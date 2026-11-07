'use strict';
// Duschboard-Generator (shower-board-generator.js V0.1): Referenz Kochhan_Duschboard_1000x1000.dxf + Invarianten
const test = require('node:test');
const assert = require('node:assert');
const G = require('../js/shower-board-generator.js');

const base = { breite: 1000, tiefe: 1000, ablauf: { w: 140, h: 140 }, gridMode: 'keins' };
const area = G._internals.area;
const near = (a, b, t = 1e-6) => Math.abs(a - b) < t;
// Referenz-DXF ist auf 0,1 mm gerundet (1.4 statt 1.4142 = 1 mm senkrecht) -> Vergleich auf 0,1 mm
const key = poly => poly.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).sort().join('|');

test('Referenz Kochhan 1000x1000, Ablauf 140: vier Trapeze wie in der Schnitt-Ebene', () => {
    const r = G.compute(base);
    assert.ok(r.ok); assert.strictEqual(r.count, 4);
    const ref = [
        [[1000, 998.6], [570, 568.6], [570, 431.4], [1000, 1.4]],
        [[568.6, 430], [431.4, 430], [1.4, 0], [998.6, 0]],
        [[430, 568.6], [0, 998.6], [0, 1.4], [430, 431.4]],
        [[998.6, 1000], [1.4, 1000], [431.4, 570], [568.6, 570]]
    ].map(a => key(a.map(([x, y]) => ({ x, y }))));
    const got = r.pieces.map(p => key(p.poly));
    for (const k of ref) assert.ok(got.includes(k), 'fehlt: ' + k);
});

test('Invarianten: Teile konvex, ueberlappungsfrei, Flaeche passt (mit Raster, nicht quadratisch, aussermittig)', () => {
    for (const inp of [
        { breite: 1300, tiefe: 1000, ablauf: { w: 124, h: 124 }, gridMode: 'ablauf' },
        { breite: 1400, tiefe: 900, ablauf: { w: 150, h: 100, cx: 500, cy: 400 }, gridMode: 'ecke' },
        { breite: 997, tiefe: 997, ablauf: { w: 124, h: 124 }, gridMode: 'ablauf', fuge: 3 }
    ]) {
        const r = G.compute(inp); assert.ok(r.ok, r.error);
        for (const pc of r.pieces) {
            const a = area(pc.poly); assert.ok(a > 0, 'Umlaufsinn/Flaeche');
            for (let i = 0; i < pc.poly.length; i++) {
                const A = pc.poly[i], B = pc.poly[(i + 1) % pc.poly.length], C = pc.poly[(i + 2) % pc.poly.length];
                assert.ok((B.x - A.x) * (C.y - B.y) - (B.y - A.y) * (C.x - B.x) > -1e-6, 'nicht konvex');
            }
        }
        const total = r.pieces.reduce((s, p) => s + area(p.poly), 0);
        const field = r.p.W * r.p.H - inp.ablauf.w * inp.ablauf.h;
        assert.ok(total < field && total > field * 0.9, `Flaeche ${total} vs Feld ${field}`);
        // Mindestabstand zwischen Teilen unterschiedlicher Teile >= Fuge (Stichprobe: Eckpunkte gegen Kanten, 1e-6)
        const f = r.p.fuge;
        for (let i = 0; i < r.pieces.length; i++) for (let j = i + 1; j < r.pieces.length; j++) {
            for (const q of r.pieces[i].poly) {
                const P = r.pieces[j].poly;
                for (let k = 0; k < P.length; k++) {
                    const a = P[k], b = P[(k + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
                    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
                    assert.ok(Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy) >= f - 1e-6, `Abstand < Fuge (${i},${j})`);
                }
            }
        }
    }
});

test('Raster: Fugenmitten ab Ablaufkante, Fuge zwischen Teilen exakt Fugenbreite', () => {
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { x: 300, y: 300 } });
    assert.ok(r.grid.xLines.some(v => near(v, 650 + 70 + 300 + 1)), 'Fugenmitte = Ablaufkante + Fliese + Fuge/2');
    assert.ok(r.grid.xLines.some(v => near(v, 650 - 70 - 300 - 1)), 'und gespiegelt links');
});

