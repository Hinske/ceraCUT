'use strict';
// Duschboard-Generator (shower-board-generator.js V0.1): Referenz Kochhan_Duschboard_1000x1000.dxf + Invarianten
const test = require('node:test');
const assert = require('node:assert');
const G = require('../js/shower-board-generator.js');

const base = { breite: 1000, tiefe: 1000, ablauf: { w: 140, h: 140 }, gridMode: 'keins' };
const area = G._internals.area;
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
// Referenz-DXF ist auf 0,1 mm gerundet (1.4 statt 1.4142 = 1 mm senkrecht) -> Vergleich auf 0,1 mm
const key = poly => poly.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).sort().join('|');

test('Referenz Kochhan 1000x1000, Ablauf 140: vier Trapeze wie in der Schnitt-Ebene', () => {
    const r = G.compute(base);
    assert.ok(r.ok); assert.strictEqual(r.count, 4);
    const ref = [
        [[1000, 998.6], [570, 568.6], [570, 431.4], [1000, 1.4]],
        [[568.6, 430], [431.4, 430], [1.4, 0], [998.6, 0]],
        [[430, 568.6], [0, 998.6], [0, 1.4], [430, 431.4]],
        [[998.6, 1000], [1.4, 1000], [431.4, 570], [568.6, 570]]
    ].map(a => key(a.map(([x, y]) => ({ x, y }))));
    const got = r.pieces.map(p => key(p.poly));
    for (const k of ref) assert.ok(got.includes(k), 'fehlt: ' + k);
});

test('Invarianten: Teile konvex, ueberlappungsfrei, Flaeche passt (mit Raster, nicht quadratisch, aussermittig)', () => {
    for (const inp of [
        { breite: 1300, tiefe: 1000, ablauf: { w: 124, h: 124 }, gridMode: 'ablauf' },
        { breite: 1400, tiefe: 900, ablauf: { w: 150, h: 100, cx: 500, cy: 400 }, gridMode: 'ecke' },
        { breite: 997, tiefe: 997, ablauf: { w: 124, h: 124 }, gridMode: 'ablauf', fuge: 3 }
    ]) {
        const r = G.compute(inp); assert.ok(r.ok, r.error);
        for (const pc of r.pieces) {
            const a = area(pc.poly); assert.ok(a > 0, 'Umlaufsinn/Flaeche');
            for (let i = 0; i < pc.poly.length; i++) {
                const A = pc.poly[i], B = pc.poly[(i + 1) % pc.poly.length], C = pc.poly[(i + 2) % pc.poly.length];
                assert.ok((B.x - A.x) * (C.y - B.y) - (B.y - A.y) * (C.x - B.x) > -1e-6, 'nicht konvex');
            }
        }
        const total = r.pieces.reduce((s, p) => s + area(p.poly), 0);
        const field = r.p.W * r.p.H - inp.ablauf.w * inp.ablauf.h;
        assert.ok(total < field && total > field * 0.9, `Flaeche ${total} vs Feld ${field}`);
        // Mindestabstand zwischen Teilen unterschiedlicher Teile >= Fuge (Stichprobe: Eckpunkte gegen Kanten, 1e-6)
        const f = r.p.fuge;
        for (let i = 0; i < r.pieces.length; i++) for (let j = i + 1; j < r.pieces.length; j++) {
            for (const q of r.pieces[i].poly) {
                const P = r.pieces[j].poly;
                for (let k = 0; k < P.length; k++) {
                    const a = P[k], b = P[(k + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
                    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
                    assert.ok(Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy) >= f - 1e-6, `Abstand < Fuge (${i},${j})`);
                }
            }
        }
    }
});

test('Raster: Fugenmitten ab Ablaufkante, Fuge zwischen Teilen exakt Fugenbreite', () => {
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { x: 300, y: 300 }, anker: 'ablauf' });
    assert.ok(r.grid.xLines.some(v => near(v, 650 + 70 + 300 + 1)), 'Fugenmitte = Ablaufkante + Fliese + Fuge/2');
    assert.ok(r.grid.xLines.some(v => near(v, 650 - 70 - 300 - 1)), 'und gespiegelt links');
});

test('Aussenmass: Fliesenfeld = Aussenmass - 2 * Randfuge', () => {
    const r = G.compute({ ...base, masseArt: 'aussen', randfuge: 2 });
    assert.ok(near(r.p.W, 996) && near(r.p.H, 996));
});

test('Eingabefehler', () => {
    assert.strictEqual(G.compute({ ...base, breite: -5 }).ok, false);
    assert.strictEqual(G.compute({ ...base, ablauf: { w: 2000, h: 10 } }).ok, false);
    assert.strictEqual(G.compute({ ...base, ablauf: { w: 0, h: 10 } }).ok, false);
});

