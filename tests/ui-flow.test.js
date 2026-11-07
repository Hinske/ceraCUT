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
        h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
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

test('In-Place-Edit: Plan → Teile → Bearbeiten → Textmarke → Aktualisieren (gleiche Transformation) + Teilebibliothek', async () => {
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine;
            h.load('dxf-parser.js', ['DXFParser']);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
            h.load('plan-update.js', ['PlanUpdate']);
            h.load('part-editor.js', ['PartEditor', 'PartUpdateDialog', 'PartLibraryDialog']);
            h.load('nesting.js', ['NestingEngine']);
            h.load('cost-plan.js', ['PlanCost']);
            h.load('cost-dialog.js', ['PlanCostDialog']);
            h.load('nesting-plan.js', ['NestingPlan', 'AutoNestDialog', 'PlanOpenDialog']);
        });
        const $ = s => h.doc.querySelector(s);
        const loaded = [];
        h.app.loadDXFContent = (name, dxf) => { loaded.push({ name, dxf }); h.app.dxfFileName = name; };

        // Daten: ein Teil (Rev 1) + Plan mit 4 Instanzen (2× 0°, 2× 90°)
        const an = await quiet(() => h.w.PartGeometry.analyze([
            { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], isClosed: true, layer: 'Teil' }]));
        const part = h.w.PartGeometry.toRecord(an, { partId: 'P-A', fileName: 'a.dxf', name: 'PLATTE', orderId: 'O-PLATTE', customer: 'Heide', qty: 4,
            techRef: { machineId: null, materialId: 21, thickness: 10 } });
        await h.stores.parts.put(JSON.parse(JSON.stringify(part)));
        const inst = (n, rot) => ({ instId: `i${n}`, partId: 'P-A', revision: 1, tx: n * 250, ty: 10, rot, sheetIndex: 0, mirror: false });
        await h.stores.plans.put({ planId: 'PLAN-X', materialId: 21, thickness: 10, sheet: { width: 1500, length: 1000 }, stats: { sheets: 1 },
            instances: [inst(1, 0), inst(2, 0), inst(3, 90), inst(4, 90)] });

        // Plan öffnen → Teile → Bearbeiten
        const po = new h.w.PlanOpenDialog(h.app);
        await po.open();
        await h.waitFor(() => $('.plan-open-overlay tr[data-id="PLAN-X"]'));
        click($('.plan-open-overlay tr[data-id="PLAN-X"] [data-act="parts"]'));
        await h.waitFor(() => $('#po-parts [data-act="editpart"]'));
        click($('#po-parts [data-act="editpart"]'));
        await h.waitFor(() => loaded.length === 1);
        assert.match(loaded[0].name, /^TEIL_PLATTE_r1\.dxf$/);
        assert.ok(h.w.PartEditor.sessions.get(loaded[0].name).planId === 'PLAN-X');

        // "CAD": Tab-Inhalt parsen, Textmarke (kleines Rechteck) ergänzen
        const parsed = await quiet(() => h.w.DXFParser.parse(loaded[0].dxf, { chainingTolerance: 0.1 }));
        h.app.contours = [...parsed.contours, { points: [{ x: 90, y: 40 }, { x: 110, y: 40 }, { x: 110, y: 60 }, { x: 90, y: 60 }], isClosed: true, layer: 'Text' }];

        // Teil aktualisieren → Dialog → "gleiche Transformation" mit Referenz i1
        const upd = h.w.PartEditor.updateFromTab(h.app);
        await h.waitFor(() => $('.part-update-overlay'));
        assert.match($('.part-update-overlay').textContent, /Neue Revision 2/);
        assert.doesNotMatch($('.part-update-overlay').textContent, /Umriss geändert/);
        const radio = $('.part-update-overlay input[value="sameTransform"]'); radio.checked = true; fire(radio, 'change');
        assert.strictEqual($('#pu-ref-row').style.display, 'flex');
        $('#pu-ref').value = 'i1';
        click($('.part-update-overlay [data-act="ok"]'));
        await upd;

        const p2 = h.stores.parts.get('P-A');
        assert.strictEqual(p2.revision, 2);
        assert.strictEqual(p2.geometry.contours.length, 2);
        assert.strictEqual(p2.geometry.contours.find(c => c.layer === 'Text').role, 'hole');
        assert.deepStrictEqual(h.stores.parts.revisions('P-A'), [1]);
        const pl = h.stores.plans.get('PLAN-X');
        assert.deepStrictEqual(pl.instances.map(i => [i.instId, i.revision]), [['i1', 2], ['i2', 2], ['i3', 1], ['i4', 1]]);
        assert.strictEqual(pl.instances[0].derivedFrom, 'P-A@1');
        assert.ok(h.toasts.some(t => /Revision 2 gespeichert · 2 Instanz/.test(t[0])));
        po.close();

        // Plan mit alter Rev öffnet weiterhin Rev 1 (ohne Textmarke): i3/i4
        const planParts = {};
        planParts['P-A@1'] = await h.w.PartLibrary.get('P-A', 1);
        assert.strictEqual(planParts['P-A@1'].geometry.contours.length, 1);

        // Tab ohne Sitzung → Hinweis
        h.app.dxfFileName = 'irgendwas.dxf';
        await h.w.PartEditor.updateFromTab(h.app);
        assert.ok(h.toasts.some(t => /gehört zu keinem Bibliotheksteil/.test(t[0])));

        // Teilebibliothek: Suche, Bearbeiten, Löschen
        const lib = new h.w.PartLibraryDialog(h.app);
        await lib.open();
        await h.waitFor(() => $('.part-library-overlay tr[data-id="P-A"]'));
        assert.match($('.part-library-overlay').textContent, /PLATTE.*Heide/s);
        $('#pl-q').value = 'gibtsnicht'; click($('.part-library-overlay [data-act="search"]'));
        await h.waitFor(() => /Keine Teile gefunden/.test($('#pl-rows').textContent));
        click($('.part-library-overlay [data-act="reset"]'));
        await h.waitFor(() => $('.part-library-overlay tr[data-id="P-A"]'));
        click($('.part-library-overlay tr[data-id="P-A"] [data-act="edit"]'));
        await h.waitFor(() => loaded.length === 2);
        assert.match(loaded[1].name, /^TEIL_PLATTE_r2\.dxf$/);
        const lib2 = new h.w.PartLibraryDialog(h.app);
        await lib2.open();
        await h.waitFor(() => $('.part-library-overlay tr[data-id="P-A"]'));
        click($('.part-library-overlay tr[data-id="P-A"] [data-act="del"]'));
        await h.waitFor(() => !h.stores.parts.exists('P-A'));
        lib2.close();
    } finally { h.close(); }
});

