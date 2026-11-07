const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./helpers/ui-harness.js');
const { seedIfEmpty } = require('../lib/seed');
const CeraJetEngine = require('../js/cerajet-engine.js');

const quiet = async fn => { const d = console.debug, l = console.log, w = console.warn; console.debug = console.log = console.warn = () => {}; try { return await fn(); } finally { console.debug = d; console.log = l; console.warn = w; } };
const click = el => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
const fire = (el, type = 'input') => el.dispatchEvent(new el.ownerDocument.defaultView.Event(type, { bubbles: true }));

// R12-DXF: Rechteck w×h mit Loch (POLYLINE closed) auf Layer 0
function dxfRect(w, h, hole) {
    const poly = pts => ['0', 'POLYLINE', '8', '0', '66', '1', '70', '1', ...pts.flatMap(p => ['0', 'VERTEX', '8', '0', '10', String(p[0]), '20', String(p[1])]), '0', 'SEQEND', '8', '0'];
    const out = ['0', 'SECTION', '2', 'ENTITIES', ...poly([[0, 0], [w, 0], [w, h], [0, h]])];
    if (hole) out.push(...poly([[w * .4, h * .4], [w * .6, h * .4], [w * .6, h * .6], [w * .4, h * .6]]));
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\n') + '\n';
}

test('Durchgang: Teileimport → Autonest → Plan speichern → Kalkulation → Plan öffnen', async () => {
    const h = await start();
    try {
    await quiet(() => seedIfEmpty(h.stores));
    h.w.CeraJetEngine = CeraJetEngine;
    await quiet(async () => {
        h.load('dxf-parser.js', ['DXFParser']);
        h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog']);
        h.load('nesting.js', ['NestingEngine']);
        h.load('cost-plan.js', ['PlanCost']);
        h.load('cost-dialog.js', ['PlanCostDialog']);
        h.load('nesting-plan.js', ['NestingPlan', 'AutoNestDialog', 'PlanOpenDialog']);
    });
    const $ = s => h.doc.querySelector(s);
    const loaded = [];
    h.app.loadDXFContent = (name, dxf, kb) => loaded.push({ name, dxf, kb });

    // 1) Teileimport
    const imp = new h.w.PartImportDialog(h.app);
    await imp.open();
    await h.waitFor(() => $('#pi-material option'));
    $('#pi-material').value = '21'; $('#pi-thickness').value = '10'; $('#pi-customer').value = 'Heide';
    await quiet(() => imp._addFiles([new h.w.File([dxfRect(300, 200, true)], 'PLATTE-A.dxf'), new h.w.File([dxfRect(150, 100, false)], 'KLEIN-B.dxf')]));
    await h.waitFor(() => imp.items.length === 2 && imp.items.every(i => i.status === 'ready'));
    imp.items[0].qty = 4; imp.items[1].qty = 6;
    await imp._showTech();
    click($('[data-act="save"]'));
    await h.waitFor(() => h.stores.parts.list().length === 2);
    const A = h.stores.parts.list().find(p => p.name === 'PLATTE-A');
    assert.strictEqual(A.customer, 'Heide'); assert.strictEqual(A.qty, 4);
    assert.deepStrictEqual(A.geometry.bbox, { w: 300, l: 200 });
    assert.strictEqual(A.technologyRef.technologyId, 'T-21-10');
    assert.strictEqual(A.geometry.contours.map(c => c.role).join(), 'disc,hole');
    imp.close();

    // 2) Autonest
    const an = new h.w.AutoNestDialog(h.app);
    an.open();
    await h.waitFor(() => h.doc.querySelectorAll('#an-hits [data-pid]').length === 2);
    for (const hit of h.doc.querySelectorAll('#an-hits [data-pid]')) await an._addPart(hit.dataset.pid);
    await h.waitFor(() => an.rows.length === 2);
    assert.deepStrictEqual([...an.rows.map(r => r.qty)].sort(), [4, 6]);
    $('#an-w').value = '1500'; $('#an-l').value = '1000';
    await quiet(async () => { click($('[data-act="run"]')); await h.waitFor(() => an.result); });
    assert.strictEqual(an.result.plan.stats.nested, 10);
    assert.match($('#an-status').textContent, /10\/10 Teile/);
    assert.ok($('#an-preview svg'));
    $('#an-name').value = 'plan test 1';
    click($('[data-act="save"]'));
    await h.waitFor(() => h.stores.plans.list().length === 1);
    const plan = h.stores.plans.get('PLAN_TEST_1');
    assert.strictEqual(plan.instances.length, 10); assert.strictEqual(plan.materialId, 21);

    // 3) Kalkulation (aus ungespeichertem Ergebnis, dann aus gespeichertem Plan)
    click($('[data-act="cost"]'));
    await h.waitFor(() => $('.cost-overlay #pc-body table'));
    assert.match($('.cost-overlay').textContent, /Gesamtkosten: [\d.,]+ €/);
    assert.match($('.cost-overlay').textContent, /PLATTE-A/);
    const before = $('.cost-overlay').textContent.match(/Gesamtkosten: ([\d.,]+) €/)[1];
    const lab = $('.cost-overlay [data-inc="labor"]'); lab.checked = true; fire(lab, 'change');
    await h.waitFor(() => $('.cost-overlay').textContent.match(/Gesamtkosten: ([\d.,]+) €/)?.[1] !== before);
    h.doc.querySelector('.cost-overlay [data-act="close"]').click();
    an.close();

    // 4) Plan öffnen → DXF im neuen Tab
    const po = new h.w.PlanOpenDialog(h.app);
    await po.open();
    await h.waitFor(() => $('.plan-open-overlay tr[data-id="PLAN_TEST_1"]'));
    click($('.plan-open-overlay tr[data-id="PLAN_TEST_1"] [data-act="open"]'));
    await h.waitFor(() => loaded.length === 1);
    assert.strictEqual(loaded[0].name, 'PLAN_TEST_1.dxf');
    assert.ok((loaded[0].dxf.match(/POLYLINE/g) || []).length >= 1 + 10 + 4);   // Blech + 10 Außen + 4 Löcher
    po.close();
    } finally { h.close(); }
});