const ents = (dxf, type, layer) => (dxf.match(new RegExp(`\\r\\n${type}\\r\\n8\\r\\n${layer}\\r\\n`, 'g')) || []).length;

test('DXF Kochhan-Struktur: 1 Fliesenumriss, 4 Schnitte (Gehrung + Ablaufkante + Gehrung verkettet), je in der Mitte der Ablaufkante gebrochen', () => {
    const r = G.compute(base);   // keins: eine Platte, 4 Gehrungsteile (wie Kochhan_Duschboard_1000x1000.dxf)
    assert.strictEqual(ents(r.dxf, 'LWPOLYLINE', 'Fliesen'), 1);
    assert.ok(/2\r\nFliesen\r\n70\r\n0\r\n62\r\n160/.test(r.dxf) && /2\r\nSchnitt\r\n70\r\n0\r\n62\r\n10/.test(r.dxf), 'Layer-Tabelle mit Farben');
    assert.deepStrictEqual(r.tiles[0].map(q => [q.x, q.y]), [[0, 0], [1000, 0], [1000, 1000], [0, 1000]]);
    assert.strictEqual(r.cuts.length, 4, 'ein Schnitt je Gehrungsteil — die Plattenkante wird nicht nochmal geschnitten');
    const right = r.cuts.find(c => Math.abs(c.chain.pts[0].x - 1000) < 1e-6 && c.chain.pts[0].y > 500);
    assert.deepStrictEqual(right.chain.pts.map(q => [+q.x.toFixed(2), +q.y.toFixed(2)]), [[1000, 998.59], [570, 568.59], [570, 431.41], [1000, 1.41]]);
    assert.strictEqual(right.parts.length, 2, 'Overlap Break: zwei Teile');
    // Bruch in der Mitte der Schneidkontur = Mitte der Ablaufkante (570, 500); aussen -> innen
    const onPath = (part, x, y) => part.some((q, i) => i && Math.abs((q.x - part[i - 1].x) * (y - part[i - 1].y) - (q.y - part[i - 1].y) * (x - part[i - 1].x)) < 1e-6 && x >= Math.min(q.x, part[i - 1].x) - 1e-6 && x <= Math.max(q.x, part[i - 1].x) + 1e-6 && y >= Math.min(q.y, part[i - 1].y) - 1e-6 && y <= Math.max(q.y, part[i - 1].y) + 1e-6);
    for (const part of right.parts) assert.ok(onPath(part, 570, 500), 'Teil laeuft bis zum Bruchpunkt in der Mitte der Ablaufkante (570, 500)');
    assert.ok(Math.abs(right.parts[0][0].x - 1003.5355) < 0.01, 'Aussenverlaengerung 5 mm am freien Ende');
    assert.strictEqual(r.cutCount, 8);
    assert.strictEqual(ents(r.dxf, 'LWPOLYLINE', 'Schnitt'), 8, 'alle Schnitte als offene Polylinien (Ketten)');
});

test('DXF Schnitte: nur echte Schnittkanten (keine Kante auf der Fliesenkante), Ketten luecken- und doppelungsfrei', () => {
    for (const inp of [
        { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } },
        { breite: 1400, tiefe: 900, ablauf: { w: 150, h: 100, cx: 500, cy: 400 }, fliese: { lang: 600, kurz: 300 }, muster: 'verband', anker: 'lu' },
        { breite: 3000, tiefe: 2400, ablauf: { w: 200, h: 200 }, fliese: { lang: 597, kurz: 597 } },
        { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 600, kurz: 300 }, muster: 'fischgraet' }
    ]) {
        const r = G.compute(inp), { onOutline } = G._internals;
        for (const pc of r.pieces) {
            if (pc.full) continue;   // ganze Fliese: nichts zu schneiden
            const T = r.tiles[pc.tile], n = pc.poly.length;
            const cutsOfPiece = r.cuts.filter(c => c.tile === pc.tile).flatMap(c => c.chain.pts.slice(1).map((q, i) => [c.chain.pts[i], q]));
            let edgesOnOutline = 0, edgesCut = 0;
            for (let i = 0; i < n; i++) {
                const a = pc.poly[i], b = pc.poly[(i + 1) % n], on = onOutline(a, b, T);
                const inChain = cutsOfPiece.some(([c, d]) => (Math.hypot(a.x - c.x, a.y - c.y) < 1e-6 && Math.hypot(b.x - d.x, b.y - d.y) < 1e-6));
                if (on) { edgesOnOutline++; assert.ok(!inChain, 'Kante auf der Fliesenkante darf nicht geschnitten werden'); }
                else { edgesCut++; assert.ok(inChain, 'Schnittkante fehlt in einer Kette'); }
            }
            assert.strictEqual(edgesOnOutline + edgesCut, n);
        }
        assert.strictEqual(ents(r.dxf, 'LWPOLYLINE', 'Fliesen'), r.tilesUsed);
        assert.strictEqual(ents(r.dxf, 'LINE', 'Schnitt') + ents(r.dxf, 'LWPOLYLINE', 'Schnitt'), r.cutCount);
        for (const c of r.cuts) for (const part of c.parts) {
            const q = part[0], T = r.tiles[c.tile];
            assert.ok(part.length >= 2);
            assert.ok(!c.chain.closed || part.length >= 3);
        }
    }
});