test('Teileimport „Vom Server…": Mehrfachauswahl über Ordner, Alle im Ordner, Übernehmen → Import-Tabelle', async () => {
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine;
            await seedIfEmpty(h.stores);
            h.load('dxf-parser.js', ['DXFParser']);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
            h.load('dxf-browser.js', ['DXFBrowser']);
        });
        // Server-DXF-Mock: Root mit 2 Dateien + Ordner "Heide" mit 2 Dateien (eine mit Umlaut-Layer, ISO-8859-1)
        const files = { 'A.dxf': dxfRect(100, 50, false), 'B.dxf': dxfRect(80, 40, true), 'Heide/C.dxf': dxfRect(60, 30, false),
            'Heide/D.dxf': dxfRect(70, 35, false).replace('\n8\n0\n', '\n8\nTeile Ä\n') };
        const calls = [];
        h.w.__fetchHook = (u) => {
            const url = new URL(u, h.base);
            if (url.pathname === '/api/health') return Promise.resolve(new Response('{"status":"ok"}', { status: 200 }));
            if (url.pathname === '/api/dxf/list') {
                const dir = url.searchParams.get('path') || '';
                const items = Object.keys(files).filter(k => (k.includes('/') ? k.split('/')[0] : '') === dir.split('/')[0] && dir === (k.includes('/') ? k.split('/')[0] : ''))
                    .map(k => ({ name: k.split('/').pop(), type: 'file', size: files[k].length, mtime: 1 }));
                if (!dir) items.push({ name: 'Heide', type: 'directory', size: 0, mtime: 1 });
                return Promise.resolve(new Response(JSON.stringify({ path: dir, items }), { status: 200 }));
            }
            if (url.pathname === '/api/dxf/file') {
                const p = url.searchParams.get('path'); calls.push(p);
                const latin1 = Uint8Array.from(files[p], ch => ch.charCodeAt(0) & 255);
                return Promise.resolve(new Response(latin1, { status: 200 }));
            }
            return null;
        };
        h.app.dxfBrowser = new h.w.DXFBrowser(h.app);
        const $ = s => h.doc.querySelector(s);
        const imp = new h.w.PartImportDialog(h.app);
        await imp.open();
        click($('[data-act="server"]'));
        await h.waitFor(() => $('.dxf-browser-ok'));
        assert.match($('.dxf-browser-list').textContent, /A\.dxf/);
        assert.strictEqual($('.dxf-browser-ok').disabled, true);
        // A.dxf einzeln, dann in Ordner Heide und dort "Alle im Ordner"
        const rowOf = name => [...h.doc.querySelectorAll('.dxf-browser-list > div')].find(d => d.textContent.includes(name));
        click(rowOf('A.dxf'));
        assert.strictEqual($('.dxf-browser-count').textContent, '1 Datei(en) ausgewählt');
        click(rowOf('Heide'));
        await h.waitFor(() => /C\.dxf/.test($('.dxf-browser-list').textContent));
        click($('.dxf-browser-all'));
        assert.strictEqual($('.dxf-browser-count').textContent, '3 Datei(en) ausgewählt');
        click($('.dxf-browser-all'));                                     // zweiter Klick wählt den Ordner wieder ab
        assert.strictEqual($('.dxf-browser-count').textContent, '1 Datei(en) ausgewählt');
        click($('.dxf-browser-all'));
        click($('.dxf-browser-ok'));
        await h.waitFor(() => imp.items.length === 3 && imp.items.every(i => i.status !== 'parsing')); 
        assert.deepStrictEqual([...imp.items.map(i => i.fileName)].sort(), ['A.dxf', 'C.dxf', 'D.dxf']);
        assert.ok(imp.items.every(i => i.status === 'ready'));
        assert.ok(!$('.dxf-browser-ok'), 'Browser ist geschlossen');
        assert.deepStrictEqual([...calls].sort(), ['A.dxf', 'Heide/C.dxf', 'Heide/D.dxf']);
        assert.ok([...imp.layerSel.keys()].includes('Teile Ä'), 'ISO-8859-1-Umlaut im Layernamen bleibt erhalten');

        // Abbrechen liefert []
        const p = h.app.dxfBrowser.pickMany();
        await h.waitFor(() => $('.dxf-browser-ok'));
        click($('.dxf-browser-close'));
        assert.deepStrictEqual([...(await p)], []);
    } finally { h.close(); }
});

