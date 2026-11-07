/**
 * CeraCUT Seed V1.0
 * Befüllt materials/technologies beim ersten Start aus CeraJetEngine (nur wenn leer).
 * Bestehende Daten werden nie überschrieben.
 *
 * Spezifische Gewichte sind Richtwerte (g/cm³) — bitte im Technologie-Manager prüfen.
 * Preise/Stundensätze bleiben 0 und müssen vom Admin gepflegt werden.
 *
 * Created: 2026-11-07
 * Build: 20261107-seed
 *
 * (c) Cerasell GmbH
 */

const path = require('path');
const CeraJetEngine = require(path.join(__dirname, '..', 'js', 'cerajet-engine.js'));

// Richtwerte g/cm³ je Materialname (Teilstring-Match, erster Treffer)
const DENSITY = [
    ['Edelstahl', 7.9], ['Hardox', 7.85], ['Inconel', 8.4], ['Nilo', 8.1], ['AL-6XN', 8.05],
    ['M2 Tool', 8.1], ['Stahl', 7.85], ['Aluminium', 2.7], ['Titan', 4.5], ['Kupfer', 8.96],
    ['Bronze', 8.8], ['Glas', 2.5], ['Marmor', 2.7], ['Granit', 2.7], ['SIC', 3.2],
    ['Feinsteinzeug', 2.4], ['Keramik', 2.4], ['Naturstein', 2.7], ['Plexiglas', 1.19], ['Graphit', 1.8]
];
const densityOf = name => (DENSITY.find(([k]) => name.includes(k)) || [null, 2.7])[1];

function materialRecord(m) {
    return {
        materialId: m.id, name: m.name, cat: m.cat,
        specificWeight: densityOf(m.name), pricePerKg: 0,
        bkz: m.bkz, akz: m.akz, refQ4: m.refQ4, verified: !!m.v, seeded: true
    };
}

/** Standard-Technologie bei Referenzbedingungen (10 mm, 2900 bar, Düse 0.25/0.80, 200 g/min). */
function defaultTechnology(m) {
    const ref = CeraJetEngine.REF;
    return {
        technologyId: `T-${m.id}-${ref.h}`, materialId: m.id, thickness: ref.h, machineId: null,
        general: {
            kerf: 0.8, zAfterCut: 40,
            // Waricam-Referenz (tasks/waricam-angleichung.md): Lead-In 45°/3 mm, Überschnitt 3 mm, Lead-Out 1 mm senkrecht
            leadDefault: {
                outer: { type: 'linear', angle: 45, in: 3, out: 1, overcut: 3 },
                inner: { type: 'linear', angle: 45, in: 3, out: 1, overcut: 3 }
            },
            rounding: { radius: 0.5, refAngle: 75, tol: 75 }
        },
        microJoints: { enabled: false, count: 2, width: 1.0 },
        cutting: { quality: 3, nozzleId: 3, pressure: ref.P, abrasiveRate: ref.m_a,
                   feedOverride: null, cornerFactor: CeraJetEngine.CORNER_FACTOR, pierceType: 'auto' },
        nesting: { partToPart: 3, partToEdge: 5, rotations: [0, 90, 180, 270] },
        misc: { minPierceClearance: 10, bigInnerAreaCm2: 5000, circleTools: [] },
        cost: { machineRatePerH: 0, abrasivePerKg: 0, nozzleLifeH: 0, nozzlePrice: 0, powerKw: 0,
                waterPerH: 0, setupMin: 0, ncProgMin: 0, laborPerH: 0 },
        seeded: true
    };
}

/**
 * @param {{materials:ListCollection, technologies:ListCollection}} stores
 * @returns {Promise<{materials:number, technologies:number}>} Anzahl neu angelegter Einträge
 */
async function seedIfEmpty(stores) {
    const out = { materials: 0, technologies: 0 };
    if (stores.materials.all().length === 0) {
        for (const m of CeraJetEngine.MATERIALS) { await stores.materials.upsert(materialRecord(m), { user: 'seed' }); out.materials++; }
    }
    if (stores.technologies.all().length === 0) {
        // Standard-Technologie nur für Stein/Fliesen (Cerasell-Kerngeschäft); Rest legt der Admin an
        for (const m of CeraJetEngine.MATERIALS.filter(x => x.cat === 'Stein')) {
            await stores.technologies.upsert(defaultTechnology(m), { user: 'seed' }); out.technologies++;
        }
    }
    return out;
}

module.exports = { seedIfEmpty, materialRecord, defaultTechnology };
