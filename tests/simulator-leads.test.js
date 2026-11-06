'use strict';
// S5: Simulator nutzt Lead-Segmente (exakte Laenge) und die reale Strahlmitte.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = require('./helpers/contour-fixtures.js');
const LG = require('../js/lead-geometry.js');

const src = fs.readFileSync(path.join(__dirname, '../js/toolpath-simulator.js'), 'utf8');
const sb = { console: { log() {}, debug() {}, warn() {}, error() {} }, LeadGeometry: LG, window: {}, document: {} };
vm.createContext(sb);
const Sim = vm.runInContext(src + '\n;ToolpathSimulator', sb);

const mk = (pts, mode, o = {}) => new F.CamContour(pts, { cuttingMode: mode, kerfWidth: 0.8, isClosed: true, ...o });
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('Lead-Laenge exakt (Bogen = echte Bogenlaenge, nicht Sehnenzug)', () => {
    const c = mk(F.circle(0, 0, 30), 'disc', { leadInType: 'arc', leadInRadius: 3, leadInLength: 9, leadOutType: 'arc', leadOutRadius: 3, leadOutLength: 9, cornerDegradeThreshold: 999 });
    const [r] = Sim.getContourLengths([c]);
    assert.equal(r.leadInLength, 9);
    assert.equal(r.leadOutLength, 9);
    assert.equal(r.overcutLength, c.overcutLength);
});

test('Animationspfad: Lead-In -> Kontur -> Ueberschnitt -> Lead-Out ohne Sprung', () => {
    for (const [pts, mode] of [[F.rect(0, 0, 100, 60), 'disc'], [F.circle(0, 0, 30), 'disc'], [F.circle(0, 0, 15), 'hole'], [F.rect(10, 10, 40, 25), 'hole']]) {
        const c = mk(pts, mode, { leadInType: 'linear', leadInAngle: 90, leadInLength: 3, leadOutType: 'linear', leadOutAngle: 90, leadOutLength: 1, overcutLength: 3 });
        const segs = Sim._buildAnimationSegments([c], [0], { x: 0, y: 0 }).filter(s => s.contourIndex === 0 && s.points && ['leadIn', 'cutting', 'overcut', 'leadOut'].includes(s.phase));
        const byPhase = Object.fromEntries(segs.map(s => [s.phase, s]));
        assert.ok(byPhase.leadIn && byPhase.cutting && byPhase.overcut && byPhase.leadOut, `${mode}: Phasen`);
        const end = s => s.points[s.points.length - 1], start = s => s.points[0];
        assert.ok(d(end(byPhase.leadIn), start(byPhase.cutting)) < 1e-6, `${mode}: Lead-In -> Kontur ${d(end(byPhase.leadIn), start(byPhase.cutting))}`);
        assert.ok(d(end(byPhase.cutting), start(byPhase.overcut)) < 1e-6, `${mode}: Kontur -> Ueberschnitt`);
        assert.ok(d(end(byPhase.overcut), start(byPhase.leadOut)) < 1e-6, `${mode}: Ueberschnitt -> Lead-Out`);
        assert.ok(Math.abs(byPhase.overcut.length - 3) < 1e-6 && Math.abs(byPhase.leadIn.length - 3) < 1e-6 && Math.abs(byPhase.leadOut.length - 1) < 1e-6);
    }
});

test('Reale Strahlmitte: Lead-Pruefpunkte liegen um kerf/2 versetzt auf der Abfallseite', () => {
    // Start auf der unteren Kante (Mitte) -> gerade Stelle
    const mid = mk([{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 0 }, { x: 50, y: 0 }], 'disc', { leadInType: 'linear', leadInAngle: 90, leadInLength: 6 });
    const prog = mid.getLeadInPath().points;     // Anschuss (50,-6) -> (50,0)
    const tool = Sim._leadToolPoints(mid, 'in');
    assert.ok(d(prog[0], tool[0]) < 1e-9, 'Anschuss bleibt unkompensiert');
    const e = tool[tool.length - 1];
    assert.ok(Math.abs(e.y - (-0.4)) < 1e-6 && Math.abs(e.x - 50) < 1e-6, `Ende auf versetzter Bahn: ${JSON.stringify(e)}`);
});
