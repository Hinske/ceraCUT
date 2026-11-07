/**
 * DXF Browser — Server-seitiger Datei-Browser
 *
 * Ermöglicht das Browsen und Laden von DXF-Dateien vom Server-Netzlaufwerk
 * über die /api/dxf/* Endpunkte von server.js.
 *
 * Version: V1.7
 * V1.7: Feat — Filterfeld + max. 400 Zeilen (CNC-Ordner hat ~10.000 Dateien); CNC: kein Datum-Sortierknopf
 * V1.6: Feat — kind 'cnc': gleicher Browser für den CNC-Ordner (/api/cnc/*, CNCReader-Vorschau, onLoad-Callback); Titel „DXF Server"/„CNC Server"
 * V1.5: Feat — Vorschau-Panel (Canvas) rechts: Einfachklick = Vorschau, Doppelklick/Button = Laden
 * V1.4: Feat — pickMany(): Mehrfachauswahl für den Teileimport (Checkboxen, Alle im Ordner, 4 parallele Downloads); Fix selectFile(): dirPath war undefiniert
 * V1.3: Sortierung (Name/Datum, auf-/absteigend, Ordner immer oben, pro User gemerkt)
 * V1.1: Zuletzt-Pfad pro User (_userKey(), Login/User-Management V6.32)
 * Last Modified: 2026-11-07
 * Build: 20261107-filter
 */

/** Pro-User-Namespacing für localStorage-Keys (V6.32 Login/User-Management). */
function _userKey(base) {
    return (typeof window !== 'undefined' && window.CeraCutCurrentUser) ? base + '::' + window.CeraCutCurrentUser : base;
}

class DXFBrowser {
    /**
     * @param {object} app
     * @param {{kind?: 'dxf'|'cnc', onLoad?: function(name, content, sizeKB)}} [opts]
     *   kind 'cnc' → /api/cnc/*, Titel „CNC Server", Vorschau per CNCReader, onLoad bekommt den Text.
     */
    constructor(app, opts = {}) {
        this.app = app;
        this.kind = opts.kind === 'cnc' ? 'cnc' : 'dxf';
        this.onLoad = opts.onLoad || null;
        this.api = '/api/' + this.kind;
        this.label = this.kind === 'cnc' ? 'CNC Server' : 'DXF Server';
        this._ns = this.kind === 'cnc' ? 'ceracut-cnc-browser' : 'ceracut-dxf-browser';
        this.currentPath = localStorage.getItem(_userKey(this._ns + '-path')) || '';
        this.overlay = null;
        this.isAvailable = null; // null = ungeprüft
        this._multi = null;      // Mehrfachauswahl-Sitzung (pickMany): {sel: Map(pfad → {name,size}), resolve}
        this.items = [];
        this.sort = { key: 'name', dir: 'asc' };
        try {
            const saved = JSON.parse(localStorage.getItem(_userKey(this._ns + '-sort')) || 'null');
            if (saved && ['name', 'mtime'].includes(saved.key) && ['asc', 'desc'].includes(saved.dir)) this.sort = saved;
        } catch (e) { /* ignorieren */ }
    }

