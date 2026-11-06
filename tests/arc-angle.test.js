'use strict';
// AP2: Bogenwinkel (90..270 Grad) und Ecken-Lead-Parameter.
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./helpers/contour-fixtures.js');
const LG = require('../js/lead-geometry.js');
const AF = require('../js/arc-fitting.js');
global.ArcFitting = AF.ArcFitting;
const PP = require('../js/sinumerik-postprocessor.js');
const LeadProfilesSrc = require('fs').readFileSync(require('path').join(__dirname, '../js/lead-profiles.js'), 'utf8');

const mk = (pts, mode, o = {}) => new F.CamContour(pts, { cuttingMode: mode, kerfWidth: 0.8, isClosed: true, cornerDegradeThreshold: 999, ...o });
const deg = r => r * 180 / Math.PI;

test('Bogenwinkel 90/180/270: Spannweite stimmt, tangential am Konturstart, auf der Abfallseite', () => {
    for (const ang of [90, 180, 270]) {
        for (const [pts, mode] of [[F.circle(0, 0, 30), 'disc'], [F.circle(0, 0, 15), 'hole'], [F.rect(0, 0, 100, 60), 'disc']]) {
            const start = pts === undefined ? 0 : 0;
            void start;
            const c = mk(pts, mode, { leadInType: 'arc', leadInRadius: 2, leadInLength: 4, leadInArcAngle: ang, leadOutType: 'arc', leadOutRadius: 2, leadOutLength: 4 });
            for (const lp of [c.getLeadInPath(), c.getLeadOutPath()]) {
                assert.equal(lp.type, 'arc');
                assert.ok(LG.validate(lp.segments).ok, `${mode} ${ang}: ${LG.validate(lp.segments).errors}`);
                const a = lp.segments.find(s => s.kind === 'arc');
                assert.ok(Math.abs(deg(a.span) - ang) < 1e-6, `Spanne ${deg(a.span)} vs ${ang}`);
            }
        }
    }
});

test('Bogenwinkel wird begrenzt und defaultet auf 90', () => {
    const c = mk(F.circle(0, 0, 30), 'disc', { leadInType: 'arc', leadInRadius: 2, leadInLength: 4 });
    assert.equal(c.leadInArcAngle, 90);
    assert.equal(c.leadOutArcAngle, 90);
    assert.ok(Math.abs(c._arcSpan(1000) - 300 * Math.PI / 180) < 1e-12);
    assert.ok(Math.abs(c._arcSpan(5) - 30 * Math.PI / 180) < 1e-12);
    assert.ok(Math.abs(c._arcSpan(undefined) - Math.PI / 2) < 1e-12);
    const cl = c.clone();
    assert.equal(cl.leadInArcAngle, 90);
    const c2 = mk(F.circle(0, 0, 30), 'disc', { leadInArcAngle: 270 });
    assert.equal(c2.clone().leadInArcAngle, 270);
    assert.equal(c2.clone().leadOutArcAngle, 270);
});

test('3/4-Kreis: G-Code enthaelt einen Bogen > 180 Grad, endet auf dem Konturstart, == Zeichnung', () => {
    const c = mk(F.circle(0, 0, 15), 'hole', { leadInType: 'arc', leadInRadius: 2, leadInLength: 4, leadInArcAngle: 270, leadOutType: 'arc', leadOutRadius: 2, leadOutLength: 4, overcutLength: 2 });
    const code = new PP().generate([c], [0], { planName: 'T' }).code;
    const L = code.split('\n'); const i0 = L.findIndex(l => l.startsWith('CONTOUR1:'));
    const lead = L.slice(i0, i0 + 14).find(l => /G4[12] G0[23]/.test(l)) || L.slice(i0, i0 + 14).find(l => /G0[23] /.test(l));
    assert.ok(lead, 'Bogensatz im Lead-In');
    const li = c.getLeadInPath();
    const arc = li.segments.find(s => s.kind === 'arc');
    assert.ok(deg(arc.span) > 269.9);
    const num = k => +lead.match(new RegExp(`\\b${k}(-?\\d+\\.\\d+)`))[1];
    // Endpunkt des Lead-Bogens = Konturstart (Geometrie)
    const join = li.segments[li.segments.length - 1].p1;
    assert.ok(Math.hypot(num('X') - join.x, num('Y') - join.y) < 0.0015, 'Lead-Bogen endet auf dem Konturstart');
    assert.ok(Math.hypot(join.x - c.points[0].x, join.y - c.points[0].y) < 1e-9);
    // Radius des G-Code-Bogens stimmt
    assert.ok(Math.abs(Math.hypot(num('I'), num('J')) - 2) < 0.002);
});

