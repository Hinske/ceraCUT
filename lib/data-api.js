/**
 * CeraCUT Data-API V1.0
 * REST-Endpunkte für Teile, Pläne, Bleche, Aufträge, Materialien, Technologien.
 * Wird von server.js eingehängt; Login-Gating erfolgt dort (currentUser wird übergeben).
 *
 *   /api/parts            GET (Filter) · POST (anlegen)
 *   /api/parts/import     POST { parts:[...] } → Ergebnis je Teil
 *   /api/parts/:id        GET (?rev=N) · PUT (If-Match) · DELETE
 *   /api/parts/:id/revision   POST → neue Revision (revision+1, alte Fassung in Historie)
 *   /api/parts/:id/revisions  GET → Liste der Historien-Revisionen
 *   /api/plans[/:id]      wie parts (ohne Historie)
 *   /api/sheets|orders|materials|technologies[/:id]   GET · POST · PUT · DELETE
 *   /api/technology/resolve?machine=&material=&thickness=
 *
 * Konflikte: PUT/DELETE mit Header `If-Match: <version>` → 409 bei Abweichung.
 * Listen-Collections (sheets, orders, materials, technologies): If-Match gilt für die Collection-Version
 * (GET-Liste liefert `version`). Dokument-Collections (parts, plans): Version je Dokument (ETag).
 * Teile: PUT überschreibt die aktuelle Revision; neue Revision nur über POST /:id/revision.
 * Schreiben von materials/technologies (enthalten Preise): nur Rolle 'admin'.
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-dataapi
 *
 * (c) Cerasell GmbH
 */

const { StoreError, assertId } = require('./store');
const { readJSONBody } = require('./auth');
const PlanCost = require('../js/cost-plan.js');
if (typeof global.CeraJetEngine === 'undefined') global.CeraJetEngine = require('../js/cerajet-engine.js');

const MAX_BODY = 10 * 1024 * 1024; // Teile mit Geometrie + Thumbnail
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;
const ADMIN_WRITE = new Set(['materials', 'technologies']);

const STATUS = { BAD_ID: 400, BAD_DOC: 400, NOT_FOUND: 404, CONFLICT: 409, EXISTS: 409, CORRUPT: 500 };

function sendJSON(res, code, data, headers = {}) {
    const body = JSON.stringify(data);
    res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        ...headers
    });
    res.end(body);
}

function sendError(res, err) {
    if (err instanceof StoreError) {
        return sendJSON(res, STATUS[err.code] || 500, { error: err.message, code: err.code });
    }
    if (err && (err.message === 'Ungültiges JSON' || err.message === 'Request-Body zu groß')) {
        return sendJSON(res, err.message === 'Ungültiges JSON' ? 400 : 413, { error: err.message });
    }
    console.error('[Data-API] Fehler:', err);
    return sendJSON(res, 500, { error: 'Interner Serverfehler' });
}

