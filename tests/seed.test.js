const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');
const { createStores } = require('../lib/store');
const { seedIfEmpty } = require('../lib/seed');
const CeraJetEngine = require('../js/cerajet-engine.js');

test('Seed füllt leere Stores, ist idempotent, überschreibt nichts', async () => {
    const st = createStores(fs.mkdtempSync(path.join(os.tmpdir(), 'ceracut-seed-')));
    const r = await seedIfEmpty(st);
    assert.strictEqual(r.materials, CeraJetEngine.MATERIALS.length);
    assert.ok(r.technologies >= 3);
    assert.strictEqual(st.materials.get(21).name, 'Fliesen (Feinsteinzeug)');
    assert.strictEqual(st.materials.get(21).specificWeight, 2.4);
    await st.materials.upsert({ materialId: 21, name: 'Geändert' });
    assert.deepStrictEqual(await seedIfEmpty(st), { materials: 0, technologies: 0 });
    assert.strictEqual(st.materials.get(21).name, 'Geändert');
});
