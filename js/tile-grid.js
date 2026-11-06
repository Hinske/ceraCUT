/**
 * CeraCUT Fliesen-Raster V1.3 (Befehl FLI)
 * Zeichnet ein Raster aus Fliesen: jede Fliese = 4 zusammenhaengende Linien (LINE, Layer "Fliese"), kein Rechteck-Objekt.
 *
 * Eingabe: Fliesenbreite (X), Fliesenlaenge (Y), Anzahl X/Y, Fuge X/Y (Standard 100 mm, Kante zu Kante).
 * Optional:
 *   - Nummerierung (TEXT auf Layer "Beschriftung", mittig in der Fliese): A1, B1 ... oder fortlaufend
 *   - Maserung/Drehrichtung: Pfeil auf Layer "Konstruktion" (senkrecht oder waagerecht)
 *   - Raster um den Ursprung (0,0) zentrieren, sonst linke untere Fliesenecke im Ursprung
 *
 * Layer: "Fliese" (blau, ACI 5), "Schnitt" (rot, ACI 1, wird nur angelegt, nichts gezeichnet),
 *        "Konstruktion" (rosa, ACI 6, Maserungspfeil), "Beschriftung" (gruen, ACI 3, Nummern). Beide werden NIE geschnitten
 *        (ceracut-pipeline setzt cuttingMode='none', siehe NON_CUT_LAYERS).
 *
 * Das DXF wird wie beim Zuschnitt-Generator ueber app.loadDXFContent() in einen neuen Tab geladen.
 * Benoetigt: drawing-tools.js (BaseTool, DrawingToolManager) nur fuer die Befehlszeile; der Kern laeuft auch ohne (Node-Test).
 *
 * V1.3: Dateiname frei waehlbar (Feld im Dialog, sonst automatisch); Fliese = 4 Einzellinien, vom Parser nicht verkettet, nie geschnitten
 * V1.2: Fliese wieder 4 zusammenhaengende LINE-Entities (kein Rechteck/Polylinie)
 * V1.1: Nummerierung auf eigenem Layer; Nummerierung auf eigenem Layer "Beschriftung"
 * V1.0: Erstversion
 * Created: 2026-11-06 MEZ
 * Last Modified: 2026-11-06
 * Build: 20261106-fliese4
 */

