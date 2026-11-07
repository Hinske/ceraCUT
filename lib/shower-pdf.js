/**
 * CeraCUT Duschboard-PDF V0.1
 * Kunden-PDF mit den gewaehlten Verlegevarianten eines Duschboards (Vektorzeichnung, pdfkit, serverseitig).
 * Geometrie kommt aus js/shower-board-generator.js (gleicher Code wie der Dialog). Der User waehlt vorher,
 * welche Varianten und welche Angaben (Bemassung, Teilenummern, Hinweise ...) der Kunde sieht.
 *
 * Created: 2026-11-07
 * Build: 20261107-showerpdf
 *
 * (c) Cerasell GmbH
 */

const PDFDocument = require('pdfkit');
const G = require('../js/shower-board-generator.js');

const DEFAULT_OPTIONS = {
    cover: true,            // Deckblatt mit Projektdaten und Variantenliste
    orientation: 'landscape', // 'landscape' | 'portrait'
    perPage: 1,             // 1 | 2 | 4 Varianten je Seite
    color: true,            // false = Schwarz-Weiss (Druck)
    totals: true,           // Gesamtmasse (Fliesenfeld / Aussenmass)
    drain: true,            // Ablaufmasse und -lage
    gridDims: true,         // Fugenraster: Breite je Spalte/Zeile
    pieceNumbers: false,    // Teilenummern (intern)
    pieceDims: false,       // Teilemasse (intern)
    angles: false,          // Gehrungswinkel (intern)
    stats: false,           // Fliesenbedarf: Anzahl ganze/geschnittene Fliesen (intern)
    warnings: false,        // Hinweise: schmale Teile, Teil passt nicht auf Fliese (intern)
    footer: true            // Fusszeile mit Datum und Seitenzahl
};

const THEME = {
    color: { stroke: '#0b5cad', fill: '#e6f0fa', drainFill: '#f8dedb', drainStroke: '#c0392b', dim: '#444444', text: '#222222', grey: '#777777', warn: '#d97706', bad: '#c0392b', head: '#0b5cad' },
    bw: { stroke: '#000000', fill: '#ffffff', drainFill: '#d9d9d9', drainStroke: '#000000', dim: '#000000', text: '#000000', grey: '#555555', warn: '#000000', bad: '#000000', head: '#000000' }
};

const de = (v, d = 1) => (+Number(v).toFixed(d)).toString().replace('.', ',');
const clean = s => String(s ?? '').replace(/[^\x20-\x7EäöüÄÖÜß°×–€²µ.,:;()\/%&+_-]/g, ' ').replace(/\s+/g, ' ').trim();

function normalizeOptions(o) {
    const r = { ...DEFAULT_OPTIONS };
    for (const k of Object.keys(DEFAULT_OPTIONS)) {
        if (o && o[k] !== undefined && typeof o[k] === typeof DEFAULT_OPTIONS[k]) r[k] = o[k];
    }
    if (![1, 2, 4].includes(r.perPage)) r.perPage = 1;
    if (!['landscape', 'portrait'].includes(r.orientation)) r.orientation = 'landscape';
    return r;
}

/** Varianten aufloesen: ids -> [{id,label,result}] ('current' = aktueller Dialogstand inkl. editiertem Fugenbild) */
function resolveVariants(input, override, ids) {
    const defs = new Map([...G.variantDefs(input, { mode: 'muster' }), ...G.variantDefs(input, { mode: 'raster' })].map(d => [d.id, d]));
    const out = [];
    for (const id of ids) {
        if (id === 'current') {
            const r = G.compute(input, override || undefined);
            if (r.ok) out.push({ id, label: 'Aktuelle Auswahl', result: r });
        } else if (defs.has(id)) {
            const d = defs.get(id), r = G.compute({ ...input, ...d.overrides });
            if (r.ok) out.push({ id, label: d.label, result: r });
        }
    }
    return out;
}

// ── Zeichnung ───────────────────────────────────────────────────────────────

