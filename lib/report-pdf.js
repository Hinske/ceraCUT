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

/**
 * Schachtelplan als PDF (A4 quer): eine Seite je Blech mit maßstäblicher Zeichnung, Teil-Nummern und Legende,
 * danach die Teileliste. Für Werkstatt/Kunde.
 * @param {object} plan  @param {object} partsMap `partId@rev` → Teil
 * @param {{material?:string, machine?:string, user?:string}} meta
 */
function planPdf(plan, partsMap, meta = {}) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, info: { Title: `Schachtelplan ${plan.planId || ''}`, Author: 'CeraCUT' } });
        const chunks = [];
        doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);

        const COLORS = ['#0078d4', '#22c55e', '#e8a020', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#64748b'];
        const W = doc.page.width, H = doc.page.height, M = 30;
        const partIds = Object.keys(plan.demand || {});
        const nameOf = id => (partsMap[id] || partsMap[Object.keys(partsMap).find(k => k.startsWith(id + '@'))])?.name || id;
        const sheets = Math.max(1, plan.stats?.sheets || Math.max(0, ...plan.instances.map(i => i.sheetIndex || 0)) + 1);
        const date = new Date().toLocaleDateString('de-DE');

        for (let si = 0; si < sheets; si++) {
            if (si > 0) doc.addPage();
            const inst = plan.instances.filter(i => (i.sheetIndex || 0) === si);
            // Kopf
            doc.font('Helvetica-Bold').fontSize(16).fillColor(BLUE).text('CeraCUT', M, M, { continued: true })
               .font('Helvetica').fillColor('black').text(`  |  Schachtelplan ${plan.planId || ''}`);
            doc.font('Helvetica').fontSize(9).fillColor(GREY)
               .text(`Blech ${si + 1}/${sheets}   ·   ${fmt(plan.sheet.width, 0)} × ${fmt(plan.sheet.length, 0)} mm${plan.thickness ? '   ·   ' + fmt(plan.thickness) + ' mm' : ''}${meta.material ? '   ·   ' + meta.material : ''}   ·   ${inst.length} Teile auf diesem Blech   ·   Abstand ${plan.config?.partToPart ?? '-'} / Rand ${plan.config?.partToEdge ?? '-'} mm   ·   ${date}`);
            // Zeichnung (links), Legende (rechts)
            const legendW = 190, top = M + 44;
            const boxW = W - 2 * M - legendW - 30, boxH = H - top - M - 16;
            const sc = Math.min(boxW / plan.sheet.width, boxH / plan.sheet.length);
            const ox = M + 14, oy = top;
            const X = x => ox + x * sc, Y = y => oy + (plan.sheet.length - y) * sc;
            doc.save().rect(ox, oy, plan.sheet.width * sc, plan.sheet.length * sc).lineWidth(0.8).strokeColor('#666').stroke();
            const polys = NestingPlan.sheetPolylines(plan, partsMap, si);
            doc.lineWidth(0.35);
            for (const c of polys) {
                const col = COLORS[partIds.indexOf(c.partId) % COLORS.length];
                c.points.forEach((p, i) => (i ? doc.lineTo(X(p.x), Y(p.y)) : doc.moveTo(X(p.x), Y(p.y))));
                if (c.closed) doc.closePath();
                doc.strokeColor(col).stroke();
            }
            // Teilenummer in die Mitte der Außenkontur, wenn genug Platz
            const done = new Set();
            for (const c of polys) {
                if (c.role !== 'disc' || done.has(c.instId)) continue;
                const xs = c.points.map(p => p.x), ys = c.points.map(p => p.y);
                const w = (Math.max(...xs) - Math.min(...xs)) * sc, h = (Math.max(...ys) - Math.min(...ys)) * sc;
                if (Math.min(w, h) < 9) continue;
                done.add(c.instId);
                const cx = X((Math.max(...xs) + Math.min(...xs)) / 2), cy = Y((Math.max(...ys) + Math.min(...ys)) / 2);
                const fs = Math.max(5, Math.min(11, Math.min(w, h) / 3));
                doc.font('Helvetica').fontSize(fs).fillColor(COLORS[partIds.indexOf(c.partId) % COLORS.length])
                   .text(String(partIds.indexOf(c.partId) + 1), cx - 10, cy - fs / 2, { width: 20, align: 'center', lineBreak: false });
            }
            doc.restore();
            // Maße
            doc.font('Helvetica').fontSize(8).fillColor(GREY)
               .text(`${fmt(plan.sheet.width, 0)} mm`, ox, oy + plan.sheet.length * sc + 3, { width: plan.sheet.width * sc, align: 'center', lineBreak: false });
            doc.save().rotate(-90, { origin: [ox - 4, oy + plan.sheet.length * sc / 2] })
               .font('Helvetica').fontSize(8).fillColor(GREY)
               .text(`${fmt(plan.sheet.length, 0)} mm`, ox - 4 - plan.sheet.length * sc / 2, oy + plan.sheet.length * sc / 2 - 10, { width: plan.sheet.length * sc, align: 'center', lineBreak: false }).restore();
            // Legende
            const lx = W - M - legendW;
            doc.font('Helvetica-Bold').fontSize(9).fillColor('black').text('Teile auf diesem Blech', lx, top);
            let ly = top + 16;
            const cnt = {};
            for (const i of inst) cnt[i.partId] = (cnt[i.partId] || 0) + 1;
            for (const id of partIds.filter(k => cnt[k])) {
                if (ly > H - M - 20) break;
                doc.rect(lx, ly + 1, 9, 9).lineWidth(1).strokeColor(COLORS[partIds.indexOf(id) % COLORS.length]).stroke();
                doc.font('Helvetica').fontSize(8).fillColor('black')
                   .text(`${partIds.indexOf(id) + 1}  ${nameOf(id)}  × ${cnt[id]}`, lx + 14, ly, { width: legendW - 14, ellipsis: true, lineBreak: false });
                ly += 13;
            }
        }

        // Teileliste
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE).text(`Teileliste — ${plan.planId || ''}`, M, M);
        doc.moveDown(0.6);
        const cols = [['Nr', 28], ['Teil', 200], ['Auftrag', 130], ['Soll', 45], ['Genestet', 55], ['Maße mm', 90], ['Bleche', 120]];
        const header = () => {
            let x = M; doc.rect(M, doc.y, cols.reduce((a, c) => a + c[1], 0), 14).fill(LIGHT).fillColor('black');
            const y = doc.y + 3; cols.forEach(([t, w]) => { doc.font('Helvetica-Bold').fontSize(8).text(t, x + 2, y, { width: w - 4 }); x += w; });
            doc.y += 16;
        };
        header();
        partIds.forEach((id, n) => {
            if (doc.y > H - M - 20) { doc.addPage(); header(); }
            const mine = plan.instances.filter(i => i.partId === id);
            const bySheet = {}; for (const i of mine) bySheet[(i.sheetIndex || 0) + 1] = (bySheet[(i.sheetIndex || 0) + 1] || 0) + 1;
            const p = partsMap[mine[0] ? `${id}@${mine[0].revision}` : id] || partsMap[id];
            const cells = [n + 1, nameOf(id), p?.orderId || '', plan.demand[id].qty, mine.length, p ? `${fmt(p.geometry.bbox.w, 1)} x ${fmt(p.geometry.bbox.l, 1)}` : '',
                           Object.entries(bySheet).map(([sh, c]) => `B${sh}: ${c}`).join('  ')];
            let x = M; const y = doc.y;
            cols.forEach(([, w], i) => { doc.font('Helvetica').fontSize(8).fillColor('black').text(String(cells[i]), x + 2, y, { width: w - 4, ellipsis: true, lineBreak: false }); x += w; });
            doc.y = y + 12;
        });
        const st = plan.stats || {};
        doc.moveDown(1).font('Helvetica').fontSize(9).fillColor(GREY)
           .text(`Gesamt: ${st.nested ?? plan.instances.length}${st.requested ? ' von ' + st.requested : ''} Teile auf ${sheets} Blech(en)${st.utilization != null ? ' · Auslastung ' + st.utilization + ' %' : ''}${st.unplaced ? ' · ' + st.unplaced + ' Teil(e) nicht untergebracht' : ''}`, M, doc.y);
        doc.end();
    });
}

module.exports = { costPdf, planPdf };
