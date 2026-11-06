'use strict';
// Renderer-Leads (S3): echte Boegen via ctx.arc, korrekte Drehrichtung, Farben, Band, Warnsymbol.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = require('./helpers/contour-fixtures.js');
const LG = require('../js/lead-geometry.js');

const src = fs.readFileSync(path.join(__dirname, '../js/canvas-renderer.js'), 'utf8');
const sandbox = { console, LeadGeometry: LG, window: {}, document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(sandbox);
const CanvasRenderer = vm.runInContext(src + '\n;CanvasRenderer', sandbox);

function fakeCtx() {
    const calls = [];
    const ctx = new Proxy({}, {
        get(t, k) {
            if (k === 'calls') return calls;
            if (k in t) return t[k];
            return (...a) => { calls.push([k, ...a]); };
        },
        set(t, k, v) { t[k] = v; calls.push(['set:' + k, v]); return true; }
    });
    return ctx;
}
const mod2pi = a => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
function mkRenderer() {
    const r = Object.create(CanvasRenderer.prototype);
    r.scale = 1; r.showKerfBand = true;
    r.colors = { leadIn: '#ff3b30', leadOut: '#3b82f6', overcut: '#3b82f6', leadWarn: '#ffb000', kerfBand: '#ffd54a' };
    return r;
}

test('_traceSegments: ctx.arc-Aufrufe tragen die richtige Spanne/Drehrichtung (CCW und CW)', () => {
    const r = mkRenderer();
    for (const normal of [{ x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const segs = LG.leadInArc({ join: { x: 5, y: 5 }, tangent: { x: 1, y: 0 }, normal, radius: 3, length: 9 });
        const ctx = fakeCtx();
        r._traceSegments(ctx, segs);
        const arcs = ctx.calls.filter(c => c[0] === 'arc');
        assert.equal(arcs.length, 1, 'genau ein Bogen, keine Polylinie');
        const [, cx, cy, rad, a0, a1, anticlockwise] = arcs[0];
        // Canvas-Semantik: anticlockwise=false -> Winkel waechst von a0 nach a1
        const sweep = anticlockwise ? mod2pi(a0 - a1) : mod2pi(a1 - a0);
        const arcSeg = segs.find(s => s.kind === 'arc');
        assert.ok(Math.abs(sweep - arcSeg.span) < 1e-9, `Spanne ${sweep} vs ${arcSeg.span}`);
        // Endpunkt des Canvas-Bogens == Anschlusspunkt
        assert.ok(Math.hypot(cx + rad * Math.cos(a1) - 5, cy + rad * Math.sin(a1) - 5) < 1e-9);
        assert.ok(Math.hypot(cx + rad * Math.cos(a0) - arcSeg.p0.x, cy + rad * Math.sin(a0) - arcSeg.p0.y) < 1e-9);
    }
});

test('drawLeadIn/Out/Overcut: rot/blau, Segmente statt Polylinie, Pfeil, Band', () => {
    const c = new F.CamContour(F.circle(0, 0, 30), { cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true, overcutLength: 10 });
    const r = mkRenderer();
    const ctx = fakeCtx();
    r.drawSmallArrow = (cx, x, y, ang, col) => ctx.calls.push(['ARROW', x, y, ang, col]);
    r.drawOvercutArrow = (x, y, ang) => ctx.calls.push(['OVERARROW', x, y, ang]);
    r.drawLeadIn(ctx, c, c.points); r.drawOvercut(ctx, c, c.points); r.drawLeadOut(ctx, c, c.points);
    const calls = ctx.calls;
    assert.ok(calls.some(x => x[0] === 'arc'), 'Bogen via ctx.arc');
    const strokes = calls.filter(x => x[0] === 'set:strokeStyle').map(x => x[1]);
    assert.ok(strokes.includes('#ff3b30'), 'Anschnitt rot');
    assert.ok(strokes.includes('#3b82f6'), 'Ausschnitt/Ueberschnitt blau');
    assert.ok(calls.filter(x => x[0] === 'ARROW').length >= 2 && calls.some(x => x[0] === 'OVERARROW'));
    const widths = calls.filter(x => x[0] === 'set:lineWidth').map(x => x[1]);
    assert.ok(widths.includes(0.8), 'Schnittfugenband in Kerfbreite (0.8 mm)');
});

test('Warnsymbol nur bei automatisch veraendertem Lead', () => {
    const r = mkRenderer();
    assert.equal(r._leadWarning({ type: 'arc' }), null);
    assert.ok(r._leadWarning({ shortened: true }));
    assert.ok(r._leadWarning({ isRotated: true }));
    assert.ok(r._leadWarning({ isFallbackCenterPierce: true }));
    const ctx = fakeCtx();
    r._drawLeadWarning(ctx, { x: 0, y: 0 }, { type: 'arc' });
    assert.equal(ctx.calls.length, 0);
    r._drawLeadWarning(ctx, { x: 0, y: 0 }, { shortened: true });
    assert.ok(ctx.calls.some(x => x[0] === 'fillText' && x[1] === '!'));
});

test('Band wird ausgeschaltet, wenn showKerfBand=false', () => {
    const c = new F.CamContour(F.circle(0, 0, 30), { cuttingMode: 'disc', kerfWidth: 0.8, isClosed: true });
    const r = mkRenderer(); r.showKerfBand = false;
    const ctx = fakeCtx(); r.drawSmallArrow = () => {};
    r.drawLeadIn(ctx, c, c.points);
    assert.ok(!ctx.calls.filter(x => x[0] === 'set:lineWidth').map(x => x[1]).includes(0.8));
});
