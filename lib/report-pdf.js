/**
 * CeraCUT Report PDF V1.0
 * PDF-Bericht "Nesting-Kalkulation" (Kostenübersicht, technische Daten, Zeit & Gewicht, Teileübersicht, Plan).
 * Serverseitig mit pdfkit; Zahlen kommen aus js/cost-plan.js (PlanCost), Geometrie aus js/nesting-plan.js.
 *
 * Created: 2026-11-07
 * Build: 20261107-reportpdf
 *
 * (c) Cerasell GmbH
 */

const PDFDocument = require('pdfkit');
const PlanCost = require('../js/cost-plan.js');
const { NestingPlan } = require('../js/nesting-plan.js');

const BLUE = '#0b5cad', GREY = '#555555', LIGHT = '#e8eef5';
const eur = PlanCost.eur;
const fmt = (v, d = 2) => Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * @param {object} plan
 * @param {object} partsMap    `partId@rev` → Teil
 * @param {object} result      PlanCost.calculate-Ergebnis
 * @param {{machine?:string, material?:string, user?:string, sheetIndex?:number}} meta
 * @returns {Promise<Buffer>}
 */
function costPdf(plan, partsMap, result, meta = {}) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Nesting-Kalkulation ${plan.planId}`, Author: 'CeraCUT' } });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = doc.page.width - 80;
        const h2 = (t) => { doc.moveDown(0.8).font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text(t); doc.moveTo(40, doc.y + 1).lineTo(40 + W, doc.y + 1).strokeColor(BLUE).lineWidth(0.7).stroke(); doc.moveDown(0.4).fillColor('black'); };
        const kv = (rows, cols = 2) => {
            const colW = W / cols; const y0 = doc.y; const per = Math.ceil(rows.length / cols);
            rows.forEach(([k, v], i) => {
                const c = Math.floor(i / per), r = i % per, x = 40 + c * colW, y = y0 + r * 14;
                doc.font('Helvetica').fontSize(9).fillColor(GREY).text(k, x, y, { width: colW * 0.5 });
                doc.font('Helvetica-Bold').fillColor('black').text(String(v), x + colW * 0.5, y, { width: colW * 0.5 - 6 });
            });
            doc.y = y0 + per * 14 + 2; doc.x = 40;
        };

        // Kopf
        doc.font('Helvetica-Bold').fontSize(18).fillColor(BLUE).text('CeraCUT', 40, 40, { continued: true })
           .font('Helvetica').fillColor('black').text('  |  Nesting-Kalkulation');
        doc.font('Helvetica').fontSize(9).fillColor(GREY)
           .text(`Datum: ${new Date().toLocaleDateString('de-DE')}    Plan: ${plan.planId || '-'}    Nested parts: ${plan.instances.length}${meta.user ? '    Benutzer: ' + meta.user : ''}`);
        doc.moveDown(0.3);

        // Kostenübersicht
        const b = result.blocks, inc = result.include;
        h2('Kostenübersicht');
        const crow = (label, val, on) => [label + (on ? '' : ' (nicht enthalten)'), eur(val)];
        kv([
            crow('Fertigungskosten', b.manufacturing.total, inc.manufacturing),
            crow('Materialkosten', b.material.total, inc.material),
            crow('Verbrauchsmaterial', b.consumable.total, inc.consumable),
            crow('Zusatzkosten' + (inc.labor ? ' (inkl. Arbeit)' : ''), b.additional.total, inc.additional)
        ]);
        doc.font('Helvetica-Bold').fontSize(12).fillColor(BLUE).text(`Gesamtkosten: ${eur(result.total)}`, 40, doc.y + 2);
        doc.fillColor('black');

        // Technische Daten
        const d = result.data;
        h2('Technische Daten');
        kv([
            ['Maschine', meta.machine || plan.machineId || '-'], ['Material', meta.material || String(plan.materialId ?? '-')],
            ['Dicke', `${fmt(d.thickness)} mm`], ['Blechgröße', `${fmt(d.sheetW, 0)} x ${fmt(d.sheetL, 0)} mm`],
            ['Anzahl Bleche', d.sheets], ['Teile', d.nested], ['Anstiche', d.piercings],
            ['Schnittlänge', `${fmt(d.cutLengthM)} m`], ['Eilganglänge (geschätzt)', `${fmt(d.rapidLengthM)} m`],
            ['Vorschub', `${fmt(d.feed, 1)} mm/min`]
        ]);

        // Zeit und Gewicht
        h2('Zeit und Gewicht');
        kv([
            ['Schneidzeit', PlanCost.fmtTime(result.time.cutting)], ['Anstichzeit', PlanCost.fmtTime(result.time.piercing)],
            ['Eilgangzeit', PlanCost.fmtTime(result.time.rapid)], ['Gesamtzeit', PlanCost.fmtTime(result.time.total)],
            ['Blechgewicht', `${fmt(b.material.totalWeightKg)} kg`], ['Teilegewicht (netto)', `${fmt(b.material.netWeightKg)} kg`],
            ['Verschnitt', `${fmt(b.material.scrapKg)} kg (${eur(b.material.scrapCost)})`]
        ]);

        // Kostendetails
        h2('Kostenaufschlüsselung');
        kv([
            ['Schneiden', eur(b.manufacturing.cutting)], ['Eilgang', eur(b.manufacturing.rapid)], ['Anstechen', eur(b.manufacturing.piercing)],
            ['Strom', eur(b.consumable.power)], ['Wasser', eur(b.consumable.water)], ['Abrasiv', eur(b.consumable.abrasive)], ['Düse/Verschleiß', eur(b.consumable.nozzle)],
            ['Anstich-Zuschlag', eur(b.additional.piercing)], ['Rüsten', eur(b.additional.setup)], ['NC-Programmierung', eur(b.additional.nc)],
            ['Arbeit' + (inc.labor ? '' : ' (aus)'), eur(b.additional.labor)]
        ]);

        // Plan-Zeichnung
        const si = meta.sheetIndex || 0;
        const polys = NestingPlan.sheetPolylines(plan, partsMap, si);
        h2(`Schachtelplan${(plan.stats?.sheets || 1) > 1 ? ` (Blech ${si + 1})` : ''}`);
        const boxW = W, boxH = 150, sc = Math.min(boxW / plan.sheet.width, boxH / plan.sheet.length);
        const ox = 40, oy = doc.y + 4;
        doc.save().rect(ox, oy, plan.sheet.width * sc, plan.sheet.length * sc).lineWidth(0.6).strokeColor('#888').stroke();
        doc.lineWidth(0.3).strokeColor(BLUE);
        for (const c of polys) {
            c.points.forEach((p, i) => { const x = ox + p.x * sc, y = oy + (plan.sheet.length - p.y) * sc; i ? doc.lineTo(x, y) : doc.moveTo(x, y); });
            if (c.closed) doc.closePath();
            doc.stroke();
        }
        doc.restore();
        doc.y = oy + plan.sheet.length * sc + 6; doc.x = 40;

        // Teileübersicht
        if (doc.y > doc.page.height - 160) doc.addPage();
        h2('Teileübersicht');
        const cols = [['Teil', 150], ['Menge', 40], ['Stückpreis', 70], ['Gesamt', 70], ['Fläche m²', 55], ['Schnittzeit', 60], ['Maße mm', 70]];
        const header = () => {
            let x = 40; doc.rect(40, doc.y, W, 14).fill(LIGHT).fillColor('black');
            const y = doc.y + 3; cols.forEach(([t, w]) => { doc.font('Helvetica-Bold').fontSize(8).text(t, x + 2, y, { width: w - 4 }); x += w; });
            doc.y += 16;
        };
        header();
        for (const p of result.parts) {
            if (doc.y > doc.page.height - 60) { doc.addPage(); header(); }
            let x = 40; const y = doc.y;
            const cells = [p.name, p.qty, eur(p.unit), eur(p.total), fmt(p.surface * p.qty, 4), PlanCost.fmtTime(p.cutTime), `${fmt(p.size.w, 1)} x ${fmt(p.size.l, 1)}`];
            cols.forEach(([, w], i) => { doc.font('Helvetica').fontSize(8).fillColor('black').text(String(cells[i]), x + 2, y, { width: w - 4, ellipsis: true, lineBreak: false }); x += w; });
            doc.y = y + 12;
        }

        // Hinweise
        if (result.defaultsUsed.length) {
            doc.moveDown(0.8).font('Helvetica-Oblique').fontSize(8).fillColor('#9a6700')
               .text(`Hinweis: für folgende Werte wurden Richtwerte verwendet (bitte in der Technologie pflegen): ${result.defaultsUsed.join(', ')}.`, 40, doc.y, { width: W });
        }
        doc.end();
    });
}

module.exports = { costPdf };
