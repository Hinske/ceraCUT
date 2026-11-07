const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { NCCheck, NCReport } = require('../js/nc-tools.js');

const wrap = body => `%_N_T_MPF\n;LAENGE MM :100.00\n;BREITE MM :50.00\nG90 G00\n${body}\nM30\n`;
const codes = r => r.issues.map(i => i.code);

test('Waricam-Referenz-CNC: fehlerfrei, Kennzahlen', { skip: !fs.existsSync('/mnt/cnc/HEIDE6000101587.CNC') }, () => {
    const r = NCCheck.parse(fs.readFileSync('/mnt/cnc/HEIDE6000101587.CNC', 'latin1'));
    assert.deepStrictEqual(r.issues, []);
    assert.deepStrictEqual(r.programs.map(p => p.type), ['MPF', 'SPF', 'SPF']);
    assert.deepStrictEqual(r.counts, { G00: 6, G01: 14, G02: 7, G03: 19 });
    assert.deepStrictEqual(r.sheet, { L: 159.6, B: 131.49 });
});

test('Längen: Linie, Halbkreis (G02/G03), Vollkreis, inkremental', () => {
    const r = NCCheck.parse(wrap('G00 X0 Y0\nG01 X30 Y40\nG02 X10 Y0 I-30 J-40\nG91 G01 X3 Y4\nG90'));
    assert.ok(Math.abs(r.rapidLength - 0) < 1e-9);
    // G01: 50 ; G02 von (30,40) nach (10,0) mit Mittelpunkt (0,0) r=50 → Bogen ; G91: 5
    assert.ok(r.cutLength > 50 + 5);
    const half = NCCheck.parse(wrap('G00 X0 Y0\nG03 X20 Y0 I10 J0'));      // Halbkreis r=10 gegen den UZS
    assert.ok(Math.abs(half.cutLength - Math.PI * 10) < 1e-6, half.cutLength);
    const full = NCCheck.parse(wrap('G00 X10 Y0\nG03 X10 Y0 I-10 J0'));
    assert.ok(Math.abs(full.cutLength - 2 * Math.PI * 10) < 1e-6);
    const inc = NCCheck.parse(wrap('G00 X0 Y0\nG91 G01 X3 Y4'));
    assert.ok(Math.abs(inc.cutLength - 5) < 1e-9);
});

test('Fehler: Kreis ohne I/J, Radius inkonsistent, NaN, Ende fehlt, Marke fehlt', () => {
    assert.ok(codes(NCCheck.parse(wrap('G00 X0 Y0\nG02 X10 Y0'))).includes('ARC_NO_IJ'));
    assert.ok(codes(NCCheck.parse(wrap('G00 X0 Y0\nG02 X10 Y0 I5 J0'))).includes('ARC_RADIUS') === false);   // r=5 → Ende r=5 ok
    assert.ok(codes(NCCheck.parse(wrap('G00 X0 Y0\nG02 X10 Y2 I5 J3'))).includes('ARC_RADIUS'));
    assert.ok(codes(NCCheck.parse(wrap('G01 XNaN Y0\nG01 X5 Y=undefined'))).includes('NON_FINITE'));
    assert.ok(codes(NCCheck.parse('%_N_T_MPF\nG90 G00\nG01 X1 Y1\n')).includes('NO_END'));
    assert.ok(codes(NCCheck.parse(wrap('GOTOF NIRGENDS'))).includes('LABEL_MISSING'));
    assert.ok(codes(NCCheck.parse('G01 X1 Y1')).includes('NO_PROGRAM'));
    assert.ok(codes(NCCheck.parse(wrap('IF R1==1\nG01 X1 Y1'))).includes('IF_UNBALANCED'));
});

test('Gültige Konstrukte erzeugen keine Meldung; Warnungen', () => {
    const ok = NCCheck.parse(wrap('IF R1==1 GOTOF M1\nG01 X1 Y1\nM1:\nIF R2==1\nG01 X2 Y2\nENDIF\nMSG("a;b X999")\nR5=3 ; Kommentar G77'));
    assert.deepStrictEqual(ok.issues, []);
    assert.ok(codes(NCCheck.parse(wrap('G41 G01 X1 Y1'))).includes('COMP_ACTIVE'));
    assert.ok(!codes(NCCheck.parse(wrap('G41 G01 X1 Y1\nG40 G01 X2 Y2'))).includes('COMP_ACTIVE'));
    assert.ok(codes(NCCheck.parse(wrap('G01 X150 Y10\nG01 X0 Y10'))).includes('OUT_OF_SHEET'));
    assert.ok(codes(NCCheck.parse(wrap('G77 X1 Y1'))).includes('UNKNOWN_G'));
});

test('explain und Zustand je Zeile', () => {
    assert.ok(NCCheck.explain('N12 G03 X1 Y2 I3 J4').some(t => /gegen den Uhrzeigersinn/.test(t)));
    assert.ok(NCCheck.explain('N15 PART1').some(t => /Teileprogramm/.test(t)));
    assert.deepStrictEqual(NCCheck.explain('; nur Kommentar'), []);
    const r = NCCheck.parse(wrap('G00 X12.5 Y7'));
    assert.deepStrictEqual(r.states[4].slice(0, 3), [12.5, 7, 0]);
});

test('Werkstattbericht: HTML mit Escaping und Kennzahlen', () => {
    const nc = NCCheck.parse(wrap('G00 X0 Y0\nG01 X30 Y40'));
    const html = NCReport.html({ planName: 'A<b>', ncFile: 'A.CNC', date: '07.11.2026', nc, sim: { pierceCount: 3, estimatedTime: 3725 },
        contours: [{ name: 'K1', mode: 'disc', length: 50, time: 12 }] });
    assert.ok(html.includes('A&lt;b&gt;') && !html.includes('A<b>'));
    assert.ok(html.includes('01:02:05') && html.includes('100 × 50 mm'));
});

test('Eigener Postprozessor-Output wird ohne Fehler gelesen (Round-Trip)', () => {
    const F = require('./helpers/contour-fixtures.js');
    global.ArcFitting = (require('../js/arc-fitting.js').ArcFitting) || require('../js/arc-fitting.js');
    const PP = require('../js/sinumerik-postprocessor.js');
    const scenarios = [...F.buildScenarios(), ...F.buildMultiScenarios()];
    assert.ok(scenarios.length > 0);
    let checked = 0;
    for (const s of scenarios) {
        const made = s.make();
        const contours = Array.isArray(made) ? made : [made];
        const r = new PP().generate(contours, contours.map((_, i) => i), { planName: 'T' });
        if (!r.code) continue;
        const res = NCCheck.parse(r.code);
        assert.deepStrictEqual(res.issues.filter(i => i.severity === 'error'), [], `Szenario ${s.name || checked}`);
        assert.ok(res.cutLength > 0);
        checked++;
    }
    assert.ok(checked > 0);
});