test('Große Vorschau: Teilebibliothek-Klick öffnet Viewer, Zoom ±/Rad/Einpassen, Esc; Import-Tabelle ebenso', async () => {
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine;
            await seedIfEmpty(h.stores);
            h.load('dxf-parser.js', ['DXFParser']);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
            h.load('plan-update.js', ['PlanUpdate']);
            h.load('part-editor.js', ['PartEditor', 'PartUpdateDialog', 'PartLibraryDialog']);
        });
        const $ = s => h.doc.querySelector(s);
        const an = await quiet(() => h.w.PartGeometry.analyze([
            { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }], isClosed: true, layer: 'Teil' },
            { points: [{ x: 80, y: 40 }, { x: 120, y: 40 }, { x: 120, y: 60 }, { x: 80, y: 60 }], isClosed: true, layer: 'Loch' }]));
        await h.stores.parts.put(JSON.parse(JSON.stringify(h.w.PartGeometry.toRecord(an, { partId: 'P-V', fileName: 'v.dxf', name: 'VORSCHAU', orderId: 'O-V', customer: 'Heide', qty: 3,
            techRef: { machineId: null, materialId: 21, thickness: 10 } }))));

        const lib = new h.w.PartLibraryDialog(h.app);
        await lib.open();
        await h.waitFor(() => $('.part-library-overlay tr[data-id="P-V"]'));
        const thumb = $('.part-library-overlay tr[data-id="P-V"] div[data-act="view"]');
        assert.ok(thumb.querySelector('svg').getAttribute('width') === '124', 'Vorschau ist größer als vorher (124 statt 56)');
        click(thumb);
        await h.waitFor(() => $('.part-viewer-overlay #pv-svg path'));
        assert.strictEqual(h.doc.querySelectorAll('.part-viewer-overlay #pv-svg path').length, 2);
        assert.match($('.part-viewer-overlay').textContent, /VORSCHAU/);
        assert.match($('.part-viewer-overlay').textContent, /200 × 100 mm/);
        const vb = () => $('#pv-svg').getAttribute('viewBox').split(' ').map(Number);
        const fit = vb();
        assert.match($('#pv-zoom').textContent, /100 %/);
        click($('.part-viewer-overlay [data-act="zin"]'));
        assert.ok(vb()[2] < fit[2] && Math.abs((vb()[0] + vb()[2] / 2) - (fit[0] + fit[2] / 2)) < 1e-6, 'zoomt um die Mitte');
        assert.match($('#pv-zoom').textContent, /140 %/);
        $('#pv-stage').dispatchEvent(new h.w.WheelEvent('wheel', { deltaY: -400, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
        assert.ok(vb()[2] < fit[2] / 1.4, 'Mausrad zoomt weiter');
        for (let i = 0; i < 40; i++) click($('.part-viewer-overlay [data-act="zin"]'));
        assert.match($('#pv-zoom').textContent, /300(0)? ?%|30000 %/, 'Zoom ist nach oben begrenzt (300×)');
        for (let i = 0; i < 40; i++) click($('.part-viewer-overlay [data-act="zout"]'));
        assert.match($('#pv-zoom').textContent, /50 %/, 'Zoom ist nach unten begrenzt (50 %)');
        click($('.part-viewer-overlay [data-act="fit"]'));
        assert.deepStrictEqual(vb(), fit);
        $('#pv-stage').dispatchEvent(new h.w.MouseEvent('dblclick', { bubbles: true }));
        h.doc.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert.ok(!$('.part-viewer-overlay'), 'Esc schließt den Viewer');
        assert.ok($('.part-library-overlay'), 'Bibliothek bleibt offen');
        // Klick auf den Namen öffnet ebenfalls
        click($('.part-library-overlay tr[data-id="P-V"] a[data-act="view"]'));
        await h.waitFor(() => $('.part-viewer-overlay'));
        click($('.part-viewer-overlay [data-act="close"]'));
        assert.ok(!$('.part-viewer-overlay'));
        lib.close();

        // Import-Tabelle: Vorschau klickbar
        const imp = new h.w.PartImportDialog(h.app);
        await imp.open();
        await quiet(() => imp._addFiles([new h.w.File([dxfRect(120, 60, true)], 'X.dxf')]));
        await h.waitFor(() => imp.items[0]?.status === 'ready');
        const t2 = $('#pi-table [data-view="0"]');
        assert.ok(t2 && t2.querySelector('svg').getAttribute('width') === '84');
        click(t2);
        await h.waitFor(() => $('.part-viewer-overlay #pv-svg path'));
        assert.match($('.part-viewer-overlay').textContent, /X\.dxf/);
        click($('.part-viewer-overlay [data-act="close"]'));
        imp.close();
    } finally { h.close(); }
});

