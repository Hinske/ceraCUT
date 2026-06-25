/**
 * CeraCUT Document Manager V1.3
 * V1.3: Fix — visibilitychange-Event ersetzt beforeunload für zuverlässige Persistenz beim
 *       Tab-/Browser-Schließen (async IndexedDB-Transaktionen werden in beforeunload abgebrochen).
 * V1.2: Fix — deletedContourNames-Set (geloeschte Konturen pro Tab) wird jetzt mit
 *       erfasst/angewendet (_captureFromApp/_applyToApp), analog zu dxfResult.
 * V1.1: Fix — settings.originSet-Default ergänzt (Gate für CAM-Freischaltung erst nach Setup)
 * Multi-Dokument-Tabs (AutoCAD-Stil) — mehrere DXF-Dateien gleichzeitig offen.
 *
 * Architektur: Swap-Pattern. Pro Tab existiert ein Document mit dem
 * kompletten Satz an Feldern, die vorher direkt auf CeraCutApp lagen
 * (contours, settings, undoManager, layerManager, ...). Beim Tab-Wechsel
 * werden die Felder des bisherigen Dokuments aus app.* zurückgeschrieben
 * (_captureFromApp) und die Felder des Zieldokuments auf app.* kopiert
 * (_applyToApp), gefolgt von einer vollständigen UI-Neuzeichnung.
 *
 * Persistenz: eigene IndexedDB 'ceracut-tabs' (bewusst getrennt von
 * ProjectManager's 'ceracut-project', um keine Versions-Migration an einer
 * bestehenden, produktiv genutzten DB vorzunehmen). Undo/Redo-Historie wird
 * NICHT persistiert (zu volatil/groß) — nach einem Reload startet jedes
 * Dokument mit leerem Undo-Stack.
 *
 * Created: 2026-06-23 MEZ
 * Build: 20260623-multidoc
 */

// ════════════════════════════════════════════════════════════════════════════
//  DOCUMENT — Per-Tab-State
// ════════════════════════════════════════════════════════════════════════════

class CeraDocument {
    constructor() {
        this.id = CeraDocument._nextId();
        this.label = 'Unbenannt';

        // ═══ Wizard / Geometrie (Default identisch zu CeraCutApp-Konstruktor) ═══
        this.currentStep = 1;
        this.fileLoaded = false;
        this.dxfContent = null;
        this.dxfResult = null;     // Wird NICHT persistiert (reine Parse-Diagnostik)
        this.deletedContourNames = new Set(); // V6.25: ueberlebt Layer-Sichtbarkeits-Reruns, pro Tab
        this.contours = [];
        this.intarsiaPosContours = null;
        this.intarsiaNegContours = null;
        this.cutOrder = [];
        this.selectedLayers = [];
        this.bounds = null;

        this.dxfFileName = null;
        this.outputFileName = null;
        this.loadedFileName = '';
        this.currentProjectName = '';
        this.isDirty = false;
        this._dxfFileHandle = null;

        this.settings = CeraDocument._defaultSettings();

        // ═══ Pro-Dokument-Manager-Instanzen ═══
        this.undoManager = new UndoManager({ maxHistory: 50 });
        this.clipboardManager = new ClipboardManager({ undoManager: this.undoManager, app: null });
        this.layerManager = new LayerManager();
        this.layerManager.undoManager = this.undoManager;
        this.imageUnderlayManager = (typeof ImageUnderlayManager !== 'undefined')
            ? new ImageUnderlayManager(null) : null;

        // ═══ View-Transform (Canvas ist global, Inhalt + View wandern pro Tab) ═══
        this.view = { scale: 1, offsetX: 0, offsetY: 0 };
    }

    static _defaultSettings() {
        return {
            chainingTolerance: 0.1,
            kerfWidth: 0.8,
            quality: 2,
            origin: { x: 0, y: 0 },
            originSet: false, // V1.1: true erst nach explizitem Setzen — gate fuer CAM-Freischaltung
            originPreset: 'bottom-left',
            microjointWidth: 0.5,
            microjointCount: 2,
            materialThickness: 10.0,
            internalLeadLikeExternal: true,
            altLeadEnabled: true,
            technology: {
                materialId: 1,
                nozzleId: 3,
                pressure: 2900,
                optMode: 'minKosten',
                abrasiveOverride: null
            },
            intarsiaMode: false,
            intarsiaGap: 1.6,
            intarsiaPreview: null,
            areaClasses: null
        };
    }

