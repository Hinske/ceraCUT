/**
 * CeraCUT Duschboard-Generator V0.2 (Kern, ohne Dialog)
 * Erzeugt die Zuschnitt-Teile eines Duschboards (Fliesen mit Gehrung zum Ablauf) aus Maßen, Ablauf und Fugenbild.
 *
 * Regeln (aus Kochhan_Duschboard_1000x1000.dxf, Ablauf 140x140 mittig):
 *   - Fliesenfeld = Bereich 0..W x 0..H (Ursprung links unten); Teile reichen exakt bis zur Feldkante und bis zur Ablaufkante
 *   - Gehrung: Diagonale von der Ablaufecke zur naechsten Boardecke; Teile werden um Fuge/2 senkrecht zur Diagonale
 *     zurueckgesetzt (1000x1000: Kante bei y = 568.6 statt 570 -> 1.4/sqrt2 = 1 mm = Fuge/2)
 *   - Fugenbild = Fugenmitten xLines/yLines (editierbar); Teile sind um Fuge/2 an jeder Fugenlinie zurueckgesetzt
 *   - Layer "Fliesen" = Teile (geschlossene Polylinien), Nesting auf Rohplatten ist NICHT Teil dieses Moduls
 *
 * Phase 2a: nur rechteckiger Punktablauf. Rinne (2d), runder/aussermittiger Sonderfall-Check (2e) folgen.
 * Rein (kein DOM) — laeuft in Node (tests/shower-board.test.js).
 *
 * V0.2: Verlegemuster (Kreuzfuge, Verband 1/2 1/3 1/4 frei, Zufall, Fischgraet, Korbgeflecht), Ausrichtung horizontal/vertikal,
 *       Drehwinkel (z. B. 45 Grad), Anker (Ecken, Mitte, Fuge), Reihen-/Spaltenversatz; Teile = Fliese (Zelle - Fuge/2) ∩ Sektor
 * V0.1: Erstversion (Raster, Sektoren, Clipping, DXF)
 * Created: 2026-11-07 MEZ
 * Last Modified: 2026-11-07
 * Build: 20261107-dusch3
 */

