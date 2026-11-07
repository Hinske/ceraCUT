const test = require('node:test');
const assert = require('node:assert');
const N = require('../js/nesting.js');

const quiet = fn => { const l = console.log, w = console.warn, d = console.debug; console.log = console.warn = console.debug = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; console.debug = d; } };
const rect = (w, h, extra = {}) => ({ points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], isClosed: true, ...extra });
const circ = (R, n, extra = {}) => ({ points: Array.from({ length: n }, (_, i) => ({ x: R + R * Math.cos(i / n * 2 * Math.PI), y: R + R * Math.sin(i / n * 2 * Math.PI) })), isClosed: true, ...extra });
const mix = n => Array.from({ length: n }, (_, i) => i % 3 === 0 ? rect(120 + i % 7 * 10, 80) : i % 3 === 1 ? circ(40 + i % 5 * 5, 48) : rect(60, 60 + i % 4 * 15));
const clone = items => items.map(c => ({ ...c, points: c.points.map(p => ({ ...p })) }));

const bb = pts => ({ minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)), minY: Math.min(...pts.map(p => p.y)), maxY: Math.max(...pts.map(p => p.y)) });
function segDist(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }
function minDist(A, B) { let m = Infinity; for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let j = 0; j < Q.length; j++) m = Math.min(m, segDist(p, Q[j], Q[(j + 1) % Q.length])); return m; }

test('Platzierungen: im Blech, ohne Überlappung, Mindestabstand eingehalten (150 gemischte Teile, 2 Bleche)', () => {
    const items = mix(150);
    const cfg = { sheetWidth: 900, sheetHeight: 600, sheetMargin: 8, spacing: 4, maxSheets: 10 };
    const r = quiet(() => N.nest(items, cfg));
    assert.strictEqual(r.unplaced.length, 0);
    assert.ok(r.sheets.length >= 2);
    const placed = clone(items);
    quiet(() => N.applyPlacements(placed, r.placements));
    const polys = r.placements.map(pl => ({ sheet: pl.sheetIndex, pts: placed[pl.contourIndex].points, box: bb(placed[pl.contourIndex].points) }));
    for (const p of polys) {
        assert.ok(p.box.minX >= 8 - 1e-6 && p.box.minY >= 8 - 1e-6 && p.box.maxX <= 892 + 1e-6 && p.box.maxY <= 592 + 1e-6, 'Rand eingehalten');
    }
    let checked = 0;
    for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
        const a = polys[i], b = polys[j];
        if (a.sheet !== b.sheet) continue;
        if (a.box.maxX + 4 < b.box.minX || b.box.maxX + 4 < a.box.minX || a.box.maxY + 4 < b.box.minY || b.box.maxY + 4 < a.box.minY) continue;
        assert.ok(minDist(a.pts, b.pts) >= 4 - 0.01, `Abstand Teil ${i}/${j}`);
        checked++;
    }
    assert.ok(checked > 40, `es wurden viele Nachbarpaare geprüft (${checked})`);
});

test('Auch bei 45°-Drehungen: kein Überlappen, Mindestabstand', () => {
    const items = mix(40).map(c => ({ ...c, rotationSteps: [0, 45, 90, 135, 180, 225, 270, 315] }));
    const r = quiet(() => N.nest(items, { sheetWidth: 600, sheetHeight: 400, sheetMargin: 5, spacing: 3, maxSheets: 6 }));
    assert.strictEqual(r.unplaced.length, 0);
    const placed = clone(items);
    quiet(() => N.applyPlacements(placed, r.placements));
    const polys = r.placements.map(pl => ({ sheet: pl.sheetIndex, pts: placed[pl.contourIndex].points, box: bb(placed[pl.contourIndex].points) }));
    for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
        const a = polys[i], b = polys[j];
        if (a.sheet !== b.sheet || a.box.maxX + 3 < b.box.minX || b.box.maxX + 3 < a.box.minX || a.box.maxY + 3 < b.box.minY || b.box.maxY + 3 < a.box.minY) continue;
        assert.ok(minDist(a.pts, b.pts) >= 3 - 0.02, `Abstand Teil ${i}/${j}`);
    }
});

