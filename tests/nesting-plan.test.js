const test = require('node:test');
const assert = require('node:assert');
global.NestingEngine = require('../js/nesting.js');
const { NestingPlan } = require('../js/nesting-plan.js');

const quiet = fn => { const l = console.log, w = console.warn, d = console.debug; console.log = console.warn = console.debug = () => {};
    try { return fn(); } finally { console.log = l; console.warn = w; console.debug = d; } };

const rectPart = (id, w, h, extra = {}) => ({
    partId: id, name: id, revision: 1, technologyRef: { machineId: 'cj1', materialId: 21, thickness: 10 },
    geometry: { contours: [
        { id: 'c1', role: 'disc', closed: true, points: [[0, 0], [w, 0], [w, h], [0, h]] },
        { id: 'c2', role: 'hole', closed: true, points: [[w * .4, h * .4], [w * .6, h * .4], [w * .6, h * .6], [w * .4, h * .6]] }],
        bbox: { w, l: h } }, ...extra });
const cfg = { width: 1000, length: 500, partToPart: 3, partToEdge: 5 };
const bb = pts => ({ minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)), minY: Math.min(...pts.map(p => p.y)), maxY: Math.max(...pts.map(p => p.y)) });

test('Stückzahlen, Abstände, Rand werden eingehalten', () => {
    const parts = { A: rectPart('A', 100, 60), B: rectPart('B', 50, 50) };
    const { plan, errors } = quiet(() => NestingPlan.run([{ partId: 'A', qty: 10 }, { partId: 'B', qty: 7, angles: 'none' }], parts, cfg));
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(plan.stats.nested, 17);
    assert.deepStrictEqual(plan.stats.nestedByPart, { A: 10, B: 7 });
    assert.strictEqual(plan.sheet.sheetId, null);
    assert.strictEqual(plan.materialId, 21); assert.strictEqual(plan.thickness, 10);
    // Außenkonturen: innerhalb Rand, ohne Überlappung (bbox mit Abstand)
    const boxes = plan.instances.map(i => bb(NestingPlan.placePart(parts[i.partId], i.rot, i.tx, i.ty)[0].points));
    for (const b of boxes) {
        assert.ok(b.minX >= 5 - 1e-6 && b.minY >= 5 - 1e-6 && b.maxX <= 995 + 1e-6 && b.maxY <= 495 + 1e-6);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        const gapX = Math.max(a.minX - b.maxX, b.minX - a.maxX), gapY = Math.max(a.minY - b.maxY, b.minY - a.maxY);
        assert.ok(Math.max(gapX, gapY) >= 3 - 1e-6, `Abstand ${i}/${j}`);
    }
});

test('placePart entspricht der Engine-Platzierung (Rotation 90°)', () => {
    const parts = { A: rectPart('A', 200, 40) };
    const { plan } = quiet(() => NestingPlan.run([{ partId: 'A', qty: 1, angles: 'r90' }], parts, { ...cfg, width: 100, length: 400 }));
    const i = plan.instances[0];
    assert.strictEqual(i.rot % 180, 90);
    const b = bb(NestingPlan.placePart(parts.A, i.rot, i.tx, i.ty)[0].points);
    assert.ok(Math.abs((b.maxX - b.minX) - 40) < 1e-6 && Math.abs((b.maxY - b.minY) - 200) < 1e-6);
    // Loch wandert mit
    const cs = NestingPlan.placePart(parts.A, i.rot, i.tx, i.ty);
    const hb = bb(cs[1].points);
    assert.ok(hb.minX > b.minX && hb.maxX < b.maxX && hb.minY > b.minY && hb.maxY < b.maxY);
});

test('Priorität, mehrere Bleche, nicht passende Teile', () => {
    const parts = { S: rectPart('S', 400, 400), T: rectPart('T', 600, 600) };
    const r = quiet(() => NestingPlan.run([{ partId: 'S', qty: 3, priority: 'low' }, { partId: 'T', qty: 1, priority: 'high' }], parts, { ...cfg, width: 650, length: 650, maxSheets: 2 }));
    assert.strictEqual(r.plan.instances[0].partId, 'T');                    // hohe Priorität zuerst
    assert.strictEqual(r.plan.stats.sheets, 2);
    assert.strictEqual(r.plan.stats.unplaced, 2);                           // 3×S passt je nur 1 pro Blech → 1 auf Blech 2, 2 offen
    assert.strictEqual(r.plan.stats.unplacedByPart.S, 2);
    const r2 = quiet(() => NestingPlan.run([{ partId: 'T', qty: 1 }], parts, { ...cfg, width: 300, length: 300 }));
    assert.strictEqual(r2.plan.stats.nested, 0);
});

test('Fehlerfälle: kein Teil, Blech 0, gemischtes Material', () => {
    const parts = { A: rectPart('A', 10, 10), B: rectPart('B', 10, 10, { technologyRef: { machineId: 'cj1', materialId: 5, thickness: 8 } }) };
    assert.throws(() => NestingPlan.run([{ partId: 'A', qty: 0 }], parts, cfg), /Stückzahl/);
    assert.throws(() => NestingPlan.run([{ partId: 'A', qty: 1 }], parts, { ...cfg, width: 0 }), /Blech/);
    const r = quiet(() => NestingPlan.run([{ partId: 'A', qty: 1 }, { partId: 'B', qty: 1 }], parts, cfg));
    assert.ok(r.errors.some(e => /unterschiedliches Material/.test(e)));
    assert.strictEqual(r.plan.materialId, null);
    assert.match(NestingPlan.previewSvg(r.plan, parts), /<svg/);
});

test('toDXF: Parser-Round-Trip (Blechumriss + Teile + Löcher)', () => {
    const P = require('../js/dxf-parser.js'); const D = P.DXFParser || P;
    const parts = { A: rectPart('A', 100, 60) };
    const { plan } = quiet(() => NestingPlan.run([{ partId: 'A', qty: 4 }], parts, cfg));
    const dxf = NestingPlan.toDXF(plan, { 'A@1': parts.A }, 0);
    const res = quiet(() => D.parse(dxf, { chainingTolerance: 0.1 }));
    assert.ok(res.success);
    assert.strictEqual(res.contours.length, 1 + 4 * 2);                    // Blech + 4 × (Außen + Loch)
    const sheet = res.contours.find(c => c.layer === 'BLECH');
    assert.ok(sheet && sheet.isClosed);
    const b = bb(sheet.points);
    assert.deepStrictEqual([b.maxX - b.minX, b.maxY - b.minY], [1000, 500]);
});
