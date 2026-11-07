/**
 * CeraCUT Part Library V1.0
 * Teilebibliothek-Client: DXF-Teileimport (Mehrfach) mit Technologie-Zuweisung,
 * Validierung und Speichern über /api/parts/import.
 *
 * Aufbau:
 *   - PartGeometry  : reine Funktionen (DOM-frei, in Node testbar): Konturen → Teile-Datensatz
 *   - PartLibrary   : API-Client (fetch) für /api/parts, /api/materials, /api/technology/resolve
 *   - PartImportDialog : UI "DXF-Teileimport" (Ribbon Datei → Import)
 *
 * Konzept: docs/finest-integration-konzept.md (Abschnitt 1.1, 2.1)
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-partedit
 * V1.3: Feat — PartViewer (große Vorschau mit Zoom/Verschieben), PartGeometry.previewSvg; größere Vorschau in der Importtabelle
 * V1.2: Feat — „Vom Server…" (DXFBrowser.pickMany), PartGeometry.decodeDXF (UTF-8/ISO-8859-1 wie app.js)
 * V1.1: Feat — PartGeometry.toDXF / fromAppContours (Teil bearbeiten, part-editor.js)
 *
 * (c) Cerasell GmbH
 */

const PartGeometry = (() => {
    'use strict';

    const r3 = v => Math.round(v * 1000) / 1000;
    const r6 = v => Math.round(v * 1e6) / 1e6;   // m²-Werte: 3 Nachkommastellen wären zu grob

    function signedArea(pts) {
        let a = 0;
        for (let i = 0, n = pts.length; i < n; i++) {
            const p = pts[i], q = pts[(i + 1) % n];
            a += p.x * q.y - q.x * p.y;
        }
        return a / 2;
    }

    function perimeter(pts, closed) {
        let l = 0;
        const n = pts.length;
        for (let i = 0; i < (closed ? n : n - 1); i++) {
            const p = pts[i], q = pts[(i + 1) % n];
            l += Math.hypot(q.x - p.x, q.y - p.y);
        }
        return l;
    }

    function bbox(pts) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    function pointInPolygon(pt, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if ((a.y > pt.y) !== (b.y > pt.y) &&
                pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside;
    }

    /** Punkt sicher innerhalb/auf Kontur: Schwerpunkt der ersten drei Punkte ist unzuverlässig → Kantenmitte nutzen. */
    function probePoint(pts) {
        const a = pts[0], b = pts[Math.min(1, pts.length - 1)];
        return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function thumbnailSvg(contours, box) {
        const w = Math.max(box.maxX - box.minX, 1e-6), h = Math.max(box.maxY - box.minY, 1e-6);
        const s = 100 / Math.max(w, h);
        const step = pts => Math.max(1, Math.ceil(pts.length / 150));
        const paths = contours.map(c => {
            const st = step(c.points);
            const d = c.points.filter((_, i) => i % st === 0)
                .map((p, i) => `${i ? 'L' : 'M'}${r3((p.x - box.minX) * s)} ${r3((box.maxY - p.y) * s)}`).join('');
            return `<path d="${d}${c.closed ? 'Z' : ''}"/>`;
        }).join('');
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${r3(w * s + 4)} ${r3(h * s + 4)}" fill="none" stroke="#0078d4" stroke-width="1">${paths}</svg>`;
    }

    /**
     * Konturen (Parser-Ergebnis: {points:[{x,y}], isClosed, layer}) → Geometrie-Block + Kennzahlen + Warnungen.
     * Rollen: Schachtelungstiefe gerade = 'disc' (Teil), ungerade = 'hole'; offene Konturen = 'open'.
     * Nullpunkt: Ursprung unten-links (bbox.min wird auf 0/0 verschoben).
     */
    function analyze(rawContours, opts = {}) {
        const warnings = [];
        const usable = rawContours.filter(c => c.points && c.points.length >= 2);
        if (!usable.length) return { ok: false, warnings: ['Keine Geometrie gefunden'], geometry: null };

        const all = usable.flatMap(c => c.points);
        const box = bbox(all);
        if (!all.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
            return { ok: false, warnings: ['Ungültige Koordinaten (NaN/Infinity)'], geometry: null };
        }
        const shift = opts.originBottomLeft === false ? { x: 0, y: 0 } : { x: box.minX, y: box.minY };

        const cs = usable.map((c, i) => {
            const pts = c.points.map(p => ({ x: p.x - shift.x, y: p.y - shift.y }));
            const closed = !!c.isClosed && pts.length >= 3;
            return { id: `c${i + 1}`, layer: c.layer || '', points: pts, closed,
                     area: closed ? Math.abs(signedArea(pts)) : 0, level: 0 };
        });

        const closedCs = cs.filter(c => c.closed);
        for (const c of closedCs) {
            const probe = probePoint(c.points);
            c.level = closedCs.filter(o => o !== c && o.area > c.area && pointInPolygon(probe, o.points)).length;
        }
        for (const c of cs) c.role = !c.closed ? 'open' : (c.level % 2 === 0 ? 'disc' : 'hole');

        const openCount = cs.filter(c => c.role === 'open').length;
        if (openCount) warnings.push(`${openCount} offene Kontur(en)`);
        if (!closedCs.length) warnings.push('Keine geschlossene Kontur');
        const tiny = closedCs.filter(c => c.area < 0.01).length;
        if (tiny) warnings.push(`${tiny} Kontur(en) mit Fläche < 0,01 mm²`);

        const nb = bbox(cs.flatMap(c => c.points));
        const w = nb.maxX - nb.minX, l = nb.maxY - nb.minY;
        const discArea = cs.filter(c => c.role === 'disc').reduce((a, c) => a + c.area, 0);
        const holeArea = cs.filter(c => c.role === 'hole').reduce((a, c) => a + c.area, 0);
        const cutLen = cs.reduce((a, c) => a + perimeter(c.points, c.closed), 0);

        return {
            ok: true, warnings,
            geometry: {
                contours: cs.map(c => ({ id: c.id, role: c.role, closed: c.closed, layer: c.layer,
                                          points: c.points.map(p => [r3(p.x), r3(p.y)]) })),
                bbox: { w: r3(w), l: r3(l) },
                netArea: r6((discArea - holeArea) / 1e6),   // m²
                rectArea: r6(w * l / 1e6),                  // m²
                cutLength: r3(cutLen / 1000),               // m
                piercings: closedCs.length
            },
            thumbnailSvg: thumbnailSvg(cs, nb)
        };
    }

    /** Dateiname → Teilename (ohne Endung) und Auftrags-ID. */
    function namesFromFile(fileName) {
        const name = String(fileName).replace(/\.[^.]+$/, '').trim() || 'Teil';
        return { name, orderId: `O-${name}`.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64) };
    }

    function newPartId(i = 0) {
        return `P-${Date.now().toString(36).toUpperCase()}${i.toString(36).toUpperCase()}`.slice(0, 64);
    }

    /**
     * Datensatz laut Schema (docs/finest-integration-konzept.md §2.1).
     * @param {object} analysis  Ergebnis von analyze()
     * @param {object} meta      {fileName, name, orderId, customer, qty, techRef, layers, partId}
     */
    function toRecord(analysis, meta) {
        return {
            partId: meta.partId, revision: 1,
            name: meta.name, orderId: meta.orderId, customer: meta.customer || '', commission: meta.commission || '',
            qty: meta.qty || 1,
            source: { file: meta.fileName, importedAt: new Date().toISOString(), layers: meta.layers || [] },
            technologyRef: meta.techRef,
            geometry: analysis.geometry,
            cam: { contourOverrides: {} },
            thumbnailSvg: analysis.thumbnailSvg,
            status: analysis.warnings.length ? 'warning' : 'ready',
            warnings: analysis.warnings
        };
    }

    /**
     * Teil als DXF (R12, POLYLINE) — zum Bearbeiten im CAD-Editor. Layer bleiben erhalten,
     * offene Konturen bleiben offen. Ursprung = Teil-Ursprung (unten-links).
     */
    function toDXF(part) {
        const out = ['0', 'SECTION', '2', 'ENTITIES'];
        const layerOf = c => String(c.layer || '0').replace(/[\r\n]/g, ' ').trim() || '0';
        for (const c of part.geometry.contours) {
            const layer = layerOf(c);
            out.push('0', 'POLYLINE', '8', layer, '66', '1', '70', c.closed ? '1' : '0');
            for (const p of c.points) out.push('0', 'VERTEX', '8', layer, '10', String(p[0]), '20', String(p[1]));
            out.push('0', 'SEQEND', '8', layer);
        }
        out.push('0', 'ENDSEC', '0', 'EOF');
        return out.join('\n') + '\n';
    }

    /** App-Konturen (CamContour) → analyze()-Eingabe; Referenz- und Schraffur-Konturen bleiben draußen. */
    function fromAppContours(contours) {
        return (contours || []).filter(c => c && !c.isReference && !c.isHatchContour && c.points && c.points.length >= 2)
            .map(c => ({ points: c.points.map(p => ({ x: p.x, y: p.y })), isClosed: !!c.isClosed, layer: c.layer || '' }));
    }

    /** DXF-Bytes → Text wie beim normalen Öffnen (app.js): AC1021+ = UTF-8, älter ISO-8859-1; \U+XXXX-Escapes dekodieren. */
    function decodeDXF(buf) {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        const head = new TextDecoder('iso-8859-1').decode(bytes.subarray(0, Math.min(bytes.length, 65536)));
        const ver = head.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d+)/);
        const utf8 = ver && parseInt(ver[1], 10) >= 1021;
        return new TextDecoder(utf8 ? 'utf-8' : 'iso-8859-1').decode(bytes)
            .replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    }

    /**
     * Große Vorschau aus der vollen Geometrie (nicht die verkleinerte Liste-Vorschau): y-Achse nach oben
     * (Koordinaten (x, -y)), Konturstärke bleibt beim Zoomen konstant (non-scaling-stroke).
     * @returns {{svgInner:string, box:{x:number,y:number,w:number,h:number}}}  box = Modell-Ausdehnung in SVG-Koordinaten
     */
    function previewSvg(geometry) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of geometry.contours) for (const p of c.points) {
            if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
            if (-p[1] < minY) minY = -p[1]; if (-p[1] > maxY) maxY = -p[1];
        }
        if (!Number.isFinite(minX)) return { svgInner: '', box: { x: 0, y: 0, w: 100, h: 100 } };
        const style = { disc: 'fill="#0078d4" fill-opacity="0.12" stroke="#0b5cad"', hole: 'fill="#fafafa" stroke="#c0392b"', open: 'fill="none" stroke="#e8a020"' };
        const paths = geometry.contours.map(c => {
            const d = c.points.map((p, i) => `${i ? 'L' : 'M'}${r3(p[0])} ${r3(-p[1])}`).join('') + (c.closed ? 'Z' : '');
            return `<path d="${d}" ${style[c.role] || style.open} stroke-width="1.3" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
        }).join('');
        return { svgInner: paths, box: { x: minX, y: minY, w: Math.max(maxX - minX, 1e-6), h: Math.max(maxY - minY, 1e-6) } };
    }

    return { analyze, toRecord, toDXF, fromAppContours, decodeDXF, previewSvg, namesFromFile, newPartId, signedArea, pointInPolygon };
})();

// ═══════════════════════════════════════════════════════════════════
// API-Client
// ═══════════════════════════════════════════════════════════════════

const PartLibrary = (() => {
    'use strict';

    async function _json(method, url, body) {
        const r = await fetch(url, {
            method, credentials: 'same-origin',
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok && r.status !== 207) {
            const err = new Error(data.error || `HTTP ${r.status}`);
            err.status = r.status; err.code = data.code;
            throw err;
        }
        return data;
    }

    const qs = o => {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(o || {})) if (v !== undefined && v !== '') p.set(k, v);
        const s = p.toString();
        return s ? `?${s}` : '';
    };

    return {
        search: filter => _json('GET', `/api/parts${qs(filter)}`),
        get: (id, rev) => _json('GET', `/api/parts/${encodeURIComponent(id)}${qs({ rev })}`),
        importBatch: (parts, overwrite = false) => _json('POST', '/api/parts/import', { parts, overwrite }),
        listMaterials: () => _json('GET', '/api/materials?limit=1000'),
        resolveTechnology: (material, thickness, machine) =>
            _json('GET', `/api/technology/resolve${qs({ material, thickness, machine })}`)
    };
})();

// ═══════════════════════════════════════════════════════════════════
// Import-Dialog
// ═══════════════════════════════════════════════════════════════════

class PartImportDialog {
    constructor(app) {
        this.app = app;
        this.overlay = null;
        this.items = [];       // {file, fileName, text, layers, analysis, name, orderId, qty, status, error}
        this.layerSel = new Map(); // Layername → true/false
        this.materials = [];
    }

    async open() {
        if (this.overlay) return;
        try { this.materials = (await PartLibrary.listMaterials()).items || []; }
        catch (e) { this.app?.showToast?.(`Materialliste nicht ladbar: ${e.message}`, 'warning'); }
        this._build();
    }

    close() {
        this.overlay?.remove();
        this.overlay = null;
        this.items = [];
        this.layerSel.clear();
    }

    _esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    _build() {
        const machines = (typeof MachineProfiles !== 'undefined' ? MachineProfiles.listProfiles() : [])
            .map(p => `<option value="${this._esc(p.id)}">${this._esc(p.name || p.id)}</option>`).join('');
        const mats = this.materials
            .map(m => `<option value="${this._esc(m.materialId)}">${this._esc(m.name)}</option>`).join('');
        const defaultMat = this.materials.find(m => m.materialId === 21)?.materialId ?? this.materials[0]?.materialId ?? '';

        const ov = document.createElement('div');
        ov.className = 'modal-overlay part-import-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="min-width:860px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>DXF-Teileimport</span><button class="cldcl-close" data-act="close" title="Schließen">×</button></div>
            <div class="cldcl-body" style="overflow:auto">
                <div style="color:#666;font-size:11px">Teile aus DXF erzeugen, Geometrie prüfen und in der Teilebibliothek speichern.</div>
                <div class="cldcl-row" style="flex-wrap:wrap">
                    <label>Maschine</label><select id="pi-machine"><option value="">(keine)</option>${machines}</select>
                    <label>Material</label><select id="pi-material">${mats}</select>
                    <label>Dicke (mm)</label><input id="pi-thickness" type="number" min="0.1" step="0.1" value="10" style="width:70px">
                    <label>Kunde</label><input id="pi-customer" type="text" style="width:140px">
                </div>
                <div class="cldcl-row">
                    <button data-act="add">Dateien hinzufügen…</button>
                    <button data-act="server">Vom Server…</button>
                    <button data-act="remove">Entfernen</button>
                    <button data-act="removeall">Alle entfernen</button>
                    <input id="pi-files" type="file" accept=".dxf,.DXF" multiple style="display:none">
                    <span id="pi-tech" style="margin-left:auto;font-size:11px;color:#666"></span>
                </div>
                <div style="display:flex;gap:10px;min-height:200px">
                    <div style="flex:1;overflow:auto;border:1px solid #bbb">
                        <table id="pi-table" style="width:100%;border-collapse:collapse;font-size:11px">
                            <thead><tr style="background:#e8eef5;text-align:left">
                                <th></th><th>Status</th><th>Vorschau</th><th>Datei</th><th>Name</th><th>Auftrag</th><th>Stück</th><th>B × L (mm)</th></tr></thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <div style="width:170px;border:1px solid #bbb;padding:6px;overflow:auto">
                        <b style="font-size:11px">Layer</b>
                        <div style="font-size:11px;margin:4px 0"><a href="#" data-act="layall">alle</a> · <a href="#" data-act="laynone">keine</a></div>
                        <div id="pi-layers" style="font-size:11px"></div>
                    </div>
                </div>
                <div id="pi-summary" style="font-size:11px;color:#444"></div>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="revalidate">Revalidieren</button>
                <button data-act="save" style="font-weight:600">Speichern</button>
                <button data-act="close">Schließen</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.querySelector('#pi-material').value = defaultMat;

        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (!act) return;
            e.preventDefault();
            ({
                close: () => this.close(),
                add: () => ov.querySelector('#pi-files').click(),
                server: () => this._addFromServer(),
                remove: () => this._removeSelected(),
                removeall: () => { this.items = []; this._rebuildLayers(); this._render(); },
                layall: () => this._setAllLayers(true),
                laynone: () => this._setAllLayers(false),
                revalidate: () => this._revalidate(),
                save: () => this._save()
            }[act] || (() => {}))();
        });
        ov.querySelector('#pi-files').addEventListener('change', async e => {
            await this._addFiles([...e.target.files]);
            e.target.value = '';
        });
        ov.querySelector('#pi-table tbody').addEventListener('click', e => {
            const v = e.target.closest('[data-view]'); if (!v) return;
            const it = this.items[Number(v.dataset.view)];
            if (it?.analysis?.geometry) PartViewer.open({ title: it.name, geometry: it.analysis.geometry, info: [
                ['Datei', it.fileName], ['Größe', `${it.analysis.geometry.bbox.w} × ${it.analysis.geometry.bbox.l} mm`],
                ['Konturen', it.analysis.geometry.contours.length], ['Anstiche', it.analysis.geometry.piercings],
                ['Schnittlänge', `${it.analysis.geometry.cutLength} m`], ['Netto-Fläche', `${it.analysis.geometry.netArea} m²`]] });
        });
        ov.querySelector('#pi-table tbody').addEventListener('input', e => {
            const tr = e.target.closest('tr'); if (!tr) return;
            const it = this.items[Number(tr.dataset.i)]; if (!it) return;
            if (e.target.dataset.f === 'qty') it.qty = Math.max(1, parseInt(e.target.value, 10) || 1);
            if (e.target.dataset.f === 'name') it.name = e.target.value;
            if (e.target.dataset.f === 'orderId') it.orderId = e.target.value;
        });
        ov.querySelector('#pi-layers').addEventListener('change', e => {
            if (e.target.dataset.layer !== undefined) {
                this.layerSel.set(e.target.dataset.layer, e.target.checked);
                this._revalidate();
            }
        });
        for (const id of ['pi-material', 'pi-thickness', 'pi-machine']) {
            ov.querySelector('#' + id).addEventListener('change', () => this._showTech());
        }
        this._showTech();
        this._render();
    }

    _techRef() {
        const q = id => this.overlay.querySelector('#' + id).value;
        const material = q('pi-material');
        return {
            machineId: q('pi-machine') || null,
            materialId: material === '' ? null : (Number.isNaN(Number(material)) ? material : Number(material)),
            thickness: parseFloat(q('pi-thickness')) || 0
        };
    }

    async _showTech() {
        const el = this.overlay?.querySelector('#pi-tech'); if (!el) return;
        const t = this._techRef();
        if (t.materialId === null || !(t.thickness > 0)) { el.textContent = ''; return; }
        try {
            const r = await PartLibrary.resolveTechnology(t.materialId, t.thickness, t.machineId);
            el.textContent = `Technologie: ${r.technology.technologyId}${r.exact ? '' : ` (nächste Dicke: ${r.technology.thickness} mm)`}`;
            this._techId = r.technology.technologyId;
        } catch {
            el.textContent = 'Keine Technologie hinterlegt'; this._techId = null;
        }
    }

    async _addFromServer() {
        const b = this.app?.dxfBrowser;
        if (!b || typeof b.pickMany !== 'function') {
            this.app?.showToast?.('Server-DXF-Browser nicht verfügbar — bitte „Dateien hinzufügen“ nutzen', 'warning');
            return;
        }
        const files = await b.pickMany();
        if (files?.length) await this._addFiles(files);
    }

    async _addFiles(files) {
        for (const f of files) {
            if (!/\.dxf$/i.test(f.name)) continue;
            if (this.items.some(i => i.fileName === f.name && i.size === f.size)) continue;
            const { name, orderId } = PartGeometry.namesFromFile(f.name);
            const it = { fileName: f.name, size: f.size, name, orderId, qty: 1, status: 'parsing', checked: false, layers: [], raw: null, analysis: null };
            this.items.push(it);
            this._render();
            try {
                const text = PartGeometry.decodeDXF(await f.arrayBuffer());
                const res = DXFParser.parse(text, { chainingTolerance: parseFloat(document.getElementById('chaining-tolerance')?.value) || 0.1, applyInsUnits: true });
                if (!res || !res.success) throw new Error('DXF-Parse-Fehler');
                it.raw = res.contours || [];
                it.layers = [...new Set(it.raw.map(c => c.layer || ''))];
                for (const l of it.layers) if (!this.layerSel.has(l)) this.layerSel.set(l, true);
            } catch (e) {
                it.status = 'error'; it.error = e.message;
            }
        }
        this._rebuildLayers();
        this._revalidate();
    }

    _removeSelected() {
        this.items = this.items.filter(i => !i.checked);
        this._rebuildLayers();
        this._render();
    }

    _rebuildLayers() {
        const all = new Set(this.items.flatMap(i => i.layers));
        for (const k of [...this.layerSel.keys()]) if (!all.has(k)) this.layerSel.delete(k);
        const el = this.overlay?.querySelector('#pi-layers'); if (!el) return;
        el.innerHTML = [...this.layerSel.entries()].map(([l, on]) =>
            `<label style="display:block"><input type="checkbox" data-layer="${this._esc(l)}" ${on ? 'checked' : ''}> ${this._esc(l || '(Default)')}</label>`).join('');
    }

    _setAllLayers(on) {
        for (const k of this.layerSel.keys()) this.layerSel.set(k, on);
        this._rebuildLayers();
        this._revalidate();
    }

    _revalidate() {
        for (const it of this.items) {
            if (!it.raw) continue;
            const sel = it.raw.filter(c => this.layerSel.get(c.layer || '') !== false);
            it.analysis = PartGeometry.analyze(sel);
            if (!it.analysis.ok) { it.status = 'error'; it.error = it.analysis.warnings.join('; '); }
            else { it.status = it.analysis.warnings.length ? 'warning' : 'ready'; it.error = ''; }
        }
        this._render();
    }

    _render() {
        if (!this.overlay) return;
        const icon = { ready: '🟢 Bereit', warning: '🟡 Warnung', error: '🔴 Fehler', parsing: '⏳ …', saved: '✅ Gespeichert' };
        const tb = this.overlay.querySelector('#pi-table tbody');
        tb.innerHTML = this.items.map((it, i) => {
            const g = it.analysis?.geometry;
            const tip = this._esc((it.analysis?.warnings || []).concat(it.error ? [it.error] : []).join('\n'));
            return `<tr data-i="${i}" style="border-top:1px solid #ddd">
                <td><input type="checkbox" ${it.checked ? 'checked' : ''}></td>
                <td title="${tip}">${icon[it.status] || it.status}</td>
                <td style="width:92px">${g && it.analysis.thumbnailSvg ? `<div data-view="${i}" title="Klicken für große Vorschau mit Zoom" style="width:84px;height:62px;cursor:zoom-in;border:1px solid #ddd;background:#fff">${it.analysis.thumbnailSvg.replace('<svg ', '<svg width="84" height="62" ')}</div>` : ''}</td>
                <td>${this._esc(it.fileName)}</td>
                <td><input data-f="name" value="${this._esc(it.name)}" style="width:130px"></td>
                <td><input data-f="orderId" value="${this._esc(it.orderId)}" style="width:150px"></td>
                <td><input data-f="qty" type="number" min="1" value="${it.qty}" style="width:55px"></td>
                <td>${g ? `${g.bbox.w} × ${g.bbox.l}` : ''}</td></tr>`;
        }).join('');
        tb.querySelectorAll('tr').forEach(tr => {
            tr.querySelector('input[type=checkbox]').addEventListener('change', e => {
                this.items[Number(tr.dataset.i)].checked = e.target.checked;
            });
        });
        const n = k => this.items.filter(i => i.status === k).length;
        this.overlay.querySelector('#pi-summary').textContent =
            `Gesamt: ${this.items.length} · Bereit: ${n('ready')} · Warnungen: ${n('warning')} · Fehler: ${n('error')} · Gespeichert: ${n('saved')}`;
    }

    async _save() {
        const techRef = this._techRef();
        if (techRef.materialId === null || !(techRef.thickness > 0)) {
            return this.app?.showToast?.('Bitte Material und Dicke wählen', 'warning');
        }
        techRef.technologyId = this._techId || null;
        const customer = this.overlay.querySelector('#pi-customer').value.trim();
        const todo = this.items.filter(i => (i.status === 'ready' || i.status === 'warning') && i.analysis?.ok);
        if (!todo.length) return this.app?.showToast?.('Keine speicherbaren Teile', 'warning');
        const names = todo.map(i => i.name.trim());
        if (names.some(n => !n)) return this.app?.showToast?.('Teilename darf nicht leer sein', 'warning');

        const records = todo.map((it, idx) => PartGeometry.toRecord(it.analysis, {
            partId: PartGeometry.newPartId(idx), fileName: it.fileName, name: it.name.trim(),
            orderId: it.orderId.trim() || PartGeometry.namesFromFile(it.fileName).orderId,
            customer, qty: it.qty, techRef, layers: [...this.layerSel.entries()].filter(([, on]) => on).map(([l]) => l)
        }));
        try {
            const res = await PartLibrary.importBatch(records);
            res.results.forEach((r, i) => {
                if (r.ok) { todo[i].status = 'saved'; todo[i].error = ''; }
                else { todo[i].status = 'error'; todo[i].error = r.error; }
            });
            this._render();
            this.app?.showToast?.(`${res.saved} von ${res.total} Teil(en) gespeichert`, res.failed ? 'warning' : 'success');
        } catch (e) {
            this.app?.showToast?.(`Speichern fehlgeschlagen: ${e.message}`, 'error');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Große Vorschau mit Zoom (Teilebibliothek, Import-Tabelle)
// ═══════════════════════════════════════════════════════════════════

class PartViewer {
    /** @param {{title:string, geometry:object, info?:Array<[string,string]>}} o */
    static open(o) { const v = new PartViewer(o); v.show(); return v; }

    constructor(o) { this.o = o; this.overlay = null; this.vb = null; this.fit = null; this.drag = null; }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    show() {
        const { svgInner, box } = PartGeometry.previewSvg(this.o.geometry);
        const pad = Math.max(box.w, box.h) * 0.05;
        this.fit = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
        this.vb = { ...this.fit };
        const info = (this.o.info || []).map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:#666">${this._esc(k)}</span><b>${this._esc(v)}</b></div>`).join('');
        const ov = document.createElement('div');
        ov.className = 'modal-overlay part-viewer-overlay';
        ov.style.zIndex = 9800;
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="width:min(1000px,96vw);max-width:96vw;height:84vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>${this._esc(this.o.title)}</span><button class="cldcl-close" data-act="close">×</button></div>
            <div class="cldcl-row" style="padding:6px 12px;gap:6px">
                <button data-act="zin" title="Vergrößern (+)">＋</button><button data-act="zout" title="Verkleinern (−)">－</button>
                <button data-act="fit" title="Einpassen (0 / Doppelklick)">Einpassen</button>
                <span id="pv-zoom" style="min-width:60px;font-size:11px;color:#555"></span>
                <span style="margin-left:auto;font-size:11px;color:#888">Mausrad: Zoom · Ziehen: Verschieben · Doppelklick: Einpassen</span>
            </div>
            <div style="display:flex;flex:1;min-height:0">
                <div id="pv-stage" style="flex:1;min-width:0;background:#fafafa;border-top:1px solid #ddd;position:relative;cursor:grab;touch-action:none;overflow:hidden">
                    <svg id="pv-svg" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet">${svgInner}</svg>
                </div>
                <div style="width:230px;border-left:1px solid #ddd;padding:10px;font-size:11px;display:flex;flex-direction:column;gap:5px;overflow:auto">
                    ${info}
                    <div style="margin-top:10px;color:#666">Legende</div>
                    <div><span style="display:inline-block;width:12px;height:12px;border:2px solid #0b5cad;background:rgba(0,120,212,.12);vertical-align:middle"></span> Teil</div>
                    <div><span style="display:inline-block;width:12px;height:12px;border:2px solid #c0392b;vertical-align:middle"></span> Loch / Ausschnitt</div>
                    <div><span style="display:inline-block;width:12px;height:0;border-top:2px solid #e8a020;vertical-align:middle"></span> Offene Kontur</div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        this._apply();
        const stage = ov.querySelector('#pv-stage');
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') this.close();
            if (act === 'zin') this.zoomAt(1.4);
            if (act === 'zout') this.zoomAt(1 / 1.4);
            if (act === 'fit') this.reset();
        });
        ov.addEventListener('keydown', e => e.stopPropagation());
        ov.addEventListener('keyup', e => e.stopPropagation());
        this._key = e => {
            if (!this.overlay) return;
            if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
            else if (e.key === '+' || e.key === '=') this.zoomAt(1.4);
            else if (e.key === '-') this.zoomAt(1 / 1.4);
            else if (e.key === '0') this.reset();
        };
        document.addEventListener('keydown', this._key, true);
        stage.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); this.zoomAt(Math.pow(1.0018, -e.deltaY), e.clientX, e.clientY); }, { passive: false });
        stage.addEventListener('dblclick', () => this.reset());
        stage.addEventListener('pointerdown', e => {
            this.drag = { x: e.clientX, y: e.clientY, vb: { ...this.vb } };
            try { stage.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
            stage.style.cursor = 'grabbing';
        });
        stage.addEventListener('pointermove', e => {
            if (!this.drag) return;
            const s = this._scale(); if (!s) return;
            this.vb.x = this.drag.vb.x - (e.clientX - this.drag.x) / s.k;
            this.vb.y = this.drag.vb.y - (e.clientY - this.drag.y) / s.k;
            this._apply();
        });
        const end = () => { this.drag = null; stage.style.cursor = 'grab'; };
        stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    }

    close() {
        document.removeEventListener('keydown', this._key, true);
        this.overlay?.remove(); this.overlay = null;
    }

    reset() { this.vb = { ...this.fit }; this._apply(); }

    /** Pixel pro Modelleinheit und Versatz des zentrierten Ausschnitts (preserveAspectRatio=meet). */
    _scale() {
        const r = this.overlay?.querySelector('#pv-svg').getBoundingClientRect();
        if (!r || !r.width || !r.height) return null;
        const k = Math.min(r.width / this.vb.w, r.height / this.vb.h);
        return { k, r, ox: (r.width - this.vb.w * k) / 2, oy: (r.height - this.vb.h * k) / 2 };
    }

    /** Zoom um den Punkt unter dem Cursor (ohne Position: Mitte). factor > 1 = hineinzoomen. */
    zoomAt(factor, cx, cy) {
        const total = this.fit.w / this.vb.w;                       // aktueller Zoom relativ zu "Einpassen"
        const nextTotal = Math.min(300, Math.max(0.5, total * factor));
        factor = nextTotal / total;
        if (factor === 1) return;
        const s = this._scale();
        let mx = this.vb.x + this.vb.w / 2, my = this.vb.y + this.vb.h / 2;    // Modellpunkt, der fix bleibt
        if (s && cx !== undefined) { mx = this.vb.x + (cx - s.r.left - s.ox) / s.k; my = this.vb.y + (cy - s.r.top - s.oy) / s.k; }
        const nw = this.vb.w / factor, nh = this.vb.h / factor;
        this.vb = { x: mx - (mx - this.vb.x) / factor, y: my - (my - this.vb.y) / factor, w: nw, h: nh };
        this._apply();
    }

    _apply() {
        const svg = this.overlay?.querySelector('#pv-svg'); if (!svg) return;
        svg.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
        const z = this.overlay.querySelector('#pv-zoom');
        if (z) z.textContent = `Zoom ${Math.round(this.fit.w / this.vb.w * 100)} %`;
    }
}

// Ribbon-Button (Datei → Import): eigenständig verdrahtet, damit app.js unberührt bleibt
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        let dlg = null;
        document.getElementById('btn-part-import')?.addEventListener('click', () => {
            if (!dlg || !dlg.overlay) dlg = new PartImportDialog(window.app);
            dlg.open();
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PartGeometry, PartLibrary, PartImportDialog, PartViewer };
}