test('DXF: jeder Zuschnitt liegt in seinem Fliesenumriss, Umriss = ganze Fliese', () => {
    for (const inp of [
        { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } },
        { breite: 1400, tiefe: 900, ablauf: { w: 150, h: 100, cx: 500, cy: 400 }, fliese: { lang: 600, kurz: 300 }, muster: 'verband', anker: 'lu' },
        { breite: 3000, tiefe: 2400, ablauf: { w: 200, h: 200 }, fliese: { lang: 597, kurz: 597 } },
        { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 600, kurz: 300 }, muster: 'fischgraet' },
        { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 }, drehung: 45 }
    ]) {
        const r = G.compute(inp), p = r.p;
        for (const pc of r.pieces) {
            const T = r.tiles[pc.tile], tb = G._internals.bboxOf(T), pb = G._internals.bboxOf(pc.poly);
            assert.ok(pb.x0 >= tb.x0 - 1e-6 && pb.x1 <= tb.x1 + 1e-6 && pb.y0 >= tb.y0 - 1e-6 && pb.y1 <= tb.y1 + 1e-6, 'Teil liegt nicht in seiner Fliese');
            if (inp.muster !== 'verband') assert.ok(Math.abs(Math.abs(G._internals.area(T)) - p.tx * p.ty) < 0.5, 'Fliesenumriss = ganze Fliese');
        }
    }
});

test('Overlap Break: jeder Schnitt wird mit GeometryOps.splitAndOverlap in der Mitte gebrochen (aussen->innen, 5 mm Ueberlappung, 5 mm aussen)', () => {
    const GO = require('../js/geometry-ops.js');
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } });
    const { pathLength, midPoint, dropCollinear } = G._internals;
    let long = 0;
    for (const c of r.cuts) {
        const len = pathLength(c.chain.pts);
        if (len < 20) { assert.strictEqual(c.parts.length, 1); continue; }
        long++;
        const m = midPoint(c.chain.pts);
        const expect = GO.splitAndOverlap(c.chain.pts.map(q => ({ ...q })), false, m.segmentIndex, m.point, 5, null, 5).map(p => dropCollinear(p));
        assert.deepStrictEqual(c.parts, expect, 'identisch zum Werkzeug OB');
        const [l0, l1] = c.parts.map(pathLength);
        assert.ok(Math.abs(l0 + l1 - (len + 15)) < 1e-6, 'Summe = Schnittlaenge + 2 x 5 aussen + 5 Ueberlappung');
        assert.ok(Math.abs(Math.abs(l0 - l1) - 5) < 1e-6 || Math.abs(Math.abs(l0 - l1)) < 1e-6 + 5, 'beide Haelften gleich lang bis auf die Ueberlappung');
        // beide Teile enden in der Naehe des Bruchpunkts (kurze Seite 5 mm dahinter)
        for (const part of c.parts) assert.ok(Math.hypot(part[part.length - 1].x - m.point.x, part[part.length - 1].y - m.point.y) <= 5 + 1e-6);
    }
    assert.ok(long > 5);
});

test('Overlap Break: Einstellungen (aus, Ueberlappung, Aussenverlaengerung) und gerade Schnitte als Einzellinie (2 Punkte)', () => {
    const inp = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } };
    const off = G.compute({ ...inp, overlapBreak: false });
    assert.ok(off.cuts.every(c => c.parts.length === 1), 'ohne OB: ein Teil je Schnitt');
    const on = G.compute({ ...inp, obOverlap: 8, obOuter: 0 });
    for (const c of on.cuts) if (c.parts.length === 2) {
        const [l0, l1] = c.parts.map(G._internals.pathLength);
        assert.ok(Math.abs(l0 + l1 - (G._internals.pathLength(c.chain.pts) + 8)) < 1e-6, 'nur 8 mm Ueberlappung, keine Aussenverlaengerung');
    }
    const straight = G.compute(inp).cuts.filter(c => c.chain.pts.length === 2 && c.parts.length === 2);
    assert.ok(straight.length > 0 && straight.every(c => c.parts.every(p => p.length === 2)), 'gerade Schnitte: Einzellinien');
    assert.strictEqual(G.compute({ ...inp, obOverlap: -1 }).ok, false);
});

