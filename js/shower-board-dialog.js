/**
 * CeraCUT Duschboard-Dialog V0.3.3: Eingabe + Live-Vorschau mit Bemaßung, Zoom/Pan, Verlegemuster, Fugenbild bearbeiten
 * Kern: shower-board-generator.js (ShowerBoardGenerator). Befehl DUSCH, Ribbon CAD -> Zuschnitte -> Duschboard.
 *
 * Bemaßung (zur Kontrolle): Gesamtmaß (Fliesenfeld, bei Außenmaß zusätzlich Außenmaß), Ablaufmaße und -lage,
 * Teilebreiten/-höhen je Fugenspalte/-zeile, Gehrungswinkel, Maße je Teil (bbox) + Nummern, Stückliste.
 * Phase 2b: Vorschau nur lesend; Fugenbild von Hand editieren folgt in 2c.
 *
 * V0.3.3: Fugenliste nur auf Wunsch (Checkbox, Standard aus)
 * V0.4: Standardfliese 597x597, Raster 'Automatisch' (Standard), Statuszeile mit Fliesenbedarf (ganz/geschnitten) und gewaehlter Rasterlage
 * V0.3.2: Passpruefung Teil -> Fliese (Drehung, laengste Kante): rote Markierung, Teilemass = kleinste Box, Nummern in der Statuszeile; Fuge-loeschen entfernt
 * V0.3 (Phase 2c): Fugenbild bearbeiten — Fugen ziehen/setzen in der Zeichnung, Fugenlisten (numerisch), Rueckgaengig/Wiederholen
 *       (Strg+Z / Strg+Y), Zuruecksetzen; gilt fuer Kreuzfuge/Verband/Zufall ohne Drehung
 * V0.2: Stueckliste entfernt, Zeichnung fuellt den Dialog, Zoom (Mausrad) + Verschieben (Ziehen) + Einpassen, Verlegemuster-Auswahl
 *       (Kreuzfuge, Verbaende, Zufall, Fischgraet, Korbgeflecht), Ausrichtung, Drehwinkel, Anker
 * V0.1: Erstversion
 * Created: 2026-11-07 MEZ
 * Last Modified: 2026-11-07
 * Build: 20261107-dusch8
 */