function drawBoard(doc, r, box, o, th) {
    const { W, H, drain: d, fuge } = r.p;
    const ch = r.chains || {}, hf = fuge / 2;
    const rowsBelow = (o.gridDims && ch.xLines ? 1 : 0) + (o.drain ? 1 : 0) + (o.totals ? 1 : 0);
    const colsLeft = o.gridDims && ch.yLines ? 1 : 0;
    const colsRight = (o.drain ? 1 : 0) + (o.totals ? 1 : 0);
    const ml = 8 + colsLeft * 26, mr = 8 + colsRight * 26, mt = 6, mb = 6 + rowsBelow * 19;
    const s = Math.max(1e-6, Math.min((box.w - ml - mr) / W, (box.h - mt - mb) / H));
    const ox = box.x + ml + ((box.w - ml - mr) - W * s) / 2, oy = box.y + mt + ((box.h - mt - mb) - H * s) / 2;
    const X = x => ox + x * s, Y = y => oy + (H - y) * s;

    // Teile
    const items = G.numberPieces(r.pieces);
    const bad = new Set(o.warnings ? r.warnings.map(w => w.piece) : []);
    doc.lineWidth(0.6);
    for (const it of items) {
        const pts = it.pc.poly.map(q => [X(q.x), Y(q.y)]);
        doc.polygon(...pts).fillAndStroke(bad.has(it.pc) ? '#fde7c8' : th.fill, th.stroke);
    }
    // Ablauf
    doc.lineWidth(0.8).dash(3, { space: 2 });
    doc.rect(X(d.x0), Y(d.y1), (d.x1 - d.x0) * s, (d.y1 - d.y0) * s).fillAndStroke(th.drainFill, th.drainStroke);
    doc.undash();

    // Teilenummern / -masse
    if (o.pieceNumbers || o.pieceDims) {
        for (const it of items) {
            const pw = it.w * s, ph = it.h * s;
            if (pw < 20 || ph < 12) continue;
            const x = X(it.cx), y = Y(it.cy);
            const lines = [];
            if (o.pieceNumbers) lines.push(String(it.nr));
            if (o.pieceDims && it.pc.fit && ph > 20) lines.push(`${de(it.pc.fit.a)}×${de(it.pc.fit.b)}`);
            doc.font('Helvetica').fontSize(7).fillColor(th.text);
            const th0 = lines.length * 8;
            lines.forEach((t, i) => doc.text(t, x - 30, y - th0 / 2 + i * 8, { width: 60, align: 'center', lineBreak: false }));
        }
    }

    // Gehrungswinkel
    if (o.angles) {
        const ang = (dx, dy) => de(Math.atan2(dy, dx) * 180 / Math.PI) + '°';
        const put = (px, py, t) => doc.font('Helvetica').fontSize(7.5).fillColor(th.bad).text(t, X(px) - 20, Y(py) - 3, { width: 40, align: 'center', lineBreak: false });
        put(d.x1 + (W - d.x1) * 0.55, d.y1 + (H - d.y1) * 0.45, ang(W - d.x1, H - d.y1));
        put(d.x0 - d.x0 * 0.55, d.y1 + (H - d.y1) * 0.45, ang(d.x0, H - d.y1));
        put(d.x1 + (W - d.x1) * 0.55, d.y0 - d.y0 * 0.45, ang(W - d.x1, d.y0));
        put(d.x0 - d.x0 * 0.55, d.y0 - d.y0 * 0.45, ang(d.x0, d.y0));
    }

    // Bemassung
    const dimH = (xa, xb, y, label) => {
        const a = X(xa), b = X(xb);
        doc.lineWidth(0.4).strokeColor(th.dim).moveTo(a, y).lineTo(b, y).stroke();
        doc.moveTo(a, y - 2.5).lineTo(a, y + 2.5).stroke().moveTo(b, y - 2.5).lineTo(b, y + 2.5).stroke();
        if (b - a > 18) doc.font('Helvetica').fontSize(8).fillColor(th.dim).text(label, a, y - 10, { width: b - a, align: 'center', lineBreak: false });
    };
    const dimV = (ya, yb, x, label, side) => {
        const a = Y(ya), b = Y(yb);
        doc.lineWidth(0.4).strokeColor(th.dim).moveTo(x, a).lineTo(x, b).stroke();
        doc.moveTo(x - 2.5, a).lineTo(x + 2.5, a).stroke().moveTo(x - 2.5, b).lineTo(x + 2.5, b).stroke();
        if (Math.abs(a - b) > 18) {
            doc.save().translate(x + side * 3, (a + b) / 2).rotate(-90);
            doc.font('Helvetica').fontSize(8).fillColor(th.dim).text(label, -Math.abs(a - b) / 2, side > 0 ? 0 : -10, { width: Math.abs(a - b), align: 'center', lineBreak: false });
            doc.restore();
        }
    };
    let rowY = Y(0) + 9;
    if (o.gridDims && ch.xLines) {
        const xb = [0, ...ch.xLines, W];
        for (let i = 0; i < xb.length - 1; i++) {
            const a = xb[i] + (i > 0 ? hf : 0), b = xb[i + 1] - (i < xb.length - 2 ? hf : 0);
            dimH(a, b, rowY, de(b - a));
        }
        rowY += 19;
    }
    if (o.drain) {
        dimH(0, d.x0, rowY, de(d.x0)); dimH(d.x0, d.x1, rowY, de(d.x1 - d.x0)); dimH(d.x1, W, rowY, de(W - d.x1));
        rowY += 19;
    }
    if (o.totals) {
        dimH(0, W, rowY, `${de(W, 0)}` + (r.p.masseArt === 'aussen' ? ` (Außenmaß ${de(r.p.breite, 0)})` : ''));
    }
    let colX = X(0) - 9;
    if (o.gridDims && ch.yLines) {
        const yb = [0, ...ch.yLines, H];
        for (let j = 0; j < yb.length - 1; j++) {
            const a = yb[j] + (j > 0 ? hf : 0), b = yb[j + 1] - (j < yb.length - 2 ? hf : 0);
            dimV(a, b, colX, de(b - a), -1);
        }
    }
    colX = X(W) + 9;
    if (o.drain) { dimV(0, d.y0, colX, de(d.y0), 1); dimV(d.y0, d.y1, colX, de(d.y1 - d.y0), 1); dimV(d.y1, H, colX, de(H - d.y1), 1); colX += 26; }
    if (o.totals) dimV(0, H, colX, de(H, 0) + (r.p.masseArt === 'aussen' ? ` (Außenmaß ${de(r.p.tiefe, 0)})` : ''), 1);
    doc.strokeColor('#000').fillColor('#000');
}

