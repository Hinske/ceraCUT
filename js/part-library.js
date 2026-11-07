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
 * Build: 20261107-canvasprev
 * V1.7: Perf — ZoomPane zeichnet große Szenen (Schachtelplan) auf Canvas statt SVG (hunderte Teile hingen beim Zoomen), nur sichtbare Instanzen
 * V1.6: Fix — Mehrere Außenkonturen je DXF werden als eigene Teile importiert (analyzeSplit, identische zusammengefasst), REFERENZ-Layer standardmäßig ausgeschlossen (isReferenceLayer)
 * V1.5: Feat — ZoomPane (wiederverwendbare Zoom-/Verschiebefläche, auch im Autonest), PartViewer akzeptiert fertigen SVG-Inhalt
 * V1.4: Perf — Importtabelle rendert beim Mehrfachimport einmal statt je Datei (200 Dateien: 26 s → s. Test), Fortschritt „Lese Dateien …"
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


    // Layer, die den Plattenrahmen/Nullpunkt beschreiben (Waricam: "REFERENZ") — gehören nicht zum Teil.
    // Gleiche Regel steht in nesting-plan.js (REF_LAYER_RE) für ältere, schon importierte Teile.
    const REF_LAYER_RE = /referenz|reference|^ref$|blech|rahmen/i;
    const isReferenceLayer = name => REF_LAYER_RE.test(String(name || ''));

    function probeOf(c) {
        const pts = c.points;
        return probePoint(pts.length >= 2 ? pts : [pts[0], pts[0]]);
    }

    /**
     * DXF mit mehreren getrennten Außenkonturen (z. B. zwei Zuschnitte in einer Datei) → ein Teil je Außenkontur.
     * Löcher, Inseln und Gravuren werden der kleinsten umschließenden Außenkontur zugeordnet; Konturen außerhalb jeder
     * Außenkontur werden verworfen (Warnung). Identische Stücke (gleiche Form, nur verschoben) werden zusammengefasst.
     * @returns {{ok:boolean, pieces:Array<{analysis:object,count:number}>, warnings:string[]}}
     */
    function analyzeSplit(rawContours, opts = {}) {
        const usable = rawContours.filter(c => c.points && c.points.length >= 2);
        const closed = usable.filter(c => c.isClosed && c.points.length >= 3).map(c => ({ c, area: Math.abs(signedArea(c.points)), probe: probeOf(c) }));
        const outer = closed.filter(x => !closed.some(o => o !== x && o.area > x.area && pointInPolygon(x.probe, o.c.points)));
        if (outer.length <= 1) {
            const a = analyze(usable, opts);
            return { ok: a.ok, pieces: a.ok ? [{ analysis: a, count: 1 }] : [], warnings: a.warnings };
        }
        const groups = outer.map(o => ({ seed: o, contours: [o.c] }));
        let orphans = 0;
        for (const c of usable) {
            if (outer.some(o => o.c === c)) continue;
            const pr = probeOf(c);
            const home = groups.filter(g => pointInPolygon(pr, g.seed.c.points)).sort((a, b) => a.seed.area - b.seed.area)[0];
            if (home) home.contours.push(c); else orphans++;
        }
        const warnings = orphans ? [`${orphans} Kontur(en) außerhalb jeder Außenkontur ignoriert`] : [];
        // Stücke analysieren (Ursprung je Stück unten-links) und identische zusammenfassen
        const merged = new Map();
        for (const g of groups) {
            const a = analyze(g.contours, opts);
            if (!a.ok) continue;
            const key = JSON.stringify(a.geometry.contours.map(c => [c.role, c.closed, c.points.map(p => [Math.round(p[0] * 20) / 20, Math.round(p[1] * 20) / 20])]));
            const m = merged.get(key);
            if (m) m.count++; else merged.set(key, { analysis: a, count: 1 });
        }
        const pieces = [...merged.values()];
        for (const p of pieces) p.analysis.warnings.push(...[]);
        return { ok: pieces.length > 0, pieces, warnings: warnings.concat(pieces.flatMap(p => p.analysis.warnings)) };
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

    return { analyze, analyzeSplit, isReferenceLayer, toRecord, toDXF, fromAppContours, decodeDXF, previewSvg, namesFromFile, newPartId, signedArea, pointInPolygon };
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
        this.maxBatchBytes = 6 * 1024 * 1024;   // je Anfrage
        this.maxBatchCount = 200;
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
                <label style="font-size:11px"><input type="checkbox" id="pi-split" checked> Getrennte Außenkonturen als eigene Teile importieren (identische Stücke werden zusammengefasst, Menge × Anzahl)</label>
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
        ov.querySelector('#pi-split').addEventListener('change', () => this._revalidate());
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
        // Erst alle Zeilen anlegen und EINMAL rendern; pro Datei neu zu rendern wäre quadratisch (200 Dateien: 26 s)
        const added = [];
        for (const f of files) {
            if (!/\.dxf$/i.test(f.name)) continue;
            if (this.items.some(i => i.fileName === f.name && i.size === f.size)) continue;
            const { name, orderId } = PartGeometry.namesFromFile(f.name);
            const it = { fileName: f.name, size: f.size, name, orderId, qty: 1, status: 'parsing', checked: false, layers: [], raw: null, analysis: null, _file: f };
            this.items.push(it); added.push(it);
        }
        this._render();
        const tol = parseFloat(document.getElementById('chaining-tolerance')?.value) || 0.1;
        const sum = this.overlay?.querySelector('#pi-summary');
        for (let n = 0; n < added.length; n++) {
            const it = added[n];
            try {
                const text = PartGeometry.decodeDXF(await it._file.arrayBuffer());
                const res = DXFParser.parse(text, { chainingTolerance: tol, applyInsUnits: true });
                if (!res || !res.success) throw new Error('DXF-Parse-Fehler');
                it.raw = res.contours || [];
                it.layers = [...new Set(it.raw.map(c => c.layer || ''))];
                for (const l of it.layers) if (!this.layerSel.has(l)) this.layerSel.set(l, !PartGeometry.isReferenceLayer(l));   // REFERENZ-Layer standardmäßig aus
            } catch (e) {
                it.status = 'error'; it.error = e.message;
            }
            delete it._file;
            if (sum && n % 5 === 4) { sum.textContent = `Lese Dateien … ${n + 1}/${added.length}`; await new Promise(r => setTimeout(r, 0)); }   // UI atmen lassen
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
        const split = this.overlay?.querySelector('#pi-split')?.checked !== false;
        for (const it of this.items) {
            if (!it.raw) continue;
            const sel = it.raw.filter(c => this.layerSel.get(c.layer || '') !== false);
            const r = split ? PartGeometry.analyzeSplit(sel) : (() => { const a = PartGeometry.analyze(sel); return { ok: a.ok, pieces: a.ok ? [{ analysis: a, count: 1 }] : [], warnings: a.warnings }; })();
            it.pieces = r.pieces;
            it.analysis = r.pieces[0]?.analysis || { ok: false, warnings: r.warnings, geometry: null };
            if (!r.ok) { it.status = 'error'; it.error = r.warnings.join('; ') || 'Keine Geometrie'; }
            else { it.status = r.warnings.length ? 'warning' : 'ready'; it.error = ''; }
            it.warnText = r.warnings.join('\n');
        }
        this._render();
    }

    _render() {
        if (!this.overlay) return;
        const icon = { ready: '🟢 Bereit', warning: '🟡 Warnung', error: '🔴 Fehler', parsing: '⏳ …', saved: '✅ Gespeichert' };
        const tb = this.overlay.querySelector('#pi-table tbody');
        tb.innerHTML = this.items.map((it, i) => {
            const g = it.analysis?.geometry;
            const tip = this._esc((it.warnText ? [it.warnText] : []).concat(it.error ? [it.error] : []).join('\n'));
            return `<tr data-i="${i}" style="border-top:1px solid #ddd">
                <td><input type="checkbox" ${it.checked ? 'checked' : ''}></td>
                <td title="${tip}">${icon[it.status] || it.status}</td>
                <td style="width:92px">${g && it.analysis.thumbnailSvg ? `<div data-view="${i}" title="Klicken für große Vorschau mit Zoom" style="width:84px;height:62px;cursor:zoom-in;border:1px solid #ddd;background:#fff">${it.analysis.thumbnailSvg.replace('<svg ', '<svg width="84" height="62" ')}</div>` : ''}</td>
                <td>${this._esc(it.fileName)}</td>
                <td><input data-f="name" value="${this._esc(it.name)}" style="width:130px"></td>
                <td><input data-f="orderId" value="${this._esc(it.orderId)}" style="width:150px"></td>
                <td><input data-f="qty" type="number" min="1" value="${it.qty}" style="width:55px">${it.pieces && it.pieces.length > 1 || (it.pieces && it.pieces[0] && it.pieces[0].count > 1) ? `<div style="font-size:10px;color:#0b5cad" title="Aus dieser Datei entstehen ${it.pieces.length} Teil(e); identische Stücke werden zusammengefasst">${it.pieces.map(p => `${p.count}×`).join(' + ')} → ${it.pieces.length} Teil(e)</div>` : ''}</td>
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

        const layers = [...this.layerSel.entries()].filter(([, on]) => on).map(([l]) => l);
        const records = [], owner = [];            // owner[i] = Importzeile zu records[i]
        for (const it of todo) {
            const pcs = it.pieces && it.pieces.length ? it.pieces : [{ analysis: it.analysis, count: 1 }];
            pcs.forEach((pc, k) => {
                records.push(PartGeometry.toRecord(pc.analysis, {
                    partId: PartGeometry.newPartId(records.length), fileName: it.fileName,
                    name: pcs.length > 1 ? `${it.name.trim()}-${k + 1}` : it.name.trim(),
                    orderId: it.orderId.trim() || PartGeometry.namesFromFile(it.fileName).orderId,
                    customer, qty: it.qty * pc.count, techRef, layers
                }));
                owner.push(it);
            });
        }
        try {
            // In Paketen senden (Server begrenzt den Body auf 30 MB; komplexe Kunstteile haben >100 KB je Datensatz)
            const chunks = []; let cur = [], bytes = 0;
            for (const r of records) {
                const size = JSON.stringify(r).length;
                if (cur.length && (bytes + size > this.maxBatchBytes || cur.length >= this.maxBatchCount)) { chunks.push(cur); cur = []; bytes = 0; }
                cur.push(r); bytes += size;
            }
            if (cur.length) chunks.push(cur);
            const res = { total: 0, saved: 0, failed: 0 };
            const sum = this.overlay.querySelector('#pi-summary');
            let offset = 0;
            try {
                for (let c = 0; c < chunks.length; c++) {
                    if (chunks.length > 1 && sum) sum.textContent = `Speichere … Paket ${c + 1}/${chunks.length}`;
                    const r = await PartLibrary.importBatch(chunks[c]);
                    res.total += r.total; res.saved += r.saved; res.failed += r.failed;
                    // Status je Paket sofort setzen: bei späterem Fehler gelten bereits gespeicherte Teile nicht erneut als "bereit"
                    r.results.forEach((x, i) => {
                        const it = owner[offset + i];
                        if (x.ok) { if (it.status !== 'error') { it.status = 'saved'; it.error = ''; } } else { it.status = 'error'; it.error = x.error; }
                    });
                    offset += chunks[c].length;
                }
            } catch (e) {
                this._render();
                this.app?.showToast?.(`Speichern nach ${res.saved} von ${records.length} Teilen abgebrochen: ${e.message} — gespeicherte Teile sind markiert, bitte erneut speichern`, 'error');
                return;
            }
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

/**
 * Zoom-/Verschiebe-Fläche (Modell-Koordinaten, y bereits nach oben gespiegelt):
 * Mausrad = Zoom um den Cursor, Ziehen = Verschieben, Doppelklick = Einpassen, Zoom 50 %…300×.
 * Zwei Darstellungen: SVG (kleine Inhalte, z. B. ein Teil) und Canvas (große Szenen wie ein Schachtelplan mit
 * hunderten Teilen: `scene` = Teiletypen einmal + eine Matrix je Instanz; SVG mit tausenden Pfaden ließ den Browser
 * beim Zoomen hängen). Ohne Canvas/Path2D (alte Umgebungen, Tests) fällt eine Szene auf SVG zurück.
 */
class ZoomPane {
    /**
     * @param {HTMLElement} stage
     * @param {{content?:object, svgInner?:string, box?:{x,y,w,h}, scene?:object, svgId?:string, onZoom?:(pct:number)=>void}} o
     *   Inhalt entweder direkt in o oder als o.content (nötig, wenn `svgInner` ein Getter ist: Spread würde ihn auswerten)
     */
    constructor(stage, o) {
        const content = o.content || o;
        this.stage = stage; this.onZoom = o.onZoom || (() => {}); this.drag = null; this.scene = null; this.raf = 0;
        let ctx = null, canvas = null;
        if (content.scene && typeof Path2D !== 'undefined') {
            canvas = document.createElement('canvas');
            try { ctx = canvas.getContext && canvas.getContext('2d'); } catch { ctx = null; }
        }
        if (ctx) {
            this.mode = 'canvas'; this.view = canvas; this.ctx = ctx;
            canvas.style.cssText = 'width:100%;height:100%;display:block';
            if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this._schedule()); this._ro.observe(stage); }
        } else {
            this.mode = 'svg';
            this.view = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.view.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            this.view.style.cssText = 'width:100%;height:100%;display:block';
        }
        this.svg = this.mode === 'svg' ? this.view : null;       // Kompatibilität (Tests, bestehender Code)
        if (o.svgId) this.view.id = o.svgId;
        stage.appendChild(this.view);
        stage.style.cursor = 'grab'; stage.style.touchAction = 'none'; stage.style.overflow = 'hidden';
        this._wheel = e => { e.preventDefault(); e.stopPropagation(); this.zoomAt(Math.pow(1.0018, -e.deltaY), e.clientX, e.clientY); };
        this._dbl = () => this.reset();
        this._down = e => { this.drag = { x: e.clientX, y: e.clientY, vb: { ...this.vb } }; try { stage.setPointerCapture(e.pointerId); } catch { /* jsdom */ } stage.style.cursor = 'grabbing'; };
        this._move = e => {
            if (!this.drag) return;
            const sc = this._scale(); if (!sc) return;
            this.vb.x = this.drag.vb.x - (e.clientX - this.drag.x) / sc.k;
            this.vb.y = this.drag.vb.y - (e.clientY - this.drag.y) / sc.k;
            this._apply();
        };
        this._up = () => { this.drag = null; stage.style.cursor = 'grab'; };
        stage.addEventListener('wheel', this._wheel, { passive: false });
        stage.addEventListener('dblclick', this._dbl);
        stage.addEventListener('pointerdown', this._down);
        stage.addEventListener('pointermove', this._move);
        stage.addEventListener('pointerup', this._up);
        stage.addEventListener('pointercancel', this._up);
        this.setContent(content);
    }

    setContent(o) {
        const box = o.box, pad = Math.max(box.w, box.h) * 0.05;
        this.fit = { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
        this.vb = { ...this.fit };
        if (this.mode === 'canvas') this._setScene(o.scene);
        else this.view.innerHTML = o.svgInner;                    // bei Szenen: Getter baut das SVG erst jetzt
        this._apply();
    }

    destroy() {
        const st = this.stage;
        st.removeEventListener('wheel', this._wheel); st.removeEventListener('dblclick', this._dbl);
        st.removeEventListener('pointerdown', this._down); st.removeEventListener('pointermove', this._move);
        st.removeEventListener('pointerup', this._up); st.removeEventListener('pointercancel', this._up);
        if (this.raf) (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout)(this.raf);
        this._ro?.disconnect();
        this.view.remove();
    }

    reset() { this.vb = { ...this.fit }; this._apply(); }
    percent() { return Math.round(this.fit.w / this.vb.w * 100); }

    /** Pixel pro Modelleinheit und Versatz des zentrierten Ausschnitts (preserveAspectRatio=meet). */
    _scale() {
        const r = this.view.getBoundingClientRect();
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
        const sc = this._scale();
        let mx = this.vb.x + this.vb.w / 2, my = this.vb.y + this.vb.h / 2;    // Modellpunkt, der fix bleibt
        if (sc && cx !== undefined) { mx = this.vb.x + (cx - sc.r.left - sc.ox) / sc.k; my = this.vb.y + (cy - sc.r.top - sc.oy) / sc.k; }
        this.vb = { x: mx - (mx - this.vb.x) / factor, y: my - (my - this.vb.y) / factor, w: this.vb.w / factor, h: this.vb.h / factor };
        this._apply();
    }

    _apply() {
        if (this.mode === 'svg') this.view.setAttribute('viewBox', `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}`);
        else this._schedule();
        this.onZoom(this.percent());
    }

    // ── Canvas-Darstellung ──────────────────────────────────────────

    /** Teiletypen einmal als Path2D (Außen/Löcher/offene Konturen) + lokale BBox für das Ausblenden außerhalb des Bildes. */
    _setScene(scene) {
        for (const t of scene.types) {
            if (t._built) continue;
            t._disc = new Path2D(); t._hole = new Path2D(); t._open = new Path2D();
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const c of t.contours) {
                const path = c.role === 'disc' ? t._disc : c.role === 'hole' ? t._hole : t._open;
                c.points.forEach((p, i) => {
                    if (i) path.lineTo(p[0], p[1]); else path.moveTo(p[0], p[1]);
                    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
                });
                if (c.closed) path.closePath();
            }
            t._bb = { x0, y0, x1, y1 }; t._built = true;
        }
        this.scene = scene;
    }

    _schedule() {
        if (this.raf || !this.scene) return;
        const run = () => { this.raf = 0; this.draw(); };
        this.raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 16);
    }

    /** Zeichnet die Szene (nur sichtbare Instanzen); wird per requestAnimationFrame gebündelt. */
    draw() {
        if (this.mode !== 'canvas' || !this.scene) return 0;
        const c = this.view, ctx = this.ctx, dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const r = c.getBoundingClientRect();
        const w = r.width || 800, h = r.height || 400;
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
        const vb = this.vb, k = Math.min(w / vb.w, h / vb.h) * dpr;
        const ox = (w * dpr - vb.w * k) / 2 - vb.x * k, oy = (h * dpr - vb.h * k) / 2 - vb.y * k;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        const { sheet, types, items } = this.scene;
        ctx.setTransform(k, 0, 0, k, ox, oy);
        ctx.lineWidth = 1.5 * dpr / k; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#888';
        ctx.fillRect(0, -sheet.l, sheet.w, sheet.l); ctx.strokeRect(0, -sheet.l, sheet.w, sheet.l);
        // sichtbarer Bereich in Modellkoordinaten (mit Rand) zum Ausblenden
        const vx0 = vb.x - vb.w * 0.05, vx1 = vb.x + vb.w * 1.05, vy0 = vb.y - vb.h * 0.05, vy1 = vb.y + vb.h * 1.05;
        let drawn = 0;
        for (let ti = 0; ti < types.length; ti++) {
            const t = types[ti], bb = t._bb;
            ctx.lineJoin = 'round'; ctx.strokeStyle = t.color;
            for (const it of items) {
                if (it.t !== ti) continue;
                const [a, b, cc, d, e, f] = it.m;
                // Instanz-BBox (4 Ecken der lokalen BBox transformiert)
                const xs = [a * bb.x0 + cc * bb.y0 + e, a * bb.x1 + cc * bb.y0 + e, a * bb.x0 + cc * bb.y1 + e, a * bb.x1 + cc * bb.y1 + e];
                const ys = [b * bb.x0 + d * bb.y0 + f, b * bb.x1 + d * bb.y0 + f, b * bb.x0 + d * bb.y1 + f, b * bb.x1 + d * bb.y1 + f];
                if (Math.max(...xs) < vx0 || Math.min(...xs) > vx1 || Math.max(...ys) < vy0 || Math.min(...ys) > vy1) continue;
                ctx.setTransform(k * a, k * b, k * cc, k * d, k * e + ox, k * f + oy);
                ctx.lineWidth = 1.2 * dpr / k;
                ctx.globalAlpha = 0.15; ctx.fillStyle = t.color; ctx.fill(t._disc); ctx.globalAlpha = 1;
                ctx.fillStyle = '#fff'; ctx.fill(t._hole);
                ctx.stroke(t._disc); ctx.stroke(t._hole); ctx.stroke(t._open);
                drawn++;
            }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.lastDrawn = drawn;
        return drawn;
    }
}

class PartViewer {
    /** @param {{title:string, geometry?:object, svg?:{svgInner:string,box:object}, info?:Array<[string,string]>, legend?:string}} o */
    static open(o) { const v = new PartViewer(o); v.show(); return v; }

    constructor(o) { this.o = o; this.overlay = null; this.pane = null; }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    show() {
        const content = this.o.svg || PartGeometry.previewSvg(this.o.geometry);
        const info = (this.o.info || []).map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:#666">${this._esc(k)}</span><b>${this._esc(v)}</b></div>`).join('');
        const legend = this.o.legend || `<div style="margin-top:10px;color:#666">Legende</div>
                    <div><span style="display:inline-block;width:12px;height:12px;border:2px solid #0b5cad;background:rgba(0,120,212,.12);vertical-align:middle"></span> Teil</div>
                    <div><span style="display:inline-block;width:12px;height:12px;border:2px solid #c0392b;vertical-align:middle"></span> Loch / Ausschnitt</div>
                    <div><span style="display:inline-block;width:12px;height:0;border-top:2px solid #e8a020;vertical-align:middle"></span> Offene Kontur</div>`;
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
                <div id="pv-stage" style="flex:1;min-width:0;background:#fafafa;border-top:1px solid #ddd;position:relative"></div>
                <div style="width:230px;border-left:1px solid #ddd;padding:10px;font-size:11px;display:flex;flex-direction:column;gap:5px;overflow:auto">${info}${legend}</div>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        this.pane = new ZoomPane(ov.querySelector('#pv-stage'), { content, svgId: 'pv-svg',
            onZoom: pct => { const z = ov.querySelector('#pv-zoom'); if (z) z.textContent = `Zoom ${pct} %`; } });
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') this.close();
            if (act === 'zin') this.pane.zoomAt(1.4);
            if (act === 'zout') this.pane.zoomAt(1 / 1.4);
            if (act === 'fit') this.pane.reset();
        });
        ov.addEventListener('keydown', e => e.stopPropagation());
        ov.addEventListener('keyup', e => e.stopPropagation());
        this._key = e => {
            if (!this.overlay) return;
            if (e.key === 'Escape') { e.stopPropagation(); this.close(); }
            else if (e.key === '+' || e.key === '=') this.pane.zoomAt(1.4);
            else if (e.key === '-') this.pane.zoomAt(1 / 1.4);
            else if (e.key === '0') this.pane.reset();
        };
        document.addEventListener('keydown', this._key, true);
    }

    close() {
        document.removeEventListener('keydown', this._key, true);
        this.pane?.destroy(); this.pane = null;
        this.overlay?.remove(); this.overlay = null;
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
    module.exports = { PartGeometry, PartLibrary, PartImportDialog, PartViewer, ZoomPane };
}
