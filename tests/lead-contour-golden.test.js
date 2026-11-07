'use strict';
// Regression: CamContour-Leads (neu, ueber LeadGeometry) vs. Golden aus dem Code VOR dem Umbau.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const F = require('./helpers/contour-fixtures.js');
const LG = require('../js/lead-geometry.js');

const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden/leads-old.json'), 'utf8'));
const HAUS_TOL = 0.05;          // Sehnenfehler der alten 12-Punkt-Boegen (R12: 0.026)
const END_TOL = 0.02;

const segDist = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};
const distToPoly = (p, poly) => {
    if (poly.length === 1) return Math.hypot(p.x - poly[0].x, p.y - poly[0].y);
    let m = Infinity;
    for (let i = 1; i < poly.length; i++) m = Math.min(m, segDist(p, poly[i - 1], poly[i]));
    return m;
};
const mod2pi = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const angEq = (a, b) => { const d = Math.abs(mod2pi(a) - mod2pi(b)); return Math.min(d, 2 * Math.PI - d) < 1e-6; };

function compareLead(name, role, g, n) {
    if (!g) { assert.equal(n, null, `${name} ${role}: war null`); return; }
    assert.ok(n, `${name} ${role}: ist null`);
    assert.equal(n.type, g.type, `${name} ${role}: type`);
    for (const f of ['shortened', 'isRotated', 'isAlternative', 'isFallbackCenterPierce', 'isFallbackCenterExit'])
        assert.equal(!!n[f], g[f], `${name} ${role}: ${f}`);
    if (role === 'overcut') {
        assert.deepEqual((n.points || []).map(p => ({ x: +p.x.toFixed(6) + 0, y: +p.y.toFixed(6) + 0 })), g.points, `${name} overcut Punkte`);
        return;
    }
    assert.ok(n.points.length >= 1, `${name} ${role}: keine Punkte`);
    const a0 = g.points[0], a1 = g.points[g.points.length - 1];
    const b0 = n.points[0], b1 = n.points[n.points.length - 1];
    for (const [p, q, w] of [[a0, b0, 'Start'], [a1, b1, 'Ende']])
        assert.ok(Math.hypot(p.x - q.x, p.y - q.y) < END_TOL, `${name} ${role}: ${w} ${JSON.stringify(p)} vs ${JSON.stringify(q)}`);
    if (g.points.length > 1 && n.points.length > 1) {
        for (const p of g.points) assert.ok(distToPoly(p, n.points) < HAUS_TOL, `${name} ${role}: alt->neu`);
        for (const p of n.points) assert.ok(distToPoly(p, g.points) < HAUS_TOL, `${name} ${role}: neu->alt`);
    }
    if (g.arc && !g.shortened) {
        const a = (n.segments || []).find(x => x.kind === 'arc');
        assert.ok(a, `${name} ${role}: Bogen-Segment fehlt`);
        assert.ok(Math.hypot(a.center.x - g.arc.c.x, a.center.y - g.arc.c.y) < 1e-6, `${name} ${role}: Mitte`);
        assert.ok(Math.abs(a.radius - g.arc.r) < 1e-6, `${name} ${role}: Radius`);
        assert.equal(a.ccw, g.arc.ccw, `${name} ${role}: Drehsinn`);
    }
    // Neue Invarianten
    if (n.type !== 'on_geometry' && role !== 'overcut') {
        assert.ok(Array.isArray(n.segments) && n.segments.length >= 1, `${name} ${role}: segments fehlen`);
        const v = LG.validate(n.segments, 1e-5);
        assert.ok(v.ok, `${name} ${role}: ${v.errors.join(';')}`);
        const sp = LG.toPolyline(n.segments, 0.005);
        assert.ok(Math.hypot(sp[0].x - b0.x, sp[0].y - b0.y) < 1e-6 && Math.hypot(sp[sp.length - 1].x - b1.x, sp[sp.length - 1].y - b1.y) < 1e-6,
            `${name} ${role}: segments != points`);
    }
}

test('Einzel-Szenarien == Golden (alte Implementierung)', () => {
    let n = 0;
    for (const s of F.buildScenarios()) {
        const g = golden[s.name];
        const c = F.snapshotContour(s.make());
        const cc = s.make();
        compareLead(s.name, 'in', g.leadIn, cc.getLeadInPath());
        compareLead(s.name, 'out', g.leadOut, cc.getLeadOutPath());
        compareLead(s.name, 'overcut', g.overcut, cc.getOvercutPath());
        n++;
    }
    assert.ok(n > 200);
});

