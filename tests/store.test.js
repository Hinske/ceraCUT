const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStores, StoreError, assertId } = require('../lib/store');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ceracut-store-')); }

test('assertId blockt Pfad-Injection', () => {
    for (const bad of ['../x', 'a/b', '', '.hidden', 'a..b', null, 'x'.repeat(65)])
        assert.throws(() => assertId(bad), e => e.code === 'BAD_ID');
    assert.strictEqual(assertId('P-000123'), 'P-000123');
    assert.strictEqual(assertId(21), '21');
});

test('Teile: anlegen, version, Konflikt, Historie', async () => {
    const { parts } = createStores(tmp());
    const a = await parts.put({ partId: 'P-1', revision: 1, name: 'A' }, { user: 'mh' });
    assert.strictEqual(a.version, 1);
    await assert.rejects(parts.put({ partId: 'P-1', revision: 1 }, { createOnly: true }), e => e.code === 'EXISTS');
    await assert.rejects(parts.put({ partId: 'P-1', revision: 2 }, { expectedVersion: 5 }), e => e.code === 'CONFLICT');
    const b = await parts.put({ partId: 'P-1', revision: 2, name: 'B' }, { expectedVersion: 1 });
    assert.strictEqual(b.version, 2);
    assert.strictEqual(b.createdAt, a.createdAt);
    assert.deepStrictEqual(parts.revisions('P-1'), [1]);
    assert.strictEqual(parts.getRevision('P-1', 1).name, 'A');
    assert.strictEqual(parts.get('P-1').name, 'B');
});

test('Teile: list/Index bleibt aktuell, delete behält Historie', async () => {
    const { parts } = createStores(tmp());
    await parts.put({ partId: 'P-1', revision: 1 });
    assert.strictEqual(parts.list().length, 1);
    await parts.put({ partId: 'P-2', revision: 1 });
    assert.strictEqual(parts.list().length, 2);
    await parts.put({ partId: 'P-2', revision: 2 });
    await parts.delete('P-2');
    assert.strictEqual(parts.list().length, 1);
    assert.throws(() => parts.get('P-2'), e => e.code === 'NOT_FOUND');
    assert.deepStrictEqual(parts.revisions('P-2'), [1]);
});

test('parallele Schreibzugriffe gehen nicht verloren', async () => {
    const { sheets } = createStores(tmp());
    await Promise.all(Array.from({ length: 25 }, (_, i) => sheets.upsert({ sheetId: `S-${i}`, width: 1500 })));
    assert.strictEqual(sheets.all().length, 25);
    assert.strictEqual(sheets.version(), 25);
});

test('Liste: numerische IDs, Ersetzen, Konflikt, Remove', async () => {
    const { materials } = createStores(tmp());
    await materials.upsert({ materialId: 21, name: 'Feinsteinzeug' });
    await materials.upsert({ materialId: 21, name: 'FSZ' });
    assert.strictEqual(materials.all().length, 1);
    assert.strictEqual(materials.get(21).name, 'FSZ');
    await assert.rejects(materials.upsert({ materialId: 22 }, { expectedVersion: 99 }), e => e.code === 'CONFLICT');
    await materials.remove(21);
    assert.throws(() => materials.get(21), e => e.code === 'NOT_FOUND');
});

test('kaputte Datei wird gemeldet, nicht überschrieben', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'sheets.json'), '{kaputt');
    const { sheets } = createStores(dir);
    await assert.rejects(sheets.upsert({ sheetId: 'S-1' }), e => e instanceof StoreError && e.code === 'CORRUPT');
    assert.strictEqual(fs.readFileSync(path.join(dir, 'sheets.json'), 'utf8'), '{kaputt');
});
