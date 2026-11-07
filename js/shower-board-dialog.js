/**
 * CeraCUT Duschboard-Dialog V0.1 (Phase 2b): Eingabe + Live-Vorschau mit Bemaßung + Stückliste
 * Kern: shower-board-generator.js (ShowerBoardGenerator). Befehl DUSCH, Ribbon CAD -> Zuschnitte -> Duschboard.
 *
 * Bemaßung (zur Kontrolle): Gesamtmaß (Fliesenfeld, bei Außenmaß zusätzlich Außenmaß), Ablaufmaße und -lage,
 * Teilebreiten/-höhen je Fugenspalte/-zeile, Gehrungswinkel, Maße je Teil (bbox) + Nummern, Stückliste.
 * Phase 2b: Vorschau nur lesend; Fugenbild von Hand editieren folgt in 2c.
 *
 * V0.1: Erstversion
 * Created: 2026-11-07 MEZ
 * Last Modified: 2026-11-07
 * Build: 20261107-dusch2
 */

const ShowerBoardDialog = (() => {
    'use strict';

    const LOG = '[Duschboard-Dialog V0.1]';
    const FIELD_CSS = 'width:100%;padding:5px 8px;background:#2a2a2a;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;';
    const LABEL_CSS = 'display:block;font-size:11px;color:#9aa;margin:8px 0 2px;';

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const de = (v, d = 1) => (+v.toFixed(d)).toString().replace('.', ',');
    const parseNum = s => { const t = String(s).trim().replace(',', '.'); return t === '' ? NaN : Number(t); };

    const bbox = poly => {
        const xs = poly.map(q => q.x), ys = poly.map(q => q.y);
        return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };

    function centroid(poly) {
        let a = 0, x = 0, y = 0;
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length], k = p.x * q.y - q.x * p.y;
            a += k; x += (p.x + q.x) * k; y += (p.y + q.y) * k;
        }
        return a ? { x: x / (3 * a), y: y / (3 * a) } : poly[0];
    }

    /** Teile nummerieren: zeilenweise von unten links nach oben rechts (Schwerpunkt). */
    function numbered(pieces) {
        const list = pieces.map(pc => {
            const b = bbox(pc.poly);
            const c = centroid(pc.poly);   // Schwerpunkt: Beschriftung liegt auch bei Dreiecken/Trapezen im Teil
            return { pc, b, w: b.x1 - b.x0, h: b.y1 - b.y0, cx: c.x, cy: c.y };
        });
        list.sort((a, c) => (Math.abs(a.cy - c.cy) > 1 ? a.cy - c.cy : a.cx - c.cx));
        list.forEach((it, i) => { it.nr = i + 1; });
        return list;
    }

    // ── Vorschau (SVG) ──────────────────────────────────────────────────────
    function previewSVG(r, showDims) {
        const { W, H, drain: d, fuge } = r.p;
        const VW = 900, VH = 560, M = { l: 70, r: 70, t: 46, b: 78 };
        const s = Math.min((VW - M.l - M.r) / W, (VH - M.t - M.b) / H);
        const ox = M.l + ((VW - M.l - M.r) - W * s) / 2, oy = M.t + ((VH - M.t - M.b) - H * s) / 2;
        const X = x => ox + x * s, Y = y => oy + (H - y) * s;
        const items = numbered(r.pieces);
        const warnSet = new Set(r.warnings.map(w => w.piece));
        const f = v => v.toFixed(1);
        const COL = '#ffd24a', COLD = '#9fd0ff';
        let g = '';

        // Teile
        for (const it of items) {
            const pts = it.pc.poly.map(q => `${f(X(q.x))},${f(Y(q.y))}`).join(' ');
            const bad = warnSet.has(it.pc);
            g += `<polygon points="${pts}" fill="${bad ? 'rgba(240,180,41,0.35)' : 'rgba(74,163,255,0.16)'}" stroke="${bad ? '#f0b429' : '#4aa3ff'}" stroke-width="1"/>`;
        }
        // Ablauf
        g += `<rect x="${f(X(d.x0))}" y="${f(Y(d.y1))}" width="${f((d.x1 - d.x0) * s)}" height="${f((d.y1 - d.y0) * s)}" fill="rgba(255,90,77,0.18)" stroke="#ff5a4d" stroke-width="1.2" stroke-dasharray="4 3"/>`;
        // Teilenummern + Maße
        for (const it of items) {
            const px = X(it.cx), py = Y(it.cy), big = it.w * s > 46 && it.h * s > 26;
            if (showDims && big) {
                g += `<text x="${f(px)}" y="${f(py - 2)}" text-anchor="middle" font-size="10" fill="#cfe6ff">${it.nr}</text>`;
                g += `<text x="${f(px)}" y="${f(py + 10)}" text-anchor="middle" font-size="9" fill="#8fb4d8">${de(it.w)}×${de(it.h)}</text>`;
            } else if (it.w * s > 26 && it.h * s > 18) {
                g += `<text x="${f(px)}" y="${f(py + 3)}" text-anchor="middle" font-size="9" fill="#cfe6ff">${it.nr}</text>`;
            }
        }

        // Bemaßungshelfer
        const tick = (x, y, dx, dy) => `<line x1="${f(x - dy * 4)}" y1="${f(y + dx * 4)}" x2="${f(x + dy * 4)}" y2="${f(y - dx * 4)}" stroke="${COL}" stroke-width="1"/>`;
        function dimH(xa, xb, ySvg, label, color = COL, lblDy = -4) {
            const a = X(xa), b = X(xb);
            let o = `<line x1="${f(a)}" y1="${f(ySvg)}" x2="${f(b)}" y2="${f(ySvg)}" stroke="${color}" stroke-width="1"/>` +
                `<line x1="${f(a - 3)}" y1="${f(ySvg + 3)}" x2="${f(a + 3)}" y2="${f(ySvg - 3)}" stroke="${color}"/>` +
                `<line x1="${f(b - 3)}" y1="${f(ySvg + 3)}" x2="${f(b + 3)}" y2="${f(ySvg - 3)}" stroke="${color}"/>`;
            if (Math.abs(b - a) > 24) o += `<text x="${f((a + b) / 2)}" y="${f(ySvg + lblDy)}" text-anchor="middle" font-size="10" fill="${color}">${label}</text>`;
            return o;
        }
        function dimV(ya, yb, xSvg, label, color = COL, side = 1) {
            const a = Y(ya), b = Y(yb);
            let o = `<line x1="${f(xSvg)}" y1="${f(a)}" x2="${f(xSvg)}" y2="${f(b)}" stroke="${color}" stroke-width="1"/>` +
                `<line x1="${f(xSvg - 3)}" y1="${f(a + 3)}" x2="${f(xSvg + 3)}" y2="${f(a - 3)}" stroke="${color}"/>` +
                `<line x1="${f(xSvg - 3)}" y1="${f(b + 3)}" x2="${f(xSvg + 3)}" y2="${f(b - 3)}" stroke="${color}"/>`;
            if (Math.abs(b - a) > 24) {
                const tx = xSvg + side * 5, ty = (a + b) / 2;
                o += `<text x="${f(tx)}" y="${f(ty)}" text-anchor="middle" font-size="10" fill="${color}" transform="rotate(-90 ${f(tx)} ${f(ty)})" dy="${side > 0 ? 9 : -2}">${label}</text>`;
            }
            return o;
        }

        // Spalten-/Zeilenbreiten (Teile ohne Fuge) — unten bzw. links
        const xb = [0, ...r.grid.xLines, W], yb = [0, ...r.grid.yLines, H], hf = fuge / 2;
        const bottom = Y(0) + 16, bottom2 = Y(0) + 40, bottom3 = Y(0) + 62, left = X(0) - 16;
        for (let i = 0; i < xb.length - 1; i++) {
            const a = xb[i] + (i > 0 ? hf : 0), b = xb[i + 1] - (i < xb.length - 2 ? hf : 0);
            g += dimH(a, b, bottom, de(b - a));
        }
        for (let j = 0; j < yb.length - 1; j++) {
            const a = yb[j] + (j > 0 ? hf : 0), b = yb[j + 1] - (j < yb.length - 2 ? hf : 0);
            g += dimV(a, b, left, de(b - a), COL, -1);
        }
        // Ablauf: Lage unten (Abstände links/Ablauf/rechts), rechts (unten/Ablauf/oben)
        g += dimH(0, d.x0, bottom2, de(d.x0), COLD) + dimH(d.x0, d.x1, bottom2, de(d.x1 - d.x0), COLD) + dimH(d.x1, W, bottom2, de(W - d.x1), COLD);
        const right = X(W) + 16;
        g += dimV(0, d.y0, right, de(d.y0), COLD) + dimV(d.y0, d.y1, right, de(d.y1 - d.y0), COLD) + dimV(d.y1, H, right, de(H - d.y1), COLD);
        // Gesamtmaße
        g += dimH(0, W, bottom3, `Fliesenfeld ${de(W)}` + (r.p.masseArt === 'aussen' ? ` (Außenmaß ${de(r.p.breite)})` : ''), '#fff', -4);
        g += dimV(0, H, X(W) + 44, `${de(H)}` + (r.p.masseArt === 'aussen' ? ` (außen ${de(r.p.tiefe)})` : ''), '#fff', 1);
        // Gehrungswinkel (oben rechts / oben links Diagonale), Winkel gegen die Waagerechte
        const angTR = Math.atan2(H - d.y1, W - d.x1) * 180 / Math.PI;
        const angTL = Math.atan2(H - d.y1, d.x0) * 180 / Math.PI;
        const angBR = Math.atan2(d.y0, W - d.x1) * 180 / Math.PI;
        const angBL = Math.atan2(d.y0, d.x0) * 180 / Math.PI;
        const lab = (px, py, t) => `<text x="${f(X(px))}" y="${f(Y(py))}" text-anchor="middle" font-size="10" fill="#ff9d95">${t}</text>`;
        g += lab(d.x1 + (W - d.x1) * 0.55, d.y1 + (H - d.y1) * 0.45 + 12, `${de(angTR)}°`);
        g += lab(d.x0 - d.x0 * 0.55, d.y1 + (H - d.y1) * 0.45 + 12, `${de(angTL)}°`);
        g += lab(d.x1 + (W - d.x1) * 0.55, d.y0 - d.y0 * 0.45 - 4, `${de(angBR)}°`);
        g += lab(d.x0 - d.x0 * 0.55, d.y0 - d.y0 * 0.45 - 4, `${de(angBL)}°`);
        // Legende
        g += `<text x="${M.l}" y="20" font-size="11" fill="#9aa">Gelb: Teilemaße (ohne Fuge) · Blau: Ablauflage · Rot: Gehrungswinkel · Orange Fläche: Teil &lt; Mindestmaß</text>`;

        return `<svg viewBox="0 0 ${VW} ${VH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" font-family="Segoe UI,sans-serif">` +
            `<rect x="${f(X(0))}" y="${f(Y(H))}" width="${f(W * s)}" height="${f(H * s)}" fill="none" stroke="#556" stroke-width="1" stroke-dasharray="2 3"/>${g}</svg>`;
    }

    function resultHTML(r) {
        if (!r.ok) return `<div style="color:#ff6b6b;font-size:13px;">⚠ ${esc(r.error)}</div>`;
        const { W, H, drain: d } = r.p;
        let h = `<div style="font-size:15px;color:#fff;font-weight:600;margin-bottom:4px">${r.count} Teile &nbsp;<span style="font-weight:400;color:#9aa;font-size:12px">Fliesenfeld ${de(W)} × ${de(H)} mm · ${r.grid.xLines.length + 1} Spalten × ${r.grid.yLines.length + 1} Zeilen</span></div>`;
        h += `<div style="font-size:12px;color:#9aa;margin-bottom:6px">Datei: ${esc(r.fileName)}</div>`;
        for (const w of r.warnings) h += `<div style="font-size:12px;color:#f0b429">⚠ ${esc(w.text)}</div>`;
        const items = numbered(r.pieces);
        // Stückliste: gleiche Teile (Eckenzahl + Maße auf 0,1 mm) zusammenfassen
        const groups = new Map();
        for (const it of items) {
            const k = `${it.pc.poly.length}|${de(it.w)}|${de(it.h)}`;
            const g = groups.get(k) || { n: 0, nrs: [], it };
            g.n++; g.nrs.push(it.nr); groups.set(k, g);
        }
        h += '<table style="font-size:12px;color:#ddd;border-collapse:collapse;margin-top:6px"><tr style="color:#9aa"><td style="padding:1px 12px 1px 0">Anz.</td><td style="padding-right:12px">Maß (bbox)</td><td style="padding-right:12px">Form</td><td>Nr.</td></tr>';
        const shape = n => n === 3 ? 'Dreieck' : n === 4 ? 'Rechteck/Trapez' : n + '-Eck';
        for (const g of groups.values()) {
            h += `<tr><td>${g.n}×</td><td style="padding-right:12px">${de(g.it.w)} × ${de(g.it.h)}</td><td style="padding-right:12px">${shape(g.it.pc.poly.length)}</td><td style="color:#9aa">${g.nrs.join(', ')}</td></tr>`;
        }
        return h + '</table>';
    }

    // ── Dialog ──────────────────────────────────────────────────────────────
    function openDialog(options = {}) {
        const app = options.app || (typeof window !== 'undefined' ? window.app : null);
        if (typeof document === 'undefined') return;
        document.getElementById('dusch-overlay')?.remove();

        const row2 = (a, b) => `<div style="display:flex;gap:10px;"><div style="flex:1">${a}</div><div style="flex:1">${b}</div></div>`;
        const fld = (id, label, val) => `<label style="${LABEL_CSS}">${label}</label><input id="${id}" style="${FIELD_CSS}" value="${val}" inputmode="decimal">`;
        const overlay = document.createElement('div');
        overlay.id = 'dusch-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#1e1e1e;border:1px solid #555;border-radius:8px;width:min(1280px,98vw);max-height:96vh;overflow:auto;padding:16px 20px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:'Segoe UI',sans-serif;">
                <h3 style="margin:0 0 8px;font-size:15px;color:#00aaff;">Duschboard erzeugen</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div style="flex:0 0 290px;min-width:260px;">
                        <label style="${LABEL_CSS}">Maßangabe bezieht sich auf</label>
                        <select id="ds-art" style="${FIELD_CSS}"><option value="fliesenfeld">Fliesenfeld (reine Fliesenfläche)</option><option value="aussen">Außenmaß (inkl. Randfuge)</option></select>
                        ${row2(fld('ds-b', 'Breite X [mm]', '1300'), fld('ds-t', 'Tiefe Y [mm]', '1000'))}
                        ${row2(fld('ds-fx', 'Fliese X [mm]', '600'), fld('ds-fy', 'Fliese Y [mm]', '300'))}
                        ${row2(fld('ds-fuge', 'Fuge [mm]', '2'), fld('ds-rf', 'Randfuge [mm]', '2'))}
                        <div style="margin-top:10px;font-size:12px;color:#00aaff;">Ablauf (rechteckig)</div>
                        ${row2(fld('ds-aw', 'Breite [mm]', '140'), fld('ds-ah', 'Tiefe [mm]', '140'))}
                        ${row2(fld('ds-cx', 'Mitte X [mm] (leer = mittig)', ''), fld('ds-cy', 'Mitte Y [mm] (leer = mittig)', ''))}
                        <label style="${LABEL_CSS}">Fugenbild (Raster)</label>
                        <select id="ds-mode" style="${FIELD_CSS}">
                            <option value="ablauf">Ab Ablaufkante</option>
                            <option value="ecke">Ab Ecke links unten</option>
                            <option value="keins">Kein Raster (nur Gehrung)</option>
                        </select>
                        ${fld('ds-min', 'Warnung bei Teil schmaler als [mm]', '30')}
                        <label style="display:block;font-size:12px;margin-top:10px;"><input type="checkbox" id="ds-dims" checked> Teilemaße in der Vorschau</label>
                    </div>
                    <div style="flex:1 1 560px;min-width:320px;display:flex;flex-direction:column;gap:10px;">
                        <div id="ds-prev" style="height:520px;background:#12161c;border:1px solid #333;border-radius:4px;padding:6px;box-sizing:border-box;"></div>
                    </div>
                    <div id="ds-res" style="flex:0 0 250px;min-width:220px;max-height:520px;overflow:auto;"></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                    <button id="ds-cancel" style="padding:6px 16px;background:#555;border:none;border-radius:4px;color:#ddd;cursor:pointer;">Abbrechen</button>
                    <button id="ds-save" style="padding:6px 16px;background:#3a3a3a;border:1px solid #666;border-radius:4px;color:#ddd;cursor:pointer;">DXF speichern</button>
                    <button id="ds-ok" style="padding:6px 16px;background:#00aaff;border:none;border-radius:4px;color:#000;cursor:pointer;font-weight:600;">Erzeugen</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const $ = id => overlay.querySelector('#' + id);
        let last = null;

        function update() {
            const cx = parseNum($('ds-cx').value), cy = parseNum($('ds-cy').value);
            const ablauf = { w: parseNum($('ds-aw').value), h: parseNum($('ds-ah').value) };
            if (isFinite(cx)) ablauf.cx = cx;
            if (isFinite(cy)) ablauf.cy = cy;
            last = ShowerBoardGenerator.compute({
                breite: parseNum($('ds-b').value), tiefe: parseNum($('ds-t').value), masseArt: $('ds-art').value,
                fliese: { x: parseNum($('ds-fx').value), y: parseNum($('ds-fy').value) },
                fuge: parseNum($('ds-fuge').value), randfuge: parseNum($('ds-rf').value),
                gridMode: $('ds-mode').value, minTeil: parseNum($('ds-min').value) || 0, ablauf
            });
            $('ds-res').innerHTML = resultHTML(last);
            $('ds-prev').innerHTML = last.ok ? previewSVG(last, $('ds-dims').checked) : '';
            $('ds-ok').disabled = $('ds-save').disabled = !last.ok;
            $('ds-ok').style.opacity = $('ds-save').style.opacity = last.ok ? '1' : '0.4';
        }

        const onDocKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onDocKey, true);
        const close = () => {
            document.removeEventListener('keydown', onDocKey, true);
            overlay.remove();
            setTimeout(() => { const cv = app?.renderer?.canvas; if (cv) cv.style.cursor = ''; }, 0);
        };

        overlay.addEventListener('input', update);
        overlay.addEventListener('change', update);
        $('ds-cancel').addEventListener('click', close);
        overlay.addEventListener('mousedown', e => { overlay._downOnBg = e.target === overlay; });
        overlay.addEventListener('click', e => { if (e.target === overlay && overlay._downOnBg) close(); });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && last?.ok) $('ds-ok').click();
            e.stopPropagation();
        });
        overlay.addEventListener('keyup', e => e.stopPropagation());

        $('ds-ok').addEventListener('click', () => {
            if (!last?.ok) return;
            if (!app?.loadGeneratedDXF) { console.warn(LOG, 'app.loadGeneratedDXF nicht verfuegbar'); return; }
            app.loadGeneratedDXF(last.fileName, last.dxf, (last.dxf.length / 1024).toFixed(1));
            app.showToast?.(`Duschboard: ${last.count} Teile erzeugt`, 'success');
            console.log(LOG, 'erzeugt', last.fileName, last.count, 'Teile');
            close();
        });
        $('ds-save').addEventListener('click', () => {
            if (!last?.ok) return;
            app.promptSaveToServer({ defaultName: last.fileName, content: last.dxf, title: 'DXF speichern', bind: false });
        });

        update();
        setTimeout(() => { const f = $('ds-b'); f.focus(); f.select(); }, 50);
    }

    return { openDialog, _internals: { previewSVG, resultHTML, numbered } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShowerBoardDialog;
if (typeof window !== 'undefined') window.ShowerBoardDialog = ShowerBoardDialog;

// ── Befehl DUSCH — Lazy-Patch in DrawingToolManager (wie MOS) ───────────────
if (typeof BaseTool !== 'undefined' && typeof DrawingToolManager !== 'undefined') {
    class ShowerBoardTool extends BaseTool {
        start() {
            ShowerBoardDialog.openDialog({ app: this.manager.app });
            this.cancel();
        }
    }
    const _origStartToolDs = DrawingToolManager.prototype.startTool;
    DrawingToolManager.prototype.startTool = function (shortcut) {
        if (!this._duschRegistered) {
            this._duschRegistered = true;
            this.tools['DUSCH'] = () => new ShowerBoardTool(this);
        }
        return _origStartToolDs.call(this, shortcut);
    };
}
