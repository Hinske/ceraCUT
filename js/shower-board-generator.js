/**
 * CeraCUT Duschboard-Generator V0.8 (Kern, ohne Dialog)
 * Erzeugt die Zuschnitt-Teile eines Duschboards (Fliesen mit Gehrung zum Ablauf) aus Maßen, Ablauf und Fugenbild.
 *
 * Regeln (aus Kochhan_Duschboard_1000x1000.dxf, Ablauf 140x140 mittig):
 *   - Fliesenfeld = Bereich 0..W x 0..H (Ursprung links unten); Teile reichen exakt bis zur Feldkante und bis zur Ablaufkante
 *   - Gehrung: Diagonale von der Ablaufecke zur naechsten Boardecke; Teile werden um Fuge/2 senkrecht zur Diagonale
 *     zurueckgesetzt (1000x1000: Kante bei y = 568.6 statt 570 -> 1.4/sqrt2 = 1 mm = Fuge/2)
 *   - Fugenbild = Fugenmitten xLines/yLines (editierbar); Teile sind um Fuge/2 an jeder Fugenlinie zurueckgesetzt
 *   - Layer "Fliesen" = ganze Fliese als Umriss (Referenz, nie Schneidkontur), Layer "Schnitt" = Zuschnitt-Konturen;
 *     ganze Fliesen haben nur den Umriss. Nesting auf Rohplatten ist NICHT Teil dieses Moduls
 *
 * Phase 2a: nur rechteckiger Punktablauf. Rinne (2d), runder/aussermittiger Sonderfall-Check (2e) folgen.
 * Rein (kein DOM) — laeuft in Node (tests/shower-board.test.js).
 *
 * V0.8: Schnittketten werden an scharfen Ecken (Richtungswechsel > 75 Grad: Diagonale <-> Boardkante, waagerecht <-> senkrecht) getrennt;
 *       jeder Schnitt wird einzeln in seiner Mitte gebrochen (Diagonale = ein Schnitt, waagerechter/senkrechter Schnitt = je ein Schnitt)
 * V0.7: DXF-Schnitte: nur echte Schnittkanten (keine Doppelung der Fliesenkante), als offene Einzellinien, Ablaufkante mit den angrenzenden
 *       Diagonalschnitten zu EINEM Schnitt verkettet, Overlap Break (GeometryOps.splitAndOverlap) in der Mitte jedes Schnitts (Ueberlappung/Aussenverlaengerung 5 mm)
 * V0.6: PDF-Varianten nach RASTERLAGE (Ecken, Boardmitte, Ablauf, Automatik; liegend/hochkant) bei gleichem Verlegemuster; Verlegemuster-Varianten optional;
 *       neue Anker 'bmitte' (Fliese mittig im Board) und 'bfuge' (Fugenkreuz in Boardmitte)
 * V0.5.1: DXF-Layer korrekt: 'Fliesen' = ganze Fliese als Umriss (Referenz, ceracut-pipeline.isTileOutline), 'Schnitt' = Zuschnitt-Konturen;
 *         ganze Fliesen ohne Schnitt-Kontur (wie Kochhan_Duschboard_1000x1000.dxf); result.tiles = Fliesenumrisse
 * V0.4: Standardfliese 597x597; Rasterlage 'auto' (Standard): vergleicht Rasterlagen (buendig, mittig, an Ablaufkante, versetzt) und waehlt die mit den meisten ganzen Fliesen,
 *       wenigsten Schnitten und ohne schmale Reste; Statistik ganze/geschnittene Teile
 * V0.3.2: Passpruefung Teil -> Fliese mit Drehung (laengste Kante/Diagonalen), Bedarf = kleinste umschliessende Box, Randabstand zur Fliesenkante; Fugen-Loeschen entfernt
 * V0.3.1: Raster 'ab Ablaufkante': Mittelband ueber dem Ablauf wird in Zellen <= Fliese geteilt (vorher Teile > Fliesenlaenge); Warnung 'Teil groesser als Fliese'
 * V0.3: Fugen-Layout (Reihen/Spalten + Fugenlisten je Reihe) fuer Kreuzfuge/Verband/Zufall ohne Drehung; Bearbeitungsfunktionen
 *       (moveLine/moveSub/addLine/addSub), jointSegments fuer Anzeige/Hit-Test
 * V0.2: Verlegemuster (Kreuzfuge, Verband 1/2 1/3 1/4 frei, Zufall, Fischgraet, Korbgeflecht), Ausrichtung horizontal/vertikal,
 *       Drehwinkel (z. B. 45 Grad), Anker (Ecken, Mitte, Fuge), Reihen-/Spaltenversatz; Teile = Fliese (Zelle - Fuge/2) ∩ Sektor
 * V0.1: Erstversion (Raster, Sektoren, Clipping, DXF)
 * Created: 2026-11-07 MEZ
 * Last Modified: 2026-11-07
 * Build: 20261107-dusch13
 */

