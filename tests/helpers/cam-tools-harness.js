'use strict';
// Laedt die Browser-Skripte (Klassen ohne Exports) in einen vm-Kontext, um die CAM-Tools headless zu testen.
const vm = require('vm'), fs = require('fs'), path = require('path');
const ctx = { console: { log() {}, debug() {}, warn() {}, error: console.error }, performance, Math, window: {}, document: { querySelector: () => null }, setTimeout };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['geometry.js', 'geometry-ops.js', 'cam-contour.js', 'drawing-tools.js', 'simplify.js', 'cam-tools.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8') + '\n;', ctx, { filename: f });
}
vm.runInContext(`var __exp = { CamContour, GeometryOps, EdgefixTool, ReplaceTool, AnalyzeTool, BoundaryTrimTool, PolyJointTool, VectorizeTool, ConvexHullTool };`, ctx);
const E = ctx.__exp;

/** Minimaler Tool-Manager mit Undo-Stack. */
function scene(contours, found = () => null) {
    const log = [];
    const undo = { undoStack: [], redoStack: [], pushExecuted(c) { this.undoStack.push(c); }, _notifyStateChange() {} };
    const app = { contours, undoManager: undo, updateContourPanel() {} };
    const mgr = { app, commandLine: { log: m => log.push(m), setPrompt() {} }, renderer: { render() {} },
        getSelectedContours: () => contours.filter(c => c.isSelected), findContourAtPoint: p => found(p), _lastShift: false };
    return { app, mgr, log, undo };
}
const rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i].x * q.y - q.x * p[i].y; } return a / 2; };
const closed = pts => new E.CamContour(pts, { isClosed: true });
module.exports = { E, scene, rect, area, closed };
