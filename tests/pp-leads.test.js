'use strict';
// S4/S6: Postprozessor-Roundtrip — der erzeugte G-Code der Leads == gezeichnete Segmente (lead-geometry).
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./helpers/contour-fixtures.js');
const LG = require('../js/lead-geometry.js');
const AF = require('../js/arc-fitting.js');
global.ArcFitting = AF.ArcFitting || AF;
const PP = require('../js/sinumerik-postprocessor.js');

const TOL = 0.0015;   // G-Code hat 3 Nachkommastellen (I/J ebenfalls gerundet)

/** G-Code-Block einer Kontur -> Segmentliste { kind, p0, p1, center?, cw? } (ab erstem G00) */
function parseContour(code, n) {
    const L = code.split('\n');
    const i0 = L.findIndex(l => l.startsWith(`CONTOUR${n}:`));
    assert.ok(i0 >= 0, 'CONTOUR-Block fehlt');
    let i1 = L.findIndex((l, i) => i > i0 && /\bL205\b/.test(l));
    const num = (l, k) => { const m = l.match(new RegExp(`\\b${k}(-?\\d+(?:\\.\\d+)?)`)); return m ? +m[1] : null; };
    let pos = null; const segs = [];
    for (let i = i0; i < i1; i++) {
        const l = L[i];
        const g = l.match(/\bG0([0-3])\b/);
        if (!g) continue;
        const x = num(l, 'X'), y = num(l, 'Y');
        if (g[1] === '0') { pos = { x, y }; continue; }
        const p0 = pos, p1 = { x, y };
        if (g[1] === '1') segs.push({ kind: 'line', p0, p1 });
        else segs.push({ kind: 'arc', p0, p1, center: { x: p0.x + num(l, 'I'), y: p0.y + num(l, 'J') }, cw: g[1] === '2' });
        pos = p1;
    }
    return segs;
}
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function segMatches(e, a) {
    if (e.kind !== a.kind) return false;
    if (d(e.p1, a.p1) > TOL) return false;
    if (e.kind === 'arc') {
        if (d(e.center, a.center) > TOL * 2) return false;
        if (a.cw !== !e.ccw) return false;
    }
    return true;
}
function matchAt(exp, act, off) {
    if (off < 0 || off + exp.length > act.length) return false;
    return exp.every((e, k) => segMatches(e, act[off + k]));
}
const nonTrivial = segs => (segs || []).filter(s => LG.segLength(s) >= 0.005);

const pp = new PP();
function checkContour(name, c) {
    const r = pp.generate([c], [0], { planName: 'T' });
    assert.ok(r.code, `${name}: kein G-Code (${r.warnings.join('; ')})`);
    const act = parseContour(r.code, 1);
    const li = c.getLeadInPath(), lo = c.getLeadOutPath();
    const eIn = li && li.type !== 'on_geometry' ? nonTrivial(li.segments) : [];
    const eOut = lo && lo.type !== 'on_geometry' ? nonTrivial(lo.segments) : [];
    if (eIn.length) {
        // optional ein vorgeschalteter Tangenten-Linearsatz (G41/G42 nur im Linearsatz)
        assert.ok(matchAt(eIn, act, 0) || matchAt(eIn, act, 1), `${name}: Lead-In G-Code != Zeichnung\n exp=${JSON.stringify(eIn.map(s => [s.kind, +s.p1.x.toFixed(3), +s.p1.y.toFixed(3)]))}\n act=${JSON.stringify(act.slice(0, 4).map(s => [s.kind, s.p1.x, s.p1.y]))}`);
    }
    if (eOut.length) {
        const off = act.length - eOut.length;
        assert.ok(matchAt(eOut, act, off) || matchAt(eOut, act, off - 1), `${name}: Lead-Out G-Code != Zeichnung\n exp=${JSON.stringify(eOut.map(s => [s.kind, +s.p1.x.toFixed(3), +s.p1.y.toFixed(3)]))}\n act=${JSON.stringify(act.slice(-4).map(s => [s.kind, s.p1.x, s.p1.y]))}`);
    }
    return { eIn: eIn.length, eOut: eOut.length, arcs: [...eIn, ...eOut].filter(s => s.kind === 'arc').length };
}

// Roundtrip G-Code == gezeichnete (programmierte) Lead-Segmente, mit realer Schnittfuge (kerf 0.8).
test('Roundtrip: G-Code der Leads == Segmente der Zeichnung (alle Einzel-Szenarien)', () => {
    let n = 0, arcs = 0, withLeads = 0;
    for (const s of F.buildScenarios()) {
        const c = s.make();
        if (!c.isClosed) continue;
        const r = checkContour(s.name, c);
        n++; arcs += r.arcs; if (r.eIn || r.eOut) withLeads++;
    }
    console.log(`Roundtrip: ${n} Szenarien, ${withLeads} mit Leads, ${arcs} Bogen-Segmente geprueft`);
    assert.ok(n > 200 && arcs > 100);
});

test('Roundtrip: Mehr-Kontur-Szenarien (gekuerzt/rotiert/Dog-Leg)', () => {
    for (const s of F.buildMultiScenarios()) {
        const cs = s.make();
        cs.forEach(c => c.checkMultiContourCollision(cs, 0.5));
        cs.forEach((c, i) => checkContour(`${s.name}#${i}`, c));
    }
});

test('Lead-Ende trifft den Konturstart im G-Code (kerf > 0, Waricam-Verhalten)', () => {
    const c = new F.CamContour(F.rect(0, 0, 100, 60), { cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, leadInType: 'linear', leadInLength: 5, leadInAngle: 45 });
    const act = parseContour(pp.generate([c], [0], { planName: 'T' }).code, 1);
    // Lead-In endet im Konturstart (0,0); danach laeuft die erste Kante nach (100,0)
    assert.ok(d(act[0].p1, { x: 0, y: 0 }) < 0.005, `Lead-Ende ${JSON.stringify(act[0].p1)} != Konturstart (0,0)`);
});