const ShowerBoardGenerator = (() => {
    'use strict';

    const VERSION = '0.8';
    const LOG = '[Duschboard V0.8]';
    const LAYER_FLIESE = 'Fliesen';    // Fliesenumriss = Referenz (ganze Fliese), nie Schneidkontur
    const LAYER_SCHNITT = 'Schnitt';   // Zuschnitt-Konturen = werden geschnitten
    const LAYER_COLORS = { [LAYER_FLIESE]: 160, [LAYER_SCHNITT]: 10 };   // wie Zuschnitt-Generator / Kochhan-Dateien
    const EPS = 1e-6;

    const DEFAULTS = {
        fuge: 2,                 // Fugenbreite (Einbau), auch an der Gehrung
        teileAbstand: 2,         // Luecke zwischen Teilen im DXF (Phase 2a: = Fuge, siehe Design 9.2)
        randfuge: 2,             // Fuge zur Wand je Seite (nur bei masseArt 'aussen')
        masseArt: 'fliesenfeld', // 'fliesenfeld' | 'aussen'
        fliese: { lang: 597, kurz: 597 },
        ausrichtung: 'horizontal', // lange Fliesenseite entlang X ('horizontal') oder Y ('vertikal')
        muster: 'kreuz',         // 'kreuz' | 'verband' | 'zufall' | 'fischgraet' | 'korb' | 'keins'
        versatz: 0.5,            // Verband: Versatz als Anteil der Fliesenlaenge (0.5 = Halbverband, 1/3, 1/4, frei)
        versatzFolge: 'treppe',  // 'treppe' (0, v, 2v, ...) | 'wechsel' (0, v, 0, v, ...)
        verbandAchse: 'reihen',  // 'reihen' (Reihen seitlich versetzt) | 'spalten' (Spalten in Hoehe versetzt)
        startVersetzt: false,    // erste Reihe/Spalte bereits versetzt beginnen
        gegenlaeufig: false,     // Versatzrichtung umkehren bzw. Fischgraet spiegeln
        seed: 1,                 // Zufallsverband
        drehung: 0,              // Drehwinkel des Musters in Grad (45 = diagonal)
        anker: 'auto',           // 'auto' (Rasterlage mit moeglichst vielen ganzen Fliesen) | 'ablauf' (nur Kreuzfuge) | 'lu' | 'ru' | 'lo' | 'ro' | 'mitte' (Fliese mittig auf Ablauf) | 'fuge' (Fugenkreuz auf Ablauf) | 'bmitte' (Fliese mittig im Board) | 'bfuge' (Fugenkreuz in Boardmitte)
        minTeil: 30,             // Warnung: Teil schmaler als (mm)
        fliesenRand: 0,          // Randabstand zur Fliesenkante fuer die Passpruefung (mm je Seite)
        maxTeile: 6000,
        overlapBreak: true,      // Overlap Break (Werkzeug OB) auf jeden Schnitt, gebrochen in der Mitte der Schneidkontur
        obOverlap: 5,            // Ueberlappung am Bruch (mm)
        obOuter: 5,              // Verlaengerung der aussenliegenden Enden (mm, 0 = aus)
        eckenTrennen: 75         // Schnittketten an Ecken mit Richtungswechsel > Winkel (Grad) trennen (180 = nie trennen)
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
        if (!(o.eckenTrennen > 0 && o.eckenTrennen <= 180)) return err('Eckenwinkel zum Trennen muss zwischen 1 und 180 Grad liegen.');
        if (!(o.obOverlap >= 0 && o.obOverlap <= 100) || !(o.obOuter >= 0 && o.obOuter <= 100)) return err('Overlap-Break-Maße müssen zwischen 0 und 100 mm liegen.');
        if (!(o.fliesenRand >= 0 && o.fliesenRand < Math.min(o.fliese.kurz, o.fliese.lang) / 2)) return err('Randabstand zur Fliesenkante ungültig.');
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
            case 'bmitte': return { x: W / 2 - cw / 2, y: H / 2 - ch / 2 };   // Fliese mittig im Board
            case 'bfuge': return { x: W / 2, y: H / 2 };                      // Fugenkreuz in Boardmitte
            case 'phase': return { x: p.phaseX, y: p.phaseY };   // von der Automatik gewaehlte Rasterlage
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
            // Mittelband ueber/neben dem Ablauf (Ablauf + je eine Fliese daneben, ggf. bis zur Feldkante) muss
            // in gleich grosse Zellen <= Fliesenzelle geteilt werden, sonst entstehen Teile laenger als die Fliese
            const A = lo - tile - fuge / 2 > fuge ? lo - tile - fuge / 2 : 0;
            const B = hi + tile + fuge / 2 < L - fuge ? hi + tile + fuge / 2 : L;
            const n = Math.ceil((B - A) / pitch - 1e-9);
            for (let i = 1; i < n; i++) out.push(A + i * (B - A) / n);
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

    /** Seitlicher Versatz (mm, vorzeichenbehaftet) der Reihe j; pu = Fliesenzelle in Reihenrichtung */
    function rowShift(p, j, pu) {
        if (p.muster !== 'verband' && p.muster !== 'zufall') return 0;
        const jj = j + (p.startVersetzt ? 1 : 0);
        const frac = p.muster === 'verband'
            ? (p.versatzFolge === 'wechsel' ? ((((jj % 2) + 2) % 2) * p.versatz) : ((((jj * p.versatz) % 1) + 1) % 1))
            : 0.2 + 0.6 * hash01(p.seed, jj);
        return (p.gegenlaeufig ? -1 : 1) * frac * pu;
    }

    /** Muster, die als Fugen-Layout (Reihen + Fugenlisten) darstellbar und damit editierbar sind */
    const isGridPattern = p => Math.abs(p.drehung % 360) < 1e-9 && ['keins', 'kreuz', 'verband', 'zufall'].includes(p.muster);

    /** Rechteckige Fliese -> Polygon (CCW) */
    const rectCCW = (x0, y0, x1, y1) => rectPoly(x0, y0, x1, y1);

    // ── Fugen-Layout ────────────────────────────────────────────────────────
    // layout = { strips: 'rows'|'cols', lines: [Fugenmitten quer zu den Streifen], sub: [[Fugenmitten entlang]...] (lines.length+1 Listen), coupled }
    //   rows: Streifen = waagerechte Reihen (lines = Y-Fugen, sub[k] = X-Fugen der Reihe k)
    //   cols: Streifen = senkrechte Spalten (lines = X-Fugen, sub[k] = Y-Fugen der Spalte k)
    //   coupled: alle Streifen haben dieselben Fugen (Kreuzfuge) -> Aenderungen gelten fuer alle
    const MIN_GAP = 1;   // mm Mindestabstand benachbarter Fugenmitten / zur Feldkante bei Bearbeitung

    function buildLayout(p) {
        if (p.muster === 'keins') return { strips: 'rows', lines: [], sub: [[]], coupled: true };
        const { W, H, drain: d, fuge } = p;
        const px = p.tx + fuge, py = p.ty + fuge;
        const O = anchorPoint(p, px, py);
        const cols = (p.muster === 'verband' || p.muster === 'zufall') && p.verbandAchse === 'spalten';
        const [Op, Os, Lp, Ls, pv, pu, tP, tS, lo, hi, loS, hiS] = cols
            ? [O.x, O.y, W, H, px, py, p.tx, p.ty, d.x0, d.x1, d.y0, d.y1]
            : [O.y, O.x, H, W, py, px, p.ty, p.tx, d.y0, d.y1, d.x0, d.x1];
        const mode = p.muster === 'kreuz' ? p.anker : 'lu';
        const lines = autoLinesAnchored(Op, Lp, pv, lo, hi, mode, tP, fuge);
        const bnd = [0, ...lines, Lp], sub = [];
        for (let k = 0; k < bnd.length - 1; k++) {
            const mid = (bnd[k] + bnd[k + 1]) / 2;
            const j = Math.floor((mid - Op) / pv);
            sub.push(p.muster === 'kreuz'
                ? autoLinesAnchored(Os, Ls, pu, loS, hiS, p.anker, tS, fuge)
                : autoLinesAnchored(Os + rowShift(p, j, pu), Ls, pu, loS, hiS, 'lu', tS, fuge));
        }
        return { strips: cols ? 'cols' : 'rows', lines, sub, coupled: p.muster === 'kreuz' };
    }

    function layoutFromGrid(grid) {
        const lines = (grid.yLines || []).slice().sort((a, b) => a - b), xs = (grid.xLines || []).slice().sort((a, b) => a - b);
        return { strips: 'rows', lines, sub: Array.from({ length: lines.length + 1 }, () => xs.slice()), coupled: true };
    }

    const cloneLayout = L => ({ strips: L.strips, coupled: L.coupled, lines: L.lines.slice(), sub: L.sub.map(a => a.slice()) });

    /** Fugenlinien fuer Bemassungsketten: {xLines,yLines}; null wenn nicht fuer alle Streifen gleich */
    function chainsOf(L) {
        if (L.strips === 'rows') return { yLines: L.lines, xLines: L.coupled ? L.sub[0] : null };
        return { xLines: L.lines, yLines: L.coupled ? L.sub[0] : null };
    }

    const clampBetween = (arr, i, v, L) => {
        const lo = (i > 0 ? arr[i - 1] : 0) + MIN_GAP, hi = (i < arr.length - 1 ? arr[i + 1] : L) - MIN_GAP;
        return Math.min(Math.max(v, lo), Math.max(lo, hi));
    };
    const fieldLens = (p, L) => L.strips === 'rows' ? { P: p.H, S: p.W } : { P: p.W, S: p.H };

    function moveLine(p, L, idx, v) { const n = cloneLayout(L), { P } = fieldLens(p, n); n.lines[idx] = clampBetween(n.lines, idx, v, P); return n; }
    function moveSub(p, L, strip, idx, v) {
        const n = cloneLayout(L), { S } = fieldLens(p, n);
        const targets = n.coupled ? n.sub.map((_, i) => i) : [strip];
        const val = clampBetween(n.sub[strip], idx, v, S);
        for (const k of targets) if (n.sub[k].length > idx) n.sub[k][idx] = val;
        return n;
    }
    function addLine(p, L, v) {
        const n = cloneLayout(L), { P } = fieldLens(p, n);
        if (!(v > MIN_GAP && v < P - MIN_GAP) || n.lines.some(x => Math.abs(x - v) < MIN_GAP)) return n;
        let k = n.lines.findIndex(x => x > v); if (k < 0) k = n.lines.length;   // Streifen k wird geteilt
        n.lines.splice(k, 0, v); n.sub.splice(k, 0, n.sub[k].slice());
        return n;
    }
    function addSub(p, L, strip, v) {
        const n = cloneLayout(L), { S } = fieldLens(p, n);
        if (!(v > MIN_GAP && v < S - MIN_GAP)) return n;
        for (const k of n.coupled ? n.sub.keys() : [strip]) {
            if (n.sub[k].some(x => Math.abs(x - v) < MIN_GAP)) continue;
            n.sub[k].push(v); n.sub[k].sort((a, b) => a - b);
        }
        return n;
    }
    /** Fugenmitten als Strecken im Feld (fuer Anzeige und Hit-Test) */
    function jointSegments(p, L) {
        const rows = L.strips === 'rows', { P, S } = fieldLens(p, L);
        const out = [], b = [0, ...L.lines, P];
        L.lines.forEach((v, idx) => out.push(rows
            ? { kind: 'line', idx, pos: v, x0: 0, y0: v, x1: p.W, y1: v }
            : { kind: 'line', idx, pos: v, x0: v, y0: 0, x1: v, y1: p.H }));
        L.sub.forEach((arr, k) => arr.forEach((v, idx) => out.push(rows
            ? { kind: 'sub', strip: k, idx, pos: v, x0: v, y0: b[k], x1: v, y1: b[k + 1] }
            : { kind: 'sub', strip: k, idx, pos: v, x0: b[k], y0: v, x1: b[k + 1], y1: v })));
        return out;
    }

    /**
     * Fliesen (Zellen um Fuge/2 verkleinert) aus dem Fugen-Layout.
     * Rueckgabe-Array = Zuschnittzellen (Randzellen offen bis +-BIG); .phys = Umriss der ganzen Fliese je Zelle
     * (Randzellen: ganze Fliese ab der Rasterkante; zu schmale Zellen (Fuge von Hand verschoben): Fliese ab unterer/linker Kante).
     */
    function tilesFromLayout(p, L) {
        const rows = L.strips === 'rows', { P, S } = fieldLens(p, L);
        const tP = rows ? p.ty : p.tx, tS = rows ? p.tx : p.ty;
        const BIG = 4 * (p.W + p.H) + 2000, h = p.fuge / 2;
        const bp = [-BIG, ...L.lines.slice().sort((a, b) => a - b), P + BIG], out = [], phys = [];
        const full = (lo, hi, t, openLo, openHi) => {
            if (openLo && !openHi) return [hi - t, hi];
            if (openHi) return [lo, lo + t];
            return hi - lo < t - 1e-6 ? [lo, lo + t] : [lo, hi];
        };
        for (let k = 0; k < bp.length - 1; k++) {
            const bs = [-BIG, ...(L.sub[k] || []).slice().sort((a, b) => a - b), S + BIG];
            for (let i = 0; i < bs.length - 1; i++) {
                const a0 = bs[i] + h, a1 = bs[i + 1] - h, c0 = bp[k] + h, c1 = bp[k + 1] - h;
                if (a1 - a0 < 1e-6 || c1 - c0 < 1e-6) continue;
                out.push(rows ? rectCCW(a0, c0, a1, c1) : rectCCW(c0, a0, c1, a1));
                const [fa0, fa1] = full(a0, a1, tS, bs[i] === -BIG, bs[i + 1] === S + BIG), [fc0, fc1] = full(c0, c1, tP, bp[k] === -BIG, bp[k + 1] === P + BIG);
                phys.push(rows ? rectCCW(fa0, fc0, fa1, fc1) : rectCCW(fc0, fa0, fc1, fa1));
            }
        }
        out.phys = phys;
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
        const cap = p.maxTeile * 4;
        const est = (iRange[1] - iRange[0] + 1) * (jRange[1] - jRange[0] + 1);
        if (est > cap * 8) return { error: 'Zu viele Fliesen für dieses Format — bitte Maße prüfen.' };

        if (p.muster === 'kreuz' || p.muster === 'verband' || p.muster === 'zufall') {
            for (let j = jRange[0]; j <= jRange[1]; j++) {
                const shift = rowShift(p, j, pu);
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

    /**
     * Passt das Teil auf die Fliese? Das Teil darf auf der Fliese beliebig gedreht liegen (Wasserstrahl schneidet frei),
     * also: gibt es einen Winkel, bei dem die umschliessende Box <= Fliesenmass ist? Das beruecksichtigt auch die
     * laengste Kante bei Gehrungsschnitten (Diagonale), nicht nur die achsparallelen Masse.
     * Rueckgabe: { ok, a, b } mit (a >= b) = Mass der flaechenkleinsten umschliessenden Box (Bedarf auf der Fliese),
     * angle = Drehung (Grad), bei der das Teil passt (nur wenn ok).
     */
    function fitInfo(poly, L, K, tol = 0.01) {
        const big = Math.max(L, K), small = Math.min(L, K);
        const boxAt = th => {
            const c = Math.cos(th), sn = Math.sin(th);
            let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
            for (const q of poly) { const u = q.x * c + q.y * sn, v = -q.x * sn + q.y * c; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
            return [u1 - u0, v1 - v0];
        };
        const fits = (w, h) => (w <= big + tol && h <= small + tol) || (w <= small + tol && h <= big + tol);
        // flaechenkleinste Box (Kantenrichtungen) = Bedarf; zugleich schneller Test auf Passung
        let best = null, ok = false, angle = 0;
        for (let i = 0; i < poly.length; i++) {
            const a0 = poly[i], b0 = poly[(i + 1) % poly.length];
            const th = Math.atan2(b0.y - a0.y, b0.x - a0.x), [w, h] = boxAt(th);
            if (!best || w * h < best[0] * best[1] - 1e-9) best = [w, h];
            if (!ok && fits(w, h)) { ok = true; angle = th * 180 / Math.PI; }
        }
        if (!ok) {   // Passung kann auch zwischen den Kantenrichtungen liegen -> Raster 0.5 Grad
            for (let d = 0; d < 180 && !ok; d += 0.5) { const [w, h] = boxAt(d * Math.PI / 180); if (fits(w, h)) { ok = true; angle = d; } }
        }
        return { ok, a: Math.max(best[0], best[1]), b: Math.min(best[0], best[1]), angle };
    }

    function validate(p, pieces) {
        const warn = [];
        const r = p.fliesenRand, L = p.fliese.lang - 2 * r, K = p.fliese.kurz - 2 * r;
        for (const pc of pieces) {
            pc.fit = p.muster === 'keins' ? { ok: true, ...fitInfo(pc.poly, 1e9, 1e9) } : fitInfo(pc.poly, L, K);
            if (!pc.fit.ok) warn.push({ type: 'fit', piece: pc, text: `Teil passt nicht auf die Fliese ${p.fliese.lang}×${p.fliese.kurz}${r ? ` (Rand ${r})` : ''}: braucht ${pc.fit.a.toFixed(1)}×${pc.fit.b.toFixed(1)} mm` });
            const w = minWidth(pc.poly);
            if (w < p.minTeil) warn.push({ type: 'narrow', piece: pc, text: `Schmales Teil (${w.toFixed(1)} mm) in Sektor ${pc.sector}` });
        }
        return warn;
    }

    // ── DXF (AC1015, geschlossene LWPOLYLINE wie in den Kochhan-Dateien) ─────
    // ── Schnitte (Layer "Schnitt") ──────────────────────────────────────────
    const GO = () => (typeof GeometryOps !== 'undefined' ? GeometryOps : require('./geometry-ops.js'));

    /** Liegt die Kante a-b auf einer Kante des Fliesenumrisses T (beide Endpunkte auf derselben Umrisskante)? */
    function onOutline(a, b, T, tol = 0.01) {
        for (let j = 0; j < T.length; j++) {
            const c = T[j], d = T[(j + 1) % T.length], dx = d.x - c.x, dy = d.y - c.y, len = Math.hypot(dx, dy);
            if (len < 1e-9) continue;
            const on = q => Math.abs((q.x - c.x) * dy - (q.y - c.y) * dx) / len <= tol && ((q.x - c.x) * dx + (q.y - c.y) * dy) / len >= -tol && ((q.x - c.x) * dx + (q.y - c.y) * dy) / len <= len + tol;
            if (on(a) && on(b)) return true;
        }
        return false;
    }

    /** Richtungswechsel (Grad) im Punkt b des Pfads a -> b -> c (0 = geradeaus, 90 = rechter Winkel) */
    function turnAngle(a, b, c) {
        const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - b.x, vy = c.y - b.y, lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
        if (lu < 1e-12 || lv < 1e-12) return 0;
        return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180 / Math.PI;
    }

    /**
     * Schnittkette an scharfen Ecken trennen: waagerechte/senkrechte Schnitte (Boardkante, Ablaufnotch) und die Diagonale sind je EIN Schnitt;
     * nur sanfte Uebergaenge (z. B. Diagonale -> Ablaufkante, Richtungswechsel <= maxTurn) bleiben verbunden.
     * @returns {{pts:object[], closed:boolean}[]}
     */
    function splitSharp(chain, maxTurn) {
        const pts = chain.pts;
        if (!(maxTurn < 180)) return [chain];
        if (chain.closed) {
            const n = pts.length - 1;   // letzter Punkt = erster
            const sharp = [];
            for (let i = 0; i < n; i++) if (turnAngle(pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n]) > maxTurn) sharp.push(i);
            if (!sharp.length) return [chain];
            const out = [];
            for (let k = 0; k < sharp.length; k++) {
                const s0 = sharp[k], s1 = sharp[(k + 1) % sharp.length], seg = [pts[s0]];
                for (let i = s0; ; ) { i = (i + 1) % n; seg.push(pts[i]); if (i === s1) break; }
                out.push({ pts: seg, closed: false });
            }
            return out;
        }
        const out = [];
        let cur = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
            cur.push(pts[i]);
            if (i < pts.length - 1 && turnAngle(pts[i - 1], pts[i], pts[i + 1]) > maxTurn) { out.push({ pts: cur, closed: false }); cur = [pts[i]]; }
        }
        out.push({ pts: cur, closed: false });
        return out;
    }

    /**
     * Echte Schnittkanten eines Zuschnitts: alle Kanten, die NICHT auf der Originalkante der Fliese liegen (die ist schon da),
     * zu Ketten verbunden (z. B. Gehrung + Ablaufkante + Gehrung = ein Schnitt) und an scharfen Ecken (> maxTurn) getrennt.
     * Geschlossen nur, wenn das Teil ganz im Inneren der Fliese liegt und keine scharfe Ecke hat.
     * @returns {{pts:{x:number,y:number}[], closed:boolean}[]}
     */
    function cutChains(poly, T, maxTurn = 180) {
        const n = poly.length, cut = poly.map((q, i) => !onOutline(q, poly[(i + 1) % n], T));
        if (cut.every(Boolean)) return splitSharp({ pts: [...poly, poly[0]], closed: true }, maxTurn);
        const out = [];
        for (let s = 0; s < n; s++) {
            if (!cut[s] || cut[(s - 1 + n) % n]) continue;   // Kette beginnt nach einer Umrisskante
            const pts = [poly[s]];
            for (let i = s; cut[i % n]; i++) pts.push(poly[(i + 1) % n]);
            out.push(...splitSharp({ pts, closed: false }, maxTurn));
        }
        return out;
    }

    const pathLength = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return l; };

    /** Kollineare Zwischenpunkte entfernen (gerade Schnitte = Einzellinie aus 2 Punkten) */
    function dropCollinear(pts, tol = 1e-6) {
        if (pts.length <= 2) return pts;
        const out = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
            const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
            if (Math.abs(cr) > tol * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y)) || dot < 0) out.push(b);
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    /** Punkt bei halber Pfadlaenge: { segmentIndex, point } */
    function midPoint(pts) {
        const half = pathLength(pts) / 2;
        let acc = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
            if (acc + l >= half - 1e-9) { const t = l > 0 ? (half - acc) / l : 0; return { segmentIndex: i, point: { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t } }; }
            acc += l;
        }
        return { segmentIndex: pts.length - 2, point: { ...pts[pts.length - 1] } };
    }

    /**
     * Overlap Break (Werkzeug OB, GeometryOps.splitAndOverlap) in der Mitte der Schneidkontur: zwei Teile von aussen nach innen,
     * kurze Seite am Bruch um `overlap` verlaengert, aussenliegende Enden um `outer` verlaengert.
     * Sehr kurze Schnitte (< 4 x Ueberlappung) werden nicht gebrochen (nur Enden verlaengert).
     */
    function overlapBreak(chain, p) {
        const pts = chain.pts.map(q => ({ x: q.x, y: q.y })), go = GO();
        if (!p.overlapBreak) return [chain.closed ? pts : dropCollinear(pts)];
        if (pathLength(pts) < 4 * Math.max(p.obOverlap, 1)) {
            let r = pts;
            if (p.obOuter > 0 && !chain.closed) { r = go._extendEndTangential(r, 'start', p.obOuter); r = go._extendEndTangential(r, 'end', p.obOuter); }
            return [chain.closed ? r : dropCollinear(r)];
        }
        const m = midPoint(pts);
        return go.splitAndOverlap(pts, chain.closed, m.segmentIndex, m.point, p.obOverlap, null, p.obOuter).map(pt => (chain.closed ? pt : dropCollinear(pt)));
    }

    /** Alle Schnitte aller Fliesen: [{ tile, chain, parts }] */
    function buildCuts(p, pieces, tiles) {
        const out = [];
        for (const pc of pieces) {
            if (pc.full) continue;
            for (const chain of cutChains(pc.poly, tiles[pc.tile], p.eckenTrennen)) out.push({ tile: pc.tile, chain, parts: overlapBreak(chain, p) });
        }
        return out;
    }

    /**
     * DXF: Layer "Fliesen" = ganze Fliese als Umriss (Referenz, je benutzter Fliese), Layer "Schnitt" = Schnitte als offene Einzellinien
     * (nur echte Schnittkanten, keine Doppelung der Fliesenkante; Overlap Break in der Mitte). Ganze Fliesen: nur der Umriss.
     * @param {{pieces:object[], tiles:object[][], cuts:object[]}} r
     */
    function buildDXF(r) {
        const f = v => (+v.toFixed(4)).toString();
        const z = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '0', 'ENDSEC',
            '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(LAYER_COLORS).length)];
        for (const [name, color] of Object.entries(LAYER_COLORS)) z.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS');
        z.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
        const closed = (layer, pts) => {
            z.push('0', 'LWPOLYLINE', '8', layer, '90', String(pts.length), '70', '1');
            for (const q of pts) z.push('10', f(q.x), '20', f(q.y));
        };
        const open = (layer, pts) => {
            if (pts.length === 2) { z.push('0', 'LINE', '8', layer, '10', f(pts[0].x), '20', f(pts[0].y), '30', '0.0', '11', f(pts[1].x), '21', f(pts[1].y), '31', '0.0'); return; }
            z.push('0', 'LWPOLYLINE', '8', layer, '90', String(pts.length), '70', '0');
            for (const q of pts) z.push('10', f(q.x), '20', f(q.y));
        };
        const used = [...new Set(r.pieces.map(pc => pc.tile))].sort((a, b) => a - b);
        for (const ti of used) {
            closed(LAYER_FLIESE, r.tiles[ti]);
            for (const c of r.cuts) if (c.tile === ti) for (const part of c.parts) open(LAYER_SCHNITT, part);
        }
        z.push('0', 'ENDSEC', '0', 'EOF');
        return z.join('\r\n') + '\r\n';
    }

    // ── Automatische Rasterlage (moeglichst wenige geschnittene Fliesen) ────
    /** Ganze Fliese = Teil deckt die Fliese (bis auf < 1 mm2, z. B. 0,3 mm Eckenanschnitt durch die Fugenversetzung) */
    const isFull = (pc, p) => Math.abs(area(pc.poly)) >= p.tx * p.ty - 1;

    function piecesFor(p, override) {
        if (isGridPattern(p)) return { pieces: clipPieces(p, tilesFromLayout(p, override || buildLayout(p))) };
        const r = tilesFromPattern(p);
        return r.error ? { error: r.error } : { pieces: clipPieces(p, r.tiles) };
    }

    /** Fliesenbedarf: benoetigte Fliesen (Zellen mit mind. einem Teil), davon ganz erhalten */
    function tileStats(p, pieces) {
        const used = new Set(pieces.map(pc => pc.tile)), full = pieces.filter(pc => isFull(pc, p)).length;
        return { tilesUsed: used.size, full, cutTiles: used.size - full };
    }

    /** Bewertung einer Rasterlage: ganze Fliesen zaehlen, jede angeschnittene Fliese, schmale Reste und viele Teile kosten */
    function scorePieces(p, pieces) {
        const st = tileStats(p, pieces);
        let narrow = 0, slim = 0;
        for (const pc of pieces) {
            if (isFull(pc, p)) continue;
            const w = minWidth(pc.poly);
            if (w < p.minTeil) narrow++; else if (w < 2 * p.minTeil) slim++;
        }
        return { ...st, score: st.full * 100 - st.cutTiles * 20 - narrow * 250 - slim * 40 - pieces.length };
    }

    function phaseCandidates(L, lo, hi, t, fuge, W, axis) {
        const px = t + fuge, h = fuge / 2, C = (lo + hi) / 2, lowName = axis === 'x' ? 'links' : 'unten', highName = axis === 'x' ? 'rechts' : 'oben';
        const c = [
            { v: -h, n: `${lowName} bündig` }, { v: L + h, n: `${highName} bündig` },
            { v: L / 2 - px / 2, n: 'Fliese mittig' }, { v: L / 2, n: 'Fuge mittig' },
            { v: lo + h, n: `Kante an Ablauf (${lowName})` }, { v: hi - h, n: `Kante an Ablauf (${highName})` },
            { v: C - px / 2, n: 'Fliese auf Ablaufmitte' }, { v: C, n: 'Fuge auf Ablaufmitte' }
        ];
        const K = 12;
        for (let k = 1; k < K; k++) c.push({ v: -h + k * px / K, n: `versetzt ${(k * px / K).toFixed(0)} mm` });
        return c;
    }

    function searchPhase(p) {
        const { W, H, drain: d } = p, px = p.tx + p.fuge, py = p.ty + p.fuge;
        const cx = phaseCandidates(W, d.x0, d.x1, p.tx, p.fuge, W, 'x'), cy = phaseCandidates(H, d.y0, d.y1, p.ty, p.fuge, H, 'y');
        const cache = new Map();
        const ev = (a, b) => {
            const key = a + '|' + b;
            if (!cache.has(key)) {
                const q = { ...p, anker: 'phase', phaseX: cx[a].v, phaseY: cy[b].v };
                const r = piecesFor(q);
                cache.set(key, r.error ? null : scorePieces(q, r.pieces));
            }
            return cache.get(key);
        };
        let bx = 0, by = 0, best = ev(0, 0);
        const better = (s1, s0) => s1 && (!s0 || s1.score > s0.score);
        for (let pass = 0; pass < 3; pass++) {
            let moved = false;
            for (let a = 0; a < cx.length; a++) { const r = ev(a, by); if (better(r, best)) { best = r; bx = a; moved = true; } }
            for (let b = 0; b < cy.length; b++) { const r = ev(bx, b); if (better(r, best)) { best = r; by = b; moved = true; } }
            if (!moved) break;
        }
        return { x: cx[bx].v, y: cy[by].v, info: `${cx[bx].n} · ${cy[by].n}`, stats: best };
    }

    /** override: Fugen-Layout (editiert) oder altes {xLines,yLines}; wird nur verwendet, wenn das Muster layout-faehig ist */
    function compute(input, override) {
        const n = normalize(input);
        if (!n.ok) return n;
        let p = n.p, autoInfo = null;
        if (p.W * p.H / ((p.tx + p.fuge) * (p.ty + p.fuge)) > p.maxTeile) return { ok: false, error: `Mehr als ${p.maxTeile} Fliesen — Fliesenformat prüfen.` };
        if (p.anker === 'auto') {
            const small = p.W * p.H / ((p.tx + p.fuge) * (p.ty + p.fuge)) > 250 || p.muster === 'keins';
            if (override && isGridPattern(p) || small) p = { ...p, anker: 'lu' };
            else { const b = searchPhase(p); p = { ...p, anker: 'phase', phaseX: b.x, phaseY: b.y }; autoInfo = b.info; }
        }
        let layout = null, tiles;
        if (isGridPattern(p)) {
            layout = override ? (override.strips ? override : layoutFromGrid(override)) : buildLayout(p);
            tiles = tilesFromLayout(p, layout);
        } else {
            const r = tilesFromPattern(p);
            if (r.error) return { ok: false, error: r.error };
            tiles = r.tiles;
        }
        const pieces = clipPieces(p, tiles);
        if (pieces.length > p.maxTeile) return { ok: false, error: `Mehr als ${p.maxTeile} Teile — Fliesenformat prüfen.` };
        // Fliesenumrisse (Layer Fliesen): Rasterfliesen = ganze Fliese; ohne Raster = das ganze Fliesenfeld als eine Platte (wie Kochhan 1000x1000)
        const tileOutlines = p.muster === 'keins' ? [rectPoly(0, 0, p.W, p.H)] : (tiles.phys || tiles);
        for (const pc of pieces) { pc.full = isFull(pc, p); if (p.muster === 'keins') pc.tile = 0; }
        const cuts = buildCuts(p, pieces, tileOutlines);
        const cutCount = cuts.reduce((n, c) => n + c.parts.length, 0), cutLength = cuts.reduce((l, c) => l + c.parts.reduce((s2, pt) => s2 + pathLength(pt), 0), 0);
        const fileName = `Duschboard_${Math.round(input.breite)}x${Math.round(input.tiefe)}_Ablauf${Math.round(input.ablauf.w)}x${Math.round(input.ablauf.h)}.dxf`;
        const chains = layout ? chainsOf(layout) : null;
        const grid = chains && chains.xLines && chains.yLines ? chains : null;
        const st = tileStats(p, pieces);
        return { ok: true, p, layout, chains, grid, editable: !!layout, pieces, warnings: validate(p, pieces), count: pieces.length, full: st.full, cutTiles: st.cutTiles, tilesUsed: st.tilesUsed, autoInfo, tiles: tileOutlines, cuts, cutCount, cutLength, fileName, dxf: buildDXF({ pieces, tiles: tileOutlines, cuts }) };
    }

    // ── Teilenummern (Dialog + PDF) ─────────────────────────────────────────
    function centroid(poly) {
        let a = 0, x = 0, y = 0;
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length], k = p.x * q.y - q.x * p.y;
            a += k; x += (p.x + q.x) * k; y += (p.y + q.y) * k;
        }
        return a ? { x: x / (3 * a), y: y / (3 * a) } : poly[0];
    }

    /** Teile nummerieren: zeilenweise von unten links nach oben rechts (Schwerpunkt) */
    function numberPieces(pieces) {
        const list = pieces.map(pc => {
            const b = bboxOf(pc.poly), c = centroid(pc.poly);
            return { pc, b, w: b.x1 - b.x0, h: b.y1 - b.y0, cx: c.x, cy: c.y };
        });
        list.sort((a, c) => (Math.abs(a.cy - c.cy) > 1 ? a.cy - c.cy : a.cx - c.cx));
        list.forEach((it, i) => { it.nr = i + 1; });
        return list;
    }

    // ── Verlegevarianten (Katalog fuer PDF/Kundenauswahl) ───────────────────
    /**
     * Varianten-Definitionen ohne Berechnung: [{id,label,group,overrides}]
     *   mode 'raster' (Standard): Verlegemuster bleibt wie eingegeben, es variiert die RASTERLAGE (wo das Raster beginnt:
     *        Ecken, Boardmitte, Ablauf, Automatik) und bei Rechteckfliesen die Lage der Fliese (liegend/hochkant)
     *   mode 'muster': andere Verlegemuster (Kreuzfuge, Verbaende, Fischgraet, Korbgeflecht) mit Rasterlage 'auto'
     */
    function variantDefs(input, opts = {}) {
        const n = normalize(input);
        if (!n.ok) return [];
        return opts.mode === 'muster' ? patternDefs(n.p) : rasterDefs(n.p);
    }

    function rasterDefs(p) {
        if (p.muster === 'keins') return [];
        const sq = Math.abs(p.fliese.lang - p.fliese.kurz) < 1;
        const shifted = p.muster === 'verband' || p.muster === 'zufall';
        const anchors = [
            ['auto', 'Automatisch (wenig Schnitte)'],
            ['lu', 'Raster ab Ecke links unten'], ['ru', 'Raster ab Ecke rechts unten'], ['lo', 'Raster ab Ecke links oben'], ['ro', 'Raster ab Ecke rechts oben'],
            ['bmitte', 'Fliese mittig im Board'], ['bfuge', 'Fugenkreuz in Boardmitte'],
            ['mitte', 'Fliese mittig auf dem Ablauf'], ['fuge', 'Fugenkreuz auf dem Ablauf']
        ];
        if (p.muster === 'kreuz' && Math.abs(p.drehung % 360) < 1e-9) anchors.push(['ablauf', 'Ab Ablaufkante, Mittelband geteilt']);
        const orients = sq
            ? [{ sfx: '', lbl: '', group: 'Rasterlagen', ov: {} }]
            : [{ sfx: '', lbl: ' (Fliese liegend)', group: 'Fliese liegend', ov: { ausrichtung: 'horizontal', ...(shifted ? { verbandAchse: 'reihen' } : {}) } },
               { sfx: '-hoch', lbl: ' (Fliese hochkant)', group: 'Fliese hochkant', ov: { ausrichtung: 'vertikal', ...(shifted ? { verbandAchse: 'spalten' } : {}) } }];
        const defs = [];
        for (const o of orients) for (const [a, label] of anchors) defs.push({ id: `r-${a}${o.sfx}`, label: label + o.lbl, group: o.group, overrides: { ...o.ov, anker: a } });
        return defs;
    }

    function patternDefs(p) {
        const sq = Math.abs(p.fliese.lang - p.fliese.kurz) < 1;
        const defs = [];
        const add = (id, label, group, overrides) => defs.push({ id, label, group, overrides: { ...overrides, anker: 'auto', drehung: overrides.drehung || 0 } });
        if (sq) add('kreuz', 'Kreuzfuge', 'Kreuzfuge', { muster: 'kreuz' });
        else {
            add('kreuz', 'Kreuzfuge (Fliese liegend)', 'Kreuzfuge', { muster: 'kreuz', ausrichtung: 'horizontal' });
            add('kreuz-hoch', 'Kreuzfuge (Fliese hochkant)', 'Kreuzfuge', { muster: 'kreuz', ausrichtung: 'vertikal' });
        }
        add('kreuz-45', 'Kreuzfuge diagonal (45°)', 'Diagonal', { muster: 'kreuz', drehung: 45 });
        for (const [key, v, name] of [['50', 0.5, 'Halbverband'], ['33', 1 / 3, 'Drittelverband'], ['25', 0.25, 'Viertelverband']]) {
            const ov = { muster: 'verband', versatz: v };
            if (sq) {
                add(`verband${key}-reihen`, `${name}, Reihen versetzt`, 'Verband', { ...ov, verbandAchse: 'reihen' });
                add(`verband${key}-spalten`, `${name}, Spalten versetzt`, 'Verband', { ...ov, verbandAchse: 'spalten' });
            } else {
                add(`verband${key}`, `${name} (Fliese liegend)`, 'Verband', { ...ov, ausrichtung: 'horizontal', verbandAchse: 'reihen' });
                add(`verband${key}-hoch`, `${name} (Fliese hochkant)`, 'Verband', { ...ov, ausrichtung: 'vertikal', verbandAchse: 'spalten' });
            }
        }
        add('verband-45', 'Halbverband diagonal (45°)', 'Diagonal', { muster: 'verband', versatz: 0.5, drehung: 45 });
        if (sq) add('zufall', 'Wilder Verband', 'Verband', { muster: 'zufall', seed: 1 });
        else {
            add('zufall', 'Wilder Verband (Fliese liegend)', 'Verband', { muster: 'zufall', seed: 1, ausrichtung: 'horizontal' });
            add('zufall-hoch', 'Wilder Verband (Fliese hochkant)', 'Verband', { muster: 'zufall', seed: 1, ausrichtung: 'vertikal', verbandAchse: 'spalten' });
            add('fischgraet', 'Fischgrät', 'Fischgrät', { muster: 'fischgraet' });
            add('fischgraet-45', 'Fischgrät diagonal (45°)', 'Fischgrät', { muster: 'fischgraet', drehung: 45 });
            add('korb', 'Korbgeflecht', 'Korbgeflecht', { muster: 'korb' });
        }
        return defs;
    }

    /** Katalog mit Berechnung (opts.mode wie variantDefs, opts.pieces = Polygone fuer Vorschaubilder): nur Varianten, die funktionieren und sich sichtbar unterscheiden. stats je Variante. */
    function variantCatalog(input, opts = {}) {
        const seen = new Set(), out = [];
        for (const d of variantDefs(input, opts)) {
            const r = compute({ ...input, ...d.overrides });
            if (!r.ok) continue;
            const key = r.pieces.map(pc => pc.poly.map(q => `${Math.round(q.x * 10)},${Math.round(q.y * 10)}`).sort().join('|')).sort().join('#');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ ...d, ...(opts.pieces ? { W: r.p.W, H: r.p.H, drain: r.p.drain, polys: r.pieces.map(pc => pc.poly) } : {}), stats: { tilesUsed: r.tilesUsed, full: r.full, cutTiles: r.cutTiles, count: r.count,
                narrow: r.warnings.filter(w => w.type === 'narrow').length, noFit: r.warnings.filter(w => w.type === 'fit').length } });
        }
        return out;
    }

    return { VERSION, LOG, DEFAULTS, compute, normalize, buildGrid, buildLayout, jointSegments, numberPieces, variantDefs, variantCatalog, moveLine, moveSub, addLine, addSub, fitInfo, buildSectors, clipPieces, buildDXF, validate, _internals: { clipHalfPlane, area, minWidth, fitInfo, cutChains, splitSharp, turnAngle, onOutline, midPoint, overlapBreak, pathLength, dropCollinear, bboxOf, tilesFromPattern, hash01 } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ShowerBoardGenerator;
if (typeof window !== 'undefined') window.ShowerBoardGenerator = ShowerBoardGenerator;
