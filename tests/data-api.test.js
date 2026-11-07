const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const { createStores } = require('../lib/store');
const { handleDataApi, resolveTechnology } = require('../lib/data-api');

async function setup(user = { username: 'mh', role: 'admin' }) {
    const stores = createStores(fs.mkdtempSync(path.join(os.tmpdir(), 'ceracut-api-')));
    const ctx = { user };
    const server = http.createServer((req, res) => {
        const p = url.parse(req.url, true);
        if (!handleDataApi(req, res, decodeURIComponent(p.pathname), p.query, ctx.user, stores)) {
            res.writeHead(404); res.end();
        }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (method, p, body, headers = {}) => {
        const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body) });
        const text = await r.text();
        return { status: r.status, body: text ? JSON.parse(text) : null, etag: r.headers.get('etag') };
    };
    return { call, ctx, stores, port: server.address().port, close: () => { server.closeAllConnections(); server.close(); } };
}

const part = (id, extra = {}) => ({
    partId: id, revision: 1, name: `Teil ${id}`, orderId: `O-${id}`, customer: 'Heide',
    technologyRef: { machineId: 'cj1', materialId: 21, thickness: 10 },
    geometry: { contours: [{ id: 'c1' }], bbox: { w: 100, l: 50 }, cutLength: 0.3, piercings: 1 },
    status: 'ready', ...extra
});

test('ohne Login 401, fremde Routen nicht behandelt', async () => {
    const s = await setup(null);
    assert.strictEqual((await s.call('GET', '/api/parts')).status, 401);
    assert.strictEqual((await s.call('GET', '/api/dxf/list')).status, 404);
    s.close();
});

test('Teile: CRUD, ETag/If-Match, Revisionen', async () => {
    const s = await setup();
    const c = await s.call('POST', '/api/parts', part('P-1'));
    assert.strictEqual(c.status, 201);
    assert.strictEqual(c.etag, '"1"');
    assert.strictEqual((await s.call('POST', '/api/parts', part('P-1'))).status, 409);
    const g = await s.call('GET', '/api/parts/P-1');
    assert.strictEqual(g.body.geometry.contours.length, 1);
    assert.strictEqual((await s.call('PUT', '/api/parts/P-1', part('P-1', { name: 'X' }), { 'If-Match': '"9"' })).status, 409);
    assert.strictEqual((await s.call('PUT', '/api/parts/P-1', part('P-1', { name: 'X' }), { 'If-Match': 'abc' })).status, 400);
    assert.strictEqual((await s.call('PUT', '/api/parts/P-2', part('P-1'))).status, 400);
    const u = await s.call('PUT', '/api/parts/P-1', part('P-1', { name: 'X' }), { 'If-Match': '"1"' });
    assert.strictEqual(u.status, 200); assert.strictEqual(u.body.version, 2);
    const r = await s.call('POST', '/api/parts/P-1/revision', part('P-1', { name: 'Y' }), { 'If-Match': '2' });
    assert.strictEqual(r.body.revision, 2);
    const h = await s.call('GET', '/api/parts/P-1/revisions');
    assert.deepStrictEqual(h.body.history, [1]);
    assert.strictEqual((await s.call('GET', '/api/parts/P-1?rev=1')).body.name, 'X');
    assert.strictEqual((await s.call('GET', '/api/parts/P-1?rev=2')).body.name, 'Y');
    assert.strictEqual((await s.call('GET', '/api/parts/P-1?rev=7')).status, 404);
    assert.strictEqual((await s.call('DELETE', '/api/parts/P-1', undefined, { 'If-Match': '1' })).status, 409);
    assert.strictEqual((await s.call('DELETE', '/api/parts/P-1')).status, 200);
    assert.strictEqual((await s.call('GET', '/api/parts/P-1')).status, 404);
    s.close();
});

test('Teile: Pfad-Injection und Filter/Pagination', async () => {
    const s = await setup();
    assert.strictEqual((await s.call('GET', '/api/parts/..%2Fusers')).status, 400);
    for (let i = 1; i <= 5; i++) {
        await s.call('POST', '/api/parts', part(`P-${i}`, i > 3 ? { customer: 'Irlich', technologyRef: { machineId: 'cj1', materialId: 5, thickness: 8 } } : {}));
    }
    const all = await s.call('GET', '/api/parts?limit=2&offset=1');
    assert.strictEqual(all.body.total, 5); assert.strictEqual(all.body.items.length, 2);
    assert.ok(!('geometry' in all.body.items[0]) && all.body.items[0].bbox);
    assert.strictEqual((await s.call('GET', '/api/parts?customer=irlich')).body.total, 2);
    assert.strictEqual((await s.call('GET', '/api/parts?material=21&thickness=10')).body.total, 3);
    assert.strictEqual((await s.call('GET', '/api/parts?q=teil p-4')).body.total, 1);
    s.close();
});