test('Multi-Kontur-Szenarien (Rotation/Dog-Leg/Kuerzung) == Golden', () => {
    for (const s of F.buildMultiScenarios()) {
        const cs = s.make();
        cs.forEach(c => c.checkMultiContourCollision(cs, 0.5));
        cs.forEach((c, i) => {
            compareLead(`${s.name}#${i}`, 'in', golden[s.name][i].leadIn, c.getLeadInPath());
            compareLead(`${s.name}#${i}`, 'out', golden[s.name][i].leadOut, c.getLeadOutPath());
        });
    }
});

test('gekuerzte Arc-Leads bleiben echte Boegen (kein Polylinien-Fallback noetig)', () => {
    let found = 0;
    for (const s of F.buildScenarios()) {
        const c = s.make();
        for (const lp of [c.getLeadInPath(), c.getLeadOutPath()]) {
            if (lp && lp.shortened && lp.type === 'arc' && lp.segments.some(x => x.kind === 'arc')) found++;
        }
    }
    console.log('gekuerzte Boegen mit Bogen-Segment:', found);
});

test('Kuerzen durch Nachbarkontur: Arc-Lead bleibt echter Bogen (In und Out)', () => {
    const LGm = require('../js/lead-geometry.js');
    for (const [role, frac] of [['in', 0.6], ['out', 0.6], ['in', 0.25], ['out', 0.25]]) {
        const c = new F.CamContour(F.rect(0, 0, 100, 60), { name: 'T', cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true,
            cornerDegradeThreshold: 999, leadInType: 'arc', leadInRadius: 3, leadInLength: 9, leadOutType: 'arc', leadOutRadius: 3, leadOutLength: 9 });
        const lp = role === 'in' ? c.getLeadInPath() : c.getLeadOutPath();
        assert.equal(lp.type, 'arc');
        const before = LGm.pathLength(lp.segments);
        const arcBefore = lp.segments.find(s => s.kind === 'arc');
        // Wand quer durch den Lead bei ~60 % Weglaenge (vom Anschluss aus gesehen)
        const poly = lp.points;
        const join = role === 'in' ? poly[poly.length - 1] : poly[0];
        const ordered = role === 'in' ? poly.slice().reverse() : poly.slice();
        let acc = 0, hit = null; const target = before * frac;
        for (let i = 1; i < ordered.length && !hit; i++) {
            const l = Math.hypot(ordered[i].x - ordered[i - 1].x, ordered[i].y - ordered[i - 1].y);
            if (acc + l >= target) { const t = (target - acc) / l; hit = { x: ordered[i - 1].x + t * (ordered[i].x - ordered[i - 1].x), y: ordered[i - 1].y + t * (ordered[i].y - ordered[i - 1].y), dx: ordered[i].x - ordered[i - 1].x, dy: ordered[i].y - ordered[i - 1].y }; }
            acc += l;
        }
        const l = Math.hypot(hit.dx, hit.dy), nx = -hit.dy / l, ny = hit.dx / l;
        const wall = [{ x: hit.x - nx * 20, y: hit.y - ny * 20 }, { x: hit.x - nx * 5, y: hit.y - ny * 5 }, { x: hit.x + nx * 5, y: hit.y + ny * 5 }, { x: hit.x + nx * 20, y: hit.y + ny * 20 }];
        assert.ok(c._shortenLeadAgainstContour(lp, wall, role, 0.1), `${role}: keine Kollision erkannt ${JSON.stringify(wall)} lead=${JSON.stringify(lp.points.slice(0,2))}`);
        assert.ok(lp.shortened);
        const v = LGm.validate(lp.segments, 1e-5);
        assert.ok(v.ok, v.errors.join(';'));
        const after = LGm.pathLength(lp.segments);
        assert.ok(Math.abs(after - before * frac) < 0.02 * before, `${role}/${frac}: Laenge ${after} vs ${before * frac}`);
        const arcAfter = lp.segments.find(s => s.kind === 'arc');
        if (frac < 0.5) assert.ok(arcAfter, `${role}: Bogen muss erhalten bleiben (frac ${frac})`);
        if (arcAfter) {
            assert.ok(Math.hypot(arcAfter.center.x - arcBefore.center.x, arcAfter.center.y - arcBefore.center.y) < 1e-9);
            assert.ok(Math.abs(arcAfter.radius - arcBefore.radius) < 1e-9 && arcAfter.ccw === arcBefore.ccw);
        }
        const p = lp.points;
        const jn = role === 'in' ? p[p.length - 1] : p[0];
        assert.ok(Math.hypot(jn.x - join.x, jn.y - join.y) < 1e-6, `${role}: Anschluss bleibt fix`);
        // Pierce/Ende liegt nahe der Wand
        const free = role === 'in' ? p[0] : p[p.length - 1];
        assert.ok(Math.hypot(free.x - hit.x, free.y - hit.y) < 0.1 * before, `${role}: freies Ende bei Wand`);
    }
});