test('DXF: ceraCUT-Parser liest Fliesen = geschlossene Umrisse, Schnitt = offene Linien (Einzellinie bzw. Kette)', () => {
    const P = require('../js/dxf-parser.js'), D = P.DXFParser || P;
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } });
    const log = console.log; console.log = () => {};
    let res; try { res = D.parse(r.dxf); } finally { console.log = log; }
    const cs = res.contours || res.entities || [];
    const fl = cs.filter(c => c.layer === 'Fliesen'), sc = cs.filter(c => c.layer === 'Schnitt');
    assert.strictEqual(fl.length, r.tilesUsed); assert.ok(fl.every(c => c.isClosed));
    assert.ok(sc.length > 0 && sc.every(c => !c.isClosed), 'Schnitte sind offene Konturen');
    assert.strictEqual(sc.length, r.cutCount);
});

test('Dialog: Vorschau-SVG und Stueckliste liefern Bemassung (Smoke)', () => {
    const D = require('../js/shower-board-dialog.js');
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { x: 300, y: 300 }, anker: 'ablauf' });
    const svg = D._internals.previewSVG(r, true);
    assert.ok(svg.startsWith('<svg') && svg.includes('Fliesenfeld 1300'));
    assert.strictEqual((svg.match(/<polygon/g) || []).length, r.count);
    const items = D._internals.numbered(r.pieces);
    assert.deepStrictEqual(items.map(i => i.nr), items.map((_, i) => i + 1));
    assert.ok(D._internals.statusHTML(r).includes(`${r.count} Teile`));
});

// ── Verlegemuster ────────────────────────────────────────────────────────────
const dist = (q, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
    return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
};
function checkInvariants(r, label) {
    assert.ok(r.ok, `${label}: ${r.error}`);
    for (const pc of r.pieces) {
        assert.ok(area(pc.poly) > 0, `${label}: Umlaufsinn`);
        for (let i = 0; i < pc.poly.length; i++) {
            const A = pc.poly[i], B = pc.poly[(i + 1) % pc.poly.length], C = pc.poly[(i + 2) % pc.poly.length];
            assert.ok((B.x - A.x) * (C.y - B.y) - (B.y - A.y) * (C.x - B.x) > -1e-6, `${label}: nicht konvex`);
        }
        for (const q of pc.poly) assert.ok(q.x > -1e-6 && q.y > -1e-6 && q.x < r.p.W + 1e-6 && q.y < r.p.H + 1e-6, `${label}: ausserhalb Feld`);
    }
    const f = r.p.fuge;
    for (let i = 0; i < r.pieces.length; i++) for (let j = i + 1; j < r.pieces.length; j++) {
        const A = r.pieces[i].poly, B = r.pieces[j].poly;
        for (const [P, Q] of [[A, B], [B, A]]) for (const q of P) for (let k = 0; k < Q.length; k++)
            assert.ok(dist(q, Q[k], Q[(k + 1) % Q.length]) >= f - 1e-6, `${label}: Abstand < Fuge (${i},${j})`);
    }
    const total = r.pieces.reduce((s, p) => s + area(p.poly), 0);
    const field = r.p.W * r.p.H - (r.p.drain.x1 - r.p.drain.x0) * (r.p.drain.y1 - r.p.drain.y0);
    assert.ok(total < field && total > field * 0.85, `${label}: Flaeche ${total.toFixed(0)} vs ${field.toFixed(0)}`);
}

