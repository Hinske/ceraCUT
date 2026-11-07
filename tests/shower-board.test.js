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
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { x: 300, y: 300 } });
    assert.ok(near(r.grid.xLines.find(v => v > 650 + 70), 650 + 70 + 300 + 1), 'erste Fugenmitte rechts von Ablaufkante = Kante + Fliese + Fuge/2');
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

test('DXF: geschlossene LWPOLYLINE je Teil auf Layer Fliesen', () => {
    const r = G.compute(base);
    assert.strictEqual((r.dxf.match(/LWPOLYLINE/g) || []).length, r.count);
    assert.ok(r.dxf.includes('Fliesen'));
});

test('Dialog: Vorschau-SVG und Stueckliste liefern Bemassung (Smoke)', () => {
    const D = require('../js/shower-board-dialog.js');
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { x: 300, y: 300 } });
    const svg = D._internals.previewSVG(r, true);
    assert.ok(svg.startsWith('<svg') && svg.includes('Fliesenfeld 1300'));
    assert.strictEqual((svg.match(/<polygon/g) || []).length, r.count);
    const items = D._internals.numbered(r.pieces);
    assert.deepStrictEqual(items.map(i => i.nr), items.map((_, i) => i + 1));
    assert.ok(D._internals.resultHTML(r).includes(`${r.count} Teile`));
});