    /** Sortiert Items: Ordner immer zuerst, dann nach gewähltem Schlüssel. */
    _sortItems(items) {
        const { key, dir } = this.sort;
        const f = dir === 'asc' ? 1 : -1;
        return [...items].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            let r = 0;
            if (key === 'name') r = 0;
            else r = (a.mtime || 0) - (b.mtime || 0);
            if (r === 0) return f * a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
            return f * r;
        });
    }

    _setSort(key) {
        if (this.sort.key === key) this.sort.dir = this.sort.dir === 'asc' ? 'desc' : 'asc';
        else this.sort = { key, dir: key === 'mtime' ? 'desc' : 'asc' };
        try { localStorage.setItem(_userKey(this._ns + '-sort'), JSON.stringify(this.sort)); } catch (e) {}
        const listEl = this.overlay?.querySelector('.dxf-browser-list');
        if (listEl) this._renderList(this.items, listEl);
        this._renderSortBar();
    }

    _renderSortBar() {
        const bar = this.overlay?.querySelector('.dxf-browser-sortbar');
        if (!bar) return;
        bar.innerHTML = '';
        const defs = this.kind === 'cnc' ? [['name', 'Name']] : [['name', 'Name'], ['mtime', 'Datum']];
        for (const [key, label] of defs) {
            const active = this.sort.key === key;
            const b = document.createElement('span');
            b.textContent = label + (active ? (this.sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
            b.style.cssText = 'cursor:pointer; padding:2px 8px; border-radius:3px; ' + (active ? 'color:#4fc3f7; background:#2a3a4a;' : 'color:#888;');
            b.addEventListener('click', () => this._setSort(key));
            bar.appendChild(b);
        }
        const f = document.createElement('input');
        f.type = 'search'; f.placeholder = 'Filter…'; f.value = this._filter || '';
        f.style.cssText = 'margin-left:auto; width:200px; padding:3px 8px; background:#111; color:#ddd; border:1px solid #444; border-radius:3px; font-size:12px;';
        let tm = null;
        f.addEventListener('input', () => {
            clearTimeout(tm);
            tm = setTimeout(() => {
                this._filter = f.value.trim().toLowerCase();
                const listEl = this.overlay?.querySelector('.dxf-browser-list');
                if (listEl) this._renderList(this.items, listEl);
            }, 150);
        });
        bar.appendChild(f);
    }

    /**
     * Prüft ob die Server-API verfügbar ist.
     */
    async checkAvailability() {
        try {
            const resp = await fetch('/api/health');
            if (resp.ok) {
                this.isAvailable = true;
                return true;
            }
        } catch { /* nicht verfügbar */ }
        this.isAvailable = false;
        return false;
    }

    /**
     * Öffnet den DXF-Browser-Dialog.
     */
    async open() {
        // Verfügbarkeit prüfen (nur beim ersten Mal)
        if (this.isAvailable === null) {
            await this.checkAvailability();
        }

        if (!this.isAvailable) {
            this.app.showToast('Server-Browse nicht verfügbar (API antwortet nicht)', 'error');
            return;
        }

        this._createModal();
        this.loadDirectory(this.currentPath || '');
    }

    /**
     * V1.4: Mehrfachauswahl — mehrere DXF-Dateien (auch aus verschiedenen Ordnern) wählen und als
     * File-Objekte (Rohbytes) zurückgeben. Abbruch/Schließen → leeres Array.
     * @returns {Promise<File[]>}
     */
    async pickMany() {
        if (this.isAvailable === null) await this.checkAvailability();
        if (!this.isAvailable) {
            this.app.showToast('Server-Browse nicht verfügbar (API antwortet nicht)', 'error');
            return [];
        }
        if (this._multi) this._multi.resolve([]);
        return new Promise(resolve => {
            this._multi = { sel: new Map(), resolve };
            this._createModal();
            this.loadDirectory(this.currentPath || '');
        });
    }

    _multiCount() { return this._multi ? this._multi.sel.size : 0; }

    _updateMultiBar() {
        const el = this.overlay?.querySelector('.dxf-browser-count');
        if (el) el.textContent = `${this._multiCount()} Datei(en) ausgewählt`;
        const ok = this.overlay?.querySelector('.dxf-browser-ok');
        if (ok) ok.disabled = this._multiCount() === 0;
    }

    _toggleMulti(path, name, size, on) {
        if (!this._multi) return;
        const next = on === undefined ? !this._multi.sel.has(path) : on;
        if (next) this._multi.sel.set(path, { name, size }); else this._multi.sel.delete(path);
        this._updateMultiBar();
        return next;
    }

    /** Alle DXF-Dateien des aktuellen Ordners an-/abwählen. */
    _multiAllInFolder() {
        const files = this.items.filter(i => i.type === 'file');
        const allOn = files.length > 0 && files.every(i => this._multi.sel.has(this._fullPath(i.name)));
        for (const i of files) this._toggleMulti(this._fullPath(i.name), i.name, i.size, !allOn);
        const listEl = this.overlay?.querySelector('.dxf-browser-list');
        if (listEl) this._renderList(this.items, listEl);
    }

    _fullPath(name) { return this.currentPath ? this.currentPath + '/' + name : name; }

    /** Gewählte Dateien laden (4 parallel) und als File-Objekte liefern. */
    async _finishMulti() {
        const m = this._multi; if (!m || m.sel.size === 0) return;
        const statusEl = this.overlay?.querySelector('.dxf-browser-status');
        const entries = [...m.sel.entries()];
        const out = new Array(entries.length);
        let done = 0, failed = 0, next = 0;
        const worker = async () => {
            while (next < entries.length) {
                const i = next++;
                const [path, info] = entries[i];
                try {
                    const resp = await fetch(`${this.api}/file?path=${encodeURIComponent(path)}`);
                    if (!resp.ok) throw new Error(resp.statusText);
                    out[i] = new File([await resp.arrayBuffer()], info.name);
                } catch { failed++; }
                done++;
                if (statusEl) statusEl.textContent = `Lade ${done}/${entries.length}…`;
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
        this._multi = null;                 // vor close(), sonst würde close() mit [] auflösen
        this.close();
        if (failed) this.app.showToast(`${failed} Datei(en) konnten nicht geladen werden`, 'warning');
        m.resolve(out.filter(Boolean));
    }

    /**
     * Schließt den Dialog.
     */
    close() {
        if (this._multi) { const m = this._multi; this._multi = null; m.resolve([]); }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    /**
     * Erstellt das Modal-Overlay.
     */
    _createModal() {
        // Altes Modal entfernen falls vorhanden (nicht close(): das würde eine laufende Mehrfachauswahl abbrechen)
        if (this.overlay) { this.overlay.remove(); this.overlay = null; }
        if (this._escHandler) document.removeEventListener('keydown', this._escHandler);

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.style.cssText = 'display:flex; z-index:10000;';

        this.overlay.innerHTML = `
            <div style="width:min(960px,96vw); max-height:80vh; display:flex; flex-direction:column; background:#1e1e1e; border:1px solid #555; border-radius:6px; box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <div class="dialog-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #444;">
                    <h3 style="margin:0; font-size:14px; color:#e0e0e0;">${this._multi ? this.label + ' — Dateien auswählen' : this.label + (this.kind === 'cnc' ? ' — CNC-Dateien' : ' — DXF-Dateien')}</h3>
                    <button class="dxf-browser-close" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer; padding:0 4px;">&times;</button>
                </div>
                <div style="flex:1; display:flex; min-height:0;">
                <div style="flex:1 1 560px; min-width:0; display:flex; flex-direction:column;">
                <div class="dxf-browser-breadcrumb" style="padding:8px 16px; border-bottom:1px solid #333; font-size:12px; color:#888; display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                </div>
                <div class="dxf-browser-sortbar" style="padding:6px 16px; border-bottom:1px solid #333; font-size:12px; display:flex; gap:4px; align-items:center;"></div>
                <div class="dxf-browser-list" style="flex:1; overflow-y:auto; padding:4px 0; min-height:200px;">
                    <div style="padding:40px; text-align:center; color:#666;">Lade...</div>
                </div>
                <div class="dxf-browser-status" style="padding:8px 16px; border-top:1px solid #333; font-size:11px; color:#666;">
                </div>
                ${this._multi ? `<div style="padding:8px 16px; border-top:1px solid #333; display:flex; gap:8px; align-items:center; font-size:12px; color:#aaa;">
                    <span class="dxf-browser-count">0 Datei(en) ausgewählt</span>
                    <button class="dxf-browser-all" style="margin-left:auto; padding:4px 10px; background:#333; color:#ddd; border:1px solid #555; border-radius:3px; cursor:pointer;">Alle im Ordner</button>
                    <button class="dxf-browser-ok" disabled style="padding:4px 14px; background:#0d6efd; color:#fff; border:none; border-radius:3px; cursor:pointer; font-weight:600;">Übernehmen</button>
                </div>` : ''}
                </div>
                <div class="dxf-browser-preview" style="flex:0 0 340px; border-left:1px solid #333; display:flex; flex-direction:column; padding:10px; gap:6px; background:#181818;">
                    <canvas class="dxf-browser-canvas" width="320" height="320" style="width:320px; height:320px; background:#101010; border:1px solid #333; border-radius:3px;"></canvas>
                    <div class="dxf-browser-pinfo" style="font-size:11px; color:#999; line-height:1.5; word-break:break-all;">Datei anklicken für Vorschau</div>
                </div>
                </div>
            </div>
        `;
        if (this._multi) {
            this.overlay.querySelector('.dxf-browser-all').addEventListener('click', () => this._multiAllInFolder());
            this.overlay.querySelector('.dxf-browser-ok').addEventListener('click', () => this._finishMulti());
        }

        // Event: Overlay-Klick schließt
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        // Event: X-Button
        this.overlay.querySelector('.dxf-browser-close').addEventListener('click', () => this.close());

        // Event: Escape
        this._escHandler = (e) => {
            if (e.key === 'Escape') { this.close(); document.removeEventListener('keydown', this._escHandler); }
        };
        document.addEventListener('keydown', this._escHandler);

        document.body.appendChild(this.overlay);
        this._renderSortBar();
    }

    /**
     * Lädt ein Verzeichnis und zeigt den Inhalt an.
     */
    async loadDirectory(dirPath) {
        this.currentPath = dirPath;
        this._filter = '';
        this._renderSortBar();
        const listEl = this.overlay?.querySelector('.dxf-browser-list');
        const statusEl = this.overlay?.querySelector('.dxf-browser-status');
        if (!listEl) return;

        listEl.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">Lade...</div>';

        try {
            const resp = await fetch(`${this.api}/list?path=${encodeURIComponent(dirPath)}`);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                this._renderBreadcrumb(dirPath); // Root-Link bleibt erreichbar (keine Sackgasse)
                try { localStorage.removeItem(_userKey(this._ns + '-path')); } catch (e) {}
                listEl.innerHTML = `<div style="padding:40px; text-align:center; color:#f44;">Fehler: ${err.error || resp.statusText}</div>`;
                return;
            }

            const data = await resp.json();
            try { localStorage.setItem(_userKey(this._ns + '-path'), dirPath); } catch (e) {}
            this._renderBreadcrumb(data.path);
            this.items = data.items;
            this._renderList(this.items, listEl);

            if (statusEl) {
                const dirs = data.items.filter(i => i.type === 'directory').length;
                const files = data.items.filter(i => i.type === 'file').length;
                statusEl.textContent = `${dirs} Ordner, ${files} ${this.kind === 'cnc' ? 'CNC' : 'DXF'}-Dateien`;
            }
        } catch (err) {
            this._renderBreadcrumb(dirPath);
            listEl.innerHTML = `<div style="padding:40px; text-align:center; color:#f44;">Verbindungsfehler: ${err.message}</div>`;
        }
    }

    /**
     * Rendert die Breadcrumb-Navigation.
     */
    _renderBreadcrumb(currentPath) {
        const el = this.overlay?.querySelector('.dxf-browser-breadcrumb');
        if (!el) return;

        el.innerHTML = '';

        // Root-Link
        const rootLink = document.createElement('span');
        rootLink.textContent = this.kind === 'cnc' ? '📁 CNC-Root' : '📁 DXF-Root';
        rootLink.style.cssText = 'cursor:pointer; color:#4fc3f7;';
        rootLink.addEventListener('click', () => this.loadDirectory(''));
        el.appendChild(rootLink);

        if (!currentPath) return;

        // Pfad-Segmente
        const parts = currentPath.split('/').filter(Boolean);
        let accumulated = '';
        for (const part of parts) {
            accumulated += (accumulated ? '/' : '') + part;
            const sep = document.createElement('span');
            sep.textContent = ' / ';
            sep.style.color = '#555';
            el.appendChild(sep);

            const link = document.createElement('span');
            link.textContent = part;
            const linkPath = accumulated;
            link.style.cssText = 'cursor:pointer; color:#4fc3f7;';
            link.addEventListener('click', () => this.loadDirectory(linkPath));
            el.appendChild(link);
        }
    }

    /**
     * Rendert die Dateiliste.
     */
    _renderList(items, listEl) {
        listEl.innerHTML = '';

        if (items.length === 0) {
            listEl.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">Keine Dateien oder Ordner</div>';
            return;
        }

        // ".." Eintrag wenn nicht im Root
        if (this.currentPath) {
            const upItem = this._createListItem('..', 'directory', 0);
            upItem.addEventListener('click', () => {
                const parent = this.currentPath.split('/').slice(0, -1).join('/');
                this.loadDirectory(parent);
            });
            listEl.appendChild(upItem);
        }

        const flt = this._filter || '';
        let all = this._sortItems(items);
        if (flt) all = all.filter(i => i.name.toLowerCase().includes(flt));
        const MAX = 400;   // 10.000 DOM-Zeilen waren der zweite Flaschenhals
        const shown = all.length > MAX ? all.slice(0, MAX) : all;
        for (const item of shown) {
            const el = this._createListItem(item.name, item.type, item.size, item.mtime);

            if (item.type === 'directory') {
                el.addEventListener('click', () => {
                    const subPath = this.currentPath ? this.currentPath + '/' + item.name : item.name;
                    this.loadDirectory(subPath);
                });
            } else if (this._multi) {
                const filePath = this._fullPath(item.name);
                const cb = document.createElement('input');
                cb.type = 'checkbox'; cb.checked = this._multi.sel.has(filePath); cb.style.cssText = 'margin:0;';
                el.insertBefore(cb, el.firstChild);
                el.addEventListener('click', (ev) => {
                    this._showPreview(filePath, item.name);
                    const on = this._toggleMulti(filePath, item.name, item.size, ev.target === cb ? cb.checked : undefined);
                    cb.checked = on;
                });
            } else {
                // Einfachklick = Vorschau, Doppelklick (oder Button) = Laden
                const filePath = this.currentPath ? this.currentPath + '/' + item.name : item.name;
                el.addEventListener('click', () => this._showPreview(filePath, item.name, el));
                el.addEventListener('dblclick', () => this.selectFile(filePath, item.name, item.size));
                const ld = document.createElement('button');
                ld.textContent = 'Laden';
                ld.style.cssText = 'padding:2px 10px; background:#0d6efd; color:#fff; border:none; border-radius:3px; cursor:pointer; font-size:11px;';
                ld.addEventListener('click', (ev) => { ev.stopPropagation(); this.selectFile(filePath, item.name, item.size); });
                el.appendChild(ld);
            }

            listEl.appendChild(el);
        }
        if (all.length > shown.length) {
            const more = document.createElement('div');
            more.style.cssText = 'padding:10px 16px; color:#888; font-size:12px; text-align:center;';
            more.textContent = `… ${all.length - shown.length} weitere — Filter oben verwenden`;
            listEl.appendChild(more);
        }
    }

    /**
     * Erstellt ein Listen-Element.
     */
    _createListItem(name, type, size, mtime) {
        const el = document.createElement('div');
        el.style.cssText = 'padding:8px 16px; cursor:pointer; display:flex; align-items:center; gap:8px; border-bottom:1px solid #2a2a2a;';

        // Hover-Effekt
        el.addEventListener('mouseenter', () => el.style.background = '#2a3a4a');
        el.addEventListener('mouseleave', () => el.style.background = 'none');

        const icon = document.createElement('span');
        icon.style.fontSize = '14px';
        icon.textContent = type === 'directory' ? '📁' : '📄';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.cssText = 'flex:1; color:#e0e0e0; font-size:13px;';

        el.appendChild(icon);
        el.appendChild(nameSpan);

        if (mtime > 0) {
            const d = document.createElement('span');
            d.textContent = new Date(mtime).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            d.style.cssText = 'color:#666; font-size:11px; min-width:110px; text-align:right;';
            el.appendChild(d);
        }

        if (type === 'file' && size > 0) {
            const sizeSpan = document.createElement('span');
            sizeSpan.textContent = (size / 1024).toFixed(1) + ' KB';
            sizeSpan.style.cssText = 'color:#666; font-size:11px;';
            el.appendChild(sizeSpan);
        }

        return el;
    }

    /** Vorschau einer Datei im rechten Panel (Cache pro Pfad, Race-sicher über Token). */
    async _showPreview(filePath, fileName) {
        const info = this.overlay?.querySelector('.dxf-browser-pinfo');
        const cv = this.overlay?.querySelector('.dxf-browser-canvas');
        if (!info || !cv) return;
        const token = this._pvToken = (this._pvToken || 0) + 1;
        this._pvCache = this._pvCache || new Map();
        info.textContent = `Lade ${fileName}…`;
        try {
            let data = this._pvCache.get(filePath);
            if (!data) {
                const resp = await fetch(`${this.api}/file?path=${encodeURIComponent(filePath)}`);
                if (!resp.ok) throw new Error(resp.statusText);
                const bytes = new Uint8Array(await resp.arrayBuffer());
                let content = '';
                for (let i = 0; i < bytes.length; i++) content += String.fromCharCode(bytes[i]);
                if (this.kind === 'cnc') {
                    const res = new CNCReader().parse(content, { showRapid: false, tolerance: 0.01 });
                    const cs = (res.entities || []).filter(e => e.points && e.points.length > 1 && !e.isRapid);
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const e of cs) for (const p of e.points) {
                        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
                        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
                    }
                    data = {
                        contours: cs.map(c => ({ pts: c.points.map(p => [p.x, p.y]), closed: !!c.isClosed })),
                        bounds: cs.length ? { minX, minY, maxX, maxY } : null,
                        open: cs.filter(c => !c.isClosed).length
                    };
                } else {
                    const res = DXFParser.parse(content);
                    if (!res.success) throw new Error(res.error || 'Parse-Fehler');
                    data = {
                        contours: res.contours.map(c => ({ pts: c.points.map(p => [p.x, p.y]), closed: !!c.isClosed })),
                        bounds: res.bounds, open: res.stats?.openContours || 0
                    };
                }
                this._pvCache.set(filePath, data);
                if (this._pvCache.size > 30) this._pvCache.delete(this._pvCache.keys().next().value);
            }
            if (token !== this._pvToken || !this.overlay) return; // neuere Auswahl hat Vorrang
            this._drawPreview(cv, data);
            const b = data.bounds;
            const w = b ? (b.maxX - b.minX) : 0, h = b ? (b.maxY - b.minY) : 0;
            info.innerHTML = `<b style="color:#e0e0e0">${fileName.replace(/</g, '&lt;')}</b><br>` +
                `${w.toFixed(1)} × ${h.toFixed(1)} mm<br>${data.contours.length} Konturen` +
                (data.open ? `, <span style="color:#ffb74d">${data.open} offen</span>` : '');
        } catch (err) {
            if (token !== this._pvToken) return;
            cv.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
            info.textContent = `Vorschau nicht möglich: ${err.message}`;
        }
    }

    _drawPreview(cv, data) {
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, cv.width, cv.height);
        const b = data.bounds;
        if (!b || !isFinite(b.minX) || !data.contours.length) return;
        const pad = 12, W = cv.width - 2 * pad, H = cv.height - 2 * pad;
        const bw = Math.max(b.maxX - b.minX, 1e-6), bh = Math.max(b.maxY - b.minY, 1e-6);
        const sc = Math.min(W / bw, H / bh);
        const ox = pad + (W - bw * sc) / 2, oy = pad + (H - bh * sc) / 2 + bh * sc;
        ctx.lineWidth = 1; ctx.lineJoin = 'round';
        for (const c of data.contours) {
            ctx.beginPath();
            c.pts.forEach((p, i) => {
                const x = ox + (p[0] - b.minX) * sc, y = oy - (p[1] - b.minY) * sc; // Y nach oben
                i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            });
            if (c.closed) ctx.closePath();
            ctx.strokeStyle = c.closed ? '#4fc3f7' : '#ffb74d';
            ctx.stroke();
        }
    }

    /**
     * Lädt eine ausgewählte DXF-Datei vom Server.
     */
    async selectFile(filePath, fileName, fileSize) {
        const statusEl = this.overlay?.querySelector('.dxf-browser-status');
        if (statusEl) statusEl.textContent = `Lade ${fileName}...`;

        try {
            const resp = await fetch(`${this.api}/file?path=${encodeURIComponent(filePath)}`);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                this.app.showToast(`Fehler: ${err.error || resp.statusText}`, 'error');
                return;
            }

            // DXF als ArrayBuffer lesen und als ISO-8859-1 dekodieren
            const buffer = await resp.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let content = '';
            for (let i = 0; i < bytes.length; i++) {
                content += String.fromCharCode(bytes[i]);
            }

            this.close();
            if (this.kind === 'cnc') {
                const text = new TextDecoder('utf-8').decode(bytes);
                this.onLoad?.(fileName, text, (fileSize / 1024).toFixed(1));
            } else {
                this.app.loadDXFContent(fileName, content, (fileSize / 1024).toFixed(1));
            }

        } catch (err) {
            this.app.showToast(`Verbindungsfehler: ${err.message}`, 'error');
            if (statusEl) statusEl.textContent = 'Fehler beim Laden';
        }
    }
}