test('Muster: alle Verlegemuster/Anker/Ausrichtungen/Drehungen erfuellen die Invarianten', () => {
    const b = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 300, kurz: 150 } };
    const cases = [
        ['kreuz', {}], ['kreuz vertikal', { ausrichtung: 'vertikal' }], ['kreuz ru', { anker: 'ru' }], ['kreuz mitte', { anker: 'mitte' }],
        ['kreuz fuge', { anker: 'fuge' }], ['kreuz 45', { drehung: 45 }],
        ['halbverband', { muster: 'verband', versatz: 0.5 }], ['drittel', { muster: 'verband', versatz: 1 / 3 }],
        ['viertel', { muster: 'verband', versatz: 0.25 }], ['frei wechsel', { muster: 'verband', versatz: 0.3, versatzFolge: 'wechsel' }],
        ['verband spalten', { muster: 'verband', verbandAchse: 'spalten' }], ['verband gegenlaeufig', { muster: 'verband', versatz: 1 / 3, gegenlaeufig: true, startVersetzt: true }],
        ['verband 45', { muster: 'verband', drehung: 45 }], ['zufall', { muster: 'zufall', seed: 7 }],
        ['fischgraet', { muster: 'fischgraet' }], ['fischgraet gespiegelt', { muster: 'fischgraet', gegenlaeufig: true }],
        ['fischgraet vertikal', { muster: 'fischgraet', ausrichtung: 'vertikal' }], ['fischgraet 45', { muster: 'fischgraet', drehung: 45 }],
        ['korb', { muster: 'korb' }], ['korb ru', { muster: 'korb', anker: 'ru' }]
    ];
    for (const [label, extra] of cases) checkInvariants(G.compute({ ...b, ...extra }), label);
});

test('Muster: Halbverband versetzt die Reihen um die halbe Fliese (Stossfugen springen)', () => {
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 300, kurz: 150 }, muster: 'verband', versatz: 0.5, anker: 'lu' });
    const rows = new Map();
    for (const pc of r.pieces.filter(q => q.sector === 'rechts')) {
        const bb = G._internals.bboxOf(pc.poly), y = Math.round(bb.y0 / 10);
        if (bb.x1 - bb.x0 > 100 && bb.x0 > 700) (rows.get(y) || rows.set(y, []).get(y)).push(bb.x0);
    }
    assert.ok(rows.size > 2);
});

test('Muster: Korbgeflecht lehnt unpassendes Seitenverhaeltnis ab, Zufall ist reproduzierbar', () => {
    const b = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 } };
    assert.strictEqual(G.compute({ ...b, fliese: { lang: 500, kurz: 300 }, muster: 'korb' }).ok, false);
    const a = G.compute({ ...b, muster: 'zufall', seed: 3 }), c = G.compute({ ...b, muster: 'zufall', seed: 3 }), d = G.compute({ ...b, muster: 'zufall', seed: 4 });
    assert.strictEqual(a.dxf, c.dxf); assert.notStrictEqual(a.dxf, d.dxf);
});

test('Muster: Fliesenformat-Ausrichtung horizontal/vertikal vertauscht die Raster', () => {
    const b = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 600, kurz: 300 }, anker: 'lu' };
    const h = G.compute({ ...b, ausrichtung: 'horizontal' }), v = G.compute({ ...b, ausrichtung: 'vertikal' });
    assert.ok(near(h.grid.xLines[0], 601) && near(h.grid.yLines[0], 301));
    assert.ok(near(v.grid.xLines[0], 301) && near(v.grid.yLines[0], 601));
});

// ── Fugen-Layout (Phase 2c) ──────────────────────────────────────────────────
const r2 = v => (Math.round(v * 100) / 100 || 0);   // -0 vermeiden
const pieceKeys = pieces => pieces.map(pc => pc.poly.map(q => `${r2(q.x)},${r2(q.y)}`).sort().join('|')).sort();
const baseIn = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 300, kurz: 150 } };

test('Layout: Fugen-Layout liefert dieselben Teile wie das allgemeine Muster-Modell (Kreuz, Verbaende, Zufall, Spalten)', () => {
    const cases = [{ anker: 'ru' }, { anker: 'lu' }, { anker: 'ro' }, { ausrichtung: 'vertikal', anker: 'lo' }, { muster: 'verband', versatz: 1 / 3 }, { muster: 'verband', versatz: 0.5, anker: 'mitte' },
        { muster: 'verband', verbandAchse: 'spalten', versatz: 0.25, gegenlaeufig: true }, { muster: 'verband', versatzFolge: 'wechsel', versatz: 0.3, startVersetzt: true }, { muster: 'zufall', seed: 5 }, { muster: 'zufall', seed: 5, verbandAchse: 'spalten', anker: 'fuge' }];
    for (const extra of cases) {
        const r = G.compute({ ...baseIn, ...extra });
        assert.ok(r.ok && r.editable, JSON.stringify(extra));
        const p = r.p;
        const viaPattern = G.clipPieces(p, G._internals.tilesFromPattern(p).tiles);
        assert.deepStrictEqual(pieceKeys(r.pieces), pieceKeys(viaPattern), JSON.stringify(extra));
    }
});