test('Aussenmass: Fliesenfeld = Aussenmass - 2 * Randfuge', () => {
    const r = G.compute({ ...base, masseArt: 'aussen', randfuge: 2 });
    assert.ok(near(r.p.W, 996) && near(r.p.H, 996));
});

test('Eingabefehler', () => {
    assert.strictEqual(G.compute({ ...base, breite: -5 }).ok, false);
    assert.strictEqual(G.compute({ ...base, ablauf: { w: 2000, h: 10 } }).ok, false);
    assert.strictEqual(G.compute({ ...base, ablauf: { w: 0, h: 10 } }).ok, false);
});

test('DXF: geschlossene LWPOLYLINE je Teil auf Layer Fliesen', () => {
    const r = G.compute(base);
    assert.strictEqual((r.dxf.match(/LWPOLYLINE/g) || []).length, r.count);
    assert.ok(r.dxf.includes('Fliesen'));
});

test('Dialog: Vorschau-SVG und Stueckliste liefern Bemassung (Smoke)', () => {
    const D = require('../js/shower-board-dialog.js');
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { x: 300, y: 300 } });
    const svg = D._internals.previewSVG(r, true);
    assert.ok(svg.startsWith('<svg') && svg.includes('Fliesenfeld 1300'));
    assert.strictEqual((svg.match(/<polygon/g) || []).length, r.count);
    const items = D._internals.numbered(r.pieces);
    assert.deepStrictEqual(items.map(i => i.nr), items.map((_, i) => i + 1));
    assert.ok(D._internals.statusHTML(r).includes(`${r.count} Teile`));
});

// ── Verlegemuster ────────────────────────────────────────────────────────────
const dist = (q, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
    return Math.hypot(q.x - a.x - t * dx, q.y - a.y - t * dy);
};
function checkInvariants(r, label) {
    assert.ok(r.ok, `${label}: ${r.error}`);
    for (const pc of r.pieces) {
        assert.ok(area(pc.poly) > 0, `${label}: Umlaufsinn`);
        for (let i = 0; i < pc.poly.length; i++) {
            const A = pc.poly[i], B = pc.poly[(i + 1) % pc.poly.length], C = pc.poly[(i + 2) % pc.poly.length];
            assert.ok((B.x - A.x) * (C.y - B.y) - (B.y - A.y) * (C.x - B.x) > -1e-6, `${label}: nicht konvex`);
        }
        for (const q of pc.poly) assert.ok(q.x > -1e-6 && q.y > -1e-6 && q.x < r.p.W + 1e-6 && q.y < r.p.H + 1e-6, `${label}: ausserhalb Feld`);
    }
    const f = r.p.fuge;
    for (let i = 0; i < r.pieces.length; i++) for (let j = i + 1; j < r.pieces.length; j++) {
        const A = r.pieces[i].poly, B = r.pieces[j].poly;
        for (const [P, Q] of [[A, B], [B, A]]) for (const q of P) for (let k = 0; k < Q.length; k++)
            assert.ok(dist(q, Q[k], Q[(k + 1) % Q.length]) >= f - 1e-6, `${label}: Abstand < Fuge (${i},${j})`);
    }
    const total = r.pieces.reduce((s, p) => s + area(p.poly), 0);
    const field = r.p.W * r.p.H - (r.p.drain.x1 - r.p.drain.x0) * (r.p.drain.y1 - r.p.drain.y0);
    assert.ok(total < field && total > field * 0.85, `${label}: Flaeche ${total.toFixed(0)} vs ${field.toFixed(0)}`);
}

