/**
 * CeraCUT Fliesen-Layout V1.0 — Verband (VERB) + Ausschnitte (AUSS)
 *
 * VERB: Verlegemuster auf einer Wandflaeche (Rechteck): Laeuferverband 1/2, Drittelverband 1/3,
 *       Viertelverband 1/4, Kreuzfuge (Gitter), jeweils gerade oder diagonal (45 Grad).
 *       Erzeugt Plan-DXF (Wand / Fliesen / Schnitt) und eine Stueckliste der Randzuschnitte (gleiche gruppiert).
 * AUSS: Ausschnitte in einer Fliese: runde Loecher (Steckdose, Rohr), rechteckige Loecher, Eckausschnitte,
 *       Randkerben. Erzeugt Schnittprogramm-DXF (Layer "Fliesen" = Umriss, Layer "Schnitt" = Ausschnittkonturen).
 *       Offene Kerben laufen optional ueber die Fliesenkante hinaus (wie beim Zuschnitt-Generator).
 *
 * Koordinaten: Ursprung links unten, Fliese hochkant (lange Seite = Y) wie im Zuschnitt-Generator.
 * Das DXF wird ueber app.loadDXFContent() in einen neuen Tab geladen.
 *
 * V1.0: Erstversion
 * Created: 2026-11-05 MEZ
 * Last Modified: 2026-11-05
 * Build: 20261105-verband
 */