test('Layout: Fischgraet/Korb/Drehung sind nicht editierbar, Kreuzfuge/Verband schon', () => {
    assert.strictEqual(G.compute({ ...baseIn, muster: 'fischgraet' }).editable, false);
    assert.strictEqual(G.compute({ ...baseIn, drehung: 45 }).editable, false);
    assert.strictEqual(G.compute({ ...baseIn, muster: 'verband' }).editable, true);
});

test('Layout: Linie ziehen (Kreuzfuge gekoppelt), clamp an Nachbar und Feldkante', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' }), L = r.layout, p = r.p;
    const moved = G.moveSub(p, L, 1, 0, 400);
    assert.ok(moved.sub.every(a => near(a[0], 400)), 'gekoppelt: alle Reihen');
    const clamped = G.moveSub(p, L, 0, 0, L.sub[0][1] + 500);
    assert.ok(clamped.sub[0][0] < L.sub[0][1], 'darf Nachbar nicht ueberholen');
    assert.ok(G.moveLine(p, L, 0, -50).lines[0] >= 1, 'nicht ueber die Feldkante');
    const r2 = G.compute({ ...baseIn, anker: 'lu' }, moved);
    checkInvariants(r2, 'nach Ziehen');
    assert.ok(r2.pieces.some(pc => { const b = G._internals.bboxOf(pc.poly); return near(b.x1, 400 - 1, 1e-6) || near(b.x0, 400 + 1, 1e-6); }));
});

test('Layout: Verband — Fuge in einer Reihe verschieben beeinflusst nur diese Reihe', () => {
    const r = G.compute({ ...baseIn, muster: 'verband', versatz: 0.5, anker: 'lu' }), L = r.layout, p = r.p;
    assert.strictEqual(L.coupled, false);
    const m = G.moveSub(p, L, 2, 0, L.sub[2][0] + 20);
    assert.ok(near(m.sub[2][0], L.sub[2][0] + 20));
    assert.ok(m.sub.every((a, k) => k === 2 || a.every((v, i) => near(v, L.sub[k][i]))));
    checkInvariants(G.compute({ ...baseIn, muster: 'verband', versatz: 0.5, anker: 'lu' }, m), 'Verband editiert');
});

test('Layout: Fuge setzen (Kreuzfuge: in allen Reihen, ausserhalb ignoriert)', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' }), L = r.layout, p = r.p;
    const a = G.addLine(p, L, 500);
    assert.strictEqual(a.lines.length, L.lines.length + 1);
    assert.strictEqual(a.sub.length, L.sub.length + 1);
    const c = G.addSub(p, L, 1, 333);
    assert.ok(c.sub.every(arr => arr.includes(333)), 'gekoppelt: in allen Reihen');
    assert.strictEqual(G.addLine(p, L, -5).lines.length, L.lines.length, 'ausserhalb ignoriert');
    checkInvariants(G.compute({ ...baseIn, anker: 'lu' }, a), 'nach Fuge setzen');
    assert.strictEqual(G.removeLine, undefined, 'Fuge-loeschen wurde entfernt');
});

test('Layout: jointSegments liefert Fugen als Strecken', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' });
    const segs = G.jointSegments(r.p, r.layout);
    const nLines = r.layout.lines.length, nSub = r.layout.sub.reduce((s, a) => s + a.length, 0);
    assert.strictEqual(segs.length, nLines + nSub);
    const h = segs.find(s => s.kind === 'line');
    assert.ok(h.x0 === 0 && h.x1 === r.p.W && h.y0 === h.y1);
});

test('Layout: altes Format {xLines,yLines} wird weiter akzeptiert', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' }, { xLines: [400], yLines: [300, 600] });
    assert.ok(r.ok && r.layout.lines.length === 2 && r.layout.sub.length === 3);
});

test('Dialog: Bearbeitungsansicht zeichnet Fugenmitten und markiert die angefasste Fuge', () => {
    global.ShowerBoardGenerator = G;
    const D = require('../js/shower-board-dialog.js');
    const r = G.compute({ ...baseIn, muster: 'verband', anker: 'lu' });
    const plain = D._internals.previewSVG(r, true);
    const edit = D._internals.previewSVG(r, true, null, null, { mode: 'move', hover: { kind: 'sub', strip: 1, idx: 0 }, sel: 1 });
    assert.ok(!plain.includes('stroke-dasharray="5 4"'));
    assert.ok(edit.includes('stroke-dasharray="5 4"') && edit.includes('#ff9d00') && edit.includes('X = '));
    assert.ok(D._internals.statusHTML(r, true).includes('Fugenbild angepasst'));
    delete global.ShowerBoardGenerator;
});

