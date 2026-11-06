'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const LG = require('../js/lead-geometry.js');

const near = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} != ${b}`);
const nearPt = (p, q, tol = 1e-9, msg) => { near(p.x, q.x, tol, msg); near(p.y, q.y, tol, msg); };

// Kontur-Anschluss im Ursprung, Schnitt nach +X; Abfallseite wahlweise +Y oder -Y
const cases = [
    { name: 'Abfall +Y', join: { x: 10, y: 5 }, tangent: { x: 1, y: 0 }, normal: { x: 0, y: 1 } },
    { name: 'Abfall -Y', join: { x: 10, y: 5 }, tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } },
    { name: 'schraeg',   join: { x: -3, y: 7 }, tangent: { x: Math.SQRT1_2, y: Math.SQRT1_2 }, normal: { x: -Math.SQRT1_2, y: Math.SQRT1_2 } },
    { name: 'senkrecht', join: { x: 0, y: 0 },  tangent: { x: 0, y: -1 }, normal: { x: 1, y: 0 } },
];

for (const c of cases) {
    test(`leadInArc ${c.name}: lueckenlos, tangential am Anschluss, Pierce auf Abfallseite`, () => {
        for (const length of [1.5, 3, 6]) {
            const segs = LG.leadInArc({ ...c, radius: 2, length });
            assert.ok(LG.validate(segs).ok, LG.validate(segs).errors.join(';'));
            nearPt(segs[segs.length - 1].p1, c.join, 1e-9, 'endet auf join');
            const t = LG.tangentAt(segs[segs.length - 1], 'end');
            near(t.x, c.tangent.x, 1e-9, 'tangent.x'); near(t.y, c.tangent.y, 1e-9, 'tangent.y');
            const p = segs[0].p0;
            const side = (p.x - c.join.x) * c.normal.x + (p.y - c.join.y) * c.normal.y;
            assert.ok(side > 0, 'Pierce muss auf der Abfallseite liegen');
            if (length >= 2 * Math.PI / 2 + 0.2) near(LG.pathLength(segs), length, 1e-9, 'Gesamtlaenge');
        }
    });

    test(`leadOutArc ${c.name}: startet auf join, tangential, Ende auf Abfallseite`, () => {
        const segs = LG.leadOutArc({ ...c, radius: 2, length: 6 });
        assert.ok(LG.validate(segs).ok);
        nearPt(segs[0].p0, c.join);
        const t = LG.tangentAt(segs[0], 'start');
        near(t.x, c.tangent.x); near(t.y, c.tangent.y);
        const e = segs[segs.length - 1].p1;
        assert.ok((e.x - c.join.x) * c.normal.x + (e.y - c.join.y) * c.normal.y > 0);
        near(LG.pathLength(segs), 6, 1e-9);
    });

    test(`leadInLinear ${c.name}: Winkel zur Kontur stimmt`, () => {
        for (const ang of [10, 20, 30, 45, 60, 90]) {
            const segs = LG.leadInLinear({ ...c, angleDeg: ang, length: 4 });
            const s = segs[0];
            nearPt(s.p1, c.join);
            const dx = s.p1.x - s.p0.x, dy = s.p1.y - s.p0.y;
            const l = Math.hypot(dx, dy);
            near(l, 4, 1e-9);
            const cos = (dx * c.tangent.x + dy * c.tangent.y) / l;
            near(Math.acos(cos) * 180 / Math.PI, ang, 1e-6, `Winkel ${ang}`);
        }
    });

    test(`leadOutLinear/Tangent ${c.name}: Richtung`, () => {
        const t = LG.leadOutTangent({ ...c, length: 3 })[0];
        nearPt(t.p1, { x: c.join.x + c.tangent.x * 3, y: c.join.y + c.tangent.y * 3 });
        const l = LG.leadOutLinear({ ...c, angleDeg: 45, length: 3 })[0];
        near(LG.segLength(l), 3);
    });
}

test('radius 0 faellt auf tangentialen Lead zurueck (kein Entarten nach +X)', () => {
    const c = cases[3];
    const segs = LG.leadInArc({ ...c, radius: 0, length: 3 });
    assert.equal(segs.length, 1);
    assert.equal(segs[0].kind, 'line');
    const t = LG.tangentAt(segs[0]);
    near(t.x, c.tangent.x); near(t.y, c.tangent.y);
});

test('trim: Boegen bleiben Boegen, Mitte/Radius/Drehsinn unveraendert, join bleibt fix', () => {
    for (const c of cases) {
        const segs = LG.leadInArc({ ...c, radius: 2, length: 7 });
        const total = LG.pathLength(segs);
        for (const d of [0.5, 2, 4, total - 1.0]) {
            const t = LG.trim(segs, d, 'start');
            assert.ok(LG.validate(t).ok, `${c.name} d=${d}: ${LG.validate(t).errors}`);
            near(LG.pathLength(t), total - d, 1e-9);
            nearPt(t[t.length - 1].p1, c.join);
            for (const s of t) if (s.kind === 'arc') {
                near(s.radius, 2); assert.ok(s.span > 0 && s.span <= Math.PI / 2 + 1e-12);
            }
            const tt = LG.tangentAt(t[t.length - 1], 'end');
            near(tt.x, c.tangent.x, 1e-9); near(tt.y, c.tangent.y, 1e-9);
        }
        assert.equal(LG.trim(segs, total + 1, 'start').length, 0);
    }
});

test('trim am Ende (Lead-Out): Start bleibt auf join', () => {
    const c = cases[2];
    const segs = LG.leadOutArc({ ...c, radius: 2, length: 7 });
    const total = LG.pathLength(segs);
    for (const d of [0.3, 3, total - 0.5]) {
        const t = LG.trim(segs, d, 'end');
        assert.ok(LG.validate(t).ok, LG.validate(t).errors.join(';'));
        near(LG.pathLength(t), total - d, 1e-9);
        nearPt(t[0].p0, c.join);
    }
});

test('toPolyline: Sehnenfehler <= tol, Start/Ende exakt, Punkte liegen auf dem Bogen', () => {
    const c = cases[0];
    const segs = LG.leadInArc({ ...c, radius: 5, length: 5 * Math.PI / 2 });
    const tol = 0.005;
    const pts = LG.toPolyline(segs, tol);
    nearPt(pts[0], segs[0].p0); nearPt(pts[pts.length - 1], c.join);
    const a = segs.find(s => s.kind === 'arc');
    for (const p of pts) near(Math.hypot(p.x - a.center.x, p.y - a.center.y), a.radius, 1e-9);
    for (let i = 1; i < pts.length; i++) {
        const mid = { x: (pts[i].x + pts[i - 1].x) / 2, y: (pts[i].y + pts[i - 1].y) / 2 };
        assert.ok(a.radius - Math.hypot(mid.x - a.center.x, mid.y - a.center.y) <= tol + 1e-9);
    }
});

test('3/4-Kreis (span 270 Grad) bleibt gueltig und tangential', () => {
    const c = cases[0];
    const segs = LG.leadInArc({ ...c, radius: 2, length: 2 * 1.5 * Math.PI, span: 1.5 * Math.PI });
    assert.ok(LG.validate(segs).ok);
    near(segs[0].span, 1.5 * Math.PI);
    const t = LG.tangentAt(segs[segs.length - 1], 'end');
    near(t.x, c.tangent.x, 1e-9); near(t.y, c.tangent.y, 1e-9);
});

test('validate erkennt Luecken und kaputte Boegen', () => {
    const segs = [LG.line({ x: 0, y: 0 }, { x: 1, y: 0 }), LG.line({ x: 1.1, y: 0 }, { x: 2, y: 0 })];
    assert.equal(LG.validate(segs).ok, false);
    const bad = LG.arc({ x: 0, y: 0 }, 1, 0, Math.PI / 2, true); bad.radius = 2;
    assert.equal(LG.validate([bad]).ok, false);
    assert.equal(LG.validate([]).ok, false);
});