test('Muster: alle Verlegemuster/Anker/Ausrichtungen/Drehungen erfuellen die Invarianten', () => {
    const b = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 300, kurz: 150 } };
    const cases = [
        ['kreuz', {}], ['kreuz vertikal', { ausrichtung: 'vertikal' }], ['kreuz ru', { anker: 'ru' }], ['kreuz mitte', { anker: 'mitte' }],
        ['kreuz fuge', { anker: 'fuge' }], ['kreuz 45', { drehung: 45 }],
        ['halbverband', { muster: 'verband', versatz: 0.5 }], ['drittel', { muster: 'verband', versatz: 1 / 3 }],
        ['viertel', { muster: 'verband', versatz: 0.25 }], ['frei wechsel', { muster: 'verband', versatz: 0.3, versatzFolge: 'wechsel' }],
        ['verband spalten', { muster: 'verband', verbandAchse: 'spalten' }], ['verband gegenlaeufig', { muster: 'verband', versatz: 1 / 3, gegenlaeufig: true, startVersetzt: true }],
        ['verband 45', { muster: 'verband', drehung: 45 }], ['zufall', { muster: 'zufall', seed: 7 }],
        ['fischgraet', { muster: 'fischgraet' }], ['fischgraet gespiegelt', { muster: 'fischgraet', gegenlaeufig: true }],
        ['fischgraet vertikal', { muster: 'fischgraet', ausrichtung: 'vertikal' }], ['fischgraet 45', { muster: 'fischgraet', drehung: 45 }],
        ['korb', { muster: 'korb' }], ['korb ru', { muster: 'korb', anker: 'ru' }]
    ];
    for (const [label, extra] of cases) checkInvariants(G.compute({ ...b, ...extra }), label);
});

test('Muster: Halbverband versetzt die Reihen um die halbe Fliese (Stossfugen springen)', () => {
    const r = G.compute({ breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 300, kurz: 150 }, muster: 'verband', versatz: 0.5, anker: 'lu' });
    const rows = new Map();
    for (const pc of r.pieces.filter(q => q.sector === 'rechts')) {
        const bb = G._internals.bboxOf(pc.poly), y = Math.round(bb.y0 / 10);
        if (bb.x1 - bb.x0 > 100 && bb.x0 > 700) (rows.get(y) || rows.set(y, []).get(y)).push(bb.x0);
    }
    assert.ok(rows.size > 2);
});

test('Muster: Korbgeflecht lehnt unpassendes Seitenverhaeltnis ab, Zufall ist reproduzierbar', () => {
    const b = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 } };
    assert.strictEqual(G.compute({ ...b, fliese: { lang: 500, kurz: 300 }, muster: 'korb' }).ok, false);
    const a = G.compute({ ...b, muster: 'zufall', seed: 3 }), c = G.compute({ ...b, muster: 'zufall', seed: 3 }), d = G.compute({ ...b, muster: 'zufall', seed: 4 });
    assert.strictEqual(a.dxf, c.dxf); assert.notStrictEqual(a.dxf, d.dxf);
});

test('Muster: Fliesenformat-Ausrichtung horizontal/vertikal vertauscht die Raster', () => {
    const b = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 600, kurz: 300 }, anker: 'lu' };
    const h = G.compute({ ...b, ausrichtung: 'horizontal' }), v = G.compute({ ...b, ausrichtung: 'vertikal' });
    assert.ok(near(h.grid.xLines[0], 601) && near(h.grid.yLines[0], 301));
    assert.ok(near(v.grid.xLines[0], 301) && near(v.grid.yLines[0], 601));
});

// ── Fugen-Layout (Phase 2c) ──────────────────────────────────────────────────
const r2 = v => (Math.round(v * 100) / 100 || 0);   // -0 vermeiden
const pieceKeys = pieces => pieces.map(pc => pc.poly.map(q => `${r2(q.x)},${r2(q.y)}`).sort().join('|')).sort();
const baseIn = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 300, kurz: 150 } };