test('Feine Konturen (400 Punkte, Drehung 45°/90°): Polygon-Vereinfachung hält den echten Mindestabstand ein', () => {
    const blob = (R, n, extra) => ({ points: Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI, r = R * (1 + 0.25 * Math.sin(5 * a)); return { x: R + r * Math.cos(a), y: R + r * Math.sin(a) }; }), isClosed: true, ...extra });
    for (const steps of [[0, 90, 180, 270], [0, 45, 90, 135, 180, 225, 270, 315]]) {
        const items = Array.from({ length: 40 }, (_, i) => i % 2 ? rect(90 + i % 5 * 10, 60, { rotationSteps: steps }) : blob(40 + i % 4 * 5, 400, { rotationSteps: steps }));
        const r = quiet(() => N.nest(items, { sheetWidth: 700, sheetHeight: 400, sheetMargin: 6, spacing: 3, maxSheets: 6 }));
        assert.strictEqual(r.unplaced.length, 0);
        const placed = clone(items);
        quiet(() => N.applyPlacements(placed, r.placements));
        const polys = r.placements.map(pl => ({ sheet: pl.sheetIndex, pts: placed[pl.contourIndex].points, box: bb(placed[pl.contourIndex].points) }));
        let near = 0;
        for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
            const a = polys[i], b = polys[j];
            if (a.sheet !== b.sheet || a.box.maxX + 3 < b.box.minX || b.box.maxX + 3 < a.box.minX || a.box.maxY + 3 < b.box.minY || b.box.maxY + 3 < a.box.minY) continue;
            assert.ok(minDist(a.pts, b.pts) >= 3 - 0.01, `Abstand Teil ${i}/${j} bei ${steps.length} Drehungen: ${minDist(a.pts, b.pts).toFixed(3)}`);
            near++;
        }
        assert.ok(near > 20);
    }
});

test('Vereinfachung beschleunigt feine Teile deutlich, ohne die Packung zu verschlechtern', () => {
    const blob = (R, n) => ({ points: Array.from({ length: n }, (_, i) => { const a = i / n * 2 * Math.PI, r = R * (1 + 0.25 * Math.sin(5 * a)); return { x: R + r * Math.cos(a), y: R + r * Math.sin(a) }; }), isClosed: true });
    const items = Array.from({ length: 80 }, (_, i) => i % 2 ? rect(100 + i % 5 * 12, 70) : blob(45 + i % 4 * 6, 400));
    const cfg = { sheetWidth: 1500, sheetHeight: 800, sheetMargin: 5, spacing: 3, maxSheets: 20 };
    const time = (c) => { let best = Infinity, r; for (let k = 0; k < 2; k++) { const t = Date.now(); r = quiet(() => N.nest(clone(items), c)); best = Math.min(best, Date.now() - t); } return { best, r }; };   // beste von 2 (Last durch parallele Tests)
    const { best: tFast, r: fast } = time(cfg);
    const { best: tSlow, r: slow } = time({ ...cfg, simplifyTol: 0 });
    assert.ok(tFast * 1.3 < tSlow, `mit ${tFast} ms, ohne ${tSlow} ms`);
    assert.ok(fast.sheets.length <= slow.sheets.length + 0);
    assert.ok(Math.abs(fast.totalUtilization - slow.totalUtilization) < 3);
});

test('typeKey optional: gleiche Teile mit/ohne expliziten Schlüssel → identisches Ergebnis', () => {
    const base = mix(60);
    const cfg = { sheetWidth: 1000, sheetHeight: 500, sheetMargin: 5, spacing: 3, maxSheets: 5 };
    const a = quiet(() => N.nest(clone(base), cfg));
    const keyed = clone(base).map(c => ({ ...c, typeKey: 'T' + JSON.stringify(c.points) }));
    const b = quiet(() => N.nest(keyed, cfg));
    assert.deepStrictEqual(b.placements.map(p => [p.contourIndex, p.sheetIndex, p.position.x, p.position.y, p.rotation]),
                           a.placements.map(p => [p.contourIndex, p.sheetIndex, p.position.x, p.position.y, p.rotation]));
});

test('Fortschritts-Callback und Laufzeit bei 500 Teilen', () => {
    const calls = [];
    const t0 = Date.now();
    const r = quiet(() => N.nest(mix(500), { sheetWidth: 3000, sheetHeight: 1500, sheetMargin: 5, spacing: 3, maxSheets: 20,
        onProgress: (done, total, sheets) => calls.push([done, total, sheets]) }));
    assert.strictEqual(r.unplaced.length, 0);
    assert.deepStrictEqual(calls.at(-1).slice(0, 2), [500, 500]);
    assert.ok(calls.length >= 100);
    assert.ok(Date.now() - t0 < 20000, `500 Teile in ${Date.now() - t0} ms (vorher ~80 s)`);
});