test('Raster ab Ablaufkante: kein Teil ist groesser als die Fliese (Regression: 900-mm-Teile bei 600x300)', () => {
    for (const [b, t, dw, dh] of [[1300, 1000, 140, 140], [1200, 900, 124, 124], [1000, 1000, 140, 140], [1600, 1000, 200, 120], [900, 900, 124, 124], [1670, 875, 150, 150], [1400, 1200, 300, 100]]) {
        for (const ausrichtung of ['horizontal', 'vertikal']) {
            const r = G.compute({ breite: b, tiefe: t, ablauf: { w: dw, h: dh }, fliese: { lang: 600, kurz: 300 }, ausrichtung });
            assert.ok(r.ok, r.error);
            for (const pc of r.pieces) {
                const bb = G._internals.bboxOf(pc.poly);
                assert.ok(pc.fit.ok, `${b}x${t} ${ausrichtung}: Teil ${(bb.x1 - bb.x0).toFixed(0)}x${(bb.y1 - bb.y0).toFixed(0)} passt nicht auf die Fliese`);
                const [w, h] = ausrichtung === 'horizontal' ? [600, 300] : [300, 600];
                assert.ok(bb.x1 - bb.x0 <= w + 0.5 && bb.y1 - bb.y0 <= h + 0.5, `${b}x${t} ${ausrichtung}: Teil ${(bb.x1 - bb.x0).toFixed(0)}x${(bb.y1 - bb.y0).toFixed(0)} ueberschreitet Fliesenzelle ${w}x${h}`);
            }
            assert.ok(!r.warnings.some(w => w.type === 'fit'));
        }
    }
});

// ── Passpruefung Teil -> Fliese ──────────────────────────────────────────────
const poly = pts => pts.map(([x, y]) => ({ x, y }));
const rotPoly = (pts, deg) => { const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180); return pts.map(([x, y]) => ({ x: x * c - y * s, y: x * s + y * c })); };

test('Passpruefung: ganze Fliese passt, 1 mm zu gross nicht (beide Lagen)', () => {
    const { fitInfo } = G._internals;
    assert.ok(fitInfo(poly([[0, 0], [600, 0], [600, 300], [0, 300]]), 600, 300).ok);
    assert.ok(fitInfo(poly([[0, 0], [300, 0], [300, 600], [0, 600]]), 600, 300).ok, 'hochkant');
    assert.ok(!fitInfo(poly([[0, 0], [601, 0], [601, 300], [0, 300]]), 600, 300).ok);
    assert.ok(!fitInfo(poly([[0, 0], [300, 0], [300, 301], [0, 301]]), 300, 300).ok, 'Quadrat 300x301 auf 300x300');
});

test('Passpruefung: laengste Kante (Diagonale) zaehlt — schlankes Teil passt nur gedreht in die Fliesendiagonale', () => {
    const { fitInfo } = G._internals;
    const sliver = len => rotPoly([[0, 0], [len, 0], [len, 10], [0, 10]], 0);
    assert.ok(fitInfo(sliver(640), 600, 300).ok, '640x10 passt entlang der Diagonale (achsparallel waere es zu lang)');
    assert.ok(fitInfo(sliver(660), 600, 300).ok, '660x10 passt gedreht (ca. 26 Grad) gerade noch');
    assert.ok(!fitInfo(sliver(670), 600, 300).ok, '670x10 passt nicht mehr (Fliesendiagonale 670, Teil hat Breite)');
    assert.ok(!fitInfo(sliver(700), 600, 300).ok, 'laenger als die Fliesendiagonale');
    // gleiches Teil gedreht eingebaut (Lage im Board egal)
    assert.ok(fitInfo(rotPoly([[0, 0], [640, 0], [640, 10], [0, 10]], 37), 600, 300).ok);
    // Dreieck mit Gehrung: Hypotenuse 640 > 600, Bounding-Box 590 x 230 passt achsparallel
    const tri = poly([[0, 0], [590, 0], [590, 230]]);
    const fi = fitInfo(tri, 600, 300);
    assert.ok(fi.ok && fi.a < 640);
    // Bedarf = kleinste Box
    assert.ok(Math.abs(fitInfo(poly([[0, 0], [500, 0], [500, 100], [0, 100]]), 600, 300).a - 500) < 1e-6);
});

