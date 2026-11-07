/**
 * CeraCUT NC Tools V1.0
 * "NC erstellen": Code erzeugen → NC-Editor (Prüfung einzelner Befehle) → Speichern → Werkstattbericht.
 *
 *   - NCCheck   : reine Logik (DOM-frei, in Node testbar): Sinumerik-840D-Code parsen, Zustand je Zeile
 *                 (Position, Modus, absolut/inkremental), Schnitt-/Eilganglängen, Grenzen, Strukturprüfung
 *   - NCReport  : Werkstattbericht (HTML, druckbar / als PDF speichern über den Browser-Druckdialog)
 *   - NCEditor  : Modal mit Zeilennummern, Befehlserklärung, Prüfliste, Speichern
 *   - NCDialog  : Modal "NC erstellen" (Ribbon Export)
 *
 * Konzept: docs/finest-integration-konzept.md §1.3. Das Format folgt der Waricam-Referenz
 * (/mnt/cnc/HEIDE6000101587.CNC): MPF + SPFs, N-Nummern, G41/G42, F=…, I/J inkremental.
 *
 * Created: 2026-11-07
 * Last Modified: 2026-11-07
 * Build: 20261107-techdb
 * V1.1: Fix — NCEditor: Prüf-Timer nach Schließen (TypeError), Guards bei geschlossenem Editor
 *
 * (c) Cerasell GmbH
 */