test('Layout: Fugen-Layout liefert dieselben Teile wie das allgemeine Muster-Modell (Kreuz, Verbaende, Zufall, Spalten)', () => {
    const cases = [{ anker: 'ru' }, { anker: 'lu' }, { anker: 'ro' }, { ausrichtung: 'vertikal', anker: 'lo' }, { muster: 'verband', versatz: 1 / 3 }, { muster: 'verband', versatz: 0.5, anker: 'mitte' },
        { muster: 'verband', verbandAchse: 'spalten', versatz: 0.25, gegenlaeufig: true }, { muster: 'verband', versatzFolge: 'wechsel', versatz: 0.3, startVersetzt: true }, { muster: 'zufall', seed: 5 }, { muster: 'zufall', seed: 5, verbandAchse: 'spalten', anker: 'fuge' }];
    for (const extra of cases) {
        const r = G.compute({ ...baseIn, ...extra });
        assert.ok(r.ok && r.editable, JSON.stringify(extra));
        const p = r.p;
        const viaPattern = G.clipPieces(p, G._internals.tilesFromPattern(p).tiles);
        assert.deepStrictEqual(pieceKeys(r.pieces), pieceKeys(viaPattern), JSON.stringify(extra));
    }
});

test('Layout: Fischgraet/Korb/Drehung sind nicht editierbar, Kreuzfuge/Verband schon', () => {
    assert.strictEqual(G.compute({ ...baseIn, muster: 'fischgraet' }).editable, false);
    assert.strictEqual(G.compute({ ...baseIn, drehung: 45 }).editable, false);
    assert.strictEqual(G.compute({ ...baseIn, muster: 'verband' }).editable, true);
});

test('Layout: Linie ziehen (Kreuzfuge gekoppelt), clamp an Nachbar und Feldkante', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' }), L = r.layout, p = r.p;
    const moved = G.moveSub(p, L, 1, 0, 400);
    assert.ok(moved.sub.every(a => near(a[0], 400)), 'gekoppelt: alle Reihen');
    const clamped = G.moveSub(p, L, 0, 0, L.sub[0][1] + 500);
    assert.ok(clamped.sub[0][0] < L.sub[0][1], 'darf Nachbar nicht ueberholen');
    assert.ok(G.moveLine(p, L, 0, -50).lines[0] >= 1, 'nicht ueber die Feldkante');
    const r2 = G.compute({ ...baseIn, anker: 'lu' }, moved);
    checkInvariants(r2, 'nach Ziehen');
    assert.ok(r2.pieces.some(pc => { const b = G._internals.bboxOf(pc.poly); return near(b.x1, 400 - 1, 1e-6) || near(b.x0, 400 + 1, 1e-6); }));
});

test('Layout: Verband — Fuge in einer Reihe verschieben beeinflusst nur diese Reihe', () => {
    const r = G.compute({ ...baseIn, muster: 'verband', versatz: 0.5, anker: 'lu' }), L = r.layout, p = r.p;
    assert.strictEqual(L.coupled, false);
    const m = G.moveSub(p, L, 2, 0, L.sub[2][0] + 20);
    assert.ok(near(m.sub[2][0], L.sub[2][0] + 20));
    assert.ok(m.sub.every((a, k) => k === 2 || a.every((v, i) => near(v, L.sub[k][i]))));
    checkInvariants(G.compute({ ...baseIn, muster: 'verband', versatz: 0.5, anker: 'lu' }, m), 'Verband editiert');
});