test('Mehrfachimport: viele Dateien in Paketen speichern; Abbruch mitten drin markiert Gespeichertes', async () => {
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine; await seedIfEmpty(h.stores);
            h.load('dxf-parser.js', ['DXFParser']);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
        });
        const $ = s => h.doc.querySelector(s);
        const imp = new h.w.PartImportDialog(h.app);
        imp.maxBatchCount = 7;                                           // 30 Teile → 5 Pakete
        await imp.open();
        $('#pi-material').value = '21';
        const t0 = Date.now();
        await quiet(() => imp._addFiles(Array.from({ length: 30 }, (_, i) => new h.w.File([dxfRect(100 + i, 50, true)], `B${String(i).padStart(2, '0')}.dxf`))));
        assert.strictEqual(imp.items.length, 30);
        assert.ok(imp.items.every(i => i.status === 'ready'));
        assert.ok(Date.now() - t0 < 5000, 'Einlesen 30 Dateien in unter 5 s');
        // Zählen der Anfragen + 3. Paket scheitert
        let posts = 0; const real = h.w.fetch;
        h.w.__fetchHook = (u, o) => { if (String(u).includes('/api/parts/import') && o?.method === 'POST') { posts++; if (posts === 3) return Promise.resolve(new Response('{"error":"Testfehler"}', { status: 500 })); } return null; };
        click($('[data-act="save"]'));
        await h.waitFor(() => h.toasts.some(t => /abgebrochen/.test(t[0])));
        assert.strictEqual(posts, 3);
        assert.strictEqual(h.stores.parts.list().length, 14);             // 2 Pakete à 7 gespeichert
        assert.strictEqual(imp.items.filter(i => i.status === 'saved').length, 14);
        assert.match(h.toasts.at(-1)[0], /nach 14 von 30/);
        // Erneut speichern: nur die 16 offenen, keine Duplikate
        h.w.__fetchHook = null;
        click($('[data-act="save"]'));
        await h.waitFor(() => h.stores.parts.list().length === 30);
        assert.strictEqual(new Set(h.stores.parts.list().map(p => p.name)).size, 30);
        assert.ok(imp.items.every(i => i.status === 'saved'));
        assert.match(h.toasts.at(-1)[0], /16 von 16/);
        imp.close();
    } finally { h.close(); }
});