test('NC-Editor: Prüfliste live, Klick springt zur Zeile, Speichern ruft Server-Save', async () => {
    const h = await start();
    try {
        h.load('nc-tools.js', ['NCCheck', 'NCReport', 'NCEditor', 'NCDialog']);
        const saved = [];
        h.app._saveCNCToServer = async (name, code) => { saved.push({ name, code }); return 'saved'; };
        const code = '%_N_T_MPF\n;LAENGE MM :100.00\n;BREITE MM :50.00\nG90 G00\nG00 X0 Y0\nG02 X10 Y0\nM30\n';
        const ed = new h.w.NCEditor(h.app, { filename: 'T.CNC', code });
        ed.open();
        const $ = s => h.doc.querySelector(s);
        assert.match($('#nce-summary').textContent, /1 Fehler/);
        assert.match($('#nce-issues').textContent, /Kreisbogen ohne I\/J/);
        click($('#nce-issues [data-line]'));
        assert.strictEqual($('#nce-lineno').textContent, '6');
        assert.match($('#nce-explain').textContent, /im Uhrzeigersinn/);
        // Fehler beheben → Prüfung läuft live, Speichern ohne Rückfrage
        const ta = $('#nce-text'); ta.value = ta.value.replace('G02 X10 Y0', 'G02 X10 Y0 I5 J0'); fire(ta);
        await h.waitFor(() => /0 Fehler/.test($('#nce-summary').textContent));
        click($('[data-act="save"]'));
        await h.waitFor(() => saved.length === 1);
        assert.strictEqual(saved[0].name, 'T.CNC');
        assert.match(saved[0].code, /I5 J0/);
        ed.close();
    } finally { h.close(); }
});