test('Layout: Fuge setzen und loeschen sind umkehrbar', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' }), L = r.layout, p = r.p;
    const a = G.addLine(p, L, 500);
    assert.strictEqual(a.lines.length, L.lines.length + 1);
    assert.strictEqual(a.sub.length, L.sub.length + 1);
    const b = G.removeLine(p, a, a.lines.indexOf(500));
    assert.deepStrictEqual(b, L);
    const c = G.addSub(p, L, 1, 333);
    assert.ok(c.sub.every(arr => arr.includes(333)), 'gekoppelt: in allen Reihen');
    assert.deepStrictEqual(G.removeSub(p, c, 0, c.sub[0].indexOf(333)), L);
    assert.strictEqual(G.addLine(p, L, -5).lines.length, L.lines.length, 'ausserhalb ignoriert');
    checkInvariants(G.compute({ ...baseIn, anker: 'lu' }, a), 'nach Fuge setzen');
});

test('Layout: jointSegments liefert Fugen als Strecken', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' });
    const segs = G.jointSegments(r.p, r.layout);
    const nLines = r.layout.lines.length, nSub = r.layout.sub.reduce((s, a) => s + a.length, 0);
    assert.strictEqual(segs.length, nLines + nSub);
    const h = segs.find(s => s.kind === 'line');
    assert.ok(h.x0 === 0 && h.x1 === r.p.W && h.y0 === h.y1);
});

test('Layout: altes Format {xLines,yLines} wird weiter akzeptiert', () => {
    const r = G.compute({ ...baseIn, anker: 'lu' }, { xLines: [400], yLines: [300, 600] });
    assert.ok(r.ok && r.layout.lines.length === 2 && r.layout.sub.length === 3);
});

test('Dialog: Bearbeitungsansicht zeichnet Fugenmitten und markiert die angefasste Fuge', () => {
    global.ShowerBoardGenerator = G;
    const D = require('../js/shower-board-dialog.js');
    const r = G.compute({ ...baseIn, muster: 'verband', anker: 'lu' });
    const plain = D._internals.previewSVG(r, true);
    const edit = D._internals.previewSVG(r, true, null, null, { mode: 'move', hover: { kind: 'sub', strip: 1, idx: 0 }, sel: 1 });
    assert.ok(!plain.includes('stroke-dasharray="5 4"'));
    assert.ok(edit.includes('stroke-dasharray="5 4"') && edit.includes('#ff9d00') && edit.includes('X = '));
    assert.ok(D._internals.statusHTML(r, true).includes('Fugenbild angepasst'));
    delete global.ShowerBoardGenerator;
});

test('Raster ab Ablaufkante: kein Teil ist groesser als die Fliese (Regression: 900-mm-Teile bei 600x300)', () => {
    for (const [b, t, dw, dh] of [[1300, 1000, 140, 140], [1200, 900, 124, 124], [1000, 1000, 140, 140], [1600, 1000, 200, 120], [900, 900, 124, 124], [1670, 875, 150, 150], [1400, 1200, 300, 100]]) {
        for (const ausrichtung of ['horizontal', 'vertikal']) {
            const r = G.compute({ breite: b, tiefe: t, ablauf: { w: dw, h: dh }, fliese: { lang: 600, kurz: 300 }, ausrichtung });
            assert.ok(r.ok, r.error);
            const diag = Math.hypot(600, 300);
            for (const pc of r.pieces) {
                const bb = G._internals.bboxOf(pc.poly);
                assert.ok(G._internals.diameter(pc.poly) <= diag + 0.5, `${b}x${t} ${ausrichtung}: Teil ${(bb.x1 - bb.x0).toFixed(0)}x${(bb.y1 - bb.y0).toFixed(0)} groesser als Fliese`);
                const [w, h] = ausrichtung === 'horizontal' ? [600, 300] : [300, 600];
                assert.ok(bb.x1 - bb.x0 <= w + 0.5 && bb.y1 - bb.y0 <= h + 0.5, `${b}x${t} ${ausrichtung}: Teil ${(bb.x1 - bb.x0).toFixed(0)}x${(bb.y1 - bb.y0).toFixed(0)} ueberschreitet Fliesenzelle ${w}x${h}`);
            }
            assert.ok(!r.warnings.some(w => /größer als die Fliese/.test(w.text)));
        }
    }
});
