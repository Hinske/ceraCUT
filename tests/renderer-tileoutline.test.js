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

// ── Referenz-Sperre im CAD aufheben (Fliesenumrisse bearbeitbar/verschiebbar) ──
const Pipe = sandbox.CeraCutPipeline;
const mk = (layer, extra = {}) => ({ layer, isClosed: true, isReference: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }, { x: 0, y: 0 }], ...extra });

test('Pipeline markiert Fliesenumrisse als automatische Referenz (_autoTileRef), manuelle Referenzen nicht', () => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/geometry.js'), 'utf8') + '\n;this.Geometry = Geometry;', sandbox);
    const tile = mk('Fliesen'), other = mk('Schnitt', { points: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 30 }, { x: 10, y: 30 }, { x: 10, y: 10 }] });
    Pipe._analyzeTopology([tile, other], {});
    assert.equal(tile.isReference, true); assert.equal(tile._autoTileRef, true);
    assert.equal(other.isReference, false); assert.ok(!other._autoTileRef);
});

test('CAD: releaseTileRefs hebt nur die automatische Fliesen-Referenz auf; CAM: restoreTileRefs stellt sie wieder her', () => {
    const auto = mk('Fliesen', { isReference: true, _autoTileRef: true });
    const manual = mk('Fliesen', { isReference: true });                       // vom User als Referenz gesetzt
    const plain = mk('Schnitt', { isReference: true, _autoTileRef: true });    // kein Fliesenumriss -> nie angefasst
    assert.equal(Pipe.releaseTileRefs([auto, manual, plain]), 1);
    assert.deepEqual([auto.isReference, manual.isReference, plain.isReference], [false, true, true]);
    assert.equal(Pipe.restoreTileRefs([auto, manual, plain]), 1);
    assert.deepEqual([auto.isReference, manual.isReference, plain.isReference], [true, true, true]);
});

test('CAD: ein freigegebener Fliesenumriss ist ueber isReference nicht mehr gesperrt (Auswahl/Verschieben pruefen !isReference)', () => {
    const tile = mk('Fliesen', { isReference: true, _autoTileRef: true });
    const lockedInCam = [tile].filter(c => !c.isReference).length;
    Pipe.releaseTileRefs([tile]);
    const editableInCad = [tile].filter(c => !c.isReference).length;
    assert.equal(lockedInCam, 0); assert.equal(editableInCad, 1);
});

test('render(): im CAD-Tab werden Fliesenumrisse freigegeben, ausserhalb von CAD nicht', () => {
    const tile = () => mk('Fliesen', { isReference: true, _autoTileRef: true });
    for (const [cad, expectRef] of [[true, false], [false, true]]) {
        const { r } = setup(cad);
        r.contours = [tile()];
        r.ctx = new Proxy({}, { get: () => () => {}, set: () => true });
        try { r.render(); } catch (e) { /* Rest von render() braucht echte Umgebung; Freigabe passiert zu Beginn */ }
        assert.equal(r.contours[0].isReference, expectRef, cad ? 'CAD: bearbeitbar' : 'CAM: Referenz');
    }
});
