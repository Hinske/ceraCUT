/**
 * CeraCUT Technology DB V1.0
 * Technologiedatenbank (Material → Dicke → Technologie): Validierung, Standardwerte und Manager-Dialog.
 *
 *   - TechDB            : reine Logik (Browser + Node): Standard-Technologie, Validierung, ID-Bildung
 *   - TechnologyManager : Modal "Technologie-Manager" (Ribbon Extras): Baum Material/Dicke, Reiter
 *                         Allgemein · Lead · Mikroverbindungen · Schnitt · Nesting · Sonstiges · Kosten
 *
 * Schreiben nur Rolle 'admin' (Server erzwingt, Dialog zeigt sonst nur an). Der Server validiert mit
 * TechDB.validateTechnology/validateMaterial (lib/data-api.js).
 *
 * Konzept: docs/finest-integration-konzept.md §1.5, Schema §2.1
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-techdb
 *
 * (c) Cerasell GmbH
 */

const TechDB = (() => {
    'use strict';

    const Engine = () => (typeof CeraJetEngine !== 'undefined' ? CeraJetEngine : null);

    /** Standard-Technologie bei Referenzbedingungen; Leads nach Waricam-Referenz (tasks/waricam-angleichung.md). */
    function defaultTechnology(materialId, thickness = 10, machineId = null) {
        const E = Engine();
        const ref = E ? E.REF : { P: 2900, m_a: 200 };
        const lead = { type: 'linear', angle: 45, in: 3, out: 1, overcut: 3 };
        return {
            technologyId: makeId(materialId, thickness, machineId), materialId, thickness, machineId,
            general: { kerf: 0.8, zAfterCut: 40, leadDefault: { outer: { ...lead }, inner: { ...lead } },
                       rounding: { radius: 0.5, refAngle: 75, tol: 75 } },
            microJoints: { enabled: false, count: 2, width: 1.0 },
            cutting: { quality: 3, nozzleId: 3, pressure: ref.P, abrasiveRate: ref.m_a, feedOverride: null,
                       cornerFactor: E ? E.CORNER_FACTOR : 1 / 3, pierceType: 'auto' },
            nesting: { partToPart: 3, partToEdge: 5, rotations: [0, 90, 180, 270] },
            misc: { minPierceClearance: 10, bigInnerAreaCm2: 5000, circleTools: [] },
            cost: { machineRatePerH: 0, abrasivePerKg: 0, nozzleLifeH: 0, nozzlePrice: 0, powerKw: 0, waterPerH: 0,
                    piercingSurcharge: 0, setupMin: 0, ncProgMin: 0, laborPerH: 0 }
        };
    }

    function makeId(materialId, thickness, machineId) {
        return `T-${materialId}-${thickness}${machineId ? '-' + machineId : ''}`.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
    }

    // ── Validierung (nur vorhandene Felder; fehlende optionale Blöcke sind erlaubt) ──

    const isNum = v => typeof v === 'number' && Number.isFinite(v);
    function rangeCheck(errors, label, v, min, max) {
        if (v === undefined || v === null) return;
        if (!isNum(v) || v < min || v > max) errors.push(`${label}: Wert zwischen ${min} und ${max} erwartet`);
    }

    function validateLead(errors, label, l) {
        if (!l) return;
        rangeCheck(errors, `${label} Länge Anfahrt`, l.in, 0, 200);
        rangeCheck(errors, `${label} Länge Abfahrt`, l.out, 0, 200);
        rangeCheck(errors, `${label} Winkel`, l.angle, 0, 180);
        rangeCheck(errors, `${label} Überschnitt`, l.overcut, 0, 50);
    }

    function validateTechnology(t) {
        const e = [];
        if (!t || typeof t !== 'object') return ['Datensatz fehlt'];
        if (t.materialId === undefined || t.materialId === null || t.materialId === '') e.push('Material fehlt');
        if (!isNum(t.thickness) || t.thickness <= 0 || t.thickness > 500) e.push('Dicke: Wert zwischen 0 und 500 mm erwartet');
        const g = t.general || {}, c = t.cutting || {}, mj = t.microJoints || {}, n = t.nesting || {}, m = t.misc || {}, k = t.cost || {};
        rangeCheck(e, 'Schnittfuge', g.kerf, 0, 5);
        rangeCheck(e, 'Z-Höhe nach Schnitt', g.zAfterCut, 0, 1000);
        validateLead(e, 'Lead außen', g.leadDefault?.outer);
        validateLead(e, 'Lead innen', g.leadDefault?.inner);
        rangeCheck(e, 'Verrunden Radius', g.rounding?.radius, 0, 50);
        rangeCheck(e, 'Qualität', c.quality, 1, 5);
        if (c.quality !== undefined && !Number.isInteger(c.quality)) e.push('Qualität: ganze Zahl 1–5 erwartet');
        rangeCheck(e, 'Druck', c.pressure, 100, 7000);
        rangeCheck(e, 'Abrasivrate', c.abrasiveRate, 0, 2000);
        rangeCheck(e, 'Ecken-Faktor', c.cornerFactor, 0.05, 1);
        if (c.feedOverride !== undefined && c.feedOverride !== null) rangeCheck(e, 'Vorschub (fest)', c.feedOverride, 0.1, 100000);
        const E = Engine();
        if (E && c.nozzleId !== undefined && !E.NOZZLES.some(z => z.id === c.nozzleId)) e.push('Düse: unbekannte Düsen-ID');
        if (c.pierceType !== undefined && !['auto', 'Punkt', 'Rotation'].includes(c.pierceType)) e.push('Anschussart: auto, Punkt oder Rotation');
        rangeCheck(e, 'Mikroverbindungen Anzahl', mj.count, 0, 50);
        rangeCheck(e, 'Mikroverbindungen Breite', mj.width, 0, 20);
        rangeCheck(e, 'Abstand Teil–Teil', n.partToPart, 0, 200);
        rangeCheck(e, 'Abstand Teil–Rand', n.partToEdge, 0, 200);
        if (n.rotations !== undefined && (!Array.isArray(n.rotations) || !n.rotations.length || !n.rotations.every(isNum))) e.push('Drehwinkel: Liste von Zahlen erwartet');
        rangeCheck(e, 'Mindestabstand Anstiche', m.minPierceClearance, 0, 500);
        rangeCheck(e, 'Fläche große Innenkontur', m.bigInnerAreaCm2, 0, 1e7);
        for (const [key, v] of Object.entries(k)) {
            if (v !== undefined && v !== null && (!isNum(v) || v < 0 || v > 1e7)) e.push(`Kosten ${key}: Zahl ≥ 0 erwartet`);
        }
        return e;
    }

    function validateMaterial(m) {
        const e = [];
        if (!m || typeof m !== 'object') return ['Datensatz fehlt'];
        if (typeof m.name !== 'string' || !m.name.trim()) e.push('Name fehlt');
        else if (m.name.length > 80) e.push('Name zu lang (max. 80 Zeichen)');
        if (m.specificWeight !== undefined) rangeCheck(e, 'Spezifisches Gewicht', m.specificWeight, 0.01, 30);
        if (m.pricePerKg !== undefined) rangeCheck(e, 'Preis pro kg', m.pricePerKg, 0, 100000);
        return e;
    }

    return { defaultTechnology, makeId, validateTechnology, validateMaterial };
})();

