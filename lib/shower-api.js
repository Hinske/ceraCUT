/**
 * CeraCUT Duschboard-API V0.1
 *   /api/shower/projects            GET (?q= Wildcard-Filter) · POST (anlegen)
 *   /api/shower/projects/:id        GET · PUT (If-Match) · DELETE (Ersteller oder Admin)
 *   /api/shower/pdf                 POST { input, override?, variantIds[], options?, meta? } -> application/pdf
 *
 * Projekt = gespeicherter Dialogstand eines Duschboards (Standard-Duschboards, Kundenprojekte), gemeinsam fuer alle Benutzer.
 * Ablage: data/shower-boards/<id>.json (DocCollection, atomar, versioniert). Login-Pflicht.
 *
 * Created: 2026-11-07
 * Build: 20261107-showerapi
 *
 * (c) Cerasell GmbH
 */

const path = require('path');
const { DocCollection, StoreError } = require('./store');
const { readJSONBody } = require('./auth');
const Wildcard = require('../js/wildcard');

const MAX_BODY = 1024 * 1024;
const STATUS = { BAD_ID: 400, BAD_DOC: 400, NOT_FOUND: 404, CONFLICT: 409, EXISTS: 409, CORRUPT: 500 };
const collections = new Map();

function projects(dataDir) {
    if (!collections.has(dataDir)) collections.set(dataDir, new DocCollection(path.join(dataDir, 'shower-boards'), { idField: 'id' }));
    return collections.get(dataDir);
}

function sendJSON(res, code, data, headers = {}) {
    const body = JSON.stringify(data);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...headers });
    res.end(body);
}

function sendError(res, err) {
    if (err instanceof StoreError) return sendJSON(res, STATUS[err.code] || 500, { error: err.message, code: err.code });
    if (err && (err.message === 'Ungültiges JSON' || err.message === 'Request-Body zu groß')) {
        return sendJSON(res, err.message === 'Ungültiges JSON' ? 400 : 413, { error: err.message });
    }
    if (err && err.userError) return sendJSON(res, 400, { error: err.message });
    console.error('[Shower-API] Fehler:', err);
    return sendJSON(res, 500, { error: 'Interner Serverfehler' });
}

const slug = name => String(name).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'duschboard';

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Projektdokument aus Request-Body (nur bekannte Felder, Groessenlimits) */
function cleanProject(body) {
    const name = str(body && body.name, 80).trim();
    if (!name) { const e = new Error('Projektname fehlt'); e.userError = true; throw e; }
    if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) { const e = new Error('Dialogstand (state) fehlt'); e.userError = true; throw e; }
    const state = JSON.stringify(body.state);
    if (state.length > 400 * 1024) { const e = new Error('Dialogstand zu groß'); e.userError = true; throw e; }
    return {
        name, kunde: str(body.kunde, 80).trim(), notiz: str(body.notiz, 2000),
        vorlage: !!body.vorlage,
        state: body.state,
        pdf: body.pdf && typeof body.pdf === 'object' ? body.pdf : undefined
    };
}

function summary(d) {
    const s = d.state || {};
    return { id: d.id, name: d.name, kunde: d.kunde, vorlage: !!d.vorlage, version: d.version, updatedAt: d.updatedAt, updatedBy: d.updatedBy, createdBy: d.createdBy,
        breite: s.fields && s.fields['ds-b'], tiefe: s.fields && s.fields['ds-t'] };
}

function ifMatch(req) {
    const h = req.headers['if-match'];
    if (h === undefined) return undefined;
    const n = Number(String(h).replace(/"/g, ''));
    return Number.isInteger(n) ? n : NaN;
}

async function route(req, res, seg, query, user, dataDir) {
    const col = projects(dataDir), m = req.method;
    // /api/shower/pdf
    if (seg[2] === 'pdf' && seg.length === 3) {
        if (m !== 'POST') return sendJSON(res, 405, { error: 'Methode nicht erlaubt' });
        const body = await readJSONBody(req, MAX_BODY);
        if (!body || typeof body.input !== 'object' || !Array.isArray(body.variantIds) || !body.variantIds.length) {
            return sendJSON(res, 400, { error: 'input und variantIds[] erforderlich' });
        }
        const { showerPdf } = require('./shower-pdf');
        let pdf;
        try { pdf = await showerPdf({ input: body.input, override: body.override, variantIds: body.variantIds.map(String), options: body.options, meta: { ...body.meta, ersteller: user.username } }); }
        catch (err) { return sendJSON(res, 400, { error: err.message }); }
        const nm = `Duschboard_${slug(body.meta && (body.meta.projekt || body.meta.kunde) || 'Varianten')}_Verlegevarianten.pdf`;
        res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Length': pdf.length, 'Content-Disposition': `attachment; filename="${nm}"` });
        return res.end(pdf);
    }
    if (seg[2] !== 'projects' || seg.length > 4) return sendJSON(res, 404, { error: 'Unbekannte Route' });
    const id = seg[3];
    if (id === undefined) {
        if (m === 'GET') {
            const match = Wildcard.compile(query.q);
            const items = col.list().filter(d => match(d.name, d.kunde, d.notiz)).map(summary)
                .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
            return sendJSON(res, 200, { total: items.length, items });
        }
        if (m === 'POST') {
            const body = await readJSONBody(req, MAX_BODY);
            const doc = cleanProject(body);
            let base = slug(doc.name), idv = base, n = 2;
            while (col.exists(idv)) idv = `${base}-${n++}`;
            const saved = await col.put({ ...doc, id: idv, createdBy: user.username }, { createOnly: true, user: user.username });
            return sendJSON(res, 201, saved, { ETag: `"${saved.version}"` });
        }
        return sendJSON(res, 405, { error: 'Methode nicht erlaubt' });
    }
    if (m === 'GET') { const d = col.get(id); return sendJSON(res, 200, d, { ETag: `"${d.version}"` }); }
    if (m === 'PUT') {
        const v = ifMatch(req);
        if (Number.isNaN(v)) return sendJSON(res, 400, { error: 'If-Match muss eine Versionsnummer sein' });
        const prev = col.get(id);
        const body = await readJSONBody(req, MAX_BODY);
        const saved = await col.put({ ...cleanProject(body), id, createdBy: prev.createdBy }, { expectedVersion: v, user: user.username });
        return sendJSON(res, 200, saved, { ETag: `"${saved.version}"` });
    }
    if (m === 'DELETE') {
        const prev = col.get(id);
        if (user.role !== 'admin' && prev.createdBy && prev.createdBy !== user.username) return sendJSON(res, 403, { error: 'Nur Ersteller oder Admin darf löschen' });
        await col.delete(id, { expectedVersion: ifMatch(req) });
        return sendJSON(res, 200, { ok: true });
    }
    return sendJSON(res, 405, { error: 'Methode nicht erlaubt' });
}

/** @returns {boolean|Promise<boolean>} true, wenn die Route zu dieser API gehoert */
function handleShowerApi(req, res, pathname, query, currentUser, dataDir) {
    const seg = pathname.split('/').filter(Boolean);
    if (seg[0] !== 'api' || seg[1] !== 'shower') return false;
    if (!currentUser) { sendJSON(res, 401, { error: 'Nicht angemeldet' }); return true; }
    return (async () => {
        try { await route(req, res, seg, query || {}, currentUser, dataDir); } catch (err) { sendError(res, err); }
        return true;
    })();
}

module.exports = { handleShowerApi, slug, cleanProject };