test('Ecken-Lead: Typ/Winkel/Schwelle wirken (Rechteckecke)', () => {
    const base = { leadInType: 'arc', leadInRadius: 2, leadInLength: 4, leadOutType: 'arc', leadOutRadius: 2, leadOutLength: 4 };
    const corner = o => new F.CamContour(F.rect(0, 0, 100, 60), { cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, ...base, ...o });
    assert.equal(corner({ cornerLeadType: 'linear' }).getLeadInPath().type, 'linear');
    assert.equal(corner({ cornerLeadType: 'tangent' }).getLeadInPath().type, 'tangent');
    assert.equal(corner({ cornerLeadType: 'arc' }).getLeadInPath().type, 'arc');
    // Schwelle ueber 90 Grad: Ecke zaehlt nicht -> Arc bleibt
    assert.equal(corner({ cornerDegradeThreshold: 100 }).getLeadInPath().type, 'arc');
    // Winkel 45 statt 0: linearer Ecken-Lead um 45 Grad zur Kantenrichtung
    const l0 = corner({ cornerLeadType: 'linear', cornerLeadAngle: 0 }).getLeadInPath().segments[0];
    const l45 = corner({ cornerLeadType: 'linear', cornerLeadAngle: 45 }).getLeadInPath().segments[0];
    const dir = s => { const dx = s.p1.x - s.p0.x, dy = s.p1.y - s.p0.y, l = Math.hypot(dx, dy); return { x: dx / l, y: dy / l }; };
    const d0 = dir(l0), d45 = dir(l45);
    const ang = Math.acos(d0.x * d45.x + d0.y * d45.y) * 180 / Math.PI;
    assert.ok(Math.abs(ang - 45) < 1, `Winkelunterschied ${ang}`);
});

test('Lead-Profile: Bogenwinkel wird migriert, angewendet und in isModified beachtet', () => {
    const store = {};
    const sb = { console: { log() {}, debug() {}, warn() {}, error() {} }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } }, window: {} };
    const vm = require('vm'); vm.createContext(sb);
    const LP = vm.runInContext(LeadProfilesSrc + '\n;LeadProfiles', sb);
    LP.init();
    const p = LP.getActive();
    assert.equal(p.ext.leadInArcAngle, 90);
    assert.equal(p.int.leadInArcAngle, 90);
    const c = new F.CamContour(F.circle(0, 0, 30), { cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true });
    const custom = LP.saveCustom('T270', { ext: { ...p.ext, leadInArcAngle: 270 }, int: { ...p.int, leadInArcAngle: 180 }, alt: p.alt, corner: { leadType: 'tangent', leadAngle: 10, degradeThreshold: 75 }, smallHole: p.smallHole, slit: p.slit });
    LP.setActive(custom.id);
    LP.applyBatchRules([c], custom);
    assert.equal(c.leadInArcAngle, 270);
    assert.equal(c.leadOutArcAngle, 270);
    assert.equal(c.cornerLeadType, 'tangent');
    assert.equal(c.cornerLeadAngle, 10);
    assert.equal(c.cornerDegradeThreshold, 75);
    assert.equal(LP.isModified(custom, { ...custom.ext, leadInArcAngle: 270 }, { ...custom.int }, null), false);
    assert.equal(LP.isModified(custom, { ...custom.ext, leadInArcAngle: 180 }, { ...custom.int }, null), true);
});