const TileGrid = (() => {
    'use strict';

    const VERSION = '1.3';
    const LOG = '[Fliesen-Raster V1.3]';
    const LAYER_FLIESE = 'Fliese', LAYER_SCHNITT = 'Schnitt', LAYER_KONSTR = 'Konstruktion', LAYER_TEXT = 'Beschriftung';
    const LAYER_COLORS = { [LAYER_FLIESE]: 5, [LAYER_SCHNITT]: 1, [LAYER_KONSTR]: 6, [LAYER_TEXT]: 3 };
    const MAX_TILES = 5000;

    const num = (v) => (+v.toFixed(3)).toString();
    const f6 = (v) => (+v.toFixed(6)).toString();
    const parseNum = (s) => parseFloat(String(s).replace(',', '.').trim());

    /** A, B, ... Z, AA, AB ... (0-basiert) */
    function rowLetters(i) {
        let s = '';
        for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
        return s;
    }

    /**
     * @param {Object} p { w, h, nx, ny, fugeX, fugeY, nummer:'aus'|'raster'|'lfd', maserung:'aus'|'senkrecht'|'waagerecht', zentriert:boolean }
     * Nummerierung beginnt links oben und laeuft zeilenweise (wie Text gelesen).
     */
    function compute(p) {
        const w = p.w, h = p.h, nx = Math.round(p.nx), ny = Math.round(p.ny);
        const fx = p.fugeX ?? 100, fy = p.fugeY ?? 100;
        if (![w, h].every(v => v > 0 && isFinite(v))) return { ok: false, error: 'Bitte Fliesenbreite und -länge als positive Zahl eingeben.' };
        if (!(nx >= 1 && ny >= 1) || !isFinite(nx) || !isFinite(ny)) return { ok: false, error: 'Anzahl X und Y muss mindestens 1 sein.' };
        if (!(fx >= 0 && fy >= 0) || !isFinite(fx) || !isFinite(fy)) return { ok: false, error: 'Fuge darf nicht negativ sein.' };
        if (nx * ny > MAX_TILES) return { ok: false, error: `Maximal ${MAX_TILES} Fliesen pro Raster.` };

        const totalW = nx * w + (nx - 1) * fx, totalH = ny * h + (ny - 1) * fy;
        const ox = p.zentriert ? -totalW / 2 : 0, oy = p.zentriert ? -totalH / 2 : 0;
        const nummer = p.nummer || 'aus', maserung = p.maserung || 'aus';
        const textH = Math.max(1, Math.min(w, h) * 0.25);

        const ents = [];   // { t:'L'|'T', layer, ... }
        const tiles = [];
        let lfd = 0;
        for (let r = 0; r < ny; r++) {              // r = 0 -> oberste Reihe
            for (let c = 0; c < nx; c++) {
                const x0 = ox + c * (w + fx);
                const y0 = oy + (ny - 1 - r) * (h + fy);
                const x1 = x0 + w, y1 = y0 + h;
                ents.push(   // 4 zusammenhaengende LINE-Entities (Endpunkt = naechster Startpunkt), KEIN Rechteck-/Polylinien-Objekt
                    { t: 'L', layer: LAYER_FLIESE, x1: x0, y1: y0, x2: x1, y2: y0 },
                    { t: 'L', layer: LAYER_FLIESE, x1: x1, y1: y0, x2: x1, y2: y1 },
                    { t: 'L', layer: LAYER_FLIESE, x1: x1, y1: y1, x2: x0, y2: y1 },
                    { t: 'L', layer: LAYER_FLIESE, x1: x0, y1: y1, x2: x0, y2: y0 });
                const cx = x0 + w / 2, cy = y0 + h / 2;
                lfd++;
                const label = nummer === 'raster' ? `${rowLetters(r)}${c + 1}` : String(lfd);
                tiles.push({ x0, y0, x1, y1, label });
                if (nummer !== 'aus') {
                    ents.push({ t: 'T', layer: LAYER_TEXT, x: cx, y: cy, h: textH, text: label });
                }
                if (maserung !== 'aus') {
                    const vert = maserung === 'senkrecht';
                    const len = (vert ? h : w) * 0.4, hd = Math.min(len * 0.25, Math.min(w, h) * 0.08);
                    // Pfeil wandert aus der Mitte, wenn Nummer in der Mitte steht (Pfeil im oberen/rechten Drittel)
                    const off = nummer !== 'aus' ? (vert ? h : w) * 0.3 : 0;
                    const ax = vert ? cx : cx + off - len / 2, ay = vert ? cy + off - len / 2 : cy;
                    const bx = vert ? ax : ax + len, by = vert ? ay + len : ay;
                    ents.push({ t: 'L', layer: LAYER_KONSTR, x1: ax, y1: ay, x2: bx, y2: by });
                    if (vert) ents.push({ t: 'L', layer: LAYER_KONSTR, x1: bx - hd, y1: by - hd, x2: bx, y2: by },
                                         { t: 'L', layer: LAYER_KONSTR, x1: bx + hd, y1: by - hd, x2: bx, y2: by });
                    else ents.push({ t: 'L', layer: LAYER_KONSTR, x1: bx - hd, y1: by - hd, x2: bx, y2: by },
                                    { t: 'L', layer: LAYER_KONSTR, x1: bx - hd, y1: by + hd, x2: bx, y2: by });
                }
            }
        }
        const name = `Fliese${num(w)}X${num(h)}_${nx}X${ny}`;
        return { ok: true, name, fileName: name + '.dxf', count: nx * ny, w, h, nx, ny, fugeX: fx, fugeY: fy,
            totalW, totalH, ox, oy, tiles, ents, dxf: buildDXF(ents) };
    }

    // ── DXF (R12: LINE + TEXT) ───────────────────────────────────────
    function buildDXF(ents) {
        const z = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
            '0', 'SECTION', '2', 'TABLES',
            '0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0',
            '3', 'Solid line', '72', '65', '73', '0', '40', '0.0', '0', 'ENDTAB',
            '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(LAYER_COLORS).length)];
        for (const [name, color] of Object.entries(LAYER_COLORS)) {
            z.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS');   // Schnitt: nur angelegt
        }
        z.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
        for (const e of ents) {
            if (e.t === 'L') z.push('0', 'LINE', '8', e.layer, '10', f6(e.x1), '20', f6(e.y1), '30', '0.0', '11', f6(e.x2), '21', f6(e.y2), '31', '0.0');
            else z.push('0', 'TEXT', '8', e.layer, '10', f6(e.x), '20', f6(e.y), '30', '0.0', '40', f6(e.h), '1', e.text,
                '72', '1', '11', f6(e.x), '21', f6(e.y), '31', '0.0');   // zentriert (Alignment-Punkt = Mitte)
        }
        z.push('0', 'ENDSEC', '0', 'EOF');
        return z.join('\r\n') + '\r\n';
    }

    // ── Dialog ───────────────────────────────────────────────────────
    const FIELD_CSS = 'width:100%;padding:5px 8px;background:#2a2a2a;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;';
    const LABEL_CSS = 'display:block;font-size:11px;color:#9aa;margin:8px 0 2px;';

    function previewSVG(r) {
        const pad = Math.max(r.totalW, r.totalH) * 0.03, lw = Math.max(r.totalW, r.totalH) / 500;
        let s = `<svg viewBox="${r.ox - pad} ${-(r.oy + r.totalH) - pad} ${r.totalW + 2 * pad} ${r.totalH + 2 * pad}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"><g transform="scale(1 -1)">`;
        for (const t of r.tiles) s += `<rect x="${t.x0}" y="${t.y0}" width="${t.x1 - t.x0}" height="${t.y1 - t.y0}" fill="#1a2330" stroke="#4aa3ff" stroke-width="${lw}"/>`;
        for (const e of r.ents) {
            if (e.layer !== LAYER_KONSTR && e.layer !== LAYER_TEXT) continue;
            if (e.t === 'L') s += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#ff7ad9" stroke-width="${lw}"/>`;
            else s += `<text transform="translate(${e.x} ${e.y}) scale(1 -1)" font-size="${e.h}" fill="#ff7ad9" text-anchor="middle" dominant-baseline="central">${e.text}</text>`;
        }
        return s + '</g></svg>';
    }

    function openDialog(options = {}) {
        const app = options.app || (typeof window !== 'undefined' ? window.app : null);
        if (typeof document === 'undefined') return;
        document.getElementById('fliese-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'fliese-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        const fld = (id, label, val = '') => `<div style="flex:1"><label style="${LABEL_CSS}">${label}</label><input id="${id}" style="${FIELD_CSS}" value="${val}" inputmode="decimal"></div>`;
        overlay.innerHTML = `
            <div style="background:#1e1e1e;border:1px solid #555;border-radius:8px;width:min(860px,96vw);max-height:94vh;overflow:auto;padding:18px 20px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:'Segoe UI',sans-serif;">
                <h3 style="margin:0 0 10px;font-size:15px;color:#00aaff;">Fliesen-Raster zeichnen</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div style="flex:0 0 300px;min-width:260px;">
                        <div style="display:flex;gap:10px;">${fld('fli-w', 'Fliese Breite X [mm]')}${fld('fli-h', 'Fliese Länge Y [mm]')}</div>
                        <div style="display:flex;gap:10px;">${fld('fli-nx', 'Anzahl X')}${fld('fli-ny', 'Anzahl Y')}</div>
                        <div style="display:flex;gap:10px;">${fld('fli-fx', 'Fuge X [mm]', '100')}${fld('fli-fy', 'Fuge Y [mm]', '100')}</div>
                        <label style="${LABEL_CSS}">Nummerierung (Layer Beschriftung, wird nicht geschnitten)</label>
                        <select id="fli-nr" style="${FIELD_CSS}"><option value="aus">Keine</option><option value="raster">Reihe/Spalte (A1, A2 …)</option><option value="lfd">Fortlaufend (1, 2, 3 …)</option></select>
                        <label style="${LABEL_CSS}">Maserung / Drehrichtung (Pfeil, Layer Konstruktion)</label>
                        <select id="fli-ms" style="${FIELD_CSS}"><option value="aus">Keine</option><option value="senkrecht">Senkrecht (Y)</option><option value="waagerecht">Waagerecht (X)</option></select>
                        <label style="${LABEL_CSS}">Dateiname</label>
                        <input id="fli-name" style="${FIELD_CSS}" placeholder="automatisch" autocomplete="off">
                        <label style="display:block;font-size:12px;margin-top:10px;"><input type="checkbox" id="fli-mid"> Raster um Ursprung (0,0) zentrieren</label>
                    </div>
                    <div style="flex:1 1 380px;min-width:300px;display:flex;flex-direction:column;gap:10px;">
                        <div id="fli-prev" style="height:300px;background:#12161c;border:1px solid #333;border-radius:4px;padding:6px;box-sizing:border-box;"></div>
                        <div id="fli-res" style="font-size:12px;"></div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button id="fli-cancel" style="padding:6px 16px;background:#555;border:none;border-radius:4px;color:#ddd;cursor:pointer;">Abbrechen</button>
                    <button id="fli-save" style="padding:6px 16px;background:#3a3a3a;border:1px solid #666;border-radius:4px;color:#ddd;cursor:pointer;">DXF speichern</button>
                    <button id="fli-ok" style="padding:6px 16px;background:#00aaff;border:none;border-radius:4px;color:#000;cursor:pointer;font-weight:600;">Erzeugen</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const $ = (id) => overlay.querySelector('#' + id);
        let last = null;

        function update() {
            last = compute({
                w: parseNum($('fli-w').value), h: parseNum($('fli-h').value),
                nx: parseNum($('fli-nx').value), ny: parseNum($('fli-ny').value),
                fugeX: parseNum($('fli-fx').value), fugeY: parseNum($('fli-fy').value),
                nummer: $('fli-nr').value, maserung: $('fli-ms').value, zentriert: $('fli-mid').checked
            });
            const empty = [$('fli-w'), $('fli-h'), $('fli-nx'), $('fli-ny')].some(i => !i.value.trim());
            $('fli-res').innerHTML = last.ok
                ? `<div style="font-size:15px;color:#fff;font-weight:600">${last.count} Fliesen</div>
                   <div style="color:#9aa;margin-top:4px">Fläche ${num(last.totalW)} × ${num(last.totalH)} mm · Fuge ${num(last.fugeX)} / ${num(last.fugeY)} mm</div>
                   <div style="color:#9aa">Layer: Fliese (blau) · Schnitt (rot, leer) · Konstruktion (rosa) · Beschriftung (grün)</div>`
                : (empty ? '<div style="color:#9aa">Bitte Fliesenmaß und Anzahl eingeben.</div>' : `<div style="color:#ff6b6b">⚠ ${last.error}</div>`);
            if (last.ok) {   // frei gewaehlter Dateiname (ohne .dxf eingeben), sonst automatischer Name
                const raw = $('fli-name').value.trim().replace(/\.dxf$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
                if (raw) { last.name = raw; last.fileName = raw + '.dxf'; }
                $('fli-name').placeholder = last.name;
            }
            $('fli-prev').innerHTML = last.ok ? previewSVG(last) : '';
            $('fli-ok').disabled = $('fli-save').disabled = !last.ok;
            $('fli-ok').style.opacity = $('fli-save').style.opacity = last.ok ? '1' : '0.4';
        }

        const onDocKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onDocKey, true);
        const close = () => {
            document.removeEventListener('keydown', onDocKey, true);
            overlay.remove();
            setTimeout(() => { const cv = app?.renderer?.canvas; if (cv) cv.style.cursor = ''; }, 0);
        };
        overlay.addEventListener('input', update);
        overlay.addEventListener('change', update);
        $('fli-cancel').addEventListener('click', close);
        overlay.addEventListener('mousedown', (e) => { overlay._downOnBg = (e.target === overlay); });
        overlay.addEventListener('click', (e) => { if (e.target === overlay && overlay._downOnBg) close(); });
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && last?.ok) $('fli-ok').click();
            e.stopPropagation();
        });
        overlay.addEventListener('keyup', (e) => e.stopPropagation());
        $('fli-ok').addEventListener('click', () => {
            if (!last?.ok) return;
            if (!app?.loadGeneratedDXF) { console.warn(LOG, 'app.loadDXFContent nicht verfuegbar'); return; }
            app.loadGeneratedDXF(last.fileName, last.dxf, (last.dxf.length / 1024).toFixed(1));
            app.showToast?.(`Fliesen-Raster ${last.name}: ${last.count} Fliesen erzeugt`, 'success');
            close();
        });
        $('fli-save').addEventListener('click', () => {
            if (!last?.ok) return;
            app.promptSaveToServer({ defaultName: last.fileName, content: last.dxf, title: 'DXF speichern', bind: false });
        });
        update();
        setTimeout(() => $('fli-w').focus(), 50);
    }

    return { VERSION, LAYER_COLORS, compute, buildDXF, openDialog, _internals: { rowLetters } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TileGrid;
if (typeof window !== 'undefined') window.TileGrid = TileGrid;

// Befehl FLI — Lazy-Patch in DrawingToolManager (wie Zuschnitt-Generator)
if (typeof BaseTool !== 'undefined' && typeof DrawingToolManager !== 'undefined') {
    class TileGridTool extends BaseTool {
        start() { TileGrid.openDialog({ app: this.manager.app }); this.cancel(); }
    }
    const _origStartToolFli = DrawingToolManager.prototype.startTool;
    DrawingToolManager.prototype.startTool = function (shortcut) {
        if (!this._fliRegistered) {
            this._fliRegistered = true;
            this.tools['FLI'] = () => new TileGridTool(this);
        }
        return _origStartToolFli.call(this, shortcut);
    };
}
