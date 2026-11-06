'use strict';
// Abnahme gegen die Waricam-Referenz HEIDE6000101587 (CNC + DXF). Uebersprungen, falls die Dateien fehlen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const F = require('./helpers/contour-fixtures.js');
const AF = require('../js/arc-fitting.js');
global.ArcFitting = AF.ArcFitting;
const DXF = require('../js/dxf-parser.js');
const PP = require('../js/sinumerik-postprocessor.js');

const CNC = '/mnt/cnc/HEIDE6000101587.CNC';
const DXF_FILE = '/mnt/dxf/Firmen/Heide/Heide6000101587.dxf';
const have = fs.existsSync(CNC) && fs.existsSync(DXF_FILE);

function parseBlock(code, n) {
    const L = code.split('\n');
    const i0 = L.findIndex(l => l.startsWith(`CONTOUR${n}:`));
    const i1 = L.findIndex((l, i) => i > i0 && /\bL205\b/.test(l));
    const num = (l, k) => { const m = l.match(new RegExp(`\\b${k}(-?\\d+(?:\\.\\d+)?)`)); return m ? +m[1] : null; };
    let pos = null; const segs = [];
    for (let i = i0; i < i1; i++) {
        const l = L[i]; const g = l.match(/\bG0([0-3])\b/); if (!g) continue;
        const x = num(l, 'X'), y = num(l, 'Y');
        if (g[1] === '0') { pos = { x, y }; segs.push({ g: 0, p0: pos, p1: pos }); continue; }
        const p0 = pos, p1 = { x, y };
        const s = { g: +g[1], p0, p1, comp: /\bG4[012]\b/.exec(l)?.[0] || null };
        if (g[1] !== '1') { s.c = { x: p0.x + num(l, 'I'), y: p0.y + num(l, 'J') }; }
        segs.push(s); pos = p1;
    }
    return segs;
}
const len = s => {
    if (s.g === 1) return Math.hypot(s.p1.x - s.p0.x, s.p1.y - s.p0.y);
    const r = Math.hypot(s.p0.x - s.c.x, s.p0.y - s.c.y);
    let a = Math.atan2(s.p1.y - s.c.y, s.p1.x - s.c.x) - Math.atan2(s.p0.y - s.c.y, s.p0.x - s.c.x);
    a = s.g === 3 ? ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) : ((-a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return r * a;
};

test('Waricam-Referenz Langloch: Lead-In 3 mm senkrecht auf Konturstart, Ueberschnitt 3 mm, Lead-Out 1 mm — wie Waricam', { skip: !have && 'Referenzdateien fehlen' }, () => {
    // --- Referenz (Waricam) ---
    const ref = parseBlock(fs.readFileSync(CNC, 'latin1'), 1);
    const refIn = ref[1];                       // G41 G01
    const refOut = ref[ref.length - 1];         // G40 G01
    assert.equal(refIn.comp, 'G41'); assert.equal(refOut.comp, 'G40');
    const refLeadIn = len(refIn), refLeadOut = len(refOut), refOver = len(ref[ref.length - 2]);
    assert.ok(Math.abs(refLeadIn - 3) < 0.01 && Math.abs(refLeadOut - 1) < 0.01 && Math.abs(refOver - 3) < 0.01, 'Referenzwerte 3/3/1');
    // Lead-In endet exakt auf dem Kreis r=14 (Geometrie, nicht Offset)
    const c0 = ref[2].c; assert.ok(Math.abs(Math.hypot(refIn.p1.x - c0.x, refIn.p1.y - c0.y) - 14) < 0.001);

    // --- CeraCUT mit denselben Parametern auf demselben DXF-Langloch ---
    const res = DXF.parse(fs.readFileSync(DXF_FILE, 'latin1'), {});
    const stadium = DXF.chainContours(res.entities, 0.1).find(c => c.isClosed && c.points.length > 80 && c.points.length < 100);
    assert.ok(stadium, 'Langloch im DXF');
    const OX = 136.122697310907 - 124.5, OY = 304.5922174 - 32.0;
    const c = new F.CamContour(stadium.points.map(p => ({ ...p })), { cuttingMode: 'hole', kerfWidth: 0.8, isClosed: true,
        leadInType: 'linear', leadInAngle: 90, leadInLength: 3, leadOutType: 'linear', leadOutAngle: 90, leadOutLength: 1, overcutLength: 3 });
    c.setStartPoint({ x: 134.399 + OX, y: 22.101 + OY });
    const code = new PP().generate([c], [0], { planName: 'T', origin: { x: OX, y: OY } }).code;
    const our = parseBlock(code, 1);
    const ourIn = our[1], ourOut = our[our.length - 1];
    assert.equal(ourIn.comp, 'G41'); assert.equal(ourOut.comp, 'G40');
    assert.ok(Math.abs(len(ourIn) - refLeadIn) < 0.005, `Lead-In ${len(ourIn)} vs ${refLeadIn}`);
    assert.ok(Math.abs(len(ourOut) - refLeadOut) < 0.005, `Lead-Out ${len(ourOut)} vs ${refLeadOut}`);
    assert.ok(Math.abs(len(our[our.length - 2]) - refOver) < 0.05, `Ueberschnitt ${len(our[our.length - 2])} vs ${refOver}`);
    // Struktur: G00, G41 G01, Kontur..., G40 G01 — und der Lead-In endet auf dem Konturstart (kein Sprung)
    assert.equal(our[0].g, 0);
    assert.ok(Math.hypot(our[our.length - 3].p1.x - our[1].p1.x, our[our.length - 3].p1.y - our[1].p1.y) < 3.2, 'Ueberschnitt beginnt am Konturstart');
    // Lead-In steht senkrecht auf der Kontur (Waricam: 90 Grad): Richtung ~ Radialrichtung zum Mittelpunkt des Halbkreises
    const sc = ref[2].c; const refDir = { x: refIn.p1.x - refIn.p0.x, y: refIn.p1.y - refIn.p0.y };
    const refRad = { x: refIn.p1.x - sc.x, y: refIn.p1.y - sc.y };
    const cosRef = (refDir.x * refRad.x + refDir.y * refRad.y) / (Math.hypot(refDir.x, refDir.y) * Math.hypot(refRad.x, refRad.y));
    assert.ok(Math.abs(Math.abs(cosRef) - 1) < 0.01, 'Waricam Lead-In steht radial (=senkrecht zur Kontur)');
    const ourCtr = our.find(s => s.g === 3).c;
    const ourDir = { x: ourIn.p1.x - ourIn.p0.x, y: ourIn.p1.y - ourIn.p0.y };
    const ourRad = { x: ourIn.p1.x - ourCtr.x, y: ourIn.p1.y - ourCtr.y };
    const cosOur = (ourDir.x * ourRad.x + ourDir.y * ourRad.y) / (Math.hypot(ourDir.x, ourDir.y) * Math.hypot(ourRad.x, ourRad.y));
    assert.ok(Math.abs(Math.abs(cosOur) - 1) < 0.05, `CeraCUT Lead-In steht radial, cos=${cosOur}`);
    assert.equal(Math.sign(cosOur), Math.sign(cosRef), 'gleiche Seite (Abfall innen)');
});
