const test = require('node:test');
const assert = require('node:assert');
const PlanUpdate = require('../js/plan-update.js');

const plan = () => ({ planId: 'P', instances: [
    { instId: 'i1', partId: 'A', revision: 1, rot: 0 }, { instId: 'i2', partId: 'A', revision: 1, rot: 90 },
    { instId: 'i3', partId: 'A', revision: 1, rot: 360 }, { instId: 'i4', partId: 'B', revision: 1, rot: 0 },
    { instId: 'i5', partId: 'A', revision: 1, rot: 0, mirror: true }] });

test('single / sameTransform / all', () => {
    const p = plan();
    let r = PlanUpdate.apply(p, { partId: 'A', newRevision: 2, mode: 'single', instId: 'i2' });
    assert.deepStrictEqual(r.changed, ['i2']);
    assert.strictEqual(r.plan.instances.find(i => i.instId === 'i2').derivedFrom, 'A@1');
    r = PlanUpdate.apply(p, { partId: 'A', newRevision: 2, mode: 'sameTransform', instId: 'i1' });
    assert.deepStrictEqual(r.changed, ['i1', 'i3']);                      // 0° und 360°, nicht gespiegelt
    r = PlanUpdate.apply(p, { partId: 'A', newRevision: 2, mode: 'all' });
    assert.deepStrictEqual(r.changed, ['i1', 'i2', 'i3', 'i5']);          // B bleibt
    assert.strictEqual(r.plan.instances.find(i => i.instId === 'i4').revision, 1);
    assert.strictEqual(p.instances[0].revision, 1, 'Original unverändert');
});

test('Fehler und bereits aktuelle Instanzen', () => {
    const p = plan();
    assert.throws(() => PlanUpdate.apply(p, { partId: 'A', newRevision: 2, mode: 'single', instId: 'i4' }), /gehört nicht/);
    assert.throws(() => PlanUpdate.apply(p, { partId: 'A', newRevision: 2, mode: 'x' }), /Modus/);
    assert.throws(() => PlanUpdate.apply(p, { partId: 'A', newRevision: 0, mode: 'all' }), /Revision/);
    const r1 = PlanUpdate.apply(p, { partId: 'A', newRevision: 2, mode: 'all' });
    assert.deepStrictEqual(PlanUpdate.apply(r1.plan, { partId: 'A', newRevision: 2, mode: 'all' }).changed, []);
});

test('summarize gruppiert nach Drehung/Spiegelung/Revision', () => {
    const rows = PlanUpdate.summarize(plan(), 'A');
    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows.find(r => r.rot === 0 && !r.mirror).count, 2);
});