test('Teil, das nicht aufs Blech passt, erzeugt keine Leer-Blech-Flut', () => {
    const items = [rect(5000, 5000), rect(5000, 5000), rect(100, 100)];
    const r = quiet(() => N.nest(items, { sheetWidth: 1000, sheetHeight: 500, sheetMargin: 5, spacing: 3, maxSheets: 50 }));
    assert.deepStrictEqual([...r.unplaced].sort(), [0, 1]);
    assert.strictEqual(r.sheets.length, 1);
    assert.strictEqual(r.placements.length, 1);
});

test('Gleichmäßige Fugen: jedes Teil liegt am nächsten Nachbarn mit der eingestellten Fuge (nicht 3…8 mm)', () => {
    // Achteck-ähnliche Teile (abgeschrägte Ecken) in zwei Größen: BBox-Abstand ≠ Konturabstand
    const octa = (w, h, c) => ({ points: [[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]].map(([x, y]) => ({ x, y })), isClosed: true });
    const items = Array.from({ length: 60 }, (_, i) => i % 3 === 0 ? octa(90, 140, 25) : octa(140, 140, 30));
    const spacing = 3;
    const r = quiet(() => N.nest(items, { sheetWidth: 1200, sheetHeight: 700, sheetMargin: 5, spacing, maxSheets: 3 }));
    assert.strictEqual(r.unplaced.length, 0);
    const placed = clone(items);
    quiet(() => N.applyPlacements(placed, r.placements));
    const polys = r.placements.map(pl => ({ sheet: pl.sheetIndex, pts: placed[pl.contourIndex].points, box: bb(placed[pl.contourIndex].points) }));
    const nn = polys.map((a, i) => {
        let best = Infinity;
        polys.forEach((b, j) => {
            if (i === j || a.sheet !== b.sheet || a.box.maxX + 40 < b.box.minX || b.box.maxX + 40 < a.box.minX || a.box.maxY + 40 < b.box.minY || b.box.maxY + 40 < a.box.minY) return;
            best = Math.min(best, minDist(a.pts, b.pts));
        });
        return best;
    }).filter(Number.isFinite);
    assert.ok(nn.length > 50);
    assert.ok(Math.min(...nn) >= spacing - 0.01, `Mindestabstand ${Math.min(...nn).toFixed(2)}`);
    const loose = nn.filter(v => v > spacing + 0.6).length;
    assert.ok(loose <= nn.length * 0.05, `${loose} von ${nn.length} Teilen haben mehr als ${spacing + 0.6} mm Abstand zum nächsten Nachbarn (max ${Math.max(...nn).toFixed(1)})`);
});

test('Common-Line: Rechtecke mit Flag liegen im Abstand = Schnittspalt (0,8 mm), ohne Flag bleibt die Fuge, gemischt = Fuge', () => {
    const run = (flagA, flagB, n = 3) => {
        const items = [rect(100, 50, { commonLine: flagA }), rect(100, 50, { commonLine: flagB }), rect(100, 50, { commonLine: flagA })].slice(0, n);
        const r = quiet(() => N.nest(items, { sheetWidth: 400, sheetHeight: 120, sheetMargin: 5, spacing: 3, rotationSteps: [0] }));
        assert.strictEqual(r.unplaced.length, 0);
        const boxes = r.placements.map(p => p.bbox).sort((a, b) => a.minX - b.minX || a.minY - b.minY);
        const gaps = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            const gx = Math.max(b.minX - a.maxX, a.minX - b.maxX), gy = Math.max(b.minY - a.maxY, a.minY - b.maxY);
            gaps.push(Math.max(gx, gy));
        }
        return Math.min(...gaps);
    };
    assert.ok(Math.abs(run(true, true) - 0.8) < 1e-6, 'Abstand = Schnittspalt');
    assert.ok(run(false, false) >= 3 - 0.01, 'Fuge ohne Flag');
    assert.ok(run(true, false, 2) >= 3 - 0.01, 'gemischt (Flag + ohne Flag): Fuge');
});

test('Common-Line: Nicht-Rechtecke (Kreis) mit Flag behalten die Fuge', () => {
    const items = [circ(30, 48, { commonLine: true }), circ(30, 48, { commonLine: true })];
    const r = quiet(() => N.nest(items, { sheetWidth: 300, sheetHeight: 100, sheetMargin: 5, spacing: 3, rotationSteps: [0] }));
    const placed = clone(items);
    quiet(() => N.applyPlacements(placed, r.placements));
    assert.ok(minDist(placed[0].points, placed[1].points) >= 3 - 0.01);
});