// Web-Worker-Attrappe: führt js/nesting-worker.js (mit nesting.js) in einem eigenen vm-Kontext aus
function makeFakeWorker(fs, vm, path) {
    const root = path.join(__dirname, '..', 'js');
    const instances = [];
    class FakeWorker {
        constructor(url) {
            this.url = url; this.dead = false; instances.push(this);
            const self = { location: { search: '' }, postMessage: m => setTimeout(() => { if (!this.dead && this.onmessage) this.onmessage({ data: m }); }, 0) };
            this.ctx = vm.createContext({ self, performance, console: { log() {}, warn() {}, debug() {}, error() {} }, Date, Math, importScripts: name => {
                vm.runInContext(fs.readFileSync(path.join(root, name.split('?')[0]), 'utf8'), this.ctx);
            } });
            vm.runInContext(fs.readFileSync(path.join(root, 'nesting-worker.js'), 'utf8'), this.ctx);
        }
        postMessage(data) { setTimeout(() => { if (!this.dead) this.ctx.self.onmessage({ data }); }, 0); }
        terminate() { this.dead = true; }
    }
    return { FakeWorker, instances };
}

test('Autonest im Worker: Fortschritt, Ergebnis, Zoom in der Vorschau, Große Ansicht, Abbrechen', async () => {
    const fs = require('fs'), vm = require('vm'), path = require('path');
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine; await seedIfEmpty(h.stores);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
            h.load('nesting.js', ['NestingEngine']);
            h.load('cost-plan.js', ['PlanCost']);
            h.load('cost-dialog.js', ['PlanCostDialog']);
            h.load('nesting-plan.js', ['NestingPlan', 'AutoNestDialog', 'PlanOpenDialog']);
        });
        const { FakeWorker, instances } = makeFakeWorker(fs, vm, path);
        h.w.Worker = FakeWorker;
        const $ = s => h.doc.querySelector(s);
        const an0 = await quiet(() => h.w.PartGeometry.analyze([
            { points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 80 }, { x: 0, y: 80 }], isClosed: true, layer: 'T' },
            { points: [{ x: 50, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 50 }, { x: 50, y: 50 }], isClosed: true, layer: 'L' }]));
        await h.stores.parts.put(JSON.parse(JSON.stringify(h.w.PartGeometry.toRecord(an0, { partId: 'P-W', fileName: 'w.dxf', name: 'WORKERTEIL', orderId: 'O-W', customer: 'X', qty: 120,
            techRef: { machineId: null, materialId: 21, thickness: 10 } }))));

        const an = new h.w.AutoNestDialog(h.app);
        an.open();
        await h.waitFor(() => $('#an-hits [data-pid]'));
        await an._addPart('P-W');
        an.rows[0].qty = 120;
        $('#an-w').value = '1500'; $('#an-l').value = '1000';

        // Lauf 1: durchläuft im Worker, Fortschritt kommt an, Ergebnis + Vorschau mit Zoom
        click($('[data-act="run"]'));
        assert.strictEqual($('#an-run').disabled, true, 'Start gesperrt während der Berechnung');
        assert.strictEqual($('#an-cancel').style.display, '', 'Abbrechen sichtbar');
        await h.waitFor(() => an.result);
        assert.strictEqual(instances.length, 1);
        assert.strictEqual(instances[0].dead, true, 'Worker beendet');
        assert.strictEqual($('#an-run').disabled, false);
        assert.strictEqual($('#an-cancel').style.display, 'none');
        const s = an.result.plan.stats;
        assert.strictEqual(s.nested, 120);
        assert.match($('#an-status').textContent, /120\/120 Teile/);
        assert.strictEqual($('#an-progress').value, 120, 'Fortschrittsbalken am Ende voll');

        const vb = () => $('#an-preview svg').getAttribute('viewBox').split(' ').map(Number);
        const fit = vb();
        assert.strictEqual(h.doc.querySelectorAll('#an-preview svg path').length, 120 * 2, '120 Teile + 120 Löcher');
        click($('[data-act="zin"]'));
        assert.ok(vb()[2] < fit[2]);
        assert.match($('#an-zoom').textContent, /140 %/);
        $('#an-preview').dispatchEvent(new h.w.WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true }));
        assert.ok(vb()[2] < fit[2] / 1.4);
        click($('[data-act="fit"]'));
        assert.deepStrictEqual(vb(), fit);
        // Große Ansicht
        click($('[data-act="big"]'));
        await h.waitFor(() => $('.part-viewer-overlay #pv-svg path'));
        assert.match($('.part-viewer-overlay').textContent, /Schachtelplan — Blech 1\/1/);
        assert.match($('.part-viewer-overlay').textContent, /WORKERTEIL\s*× 120/);
        click($('.part-viewer-overlay [data-act="close"]'));

        // Lauf 2: sofort abbrechen → kein Ergebnis-Update, Worker beendet, erneut startbar
        const before = an.result;
        click($('[data-act="run"]'));
        click($('[data-act="cancel"]'));
        await h.waitFor(() => /Abgebrochen/.test($('#an-status').textContent));
        assert.strictEqual(instances.at(-1).dead, true);
        assert.strictEqual($('#an-run').disabled, false);
        await h.sleep(50);
        assert.strictEqual(an.result, before, 'Ergebnis unverändert');
        // Lauf 3 funktioniert wieder
        click($('[data-act="run"]'));
        await h.waitFor(() => an.result !== before);
        // Plan als PDF: Anfrage mit Plan inline + Planname, Download wird ausgelöst
        $('#an-name').value = 'mein plan';
        let pdfReq = null; const created = [];
        h.w.URL.createObjectURL = b => { created.push(b); return 'blob:test'; }; h.w.URL.revokeObjectURL = () => {};
        h.w.__fetchHook = (u, o) => { if (String(u).includes('/api/reports/plan-pdf')) { pdfReq = JSON.parse(o.body); return Promise.resolve(new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { 'Content-Type': 'application/pdf' } })); } return null; };
        click($('[data-act="pdf"]'));
        await h.waitFor(() => created.length === 1);
        assert.strictEqual(pdfReq.plan.planId, 'MEIN_PLAN');
        assert.strictEqual(pdfReq.plan.instances.length, 120);
        h.w.__fetchHook = null;

        // Schließen während der Berechnung bricht ab
        click($('[data-act="run"]'));
        an.close();
        assert.strictEqual(instances.at(-1).dead, true);
    } finally { h.close(); }
});

