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
 * Build: 20261107-planopen
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
        const outer = outerContour(part);
        if (!outer) return [];
        const ob = bbox(toPts(outer.points));
        const cx = (ob.minX + ob.maxX) / 2, cy = (ob.minY + ob.maxY) / 2;
        const rb = bbox(rotate(toPts(outer.points), rot, cx, cy));
        return part.geometry.contours.map(c => ({
            id: c.id, role: c.role, closed: c.closed,
            points: rotate(toPts(c.points), rot, cx, cy).map(p => ({ x: p.x - rb.minX + tx, y: p.y - rb.minY + ty }))
        }));
    }

    /**
     * @param {Array<{partId, qty, priority?:'high'|'normal'|'low', angles?:'none'|'r90'|'r45'|'free'}>} demand
     * @param {Object<string,object>} partsMap  partId → Teile-Datensatz (mit geometry)
     * @param {{width:number,length:number,partToPart:number,partToEdge:number,order?:string,maxSheets?:number}} cfg
     */
    function run(demand, partsMap, cfg) {
        const errors = [];
        if (typeof NestingEngine === 'undefined') throw new Error('NestingEngine nicht geladen');
        if (!(cfg.width > 0) || !(cfg.length > 0)) throw new Error('Blechbreite und -länge müssen > 0 sein');

        const items = [];      // Pseudo-Konturen für die Engine
        const meta = [];       // parallel zu items: {partId}
        for (const d of demand) {
            const part = partsMap[d.partId];
            const qty = Math.max(0, Math.floor(d.qty) || 0);
            if (!part) { errors.push(`${d.partId}: Teil nicht geladen`); continue; }
            const outer = outerContour(part);
            if (!outer) { errors.push(`${part.name}: keine geschlossene Außenkontur`); continue; }
            for (let i = 0; i < qty; i++) {
                items.push({
                    points: toPts(outer.points), isClosed: true, name: part.name,
                    priority: PRIORITY[d.priority || 'normal'] ?? 0,
                    rotationSteps: ROTATIONS[d.angles || 'r90'] || ROTATIONS.r90
                });
                meta.push({ partId: d.partId });
            }
        }
        if (!items.length) throw new Error(errors[0] || 'Keine Teile mit Stückzahl > 0');

        const t0 = Date.now();
        const res = NestingEngine.nest(items, {
            sheetWidth: cfg.width, sheetHeight: cfg.length,
            sheetMargin: cfg.partToEdge, spacing: cfg.partToPart,
            order: cfg.order || 'large-first', maxSheets: cfg.maxSheets || 20
        });

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
        if (mixedTech) errors.push('Teile haben unterschiedliches Material/Dicke — bitte getrennt nesten');

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
                         nestedByPart, unplacedByPart: unplaced, ms: Date.now() - t0 }
            },
            errors
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

    return { run, placePart, partFor, sheetPolylines, toDXF, previewSvg, outerContour, ROTATIONS, PRIORITY };
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
                <div class="cldcl-row"><button data-act="run" style="font-weight:600">Nesting starten</button>
                    <span id="an-status" style="font-size:11px;color:#444"></span>
                    <select id="an-sheet" style="margin-left:auto;display:none"></select></div>
                <div id="an-preview"></div>
                <div id="an-stats" style="font-size:11px;color:#444"></div>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
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
            ({ close: () => this.close(), search: () => this._search(), run: () => this._run(), save: () => this._save(), edit: () => this._openInEditor(),
               add: () => this._addPart(e.target.closest('[data-pid]').dataset.pid),
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

    close() { this.overlay?.remove(); this.overlay = null; this.result = null; }

    async _search() {
        const q = this.overlay.querySelector('#an-q').value.trim();
        try {
            const r = await PartLibrary.search({ q, limit: 50 });
            this.overlay.querySelector('#an-hits').innerHTML = r.items.length ? r.items.map(p =>
                `<div data-pid="${this._esc(p.partId)}" style="display:flex;gap:8px;padding:2px 6px;border-bottom:1px solid #eee;align-items:center">
                    <span style="flex:1">${this._esc(p.name)} <span style="color:#888">· ${this._esc(p.orderId)} · ${p.bbox ? p.bbox.w + '×' + p.bbox.l : ''}</span></span>
                    <button data-act="add">+</button></div>`).join('') : '<div style="padding:6px;color:#888">Keine Teile gefunden</div>';
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

    _run() {
        const st = this.overlay.querySelector('#an-status');
        if (!this.rows.length) return this._toast('Bitte zuerst Teile hinzufügen', 'warning');
        st.textContent = 'Rechne …';
        setTimeout(() => {   // UI zuerst aktualisieren lassen
            try {
                this.result = NestingPlan.run(this.rows, this.partsMap, this._cfg());
                const s = this.result.plan.stats;
                st.textContent = `${s.nested}/${s.requested} Teile · ${s.sheets} Blech(e) · ${s.utilization}% Auslastung · ${s.ms} ms`;
                this.sheetIndex = 0;
                const sel = this.overlay.querySelector('#an-sheet');
                sel.innerHTML = Array.from({ length: s.sheets }, (_, i) => `<option value="${i}">Blech ${i + 1}</option>`).join('');
                sel.style.display = s.sheets > 1 ? '' : 'none';
                this._renderPreview(); this._renderRows();
                const msgs = [...this.result.errors];
                if (s.unplaced) msgs.push(`${s.unplaced} Teil(e) passen nicht (Blech zu klein oder Max. Bleche erreicht)`);
                this.overlay.querySelector('#an-stats').textContent = msgs.join(' · ');
            } catch (e) { st.textContent = ''; this._toast(`Nesting fehlgeschlagen: ${e.message}`, 'error'); }
        }, 30);
    }

    _renderPreview() {
        this.overlay.querySelector('#an-preview').innerHTML = this.result ? NestingPlan.previewSvg(this.result.plan, this.partsMap, this.sheetIndex) : '';
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
                    <td>${n > 1 ? `<select>${Array.from({ length: n }, (_, i) => `<option value="${i}">Blech ${i + 1}</option>`).join('')}</select> ` : ''}<button data-act="open">Öffnen</button></td></tr>`;
            }).join('') : '<tr><td colspan="7" style="padding:8px;color:#888">Keine Pläne gefunden</td></tr>';
        } catch (e) { this._toast(`Planliste nicht ladbar: ${e.message}`, 'error'); }
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