test('Import-Batch: Teilergebnisse (207)', async () => {
    const s = await setup();
    await s.call('POST', '/api/parts', part('P-1'));
    const r = await s.call('POST', '/api/parts/import', { parts: [part('P-1'), part('P-2'), { name: 'ohne id' }] });
    assert.strictEqual(r.status, 207);
    assert.deepStrictEqual([r.body.saved, r.body.failed], [1, 2]);
    assert.strictEqual(r.body.results[0].code, 'EXISTS');
    assert.strictEqual((await s.call('POST', '/api/parts/import', { parts: [part('P-1')], overwrite: true })).status, 200);
    assert.strictEqual((await s.call('POST', '/api/parts/import', {})).status, 400);
    s.close();
});

test('Listen: Bleche CRUD + Collection-Version; Aufträge filtern', async () => {
    const s = await setup();
    const c = await s.call('POST', '/api/sheets', { sheetId: 'S-1', materialId: 5, thickness: 10, width: 1500, length: 3000 });
    assert.strictEqual(c.status, 201);
    assert.strictEqual((await s.call('POST', '/api/sheets', { sheetId: 'S-1' })).status, 409);
    const l = await s.call('GET', '/api/sheets?material=5');
    assert.strictEqual(l.body.version, 1); assert.strictEqual(l.body.total, 1);
    assert.strictEqual((await s.call('PUT', '/api/sheets/S-1', { sheetId: 'S-1', stock: 3 }, { 'If-Match': '5' })).status, 409);
    assert.strictEqual((await s.call('PUT', '/api/sheets/S-1', { sheetId: 'S-1', stock: 3 }, { 'If-Match': '1' })).status, 200);
    await s.call('POST', '/api/orders', { orderId: 'O-1', customer: 'Heide', status: 'withGeometry' });
    await s.call('POST', '/api/orders', { orderId: 'O-2', customer: 'Irlich', status: 'withGeometry' });
    assert.strictEqual((await s.call('GET', '/api/orders?customer=heide')).body.total, 1);
    assert.strictEqual((await s.call('DELETE', '/api/sheets/S-1')).status, 200);
    s.close();
});

test('Technologie/Materialien: Schreiben nur Admin, resolve', async () => {
    const s = await setup({ username: 'op', role: 'user' });
    assert.strictEqual((await s.call('POST', '/api/technologies', { technologyId: 'T1', materialId: 21, thickness: 10 })).status, 403);
    s.ctx.user = { username: 'mh', role: 'admin' };
    await s.call('POST', '/api/materials', { materialId: 21, name: 'Feinsteinzeug' });
    await s.call('POST', '/api/technologies', { technologyId: 'T1', materialId: 21, thickness: 10 });
    await s.call('POST', '/api/technologies', { technologyId: 'T2', materialId: 21, thickness: 12, machineId: 'cj1' });
    s.ctx.user = { username: 'op', role: 'user' };
    assert.strictEqual((await s.call('GET', '/api/technologies?material=21')).body.total, 2);
    let r = await s.call('GET', '/api/technology/resolve?material=21&thickness=10');
    assert.strictEqual(r.body.technology.technologyId, 'T1'); assert.strictEqual(r.body.exact, true);
    assert.strictEqual(r.body.material.name, 'Feinsteinzeug');
    r = await s.call('GET', '/api/technology/resolve?material=21&thickness=11&machine=cj1');
    assert.strictEqual(r.body.technology.technologyId, 'T2'); assert.strictEqual(r.body.exact, false);
    assert.strictEqual((await s.call('GET', '/api/technology/resolve?material=99&thickness=10')).status, 404);
    assert.strictEqual((await s.call('GET', '/api/technology/resolve?material=21')).status, 400);
    s.close();
});

test('resolveTechnology: Maschine exakt vor Default, nächste Dicke', () => {
    const t = [{ technologyId: 'a', materialId: 1, thickness: 10 },
               { technologyId: 'b', materialId: 1, thickness: 20, machineId: 'm' }];
    assert.strictEqual(resolveTechnology(t, { machineId: 'm', materialId: 1, thickness: 10 }).technology.technologyId, 'b');
    assert.strictEqual(resolveTechnology(t, { machineId: 'x', materialId: 1, thickness: 19 }).technology.technologyId, 'a');
    assert.strictEqual(resolveTechnology(t, { materialId: 1, thickness: 19 }).technology.technologyId, 'a');
    assert.strictEqual(resolveTechnology(t, { materialId: 2, thickness: 10 }), null);
});