function ifMatch(req) {
    const h = req.headers['if-match'];
    if (h === undefined) return undefined;
    const n = Number(String(h).replace(/"/g, ''));
    return Number.isInteger(n) ? n : NaN;
}

const etag = doc => (doc && doc.version !== undefined ? { ETag: `"${doc.version}"` } : {});
const lc = v => String(v ?? '').toLowerCase();
const num = v => (v === undefined || v === '' ? undefined : Number(v));

// ── Filter ───────────────────────────────────────────────────────────

function textMatch(q, ...fields) {
    if (!q) return true;
    const needle = lc(q);
    return fields.some(f => lc(f).includes(needle));
}

const FILTERS = {
    parts: (q) => p => textMatch(q.q, p.name, p.orderId, p.customer, p.commission, p.partId)
        && (!q.customer || lc(p.customer) === lc(q.customer))
        && (!q.orderId || p.orderId === q.orderId)
        && (!q.status || p.status === q.status)
        && (q.material === undefined || String(p.technologyRef?.materialId) === q.material)
        && (!q.machine || p.technologyRef?.machineId === q.machine)
        && (q.thickness === undefined || p.technologyRef?.thickness === num(q.thickness)),
    plans: (q) => p => textMatch(q.q, p.planId, p.comment)
        && (!q.machine || p.machineId === q.machine)
        && (q.material === undefined || String(p.materialId) === q.material)
        && (q.thickness === undefined || p.thickness === num(q.thickness)),
    sheets: (q) => s => textMatch(q.q, s.name, s.sheetId)
        && (q.material === undefined || String(s.materialId) === q.material)
        && (q.thickness === undefined || s.thickness === num(q.thickness))
        && (q.remnant === undefined || String(!!s.remnant) === q.remnant),
    orders: (q) => o => textMatch(q.q, o.orderId, o.partId, o.customer, o.commission)
        && (!q.customer || lc(o.customer) === lc(q.customer))
        && (!q.status || o.status === q.status)
        && (!q.machine || o.machineId === q.machine)
        && (q.material === undefined || String(o.materialId) === q.material)
        && (q.thickness === undefined || o.thickness === num(q.thickness)),
    materials: (q) => m => textMatch(q.q, m.name) && (!q.cat || m.cat === q.cat),
    technologies: (q) => t => (q.material === undefined || String(t.materialId) === q.material)
        && (!q.machine || t.machineId === q.machine)
        && (q.thickness === undefined || t.thickness === num(q.thickness))
};

/** Listenansicht: schwere Felder weglassen (Geometrie, CAM-Overrides, Instanzen). */
function summarize(name, doc) {
    if (name === 'parts') {
        const { geometry, cam, ...rest } = doc;
        return { ...rest, bbox: geometry?.bbox, netArea: geometry?.netArea,
                 cutLength: geometry?.cutLength, piercings: geometry?.piercings };
    }
    if (name === 'plans') {
        const { instances, demand, cutOrder, remnants, ...rest } = doc;
        return { ...rest, instanceCount: Array.isArray(instances) ? instances.length : 0 };
    }
    return doc;
}

function paginate(items, query) {
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(query.offset, 10) || 0, 0);
    return { total: items.length, limit, offset, items: items.slice(offset, offset + limit) };
}

// ── Technologie-Auflösung ────────────────────────────────────────────

/**
 * Wirksamen Technologie-Datensatz finden:
 * Material muss passen; Maschine: exakt > ohne Maschine (Default); Dicke: exakt > nächste.
 * @returns {{technology:object, exact:boolean}|null}
 */
function resolveTechnology(technologies, { machineId, materialId, thickness }) {
    const sameMat = technologies.filter(t => String(t.materialId) === String(materialId));
    if (!sameMat.length) return null;
    const byMachine = machineId ? sameMat.filter(t => t.machineId === machineId) : [];
    const pool = byMachine.length ? byMachine : sameMat.filter(t => !t.machineId);
    const cand = pool.length ? pool : (machineId ? [] : sameMat);
    if (!cand.length) return null;
    const th = Number(thickness);
    let best = null;
    for (const t of cand) {
        const d = Math.abs(t.thickness - th);
        if (!best || d < best.d) best = { t, d };
    }
    return { technology: best.t, exact: best.d === 0 };
}

// ── Router ───────────────────────────────────────────────────────────

/**
 * @returns {boolean|Promise<boolean>} true, wenn die Route zu dieser API gehört (Antwort gesendet/in Arbeit)
 */
function handleDataApi(req, res, pathname, query, currentUser, stores) {
    const seg = pathname.split('/').filter(Boolean);
    if (seg[0] !== 'api') return false;
    const root = seg[1];
    const known = ['parts', 'plans', 'sheets', 'orders', 'materials', 'technologies', 'technology', 'reports'];
    if (!known.includes(root)) return false;

    if (!currentUser) { sendJSON(res, 401, { error: 'Nicht angemeldet' }); return true; }

    return (async () => {
        try {
            await route(req, res, seg, query, currentUser, stores);
        } catch (err) {
            sendError(res, err);
        }
        return true;
    })();
}

async function route(req, res, seg, query, user, stores) {
    const [, root, id, sub] = seg;
    const m = req.method;
    const isWrite = m !== 'GET' && m !== 'HEAD';

    // /api/technology/resolve
    if (root === 'technology') {
        if (id !== 'resolve' || m !== 'GET' || seg.length !== 3) return sendJSON(res, 404, { error: 'Unbekannte Route' });
        if (query.material === undefined || query.thickness === undefined || !Number.isFinite(Number(query.thickness))) {
            return sendJSON(res, 400, { error: 'material und thickness (Zahl) erforderlich' });
        }
        const r = resolveTechnology(stores.technologies.all(),
            { machineId: query.machine, materialId: query.material, thickness: query.thickness });
        if (!r) return sendJSON(res, 404, { error: 'Keine Technologie für dieses Material' });
        const material = (() => { try { return stores.materials.get(query.material); } catch { return null; } })();
        return sendJSON(res, 200, { ...r, material });
    }

    if (root === 'reports') return reportRoute(req, res, seg, stores);

    if (isWrite && ADMIN_WRITE.has(root) && user.role !== 'admin') {
        return sendJSON(res, 403, { error: 'Nur für Admins' });
    }

    if (id !== undefined && !(root === 'parts' && id === 'import')) assertId(id); // 400 statt stiller 404 bei Pfad-Tricks
    const store = stores[root];
    const isDoc = root === 'parts' || root === 'plans';
    const idField = store.idField;
    const opts = () => ({ expectedVersion: ifMatch(req), user: user.username });
    const checkIfMatch = () => {
        const v = ifMatch(req);
        if (Number.isNaN(v)) { sendJSON(res, 400, { error: 'If-Match muss eine Versionsnummer sein' }); return false; }
        return true;
    };

    // ── Collection ──
    if (id === undefined) {
        if (m === 'GET') {
            const all = isDoc ? store.list() : store.all();
            const filtered = all.filter(FILTERS[root](query));
            const page = paginate(filtered, query);
            page.items = page.items.map(d => summarize(root, d));
            if (!isDoc) page.version = store.version(); // Collection-Version für If-Match bei PUT/DELETE
            return sendJSON(res, 200, page);
        }
        if (m === 'POST') {
            const body = await readJSONBody(req, MAX_BODY);
            const saved = isDoc
                ? await store.put(body, { createOnly: true, user: user.username })
                : await createListItem(store, body, user);
            return sendJSON(res, 201, saved, etag(saved));
        }
        return sendJSON(res, 405, { error: 'Methode nicht erlaubt' });
    }

    // /api/parts/import
    if (root === 'parts' && id === 'import' && seg.length === 3) {
        if (m !== 'POST') return sendJSON(res, 405, { error: 'Methode nicht erlaubt' });
        const body = await readJSONBody(req, MAX_BODY * 3);
        if (!Array.isArray(body.parts)) return sendJSON(res, 400, { error: 'parts[] erforderlich' });
        const results = [];
        for (const p of body.parts) {
            try {
                const saved = await store.put(p, { createOnly: !body.overwrite, user: user.username });
                results.push({ partId: saved.partId, ok: true, version: saved.version });
            } catch (err) {
                if (!(err instanceof StoreError)) throw err;
                results.push({ partId: p && p.partId, ok: false, code: err.code, error: err.message });
            }
        }
        const ok = results.filter(r => r.ok).length;
        return sendJSON(res, ok === results.length ? 200 : 207,
            { total: results.length, saved: ok, failed: results.length - ok, results });
    }

    // ── Sub-Ressourcen von Teilen ──
    if (root === 'parts' && sub !== undefined) {
        if (sub === 'revisions' && m === 'GET') {
            const cur = store.get(id);
            return sendJSON(res, 200, { partId: id, current: cur.revision, history: store.revisions(id) });
        }
        if (sub === 'revision' && m === 'POST') {
            if (!checkIfMatch()) return;
            const body = await readJSONBody(req, MAX_BODY);
            const prev = store.get(id);
            const saved = await store.put({ ...body, partId: id, revision: (prev.revision || 1) + 1 }, opts());
            return sendJSON(res, 200, saved, etag(saved));
        }
        return sendJSON(res, 404, { error: 'Unbekannte Route' });
    }
    if (sub !== undefined) return sendJSON(res, 404, { error: 'Unbekannte Route' });

    // ── Einzelnes Dokument ──
    if (m === 'GET') {
        if (root === 'parts' && query.rev !== undefined) {
            const rev = Number(query.rev);
            if (!Number.isInteger(rev) || rev < 1) return sendJSON(res, 400, { error: 'rev ungültig' });
            const cur = store.get(id);
            return sendJSON(res, 200, cur.revision === rev ? cur : store.getRevision(id, rev));
        }
        const doc = store.get(id);
        return sendJSON(res, 200, doc, etag(doc));
    }
    if (m === 'PUT') {
        if (!checkIfMatch()) return;
        const body = await readJSONBody(req, MAX_BODY);
        if (!body || String(body[idField]) !== String(id)) {
            return sendJSON(res, 400, { error: `${idField} im Body muss der URL-ID entsprechen` });
        }
        if (isDoc) {
            const saved = await store.put(body, opts());
            return sendJSON(res, 200, saved, etag(saved));
        }
        const saved = await store.upsert(body, opts());
        return sendJSON(res, 200, saved);
    }
    if (m === 'DELETE') {
        if (!checkIfMatch()) return;
        if (isDoc) await store.delete(id, { expectedVersion: ifMatch(req) });
        else await store.remove(id, { expectedVersion: ifMatch(req) });
        return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 405, { error: 'Methode nicht erlaubt' });
}

// ── Kalkulation / PDF ────────────────────────────────────────────────

/** Plan (gespeichert per planId oder inline) + Teile (exakte Revision) + Technologie/Material laden. */
function loadCostInputs(body, stores) {
    let plan = body.plan;
    if (!plan) {
        if (!body.planId) throw new StoreError('BAD_DOC', 'planId oder plan erforderlich');
        plan = stores.plans.get(body.planId);
    }
    if (!plan || !Array.isArray(plan.instances) || !plan.sheet || !(plan.sheet.width > 0) || !(plan.sheet.length > 0)) {
        throw new StoreError('BAD_DOC', 'Ungültiger Plan (instances/sheet fehlen)');
    }
    if (plan.instances.length > 20000) throw new StoreError('BAD_DOC', 'Plan zu groß');
    const partsMap = {};
    for (const k of new Set(plan.instances.map(i => `${i.partId}@${i.revision}`))) {
        const [id, rev] = k.split('@');
        let part = stores.parts.get(id);
        if (part.revision !== Number(rev)) { try { part = stores.parts.getRevision(id, Number(rev)); } catch { /* aktuelle Fassung */ } }
        partsMap[k] = part;
        partsMap[id] = partsMap[id] || part;
    }
    if (plan.materialId === null || plan.materialId === undefined) {
        throw new StoreError('BAD_DOC', 'Plan hat kein einheitliches Material/Dicke — Kalkulation nicht möglich');
    }
    let material = {};
    try { material = stores.materials.get(plan.materialId); } catch { /* Richtwerte */ }
    const r = resolveTechnology(stores.technologies.all(), { machineId: plan.machineId, materialId: plan.materialId, thickness: plan.thickness });
    return { plan, partsMap, material, tech: r ? r.technology : { materialId: plan.materialId }, techExact: r ? r.exact : false };
}

async function reportRoute(req, res, seg, stores) {
    const what = seg[2];
    if (req.method !== 'POST' || seg.length !== 3 || !['cost', 'cost-pdf'].includes(what)) {
        return sendJSON(res, 404, { error: 'Unbekannte Route' });
    }
    const body = await readJSONBody(req, MAX_BODY);
    const { plan, partsMap, material, tech, techExact } = loadCostInputs(body, stores);
    const result = PlanCost.calculate(plan, partsMap, tech, material, { include: { labor: !!body.labor, ...(body.include || {}) } });
    if (what === 'cost') return sendJSON(res, 200, { ...result, techId: tech.technologyId || null, techExact });

    const { costPdf } = require('./report-pdf');
    const pdf = await costPdf(plan, partsMap, result, { machine: plan.machineId, material: material.name, sheetIndex: Number(body.sheetIndex) || 0 });
    const name = `Kalkulation_${String(plan.planId || 'PLAN').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length,
        'Content-Disposition': `attachment; filename="${name}"` });
    res.end(pdf);
}

/** POST auf Listen-Collection: bei vorhandener ID 409 statt stillem Überschreiben. */
async function createListItem(store, body, user) {
    const idv = body && body[store.idField];
    if (idv !== undefined && store.all().some(i => String(i[store.idField]) === String(idv))) {
        throw new StoreError('EXISTS', `${idv} existiert bereits`);
    }
    return store.upsert(body, { user: user.username });
}

module.exports = { handleDataApi, resolveTechnology };
