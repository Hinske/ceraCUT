'use strict';
// Fliesenumrisse (Layer Fliesen) = automatische Referenz: im Tab CAD normale Linie in Layerfarbe, in den CAM-Tabs Referenz-Optik.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');

const sandbox = { console, window: {}, document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ceracut-pipeline.js'), 'utf8') + '\n;this.CeraCutPipeline = CeraCutPipeline;', sandbox);
const CanvasRenderer = vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/canvas-renderer.js'), 'utf8') + '\n;CanvasRenderer', sandbox);

function setup(cadTab) {
    const r = Object.create(CanvasRenderer.prototype);
    r.scale = 1; r.colors = { reference: '#555555', hovered: '#0ff', selected: '#ff0' };
    r.app = { isGeometryEditAllowed: () => cadTab, layerManager: { getLayer: () => ({ color: '#a020f0' }) } };
    const calls = [];
    r.drawPath = (ctx, pts, color, w) => calls.push({ fn: 'drawPath', color, w, n: pts.length });
    const ctx = { setLineDash: d => calls.push({ fn: 'dash', d }), save() {}, restore() {}, beginPath() {}, stroke() {} };
    return { r, ctx, calls };
}
const rect = layer => ({ layer, isClosed: true, isReference: true, isSelected: false, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] });

test('CAD-Tab: Fliesenumriss (automatische Referenz) wird als normale duenne Linie in Layerfarbe gezeichnet, nicht gestrichelt', () => {
    const { r, ctx, calls } = setup(true);
    r.drawContour(ctx, rect('Fliesen'));
    assert.equal(calls.filter(c => c.fn === 'dash').length, 0, 'keine Strichelung');
    const dp = calls.filter(c => c.fn === 'drawPath');
    assert.equal(dp.length, 1); assert.equal(dp[0].color, '#a020f0'); assert.equal(dp[0].n, 5, 'geschlossen gezeichnet');
});

test('CAM-Tab: derselbe Fliesenumriss bleibt Referenz (gestrichelt grau)', () => {
    const { r, ctx, calls } = setup(false);
    r.drawContour(ctx, rect('Fliesen'));
    assert.ok(calls.some(c => c.fn === 'dash' && c.d.length > 0), 'gestrichelt');
    assert.ok(calls.some(c => c.fn === 'drawPath' && c.color === '#555555'));
});

test('CAD-Tab: manuell gesetzte Referenz auf anderem Layer bleibt Referenz-Optik; selektierter Fliesenumriss behaelt Auswahlfarbe', () => {
    let t = setup(true);
    t.r.drawContour(t.ctx, rect('Konstruktion2'));
    assert.ok(t.calls.some(c => c.fn === 'drawPath' && c.color === '#555555'));
    t = setup(true);
    const sel = rect('Fliesen'); sel.isSelected = true;
    t.r.drawContour(t.ctx, sel);
    assert.ok(!t.calls.some(c => c.fn === 'drawPath' && c.color === '#a020f0'), 'selektiert: nicht die Plain-Zeichnung');
});
