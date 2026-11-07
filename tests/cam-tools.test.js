'use strict';
// Praxis-Regressionstests der CAM-Tools (cam-tools.js V1.7): EF, REP, AN, BT, PJ, VZ, HULL
const test = require('node:test');
const assert = require('node:assert');
const { E, scene, rect, area, closed } = require('./helpers/cam-tools-harness');

const selfIntersections = P => {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    const inter = (a, b, c, d) => o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    let n = 0; const m = P.length - 1;
    for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) if (!(i === 0 && j === m - 1) && inter(P[i], P[i + 1], P[j], P[j + 1])) n++;
    return n;
};

test('REP: Ziel landet exakt auf Zielschwerpunkt (ungleichmaessige Punktdichte)', () => {
    const dense = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    for (let i = 1; i <= 20; i++) dense.push({ x: 100, y: i });
    dense.push({ x: 0, y: 20 }, { x: 0, y: 0 });
    const s = closed(dense), t = closed(rect(500, 500, 100, 20));
    const { mgr } = scene([s, t]);
    const r = new E.ReplaceTool(mgr); r.sourceContour = s; r.targetContours = [t]; r.state = 'pickTargets'; r._executeReplace();
    const xs = t.points.map(p => p.x), ys = t.points.map(p => p.y);
    assert.deepStrictEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [500, 600, 500, 520]);
});

test('BT: loescht nur komplett Innenliegendes; Kreuzende und Umschliessende bleiben', () => {
    const b = closed(rect(0, 0, 100, 100)), inner = closed(rect(10, 10, 80, 80));
    const cross = closed(rect(-50, 40, 200, 20)), out = closed(rect(200, 200, 10, 10)), around = closed(rect(-10, -10, 120, 120));
    const cs = [b, inner, cross, out, around];
    const { mgr } = scene(cs);
    const t = new E.BoundaryTrimTool(mgr); t.boundaryContour = b; t._executeBoundaryTrim(false);
    assert.deepStrictEqual(cs, [b, cross, out, around]);
    const cs2 = [b, inner, cross, out, around];
    const t2 = new E.BoundaryTrimTool(scene(cs2).mgr); t2.boundaryContour = b; t2._executeBoundaryTrim(true);   // Shift: Aussen loeschen
    assert.deepStrictEqual(cs2, [b, inner, cross]);
});

test('BT: Undo stellt Konturen wieder her', () => {
    const b = closed(rect(0, 0, 100, 100)), inner = closed(rect(10, 10, 20, 20));
    const cs = [b, inner]; const sc = scene(cs);
    const t = new E.BoundaryTrimTool(sc.mgr); t.boundaryContour = b; t._executeBoundaryTrim(false);
    assert.strictEqual(cs.length, 1);
    sc.undo.undoStack.pop().undo();
    assert.strictEqual(cs.length, 2);
});

for (const [name, flipB] of [['gleicher Drehsinn', false], ['verschiedener Drehsinn', true]]) {
    test('PJ Join (' + name + '): Flaeche = A + B + Steg, keine Selbstschnitte', () => {
        const ca = closed(rect(0, 0, 20, 20)), cb = closed(flipB ? rect(40, 0, 20, 20).reverse() : rect(40, 0, 20, 20));
        const cs = [ca, cb]; const { mgr } = scene(cs);
        const t = new E.PolyJointTool(mgr); t.width = 4;
        t._joinContours(ca, cb, { x: 20, y: 10 }, { x: 40, y: 10 });
        assert.strictEqual(cs.length, 1);
        assert.ok(Math.abs(Math.abs(area(ca.points)) - 880) < 1e-6, 'Flaeche ' + area(ca.points));
        assert.strictEqual(selfIntersections(ca.points), 0);
    });
}

test('PJ Join: auch CW-Ringe, Undo stellt beide Konturen her', () => {
    const ca = closed(rect(0, 0, 20, 20).reverse()), cb = closed(rect(40, 0, 20, 20).reverse());
    const cs = [ca, cb]; const sc = scene(cs); const t = new E.PolyJointTool(sc.mgr); t.width = 4;
    const before = ca.points.length;
    t._joinContours(ca, cb, { x: 20, y: 10 }, { x: 40, y: 10 });
    assert.ok(Math.abs(Math.abs(area(ca.points)) - 880) < 1e-6);
    sc.undo.undoStack.pop().undo();
    assert.deepStrictEqual(cs, [ca, cb]);
    assert.strictEqual(ca.points.length, before);
});

test('PJ Split: zwei GESCHLOSSENE Konturen, Gesamtflaeche bleibt, Undo', () => {
    const c = closed(rect(0, 0, 100, 50)); const cs = [c]; const sc = scene(cs);
    new E.PolyJointTool(sc.mgr)._splitContour(c, { x: 50, y: 0 }, { x: 50, y: 50 });
    assert.strictEqual(cs.length, 2);
    assert.ok(cs.every(k => k.isClosed));
    assert.ok(Math.abs(cs.reduce((a, k) => a + Math.abs(area(k.points)), 0) - 5000) < 1e-6);
    assert.ok(Math.abs(Math.abs(area(cs[0].points)) - 2500) < 1e-6);
    sc.undo.undoStack.pop().undo();
    assert.strictEqual(cs.length, 1); assert.strictEqual(c.points.length, 5);
});