const NCCheck = (() => {
    'use strict';

    const GCODES = {
        0: 'Eilgang (Positionieren, nicht schneiden)',
        1: 'Linearinterpolation (Schneiden)',
        2: 'Kreisbogen im Uhrzeigersinn',
        3: 'Kreisbogen gegen den Uhrzeigersinn',
        4: 'Verweilzeit',
        17: 'Ebene XY',
        40: 'Schnittfugenkorrektur aus',
        41: 'Schnittfugenkorrektur links',
        42: 'Schnittfugenkorrektur rechts',
        90: 'Absolutmaß',
        91: 'Kettenmaß (inkremental)'
    };
    const KEYWORDS = [
        [/^M30\b/, 'Programmende (Hauptprogramm)'], [/^M2\b/, 'Programmende (Hauptprogramm)'],
        [/^M17\b/, 'Unterprogrammende'], [/^RET\b/, 'Unterprogrammende'],
        [/^STOPRE\b/, 'Vorlaufstopp'], [/^MSG\(/, 'Meldung an den Bediener'],
        [/^L\d+\b/, 'Unterprogrammaufruf (Zyklus, z. B. L201 Anstechen, L205 Abschalten)'],
        [/^TRANS\b/, 'Nullpunktverschiebung'], [/^AROT\b/, 'Drehung'], [/^AMIRROR\b/, 'Spiegeln'],
        [/^R\d+\s*=/, 'Rechenparameter setzen'], [/^DEF\b/, 'Variable definieren'],
        [/^PART\d+\b/, 'Teileprogramm aufrufen'], [/^PARAMETER\b/, 'Parameterprogramm aufrufen'],
        [/^IF\b/, 'Bedingung / Sprung'], [/^ENDIF\b/, 'Ende Bedingung'], [/^GOTO[FB]\b/, 'Sprung'],
        [/^[A-Z_0-9]+:\s*$/, 'Sprungmarke']
    ];

    const NON_FINITE = /\b(NaN|undefined|Infinity|null)\b/;

    /** Kommentar (;) abtrennen, Anführungszeichen beachten (MSG("...;...")). */
    function stripComment(line) {
        let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') q = !q;
            else if (ch === ';' && !q) return line.slice(0, i);
        }
        return line;
    }

    const num = s => parseFloat(s);

    function parse(code, opts = {}) {
        const lines = String(code).split(/\r?\n/);
        const issues = [];
        const add = (line, severity, codeId, message) => issues.push({ line, severity, code: codeId, message });
        const counts = { G00: 0, G01: 0, G02: 0, G03: 0 };
        const programs = [];
        const header = {};
        const states = new Array(lines.length);   // [x, y, mode, abs, comp] nach Ausführung der Zeile

        let cur = null;                           // aktuelles Programm
        let x = null, y = null, mode = null, abs = true, comp = 0;
        let cutLength = 0, rapidLength = 0;
        const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        let labels = new Set(), jumps = [];
        let ifDepth = 0;

        const endProgram = (lineNo) => {
            if (!cur) return;
            cur.endLine = lineNo;
            if (ifDepth !== 0) add(cur.startLine, 'error', 'IF_UNBALANCED', `${cur.name}: IF/ENDIF nicht ausgeglichen`);
            if (comp !== 0 && cur.type === 'MPF') add(lineNo, 'warning', 'COMP_ACTIVE', 'Schnittfugenkorrektur (G41/G42) am Programmende noch aktiv');
            if (!cur.closed) add(cur.startLine, 'error', 'NO_END', `${cur.name}: ${cur.type === 'MPF' ? 'M30' : 'M17'} fehlt`);
            programs.push(cur);
            ifDepth = 0;
        };

        for (let i = 0; i < lines.length; i++) {
            const lineNo = i + 1;
            const raw = lines[i];
            const trimmed = raw.trim();

            // Kopfkommentare auswerten
            const hm = /^;\s*([A-ZÄÖÜ ]+?)\s*(?:MM|QM)?\s*:\s*(.+)$/.exec(trimmed);
            if (hm) header[hm[1].trim()] = hm[2].trim();

            const body = stripComment(raw).trim();
            if (!body) { states[i] = [x, y, mode, abs, comp]; continue; }

            if (NON_FINITE.test(body)) add(lineNo, 'error', 'NON_FINITE', 'Ungültiger Wert im Code (NaN/undefined/Infinity)');

            // Programmkopf
            const pm = /^%_N_(.+)_(MPF|SPF)$/.exec(body);
            if (pm) {
                endProgram(lineNo - 1);
                cur = { name: pm[1], type: pm[2], startLine: lineNo, endLine: lineNo, closed: false };
                labels = new Set(); cur.labels = labels;
                states[i] = [x, y, mode, abs, comp];
                continue;
            }
            if (!cur) { add(lineNo, 'warning', 'NO_PROGRAM', 'Code vor dem ersten Programmkopf (%_N_…)'); states[i] = [x, y, mode, abs, comp]; continue; }

            const stmt = body.replace(/^N\d+\s*/, '');

            // Struktur
            if (/^(M30|M2)\b/.test(stmt)) { if (cur.type === 'MPF') cur.closed = true; else add(lineNo, 'warning', 'M30_IN_SPF', 'M30 in einem Unterprogramm'); }
            if (/^(M17|RET)\b/.test(stmt)) { if (cur.type === 'SPF') cur.closed = true; else add(lineNo, 'warning', 'M17_IN_MPF', 'M17 im Hauptprogramm'); }
            const lm = /^([A-Z_][A-Z_0-9]*):\s*$/.exec(stmt);
            if (lm) labels.add(lm[1]);
            if (/^IF\b/.test(stmt)) { if (!/\bGOTO[FB]?\b/.test(stmt)) ifDepth++; }
            if (/^ENDIF\b/.test(stmt)) { ifDepth--; if (ifDepth < 0) { add(lineNo, 'error', 'ENDIF_EXTRA', 'ENDIF ohne IF'); ifDepth = 0; } }
            const jm = /\bGOTO[FB]\s+([A-Z_][A-Z_0-9]*)\b/.exec(stmt);
            if (jm) jumps.push({ line: lineNo, label: jm[1], prog: cur });

            // Bewegungszeile: beginnt mit G-Code oder Achse
            if (/^(G\d+|[XYIJ]\s*=?\s*[-\d.])/.test(stmt)) {
                for (const g of stmt.matchAll(/\bG(\d+)\b/g)) {
                    const n = parseInt(g[1], 10);
                    if (n <= 3) mode = n;
                    else if (n === 90) abs = true;
                    else if (n === 91) abs = false;
                    else if (n === 40) comp = 0;
                    else if (n === 41 || n === 42) comp = n;
                    else if (!(n in GCODES)) add(lineNo, 'warning', 'UNKNOWN_G', `Unbekannter G-Befehl G${n}`);
                }
                const ax = {};
                for (const m of stmt.matchAll(/\b([XYIJ])\s*=?\s*(-?\d*\.?\d+)\b/g)) ax[m[1]] = num(m[2]);
                const hasMove = 'X' in ax || 'Y' in ax;
                if (hasMove) {
                    const x0 = x, y0 = y;
                    const nx = 'X' in ax ? (abs ? ax.X : (x ?? 0) + ax.X) : x;
                    const ny = 'Y' in ax ? (abs ? ax.Y : (y ?? 0) + ax.Y) : y;
                    if (mode === null) add(lineNo, 'warning', 'NO_MODE', 'Bewegung ohne G00/G01/G02/G03');
                    if (mode !== null) counts['G0' + mode]++;
                    if (x0 !== null && y0 !== null && nx !== null && ny !== null) {
                        let len = 0;
                        if (mode === 2 || mode === 3) {
                            if (!('I' in ax) && !('J' in ax)) {
                                add(lineNo, 'error', 'ARC_NO_IJ', 'Kreisbogen ohne I/J');
                            } else {
                                const cx = x0 + (ax.I || 0), cy = y0 + (ax.J || 0);
                                const r1 = Math.hypot(x0 - cx, y0 - cy), r2 = Math.hypot(nx - cx, ny - cy);
                                if (Math.abs(r1 - r2) > 0.02 + 1e-3 * r1) {
                                    add(lineNo, 'error', 'ARC_RADIUS', `Kreisbogen inkonsistent: Radius Start ${r1.toFixed(3)} ≠ Ende ${r2.toFixed(3)}`);
                                }
                                const a0 = Math.atan2(y0 - cy, x0 - cx), a1 = Math.atan2(ny - cy, nx - cx);
                                let sweep = mode === 2 ? a0 - a1 : a1 - a0;
                                sweep = ((sweep % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                                if (sweep < 1e-9 && Math.hypot(nx - x0, ny - y0) < 1e-6) sweep = 2 * Math.PI;   // Vollkreis
                                len = r1 * sweep;
                            }
                        } else {
                            len = Math.hypot(nx - x0, ny - y0);
                        }
                        if (mode === 0) rapidLength += len; else if (mode !== null) cutLength += len;
                    }
                    x = nx; y = ny;
                    if (abs) {
                        bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
                        bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
                    }
                }
            }
            states[i] = [x, y, mode, abs, comp];
        }
        endProgram(lines.length);

        // Sprungziele (Marken je Programm beim Parsen gesammelt)
        for (const j of jumps) {
            if (!j.prog.labels.has(j.label)) add(j.line, 'error', 'LABEL_MISSING', `Sprungmarke ${j.label} nicht gefunden`);
        }

        const L = num(header['LAENGE']), B = num(header['BREITE']);
        const sheet = Number.isFinite(L) && Number.isFinite(B) ? { L, B } : null;
        const hasMoves = Number.isFinite(bounds.minX);
        if (sheet && hasMoves) {
            // Ausdehnung statt Lage prüfen: manche Programme haben den Nullpunkt oben (negative Y)
            const tol = opts.boundsTolerance ?? 10;
            const w = bounds.maxX - bounds.minX, h = bounds.maxY - bounds.minY;
            if (w > sheet.L + tol || h > sheet.B + tol) {
                add(1, 'warning', 'OUT_OF_SHEET',
                    `Bewegungen größer als die Platte ${sheet.L}×${sheet.B} mm (belegt ${w.toFixed(1)}×${h.toFixed(1)} mm)`);
            }
        }
        if (!lines.some(l => /^\s*%_N_/.test(l))) add(1, 'error', 'NO_PROGRAM', 'Kein Programm (%_N_…_MPF) gefunden');

        issues.sort((a, b) => a.line - b.line);
        return {
            lines: lines.length, programs, counts, header, sheet,
            cutLength, rapidLength, bounds: hasMoves ? bounds : null,
            issues, errors: issues.filter(i => i.severity === 'error').length,
            warnings: issues.filter(i => i.severity === 'warning').length,
            states
        };
    }

    /** Erklärung einer Zeile (für den Editor). */
    function explain(rawLine) {
        const body = stripComment(rawLine).trim().replace(/^N\d+\s*/, '');
        if (!body) return [];
        const out = [];
        for (const g of body.matchAll(/\bG(\d+)\b/g)) {
            const n = parseInt(g[1], 10);
            out.push(`G${g[1].padStart(2, '0')}: ${GCODES[n] || 'unbekannt'}`);
        }
        for (const m of body.matchAll(/\bM(\d+)\b/g)) {
            const k = KEYWORDS.find(([re]) => re.test('M' + m[1]));
            out.push(`M${m[1]}: ${k ? k[1] : 'Zusatzfunktion'}`);
        }
        if (/\b[XY]\s*=?\s*-?\d/.test(body)) out.push('X/Y: Zielposition (mm)');
        if (/\bI\s*=?\s*-?\d|\bJ\s*=?\s*-?\d/.test(body)) out.push('I/J: Kreismittelpunkt relativ zum Startpunkt (mm)');
        if (/\bF\s*=/.test(body)) out.push('F=…: Vorschub (mm/min), aus Parameter/Variable');
        for (const [re, text] of KEYWORDS) if (re.test(body) && !/^M\d/.test(re.source.replace('^', ''))) { out.push(text); break; }
        return out;
    }

    return { parse, explain, stripComment, GCODES };
})();

// ═══════════════════════════════════════════════════════════════════
// Werkstattbericht
// ═══════════════════════════════════════════════════════════════════

const NCReport = (() => {
    'use strict';
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtTime = sec => {
        if (!Number.isFinite(sec)) return '–';
        const s = Math.round(sec);
        return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    };
    const m = mm => Number.isFinite(mm) ? (mm / 1000).toFixed(2) : '–';

    /**
     * @param {object} d {planName, ncFile, date, user, machine, material, thickness, comment,
     *                    nc: NCCheck.parse-Ergebnis, sim: ToolpathSimulator-stats|null, contours:[{name, mode, length, time}]}
     */
    function html(d) {
        const nc = d.nc, sim = d.sim;
        const sheet = nc.sheet ? `${nc.sheet.L} × ${nc.sheet.B} mm` : '–';
        const b = nc.bounds;
        const rows = (d.contours || []).map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.mode)}</td>
            <td class="r">${Number.isFinite(c.length) ? c.length.toFixed(1) : '–'}</td><td class="r">${fmtTime(c.time)}</td></tr>`).join('');
        const issues = nc.issues.length
            ? `<ul>${nc.issues.slice(0, 40).map(i => `<li class="${i.severity}">Zeile ${i.line}: ${esc(i.message)}</li>`).join('')}</ul>`
            : '<p>Keine Auffälligkeiten.</p>';
        return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Werkstattbericht ${esc(d.planName)}</title>
<style>
 body{font:12px/1.4 Arial,Helvetica,sans-serif;color:#111;margin:18mm 14mm}
 h1{font-size:18px;margin:0 0 2px} h2{font-size:13px;margin:16px 0 4px;border-bottom:1px solid #999;padding-bottom:2px}
 .sub{color:#555;margin-bottom:10px} table{border-collapse:collapse;width:100%} td,th{padding:3px 6px;border-bottom:1px solid #ddd;text-align:left}
 th{background:#eef2f7} .r{text-align:right} .kv td:first-child{width:38%;color:#555} .error{color:#b00020} .warning{color:#9a6700}
 @media print{body{margin:0}}
</style></head><body>
<h1>Werkstattbericht</h1>
<div class="sub">${esc(d.planName)} · ${esc(d.date)}${d.user ? ' · ' + esc(d.user) : ''}</div>
<h2>Plan</h2>
<table class="kv">
<tr><td>NC-Datei</td><td>${esc(d.ncFile)}</td></tr><tr><td>Maschine</td><td>${esc(d.machine || '–')}</td></tr>
<tr><td>Material</td><td>${esc(d.material || '–')}</td></tr><tr><td>Dicke</td><td>${d.thickness ? esc(d.thickness) + ' mm' : '–'}</td></tr>
<tr><td>Platte (Länge × Breite)</td><td>${esc(sheet)}</td></tr>
<tr><td>Belegt (X max / Y max)</td><td>${b ? `${b.maxX.toFixed(2)} / ${b.maxY.toFixed(2)} mm` : '–'}</td></tr>
${d.comment ? `<tr><td>Kommentar</td><td>${esc(d.comment)}</td></tr>` : ''}
</table>
<h2>Schneiddaten</h2>
<table class="kv">
<tr><td>Konturen</td><td>${sim ? sim.contourCount ?? (d.contours || []).length : (d.contours || []).length}</td></tr>
<tr><td>Anstiche (Piercings)</td><td>${sim ? sim.pierceCount : '–'}</td></tr>
<tr><td>Schnittlänge (aus NC)</td><td>${m(nc.cutLength)} m</td></tr><tr><td>Eilgang (aus NC)</td><td>${m(nc.rapidLength)} m</td></tr>
<tr><td>Geschätzte Gesamtzeit</td><td>${sim ? fmtTime(sim.estimatedTime) : '–'}</td></tr>
<tr><td>NC-Sätze G00/G01/G02/G03</td><td>${nc.counts.G00} / ${nc.counts.G01} / ${nc.counts.G02} / ${nc.counts.G03}</td></tr>
</table>
${rows ? `<h2>Konturen in Schneidreihenfolge</h2><table><tr><th>#</th><th>Name</th><th>Art</th><th class="r">Länge (mm)</th><th class="r">Zeit</th></tr>${rows}</table>` : ''}
<h2>NC-Prüfung</h2>${issues}
</body></html>`;
    }

    return { html, fmtTime };
})();

// ═══════════════════════════════════════════════════════════════════
// NC-Editor (Modal)
// ═══════════════════════════════════════════════════════════════════

class NCEditor {
    /**
     * @param {object} app  CeraCutApp (showToast, _saveCNCToServer)
     * @param {{filename:string, code:string, reportData?:object, onSaved?:Function}} opts
     */
    constructor(app, opts) {
        this.app = app; this.opts = opts;
        this.filename = opts.filename; this.original = opts.code;
        this.overlay = null; this.result = null; this.saved = false;
    }

    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }
    get code() { return this.overlay.querySelector('#nce-text').value; }

    open() {
        const ov = document.createElement('div');
        ov.className = 'modal-overlay nc-editor-overlay';
        ov.style.zIndex = 9500;
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="width:min(1250px,96vw);max-width:96vw;height:90vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>NC-Editor — <span id="nce-name">${this._esc(this.filename)}</span><span id="nce-dirty"></span></span><button class="cldcl-close" data-act="close">×</button></div>
            <div style="display:flex;flex:1;min-height:0">
                <div style="flex:1;display:flex;min-width:0;position:relative">
                    <pre id="nce-gutter" style="margin:0;padding:8px 6px;background:#f0f0f0;color:#888;text-align:right;overflow:hidden;font:12px/1.5 Consolas,'Courier New',monospace;user-select:none"></pre>
                    <textarea id="nce-text" spellcheck="false" wrap="off" style="flex:1;border:0;outline:0;resize:none;padding:8px;font:12px/1.5 Consolas,'Courier New',monospace;white-space:pre;overflow:auto"></textarea>
                </div>
                <div style="width:320px;border-left:1px solid #ccc;display:flex;flex-direction:column;font-size:11px">
                    <div style="padding:6px 8px;background:#eef2f7;font-weight:600">Zeile <span id="nce-lineno">1</span></div>
                    <div id="nce-explain" style="padding:6px 8px;min-height:72px;border-bottom:1px solid #ddd"></div>
                    <div style="padding:6px 8px;background:#eef2f7;font-weight:600">Prüfung <span id="nce-summary" style="font-weight:400"></span></div>
                    <div id="nce-issues" style="flex:1;overflow:auto"></div>
                    <div id="nce-stats" style="padding:6px 8px;border-top:1px solid #ddd;color:#444"></div>
                </div>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="check">Prüfen</button>
                <button data-act="revert" title="Auf den erzeugten Code zurücksetzen">Zurücksetzen</button>
                ${this.opts.reportData ? '<button data-act="report">Werkstattbericht</button>' : ''}
                <button data-act="save" style="font-weight:600">Speichern</button>
                <button data-act="close">Schließen</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        const ta = ov.querySelector('#nce-text');
        ta.value = this.original;
        this._gutter();
        ta.addEventListener('input', () => { this._gutter(); this._dirty(); clearTimeout(this._t); this._t = setTimeout(() => this._check(), 400); });
        ta.addEventListener('scroll', () => { ov.querySelector('#nce-gutter').scrollTop = ta.scrollTop; });
        for (const ev of ['click', 'keyup']) ta.addEventListener(ev, () => this._cursor());
        ta.addEventListener('keydown', e => {
            e.stopPropagation();   // App-Shortcuts nicht auslösen
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this._save(); }
        });
        ov.addEventListener('keyup', e => e.stopPropagation());
        ov.addEventListener('click', e => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') return this.close();
            if (act === 'check') return this._check();
            if (act === 'revert') { ta.value = this.original; this._gutter(); this._dirty(); return this._check(); }
            if (act === 'save') return this._save();
            if (act === 'report') return this.opts.onReport?.(this);
            const li = e.target.closest('[data-line]');
            if (li) this._goto(Number(li.dataset.line));
        });
        this._check();
        this._cursor();
    }

    close() {
        if (this._isDirty() && !this.saved && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
        clearTimeout(this._t);
        this.overlay?.remove(); this.overlay = null;
    }

    _isDirty() { return this.overlay && this.code !== this.original; }
    _dirty() { if (!this.overlay) return; this.overlay.querySelector('#nce-dirty').textContent = this._isDirty() ? ' *' : ''; }

    _gutter() {
        const n = this.code.split('\n').length;
        let s = ''; for (let i = 1; i <= n; i++) s += i + '\n';
        this.overlay.querySelector('#nce-gutter').textContent = s;
    }

    _goto(line) {
        const ta = this.overlay.querySelector('#nce-text');
        const lines = ta.value.split('\n');
        let pos = 0; for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
        ta.focus(); ta.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
        ta.scrollTop = Math.max(0, (line - 6) * 18);
        this._cursor();
    }

    _cursor() {
        if (!this.overlay) return;
        const ta = this.overlay.querySelector('#nce-text');
        const line = ta.value.slice(0, ta.selectionStart).split('\n').length;
        this.overlay.querySelector('#nce-lineno').textContent = line;
        const text = ta.value.split('\n')[line - 1] || '';
        const ex = NCCheck.explain(text);
        const st = this.result?.states?.[line - 1];
        const pos = st && st[0] !== null ? `Position nach Zeile: X ${st[0].toFixed(3)}  Y ${st[1].toFixed(3)} · ${st[3] ? 'absolut' : 'inkremental'}${st[2] !== null ? ' · G0' + st[2] : ''}${st[4] ? ' · G' + st[4] : ''}` : '';
        this.overlay.querySelector('#nce-explain').innerHTML =
            (ex.length ? ex.map(e => `<div>• ${this._esc(e)}</div>`).join('') : '<div style="color:#888">Keine Erklärung (Kommentar / leere Zeile / Ausdruck)</div>')
            + (pos ? `<div style="margin-top:4px;color:#0b5">${this._esc(pos)}</div>` : '');
    }

    _check() {
        if (!this.overlay) return;
        this.result = NCCheck.parse(this.code);
        const r = this.result;
        this.overlay.querySelector('#nce-summary').textContent = `${r.errors} Fehler · ${r.warnings} Warnungen`;
        this.overlay.querySelector('#nce-issues').innerHTML = r.issues.length ? r.issues.map(i =>
            `<div data-line="${i.line}" style="padding:4px 8px;border-bottom:1px solid #eee;cursor:pointer;color:${i.severity === 'error' ? '#b00020' : '#9a6700'}">
                ${i.severity === 'error' ? '⛔' : '⚠️'} Zeile ${i.line}: ${this._esc(i.message)}</div>`).join('')
            : '<div style="padding:8px;color:#0b5">✓ Keine Auffälligkeiten</div>';
        const b = r.bounds;
        this.overlay.querySelector('#nce-stats').innerHTML =
            `${r.lines} Zeilen · ${r.programs.length} Programm(e)<br>Schnitt ${(r.cutLength / 1000).toFixed(2)} m · Eilgang ${(r.rapidLength / 1000).toFixed(2)} m`
            + (b ? `<br>X ${b.minX.toFixed(1)}…${b.maxX.toFixed(1)} · Y ${b.minY.toFixed(1)}…${b.maxY.toFixed(1)}` : '');
        this._cursor();
    }

    async _save() {
        this._check();
        if (this.result.errors > 0 && !confirm(`${this.result.errors} Fehler im NC-Code gefunden.\nTrotzdem speichern?`)) return;
        const code = this.code;
        let state = 'unavailable';
        try { state = await this.app?._saveCNCToServer?.(this.filename, code); } catch { /* weiter mit Download */ }
        if (state === 'cancelled') return this._toast('Speichern abgebrochen', 'warning');
        if (state === 'saved') { this._toast(`✅ ${this.filename} → Server/CNC`, 'success'); }
        else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
            a.download = this.filename; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            this._toast(`${this.filename} heruntergeladen (Server-CNC-Ordner nicht erreichbar)`, 'warning');
        }
        this.original = code; this.saved = true;
        if (this.overlay) this._dirty();
        this.opts.onSaved?.(this, code);
    }
}

// ═══════════════════════════════════════════════════════════════════
// "NC erstellen" — Dialog + Ablauf
// ═══════════════════════════════════════════════════════════════════

class NCDialog {
    constructor(app) { this.app = app; this.overlay = null; }
    _toast(m, t = 'info') { this.app?.showToast?.(m, t); }
    _esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    open() {
        const app = this.app;
        if (this.overlay) return;
        if (!app?.contours?.length) return this._toast('Keine Konturen zum Exportieren', 'error');
        if (!app.cutOrder?.length) return this._toast('Keine Schneidreihenfolge festgelegt', 'error');
        const planName = (document.getElementById('planname-input')?.value || app.dxfFileName?.replace(/\.dxf$/i, '') || 'UNNAMED')
            .toUpperCase().replace(/[^A-Z0-9_]/g, '_');

        const ov = document.createElement('div');
        ov.className = 'modal-overlay nc-create-overlay';
        ov.innerHTML = `
        <div class="cldcl-dialog-box" style="min-width:420px">
            <div class="cldcl-header"><span>NC erstellen</span><button class="cldcl-close" data-act="close">×</button></div>
            <div class="cldcl-body">
                <div class="cldcl-row"><label>NC-Name</label><input id="ncd-name" type="text" value="${this._esc(planName)}" style="flex:1;text-transform:uppercase"></div>
                <div class="cldcl-row"><label>Ausgabe</label><span style="font-size:11px;color:#555">Server-Ordner CNC (sonst Download) · Format Sinumerik 840D (*.CNC)</span></div>
                <div class="cldcl-row"><label></label><label style="min-width:0;text-align:left"><input id="ncd-edit" type="checkbox" checked> NC im Editor prüfen / bearbeiten</label></div>
                <div class="cldcl-row"><label></label><label style="min-width:0;text-align:left"><input id="ncd-report" type="checkbox" checked> Werkstattbericht anzeigen</label></div>
            </div>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="ok" style="font-weight:600">OK</button><button data-act="close">Abbrechen</button>
            </div>
        </div>`;
        document.body.appendChild(ov);
        this.overlay = ov;
        ov.addEventListener('click', e => {
            if (e.target === ov) return this.close();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') this.close();
            if (act === 'ok') this._ok();
        });
        ov.addEventListener('keyup', e => e.stopPropagation());
        ov.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this._ok(); if (e.key === 'Escape') this.close(); });
        setTimeout(() => ov.querySelector('#ncd-name')?.select(), 30);
    }

    close() { this.overlay?.remove(); this.overlay = null; }

    async _ok() {
        const app = this.app;
        const name = this.overlay.querySelector('#ncd-name').value.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const edit = this.overlay.querySelector('#ncd-edit').checked;
        const report = this.overlay.querySelector('#ncd-report').checked;
        if (!name) return this._toast('Bitte einen NC-Namen angeben', 'warning');
        this.close();

        // Mehrere Zuschnitte (Fliesenbogen) → eigene Dateien je Fliese: Standard-Export nutzen
        try {
            const parts = app.refreshTiles?.(true) || [];
            if (parts.length >= 1) return this._toast('Mehrere Zuschnitte erkannt — bitte „CNC Export“ verwenden (eine Datei je Zuschnitt)', 'warning');
        } catch { /* keine Fliesen-Logik → weiter */ }

        // Validierung wie beim CNC-Export
        if (typeof CeraCutPipeline !== 'undefined' && CeraCutPipeline.validate) {
            const v = CeraCutPipeline.validate(app.contours, {
                kerfWidth: app.settings.kerfWidth || 0.8, intarsiaMode: app.settings.intarsiaMode,
                intarsiaPosContours: app.intarsiaPosContours, intarsiaNegContours: app.intarsiaNegContours });
            if ((v.errors.length || v.warnings.length) && !(await app._showValidationModal(v))) return;
        }

        const pp = new SinumerikPostprocessor();
        const result = pp.generate(app.contours, app.cutOrder, {
            planName: name, dicke: app.settings.materialThickness || 10.0,
            material: app._cerajetResult?.material?.name || 'AALLGEMEIN',
            technologyParams: app.getTechnologyParams(), origin: app.settings.origin
        });
        if (!result?.code?.trim()) return this._toast('Kein G-Code erzeugt — sind schneidbare Konturen vorhanden?', 'error');
        if (result.warnings?.length) this._toast(`${result.warnings.length} Warnung(en) bei der Code-Erzeugung`, 'warning');

        let sim = null;
        try { sim = ToolpathSimulator.verify(app.contours, app.cutOrder); } catch { /* optional */ }
        const filename = `${name}.CNC`;
        const makeReportData = (code) => ({
            planName: name, ncFile: filename, date: new Date().toLocaleDateString('de-DE'), user: app.currentUser || window.CeraCutCurrentUser || '',
            machine: (typeof MachineProfiles !== 'undefined' ? MachineProfiles.getActiveProfile?.()?.name : '') || '',
            material: app._cerajetResult?.material?.name || '', thickness: app.settings.materialThickness,
            nc: NCCheck.parse(code), sim: sim?.stats || null,
            contours: (sim?.stats?.contourStats || []).map(c => ({ name: c.name, mode: c.cuttingMode, length: c.totalCutLength, time: c.estimatedTime }))
        });
        const showReport = (code) => NCDialog.showReport(app, NCReport.html(makeReportData(code)), name);

        if (edit) {
            const ed = new NCEditor(app, { filename, code: result.code, reportData: true,
                onReport: e => showReport(e.code),
                onSaved: (e, code) => { if (report) showReport(code); } });
            ed.open();
        } else {
            const check = NCCheck.parse(result.code);
            if (check.errors > 0 && !confirm(`${check.errors} Fehler im NC-Code gefunden.\nTrotzdem speichern?`)) return;
            const state = await app._saveCNCToServer(filename, result.code);
            if (state === 'cancelled') return this._toast('Export abgebrochen', 'warning');
            if (state !== 'saved') {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([result.code], { type: 'text/plain;charset=utf-8' }));
                a.download = filename; document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }
            this._toast(state === 'saved' ? `✅ ${filename} → Server/CNC` : `${filename} heruntergeladen`, state === 'saved' ? 'success' : 'warning');
            if (report) showReport(result.code);
        }
    }

    /** Bericht in Modal (iframe) mit Drucken/PDF-Button. */
    static showReport(app, html, name) {
        document.getElementById('nc-report-modal')?.remove();
        const ov = document.createElement('div');
        ov.id = 'nc-report-modal';
        ov.className = 'modal-overlay';
        ov.style.zIndex = 9600;
        ov.innerHTML = `<div class="cldcl-dialog-box" style="width:min(900px,96vw);max-width:96vw;height:90vh;display:flex;flex-direction:column">
            <div class="cldcl-header"><span>Werkstattbericht — ${String(name).replace(/[<>&"]/g, '')}</span><button class="cldcl-close" data-act="close">×</button></div>
            <iframe style="flex:1;border:0;background:#fff" sandbox="allow-same-origin allow-modals"></iframe>
            <div class="cldcl-row" style="padding:8px 12px;border-top:1px solid #ccc;justify-content:flex-end">
                <button data-act="print" style="font-weight:600">Drucken / als PDF speichern</button><button data-act="close">Schließen</button></div></div>`;
        document.body.appendChild(ov);
        const fr = ov.querySelector('iframe');
        fr.srcdoc = html;
        ov.addEventListener('click', e => {
            if (e.target === ov) return ov.remove();
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'close') ov.remove();
            if (act === 'print') { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch { app?.showToast?.('Drucken nicht möglich', 'error'); } }
        });
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        let dlg = null;
        document.getElementById('btn-nc-create')?.addEventListener('click', () => {
            if (!dlg) dlg = new NCDialog(window.app);
            dlg.open();
        });
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NCCheck, NCReport, NCEditor, NCDialog };
}
