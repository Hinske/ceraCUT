/**
 * CeraCUT Zuschnitt-Generator (Mosaik / Rechteck / Sockel) V1.3
 * Erzeugt Zuschnitt-Schnittprogramme (Mosaik Wuerfel / Rechteck / Sockel) aus einer Fliese per Masseingabe.
 *
 * Regeln (aus den vorhandenen Programmen W48A900X320.dxf, R100X16A730.dxf):
 *   - Teilung = Stueckmass + Schnittaufmass (Standard 0,8 mm) -> Schnittlinien = Saegemittellinie
 *   - Layer "Fliesen" = Fliesenumriss (Referenz), Layer "Schnitt" = Schnittlinien (offen -> Slit)
 *   - Fliese immer hochkant (lange Seite = Y), Ursprung links unten
 *   - Senkrechte Schnitte oben->unten, waagerechte links->rechts
 *   - Rand (Standard 3 mm): Mindestabstand Stueck <-> Fliesenkante
 *   - Rechteck: beide Lagen werden verglichen (Verschnittoptimierung); Dekor-Lage fest waehlbar;
 *     Mischlage (Reststreifen mit gedrehten Stuecken) als Option
 *   - Ueberlauf der Schnittlinien optional, nur soweit Platz ist (nie ueber Fliesenkante, nie in Nachbarstuecke)
 *   - Aussenkontur = EINE Kontur: nur an der Startecke (links unten) Ueberschnitt, die uebrigen drei Ecken
 *     treffen exakt aufeinander (V1.1, nach Musterdateien W48/W21/W19/W58/R98)
 *
 * Integration: Ribbon CAD -> Gruppe "Zuschnitt" (Buttons mit data-mosaik="W"|"R"), Befehle MOSW / MOSR / MOS.
 * Das erzeugte DXF wird ueber app.loadDXFContent() in einen neuen Tab geladen (wie eine geoeffnete Datei).
 *
 * Benoetigt: drawing-tools.js (BaseTool, DrawingToolManager) — nur fuer die Befehlszeile; Kern laeuft auch ohne (Node-Test)
 *
 * V1.3: Menue umbenannt in "Zuschnitt" (nicht mehr nur Mosaik), neues Icon; Sockel-Dateiname bei quadratischer Fliese ...A600
 * V1.2: Typ Sockel (Streifenzuschnitt ueber volle Fliesenseite, nur parallele Schnitte, Ueberlauf ueber Fliesenkante; Sockellaenge ohne Seitenpassung -> Rechteck-Raster)
 * V1.1: Aussenkontur als eine Kontur — Ueberschnitt nur an der Startecke (links unten), nicht an allen Ecken
 * V1.0: Erstversion
 * Created: 2026-11-05 MEZ
 * Last Modified: 2026-11-05
 * Build: 20261105-zuschnitt
 */

