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

// ── Mehrere Außenkonturen / REFERENZ-Layer (Fehlerbild: überlagerte Konturen, Testdatei HEIDED856000W-115V1) ──
const brute = require('./helpers/overlap.js');

const twoDiscPart = (extra = {}) => ({ partId: 'P-2', name: 'ZWEI', revision: 1, technologyRef: { materialId: 21, thickness: 10 },
    geometry: { bbox: { w: 240, l: 420 }, contours: [
        { id: 'c1', role: 'open', closed: false, layer: 'REFERENZ', points: [[0, 0], [240, 0], [240, 420]] },
        { id: 'c2', role: 'disc', closed: true, layer: 'SCHNEIDEN', points: [[8, 5], [148, 5], [148, 145], [8, 145]] },
        { id: 'c3', role: 'hole', closed: true, layer: 'SCHNEIDEN', points: [[60, 60], [90, 60], [90, 90], [60, 90]] },
        { id: 'c4', role: 'disc', closed: true, layer: 'SCHNEIDEN', points: [[8, 153], [148, 153], [148, 293], [8, 293]] },
        { id: 'c5', role: 'hole', closed: true, layer: 'SCHNEIDEN', points: [[60, 200], [90, 200], [90, 230], [60, 230]] }] }, ...extra });

test('Teil mit zwei Außenkonturen wird als starre Einheit genestet: keine Überlagerung zwischen Instanzen', () => {
    const part = twoDiscPart();
    const poly = NestingPlan.nestPolygon(part);
    assert.ok(poly.length >= 4);
    const { plan } = quiet(() => NestingPlan.run([{ partId: 'P-2', qty: 30 }], { 'P-2': part }, { width: 1500, length: 1000, partToPart: 5, partToEdge: 5 }));
    assert.strictEqual(plan.stats.nested, 30);
    const polys = plan.instances.map(i => NestingPlan.placePart(part, i.rot, i.tx, i.ty));
    for (const p of polys) assert.ok(p.every(c => c.role !== 'open'), 'REFERENZ-Kontur wandert nicht mit');
    assert.strictEqual(brute.overlaps(polys, plan.instances.map(i => i.sheetIndex)), 0);
});

test('Ältere Teile mit REFERENZ-Layer: Kontur wird weder gezeichnet noch in die DXF/Vorschau übernommen', () => {
    const part = twoDiscPart();
    const { plan } = quiet(() => NestingPlan.run([{ partId: 'P-2', qty: 3 }], { 'P-2': part }, { width: 1500, length: 1000, partToPart: 5, partToEdge: 5 }));
    const pls = NestingPlan.sheetPolylines(plan, { 'P-2@1': part }, 0);
    assert.ok(!pls.some(c => c.role === 'open'));
    assert.strictEqual(pls.length, 3 * 4);
    assert.ok(!NestingPlan.toDXF(plan, { 'P-2@1': part }, 0).includes('REFERENZ'));
});

test('Reale Testdatei HEIDED856000W-115V1: Import (REFERENZ aus, Aufteilen) + 30 Stück → keine Überlagerung', { skip: !require('fs').existsSync('/mnt/dxf/Output Waricam/HEIDED856000W-115V1.DXF') }, () => {
    const P = require('../js/dxf-parser.js'); const D = P.DXFParser || P;
    const { PartGeometry } = require('../js/part-library.js');
    const txt = PartGeometry.decodeDXF(require('fs').readFileSync('/mnt/dxf/Output Waricam/HEIDED856000W-115V1.DXF'));
    const res = quiet(() => D.parse(txt, { chainingTolerance: 0.1, applyInsUnits: true }));
    const sel = res.contours.filter(c => !PartGeometry.isReferenceLayer(c.layer));
    assert.ok(sel.length < res.contours.length, 'REFERENZ-Konturen werden ausgefiltert');
    const sp = PartGeometry.analyzeSplit(sel);
    assert.ok(sp.ok);
    const total = sp.pieces.reduce((a, p) => a + p.count, 0);
    assert.strictEqual(total, 2, 'zwei Stücke in der Datei');
    const parts = {}; const demand = [];
    sp.pieces.forEach((pc, k) => {
        const id = `P-H${k}`;
        parts[id] = PartGeometry.toRecord(pc.analysis, { partId: id, fileName: 'h.dxf', name: `H-${k}`, orderId: 'O', techRef: { materialId: 21, thickness: 10 } });
        demand.push({ partId: id, qty: 15 * pc.count });
    });
    const { plan } = quiet(() => NestingPlan.run(demand, parts, { width: 1500, length: 1000, partToPart: 5, partToEdge: 5 }));
    assert.strictEqual(plan.stats.nested, 30);
    const polys = plan.instances.map(i => NestingPlan.placePart(parts[i.partId], i.rot, i.tx, i.ty));
    assert.strictEqual(brute.overlaps(polys, plan.instances.map(i => i.sheetIndex)), 0);
});

test('instanceMatrix (Canvas-Vorschau) entspricht placePart für alle Drehungen', () => {
    const part = twoDiscPart();
    const cache = {};
    for (const rot of [0, 45, 90, 135, 180, 270, 315]) {
        const m = NestingPlan.instanceMatrix(part, rot, 120.5, 33.25, cache);
        const placed = NestingPlan.placePart(part, rot, 120.5, 33.25);
        const src = part.geometry.contours.filter(c => !/referenz/i.test(c.layer));
        assert.strictEqual(placed.length, src.length);
        placed.forEach((pc, ci) => pc.points.forEach((p, k) => {
            const [x, y] = [src[ci].points[k][0], -src[ci].points[k][1]];               // Teilpunkt im (x,−y)-Raum
            const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
            assert.ok(Math.abs(X - p.x) < 1e-6 && Math.abs(Y - (-p.y)) < 1e-6, `rot ${rot}: (${X},${Y}) ≠ (${p.x},${-p.y})`);
        }));
    }
});

test('sheetScene: ein Typ, je Instanz eine Matrix; Referenz-Konturen fehlen; svgInner erst bei Zugriff', () => {
    const part = twoDiscPart();
    const { plan } = quiet(() => NestingPlan.run([{ partId: 'P-2', qty: 40 }], { 'P-2': part }, { width: 1500, length: 1000, partToPart: 5, partToEdge: 5 }));
    const c = NestingPlan.sheetContent(plan, { 'P-2@1': part }, 0);
    const onSheet = plan.instances.filter(i => (i.sheetIndex || 0) === 0).length;
    assert.strictEqual(c.scene.types.length, 1);
    assert.strictEqual(c.scene.items.length, onSheet);
    assert.ok(c.scene.items.every(i => i.m.length === 6 && i.m.every(Number.isFinite)));
    assert.ok(!c.scene.types[0].contours.some(k => k.role === 'open'));
    assert.deepStrictEqual(c.box, { x: 0, y: -1000, w: 1500, h: 1000 });
    assert.strictEqual((c.svgInner.match(/<path/g) || []).length, onSheet * 4);               // 2 Außen + 2 Löcher je Teil
});