function variantNote(r, o) {
    const lines = [];
    if (o.stats) lines.push(`${r.tilesUsed} Fliesen (${r.full} ganz, ${r.cutTiles} geschnitten) · ${r.count} Teile`);
    if (o.warnings) {
        const fit = r.warnings.filter(w => w.type === 'fit').length, nar = r.warnings.filter(w => w.type === 'narrow').length;
        if (fit) lines.push(`Hinweis: ${fit} Teil(e) passen nicht auf die Fliese`);
        if (nar) lines.push(`Hinweis: ${nar} schmale(s) Teil(e)`);
    }
    return lines;
}

// ── Dokument ────────────────────────────────────────────────────────────────

/**
 * @param {{input:object, override?:object, variantIds:string[], options?:object, meta?:object}} req
 * @returns {Promise<Buffer>}
 */
function showerPdf(req) {
    const { input, override } = req;
    const o = normalizeOptions(req.options);
    const th = o.color ? THEME.color : THEME.bw;
    const meta = {
        projekt: clean(req.meta?.projekt), kunde: clean(req.meta?.kunde), notiz: clean(req.meta?.notiz).slice(0, 600),
        ersteller: clean(req.meta?.ersteller), datum: new Date().toLocaleDateString('de-DE')
    };
    const variants = resolveVariants(input, override, Array.isArray(req.variantIds) ? req.variantIds.slice(0, 40) : []);
    if (!variants.length) return Promise.reject(new Error('Keine gültige Variante gewählt'));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'A4', layout: o.orientation, margin: 36, bufferPages: true,
            info: { Title: `Duschboard ${meta.projekt || ''} – Verlegevarianten`.trim(), Author: 'CeraCUT' }
        });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const PW = doc.page.width, PH = doc.page.height, M = 36;
        const first = variants[0].result.p;
        const title = meta.projekt ? `Duschboard ${meta.projekt}` : 'Duschboard';
        const head = (sub) => {
            doc.font('Helvetica-Bold').fontSize(14).fillColor(th.head).text(sub || title, M, M - 6, { width: PW - 2 * M - 160, lineBreak: false });
            doc.font('Helvetica').fontSize(8.5).fillColor(th.grey).text([meta.kunde, meta.projekt].filter(Boolean).join(' · '), PW - M - 200, M - 4, { width: 200, align: 'right', lineBreak: false });
            doc.lineWidth(0.6).strokeColor(th.head).moveTo(M, M + 14).lineTo(PW - M, M + 14).stroke();
        };

        // Deckblatt
        if (o.cover) {
            doc.font('Helvetica-Bold').fontSize(22).fillColor(th.head).text('Duschboard', M, M + 20);
            doc.font('Helvetica').fontSize(13).fillColor(th.text).text('Verlegevarianten', M, doc.y + 2);
            doc.moveTo(M, doc.y + 8).lineTo(PW - M, doc.y + 8).strokeColor(th.head).lineWidth(0.8).stroke();
            doc.moveDown(1.6);
            const rows = [];
            if (meta.kunde) rows.push(['Kunde', meta.kunde]);
            if (meta.projekt) rows.push(['Projekt', meta.projekt]);
            rows.push(['Boardmaß', `${de(first.breite, 0)} × ${de(first.tiefe, 0)} mm ${first.masseArt === 'aussen' ? '(Außenmaß)' : '(Fliesenfeld)'}`]);
            rows.push(['Fliese', `${de(first.fliese.lang, 0)} × ${de(first.fliese.kurz, 0)} mm, Fuge ${de(first.fuge, 1)} mm`]);
            rows.push(['Ablauf', `${de(input.ablauf.w, 0)} × ${de(input.ablauf.h, 0)} mm${input.ablauf.cx !== undefined || input.ablauf.cy !== undefined ? '' : ', mittig'}`]);
            rows.push(['Varianten', String(variants.length)]);
            rows.push(['Datum', meta.datum]);
            if (meta.ersteller) rows.push(['Erstellt von', meta.ersteller]);
            for (const [k, v] of rows) {
                const y = doc.y;
                doc.font('Helvetica').fontSize(10).fillColor(th.grey).text(k, M, y, { width: 110, lineBreak: false });
                doc.font('Helvetica-Bold').fillColor(th.text).text(v, M + 115, y, { width: PW - 2 * M - 115 });
                doc.moveDown(0.35);
            }
            if (meta.notiz) { doc.moveDown(0.6).font('Helvetica').fontSize(10).fillColor(th.text).text(meta.notiz, M, doc.y, { width: PW - 2 * M }); }
            doc.moveDown(1.2).font('Helvetica-Bold').fontSize(11).fillColor(th.head).text('Enthaltene Varianten');
            doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor(th.text);
            variants.forEach((v, i) => doc.text(`${i + 1}.  ${clean(v.label)}`, M + 4, doc.y, { width: PW - 2 * M }));
            doc.addPage();
        }

        // Variantenseiten
        const cols = o.perPage === 1 ? 1 : 2, rowsN = o.perPage === 4 ? 2 : 1;
        const per = cols * rowsN;
        variants.forEach((v, idx) => {
            const slot = idx % per;
            if (slot === 0) { if (idx > 0) doc.addPage(); head(per === 1 ? clean(v.label) : title); }
            const top = M + 22, availW = PW - 2 * M, availH = PH - top - M - (o.footer ? 14 : 0);
            const cw = availW / cols, chh = availH / rowsN;
            const cx = M + (slot % cols) * cw, cy = top + Math.floor(slot / cols) * chh;
            const label = per === 1 ? null : clean(v.label);
            const notes = variantNote(v.result, o);
            let yBox = cy;
            if (label) { doc.font('Helvetica-Bold').fontSize(9.5).fillColor(th.text).text(`${idx + 1}. ${label}`, cx + 4, cy + 2, { width: cw - 8, lineBreak: false }); yBox += 15; }
            const noteH = notes.length * 11 + (notes.length ? 4 : 0);
            drawBoard(doc, v.result, { x: cx + 4, y: yBox, w: cw - 8, h: chh - (yBox - cy) - noteH - 4 }, o, th);
            notes.forEach((t, i) => doc.font('Helvetica').fontSize(8.5).fillColor(t.startsWith('Hinweis') ? th.warn : th.grey).text(t, cx + 4, cy + chh - noteH + i * 11, { width: cw - 8, align: 'center', lineBreak: false }));
        });

        // Fusszeile
        if (o.footer) {
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                const m = doc.page.margins.bottom; doc.page.margins.bottom = 0;
                doc.font('Helvetica').fontSize(7.5).fillColor(th.grey)
                    .text(`${meta.datum}${meta.ersteller ? ' · ' + meta.ersteller : ''}`, M, PH - M + 8, { width: PW / 2 - M, lineBreak: false })
                    .text(`Seite ${i + 1} / ${range.count}`, PW / 2, PH - M + 8, { width: PW / 2 - M, align: 'right', lineBreak: false });
                doc.page.margins.bottom = m;
            }
        }
        doc.end();
    });
}

module.exports = { showerPdf, normalizeOptions, resolveVariants, DEFAULT_OPTIONS };
