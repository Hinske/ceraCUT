const test = require('node:test');
const assert = require('node:assert');
const { start } = require('./helpers/ui-harness.js');
const { seedIfEmpty } = require('../lib/seed');
const CeraJetEngine = require('../js/cerajet-engine.js');

const quiet = async fn => { const d = console.debug, l = console.log; console.debug = console.log = () => {}; try { return await fn(); } finally { console.debug = d; console.log = l; } };

async function setup(user) {
    const h = await start(user);
    await quiet(() => seedIfEmpty(h.stores));
    h.w.CeraJetEngine = CeraJetEngine;
    h.load('technology-db.js', ['TechDB', 'TechnologyManager']);
    return h;
}
const click = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
const fire = (el, type = 'input') => el.dispatchEvent(new el.ownerDocument.defaultView.Event(type, { bubbles: true }));

test('Manager: lädt Baum, bearbeitet Kerf + Lead im Entwurf über Reiter, speichert, Server hat Werte', async () => {
    const h = await setup();
    const m = new h.w.TechnologyManager(h.app);
    await m.open();
    const $ = s => h.doc.querySelector(s);
    await h.waitFor(() => $('#tm-tree [data-node^="material:"]'));
    assert.ok(h.doc.querySelectorAll('#tm-tree [data-node^="material:"]').length >= 20);

    // Technologie "Fliesen (Feinsteinzeug)" 10 mm wählen
    const node = $('#tm-tree [data-node="tech:T-21-10"]');
    assert.ok(node, 'Seed-Technologie im Baum');
    click(node);
    const kerf = $('#tm-form [data-path="general.kerf"]');
    assert.strictEqual(kerf.value, '0.8');
    kerf.value = '0.9'; fire(kerf);
    // Reiter wechseln (Entwurf bleibt) und Lead ändern
    click($('#tm-tabs [data-tab="lead"]'));
    const ov = $('#tm-form [data-path="general.leadDefault.outer.overcut"]');
    assert.strictEqual(ov.value, '3');
    ov.value = '4'; fire(ov);
    click($('#tm-tabs [data-tab="general"]'));
    assert.strictEqual($('#tm-form [data-path="general.kerf"]').value, '0.9', 'Entwurf überlebt Reiterwechsel');
    // Schnitt-Reiter: berechnete Vorschau
    click($('#tm-tabs [data-tab="cut"]'));
    assert.match($('#tm-feed').textContent, /Q3 ▶/);

    click($('[data-act="save"]'));
    await h.waitFor(() => h.toasts.some(t => t[0] === 'Gespeichert'));
    const saved = h.stores.technologies.get('T-21-10');
    assert.strictEqual(saved.general.kerf, 0.9);
    assert.strictEqual(saved.general.leadDefault.outer.overcut, 4);
    assert.strictEqual(saved.general.leadDefault.inner.overcut, 3);       // unberührt
    m.dirty = false; m.close(); h.close();
});

test('Manager: ungültiger Wert wird abgelehnt, Material-Preis speichern, Dicke ändern = neue ID', async () => {
    const h = await setup();
    const m = new h.w.TechnologyManager(h.app);
    await m.open();
    const $ = s => h.doc.querySelector(s);
    await h.waitFor(() => $('#tm-tree [data-node="tech:T-21-10"]'));
    click($('#tm-tree [data-node="tech:T-21-10"]'));
    const q = (click($('#tm-tabs [data-tab="cut"]')), $('#tm-form [data-path="cutting.quality"]'));
    q.value = '9'; fire(q);
    click($('[data-act="save"]'));
    assert.match($('#tm-msg').textContent, /Qualität/);
    assert.strictEqual(h.stores.technologies.get('T-21-10').cutting.quality, 3);   // nicht gespeichert
    q.value = '2'; fire(q);

    // Dicke 10 → 12: neuer Datensatz T-21-12, alter weg
    click($('#tm-tabs [data-tab="general"]'));
    const th = $('#tm-form [data-path="thickness"]'); th.value = '12'; fire(th);
    click($('[data-act="save"]'));
    await h.waitFor(() => h.stores.technologies.all().some(t => t.technologyId === 'T-21-12'));
    assert.ok(!h.stores.technologies.all().some(t => t.technologyId === 'T-21-10'));
    assert.strictEqual(h.stores.technologies.get('T-21-12').cutting.quality, 2);

    // Material 21: Preis pro kg
    click($('#tm-tree [data-node="material:21"]'));
    const price = $('#tm-form [data-path="pricePerKg"]'); price.value = '1.35'; fire(price);
    click($('[data-act="save"]'));
    await h.waitFor(() => h.stores.materials.get(21).pricePerKg === 1.35);
    m.dirty = false; m.close(); h.close();
});

test('Manager: Nicht-Admin sieht Felder gesperrt, keine Schreib-Buttons', async () => {
    const h = await setup({ username: 'op', role: 'user' });
    const m = new h.w.TechnologyManager(h.app);
    await m.open();
    await h.waitFor(() => h.doc.querySelector('#tm-tree [data-node="tech:T-21-10"]'));
    click(h.doc.querySelector('#tm-tree [data-node="tech:T-21-10"]'));
    assert.strictEqual(h.doc.querySelector('#tm-form [data-path="general.kerf"]').disabled, true);
    assert.strictEqual(h.doc.querySelector('[data-act="save"]'), null);
    assert.strictEqual(h.doc.querySelector('[data-act="newmat"]'), null);
    m.close(); h.close();
});

test('API: ungültige Technologie/Material → 400', async () => {
    const h = await setup();
    const call = async (method, p, body) => { const r = await h.w.fetch(p, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.status; };
    assert.strictEqual(await call('POST', '/api/technologies', { technologyId: 'X1', materialId: 21, thickness: -5 }), 400);
    assert.strictEqual(await call('POST', '/api/technologies', { technologyId: 'X2', materialId: 21, thickness: 10, cutting: { nozzleId: 99 } }), 400);
    assert.strictEqual(await call('POST', '/api/materials', { materialId: 99, name: '', specificWeight: 2 }), 400);
    assert.strictEqual(await call('POST', '/api/materials', { materialId: 99, name: 'OK', specificWeight: 2 }), 201);
    h.close();
});