test('Worker-Skript: Fortschritt + Ergebnis, Fehler werden gemeldet', async () => {
    const fs = require('fs'), vm = require('vm'), path = require('path');
    const { FakeWorker } = makeFakeWorker(fs, vm, path);
    const msgs = [];
    const w = new FakeWorker('js/nesting-worker.js'); w.onmessage = e => msgs.push(e.data);
    const sq = (x) => ({ points: [{ x: 0, y: 0 }, { x: 50 + x, y: 0 }, { x: 50 + x, y: 50 }, { x: 0, y: 50 }], isClosed: true });
    w.postMessage({ items: Array.from({ length: 30 }, (_, i) => sq(i % 3)), cfg: { sheetWidth: 500, sheetHeight: 300, sheetMargin: 5, spacing: 3, maxSheets: 5 } });
    await new Promise(r => { const t = setInterval(() => { if (msgs.some(m => m.type === 'done' || m.type === 'error')) { clearInterval(t); r(); } }, 10); });
    const done = msgs.find(m => m.type === 'done');
    assert.ok(done && done.res.placements.length === 30);
    assert.ok(msgs.some(m => m.type === 'progress' && m.done === m.total), 'letzte Fortschrittsmeldung vorhanden');
    // Fehlerfall: ungültige Items
    const w2 = new FakeWorker('x'); const m2 = []; w2.onmessage = e => m2.push(e.data);
    w2.postMessage({ items: null, cfg: {} });
    await new Promise(r => setTimeout(r, 50));
    assert.strictEqual(m2.at(-1).type, 'error');
});