test('PJ Split: beide Punkte auf demselben Segment wird abgelehnt', () => {
    const c = closed(rect(0, 0, 100, 50)); const cs = [c]; const sc = scene(cs);
    new E.PolyJointTool(sc.mgr)._splitContour(c, { x: 10, y: 0 }, { x: 60, y: 0 });
    assert.strictEqual(cs.length, 1);
});

test('AN: grosse Szene bleibt schnell (BBox-Vorfilter), findet Luecke + Ueberlappung', () => {
    const cs = [];
    for (let i = 0; i < 300; i++) {
        const pts = [];
        for (let k = 0; k <= 200; k++) { const a = k / 200 * 2 * Math.PI; pts.push({ x: (i % 20) * 50 + 10 * Math.cos(a), y: Math.floor(i / 20) * 50 + 10 * Math.sin(a) }); }
        cs.push(closed(pts));
    }
    const t0 = Date.now();
    const sc = scene(cs); const t = new E.AnalyzeTool(sc.mgr); t.selectedContours = []; t.cancel = () => {}; t._executeAnalyze();
    assert.ok(Date.now() - t0 < 3000, 'dauerte ' + (Date.now() - t0) + ' ms');

    const l1 = new E.CamContour([{ x: 0, y: 0 }, { x: 50, y: 0 }], { isClosed: false }), l2 = new E.CamContour([{ x: 50.3, y: 0 }, { x: 100, y: 0 }], { isClosed: false });
    const sq = closed(rect(0, 10, 10, 10)), sq2 = closed(rect(10, 10, 10, 10));
    const sc2 = scene([l1, l2, sq, sq2]); const t2 = new E.AnalyzeTool(sc2.mgr); t2.selectedContours = []; t2.cancel = () => {}; t2._executeAnalyze();
    assert.match(sc2.log.join('|'), /1 Lücke.*1 Überlappung/);
});

test('VZ: reduziert Punkte mit Toleranz, Undo stellt Original her', () => {
    const pts = []; for (let i = 0; i <= 72; i++) { const a = i / 72 * 2 * Math.PI; pts.push({ x: 30 * Math.cos(a), y: 30 * Math.sin(a) }); }
    const c = closed(pts); const sc = scene([c]);
    const t = new E.VectorizeTool(sc.mgr); t.tolerance = 0.5; t.selectedContours = [c]; t.state = 'select'; t._executeVectorize();
    assert.ok(c.points.length < 40 && c.points.length >= 12, 'Punkte ' + c.points.length);
    // Abweichung vom Ideal-Kreis <= Toleranz
    assert.ok(Math.max(...c.points.map(p => Math.abs(Math.hypot(p.x, p.y) - 30))) <= 0.5 + 1e-9);
    sc.undo.undoStack.pop().undo();
    assert.strictEqual(c.points.length, 73);
});

test('HULL: konvexe Huelle zweier Rechtecke (6 Ecken), Undo', () => {
    const cs = [closed(rect(0, 0, 10, 10)), closed(rect(30, 5, 10, 10))]; const sc = scene(cs);
    const t = new E.ConvexHullTool(sc.mgr); t.selectedContours = [...cs]; t.cancel = () => {}; t._executeConvexHull();
    assert.strictEqual(cs.length, 3);
    assert.strictEqual(cs[2].points.length - 1, 6);
    sc.undo.undoStack.pop().undo();
    assert.strictEqual(cs.length, 2);
});

test('EF: Arc ersetzt Abschnitt, Punkte liegen auf dem Kreis; B vor A wird sortiert', () => {
    const A = { segmentIndex: 0, point: { x: 20, y: 0 } }, B = { segmentIndex: 1, point: { x: 50, y: 30 } };
    const c = closed(rect(0, 0, 50, 50)); const sc = scene([c], () => c);
    const t = new E.EdgefixTool(sc.mgr);
    // Klickfolge Kontur, B, A, C ueber handleClick (B zuerst angeklickt)
    const picks = [B, A];
    t._nearestOnContour = () => picks.shift();
    t.handleClick({ x: 1, y: 1 });   // Kontur
    t.handleClick({ x: 1, y: 1 });   // erster Klick = B
    t.handleClick({ x: 1, y: 1 });   // zweiter Klick = A
    assert.strictEqual(t.state, 'pickC');
    assert.strictEqual(t.segA.segmentIndex, 0);
    t.handleClick({ x: 42, y: 8 });
    const arc = t._fitArc(A.point, { x: 42, y: 8 }, B.point);
    const inArc = c.points.filter(p => p.y > 0.01 && p.x < 49.99 && p.x > 20.01);
    assert.ok(inArc.length > 5);
    for (const p of inArc) assert.ok(Math.abs(Math.hypot(p.x - arc.cx, p.y - arc.cy) - arc.r) < 1e-6);
});
