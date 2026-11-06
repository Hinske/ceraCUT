'use strict';
// Erzeugt tests/golden/leads-old.json aus dem AKTUELLEN cam-contour.js (Referenz vor dem Umbau).
const fs = require('fs'), path = require('path');
const F = require('./helpers/contour-fixtures.js');
const out = {};
for (const s of F.buildScenarios()) {
    try { out[s.name] = F.snapshotContour(s.make()); } catch (e) { out[s.name] = { error: String(e.message) }; }
}
for (const s of F.buildMultiScenarios()) {
    try {
        const cs = s.make();
        cs.forEach(c => c.checkMultiContourCollision(cs, 0.5));
        out[s.name] = cs.map(c => F.snapshotContour(c));
    } catch (e) { out[s.name] = { error: String(e.message) }; }
}
fs.writeFileSync(path.join(__dirname, 'golden/leads-old.json'), JSON.stringify(out));
const errs = Object.entries(out).filter(([, v]) => v.error);
console.log('Szenarien:', Object.keys(out).length, 'Fehler:', errs.length);
errs.slice(0, 5).forEach(([k, v]) => console.log(' ', k, v.error));