const TileLayout = (() => {
    'use strict';

    const VERSION = '1.0';
    const LOG = '[Fliesen-Layout V1.0]';
    const EPS = 1e-6;

    const num = (v) => (+v.toFixed(3)).toString();
    const de = (v, d = 1) => (+v.toFixed(d)).toString().replace('.', ',');
    const parseNum = (s) => parseFloat(String(s).replace(',', '.').trim());
    const f6 = (v) => (+v.toFixed(6)).toString();

    const LAYERS = { Wand: 7, Fliesen: 160, Schnitt: 10 };

    // ════════════════════════════════════════════════════════════════
    // DXF (R12: LINE + CIRCLE)
    // ════════════════════════════════════════════════════════════════

    function buildDXF(ents) {
        const z = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC',
            '0', 'SECTION', '2', 'TABLES',
            '0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0',
            '3', 'Solid line', '72', '65', '73', '0', '40', '0.0', '0', 'ENDTAB',
            '0', 'TABLE', '2', 'LAYER', '70', String(Object.keys(LAYERS).length)];
        for (const [name, color] of Object.entries(LAYERS)) {
            z.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS');
        }
        z.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
        for (const e of ents) {
            if (e.t === 'L') z.push('0', 'LINE', '8', e.layer, '10', f6(e.x1), '20', f6(e.y1), '30', '0.0', '11', f6(e.x2), '21', f6(e.y2), '31', '0.0');
            else if (e.t === 'C') z.push('0', 'CIRCLE', '8', e.layer, '10', f6(e.x), '20', f6(e.y), '30', '0.0', '40', f6(e.r));
        }
        z.push('0', 'ENDSEC', '0', 'EOF');
        return z.join('\r\n') + '\r\n';
    }

    /** Geschlossenes Polygon als LINE-Folge (Reihenfolge = Schnittrichtung). */
    function polyLines(pts, layer, out) {
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i], q = pts[(i + 1) % pts.length];
            out.push({ t: 'L', layer, x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
        }
    }

    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    // ════════════════════════════════════════════════════════════════
    // VERBAND
    // ════════════════════════════════════════════════════════════════

    const PATTERNS = {
        half:    { label: 'Läuferverband 1/2', offs: [0, 1 / 2] },
        third:   { label: 'Drittelverband 1/3', offs: [0, 1 / 3, 2 / 3] },
        quarter: { label: 'Viertelverband 1/4', offs: [0, 1 / 4, 1 / 2, 3 / 4] },
        grid:    { label: 'Kreuzfuge (Gitter)', offs: [0] }
    };

    /** Sutherland-Hodgman gegen Achsenrechteck [0,W]x[0,H]. */
    function clipRect(poly, W, H) {
        const edges = [
            (p) => p[0] >= -EPS, (p) => p[0] <= W + EPS, (p) => p[1] >= -EPS, (p) => p[1] <= H + EPS
        ];
        const inter = [
            (a, b) => { const t = (0 - a[0]) / (b[0] - a[0]); return [0, a[1] + t * (b[1] - a[1])]; },
            (a, b) => { const t = (W - a[0]) / (b[0] - a[0]); return [W, a[1] + t * (b[1] - a[1])]; },
            (a, b) => { const t = (0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), 0]; },
            (a, b) => { const t = (H - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), H]; }
        ];
        let out = poly;
        for (let e = 0; e < 4 && out.length; e++) {
            const inp = out; out = [];
            for (let i = 0; i < inp.length; i++) {
                const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
                const cin = edges[e](cur), pin = edges[e](prev);
                if (cin) { if (!pin) out.push(inter[e](prev, cur)); out.push(cur); }
                else if (pin) out.push(inter[e](prev, cur));
            }
        }
        // doppelte Punkte entfernen
        return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4; });
    }

    function polyArea(p) {
        let a = 0;
        for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
        return a / 2;
    }

    function polyPerim(p) {
        let l = 0;
        for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; l += Math.hypot(p[i][0] - q[0], p[i][1] - q[1]); }
        return l;
    }

    /**
     * @param {Object} p { W, H (Wand), tw, th (Fliese horizontal/vertikal), fuge, muster, diagonal:boolean,
     *                     startX:'mitte'|'links', startY:'unten'|'mitte'|'oben', minStueck }
     */
    function computeVerband(p) {
        const { W, H, tw, th } = p;
        const fuge = p.fuge ?? 3;
        const minStueck = p.minStueck ?? 30;
        if ([W, H, tw, th].some(v => !(v > 0) || !isFinite(v))) return { ok: false, error: 'Bitte alle Maße als positive Zahl eingeben.' };
        if (!(fuge >= 0 && fuge <= 20)) return { ok: false, error: 'Fuge muss zwischen 0 und 20 mm liegen.' };
        const pat = PATTERNS[p.muster] || PATTERNS.half;
        const diag = !!p.diagonal;
        const px = tw + fuge, py = th + fuge;
        const cx = W / 2, cy = H / 2;
        const R = diag ? Math.hypot(W, H) / 2 : Math.max(W, H) / 2;
        const nI = Math.ceil(R / px) + 3, nJ = Math.ceil(R / py) + 3;
        if ((2 * nI + 1) * (2 * nJ + 1) > 40000) return { ok: false, error: 'Zu viele Fliesen (Wand zu groß oder Fliese zu klein).' };

        const startX = diag ? 'mitte' : (p.startX || 'mitte');
        const startY = diag ? 'mitte' : (p.startY || 'unten');
        // lokale Koordinaten (u,v) relativ Wandmitte; Zeile 0 = Startzeile
        const v0 = startY === 'unten' ? -H / 2 : (startY === 'oben' ? H / 2 - th : -th / 2);
        const u0 = startX === 'links' ? -W / 2 : -tw / 2;
        const ang = diag ? Math.PI / 4 : 0, ca = Math.cos(ang), sa = Math.sin(ang);
        const tx = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
        const dirY = startY === 'oben' ? -1 : 1;   // Zeilenrichtung weg von der Startkante

        const tiles = [];
        for (let j = -nJ; j <= nJ; j++) {
            const vj = v0 + dirY * j * py;
            const k = ((j % pat.offs.length) + pat.offs.length) % pat.offs.length;
            const off = pat.offs[k] * px;
            for (let i = -nI; i <= nI; i++) {
                const ui = u0 + off + i * px;
                const poly = [tx(ui, vj), tx(ui + tw, vj), tx(ui + tw, vj + th), tx(ui, vj + th)];
                // Schnellausschluss
                const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]);
                if (Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H) continue;
                const clipped = clipRect(poly, W, H);
                if (clipped.length < 3) continue;
                const area = Math.abs(polyArea(clipped));
                if (area < 1) continue;
                const full = area >= tw * th - 0.5;
                tiles.push({ poly: full ? poly : clipped, full, area, row: j, col: i });
            }
        }

        // Zuschnitte gruppieren
        const groups = new Map();
        const fullCount = tiles.filter(t => t.full).length;
        for (const t of tiles) {
            if (t.full) continue;
            const xs = t.poly.map(q => q[0]), ys = t.poly.map(q => q[1]);
            const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
            const rect = t.poly.length === 4 && Math.abs(t.area - bw * bh) < 0.5;
            const key = rect
                ? `R ${de(Math.max(bw, bh), 1)}x${de(Math.min(bw, bh), 1)}`
                : `P${t.poly.length} ${de(t.area / 100, 0)} ${de(polyPerim(t.poly), 0)}`;
            let g = groups.get(key);
            if (!g) { g = { key, rect, w: bw, h: bh, area: t.area, n: t.poly.length, count: 0, polys: [] }; groups.set(key, g); }
            g.count++; g.polys.push(t.poly);
        }
        const stueckliste = [...groups.values()].sort((a, b) => b.count - a.count);
        const cutCount = tiles.length - fullCount;
        const minDim = stueckliste.length ? Math.min(...stueckliste.map(g => g.rect ? Math.min(g.w, g.h) : Math.sqrt(g.area))) : Infinity;

        const warnings = [];
        for (const g of stueckliste) {
            if (g.rect && Math.min(g.w, g.h) < minStueck) warnings.push(`Schmales Randstück ${de(Math.min(g.w, g.h))} mm (${g.count}×) — Bruchgefahr / optisch ungünstig. Startposition ändern (Mitte/Links, Unten/Oben).`);
        }
        if (diag) warnings.push('Diagonal: Randzuschnitte sind Dreiecke/Trapeze — Spiegelbilder sind in der Stückliste zusammengefasst.');

        // Fliesenbedarf: jedes Randstueck braucht eine Fliese (Restverwertung nicht beruecksichtigt)
        const bedarf = tiles.length;
        const flaeche = W * H / 1e6;

        // Plan-DXF: Wand, volle Fliesen (Layer Fliesen), Zuschnitte (Layer Schnitt)
        const ents = [];
        polyLines([[0, 0], [W, 0], [W, H], [0, H]], 'Wand', ents);
        for (const t of tiles) polyLines(t.poly, t.full ? 'Fliesen' : 'Schnitt', ents);

        const name = `Verband_${p.muster || 'half'}${diag ? '_diag' : ''}_${num(W)}X${num(H)}_F${num(tw)}X${num(th)}`;
        return {
            ok: true, name, fileName: name + '.dxf', W, H, tw, th, fuge, muster: p.muster || 'half', diag,
            tiles, fullCount, cutCount, bedarf, flaeche, stueckliste, minDim, warnings,
            fliesenFlaeche: bedarf * tw * th / 1e6,
            dxf: buildDXF(ents), ents
        };
    }

    function stuecklisteCSV(r) {
        const rows = [['Nr', 'Form', 'Breite [mm]', 'Höhe [mm]', 'Anzahl']];
        r.stueckliste.forEach((g, i) => rows.push([String(i + 1), g.rect ? 'Rechteck' : `${g.n}-Eck`, g.rect ? de(Math.max(g.w, g.h)).replace('.', ',') : de(g.w), g.rect ? de(Math.min(g.w, g.h)) : de(g.h), String(g.count)]));
        rows.push(['', 'Ganze Fliesen', '', '', String(r.fullCount)]);
        return rows.map(x => x.join(';')).join('\r\n') + '\r\n';
    }

    function verbandSVG(r) {
        const pad = Math.max(r.W, r.H) * 0.02, lw = Math.max(r.W, r.H) / 500;
        let s = `<svg viewBox="${-pad} ${-pad} ${r.W + 2 * pad} ${r.H + 2 * pad}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"><g transform="translate(0 ${r.H}) scale(1 -1)">`;
        for (const t of r.tiles) {
            s += `<polygon points="${t.poly.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="${t.full ? '#24384f' : '#6b4f1d'}" fill-opacity="${t.full ? 0.7 : 0.8}" stroke="${t.full ? '#4aa3ff' : '#ff5a4d'}" stroke-width="${lw}"/>`;
        }
        return s + `<rect x="0" y="0" width="${r.W}" height="${r.H}" fill="none" stroke="#fff" stroke-width="${lw * 2}"/></g></svg>`;
    }

    // ════════════════════════════════════════════════════════════════
    // AUSSCHNITTE
    // ════════════════════════════════════════════════════════════════

    /**
     * @param {Object} p { fl, fb, ref:'lu'|'ru'|'lo'|'ro', cuts:[...], ueberlauf, ueberlaufMax, steg }
     *   cut: { typ:'rund'|'eck'|'rechteck'|'kerbe', x, y, w, h, d, ecke:'lu'|'ru'|'lo'|'ro', kante:'l'|'r'|'u'|'o' }
     *   rund:     x,y = Mittelpunkt (ab Bezugsecke ref), d = Durchmesser
     *   rechteck: x,y = Mittelpunkt (ab Bezugsecke ref), w,h
     *   eck:      ecke = Fliesenecke (in Fliesenkoordinaten, unabhaengig von ref), w = Breite (X), h = Hoehe (Y)
     *   kerbe:    kante = Fliesenkante, x = Mitte der Kerbe entlang der Kante (ab Bezugsecke ref), w = Breite entlang Kante, h = Tiefe ins Material
     */
    function computeAusschnitt(p) {
        const lang = Math.max(p.fl, p.fb), kurz = Math.min(p.fl, p.fb);
        const W = kurz, H = lang;
        const ref = p.ref || 'lu';
        const steg = p.steg ?? 8;
        const ueMax = p.ueberlauf === false ? 0 : (p.ueberlaufMax ?? 5);
        if (!(W > 0 && H > 0) || !isFinite(W + H)) return { ok: false, error: 'Bitte Fliesenmaße als positive Zahl eingeben.' };
        if (!p.cuts || !p.cuts.length) return { ok: false, error: 'Mindestens einen Ausschnitt anlegen.' };

        const mx = (x) => ref[0] === 'r' ? W - x : x;      // Bezugsecke -> Fliesenkoordinaten
        const my = (y) => ref[1] === 'o' ? H - y : y;

        const rects = [];     // Rechtecke, die aus der Fliese entfernt werden (Fliesenkoordinaten)
        const circles = [];
        const warnings = [];
        const labels = [];
        let idx = 0;
        for (const c of p.cuts) {
            idx++;
            const tag = `Ausschnitt ${idx}`;
            const bad = (...v) => v.some(x => !(x > 0) || !isFinite(x));
            if (c.typ === 'rund') {
                if (bad(c.d) || !isFinite(c.x) || !isFinite(c.y)) return { ok: false, error: `${tag}: Durchmesser und Position angeben.` };
                const cxm = mx(c.x), cym = my(c.y), r = c.d / 2;
                if (cxm - r < -EPS || cxm + r > W + EPS || cym - r < -EPS || cym + r > H + EPS)
                    return { ok: false, error: `${tag}: Loch Ø${num(c.d)} liegt nicht vollständig in der Fliese (Randkerbe verwenden).` };
                circles.push({ x: cxm, y: cym, r, idx });
                labels.push(`Loch Ø${num(c.d)} bei ${num(c.x)} / ${num(c.y)}`);
            } else if (c.typ === 'rechteck') {
                if (bad(c.w, c.h) || !isFinite(c.x) || !isFinite(c.y)) return { ok: false, error: `${tag}: Breite, Höhe und Position angeben.` };
                const x0 = mx(c.x) - c.w / 2, x1 = mx(c.x) + c.w / 2, y0 = my(c.y) - c.h / 2, y1 = my(c.y) + c.h / 2;
                if (x0 < -EPS || y0 < -EPS || x1 > W + EPS || y1 > H + EPS)
                    return { ok: false, error: `${tag}: Rechteckloch ragt über die Fliesenkante (Eck-/Randkerbe verwenden).` };
                rects.push({ x0, y0, x1, y1, idx, loch: true });
                labels.push(`Rechteck ${num(c.w)}×${num(c.h)} bei ${num(c.x)} / ${num(c.y)}`);
            } else if (c.typ === 'eck') {
                if (bad(c.w, c.h)) return { ok: false, error: `${tag}: Breite und Höhe der Ecke angeben.` };
                const e = c.ecke || 'lu';
                const x0 = e[0] === 'l' ? 0 : W - c.w, x1 = e[0] === 'l' ? c.w : W;
                const y0 = e[1] === 'u' ? 0 : H - c.h, y1 = e[1] === 'u' ? c.h : H;
                if (c.w >= W - EPS && c.h >= H - EPS) return { ok: false, error: `${tag}: Eckausschnitt ist größer als die Fliese.` };
                rects.push({ x0, y0, x1, y1, idx });
                labels.push(`Ecke ${e} ${num(c.w)}×${num(c.h)}`);
            } else if (c.typ === 'kerbe') {
                if (bad(c.w, c.h) || !isFinite(c.x)) return { ok: false, error: `${tag}: Breite, Tiefe und Position angeben.` };
                const k = c.kante || 'u';
                let x0, x1, y0, y1;
                if (k === 'u' || k === 'o') {
                    const m = mx(c.x); x0 = m - c.w / 2; x1 = m + c.w / 2;
                    y0 = k === 'u' ? 0 : H - c.h; y1 = k === 'u' ? c.h : H;
                } else {
                    const m = my(c.x); y0 = m - c.w / 2; y1 = m + c.w / 2;
                    x0 = k === 'l' ? 0 : W - c.h; x1 = k === 'l' ? c.h : W;
                }
                if (x0 < -EPS || y0 < -EPS || x1 > W + EPS || y1 > H + EPS) return { ok: false, error: `${tag}: Kerbe ragt über die Fliese hinaus.` };
                rects.push({ x0, y0, x1, y1, idx });
                labels.push(`Kerbe Kante ${k} ${num(c.w)}×${num(c.h)}`);
            } else return { ok: false, error: `${tag}: unbekannter Typ.` };
        }

        // Stege pruefen
        const edgeGap = (x0, y0, x1, y1) => Math.min(x0, y0, W - x1, H - y1);
        for (const r of rects.filter(q => q.loch)) {
            const g = edgeGap(r.x0, r.y0, r.x1, r.y1);
            if (g < steg) warnings.push(`Ausschnitt ${r.idx}: Steg zum Fliesenrand nur ${de(g)} mm (< ${num(steg)} mm) — Bruchgefahr.`);
        }
        for (const c of circles) {
            const g = edgeGap(c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
            if (g < steg) warnings.push(`Ausschnitt ${c.idx}: Steg zum Fliesenrand nur ${de(g)} mm (< ${num(steg)} mm) — Bruchgefahr.`);
        }
        const distRectRect = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
        const distCircRect = (c, r) => Math.hypot(Math.max(0, r.x0 - c.x, c.x - r.x1), Math.max(0, r.y0 - c.y, c.y - r.y1)) - c.r;
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                const d = distRectRect(rects[i], rects[j]);
                if (d > EPS && d < steg) warnings.push(`Ausschnitt ${rects[i].idx} / ${rects[j].idx}: Steg dazwischen nur ${de(d)} mm — Bruchgefahr.`);
            }
            for (const c of circles) {
                const d = distCircRect(c, rects[i]);
                if (d < 0) return { ok: false, error: `Ausschnitt ${c.idx} überschneidet Ausschnitt ${rects[i].idx}.` };
                if (d < steg) warnings.push(`Ausschnitt ${c.idx} / ${rects[i].idx}: Steg dazwischen nur ${de(d)} mm — Bruchgefahr.`);
            }
        }
        for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) {
            const d = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y) - circles[i].r - circles[j].r;
            if (d < 0) return { ok: false, error: `Ausschnitt ${circles[i].idx} überschneidet Ausschnitt ${circles[j].idx}.` };
            if (d < steg) warnings.push(`Ausschnitt ${circles[i].idx} / ${circles[j].idx}: Steg dazwischen nur ${de(d)} mm — Bruchgefahr.`);
        }

        // Rechteck-Vereinigung ueber Koordinatenkompression -> Kantenzuege der entfernten Flaeche
        const xsU = [...new Set([0, W, ...rects.flatMap(r => [r.x0, r.x1])].map(v => +v.toFixed(6)))].sort((a, b) => a - b);
        const ysU = [...new Set([0, H, ...rects.flatMap(r => [r.y0, r.y1])].map(v => +v.toFixed(6)))].sort((a, b) => a - b);
        const nx = xsU.length - 1, ny = ysU.length - 1;
        const removed = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny &&
            rects.some(r => xsU[i] >= r.x0 - EPS && xsU[i + 1] <= r.x1 + EPS && ysU[j] >= r.y0 - EPS && ysU[j + 1] <= r.y1 + EPS);
        const inTile = (i, j) => i >= 0 && j >= 0 && i < nx && j < ny;
        // Kanten zwischen entfernter Zelle und verbleibender Zelle = Schnittkanten; Kanten zum Fliesenrand entfallen
        const cutEdges = [];
        for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
            if (!removed(i, j)) continue;
            const X0 = xsU[i], X1 = xsU[i + 1], Y0 = ysU[j], Y1 = ysU[j + 1];
            const keep = (a, b) => inTile(a, b) && !removed(a, b);
            if (keep(i - 1, j)) cutEdges.push([[X0, Y0], [X0, Y1]]);
            if (keep(i + 1, j)) cutEdges.push([[X1, Y0], [X1, Y1]]);
            if (keep(i, j - 1)) cutEdges.push([[X0, Y0], [X1, Y0]]);
            if (keep(i, j + 1)) cutEdges.push([[X0, Y1], [X1, Y1]]);
        }
        // Zu Zuegen verketten
        const key = (pt) => pt[0].toFixed(5) + ',' + pt[1].toFixed(5);
        const adj = new Map();
        cutEdges.forEach((e, n) => { for (const pt of e) { const k = key(pt); (adj.get(k) || adj.set(k, []).get(k)).push(n); } });
        const used = new Array(cutEdges.length).fill(false);
        const chains = [];
        const walk = (startEdge, startPt) => {
            const pts = [startPt];
            let n = startEdge, cur = startPt;
            while (n !== undefined && !used[n]) {
                used[n] = true;
                const e = cutEdges[n];
                const nxt = key(e[0]) === key(cur) ? e[1] : e[0];
                pts.push(nxt); cur = nxt;
                n = (adj.get(key(cur)) || []).find(m => !used[m]);
            }
            return pts;
        };
        const deg1 = [...adj.entries()].filter(([, v]) => v.length === 1);
        for (const [k, v] of deg1) {
            if (used[v[0]]) continue;
            const e = cutEdges[v[0]];
            chains.push(walk(v[0], key(e[0]) === k ? e[0] : e[1]));
        }
        for (let n = 0; n < cutEdges.length; n++) if (!used[n]) chains.push(walk(n, cutEdges[n][0]));
        // kollineare Punkte zusammenfassen
        const simplify = (pts) => {
            const out = [pts[0]];
            for (let i = 1; i < pts.length - 1; i++) {
                const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
                if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-6) out.push(b);
            }
            out.push(pts[pts.length - 1]);
            return out;
        };

        const ents = [];
        polyLines([[0, H], [0, 0], [W, 0], [W, H]], 'Fliesen', ents);   // wie Zuschnitt-Generator: 4 Linien
        ents.length = 0;
        ents.push({ t: 'L', layer: 'Fliesen', x1: 0, y1: H, x2: 0, y2: 0 }, { t: 'L', layer: 'Fliesen', x1: 0, y1: 0, x2: W, y2: 0 },
            { t: 'L', layer: 'Fliesen', x1: 0, y1: H, x2: W, y2: H }, { t: 'L', layer: 'Fliesen', x1: W, y1: H, x2: W, y2: 0 });
        const drawn = [];
        for (const c of circles) { ents.push({ t: 'C', layer: 'Schnitt', x: c.x, y: c.y, r: c.r }); drawn.push({ circle: c }); }
        for (const ch of chains) {
            let pts = simplify(ch);
            const closed = pts.length > 2 && key(pts[0]) === key(pts[pts.length - 1]);
            if (closed) pts = pts.slice(0, -1);
            const seg = [];
            const n = closed ? pts.length : pts.length - 1;
            for (let i = 0; i < n; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                seg.push({ t: 'L', layer: 'Schnitt', x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
            }
            if (!closed && ueMax > 0 && seg.length) {
                // offene Kerbe: beide Enden ueber die Fliesenkante hinaus verlaengern
                const ext = (s, atEnd) => {
                    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l = Math.hypot(dx, dy) || 1;
                    if (atEnd) { s.x2 += dx / l * ueMax; s.y2 += dy / l * ueMax; } else { s.x1 -= dx / l * ueMax; s.y1 -= dy / l * ueMax; }
                };
                ext(seg[0], false); ext(seg[seg.length - 1], true);
            }
            ents.push(...seg);
            drawn.push({ pts, closed });
        }

        const lenOf = (e) => e.t === 'C' ? 2 * Math.PI * e.r : Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
        const schnittlaenge = ents.filter(e => e.layer === 'Schnitt').reduce((s, e) => s + lenOf(e), 0);
        const name = `Ausschnitt_${num(H)}X${num(W)}_${p.cuts.length}x`;
        if (ueMax <= 0 && chains.some(ch => key(ch[0]) !== key(ch[ch.length - 1]))) warnings.push('Ohne Überlauf trennt der Schnitt an der Fliesenkante nicht sicher durch — Überlauf aktivieren.');
        return {
            ok: true, name, fileName: name + '.dxf', W, H, rects, circles, labels, warnings, ents,
            anzKonturen: circles.length + chains.length, schnittlaenge, dxf: buildDXF(ents)
        };
    }

    function ausschnittSVG(r) {
        const pad = Math.max(r.W, r.H) * 0.03, lw = Math.max(r.W, r.H) / 400;
        let s = `<svg viewBox="${-pad} ${-pad} ${r.W + 2 * pad} ${r.H + 2 * pad}" style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet"><g transform="translate(0 ${r.H}) scale(1 -1)">` +
            `<rect x="0" y="0" width="${r.W}" height="${r.H}" fill="#1a2330" stroke="#4aa3ff" stroke-width="${lw * 1.5}"/>`;
        for (const q of r.rects) s += `<rect x="${q.x0}" y="${q.y0}" width="${q.x1 - q.x0}" height="${q.y1 - q.y0}" fill="#6b4f1d" fill-opacity="0.55"/>`;
        for (const c of r.circles) s += `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="#6b4f1d" fill-opacity="0.55"/>`;
        for (const e of r.ents) {
            if (e.layer !== 'Schnitt') continue;
            if (e.t === 'C') s += `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="none" stroke="#ff5a4d" stroke-width="${lw}"/>`;
            else s += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#ff5a4d" stroke-width="${lw}"/>`;
        }
        return s + '</g></svg>';
    }

    // ════════════════════════════════════════════════════════════════
    // DIALOGE
    // ════════════════════════════════════════════════════════════════

    const FIELD_CSS = 'width:100%;padding:5px 8px;background:#2a2a2a;border:1px solid #555;border-radius:4px;color:#fff;font-size:13px;box-sizing:border-box;';
    const SMALL_CSS = 'width:100%;padding:3px 5px;background:#2a2a2a;border:1px solid #555;border-radius:3px;color:#fff;font-size:12px;box-sizing:border-box;';
    const LABEL_CSS = 'display:block;font-size:11px;color:#9aa;margin:8px 0 2px;';
    const BOX_CSS = 'background:#1e1e1e;border:1px solid #555;border-radius:8px;width:min(960px,96vw);max-height:94vh;overflow:auto;padding:18px 20px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:\'Segoe UI\',sans-serif;';
    const BTN = 'padding:6px 16px;border-radius:4px;cursor:pointer;';

    function makeOverlay(id, html, app) {
        document.getElementById(id)?.remove();
        const overlay = document.createElement('div');
        overlay.id = id;
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
        const onDocKey = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onDocKey, true);
        const close = () => {
            document.removeEventListener('keydown', onDocKey, true);
            overlay.remove();
            setTimeout(() => { const cv = app?.renderer?.canvas; if (cv) cv.style.cursor = ''; }, 0);
        };
        overlay.addEventListener('mousedown', (e) => { overlay._downOnBg = e.target === overlay; });
        overlay.addEventListener('click', (e) => { if (e.target === overlay && overlay._downOnBg) close(); });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); e.stopPropagation(); });
        overlay.addEventListener('keyup', (e) => e.stopPropagation());
        return { overlay, close, $: (sel) => overlay.querySelector('#' + sel) };
    }

    function download(name, text, type) {
        const blob = new Blob([text], { type });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }

    function openVerband(options = {}) {
        if (typeof document === 'undefined') return;
        const app = options.app || window.app;
        const opts = Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
        const { overlay, close, $ } = makeOverlay('verband-overlay', `
            <div style="${BOX_CSS}">
                <h3 style="margin:0 0 10px;font-size:15px;color:#00aaff;">Verband — Verlegemuster &amp; Randzuschnitte</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div style="flex:0 0 290px;min-width:250px;">
                        <div style="display:flex;gap:10px;"><div style="flex:1"><label style="${LABEL_CSS}">Wand Breite [mm]</label><input id="vb-w" style="${FIELD_CSS}" value="2400" inputmode="decimal"></div>
                        <div style="flex:1"><label style="${LABEL_CSS}">Wand Höhe [mm]</label><input id="vb-h" style="${FIELD_CSS}" value="2000" inputmode="decimal"></div></div>
                        <div style="display:flex;gap:10px;"><div style="flex:1"><label style="${LABEL_CSS}">Fliese horizontal [mm]</label><input id="vb-tw" style="${FIELD_CSS}" value="600" inputmode="decimal"></div>
                        <div style="flex:1"><label style="${LABEL_CSS}">Fliese vertikal [mm]</label><input id="vb-th" style="${FIELD_CSS}" value="300" inputmode="decimal"></div></div>
                        <label style="${LABEL_CSS}">Fuge [mm]</label><input id="vb-fuge" style="${FIELD_CSS}" value="3" inputmode="decimal">
                        <label style="${LABEL_CSS}">Muster</label><select id="vb-muster" style="${FIELD_CSS}">${opts}</select>
                        <label style="display:block;font-size:12px;margin-top:8px;"><input type="checkbox" id="vb-diag"> Diagonal (45°)</label>
                        <div id="vb-start">
                            <label style="${LABEL_CSS}">Start horizontal</label>
                            <select id="vb-sx" style="${FIELD_CSS}"><option value="mitte">Symmetrisch zur Wandmitte</option><option value="links">Ab linker Kante</option></select>
                            <label style="${LABEL_CSS}">Start vertikal (erste ganze Reihe)</label>
                            <select id="vb-sy" style="${FIELD_CSS}"><option value="unten">Ab Unterkante</option><option value="oben">Ab Oberkante</option><option value="mitte">Reihe in Wandmitte</option></select>
                        </div>
                    </div>
                    <div style="flex:1 1 400px;min-width:300px;display:flex;flex-direction:column;gap:10px;">
                        <div id="vb-prev" style="height:300px;background:#12161c;border:1px solid #333;border-radius:4px;padding:6px;box-sizing:border-box;"></div>
                        <div id="vb-res"></div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button id="vb-cancel" style="${BTN}background:#555;border:none;color:#ddd;">Abbrechen</button>
                    <button id="vb-csv" style="${BTN}background:#3a3a3a;border:1px solid #666;color:#ddd;">Stückliste (CSV)</button>
                    <button id="vb-save" style="${BTN}background:#3a3a3a;border:1px solid #666;color:#ddd;">DXF speichern</button>
                    <button id="vb-ok" style="${BTN}background:#00aaff;border:none;color:#000;font-weight:600;">Plan erzeugen</button>
                </div>
            </div>`, app);

        let last = null;
        function update() {
            const diag = $('vb-diag').checked;
            $('vb-start').style.display = diag ? 'none' : '';
            last = computeVerband({
                W: parseNum($('vb-w').value), H: parseNum($('vb-h').value), tw: parseNum($('vb-tw').value), th: parseNum($('vb-th').value),
                fuge: parseNum($('vb-fuge').value), muster: $('vb-muster').value, diagonal: diag,
                startX: $('vb-sx').value, startY: $('vb-sy').value
            });
            $('vb-res').innerHTML = verbandHTML(last);
            $('vb-prev').innerHTML = last.ok ? verbandSVG(last) : '';
            for (const id of ['vb-ok', 'vb-save', 'vb-csv']) { $(id).disabled = !last.ok; $(id).style.opacity = last.ok ? '1' : '0.4'; }
        }
        overlay.addEventListener('input', update);
        overlay.addEventListener('change', update);
        $('vb-cancel').addEventListener('click', close);
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && last?.ok) $('vb-ok').click(); });
        $('vb-ok').addEventListener('click', () => {
            if (!last?.ok) return;
            if (!app?.loadGeneratedDXF) { console.warn(LOG, 'app.loadDXFContent nicht verfuegbar'); return; }
            app.loadGeneratedDXF(last.fileName, last.dxf, (last.dxf.length / 1024).toFixed(1));
            app.showToast?.(`Verband: ${last.fullCount} ganze Fliesen, ${last.cutCount} Zuschnitte`, 'success');
            close();
        });
        $('vb-save').addEventListener('click', () => { if (last?.ok) app.promptSaveToServer({ defaultName: last.fileName, content: last.dxf, title: 'DXF speichern', bind: false }); });
        $('vb-csv').addEventListener('click', () => { if (last?.ok) download(last.name + '_Stueckliste.csv', '﻿' + stuecklisteCSV(last), 'text/csv'); });
        update();
        setTimeout(() => { const f = $('vb-w'); f.focus(); f.select(); }, 50);
    }

    function verbandHTML(r) {
        if (!r.ok) return `<div style="color:#ff6b6b;font-size:13px;">⚠ ${esc(r.error)}</div>`;
        let h = `<div style="font-size:15px;color:#fff;font-weight:600;margin-bottom:6px">${r.fullCount} ganze + ${r.cutCount} Zuschnitte &nbsp;<span style="font-weight:400;color:#9aa;font-size:12px">= ${r.bedarf} Fliesen (${de(r.fliesenFlaeche, 2)} m² bei ${de(r.flaeche, 2)} m² Wand)</span></div>`;
        if (r.stueckliste.length) {
            h += '<table style="font-size:12px;color:#ddd;border-collapse:collapse"><tr style="color:#9aa"><td style="padding-right:14px">Zuschnitt</td><td style="padding-right:14px">Maß [mm]</td><td>Anzahl</td></tr>';
            r.stueckliste.slice(0, 12).forEach((g, i) => {
                const m = g.rect ? `${de(Math.max(g.w, g.h))} × ${de(Math.min(g.w, g.h))}` : `${g.n}-Eck, Fläche ${de(g.area / 100, 0)} cm²`;
                h += `<tr><td style="padding-right:14px">${i + 1}</td><td style="padding-right:14px">${m}</td><td>${g.count}×</td></tr>`;
            });
            if (r.stueckliste.length > 12) h += `<tr><td colspan="3" style="color:#9aa">… ${r.stueckliste.length - 12} weitere (siehe CSV)</td></tr>`;
            h += '</table>';
        } else h += '<div style="font-size:12px;color:#4ade80">Keine Randzuschnitte — Wand geht genau auf.</div>';
        for (const w of r.warnings) h += `<div style="margin-top:6px;font-size:12px;color:#f0b429">⚠ ${esc(w)}</div>`;
        return h;
    }

    // ── AUSSCHNITT-Dialog ────────────────────────────────────────

    const CUT_TYPES = { rund: 'Loch rund', rechteck: 'Loch eckig', eck: 'Ecke', kerbe: 'Randkerbe' };
    const CUT_PRESETS = {
        steckdose: { typ: 'rund', d: 68, label: 'Steckdose Ø68' },
        steckdoseEckig: { typ: 'rechteck', w: 55, h: 55, label: 'Steckdose 55×55' },
        rohr: { typ: 'rund', d: 20, label: 'Rohr Ø20' }
    };

    function openAusschnitt(options = {}) {
        if (typeof document === 'undefined') return;
        const app = options.app || window.app;
        const refOpts = [['lu', 'links unten'], ['ru', 'rechts unten'], ['lo', 'links oben'], ['ro', 'rechts oben']]
            .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        const { overlay, close, $ } = makeOverlay('ausschnitt-overlay', `
            <div style="${BOX_CSS}">
                <h3 style="margin:0 0 10px;font-size:15px;color:#00aaff;">Ausschnitte in Fliese</h3>
                <div style="display:flex;gap:20px;flex-wrap:wrap;">
                    <div style="flex:0 0 430px;min-width:300px;">
                        <div style="display:flex;gap:10px;">
                            <div style="flex:1"><label style="${LABEL_CSS}">Fliese Länge [mm]</label><input id="au-fl" style="${FIELD_CSS}" value="600" inputmode="decimal"></div>
                            <div style="flex:1"><label style="${LABEL_CSS}">Fliese Breite [mm]</label><input id="au-fb" style="${FIELD_CSS}" value="300" inputmode="decimal"></div>
                            <div style="flex:1"><label style="${LABEL_CSS}">Maße ab Ecke</label><select id="au-ref" style="${FIELD_CSS}">${refOpts}</select></div>
                        </div>
                        <div style="font-size:11px;color:#9aa;margin-top:10px;">Ausschnitte (Position = Mittelpunkt ab Bezugsecke, hochkant dargestellt)</div>
                        <div id="au-list" style="margin-top:4px;"></div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                            <button class="au-add" data-p="steckdose" style="${BTN}padding:3px 8px;font-size:12px;background:#3a3a3a;border:1px solid #666;color:#ddd;">+ Steckdose Ø68</button>
                            <button class="au-add" data-p="steckdoseEckig" style="${BTN}padding:3px 8px;font-size:12px;background:#3a3a3a;border:1px solid #666;color:#ddd;">+ Steckdose 55×55</button>
                            <button class="au-add" data-p="rohr" style="${BTN}padding:3px 8px;font-size:12px;background:#3a3a3a;border:1px solid #666;color:#ddd;">+ Rohr</button>
                            <button class="au-add" data-p="eck" style="${BTN}padding:3px 8px;font-size:12px;background:#3a3a3a;border:1px solid #666;color:#ddd;">+ Ecke</button>
                            <button class="au-add" data-p="kerbe" style="${BTN}padding:3px 8px;font-size:12px;background:#3a3a3a;border:1px solid #666;color:#ddd;">+ Randkerbe</button>
                            <button class="au-add" data-p="rechteck" style="${BTN}padding:3px 8px;font-size:12px;background:#3a3a3a;border:1px solid #666;color:#ddd;">+ Loch eckig</button>
                        </div>
                        <label style="display:block;font-size:12px;margin-top:10px;"><input type="checkbox" id="au-ue" checked> Überlauf offener Kerben, max.
                            <input id="au-uemax" style="width:44px;padding:2px 4px;background:#2a2a2a;border:1px solid #555;border-radius:3px;color:#fff;font-size:12px;" value="5"> mm</label>
                        <label style="display:block;font-size:12px;margin-top:6px;">Mindeststeg
                            <input id="au-steg" style="width:44px;padding:2px 4px;background:#2a2a2a;border:1px solid #555;border-radius:3px;color:#fff;font-size:12px;" value="8"> mm (Warnung bei Unterschreitung)</label>
                    </div>
                    <div style="flex:1 1 300px;min-width:260px;display:flex;flex-direction:column;gap:10px;">
                        <div id="au-prev" style="height:340px;background:#12161c;border:1px solid #333;border-radius:4px;padding:6px;box-sizing:border-box;"></div>
                        <div id="au-res"></div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
                    <button id="au-cancel" style="${BTN}background:#555;border:none;color:#ddd;">Abbrechen</button>
                    <button id="au-save" style="${BTN}background:#3a3a3a;border:1px solid #666;color:#ddd;">DXF speichern</button>
                    <button id="au-ok" style="${BTN}background:#00aaff;border:none;color:#000;font-weight:600;">Erzeugen</button>
                </div>
            </div>`, app);

        const cuts = [];
        const field = (i, k, v, w = 50, title = '') => `<input data-i="${i}" data-k="${k}" title="${title}" value="${v ?? ''}" inputmode="decimal" style="${SMALL_CSS}width:${w}px;">`;
        function renderList() {
            $('au-list').innerHTML = cuts.map((c, i) => {
                let f = '';
                if (c.typ === 'rund') f = `X ${field(i, 'x', c.x)} Y ${field(i, 'y', c.y)} Ø ${field(i, 'd', c.d)}`;
                else if (c.typ === 'rechteck') f = `X ${field(i, 'x', c.x)} Y ${field(i, 'y', c.y)} B ${field(i, 'w', c.w)} H ${field(i, 'h', c.h)}`;
                else if (c.typ === 'eck') f = `<select data-i="${i}" data-k="ecke" style="${SMALL_CSS}width:92px;">${[['lu', 'links unten'], ['ru', 'rechts unten'], ['lo', 'links oben'], ['ro', 'rechts oben']].map(([k, v]) => `<option value="${k}"${c.ecke === k ? ' selected' : ''}>${v}</option>`).join('')}</select> B ${field(i, 'w', c.w)} H ${field(i, 'h', c.h)}`;
                else f = `<select data-i="${i}" data-k="kante" style="${SMALL_CSS}width:78px;">${[['u', 'unten'], ['o', 'oben'], ['l', 'links'], ['r', 'rechts']].map(([k, v]) => `<option value="${k}"${c.kante === k ? ' selected' : ''}>${v}</option>`).join('')}</select> Pos ${field(i, 'x', c.x, 46, 'Mitte entlang der Kante ab Bezugsecke')} B ${field(i, 'w', c.w, 44, 'Breite entlang der Kante')} T ${field(i, 'h', c.h, 44, 'Tiefe ins Material')}`;
                return `<div style="display:flex;align-items:center;gap:5px;font-size:12px;margin:3px 0;"><span style="width:70px;color:#9aa;">${i + 1}. ${CUT_TYPES[c.typ]}</span>${f}<button data-del="${i}" style="margin-left:auto;background:none;border:none;color:#ff6b6b;cursor:pointer;font-size:14px;">✕</button></div>`;
            }).join('') || '<div style="font-size:12px;color:#9aa;">Noch kein Ausschnitt — unten hinzufügen.</div>';
        }

        let last = null;
        function update() {
            last = computeAusschnitt({
                fl: parseNum($('au-fl').value), fb: parseNum($('au-fb').value), ref: $('au-ref').value,
                ueberlauf: $('au-ue').checked, ueberlaufMax: parseNum($('au-uemax').value), steg: parseNum($('au-steg').value),
                cuts: cuts.map(c => ({ ...c, x: parseNum(c.x), y: parseNum(c.y), w: parseNum(c.w), h: parseNum(c.h), d: parseNum(c.d) }))
            });
            if (!last.ok) {
                $('au-res').innerHTML = `<div style="color:#ff6b6b;font-size:13px;">⚠ ${esc(last.error)}</div>`;
                $('au-prev').innerHTML = '';
            } else {
                let h = `<div style="font-size:15px;color:#fff;font-weight:600;margin-bottom:6px">${last.anzKonturen} Ausschnitt${last.anzKonturen === 1 ? '' : 'e'} &nbsp;<span style="font-weight:400;color:#9aa;font-size:12px">${de(last.schnittlaenge / 1000, 2)} m Schnitt</span></div>`;
                h += `<div style="font-size:12px;color:#ddd">Datei: ${esc(last.fileName)}<br>Fliese: ${num(last.W)} × ${num(last.H)} mm (hochkant)</div>`;
                for (const w of last.warnings) h += `<div style="margin-top:6px;font-size:12px;color:#f0b429">⚠ ${esc(w)}</div>`;
                $('au-res').innerHTML = h;
                $('au-prev').innerHTML = ausschnittSVG(last);
            }
            for (const id of ['au-ok', 'au-save']) { $(id).disabled = !last.ok; $(id).style.opacity = last.ok ? '1' : '0.4'; }
        }

        function addCut(preset) {
            const W = Math.min(parseNum($('au-fl').value), parseNum($('au-fb').value)) || 300;
            const H = Math.max(parseNum($('au-fl').value), parseNum($('au-fb').value)) || 600;
            if (preset === 'eck') cuts.push({ typ: 'eck', ecke: 'lu', w: 60, h: 60 });
            else if (preset === 'kerbe') cuts.push({ typ: 'kerbe', kante: 'u', x: num(W / 2), w: 30, h: 30 });
            else if (preset === 'rechteck') cuts.push({ typ: 'rechteck', x: num(W / 2), y: num(H / 2), w: 60, h: 40 });
            else { const p = CUT_PRESETS[preset]; cuts.push({ ...p, x: num(W / 2), y: num(H / 2) }); }
            renderList(); update();
        }
        overlay.querySelectorAll('.au-add').forEach(b => b.addEventListener('click', () => addCut(b.dataset.p)));
        $('au-list').addEventListener('click', (e) => {
            const i = e.target.dataset?.del;
            if (i !== undefined) { cuts.splice(+i, 1); renderList(); update(); }
        });
        $('au-list').addEventListener('input', (e) => {
            const t = e.target;
            if (t.dataset?.k !== undefined) cuts[+t.dataset.i][t.dataset.k] = t.value;
        });
        overlay.addEventListener('input', update);
        overlay.addEventListener('change', update);
        $('au-cancel').addEventListener('click', close);
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && last?.ok) $('au-ok').click(); });
        $('au-ok').addEventListener('click', () => {
            if (!last?.ok) return;
            if (!app?.loadGeneratedDXF) { console.warn(LOG, 'app.loadDXFContent nicht verfuegbar'); return; }
            app.loadGeneratedDXF(last.fileName, last.dxf, (last.dxf.length / 1024).toFixed(1));
            app.showToast?.(`Ausschnitt: ${last.anzKonturen} Kontur(en) erzeugt`, 'success');
            close();
        });
        $('au-save').addEventListener('click', () => { if (last?.ok) app.promptSaveToServer({ defaultName: last.fileName, content: last.dxf, title: 'DXF speichern', bind: false }); });
        addCut('steckdose');
    }

    return { VERSION, computeVerband, computeAusschnitt, buildDXF, stuecklisteCSV, openVerband, openAusschnitt, PATTERNS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TileLayout;
if (typeof window !== 'undefined') window.TileLayout = TileLayout;


// ════════════════════════════════════════════════════════════════════════════
//  BEFEHLE (VERB / AUSS) — Lazy-Patch in DrawingToolManager, wie mosaic-generator
// ════════════════════════════════════════════════════════════════════════════

if (typeof BaseTool !== 'undefined' && typeof DrawingToolManager !== 'undefined') {
    class TileLayoutTool extends BaseTool {
        constructor(manager, which) { super(manager); this.which = which; }
        start() {
            if (this.which === 'V') TileLayout.openVerband({ app: this.manager.app });
            else TileLayout.openAusschnitt({ app: this.manager.app });
            this.cancel();
        }
    }
    const _origStartToolTL = DrawingToolManager.prototype.startTool;
    DrawingToolManager.prototype.startTool = function (shortcut) {
        if (!this._tileLayoutRegistered) {
            this._tileLayoutRegistered = true;
            this.tools['VERB'] = () => new TileLayoutTool(this, 'V');
            this.tools['AUSS'] = () => new TileLayoutTool(this, 'A');
        }
        return _origStartToolTL.call(this, shortcut);
    };
}