const MosaicGenerator = (() => {
    'use strict';

    const VERSION = '1.3';
    const LOG = '[Zuschnitt V1.3]';

    const DEFAULTS = { kerf: 0.8, rand: 3.0, ueberlaufMax: 5.0 };
    const LAYER_FLIESE = 'Fliesen';
    const LAYER_SCHNITT = 'Schnitt';
    const LAYER_COLORS = { [LAYER_FLIESE]: 160, [LAYER_SCHNITT]: 10 };   // wie in den vorhandenen Dateien
    const EPS = 1e-6;

    // ════════════════════════════════════════════════════════════════
    // HILFSFUNKTIONEN
    // ════════════════════════════════════════════════════════════════

    const num = (v) => (+v.toFixed(3)).toString();                 // 48 -> "48", 48.5 -> "48.5"
    const de = (v, d = 2) => (+v.toFixed(d)).toString().replace('.', ',');
    const parseNum = (s) => parseFloat(String(s).replace(',', '.').trim());

    /** Anzahl Stuecke der Groesse piece (+kerf dazwischen), die in die Laenge len passen. */
    function countFit(len, piece, kerf) {
        if (!(len >= piece - EPS)) return 0;
        return Math.max(0, Math.floor((len + kerf) / (piece + kerf) + EPS));
    }

    /** Block = regelmaessiges Raster aus nx*ny Stuecken; x0/y0 = linke untere Stueckkante. */
    function makeBlock(x0, y0, nx, ny, sx, sy, kerf) {
        return {
            x0, y0, nx, ny, sx, sy,
            x1: x0 + nx * (sx + kerf) - kerf,
            y1: y0 + ny * (sy + kerf) - kerf
        };
    }

    /** Stueckmasse je Lage: 'hoch' = Mass 1 in Y (wie bisherige Programme), 'quer' = Mass 1 in X. */
    function dims(lage, a, b) {
        return lage === 'hoch' ? { sx: b, sy: a } : { sx: a, sy: b };
    }

    // ════════════════════════════════════════════════════════════════
    // LAYOUT — reine Lage (mittig) und Mischlage
    // ════════════════════════════════════════════════════════════════

    function pureLayout(W, H, a, b, lage, kerf, rand) {
        const { sx, sy } = dims(lage, a, b);
        const w = W - 2 * rand, h = H - 2 * rand;
        const nx = countFit(w, sx, kerf), ny = countFit(h, sy, kerf);
        if (nx < 1 || ny < 1) return null;
        const bw = nx * (sx + kerf) - kerf, bh = ny * (sy + kerf) - kerf;
        const blk = makeBlock(rand + (w - bw) / 2, rand + (h - bh) / 2, nx, ny, sx, sy, kerf);
        return { kind: 'rein', lage, blocks: [blk], count: nx * ny, schnitte: nx + ny + 2 };
    }

    /** Beste Fuellung einer Restflaeche mit einem Raster (beide Lagen probieren). */
    function bestFill(reg, a, b, kerf) {
        let best = null;
        for (const lage of ['hoch', 'quer']) {
            const { sx, sy } = dims(lage, a, b);
            const nx = countFit(reg.w, sx, kerf), ny = countFit(reg.h, sy, kerf);
            if (nx < 1 || ny < 1) continue;
            if (!best || nx * ny > best.nx * best.ny) best = makeBlock(reg.x, reg.y, nx, ny, sx, sy, kerf);
        }
        return best;
    }

    /** Mischlage: Hauptblock in Ecke links unten + Reststreifen rechts/oben mit der besseren Lage fuellen. */
    function mixLayouts(W, H, a, b, kerf, rand) {
        const out = [];
        const w = W - 2 * rand, h = H - 2 * rand;
        for (const lage of ['hoch', 'quer']) {
            const { sx, sy } = dims(lage, a, b);
            const n = countFit(w, sx, kerf), m = countFit(h, sy, kerf);
            if (n < 1 || m < 1) continue;
            const main = makeBlock(rand, rand, n, m, sx, sy, kerf);
            const rx = main.x1 + kerf, ty = main.y1 + kerf;
            const rw = rand + w - rx, th = rand + h - ty;
            const variants = {
                rechtsVoll: [{ x: rx, y: rand, w: rw, h: h }, { x: rand, y: ty, w: main.x1 - rand, h: th }],
                obenVoll:   [{ x: rx, y: rand, w: rw, h: main.y1 - rand }, { x: rand, y: ty, w: w, h: th }]
            };
            for (const [vname, regs] of Object.entries(variants)) {
                const blocks = [main];
                for (const reg of regs) {
                    const f = bestFill(reg, a, b, kerf);
                    if (f) blocks.push(f);
                }
                if (blocks.length < 2) continue;
                const count = blocks.reduce((s, k) => s + k.nx * k.ny, 0);
                out.push({ kind: 'misch', lage, variant: vname, blocks, count, schnitte: 0 });
            }
        }
        return out;
    }

    // ════════════════════════════════════════════════════════════════
    // SCHNITTLINIEN aus Bloecken (zusammenfuehren + Ueberlauf)
    // ════════════════════════════════════════════════════════════════

    function buildSegments(blocks, kerf) {
        const raw = [];
        const h = kerf / 2;
        for (const k of blocks) {
            for (let i = 0; i <= k.nx; i++) raw.push({ o: 'V', c: k.x0 - h + i * (k.sx + kerf), a: k.y0 - h, b: k.y1 + h });
            for (let j = 0; j <= k.ny; j++) raw.push({ o: 'H', c: k.y0 - h + j * (k.sy + kerf), a: k.x0 - h, b: k.x1 + h });
        }
        // Kollineare, beruehrende/ueberlappende Linien zu einer Linie vereinen (nie doppelt schneiden)
        // Sortierschluessel auf 1/1000 mm gerundet: Gleitkomma-Abweichungen (1e-13) duerfen die Reihenfolge nicht stoeren
        const key = (s) => Math.round(s.c * 1000);
        raw.sort((p, q) => (p.o === q.o ? (key(p) - key(q)) || (p.a - q.a) : (p.o < q.o ? 1 : -1)));
        const segs = [];
        for (const s of raw) {
            const last = segs[segs.length - 1];
            if (last && last.o === s.o && key(last) === key(s) && s.a <= last.b + 1e-4) {
                last.a = Math.min(last.a, s.a);
                last.b = Math.max(last.b, s.b);
            } else {
                segs.push({ ...s });
            }
        }
        return segs;
    }

    /** Wie weit darf die Linie am Ende (side -1 = Anfang, +1 = Ende) verlaengert werden? */
    function freeExtension(seg, side, blocks, W, H, kerf, maxExt) {
        const pos = side < 0 ? seg.a : seg.b;
        const tileLim = side < 0 ? pos : (seg.o === 'V' ? H : W) - pos;
        let ext = Math.min(maxExt, Math.max(0, tileLim));
        const hk = kerf / 2;
        for (const k of blocks) {
            const cross = seg.o === 'V' ? [k.x0, k.x1] : [k.y0, k.y1];
            const along = seg.o === 'V' ? [k.y0, k.y1] : [k.x0, k.x1];
            if (cross[0] < seg.c + hk - EPS && cross[1] > seg.c - hk + EPS) {
                if (side > 0 && along[0] >= pos - EPS) ext = Math.min(ext, Math.max(0, along[0] - pos - hk));
                if (side < 0 && along[1] <= pos + EPS) ext = Math.min(ext, Math.max(0, pos - along[1] - hk));
            }
        }
        return ext;
    }

    /** Linien in Schnittreihenfolge: Senkrechte oben->unten, dann Waagerechte links->rechts. */
    function buildLines(W, H, blocks, kerf, opt) {
        const segs = buildSegments(blocks, kerf);
        const maxExt = opt.ueberlauf ? opt.ueberlaufMax : 0;
        const lines = [
            { layer: LAYER_FLIESE, x1: 0, y1: H, x2: 0, y2: 0 },
            { layer: LAYER_FLIESE, x1: 0, y1: 0, x2: W, y2: 0 },
            { layer: LAYER_FLIESE, x1: 0, y1: H, x2: W, y2: H },
            { layer: LAYER_FLIESE, x1: W, y1: H, x2: W, y2: 0 }
        ];
        // Aussenkontur (4 Aussenlinien) wird als EINE Kontur geschnitten (wie in den Musterdateien):
        // drei Ecken treffen exakt aufeinander, nur an einer Ecke (Dateikoordinaten links unten, Start/Ende
        // der Kontur) stehen die beiden Linienenden ueber. Innenlinien laufen an beiden Enden ueber.
        const hk = kerf / 2, tol = 1e-4;
        const bx0 = Math.min(...blocks.map(k => k.x0)) - hk, bx1 = Math.max(...blocks.map(k => k.x1)) + hk;
        const by0 = Math.min(...blocks.map(k => k.y0)) - hk, by1 = Math.max(...blocks.map(k => k.y1)) + hk;
        // Ueberschnitt-Ecke: 'lu' (Standard, wie Muster in Dateikoordinaten), 'ru', 'lo', 'ro'
        const ecke = opt.ecke || 'lu';
        const cxLow = ecke[0] === 'l', cyLow = ecke[1] === 'u';
        for (const s of segs) {
            const isV = s.o === 'V';
            const lo = isV ? bx0 : by0, hi = isV ? bx1 : by1;
            const outer = Math.abs(s.c - lo) < tol || Math.abs(s.c - hi) < tol;
            let e0 = 0, e1 = 0;
            if (maxExt > 0) {
                if (!outer) {
                    e0 = freeExtension(s, -1, blocks, W, H, kerf, maxExt);
                    e1 = freeExtension(s, +1, blocks, W, H, kerf, maxExt);
                } else {
                    // Aussenlinie auf der Seite der Ueberschnitt-Ecke: nur das Ende an dieser Ecke wird verlaengert
                    const lowSide = isV ? cxLow : cyLow;                     // Ecke auf der unteren/linken Seite dieser Linie?
                    const onCornerSide = Math.abs(s.c - (lowSide ? lo : hi)) < tol;
                    const endLow = isV ? cyLow : cxLow;                      // Ecke am Anfang (a) oder Ende (b) der Linie?
                    const cornerPos = isV ? (endLow ? by0 : by1) : (endLow ? bx0 : bx1);
                    if (onCornerSide && Math.abs((endLow ? s.a : s.b) - cornerPos) < tol) {
                        const ext = freeExtension(s, endLow ? -1 : +1, blocks, W, H, kerf, maxExt);
                        if (endLow) e0 = ext; else e1 = ext;
                    }
                }
            }
            s.a -= e0; s.b += e1;
        }
        for (const s of segs.filter(q => q.o === 'V')) lines.push({ layer: LAYER_SCHNITT, x1: s.c, y1: s.b, x2: s.c, y2: s.a });
        for (const s of segs.filter(q => q.o === 'H')) lines.push({ layer: LAYER_SCHNITT, x1: s.a, y1: s.c, x2: s.b, y2: s.c });
        return { lines, segs };
    }

    // ════════════════════════════════════════════════════════════════
    // DXF (R12, nur LINE — breit kompatibel, wie dxf-writer-Export)
    // ════════════════════════════════════════════════════════════════

    function buildDXF(lines) {
        const z = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
            '0', 'SECTION', '2', 'TABLES',
            '0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0',
            '3', 'Solid line', '72', '65', '73', '0', '40', '0.0', '0', 'ENDTAB',
            '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(LAYER_COLORS).length)];
        for (const [name, color] of Object.entries(LAYER_COLORS)) {
            z.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS');
        }
        z.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
        const f = (v) => (+v.toFixed(6)).toString();
        for (const l of lines) {
            z.push('0', 'LINE', '8', l.layer, '10', f(l.x1), '20', f(l.y1), '30', '0.0',
                '11', f(l.x2), '21', f(l.y2), '31', '0.0');
        }
        z.push('0', 'ENDSEC', '0', 'EOF');
        return z.join('\r\n') + '\r\n';
    }

    // ════════════════════════════════════════════════════════════════
    // BERECHNUNG
    // ════════════════════════════════════════════════════════════════

    /**
     * Sockel-Zuschnitt: Streifen laufen ueber die volle Fliesenseite (keine Querschnitte, kein Endrand),
     * nur parallele Schnitte im Raster Sockelhoehe + Schnittaufmass. Schnittlinien laufen an beiden Enden
     * ueber die Fliesenkante hinaus (sonst haengen die Streifen am Ende zusammen).
     * Passt die Sockellaenge zu keiner Fliesenseite, wird das Rechteck-Raster (mit Querschnitt) verwendet.
     */
    function computeSockel(p, kerf, rand, opt) {
        const SL = p.m1, SH = p.m2, TOL = 0.5;
        const lang = Math.max(p.fl, p.fb), kurz = Math.min(p.fl, p.fb);
        if (SL > lang + TOL) return { ok: false, error: 'Die Sockellänge ist länger als die Fliese.' };
        const seite = Math.abs(SL - lang) <= TOL ? 'lang' : (Math.abs(SL - kurz) <= TOL ? 'kurz' : null);
        const nameTile = (lang === kurz) ? num(lang) : `${num(lang)}X${num(kurz)}`;   // quadratisch: Sockel600X50A600
        const name = `Sockel${num(SL)}X${num(SH)}A${nameTile}`;

        if (!seite) {   // Sockellaenge kuerzer als Fliesenseite -> Querschnitt noetig -> Rechteck-Raster
            const r = compute({ ...p, typ: 'R', lage: 'auto', mix: false });
            if (!r.ok) return r;
            r.name = name; r.fileName = name + '.dxf';
            r.warnings.unshift('Sockellänge passt zu keiner Fliesenseite — Querschnitt nötig, Rechteck-Raster mit Verschnittprüfung verwendet.');
            return r;
        }

        const H = seite === 'lang' ? lang : kurz;      // Streifenlaenge (Y)
        const W = seite === 'lang' ? kurz : lang;      // quer dazu (X)
        const n = countFit(W - 2 * rand, SH, kerf);
        const rl = n < 1 ? 0 : rand + ((W - 2 * rand) - (n * (SH + kerf) - kerf)) / 2;   // Randstreifen links (mittig)
        const rr = n < 1 ? 0 : W - rl - (n * (SH + kerf) - kerf);
        const linien = Array.from({ length: n + 1 }, (_, i) => rl - kerf / 2 + i * (SH + kerf));   // Saegemittellinien
        if (n < 1) return { ok: false, error: 'Die Sockelhöhe passt (mit Randabstand) nicht auf die Fliesenbreite.' };

        const ext = opt.ueberlauf ? opt.ueberlaufMax : 0;
        const lines = [
            { layer: LAYER_FLIESE, x1: 0, y1: H, x2: 0, y2: 0 },
            { layer: LAYER_FLIESE, x1: 0, y1: 0, x2: W, y2: 0 },
            { layer: LAYER_FLIESE, x1: 0, y1: H, x2: W, y2: H },
            { layer: LAYER_FLIESE, x1: W, y1: H, x2: W, y2: 0 }
        ];
        for (const x of linien) lines.push({ layer: LAYER_SCHNITT, x1: x, y1: H + ext, x2: x, y2: -ext });   // oben -> unten

        const blk = makeBlock(linien[0] + kerf / 2, 0, n, 1, SH, H, kerf);
        const warnings = [];
        if (rand < 3) warnings.push(`Randabstand ${de(rand, 1)} mm ist kleiner als 3 mm — Kantenausbruch / Fliesentoleranz beachten.`);
        if (ext <= 0) warnings.push('Ohne Überlauf trennt der Schnitt am Fliesenende nicht sicher durch — Überlauf aktivieren.');
        return {
            ok: true, name, fileName: name + '.dxf', typ: 'S', W, H, a: SL, b: SH, kerf, rand,
            lage: 'hoch', kind: 'sockel', variant: null, seite,
            count: n, verschnitt: 100 * (1 - n * SH * H / (W * H)), blocks: [blk],
            raster: { x: SH + kerf, y: H }, randIst: { links: rl, rechts: rr, unten: 0, oben: 0 }, minRand: Math.min(rl, rr),
            warnings, varianten: [], mix: null,
            anzLinien: n + 1, schnittlaenge: (n + 1) * (H + 2 * ext),
            lines, segs: [], dxf: buildDXF(lines)
        };
    }

    /**
     * @param {Object} p  { typ:'W'|'R'|'S' (S = Sockel: m1 = Laenge, m2 = Hoehe), fl, fb, m1, m2, rand, kerf, lage:'auto'|'hoch'|'quer',
     *                      mix:boolean, ueberlauf:boolean, ueberlaufMax }
     * @returns {Object}  { ok:false, error } oder Ergebnis mit lines, dxf, name, Kennzahlen
     */
    function compute(p) {
        const kerf = p.kerf ?? DEFAULTS.kerf;
        const rand = p.rand ?? DEFAULTS.rand;
        const opt = { ueberlauf: p.ueberlauf !== false, ueberlaufMax: p.ueberlaufMax ?? DEFAULTS.ueberlaufMax,
            ecke: ['lu', 'ru', 'lo', 'ro'].includes(p.ecke) ? p.ecke : 'lu' };
        const isW = p.typ === 'W';
        const isS = p.typ === 'S';
        const a = p.m1, b = isW ? p.m1 : p.m2;

        const vals = isW ? [p.fl, p.fb, p.m1] : [p.fl, p.fb, p.m1, p.m2];
        if (vals.some(v => !(v > 0) || !isFinite(v))) return { ok: false, error: 'Bitte alle Maße als positive Zahl eingeben.' };
        if (!(kerf >= 0 && kerf <= 5)) return { ok: false, error: 'Schnittaufmaß muss zwischen 0 und 5 mm liegen.' };
        if (!(rand >= 0 && isFinite(rand))) return { ok: false, error: 'Randabstand darf nicht negativ sein.' };
        if (!(opt.ueberlaufMax >= 0 && isFinite(opt.ueberlaufMax))) return { ok: false, error: 'Überlauf darf nicht negativ sein.' };

        if (isS) return computeSockel(p, kerf, rand, opt);

        const lang = Math.max(p.fl, p.fb), kurz = Math.min(p.fl, p.fb);   // hochkant: Breite = kurz, Hoehe = lang
        const W = kurz, H = lang;

        const lageWahl = isW ? 'hoch' : (p.lage || 'auto');
        const lagen = lageWahl === 'auto' ? ['hoch', 'quer'] : [lageWahl];
        const pure = lagen.map(l => pureLayout(W, H, a, b, l, kerf, rand)).filter(Boolean);
        if (!pure.length) return { ok: false, error: 'Das Stück passt (mit Randabstand) nicht auf die Fliese.' };
        pure.sort((x, y) => (y.count - x.count) || (x.schnitte - y.schnitte) || ((x.lage === 'hoch' ? 0 : 1) - (y.lage === 'hoch' ? 0 : 1)));
        let best = pure[0];

        // Mischlage nur bei Rechteck, freier Lage (Dekor egal) und wenn sie wirklich mehr Stuecke bringt
        let mixInfo = null;
        if (p.mix && !isW && lageWahl === 'auto') {
            const mixes = mixLayouts(W, H, a, b, kerf, rand).sort((x, y) => y.count - x.count);
            if (mixes.length && mixes[0].count > best.count) {
                mixInfo = { gewonnen: mixes[0].count - best.count, rein: best.count };
                best = mixes[0];
            } else {
                mixInfo = { gewonnen: 0, rein: best.count };
            }
        }

        const { lines, segs } = buildLines(W, H, best.blocks, kerf, opt);
        const schnitt = lines.filter(l => l.layer === LAYER_SCHNITT);
        const laenge = schnitt.reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0);

        const minX = Math.min(...best.blocks.map(k => k.x0)), maxX = Math.max(...best.blocks.map(k => k.x1));
        const minY = Math.min(...best.blocks.map(k => k.y0)), maxY = Math.max(...best.blocks.map(k => k.y1));
        const randIst = { links: minX, rechts: W - maxX, unten: minY, oben: H - maxY };

        const warnings = [];
        const minRand = Math.min(randIst.links, randIst.rechts, randIst.unten, randIst.oben);
        if (rand < 3) warnings.push(`Randabstand ${de(rand, 1)} mm ist kleiner als 3 mm — Kantenausbruch / Fliesentoleranz beachten.`);
        if (best.kind === 'misch') warnings.push('Mischlage: Stücke liegen in unterschiedlicher Richtung (Dekor/Maserung beachten).');

        const nameTile = (lang === kurz) ? num(lang) : `${num(lang)}X${num(kurz)}`;
        const name = isW ? `W${num(a)}A${nameTile}` : `R${num(a)}X${num(b)}A${nameTile}`;

        const gesamt = best.blocks.reduce((s, k) => s + k.nx * k.ny, 0);
        const verschnitt = 100 * (1 - gesamt * a * b / (W * H));

        return {
            ok: true, name, fileName: name + '.dxf', typ: p.typ,
            W, H, a, b, kerf, rand, lage: best.lage, kind: best.kind, variant: best.variant || null,
            count: gesamt, verschnitt, blocks: best.blocks,
            raster: { x: dims(best.lage, a, b).sx + kerf, y: dims(best.lage, a, b).sy + kerf },
            randIst, minRand, warnings,
            varianten: pure.map(v => ({ lage: v.lage, count: v.count, nx: v.blocks[0].nx, ny: v.blocks[0].ny,
                verschnitt: 100 * (1 - v.count * a * b / (W * H)), schnitte: v.schnitte, gewaehlt: best.kind === 'rein' && v.lage === best.lage })),
            mix: mixInfo,
            anzLinien: schnitt.length, schnittlaenge: laenge,
            lines, segs, dxf: buildDXF(lines)
        };
    }

    // ════════════════════════════════════════════════════════════════
    // DIALOG
    // ════════════════════════════════════════════════════════════════

    const FIELD_CSS = 'width:100%;padding:5px 8px;background:#2a2a2a;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;';
    const LABEL_CSS = 'display:block;font-size:11px;color:#9aa;margin:8px 0 2px;';

    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    function previewSVG(r) {
        const pad = Math.max(r.W, r.H) * 0.02;
        const lw = Math.max(r.W, r.H) / 400;
        let s = `<svg viewBox="${-pad} ${-pad} ${r.W + 2 * pad} ${r.H + 2 * pad}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet">` +
            `<g transform="translate(0 ${r.H}) scale(1 -1)">` +
            `<rect x="0" y="0" width="${r.W}" height="${r.H}" fill="#1a2330" stroke="#4aa3ff" stroke-width="${lw * 1.5}"/>`;
        r.blocks.forEach((k, i) => {
            s += `<rect x="${k.x0}" y="${k.y0}" width="${k.x1 - k.x0}" height="${k.y1 - k.y0}" fill="${i === 0 ? '#2f5d3a' : '#6b4f1d'}" fill-opacity="0.55"/>`;
        });
        for (const l of r.lines) {
            if (l.layer !== LAYER_SCHNITT) continue;
            s += `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#ff5a4d" stroke-width="${lw}"/>`;
        }
        return s + '</g></svg>';
    }

    function resultHTML(r) {
        if (!r.ok) return `<div style="color:#ff6b6b;font-size:13px;">⚠ ${esc(r.error)}</div>`;
        const row = (k, v) => `<tr><td style="color:#9aa;padding:1px 10px 1px 0;white-space:nowrap">${k}</td><td>${v}</td></tr>`;
        let h = `<div style="font-size:15px;color:#fff;font-weight:600;margin-bottom:6px">${r.count} ${r.kind === 'sockel' ? 'Streifen' : 'Stück'} &nbsp;<span style="font-weight:400;color:#9aa;font-size:12px">Verschnitt ${de(r.verschnitt)} %</span></div>`;
        h += '<table style="font-size:12px;color:#ddd;border-collapse:collapse">';
        h += row('Datei', esc(r.fileName));
        if (r.kind === 'sockel') {
            h += row('Fliese', `${num(r.W)} × ${num(r.H)} mm (Streifen senkrecht, ganze ${r.seite === 'lang' ? 'lange' : 'kurze'} Seite)`);
            h += row('Raster', `${de(r.raster.x)} mm (Höhe + ${de(r.kerf, 2)}) · ${r.count} Streifen à ${num(r.a)} × ${num(r.b)}`);
            h += row('Rand', `L ${de(r.randIst.links)} · R ${de(r.randIst.rechts)} mm`);
            h += row('Schnitte', `${r.anzLinien} Linien, ${de(r.schnittlaenge / 1000)} m`);
            h += '</table>';
            for (const w of r.warnings) h += `<div style="margin-top:6px;font-size:12px;color:#f0b429">⚠ ${esc(w)}</div>`;
            return h;
        }
        h += row('Fliese', `${num(r.W)} × ${num(r.H)} mm (hochkant)`);
        h += row('Raster', `${de(r.raster.x)} × ${de(r.raster.y)} mm (Stück + ${de(r.kerf, 2)})`);
        if (r.kind === 'misch') {
            h += row('Aufteilung', r.blocks.map((k, i) => `${i ? '+ ' : ''}${k.nx}×${k.ny}`).join(' ') + ' <span style="color:#f0b429">(Mischlage)</span>');
        } else {
            h += row('Aufteilung', `${r.blocks[0].nx} × ${r.blocks[0].ny}` + (r.typ === 'R' ? ` &nbsp;(Maß 1 ${r.lage === 'hoch' ? 'senkrecht' : 'waagerecht'})` : ''));
        }
        h += row('Rand', `L ${de(r.randIst.links)} · R ${de(r.randIst.rechts)} · U ${de(r.randIst.unten)} · O ${de(r.randIst.oben)} mm`);
        h += row('Schnitte', `${r.anzLinien} Linien, ${de(r.schnittlaenge / 1000)} m`);
        h += '</table>';
        if (r.varianten.length > 1) {
            h += '<div style="margin-top:8px;font-size:11px;color:#9aa">Verschnittprüfung (Lage des Maßes 1):</div><table style="font-size:12px;color:#ddd;border-collapse:collapse">';
            for (const v of r.varianten.slice().sort((x, y) => y.count - x.count)) {
                const mark = v.gewaehlt ? ' <span style="color:#4ade80">◀ gewählt</span>' : '';
                h += `<tr><td style="padding-right:10px">${v.lage === 'hoch' ? 'senkrecht' : 'waagerecht'}</td><td style="padding-right:10px">${v.nx}×${v.ny} = ${v.count}</td><td>${de(v.verschnitt)} %${mark}</td></tr>`;
            }
            h += '</table>';
        }
        if (r.mix) {
            h += `<div style="margin-top:6px;font-size:12px;color:${r.mix.gewonnen > 0 ? '#f0b429' : '#9aa'}">` +
                (r.mix.gewonnen > 0 ? `Mischlage: +${r.mix.gewonnen} Stück gegenüber reiner Lage (${r.mix.rein}).` : 'Mischlage bringt hier keinen Vorteil — reine Lage verwendet.') + '</div>';
        }
        for (const w of r.warnings) h += `<div style="margin-top:6px;font-size:12px;color:#f0b429">⚠ ${esc(w)}</div>`;
        return h;
    }

    function openDialog(options = {}) {
        const app = options.app || (typeof window !== 'undefined' ? window.app : null);
        if (typeof document === 'undefined') return;
        document.getElementById('mosaik-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'mosaik-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#1e1e1e;border:1px solid #555;border-radius:8px;width:min(900px,96vw);max-height:94vh;overflow:auto;padding:18px 20px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:'Segoe UI',sans-serif;">
                <h3 style="margin:0 0 10px;font-size:15px;color:#00aaff;">Zuschnitt-Programm erzeugen</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div style="flex:0 0 300px;min-width:260px;">
                        <div style="display:flex;gap:14px;font-size:13px;margin-bottom:4px;">
                            <label><input type="radio" name="mos-typ" value="W"> Würfel</label>
                            <label><input type="radio" name="mos-typ" value="R"> Rechteck</label>
                            <label><input type="radio" name="mos-typ" value="S"> Sockel</label>
                        </div>
                        <label style="${LABEL_CSS}">Fliese Länge [mm]</label><input id="mos-fl" style="${FIELD_CSS}" value="900" inputmode="decimal">
                        <label style="${LABEL_CSS}">Fliese Breite [mm]</label><input id="mos-fb" style="${FIELD_CSS}" value="320" inputmode="decimal">
                        <label id="mos-l-m1" style="${LABEL_CSS}">Würfelkante [mm] (ohne Aufmaß)</label><input id="mos-m1" style="${FIELD_CSS}" value="48" inputmode="decimal">
                        <div id="mos-m2-wrap"><label id="mos-l-m2" style="${LABEL_CSS}">Maß 2 [mm] (ohne Aufmaß)</label><input id="mos-m2" style="${FIELD_CSS}" value="16" inputmode="decimal"></div>
                        <div style="display:flex;gap:10px;">
                            <div style="flex:1"><label style="${LABEL_CSS}">Randabstand [mm]</label><input id="mos-rand" style="${FIELD_CSS}" value="3" inputmode="decimal"></div>
                            <div style="flex:1"><label style="${LABEL_CSS}">Schnittaufmaß [mm]</label><input id="mos-kerf" style="${FIELD_CSS}" value="0,8" inputmode="decimal"></div>
                        </div>
                        <div id="mos-rect-opts">
                            <label style="${LABEL_CSS}">Lage / Dekor</label>
                            <select id="mos-lage" style="${FIELD_CSS}">
                                <option value="auto">Automatisch (verschnittoptimiert)</option>
                                <option value="hoch">Dekor fest: Maß 1 senkrecht</option>
                                <option value="quer">Dekor fest: Maß 1 waagerecht</option>
                            </select>
                            <label style="display:block;font-size:12px;margin-top:8px;"><input type="checkbox" id="mos-mix"> Mischlage (Reststreifen mit gedrehten Stücken füllen)</label>
                        </div>
                        <label style="display:block;font-size:12px;margin-top:8px;"><input type="checkbox" id="mos-ue" checked> Überlauf der Schnittlinien, max.
                            <input id="mos-uemax" style="width:44px;padding:2px 4px;background:#2a2a2a;border:1px solid #555;border-radius:3px;color:#fff;font-size:12px;" value="5"> mm (nur soweit Platz ist)</label>
                        <div id="mos-ecke-wrap"><label style="${LABEL_CSS}">Überschnitt der Außenkontur (Start/Ende, Ecke in Dateikoordinaten)</label>
                        <select id="mos-ecke" style="${FIELD_CSS}">
                            <option value="lu">links unten (wie Musterdateien)</option>
                            <option value="ru">rechts unten</option>
                            <option value="lo">links oben</option>
                            <option value="ro">rechts oben</option>
                        </select></div>
                    </div>
                    <div style="flex:1 1 380px;min-width:300px;display:flex;flex-direction:column;gap:10px;">
                        <div id="mos-prev" style="height:300px;background:#12161c;border:1px solid #333;border-radius:4px;padding:6px;box-sizing:border-box;"></div>
                        <div id="mos-res"></div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button id="mos-cancel" style="padding:6px 16px;background:#555;border:none;border-radius:4px;color:#ddd;cursor:pointer;">Abbrechen</button>
                    <button id="mos-save" style="padding:6px 16px;background:#3a3a3a;border:1px solid #666;border-radius:4px;color:#ddd;cursor:pointer;">DXF speichern</button>
                    <button id="mos-ok" style="padding:6px 16px;background:#00aaff;border:none;border-radius:4px;color:#000;cursor:pointer;font-weight:600;">Erzeugen</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const $ = (id) => overlay.querySelector('#' + id);
        const typRadios = overlay.querySelectorAll('input[name="mos-typ"]');
        const preset = ['R', 'S'].includes(options.typ) ? options.typ : 'W';
        typRadios.forEach(r => { r.checked = (r.value === preset); });
        let last = null;
        if (preset === 'S') {   // Beispielwerte nach Sockel1200X45A1200X300
            $('mos-fl').value = '1200'; $('mos-fb').value = '300'; $('mos-m1').value = '1200'; $('mos-m2').value = '45';
            $('mos-uemax').value = '3';
        }
        let ueTouched = false;
        $('mos-uemax').addEventListener('input', () => { ueTouched = true; });
        typRadios.forEach(r => r.addEventListener('change', () => { if (!ueTouched) $('mos-uemax').value = r.value === 'S' ? '3' : '5'; }));

        const getTyp = () => overlay.querySelector('input[name="mos-typ"]:checked')?.value || 'W';

        function update() {
            const typ = getTyp();
            $('mos-m2-wrap').style.display = typ === 'W' ? 'none' : '';
            $('mos-rect-opts').style.display = typ === 'R' ? '' : 'none';
            $('mos-ecke-wrap').style.display = typ === 'S' ? 'none' : '';
            $('mos-l-m1').textContent = typ === 'R' ? 'Maß 1 [mm] (ohne Aufmaß)' : (typ === 'S' ? 'Sockellänge [mm]' : 'Würfelkante [mm] (ohne Aufmaß)');
            $('mos-l-m2').textContent = typ === 'S' ? 'Sockelhöhe [mm] (ohne Aufmaß)' : 'Maß 2 [mm] (ohne Aufmaß)';
            const lageAuto = $('mos-lage').value === 'auto';
            $('mos-mix').disabled = !lageAuto;
            if (!lageAuto) $('mos-mix').checked = false;
            last = compute({
                typ, fl: parseNum($('mos-fl').value), fb: parseNum($('mos-fb').value),
                m1: parseNum($('mos-m1').value), m2: parseNum($('mos-m2').value),
                rand: parseNum($('mos-rand').value), kerf: parseNum($('mos-kerf').value),
                lage: $('mos-lage').value, mix: $('mos-mix').checked,
                ecke: $('mos-ecke').value,
                ueberlauf: $('mos-ue').checked, ueberlaufMax: $('mos-ue').checked ? parseNum($('mos-uemax').value) : 0
            });
            $('mos-res').innerHTML = resultHTML(last);
            $('mos-prev').innerHTML = last.ok ? previewSVG(last) : '';
            $('mos-ok').disabled = $('mos-save').disabled = !last.ok;
            $('mos-ok').style.opacity = $('mos-save').style.opacity = last.ok ? '1' : '0.4';
        }

        const onDocKey = (e) => { if (e.key === 'Escape') close(); };   // Esc auch ohne Fokus im Dialog
        document.addEventListener('keydown', onDocKey, true);
        const close = () => {
            document.removeEventListener('keydown', onDocKey, true);
            overlay.remove();
            // Cursor zuruecksetzen (startTool setzt nach start() ein Fadenkreuz)
            setTimeout(() => { const cv = app?.renderer?.canvas; if (cv) cv.style.cursor = ''; }, 0);
        };

        overlay.addEventListener('input', update);
        overlay.addEventListener('change', update);
        $('mos-cancel').addEventListener('click', close);
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) overlay._downOnBg = true; else overlay._downOnBg = false; });
        overlay.addEventListener('click', (e) => { if (e.target === overlay && overlay._downOnBg) close(); });
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && last?.ok) $('mos-ok').click();
            e.stopPropagation();   // Befehlszeilen-/Tool-Shortcuts nicht triggern
        });
        overlay.addEventListener('keyup', (e) => e.stopPropagation());

        $('mos-ok').addEventListener('click', () => {
            if (!last?.ok) return;
            if (!app?.loadDXFContent) { console.warn(LOG, 'app.loadDXFContent nicht verfuegbar'); return; }
            const kb = (last.dxf.length / 1024).toFixed(1);
            app.loadDXFContent(last.fileName, last.dxf, kb);
            app.showToast?.(`Mosaik ${last.name}: ${last.count} Stück erzeugt`, 'success');
            console.log(LOG, 'erzeugt', last.name, last.count, 'Stueck');
            close();
        });
        $('mos-save').addEventListener('click', () => {
            if (!last?.ok) return;
            const blob = new Blob([last.dxf], { type: 'application/dxf' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = last.fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
        });

        update();
        setTimeout(() => { const f = $('mos-m1'); f.focus(); f.select(); }, 50);
    }

    return { VERSION, DEFAULTS, compute, buildDXF, openDialog, _internals: { countFit, pureLayout, mixLayouts, buildSegments } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MosaicGenerator;
if (typeof window !== 'undefined') window.MosaicGenerator = MosaicGenerator;


// ════════════════════════════════════════════════════════════════════════════
//  BEFEHLE (MOS / MOSW / MOSR) — Lazy-Patch in DrawingToolManager, wie CAM-Tools
// ════════════════════════════════════════════════════════════════════════════

if (typeof BaseTool !== 'undefined' && typeof DrawingToolManager !== 'undefined') {
    class MosaicTool extends BaseTool {
        constructor(manager, typ) { super(manager); this.typ = typ; }
        start() {
            MosaicGenerator.openDialog({ app: this.manager.app, typ: this.typ });
            this.cancel();   // Dialog-Tool: kein aktiver Zeichenmodus
        }
    }

    const _origStartToolMos = DrawingToolManager.prototype.startTool;
    DrawingToolManager.prototype.startTool = function (shortcut) {
        if (!this._mosaikRegistered) {
            this._mosaikRegistered = true;
            this.tools['MOS']  = () => new MosaicTool(this, 'W');
            this.tools['MOSW'] = () => new MosaicTool(this, 'W');
            this.tools['MOSR'] = () => new MosaicTool(this, 'R');
            this.tools['MOSS'] = () => new MosaicTool(this, 'S');
        }
        return _origStartToolMos.call(this, shortcut);
    };
}

// Ribbon-Buttons der Gruppe "Mosaik" (CAD-Tab) — eigene Handler, kein Zeichenmodus noetig
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-mosaik]').forEach(btn => {
            btn.addEventListener('click', () => MosaicGenerator.openDialog({ app: window.app, typ: btn.dataset.mosaik }));
        });
    });
}