const ShowerBoardGenerator = (() => {
    'use strict';

    const VERSION = '0.2';
    const LOG = '[Duschboard V0.2]';
    const LAYER_FLIESE = 'Fliesen';
    const LAYER_COLOR = 160;
    const EPS = 1e-6;

    const DEFAULTS = {
        fuge: 2,                 // Fugenbreite (Einbau), auch an der Gehrung
        teileAbstand: 2,         // Luecke zwischen Teilen im DXF (Phase 2a: = Fuge, siehe Design 9.2)
        randfuge: 2,             // Fuge zur Wand je Seite (nur bei masseArt 'aussen')
        masseArt: 'fliesenfeld', // 'fliesenfeld' | 'aussen'
        fliese: { lang: 600, kurz: 300 },
        ausrichtung: 'horizontal', // lange Fliesenseite entlang X ('horizontal') oder Y ('vertikal')
        muster: 'kreuz',         // 'kreuz' | 'verband' | 'zufall' | 'fischgraet' | 'korb' | 'keins'
        versatz: 0.5,            // Verband: Versatz als Anteil der Fliesenlaenge (0.5 = Halbverband, 1/3, 1/4, frei)
        versatzFolge: 'treppe',  // 'treppe' (0, v, 2v, ...) | 'wechsel' (0, v, 0, v, ...)
        verbandAchse: 'reihen',  // 'reihen' (Reihen seitlich versetzt) | 'spalten' (Spalten in Hoehe versetzt)
        startVersetzt: false,    // erste Reihe/Spalte bereits versetzt beginnen
        gegenlaeufig: false,     // Versatzrichtung umkehren bzw. Fischgraet spiegeln
        seed: 1,                 // Zufallsverband
        drehung: 0,              // Drehwinkel des Musters in Grad (45 = diagonal)
        anker: 'ablauf',         // 'ablauf' (nur Kreuzfuge) | 'lu' | 'ru' | 'lo' | 'ro' | 'mitte' (Fliese mittig auf Ablauf) | 'fuge' (Fugenkreuz auf Ablauf)
        minTeil: 30,             // Warnung: Teil schmaler als (mm)
        maxTeile: 6000
    };

    // ── Polygon-Helfer (konvex, Sutherland-Hodgman) ─────────────────────────
    function clipHalfPlane(poly, p, n) {
        // behaelt Punkte q mit (q-p).n >= 0
        const out = [];
        const side = q => (q.x - p.x) * n.x + (q.y - p.y) * n.y;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            const sa = side(a), sb = side(b);
            if (sa >= -EPS) out.push(a);
            if ((sa > EPS && sb < -EPS) || (sa < -EPS && sb > EPS)) {
                const t = sa / (sa - sb);
                out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            }
        }
        return out;
    }

    function area(poly) {
        let s = 0;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length];
            s += a.x * b.y - b.x * a.y;
        }
        return s / 2;
    }

    function dedupe(poly) {
        const out = [];
        for (const p of poly) {
            const l = out[out.length - 1];
            if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 1e-4) out.push(p);
        }
        if (out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) <= 1e-4) out.pop();
        // kollineare Zwischenpunkte entfernen
        const res = [];
        for (let i = 0; i < out.length; i++) {
            const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
            const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
            if (Math.abs(cr) > 1e-6) res.push(b);
        }
        return res;
    }

    const rectPoly = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

    // ── Parameter ───────────────────────────────────────────────────────────
    /**
     * Normalisiert Eingaben. Ergebnis: Fliesenfeld W x H, Ablauf (Rechteck) in Feldkoordinaten.
     * ablauf: { w, h, cx, cy } (Mitte; fehlt cx/cy -> mittig)
     */
    function normalize(input) {
        const o = { ...DEFAULTS, ...input, fliese: { ...DEFAULTS.fliese, ...(input.fliese || {}) } };
        // Kompatibilitaet V0.1: fliese {x,y} und gridMode
        if (input.fliese && input.fliese.x !== undefined) {
            o.fliese = { lang: Math.max(input.fliese.x, input.fliese.y), kurz: Math.min(input.fliese.x, input.fliese.y) };
            o.ausrichtung = input.fliese.x >= input.fliese.y ? 'horizontal' : 'vertikal';
        }
        if (input.gridMode === 'keins') o.muster = 'keins';
        else if (input.gridMode === 'ecke') o.anker = 'lu';
        const err = m => ({ ok: false, error: m });
        const pos = v => typeof v === 'number' && isFinite(v) && v > 0;
        if (!pos(o.breite) || !pos(o.tiefe)) return err('Bitte Breite und Tiefe als positive Zahl eingeben.');
        if (!(o.fuge >= 0 && o.fuge <= 20)) return err('Fuge muss zwischen 0 und 20 mm liegen.');
        if (!(o.randfuge >= 0 && o.randfuge <= 20)) return err('Randfuge muss zwischen 0 und 20 mm liegen.');
        if (!pos(o.fliese.lang) || !pos(o.fliese.kurz)) return err('Fliesenformat ungültig.');
        if (o.fliese.kurz > o.fliese.lang) o.fliese = { lang: o.fliese.kurz, kurz: o.fliese.lang };
        if (!['kreuz', 'verband', 'zufall', 'fischgraet', 'korb', 'keins'].includes(o.muster)) return err('Unbekanntes Verlegemuster.');
        if (!(o.versatz > 0 && o.versatz < 1)) { if (o.muster === 'verband') return err('Versatz muss zwischen 0 und 100 % liegen.'); }
        if (!isFinite(o.drehung)) return err('Drehwinkel ungültig.');
        const W = o.masseArt === 'aussen' ? o.breite - 2 * o.randfuge : o.breite;
        const H = o.masseArt === 'aussen' ? o.tiefe - 2 * o.randfuge : o.tiefe;
        if (!(W > 0 && H > 0)) return err('Fliesenfeld ist nach Abzug der Randfugen nicht positiv.');
        const a = input.ablauf || {};
        if (!pos(a.w) || !pos(a.h)) return err('Bitte Ablaufgröße eingeben.');
        const cx = typeof a.cx === 'number' ? a.cx : W / 2;
        const cy = typeof a.cy === 'number' ? a.cy : H / 2;
        const drain = { x0: cx - a.w / 2, x1: cx + a.w / 2, y0: cy - a.h / 2, y1: cy + a.h / 2 };
        if (drain.x0 <= EPS || drain.y0 <= EPS || drain.x1 >= W - EPS || drain.y1 >= H - EPS) {
            return err('Der Ablauf muss vollständig im Fliesenfeld liegen und darf keine Kante berühren (Phase 2a).');
        }
        const t = o.fliese;
        const horiz = o.ausrichtung !== 'vertikal';
        return { ok: true, p: { ...o, W, H, drain, tx: horiz ? t.lang : t.kurz, ty: horiz ? t.kurz : t.lang } };
    }

    // ── Verlegemuster ───────────────────────────────────────────────────────
    const rad = d => d * Math.PI / 180;

    /** deterministische Zufallszahl 0..1 aus (seed, index) */
    function hash01(seed, j) {
        let h = (Math.imul(seed | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    /** Anker (Ursprung O des Musters in Feldkoordinaten); cell = (zellbreite, zellhoehe) fuer 'mitte' */
    function anchorPoint(p, cw, ch) {
        const { W, H, drain: d, fuge } = p, h = fuge / 2;
        const C = { x: (d.x0 + d.x1) / 2, y: (d.y0 + d.y1) / 2 };
        switch (p.anker) {
            case 'ru': return { x: W + h, y: -h };
            case 'lo': return { x: -h, y: H + h };
            case 'ro': return { x: W + h, y: H + h };
            case 'mitte': return { x: C.x - cw / 2, y: C.y - ch / 2 };
            case 'fuge': return C;
            default: return { x: -h, y: -h };   // 'lu' (und 'ablauf' bei Mustern ohne Ablauf-Raster)
        }
    }

    function autoLinesAnchored(O, L, pitch, lo, hi, anchorMode, tile, fuge) {
        const out = [];
        if (anchorMode === 'ablauf') {
            for (let v = hi + tile + fuge / 2; v < L - fuge; v += pitch) out.push(v);
            for (let v = lo - tile - fuge / 2; v > fuge; v -= pitch) out.push(v);
        } else {
            const k0 = Math.ceil((0 - O) / pitch);
            for (let k = k0; O + k * pitch < L; k++) { const v = O + k * pitch; if (v > 0.01 && v < L - 0.01) out.push(v); }
        }
        return out.sort((a, b) => a - b);
    }

    /** Fugenraster der Kreuzfuge (editierbar): Fugenmitten xLines / yLines */
    function buildGrid(p) {
        if (p.muster === 'keins') return { xLines: [], yLines: [] };
        const px = p.tx + p.fuge, py = p.ty + p.fuge;
        const O = anchorPoint(p, px, py);
        return {
            xLines: autoLinesAnchored(O.x, p.W, px, p.drain.x0, p.drain.x1, p.anker, p.tx, p.fuge),
            yLines: autoLinesAnchored(O.y, p.H, py, p.drain.y0, p.drain.y1, p.anker, p.ty, p.fuge)
        };
    }

    const isGridPattern = p => p.muster === 'keins' || (p.muster === 'kreuz' && Math.abs(p.drehung % 360) < 1e-9);

    /** Rechteckige Fliese -> Polygon (CCW) */
    const rectCCW = (x0, y0, x1, y1) => rectPoly(x0, y0, x1, y1);

    /** Fliesen (Zellen um Fuge/2 verkleinert) aus Fugenlinien — Kreuzfuge ohne Drehung */
    function tilesFromGrid(p, grid) {
        const BIG = 4 * (p.W + p.H) + 2000, h = p.fuge / 2;
        const bx = [-BIG, ...grid.xLines.slice().sort((a, b) => a - b), p.W + BIG];
        const by = [-BIG, ...grid.yLines.slice().sort((a, b) => a - b), p.H + BIG];
        const out = [];
        for (let i = 0; i < bx.length - 1; i++) for (let j = 0; j < by.length - 1; j++) {
            const x0 = bx[i] + h, x1 = bx[i + 1] - h, y0 = by[j] + h, y1 = by[j + 1] - h;
            if (x1 - x0 > 1e-6 && y1 - y0 > 1e-6) out.push(rectCCW(x0, y0, x1, y1));
        }
        return out;
    }

    /** Fliesen allgemeiner Muster: Musterraum (u,v) -> [Spiegeln] -> [Tauschen] -> Drehen -> +O */
    function tilesFromPattern(p) {
        const { W, H, fuge } = p, h = fuge / 2;
        const px = p.tx + fuge, py = p.ty + fuge;
        let pu = px, pv = py, swap = false, mirror = false, theta = p.drehung;
        const Lc = Math.max(p.tx, p.ty) + fuge, wc = Math.min(p.tx, p.ty) + fuge;
        let korbN = 1;

        if (p.muster === 'verband' || p.muster === 'zufall') {
            if (p.verbandAchse === 'spalten') { swap = true; pu = py; pv = px; }
        } else if (p.muster === 'fischgraet') {
            pu = Lc; pv = wc; mirror = p.gegenlaeufig;
            if (p.ausrichtung === 'vertikal') theta += 90;
        } else if (p.muster === 'korb') {
            korbN = Math.max(1, Math.round(Lc / wc));
            if (Math.abs(Lc - korbN * wc) > 0.05 * Lc) return { error: `Korbgeflecht braucht ein ganzzahliges Seitenverhältnis (z. B. 2:1) — hier ${(Lc / wc).toFixed(2)}:1.` };
            pu = pv = korbN * wc;
            if (p.ausrichtung === 'vertikal') theta += 90;
        }
        const O = anchorPoint(p, p.muster === 'fischgraet' ? Lc : pu, p.muster === 'fischgraet' ? wc : pv);
        const cs = Math.cos(rad(theta)), sn = Math.sin(rad(theta));
        const fwd = (u, v) => {
            if (mirror) u = -u;
            if (swap) { const t = u; u = v; v = t; }
            return { x: O.x + u * cs - v * sn, y: O.y + u * sn + v * cs };
        };
        // Feldecken in Musterraum -> Schleifengrenzen
        let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
        for (const c of [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]) {
            let a = (c.x - O.x) * cs + (c.y - O.y) * sn, b = -(c.x - O.x) * sn + (c.y - O.y) * cs;
            if (swap) { const t = a; a = b; b = t; }
            if (mirror) a = -a;
            umin = Math.min(umin, a); umax = Math.max(umax, a); vmin = Math.min(vmin, b); vmax = Math.max(vmax, b);
        }
        const rects = [];   // Musterraum-Rechtecke [u0,v0,u1,v1] = Fugenmitten-Zellen
        const jRange = [Math.floor(vmin / pv) - 2, Math.ceil(vmax / pv) + 2];
        const iRange = [Math.floor(umin / pu) - 2, Math.ceil(umax / pu) + 2];
        const sgn = p.gegenlaeufig && !mirror ? -1 : 1;
        const cap = p.maxTeile * 4;
        const est = (iRange[1] - iRange[0] + 1) * (jRange[1] - jRange[0] + 1);
        if (est > cap * 8) return { error: 'Zu viele Fliesen für dieses Format — bitte Maße prüfen.' };

        if (p.muster === 'kreuz' || p.muster === 'verband' || p.muster === 'zufall') {
            const v = p.muster === 'verband' ? p.versatz : 0;
            for (let j = jRange[0]; j <= jRange[1]; j++) {
                const jj = j + (p.startVersetzt ? 1 : 0);
                let frac = 0;
                if (p.muster === 'verband') {
                    frac = p.versatzFolge === 'wechsel' ? ((((jj % 2) + 2) % 2) * v) : (((jj * v) % 1) + 1) % 1;
                } else if (p.muster === 'zufall') {
                    frac = 0.2 + 0.6 * hash01(p.seed, jj);
                }
                const shift = sgn * frac * pu;
                for (let i = iRange[0] - 1; i <= iRange[1] + 1; i++) rects.push([i * pu + shift, j * pv, (i + 1) * pu + shift, (j + 1) * pv]);
            }
        } else if (p.muster === 'fischgraet') {
            const kA = Math.floor((umin + vmin) / (2 * wc)) - 3, kB = Math.ceil((umax + vmax) / (2 * wc)) + 3;
            const mA = Math.floor((umin - vmax) / (2 * Lc)) - 3, mB = Math.ceil((umax - vmin) / (2 * Lc)) + 3;
            for (let k = kA; k <= kB; k++) for (let m = mA; m <= mB; m++) {
                const x = k * wc + m * Lc, y = k * wc - m * Lc;
                rects.push([x, y, x + Lc, y + wc]);                          // liegend
                rects.push([x + Lc, y + wc - Lc, x + Lc + wc, y + wc]);      // stehend
            }
        } else if (p.muster === 'korb') {
            const S = pu;
            for (let j = jRange[0]; j <= jRange[1]; j++) for (let i = iRange[0]; i <= iRange[1]; i++) {
                const even = (((i + j) % 2) + 2) % 2 === 0;
                for (let t = 0; t < korbN; t++) {
                    if (even) rects.push([i * S, j * S + t * wc, (i + 1) * S, j * S + (t + 1) * wc]);
                    else rects.push([i * S + t * wc, j * S, i * S + (t + 1) * wc, (j + 1) * S]);
                }
            }
        }
        // Rechtecke -> Polygone im Feld, ausserhalb des Feldes verwerfen
        const out = [];
        for (const [u0, v0, u1, v1] of rects) {
            const a = u0 + h, b = v0 + h, c = u1 - h, d = v1 - h;
            if (c - a < 1e-6 || d - b < 1e-6) continue;
            let poly = [fwd(a, b), fwd(c, b), fwd(c, d), fwd(a, d)];
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (const q of poly) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
            if (x1 < -EPS || x0 > W + EPS || y1 < -EPS || y0 > H + EPS) continue;
            if (area(poly) < 0) poly = poly.reverse();   // Spiegeln dreht den Umlaufsinn
            out.push(poly);
        }
        return { tiles: out };
    }

    // ── Sektoren (Gehrung) ──────────────────────────────────────────────────
    function halfPlaneThrough(c, b, ref, offset) {
        // Gerade durch c und b, Normale zeigt zur Seite von ref, um offset verschoben
        const dx = b.x - c.x, dy = b.y - c.y, len = Math.hypot(dx, dy);
        let n = { x: -dy / len, y: dx / len };
        if ((ref.x - c.x) * n.x + (ref.y - c.y) * n.y < 0) n = { x: -n.x, y: -n.y };
        return { p: { x: c.x + n.x * offset, y: c.y + n.y * offset }, n };
    }

    function buildSectors(p) {
        const { W, H, drain: d, fuge } = p, h = fuge / 2;
        const cx = (d.x0 + d.x1) / 2, cy = (d.y0 + d.y1) / 2;
        const BR = { x: W, y: 0 }, TR = { x: W, y: H }, TL = { x: 0, y: H }, BL = { x: 0, y: 0 };
        const dBR = { x: d.x1, y: d.y0 }, dTR = { x: d.x1, y: d.y1 }, dTL = { x: d.x0, y: d.y1 }, dBL = { x: d.x0, y: d.y0 };
        const field = rectPoly(0, 0, W, H);
        const hp = (c, b, ref) => halfPlaneThrough(c, b, ref, h);
        const cut = (poly, ...planes) => planes.reduce((acc, pl) => clipHalfPlane(acc, pl.p, pl.n), poly);
        return [
            { name: 'rechts', poly: cut(field, { p: { x: d.x1, y: 0 }, n: { x: 1, y: 0 } }, hp(dTR, TR, { x: W, y: cy }), hp(dBR, BR, { x: W, y: cy })) },
            { name: 'oben',   poly: cut(field, { p: { x: 0, y: d.y1 }, n: { x: 0, y: 1 } }, hp(dTR, TR, { x: cx, y: H }), hp(dTL, TL, { x: cx, y: H })) },
            { name: 'links',  poly: cut(field, { p: { x: d.x0, y: 0 }, n: { x: -1, y: 0 } }, hp(dTL, TL, { x: 0, y: cy }), hp(dBL, BL, { x: 0, y: cy })) },
            { name: 'unten',  poly: cut(field, { p: { x: 0, y: d.y0 }, n: { x: 0, y: -1 } }, hp(dBR, BR, { x: cx, y: 0 }), hp(dBL, BL, { x: cx, y: 0 })) }
        ];
    }

    // ── Teile ───────────────────────────────────────────────────────────────
    /** Fliese (konvex) mit konvexem Sektor schneiden: Fliese gegen alle Sektorkanten (CCW) */
    function clipTileBySector(tile, sector) {
        let poly = tile;
        const S = sector.poly;
        for (let i = 0; i < S.length && poly.length >= 3; i++) {
            const a = S[i], b = S[(i + 1) % S.length];
            poly = clipHalfPlane(poly, a, { x: -(b.y - a.y), y: b.x - a.x });
        }
        return poly;
    }

    function clipPieces(p, tiles) {
        const sectors = buildSectors(p).map(s => {
            const b = bboxOf(s.poly);
            return { ...s, b };
        });
        const pieces = [];
        tiles.forEach((tile, ti) => {
            const tb = bboxOf(tile);
            for (const s of sectors) {
                if (tb.x1 < s.b.x0 - EPS || tb.x0 > s.b.x1 + EPS || tb.y1 < s.b.y0 - EPS || tb.y0 > s.b.y1 + EPS) continue;
                const poly = dedupe(clipTileBySector(tile, s));
                if (poly.length >= 3 && Math.abs(area(poly)) > 1) pieces.push({ sector: s.name, tile: ti, poly });
            }
        });
        return pieces;
    }

    function bboxOf(poly) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const q of poly) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
        return { x0, x1, y0, y1 };
    }

    /** kleinste Breite eines konvexen Polygons (Mindestmass quer) */
    function minWidth(poly) {
        let best = Infinity;
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len < 1e-9) continue;
            const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
            let lo = Infinity, hi = -Infinity;
            for (const q of poly) { const t = (q.x - a.x) * nx + (q.y - a.y) * ny; lo = Math.min(lo, t); hi = Math.max(hi, t); }
            best = Math.min(best, hi - lo);
        }
        return best;
    }

    function validate(p, pieces) {
        const warn = [];
        for (const pc of pieces) {
            const w = minWidth(pc.poly);
            if (w < p.minTeil) warn.push({ piece: pc, text: `Schmales Teil (${w.toFixed(1)} mm) in Sektor ${pc.sector}` });
        }
        return warn;
    }

    // ── DXF (AC1015, geschlossene LWPOLYLINE wie in den Kochhan-Dateien) ─────
    function buildDXF(pieces) {
        const f = v => (+v.toFixed(4)).toString();
        const z = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC',
            '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '1',
            '0', 'LAYER', '2', LAYER_FLIESE, '70', '0', '62', String(LAYER_COLOR), '6', 'CONTINUOUS',
            '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
        for (const pc of pieces) {
            z.push('0', 'LWPOLYLINE', '8', LAYER_FLIESE, '90', String(pc.poly.length), '70', '1');
            for (const q of pc.poly) z.push('10', f(q.x), '20', f(q.y));
        }
        z.push('0', 'ENDSEC', '0', 'EOF');
        return z.join('\r\n') + '\r\n';
    }

    /**
     * Hauptfunktion. grid optional (manuell editiertes Fugenbild: { xLines, yLines }); sonst Automatik.
     */
    function compute(input, grid) {
        const n = normalize(input);
        if (!n.ok) return n;
        const p = n.p;
        if (p.W * p.H / ((p.tx + p.fuge) * (p.ty + p.fuge)) > p.maxTeile) return { ok: false, error: `Mehr als ${p.maxTeile} Fliesen — Fliesenformat prüfen.` };
        let g = null, tiles;
        if (isGridPattern(p)) {
            g = grid || buildGrid(p);
            tiles = tilesFromGrid(p, g);
        } else {
            const r = tilesFromPattern(p);
            if (r.error) return { ok: false, error: r.error };
            tiles = r.tiles;
        }
        const pieces = clipPieces(p, tiles);
        if (pieces.length > p.maxTeile) return { ok: false, error: `Mehr als ${p.maxTeile} Teile — Fliesenformat prüfen.` };
        const fileName = `Duschboard_${Math.round(input.breite)}x${Math.round(input.tiefe)}_Ablauf${Math.round(input.ablauf.w)}x${Math.round(input.ablauf.h)}.dxf`;
        return { ok: true, p, grid: g, pieces, warnings: validate(p, pieces), count: pieces.length, fileName, dxf: buildDXF(pieces) };
    }

    return { VERSION, LOG, DEFAULTS, compute, normalize, buildGrid, buildSectors, clipPieces, buildDXF, validate, _internals: { clipHalfPlane, area, minWidth, bboxOf, tilesFromPattern, hash01 } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShowerBoardGenerator;
if (typeof window !== 'undefined') window.ShowerBoardGenerator = ShowerBoardGenerator;
