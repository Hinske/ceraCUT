#!/usr/bin/env node
/**
 * Browser-Pruefung des Import-Workflows (Headless-Chromium via playwright-core):
 *  - Fliesen-Raster (4 Einzellinien je Fliese, Layer "Fliese") + je ein Schnitt: ALLE Fliesen erkannt, je eigener Nullpunkt, alle Schnitte vorhanden
 *  - dasselbe mit geschlossenen Polylinien als Fliesenumriss
 *  - normales Teil ohne Fliesen: Auto-Setup setzt Referenz + Nullpunkt und wechselt in Bearbeitung
 * Aufruf: node scripts/check-import-workflow.js   (Exit 1 bei Abweichung)
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright-core'));
const TileGrid = require(path.join(ROOT, 'js', 'tile-grid.js'));

const NX = 3, NY = 2, W = 300, H = 300, GAP = 100;
function circles() {
    let s = '';
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++)
        s += `0\nCIRCLE\n8\n0\n10\n${150 + (W + GAP) * i}\n20\n${150 + (H + GAP) * j}\n30\n0\n40\n50\n`;
    return s;
}
function linesDxf() {
    const r = TileGrid.compute({ w: W, h: H, nx: NX, ny: NY, fugeX: GAP, fugeY: GAP, nummer: 'aus', maserung: 'aus', zentriert: false });
    const d = r.dxf.replace(/\r\n/g, '\n'), i = d.lastIndexOf('0\nENDSEC');
    return d.slice(0, i) + circles() + d.slice(i);
}
function polyDxf() {
    const o = ['0', 'SECTION', '2', 'ENTITIES'];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
        const x = (W + GAP) * i, y = (H + GAP) * j;
        o.push('0', 'LWPOLYLINE', '8', 'Fliese', '90', '4', '70', '1');
        for (const [px, py] of [[x, y], [x + W, y], [x + W, y + H], [x, y + H]]) o.push('10', String(px), '20', String(py));
    }
    o.push('0', 'ENDSEC', '0', 'EOF');
    const d = o.join('\n') + '\n', k = d.lastIndexOf('0\nENDSEC');
    return d.slice(0, k) + circles() + d.slice(k);
}
function noLayerDxf() {   // Rechtecke auf Layer 0 (kein Layer "Fliese") mit je 2 Schnitten -> Fallback-Erkennung
    const o = ['0', 'SECTION', '2', 'ENTITIES'];
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
        const x = (W + GAP) * i, y = (H + GAP) * j;
        o.push('0', 'LWPOLYLINE', '8', '0', '90', '4', '70', '1');
        for (const [px, py] of [[x, y], [x + W, y], [x + W, y + H], [x, y + H]]) o.push('10', String(px), '20', String(py));
        for (const [dx, rad] of [[90, 40], [210, 30]]) o.push('0', 'CIRCLE', '8', '0', '10', String(x + dx), '20', String(y + 150), '30', '0', '40', String(rad));
    }
    o.push('0', 'ENDSEC', '0', 'EOF');
    return o.join('\n') + '\n';
}
const PLAIN = ['0', 'SECTION', '2', 'ENTITIES', '0', 'CIRCLE', '8', '0', '10', '100', '20', '100', '30', '0', '40', '80',
    '0', 'CIRCLE', '8', '0', '10', '100', '20', '100', '30', '0', '40', '20', '0', 'ENDSEC', '0', 'EOF'].join('\n') + '\n';

(async () => {
    const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
    let fail = 0;
    const check = (name, ok, info) => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fail++; };
    for (const [name, dxf, expectTiles] of [['Fliesen aus 4 Linien', linesDxf(), NX * NY], ['Fliesen als Polylinie', polyDxf(), NX * NY]]) {
        const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
        const errs = []; p.on('pageerror', e => errs.push(e.message));
        await p.goto('file://' + path.join(ROOT, 'index.html')); await p.waitForTimeout(1500);
        await p.evaluate(c => window.app.loadDXFContent('x.dxf', c, 100), dxf); await p.waitForTimeout(3000);
        const r = await p.evaluate(() => { const a = window.app; a.refreshTiles(true);
            return { cut: a.cutOrder.length, n: a.contours.length, setup: a.isSetupComplete(), tiles: a.tiles.length, cuts: a.tiles.reduce((n, t) => n + t.contourIdx.length, 0),
                origins: new Set(a.tiles.map(t => t.origin.x + '_' + t.origin.y)).size, tab: document.querySelector('.ribbon-tab.active')?.dataset.ribbon }; });
        check(`${name}: ${expectTiles} Fliesen erkannt`, r.tiles === expectTiles, r);
        check(`${name}: jede Fliese mit eigenem Nullpunkt`, r.origins === expectTiles, r);
        check(`${name}: alle ${expectTiles} Schnitte vorhanden`, r.cuts === expectTiles, r);
        check(`${name}: Auto-Setup (Nullpunkt gesetzt, Bearbeitung offen)`, r.setup && r.tab === 'bearbeitung', r);
        check(`${name}: keine Konsolenfehler`, errs.length === 0, errs);
        await p.close();
    }
    {   // Fliesenbogen ohne Layer "Fliese": nach "Sortieren" muessen alle 6 Fliesen mit je eigenem Nullpunkt erkannt sein
        const q = await b.newPage({ viewport: { width: 1600, height: 900 } });
        await q.goto('file://' + path.join(ROOT, 'index.html')); await q.waitForTimeout(1500);
        await q.evaluate(c => window.app.loadDXFContent('x.dxf', c, 100), noLayerDxf()); await q.waitForTimeout(3000);
        await q.evaluate(() => document.querySelector('.ribbon-tab[data-ribbon="order"]').click()); await q.waitForTimeout(500);
        await q.evaluate(() => document.getElementById('btn-auto-sort').click()); await q.waitForTimeout(1500);
        const r2 = await q.evaluate(() => ({ tiles: (window.app.tiles || []).length, origins: new Set((window.app.tiles || []).map(t => t.origin.x + '_' + t.origin.y)).size, refs: window.app.contours.filter(c => c.isReference).length }));
        check('Fliesen ohne Layer "Fliese": 6 Fliesen, je eigener Nullpunkt, keine Auto-Referenz', r2.tiles === 6 && r2.origins === 6 && r2.refs === 0, r2);
        await q.close();
    }
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
    await p.goto('file://' + path.join(ROOT, 'index.html')); await p.waitForTimeout(1500);
    await p.evaluate(c => window.app.loadDXFContent('x.dxf', c, 100), PLAIN); await p.waitForTimeout(3000);
    const r = await p.evaluate(() => ({ setup: window.app.isSetupComplete(), refs: window.app.contours.filter(c => c.isReference).length, tab: document.querySelector('.ribbon-tab.active')?.dataset.ribbon }));
    check('Teil ohne Fliesen: Auto-Referenz + Nullpunkt, Bearbeitung offen', r.setup && r.refs === 1 && r.tab === 'bearbeitung', r);
    await b.close();
    process.exit(fail ? 1 : 0);
})();