test('Passpruefung: Fugen von Hand zu weit auseinander -> Teile passen nicht, Warnung enthaelt Mass; Randabstand wirkt', () => {
    const r0 = G.compute({ ...baseIn, anker: 'lu' });
    assert.ok(r0.ok && !r0.warnings.some(w => w.type === 'fit'));
    const moved = G.moveSub(r0.p, r0.layout, 1, 0, 340);
    const r1 = G.compute({ ...baseIn, anker: 'lu' }, moved);
    const w = r1.warnings.filter(x => x.type === 'fit');
    assert.ok(w.length > 0 && /passt nicht auf die Fliese 300×150/.test(w[0].text));
    assert.ok(r1.pieces.some(pc => !pc.fit.ok) && r1.pieces.every(pc => pc.fit && typeof pc.fit.a === 'number'));
    // Randabstand 5 mm: ganze Fliesen (300x150) passen nicht mehr in 290x140
    const r2 = G.compute({ ...baseIn, anker: 'lu', fliesenRand: 5 });
    assert.ok(r2.warnings.some(x => x.type === 'fit'));
    assert.strictEqual(G.compute({ ...baseIn, fliesenRand: -1 }).ok, false);
});

test('Dialog: Statuszeile nennt nicht passende Teile mit Nummer und Mass', () => {
    global.ShowerBoardGenerator = G;
    const D = require('../js/shower-board-dialog.js');
    const r0 = G.compute({ ...baseIn, anker: 'lu' });
    const r1 = G.compute({ ...baseIn, anker: 'lu' }, G.moveSub(r0.p, r0.layout, 1, 0, 340));
    const html = D._internals.statusHTML(r1, true);
    assert.ok(/passen nicht auf die Fliese 300×150: Nr\. \d+/.test(html), html);
    assert.ok(D._internals.previewSVG(r1, true).includes('rgba(255,60,60,0.45)'));
    delete global.ShowerBoardGenerator;
});

// ── Automatische Rasterlage (V0.4) ───────────────────────────────────────────
test('Auto-Raster: Standardfliese 597x597, Automatik erfuellt die Invarianten und braucht nie mehr Fliesen als feste Anker', () => {
    assert.deepStrictEqual(G.DEFAULTS.fliese, { lang: 597, kurz: 597 });
    assert.strictEqual(G.DEFAULTS.anker, 'auto');
    for (const [b, t, dw, dh] of [[1300, 1000, 140, 140], [900, 900, 124, 124], [1200, 900, 140, 140], [1670, 875, 150, 150], [1400, 1200, 300, 100], [2000, 1500, 140, 140]]) {
        const base = { breite: b, tiefe: t, ablauf: { w: dw, h: dh }, fliese: { lang: 597, kurz: 597 } };
        const a = G.compute(base);
        checkInvariants(a, `auto ${b}x${t}`);
        assert.ok(a.autoInfo && a.tilesUsed > 0 && a.tilesUsed === a.full + a.cutTiles);
        assert.ok(!a.warnings.some(w => w.type === 'fit'), `${b}x${t}: Teil passt nicht auf Fliese`);
        const narrowAuto = a.warnings.filter(w => w.type === 'narrow').length;
        for (const anker of ['ablauf', 'lu', 'ru', 'mitte', 'fuge']) {
            const o = G.compute({ ...base, anker });
            const narrowO = o.warnings.filter(w => w.type === 'narrow').length;
            if (narrowO <= narrowAuto) assert.ok(a.tilesUsed - a.full * 0.2 <= o.tilesUsed + 0.01 || a.full >= o.full, `${b}x${t}: Auto schlechter als ${anker} (${a.tilesUsed}F/${a.full}g vs ${o.tilesUsed}F/${o.full}g)`);
            assert.ok(narrowAuto <= narrowO || a.tilesUsed <= o.tilesUsed, `${b}x${t}: Auto hat mehr schmale Reste als ${anker}`);
        }
    }
});

test('Auto-Raster: grosses Board erhaelt ganze Fliesen und hat weniger schmale Reste als eine feste Ecklage', () => {
    const base = { breite: 3000, tiefe: 2400, ablauf: { w: 200, h: 200 }, fliese: { lang: 597, kurz: 597 } };
    const a = G.compute(base), l = G.compute({ ...base, anker: 'lu' });
    assert.ok(a.full >= 4, `ganze Fliesen: ${a.full}`);
    assert.ok(a.warnings.length < l.warnings.length, 'Automatik vermeidet die schmalen Reste, die die Ecke-links-unten-Lage hat');
    assert.ok(a.tilesUsed <= l.tilesUsed);
});

test('Auto-Raster: mit editiertem Layout laeuft keine Suche (Lage bleibt wie uebergeben)', () => {
    const base = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } };
    const a = G.compute(base);
    const b = G.compute(base, a.layout);
    assert.strictEqual(b.autoInfo, null);
    assert.deepStrictEqual(pieceKeys(b.pieces), pieceKeys(a.pieces));
});
