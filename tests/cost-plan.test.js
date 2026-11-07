const test = require('node:test');
const assert = require('node:assert');
global.CeraJetEngine = require('../js/cerajet-engine.js');
const PlanCost = require('../js/cost-plan.js');

const part = (id, w, h, cutLen, pierce, net, extra = {}) => ({ partId: id, name: id, orderId: 'O-' + id, revision: 1,
    geometry: { bbox: { w, l: h }, cutLength: cutLen, piercings: pierce, netArea: net, rectArea: w * h / 1e6 }, ...extra });
const parts = { A: part('A', 100, 50, 0.3, 2, 0.0046), B: part('B', 200, 100, 0.6, 1, 0.02) };
const plan = { thickness: 10, sheet: { width: 3000, length: 1500 }, stats: { sheets: 1 },
    instances: [
        { partId: 'A', revision: 1, tx: 10, ty: 10, rot: 0 }, { partId: 'A', revision: 1, tx: 120, ty: 10, rot: 0 },
        { partId: 'B', revision: 1, tx: 10, ty: 100, rot: 90 }] };
const tech = { materialId: 21, thickness: 10, cutting: { quality: 3, nozzleId: 3, pressure: 2900, abrasiveRate: 200 },
    cost: { machineRatePerH: 100, abrasivePerKg: 0.5, powerKw: 30, waterPerH: 200, setupMin: 10, ncProgMin: 6, laborPerH: 60, nozzleLifeH: 100, nozzlePrice: 50 } };
const mat = { specificWeight: 2.4, pricePerKg: 1.2 };

test('Mengen, Zeiten und Gewichte stimmen', () => {
    const r = PlanCost.calculate(plan, parts, tech, mat);
    assert.strictEqual(r.data.nested, 3);
    assert.ok(Math.abs(r.data.cutLengthM - (0.3 * 2 + 0.6)) < 1e-9);
    assert.strictEqual(r.data.piercings, 5);
    const w = 3 * 1.5 * 0.010 * 2.4 * 1000;                                    // 108 kg
    assert.ok(Math.abs(r.blocks.material.sheetWeightKg - w) < 1e-6);
    assert.ok(Math.abs(r.blocks.material.total - w * 1.2) < 1e-6);
    assert.ok(r.blocks.material.scrapKg > 0 && r.blocks.material.scrapKg < w);
    assert.ok(Math.abs(r.time.total - (r.time.cutting + r.time.rapid + r.time.piercing)) < 1e-9);
    assert.ok(r.time.cutting > 0 && r.time.rapid > 0);
});

test('Block-Summen, Gesamtsumme und Ein-/Ausschalten', () => {
    const r = PlanCost.calculate(plan, parts, tech, mat);
    const b = r.blocks;
    assert.ok(Math.abs(b.manufacturing.total - (b.manufacturing.cutting + b.manufacturing.rapid + b.manufacturing.piercing)) < 1e-9);
    assert.ok(Math.abs(b.additional.setup - 10 / 60 * 60) < 1e-9);               // 10 min × 60 €/h
    assert.ok(Math.abs(b.additional.nc - 6 / 60 * 60) < 1e-9);
    assert.ok(b.consumable.nozzle > 0);
    assert.ok(Math.abs(r.total - (b.manufacturing.total + b.material.total + b.consumable.total + b.additional.total)) < 1e-6);
    const noLabor = r.total, withLabor = PlanCost.calculate(plan, parts, tech, mat, { include: { labor: true } }).total;
    assert.ok(withLabor > noLabor);
    const onlyMat = PlanCost.calculate(plan, parts, tech, mat, { include: { manufacturing: false, consumable: false, additional: false } });
    assert.ok(Math.abs(onlyMat.total - b.material.total) < 1e-9);
});

test('Teilepreise summieren sich zum Gesamtpreis', () => {
    const r = PlanCost.calculate(plan, parts, tech, mat);
    const sum = r.parts.reduce((a, p) => a + p.total, 0);
    assert.ok(Math.abs(sum - r.total) < 1e-6, `${sum} vs ${r.total}`);
    const A = r.parts.find(p => p.partId === 'A');
    assert.strictEqual(A.qty, 2);
    assert.ok(Math.abs(A.unit * 2 - A.total) < 1e-9);
    assert.ok(r.parts.find(p => p.partId === 'B').unit > A.unit);                // größeres Teil teurer
});

test('Fehlende Preise → Richtwerte werden gemeldet; mehr Bleche = mehr Material', () => {
    const r = PlanCost.calculate(plan, parts, { materialId: 21, thickness: 10 }, {});
    for (const k of ['Maschinenstundensatz', 'Materialpreis', 'spezifisches Gewicht', 'Rüstkosten']) assert.ok(r.defaultsUsed.includes(k), k);
    assert.ok(r.total > 0);
    const two = PlanCost.calculate({ ...plan, stats: { sheets: 2 } }, parts, tech, mat);
    assert.ok(Math.abs(two.blocks.material.total - 2 * PlanCost.calculate(plan, parts, tech, mat).blocks.material.total) < 1e-6);
});

test('Eilgang-Schätzung und Formatierung', () => {
    const rapid = PlanCost.estimateRapid(plan, parts);
    assert.ok(rapid > 0 && rapid < 10000);
    assert.strictEqual(PlanCost.fmtTime(3725), '01:02:05');
    assert.match(PlanCost.eur(1234.5), /1\.234,50\s€/);
});