const ShowerBoardDialog = (() => {
    'use strict';

    const LOG = '[Duschboard-Dialog V0.3]';
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
    /** Ansicht einpassen: Zeichenfeld VW x VH (px) fuellen, Platz fuer Bemassungsketten lassen */
    function fitView(r, VW, VH) {
        const { W, H } = r.p;
        const M = { l: 62, r: 96, t: 34, b: 92 };
        const s = Math.max(1e-6, Math.min((VW - M.l - M.r) / W, (VH - M.t - M.b) / H));
        return { s, ox: M.l + ((VW - M.l - M.r) - W * s) / 2, oy: M.t + ((VH - M.t - M.b) - H * s) / 2 };
    }

    function previewSVG(r, showDims, view, size, ui) {
        const { W, H, drain: d, fuge } = r.p;
        const VW = size?.w || 900, VH = size?.h || 560;
        const v = view || fitView(r, VW, VH);
        const s = v.s, ox = v.ox, oy = v.oy, M = { l: 62, t: 34 };
        const X = x => ox + x * s, Y = y => oy + (H - y) * s;
        const items = numbered(r.pieces);
        const warnSet = new Set(r.warnings.map(w => w.piece));
        const f = v => v.toFixed(1);
        const COL = '#ffd24a', COLD = '#9fd0ff';
        let g = '';

        // Teile
        for (const it of items) {
            const pts = it.pc.poly.map(q => `${f(X(q.x))},${f(Y(q.y))}`).join(' ');
            const noFit = it.pc.fit && !it.pc.fit.ok, bad = warnSet.has(it.pc);
            g += `<polygon points="${pts}" fill="${noFit ? 'rgba(255,60,60,0.45)' : bad ? 'rgba(240,180,41,0.35)' : 'rgba(74,163,255,0.16)'}" stroke="${noFit ? '#ff4d4d' : bad ? '#f0b429' : '#4aa3ff'}" stroke-width="${noFit ? 2 : 1}"/>`;
        }
        // Ablauf
        g += `<rect x="${f(X(d.x0))}" y="${f(Y(d.y1))}" width="${f((d.x1 - d.x0) * s)}" height="${f((d.y1 - d.y0) * s)}" fill="rgba(255,90,77,0.18)" stroke="#ff5a4d" stroke-width="1.2" stroke-dasharray="4 3"/>`;
        // Fugen-Bearbeitung: Streifen-Auswahl, Fugenmitten, Hover
        if (ui && ui.mode && ui.mode !== 'view' && r.layout) {
            const L = r.layout, rowsL = L.strips === 'rows', bnd = [0, ...L.lines, rowsL ? H : W];
            if (ui.sel != null && !L.coupled && ui.sel >= 0 && ui.sel < bnd.length - 1) {
                g += rowsL
                    ? `<rect x="${f(X(0))}" y="${f(Y(bnd[ui.sel + 1]))}" width="${f(W * s)}" height="${f((bnd[ui.sel + 1] - bnd[ui.sel]) * s)}" fill="rgba(255,210,74,0.10)"/>`
                    : `<rect x="${f(X(bnd[ui.sel]))}" y="${f(Y(H))}" width="${f((bnd[ui.sel + 1] - bnd[ui.sel]) * s)}" height="${f(H * s)}" fill="rgba(255,210,74,0.10)"/>`;
            }
            for (const sg of ShowerBoardGenerator.jointSegments(r.p, L)) {
                const hot = ui.hover && ui.hover.kind === sg.kind && ui.hover.idx === sg.idx && (sg.kind === 'line' || ui.hover.strip === sg.strip);
                g += `<line x1="${f(X(sg.x0))}" y1="${f(Y(sg.y0))}" x2="${f(X(sg.x1))}" y2="${f(Y(sg.y1))}" stroke="${hot ? '#ff9d00' : '#ffd24a'}" stroke-width="${hot ? 2.6 : 1}" ${hot ? '' : 'stroke-dasharray="5 4" opacity="0.75"'}/>`;
                if (hot) {
                    const horiz = sg.y0 === sg.y1, tx = horiz ? X(sg.x1) + 6 : (X(sg.x0) + X(sg.x1)) / 2, ty = horiz ? Y(sg.y0) + 4 : Y(sg.y1) - 8;
                    g += `<text x="${f(tx)}" y="${f(ty)}" ${horiz ? '' : 'text-anchor="middle"'} font-size="12" font-weight="600" fill="#ff9d00">${horiz ? 'Y' : 'X'} = ${de(sg.pos, 1)}</text>`;
                }
            }
        }
        // Teilenummern + Maße
        for (const it of items) {
            const px = X(it.cx), py = Y(it.cy), big = it.w * s > 46 && it.h * s > 26;
            const nf = it.pc.fit && !it.pc.fit.ok;
            if (showDims && big && it.pc.fit) {
                g += `<text x="${f(px)}" y="${f(py - 2)}" text-anchor="middle" font-size="10" fill="${nf ? '#ff8a8a' : '#cfe6ff'}">${it.nr}</text>`;
                g += `<text x="${f(px)}" y="${f(py + 10)}" text-anchor="middle" font-size="9" fill="${nf ? '#ff8a8a' : '#8fb4d8'}">${de(it.pc.fit.a)}×${de(it.pc.fit.b)}</text>`;
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
        const ch = r.chains || {}, xb = [0, ...(ch.xLines || []), W], yb = [0, ...(ch.yLines || []), H], hf = fuge / 2;
        const bottom = Y(0) + 16, bottom2 = Y(0) + 40, bottom3 = Y(0) + 62, left = X(0) - 16;
        if (ch.xLines || xb.length === 2) for (let i = 0; i < xb.length - 1; i++) {
            const a = xb[i] + (i > 0 ? hf : 0), b = xb[i + 1] - (i < xb.length - 2 ? hf : 0);
            g += dimH(a, b, bottom, de(b - a));
        }
        if (ch.yLines || yb.length === 2) for (let j = 0; j < yb.length - 1; j++) {
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
        g += `<text x="${M.l}" y="20" font-size="11" fill="#9aa">Teilemaß = kleinste Box auf der Fliese (gedreht) · Rot: Teil passt nicht auf die Fliese · Orange: Teil schmaler als Warnschwelle</text>`;

        return `<svg width="${VW}" height="${VH}" viewBox="0 0 ${VW} ${VH}" style="display:block" font-family="Segoe UI,sans-serif">` +
            `<rect x="${f(X(0))}" y="${f(Y(H))}" width="${f(W * s)}" height="${f(H * s)}" fill="none" stroke="#556" stroke-width="1" stroke-dasharray="2 3"/>${g}</svg>`;
    }

    function statusHTML(r, edited) {
        if (!r.ok) return `<span style="color:#ff6b6b">⚠ ${esc(r.error)}</span>`;
        const { W, H } = r.p;
        let t = `<b style="color:#fff">${r.count} Teile</b> &nbsp;<span style="color:#9aa">Fliesenfeld ${de(W)} × ${de(H)} mm`;
        if (r.grid) t += ` · ${r.grid.xLines.length + 1} Spalten × ${r.grid.yLines.length + 1} Zeilen`;
        else if (r.layout) t += r.layout.strips === 'rows' ? ` · ${r.layout.lines.length + 1} Reihen` : ` · ${r.layout.lines.length + 1} Spalten`;
        t += `</span>`;
        t += ` &nbsp;<b style="color:#9fd0ff">${r.tilesUsed} Fliesen</b><span style="color:#9aa"> (${r.full} ganz, ${r.cutTiles} geschnitten)</span>`;
        if (r.autoInfo) t += ` &nbsp;<span style="color:#7c8" title="Automatisch gewählte Rasterlage">Raster: ${esc(r.autoInfo)}</span>`;
        if (edited) t += ` &nbsp;<span style="color:#ffd24a">✎ Fugenbild angepasst</span>`;
        const fit = r.warnings.filter(w => w.type === 'fit'), narrow = r.warnings.filter(w => w.type === 'narrow');
        if (fit.length) {
            const nr = new Map(numbered(r.pieces).map(it => [it.pc, it]));
            const lst = fit.slice(0, 3).map(w => `Nr. ${nr.get(w.piece)?.nr} (${de(w.piece.fit.a)}×${de(w.piece.fit.b)})`).join(', ');
            t += ` &nbsp;<span style="color:#ff6b6b;font-weight:600">⛔ ${fit.length} Teil${fit.length > 1 ? 'e' : ''} passen nicht auf die Fliese ${de(r.p.fliese.lang, 0)}×${de(r.p.fliese.kurz, 0)}: ${lst}${fit.length > 3 ? ' …' : ''}</span>`;
        }
        if (narrow.length) t += ` &nbsp;<span style="color:#f0b429">⚠ ${narrow.length} × schmal (&lt; ${de(r.p.minTeil, 0)} mm)</span>`;
        return t;
    }

    // ── Dialog ──────────────────────────────────────────────────────────────
    const MUSTER = [
        ['kreuz', 'Kreuzfuge (gestapelt)'],
        ['verband-50', 'Halbverband (1/2)'], ['verband-33', 'Drittelverband (1/3)'], ['verband-25', 'Viertelverband (1/4)'],
        ['verband-frei', 'Verband mit freiem Versatz'], ['zufall', 'Wilder Verband (Zufallsversatz)'],
        ['fischgraet', 'Fischgrät (90°)'], ['korb', 'Korbgeflecht (Parkett-Block)'], ['keins', 'Kein Raster (nur Gehrung)']
    ];
    const ANKER = [
        ['auto', 'Automatisch (wenig Schnitte, ganze Fliesen)'], ['ablauf', 'Ab Ablaufkante, Mittelband geteilt (nur Kreuzfuge)'], ['lu', 'Ecke links unten'], ['ru', 'Ecke rechts unten'], ['lo', 'Ecke links oben'], ['ro', 'Ecke rechts oben'],
        ['mitte', 'Fliese mittig auf Ablauf'], ['fuge', 'Fugenkreuz auf Ablaufmitte']
    ];

    function openDialog(options = {}) {
        const app = options.app || (typeof window !== 'undefined' ? window.app : null);
        if (typeof document === 'undefined') return;
        document.getElementById('dusch-overlay')?.remove();

        const row2 = (a, b) => `<div style="display:flex;gap:8px;"><div style="flex:1;min-width:0">${a}</div><div style="flex:1;min-width:0">${b}</div></div>`;
        const fld = (id, label, val) => `<label style="${LABEL_CSS}">${label}</label><input id="${id}" style="${FIELD_CSS}" value="${val}" inputmode="decimal">`;
        const sel = (id, label, opts) => `<label style="${LABEL_CSS}">${label}</label><select id="${id}" style="${FIELD_CSS}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select>`;
        const chk = (id, label) => `<label style="display:block;font-size:12px;margin-top:6px;"><input type="checkbox" id="${id}"> ${label}</label>`;
        const sec = t => `<div style="margin-top:12px;padding-top:6px;border-top:1px solid #333;font-size:12px;color:#00aaff;">${t}</div>`;
        const BTN = 'padding:3px 10px;background:#2f2f33;border:1px solid #555;border-radius:4px;color:#ddd;cursor:pointer;font-size:13px;';
        const overlay = document.createElement('div');
        overlay.id = 'dusch-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#1e1e1e;border:1px solid #555;border-radius:8px;width:99vw;height:97vh;display:flex;flex-direction:column;padding:10px 14px;box-sizing:border-box;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:'Segoe UI',sans-serif;">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
                    <h3 style="margin:0;font-size:15px;color:#00aaff;white-space:nowrap;">Duschboard erzeugen</h3>
                    <div id="ds-status" style="flex:1;min-width:0;font-size:12.5px;line-height:1.35;max-height:2.7em;overflow:hidden;"></div>
                    <span id="ds-modes" style="display:flex;gap:4px;align-items:center;">
                        <button id="ds-m-view" data-mode="view" style="${BTN}" title="Ansicht: Ziehen = Verschieben">✋ Ansicht</button>
                        <button id="ds-m-move" data-mode="move" style="${BTN}" title="Fuge anfassen und ziehen">↔ Fuge ziehen</button>
                        <button id="ds-m-addv" data-mode="addv" style="${BTN}" title="Klick setzt eine senkrechte Fuge">＋ senkrecht</button>
                        <button id="ds-m-addh" data-mode="addh" style="${BTN}" title="Klick setzt eine waagerechte Fuge">＋ waagerecht</button>
                        <button id="ds-undo" style="${BTN}" title="Rückgängig (Strg+Z)">↶</button>
                        <button id="ds-redo" style="${BTN}" title="Wiederholen (Strg+Y)">↷</button>
                        <button id="ds-reset" style="${BTN}" title="Fugenbild auf Automatik zurücksetzen">Fugenbild zurücksetzen</button>
                    </span>
                    <button id="ds-zout" style="${BTN}" title="Verkleinern">−</button>
                    <button id="ds-fit" style="${BTN}" title="Einpassen (Doppelklick in die Zeichnung)">Einpassen</button>
                    <button id="ds-zin" style="${BTN}" title="Vergrößern">+</button>
                    <span style="font-size:11px;color:#778;white-space:nowrap;">Mausrad = Zoom</span>
                </div>
                <div style="flex:1;min-height:0;display:flex;gap:14px;">
                    <div style="flex:0 0 272px;overflow:auto;padding-right:6px;">
                        ${sel('ds-art', 'Maßangabe bezieht sich auf', [['fliesenfeld', 'Fliesenfeld (reine Fliesenfläche)'], ['aussen', 'Außenmaß (inkl. Randfuge)']])}
                        ${row2(fld('ds-b', 'Breite X [mm]', '1300'), fld('ds-t', 'Tiefe Y [mm]', '1000'))}
                        ${sec('Fliese und Fuge')}
                        ${row2(fld('ds-fl', 'Lange Seite [mm]', '597'), fld('ds-fk', 'Kurze Seite [mm]', '597'))}
                        ${sel('ds-ausr', 'Lange Seite verläuft', [['horizontal', 'horizontal (entlang X)'], ['vertikal', 'vertikal (entlang Y)']])}
                        ${row2(fld('ds-fuge', 'Fuge [mm]', '2'), fld('ds-rf', 'Randfuge [mm]', '2'))}
                        ${sec('Verlegeraster')}
                        ${sel('ds-muster', 'Verlegemuster', MUSTER)}
                        <div id="ds-g-vfrei">${fld('ds-vp', 'Versatz [% der Fliesenlänge]', '30')}</div>
                        <div id="ds-g-achse">${sel('ds-achse', 'Versatz', [['reihen', 'Reihen seitlich versetzt'], ['spalten', 'Spalten in der Höhe versetzt']])}</div>
                        <div id="ds-g-folge">${sel('ds-folge', 'Versatzfolge', [['treppe', 'Treppe (0, v, 2v, …)'], ['wechsel', 'Wechselnd (0, v, 0, v, …)']])}</div>
                        <div id="ds-g-start">${chk('ds-start', 'Erste Reihe bereits versetzt beginnen')}</div>
                        <div id="ds-g-gegen">${chk('ds-gegen', '<span id="ds-gegen-t">Gegenläufig</span>')}</div>
                        <div id="ds-g-seed">${fld('ds-seed', 'Zufallswert (Seed)', '1')}</div>
                        <label style="${LABEL_CSS}">Drehwinkel des Rasters [°] (45 = diagonal)</label>
                        <input id="ds-rot" list="ds-rot-l" style="${FIELD_CSS}" value="0" inputmode="decimal">
                        <datalist id="ds-rot-l"><option value="0"><option value="15"><option value="22,5"><option value="30"><option value="45"><option value="60"><option value="75"><option value="-45"></datalist>
                        ${sel('ds-anker', 'Raster beginnt', ANKER)}
                        ${sec('Ablauf (rechteckig)')}
                        ${row2(fld('ds-aw', 'Breite [mm]', '140'), fld('ds-ah', 'Tiefe [mm]', '140'))}
                        ${row2(fld('ds-cx', 'Mitte X (leer = mittig)', ''), fld('ds-cy', 'Mitte Y (leer = mittig)', ''))}
                        ${sec('Fugen')}
                        ${chk('ds-showlist', 'Fugenliste anzeigen (Fugenmitten numerisch bearbeiten)')}
                        <div id="ds-lists" style="font-size:12px;display:none;"></div>
                        ${sec('Anzeige')}
                        ${fld('ds-fr', 'Passprüfung: Randabstand zur Fliesenkante [mm]', '0')}
                        ${fld('ds-min', 'Warnung bei Teil schmaler als [mm]', '30')}
                        ${chk('ds-dims', 'Teilemaße in der Vorschau')}
                    </div>
                    <div id="ds-prev" style="flex:1;min-width:0;position:relative;overflow:hidden;background:#12161c;border:1px solid #333;border-radius:4px;cursor:grab;touch-action:none;"></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
                    <button id="ds-cancel" style="padding:6px 16px;background:#555;border:none;border-radius:4px;color:#ddd;cursor:pointer;">Abbrechen</button>
                    <button id="ds-save" style="padding:6px 16px;background:#3a3a3a;border:1px solid #666;border-radius:4px;color:#ddd;cursor:pointer;">DXF speichern</button>
                    <button id="ds-ok" style="padding:6px 16px;background:#00aaff;border:none;border-radius:4px;color:#000;cursor:pointer;font-weight:600;">Erzeugen</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const $ = id => overlay.querySelector('#' + id);
        $('ds-dims').checked = true;
        let last = null, view = null, fitted = true, sizeKey = '';
        // Fugenbild-Bearbeitung
        let override = null, mode = 'view', hover = null, selStrip = 0, hist = [], redoStack = [], editDrag = null;
        const KEEP_OVERRIDE = new Set(['ds-showlist', 'ds-fuge', 'ds-rf', 'ds-min', 'ds-fr', 'ds-dims', 'ds-aw', 'ds-ah', 'ds-cx', 'ds-cy']);

        const vis = (id, on) => { $(id).style.display = on ? '' : 'none'; };
        function syncControls() {
            const m = $('ds-muster').value;
            const verband = m.startsWith('verband');
            vis('ds-g-vfrei', m === 'verband-frei'); vis('ds-g-achse', verband || m === 'zufall'); vis('ds-g-folge', verband);
            vis('ds-g-start', verband); vis('ds-g-gegen', verband || m === 'fischgraet'); vis('ds-g-seed', m === 'zufall');
            $('ds-gegen-t').textContent = m === 'fischgraet' ? 'Spiegeln (Staffelung gegenläufig)' : 'Versatzrichtung umkehren';
            const opt = $('ds-anker').querySelector('option[value="ablauf"]');
            if (opt) { opt.disabled = m !== 'kreuz'; if (m !== 'kreuz' && $('ds-anker').value === 'ablauf') $('ds-anker').value = 'lu'; }
        }

        function readParams() {
            const m = $('ds-muster').value, verband = m.startsWith('verband');
            const cx = parseNum($('ds-cx').value), cy = parseNum($('ds-cy').value);
            const ablauf = { w: parseNum($('ds-aw').value), h: parseNum($('ds-ah').value) };
            if (isFinite(cx)) ablauf.cx = cx;
            if (isFinite(cy)) ablauf.cy = cy;
            const versatz = m === 'verband-50' ? 0.5 : m === 'verband-33' ? 1 / 3 : m === 'verband-25' ? 0.25 : parseNum($('ds-vp').value) / 100;
            return {
                breite: parseNum($('ds-b').value), tiefe: parseNum($('ds-t').value), masseArt: $('ds-art').value,
                fliese: { lang: parseNum($('ds-fl').value), kurz: parseNum($('ds-fk').value) }, ausrichtung: $('ds-ausr').value,
                fuge: parseNum($('ds-fuge').value), randfuge: parseNum($('ds-rf').value),
                muster: verband ? 'verband' : m, versatz, versatzFolge: $('ds-folge').value, verbandAchse: $('ds-achse').value,
                startVersetzt: $('ds-start').checked, gegenlaeufig: $('ds-gegen').checked, seed: Math.round(parseNum($('ds-seed').value)) || 1,
                drehung: parseNum($('ds-rot').value) || 0, anker: $('ds-anker').value,
                minTeil: parseNum($('ds-min').value) || 0, fliesenRand: parseNum($('ds-fr').value) || 0, ablauf
            };
        }

        const prev = $('ds-prev');
        let raf = 0;
        function draw() {
            raf = 0;
            if (!last?.ok) { prev.innerHTML = ''; return; }
            const w = Math.max(200, prev.clientWidth), h = Math.max(200, prev.clientHeight);
            const key = `${w}x${h}`;
            if (fitted || !view || key !== sizeKey) { if (fitted || !view) view = fitView(last, w, h); }
            sizeKey = key;
            prev.innerHTML = previewSVG(last, $('ds-dims').checked, view, { w, h }, { mode, hover, sel: selStrip });
        }
        const redraw = () => { if (!raf) raf = requestAnimationFrame(draw); };

        function update(keepView) {
            syncControls();
            last = ShowerBoardGenerator.compute(readParams(), override);
            if (!last.ok || !last.layout) { if (mode !== 'view') setMode('view'); }
            if (last.ok && last.layout && selStrip >= last.layout.sub.length) selStrip = 0;
            $('ds-status').innerHTML = statusHTML(last, !!override);
            renderLists(); syncModeButtons();
            $('ds-ok').disabled = $('ds-save').disabled = !last.ok;
            $('ds-ok').style.opacity = $('ds-save').style.opacity = last.ok ? '1' : '0.4';
            if (!keepView) fitted = true;
            redraw();
        }

        // ── Fugenbild bearbeiten ────────────────────────────────────────────
        const GEN = ShowerBoardGenerator;
        const snap = v => Math.round(v);
        const canEdit = () => !!(last?.ok && last.layout);
        const pushHist = () => { hist.push(JSON.stringify(override)); if (hist.length > 80) hist.shift(); redoStack = []; };
        const commit = (next, keep = true) => { pushHist(); override = next; update(keep); };
        function undo() { if (!hist.length) return; redoStack.push(JSON.stringify(override)); override = JSON.parse(hist.pop()); update(true); }
        function redo() { if (!redoStack.length) return; hist.push(JSON.stringify(override)); override = JSON.parse(redoStack.pop()); update(true); }

        function syncModeButtons() {
            const ok = canEdit();
            overlay.querySelectorAll('#ds-modes [data-mode]').forEach(b => {
                const on = b.dataset.mode === mode;
                b.style.background = on ? '#0a6fa8' : '#2f2f33'; b.style.borderColor = on ? '#00aaff' : '#555';
                const dis = !ok && b.dataset.mode !== 'view';
                b.disabled = dis; b.style.opacity = dis ? '0.35' : '1';
            });
            $('ds-undo').disabled = !hist.length; $('ds-redo').disabled = !redoStack.length;
            $('ds-undo').style.opacity = hist.length ? '1' : '0.35'; $('ds-redo').style.opacity = redoStack.length ? '1' : '0.35';
            $('ds-reset').disabled = !override; $('ds-reset').style.opacity = override ? '1' : '0.35';
            prev.style.cursor = mode === 'view' ? 'grab' : (mode === 'addv' || mode === 'addh') ? 'crosshair' : 'default';
        }
        function setMode(m) { mode = m; hover = null; syncModeButtons(); redraw(); }

        const local = e => { const r = prev.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
        const toField = pt => ({ x: (pt.x - view.ox) / view.s, y: last.p.H - (pt.y - view.oy) / view.s });
        /** Streifen unter einem Feldpunkt */
        function stripAt(fp) {
            const L = last.layout, v = L.strips === 'rows' ? fp.y : fp.x;
            let k = 0; while (k < L.lines.length && v > L.lines[k]) k++;
            return k;
        }
        function hitTest(pt) {
            if (!canEdit() || !view) return null;
            const { s, ox, oy } = view, H = last.p.H;
            let best = null, bd = 7;
            for (const sg of GEN.jointSegments(last.p, last.layout)) {
                const ax = ox + sg.x0 * s, ay = oy + (H - sg.y0) * s, bx = ox + sg.x1 * s, by = oy + (H - sg.y1) * s;
                const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
                const t = Math.max(0, Math.min(1, ((pt.x - ax) * dx + (pt.y - ay) * dy) / l2));
                const d = Math.hypot(pt.x - ax - t * dx, pt.y - ay - t * dy);
                if (d < bd - (sg.kind === 'sub' ? 0.5 : 0)) { bd = d; best = sg; }
            }
            return best;
        }
        const posOf = (sg, fp) => (sg.kind === 'line' ? last.layout.strips === 'rows' : last.layout.strips !== 'rows') ? fp.y : fp.x;

        /** Klick im Bearbeitungsmodus; true = verbraucht (kein Verschieben der Ansicht) */
        function editPointerDown(e) {
            const pt = local(e), fp = toField(pt), P = last.p, L = override || last.layout, rows = L.strips === 'rows';
            selStrip = stripAt(fp); renderLists();
            if (mode === 'move') {
                const sg = hitTest(pt); if (!sg) return false;
                pushHist();
                editDrag = { sg, base: JSON.parse(JSON.stringify(L)), val: sg.pos };
                return true;
            }
            if (mode === 'addv') {   // senkrechte Fuge
                commit(rows ? GEN.addSub(P, L, stripAt(fp), snap(fp.x)) : GEN.addLine(P, L, snap(fp.x))); return true;
            }
            if (mode === 'addh') {   // waagerechte Fuge
                commit(rows ? GEN.addLine(P, L, snap(fp.y)) : GEN.addSub(P, L, stripAt(fp), snap(fp.y))); return true;
            }
            return false;
        }
        let rafEdit = 0;
        function editDragMove(e) {
            const fp = toField(local(e)), sg = editDrag.sg;
            editDrag.val = snap(posOf(sg, fp));
            if (rafEdit) return;
            rafEdit = requestAnimationFrame(() => {
                rafEdit = 0; if (!editDrag) return;
                applyEditDrag(); hover = sg; update(true);
            });
        }

        // Fugenlisten (numerisch)
        function renderLists() {
            const box = $('ds-lists');
            box.style.display = $('ds-showlist').checked ? '' : 'none';
            if (!$('ds-showlist').checked) return;   // Liste nur auf Wunsch (kann sehr lang werden)
            if (!canEdit()) { box.innerHTML = '<div style="color:#778">Für dieses Muster (Fischgrät, Korbgeflecht, gedrehtes Raster, kein Raster) gibt es keine einzelnen Fugen zum Bearbeiten — Änderungen über die Parameter.</div>'; return; }
            const L = last.layout, rows = L.strips === 'rows', sub = L.sub[Math.min(selStrip, L.sub.length - 1)] || [];
            const list = (title, arr, kind) => {
                let h = `<div style="color:#9aa;margin:6px 0 2px">${title}</div>`;
                if (!arr.length) h += '<div style="color:#667">keine</div>';
                arr.forEach((v, i) => {
                    h += `<div style="display:flex;gap:4px;margin-bottom:2px"><input class="ds-lst" data-k="${kind}" data-i="${i}" value="${de(v, 2)}" style="${FIELD_CSS}padding:2px 6px;font-size:12px;"></div>`;
                });
                return h;
            };
            const strip = L.coupled ? '' : ` — ${rows ? 'Reihe' : 'Spalte'} ${selStrip + 1} (Klick in der Zeichnung wählt)`;
            box.innerHTML = list(rows ? 'Waagerechte Fugen (Y)' : 'Senkrechte Fugen (X)', L.lines, 'line') +
                list((rows ? 'Senkrechte Fugen (X)' : 'Waagerechte Fugen (Y)') + strip, sub, 'sub');
        }
        $('ds-lists').addEventListener('change', e => {
            const t = e.target; if (!t.classList.contains('ds-lst')) return;
            e.stopPropagation();
            const v = parseNum(t.value); if (!isFinite(v)) { renderLists(); return; }
            const i = +t.dataset.i, P = last.p, L = override || last.layout;
            commit(t.dataset.k === 'line' ? GEN.moveLine(P, L, i, v) : GEN.moveSub(P, L, selStrip, i, v));
        });
        overlay.querySelectorAll('#ds-modes [data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
        $('ds-undo').addEventListener('click', undo);
        $('ds-redo').addEventListener('click', redo);
        $('ds-reset').addEventListener('click', () => { if (override) { pushHist(); override = null; update(true); } });

        // Zoom / Verschieben
        function zoomAt(k, mx, my) {
            if (!view) return;
            const ns = Math.min(Math.max(view.s * k, 0.02), 80);
            k = ns / view.s;
            view = { s: ns, ox: mx - (mx - view.ox) * k, oy: my - (my - view.oy) * k };
            fitted = false; redraw();
        }
        prev.addEventListener('wheel', e => {
            e.preventDefault();
            const r = prev.getBoundingClientRect();
            zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
        }, { passive: false });
        let drag = null;
        prev.addEventListener('pointerdown', e => {
            if (e.button > 1) return;
            if (e.button === 0 && mode !== 'view' && canEdit() && view && editPointerDown(e)) { prev.setPointerCapture?.(e.pointerId); return; }
            drag = { x: e.clientX, y: e.clientY, ox: view?.ox, oy: view?.oy };
            prev.setPointerCapture?.(e.pointerId); prev.style.cursor = 'grabbing';
        });
        prev.addEventListener('pointermove', e => {
            if (editDrag) { editDragMove(e); return; }
            if (!drag && mode !== 'view' && canEdit() && view) {
                const h = mode === 'move' ? hitTest(local(e)) : null;
                if (h !== hover && !(h && hover && h.kind === hover.kind && h.idx === hover.idx && h.strip === hover.strip)) { hover = h; redraw(); }
                prev.style.cursor = h ? ((h.y0 === h.y1) ? 'ns-resize' : 'ew-resize') : (mode === 'addv' || mode === 'addh') ? 'crosshair' : 'default';
            }
            if (!drag || !view) return;
            view = { ...view, ox: drag.ox + e.clientX - drag.x, oy: drag.oy + e.clientY - drag.y };
            fitted = false; redraw();
        });
        const applyEditDrag = () => {
            const sg = editDrag.sg, P = last.p, b = editDrag.base;
            override = sg.kind === 'line' ? GEN.moveLine(P, b, sg.idx, editDrag.val) : GEN.moveSub(P, b, sg.strip, sg.idx, editDrag.val);
        };
        const endDrag = () => {
            drag = null;
            if (editDrag) {
                if (rafEdit) { cancelAnimationFrame(rafEdit); rafEdit = 0; }
                if (editDrag.val !== editDrag.sg.pos) applyEditDrag(); else hist.pop();   // nichts bewegt -> kein Undo-Eintrag
                editDrag = null; hover = null; update(true);
            }
            if (mode === 'view') prev.style.cursor = 'grab';
        };
        prev.addEventListener('pointerup', endDrag); prev.addEventListener('pointercancel', endDrag);
        prev.addEventListener('dblclick', () => { if (mode === 'view') { fitted = true; redraw(); } });
        const centerZoom = k => zoomAt(k, prev.clientWidth / 2, prev.clientHeight / 2);
        $('ds-zin').addEventListener('click', () => centerZoom(1.25));
        $('ds-zout').addEventListener('click', () => centerZoom(0.8));
        $('ds-fit').addEventListener('click', () => { fitted = true; redraw(); });
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => redraw()) : null;
        ro?.observe(prev);

        const onDocKey = e => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onDocKey, true);
        const close = () => {
            document.removeEventListener('keydown', onDocKey, true);
            ro?.disconnect();
            overlay.remove();
            setTimeout(() => { const cv = app?.renderer?.canvas; if (cv) cv.style.cursor = ''; }, 0);
        };

        const onParam = e => {
            if (e.target.classList?.contains('ds-lst')) return;   // Fugenlisten haben eigenen Handler
            if (override && !KEEP_OVERRIDE.has(e.target.id)) { override = null; hist = []; redoStack = []; }   // Parameter geaendert -> Automatik
            update(!['ds-b', 'ds-t', 'ds-art'].includes(e.target.id));
        };
        overlay.addEventListener('input', onParam);
        overlay.addEventListener('change', onParam);
        $('ds-cancel').addEventListener('click', close);
        overlay.addEventListener('mousedown', e => { overlay._downOnBg = e.target === overlay; });
        overlay.addEventListener('click', e => { if (e.target === overlay && overlay._downOnBg) close(); });
        overlay.addEventListener('keydown', e => {
            if (e.key === 'Escape') close();
            if ((e.ctrlKey || e.metaKey) && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
                const k = e.key.toLowerCase();
                if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
            }
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

    return { openDialog, _internals: { previewSVG, statusHTML, fitView, numbered } };
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