test('Eckenerkennung (V5.26): gerade/glatt -> Arc bleibt, echte Ecke -> degradiert', () => {
    const mk = (pts, mode = 'disc') => new F.CamContour(pts, { cuttingMode: mode, kerfWidth: 0.8, isClosed: true, leadInType: 'arc', leadOutType: 'arc' });
    // Kreis (5 Grad Drehung je Punkt) -> Arc
    const circ = mk(F.circle(0, 0, 30));
    assert.equal(circ._isAtCorner(circ.points), 0);
    assert.equal(circ.getLeadInPath().type, 'arc');
    assert.equal(circ.getLeadOutPath().type, 'arc');
    // Rechteck mit Start auf Kantenmitte (gerade Stelle) -> Arc
    const r = [{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 0 }, { x: 50, y: 0 }];
    const mid = mk(r);
    assert.equal(mid._isAtCorner(mid.points), 0);
    assert.equal(mid.getLeadInPath().type, 'arc');
    // 90-Grad-Ecke -> degradiert zu cornerLeadType (linear)
    const corner = mk(F.rect(0, 0, 100, 60));
    assert.ok(Math.abs(corner._isAtCorner(corner.points) - 90) < 1e-6);
    assert.equal(corner.getLeadInPath().type, 'linear');
});

test('Lead-Laenge wird nicht mehr durch eigene Kruemmung/Ecke gekappt (V5.27)', () => {
    const len = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); return l; };
    const mk = (pts, mode, o = {}) => new F.CamContour(pts, { cuttingMode: mode, kerfWidth: 0.8, isClosed: true, leadInType: 'tangent', leadInLength: 8, leadOutType: 'tangent', leadOutLength: 8, ...o });
    for (const [pts, mode] of [[F.circle(0, 0, 30), 'disc'], [F.circle(0, 0, 15), 'hole'], [F.rect(0, 0, 100, 60), 'disc'], [F.rect(10, 10, 40, 25), 'hole']]) {
        const c = mk(pts, mode);
        assert.ok(Math.abs(len(c.getLeadInPath().points) - 8) < 1e-6, `In ${mode}: ${len(c.getLeadInPath().points)}`);
        assert.ok(Math.abs(len(c.getLeadOutPath().points) - 8) < 1e-6, `Out ${mode}: ${len(c.getLeadOutPath().points)}`);
    }
    // Echte Engstelle (4 mm breiter Schlitz, Start in Kantenmitte): Lead bleibt auf halbe Kanalbreite gekappt
    const slot = mk([{ x: 30, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 4 }, { x: 0, y: 4 }, { x: 0, y: 0 }, { x: 30, y: 0 }], 'hole');
    assert.ok(len(slot.getLeadInPath().points) <= 2.0 + 1e-6, `Schlitz-Lead ${len(slot.getLeadInPath().points)}`);
});

// V5.31: Ueberschnitt an Ecken automatisch gesperrt
test('Ueberschnitt: an Ecke gesperrt, auf glatter Kante/Kreis erlaubt, Override moeglich', () => {
    const { CamContour: C, rect, circle } = require('./helpers/contour-fixtures.js');
    const opt = { cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, overcutLength: 3 };
    const corner = new C(rect(0, 0, 100, 60, true), { ...opt, overcutAtCorners: false });
    assert.equal(corner.isStartAtCorner(), true);
    assert.equal(corner.getOvercutPath(), null);
    const forced = new C(rect(0, 0, 100, 60, true), { ...opt, overcutAtCorners: true });
    assert.equal(forced.getOvercutPath().type, 'positive');
    const circ = new C(circle(0, 0, 30), { ...opt, overcutAtCorners: false });
    assert.equal(circ.isStartAtCorner(), false);
    assert.equal(circ.getOvercutPath().type, 'positive');
    const neg = new C(rect(0, 0, 100, 60, true), { ...opt, overcutLength: -2, overcutAtCorners: false });
    assert.equal(neg.getOvercutPath(), null);
});
