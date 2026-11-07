/**
 * CeraCUT Nesting Plan V1.0
 * Autonest für Teile aus der Teilebibliothek → Schachtelplan (Datensatz laut docs/finest-integration-konzept.md §2.1)
 *
 *   - NestingPlan     : reine Logik (DOM-frei, in Node testbar): Bedarf → Items → NestingEngine → Plan,
 *                       Instanz-Transformation (Teil + rot/tx/ty → Polylinien auf dem Blech)
 *   - AutoNestDialog  : UI "Automatisches Nesting" (Ribbon Nesting → Autonest)
 *
 * Blech: vorerst manuell (Breite × Länge). `plan.sheet.sheetId` bleibt null; sobald die Blechbibliothek
 * (/api/sheets) eine Oberfläche hat, wird dort ein sheetId eingetragen — siehe tasks/todo-finest-phase2a.md.
 * Nicht enthalten (Phase 2b): Spiegeln, Innenkontur-Belegung (True-Shape), manuelles Nesting.
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-multidisc
 * V1.6: Fix — Teile mit mehreren Außenkonturen werden als starre Einheit (konvexe Hülle) genestet, REFERENZ-Layer-Konturen wandern nicht mehr mit (Überlagerungen)
 * V1.5: Feat — Schachtelplan als PDF (Autonest-Dialog, Planliste) über /api/reports/plan-pdf
 * V1.4: Feat — Autonest im Web Worker (Fortschritt, Abbrechen), Vorschau mit Zoom/Verschieben + Große Ansicht, runAsync/prepare/finish
 * V1.3: Feat — Teil bearbeiten (Planliste „Teile", Autonest-Treffer) → part-editor.js
 * V1.2: Feat — Button „Kalkulation" (Autonest-Dialog, Planliste) → cost-dialog.js
 * V1.1: Feat — Plan öffnen (PlanOpenDialog, toDXF, loadPlanParts), „Im Editor öffnen" im Autonest-Dialog
 *
 * (c) Cerasell GmbH
 */

