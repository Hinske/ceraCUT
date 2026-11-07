/**
 * CeraCUT Cost Dialog V1.0
 * Dialog "Kostenkalkulation" für einen Schachtelplan (gespeichert per planId oder ungespeichert inline).
 * Rechnet serverseitig (POST /api/reports/cost → js/cost-plan.js), Blöcke ein-/ausschaltbar,
 * Teile-Einzelpreise, PDF-Export (POST /api/reports/cost-pdf).
 *
 * Created: 2026-11-07
 * Build: 20261107-costdialog
 *
 * (c) Cerasell GmbH
 */

class PlanCostDialog {
    /** @param {object} app  @param {{planId?:string, plan?:object, name?:string}} source */
    constructor(app, source) {
        this.app = app; this.source = source; this.overlay = null; this.result = null;
        this.inc = { manufacturing: true, material: true, consumable: true, additional: true, labor: false };
    }

    static open(app, source) { new PlanCostDialog(app, source).open(); }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }
    _body() { return { ...(this.source.planId ? { planId: this.source.planId } : { plan: this.source.plan }), labor: this.inc.labor, include: this.inc }; }

    open() {
        const ov = document.createElement('div');
        ov.className = 'modal-overlay cost-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="width:min(980px,96vw);max-width:96vw;max-height:92vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>Kostenkalkulation — ${this._esc(this.source.name || this.source.planId || 'Plan')}</span><button class="cldcl-close" data-act="close">×</button></div>
            <div class="cldcl-body" id="pc-body" style="overflow:auto;font-size:11px">Rechne …</div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="pdf" style="font-weight:600">PDF-Bericht</button><button data-act="close">Schließen</button></div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') this.close();
            if (act === 'pdf') this._pdf();
        });
        ov.addEventListener('change', e => {
            const k = e.target.dataset.inc;
            if (k) { this.inc[k] = e.target.checked; this._load(); }
        });
        this._load();
    }

    close() { this.overlay?.remove(); this.overlay = null; }

    async _post(path) {
        const r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this._body()) });
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`); }
        return r;
    }

    async _load() {
        const el = this.overlay?.querySelector('#pc-body'); if (!el) return;
        try {
            this.result = await (await this._post('/api/reports/cost')).json();
            this._render();
        } catch (e) { el.innerHTML = `<div style="color:#b00020">Kalkulation nicht möglich: ${this._esc(e.message)}</div>`; }
    }

    _render() {
        const r = this.result, b = r.blocks, d = r.data, inc = this.inc;
        const eur = PlanCost.eur, t = PlanCost.fmtTime;
        const row = (label, val, strong) => `<tr><td>${label}</td><td style="text-align:right;${strong ? 'font-weight:600' : ''}">${val}</td></tr>`;
        const chk = (k, label, extra = '') => `<label style="display:flex;gap:6px;align-items:center;font-weight:600;margin:8px 0 2px"><input type="checkbox" data-inc="${k}" ${inc[k] ? 'checked' : ''}> ${label} ${extra}</label>`;
        const share = v => r.total > 0 ? Math.max(1, Math.round(v / r.total * 100)) : 0;
        const bar = (v, color) => `<div style="height:8px;background:${color};width:${share(v)}%;min-width:2px"></div>`;
        this.overlay.querySelector('#pc-body').innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:300px">
            ${chk('manufacturing', 'Fertigungskosten', eur(b.manufacturing.total))}
            <table style="width:100%">${row('Schneiden (' + t(r.time.cutting) + ')', eur(b.manufacturing.cutting))}${row('Eilgang (' + t(r.time.rapid) + ')', eur(b.manufacturing.rapid))}${row('Anstechen (' + t(r.time.piercing) + ')', eur(b.manufacturing.piercing))}</table>
            ${chk('material', 'Materialkosten', eur(b.material.total))}
            <table style="width:100%">${row(`Blech ${d.sheets}× · ${b.material.totalWeightKg.toFixed(2)} kg`, eur(b.material.total))}${row(`davon Verschnitt ${b.material.scrapKg.toFixed(2)} kg`, eur(b.material.scrapCost))}</table>
            ${chk('consumable', 'Verbrauchsmaterial', eur(b.consumable.total))}
            <table style="width:100%">${row(`Strom ${b.consumable.powerKwh.toFixed(1)} kWh`, eur(b.consumable.power))}${row(`Wasser ${b.consumable.waterM3.toFixed(3)} m³`, eur(b.consumable.water))}${row(`Abrasiv ${b.consumable.abrasiveKg.toFixed(2)} kg`, eur(b.consumable.abrasive))}${row('Düse/Verschleiß', eur(b.consumable.nozzle))}</table>
            ${chk('additional', 'Zusatzkosten', eur(b.additional.total + (inc.labor ? b.additional.labor : 0)))}
            <table style="width:100%">${row('Anstich-Zuschlag', eur(b.additional.piercing))}${row('Rüsten', eur(b.additional.setup))}${row('NC-Programmierung', eur(b.additional.nc))}</table>
            ${chk('labor', 'Arbeit', eur(b.additional.labor))}
          </div>
          <div style="flex:1;min-width:300px">
            <div style="font-size:16px;font-weight:700;color:#0b5cad;margin:6px 0">Gesamtkosten: ${eur(r.total)}</div>
            <div style="margin-bottom:8px">Gesamtzeit: <b>${t(r.time.total)}</b></div>
            <div style="display:grid;grid-template-columns:90px 1fr;gap:3px 8px;align-items:center;margin-bottom:10px">
              <span>Fertigung</span>${bar(inc.manufacturing ? b.manufacturing.total : 0, '#0078d4')}
              <span>Material</span>${bar(inc.material ? b.material.total : 0, '#22c55e')}
              <span>Verbrauch</span>${bar(inc.consumable ? b.consumable.total : 0, '#e8a020')}
              <span>Zusatz</span>${bar(inc.additional ? b.additional.total + (inc.labor ? b.additional.labor : 0) : 0, '#a855f7')}
            </div>
            <table style="width:100%">
              ${row('Blech', `${d.sheetW} × ${d.sheetL} mm · ${d.thickness} mm`)}${row('Teile / Anstiche', `${d.nested} / ${d.piercings}`)}
              ${row('Schnittlänge', d.cutLengthM.toFixed(2) + ' m')}${row('Eilganglänge (geschätzt)', d.rapidLengthM.toFixed(2) + ' m')}
              ${row('Vorschub', d.feed.toFixed(1) + ' mm/min')}${row('Technologie', this._esc(r.techId || '— (Richtwerte)') + (r.techId && !r.techExact ? ' (nächste Dicke)' : ''))}
            </table>
            ${r.defaultsUsed.length ? `<div style="margin-top:8px;color:#9a6700">⚠️ Richtwerte verwendet für: ${this._esc(r.defaultsUsed.join(', '))} — bitte in Technologie/Material pflegen.</div>` : ''}
          </div>
        </div>
        <div style="font-weight:600;margin:12px 0 4px">Teile</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#e8eef5;text-align:left"><th>Teil</th><th>Auftrag</th><th style="text-align:right">Menge</th><th style="text-align:right">Stückpreis</th><th style="text-align:right">Gesamt</th><th style="text-align:right">Fläche m²</th><th style="text-align:right">Schnittzeit</th></tr></thead>
          <tbody>${r.parts.map(p => `<tr style="border-top:1px solid #ddd"><td>${this._esc(p.name)}</td><td>${this._esc(p.orderId)}</td><td style="text-align:right">${p.qty}</td>
            <td style="text-align:right">${eur(p.unit)}</td><td style="text-align:right">${eur(p.total)}</td><td style="text-align:right">${(p.surface * p.qty).toFixed(4)}</td><td style="text-align:right">${t(p.cutTime)}</td></tr>`).join('')}</tbody>
        </table>`;
    }

    async _pdf() {
        try {
            const r = await this._post('/api/reports/cost-pdf');
            const blob = await r.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `Kalkulation_${(this.source.planId || this.source.name || 'PLAN').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        } catch (e) { this._toast(`PDF fehlgeschlagen: ${e.message}`, 'error'); }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlanCostDialog };
}
