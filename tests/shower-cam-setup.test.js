'use strict';
// Nach dem Erzeugen: Kerf-Seite je Schnitt (Abfallseite, G41/G42), Nullpunkt je Fliese, Fliesen = Referenz — in der echten App (jsdom).
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/shower-board-generator.js');
const { bootApp } = require('./helpers/app-boot.js');

const input = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } };

test('kerfForPath: Zuordnung per Anfang/Ende, umgekehrte Richtung kehrt die Seite um, kein Treffer -> null', () => {
    const r = G.compute(input);
    const c = r.cuts.find(x => x.parts.length === 2);
    const [a, b] = c.parts;
    assert.equal(G.kerfForPath(a, r.cuts), 'right'); assert.equal(G.kerfForPath(b, r.cuts), 'left');
    assert.equal(G.kerfForPath(a.slice().reverse(), r.cuts), 'left');
    assert.equal(G.kerfForPath([{ x: 1e5, y: 1e5 }, { x: 1e5 + 5, y: 1e5 }], r.cuts), null);
    assert.equal(G.kerfForPath(null, r.cuts), null);
});

test('Kerf-Seite: bei jedem Schnitt liegt das Teil auf der Gegenseite des Werkzeugs (Abfallseite)', () => {
    for (const inp of [input, { ...input, fliese: { lang: 600, kurz: 300 }, muster: 'verband' }, { ...input, muster: 'keins' }]) {
        const r = G.compute(inp);
        for (const c of r.cuts) c.parts.forEach((part, i) => {
            const cen = c.piece.reduce((s, q) => ({ x: s.x + q.x / c.piece.length, y: s.y + q.y / c.piece.length }), { x: 0, y: 0 });
            for (let k = 1; k < part.length; k++) {
                const p0 = part[k - 1], p1 = part[k];
                if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 10) continue;
                const pieceLeft = (p1.x - p0.x) * (cen.y - p0.y) - (p1.y - p0.y) * (cen.x - p0.x) > 0;
                assert.equal(c.kerf[i], pieceLeft ? 'right' : 'left', 'Werkzeug (G41 links/G42 rechts) muss auf der Abfallseite laufen');
                break;
            }
        });
    }
});

test('CAM-Einrichtung in der echten App: Kerf-Seite aller Schnitte, Nullpunkt je Fliese (links unten), Fliesenumrisse als Referenz, G41/G42 im Postprozessor', async () => {
    const { w, app, close } = await bootApp();
    try {
        const r = G.compute(input);
        app.loadDXFContent('Duschboard_test.dxf', r.dxf, '10');
        const D = w.eval('ShowerBoardDialog');
        const res = await D.camSetupAfterLoad(app, r);
        assert.ok(res, 'Konturen wurden geladen');
        assert.equal(res.fliesen, r.tilesUsed);
        assert.equal(res.offen, r.cutCount); assert.equal(res.kerf, r.cutCount, 'jeder Schnitt bekam seine Kerf-Seite');
        // Nullpunkt je Fliese
        assert.equal(app.tiles.length, r.tilesUsed);
        for (const t of app.tiles) { assert.equal(t.origin.x, t.bbox.minX); assert.equal(t.origin.y, t.bbox.minY); assert.equal(t.originAuto, true); }
        assert.equal(app.settings.originSet, true);
        // Kerf je Schnitt + Postprozessor
        const SP = w.eval('SinumerikPostprocessor'), pp = new SP({});
        const cuts = app.contours.filter(c => c.layer === 'Schnitt');
        assert.equal(cuts.length, r.cutCount);
        for (const c of cuts) {
            assert.ok(c.kerfComp === 'left' || c.kerfComp === 'right');
            assert.equal(c.cuttingMode, 'slit');
            assert.equal(pp._getKerfCode(c), c.kerfComp === 'left' ? 'G41' : 'G42', 'G41 = Werkzeug links, G42 = rechts');
            assert.equal(c.resolveKerfSide(), c.kerfComp);
            assert.ok(c.kerfWidth > 0);
        }
        // Fliesenumrisse: im CAD bearbeitbar, in CAM Referenz
        const tiles = app.contours.filter(c => c.layer === 'Fliesen');
        assert.equal(tiles.length, r.tilesUsed);
        w.eval('CeraCutPipeline').restoreTileRefs(app.contours);
        assert.ok(tiles.every(c => c.isReference), 'in CAM sind die Fliesenumrisse Referenz');
    } finally { close(); }
});

test('CamContour: Kerf-Seite eines offenen Schnitts (Slit) haengt nicht von der Geometrie ab — links = G41, rechts = G42', () => {
    const F = require('./helpers/contour-fixtures.js');
    const pts = {
        zweiPunkt: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
        knick: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }],
        knickRueck: [{ x: 100, y: 50 }, { x: 100, y: 0 }, { x: 0, y: 0 }]
    };
    for (const [n, p] of Object.entries(pts)) for (const comp of ['left', 'right']) {
        const c = new F.CamContour(p.map(q => ({ ...q })), { cuttingMode: 'slit', kerfWidth: 0.8, isClosed: false, kerfComp: comp });
        assert.equal(c.resolveKerfSide(), comp, `${n}/${comp}`);
        assert.equal(c._effectiveFlip(), comp === 'left', `${n}/${comp}: G41 (links) = Flip`);
    }
    const auto = new F.CamContour(pts.zweiPunkt.map(q => ({ ...q })), { cuttingMode: 'slit', kerfWidth: 0.8, isClosed: false });
    assert.equal(auto.resolveKerfSide(), 'right', 'ohne Vorgabe: G42 wie bisher');
});
