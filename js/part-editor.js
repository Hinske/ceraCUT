/**
 * CeraCUT Part Editor V1.0
 * In-Place-Bearbeitung von Teilen (FINest "Edit part" / "Update") und Teilebibliothek (Auftragsbibliothek).
 *
 *   PartEditor        : Teil als DXF in neuem Tab öffnen (Sitzung über den Tab-Dateinamen),
 *                       "Teil aktualisieren" → neue Revision + Update-Modus im Plan
 *   PartUpdateDialog  : Modus wählen — nur diese Instanz · gleiche Transformation · alle verwandten (+ andere Pläne)
 *   PartLibraryDialog : Suche/Filter mit Vorschau; Bearbeiten, DXF-Export, Löschen
 *
 * Instanzen referenzieren Teil + exakte Revision (js/plan-update.js) → andere Instanzen behalten ihre Geometrie.
 * Konzept: docs/finest-integration-konzept.md §1.4
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-partedit
 *
 * (c) Cerasell GmbH
 */

const PartEditor = (() => {
    'use strict';

    const sessions = new Map();    // Tab-Dateiname → {partId, baseRevision, planId, name}
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    async function api(method, url, body, ifMatch) {
        const r = await fetch(url, { method, credentials: 'same-origin',
            headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(ifMatch !== undefined ? { 'If-Match': String(ifMatch) } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(d.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
        return d;
    }

    /** Teil (optional in bestimmter Revision) in neuem Tab zum Bearbeiten öffnen. */
    async function openPart(app, partId, { revision, planId } = {}) {
        const part = await PartLibrary.get(partId, revision);
        const cur = revision ? await PartLibrary.get(partId) : part;
        const base = String(part.name).replace(/[^A-Za-z0-9._-]/g, '_');
        let filename = `TEIL_${base}_r${part.revision}.dxf`;
        for (let n = 2; sessions.has(filename); n++) filename = `TEIL_${base}_r${part.revision}_${n}.dxf`;
        sessions.set(filename, { partId, baseRevision: part.revision, planId: planId || null, name: part.name });
        const dxf = PartGeometry.toDXF(part);
        if (!app?.loadDXFContent) throw new Error('App nicht bereit');
        app.loadDXFContent(filename, dxf, (dxf.length / 1024).toFixed(1));
        if (cur.revision !== part.revision) app.showToast?.(`Hinweis: Das Teil hat inzwischen Revision ${cur.revision} — Sie bearbeiten Revision ${part.revision}`, 'warning');
        return filename;
    }

    /** Geänderten Tab zurück ins Teil schreiben: neue Revision, optional Update-Modus im Plan. */
    async function updateFromTab(app) {
        const sess = sessions.get(app.dxfFileName);
        if (!sess) return app.showToast?.('Dieser Tab gehört zu keinem Bibliotheksteil — bitte über Teilebibliothek/Plan „Bearbeiten“ öffnen', 'warning');
        const analysis = PartGeometry.analyze(PartGeometry.fromAppContours(app.contours));
        if (!analysis.ok) return app.showToast?.(`Teil nicht speicherbar: ${analysis.warnings.join('; ')}`, 'error');
        const part = await PartLibrary.get(sess.partId);
        const oldBox = part.geometry.bbox, newBox = analysis.geometry.bbox;
        const bboxChanged = Math.abs(oldBox.w - newBox.w) > 0.01 || Math.abs(oldBox.l - newBox.l) > 0.01;
        const plan = sess.planId ? await api('GET', `/api/plans/${encodeURIComponent(sess.planId)}`).catch(() => null) : null;

        const choice = await new PartUpdateDialog(app, { sess, part, analysis, bboxChanged, oldBox, newBox, plan }).ask();
        if (!choice) return;
        try {
            const next = { ...part, geometry: analysis.geometry, thumbnailSvg: analysis.thumbnailSvg,
                           status: analysis.warnings.length ? 'warning' : 'ready', warnings: analysis.warnings };
            delete next.version; delete next.createdAt; delete next.updatedAt; delete next.updatedBy;
            const saved = await api('POST', `/api/parts/${encodeURIComponent(part.partId)}/revision`, next, part.version);
            let msg = `${part.name}: Revision ${saved.revision} gespeichert`;
            if (plan && choice.mode) {
                const r = await api('POST', `/api/plans/${encodeURIComponent(plan.planId)}/update-parts`,
                    { partId: part.partId, revision: saved.revision, mode: choice.mode, instId: choice.instId, otherPlans: !!choice.otherPlans }, plan.version);
                msg += ` · ${r.changed} Instanz(en) in ${r.updated.length} Plan/Plänen aktualisiert`;
            }
            sess.baseRevision = saved.revision;
            app.showToast?.(msg + (bboxChanged && plan ? ' — Umriss geändert, Plan ggf. neu nesten' : ''), bboxChanged ? 'warning' : 'success');
        } catch (e) {
            app.showToast?.(e.status === 409 ? 'Konflikt: Teil oder Plan wurde zwischenzeitlich geändert — bitte neu öffnen' : `Aktualisieren fehlgeschlagen: ${e.message}`, 'error');
        }
    }

    return { openPart, updateFromTab, sessions, api, esc };
})();

// ═══════════════════════════════════════════════════════════════════
// Update-Dialog
// ═══════════════════════════════════════════════════════════════════

class PartUpdateDialog {
    constructor(app, ctx) { this.app = app; this.ctx = ctx; }

    ask() {
        const { sess, part, analysis, bboxChanged, oldBox, newBox, plan } = this.ctx;
        const esc = PartEditor.esc;
        const insts = plan ? plan.instances.filter(i => i.partId === part.partId) : [];
        const groups = plan ? PlanUpdate.summarize(plan, part.partId) : [];
        return new Promise(resolve => {
            const ov = document.createElement('div');
            ov.className = 'modal-overlay part-update-overlay';
            ov.style.zIndex = 9700;
            ov.innerHTML = `
            <div class="cldcl-dialog-box" style="min-width:520px;max-width:640px">
                <div class="cldcl-header"><span>Teil aktualisieren — ${esc(part.name)}</span><button class="cldcl-close" data-act="cancel">×</button></div>
                <div class="cldcl-body" style="font-size:12px">
                    <div>Neue Revision <b>${part.revision + 1}</b> (bisher ${part.revision}${sess.baseRevision !== part.revision ? `, geöffnet war ${sess.baseRevision}` : ''})
                        · ${analysis.geometry.contours.length} Konturen · ${analysis.geometry.piercings} Anstiche</div>
                    ${analysis.warnings.length ? `<div style="color:#9a6700">⚠️ ${esc(analysis.warnings.join('; '))}</div>` : ''}
                    ${bboxChanged ? `<div style="color:#b00020">⚠️ Umriss geändert: ${oldBox.w}×${oldBox.l} → ${newBox.w}×${newBox.l} mm — im Plan können sich Teile überlappen, bitte neu nesten.</div>` : ''}
                    ${plan ? `
                    <div style="font-weight:600;margin-top:8px">Plan ${esc(plan.planId)}: ${insts.length} Instanz(en) dieses Teils</div>
                    <label style="display:block;margin:4px 0"><input type="radio" name="pu-mode" value="all" checked> Alle verwandten Teile aktualisieren (${insts.length})</label>
                    <label style="display:block;margin:4px 0 4px 22px;color:#555"><input type="checkbox" id="pu-other"> auch in allen anderen Plänen mit diesem Teil</label>
                    <label style="display:block;margin:4px 0"><input type="radio" name="pu-mode" value="sameTransform"> Nur Teile mit gleicher Transformation wie Referenz-Instanz</label>
                    <label style="display:block;margin:4px 0"><input type="radio" name="pu-mode" value="single"> Nur die Referenz-Instanz</label>
                    <div class="cldcl-row" id="pu-ref-row" style="display:none"><label style="min-width:130px">Referenz-Instanz</label>
                        <select id="pu-ref">${insts.map(i => `<option value="${esc(i.instId)}">${esc(i.instId)} · Blech ${(i.sheetIndex || 0) + 1} · ${i.rot}°${i.mirror ? ' gespiegelt' : ''} · Rev ${i.revision}</option>`).join('')}</select></div>
                    <div style="color:#666;margin-top:4px">${groups.map(g => `${g.count}× ${g.rot}°${g.mirror ? ' gesp.' : ''} (Rev ${g.revision})`).join(' · ')}</div>`
                    : `<div style="margin-top:8px;color:#555">Das Teil gehört zu keinem geöffneten Plan — es wird nur die Bibliothek aktualisiert. Pläne behalten ihre bisherige Revision.</div>`}
                </div>
                <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                    <button data-act="ok" style="font-weight:600">Speichern</button><button data-act="cancel">Abbrechen</button>
                </div>
            </div>`;
            document.body.appendChild(ov);
            const done = v => { ov.remove(); resolve(v); };
            const modeEl = () => ov.querySelector('input[name="pu-mode"]:checked')?.value;
            ov.addEventListener('change', () => {
                const refRow = ov.querySelector('#pu-ref-row'); if (refRow) refRow.style.display = modeEl() === 'all' ? 'none' : 'flex';
                const other = ov.querySelector('#pu-other'); if (other) { other.disabled = modeEl() !== 'all'; if (other.disabled) other.checked = false; }
            });
            ov.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') done(null); });
            ov.addEventListener('click', e => {
                if (e.target === ov) return done(null);
                const act = e.target.closest('[data-act]')?.dataset.act;
                if (act === 'cancel') done(null);
                if (act === 'ok') done(plan
                    ? { mode: modeEl(), instId: ov.querySelector('#pu-ref')?.value, otherPlans: !!ov.querySelector('#pu-other')?.checked }
                    : { mode: null });
            });
        });
    }
}

// ═══════════════════════════════════════════════════════════════════
// Teilebibliothek (Auftragsbibliothek)
// ═══════════════════════════════════════════════════════════════════

class PartLibraryDialog {
    constructor(app) { this.app = app; this.overlay = null; this.items = []; this.total = 0; this.materials = []; }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }

    async open() {
        if (this.overlay) return;
        const esc = PartEditor.esc;
        try { this.materials = (await PartLibrary.listMaterials()).items || []; } catch { /* Filter ohne Material */ }
        const ov = document.createElement('div');
        ov.className = 'modal-overlay part-library-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="width:min(1100px,97vw);max-width:97vw;height:88vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>Teilebibliothek</span><button class="cldcl-close" data-act="close">×</button></div>
            <div class="cldcl-row" style="padding:8px 12px;flex-wrap:wrap">
                <input id="pl-q" type="text" placeholder="Suchen (Name, Auftrag, Kunde, Kommission)" style="width:260px">
                <input id="pl-customer" type="text" placeholder="Kunde" style="width:120px">
                <select id="pl-material"><option value="">Material: alle</option>${this.materials.map(m => `<option value="${esc(m.materialId)}">${esc(m.name)}</option>`).join('')}</select>
                <input id="pl-thickness" type="number" placeholder="Dicke" step="0.1" style="width:70px">
                <select id="pl-status"><option value="">Status: alle</option><option value="ready">Bereit</option><option value="warning">Warnung</option></select>
                <button data-act="search" style="font-weight:600">Suchen</button><button data-act="reset">Zurücksetzen</button>
                <span id="pl-count" style="margin-left:auto;font-size:11px;color:#555"></span>
            </div>
            <div style="flex:1;overflow:auto;padding:0 12px">
                <table style="width:100%;border-collapse:collapse;font-size:11px">
                    <thead style="position:sticky;top:0;background:#e8eef5"><tr style="text-align:left"><th>Vorschau</th><th>Name</th><th>Auftrag</th><th>Kunde</th><th>Material / Dicke</th><th>B × L (mm)</th><th>Stück</th><th>Rev.</th><th></th></tr></thead>
                    <tbody id="pl-rows"></tbody>
                </table>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="more" id="pl-more" style="display:none">Weitere laden</button><button data-act="close">Schließen</button></div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            const id = e.target.closest('tr[data-id]')?.dataset.id;
            if (act === 'close') this.close();
            if (act === 'search') this._search(true);
            if (act === 'more') this._search(false);
            if (act === 'reset') { ov.querySelectorAll('input').forEach(i => { i.value = ''; }); ov.querySelectorAll('select').forEach(s => { s.value = ''; }); this._search(true); }
            if (act === 'edit') this._edit(id);
            if (act === 'dxf') this._dxf(id);
            if (act === 'del') this._del(id);
        });
        ov.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && e.target.tagName === 'INPUT') this._search(true); if (e.key === 'Escape') this.close(); });
        ov.addEventListener('keyup', e => e.stopPropagation());
        await this._search(true);
    }

    close() { this.overlay?.remove(); this.overlay = null; }

    async _search(reset) {
        const v = id => this.overlay.querySelector('#' + id).value.trim();
        if (reset) this.items = [];
        try {
            const r = await PartLibrary.search({ q: v('pl-q'), customer: v('pl-customer'), material: v('pl-material'),
                thickness: v('pl-thickness'), status: v('pl-status'), limit: 100, offset: this.items.length });
            this.items = this.items.concat(r.items); this.total = r.total;
            this._render();
        } catch (e) { this._toast(`Suche fehlgeschlagen: ${e.message}`, 'error'); }
    }

    _render() {
        const esc = PartEditor.esc;
        const matName = id => this.materials.find(m => String(m.materialId) === String(id))?.name || id;
        this.overlay.querySelector('#pl-rows').innerHTML = this.items.map(p => `
            <tr data-id="${esc(p.partId)}" style="border-top:1px solid #ddd">
                <td style="width:64px"><div style="width:56px;height:40px">${p.thumbnailSvg ? p.thumbnailSvg.replace('<svg ', '<svg width="56" height="40" ') : ''}</div></td>
                <td>${esc(p.name)}</td><td>${esc(p.orderId)}</td><td>${esc(p.customer)}</td>
                <td>${esc(matName(p.technologyRef?.materialId))} · ${esc(p.technologyRef?.thickness)} mm</td>
                <td>${p.bbox ? `${p.bbox.w} × ${p.bbox.l}` : ''}</td><td>${p.qty ?? ''}</td><td>${p.revision}</td>
                <td style="white-space:nowrap"><button data-act="edit">Bearbeiten</button> <button data-act="dxf">DXF</button> <button data-act="del">Löschen</button></td></tr>`).join('')
            || '<tr><td colspan="9" style="padding:12px;color:#888">Keine Teile gefunden</td></tr>';
        this.overlay.querySelector('#pl-count').textContent = `${this.items.length} von ${this.total}`;
        this.overlay.querySelector('#pl-more').style.display = this.items.length < this.total ? '' : 'none';
    }

    async _edit(id) {
        try { await PartEditor.openPart(this.app, id); this.close(); }
        catch (e) { this._toast(`Öffnen fehlgeschlagen: ${e.message}`, 'error'); }
    }

    async _dxf(id) {
        try {
            const part = await PartLibrary.get(id);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([PartGeometry.toDXF(part)], { type: 'application/dxf' }));
            a.download = `${String(part.name).replace(/[^A-Za-z0-9._-]/g, '_')}.dxf`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1500);
        } catch (e) { this._toast(`DXF-Export fehlgeschlagen: ${e.message}`, 'error'); }
    }

    async _del(id) {
        const p = this.items.find(x => x.partId === id);
        if (!confirm(`Teil „${p?.name || id}“ löschen?\nPläne, die dieses Teil nutzen, behalten ihre Revisionen nur, solange die Historie besteht.`)) return;
        try {
            await PartEditor.api('DELETE', `/api/parts/${encodeURIComponent(id)}`);
            this.items = this.items.filter(x => x.partId !== id); this.total--; this._render();
        } catch (e) { this._toast(`Löschen fehlgeschlagen: ${e.message}`, 'error'); }
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        let lib = null;
        document.getElementById('btn-part-library')?.addEventListener('click', () => {
            if (!lib || !lib.overlay) lib = new PartLibraryDialog(window.app);
            lib.open();
        });
        document.getElementById('btn-part-update')?.addEventListener('click', () => {
            PartEditor.updateFromTab(window.app).catch(e => window.app?.showToast?.(`Fehler: ${e.message}`, 'error'));
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PartEditor, PartUpdateDialog, PartLibraryDialog };
}
