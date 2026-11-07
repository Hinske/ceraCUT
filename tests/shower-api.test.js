'use strict';
// Duschboard-API (lib/shower-api.js) + Kunden-PDF (lib/shower-pdf.js)
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handleShowerApi, slug } = require('../lib/shower-api.js');
const { showerPdf, normalizeOptions } = require('../lib/shower-pdf.js');
const G = require('../js/shower-board-generator.js');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shower-api-'));
let user = { username: 'anna', role: 'user' };
const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const q = Object.fromEntries(u.searchParams);
    const handled = handleShowerApi(req, res, u.pathname, q, user, dataDir);
    if (!handled) { res.statusCode = 404; res.end('{}'); }
});
let base;
test.before(async () => { await new Promise(r => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, headers: r.headers, body: ct.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
};
const input = { breite: 1300, tiefe: 1000, ablauf: { w: 140, h: 140 }, fliese: { lang: 597, kurz: 597 } };
const proj = (name, extra = {}) => ({ name, kunde: 'Kochhan', notiz: 'n', state: { fields: { 'ds-b': '1300', 'ds-t': '1000' }, checks: {}, override: null }, ...extra });

test('slug: Umlaute und Sonderzeichen', () => {
    assert.strictEqual(slug('Bad Müller 1300×1000!'), 'bad-mueller-1300-1000');
    assert.strictEqual(slug('///'), 'duschboard');
});

test('Projekte: ohne Login 401', async () => {
    const saved = user; user = null;
    assert.strictEqual((await call('GET', '/api/shower/projects')).status, 401);
    user = saved;
});

test('Projekte: anlegen, doppelter Name bekommt neue ID, Liste + Wildcard-Filter, laden', async () => {
    const a = await call('POST', '/api/shower/projects', proj('Standard 1300x1000'));
    assert.strictEqual(a.status, 201); assert.strictEqual(a.body.id, 'standard-1300x1000'); assert.strictEqual(a.body.createdBy, 'anna');
    const b = await call('POST', '/api/shower/projects', proj('Standard 1300x1000'));
    assert.strictEqual(b.body.id, 'standard-1300x1000-2');
    await call('POST', '/api/shower/projects', proj('Bad Mueller', { kunde: 'Mueller' }));
    const all = await call('GET', '/api/shower/projects');
    assert.strictEqual(all.body.total, 3);
    assert.strictEqual((await call('GET', '/api/shower/projects?q=stand*')).body.total, 2);
    assert.strictEqual((await call('GET', '/api/shower/projects?q=mueller')).body.total, 1);
    assert.strictEqual((await call('GET', '/api/shower/projects?q=gibtsnicht')).body.total, 0);
    const one = await call('GET', '/api/shower/projects/standard-1300x1000');
    assert.strictEqual(one.status, 200); assert.strictEqual(one.body.state.fields['ds-b'], '1300');
    assert.strictEqual(all.body.items[0].breite, '1300');
});

test('Projekte: Validierung (Name fehlt, state fehlt, ungueltige ID) und 404', async () => {
    assert.strictEqual((await call('POST', '/api/shower/projects', { ...proj('x'), name: '  ' })).status, 400);
    assert.strictEqual((await call('POST', '/api/shower/projects', { name: 'ohne state' })).status, 400);
    assert.strictEqual((await call('GET', '/api/shower/projects/gibts-nicht')).status, 404);
    assert.strictEqual((await call('GET', '/api/shower/projects/..%2Fx')).status, 400);
});

test('Projekte: PUT mit If-Match, Konflikt 409, Ersteller bleibt', async () => {
    const cur = await call('GET', '/api/shower/projects/bad-mueller');
    const ok = await call('PUT', '/api/shower/projects/bad-mueller', proj('Bad Mueller neu', { notiz: 'geändert' }), { 'If-Match': String(cur.body.version) });
    assert.strictEqual(ok.status, 200); assert.strictEqual(ok.body.version, cur.body.version + 1); assert.strictEqual(ok.body.createdBy, 'anna'); assert.strictEqual(ok.body.notiz, 'geändert');
    const stale = await call('PUT', '/api/shower/projects/bad-mueller', proj('x'), { 'If-Match': String(cur.body.version) });
    assert.strictEqual(stale.status, 409);
    assert.strictEqual((await call('PUT', '/api/shower/projects/bad-mueller', proj('x'), { 'If-Match': 'abc' })).status, 400);
});

test('Projekte: Loeschen nur Ersteller oder Admin', async () => {
    user = { username: 'bernd', role: 'user' };
    assert.strictEqual((await call('DELETE', '/api/shower/projects/bad-mueller')).status, 403);
    user = { username: 'chef', role: 'admin' };
    assert.strictEqual((await call('DELETE', '/api/shower/projects/bad-mueller')).status, 200);
    user = { username: 'anna', role: 'user' };
    assert.strictEqual((await call('DELETE', '/api/shower/projects/standard-1300x1000-2')).status, 200);
    assert.strictEqual((await call('GET', '/api/shower/projects/bad-mueller')).status, 404);
});

test('PDF: Varianten + Optionen -> gueltiges PDF, Dateiname aus Projekt', async () => {
    const r = await call('POST', '/api/shower/pdf', { input, variantIds: ['current', 'kreuz', 'verband50-reihen'], options: { perPage: 2, color: false }, meta: { projekt: 'Bad Müller', kunde: 'K' } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers.get('content-type'), 'application/pdf');
    assert.ok(r.body.slice(0, 5).toString() === '%PDF-');
    assert.match(r.headers.get('content-disposition'), /Duschboard_bad-mueller_Verlegevarianten\.pdf/);
});

test('PDF: fehlende/ungueltige Eingaben -> 400', async () => {
    assert.strictEqual((await call('POST', '/api/shower/pdf', { input })).status, 400);
    assert.strictEqual((await call('POST', '/api/shower/pdf', { input, variantIds: ['gibts-nicht'] })).status, 400);
    assert.strictEqual((await call('POST', '/api/shower/pdf', { input: { ...input, breite: -1 }, variantIds: ['current'] })).status, 400);
});

test('PDF: Seitenzahl je Layout (Deckblatt + 1/2/4 je Seite), Optionen werden normalisiert', async () => {
    const pages = async (opts, ids) => {
        const buf = await showerPdf({ input, variantIds: ids, options: opts, meta: {} });
        return (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    };
    const ids = ['kreuz', 'kreuz-45', 'verband50-reihen', 'verband33-reihen', 'zufall'];
    assert.strictEqual(await pages({ perPage: 1, cover: true }, ids), 6);
    assert.strictEqual(await pages({ perPage: 1, cover: false }, ids), 5);
    assert.strictEqual(await pages({ perPage: 2, cover: false }, ids), 3);
    assert.strictEqual(await pages({ perPage: 4, cover: false }, ids), 2);
    const o = normalizeOptions({ perPage: 3, orientation: 'quer', color: 'ja', pieceNumbers: true, unbekannt: 1 });
    assert.deepStrictEqual([o.perPage, o.orientation, o.color, o.pieceNumbers, o.unbekannt], [1, 'landscape', true, true, undefined]);
});

test('PDF: interne Angaben nur auf Wunsch (Teilenummern/Hinweise erscheinen nicht im Standard-PDF)', async () => {
    const mk = async o => (await showerPdf({ input: { ...input, fliese: { lang: 600, kurz: 300 } }, variantIds: ['kreuz'], options: { cover: false, footer: false, ...o }, meta: {} })).length;
    const plain = await mk({}), intern = await mk({ pieceNumbers: true, pieceDims: true, angles: true, stats: true, warnings: true });
    assert.ok(intern > plain, 'mit internen Angaben mehr Inhalt');
});

test('Variantenkatalog Raster (Standard): Verlegemuster bleibt, es variiert die Rasterlage; liegend/hochkant nur bei Rechteckfliesen', () => {
    const sq = G.variantCatalog(input), re = G.variantCatalog({ ...input, fliese: { lang: 600, kurz: 300 }, muster: 'verband', versatz: 0.5 });
    assert.ok(sq.length >= 5 && sq.every(v => v.id.startsWith('r-')) && sq.some(v => v.id === 'r-auto') && sq.some(v => v.id === 'r-bmitte'));
    assert.ok(sq.every(v => !/hochkant/.test(v.label)), 'quadratische Fliese: keine liegend/hochkant-Varianten');
    assert.ok(re.some(v => v.group === 'Fliese liegend') && re.some(v => v.group === 'Fliese hochkant'));
    // Muster der Varianten = Muster der Eingabe
    for (const v of G.variantDefs({ ...input, muster: 'verband', versatz: 1 / 3 })) assert.ok(!('muster' in v.overrides), 'Raster-Variante aendert das Verlegemuster nicht');
    assert.ok(sq.every(v => v.stats.count > 0 && v.stats.tilesUsed > 0));
    assert.ok(!G.variantDefs({ ...input, muster: 'kreuz', drehung: 45 }).some(d => d.id === 'r-ablauf'), 'Ablaufkante nur bei Kreuzfuge ohne Drehung');
    assert.deepStrictEqual(G.variantDefs({ ...input, muster: 'keins' }), []);
    assert.deepStrictEqual(G.variantDefs({ ...input, breite: -1 }), []);
});

test('Variantenkatalog Verlegemuster (optional): stabile IDs, quadratische Fliese ohne Fischgraet, rechteckige mit', () => {
    const sq = G.variantCatalog(input, { mode: 'muster' }).map(v => v.id), re = G.variantCatalog({ ...input, fliese: { lang: 600, kurz: 300 } }, { mode: 'muster' }).map(v => v.id);
    assert.ok(sq.includes('kreuz') && sq.includes('verband50-reihen') && !sq.includes('fischgraet'));
    assert.ok(re.includes('fischgraet') && re.includes('kreuz-hoch') && re.includes('verband33-hoch'));
});

test('PDF: Raster-Varianten werden aufgeloest (r-bmitte) und unterscheiden sich in der Rasterlage', async () => {
    const R = require('../lib/shower-pdf.js');
    const v = R.resolveVariants(input, undefined, ['r-lu', 'r-bmitte', 'kreuz', 'gibts-nicht']);
    assert.deepStrictEqual(v.map(x => x.id), ['r-lu', 'r-bmitte', 'kreuz']);
    assert.notDeepStrictEqual(v[0].result.pieces.length, v[1].result.pieces.length);
    const buf = await showerPdf({ input, variantIds: ['r-lu', 'r-bmitte'], options: { cover: false }, meta: {} });
    assert.strictEqual(buf.slice(0, 5).toString(), '%PDF-');
});