    static _nextId() {
        return 'doc' + (CeraDocument._idCounter++) + '_' + Date.now().toString(36);
    }

    /** Serialisiert das Dokument für IndexedDB-Persistenz (Undo-Historie ausgeschlossen) */
    toJSON() {
        return {
            id: this.id,
            label: this.label,
            currentStep: this.currentStep,
            fileLoaded: this.fileLoaded,
            dxfContent: this.dxfContent,
            contours: this.contours.map(c => c.toJSON()),
            intarsiaPosContours: this.intarsiaPosContours ? this.intarsiaPosContours.map(c => c.toJSON()) : null,
            intarsiaNegContours: this.intarsiaNegContours ? this.intarsiaNegContours.map(c => c.toJSON()) : null,
            cutOrder: this.cutOrder,
            selectedLayers: this.selectedLayers,
            bounds: this.bounds,
            dxfFileName: this.dxfFileName,
            outputFileName: this.outputFileName,
            loadedFileName: this.loadedFileName,
            currentProjectName: this.currentProjectName,
            isDirty: this.isDirty,
            _dxfFileHandle: this._dxfFileHandle,   // FileSystemFileHandle — Structured-Clone-fähig
            settings: this.settings,
            layers: this.layerManager.toJSON(),
            view: this.view
        };
    }

    /** Rekonstruiert ein Document aus toJSON()-Daten (Undo-Stack startet leer) */
    static fromJSON(data) {
        const doc = new CeraDocument();
        doc.id = data.id || doc.id;
        doc.label = data.label || 'Unbenannt';
        doc.currentStep = data.currentStep || 1;
        doc.fileLoaded = !!data.fileLoaded;
        doc.dxfContent = data.dxfContent || null;
        doc.contours = (data.contours || []).map(c => CamContour.fromJSON(c));
        doc.intarsiaPosContours = data.intarsiaPosContours ? data.intarsiaPosContours.map(c => CamContour.fromJSON(c)) : null;
        doc.intarsiaNegContours = data.intarsiaNegContours ? data.intarsiaNegContours.map(c => CamContour.fromJSON(c)) : null;
        doc.cutOrder = data.cutOrder || [];
        doc.selectedLayers = data.selectedLayers || [];
        doc.bounds = data.bounds || null;
        doc.dxfFileName = data.dxfFileName || null;
        doc.outputFileName = data.outputFileName || null;
        doc.loadedFileName = data.loadedFileName || '';
        doc.currentProjectName = data.currentProjectName || '';
        doc.isDirty = false; // bewusst nicht übernommen — frischer Session-Start
        doc._dxfFileHandle = data._dxfFileHandle || null;
        doc.settings = data.settings || CeraDocument._defaultSettings();
        if (data.layers) doc.layerManager.fromJSON(data.layers);
        doc.view = data.view || { scale: 1, offsetX: 0, offsetY: 0 };
        return doc;
    }
}
CeraDocument._idCounter = 1;

// ════════════════════════════════════════════════════════════════════════════
//  DOCUMENT MANAGER — Tabs, Switch, Persistenz
// ════════════════════════════════════════════════════════════════════════════

