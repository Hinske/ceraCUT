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

test('In-Place-Edit: Plan → Teile → Bearbeiten → Textmarke → Aktualisieren (gleiche Transformation) + Teilebibliothek', async () => {
    const h = await start();
    try {
        await quiet(async () => {
            h.w.CeraJetEngine = CeraJetEngine;
            h.load('dxf-parser.js', ['DXFParser']);
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog']);
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
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog']);
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
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer']);
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
            h.load('part-library.js', ['PartGeometry', 'PartLibrary', 'PartImportDialog', 'PartViewer']);
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
