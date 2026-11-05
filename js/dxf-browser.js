/**
 * DXF Browser — Server-seitiger Datei-Browser
 *
 * Ermöglicht das Browsen und Laden von DXF-Dateien vom Server-Netzlaufwerk
 * über die /api/dxf/* Endpunkte von server.js.
 *
 * Version: V1.3
 * V1.3: Sortierung (Name/Datum, auf-/absteigend, Ordner immer oben, pro User gemerkt)
 * V1.1: Zuletzt-Pfad pro User (_userKey(), Login/User-Management V6.32)
 * Last Modified: 2026-11-05
 * Build: 20261105-sort2
 */

/** Pro-User-Namespacing für localStorage-Keys (V6.32 Login/User-Management). */
function _userKey(base) {
    return (typeof window !== 'undefined' && window.CeraCutCurrentUser) ? base + '::' + window.CeraCutCurrentUser : base;
}

class DXFBrowser {
    constructor(app) {
        this.app = app;
        this.currentPath = localStorage.getItem(_userKey('ceracut-dxf-browser-path')) || '';
        this.overlay = null;
        this.isAvailable = null; // null = ungeprüft
        this.items = [];
        this.sort = { key: 'name', dir: 'asc' };
        try {
            const saved = JSON.parse(localStorage.getItem(_userKey('ceracut-dxf-browser-sort')) || 'null');
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
        try { localStorage.setItem(_userKey('ceracut-dxf-browser-sort'), JSON.stringify(this.sort)); } catch (e) {}
        const listEl = this.overlay?.querySelector('.dxf-browser-list');
        if (listEl) this._renderList(this.items, listEl);
        this._renderSortBar();
    }

    _renderSortBar() {
        const bar = this.overlay?.querySelector('.dxf-browser-sortbar');
        if (!bar) return;
        bar.innerHTML = '';
        const defs = [['name', 'Name'], ['mtime', 'Datum']];
        for (const [key, label] of defs) {
            const active = this.sort.key === key;
            const b = document.createElement('span');
            b.textContent = label + (active ? (this.sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
            b.style.cssText = 'cursor:pointer; padding:2px 8px; border-radius:3px; ' + (active ? 'color:#4fc3f7; background:#2a3a4a;' : 'color:#888;');
            b.addEventListener('click', () => this._setSort(key));
            bar.appendChild(b);
        }
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
            this.app.showToast('Server-DXF-Browse nicht verfügbar (API antwortet nicht)', 'error');
            return;
        }

        this._createModal();
        this.loadDirectory(this.currentPath || '');
    }

    /**
     * Schließt den Dialog.
     */
    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }

    /**
     * Erstellt das Modal-Overlay.
     */
    _createModal() {
        // Altes Modal entfernen falls vorhanden
        this.close();

        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';
        this.overlay.style.cssText = 'display:flex; z-index:10000;';

        this.overlay.innerHTML = `
            <div style="width:600px; max-height:80vh; display:flex; flex-direction:column; background:#1e1e1e; border:1px solid #555; border-radius:6px; box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <div class="dialog-header" style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #444;">
                    <h3 style="margin:0; font-size:14px; color:#e0e0e0;">Server DXF-Dateien</h3>
                    <button class="dxf-browser-close" style="background:none; border:none; color:#888; font-size:18px; cursor:pointer; padding:0 4px;">&times;</button>
                </div>
                <div class="dxf-browser-breadcrumb" style="padding:8px 16px; border-bottom:1px solid #333; font-size:12px; color:#888; display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                </div>
                <div class="dxf-browser-sortbar" style="padding:6px 16px; border-bottom:1px solid #333; font-size:12px; display:flex; gap:4px; align-items:center;"></div>
                <div class="dxf-browser-list" style="flex:1; overflow-y:auto; padding:4px 0; min-height:200px;">
                    <div style="padding:40px; text-align:center; color:#666;">Lade...</div>
                </div>
                <div class="dxf-browser-status" style="padding:8px 16px; border-top:1px solid #333; font-size:11px; color:#666;">
                </div>
            </div>
        `;

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
        const listEl = this.overlay?.querySelector('.dxf-browser-list');
        const statusEl = this.overlay?.querySelector('.dxf-browser-status');
        if (!listEl) return;

        listEl.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">Lade...</div>';

        try {
            const resp = await fetch(`/api/dxf/list?path=${encodeURIComponent(dirPath)}`);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                this._renderBreadcrumb(dirPath); // Root-Link bleibt erreichbar (keine Sackgasse)
                try { localStorage.removeItem(_userKey('ceracut-dxf-browser-path')); } catch (e) {}
                listEl.innerHTML = `<div style="padding:40px; text-align:center; color:#f44;">Fehler: ${err.error || resp.statusText}</div>`;
                return;
            }

            const data = await resp.json();
            try { localStorage.setItem(_userKey('ceracut-dxf-browser-path'), dirPath); } catch (e) {}
            this._renderBreadcrumb(data.path);
            this.items = data.items;
            this._renderList(this.items, listEl);

            if (statusEl) {
                const dirs = data.items.filter(i => i.type === 'directory').length;
                const files = data.items.filter(i => i.type === 'file').length;
                statusEl.textContent = `${dirs} Ordner, ${files} DXF-Dateien`;
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
        rootLink.textContent = '📁 DXF-Root';
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
            listEl.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">Keine DXF-Dateien oder Ordner</div>';
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

        for (const item of this._sortItems(items)) {
            const el = this._createListItem(item.name, item.type, item.size, item.mtime);

            if (item.type === 'directory') {
                el.addEventListener('click', () => {
                    const subPath = this.currentPath ? this.currentPath + '/' + item.name : item.name;
                    this.loadDirectory(subPath);
                });
            } else {
                el.addEventListener('click', () => {
                    const filePath = this.currentPath ? this.currentPath + '/' + item.name : item.name;
                    this.selectFile(filePath, item.name, item.size);
                });
            }

            listEl.appendChild(el);
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

    /**
     * Lädt eine ausgewählte DXF-Datei vom Server.
     */
    async selectFile(filePath, fileName, fileSize) {
        const statusEl = this.overlay?.querySelector('.dxf-browser-status');
        if (statusEl) statusEl.textContent = `Lade ${fileName}...`;

        try {
            const resp = await fetch(`/api/dxf/file?path=${encodeURIComponent(filePath)}`);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                this._renderBreadcrumb(dirPath); // Root-Link bleibt erreichbar (keine Sackgasse)
                try { localStorage.removeItem(_userKey('ceracut-dxf-browser-path')); } catch (e) {}
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
            this.app.loadDXFContent(fileName, content, (fileSize / 1024).toFixed(1));

        } catch (err) {
            this.app.showToast(`Verbindungsfehler: ${err.message}`, 'error');
            if (statusEl) statusEl.textContent = 'Fehler beim Laden';
        }
    }
}