test('Import: DXF mit zwei identischen Stücken + REFERENZ-Layer → ein Teil, Menge × 2, Referenz standardmäßig aus', async () => {
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine; await seedIfEmpty(h.stores);
            h.load('dxf-parser.js', ['DXFParser']);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
        });
        const $ = s => h.doc.querySelector(s);
        const poly = (layer, pts, closed = true) => ['0', 'POLYLINE', '8', layer, '66', '1', '70', closed ? '1' : '0', ...pts.flatMap(p => ['0', 'VERTEX', '8', layer, '10', String(p[0]), '20', String(p[1])]), '0', 'SEQEND', '8', layer];
        const piece = (oy) => [...poly('SCHNEIDEN', [[8, oy + 5], [148, oy + 5], [148, oy + 145], [8, oy + 145]]), ...poly('SCHNEIDEN', [[60, oy + 60], [90, oy + 60], [90, oy + 90], [60, oy + 90]])];
        const dxf = ['0', 'SECTION', '2', 'ENTITIES', ...poly('REFERENZ', [[0, 0], [240, 0], [240, 420]], false), ...piece(0), ...piece(150), '0', 'ENDSEC', '0', 'EOF'].join('\n') + '\n';
        const imp = new h.w.PartImportDialog(h.app);
        await imp.open();
        $('#pi-material').value = '21';
        await quiet(() => imp._addFiles([new h.w.File([dxf], 'ZWEI.dxf')]));
        await h.waitFor(() => imp.items[0]?.status === 'ready');
        assert.strictEqual(imp.layerSel.get('REFERENZ'), false, 'REFERENZ-Layer standardmäßig abgewählt');
        assert.strictEqual(imp.layerSel.get('SCHNEIDEN'), true);
        const it = imp.items[0];
        assert.strictEqual(it.pieces.length, 1); assert.strictEqual(it.pieces[0].count, 2);
        assert.deepStrictEqual({ ...it.pieces[0].analysis.geometry.bbox }, { w: 140, l: 140 }, 'Teil ohne Referenzrahmen vermessen');
        assert.match($('#pi-table').textContent, /2× → 1 Teil\(e\)/);
        it.qty = 5;
        click($('[data-act="save"]'));
        await h.waitFor(() => h.stores.parts.list().length === 1);
        const part = h.stores.parts.list()[0];
        assert.strictEqual(part.qty, 10, 'Menge × Anzahl identischer Stücke');
        assert.strictEqual(part.name, 'ZWEI');
        assert.ok(!part.geometry.contours.some(c => c.layer === 'REFERENZ'));

        // Aufteilen aus → ein Teil mit beiden Außenkonturen
        const cb = $('#pi-split'); cb.checked = false; cb.dispatchEvent(new h.w.Event('change', { bubbles: true }));
        assert.strictEqual(imp.items[0].pieces.length, 1); assert.strictEqual(imp.items[0].pieces[0].count, 1);
        assert.strictEqual(imp.items[0].pieces[0].analysis.geometry.contours.filter(c => c.role === 'disc').length, 2);
        // REFERENZ wieder einschalten → Teil wird groß, Warnung offene Kontur
        const refBox = $('#pi-layers input[data-layer="REFERENZ"]'); refBox.checked = true; refBox.dispatchEvent(new h.w.Event('change', { bubbles: true }));
        assert.strictEqual(imp.items[0].status, 'warning');
        imp.close();
    } finally { h.close(); }
});

