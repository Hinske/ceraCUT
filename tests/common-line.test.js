const test = require('node:test');
const assert = require('node:assert');
const CL = require('../js/common-line.js');

const G = 0.8, W = 100, H = 60;
const grid = (nx, ny, x0 = 5, y0 = 5) => {
    const r = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++)
        r.push({ id: `r${i}${j}`, minX: x0 + i * (W + G), minY: y0 + j * (H + G), maxX: x0 + i * (W + G) + W, maxY: y0 + j * (H + G) + H });
    return r;
};
const opt = { gap: G, sheetWidth: 1000, sheetHeight: 500 };

test('2×2-Raster: 2 Durchschnitte mittig im Spalt + Rahmen, 3 statt 4 Anstiche', () => {
    const r = CL.build(grid(2, 2), opt);
    assert.strictEqual(r.groups.length, 1);
    const g = r.groups[0];
    assert.strictEqual(g.cuts.length, 2);
    const v = g.cuts.find(c => c.vertical), h = g.cuts.find(c => !c.vertical);
    assert.ok(Math.abs(v.a.x - (5 + W + G / 2)) < 1e-9 && v.a.x === v.b.x, 'vertikale Linie mittig im Spalt');
    assert.ok(Math.abs(h.a.y - (5 + H + G / 2)) < 1e-9, 'horizontale Linie mittig im Spalt');
    assert.ok(v.a.y < g.bbox.minY && v.b.y > g.bbox.maxY, 'Anstich/Austritt außerhalb des Blocks');
    assert.deepStrictEqual(g.frame[0], g.frame[4]);
    assert.strictEqual(r.stats.piercesBefore, 4); assert.strictEqual(r.stats.pierces, 3);
    assert.ok(r.stats.savedLength > 0 && r.stats.savedPierces === 1);
    assert.deepStrictEqual(r.rest, []);
});

test('3×2-Raster: 3 Schnitte (2 vertikal, 1 durchgehend horizontal) + Rahmen = 4 statt 6 Anstiche', () => {
    const r = CL.build(grid(3, 2), opt);
    assert.strictEqual(r.groups[0].cuts.length, 3);
    assert.strictEqual(r.stats.pierces, 4); assert.strictEqual(r.stats.piercesBefore, 6);
});

test('Teilschnitte enden als T-Stoß auf dem Hauptschnitt (Mittellinie) und kommen nach ihm', () => {
    // links 1 hohes Teil, rechts 2 übereinander
    const L = { id: 'L', minX: 5, minY: 5, maxX: 105, maxY: 5 + 2 * H + G };
    const R1 = { id: 'R1', minX: 105 + G, minY: 5, maxX: 105 + G + W, maxY: 5 + H };
    const R2 = { id: 'R2', minX: 105 + G, minY: 5 + H + G, maxX: 105 + G + W, maxY: 5 + 2 * H + G };
    const g = CL.build([L, R1, R2], opt).groups[0];
    assert.strictEqual(g.cuts.length, 2);
    assert.ok(g.cuts[0].vertical && !g.cuts[1].vertical, 'Hauptschnitt zuerst');
    const mid = 105 + G / 2, t = g.cuts[1];
    assert.ok(Math.abs(t.a.x - mid) < 1e-9, 'Teilschnitt beginnt auf dem Hauptschnitt');
    assert.ok(t.b.x > g.bbox.maxX, 'und endet außerhalb am Gruppenrand');
});

test('Nicht lückenlos (versetzte Reihen) → Fallback, kein Common-Line', () => {
    const a = { id: 'a', minX: 5, minY: 5, maxX: 105, maxY: 65 };
    const b = { id: 'b', minX: 105 + G, minY: 5 + 20, maxX: 205 + G, maxY: 85 };   // seitlich versetzt
    const r = CL.build([a, b], opt);
    assert.strictEqual(r.groups.length, 0);
    assert.deepStrictEqual(r.rest.sort(), ['a', 'b']);
});

test('Einzelteile, falscher Abstand und zu wenig Platz am Blechrand → Fallback', () => {
    assert.strictEqual(CL.build([grid(1, 1)[0]], opt).groups.length, 0);
    const far = grid(2, 1); far[1].minX += 3; far[1].maxX += 3;
    assert.strictEqual(CL.build(far, opt).groups.length, 0);
    assert.strictEqual(CL.build(grid(2, 2, 0.2, 0.2), opt).groups.length, 0, 'kein Platz für den Anstich im Randstreifen');
});

test('Zwei getrennte Blöcke → zwei Gruppen', () => {
    const r = CL.build([...grid(2, 1, 5, 5), ...grid(2, 1, 400, 300).map(x => ({ ...x, id: 'z' + x.id }))], opt);
    assert.strictEqual(r.groups.length, 2);
    assert.strictEqual(r.stats.savedPierces, 0, '2×1: 1 Schnitt + Rahmen = 2 Anstiche wie vorher — nur Länge gespart');
    assert.ok(r.stats.savedLength > 0);
});