// ═══════════════════════════════════════════════════════════════════
// Manager-Dialog
// ═══════════════════════════════════════════════════════════════════

class TechnologyManager {
    constructor(app) {
        this.app = app; this.overlay = null;
        this.materials = []; this.techs = []; this.matVersion = 0; this.techVersion = 0;
        this.sel = null;            // { kind:'material', id } | { kind:'tech', id }
        this.tab = 'general';
        this.canWrite = (window.CeraCutCurrentRole || this.app?.currentUser?.role) === 'admin';
        this.dirty = false;
    }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }

    async _api(method, url, body, ifMatch) {
        const r = await fetch(url, { method, credentials: 'same-origin',
            headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(ifMatch !== undefined ? { 'If-Match': String(ifMatch) } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { const err = new Error(d.error || `HTTP ${r.status}`); err.status = r.status; throw err; }
        return d;
    }

    async open() {
        if (this.overlay) return;
        const ov = document.createElement('div');
        ov.className = 'modal-overlay tech-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="width:min(1100px,97vw);max-width:97vw;height:90vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>Technologie-Manager${this.canWrite ? '' : ' <span style="font-weight:400;color:#888">(nur Ansicht — Änderungen nur für Admins)</span>'}</span><button class="cldcl-close" data-act="close">×</button></div>
            <div style="display:flex;flex:1;min-height:0">
                <div style="width:270px;border-right:1px solid #ccc;display:flex;flex-direction:column">
                    <div id="tm-tree" style="flex:1;overflow:auto;font-size:12px"></div>
                    ${this.canWrite ? `<div class="cldcl-row" style="padding:6px;border-top:1px solid #ddd;flex-wrap:wrap">
                        <button data-act="newmat">Neues Material</button><button data-act="newtech">Neue Technologie</button>
                        <button data-act="dup">Duplizieren</button><button data-act="del">Löschen</button></div>` : ''}
                </div>
                <div style="flex:1;display:flex;flex-direction:column;min-width:0">
                    <div id="tm-tabs" style="display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid #ccc;font-size:12px"></div>
                    <div id="tm-form" style="flex:1;overflow:auto;padding:10px 14px;font-size:12px"></div>
                </div>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <span id="tm-msg" style="margin-right:auto;font-size:11px;color:#b00020"></span>
                ${this.canWrite ? '<button data-act="save" style="font-weight:600">Speichern</button>' : ''}<button data-act="close">Schließen</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.addEventListener('click', e => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            const node = e.target.closest('[data-node]');
            const tab = e.target.closest('[data-tab]');
            if (e.target === ov || act === 'close') return this.close();
            if (act) return this[`_${act}`]?.();
            if (tab) { this._collect(); this.tab = tab.dataset.tab; this._renderTabs(); this._renderForm(); return; }
            if (node) this._select(node.dataset.node);
        });
        ov.addEventListener('input', () => { this.dirty = true; this._msg(''); if (this.tab === 'cut' && this.sel?.kind === 'tech') this._feedPreview(); });
        ov.addEventListener('keydown', e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this._save(); } });
        ov.addEventListener('keyup', e => e.stopPropagation());
        await this._reload();
    }

    close() {
        if (this.dirty && this.canWrite && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
        this.overlay?.remove(); this.overlay = null;
    }

    _msg(t) { const el = this.overlay?.querySelector('#tm-msg'); if (el) el.textContent = t; }

    async _reload(keepSel = true) {
        try {
            const [m, t] = await Promise.all([this._api('GET', '/api/materials?limit=1000'), this._api('GET', '/api/technologies?limit=1000')]);
            this.materials = m.items.sort((a, b) => (a.cat || '').localeCompare(b.cat || '', 'de') || a.name.localeCompare(b.name, 'de'));
            this.techs = t.items.sort((a, b) => a.thickness - b.thickness);
            this.matVersion = m.version; this.techVersion = t.version;
            if (!keepSel || !this._current()) this.sel = this.materials[0] ? { kind: 'material', id: String(this.materials[0].materialId) } : null;
            this.dirty = false;
            this._renderTree(); this._renderTabs(); this._renderForm();
        } catch (e) { this._msg(`Laden fehlgeschlagen: ${e.message}`); }
    }

    _current() {
        if (!this.sel) return null;
        return this.sel.kind === 'material'
            ? this.materials.find(m => String(m.materialId) === this.sel.id)
            : this.techs.find(t => t.technologyId === this.sel.id);
    }

    /** Anzeige-Datensatz: ungespeicherter Entwurf (nach Reiterwechsel) oder gespeicherter Stand. */
    _view() {
        const cur = this._current();
        return cur && this.draft && this.draft.__id === (this.sel.kind + ':' + this.sel.id) ? this.draft : cur;
    }

    _select(key) {
        if (this.dirty && this.canWrite && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
        const [kind, ...rest] = key.split(':');
        this.sel = { kind, id: rest.join(':') };
        this.dirty = false; this._msg(''); this.draft = null;
        if (kind === 'material') this.tab = 'general';
        this._renderTree(); this._renderTabs(); this._renderForm();
    }

    _renderTree() {
        let html = '', lastCat = null;
        for (const m of this.materials) {
            if (m.cat !== lastCat) { lastCat = m.cat; html += `<div style="padding:4px 8px;background:#eef2f7;font-weight:600">${this._esc(m.cat || 'Sonstige')}</div>`; }
            const isSel = this.sel?.kind === 'material' && this.sel.id === String(m.materialId);
            html += `<div data-node="material:${this._esc(m.materialId)}" style="padding:3px 8px;cursor:pointer;${isSel ? 'background:#cfe3f8' : ''}">${this._esc(m.name)}</div>`;
            for (const t of this.techs.filter(t => String(t.materialId) === String(m.materialId))) {
                const s = this.sel?.kind === 'tech' && this.sel.id === t.technologyId;
                html += `<div data-node="tech:${this._esc(t.technologyId)}" style="padding:2px 8px 2px 24px;cursor:pointer;color:#444;${s ? 'background:#cfe3f8' : ''}">${t.thickness} mm${t.machineId ? ' · ' + this._esc(t.machineId) : ''}</div>`;
            }
        }
        this.overlay.querySelector('#tm-tree').innerHTML = html || '<div style="padding:10px;color:#888">Keine Materialien</div>';
    }

    _renderTabs() {
        const tabs = this.sel?.kind === 'tech'
            ? [['general', 'Allgemein'], ['lead', 'Lead'], ['mj', 'Mikroverbindungen'], ['cut', 'Schnitt'], ['nest', 'Nesting'], ['misc', 'Sonstiges'], ['cost', 'Kosten']]
            : [['general', 'Material']];
        if (!tabs.some(t => t[0] === this.tab)) this.tab = tabs[0][0];
        this.overlay.querySelector('#tm-tabs').innerHTML = tabs.map(([k, l]) =>
            `<div data-tab="${k}" style="padding:5px 12px;cursor:pointer;border:1px solid #ccc;border-bottom:0;border-radius:3px 3px 0 0;${this.tab === k ? 'background:#fff;font-weight:600' : 'background:#eef2f7'}">${l}</div>`).join('');
    }

    // Feld-Hilfen: name = Pfad im Datensatz (z. B. "general.kerf")
    _f(label, path, v, o = {}) {
        const dis = this.canWrite ? '' : 'disabled';
        const unit = o.unit ? ` <span style="color:#888">${o.unit}</span>` : '';
        let input;
        if (o.options) input = `<select data-path="${path}" data-type="${o.type || 'str'}" ${dis}>${o.options.map(([val, t]) => `<option value="${this._esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${this._esc(t)}</option>`).join('')}</select>`;
        else if (o.bool) input = `<input type="checkbox" data-path="${path}" data-type="bool" ${v ? 'checked' : ''} ${dis}>`;
        else input = `<input data-path="${path}" data-type="${o.str ? 'str' : 'num'}" ${o.str ? '' : 'type="number"'} step="${o.step ?? 'any'}" value="${this._esc(v ?? '')}" style="width:${o.w || 110}px" ${dis}>`;
        return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0"><label style="width:190px;color:#555">${label}</label>${input}${unit}</div>`;
    }

    _renderForm() {
        const el = this.overlay.querySelector('#tm-form'), cur = this._view();
        if (!cur) { el.innerHTML = '<div style="color:#888">Bitte links ein Material oder eine Technologie wählen.</div>'; return; }
        const f = (...a) => this._f(...a);
        if (this.sel.kind === 'material') {
            const E = typeof CeraJetEngine !== 'undefined' ? CeraJetEngine.getMaterial?.(cur.materialId) : null;
            el.innerHTML = f('Name', 'name', cur.name, { str: true, w: 230 }) + f('Kategorie', 'cat', cur.cat, { str: true, w: 150 })
                + f('Spezifisches Gewicht', 'specificWeight', cur.specificWeight, { unit: 'g/cm³', step: 0.01 })
                + f('Preis pro kg', 'pricePerKg', cur.pricePerKg, { unit: '€/kg', step: 0.01 })
                + `<div style="margin-top:10px;color:#888;font-size:11px">Material-ID ${this._esc(cur.materialId)}${E ? ` · Vorschub-Referenz Q4 ${cur.refQ4} mm/min (10 mm, 2900 bar)` : ''}${cur.seeded ? ' · aus CeraJet-Engine übernommen (Richtwerte prüfen)' : ''}</div>`;
            return;
        }
        const t = cur, g = t.general || {}, c = t.cutting || {}, mj = t.microJoints || {}, n = t.nesting || {}, m = t.misc || {}, k = t.cost || {};
        const leadOpts = [['linear', 'Gerade (linear)'], ['arc', 'Bogen'], ['tangent', 'Tangential'], ['on_geometry', 'Auf Kontur']];
        const lead = (side, label) => { const l = g.leadDefault?.[side] || {}; const p = `general.leadDefault.${side}`;
            return `<div style="font-weight:600;margin:10px 0 2px">${label}</div>` + f('Typ', `${p}.type`, l.type, { options: leadOpts })
                + f('Winkel', `${p}.angle`, l.angle, { unit: '°' }) + f('Länge Anfahrt', `${p}.in`, l.in, { unit: 'mm' })
                + f('Länge Abfahrt', `${p}.out`, l.out, { unit: 'mm' }) + f('Überschnitt', `${p}.overcut`, l.overcut, { unit: 'mm' }); };
        const nozzles = (typeof CeraJetEngine !== 'undefined' ? CeraJetEngine.NOZZLES : []).map(z => [z.id, z.label]);
        const forms = {
            general: f('Dicke', 'thickness', t.thickness, { unit: 'mm', step: 0.1 })
                + f('Maschine (leer = alle)', 'machineId', t.machineId || '', { str: true, w: 150 })
                + f('Schnittfuge (Kerf)', 'general.kerf', g.kerf, { unit: 'mm', step: 0.05 })
                + f('Z-Höhe nach Schnitt', 'general.zAfterCut', g.zAfterCut, { unit: 'mm' })
                + `<div style="font-weight:600;margin:10px 0 2px">Automatisches Verrunden</div>`
                + f('Radius', 'general.rounding.radius', g.rounding?.radius, { unit: 'mm', step: 0.1 }) + f('Referenzwinkel', 'general.rounding.refAngle', g.rounding?.refAngle, { unit: '°' })
                + f('± Winkel', 'general.rounding.tol', g.rounding?.tol, { unit: '°' }),
            lead: lead('outer', 'Außenkonturen') + lead('inner', 'Innenkonturen'),
            mj: f('Mikroverbindungen aktiv', 'microJoints.enabled', mj.enabled, { bool: true }) + f('Anzahl', 'microJoints.count', mj.count, { step: 1 }) + f('Breite', 'microJoints.width', mj.width, { unit: 'mm', step: 0.1 }),
            cut: f('Qualität (1 sehr gut … 5 grob)', 'cutting.quality', c.quality, { step: 1 }) + f('Düse', 'cutting.nozzleId', c.nozzleId, { options: nozzles, type: 'num' })
                + f('Druck', 'cutting.pressure', c.pressure, { unit: 'bar' }) + f('Abrasivrate', 'cutting.abrasiveRate', c.abrasiveRate, { unit: 'g/min' })
                + f('Vorschub fest (leer = berechnet)', 'cutting.feedOverride', c.feedOverride ?? '', { unit: 'mm/min' }) + f('Ecken-Faktor', 'cutting.cornerFactor', c.cornerFactor, { step: 0.01 })
                + f('Anschussart', 'cutting.pierceType', c.pierceType, { options: [['auto', 'Automatisch (nach Dicke)'], ['Punkt', 'Punkt'], ['Rotation', 'Rotation']] })
                + `<div id="tm-feed" style="margin:12px 0;padding:8px;background:#f4f8fc;border:1px solid #d5e3f2"></div>`,
            nest: f('Abstand Teil–Teil', 'nesting.partToPart', n.partToPart, { unit: 'mm', step: 0.5 }) + f('Abstand Teil–Rand', 'nesting.partToEdge', n.partToEdge, { unit: 'mm', step: 0.5 })
                + f('Drehwinkel (Komma-getrennt)', 'nesting.rotations', (n.rotations || []).join(', '), { str: true, w: 220, type: 'list' }),
            misc: f('Mindestabstand Anstiche', 'misc.minPierceClearance', m.minPierceClearance, { unit: 'mm' }) + f('Fläche „große“ Innenkontur', 'misc.bigInnerAreaCm2', m.bigInnerAreaCm2, { unit: 'cm²' }),
            cost: f('Maschinenstundensatz', 'cost.machineRatePerH', k.machineRatePerH, { unit: '€/h' }) + f('Abrasivpreis', 'cost.abrasivePerKg', k.abrasivePerKg, { unit: '€/kg', step: 0.01 })
                + f('Düse: Standzeit', 'cost.nozzleLifeH', k.nozzleLifeH, { unit: 'h' }) + f('Düse: Preis', 'cost.nozzlePrice', k.nozzlePrice, { unit: '€' })
                + f('Leistung', 'cost.powerKw', k.powerKw, { unit: 'kW' }) + f('Wasserverbrauch', 'cost.waterPerH', k.waterPerH, { unit: 'l/h' })
                + f('Anstich-Zuschlag', 'cost.piercingSurcharge', k.piercingSurcharge, { unit: '€', step: 0.01 })
                + f('Rüstzeit', 'cost.setupMin', k.setupMin, { unit: 'min' }) + f('NC-Programmierung', 'cost.ncProgMin', k.ncProgMin, { unit: 'min' })
                + f('Stundensatz Arbeit', 'cost.laborPerH', k.laborPerH, { unit: '€/h' })
                + `<div style="margin-top:8px;color:#888;font-size:11px">Leere/0-Felder: die Kalkulation verwendet Richtwerte und weist darauf hin.</div>`
        };
        el.innerHTML = forms[this.tab] || '';
        if (this.tab === 'cut') this._feedPreview();
    }

    _feedPreview() {
        const box = this.overlay?.querySelector('#tm-feed'); if (!box || typeof CeraJetEngine === 'undefined') return;
        const cur = this._collect(true) || this._current();
        try {
            const e = CeraJetEngine.calculate({ materialId: Number(cur.materialId), nozzleId: cur.cutting?.nozzleId ?? 3, thickness: cur.thickness || 10,
                pressure: cur.cutting?.pressure || 2900, optMode: 'kostenProduktion', abrasiveOverride: cur.cutting?.abrasiveRate || null });
            box.innerHTML = `<b>Berechnet (CeraJet-Engine)</b> für ${this._esc(e.material.name)}, ${cur.thickness} mm: `
                + e.feeds.map((v, i) => `Q${i + 1}${i + 1 === cur.cutting?.quality ? ' ▶' : ''} <b>${v}</b>`).join(' · ') + ' mm/min'
                + ` · Anschuss ${e.pierceType} ${e.pierceTime} s · Ecken ${e.corners[Math.max(0, (cur.cutting?.quality || 3) - 1)]} mm/min`;
        } catch { box.textContent = 'Keine Vorschau (Material nicht in der Engine)'; }
    }

    /** Formularwerte in eine Kopie des aktuellen Datensatzes schreiben (immer auf this.draft). */
    _collect(peek = false) {
        const cur = this._current(); if (!cur) return null;
        const draft = this.draft && this.draft.__id === (this.sel.kind + ':' + this.sel.id) ? this.draft : (this.draft = Object.assign(structuredClone(cur), { __id: this.sel.kind + ':' + this.sel.id }));
        const target = peek ? structuredClone(draft) : draft;
        this.overlay.querySelectorAll('#tm-form [data-path]').forEach(el => {
            const path = el.dataset.path.split('.'); let o = target;
            for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {};
            const key = path[path.length - 1], ty = el.dataset.type;
            let v;
            if (ty === 'bool') v = el.checked;
            else if (ty === 'num') v = el.value === '' ? (key === 'feedOverride' ? null : undefined) : Number(el.value);
            else if (ty === 'list') v = el.value.split(/[,;\s]+/).filter(Boolean).map(Number);
            else v = el.value.trim();
            if (ty === 'num' && el.tagName === 'SELECT') v = Number(el.value);
            if (key === 'machineId' && v === '') v = null;
            o[key] = v;
        });
        return peek ? target : draft;
    }

    async _save() {
        if (!this.canWrite) return;
        const rec = this._collect(); if (!rec) return;
        const { __id, ...record } = rec;
        const isMat = this.sel.kind === 'material';
        const errors = isMat ? TechDB.validateMaterial(record) : TechDB.validateTechnology(record);
        if (errors.length) return this._msg(errors[0]);
        try {
            if (isMat) await this._api('PUT', `/api/materials/${encodeURIComponent(record.materialId)}`, record, this.matVersion);
            else {
                // ID folgt Material/Dicke/Maschine; bei Änderung neuer Datensatz + alten entfernen
                const newId = TechDB.makeId(record.materialId, record.thickness, record.machineId);
                if (newId !== record.technologyId) {
                    if (this.techs.some(t => t.technologyId === newId)) return this._msg('Für Material/Dicke/Maschine existiert bereits eine Technologie');
                    const old = record.technologyId; record.technologyId = newId;
                    await this._api('POST', '/api/technologies', record);
                    await this._api('DELETE', `/api/technologies/${encodeURIComponent(old)}`, undefined, this.techVersion + 1);
                    this.sel = { kind: 'tech', id: newId };
                } else await this._api('PUT', `/api/technologies/${encodeURIComponent(record.technologyId)}`, record, this.techVersion);
            }
            this.draft = null; this._toast('Gespeichert', 'success');
            await this._reload(true);
        } catch (e) {
            this._msg(e.status === 409 ? 'Konflikt: jemand hat zwischenzeitlich geändert — Dialog lädt neu' : `Speichern fehlgeschlagen: ${e.message}`);
            if (e.status === 409) { this.draft = null; await this._reload(true); }
        }
    }

    async _newmat() {
        const name = prompt('Name des neuen Materials:'); if (!name || !name.trim()) return;
        const id = Math.max(0, ...this.materials.map(m => Number(m.materialId) || 0)) + 1;
        const rec = { materialId: id, name: name.trim(), cat: 'Sonstige', specificWeight: 2.7, pricePerKg: 0 };
        const errs = TechDB.validateMaterial(rec); if (errs.length) return this._msg(errs[0]);
        try { await this._api('POST', '/api/materials', rec); this.sel = { kind: 'material', id: String(id) }; this.draft = null; await this._reload(true); }
        catch (e) { this._msg(e.message); }
    }

    async _newtech() {
        const mat = this.sel?.kind === 'material' ? this._current() : this.materials.find(m => String(m.materialId) === String(this._current()?.materialId));
        if (!mat) return this._msg('Bitte zuerst ein Material wählen');
        const th = parseFloat(prompt(`Dicke für ${mat.name} (mm):`, '10')); if (!(th > 0)) return;
        const rec = TechDB.defaultTechnology(mat.materialId, th);
        if (this.techs.some(t => t.technologyId === rec.technologyId)) return this._msg('Für diese Dicke existiert bereits eine Technologie');
        try { await this._api('POST', '/api/technologies', rec); this.sel = { kind: 'tech', id: rec.technologyId }; this.draft = null; await this._reload(true); }
        catch (e) { this._msg(e.message); }
    }

    async _dup() {
        const cur = this._current(); if (!cur || this.sel.kind !== 'tech') return this._msg('Bitte eine Technologie wählen');
        const th = parseFloat(prompt('Dicke der Kopie (mm):', String(cur.thickness))); if (!(th > 0)) return;
        const mach = prompt('Maschine der Kopie (leer = alle):', cur.machineId || '') || null;
        const { createdAt, updatedAt, updatedBy, ...base } = structuredClone(cur);
        const rec = { ...base, thickness: th, machineId: mach, technologyId: TechDB.makeId(cur.materialId, th, mach), seeded: false };
        if (this.techs.some(t => t.technologyId === rec.technologyId)) return this._msg('Diese Kombination existiert bereits');
        try { await this._api('POST', '/api/technologies', rec); this.sel = { kind: 'tech', id: rec.technologyId }; this.draft = null; await this._reload(true); }
        catch (e) { this._msg(e.message); }
    }

    async _del() {
        const cur = this._current(); if (!cur) return;
        const isMat = this.sel.kind === 'material';
        if (isMat && this.techs.some(t => String(t.materialId) === String(cur.materialId))) return this._msg('Material hat noch Technologien — zuerst diese löschen');
        if (!confirm(`„${isMat ? cur.name : cur.thickness + ' mm'}“ wirklich löschen?`)) return;
        try {
            if (isMat) await this._api('DELETE', `/api/materials/${encodeURIComponent(cur.materialId)}`, undefined, this.matVersion);
            else await this._api('DELETE', `/api/technologies/${encodeURIComponent(cur.technologyId)}`, undefined, this.techVersion);
            this.sel = null; this.draft = null; await this._reload(false);
        } catch (e) { this._msg(e.message); }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        let dlg = null;
        document.getElementById('btn-tech-manager')?.addEventListener('click', () => {
            if (!dlg || !dlg.overlay) dlg = new TechnologyManager(window.app);
            dlg.open();
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TechDB, TechnologyManager };
}
