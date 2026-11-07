/**
 * CeraCUT Duschboard-Generator V0.1 (Phase 2a: Kern, ohne Dialog)
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
 * V0.1: Erstversion (Raster, Sektoren, Clipping, DXF)
 * Created: 2026-11-07 MEZ
 * Last Modified: 2026-11-07
 * Build: 20261107-dusch1
 */

const ShowerBoardGenerator = (() => {
    'use strict';

    const VERSION = '0.1';
    const LOG = '[Duschboard V0.1]';
    const LAYER_FLIESE = 'Fliesen';
    const LAYER_COLOR = 160;
    const EPS = 1e-6;

    const DEFAULTS = {
        fuge: 2,                 // Fugenbreite (Einbau), auch an der Gehrung
        teileAbstand: 2,         // Luecke zwischen Teilen im DXF (Phase 2a: = Fuge, siehe Design 9.2)
        randfuge: 2,             // Fuge zur Wand je Seite (nur bei masseArt 'aussen')
        masseArt: 'fliesenfeld', // 'fliesenfeld' | 'aussen'
        fliese: { x: 600, y: 300 },
        gridMode: 'ablauf',      // 'ablauf' | 'ecke' | 'keins'
        minTeil: 30              // Warnung: Teil schmaler als (mm)
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
        const err = m => ({ ok: false, error: m });
        const pos = v => typeof v === 'number' && isFinite(v) && v > 0;
        if (!pos(o.breite) || !pos(o.tiefe)) return err('Bitte Breite und Tiefe als positive Zahl eingeben.');
        if (!(o.fuge >= 0 && o.fuge <= 20)) return err('Fuge muss zwischen 0 und 20 mm liegen.');
        if (!(o.randfuge >= 0 && o.randfuge <= 20)) return err('Randfuge muss zwischen 0 und 20 mm liegen.');
        if (!pos(o.fliese.x) || !pos(o.fliese.y)) return err('Fliesenformat ungültig.');
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
        return { ok: true, p: { ...o, W, H, drain } };
    }

    // ── Fugenbild ───────────────────────────────────────────────────────────
    /** Fugenmitten (sortiert) in einer Achse. [lo,hi] = Ablaufkanten, L = Feldlaenge, t = Fliesenmass. */
    function autoLines(mode, L, lo, hi, t, fuge) {
        const pitch = t + fuge, out = [];
        if (mode === 'keins') return out;
        if (mode === 'ecke') {
            for (let v = t + fuge / 2; v < L - fuge; v += pitch) out.push(v);
            return out;
        }
        // 'ablauf': Fliesenkante liegt auf der Ablaufkante, nach aussen Raster
        for (let v = hi + t + fuge / 2; v < L - fuge; v += pitch) out.push(v);
        for (let v = lo - t - fuge / 2; v > fuge; v -= pitch) out.push(v);
        return out.sort((a, b) => a - b);
    }

    function buildGrid(p) {
        return {
            xLines: autoLines(p.gridMode, p.W, p.drain.x0, p.drain.x1, p.fliese.x, p.fuge),
            yLines: autoLines(p.gridMode, p.H, p.drain.y0, p.drain.y1, p.fliese.y, p.fuge)
        };
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
    function intervals(lines, L, fuge) {
        const b = [0, ...lines.slice().sort((a, c) => a - c), L], h = fuge / 2, out = [];
        for (let i = 0; i < b.length - 1; i++) out.push([b[i] + (i > 0 ? h : 0), b[i + 1] - (i < b.length - 2 ? h : 0)]);
        return out;
    }

    function clipPieces(p, grid) {
        const sectors = buildSectors(p);
        const xs = intervals(grid.xLines, p.W, p.fuge), ys = intervals(grid.yLines, p.H, p.fuge);
        const pieces = [];
        for (const s of sectors) {
            xs.forEach(([x0, x1], i) => ys.forEach(([y0, y1], j) => {
                const poly = dedupe(clipHalfPlane(clipHalfPlane(clipHalfPlane(clipHalfPlane(s.poly,
                    { x: x0, y: 0 }, { x: 1, y: 0 }), { x: x1, y: 0 }, { x: -1, y: 0 }),
                    { x: 0, y: y0 }, { x: 0, y: 1 }), { x: 0, y: y1 }, { x: 0, y: -1 }));
                if (poly.length >= 3 && Math.abs(area(poly)) > 1) pieces.push({ sector: s.name, col: i, row: j, poly });
            }));
        }
        return pieces;
    }

    function validate(p, pieces) {
        const warn = [];
        for (const pc of pieces) {
            const xs = pc.poly.map(q => q.x), ys = pc.poly.map(q => q.y);
            const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
            if (Math.min(bw, bh) < p.minTeil) warn.push({ piece: pc, text: `Schmales Teil (${Math.min(bw, bh).toFixed(1)} mm) in Sektor ${pc.sector}` });
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
        const g = grid || buildGrid(p);
        const pieces = clipPieces(p, g);
        const fileName = `Duschboard_${Math.round(input.breite)}x${Math.round(input.tiefe)}_Ablauf${Math.round(input.ablauf.w)}x${Math.round(input.ablauf.h)}.dxf`;
        return { ok: true, p, grid: g, pieces, warnings: validate(p, pieces), count: pieces.length, fileName, dxf: buildDXF(pieces) };
    }

    return { VERSION, LOG, DEFAULTS, compute, normalize, buildGrid, buildSectors, clipPieces, buildDXF, validate, _internals: { clipHalfPlane, area, intervals, autoLines } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShowerBoardGenerator;
if (typeof window !== 'undefined') window.ShowerBoardGenerator = ShowerBoardGenerator;