test('Reports: Kalkulation (JSON) und PDF aus gespeichertem/inline Plan', async () => {
    const s = await setup();
    await s.call('POST', '/api/materials', { materialId: 21, name: 'Feinsteinzeug', specificWeight: 2.4, pricePerKg: 1.2 });
    await s.call('POST', '/api/technologies', { technologyId: 'T1', materialId: 21, thickness: 10, cutting: { quality: 3, nozzleId: 3, pressure: 2900 }, cost: { machineRatePerH: 100 } });
    const p = part('P-1', { geometry: { contours: [{ id: 'c1', role: 'disc', closed: true, points: [[0, 0], [100, 0], [100, 50], [0, 50]] }],
        bbox: { w: 100, l: 50 }, cutLength: 0.3, piercings: 1, netArea: 0.005, rectArea: 0.005 } });
    await s.call('POST', '/api/parts', p);
    const plan = { planId: 'PL1', materialId: 21, thickness: 10, machineId: 'cj1', sheet: { width: 1000, length: 500 }, stats: { sheets: 1 },
        instances: [{ partId: 'P-1', revision: 1, tx: 5, ty: 5, rot: 0, sheetIndex: 0 }, { partId: 'P-1', revision: 1, tx: 120, ty: 5, rot: 0, sheetIndex: 0 }] };
    await s.call('POST', '/api/plans', plan);

    const j = await s.call('POST', '/api/reports/cost', { planId: 'PL1', labor: true });
    assert.strictEqual(j.status, 200);
    assert.strictEqual(j.body.data.nested, 2); assert.strictEqual(j.body.techId, 'T1');
    assert.strictEqual(j.body.include.labor, true);
    assert.ok(j.body.total > 0 && j.body.parts[0].qty === 2);
    const inline = await s.call('POST', '/api/reports/cost', { plan: { ...plan, planId: undefined } });
    assert.strictEqual(inline.status, 200);

    const raw = await fetch(`http://127.0.0.1:${s.port}/api/reports/cost-pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: 'PL1' }) });
    assert.strictEqual(raw.status, 200);
    assert.strictEqual(raw.headers.get('content-type'), 'application/pdf');
    assert.match(raw.headers.get('content-disposition'), /Kalkulation_PL1\.pdf/);
    assert.strictEqual(Buffer.from(await raw.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');

    assert.strictEqual((await s.call('POST', '/api/reports/cost', { planId: 'NOPE' })).status, 404);
    assert.strictEqual((await s.call('POST', '/api/reports/cost', {})).status, 400);
    assert.strictEqual((await s.call('POST', '/api/reports/cost', { plan: { instances: [], sheet: { width: 0 } } })).status, 400);
    assert.strictEqual((await s.call('POST', '/api/reports/cost', { plan: { ...plan, materialId: null } })).status, 400);
    assert.strictEqual((await s.call('GET', '/api/reports/cost')).status, 404);
    s.close();
});

test('Plan: update-parts (single/all, andere Pläne, Fehler)', async () => {
    const s = await setup();
    const mk = (id, rev) => ({ ...part(id), revision: rev });
    await s.call('POST', '/api/parts', mk('P-1', 1));
    const inst = (n, rot, rev = 1) => ({ instId: `i${n}`, partId: 'P-1', revision: rev, tx: n * 10, ty: 0, rot, sheetIndex: 0 });
    const base = { materialId: 21, thickness: 10, sheet: { width: 1000, length: 500 }, stats: { sheets: 1 } };
    await s.call('POST', '/api/plans', { ...base, planId: 'PL1', instances: [inst(1, 0), inst(2, 90), inst(3, 0)] });
    await s.call('POST', '/api/plans', { ...base, planId: 'PL2', instances: [inst(1, 0)] });
    // neue Revision 2
    const r2 = await s.call('POST', '/api/parts/P-1/revision', part('P-1', { name: 'neu' }), { 'If-Match': '1' });
    assert.strictEqual(r2.body.revision, 2);

    let r = await s.call('POST', '/api/plans/PL1/update-parts', { partId: 'P-1', revision: 2, mode: 'single', instId: 'i2' });
    assert.strictEqual(r.status, 200); assert.strictEqual(r.body.changed, 1);
    let pl = (await s.call('GET', '/api/plans/PL1')).body;
    assert.deepStrictEqual(pl.instances.map(i => i.revision), [1, 2, 1]);
    r = await s.call('POST', '/api/plans/PL1/update-parts', { partId: 'P-1', revision: 2, mode: 'all', otherPlans: true });
    assert.deepStrictEqual(r.body.updated.map(u => [u.planId, u.changed]), [['PL1', 2], ['PL2', 1]]);
    assert.deepStrictEqual((await s.call('GET', '/api/plans/PL2')).body.instances.map(i => i.revision), [2]);
    // Fehler
    assert.strictEqual((await s.call('POST', '/api/plans/PL1/update-parts', { partId: 'P-1', revision: 9, mode: 'all' })).status, 400);
    assert.strictEqual((await s.call('POST', '/api/plans/PL1/update-parts', { partId: 'NOPE', revision: 1, mode: 'all' })).status, 404);
    assert.strictEqual((await s.call('POST', '/api/plans/PL1/update-parts', { partId: 'P-1', revision: 1, mode: 'single', instId: 'zz' })).status, 400);
    assert.strictEqual((await s.call('POST', '/api/plans/PL1/update-parts', { partId: 'P-1', revision: 1, mode: 'all' }, { 'If-Match': '999' })).status, 409);
    assert.strictEqual((await s.call('GET', '/api/plans/PL1/update-parts')).status, 405);
    s.close();
});