class DocumentManager {
    constructor(app) {
        this.app = app;
        this.documents = new Map();   // id → Document
        this.tabOrder = [];           // [id, ...]
        this.activeId = null;

        this._dbName = 'ceracut-tabs';
        this._dbStore = 'documents';
        this._persistTimers = new Map();

        // visibilitychange ist zuverlässiger als beforeunload für async IndexedDB-Writes:
        // Browser dispatchen 'hidden' vor dem Entladen und geben laufenden Hintergrund-Tasks
        // mehr Zeit zum Abschluss. Feuert auch bei Tab-Wechsel (harmlos — extra Save).
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this.activeId) {
                this._persist(this.activeId);
            }
        });
        // beforeunload als letzter Fallback behalten (best-effort, kein Garant)
        window.addEventListener('beforeunload', () => {
            if (this.activeId) this._persist(this.activeId);
        });

        console.debug('[DocumentManager V1.0] Initialisiert');
    }

    get activeDocument() { return this.documents.get(this.activeId) || null; }

    // ═══ TAB-LEBENSZYKLUS ═══

    createDocument({ activate = true } = {}) {
        const doc = new CeraDocument();
        this.documents.set(doc.id, doc);
        this.tabOrder.push(doc.id);
        if (activate) this.switchTo(doc.id);
        this._renderTabs();
        this._persist(doc.id);
        return doc;
    }

    /**
     * Liefert das Zieldokument für eine neu zu öffnende Datei: der allererste
     * leere Start-Tab wird einmalig wiederverwendet, danach öffnet jede Datei
     * immer einen neuen Tab (AutoCAD-Konvention).
     */
    ensureTargetForNewFile() {
        const cur = this.activeDocument;
        const isEmptyStart = cur && !cur.fileLoaded && cur.contours.length === 0 && !cur.isDirty;
        if (isEmptyStart) return cur;
        return this.createDocument();
    }

    closeDocument(id) {
        const doc = this.documents.get(id);
        if (!doc) return;

        if (id === this.activeId) this._captureFromApp(doc);
        if (doc.isDirty) {
            const ok = confirm(`"${doc.label}" hat ungespeicherte Änderungen. Trotzdem schließen?`);
            if (!ok) return;
        }

        this.documents.delete(id);
        this.tabOrder = this.tabOrder.filter(x => x !== id);
        this._deletePersisted(id);

        if (this.activeId === id) {
            this.activeId = null;
            const next = this.tabOrder[this.tabOrder.length - 1];
            if (next) {
                this.switchTo(next);
                return; // switchTo() rendert die Tab-Leiste bereits
            }
            this.createDocument(); // nie 0 Tabs
            return;
        }
        this._renderTabs();
    }

    switchTo(id) {
        const target = this.documents.get(id);
        if (!target) return;

        const current = this.activeDocument;
        if (current && current !== target) {
            this._captureFromApp(current);
            this._persist(current.id);
        }

        this.activeId = id;
        this._applyToApp(target);
        this._renderTabs();
    }

    // ═══ STATE-TRANSFER (App ↔ Document) ═══

    _captureFromApp(doc) {
        const app = this.app;
        doc.currentStep = app.currentStep;
        doc.fileLoaded = app.fileLoaded;
        doc.dxfContent = app.dxfContent;
        doc.dxfResult = app.dxfResult;
        doc.deletedContourNames = app.deletedContourNames;
        doc.contours = app.contours;
        doc.intarsiaPosContours = app.intarsiaPosContours;
        doc.intarsiaNegContours = app.intarsiaNegContours;
        doc.cutOrder = app.cutOrder;
        doc.selectedLayers = app.selectedLayers;
        doc.bounds = app.bounds;
        doc.dxfFileName = app.dxfFileName;
        doc.outputFileName = app.outputFileName;
        doc.loadedFileName = app.loadedFileName;
        doc.currentProjectName = app.currentProjectName;
        doc.isDirty = app.isDirty;
        doc._dxfFileHandle = app._dxfFileHandle;
        doc.settings = app.settings;
        doc.undoManager = app.undoManager;
        doc.clipboardManager = app.clipboardManager;
        doc.layerManager = app.layerManager;
        doc.imageUnderlayManager = app.imageUnderlayManager;
        if (app.renderer) {
            doc.view = { scale: app.renderer.scale, offsetX: app.renderer.offsetX, offsetY: app.renderer.offsetY };
        }
        doc.label = doc.dxfFileName || doc.loadedFileName || 'Unbenannt';
    }

    _applyToApp(doc) {
        const app = this.app;
        app.currentStep = doc.currentStep;
        app.fileLoaded = doc.fileLoaded;
        app.dxfContent = doc.dxfContent;
        app.dxfResult = doc.dxfResult;
        app.deletedContourNames = doc.deletedContourNames;
        app.contours = doc.contours;
        app.intarsiaPosContours = doc.intarsiaPosContours;
        app.intarsiaNegContours = doc.intarsiaNegContours;
        app.cutOrder = doc.cutOrder;
        app.selectedLayers = doc.selectedLayers;
        app.bounds = doc.bounds;
        app.dxfFileName = doc.dxfFileName;
        app.outputFileName = doc.outputFileName;
        app.loadedFileName = doc.loadedFileName;
        app.currentProjectName = doc.currentProjectName;
        app.isDirty = doc.isDirty;
        app._dxfFileHandle = doc._dxfFileHandle;
        app.settings = doc.settings;

        // Undo/Redo, Layer, Clipboard, Image-Underlays an das Dokument re-binden
        app.undoManager = doc.undoManager;
        app.undoManager.onStateChange = (state) => {
            app.isDirty = true;
            doc.isDirty = true;
            app._updateUndoUI(state);
            this._scheduleAutoPersist();
        };
        app.clipboardManager = doc.clipboardManager;
        app.clipboardManager.app = app;
        app.clipboardManager.undoManager = app.undoManager;
        app.layerManager = doc.layerManager;
        app.layerManager.undoManager = app.undoManager;
        app.layerManager.onChange = () => app._updateLayerUI();
        app.imageUnderlayManager = doc.imageUnderlayManager;
        if (app.imageUnderlayManager) app.imageUnderlayManager.app = app;

        // Canvas-Inhalt + View-Transform umhängen (Canvas-Instanz bleibt global)
        app.renderer?.setContours(app.contours);
        if (app.renderer && doc.view) {
            app.renderer.scale = doc.view.scale;
            app.renderer.offsetX = doc.view.offsetX;
            app.renderer.offsetY = doc.view.offsetY;
        }
        app.snapManager?.setContours(app.contours);

        // Komplette UI-Neuzeichnung (kein Diffing nötig laut updateStepUI()-Implementierung)
        app.updateStepUI();
        app.onStepEnter(app.currentStep);
        app._updateLayerUI();
        app.updateContourPanel();
        app.updateCutOrderList?.();
        app.updateOrderStats?.();
        app.updateExportSummary?.();
        app._updateUndoUI(app.undoManager.getState());

        const fnEl = document.getElementById('current-filename');
        if (fnEl) fnEl.textContent = doc.dxfFileName ? `📄 ${doc.dxfFileName}` : 'Keine Datei geladen';

        app.renderer?.render();
    }

    // ═══ PERSISTENZ (IndexedDB 'ceracut-tabs') ═══

    _scheduleAutoPersist() {
        const id = this.activeId;
        if (!id) return;
        clearTimeout(this._persistTimers.get(id));
        this._persistTimers.set(id, setTimeout(() => this._persist(id), 1500));
    }

    _persist(id) {
        const doc = this.documents.get(id);
        if (!doc) return;
        if (id === this.activeId) this._captureFromApp(doc);

        this._openDB().then(db => {
            const tx = db.transaction(this._dbStore, 'readwrite');
            tx.objectStore(this._dbStore).put(doc.toJSON(), doc.id);
            tx.objectStore(this._dbStore).put({ tabOrder: this.tabOrder, activeId: this.activeId }, '__meta__');
            tx.oncomplete = () => db.close();
            tx.onerror = () => db.close();
        }).catch(err => console.warn('[DocumentManager V1.0] Persist fehlgeschlagen:', err));
    }

    _deletePersisted(id) {
        this._openDB().then(db => {
            const tx = db.transaction(this._dbStore, 'readwrite');
            tx.objectStore(this._dbStore).delete(id);
            tx.objectStore(this._dbStore).put({ tabOrder: this.tabOrder, activeId: this.activeId }, '__meta__');
            tx.oncomplete = () => db.close();
        }).catch(err => console.warn('[DocumentManager V1.0] Löschen fehlgeschlagen:', err));
    }

    async restoreAll() {
        try {
            const db = await this._openDB();
            const tx = db.transaction(this._dbStore, 'readonly');
            const store = tx.objectStore(this._dbStore);
            const keys = await this._promisify(store.getAllKeys());
            const values = await this._promisify(store.getAll());
            db.close();

            let meta = null;
            const docDataList = [];
            keys.forEach((key, i) => {
                if (key === '__meta__') { meta = values[i]; return; }
                if (values[i]) docDataList.push(values[i]);
            });

            if (docDataList.length === 0) {
                this.createDocument();
                return;
            }

            for (const data of docDataList) {
                const doc = CeraDocument.fromJSON(data);
                this.documents.set(doc.id, doc);
            }
            this.tabOrder = (meta?.tabOrder || docDataList.map(d => d.id)).filter(id => this.documents.has(id));
            for (const id of this.documents.keys()) {
                if (!this.tabOrder.includes(id)) this.tabOrder.push(id);
            }

            const activeId = (meta?.activeId && this.documents.has(meta.activeId)) ? meta.activeId : this.tabOrder[0];
            this.switchTo(activeId);

            for (const doc of this.documents.values()) {
                this._checkFileHandlePermission(doc);
            }
            console.log(`[DocumentManager V1.0] ${this.documents.size} Dokument(e) wiederhergestellt`);
        } catch (err) {
            console.warn('[DocumentManager V1.0] Restore fehlgeschlagen:', err);
            if (this.documents.size === 0) this.createDocument();
        }
    }

    /** Best-effort: FileSystemFileHandle-Permission prüfen, sonst Handle entfernen statt blockieren */
    async _checkFileHandlePermission(doc) {
        if (!doc._dxfFileHandle?.queryPermission) return;
        try {
            const perm = await doc._dxfFileHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                doc._dxfFileHandle = null;
                if (doc.id === this.activeId) this.app._dxfFileHandle = null;
                this.app.showToast?.(`"${doc.label}": Datei-Zugriff verloren — "Speichern unter" verwenden`, 'warning');
            }
        } catch {
            doc._dxfFileHandle = null;
            if (doc.id === this.activeId) this.app._dxfFileHandle = null;
        }
    }

    // ═══ TAB-LEISTE UI ═══

    _renderTabs() {
        const bar = document.getElementById('file-tabs');
        if (!bar) return;
        bar.innerHTML = '';

        for (const id of this.tabOrder) {
            const doc = this.documents.get(id);
            if (!doc) continue;
            const isActive = id === this.activeId;

            // Für das aktive Dokument live von app.* lesen statt aus dem Document-
            // Snapshot — der wird erst bei switchTo()/_persist() aktualisiert und
            // wäre direkt nach einem Datei-Load sonst veraltet ("Unbenannt").
            const labelText = isActive
                ? (this.app.dxfFileName || this.app.loadedFileName || 'Unbenannt')
                : (doc.label || 'Unbenannt');
            const isDirty = isActive ? this.app.isDirty : doc.isDirty;

            const tab = document.createElement('div');
            tab.className = 'file-tab' + (isActive ? ' active' : '');
            tab.dataset.docId = id;

            const label = document.createElement('span');
            label.className = 'file-tab-label';
            label.textContent = (isDirty ? '● ' : '') + labelText;
            tab.appendChild(label);

            const closeBtn = document.createElement('span');
            closeBtn.className = 'close-btn';
            closeBtn.textContent = '×';
            closeBtn.title = 'Schließen';
            closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.closeDocument(id); });
            tab.appendChild(closeBtn);

            tab.addEventListener('click', () => { if (id !== this.activeId) this.switchTo(id); });
            bar.appendChild(tab);
        }

        const addBtn = document.createElement('div');
        addBtn.className = 'file-tab-add';
        addBtn.id = 'file-tab-add';
        addBtn.title = 'Neue Datei öffnen';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => this.app.openFilePicker?.());
        bar.appendChild(addBtn);
    }

    // ═══ INDEXEDDB-HELFER ═══

    _openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this._dbName, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(this._dbStore)) {
                    db.createObjectStore(this._dbStore);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    _promisify(idbRequest) {
        return new Promise((resolve, reject) => {
            idbRequest.onsuccess = () => resolve(idbRequest.result);
            idbRequest.onerror = () => reject(idbRequest.error);
        });
    }
}

if (typeof window !== 'undefined') {
    window.CeraDocument = CeraDocument;
    window.DocumentManager = DocumentManager;
}