const NestingPlan = (() => {
    'use strict';

    const ROTATIONS = {
        none: [0],
        r90: [0, 90, 180, 270],
        r45: [0, 45, 90, 135, 180, 225, 270, 315],
        free: Array.from({ length: 36 }, (_, i) => i * 10)
    };
    const PRIORITY = { high: 1, normal: 0, low: -1 };

    const toPts = arr => arr.map(p => ({ x: p[0], y: p[1] }));

    function bbox(pts) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    function rotate(pts, deg, cx, cy) {
        if (!deg) return pts.map(p => ({ x: p.x, y: p.y }));
        const rad = deg * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
        return pts.map(p => ({ x: cx + (p.x - cx) * c - (p.y - cy) * s, y: cy + (p.x - cx) * s + (p.y - cy) * c }));
    }

    // Layer des Plattenrahmens/Nullpunkts (z. B. Waricam "REFERENZ") gehören nicht zum Teil — gleiche Regel wie PartGeometry.isReferenceLayer.
    // Schützt auch ältere, schon importierte Teile, die diese Konturen noch enthalten.
    const REF_LAYER_RE = /referenz|reference|^ref$|blech|rahmen/i;
    const partContours = part => (part.geometry?.contours || []).filter(c => !REF_LAYER_RE.test(String(c.layer || '')));

    function pip(pt, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    function convexHull(pts) {
        const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
        if (p.length < 3) return p;
        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        const lo = [], up = [];
        for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
        for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
        return lo.slice(0, -1).concat(up.slice(0, -1));
    }

    /**
     * Umriss, mit dem ein Teil genestet wird: die Außenkontur; besteht das Teil aus mehreren getrennten Außenkonturen
     * (mehrere Stücke in einer DXF), wird es als starre Einheit behandelt → konvexe Hülle aller Außenkonturen.
     * (Beim Import werden getrennte Stücke normalerweise aufgeteilt; das hier fängt ältere/bewusst zusammenhängende Teile ab.)
     * @returns {Array<{x,y}>|null}
     */
    function nestPolygon(part) {
        const discs = partContours(part).filter(c => c.role === 'disc' && c.closed).map(c => toPts(c.points));
        if (!discs.length) return null;
        const outer = discs.filter((d, i) => !discs.some((o, j) => j !== i && pip(d[0], o) && !pip(o[0], d)));   // nicht in anderer Scheibe enthalten
        if (outer.length === 1) return outer[0];
        return convexHull(outer.flat());
    }

    /** Äußerkontur des Teils: größte geschlossene 'disc'-Kontur (nach BBox-Fläche). */
    function outerContour(part) {
        let best = null, bestA = -1;
        for (const c of part.geometry?.contours || []) {
            if (c.role !== 'disc' || !c.closed) continue;
            const b = bbox(toPts(c.points));
            const a = (b.maxX - b.minX) * (b.maxY - b.minY);
            if (a > bestA) { bestA = a; best = c; }
        }
        return best;
    }

    /**
     * Teil auf dem Blech: alle Konturen um Mittelpunkt der Außenkontur drehen,
     * Außenkontur-BBox auf (0,0) schieben, dann um (tx,ty) versetzen — identisch zu NestingEngine.applyPlacements.
     * @returns {Array<{role, closed, points:[{x,y}]}>}
     */
    function placePart(part, rot, tx, ty) {
        const poly = nestPolygon(part);
        if (!poly) return [];
        const ob = bbox(poly);
        const cx = (ob.minX + ob.maxX) / 2, cy = (ob.minY + ob.maxY) / 2;
        const rb = bbox(rotate(poly, rot, cx, cy));
        return partContours(part).map(c => ({
            id: c.id, role: c.role, closed: c.closed,
            points: rotate(toPts(c.points), rot, cx, cy).map(p => ({ x: p.x - rb.minX + tx, y: p.y - rb.minY + ty }))
        }));
    }

    /**
     * @param {Array<{partId, qty, priority?:'high'|'normal'|'low', angles?:'none'|'r90'|'r45'|'free'}>} demand
     * @param {Object<string,object>} partsMap  partId → Teile-Datensatz (mit geometry)
     * @param {{width:number,length:number,partToPart:number,partToEdge:number,order?:string,maxSheets?:number}} cfg
     */
    /** Bedarf → Engine-Eingabe (Pseudo-Konturen mit gemeinsamem Punktefeld je Teil, typeKey = Teil+Revision+Drehung). */
    function prepare(demand, partsMap, cfg) {
        const errors = [];
        if (!(cfg.width > 0) || !(cfg.length > 0)) throw new Error('Blechbreite und -länge müssen > 0 sein');
        const items = [];      // Pseudo-Konturen für die Engine
        const meta = [];       // parallel zu items: {partId}
        for (const d of demand) {
            const part = partsMap[d.partId];
            const qty = Math.max(0, Math.floor(d.qty) || 0);
            if (!part) { errors.push(`${d.partId}: Teil nicht geladen`); continue; }
            const pts = nestPolygon(part);                                    // gemeinsam für alle Exemplare (kleinere Worker-Nachricht)
            if (!pts) { errors.push(`${part.name}: keine geschlossene Außenkontur`); continue; }
            const priority = PRIORITY[d.priority || 'normal'] ?? 0;
            const rotationSteps = ROTATIONS[d.angles || 'r90'] || ROTATIONS.r90;
            const typeKey = `${d.partId}@${part.revision}|${d.angles || 'r90'}`;
            for (let i = 0; i < qty; i++) {
                items.push({ points: pts, isClosed: true, name: part.name, priority, rotationSteps, typeKey });
                meta.push({ partId: d.partId });
            }
        }
        if (!items.length) throw new Error(errors[0] || 'Keine Teile mit Stückzahl > 0');
        const engineCfg = {
            sheetWidth: cfg.width, sheetHeight: cfg.length,
            sheetMargin: cfg.partToEdge, spacing: cfg.partToPart,
            order: cfg.order || 'large-first', maxSheets: cfg.maxSheets || 20
        };
        return { items, meta, errors, engineCfg, demand, partsMap, cfg };
    }

    /** Engine-Ergebnis → Plan-Datensatz. */
    function finish(prep, res, ms) {
        const { meta, errors, demand, partsMap, cfg, items } = prep;
        const instances = res.placements.map((pl, n) => ({
            instId: `i${n + 1}`, partId: meta[pl.contourIndex].partId,
            revision: partsMap[meta[pl.contourIndex].partId].revision,
            sheetIndex: pl.sheetIndex, tx: Math.round(pl.position.x * 1000) / 1000, ty: Math.round(pl.position.y * 1000) / 1000,
            rot: pl.rotation, mirror: false, derivedFrom: null
        }));

        const nestedByPart = {};
        for (const i of instances) nestedByPart[i.partId] = (nestedByPart[i.partId] || 0) + 1;
        const unplaced = {};
        for (const idx of res.unplaced) unplaced[meta[idx].partId] = (unplaced[meta[idx].partId] || 0) + 1;

        // Maschine/Material/Dicke nur übernehmen, wenn alle Teile übereinstimmen
        const refs = demand.map(d => partsMap[d.partId]?.technologyRef).filter(Boolean);
        const same = k => refs.length && refs.every(r => r[k] === refs[0][k]) ? refs[0][k] : null;
        const mixedTech = refs.some(r => r.materialId !== refs[0].materialId || r.thickness !== refs[0].thickness);
        const errs = mixedTech ? [...errors, 'Teile haben unterschiedliches Material/Dicke — bitte getrennt nesten'] : errors;

        return {
            plan: {
                machineId: same('machineId'), materialId: same('materialId'), thickness: same('thickness'),
                ncAllowed: true, deleteAllowed: true, comment: '',
                sheet: { sheetId: null, width: cfg.width, length: cfg.length },   // sheetId: später aus Blechbibliothek
                config: { partToPart: cfg.partToPart, partToEdge: cfg.partToEdge, order: cfg.order || 'large-first',
                          innerPlacement: 'prevent', heads: { min: 1, max: 1, distance: 0 }, rectOptimize: false },
                instances,
                demand: Object.fromEntries(demand.map(d => [d.partId, {
                    qty: d.qty, priority: d.priority || 'normal', angles: d.angles || 'r90', mirror: false }])),
                cutOrder: [], remnants: [],
                stats: { requested: items.length, nested: instances.length, unplaced: res.unplaced.length,
                         sheets: res.sheets.length, utilization: res.totalUtilization, sheetStats: res.sheets,
                         nestedByPart, unplacedByPart: unplaced, ms }
            },
            errors: errs
        };
    }

    /** Synchron (Tests, Fallback ohne Web Worker). */
    function run(demand, partsMap, cfg, onProgress) {
        if (typeof NestingEngine === 'undefined') throw new Error('NestingEngine nicht geladen');
        const prep = prepare(demand, partsMap, cfg);
        const t0 = Date.now();
        const res = NestingEngine.nest(prep.items, { ...prep.engineCfg, onProgress });
        return finish(prep, res, Date.now() - t0);
    }

    /**
     * Asynchron im Web Worker (UI bleibt bedienbar, Fortschritt, Abbruch). Ohne Worker-Unterstützung läuft es
     * synchron nach einem setTimeout — dann ohne Abbruchmöglichkeit.
     * @returns {{promise:Promise<{plan,errors}>, cancel:Function}}
     */
    function runAsync(demand, partsMap, cfg, { onProgress, workerUrl } = {}) {
        const prep = prepare(demand, partsMap, cfg);
        const t0 = Date.now();
        let worker = null, rejectFn = null, cancelled = false;
        const promise = new Promise((resolve, reject) => {
            rejectFn = reject;
            const canWorker = typeof Worker !== 'undefined' && workerUrl;
            if (!canWorker) {
                setTimeout(() => {
                    try { resolve(finish(prep, NestingEngine.nest(prep.items, { ...prep.engineCfg, onProgress }), Date.now() - t0)); }
                    catch (e) { reject(e); }
                }, 20);
                return;
            }
            try { worker = new Worker(workerUrl); } catch (e) { return reject(e); }
            worker.onmessage = e => {
                const m = e.data;
                if (m.type === 'progress') onProgress?.(m.done, m.total, m.sheets);
                else if (m.type === 'done') { worker.terminate(); resolve(finish(prep, m.res, Date.now() - t0)); }
                else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
            };
            worker.onerror = e => { worker.terminate(); reject(new Error(e.message || 'Worker-Fehler')); };
            worker.postMessage({ items: prep.items, cfg: prep.engineCfg });
        });
        return {
            promise,
            cancel() { if (cancelled) return; cancelled = true; worker?.terminate(); rejectFn?.(new Error('abgebrochen')); }
        };
    }

    /** Teil zur Instanz: exakte Revision (`partId@rev`) bevorzugt, sonst aktuelles Teil. */
    function partFor(partsMap, inst) {
        return partsMap[`${inst.partId}@${inst.revision}`] || partsMap[inst.partId];
    }

    /** Alle Instanzen eines Blechs als Polylinien (für Vorschau/Simulation). */
    function sheetPolylines(plan, partsMap, sheetIndex = 0) {
        return plan.instances.filter(i => (i.sheetIndex || 0) === sheetIndex).flatMap(i => {
            const part = partFor(partsMap, i);
            return part ? placePart(part, i.rot, i.tx, i.ty).map(c => ({ ...c, instId: i.instId, partId: i.partId })) : [];
        });
    }

    /**
     * Blech eines Plans als DXF (R12, POLYLINE): Blechumriss auf Layer BLECH (wird als Referenz erkannt),
     * Teile auf Layer 0. Wird wie eine geöffnete Datei in einen neuen Tab geladen.
     */
    function toDXF(plan, partsMap, sheetIndex = 0) {
        const out = ['0', 'SECTION', '2', 'ENTITIES'];
        const poly = (layer, pts) => {
            out.push('0', 'POLYLINE', '8', layer, '66', '1', '70', '1');
            for (const p of pts) out.push('0', 'VERTEX', '8', layer, '10', String(Math.round(p.x * 1e4) / 1e4), '20', String(Math.round(p.y * 1e4) / 1e4));
            out.push('0', 'SEQEND', '8', layer);
        };
        const W = plan.sheet.width, L = plan.sheet.length;
        poly('BLECH', [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: L }, { x: 0, y: L }]);
        for (const c of sheetPolylines(plan, partsMap, sheetIndex)) if (c.closed) poly('0', c.points);
        out.push('0', 'ENDSEC', '0', 'EOF');
        return out.join('\n') + '\n';
    }

    const COLORS = ['#0078d4', '#22c55e', '#e8a020', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#64748b'];

    /** Blech als SVG-Inhalt für ZoomPane/PartViewer: Koordinaten (x, -y) (y nach oben), Konturstärke konstant, Farbe je Teil. */
    function sheetContent(plan, partsMap, sheetIndex = 0) {
        const W = plan.sheet.width, L = plan.sheet.length;
        const partIds = Object.keys(plan.demand);
        const r2 = v => Math.round(v * 100) / 100;
        const paths = sheetPolylines(plan, partsMap, sheetIndex).map(c => {
            const d = c.points.map((p, k) => `${k ? 'L' : 'M'}${r2(p.x)} ${r2(-p.y)}`).join('') + (c.closed ? 'Z' : '');
            const col = COLORS[partIds.indexOf(c.partId) % COLORS.length];
            return `<path d="${d}" stroke="${col}" ${c.role === 'disc' ? `fill="${col}" fill-opacity="0.15"` : 'fill="#fff"'} stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
        }).join('');
        const outline = `<rect x="0" y="${-L}" width="${W}" height="${L}" fill="#fff" stroke="#888" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
        return { svgInner: outline + paths, box: { x: 0, y: -L, w: W, h: L } };
    }

    /** Legende (Teil → Farbe, Menge auf diesem Blech) als HTML für den Vorschau-Dialog. */
    function sheetLegend(plan, partsMap, sheetIndex = 0) {
        const partIds = Object.keys(plan.demand);
        const cnt = {};
        for (const i of plan.instances) if ((i.sheetIndex || 0) === sheetIndex) cnt[i.partId] = (cnt[i.partId] || 0) + 1;
        const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        return '<div style="margin-top:10px;color:#666">Teile auf diesem Blech</div>' + partIds.filter(id => cnt[id]).map(id => {
            const p = partsMap[id] || partsMap[Object.keys(partsMap).find(k => k.startsWith(id + '@'))];
            return `<div><span style="display:inline-block;width:12px;height:12px;border:2px solid ${COLORS[partIds.indexOf(id) % COLORS.length]};vertical-align:middle"></span> ${esc(p?.name || id)} <b>× ${cnt[id]}</b></div>`;
        }).join('');
    }

    function previewSvg(plan, partsMap, sheetIndex = 0) {
        const W = plan.sheet.width, L = plan.sheet.length;
        const partIds = Object.keys(plan.demand);
        const colors = ['#0078d4', '#22c55e', '#e8a020', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#64748b'];
        const paths = sheetPolylines(plan, partsMap, sheetIndex).map(c => {
            const d = c.points.map((p, k) => `${k ? 'L' : 'M'}${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`).join('') + (c.closed ? 'Z' : '');
            const col = colors[partIds.indexOf(c.partId) % colors.length];
            return `<path d="${d}" stroke="${col}" ${c.role === 'disc' ? `fill="${col}" fill-opacity="0.15"` : 'fill="#fff"'} stroke-width="${Math.max(W, L) / 600}"/>`;
        }).join('');
        // y-Achse nach oben: Gruppe spiegeln
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${W * 0.01} -${L * 0.01} ${W * 1.02} ${L * 1.02}" style="width:100%;max-height:340px;background:#fafafa">`
             + `<g transform="translate(0 ${L}) scale(1 -1)"><rect x="0" y="0" width="${W}" height="${L}" fill="#fff" stroke="#888" stroke-width="${Math.max(W, L) / 400}"/>${paths}</g></svg>`;
    }

    return { run, runAsync, prepare, finish, sheetContent, sheetLegend, placePart, nestPolygon, partFor, sheetPolylines, toDXF, previewSvg, outerContour, ROTATIONS, PRIORITY };
})();

/** Alle Teile eines Plans in exakter Revision laden → Map `partId@rev`. */
async function loadPlanParts(plan) {
    const map = {}, warn = [];
    const keys = [...new Set(plan.instances.map(i => `${i.partId}@${i.revision}`))];
    await Promise.all(keys.map(async k => {
        const [id, rev] = k.split('@');
        try { map[k] = await PartLibrary.get(id, Number(rev)); }
        catch (e) { warn.push(`${id} (Rev. ${rev}): ${e.message}`); }
    }));
    return { map, warn };
}

/** Sheet eines Plans in neuem Tab öffnen (wie eine geladene DXF-Datei). */
function openPlanSheet(app, plan, partsMap, sheetIndex = 0) {
    const dxf = NestingPlan.toDXF(plan, partsMap, sheetIndex);
    const sheets = plan.stats?.sheets || 1;
    const name = `${plan.planId || 'PLAN'}${sheets > 1 ? '_B' + (sheetIndex + 1) : ''}.dxf`;
    if (!app?.loadDXFContent) throw new Error('App nicht bereit');
    app.loadDXFContent(name, dxf, (dxf.length / 1024).toFixed(1));
    return name;
}

/** Schachtelplan als PDF vom Server holen und speichern (planId = gespeicherter Plan, plan = ungespeichert). */
async function downloadPlanPdf(app, source) {
    try {
        const r = await fetch('/api/reports/plan-pdf', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(source.planId ? { planId: source.planId } : { plan: source.plan }) });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
        const blob = await r.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Schachtelplan_${String(source.planId || source.plan?.planId || 'PLAN').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) { app?.showToast?.(`PDF fehlgeschlagen: ${e.message}`, 'error'); }
}

// ═══════════════════════════════════════════════════════════════════
// Dialog
// ═══════════════════════════════════════════════════════════════════

class AutoNestDialog {
    constructor(app) {
        this.app = app;
        this.overlay = null;
        this.rows = [];          // {part (Listenansicht), full (mit Geometrie) | null, qty, priority, angles}
        this.result = null;
        this.partsMap = {};
        this.sheetIndex = 0;
    }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }

    open() {
        if (this.overlay) return;
        const ov = document.createElement('div');
        ov.className = 'modal-overlay autonest-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="min-width:980px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>Automatisches Nesting</span><button class="cldcl-close" data-act="close">×</button></div>
            <div class="cldcl-body" style="overflow:auto">
                <div style="display:flex;gap:12px">
                    <div style="flex:1.3;min-width:0">
                        <div class="cldcl-row"><b>Teile aus der Bibliothek</b>
                            <input id="an-q" type="text" placeholder="Suchen (Name, Auftrag, Kunde)" style="flex:1">
                            <button data-act="search">Suchen</button></div>
                        <div id="an-hits" style="max-height:110px;overflow:auto;border:1px solid #bbb;font-size:11px;margin:4px 0"></div>
                        <table style="width:100%;border-collapse:collapse;font-size:11px">
                            <thead><tr style="background:#e8eef5;text-align:left"><th>Teil</th><th>B × L</th><th>Menge</th><th>Priorität</th><th>Drehung</th><th>Genestet</th><th></th></tr></thead>
                            <tbody id="an-rows"></tbody></table>
                    </div>
                    <div style="flex:.8;min-width:260px;font-size:11px">
                        <div class="cldcl-row"><label>Blech Breite</label><input id="an-w" type="number" min="1" value="3000" style="width:80px"> mm</div>
                        <div class="cldcl-row"><label>Blech Länge</label><input id="an-l" type="number" min="1" value="1500" style="width:80px"> mm</div>
                        <div class="cldcl-row"><label>Teil–Teil</label><input id="an-pp" type="number" min="0" step="0.5" value="3" style="width:80px"> mm</div>
                        <div class="cldcl-row"><label>Teil–Rand</label><input id="an-pe" type="number" min="0" step="0.5" value="5" style="width:80px"> mm</div>
                        <div class="cldcl-row"><label>Reihenfolge</label>
                            <select id="an-order"><option value="large-first">Große Teile zuerst</option><option value="small-first">Kleine Teile zuerst</option><option value="input">Wie aufgelistet</option></select></div>
                        <div class="cldcl-row"><label>Max. Bleche</label><input id="an-max" type="number" min="1" max="100" value="5" style="width:80px"></div>
                        <div style="color:#888;margin-top:6px">Blech vorerst von Hand; Auswahl aus der Blechbibliothek folgt.</div>
                    </div>
                </div>
                <div class="cldcl-row"><button data-act="run" id="an-run" style="font-weight:600">Nesting starten</button>
                    <button data-act="cancel" id="an-cancel" style="display:none">Abbrechen</button>
                    <progress id="an-progress" max="100" value="0" style="display:none;width:180px"></progress>
                    <span id="an-status" style="font-size:11px;color:#444"></span>
                    <select id="an-sheet" style="margin-left:auto;display:none"></select></div>
                <div class="cldcl-row" id="an-zoombar" style="display:none;gap:6px;font-size:11px">
                    <button data-act="zin" title="Vergrößern">＋</button><button data-act="zout" title="Verkleinern">－</button>
                    <button data-act="fit">Einpassen</button><button data-act="big" title="Große Ansicht mit Zoom in eigenem Fenster">Große Ansicht</button>
                    <span id="an-zoom" style="color:#555"></span>
                    <span style="margin-left:auto;color:#888">Mausrad: Zoom · Ziehen: Verschieben · Doppelklick: Einpassen</span></div>
                <div id="an-preview" style="height:340px;background:#fafafa;border:1px solid #ddd;display:none;position:relative"></div>
                <div id="an-stats" style="font-size:11px;color:#444"></div>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="pdf" title="Schachtelplan als PDF (alle Bleche + Teileliste)">Plan als PDF</button>
                <button data-act="cost" title="Kostenkalkulation für das aktuelle Nesting-Ergebnis">Kalkulation</button>
                <button data-act="edit" title="Aktuelles Blech ungespeichert im Editor öffnen">Im Editor öffnen</button>
                <input id="an-name" type="text" placeholder="Planname" style="width:180px;text-transform:uppercase">
                <button data-act="save">Plan speichern</button>
                <button data-act="close">Schließen</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            const i = e.target.closest('[data-i]')?.dataset.i;
            ({ close: () => this.close(), search: () => this._search(), run: () => this._run(), save: () => this._save(), edit: () => this._openInEditor(), cost: () => this._cost(),
               pdf: () => this._pdf(), cancel: () => this._cancel(), zin: () => this.pane?.zoomAt(1.4), zout: () => this.pane?.zoomAt(1 / 1.4), fit: () => this.pane?.reset(), big: () => this._bigView(),
               add: () => this._addPart(e.target.closest('[data-pid]').dataset.pid),
               editpart: () => PartEditor.openPart(this.app, e.target.closest('[data-pid]').dataset.pid).then(() => this.close()).catch(err => this._toast(`Öffnen fehlgeschlagen: ${err.message}`, 'error')),
               del: () => { this.rows.splice(Number(i), 1); this._renderRows(); } }[act] || (() => {}))();
        });
        ov.querySelector('#an-q').addEventListener('keydown', e => { if (e.key === 'Enter') this._search(); });
        ov.querySelector('#an-rows').addEventListener('input', e => {
            const r = this.rows[Number(e.target.closest('tr')?.dataset.i)]; if (!r) return;
            const f = e.target.dataset.f;
            if (f === 'qty') r.qty = Math.max(0, parseInt(e.target.value, 10) || 0);
            if (f === 'priority') r.priority = e.target.value;
            if (f === 'angles') r.angles = e.target.value;
        });
        ov.querySelector('#an-sheet').addEventListener('change', e => { this.sheetIndex = Number(e.target.value); this._renderPreview(); });
        this._search();
        this._renderRows();
    }

    close() { this.job?.cancel(); this.pane?.destroy(); this.pane = null; this.overlay?.remove(); this.overlay = null; this.result = null; }

    async _search() {
        const q = this.overlay.querySelector('#an-q').value.trim();
        try {
            const r = await PartLibrary.search({ q, limit: 50 });
            this.overlay.querySelector('#an-hits').innerHTML = r.items.length ? r.items.map(p =>
                `<div data-pid="${this._esc(p.partId)}" style="display:flex;gap:8px;padding:2px 6px;border-bottom:1px solid #eee;align-items:center">
                    <span style="flex:1">${this._esc(p.name)} <span style="color:#888">· ${this._esc(p.orderId)} · ${p.bbox ? p.bbox.w + '×' + p.bbox.l : ''}</span></span>
                    <button data-act="editpart" title="Teil im CAD-Editor bearbeiten">Bearbeiten</button> <button data-act="add">+</button></div>`).join('') : '<div style="padding:6px;color:#888">Keine Teile gefunden</div>';
        } catch (e) { this._toast(`Teilesuche fehlgeschlagen: ${e.message}`, 'error'); }
    }

    async _addPart(partId) {
        if (this.rows.some(r => r.partId === partId)) return this._toast('Teil ist bereits in der Liste', 'info');
        try {
            const full = await PartLibrary.get(partId);
            this.partsMap[partId] = full;
            this.rows.push({ partId, qty: full.qty || 1, priority: 'normal', angles: 'r90' });
            this._renderRows();
        } catch (e) { this._toast(`Teil nicht ladbar: ${e.message}`, 'error'); }
    }

    _renderRows() {
        const nested = this.result?.plan.stats.nestedByPart || {};
        this.overlay.querySelector('#an-rows').innerHTML = this.rows.map((r, i) => {
            const p = this.partsMap[r.partId];
            const sel = (v, opts) => opts.map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${t}</option>`).join('');
            return `<tr data-i="${i}" style="border-top:1px solid #ddd"><td>${this._esc(p.name)}</td><td>${p.geometry.bbox.w}×${p.geometry.bbox.l}</td>
                <td><input data-f="qty" type="number" min="0" value="${r.qty}" style="width:55px"></td>
                <td><select data-f="priority">${sel(r.priority, [['high', 'Hoch'], ['normal', 'Normal'], ['low', 'Niedrig']])}</select></td>
                <td><select data-f="angles">${sel(r.angles, [['none', 'Keine'], ['r90', '90°'], ['r45', '45°'], ['free', 'Frei (10°)']])}</select></td>
                <td>${this.result ? `${nested[r.partId] || 0}/${r.qty}` : ''}</td>
                <td><button data-act="del">×</button></td></tr>`;
        }).join('');
    }

    _cfg() {
        const n = id => parseFloat(this.overlay.querySelector('#' + id).value);
        return { width: n('an-w'), length: n('an-l'), partToPart: n('an-pp') || 0, partToEdge: n('an-pe') || 0,
                 order: this.overlay.querySelector('#an-order').value, maxSheets: parseInt(this.overlay.querySelector('#an-max').value, 10) || 5 };
    }

    /** Worker-URL (Cache-Busting über die Version des eigenen Skripts). */
    _workerUrl() {
        const me = [...document.scripts].find(sc => /nesting-plan\.js/.test(sc.src));
        const v = me ? (me.src.match(/\?(v=[^&]+)/) || [])[1] : '';
        return `js/nesting-worker.js${v ? '?' + v : ''}`;
    }

    _setBusy(busy) {
        const q = id => this.overlay?.querySelector('#' + id);
        if (!this.overlay) return;
        q('an-run').disabled = busy;
        q('an-cancel').style.display = busy ? '' : 'none';
        q('an-progress').style.display = busy ? '' : 'none';
        if (busy) q('an-progress').value = 0;
    }

    _cancel() { this.job?.cancel(); }

    _run() {
        const st = this.overlay.querySelector('#an-status');
        if (this.job) return;
        if (!this.rows.length) return this._toast('Bitte zuerst Teile hinzufügen', 'warning');
        const total = this.rows.reduce((a, r) => a + Math.max(0, r.qty | 0), 0);
        st.textContent = `Rechne … 0/${total}`;
        this._setBusy(true);
        let job;
        try {
            job = NestingPlan.runAsync(this.rows, this.partsMap, this._cfg(), {
                workerUrl: typeof Worker !== 'undefined' && this.useWorker !== false ? this._workerUrl() : null,
                onProgress: (done, tot, sheets) => {
                    if (!this.overlay) return;
                    st.textContent = `Rechne … ${done}/${tot} Teile · Blech ${sheets}`;
                    const pr = this.overlay.querySelector('#an-progress'); pr.max = tot; pr.value = done;
                }
            });
        } catch (e) { this._setBusy(false); st.textContent = ''; return this._toast(`Nesting fehlgeschlagen: ${e.message}`, 'error'); }
        this.job = job;
        job.promise.then(result => {
            this.job = null;
            if (!this.overlay) return;
            this._setBusy(false);
            this.result = result;
            const s = result.plan.stats;
            st.textContent = `${s.nested}/${s.requested} Teile · ${s.sheets} Blech(e) · ${s.utilization}% Auslastung · ${(s.ms / 1000).toFixed(1)} s`;
            this.sheetIndex = 0;
            const sel = this.overlay.querySelector('#an-sheet');
            sel.innerHTML = Array.from({ length: s.sheets }, (_, i) => `<option value="${i}">Blech ${i + 1}</option>`).join('');
            sel.style.display = s.sheets > 1 ? '' : 'none';
            this._renderPreview(); this._renderRows();
            const msgs = [...result.errors];
            if (s.unplaced) msgs.push(`${s.unplaced} Teil(e) passen nicht (Blech zu klein oder Max. Bleche erreicht)`);
            this.overlay.querySelector('#an-stats').textContent = msgs.join(' · ');
        }, err => {
            this.job = null;
            if (!this.overlay) return;
            this._setBusy(false);
            st.textContent = err.message === 'abgebrochen' ? 'Abgebrochen' : '';
            if (err.message !== 'abgebrochen') this._toast(`Nesting fehlgeschlagen: ${err.message}`, 'error');
        });
    }

    _renderPreview() {
        const host = this.overlay.querySelector('#an-preview'), bar = this.overlay.querySelector('#an-zoombar');
        if (!this.result) { this.pane?.destroy(); this.pane = null; host.style.display = bar.style.display = 'none'; return; }
        host.style.display = ''; bar.style.display = 'flex';
        const content = NestingPlan.sheetContent(this.result.plan, this.partsMap, this.sheetIndex);
        if (this.pane) this.pane.setContent(content);
        else this.pane = new ZoomPane(host, { ...content, onZoom: pct => { const z = this.overlay?.querySelector('#an-zoom'); if (z) z.textContent = `Zoom ${pct} %`; } });
    }

    _bigView() {
        if (!this.result) return;
        const plan = this.result.plan, s = plan.stats;
        PartViewer.open({
            title: `Schachtelplan — Blech ${this.sheetIndex + 1}/${s.sheets}`, svg: NestingPlan.sheetContent(plan, this.partsMap, this.sheetIndex),
            legend: NestingPlan.sheetLegend(plan, this.partsMap, this.sheetIndex),
            info: [['Blech', `${plan.sheet.width} × ${plan.sheet.length} mm`], ['Teile gesamt', `${s.nested}/${s.requested}`], ['Auslastung', `${s.utilization}%`],
                   ['Abstand Teil–Teil', `${plan.config.partToPart} mm`], ['Abstand Teil–Rand', `${plan.config.partToEdge} mm`]]
        });
    }

    _pdf() {
        if (!this.result) return this._toast('Bitte zuerst Nesting starten', 'warning');
        const name = this.overlay.querySelector('#an-name').value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '_') || 'NESTING';
        downloadPlanPdf(this.app, { plan: { ...this.result.plan, planId: name } });
    }

    _cost() {
        if (!this.result) return this._toast('Bitte zuerst Nesting starten', 'warning');
        if (typeof PlanCostDialog === 'undefined') return this._toast('Kalkulation nicht geladen', 'error');
        const name = this.overlay.querySelector('#an-name').value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '_') || 'NESTING';
        PlanCostDialog.open(this.app, { plan: { ...this.result.plan, planId: name }, name });
    }

    _openInEditor() {
        if (!this.result) return this._toast('Bitte zuerst Nesting starten', 'warning');
        try {
            const name = this.overlay.querySelector('#an-name').value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '_') || 'NESTING';
            openPlanSheet(this.app, { ...this.result.plan, planId: name }, this.partsMap, this.sheetIndex);
            this.close();
        } catch (e) { this._toast(`Öffnen fehlgeschlagen: ${e.message}`, 'error'); }
    }

    async _save() {
        if (!this.result) return this._toast('Bitte zuerst Nesting starten', 'warning');
        const name = this.overlay.querySelector('#an-name').value.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '_');
        if (!name) return this._toast('Bitte einen Plannamen eingeben', 'warning');
        try {
            const r = await fetch('/api/plans', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...this.result.plan, planId: name }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(r.status === 409 ? `Plan „${name}“ existiert bereits` : d.error || `HTTP ${r.status}`);
            this._toast(`Plan ${name} gespeichert`, 'success');
        } catch (e) { this._toast(`Speichern fehlgeschlagen: ${e.message}`, 'error'); }
    }
}

class PlanOpenDialog {
    constructor(app) { this.app = app; this.overlay = null; this.items = []; }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }

    async open() {
        if (this.overlay) return;
        const ov = document.createElement('div');
        ov.className = 'modal-overlay plan-open-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="min-width:720px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>Plan öffnen</span><button class="cldcl-close" data-act="close">×</button></div>
            <div class="cldcl-body" style="overflow:auto">
                <div class="cldcl-row"><input id="po-q" type="text" placeholder="Suchen (Planname, Kommentar)" style="flex:1"><button data-act="search">Suchen</button></div>
                <table style="width:100%;border-collapse:collapse;font-size:11px">
                    <thead><tr style="background:#e8eef5;text-align:left"><th>Plan</th><th>Blech</th><th>Teile</th><th>Bleche</th><th>Auslastung</th><th>Geändert</th><th></th></tr></thead>
                    <tbody id="po-rows"></tbody></table>
                <div id="po-parts" style="font-size:11px;margin-top:6px"></div>
                <div id="po-status" style="font-size:11px;color:#444"></div>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
            if (act === 'close') this.close();
            if (act === 'search') this._search();
            if (act === 'parts') this._parts(e.target.closest('tr').dataset.id);
            if (act === 'pdf') downloadPlanPdf(this.app, { planId: e.target.closest('tr').dataset.id });
            if (act === 'editpart') this._editPart(e.target.closest('[data-pid]'));
            if (act === 'cost') PlanCostDialog.open(this.app, { planId: e.target.closest('tr').dataset.id });
            if (act === 'open') this._open(e.target.closest('tr').dataset.id, Number(e.target.closest('tr').querySelector('select')?.value || 0));
        });
        ov.querySelector('#po-q').addEventListener('keydown', e => { if (e.key === 'Enter') this._search(); });
        this._search();
    }

    close() { this.overlay?.remove(); this.overlay = null; }

    async _search() {
        try {
            const q = this.overlay.querySelector('#po-q').value.trim();
            const r = await fetch(`/api/plans?limit=200${q ? '&q=' + encodeURIComponent(q) : ''}`, { credentials: 'same-origin' });
            const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
            this.overlay.querySelector('#po-rows').innerHTML = d.items.length ? d.items.map(p => {
                const n = p.stats?.sheets || 1;
                return `<tr data-id="${this._esc(p.planId)}" style="border-top:1px solid #ddd"><td>${this._esc(p.planId)}</td>
                    <td>${p.sheet ? p.sheet.width + '×' + p.sheet.length : ''}</td><td>${p.stats?.nested ?? p.instanceCount}</td><td>${n}</td>
                    <td>${p.stats?.utilization ?? ''}%</td><td>${this._esc((p.updatedAt || '').slice(0, 16).replace('T', ' '))}</td>
                    <td>${n > 1 ? `<select>${Array.from({ length: n }, (_, i) => `<option value="${i}">Blech ${i + 1}</option>`).join('')}</select> ` : ''}<button data-act="parts">Teile</button> <button data-act="pdf">PDF</button> <button data-act="cost">Kalkulation</button> <button data-act="open">Öffnen</button></td></tr>`;
            }).join('') : '<tr><td colspan="7" style="padding:8px;color:#888">Keine Pläne gefunden</td></tr>';
        } catch (e) { this._toast(`Planliste nicht ladbar: ${e.message}`, 'error'); }
    }

    /** Teile eines Plans auflisten (Menge, Revision) mit "Bearbeiten" (In-Place-Edit). */
    async _parts(planId) {
        const box = this.overlay.querySelector('#po-parts');
        try {
            const r = await fetch(`/api/plans/${encodeURIComponent(planId)}`, { credentials: 'same-origin' });
            const plan = await r.json(); if (!r.ok) throw new Error(plan.error || `HTTP ${r.status}`);
            const by = new Map();
            for (const i of plan.instances) {
                const e = by.get(i.partId) || { partId: i.partId, qty: 0, revs: new Set() };
                e.qty++; e.revs.add(i.revision); by.set(i.partId, e);
            }
            const names = {};
            await Promise.all([...by.keys()].map(async id => { try { names[id] = (await PartLibrary.get(id)).name; } catch { names[id] = id + ' (fehlt)'; } }));
            box.innerHTML = `<div style="font-weight:600;margin-bottom:2px">Teile in ${this._esc(planId)}</div>` + [...by.values()].map(e =>
                `<div data-pid="${this._esc(e.partId)}" data-plan="${this._esc(planId)}" data-rev="${Math.max(...e.revs)}" style="display:flex;gap:10px;align-items:center;padding:2px 0;border-bottom:1px solid #eee">
                    <span style="flex:1">${this._esc(names[e.partId])}</span><span>${e.qty}×</span><span>Rev ${[...e.revs].sort().join(', ')}</span>
                    <button data-act="editpart">Bearbeiten</button></div>`).join('');
        } catch (e) { this._toast(`Teile nicht ladbar: ${e.message}`, 'error'); }
    }

    async _editPart(row) {
        try {
            await PartEditor.openPart(this.app, row.dataset.pid, { revision: Number(row.dataset.rev), planId: row.dataset.plan });
            this.close();
        } catch (e) { this._toast(`Öffnen fehlgeschlagen: ${e.message}`, 'error'); }
    }

    async _open(planId, sheetIndex) {
        const st = this.overlay.querySelector('#po-status');
        st.textContent = 'Lade Plan …';
        try {
            const r = await fetch(`/api/plans/${encodeURIComponent(planId)}`, { credentials: 'same-origin' });
            const plan = await r.json(); if (!r.ok) throw new Error(plan.error || `HTTP ${r.status}`);
            const { map, warn } = await loadPlanParts(plan);
            if (warn.length) this._toast(`Teile fehlen, Plan unvollständig: ${warn.join('; ')}`, 'warning');
            openPlanSheet(this.app, plan, map, sheetIndex);
            this.close();
        } catch (e) { st.textContent = ''; this._toast(`Plan öffnen fehlgeschlagen: ${e.message}`, 'error'); }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        let po = null;
        document.getElementById('btn-plan-open')?.addEventListener('click', () => {
            if (!po || !po.overlay) po = new PlanOpenDialog(window.app);
            po.open();
        });
        let dlg = null;
        document.getElementById('btn-autonest')?.addEventListener('click', () => {
            if (!dlg || !dlg.overlay) dlg = new AutoNestDialog(window.app);
            dlg.open();
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NestingPlan, AutoNestDialog, PlanOpenDialog };
}