test('Große Pläne: Vorschau zeichnet auf Canvas (kein SVG mit tausenden Pfaden), blendet unsichtbare Teile aus, SVG wird nie gebaut', async () => {
    const fs = require('fs'), vm = require('vm'), path = require('path');
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine; await seedIfEmpty(h.stores);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer', 'ZoomPane']);
            h.load('nesting.js', ['NestingEngine']);
            h.load('cost-plan.js', ['PlanCost']);
            h.load('cost-dialog.js', ['PlanCostDialog']);
            h.load('nesting-plan.js', ['NestingPlan', 'AutoNestDialog', 'PlanOpenDialog']);
        });
        // Canvas-/Path2D-Attrappen (jsdom hat keinen 2D-Kontext)
        const calls = { fill: 0, stroke: 0, setTransform: 0, clear: 0 };
        const ctx = { setTransform() { calls.setTransform++; }, clearRect() { calls.clear++; }, fillRect() {}, strokeRect() {}, fill() { calls.fill++; }, stroke() { calls.stroke++; } };
        h.w.HTMLCanvasElement.prototype.getContext = () => ctx;
        h.w.Path2D = class { moveTo() {} lineTo() {} closePath() {} };
        let svgBuilt = 0;
        const origContent = h.w.NestingPlan.sheetContent;
        h.w.NestingPlan.sheetContent = (...a) => { const c = origContent(...a); const getter = Object.getOwnPropertyDescriptor(c, 'svgInner').get; Object.defineProperty(c, 'svgInner', { get() { svgBuilt++; return getter(); } }); return c; };
        const { FakeWorker } = makeFakeWorker(fs, vm, path); h.w.Worker = FakeWorker;

        const $ = s => h.doc.querySelector(s);
        const an0 = await quiet(() => h.w.PartGeometry.analyze([
            { points: [{ x: 0, y: 0 }, { x: 140, y: 0 }, { x: 140, y: 140 }, { x: 0, y: 140 }], isClosed: true, layer: 'T' },
            { points: [{ x: 50, y: 50 }, { x: 90, y: 50 }, { x: 90, y: 90 }, { x: 50, y: 90 }], isClosed: true, layer: 'L' }]));
        await h.stores.parts.put(JSON.parse(JSON.stringify(h.w.PartGeometry.toRecord(an0, { partId: 'P-C', fileName: 'c.dxf', name: 'CANVASTEIL', orderId: 'O', customer: 'X', qty: 200,
            techRef: { machineId: null, materialId: 21, thickness: 10 } }))));
        const an = new h.w.AutoNestDialog(h.app);
        an.open();
        await h.waitFor(() => $('#an-hits [data-pid]'));
        await an._addPart('P-C'); an.rows[0].qty = 300;
        $('#an-w').value = '6000'; $('#an-l').value = '3000';
        click($('[data-act="run"]'));
        await h.waitFor(() => an.result);
        const total = an.result.plan.instances.filter(i => (i.sheetIndex || 0) === 0).length;
        assert.ok(total > 100, `viele Teile auf Blech 1 (${total})`);

        assert.ok($('#an-preview canvas'), 'Canvas statt SVG');
        assert.ok(!$('#an-preview svg'), 'kein SVG im DOM');
        assert.strictEqual(an.pane.mode, 'canvas');
        const drawn = an.pane.draw();
        assert.strictEqual(drawn, total, 'beim Einpassen sind alle Instanzen sichtbar');
        const f0 = calls.fill; an.pane.draw(); assert.strictEqual(calls.fill - f0, total * 2);
        assert.strictEqual(svgBuilt, 0, 'der große SVG-String wird im Canvas-Modus nie gebaut');

        // Hineinzoomen → nur noch Instanzen im Bild werden gezeichnet
        for (let i = 0; i < 12; i++) an.pane.zoomAt(1.4);
        assert.match($('#an-zoom').textContent, /\d{4,} %/);
        const it0 = an.pane.scene.items[0];                                        // Ausschnitt auf das erste Teil legen (die Mitte des Blechs ist leer)
        an.pane.vb = { x: it0.m[4] - 80, y: it0.m[5] - 80, w: 160, h: 160 * an.pane.fit.h / an.pane.fit.w };
        const zoomed = an.pane.draw();
        assert.ok(zoomed > 0 && zoomed < total / 4, `Ausblenden außerhalb des Bildes: ${zoomed} von ${total}`);
        // Mausrad/Einpassen laufen über requestAnimationFrame (gebündelt) und zeichnen neu
        const c0 = calls.clear;
        $('#an-preview').dispatchEvent(new h.w.WheelEvent('wheel', { deltaY: 300, bubbles: true, cancelable: true }));
        click($('[data-act="fit"]'));
        await h.waitFor(() => calls.clear > c0, 2000);
        assert.strictEqual(an.pane.lastDrawn, total);
        // Große Ansicht nutzt ebenfalls Canvas
        click($('[data-act="big"]'));
        await h.waitFor(() => $('.part-viewer-overlay canvas'));
        assert.ok(!$('.part-viewer-overlay svg'));
        click($('.part-viewer-overlay [data-act="close"]'));
        assert.strictEqual(svgBuilt, 0);

        // Sehr großes Blech im Editor öffnen: Rückfrage, Abbruch lässt den Dialog offen
        const opened = []; h.app.loadDXFContent = (n) => opened.push(n);
        let asked = null; h.w.confirm = msg => { asked = msg; return false; };
        click($('[data-act="edit"]'));
        assert.match(asked, /Konturen/);
        assert.strictEqual(opened.length, 0, 'bei Abbruch wird nichts geöffnet');
        assert.ok($('.autonest-overlay'), 'Dialog bleibt offen');
        h.w.confirm = () => true;
        click($('[data-act="edit"]'));
        assert.strictEqual(opened.length, 1);
        assert.ok(!$('.autonest-overlay'), 'nach dem Öffnen schließt der Dialog');
    } finally { h.close(); }
});
