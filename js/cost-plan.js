/**
 * CeraCUT Plan Cost V1.0
 * Kalkulation eines Schachtelplans (FINest-Blöcke): Fertigung · Material · Verbrauchsmaterial · Zusatz,
 * Teile-Einzelpreise. Reine Logik (DOM-frei) — läuft im Browser und im Node-Server (PDF-Bericht).
 *
 * Eingaben stammen aus dem Plan (Instanzen, Blech), den Teilen (Schnittlänge, Anstiche, Fläche) und der
 * Technologie-/Materialdatenbank (data/technologies.json, materials.json). Fehlt ein Wert (0/leer), wird
 * ein Richtwert verwendet und in `defaultsUsed` gemeldet — Preise müssen vom Admin kalibriert werden.
 *
 * Konzept: docs/finest-integration-konzept.md §1.6, Schema §2.1 (technology.cost)
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-plancost
 *
 * (c) Cerasell GmbH
 */

const PlanCost = (() => {
    'use strict';

    // Richtwerte (identisch zu cost-calculator.js DEFAULT_SETTINGS), nur wenn die Technologie nichts vorgibt
    const DEFAULTS = {
        machineRatePerH: 120,      // €/h
        abrasivePerKg: 0.35,       // €/kg
        abrasiveGPerMin: 250,      // g/min (wenn cutting.abrasiveRate fehlt)
        powerKw: 37,               // kW
        powerPerKwh: 0.30,         // €/kWh
        waterLPerMin: 3.5,         // l/min
        waterPerM3: 4.5,           // €/m³
        piercingSurcharge: 0.10,   // € je Anstich
        setupCostFlat: 25,         // € Rüstpauschale, wenn setupMin/laborPerH nicht gepflegt
        laborPerH: 50,             // €/h Arbeit (nur wenn "Arbeit" aktiv)
        materialPricePerM2: 50,    // €/m² Blech, wenn pricePerKg fehlt
        rapidSpeed: 20000,         // mm/min
        feedFallback: 85.4,        // mm/min (Q4 Stahl 10 mm), wenn keine Engine
        pierceFallback: 2.0        // s
    };

    const pos = v => (Number.isFinite(v) && v > 0 ? v : null);

    function partFor(partsMap, inst) {
        return partsMap[`${inst.partId}@${inst.revision}`] || partsMap[inst.partId];
    }

    /** Eilganglänge schätzen: nächster-Nachbar-Tour über die Instanz-Mittelpunkte je Blech, Start/Ende (0,0). */
    function estimateRapid(plan, partsMap) {
        const bySheet = new Map();
        for (const i of plan.instances) {
            const p = partFor(partsMap, i); if (!p) continue;
            const b = p.geometry.bbox;
            const quarter = Math.abs(((i.rot % 180) + 180) % 180) === 90;   // 90°/270° vertauscht Breite/Länge
            const w = quarter ? b.l : b.w, l = quarter ? b.w : b.l;
            (bySheet.get(i.sheetIndex || 0) || bySheet.set(i.sheetIndex || 0, []).get(i.sheetIndex || 0))
                .push({ x: i.tx + w / 2, y: i.ty + l / 2 });
        }
        let len = 0;
        for (const pts of bySheet.values()) {
            let cur = { x: 0, y: 0 };
            const rest = pts.slice();
            while (rest.length) {
                let bi = 0, bd = Infinity;
                rest.forEach((q, k) => { const d = Math.hypot(q.x - cur.x, q.y - cur.y); if (d < bd) { bd = d; bi = k; } });
                len += bd; cur = rest.splice(bi, 1)[0];
            }
            len += Math.hypot(cur.x, cur.y);
        }
        return len;
    }

    /**
     * @param {object} plan       Plan-Datensatz
     * @param {object} partsMap   `partId@rev` | `partId` → Teil (mit geometry)
     * @param {object} tech       Technologie-Datensatz (kann leer sein)
     * @param {object} material   Material-Datensatz ({specificWeight, pricePerKg, name, …})
     * @param {object} [opts]     { include:{manufacturing,material,consumable,additional,labor} , engine }
     */
    function calculate(plan, partsMap, tech = {}, material = {}, opts = {}) {
        const inc = { manufacturing: true, material: true, consumable: true, additional: true, labor: false, ...(opts.include || {}) };
        const defaultsUsed = [];
        const dflt = (value, def, label) => { const v = pos(value); if (v !== null) return v; defaultsUsed.push(label); return def; };
        const c = tech.cost || {}, cut = tech.cutting || {};
        const engine = opts.engine || (typeof CeraJetEngine !== 'undefined' ? CeraJetEngine : null);

        const thickness = pos(plan.thickness) || pos(tech.thickness) || 10;
        const sheets = Math.max(1, plan.stats?.sheets || 1);
        const W = plan.sheet.width, L = plan.sheet.length;
        const density = dflt(material.specificWeight, 2.4, 'spezifisches Gewicht');

        // ── Mengen aus den Instanzen ──
        const perPart = new Map();      // partId → Summen
        let cutLen = 0, pierce = 0, netArea = 0, rectArea = 0;
        for (const inst of plan.instances) {
            const p = partFor(partsMap, inst);
            if (!p) continue;
            const g = p.geometry;
            const m = perPart.get(inst.partId) || { partId: inst.partId, name: p.name, orderId: p.orderId, qty: 0, cutLen: 0, pierce: 0, net: 0, rect: 0, size: g.bbox };
            m.qty++; m.cutLen += g.cutLength * 1000; m.pierce += g.piercings; m.net += g.netArea; m.rect += g.rectArea;
            perPart.set(inst.partId, m);
            cutLen += g.cutLength * 1000; pierce += g.piercings; netArea += g.netArea; rectArea += g.rectArea;
        }
        const rapidLen = estimateRapid(plan, partsMap);

        // ── Zeiten ──
        let feed = pos(cut.feedOverride), pierceT = null;
        if (engine && tech.materialId !== undefined) {
            try {
                const e = engine.calculate({ materialId: tech.materialId, nozzleId: cut.nozzleId ?? 3, thickness,
                    pressure: pos(cut.pressure) || 2900, optMode: 'kostenProduktion', abrasiveOverride: pos(cut.abrasiveRate) });
                const qi = Math.max(0, Math.min(4, (cut.quality ?? 2) - 1));      // Qualität 1-basiert wie CamContour
                if (!feed) feed = e.feeds[qi];
                pierceT = e.pierceTime;
            } catch { /* Fallback unten */ }
        }
        if (!feed) { feed = DEFAULTS.feedFallback; defaultsUsed.push('Vorschub'); }
        if (!pierceT) { pierceT = DEFAULTS.pierceFallback; defaultsUsed.push('Anschusszeit'); }
        const tCut = cutLen / feed * 60, tRapid = rapidLen / DEFAULTS.rapidSpeed * 60, tPierce = pierce * pierceT;
        const tActive = tCut + tPierce, tTotal = tCut + tRapid + tPierce;
        const hActive = tActive / 3600, hTotal = tTotal / 3600;

        // ── Fertigung ──
        const rate = dflt(c.machineRatePerH, DEFAULTS.machineRatePerH, 'Maschinenstundensatz');
        const manufacturing = {
            cutting: tCut / 3600 * rate, rapid: tRapid / 3600 * rate, piercing: tPierce / 3600 * rate
        };
        manufacturing.total = manufacturing.cutting + manufacturing.rapid + manufacturing.piercing;

        // ── Material ──
        const sheetWeight = W * L / 1e6 * (thickness / 1000) * density * 1000;          // kg je Blech
        const netWeight = netArea * (thickness / 1000) * density * 1000;
        const totalWeight = sheetWeight * sheets;
        const scrapKg = Math.max(0, totalWeight - netWeight);
        let pricePerKg = pos(material.pricePerKg);
        if (pricePerKg === null) {
            pricePerKg = (DEFAULTS.materialPricePerM2 / ((thickness / 1000) * density * 1000));   // €/m² → €/kg
            defaultsUsed.push('Materialpreis');
        }
        const mat = { sheets, sheetWeightKg: sheetWeight, totalWeightKg: totalWeight, netWeightKg: netWeight, scrapKg,
                      pricePerKg, total: totalWeight * pricePerKg, scrapCost: scrapKg * pricePerKg };

        // ── Verbrauch ──
        const abrG = pos(cut.abrasiveRate) || (defaultsUsed.push('Abrasivrate'), DEFAULTS.abrasiveGPerMin);
        const abrKg = hActive * 60 * abrG / 1000;
        const kw = dflt(c.powerKw, DEFAULTS.powerKw, 'Leistung (kW)');
        const waterM3 = (pos(c.waterPerH) ? c.waterPerH / 1000 * hActive : hActive * 60 * DEFAULTS.waterLPerMin / 1000);
        if (!pos(c.waterPerH)) defaultsUsed.push('Wasserverbrauch');
        const consumable = {
            abrasive: abrKg * dflt(c.abrasivePerKg, DEFAULTS.abrasivePerKg, 'Abrasivpreis'),
            power: hTotal * kw * DEFAULTS.powerPerKwh,
            water: waterM3 * DEFAULTS.waterPerM3,
            nozzle: pos(c.nozzleLifeH) && pos(c.nozzlePrice) ? hActive / c.nozzleLifeH * c.nozzlePrice : 0,
            abrasiveKg: abrKg, powerKwh: hTotal * kw, waterM3
        };
        consumable.total = consumable.abrasive + consumable.power + consumable.water + consumable.nozzle;

        // ── Zusatz ──
        const laborRate = dflt(c.laborPerH, DEFAULTS.laborPerH, 'Stundensatz Arbeit');
        const additional = {
            piercing: pierce * (pos(c.piercingSurcharge) || DEFAULTS.piercingSurcharge),
            setup: pos(c.setupMin) && pos(c.laborPerH) ? c.setupMin / 60 * c.laborPerH : DEFAULTS.setupCostFlat,
            nc: pos(c.ncProgMin) && pos(c.laborPerH) ? c.ncProgMin / 60 * c.laborPerH : 0,
            labor: hTotal * laborRate
        };
        if (!(pos(c.setupMin) && pos(c.laborPerH))) defaultsUsed.push('Rüstkosten');
        additional.total = additional.piercing + additional.setup + additional.nc + (inc.labor ? additional.labor : 0);

        const blocks = { manufacturing, material: mat, consumable, additional };
        const total = (inc.manufacturing ? manufacturing.total : 0) + (inc.material ? mat.total : 0)
                    + (inc.consumable ? consumable.total : 0) + (inc.additional ? additional.total : 0);

        // ── Teile-Einzelpreise: Zeit-/Verbrauchsanteile nach Schnittlänge/Anstichen/Fläche, Material nach Rechteckfläche ──
        const timeBased = (inc.manufacturing ? manufacturing.total : 0) + (inc.consumable ? consumable.total : 0) + (inc.additional ? additional.total : 0);
        const parts = [...perPart.values()].map(m => {
            const share = 0.6 * (cutLen ? m.cutLen / cutLen : 0) + 0.2 * (pierce ? m.pierce / pierce : 0) + 0.2 * (netArea ? m.net / netArea : 0);
            const mShare = rectArea ? m.rect / rectArea : 0;
            const cost = timeBased * share + (inc.material ? mat.total * mShare : 0);
            return { partId: m.partId, name: m.name, orderId: m.orderId, qty: m.qty, size: m.size,
                     surface: m.net, cutLengthM: m.cutLen / 1000, cutTime: tCut * (cutLen ? m.cutLen / cutLen : 0),
                     total: cost, unit: m.qty ? cost / m.qty : 0 };
        });

        return {
            include: inc, blocks, total,
            time: { cutting: tCut, rapid: tRapid, piercing: tPierce, total: tTotal },
            data: { thickness, density, sheetW: W, sheetL: L, sheets, nested: plan.instances.length, piercings: pierce,
                    cutLengthM: cutLen / 1000, rapidLengthM: rapidLen / 1000, netAreaM2: netArea, rectAreaM2: rectArea, feed },
            parts, defaultsUsed: [...new Set(defaultsUsed)]
        };
    }

    function fmtTime(sec) {
        const s = Math.round(sec || 0);
        return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
    const eur = v => (Math.round((v || 0) * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

    return { calculate, estimateRapid, fmtTime, eur, DEFAULTS };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanCost;
}
