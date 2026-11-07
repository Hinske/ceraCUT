const test = require('node:test');
const assert = require('node:assert');
const { PartGeometry } = require('../js/part-library.js');

const rect = (x, y, w, h, extra = {}) => ({
    points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], isClosed: true, ...extra });

test('Rechteck mit Loch: Rollen, Fläche, Schnittlänge, Ursprung unten-links', () => {
    const r = PartGeometry.analyze([rect(100, 200, 100, 50), rect(120, 215, 20, 20)]);
    assert.ok(r.ok);
    const g = r.geometry;
    assert.deepStrictEqual(g.contours.map(c => c.role), ['disc', 'hole']);
    assert.deepStrictEqual(g.contours[0].points[0], [0, 0]);
    assert.deepStrictEqual(g.bbox, { w: 100, l: 50 });
    assert.strictEqual(g.netArea, (100 * 50 - 20 * 20) / 1e6);
    assert.strictEqual(g.rectArea, 5000 / 1e6);
    assert.strictEqual(g.cutLength, (300 + 80) / 1000);
    assert.strictEqual(g.piercings, 2);
    assert.deepStrictEqual(r.warnings, []);
    assert.match(r.thumbnailSvg, /^<svg[^>]*viewBox=/);
});

test('Insel im Loch ist wieder disc (Tiefe 2)', () => {
    const r = PartGeometry.analyze([rect(0, 0, 100, 100), rect(10, 10, 80, 80), rect(30, 30, 20, 20)]);
    assert.deepStrictEqual(r.geometry.contours.map(c => c.role), ['disc', 'hole', 'disc']);
});

test('offene Kontur → Warnung; leer/NaN → nicht ok', () => {
    const open = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], isClosed: false };
    const r = PartGeometry.analyze([rect(0, 0, 10, 10), open]);
    assert.ok(r.ok);
    assert.ok(r.warnings.some(w => /offene/.test(w)));
    assert.strictEqual(r.geometry.contours[1].role, 'open');
    assert.strictEqual(PartGeometry.analyze([]).ok, false);
    assert.strictEqual(PartGeometry.analyze([{ points: [{ x: NaN, y: 0 }, { x: 1, y: 1 }], isClosed: false }]).ok, false);
});

test('Namen und Datensatz', () => {
    assert.deepStrictEqual(PartGeometry.namesFromFile('KOMM 0005.dxf'), { name: 'KOMM 0005', orderId: 'O-KOMM_0005' });
    const a = PartGeometry.analyze([rect(0, 0, 10, 10)]);
    const rec = PartGeometry.toRecord(a, { partId: 'P-1', fileName: 'a.dxf', name: 'a', orderId: 'O-a', qty: 3,
        techRef: { materialId: 21, thickness: 10 } });
    assert.strictEqual(rec.status, 'ready'); assert.strictEqual(rec.revision, 1); assert.strictEqual(rec.qty, 3);
    assert.match(PartGeometry.newPartId(2), /^P-[A-Z0-9]+$/);
});

test('toDXF → Parser → analyze: Round-Trip bleibt geometrisch gleich (inkl. offene Kontur, Layer)', () => {
    const P = require('../js/dxf-parser.js'); const D = P.DXFParser || P;
    const a = PartGeometry.analyze([rect(0, 0, 100, 50, { layer: 'Teil' }), rect(20, 10, 20, 20, { layer: 'Text' }),
        { points: [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 15, y: 9 }], isClosed: false, layer: 'Ritz' }]);
    const part = PartGeometry.toRecord(a, { partId: 'P-1', fileName: 'a.dxf', name: 'a', orderId: 'O', techRef: {} });
    const log = console.log, dbg = console.debug, wrn = console.warn; console.log = console.debug = console.warn = () => {};
    let res; try { res = D.parse(PartGeometry.toDXF(part), { chainingTolerance: 0.1 }); } finally { console.log = log; console.debug = dbg; console.warn = wrn; }
    assert.ok(res.success);
    const b = PartGeometry.analyze(PartGeometry.fromAppContours(res.contours));
    assert.deepStrictEqual(b.geometry.bbox, a.geometry.bbox);
    assert.strictEqual(b.geometry.netArea, a.geometry.netArea);
    assert.strictEqual(b.geometry.contours.length, 3);
    assert.deepStrictEqual(b.geometry.contours.map(c => c.role).sort(), ['disc', 'hole', 'open']);
    assert.deepStrictEqual(b.geometry.contours.map(c => c.layer).sort(), ['Ritz', 'Teil', 'Text']);
});

test('fromAppContours filtert Referenz/Schraffur/zu kurze', () => {
    const out = PartGeometry.fromAppContours([{ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], isClosed: false }, { isReference: true, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
        { isHatchContour: true, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }, { points: [{ x: 0, y: 0 }] }, null]);
    assert.strictEqual(out.length, 1);
});

test('previewSvg: y nach oben, Rollen-Stile, Ausdehnung', () => {
    const a = PartGeometry.analyze([rect(0, 0, 100, 50), rect(20, 10, 20, 20),
        { points: [{ x: 5, y: 5 }, { x: 15, y: 5 }], isClosed: false }]);
    const { svgInner, box } = PartGeometry.previewSvg(a.geometry);
    assert.deepStrictEqual(box, { x: 0, y: -50, w: 100, h: 50 });          // y gespiegelt: -50…0
    assert.strictEqual((svgInner.match(/<path/g) || []).length, 3);
    assert.ok(/fill-opacity/.test(svgInner) && /#c0392b/.test(svgInner) && /#e8a020/.test(svgInner));
    assert.ok(svgInner.includes('vector-effect="non-scaling-stroke"'));
    assert.deepStrictEqual(PartGeometry.previewSvg({ contours: [] }).box, { x: 0, y: 0, w: 100, h: 100 });
});
