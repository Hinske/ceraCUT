/**
 * CeraCUT V6.50 - Main Application
 * V6.71: Fix — applyKerfWidth wirkt auch auf offene Konturen (Schnittfuge aendert sich sichtbar).
 * V6.70: Feat — Lead-Menue Einfach-Ansicht: Groesse Klein/Mittel/Gross, Klartext-Zusammenfassung, Begriffe (Form/Laenge/Ueberschnitt), Feineinstellungen unter Experte.
 * V6.69: Feat — Ribbon: eigener Ausfahr-Typ und -Radius (lead-out-type/-radius, leer = wie Anfahrt).
 * V6.68: Feat — Ribbon: eigener Ausfahrwinkel (lead-out-angle), Schalter Ueberschnitt an Ecken (overcut-at-corners); Ausfahrlaenge/Winkel nicht mehr unter Erweitert.
 * V6.67: Refactor — Setup-Tab entfaellt: Referenz + Nullpunkt (Checkbox "Auto beim Import") wandern in den Tab Datei, Technologie (Material/Dicke/Druck) als ③ Technologie in Bearbeitung
 * V6.66: Fix — Auto-Setup erkennt Fliesenbogen auch OHNE Layer Fliese (mehrere aeussere Rechtecke mit Schnitten) und setzt dort keine Auto-Referenz (eine Fliese ging verloren)
 * V6.65: Fix — Auto-Setup beim Import fasst Fliesen (Layer Fliese) und vorhandene Referenzen nicht mehr an (setzte sonst EINE Fliese als Referenz, eine Fliese fehlte in Erkennung/Schnitt); nur Nullpunkt
 * V6.64: Feat — AP4 Waricam-Workflow: Auto-Setup beim Import (Referenz + Nullpunkt), danach direkt in Bearbeitung; Bearbeitung-Tab in Workflow-Reihenfolge ① Loch/Scheibe ② Leads ③ Schnittfuge
 * V6.63: Feat — AP2 Bogenwinkel (Feld ⌒°, Aussen/Innen) und Ecken-Lead (Typ/Winkel/ab Eckwinkel) im Lead-Ribbon, in Profilen und Undo-Snapshots
 * V6.61: Feat — Schnittfugenband An/Aus (btn-kerf-band, renderer.showKerfBand, localStorage ceracut_kerf_band)
 * V6.62: Feat — Jede Fliese (geschlossene Kontur auf Layer Fliese) ist automatisch Referenz: nicht geschnitten, nicht in Schnittreihenfolge, Topologie transparent; Plattengroesse je Fliese im Export (pipeline V3.12, sinumerik-pp V2.9)
 * V6.60: Feat — Schnittreihenfolge manuell: Schnitte anklicken, Auswahl Anfang/↑/↓/Ende/Position N (je Fliese, Undo); alte Schnittliste war seit V5.7 nicht mehr im HTML
 * V6.59: Feat — Fliesen-Reihenfolge im Tab Reihenfolge: Presets (Zeile/Spalte/Schlangenlinie/Nachbar, Startecke, umkehren), Anklick-Modus, Drag&Drop, Sperre bei manueller Reihenfolge; Button "Fliesen erkennen" entfällt (Erkennung automatisch)
 * V6.58: Fix — Fliesen nach Auto-Referenz neu zuordnen, Nullpunkt-Gedaechtnis, Rechteck-Erkennung tolerant (verkettete Linien)
 * V6.73: Fix — Ribbon-Tooltips per JS (CSS-Tooltip wurde im Ribbon abgeschnitten, z.B. Analyze)
 * V6.72: Feat — Tooltips auch fuer Flyout-Eintraege (data-fly-tool, Position rechts)
 * V6.57: Feat — Konturgeometrie nur im Tab CAD änderbar (isGeometryEditAllowed: Tools, Grips, Löschen); Schnittliste hält Fliesengruppen
 * V6.56: Fix — Fliesen-Zuordnung bleibt nach Konturaenderungen aktuell (_ensureTilesFresh, Signatur), vorher veraltete Indizes
 * V6.55: Fix — Schnittliste fliesenweise gruppiert (regroupCutOrderByTile), Nummern/Fahrwege je Fliese ab Fliesen-Nullpunkt
 * V6.54: Fix — Sortierung pro Fliese (eigener Nullpunkt, eigener Rand zuletzt), Fliesen-Badge in der Schnittliste
 * V6.53: Feat — Fliesen-Liste (Bearbeitung-Tab): Nullpunkt je Fliese, Reihenfolge, Kontrolldialog vor Export, Dateiname mit Massen
 * V6.50: Feat — Konturen vereinfachen (simplify.js): Toleranz-Slider mit Live-Vorschau, Ecken/Startpunkt erhalten, Schutz vor Nachbar-Kollision, Undo
 * V6.49: Feat — Strahlbreiten-Check (feasibility.js): Pruefen/Halo, Auswahl nach Kriterien (schmal/nah/Breite/Flaeche), Typ aus Schachtelung
 * V6.48: Feat — Richtungspfeile-Umschalter (Auto/An/Aus) im Bearbeitung-Tab; Konturauswahl-Fix siehe canvas-renderer V3.49
 * V6.47: Feat — Setup/Technologie: Duese, Druck, Optimierung eingeklappt (Toggle ⚙); Export: Maschine-Gruppe ausgeblendet
 * V6.46: Feat — Bearbeitung-Tab: erweiterte Lead-Parameter (Radius, Winkel, Ausfahrt, Anschluss, Dynamisch, Innen-Lead, Profil speichern/loeschen) standardmaessig eingeklappt, Toggle '⚙ Erweitert' (merkt Zustand)
 * V6.45: Feat — Sortiermethode 'Mosaik-Maeander' (_planMosaicMeander/applyMosaicMeander): durchgehende Innenlinien je Richtung zu EINER Kontur, Halbkreis-Wendungen 3 mm ausserhalb der Fliese (Opferplatte), Rand zuletzt; Helfer _mosaicDetectBorder/_mosaicNearest
 * V6.44: Feat — Sortiermethode 'Mosaik' (sortMosaic): Fliesenrand zuletzt, Innenkonturen Nearest-Neighbor ab Nullpunkt (Standard im Dropdown)
 * V6.43: Feat — CNC-Export speichert direkt auf dem Server (POST /api/cnc/save → Share Wasserstrahl/CNC), Rueckfrage bei vorhandener Datei; Fallback Workspace/Download
 * V6.42: Fix — Offene Linien gelten immer als Slit (Reihenfolge fand 'keine schneidbaren Konturen'); Auto-Referenz verkettet Einzellinien zu geschlossener Fliese
 * V6.41: Feat — Druckdialog: Farbe / Schwarz-Weiss waehlbar (Wahl wird gemerkt)
 * V6.40: Feat — Druck/Bereichsdruck uebernimmt Layerfarben (helle Farben werden abgedunkelt)
 * V6.39: Feat — Bereichsdruck: startPrintSelection() (Rahmen aufziehen, Strg+Shift+P / Button), printCanvas(region) mit Clip
 * V6.38: Feat — Object Snap Tracking (F11), Polar Tracking (F10), Rasterfang (F9), Shift = Ortho temporaer umkehren; zentrale SnapManager.resolve()
 * Last Modified: 2026-11-06
 * Build: 20261106-tileref
 * V6.36: Fix — Code-Review 2026-11-04 (tasks/code-review-2026-11-04.md)
 * V6.35: Fix — Intarsien-Fugen-Offset korrigiert: _applyIntarsiaOffset() nutzte intern
 *        getKerfOffsetPolyline(), das für hole-Konturen (CCW) den Offset nach innen berechnete.
 *        NEG-Aussparung wurde kleiner statt größer — bei gap ≠ 2×kerf passte der Einleger nicht.
 *        Jetzt: Geometry.offsetPolygon() direkt mit Flächencheck zur Richtungsvalidierung.
 *        Hatch-Konturen werden in regenerateIntarsiaContours()/_buildIntarsiaExportContours()
 *        korrekt gefiltert. Toter Code _createIntarsiaContours() (V5.2) entfernt.
 * V6.34: Fix — rebuildCutOrder() baute immer natürliche Reihenfolge (Scheibe zuerst) und
 *        wurde bei Delete/Duplikat aufgerufen — Inside-Out-Sortierung ging verloren.
 *        Jetzt: _applyInsideOutSort() als eigene Methode extrahiert; rebuildCutOrder() und
 *        autoSortContours('inside-out') nutzen sie gemeinsam. Standardreihenfolge immer
 *        Inside-Out (Löcher vor ihrer Scheibe).
 * V6.33: Fix — rebuildCutOrder() beim Betreten von Schritt 5 setzte cutOrder auf natürliche
 *        Import-Reihenfolge zurück und verwarf jede manuelle Inside-Out-Sortierung.
 *        Schritt-5-Initialisierung ruft rebuildCutOrder() jetzt nur noch wenn cutOrder leer ist.
 * V6.30: Fix — 3 Robustheitsfixes aus systematischer Code-Inspektion (Agent-gestützt):
 *        (1) Startpunkt-Grip-Edit: _notifyStateChange() fehlte nach undoStack.push() —
 *        Undo/Redo-Buttons blieben nach Startpunkt-Verschiebung in veraltetem State.
 *        (2) invalidateGrips() fehlte in 5 isSelected-Pfaden (Cut-Order-Click,
 *        btn-select-all/none, Konturen-Panel-Click, ESC, STRG+A) — Grip-Punkte wurden
 *        nicht angezeigt, obwohl Kontur selektiert war.
 *        (3) isSetupComplete() erforderte zwingend eine Referenzkontur — Einzelteil-
 *        Workflow ohne Plattenrahmen war komplett gesperrt; Origin-Setzung allein reicht.
 * V6.29: Fix — 3 Robustheitsfixes: (1) autoSortContours() speicherte Array-Indizes in
 *        Undo-Commands — nach Delete/Insert verschoben diese auf falsche Konturen und
 *        korrumpierten die Geometrie beim Redo. Jetzt Objekt-Referenzen (_lastReversedContours).
 *        (2) saveDXF()/saveDXFAs(): _isSaving-Mutex verhindert überlappende FSAPI-
 *        createWritable()-Aufrufe auf demselben FileHandle (Doppelklick/STRG+S-Spam → 0-Byte-
 *        File-Korruption möglich). (3) _downloadIntarsiaFile(): per-Dateiname-Set (_savingFiles)
 *        verhindert gleichzeitige Schreibzugriffe auf dieselbe CNC-Ausgabedatei.
 * V6.28: Fix — Zombie-Event-Listener in _showShortcutDialog() und _showPreviewModal():
 *        escHandler wurde nur bei ESC-Schließung entfernt; Schließen per Button/Hintergrund
 *        ließ ihn als toten Listener am document hängen. Akkumulierte bei jedem Öffnen.
 * V6.27: Fix — getContourPerimeter() zählte das Schließungssegment (letzter→erster Punkt)
 *        bei geschlossenen Konturen nicht. Folge: Auto-Microjoint-Positionen (Gleichverteilung
 *        per Perimeteranteil) lagen leicht verschoben, der letzte Microjoint fehlte im
 *        letzten Segment. Für isClosed-Konturen wird jetzt pts[n-1]→pts[0] addiert.
 * V6.26: Feat — Toolpath-Verifikation zeigte nur die Anzahl der Warnungen/Fehler
 *        ("11 Warnungen") ohne jeden Inhalt. _showSimVerifyModal() listet jetzt die
 *        konkreten Meldungstexte aus ToolpathSimulator.verify() in einem Modal auf
 *        (Klick auf die Ergebnis-Zeile im Simulation-Ribbon).
 * V6.25: Fix — deletedContourNames-Set verhindert, dass geloeschte Konturen bei einem
 *        Layer-Sichtbarkeits-Toggle aus dxfResult.contours wieder auftauchen
 *        (applyLayerSelection() baute die Liste sonst immer komplett neu auf).
 *        Zusaetzlich: _runPipelineKeepUndo() aktualisiert this.contours jetzt IN-PLACE
 *        (length=0+push) statt per Neuzuweisung — sonst haengen Undo-Stack-Commands
 *        (z.B. DeleteContoursCommand), die das alte Array referenzieren, nach einem
 *        Toggle aus und STRG+Z wird zum No-Op.
 * V6.24: Refactor — _applyLeadToContour() übernimmt jetzt optional cornerLeadType/
 *        cornerLeadAngle/cornerDegradeThreshold (neuer Corner-Lead-Slot, cam-contour
 *        V5.19) — bisher noch ohne UI-Felder, Pass-Through analog zu den anderen
 *        optionalen Eigenschaften vorbereitet.
 * V6.23: Feat — Multi-Kontur-Kollisionsprüfung (CamContour.checkAllCollisions) lief
 *        bisher nur über den manuellen "Multi-Collision"-Button; autoPlaceStartPoint()
 *        kennt nur Clearance zu Nachbarn fürs Scoring, prüft aber nicht ob der finale
 *        Lead/Alt-Lead tatsächlich in eine Nachbarkontur läuft. Neue
 *        _runMultiContourCollisionCheck() läuft jetzt automatisch nach jedem finalen
 *        Lead-Apply (_commitLeadChanges(), Wizard-Step-4-Eintritt) — Dog-Leg/Rotation/
 *        Shortening gegen Nachbarn greifen jetzt ohne manuellen Button-Klick.
 * V6.22: Fix — toggleReference()/autoDetectReference() triggern jetzt
 *        _recalcTopologyAfterReferenceChange() (ruft CeraCutPipeline._analyzeTopology()
 *        erneut auf), statt nur isReference zu setzen. Vorher blieb die Inselerkennung
 *        (disc/hole) nach manuellem Referenz-Wechsel auf dem alten Stand.
 * V6.21: Feat — lastCreatedContour-Tracking in addDrawnEntities() für ModificationTool
 *        "L" (Last) Selektionsoption (CAD-Improvements Abschnitt 7).
 * V6.20: Feat — Login/User-Management: currentUser-Feld (aus window.CeraCutCurrentUser,
 *        von server.js synchron in index.html injiziert), _initUserBadge() zeigt
 *        eingeloggten User in der Titelleiste + bindet Logout-Button (POST /api/auth/logout
 *        → Redirect /login.html), "Benutzer verwalten"-Link nur bei Rolle admin sichtbar.
 * V6.19: Fix — saveDXF()/saveDXFAs() schrieben result.content als rohen String in den
 *        FileSystemWritableFileStream (File System Access API). Der Browser kodiert das
 *        als UTF-8, der DXF-Header deklariert aber $DWGCODEPAGE=ANSI_1252 — Umlaute in
 *        Layer-Namen wurden dadurch beschädigt, AutoCAD wies den Import zurück. Beide
 *        Pfade nutzen jetzt dxfWriter._encodeAnsi1252() wie der Blob-Download-Fallback.
 * V6.18: Fix — CAM-Funktionen (Kontextmenü-Properties, Startpunkt/Reverse/Microjoint) erst
 *        nach abgeschlossenem Setup (Referenz + Nullpunkt) freigeschaltet: neue Methode
 *        isSetupComplete(), settings.originSet-Flag, von currentStep entkoppelt
 * V6.17: Multi-Dokument-Tabs — DocumentManager integriert (openFilePicker() extrahiert,
 *        loadDXFContent() öffnet jede neue Datei in einem eigenen Tab, "Neu" erzeugt
 *        einen neuen Tab statt In-Place-Reset, Tabs werden via IndexedDB persistiert)
 * V6.16: Fix — XSS-Lücken geschlossen (sanitizeHTML in Validation-Modal, Layer-Manager-Tabelle, Export-Vorschau-Warnungen)
 * V6.15: Fix — Ctrl+Z/Y funktioniert jetzt auch wenn cmd-input Focus hat (Keyboard-Filter erweitert)
 * V6.15: Fix — Layer-Dropdown zeigt alle Layer (auch leere manuell erstellte)
 * V6.15: Fix — Undo-System: LayerManager.undoManager Verknüpfung für undo-fähige Layer-Ops
 * V6.14: Fix — Neu erstellte Layer werden als aktiver Layer gesetzt und im Dropdown angezeigt
 * V6.11: Cycle-Selection — wiederholter Klick auf gleiche Stelle cycled durch überlappende Konturen
 * V6.10: Quick Wins — Snap-Modi-Statusbar, Locked-Layer Guard
 * V6.9: Auto-Apply Rechtsklick + fitToContent nur beim ersten Zeichnen (kein View-Sprung)
 * V6.8: Console Cleanup — Init-Logs auf console.debug, sauberer Startup-Output
 * V6.7: Undo-Fix — addDrawnEntities erstellt pro Kontur einen eigenen Undo-Step
 * V6.5: Hatch-Fix — _drawHatch ctx.fill() statt ctx.clip(), Toast/Panel-Refresh
 * V6.4: Validation Engine — Pre-Export-Prüfung mit Modal (Gap, Ecken, Waisen, Kollisionen)
 * V6.3: interiorPoint() für robuste Topologie
 * V6.2: Layer-Visibility → Pipeline-Rebuild (unsichtbare Layer aus Topology ausgeschlossen)
 * Wizard Controller + Konturen-Panel
 * V3.8: Layer-System, Layer-Manager Dialog, DXF-Writer R12
 * V3.7: Tier 4 Aufteilen — CL2D (Halbieren), CLND (N-Teilen), CLDCL (Divided Calculation)
 *       Ribbon-Gruppe "Aufteilen" im Start-Tab
 * V3.6: Tier 3 Phase A — GeometryOps, Explode (X), Join (J), Break (B)
 *       LineTool S/C=Close, Rechtsklick=Bestätigen, Auto-Apply Fixes
 * V3.5: Tier 2 Modification Tools (Move, Copy, Rotate, Mirror, Scale, Erase)
 *       Always-Active ToolManager, Window-Selection, Noun-Verb + Verb-Noun
 * V3.4: CAD Drawing Tools (Line, Circle, Rectangle, Arc, Polyline)
 * V3.3: Sinumerik 840D Postprozessor, Export + Vorschau-Modal
 * V3.2: Vollständige Undo-Abdeckung aller Benutzeraktionen
 * V3.1: Undo/Redo (Command Pattern), Clipboard (Copy/Cut/Paste)
 * V3.14: CAM-Tab Redesign — Außen/Innen-Lead, Material-Gruppe, Piercing-Typen, Speed-Info
 * V4.5: IGEMS 4-Slot Lead-System — Alternativ-Lead Fallback bei Kollision
 * Last Modified: 2026-06-25 MEZ
 * Build: 20260625-snapcenterfix
 */

// XSS Protection
function sanitizeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

class CeraCutApp {
    constructor() {
        // State
        this.currentStep = 1;
        this.totalSteps = 6; // Jetzt 6 Steps!
        this.fileLoaded = false;
        this.dxfContent = null;
        this.dxfResult = null;
        this.deletedContourNames = new Set(); // V6.25: ueberlebt Layer-Sichtbarkeits-Reruns
        this.contours = [];
        this.intarsiaPosContours = null;  // CamContour[] | null — Intarsien V2.0
        this.intarsiaNegContours = null;  // CamContour[] | null — Intarsien V2.0
        this.cutOrder = []; // Schnitt-Reihenfolge (Indizes)
        this.selectedLayers = [];
        this.bounds = null;
        
        // Settings
        this.settings = {
            chainingTolerance: 0.1,
            kerfWidth: 0.8,
            quality: 2,
            origin: { x: 0, y: 0 },
            originSet: false, // V6.21: true erst nach explizitem Setzen — gate fuer CAM-Freischaltung
            originPreset: 'bottom-left',
            microjointWidth: 0.5,
            microjointCount: 2,
            // V3.14: Material
            materialThickness: 10.0,
            // kerfWidth bereits oben gesetzt (0.8mm, Düsen-Ø)
            // V3.14: Innen-Lead "= Außen" Flag
            internalLeadLikeExternal: true,
            // V4.5: Alternativ-Lead (intern automatisch)
            altLeadEnabled: true,
            // V5.0: CeraJet Technologie
            technology: {
                materialId: 1,          // Stahl
                nozzleId: 3,            // 0.25W / 0.80A (Standard)
                pressure: 2900,         // bar
                optMode: 'minKosten',   // Optimierungsmodus
                abrasiveOverride: null  // null = Auto aus Tabelle
            },
            // V5.2: Intarsien-Modus
            intarsiaMode: false,
            intarsiaGap: 1.6,           // Fugenbreite in mm
            intarsiaPreview: null,      // 'pos' | 'neg' | 'both' | null
            // V5.3 Phase B: Flächenklassen (IGEMS-Standard)
            areaClasses: null           // null = nicht aktiv, Array = [{maxArea, enabled, ...}]
        };
        
        // Modi
        this.measureMode = false;
        this.measureStart = null;
        this.measurements = [];
        this.currentSnapPoint = null;
        this.currentTrackPoint = null;  // V6.78: Ergebnis von Object-Snap-Tracking / Polar / Ortho (ohne Objektfang)
        
        this.startpointMode = false; // NEU: Startpunkt-Modus

        // V6.11: Cycle-Selection State
        this._cyclePoint = null;    // Letzter Klickpunkt
        this._cycleContours = [];   // Alle Konturen an diesem Punkt
        this._cycleIndex = 0;       // Aktueller Index im Cycle

        // Kontext-Menü
        this.contextMenuContour = null;
        this.contextMenuPoint = null;
        this.canvasContextMenuPoint = null; // V5.2: Rechtsklick-Position für Canvas-Menü
        this.lastToolShortcut = null;       // V5.2: Letzte Funktion für "Wiederholen"
        
        // Components
        this.renderer = null;
        
        // Undo/Redo & Clipboard (V1.0)
        this.undoManager = new UndoManager({
            maxHistory: 50,
            onStateChange: (state) => { this.isDirty = true; this._updateUndoUI(state); }
        });
        this.clipboardManager = new ClipboardManager({
            undoManager: this.undoManager,
            app: this
        });
        
        // V3.5: ToolManager (Zeichnen + Modifikation)
        this.commandLine = null;
        this.snapManager = null;
        this.drawingTools = null;  // Alias für toolManager (Backward-Kompatibilität)
        this.toolManager = null;
        
        // V5.7: Properties Panel (Kontextmenu-Modus)
        this.propertiesPanel = new PropertiesPanel({ app: this });

        // V3.8: Layer-Management + DXF-Writer
        this.layerManager = new LayerManager();
        this.layerManager.undoManager = this.undoManager;
        this.layerManager.onChange = () => this._updateLayerUI();
        this.dxfWriter = new DXFWriter();
        this.loadedFileName = '';  // Geladener Dateiname (für "Speichern")
        this.currentProjectName = ''; // Projektname (für suggestedName)
        this.isDirty = false;      // Ungespeicherte Änderungen
        this._lastDirHandle = null; // Letzter Ordner (für "Speichern unter")
        this._dxfServerName = null; // V6.93: Dateiname im Server-DXF-Ordner
        this._dxfFileHandle = null; // FileHandle für "Speichern" direkt (FSAPI)
        this._isSaving = false;     // Mutex gegen gleichzeitige FSAPI-Schreibvorgänge

        // V5.6: ProjectManager (Workspace-Verwaltung)
        if (typeof ProjectManager !== 'undefined') {
            this.projectManager = new ProjectManager(this);
        }

        // V5.9: DXF Browser (Server-Netzlaufwerk)
        if (typeof DXFBrowser !== 'undefined') {
            this.dxfBrowser = new DXFBrowser(this);
        }

        // V3.11: Image Underlay Manager
        this.imageUnderlayManager = new ImageUnderlayManager(this);

        // V6.20: Multi-Dokument-Tabs (mehrere DXF gleichzeitig offen, IndexedDB-Persistenz)
        this.documentManager = (typeof DocumentManager !== 'undefined') ? new DocumentManager(this) : null;

        // V6.32: Login/User-Management — von server.js synchron in index.html injiziert
        this.currentUser = window.CeraCutCurrentUser
            ? { username: window.CeraCutCurrentUser, role: window.CeraCutCurrentRole }
            : null;

        // Für ModificationTool "L" (Last) — zuletzt erzeugte Kontur
        this.lastCreatedContour = null;

        // V3.1: Verifikation dass Undo-Integration geladen ist
        this.init();
    }

    /** V6.32: Zeigt eingeloggten User in der Titelleiste, bindet Logout-Button. */
    _initUserBadge() {
        const badge = document.getElementById('current-user-badge');
        const logoutBtn = document.getElementById('btn-logout');
        const adminLink = document.getElementById('admin-users-link');

        if (badge && this.currentUser) {
            badge.textContent = `👤 ${this.currentUser.username}`;
        }
        if (adminLink && this.currentUser?.role === 'admin') {
            adminLink.style.display = 'inline';
        }
        logoutBtn?.addEventListener('click', async () => {
            try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
            } catch (err) {
                console.warn('[App V6.32] Logout-Request fehlgeschlagen:', err);
            }
            window.location.href = '/login.html';
        });
    }

    init() {
        this._initUserBadge();  // V6.32: Titelleiste — window.CeraCutCurrentUser ist bereits synchron vom Server gesetzt
        this.initRenderer();
        this.initDrawingTools();  // V3.4
        this.bindNavigationEvents();
        this.bindFileEvents();
        this.bindOriginEvents();
        this.bindReferenceEvents();
        this.bindCuttingEvents();
        this.bindExportEvents();
        this.bindCanvasEvents();
        this.bindMeasureEvents();
        this.bindStartpointEvents();
        this.bindContextMenuEvents();
        this.bindKeyboardEvents();
        this.bindContourPanelEvents();
        this.bindLeadLiveUpdates();
        this._initLeadProfiles();   // V6.0: Lead-Profile
        this.bindMicrojointEvents();
        this.bindOrderEvents();
        this.bindTolerancePresets();  // Quick-Fix #5
        this.bindDrawingEvents();    // V3.4
        this._updateSnapModesDisplay();  // V6.10: Snap-Modi-Statusbar

        // V6.20: Tabs aus IndexedDB wiederherstellen (ruft intern updateStepUI()/onStepEnter()
        // für das aktive Dokument auf) — ohne DocumentManager Fallback auf einfaches updateStepUI()
        if (this.documentManager) {
            this.documentManager.restoreAll().catch(err => {
                console.warn('[App V6.20] Dokument-Restore fehlgeschlagen:', err);
                this.updateStepUI();
            });
        } else {
            this.updateStepUI();
        }

        // V5.6: Workspace wiederherstellen (async, non-blocking)
        if (this.projectManager) {
            this.projectManager.restoreWorkspace().catch(err => {
                console.warn('[App V5.6] Workspace-Restore fehlgeschlagen:', err);
            });
        }
    }
    
    // ════════════════════════════════════════════════════════════════
    // QUICK-FIX #4: LOADING SPINNER
    // ════════════════════════════════════════════════════════════════
    
    showParserSpinner(show, subtext = 'Bitte warten') {
        const spinner = document.getElementById('parser-spinner');
        if (spinner) {
            spinner.style.display = show ? 'flex' : 'none';
            if (show) {
                const subtextEl = document.getElementById('spinner-subtext');
                if (subtextEl) subtextEl.textContent = subtext;
            }
        }
    }
    
    // ════════════════════════════════════════════════════════════════
    // QUICK-FIX #5: TOLERANZ-PRESETS
    // ════════════════════════════════════════════════════════════════
    
    bindTolerancePresets() {
        document.querySelectorAll('.tolerance-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const tolerance = parseFloat(btn.dataset.tolerance);
                document.getElementById('chaining-tolerance').value = tolerance;
                this.settings.chainingTolerance = tolerance;
                
                // UI Update
                document.querySelectorAll('.tolerance-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.showToast(`Toleranz: ${tolerance}mm`, 'info');
            });
        });
        
        // Sync Input mit Presets
        document.getElementById('chaining-tolerance')?.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            document.querySelectorAll('.tolerance-preset').forEach(btn => {
                btn.classList.toggle('active', parseFloat(btn.dataset.tolerance) === value);
            });
        });
    }
    
    // ════════════════════════════════════════════════════════════════
    // RENDERER
    // ════════════════════════════════════════════════════════════════
    
    initRenderer() {
        if (typeof CanvasRenderer === 'undefined') {
            console.error('CanvasRenderer not loaded!');
            return;
        }
        
        this.renderer = new CanvasRenderer('canvas');
        this.renderer.app = this;
        
        // Mouse move callback
        this.renderer.onMouseMove = (worldX, worldY, snapPoint, screenX, screenY) => {
            document.getElementById('coord-x').textContent = worldX.toFixed(3);
            document.getElementById('coord-y').textContent = worldY.toFixed(3);
            
            // V3.5: Erweitertes Snap-System — immer aktiv (AutoCAD Running-OSNAP)
            let activeSnap = snapPoint;
            if (this.snapManager) {
                // Konturen immer synchron halten (nach Import, Zeichnen, Undo etc.)
                // V6.31: auch Längenänderung prüfen (gleiche Referenz, neues Element)
                if ((this.snapManager._contours !== this.contours ||
                     this.snapManager._contours?.length !== this.contours?.length) &&
                    this.contours?.length) {
                    this.snapManager.setContours(this.contours);
                }
                // V6.78: Zentrale Aufloesung — Objektfang > Object-Snap-Tracking > Polar/Ortho
                const toolActive = !!(this.toolManager?.isToolActive() || this.measureMode);
                let basePoint = null;
                if (this.toolManager?.isToolActive()) basePoint = this.toolManager.activeTool?.getLastPoint?.() || null;
                else if (this.measureMode && this.measureStart) basePoint = this.measureStart;
                if (!toolActive) this.snapManager.clearTracking();
                const res = this.snapManager.resolve(worldX, worldY, this.renderer.scale, basePoint, true, toolActive);
                if (res.snap) activeSnap = { point: res.snap.point, type: res.snap.typeDef.name };
                const tk = res.trackState?.kind;
                this.currentTrackPoint = (!res.snap && (tk === 'otrack' || tk === 'polar' || tk === 'otrack-int' || tk === 'ortho')) ? res.point : null;
                this._effectiveCursor = res.point;
            }
            
            const snapIndicator = document.getElementById('snap-indicator');
            const prevSnap = this.currentSnapPoint;
            if (activeSnap) {
                this.currentSnapPoint = activeSnap.point;
                snapIndicator.style.display = 'inline';
                snapIndicator.textContent = `● SNAP (${activeSnap.type})`;
            } else {
                this.currentSnapPoint = null;
                snapIndicator.style.display = 'none';
            }
            
            // Snap aktiv → nativen Cursor verstecken, Crosshair wird am Snap-Punkt gezeichnet
            const tkKind = this.snapManager?.trackState?.kind;
            const hasSnap = !!this.snapManager?.currentSnap || tkKind === 'otrack' || tkKind === 'polar' || tkKind === 'otrack-int';
            if (this.toolManager?.isToolActive() || this.measureMode) {
                this.renderer.canvas.style.cursor = hasSnap ? 'none' : 'crosshair';
            }
            
            // Canvas bei Snap-Wechsel neu rendern (Crosshair + Indikator)
            // V1.2-fix: Auch bei Positionswechsel rendern + immer wenn Snap aktiv
            const trackSig = this.snapManager?.trackState ? (this.snapManager.trackState.kind + ':' + this.snapManager.trackState.point.x + ',' + this.snapManager.trackState.point.y) : '';
            const trackChanged = trackSig !== this._prevTrackSig;
            this._prevTrackSig = trackSig;
            const snapChanged = trackChanged || (!!prevSnap !== !!this.currentSnapPoint) ||
                (prevSnap && this.currentSnapPoint && (prevSnap.x !== this.currentSnapPoint.x || prevSnap.y !== this.currentSnapPoint.y));
            if (snapChanged) {
                this.renderer?.render();
            }
            
            // V3.5: Tool Mouse-Move (Zeichnen + Modifikation)
            if (this.toolManager?.isToolActive()) {
                this.toolManager.handleMouseMove({ x: worldX, y: worldY });
            }
            
            // Messwerkzeug Live-Update
            if (this.measureMode && this.measureStart) {
                const endPoint = this.currentSnapPoint || this.currentTrackPoint || { x: worldX, y: worldY };
                this.updateMeasureInfo(this.measureStart, endPoint);
            }

            // V2.3: Dynamic Input HUD — Koordinaten am Cursor
            if (typeof DynamicInput !== 'undefined' && screenX != null) {
                const basePoint = this.toolManager?.activeTool?.getLastPoint?.() || null;
                const eff = this._effectiveCursor || { x: worldX, y: worldY };   // V6.78: aufgeloester Punkt (Snap/Tracking/Ortho)
                DynamicInput.update(screenX, screenY, eff.x, eff.y, basePoint);
            }
        };
        
        // Canvas click callback (Klick auf leere Fläche)
        this.renderer.onClick = (worldPoint) => {
            if (this.cutSeqMode) return;   // V6.60: Leerklick beendet den Anklick-Modus nicht und löscht keine Auswahl
            // Messmodus hat höchste Priorität
            if (this.measureMode) {
                this.handleMeasureClick(worldPoint);
                return;
            }
            // V3.5: Aktives Tool hat Priorität (Zeichnen + Modifikation)
            if (this.toolManager?.isToolActive()) {
                this.toolManager.handleClick(worldPoint);
                return;
            }
            if (this.startpointMode) {
                const contour = this.renderer.findContourAtPoint(worldPoint.x, worldPoint.y);
                if (contour && (contour.isClosed || contour.cuttingMode === 'slit') && !contour.isReference) {
                    this.setStartpointOnContour(contour, worldPoint);
                }
                return;
            }
            if (this.tileSeqMode) { this._handleTileSeqClick(worldPoint); return; }   // V6.59
            if (this.tilePickIdx != null) {   // V6.95: Nullpunkt einer Fliese setzen
                this._finishTilePick(this.currentSnapPoint || worldPoint);
                return;
            }
            if (this.currentStep === 3) {
                const point = this.currentSnapPoint || worldPoint;
                this.setOriginFromPoint(point);
                this.currentStep = this._stepBeforeOrigin || 1; // Reset nach Setzen (vorherigen Schritt wiederherstellen)
                document.getElementById('btn-set-origin-from-snap')?.classList.remove('active');
                document.getElementById('ct-origin')?.classList.remove('active');
                this.showToast(`Nullpunkt: X=${point.x.toFixed(3)}, Y=${point.y.toFixed(3)}`, 'success');
                console.log('[Origin V5.0] Nullpunkt gesetzt:', point.x.toFixed(3), point.y.toFixed(3));
                return;
            }
            // V3.5: Klick auf leere Fläche → Selektion aufheben (wenn kein Tool aktiv)
            this._cyclePoint = null; // V6.11: Cycle-Reset
            this.contours.forEach(c => { c.isSelected = false; });
            this.renderer?.invalidateGrips?.();  // V3.10
            this.renderer?.render();
            this.updateContourPanel();
        };
        
        // Contour click callback
        this.renderer.onContourClick = (contour, worldPoint, isShift) => {
            if (this.cutSeqMode) { this._handleCutSeqClick(contour); return; }   // V6.60: Schnitte anklicken
            // V3.5: Aktives Tool hat Priorität (Zeichnen + Modifikation)
            if (this.toolManager?.isToolActive()) {
                this.toolManager.handleClick(worldPoint);
                return;
            }
            if (this.measureMode) {
                this.handleMeasureClick(worldPoint);
                return;
            }
            
            if (this.startpointMode) {
                if ((contour.isClosed || contour.cuttingMode === 'slit') && !contour.isReference) {
                    this.setStartpointOnContour(contour, worldPoint);
                }
                return;
            }
            
            // Step-spezifische Logik
            if (this.currentStep === 2) {
                this.toggleReference(contour);
                return;
            }
            if (this.tileSeqMode) { this._handleTileSeqClick(worldPoint); return; }   // V6.59
            if (this.tilePickIdx != null) {   // V6.95: Nullpunkt einer Fliese setzen
                this._finishTilePick(this.currentSnapPoint || worldPoint);
                return;
            }
            if (this.currentStep === 3) {
                const point = this.currentSnapPoint || worldPoint;
                this.setOriginFromPoint(point);
                this.currentStep = this._stepBeforeOrigin || 1;
                document.getElementById('btn-set-origin-from-snap')?.classList.remove('active');
                document.getElementById('ct-origin')?.classList.remove('active');
                this.showToast(`Nullpunkt: X=${point.x.toFixed(3)}, Y=${point.y.toFixed(3)}`, 'success');
                console.log('[Origin V5.0] Nullpunkt gesetzt:', point.x.toFixed(3), point.y.toFixed(3));
                return;
            }
            
            // V5.2: Additive Selektion — Shift subtrahiert
            if (isShift) {
                // Shift+Klick: Aus Selektion entfernen (unverändert)
                contour.isSelected = false;
                this._cyclePoint = null; // Cycle-Reset bei Shift
            } else {
                // V6.11: Cycle-Selection — wiederholter Klick auf gleiche Stelle
                const CYCLE_TOLERANCE = 5 / (this.renderer?.scale || 1); // 5px in World-Koordinaten
                const isSameSpot = this._cyclePoint &&
                    Math.hypot(worldPoint.x - this._cyclePoint.x, worldPoint.y - this._cyclePoint.y) < CYCLE_TOLERANCE;

                if (isSameSpot && this._cycleContours.length > 1) {
                    // Nächste Kontur im Cycle
                    this._cycleIndex = (this._cycleIndex + 1) % this._cycleContours.length;
                    const target = this._cycleContours[this._cycleIndex];
                    this.contours.forEach(c => { c.isSelected = false; });
                    target.isSelected = true;
                    console.debug(`[App V6.11] Cycle-Selection: ${this._cycleIndex + 1}/${this._cycleContours.length}`);
                } else {
                    // Neuer Punkt — Cycle initialisieren
                    this._cycleContours = this.renderer.findAllContoursAtPoint(worldPoint.x, worldPoint.y);
                    this._cycleIndex = 0;
                    this._cyclePoint = { x: worldPoint.x, y: worldPoint.y };
                    // Normales Select: addieren
                    contour.isSelected = true;
                }
            }
            this.renderer.invalidateGrips?.();
            this.renderer.render();
            this.updateContourPanel();
        };
        
        // V5.2: Rechtsklick — Tool bestätigen ODER Kontext-Menü (Kontur/Canvas)
        this.renderer.onRightClick = (contour, worldPoint, screenX, screenY) => {
            // Aktives Tool hat Priorität — Rechtsklick = Enter/Bestätigen (AutoCAD-Stil)
            if (this.toolManager?.isToolActive()) {
                this.toolManager._handleEnter();
                return;
            }
            if (contour) {
                this.showContextMenu(contour, worldPoint, screenX, screenY);
            } else {
                // V5.2: Canvas-Kontextmenü auf leerer Fläche
                this.showCanvasContextMenu(worldPoint, screenX, screenY);
            }
        };
        
        console.debug('✓ CanvasRenderer initialized');
    }
    
    // ════════════════════════════════════════════════════════════════
    // V3.4: CAD DRAWING TOOLS
    // ════════════════════════════════════════════════════════════════
    
    initDrawingTools() {
        // CommandLine
        if (typeof CommandLine !== 'undefined') {
            this.commandLine = new CommandLine({
                containerId: 'command-line',
                inputId: 'cmd-input',
                promptId: 'cmd-prompt',
                historyId: 'cmd-history'
            });
        } else {
            console.warn('[V3.5] CommandLine nicht geladen');
        }
        
        // SnapManager
        if (typeof SnapManager !== 'undefined') {
            this.snapManager = new SnapManager();
            this.snapManager.onTrackingChange = () => this.renderer?.render();   // V6.78: Re-Render nach Erfassen
            this._syncTrackingToggles();
        } else {
            console.warn('[V3.5] SnapManager nicht geladen');
        }
        
        // V3.5: ToolManager (ersetzt DrawingToolManager)
        const ToolCls = (typeof ToolManager !== 'undefined') ? ToolManager :
                        (typeof DrawingToolManager !== 'undefined') ? DrawingToolManager : null;
        if (ToolCls) {
            this.toolManager = new ToolCls({
                app: this,
                renderer: this.renderer,
                commandLine: this.commandLine,
                snapManager: this.snapManager
            });
            this.drawingTools = this.toolManager;  // Backward-Kompatibilität
        } else {
            console.warn('[V3.5] ToolManager nicht geladen');
        }
        
        // V3.5: Command-Line immer sichtbar + aktiv
        if (this.commandLine) {
            this.commandLine.activate();
            const cmdContainer = document.getElementById('command-line');
            if (cmdContainer) cmdContainer.style.display = 'flex';
        }
        
        // V3.5: SnapManager mit Konturen synchronisieren
        if (this.snapManager && this.contours?.length) {
            this.snapManager.setContours(this.contours);
        }
        
        console.debug(`[V3.5] ToolManager: CmdLine=${this.commandLine ? '✅' : '❌'}, Snap=${this.snapManager ? '✅' : '❌'}, Tools=${this.toolManager ? '✅' : '❌'}`);
    }
    
    bindDrawingEvents() {
        // V3.4: Step 1 Tab-System (Import / Zeichnen)
        document.querySelectorAll('.step1-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                
                // Tab-Buttons umschalten
                document.querySelectorAll('.step1-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Tab-Content umschalten
                document.getElementById('tab-import').style.display = targetTab === 'import' ? 'block' : 'none';
                document.getElementById('tab-import')?.classList.toggle('active', targetTab === 'import');
                document.getElementById('tab-draw').style.display = targetTab === 'draw' ? 'block' : 'none';
                document.getElementById('tab-draw')?.classList.toggle('active', targetTab === 'draw');
                
                // Zeichenmodus automatisch aktivieren/deaktivieren
                if (targetTab === 'draw' && !this.drawingTools?.drawMode) {
                    this.toggleDrawMode();
                } else if (targetTab === 'import' && this.drawingTools?.drawMode) {
                    this.toggleDrawMode();
                }
            });
        });
        
        // Sidebar Draw-Tool Buttons
        document.querySelectorAll('.draw-sidebar-btn[data-shortcut]').forEach(btn => {
            btn.addEventListener('click', () => {
                const shortcut = btn.dataset.shortcut;
                if (!this.drawingTools?.drawMode) this.toggleDrawMode();
                this.drawingTools?.startTool(shortcut);
            });
        });
        
        // Sidebar Apply + Clear
        document.getElementById('btn-apply-drawing-sidebar')?.addEventListener('click', () => {
            this.drawingTools?.applyEntities();
            this._updateDrawEntityCount();
        });
        document.getElementById('btn-clear-drawing')?.addEventListener('click', () => {
            if (this.drawingTools) {
                this.drawingTools.entities = [];
                this.drawingTools.rubberBand = null;
                this.renderer?.render();
                this._updateDrawEntityCount();
                this.showToast('Zeichnung gelöscht', 'info');
            }
        });
        
        // Sidebar Ortho + Snap Checkboxen
        document.getElementById('draw-ortho-cb')?.addEventListener('change', (e) => {
            if (this.snapManager) {
                this.snapManager.setOrtho(e.target.checked);
                this._syncTrackingToggles();
            }
        });
        document.getElementById('draw-snap-cb')?.addEventListener('change', (e) => {
            if (this.snapManager) {
                // Haupt-Snaps ein/ausschalten (Nearest bleibt separat steuerbar)
                const on = e.target.checked;
                this.snapManager.enabledSnaps.endpoint = on;
                this.snapManager.enabledSnaps.midpoint = on;
                this.snapManager.enabledSnaps.center = on;
                this.snapManager.enabledSnaps.intersection = on;
                // nearest bleibt wie es ist (standardmäßig AUS)
                this._updateSnapModesDisplay();
            }
        });
        
        // Draw-Mode Toggle-Button
        document.getElementById('btn-draw-mode')?.addEventListener('click', () => {
            this.toggleDrawMode();
        });
        
        // Draw-Toolbar Buttons (Tool-Selektion)
        document.querySelectorAll('.draw-tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (!this.drawingTools?.drawMode) this.toggleDrawMode();
                this.drawingTools?.startTool(tool);
                this.lastToolShortcut = tool; // V5.2: Letzte Funktion merken
                
                // Active-State visuell
                document.querySelectorAll('.draw-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Apply-Button
        document.getElementById('btn-apply-drawing')?.addEventListener('click', () => {
            this.drawingTools?.applyEntities();
        });
        
        // Ortho-Toggle
        document.getElementById('btn-ortho-toggle')?.addEventListener('click', () => {
            if (this.snapManager) {
                const ortho = this.snapManager.toggleOrtho();
                this._syncTrackingToggles();
                this.showToast(ortho ? '⊞ Ortho-Modus EIN (0°/90°)' : '⊞ Ortho-Modus AUS', 'info');
            }
        });
        // V6.78: Polar Tracking (F10), Object Snap Tracking (F11), Rasterfang (F9)
        document.getElementById('btn-polar-toggle')?.addEventListener('click', () => this.togglePolarTracking());
        document.getElementById('btn-otrack-toggle')?.addEventListener('click', () => this.toggleObjectSnapTracking());
        document.getElementById('btn-grid-snap-toggle')?.addEventListener('click', () => this.toggleGridSnapMode());
        if (this.snapManager) {
            this.snapManager.onTrackingChange = () => this.renderer?.render();   // Re-Render nach Erfassen
        }
        this._syncTrackingToggles();
    }
    
    /** V6.78: Statusleisten-Buttons (Ortho/Polar/OTrack/Raster) mit SnapManager synchronisieren */
    _syncTrackingToggles() {
        const sm = this.snapManager;
        if (!sm) return;
        document.getElementById('btn-ortho-toggle')?.classList.toggle('active', !!sm.orthoEnabled);
        document.getElementById('btn-polar-toggle')?.classList.toggle('active', !!sm.polarEnabled);
        document.getElementById('btn-otrack-toggle')?.classList.toggle('active', !!sm.otrackEnabled);
        document.getElementById('btn-grid-snap-toggle')?.classList.toggle('active', !!sm.gridSnapEnabled);
        const cb = document.getElementById('draw-ortho-cb');
        if (cb) cb.checked = !!sm.orthoEnabled;
    }

    /** V6.78: Polar Tracking umschalten (F10) */
    togglePolarTracking() {
        if (!this.snapManager) return;
        const on = this.snapManager.togglePolar();
        this._syncTrackingToggles();
        this.showToast(on ? `∠ Polar-Tracking EIN (${this.snapManager.polarIncrement}°)` : '∠ Polar-Tracking AUS', 'info');
        this.renderer?.render();
    }

    /** V6.78: Object Snap Tracking umschalten (F11) */
    toggleObjectSnapTracking() {
        if (!this.snapManager) return;
        const on = this.snapManager.toggleOtrack();
        this._syncTrackingToggles();
        this.showToast(on ? '⊹ Objektfang-Tracking EIN' : '⊹ Objektfang-Tracking AUS', 'info');
        this.renderer?.render();
    }

    /** V6.78: Rasterfang umschalten (F9) */
    toggleGridSnapMode() {
        if (!this.snapManager) return;
        const on = this.snapManager.toggleGridSnap();
        this.snapManager._resolveCache = null;
        this._syncTrackingToggles();
        this.showToast(on ? '▦ Rasterfang EIN' : '▦ Rasterfang AUS', 'info');
    }

    /** V6.10: Snap-Modi-Anzeige in Status-Bar aktualisieren */
    _updateSnapModesDisplay() {
        const el = document.getElementById('status-snap-modes');
        if (!el || !this.snapManager) return;
        const snaps = this.snapManager.enabledSnaps;
        const abbr = [
            { key: 'endpoint',      label: 'END' },
            { key: 'midpoint',      label: 'MID' },
            { key: 'center',        label: 'CEN' },
            { key: 'geocenter',     label: 'GEO' },
            { key: 'quadrant',      label: 'QUA' },
            { key: 'intersection',  label: 'INT' },
            { key: 'perpendicular', label: 'PER' },
            { key: 'tangent',       label: 'TAN' },
            { key: 'nearest',       label: 'NEA' }
        ];
        el.innerHTML = abbr.map(s =>
            snaps[s.key] ? `<span class="snap-active">${s.label}</span>` : s.label
        ).join(' ');
    }

    toggleDrawMode() {
        if (!this.drawingTools) return;
        
        if (this.drawingTools.drawMode) {
            // Zeichenmodus beenden
            this.drawingTools.exitDrawMode();
            document.getElementById('btn-draw-mode')?.classList.remove('active');
            document.getElementById('draw-toolbar').style.display = 'none';
            this.showToast('Zeichenmodus beendet', 'info');
        } else {
            // Andere Modi beenden
            if (this.measureMode) this.toggleMeasureMode();
            if (this.startpointMode) this.toggleStartpointMode();
            
            // Zeichenmodus starten
            this.drawingTools.enterDrawMode();
            this.snapManager?.setContours(this.contours || []);
            document.getElementById('btn-draw-mode')?.classList.add('active');
            document.getElementById('draw-toolbar').style.display = 'flex';
            this.showToast('✏️ Zeichenmodus: Werkzeug wählen oder Shortcut eingeben (L/C/N/A/P)', 'success');
        }
    }
    
    /** Gezeichnete Entities zum Kontur-Array hinzufügen (durch Pipeline) */
    addDrawnEntities(dxfEntities) {
        if (!dxfEntities || dxfEntities.length === 0) return;
        
        const tolerance = this.settings.chainingTolerance || 0.1;
        
        // Entities durch DXF-Parser chainContours schicken
        let newContours = [];
        try {
            if (typeof DXFParser !== 'undefined' && DXFParser.chainContours) {
                newContours = DXFParser.chainContours(dxfEntities, tolerance);
            } else {
                // Fallback: Direkte Konvertierung
                for (const entity of dxfEntities) {
                    if (entity.points && entity.points.length >= 2) {
                        if (typeof CamContour !== 'undefined') {
                            const c = new CamContour(entity.points, {
                                layer: 'DRAW',
                                name: `Gezeichnet ${this.contours.length + newContours.length + 1}`,
                                _fitPoints: entity._fitPoints || null,
                                _splineClosed: entity._splineClosed ?? null
                            });
                            newContours.push(c);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('[V3.4] addDrawnEntities Fehler:', e);
            this.showToast('Fehler beim Konvertieren der Zeichnung', 'error');
            return;
        }
        
        if (newContours.length === 0) {
            this.showToast('Keine gültigen Konturen aus Zeichnung', 'warning');
            return;
        }
        
        // CamContour-Wrapping + Topologie-Klassifizierung (V5.0)
        const camContours = newContours.map(c => {
            let cam;
            if (typeof CamContour !== 'undefined' && !(c instanceof CamContour)) {
                cam = new CamContour(c.points, {
                    layer: 'DRAW',
                    name: c.name || 'Gezeichnet',
                    _fitPoints: c._fitPoints || null,
                    _splineClosed: c._splineClosed ?? null
                });
            } else {
                cam = c;
            }
            
            // V5.0: cuttingMode setzen (sonst keine Kerf/Leads/Flags)
            if (!cam.cuttingMode) {
                if (!cam.isClosed) {
                    cam.cuttingMode = 'slit';
                } else {
                    // Nesting-Check: liegt die neue Kontur innerhalb einer bestehenden Disc?
                    let nestingLevel = 0;
                    const testPt = cam.points[0];
                    for (const existing of this.contours) {
                        if (existing.isClosed && !existing.isReference && existing.points?.length >= 3) {
                            if (CeraCutPipeline._pointInPolygon(testPt, existing.points)) {
                                nestingLevel++;
                            }
                        }
                    }
                    cam.cuttingMode = nestingLevel % 2 === 0 ? 'disc' : 'hole';
                    cam.nestingLevel = nestingLevel;
                    cam.type = nestingLevel % 2 === 0 ? 'OUTER' : 'INNER';
                    console.log(`[V5.0] Gezeichnete Kontur klassifiziert: ${cam.cuttingMode} (nesting=${nestingLevel})`);
                }
            }
            return cam;
        });
        
        // Über Undo-Manager hinzufügen — pro Kontur ein eigener Undo-Step (V6.6)
        // Damit STRG+Z jeweils EINE Kontur entfernt statt alle auf einmal
        const onChanged = () => {
            this.rebuildCutOrder();
            if (this.settings.intarsiaMode) this.regenerateIntarsiaContours();
            this.renderer?.setContours(this.contours);
            this.snapManager?.invalidatePointsCache?.(); // V6.31: Snap-Cache nach neuen Konturen
            this.updateContourPanel();
            this.updateStats({ totalEntities: this.contours.length });
        };
        for (const cam of camContours) {
            const addCmd = new AddContoursCommand(
                this.contours,
                [cam],
                -1,
                onChanged
            );
            this.undoManager.execute(addCmd);
        }

        // Für ModificationTool "L" (Last) — zuletzt erzeugte Kontur merken
        this.lastCreatedContour = camContours[camContours.length - 1];


        // V3.5-fix: fileLoaded setzen damit Step-Navigation funktioniert (auch ohne DXF-Import)
        if (!this.fileLoaded) {
            this.fileLoaded = true;
            console.log('[App V3.5] fileLoaded=true (via Drawing)');
        }
        
        // Start-Hint + Drop-Zone ausblenden
        document.getElementById('start-hint')?.classList.add('hidden');
        document.getElementById('drop-zone')?.classList.remove('visible');
        this.updateStepUI();
        // V6.9: fitToContent nur beim ersten Mal — sonst verspringt die Ansicht
        if (!this._drawFitDone) {
            this._drawFitDone = true;
            this.renderer?.fitToContent();
        } else {
            this.renderer?.render();
        }
        
        this.showToast(`✓ ${camContours.length} gezeichnete Kontur(en) hinzugefügt (STRG+Z = Rückgängig)`, 'success');
        this._updateDrawEntityCount();
    }
    
    /** Entity-Zähler im Zeichnen-Tab aktualisieren */
    _updateDrawEntityCount() {
        const count = this.drawingTools?.entities?.length || 0;
        const el = document.getElementById('draw-entity-count');
        if (el) el.textContent = count;
    }
    
    // ════════════════════════════════════════════════════════════════
    // STARTPUNKT VERSCHIEBEN (V2.8)
    // ════════════════════════════════════════════════════════════════
    
    bindStartpointEvents() {
        document.getElementById('btn-set-startpoint')?.addEventListener('click', () => {
            this.toggleStartpointMode();
        });
    }
    
    toggleStartpointMode() {
        this.startpointMode = !this.startpointMode;
        
        // Andere Modi beenden
        if (this.startpointMode && this.measureMode) {
            this.toggleMeasureMode();
        }
        
        const btn = document.getElementById('btn-set-startpoint');
        const indicator = document.getElementById('startpoint-indicator');
        
        if (this.startpointMode) {
            btn?.classList.add('active');
            if (indicator) indicator.style.display = 'inline';
            this.renderer.canvas.style.cursor = 'crosshair';
            this.renderer.canvas.classList.add('startpoint-mode');
            this.showToast('📍 Startpunkt-Modus - Klick auf Kontur, ESC zum Beenden', 'success');
        } else {
            btn?.classList.remove('active');
            if (indicator) indicator.style.display = 'none';
            this.renderer.canvas.style.cursor = 'default';
            this.renderer.canvas.classList.remove('startpoint-mode');
        }
    }
    
    setStartpointOnContour(contour, clickPoint) {
        if (!contour || !contour.points || contour.points.length < 3) return;

        const points = contour.points;

        // Finde nächsten Punkt auf der Kontur
        let nearestIndex = 0;
        let minDist = Infinity;

        for (let i = 0; i < points.length - 1; i++) {
            const d = Math.hypot(points[i].x - clickPoint.x, points[i].y - clickPoint.y);
            if (d < minDist) {
                minDist = d;
                nearestIndex = i;
            }
        }

        // Rotiere Punkte-Array
        if (nearestIndex > 0) {
            const before = points.slice(0, nearestIndex);
            const after = points.slice(nearestIndex);

            // Neues Array: after + before (ohne doppelten Schlusspunkt)
            const newPoints = [...after];

            // Wenn geschlossen, alten Anfang anhängen
            if (contour.isClosed) {
                // Alten Schlusspunkt (== Startpunkt) entfernen, sonst doppelter Nahtpunkt
                if (newPoints.length > 1) {
                    const l = newPoints[newPoints.length - 1], f = points[0];
                    if (Math.hypot(l.x - f.x, l.y - f.y) < 1e-9) newPoints.pop();
                }
                newPoints.push(...before);
                // Schließen
                if (newPoints.length > 0) {
                    newPoints.push({...newPoints[0]});
                }
            }

            // Undo-fähige Mutation via FunctionCommand
            const oldPoints = contour.points.map(p => ({...p}));
            const app = this;
            const cmd = new FunctionCommand(
                `Startpunkt verschieben (Punkt ${nearestIndex})`,
                () => {
                    contour.points = newPoints.map(p => ({...p}));
                    contour.invalidate?.();
                    app.renderer?.render();
                    app.updateContourPanel();
                },
                () => {
                    contour.points = oldPoints.map(p => ({...p}));
                    contour.invalidate?.();
                    app.renderer?.render();
                    app.updateContourPanel();
                }
            );
            // Aktion bereits ausgeführt — direkt auf Stack pushen
            contour.points = newPoints;
            contour.invalidate?.();
            contour._rotationCount = (contour._rotationCount || 0) + 1;
            this.undoManager.pushExecuted(cmd);
            this.undoManager.redoStack = [];
            this.undoManager._notifyStateChange();

            this.showToast(`📍 Startpunkt verschoben (Punkt ${nearestIndex})`, 'success');
            this.renderer.render();
            this.updateContourPanel();
        }
    }
    
    // ════════════════════════════════════════════════════════════════
    // KONTEXT-MENÜ (V2.8)
    // ════════════════════════════════════════════════════════════════
    
    bindContextMenuEvents() {
        const menu = document.getElementById('context-menu');
        const canvasMenu = document.getElementById('canvas-context-menu');
        
        // Kontur-Menü Items
        menu?.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            });
        });

        // V5.2: Canvas-Menü Items
        canvasMenu?.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.canvasAction;
                if (action) this.handleCanvasContextMenuAction(action);
            });
        });
        
        // Klick außerhalb schließt beide Menüs
        document.addEventListener('click', (e) => {
            if (!menu?.contains(e.target)) this.hideContextMenu();
            if (!canvasMenu?.contains(e.target)) this.hideCanvasContextMenu();
        });
        
        // ESC schließt beide Menüs
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
                this.hideCanvasContextMenu();
            }
        });
        
        // Canvas Rechtsklick (Backup-Handler für Kontext-Menü)
        this.renderer?.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.toolManager?.isToolActive()) return;

            // V2.7: Rechtsklick im drawMode ohne Tool → Auto-Apply pending Entities
            if (this.drawingTools?.drawMode && !this.drawingTools.activeTool && this.drawingTools.entities.length > 0) {
                console.debug('[App V6.9] Auto-Apply: Rechtsklick bei pending Entities');
                this.drawingTools.applyEntities();
                return;
            }

            const worldPos = this.renderer.screenToWorld(e.offsetX, e.offsetY);
            // V3.36: Rechtsklick nur auf Kanten → Kontur-Menü, im Inneren → Canvas-Menü
            const contour = this.renderer.findContourAtPoint(worldPos.x, worldPos.y, { edgeOnly: true });

            if (contour) {
                this.showContextMenu(contour, worldPos, e.clientX, e.clientY);
            } else {
                // V5.2: Canvas-Menü auf leerer Fläche (auch im Inneren geschlossener Konturen)
                this.showCanvasContextMenu(worldPos, e.clientX, e.clientY);
            }
        });
    }
    
    showContextMenu(contour, worldPoint, screenX, screenY) {
        this.contextMenuContour = contour;
        this.contextMenuPoint = worldPoint;
        this.hideCanvasContextMenu(); // V5.2: Canvas-Menü schließen
        
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        
        // Position
        menu.style.left = `${screenX}px`;
        menu.style.top = `${screenY}px`;
        menu.classList.add('visible');
        
        // Menü-Items je nach Kontext ein/ausblenden
        // V6.21: CAM-Aktionen erst nach abgeschlossenem Setup (Referenz + Nullpunkt)
        const isReference = contour.isReference;
        const setupComplete = this.isSetupComplete();
        const isCuttable = (contour.isClosed || contour.cuttingMode === 'slit') && !isReference;

        const startpointItem = menu.querySelector('[data-action="set-startpoint"]');
        if (startpointItem) startpointItem.style.display = isCuttable ? 'flex' : 'none';
        const reverseItem = menu.querySelector('[data-action="reverse-direction"]');
        if (reverseItem) reverseItem.style.display = isCuttable ? 'flex' : 'none';
        const microjointItem = menu.querySelector('[data-action="add-microjoint"]');
        if (microjointItem) microjointItem.style.display = (contour.isClosed && !isReference && setupComplete) ? 'flex' : 'none';

        // V5.7: CAM-Properties im Kontextmenu (erst nach abgeschlossenem Setup, V6.21)
        const camContainer = document.getElementById('ctx-cam-properties');
        if (camContainer) {
            if (setupComplete && !isReference) {
                // Sicherstellen, dass die rechts-geklickte Kontur selektiert ist
                if (!contour.isSelected) {
                    this.contours.forEach(c => { c.isSelected = false; });
                    contour.isSelected = true;
                }
                camContainer.innerHTML = this.propertiesPanel.generateContextMenuHTML();
                this.propertiesPanel.bindEvents(camContainer);
            } else {
                camContainer.innerHTML = '';
            }
        }

        // Menue-Position korrigieren (nicht ueber Bildschirmrand)
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.bottom > window.innerHeight) {
                menu.style.top = `${Math.max(4, window.innerHeight - rect.height - 4)}px`;
            }
            if (rect.right > window.innerWidth) {
                menu.style.left = `${Math.max(4, window.innerWidth - rect.width - 4)}px`;
            }
        });
    }
    
    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        menu?.classList.remove('visible');
        // V5.7: CAM-Properties aufräumen
        const camContainer = document.getElementById('ctx-cam-properties');
        if (camContainer) camContainer.innerHTML = '';
        this.contextMenuContour = null;
        this.contextMenuPoint = null;
    }
    
    handleContextMenuAction(action) {
        const contour = this.contextMenuContour;
        const point = this.contextMenuPoint;
        
        if (!contour) return;
        
        const rerender = () => {
            this.renderer?.render();
            this.updateContourPanel();
        };
        
        switch (action) {
            case 'set-startpoint':
                this.setStartpointOnContour(contour, point);
                break;
                
            case 'reverse-direction':
                this.reverseContourDirection(contour);
                break;
                
            case 'set-hole': {
                const cmd = new PropertyChangeCommand(contour, 'cuttingMode', 'hole', () => {
                    contour.invalidate?.();
                    rerender();
                });
                this.undoManager.execute(cmd);
                this.showToast('⭕ Als Loch markiert (STRG+Z = Rückgängig)', 'success');
                return; // rerender schon im Callback
            }
                
            case 'set-disc': {
                const cmd = new PropertyChangeCommand(contour, 'cuttingMode', 'disc', () => {
                    contour.invalidate?.();
                    rerender();
                });
                this.undoManager.execute(cmd);
                this.showToast('🔵 Als Scheibe markiert (STRG+Z = Rückgängig)', 'success');
                return;
            }
                
            case 'flip-kerf': {
                const wasFlipped = !!contour.kerfFlipped;
                const cmd = new FunctionCommand(
                    'Kerf umkehren',
                    () => { contour.toggleKerfSide?.(); rerender(); },
                    () => { contour.toggleKerfSide?.(); rerender(); }
                );
                this.undoManager.execute(cmd);
                this.showToast(
                    !wasFlipped ? '⇄ Kerf umgekehrt' : '⇄ Kerf normal',
                    'success'
                );
                return;
            }
                
            case 'set-reference': {
                const cmd = new PropertyChangeCommand(contour, 'isReference', !contour.isReference, rerender);
                this.undoManager.execute(cmd);
                this.showToast(contour.isReference ? '🚫 Als Referenz markiert' : 'Referenz aufgehoben', 'success');
                return;
            }
                
            case 'add-microjoint':
                this.addMicrojointAtPoint(contour, point);
                break;

            case 'origin-to-endpoint': {
                // V5.3: Nullpunkt zum nächsten Endpunkt der Kontur setzen
                if (!contour.points || contour.points.length < 2) break;
                const clickPt = this.currentSnapPoint || point;
                let bestPt = contour.points[0];
                let bestDist = Infinity;
                for (const p of contour.points) {
                    const d = Math.hypot(p.x - clickPt.x, p.y - clickPt.y);
                    if (d < bestDist) { bestDist = d; bestPt = p; }
                }
                this.setOriginFromPoint({ x: bestPt.x, y: bestPt.y });
                this.showToast(`📍 Nullpunkt → Endpunkt: X=${bestPt.x.toFixed(3)}, Y=${bestPt.y.toFixed(3)}`, 'success');
                console.log('[Origin V5.3] Nullpunkt → Endpunkt:', bestPt.x.toFixed(3), bestPt.y.toFixed(3));
                break;
            }

            case 'origin-to-midpoint': {
                // V5.3: Nullpunkt zum geometrischen Mittelpunkt (Centroid) der Kontur
                if (!contour.points || contour.points.length < 2) break;
                let cx = 0, cy = 0;
                const pts = contour.isClosed ? contour.points.slice(0, -1) : contour.points;
                for (const p of pts) { cx += p.x; cy += p.y; }
                cx /= pts.length;
                cy /= pts.length;
                this.setOriginFromPoint({ x: cx, y: cy });
                this.showToast(`📍 Nullpunkt → Mittelpunkt: X=${cx.toFixed(3)}, Y=${cy.toFixed(3)}`, 'success');
                console.log('[Origin V5.3] Nullpunkt → Mittelpunkt:', cx.toFixed(3), cy.toFixed(3));
                break;
            }
                
            case 'duplicate':
                this.duplicateContour(contour);
                return; // hat eigenes rerender
                
            case 'delete':
                this.deleteContour(contour);
                return; // hat eigenes rerender
        }
        
        this.renderer?.render();
        this.updateContourPanel();
    }
    
    // ════════════════════════════════════════════════════════════════
    // V5.2: CANVAS-KONTEXTMENÜ (Rechtsklick auf leere Fläche)
    // ════════════════════════════════════════════════════════════════

    showCanvasContextMenu(worldPoint, screenX, screenY) {
        console.log('[ContextMenu V5.2] Canvas-Menü:', worldPoint.x.toFixed(2), worldPoint.y.toFixed(2));
        this.canvasContextMenuPoint = worldPoint;
        this.hideContextMenu(); // Kontur-Menü schließen falls offen

        const menu = document.getElementById('canvas-context-menu');
        if (!menu) return;

        // "Letzte Funktion" ein/ausblenden
        const repeatItem = menu.querySelector('[data-canvas-action="repeat-last"]');
        if (repeatItem) {
            if (this.lastToolShortcut) {
                repeatItem.style.display = 'flex';
                repeatItem.textContent = `↺ ${this.lastToolShortcut} wiederholen`;
            } else {
                repeatItem.style.display = 'none';
            }
        }

        // Undo/Redo Verfügbarkeit
        const undoItem = menu.querySelector('[data-canvas-action="undo"]');
        const redoItem = menu.querySelector('[data-canvas-action="redo"]');
        if (undoItem) undoItem.style.opacity = this.undoManager?.canUndo() ? '1' : '0.4';
        if (redoItem) redoItem.style.opacity = this.undoManager?.canRedo() ? '1' : '0.4';

        // Paste Verfügbarkeit
        const pasteItem = menu.querySelector('[data-canvas-action="paste"]');
        if (pasteItem) pasteItem.style.opacity = (typeof ClipboardManager !== 'undefined' && ClipboardManager._sharedClipboard?.length) ? '1' : '0.4';

        // Position
        menu.style.left = `${screenX}px`;
        menu.style.top = `${screenY}px`;
        menu.classList.add('visible');
    }

    hideCanvasContextMenu() {
        const menu = document.getElementById('canvas-context-menu');
        menu?.classList.remove('visible');
        this.canvasContextMenuPoint = null;
    }

    handleCanvasContextMenuAction(action) {
        console.log('[ContextMenu V5.2] Canvas-Aktion:', action);
        const point = this.canvasContextMenuPoint;

        switch (action) {
            case 'repeat-last':
                if (this.lastToolShortcut && this.toolManager) {
                    this.toolManager.startTool(this.lastToolShortcut);
                }
                break;

            case 'paste':
                this.clipboardManager?.paste?.(this);
                break;

            case 'select-all':
                this.contours.forEach(c => { if (!c.isReference) c.isSelected = true; });
                this.renderer?.invalidateGrips?.();
                this.renderer?.render();
                this.updateContourPanel();
                break;

            case 'deselect-all':
                this.contours.forEach(c => { c.isSelected = false; });
                this.renderer?.invalidateGrips?.();
                this.renderer?.render();
                this.updateContourPanel();
                break;

            case 'undo':
                this.undoManager?.undo();
                this._refreshAfterUndoRedo();
                break;

            case 'redo':
                this.undoManager?.redo();
                this._refreshAfterUndoRedo();
                break;

            case 'set-origin':
                if (point) {
                    const snapPt = this.currentSnapPoint || point;
                    this.setOriginFromPoint(snapPt);
                    this.showToast(`Nullpunkt: X=${snapPt.x.toFixed(3)}, Y=${snapPt.y.toFixed(3)}`, 'success');
                    console.log('[Origin V5.2] Nullpunkt via Kontextmenü:', snapPt.x.toFixed(3), snapPt.y.toFixed(3));
                }
                break;

            case 'zoom-fit':
                this.renderer?.fitToContent();
                break;

            case 'calculator':
                this._showCalculator();
                break;
        }

        this.hideCanvasContextMenu();
    }

    /** V5.2: Mini-Taschenrechner (Prompt-basiert) */
    _showCalculator() {
        const expr = prompt('🧮 Taschenrechner — Ausdruck eingeben:', '');
        if (expr === null || expr.trim() === '') return;
        try {
            // Sichere Auswertung: nur Zahlen und Operatoren
            const sanitized = expr.replace(/[^0-9+\-*/().,%^sqrt\s]/gi, '');
            // Math-Funktionen erlauben
            const safe = sanitized
                .replace(/sqrt/gi, 'Math.sqrt')
                .replace(/\^/g, '**')
                .replace(/%/g, '/100*');
            const result = Function('"use strict"; return (' + safe + ')')();
            this.showToast(`🧮 ${expr} = ${result}`, 'success');
            // In Commandline eintragen für Copy
            const cmdInput = document.getElementById('cmd-input');
            if (cmdInput) cmdInput.value = String(result);
            console.log('[Calculator V5.2]', expr, '=', result);
        } catch (e) {
            this.showToast(`❌ Ungültiger Ausdruck: ${expr}`, 'error');
        }
    }

    reverseContourDirection(contour) {
        if (!contour || !contour.points) return;
        
        const cmd = new FunctionCommand(
            'Richtung umkehren',
            () => {
                contour.points = contour.points.slice().reverse();
                contour.invalidate?.();
                this.renderer?.render();
            },
            () => {
                contour.points = contour.points.slice().reverse();
                contour.invalidate?.();
                this.renderer?.render();
            }
        );
        this.undoManager.execute(cmd);
        
        this.showToast('↻ Richtung umgekehrt (STRG+Z = Rückgängig)', 'success');
    }
    
    /** Referenz-Status togglen (Canvas-Klick + Panel-Klick in Step 2) */
    toggleReference(contour) {
        if (!contour) return;
        const newVal = !contour.isReference;
        const cmd = new PropertyChangeCommand(contour, 'isReference', newVal, () => {
            if (contour.isReference) this.setOriginToReferenceUL();
            this._recalcTopologyAfterReferenceChange();
        });
        this.undoManager.execute(cmd);
        this.showToast(newVal ? '🟨 Referenz gesetzt (STRG+Z = Rückgängig)' : 'Referenz aufgehoben', 'success');
    }

    /**
     * V6.22: Nesting-Level (disc/hole) neu berechnen, nachdem die Referenz manuell
     * gesetzt/gewechselt wurde. Die Referenz ist "transparent" fuer die Topologie —
     * Konturen darin/dahinter muessen neu als disc/hole klassifiziert werden,
     * sonst bleiben Kerf-Offset-Richtung und Lead-Routing inkonsistent.
     */
    _recalcTopologyAfterReferenceChange() {
        if (typeof CeraCutPipeline !== 'undefined') {
            CeraCutPipeline._analyzeTopology(this.contours, { skipReference: true });
        }
        this.renderer?.render();
        this.updateContourPanel();
        this.rebuildCutOrder?.();
        if (this._tilesActive) this.refreshTiles(true);   // V6.58: Fliesen nach Auto-Referenz neu zuordnen
        this.updateStepUI();
    }
    
    // ════════════════════════════════════════════════════════════════
    // KONTUR LÖSCHEN / DUPLIZIEREN (V2.8)
    // ════════════════════════════════════════════════════════════════
    
    deleteContour(contour) {
        const index = this.contours.indexOf(contour);
        if (index === -1) return;
        
        const name = contour.name || `Kontur ${index + 1}`;
        
        // Über UndoManager löschen (Undo-fähig)
        const deleteCmd = new DeleteContoursCommand(
            this.contours,
            [contour],
            () => {
                this.rebuildCutOrder();
                if (this.settings.intarsiaMode) this.regenerateIntarsiaContours();
                this.renderer?.setContours(this.contours);
                this.updateContourPanel();
                this.updateStats({ totalEntities: this.contours.length });
            },
            this
        );
        this.undoManager.execute(deleteCmd);
        
        this.showToast(`🗑️ "${name}" gelöscht (STRG+Z = Rückgängig)`, 'success');
    }
    
    /** V6.57: Konturgeometrie nur im Ribbon-Tab "CAD" änderbar (Zeichnen/Ändern, Grips, Löschen). CAM-Funktionen mit eigenen Buttons bleiben möglich. */
    isGeometryEditAllowed() {
        const tab = document.querySelector('.ribbon-tab.active[data-ribbon]');
        return !tab || tab.dataset.ribbon === 'cad';
    }

    _denyGeometryEdit() {
        this.showToast('Konturen sind nur im Tab „CAD“ änderbar', 'warning');
        return false;
    }

    deleteSelectedContours() {
        if (!this.isGeometryEditAllowed()) return this._denyGeometryEdit();
        const selected = this.contours.filter(c => c.isSelected);
        
        if (selected.length === 0) {
            this.showToast('Keine Konturen ausgewählt', 'warning');
            return;
        }
        
        // Über UndoManager löschen (Undo-fähig)
        const deleteCmd = new DeleteContoursCommand(
            this.contours,
            selected,
            () => {
                this.rebuildCutOrder();
                if (this.settings.intarsiaMode) this.regenerateIntarsiaContours();
                this.renderer?.setContours(this.contours);
                this.updateContourPanel();
            },
            this
        );
        this.undoManager.execute(deleteCmd);
        
        this.showToast(`🗑️ ${selected.length} Konturen gelöscht (STRG+Z = Rückgängig)`, 'success');
    }
    
    duplicateContour(contour) {
        const index = this.contours.indexOf(contour);
        if (index === -1) return;
        
        // Deep copy
        let newContour;
        if (typeof CamContour !== 'undefined' && contour instanceof CamContour) {
            const points = contour.points.map(p => ({...p}));
            newContour = new CamContour(points, { isClosed: contour.isClosed });
            Object.assign(newContour, {
                ...contour,
                points: points,
                name: (contour.name || `Kontur ${index + 1}`) + ' (Kopie)',
                isSelected: false,
                microjoints: contour.microjoints ? [...contour.microjoints] : []
            });
            // Cache-Properties löschen — nicht übernehmen aus Original
            newContour._cachedKerfPolyline = null;
            newContour._cacheKey = null;
            newContour._cachedLeadInPath = null;
            newContour._cachedLeadOutPath = null;
            newContour._cachedOvercutPath = null;
        } else {
            newContour = {
                ...contour,
                points: contour.points.map(p => ({...p})),
                name: (contour.name || `Kontur ${index + 1}`) + ' (Kopie)',
                isSelected: false,
                microjoints: contour.microjoints ? [...contour.microjoints] : []
            };
        }
        
        // Über UndoManager einfügen (Undo-fähig)
        const addCmd = new AddContoursCommand(
            this.contours,
            [newContour],
            index + 1,
            () => {
                this.rebuildCutOrder();
                if (this.settings.intarsiaMode) this.regenerateIntarsiaContours();
                this.renderer?.setContours(this.contours);
                this.updateContourPanel();
            }
        );
        this.undoManager.execute(addCmd);
        
        this.showToast(`📋 "${newContour.name}" dupliziert (STRG+Z = Rückgängig)`, 'success');
    }
    
    // ════════════════════════════════════════════════════════════════
    // MICRO-JOINTS / STEGE (V2.8)
    // ════════════════════════════════════════════════════════════════
    
    bindMicrojointEvents() {
        document.getElementById('btn-add-microjoints')?.addEventListener('click', () => {
            this.addAutoMicrojoints();
        });
        
        document.getElementById('btn-clear-microjoints')?.addEventListener('click', () => {
            this.clearMicrojoints();
        });
    }
    
    addMicrojointAtPoint(contour, point) {
        if (!contour || !contour.points) return;
        
        const position = this.findPositionOnContour(contour, point);
        const width = parseFloat(document.getElementById('microjoint-width')?.value) || 0.5;
        const oldJoints = contour.microjoints ? [...contour.microjoints] : [];
        
        if (!contour.microjoints) contour.microjoints = [];
        contour.microjoints.push({ position, width });
        
        const newJoints = [...contour.microjoints];
        const cmd = new FunctionCommand(
            'Steg hinzufügen',
            () => { contour.microjoints = newJoints.map(j => ({...j})); this.renderer?.render(); this.updateContourPanel(); },
            () => { contour.microjoints = oldJoints.map(j => ({...j})); this.renderer?.render(); this.updateContourPanel(); }
        );
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        
        this.showToast(`✂️ Steg hinzugefügt (${position.toFixed(1)}mm, STRG+Z = Rückgängig)`, 'success');
        this.renderer?.render();
    }
    
    findPositionOnContour(contour, point) {
        const points = contour.points;
        let totalDist = 0;
        let nearestDist = Infinity;
        let nearestPosition = 0;
        
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            
            // Projektion des Punkts auf Segment
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const t = Math.max(0, Math.min(1, ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / (dx*dx + dy*dy || 1)));
            
            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const dist = Math.hypot(point.x - projX, point.y - projY);
            
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestPosition = totalDist + t * segLen;
            }
            
            totalDist += segLen;
        }
        
        return nearestPosition;
    }
    
    addAutoMicrojoints() {
        const count = parseInt(document.getElementById('microjoint-count')?.value) || 2;
        const width = parseFloat(document.getElementById('microjoint-width')?.value) || 0.5;
        
        const selected = this.contours.filter(c => c.isSelected && c.isClosed && !c.isReference);
        const targets = selected.length > 0 ? selected : this.contours.filter(c => c.isClosed && !c.isReference);
        
        if (targets.length === 0) {
            this.showToast('Keine schneidbaren Konturen', 'warning');
            return;
        }
        
        // Snapshot VOR Änderung
        const snapshot = targets.map(c => ({ contour: c, old: c.microjoints ? c.microjoints.map(j => ({...j})) : [] }));
        
        let totalJoints = 0;
        targets.forEach(contour => {
            const perimeter = this.getContourPerimeter(contour);
            contour.microjoints = [];
            for (let i = 0; i < count; i++) {
                const position = (perimeter / count) * (i + 0.5);
                contour.microjoints.push({ position, width });
                totalJoints++;
            }
        });
        
        // Snapshot NACH Änderung
        const newState = targets.map(c => ({ contour: c, joints: c.microjoints.map(j => ({...j})) }));
        const app = this;
        const cmd = new FunctionCommand(
            `Auto-Stege (${totalJoints} auf ${targets.length} Konturen)`,
            () => { newState.forEach(s => { s.contour.microjoints = s.joints.map(j => ({...j})); }); app.renderer?.render(); app.updateContourPanel(); },
            () => { snapshot.forEach(s => { s.contour.microjoints = s.old.map(j => ({...j})); }); app.renderer?.render(); app.updateContourPanel(); }
        );
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        
        this.showToast(`✂️ ${totalJoints} Stege auf ${targets.length} Konturen (STRG+Z = Rückgängig)`, 'success');
        this.renderer?.render();
        this.updateContourPanel();
    }
    
    clearMicrojoints() {
        const selected = this.contours.filter(c => c.isSelected);
        const targets = selected.length > 0 ? selected : this.contours;
        
        // Nur Konturen mit Stegen sammeln
        const affected = targets.filter(c => c.microjoints && c.microjoints.length > 0);
        if (affected.length === 0) {
            this.showToast('Keine Stege vorhanden', 'info');
            return;
        }
        
        // Snapshot VOR Löschung
        const snapshot = affected.map(c => ({ contour: c, old: c.microjoints.map(j => ({...j})) }));
        let cleared = 0;
        affected.forEach(c => {
            cleared += c.microjoints.length;
            c.microjoints = [];
        });
        
        const app = this;
        const cmd = new FunctionCommand(
            `${cleared} Stege entfernen`,
            () => { snapshot.forEach(s => { s.contour.microjoints = []; }); app.renderer?.render(); app.updateContourPanel(); },
            () => { snapshot.forEach(s => { s.contour.microjoints = s.old.map(j => ({...j})); }); app.renderer?.render(); app.updateContourPanel(); }
        );
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        
        this.showToast(`${cleared} Stege entfernt (STRG+Z = Rückgängig)`, 'success');
        this.renderer?.render();
        this.updateContourPanel();
    }
    
    getContourPerimeter(contour) {
        if (!contour || !contour.points) return 0;
        const pts = contour.points;
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
            len += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
        }
        if (contour.isClosed && pts.length >= 2) {
            len += Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y);
        }
        return len;
    }
    
    // ════════════════════════════════════════════════════════════════
    // STEP 5: REIHENFOLGE (V2.8)
    // ════════════════════════════════════════════════════════════════
    
    bindOrderEvents() {
        const sortBtn = document.getElementById('btn-auto-sort');
        console.log('[INIT] btn-auto-sort:', sortBtn ? 'gefunden' : 'NICHT GEFUNDEN');
        
        sortBtn?.addEventListener('click', () => {
            console.log('[SORT] Button geklickt, Methode:', document.getElementById('sort-method')?.value);
            this.autoSortContours();
        });
    }
    
    /**
     * V6.83: Offene Konturen (z.B. Fliese aus Einzellinien, oder Kontur nach Trim/Loeschen einer
     * Seite) behalten sonst ein veraltetes cuttingMode 'disc'/'hole'/null und fallen aus allen
     * "schneidbar"-Filtern. Offene, nicht-Hatch, nicht-Referenz-Konturen sind immer Slits.
     */
    _normalizeOpenContours() {
        for (const c of this.contours) {
            if (!c.isClosed && !c.isHatchContour && !c.isReference
                && c.cuttingMode !== 'none' && c.cuttingMode !== 'slit') {
                c.cuttingMode = 'slit';
                if (typeof ModificationTool !== 'undefined') ModificationTool.invalidateCache?.(c);
            }
        }
    }

    rebuildCutOrder() {
        this._normalizeOpenContours();
        const cuttable = [];
        this.contours.forEach((c, i) => {
            if (!c.isReference && (c.isClosed || c.cuttingMode === 'slit')) {
                cuttable.push({ contour: c, index: i });
            }
        });
        this._applyInsideOutSort(cuttable);
        this.cutOrder = cuttable.map(item => item.index);
        this.renderer?.render();
    }
    
    /** V6.96: Sortiermethode auf eine Konturliste anwenden (in place) */
    _applySortMethod(method, cuttable, startContour) {
        switch (method) {
            case 'inside-out': {
                this._applyInsideOutSort(cuttable);
                break;
            }
                
            case 'outside-in':
                // Größte zuerst
                cuttable.sort((a, b) => {
                    const areaA = Math.abs(this.computeArea(a.contour.points));
                    const areaB = Math.abs(this.computeArea(b.contour.points));
                    return areaB - areaA;
                });
                break;
                
            case 'shortest-path':
                // Greedy nearest-neighbor TSP (von hinten-rechts)
                this.sortByShortestPath(cuttable, null);
                break;
                
            case 'shortest-path-selected':
                // TSP ab ausgewählter Kontur
                this.sortByShortestPath(cuttable, startContour);
                break;

            case 'mosaic':
                // V6.88: Innenkonturen ab Nullpunkt, Fliesenrand zuletzt
                this.sortMosaic(cuttable);
                break;
                
            case 'by-layer':
                cuttable.sort((a, b) => (a.contour.layer || '').localeCompare(b.contour.layer || ''));
                break;
                
            case 'by-size':
                cuttable.sort((a, b) => {
                    const areaA = Math.abs(this.computeArea(a.contour.points));
                    const areaB = Math.abs(this.computeArea(b.contour.points));
                    return areaA - areaB;
                });
                break;
        }
        
    }

    autoSortContours() {
        const method = document.getElementById('sort-method')?.value || 'inside-out';
        
        // Nur schneidbare Konturen
        this._normalizeOpenContours();
        const cuttable = this.contours
            .map((c, i) => ({ contour: c, index: i }))
            .filter(item => !item.contour.isReference && (item.contour.isClosed || item.contour.cuttingMode === 'slit'));
        
        if (cuttable.length === 0) {
            this.showToast('Keine schneidbaren Konturen', 'warning');
            return;
        }
        
        if (method === 'mosaic-meander') {
            this.applyMosaicMeander(cuttable);
            return;
        }

        // Für "shortest-path-selected": Prüfe ob eine Kontur ausgewählt ist
        let startContour = null;
        if (method === 'shortest-path-selected') {
            const selected = cuttable.find(item => item.contour.isSelected);
            if (!selected) {
                this.showToast('⚠️ Bitte erst eine Startkontur auswählen', 'warning');
                return;
            }
            startContour = selected;
        }
        
        // V6.96: Mit Fliesen wird JEDE Fliese einzeln sortiert (eigener Nullpunkt, eigener Rand zuletzt),
        // danach werden die Fliesen in der Fliesen-Reihenfolge aneinandergehängt.
        const tiles = (method !== 'mosaic-meander') ? this.refreshTiles(true) : [];
        if (tiles.length > 0) {
            const out = [], allReversed = [];
            for (const t of tiles) {
                const idxSet = new Set(t.contourIdx);
                const sub = cuttable.filter(it => idxSet.has(it.index));
                if (sub.length === 0) continue;
                this._sortOriginOverride = t.origin;
                this._lastReversedContours = [];
                this._applySortMethod(method, sub, startContour && idxSet.has(startContour.index) ? startContour : null);
                this._sortOriginOverride = null;
                allReversed.push(...(this._lastReversedContours || []));
                out.push(...sub);
            }
            const used = new Set(out);
            const rest = cuttable.filter(it => !used.has(it));   // Konturen ohne Fliese ans Ende
            cuttable.length = 0;
            cuttable.push(...out, ...rest);
            this._lastReversedContours = allReversed;
            this.showToast(`Sortiert pro Fliese: ${tiles.length} Fliese(n), je eigene Reihenfolge ab eigenem Nullpunkt`, 'success');
        } else {
            this._applySortMethod(method, cuttable, startContour);
        }

        // Nur TSP-Sortierung setzt _lastReversedContours neu; sonst veraltete Refs verwerfen
        if (method !== 'shortest-path' && method !== 'shortest-path-selected' && method !== 'mosaic') {
            this._lastReversedContours = [];
        }
        const oldOrder = [...this.cutOrder];
        const newOrder = cuttable.map(item => item.index);
        this.cutOrder = newOrder;
        
        // Objekt-Referenzen (nicht Indizes) — überleben Array-Verschiebungen durch Delete/Insert
        const reversedContours = [...(this._lastReversedContours || [])];

        // Undo-Command für Sortierung + Richtungsumkehr
        const app = this;
        const cmd = new FunctionCommand(
            `Sortierung: ${method}`,
            () => {
                // Redo: Konturen erneut umkehren + neue Reihenfolge
                reversedContours.forEach(c => { if (c?.points) c.points.reverse(); });
                app.cutOrder = [...newOrder];
                app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render();
            },
            () => {
                // Undo: Konturen zurück-umkehren + alte Reihenfolge
                reversedContours.forEach(c => { if (c?.points) c.points.reverse(); });
                app.cutOrder = [...oldOrder];
                app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render();
            }
        );
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        
        console.log('[SORT] Neue Reihenfolge:', this.cutOrder);
        this.showToast(`🔄 Sortiert: ${method} (STRG+Z = Rückgängig)`, 'success');
        this.updateCutOrderList();
        this.updateOrderStats();
        this.renderer?.render();
    }
    
    // ── Mosaik-Helfer (V6.89) ──────────────────────────────────────

    _mosaicBBox(c) {
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const p of c.points) {
            if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
            if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
        }
        return { x0, x1, y0, y1, area: (x1 - x0) * (y1 - y0) };
    }

    /** Randkontur(en): verkettete Kontur mit groesster Bounding-Box, sonst aeusserste Einzellinien je Seite. */
    _mosaicDetectBorder(cuttable) {
        const bb = new Map(cuttable.map(it => [it, this._mosaicBBox(it.contour)]));
        let maxArea = 0;
        for (const it of cuttable) if (bb.get(it).area > maxArea) maxArea = bb.get(it).area;
        let border = [];
        if (maxArea > 0) border = cuttable.filter(it => bb.get(it).area >= maxArea * 0.98 && it.contour.points.length >= 4);
        if (border.length === 0) {
            const tol = 1e-3;
            const lines = cuttable.filter(it => it.contour.points.length >= 2);
            const pick = (axis, dir) => {
                const val = (it) => { const b = bb.get(it); return axis === 'x' ? (dir < 0 ? b.x0 : b.x1) : (dir < 0 ? b.y0 : b.y1); };
                const isLine = (it) => { const b = bb.get(it); return axis === 'x' ? (b.x1 - b.x0) < tol : (b.y1 - b.y0) < tol; };
                const cand = lines.filter(isLine);
                if (!cand.length) return null;
                return cand.reduce((a, b) => (dir < 0 ? val(b) < val(a) : val(b) > val(a)) ? b : a);
            };
            border = [...new Set([pick('x', -1), pick('x', 1), pick('y', -1), pick('y', 1)].filter(Boolean))];
        }
        return { border, bb };
    }

    _mosaicOrigin() {
        if (this._sortOriginOverride) return { x: this._sortOriginOverride.x, y: this._sortOriginOverride.y };   // V6.96: Fliesen-Nullpunkt
        const o = (this.settings && this.settings.originSet && this.settings.origin) ? this.settings.origin : { x: 0, y: 0 };
        return { x: o.x, y: o.y };
    }

    /** Greedy Nearest-Neighbor ab pos; offene Linien ggf. umgedreht (in `reversed` vermerkt). */
    _mosaicNearest(pool, pos, reversed) {
        const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        const rest = [...pool], out = [];
        while (rest.length) {
            let bi = 0, bd = Infinity, brev = false;
            rest.forEach((it, i) => {
                const pts = it.contour.points;
                const dS = d2(pos, pts[0]);
                if (dS < bd) { bd = dS; bi = i; brev = false; }
                if (!it.contour.isClosed) {
                    const dE = d2(pos, pts[pts.length - 1]);
                    if (dE < bd) { bd = dE; bi = i; brev = true; }
                }
            });
            const best = rest.splice(bi, 1)[0];
            if (brev) { best.contour.points.reverse(); best.contour.invalidate?.(); reversed.push(best.contour); }
            const pts = best.contour.points;
            pos = best.contour.isClosed ? pts[0] : pts[pts.length - 1];
            out.push(best);
        }
        return { sorted: out, pos };
    }

    /**
     * V6.88: Mosaik-Sortierung. Randkontur der Fliese IMMER zuletzt; alle Konturen davor
     * Nearest-Neighbor ab Nullpunkt (offene Linien in der naeheren Richtung).
     */
    sortMosaic(cuttable) {
        if (cuttable.length < 2) return;
        const { border } = this._mosaicDetectBorder(cuttable);
        const bset = new Set(border);
        const inner = cuttable.filter(it => !bset.has(it));
        const reversed = [];
        const a = this._mosaicNearest(inner, this._mosaicOrigin(), reversed);
        const b = this._mosaicNearest(border, a.pos, reversed);
        cuttable.length = 0;
        cuttable.push(...a.sorted, ...b.sorted);
        this._lastReversedContours = reversed;
        console.log(`[SORT V6.89] Mosaik: ${inner.length} innen, ${border.length} Rand (zuletzt), ${reversed.length} umgekehrt`);
    }

    /**
     * V6.89: Mosaik-Maeander. Parallele, durchgehende Innenlinien (Ende < `tol` vom Fliesenrand) werden
     * pro Richtung zu EINER Kontur verkettet: Linien laufen `reserve` mm ueber die Fliesenkante hinaus,
     * dort verbindet ein Halbkreis (r = Linienabstand/2) die Nachbarlinien. Spart Anstiche + Eilgaenge.
     * Erwartet eine Opferplatte unter der Fliese. Rand bleibt als letzte Kontur.
     * @returns {{order:Array, added:Array, removed:Set, reversed:Array, stats:Object}|null}
     */
    _planMosaicMeander(cuttable, opt = {}) {
        const reserve = opt.reserve ?? 3, tol = opt.tol ?? 10, maxR = opt.maxR ?? 30, minR = opt.minR ?? 1.5;
        const axTol = 1e-3;
        const { border } = this._mosaicDetectBorder(cuttable);
        if (border.length === 0) return null;
        const bset = new Set(border);
        const T = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
        for (const it of border) {
            const b = this._mosaicBBox(it.contour);
            T.x0 = Math.min(T.x0, b.x0); T.x1 = Math.max(T.x1, b.x1);
            T.y0 = Math.min(T.y0, b.y0); T.y1 = Math.max(T.y1, b.y1);
        }

        const groups = { V: [], H: [] };
        const others = [];
        for (const it of cuttable) {
            if (bset.has(it)) continue;
            const c = it.contour, pts = c.points;
            if (!c.isClosed && pts.length === 2) {
                const [p, q] = pts;
                if (Math.abs(p.x - q.x) < axTol && Math.abs(p.y - q.y) > axTol) {
                    const a = Math.min(p.y, q.y), b = Math.max(p.y, q.y);
                    if (a <= T.y0 + tol && b >= T.y1 - tol) { groups.V.push({ it, c: p.x }); continue; }
                } else if (Math.abs(p.y - q.y) < axTol && Math.abs(p.x - q.x) > axTol) {
                    const a = Math.min(p.x, q.x), b = Math.max(p.x, q.x);
                    if (a <= T.x0 + tol && b >= T.x1 - tol) { groups.H.push({ it, c: p.y }); continue; }
                }
            }
            others.push(it);
        }

        // Ketten je Richtung: aufsteigend nach c, Bruch bei unpassendem Abstand
        const chains = [];
        for (const o of ['V', 'H']) {
            const arr = groups[o].sort((a, b) => a.c - b.c);
            let cur = [];
            const flush = () => { if (cur.length >= 2) chains.push({ o, lines: cur }); else others.push(...cur.map(l => l.it)); cur = []; };
            for (const l of arr) {
                if (cur.length) {
                    const r = (l.c - cur[cur.length - 1].c) / 2;
                    if (r < minR || r > maxR) flush();
                }
                cur.push(l);
            }
            flush();
        }
        if (chains.length === 0) return null;

        const reversed = [];
        const removed = new Set();
        const added = [];
        const unions = (o) => o === 'V' ? { lo: T.y0 - reserve, hi: T.y1 + reserve } : { lo: T.x0 - reserve, hi: T.x1 + reserve };
        const mk = (o, c, t) => o === 'V' ? { x: c, y: t } : { x: t, y: c };
        const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

        // Konturen vor den Maeandern (Nicht-Durchgangslinien etc.): Nearest-Neighbor ab Nullpunkt
        const pre = this._mosaicNearest(others, this._mosaicOrigin(), reversed);
        let pos = pre.pos;
        const order = [...pre.sorted.map(it => it.contour)];

        const build = (chain, startDesc, startHigh) => {
            const { o } = chain, { lo, hi } = unions(o);
            const lines = startDesc ? [...chain.lines].reverse() : chain.lines;
            const pts = [];
            let up = startHigh ? false : true;   // Fahrtrichtung entlang t
            lines.forEach((l, k) => {
                const t0 = up ? lo : hi, t1 = up ? hi : lo;
                if (k === 0) pts.push(mk(o, l.c, t0));
                // Kollinearer Mittelpunkt: ArcFitting legt sonst einen Riesenkreis durch Linienende + erste Bogenpunkte
                pts.push(mk(o, l.c, (t0 + t1) / 2));
                pts.push(mk(o, l.c, t1));
                if (k < lines.length - 1) {
                    const n = lines[k + 1], m = (l.c + n.c) / 2, r = Math.abs(n.c - l.c) / 2;
                    const s = up ? 1 : -1, dir = n.c > l.c ? -1 : 1;   // cosθ: von l nach n
                    const steps = 24;
                    for (let i = 1; i < steps; i++) {
                        const th = Math.PI * i / steps;
                        pts.push(mk(o, m + dir * r * Math.cos(th), t1 + s * r * Math.sin(th)));
                    }
                    pts.push(mk(o, n.c, t1));   // Bogenende = Start der naechsten Linie
                    up = !up;
                }
            });
            const last = lines[lines.length - 1];
            pts.push(mk(o, last.c, up ? hi : lo));
            return pts;
        };

        const remaining = [...chains];
        let nMeander = 0, nLines = 0;
        while (remaining.length) {
            let best = null;
            remaining.forEach((ch, ci) => {
                for (const desc of [false, true]) for (const high of [false, true]) {
                    const { lo, hi } = unions(ch.o);
                    const l0 = (desc ? ch.lines[ch.lines.length - 1] : ch.lines[0]);
                    const d = dist2(pos, mk(ch.o, l0.c, high ? hi : lo));
                    if (!best || d < best.d) best = { d, ci, desc, high };
                }
            });
            const ch = remaining.splice(best.ci, 1)[0];
            const pts = build(ch, best.desc, best.high);
            const first = ch.lines[0].it.contour;
            const nc = new CamContour(pts, {
                isClosed: false, cuttingMode: 'slit', layer: first.layer || '',
                name: `Mosaik-Maeander_${ch.o}${nMeander + 1}`,
                quality: first.quality, kerfWidth: first.kerfWidth, overcutLength: first.overcutLength
            });
            nc.cuttingMode = 'slit';
            ch.lines.forEach(l => removed.add(l.it.contour));
            added.push(nc);
            order.push(nc);
            pos = pts[pts.length - 1];
            nMeander++; nLines += ch.lines.length;
        }

        const b = this._mosaicNearest(border, pos, reversed);
        b.sorted.forEach(it => order.push(it.contour));
        return { order, added, removed, reversed, stats: { meanders: nMeander, lines: nLines, others: others.length } };
    }

    /** V6.89: Plan anwenden (ein Undo-Schritt: Konturen ersetzen + Reihenfolge + Richtungsumkehrungen). */
    applyMosaicMeander(cuttable) {
        const plan = this._planMosaicMeander(cuttable);
        if (!plan) {
            this.showToast('Mäander nicht möglich — keine durchgehenden, parallelen Innenlinien/Randkontur gefunden', 'warning');
            return;
        }
        const oldContours = [...this.contours];
        const oldOrder = [...this.cutOrder];
        const newContours = oldContours.filter(c => !plan.removed.has(c)).concat(plan.added);
        const newOrder = plan.order.map(c => newContours.indexOf(c));
        const reversed = [...plan.reversed];
        const app = this;
        const refresh = () => {
            app.renderer?.setContours(app.contours);
            app.updateContourPanel?.(); app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render();
        };
        const apply = () => {
            reversed.forEach(c => { if (c?.points) { c.points.reverse(); c.invalidate?.(); } });
            this.contours.splice(0, this.contours.length, ...newContours);
            app.cutOrder = [...newOrder]; refresh();
        };
        const revert = () => {
            reversed.forEach(c => { if (c?.points) { c.points.reverse(); c.invalidate?.(); } });
            this.contours.splice(0, this.contours.length, ...oldContours);
            app.cutOrder = [...oldOrder]; refresh();
        };
        // Umkehrungen wurden bereits beim Planen angewendet -> erst zurueck, dann sauber ueber apply()
        reversed.forEach(c => { c.points.reverse(); c.invalidate?.(); });
        apply();
        this._lastReversedContours = [];
        const cmd = new FunctionCommand(`Sortierung: Mosaik-Mäander`, apply, revert);
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        const st = plan.stats;
        this.showToast(`🔄 Mäander: ${st.lines} Linien → ${st.meanders} Konturen, Rand zuletzt (STRG+Z = Rückgängig)`, 'success');
        console.log('[SORT V6.89] Mosaik-Mäander', st);
    }

    sortByShortestPath(cuttable, startItem = null) {
        if (cuttable.length < 2) return;
        console.time('[SORT] sortByShortestPath');

        // Topologie-Hierarchie: Holes müssen vor ihrer Parent-Disc geschnitten werden
        const { parent: tpParent, children: tpChildren } = this._buildParentChildMap(cuttable);

        // Pending-Kinder-Count: eine Kontur ist "bereit" wenn alle ihre Kinder geschnitten sind
        const pendingCount = new Map();
        for (const item of cuttable) {
            pendingCount.set(item, (tpChildren.get(item) || []).length);
        }

        // Endpunkte vorab berechnen
        const endpoints = new Map();
        let maxX = -Infinity, maxY = -Infinity;
        for (const item of cuttable) {
            const pts = item.contour.points;
            const first = pts[0];
            const last = pts[pts.length - 1];
            endpoints.set(item, { first, last });
            const cx = (first.x + last.x) / 2;
            const cy = (first.y + last.y) / 2;
            if (cx > maxX) maxX = cx;
            if (cy > maxY) maxY = cy;
        }

        const sorted = [];
        const remaining = new Set(cuttable);
        let currentPos;

        const markDone = (item) => {
            const par = tpParent.get(item);
            if (par && pendingCount.has(par)) {
                pendingCount.set(par, pendingCount.get(par) - 1);
            }
        };

        // Startpunkt bestimmen
        if (startItem) {
            remaining.delete(startItem);
            sorted.push(startItem);
            markDone(startItem);
            currentPos = endpoints.get(startItem).last;
            console.log('[SORT] TSP ab Kontur:', startItem.contour.name || startItem.index);
        } else {
            currentPos = { x: maxX + 10, y: maxY + 10 };
        }

        let reversals = 0;
        const reversedContourRefs = [];

        while (remaining.size > 0) {
            // Nur Kandidaten deren Kinder bereits geschnitten sind (pendingCount = 0)
            let candidates = [...remaining].filter(item => pendingCount.get(item) === 0);
            if (candidates.length === 0) {
                // Fallback: kein Topologie-Constraint, verhindert Deadlock
                candidates = [...remaining];
                console.warn('[SORT] Topologie-Deadlock — Fallback auf beliebige Kontur');
            }

            let bestIdx = 0, bestDist = Infinity, bestReverse = false;

            for (let i = 0; i < candidates.length; i++) {
                const ep = endpoints.get(candidates[i]);
                const isClosed = candidates[i].contour.isClosed;

                const dxS = ep.first.x - currentPos.x;
                const dyS = ep.first.y - currentPos.y;
                const distToStart = dxS * dxS + dyS * dyS;
                if (distToStart < bestDist) { bestDist = distToStart; bestIdx = i; bestReverse = false; }

                if (!isClosed) {
                    const dxE = ep.last.x - currentPos.x;
                    const dyE = ep.last.y - currentPos.y;
                    const distToEnd = dxE * dxE + dyE * dyE;
                    if (distToEnd < bestDist) { bestDist = distToEnd; bestIdx = i; bestReverse = true; }
                }
            }

            const best = candidates[bestIdx];
            remaining.delete(best);
            sorted.push(best);
            markDone(best);

            if (bestReverse && best.contour.points) {
                best.contour.points.reverse();
                best.contour.invalidate?.();
                const ep = endpoints.get(best);
                const tmp = ep.first; ep.first = ep.last; ep.last = tmp;
                reversals++;
                reversedContourRefs.push(best.contour);
            }

            currentPos = endpoints.get(best).last;
        }

        cuttable.length = 0;
        cuttable.push(...sorted);
        this._lastReversedContours = reversedContourRefs;

        console.timeEnd('[SORT] sortByShortestPath');
        console.log(`[SORT] ${sorted.length} Konturen, ${reversals} Richtungsumkehrungen (Serpentine)`);
    }
    
    // ════════════════════════════════════════════════════════════════
    // V6.60: SCHNITTREIHENFOLGE MANUELL (Tab Reihenfolge) — die alte Schnittliste (#cut-order-list)
    // existiert seit V5.7 nicht mehr im HTML. Bedienung jetzt direkt im Bild (CAM-Standard):
    //   • Schnitte anklicken = Reihenfolge festlegen   • Auswahl: Anfang / ↑ / ↓ / Ende / auf Position N
    // Verschoben wird immer innerhalb der Fliese (Export je Fliese; Fliesen-Reihenfolge siehe Fliesenliste).
    // ════════════════════════════════════════════════════════════════

    /** Neue Schnittreihenfolge setzen (Undo/Redo) */
    _setCutOrder(newOrder, label) {
        const oldOrder = [...this.cutOrder];
        if (oldOrder.join(',') === newOrder.join(',')) return false;
        this.cutOrder = [...newOrder];
        const app = this, frozen = [...newOrder];
        const refresh = () => { app.updateCutOrderList?.(); app.updateOrderStats?.(); app.renderer?.render(); };
        this.undoManager.pushExecuted(new FunctionCommand(`Reihenfolge: ${label}`,
            () => { app.cutOrder = [...frozen]; refresh(); },
            () => { app.cutOrder = [...oldOrder]; refresh(); }));
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        refresh();
        return true;
    }

    /** Positionen der cutOrder je Fliese (Schlüssel -1 = ohne Fliese): Map<key, number[] Positionen> */
    _cutGroups() {
        const tileOf = this.getTileOfMap();
        const groups = new Map();
        this.cutOrder.forEach((ci, pos) => {
            const k = tileOf.has(ci) ? tileOf.get(ci) : -1;
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(pos);
        });
        return groups;
    }

    /** Ausgewählte Schnitte verschieben: 'first' | 'up' | 'down' | 'last' | {pos:n (1-basiert, in der Fliese)} */
    moveSelectedCuts(how) {
        const sel = new Set(this.cutOrder.filter(ci => this.contours[ci]?.isSelected));
        if (!sel.size) { this.showToast('Erst Schnitt(e) im Bild auswählen (Klick, Shift = mehrere)', 'warning'); return; }
        const order = [...this.cutOrder];
        for (const positions of this._cutGroups().values()) {
            let L = positions.map(p => order[p]);
            if (!L.some(ci => sel.has(ci))) continue;
            const S = L.filter(ci => sel.has(ci)), R = L.filter(ci => !sel.has(ci));
            if (how === 'first') L = [...S, ...R];
            else if (how === 'last') L = [...R, ...S];
            else if (how === 'up') { for (let i = 1; i < L.length; i++) if (sel.has(L[i]) && !sel.has(L[i - 1])) [L[i - 1], L[i]] = [L[i], L[i - 1]]; }
            else if (how === 'down') { for (let i = L.length - 2; i >= 0; i--) if (sel.has(L[i]) && !sel.has(L[i + 1])) [L[i], L[i + 1]] = [L[i + 1], L[i]]; }
            else if (how?.pos != null) { const at = Math.max(0, Math.min(R.length, how.pos - 1)); L = [...R.slice(0, at), ...S, ...R.slice(at)]; }
            positions.forEach((p, k) => { order[p] = L[k]; });
        }
        this._setCutOrder(order, typeof how === 'string' ? how : 'Position');
    }

    /** Modus „Schnitte anklicken“: angeklickte Schnitte werden je Fliese an den Anfang gesetzt, in Klick-Reihenfolge */
    startCutSeq() {
        if (!this.cutOrder?.length) { this.showToast('Keine Schnitte vorhanden', 'warning'); return; }
        if (this.tileSeqMode) this.endTileSeq(false);
        this.cutSeqMode = true; this.cutSeq = [];
        this._cutSeqKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.endCutSeq(true); }
            else if (e.key === 'Backspace' && e.target?.tagName !== 'INPUT') { e.preventDefault(); e.stopPropagation(); this.cutSeq.pop(); this._cutSeqUI(); }
        };
        document.addEventListener('keydown', this._cutSeqKey, true);
        this.showToast('Schnitte in gewünschter Reihenfolge anklicken · Esc = übernehmen · Rücktaste = zurück', 'info');
        this._cutSeqUI();
    }

    _handleCutSeqClick(contour) {
        const ci = this.contours.indexOf(contour);
        if (ci < 0 || !this.cutOrder.includes(ci)) return;   // nur schneidbare Konturen
        if (!this.cutSeq.includes(ci)) this.cutSeq.push(ci);
        this._cutSeqUI();
    }

    _cutSeqUI() {
        const b = document.getElementById('btn-cut-seq');
        if (b) { b.textContent = this.cutSeqMode ? `✔ Fertig (${this.cutSeq.length})` : '🖱 Anklicken'; b.style.background = this.cutSeqMode ? '#0e639c' : ''; b.style.color = this.cutSeqMode ? '#fff' : ''; }
        this.renderer?.render();
    }

    endCutSeq(apply) {
        if (!this.cutSeqMode) return;
        document.removeEventListener('keydown', this._cutSeqKey, true);
        const seq = this.cutSeq || [];
        this.cutSeqMode = false; this.cutSeq = [];
        if (apply && seq.length) {
            const order = [...this.cutOrder], picked = new Set(seq);
            for (const positions of this._cutGroups().values()) {
                const L = positions.map(p => order[p]);
                const mine = seq.filter(ci => L.includes(ci));
                if (!mine.length) continue;
                const out = [...mine, ...L.filter(ci => !picked.has(ci))];
                positions.forEach((p, k) => { order[p] = out[k]; });
            }
            this._setCutOrder(order, 'angeklickt');
            this.showToast(`${seq.length} Schnitt(e) an den Anfang (je Fliese) gesetzt — STRG+Z = Rückgängig`, 'success');
        }
        this._cutSeqUI();
    }

    _bindCutOrderUI() {
        const $ = (id) => document.getElementById(id);
        $('btn-cut-seq')?.addEventListener('click', () => this.cutSeqMode ? this.endCutSeq(true) : this.startCutSeq());
        $('btn-cut-first')?.addEventListener('click', () => this.moveSelectedCuts('first'));
        $('btn-cut-up')?.addEventListener('click', () => this.moveSelectedCuts('up'));
        $('btn-cut-down')?.addEventListener('click', () => this.moveSelectedCuts('down'));
        $('btn-cut-last')?.addEventListener('click', () => this.moveSelectedCuts('last'));
        const go = () => { const n = parseInt($('cut-pos-input')?.value, 10); if (n >= 1) this.moveSelectedCuts({ pos: n }); };
        $('btn-cut-pos')?.addEventListener('click', go);
        $('cut-pos-input')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); e.stopPropagation(); });
    }

    updateCutOrderList() {
        const listEl = document.getElementById('cut-order-list');
        if (!listEl) return;
        
        if (this.cutOrder.length === 0) {
            listEl.innerHTML = '<p class="empty-hint">Keine Konturen zum Schneiden</p>';
            return;
        }
        
        // V6.96: Fliesen-Zuordnung (Badge "F2" + laufende Nummer je Fliese)
        this._ensureTilesFresh();
        this.regroupCutOrderByTile(true);   // manuelles Verschieben über Fliesengrenzen hinweg wird zurückgesetzt
        const tileOf = new Map();
        (this.tiles || []).forEach((t, ti) => t.contourIdx.forEach(ci => tileOf.set(ci, ti)));
        const perTile = new Map();
        const html = this.cutOrder.map((contourIdx, orderIdx) => {
            const c = this.contours[contourIdx];
            if (!c) return '';
            const ti = tileOf.get(contourIdx);
            const seq = ti != null ? (perTile.set(ti, (perTile.get(ti) || 0) + 1), perTile.get(ti)) : orderIdx + 1;
            const tileBadge = ti != null ? `<span class="cut-order-badge" style="background:#5d4d00;color:#ffd54f" title="Fliese ${ti + 1}">F${ti + 1}</span>` : '';
            
            const name = sanitizeHTML(c.name) || `Kontur ${contourIdx + 1}`;
            const mode = c.cuttingMode === 'hole' ? 'hole' : 'disc';
            const modeLabel = mode === 'hole' ? 'Loch' : 'Scheibe';
            
            const qColors = {
                1: '#22c55e', 2: '#3b82f6', 3: '#eab308', 4: '#f97316', 5: '#ef4444'
            };
            const color = qColors[c.quality || 2];
            
            return `
                <div class="cut-order-item" draggable="true" data-order="${orderIdx}" data-index="${contourIdx}">
                    <span class="cut-order-handle">≡</span>
                    <span class="cut-order-number">${seq}</span>
                    ${tileBadge}
                    <span class="cut-order-color" style="background: ${color}"></span>
                    <span class="cut-order-name">${name}</span>
                    <span class="cut-order-badge ${mode}">${modeLabel}</span>
                    <div class="cut-order-buttons">
                        <button class="cut-order-btn" data-action="up" title="Nach oben">↑</button>
                        <button class="cut-order-btn" data-action="down" title="Nach unten">↓</button>
                    </div>
                </div>
            `;
        }).join('');
        
        listEl.innerHTML = html;
        
        // Drag & Drop Events
        this.initDragAndDrop(listEl);
        
        // Button Events
        listEl.querySelectorAll('.cut-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.cut-order-item');
                const orderIdx = parseInt(item.dataset.order, 10);
                const action = btn.dataset.action;
                
                const oldOrder = [...this.cutOrder];
                
                if (action === 'up' && orderIdx > 0) {
                    [this.cutOrder[orderIdx], this.cutOrder[orderIdx - 1]] = 
                    [this.cutOrder[orderIdx - 1], this.cutOrder[orderIdx]];
                } else if (action === 'down' && orderIdx < this.cutOrder.length - 1) {
                    [this.cutOrder[orderIdx], this.cutOrder[orderIdx + 1]] = 
                    [this.cutOrder[orderIdx + 1], this.cutOrder[orderIdx]];
                } else {
                    return; // Nichts geändert
                }
                
                const newOrder = [...this.cutOrder];
                const app = this;
                const cmd = new FunctionCommand(
                    `Reihenfolge: ${action}`,
                    () => { app.cutOrder = [...newOrder]; app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render(); },
                    () => { app.cutOrder = [...oldOrder]; app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render(); }
                );
                this.undoManager.pushExecuted(cmd);
                this.undoManager.redoStack.length = 0;
                this.undoManager._notifyStateChange();
                
                this.updateCutOrderList();
                this.updateOrderStats();
                this.renderer?.render();
            });
        });
        
        // Klick wählt Kontur aus
        listEl.querySelectorAll('.cut-order-item').forEach(item => {
            item.addEventListener('click', () => {
                const contourIdx = parseInt(item.dataset.index, 10);
                this.contours.forEach(c => { c.isSelected = false; });
                if (this.contours[contourIdx]) {
                    this.contours[contourIdx].isSelected = true;
                }
                this.renderer?.invalidateGrips?.();
                this.renderer?.render();
                this.updateContourPanel();
            });
        });
    }
    
    initDragAndDrop(listEl) {
        let draggedItem = null;
        
        listEl.querySelectorAll('.cut-order-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                listEl.querySelectorAll('.cut-order-item').forEach(i => i.classList.remove('drag-over'));
                draggedItem = null;
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (item !== draggedItem) {
                    item.classList.add('drag-over');
                }
            });
            
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                
                if (!draggedItem || item === draggedItem) return;
                
                const fromIdx = parseInt(draggedItem.dataset.order, 10);
                const toIdx = parseInt(item.dataset.order, 10);
                
                const oldOrder = [...this.cutOrder];
                
                // Array umsortieren
                const [moved] = this.cutOrder.splice(fromIdx, 1);
                this.cutOrder.splice(toIdx, 0, moved);
                
                const newOrder = [...this.cutOrder];
                const app = this;
                const cmd = new FunctionCommand(
                    'Reihenfolge: Drag&Drop',
                    () => { app.cutOrder = [...newOrder]; app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render(); },
                    () => { app.cutOrder = [...oldOrder]; app.updateCutOrderList(); app.updateOrderStats(); app.renderer?.render(); }
                );
                this.undoManager.pushExecuted(cmd);
                this.undoManager.redoStack.length = 0;
                this.undoManager._notifyStateChange();
                
                this.updateCutOrderList();
                this.updateOrderStats();
                this.renderer?.render();
            });
        });
    }
    
    updateOrderStats() {
        let totalLength = 0;
        let travelLength = 0;
        let lastPos = this.settings.origin;
        
        this.cutOrder.forEach(idx => {
            const c = this.contours[idx];
            if (!c) return;
            
            // Schnittlänge
            totalLength += this.getContourPerimeter(c);
            
            // Verfahrweg zum Start
            if (c.points && c.points.length > 0) {
                const start = c.points[0];
                travelLength += Math.hypot(start.x - lastPos.x, start.y - lastPos.y);
                lastPos = c.points[c.points.length - 1] || start;
            }
        });
        
        const elCount = document.getElementById('order-stat-count');
        const elLength = document.getElementById('order-stat-length');
        const elTravel = document.getElementById('order-stat-travel');
        if (elCount) elCount.textContent = this.cutOrder.length;
        if (elLength) elLength.textContent = `${totalLength.toFixed(1)} mm`;
        if (elTravel) elTravel.textContent = `${travelLength.toFixed(1)} mm`;
    }
    
    // ════════════════════════════════════════════════════════════════
    // KONTUREN PANEL (Links)
    // ════════════════════════════════════════════════════════════════
    
    bindContourPanelEvents() {
        document.getElementById('btn-toggle-contours')?.addEventListener('click', () => {
            const panel = document.getElementById('contour-panel');
            panel?.classList.toggle('collapsed');
        });
        
        document.getElementById('btn-select-all')?.addEventListener('click', () => {
            this.contours.forEach(c => {
                if (!c.isReference) c.isSelected = true;
            });
            this.renderer?.invalidateGrips?.();
            this.renderer?.render();
            this.updateContourPanel();
        });

        document.getElementById('btn-select-none')?.addEventListener('click', () => {
            this.contours.forEach(c => { c.isSelected = false; });
            this.renderer?.invalidateGrips?.();
            this.renderer?.render();
            this.updateContourPanel();
        });
    }
    
    updateContourPanel() {
        const listEl = document.getElementById('contour-list-panel');
        if (!listEl) return;
        
        if (!this.contours || this.contours.length === 0) {
            listEl.innerHTML = '<p class="empty-hint">Keine Datei geladen</p>';
            const elTotal = document.getElementById('panel-stat-total');
            const elSel = document.getElementById('panel-stat-selected');
            if (elTotal) elTotal.textContent = '0';
            if (elSel) elSel.textContent = '0';
            return;
        }
        
        const html = this.contours.map((c, i) => {
            const isRef = c.isReference;
            const isOpen = !c.isClosed;
            const quality = c.quality || this.settings.quality || 2;
            const hasMicrojoints = c.microjoints && c.microjoints.length > 0;
            
            const qColors = {
                1: '#22c55e', 2: '#3b82f6', 3: '#eab308', 4: '#f97316', 5: '#ef4444'
            };
            
            let color = qColors[quality];
            if (isRef) color = '#555555';
            if (isOpen && c.cuttingMode === 'slit') color = '#FFaa00';
            else if (isOpen) color = '#888888';
            
            let badge = '', badgeClass = '';
            if (isRef) { badge = 'Ref'; badgeClass = 'ref'; }
            else if (isOpen && c.cuttingMode === 'slit') { badge = 'Slit'; badgeClass = 'slit'; }
            else if (isOpen) { badge = 'Open'; badgeClass = ''; }
            else { badge = c.cuttingMode === 'hole' ? 'Loch' : 'Disc'; badgeClass = c.cuttingMode === 'hole' ? 'hole' : 'disc'; }
            
            const microjointBadge = hasMicrojoints ? `<span class="microjoint-badge">${c.microjoints.length}⚡</span>` : '';
            
            return `
                <div class="contour-item-panel ${c.isSelected ? 'selected' : ''} ${isRef ? 'reference' : ''} ${hasMicrojoints ? 'has-microjoints' : ''}" 
                     data-index="${i}">
                    <div class="color-dot" style="background: ${color}"></div>
                    <span class="name">${sanitizeHTML(c.name) || 'K' + (i+1)}</span>
                    <span class="badge ${badgeClass}">${badge}</span>
                    ${microjointBadge}
                    <span class="delete-btn" data-index="${i}" title="Löschen">✕</span>
                </div>
            `;
        }).join('');
        
        listEl.innerHTML = html;
        
        // Stats (Panel entfernt V5.7 — null-safe)
        const elTotal = document.getElementById('panel-stat-total');
        const elSel = document.getElementById('panel-stat-selected');
        if (elTotal) elTotal.textContent = this.contours.length;
        if (elSel) elSel.textContent = this.contours.filter(c => c.isSelected).length;
        
        // Click Events
        listEl.querySelectorAll('.contour-item-panel').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) {
                    const index = parseInt(e.target.dataset.index, 10);
                    this.deleteContour(this.contours[index]);
                    return;
                }
                
                const index = parseInt(item.dataset.index, 10);
                const contour = this.contours[index];
                
                if (e.shiftKey) {
                    contour.isSelected = !contour.isSelected;
                } else if (this.currentStep === 2) {
                    this.toggleReference(contour);
                    return; // toggleReference macht eigenes Render + Panel-Update
                } else {
                    this.contours.forEach(c => { c.isSelected = false; });
                    contour.isSelected = true;
                }

                this.renderer?.invalidateGrips?.();
                this.renderer?.render();
                this.updateContourPanel();
            });
        });
    }
    
    // ════════════════════════════════════════════════════════════════
    // MESSWERKZEUG
    // ════════════════════════════════════════════════════════════════
    
    bindMeasureEvents() {
        document.getElementById('btn-measure')?.addEventListener('click', () => {
            this.toggleMeasureMode();
        });
    }
    
    toggleMeasureMode() {
        this.measureMode = !this.measureMode;
        this.measureStart = null;
        
        // Andere Modi beenden
        if (this.measureMode && this.startpointMode) {
            this.toggleStartpointMode();
        }
        
        const btn = document.getElementById('btn-measure');
        const indicator = document.getElementById('measure-indicator');
        const measureInfo = document.getElementById('measure-info');
        
        if (this.measureMode) {
            btn?.classList.add('active');
            document.getElementById('ct-measure')?.classList.add('active');
            if (indicator) indicator.style.display = 'inline';
            this.renderer.canvas.style.cursor = 'crosshair';
            this.showToast('📏 Messmodus - Klick für Start, ESC zum Beenden', 'success');
        } else {
            btn?.classList.remove('active');
            document.getElementById('ct-measure')?.classList.remove('active');
            if (indicator) indicator.style.display = 'none';
            if (measureInfo) measureInfo.style.display = 'none';
            // Im Zeichenmodus: Cursor zurück auf crosshair
            this.renderer.canvas.style.cursor = this.toolManager?.isToolActive() ? 'crosshair' : 'default';
            this.measurements = [];
        }
        
        this.renderer.render();
    }
    
    handleMeasureClick(worldPoint) {
        const point = this.currentSnapPoint || this.currentTrackPoint || worldPoint;
        
        if (!this.measureStart) {
            this.measureStart = { x: point.x, y: point.y };
            const measureInfoEl = document.getElementById('measure-info');
            if (measureInfoEl) measureInfoEl.style.display = 'flex';
        } else {
            const p1 = this.measureStart;
            const p2 = { x: point.x, y: point.y };
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            this.measurements.push({ p1, p2, distance, dx, dy, angle });
            this.measureStart = null;
            
            this.showToast(`📏 ${distance.toFixed(2)} mm`, 'success');
            const measureInfoHide = document.getElementById('measure-info');
            if (measureInfoHide) measureInfoHide.style.display = 'none';
        }
        
        this.renderer.render();
    }
    
    updateMeasureInfo(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        document.getElementById('measure-distance').textContent = `L: ${distance.toFixed(2)} mm`;
        document.getElementById('measure-angle').textContent = `∠ ${angle.toFixed(1)}°`;
    }
    
    // ════════════════════════════════════════════════════════════════
    // KEYBOARD
    // ════════════════════════════════════════════════════════════════
    
    bindKeyboardEvents() {
        // V6.78: Shift gedrueckt = Ortho temporaer umkehren (AutoCAD)
        document.addEventListener('keydown', (e) => { if (e.key === 'Shift' && !e.repeat) this.snapManager?.setShiftOverride(true); });
        document.addEventListener('keyup', (e) => { if (e.key === 'Shift') this.snapManager?.setShiftOverride(false); });
        window.addEventListener('blur', () => this.snapManager?.setShiftOverride(false));

        document.addEventListener('keydown', (e) => {
            // V3.5: Command-Line Input hat eigene Handler — nur ESC/F-Tasten + Ctrl-Shortcuts durchlassen
            const isCmdInput = e.target.id === 'cmd-input';
            const ctrl = e.ctrlKey || e.metaKey;
            if (!isCmdInput && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
            if (isCmdInput && !ctrl && e.key !== 'Escape' && e.key !== 'F1' && e.key !== 'F2' && e.key !== 'F3' && e.key !== 'F8' && e.key !== 'F9' && e.key !== 'F10' && e.key !== 'F11' && e.key !== 'Delete') return;

            const shift = e.shiftKey;
            
            // V3.5: Auto-Focus — Tastatureingabe landet automatisch in cmd-input
            // Gilt IMMER (nicht nur im Draw-Mode), außer bei Spezial-Tasten
            if (!isCmdInput && !ctrl && !e.altKey && e.key.length === 1 && e.key !== ' ') {
                const cmdInput = document.getElementById('cmd-input');
                const cmdHasText = cmdInput && cmdInput.value.length > 0;
                
                // V3.9: Wenn cmd-input bereits Text hat → IMMER dorthin routen
                // (ermöglicht Multi-Char-Befehle: TX, EL, SP, DO, CL2D, DTEXT, etc.)
                if (cmdHasText) {
                    cmdInput.focus();
                    return;
                }
                
                // V4.1: ALLE Zeichen an cmd-input routen (AutoCAD-Stil)
                // Kein sofortiges Auslösen — Befehl wird erst bei Enter/Space ausgeführt
                // Damit funktionieren Multi-Char-Befehle: LE, EX, CH, AR, BO, ZF etc.
                if (cmdInput) {
                    e.preventDefault();
                    cmdInput.focus();
                    cmdInput.value += e.key;
                    cmdInput.dispatchEvent(new Event('input'));
                    return;
                }
            }
            
            switch (e.key) {
                // V4.1: Enter/Space → cmd-input absenden oder Tool beenden
                case 'Enter':
                case ' ': {
                    // V3.16: Space-Pan aktiv → nicht an cmd-input/Tool routen
                    if (e.key === ' ' && this.renderer?._isSpacePanning) break;

                    const cmdInput2 = document.getElementById('cmd-input');
                    const cmdVal = cmdInput2?.value?.trim() || '';
                    const onCmdInput = e.target.id === 'cmd-input';

                    if (!onCmdInput && cmdVal !== '') {
                        // Text in cmd-input aber Fokus woanders → absenden
                        e.preventDefault();
                        // Simuliere Enter auf cmd-input
                        cmdInput2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: false }));
                    } else if (!onCmdInput && cmdVal === '' && this.toolManager?.isToolActive()) {
                        // Leerer cmd-input + Tool aktiv → Tool beenden/bestätigen
                        e.preventDefault();
                        this.toolManager._handleEnter();
                    }
                    break;
                }
                    
                // V3.5: F2 = Zeichenmodus Toggle (Backward-Kompatibilität, fokussiert cmd-input)
                case 'F2':
                    e.preventDefault();
                    this.toggleDrawMode();
                    break;
                    
                // V3.5: F3 = Messmodus (vorher M)
                case 'F3':
                    e.preventDefault();
                    this.toggleMeasureMode();
                    break;
                    
                // V3.5: Ortho-Modus Toggle
                case 'F8':
                    e.preventDefault();
                    if (this.snapManager) {
                        const ortho = this.snapManager.toggleOrtho();
                        this._syncTrackingToggles();
                        this.showToast(ortho ? '⊞ Ortho EIN' : '⊞ Ortho AUS', 'info');
                    }
                    break;

                // V6.78: AutoCAD-Standard — F9 Rasterfang, F10 Polar-Tracking, F11 Objektfang-Tracking
                case 'F9':
                    e.preventDefault();
                    this.toggleGridSnapMode();
                    break;
                case 'F10':
                    e.preventDefault();
                    this.togglePolarTracking();
                    break;
                case 'F11':
                    e.preventDefault();
                    this.toggleObjectSnapTracking();
                    break;
                    
                // V5.10: F1 = Shortcut-Hilfe
                case 'F1':
                    e.preventDefault();
                    this.showShortcutDialog();
                    break;

                case 'Escape':
                    // V6.78: Erfasste Tracking-Punkte verwerfen
                    this.snapManager?.clearTracking();
                    // V3.5: Tool abbrechen → Messmodus beenden → Selektion aufheben
                    if (this.toolManager?.isToolActive()) {
                        this.toolManager.cancelTool();
                        break;
                    }
                    if (this.measureMode) {
                        this.toggleMeasureMode();
                        break;
                    }
                    if (this.startpointMode) {
                        this.toggleStartpointMode();
                        break;
                    }
                    // Selektion aufheben
                    this.contours.forEach(c => { c.isSelected = false; });
                    this.renderer?.invalidateGrips?.();
                    this.renderer?.render();
                    this.updateContourPanel();
                    this.hideContextMenu();
                    break;
                    
                case 'Delete':
                    if (!ctrl) {
                        // V3.5: DEL = Erase Tool (mit Undo)
                        const selected = this.contours.filter(c => c.isSelected && !c.isReference);
                        if (selected.length > 0) {
                            e.preventDefault();
                            this.toolManager?.startTool('ERASE');
                        }
                    }
                    break;
                    
                // V4.0: F = Fillet (nicht mehr FitToContent)
                // FitToContent jetzt via Home-Taste oder Doppelklick Mausrad
                case 'Home':
                    if (!ctrl) { e.preventDefault(); this.renderer?.fitToContent(); }
                    break;
                    
                case '+':
                case '=':
                    this.renderer?.zoomIn();
                    break;
                    
                case '-':
                    this.renderer?.zoomOut();
                    break;
                    
                case 'a':
                case 'A':
                    if (ctrl) {
                        e.preventDefault();
                        this.contours.forEach(c => { if (!c.isReference) c.isSelected = true; });
                        this.renderer?.invalidateGrips?.();
                        this.renderer?.render();
                        this.updateContourPanel();
                    }
                    break;
                    
                // ── Undo/Redo/Clipboard (V1.0) ──
                case 'z':
                case 'Z':
                    if (ctrl) {
                        e.preventDefault();
                        if (e.shiftKey) {
                            if (this.undoManager.redo()) this._refreshAfterUndoRedo();
                        } else {
                            if (this.undoManager.undo()) this._refreshAfterUndoRedo();
                        }
                    }
                    break;
                    
                case 'y':
                case 'Y':
                    if (ctrl) {
                        e.preventDefault();
                        if (this.undoManager.redo()) this._refreshAfterUndoRedo();
                    }
                    break;
                    
                case 'c':
                case 'C':
                    if (ctrl) {
                        e.preventDefault();
                        this.clipboardManager.copy(); // STRG+C = Copy
                    }
                    break;
                    
                case 'x':
                case 'X':
                    if (ctrl) {
                        e.preventDefault();
                        this.clipboardManager.cut(); // STRG+X = Cut
                    }
                    break;
                    
                case 'v':
                case 'V':
                    if (ctrl) {
                        e.preventDefault();
                        this.clipboardManager.paste(); // STRG+V = Paste
                    }
                    break;
                
                // V3.8: DXF Speichern
                case 's':
                case 'S':
                    if (ctrl) {
                        e.preventDefault();
                        if (shift) {
                            this.saveDXFAs();  // STRG+SHIFT+S = Speichern unter
                        } else {
                            this.saveDXF();    // STRG+S = Speichern
                        }
                    }
                    break;

                // Drucken
                case 'p':
                case 'P':
                    if (ctrl) {
                        e.preventDefault();
                        if (e.shiftKey) this.startPrintSelection(); // V6.79: Strg+Shift+P = Bereich drucken
                        else this.printCanvas();
                    }
                    break;
            }
        });
    }
    
    /** UI nach Undo/Redo aktualisieren */
    _refreshAfterUndoRedo() {
        if (this.settings.intarsiaMode) this.regenerateIntarsiaContours();
        this.renderer?.render();
        this.updateContourPanel();
        this.updateCutOrderList?.();
        this.updateOrderStats?.();
    }
    
    bindCanvasEvents() {
        // ── Ribbon Ansicht-Buttons ──
        document.getElementById('btn-zoom-in')?.addEventListener('click', () => this.renderer?.zoomIn());
        document.getElementById('btn-zoom-out')?.addEventListener('click', () => this.renderer?.zoomOut());
        document.getElementById('btn-zoom-fit')?.addEventListener('click', () => this.renderer?.fitToContent());
        document.getElementById('btn-toggle-grid')?.addEventListener('click', () => this._toggleGrid());

        // ── V3.11: Floating Canvas Toolbar ──
        document.getElementById('ct-zoom-in')?.addEventListener('click', () => this.renderer?.zoomIn());
        document.getElementById('ct-zoom-out')?.addEventListener('click', () => this.renderer?.zoomOut());
        document.getElementById('ct-fit')?.addEventListener('click', () => this.renderer?.fitToContent());
        document.getElementById('ct-grid')?.addEventListener('click', () => this._toggleGrid());
        document.getElementById('ct-measure')?.addEventListener('click', () => this.toggleMeasureMode());
        document.getElementById('ct-delete')?.addEventListener('click', () => {
            if (this.toolManager) this.toolManager.startTool('E');
        });

        // Grid-Button Initialzustand
        if (this.renderer) {
            const active = this.renderer.gridEnabled;
            document.getElementById('ct-grid')?.classList.toggle('active', active);
        }

        // ── V3.11: Linie-Flyout (Linie / Polylinie / XLine) ──
        this._initLineFlyout();
    }

    /** Toggle grid on/off – sync Ribbon + Floating Toolbar */
    _toggleGrid() {
        if (!this.renderer) return;
        this.renderer.gridEnabled = !this.renderer.gridEnabled;
        const active = this.renderer.gridEnabled;
        document.getElementById('ct-grid')?.classList.toggle('active', active);
        this.renderer.render();
    }

    /** Linie-Flyout: Rechtsklick auf Linie-Button → Untermenü */
    _initLineFlyout() {
        const lineBtn = document.querySelector('.ribbon-btn-lg[data-tool="L"]');
        const lineFlyout = document.getElementById('line-flyout');
        if (!lineBtn || !lineFlyout) return;

        // Rechtsklick öffnet Flyout
        lineBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = lineBtn.getBoundingClientRect();
            lineFlyout.style.left = (rect.right + 2) + 'px';
            lineFlyout.style.top = rect.top + 'px';
            lineFlyout.style.display = 'block';
        });

        // Klick auf ▾-Label öffnet auch Flyout
        const label = lineBtn.querySelector('.label');
        if (label) {
            label.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = lineBtn.getBoundingClientRect();
                lineFlyout.style.left = (rect.right + 2) + 'px';
                lineFlyout.style.top = rect.top + 'px';
                lineFlyout.style.display = lineFlyout.style.display === 'block' ? 'none' : 'block';
            });
        }

        // Flyout-Items
        lineFlyout.querySelectorAll('.flyout-item').forEach(item => {
            item.addEventListener('click', () => {
                const mode = item.dataset.lineMode;
                lineFlyout.style.display = 'none';
                if (this.toolManager && mode) this.toolManager.startTool(mode);
            });
            item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.1)');
            item.addEventListener('mouseleave', () => item.style.background = '');
        });

        // Klick außerhalb schließt Flyout
        document.addEventListener('click', (e) => {
            if (!lineFlyout.contains(e.target) && !lineBtn.contains(e.target)) {
                lineFlyout.style.display = 'none';
            }
        });
    }
    
    // ════════════════════════════════════════════════════════════════
    // NAVIGATION
    // ════════════════════════════════════════════════════════════════
    
    bindNavigationEvents() {
        document.querySelectorAll('.step-item').forEach(item => {
            item.addEventListener('click', () => {
                const step = parseInt(item.dataset.step, 10);
                if (this.canGoToStep(step)) {
                    this.goToStep(step);
                }
            });
        });
        
        document.getElementById('btn-prev').addEventListener('click', () => this.prevStep());
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
    }
    
    canGoToStep(step) {
        if (step < this.currentStep) return true;
        if (step === 1) return true;
        // Steps 2-3 immer erreichbar, ab Step 4 braucht man Konturen
        if (step >= 4 && !this.contours.length) return false;
        return step <= this.currentStep + 1;
    }

    /** V6.0: Validierung beim Vorwärts-Navigieren — warnt bei fehlenden Voraussetzungen */
    _validateStepTransition(fromStep, toStep) {
        // Vorwärts-Validierung: Step 3→4 braucht geschlossene Konturen
        if (toStep >= 4 && fromStep < 4) {
            const closedCount = this.contours.filter(c => c.isClosed && !c.isReference).length;
            if (closedCount === 0) {
                this.showToast('Keine geschlossenen Konturen vorhanden — Schneiden erfordert geschlossene Formen', 'warning');
                return false;
            }
            // Nullpunkt prüfen
            if (!this.settings.origin && !this.contours.some(c => c.isReference)) {
                this.showToast('Nullpunkt nicht gesetzt — bitte in Step 3 festlegen', 'warning');
                // Warnung, aber kein Block — Bediener kann trotzdem weiter
            }
        }
        // Step 4→5: Schneidparameter prüfen
        if (toStep >= 5 && fromStep < 5) {
            const unassigned = this.contours.filter(c => !c.isReference && c.isClosed && !c.cuttingMode);
            if (unassigned.length > 0) {
                this.showToast(`${unassigned.length} Kontur(en) ohne Schneidmodus (disc/hole) — Pipeline erneut ausführen`, 'warning');
            }
        }
        return true;
    }

    goToStep(step) {
        if (step < 1 || step > this.totalSteps) return;
        this.currentStep = step;
        this.updateStepUI();
        this.onStepEnter(step);
    }

    nextStep() {
        if (this.currentStep >= 4 && !this.contours.length) {
            this.showToast('Bitte laden oder zeichnen Sie zuerst Konturen', 'warning');
            return;
        }
        // V6.0: Validierung vor Schrittwechsel
        if (!this._validateStepTransition(this.currentStep, this.currentStep + 1)) {
            return;
        }
        if (this.currentStep < this.totalSteps) {
            this.goToStep(this.currentStep + 1);
        }
    }
    
    prevStep() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    }
    
    updateStepUI() {
        document.querySelectorAll('.step-item').forEach((item, i) => {
            const step = i + 1;
            item.classList.remove('active', 'completed', 'locked');
            
            if (step < this.currentStep) {
                item.classList.add('completed');
            } else if (step === this.currentStep) {
                item.classList.add('active');
            } else if (!this.canGoToStep(step)) {
                item.classList.add('locked');
            }
        });
        
        document.querySelectorAll('.step-connector').forEach((conn, i) => {
            conn.classList.toggle('completed', i < this.currentStep - 1);
        });
        
        document.querySelectorAll('.step-content').forEach(content => {
            const step = parseInt(content.dataset.step, 10);
            content.classList.toggle('active', step === this.currentStep);
        });
        
        document.getElementById('btn-prev').disabled = this.currentStep === 1;
        document.getElementById('btn-next').textContent = this.currentStep === this.totalSteps ? '✓ Fertig' : 'Weiter →';
        
        // Wizard-Indikator aktualisieren
        const stepToRibbon = { 1: 'file', 2: 'file', 3: 'file', 4: 'bearbeitung', 5: 'order', 6: 'export' };   // V6.67: Setup-Tab entfaellt (Referenz/Nullpunkt im Tab Datei)
        const stepNames = ['', 'Datei laden', 'Referenz', 'Nullpunkt', 'Schneiden', 'Reihenfolge', 'Export'];
        const stepNameEl = document.getElementById('wizard-step-name');
        if (stepNameEl) stepNameEl.textContent = stepNames[this.currentStep] || '';

        // Ribbon-Tab synchronisieren (nur für Steps 2-6, Step 1 lässt den Tab wie er ist)
        const targetRibbon = stepToRibbon[this.currentStep];
        if (targetRibbon && this.currentStep > 1) {
            document.querySelectorAll('.ribbon-tab[data-ribbon]').forEach(t => {
                t.classList.toggle('active', t.dataset.ribbon === targetRibbon);
            });
            document.querySelectorAll('.ribbon-panel[data-ribbon]').forEach(p => {
                p.style.display = p.dataset.ribbon === targetRibbon ? 'flex' : 'none';
            });
        }

        // Start-Hint ausblenden sobald Konturen existieren oder Datei geladen
        const startHint = document.getElementById('start-hint');
        if (startHint && (this.fileLoaded || this.contours.length)) {
            startHint.classList.add('hidden');
        }
    }
    
    // ════════════════════════════════════════════════════════════════
    // SHORTCUT DIALOG (F1)
    // ════════════════════════════════════════════════════════════════

    showShortcutDialog() {
        const modal = document.getElementById('shortcut-modal');
        if (!modal) return;

        const body = document.getElementById('shortcut-modal-body');
        if (body && typeof TOOL_TOOLTIPS !== 'undefined') {
            const kbd = (k) => `<kbd style="background:#333;border:1px solid #555;border-radius:3px;padding:1px 6px;font-size:11px;font-family:Consolas,monospace;color:#fff;">${k}</kbd>`;
            const row = (sc, lbl) => `<tr><td style="padding:3px 0;">${kbd(sc)}</td><td style="padding:3px 6px;color:#bbb;">${lbl}</td></tr>`;

            // Gruppen aus TOOL_TOOLTIPS generieren
            const groups = { draw: [], edit: [] };
            for (const entry of Object.values(TOOL_TOOLTIPS)) {
                if (groups[entry.group]) groups[entry.group].push(entry);
            }

            const drawRows = groups.draw.map(e => row(e.shortcut, e.label)).join('');
            const editRows = groups.edit.map(e => row(e.shortcut, e.label)).join('');
            const generalRows = (typeof GENERAL_SHORTCUTS !== 'undefined' ? GENERAL_SHORTCUTS : [])
                .map(e => row(e.shortcut, e.label)).join('');
            const mouseRows = (typeof MOUSE_SHORTCUTS !== 'undefined' ? MOUSE_SHORTCUTS : [])
                .map(t => `<tr><td style="padding:3px 0;color:#bbb;" colspan="2">${t}</td></tr>`).join('');

            body.innerHTML = `
                <div>
                    <h3 style="color:#4fc3f7;font-size:13px;margin:0 0 8px;">Zeichnen</h3>
                    <table style="width:100%;border-collapse:collapse;">${drawRows}</table>
                </div>
                <div>
                    <h3 style="color:#4fc3f7;font-size:13px;margin:0 0 8px;">Bearbeiten</h3>
                    <table style="width:100%;border-collapse:collapse;">${editRows}</table>
                </div>
                <div>
                    <h3 style="color:#4fc3f7;font-size:13px;margin:0 0 8px;">Allgemein</h3>
                    <table style="width:100%;border-collapse:collapse;">${generalRows}</table>
                    <h3 style="color:#4fc3f7;font-size:13px;margin:12px 0 8px;">Maus / Trackpad</h3>
                    <table style="width:100%;border-collapse:collapse;">${mouseRows}</table>
                </div>
            `;
        }

        modal.style.display = 'flex';

        // Close handlers
        const closeBtn = document.getElementById('shortcut-modal-close');
        // Vorherige Listener des letzten Öffnens entfernen (kein Akkumulieren)
        this._shortcutModalAbort?.abort();
        const ac = new AbortController();
        this._shortcutModalAbort = ac;
        const closeModal = () => { modal.style.display = 'none'; ac.abort(); };
        closeBtn?.addEventListener('click', closeModal, { signal: ac.signal });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        }, { signal: ac.signal });

        // ESC closes
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); }, { signal: ac.signal });
    }

    onStepEnter(step) {
        // Modi beenden
        if (this.measureMode) this.toggleMeasureMode();
        if (this.startpointMode) this.toggleStartpointMode();
        
        switch (step) {
            case 1:
                if (this.renderer) this.renderer.currentMode = null;
                break;
            case 2:
                if (this.renderer) this.renderer.currentMode = 'referenz';
                this.updateContourPanel();
                const hasRef = this.contours.some(c => c.isReference);
                if (!hasRef && this.contours.length > 0) {
                    this.autoDetectReference();
                }
                break;
            case 3:
                if (this.renderer) this.renderer.currentMode = 'nullpunkt';
                this.updateOriginDisplay();
                this.updateContourPanel();
                break;
            case 4:
                if (this.renderer) this.renderer.currentMode = 'anschuss';
                this.refreshTiles(true);   // V6.95
                // Undo-fähig: Snapshot vor dem Überschreiben, Commit danach
                this._captureLeadSnapshot();
                this._applyLeadValues();
                this._commitLeadChanges();
                this._runMultiContourCollisionCheck();
                this.updateContourPanel();
                break;
            case 5:
                if (this.renderer) this.renderer.currentMode = 'reihenfolge';
                // rebuildCutOrder() wird von Add/Delete-Handlern gepflegt —
                // hier NICHT aufrufen, sonst geht jede manuelle Sortierung verloren
                if (!this.cutOrder || this.cutOrder.length === 0) this.rebuildCutOrder();
                this.updateCutOrderList();
                this.updateOrderStats();
                this.updateContourPanel();
                break;
            case 6:
                if (this.renderer) this.renderer.currentMode = null;
                this.updateExportSummary();
                break;
        }
        
        this.renderer?.render();
    }
    
    // ════════════════════════════════════════════════════════════════
    // FILE HANDLING
    // ════════════════════════════════════════════════════════════════
    
    bindFileEvents() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const dropZone = document.getElementById('drop-zone');
        const canvasArea = document.getElementById('canvas-area');
        
        // File-Open: showOpenFilePicker (für DirHandle + FileHandle) oder Fallback auf <input>
        const openFile = () => this.openFilePicker();
        uploadArea?.addEventListener('click', openFile);
        dropZone?.addEventListener('click', openFile);
        document.getElementById('start-hint')?.addEventListener('click', openFile);
        document.getElementById('qa-open')?.addEventListener('click', openFile);

        fileInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) this.loadFile(e.target.files[0]);
        });

        // Server-DXF-Browse Button
        document.getElementById('btn-server-dxf')?.addEventListener('click', () => {
            this.dxfBrowser?.open();
        });

        canvasArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone?.classList.add('visible');
        });

        canvasArea?.addEventListener('dragleave', (e) => {
            if (!canvasArea.contains(e.relatedTarget)) {
                dropZone?.classList.remove('visible');
            }
        });

        canvasArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('visible');
            if (e.dataTransfer?.files[0]) {
                this.loadFile(e.dataTransfer.files[0]);
            }
        });

        document.getElementById('btn-apply-layers')?.addEventListener('click', () => {
            this.applyLayerSelection();
        });

        // Save-Buttons
        document.getElementById('btn-save-dxf')?.addEventListener('click', () => this.saveDXF());
        document.getElementById('btn-save-dxf-as')?.addEventListener('click', () => this.saveDXFAs());
        document.getElementById('qa-save')?.addEventListener('click', () => this.saveDXF());

        // Print-Button
        document.getElementById('qa-print')?.addEventListener('click', () => this.printCanvas());
        document.getElementById('qa-print-area')?.addEventListener('click', () => this.startPrintSelection());

        // Undo/Redo-Buttons (V6.9)
        document.getElementById('btn-undo')?.addEventListener('click', () => {
            if (this.undoManager.undo()) this._refreshAfterUndoRedo();
        });
        document.getElementById('btn-redo')?.addEventListener('click', () => {
            if (this.undoManager.redo()) this._refreshAfterUndoRedo();
        });
    }
    
    /** File-Open: showOpenFilePicker (für DirHandle + FileHandle) oder Fallback auf <input> (V6.20) */
    async openFilePicker() {
        const fileInput = document.getElementById('file-input');
        if (window.showOpenFilePicker) {
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    id: 'ceracut-dxf',
                    startIn: this._lastDirHandle || 'documents'
                });
                const file = await fileHandle.getFile();
                // Handle erst NACH Tab-Erzeugung setzen (loadDXFContent), sonst schreibt
                // _captureFromApp es in den alten Tab → Strg+S überschreibt falsche Datei
                this.loadFile(file, fileHandle);
                console.log('[App] DXF geöffnet via File Picker, Handle gespeichert');
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn('[App] showOpenFilePicker fehlgeschlagen, Fallback:', err);
            }
        }
        fileInput?.click();
    }

    loadFile(file, fileHandle = null) {
        if (!file.name.toLowerCase().endsWith('.dxf')) {
            this.showToast('Bitte eine DXF-Datei auswählen', 'error');
            return;
        }

        const reader = new FileReader();

        reader.onerror = () => {
            this.showToast('Datei konnte nicht gelesen werden', 'error');
        };

        reader.onload = (e) => {
            console.timeEnd('[PERF] FileReader.readAsText');
            // Encoding nach $ACADVER: AC1021+ (AutoCAD 2007+) = UTF-8, älter = ISO-8859-1
            const buf = e.target.result;
            const head = new TextDecoder('iso-8859-1').decode(new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536)));
            const ver = head.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d+)/);
            const isUtf8 = ver && parseInt(ver[1], 10) >= 1021;
            let text = new TextDecoder(isUtf8 ? 'utf-8' : 'iso-8859-1').decode(buf);
            // \U+XXXX-Escapes (Text-Entities) zu Unicode dekodieren
            text = text.replace(/\\U\+([0-9A-Fa-f]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
            this.loadDXFContent(file.name, text, (file.size / 1024).toFixed(1), fileHandle);
        };

        console.time('[PERF] FileReader.readAsText');
        reader.readAsArrayBuffer(file);
    }

    /**
     * Lädt DXF-Content aus beliebiger Quelle (File, Server-Browse, etc.)
     * @param {string} filename - Dateiname (z.B. "Teil.dxf")
     * @param {string} content - DXF-Dateiinhalt als String
     * @param {string} sizeKB - Dateigröße in KB (für Anzeige)
     */
    loadDXFContent(filename, content, sizeKB, fileHandle = null) {
        // V6.20: Jede neu geöffnete Datei bekommt einen eigenen Tab — außer dem
        // allerersten leeren Start-Tab, der einmalig wiederverwendet wird.
        this.documentManager?.ensureTargetForNewFile();
        this._dxfFileHandle = fileHandle;  // gehört zum (ggf. neuen) Ziel-Tab, Strg+S
        this._dxfServerName = null;

        this.dxfFileName = filename;
        this.loadedFileName = filename;
        this.currentProjectName = filename;
        this.isDirty = false;
        this.outputFileName = filename.replace(/\.dxf$/i, '.cnc');

        this.dxfContent = content;
        console.log('[PERF] DXF content size:', (content.length / 1024).toFixed(1), 'KB');
        this.parseDXF();

        const fileStatusEl = document.getElementById('file-status');
        if (fileStatusEl) fileStatusEl.innerHTML = `
            <div class="file-loaded">
                <span class="icon">📄</span>
                <span class="name">${sanitizeHTML(filename)}</span>
                <span class="size">${sizeKB} KB</span>
            </div>
        `;

        document.getElementById('current-filename').textContent = `📄 ${filename}`;
        const planInput = document.getElementById('planname-input');
        if (planInput) planInput.value = filename.replace(/\.dxf$/i, '').toUpperCase();

        this.showToast(`${filename} geladen`, 'success');
        this.documentManager?._renderTabs();
    }

    parseDXF() {
        if (!this.dxfContent || typeof DXFParser === 'undefined') {
            this.showToast('DXF-Parser nicht verfügbar', 'error');
            return;
        }
        
        let layers = [];
        
        // Quick-Fix #4: Spinner anzeigen
        this.showParserSpinner(true, 'Parsing DXF-Datei...');
        
        // Async-Wrapper für Spinner
        setTimeout(() => {
            try {
                const tolerance = parseFloat(document.getElementById('chaining-tolerance').value) || 0.1;
                
                console.time('[PERF] DXFParser.parse');
                this.dxfResult = DXFParser.parse(this.dxfContent, {
                    chainingTolerance: tolerance,
                    applyInsUnits: true   // Zoll-DXF ($INSUNITS) auf mm umrechnen
                });
                console.timeEnd('[PERF] DXFParser.parse');
                this.deletedContourNames = new Set(); // V6.25: neuer Import, alte Loeschungen verwerfen
                
                if (!this.dxfResult || !this.dxfResult.success) {
                    this.showToast('DXF Parse-Fehler', 'error');
                    this.showParserSpinner(false);
                    return;
                }
                
                // Quick-Fix #1: Ignorierte Entities anzeigen
                if (this.dxfResult.ignoredCount > 0) {
                    const types = this.dxfResult.ignoredTypes?.join(', ') || 'Unbekannt';
                    this.showToast(
                        `⚠️ ${this.dxfResult.ignoredCount} Element(e) ignoriert: ${types}`,
                        'warning'
                    );
                    console.warn('[CeraCUT] Ignorierte Entity-Typen:', types);
                }
                
                // Quick-Fix #2: Größen-Warnung
                if (this.dxfResult.entities && this.dxfResult.entities.length > 5000) {
                    this.showToast(
                        `⚠️ Große Datei (${this.dxfResult.entities.length} Elemente)`,
                        'warning'
                    );
                }
                
                // Parser-Warnungen anzeigen
                if (this.dxfResult.warnings && this.dxfResult.warnings.length > 0) {
                    this.dxfResult.warnings.forEach(w => {
                        if (w.type === 'OPEN_CONTOURS' || w.type === 'TEXT_BBOX_FALLBACK') {
                            this.showToast(`⚠️ ${w.message}`, 'warning');
                        }
                    });
                }
                
                layers = Array.from(this.dxfResult.layers || []);
                this.selectedLayers = [...layers];
                
                // V3.8: Layer in LayerManager importieren (mit ACI-Farben aus TABLES)
                const layerColors = this.dxfResult.layerDefs?.colors || {};
                this.layerManager.importFromDXF(layers, layerColors);
                this.layerManager.updateEntityCounts(this.dxfResult.contours || []);
                
            } catch (error) {
                console.error('[CeraCUT] Parse error:', error);
                // V6.0: Benutzerfreundliche Fehlermeldungen
                const msg = this._classifyDXFError(error);
                this.showToast(msg, 'error');
                this.showParserSpinner(false);
                return;
            }
            
            // Spinner ausblenden
            this.showParserSpinner(false);
            
            if (!layers || layers.length === 0) {
                layers = [''];
            }
            
            const layerList = document.getElementById('layer-list');
            if (layerList) layerList.innerHTML = layers.map(layer => {
                const safeName = sanitizeHTML(layer);
                return `
                    <div class="layer-item">
                        <input type="checkbox" id="layer-${safeName}" value="${safeName}" checked>
                        <label for="layer-${safeName}">${safeName || '(Default)'}</label>
                    </div>
                `;
            }).join('');
            
            // V3.8: Layer werden jetzt über LayerManager gesteuert
            // document.getElementById('btn-apply-layers').style.display = 'block';
            this.fileLoaded = true;
            this.applyLayerSelection();
        }, 50); // Kleine Verzögerung damit Spinner erscheint
    }
    
    /** V6.0: DXF-Fehler in verständliche Meldungen übersetzen */
    _classifyDXFError(error) {
        const msg = error?.message || '';
        if (msg.includes('undefined') || msg.includes('null'))
            return 'DXF-Datei enthält fehlerhafte Geometrie — bitte in CAD prüfen und als R12/R14 DXF speichern';
        if (msg.includes('SPLINE') || msg.includes('spline'))
            return 'DXF enthält komplexe Splines — bitte in CAD zu Polylinien konvertieren (FLATTEN/EXPLODE)';
        if (msg.includes('encoding') || msg.includes('Encoding'))
            return 'DXF-Encoding nicht erkennbar — bitte als ASCII-DXF speichern (nicht binär)';
        if (msg.includes('memory') || msg.includes('Maximum call'))
            return 'DXF zu komplex — bitte vereinfachen (zu viele Entities) oder Toleranz erhöhen';
        return `DXF-Fehler: ${msg.substring(0, 120)}${msg.length > 120 ? '...' : ''} — bitte als DXF R12/R14 exportieren und erneut laden`;
    }

    applyLayerSelection(options = {}) {
        const checkboxes = document.querySelectorAll('#layer-list input[type="checkbox"]');
        const allContours = this.dxfResult?.contours || [];

        if (checkboxes.length === 0) {
            // Kein layer-list vorhanden → alle Layer durchlassen
            this.selectedLayers = [...new Set(allContours.map(c => c.layer || ''))];
        } else {
            this.selectedLayers = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
        }

        // V6.2: LayerManager-Sichtbarkeit als zusätzlichen Filter
        const lm = this.layerManager;
        const filteredContours = allContours.filter(c => {
            const layer = c.layer || '';
            if (!this.selectedLayers.includes(layer)) return false;
            if (lm && !lm.isVisible(layer)) return false;
            if (this.deletedContourNames?.has(c.name)) return false; // V6.25: geloeschte Konturen bleiben weg
            return true;
        });

        if (options.visibilityChange) {
            // Visibility-Toggle: Pipeline neu, aber Undo-Stack erhalten
            this._runPipelineKeepUndo(filteredContours);
        } else {
            this.runPipeline(filteredContours);
        }
    }

    /**
     * V6.2: Pipeline-Neuberechnung bei Layer-Sichtbarkeits-Wechsel.
     * Wie runPipeline(), aber OHNE Undo/Clipboard zu löschen.
     *
     * V6.25: this.contours wird hier per length=0+push IN-PLACE aktualisiert statt neu
     * zugewiesen — Commands auf dem Undo-Stack (z.B. DeleteContoursCommand) halten eine
     * Referenz auf das ORIGINALE Array. Eine Neuzuweisung haengt diese Commands aus, ihr
     * splice() greift dann auf ein verwaistes Array ohne Wirkung auf das sichtbare
     * this.contours — STRG+Z waere nach einem Sichtbarkeits-Toggle ein No-Op.
     */
    _runPipelineKeepUndo(contours) {
        if (typeof CeraCutPipeline === 'undefined') {
            this.contours.length = 0;
            this.contours.push(...contours);
            this.updateRenderer();
            return;
        }

        const enableArcFitting = document.getElementById('enable-arc-fitting')?.checked || false;
        const arcFittingTolerance = parseFloat(document.getElementById('arc-fitting-tolerance')?.value) || 0.01;

        const result = CeraCutPipeline.autoProcess(contours, {
            kerfWidth: this.settings.kerfWidth,
            quality: this.settings.quality,
            enableArcFitting,
            arcFittingTolerance,
            skipReference: true
        });

        if (result.success) {
            this.contours.length = 0;
            this.contours.push(...result.contours);
            this.updateStats?.(result);
            this.updateRenderer();
            this.updateContourPanel();
            this.rebuildCutOrder();
            this.updateStepUI?.();
            console.log(`[App V6.2] Layer-Visibility Pipeline: ${result.contours.length} Konturen neu klassifiziert`);
        }
    }
    
    runPipeline(contours) {
        console.time('[PERF] runPipeline total');
        // Undo-Historie leeren bei neuem Import
        this.undoManager?.clear();
        this.clipboardManager?.clear();
        
        if (typeof CeraCutPipeline === 'undefined') {
            this.contours = contours;
            this.updateRenderer();
            return;
        }
        
        // V3.0: Arc-Fitting Einstellungen aus UI lesen
        const enableArcFitting = document.getElementById('enable-arc-fitting')?.checked || false;
        const arcFittingTolerance = parseFloat(document.getElementById('arc-fitting-tolerance')?.value) || 0.01;

        console.time('[PERF] Pipeline.autoProcess');
        const result = CeraCutPipeline.autoProcess(contours, {
            kerfWidth: this.settings.kerfWidth,
            quality: this.settings.quality,
            enableArcFitting: enableArcFitting,
            arcFittingTolerance: arcFittingTolerance,
            skipReference: true  // V3.8: Referenz manuell per Layer, nicht automatisch
        });
        console.timeEnd('[PERF] Pipeline.autoProcess');
        
        if (result.success) {
            this.contours = result.contours;
            console.time('[PERF] updateRenderer');
            this.updateStats(result);
            this.updateRenderer();
            console.timeEnd('[PERF] updateRenderer');
            console.time('[PERF] updateContourPanel+rebuild');
            this.updateContourPanel();
            this.rebuildCutOrder();
            this.updateStepUI();
            console.timeEnd('[PERF] updateContourPanel+rebuild');
            
            // V3.1: Import-Zustand als Restore-Punkt merken (NICHT im Undo-Stack!)
            // Undo-Stack startet leer – erst echte Benutzeraktionen werden registriert
            this._importSnapshot = this.contours.map(c => 
                typeof c.clone === 'function' ? c.clone() : { ...c, points: c.points?.map(p => ({...p})) || [] }
            );
            console.log(`[UndoManager V1.0] Import-Snapshot gespeichert (${this._importSnapshot.length} Konturen, Stack bleibt leer)`);

            // V3.0: Feedback für MicroHealing
            const healStats = result.healingStats;
            if (healStats && (healStats.overlapsFixed > 0 || healStats.duplicatesRemoved > 0)) {
                this.showToast(
                    `🔧 Repariert: ${healStats.overlapsFixed || 0} Überlappungen, ${healStats.duplicatesRemoved || 0} Duplikate`,
                    'info'
                );
            }

            // V3.1: Feedback für CamPreProcessor
            const preStats = result.preProcessStats;
            if (preStats && (preStats.spikeCount > 0 || preStats.removedContours > 0 || preStats.pointsBefore > preStats.pointsAfter)) {
                const reduction = preStats.pointsBefore > 0
                    ? Math.round((1 - preStats.pointsAfter / preStats.pointsBefore) * 100) : 0;
                this.showToast(
                    `🔬 Vorverarbeitung: ${preStats.pointsBefore}→${preStats.pointsAfter} Punkte (−${reduction}%), ${preStats.removedContours} Konturen entfernt`,
                    'info'
                );
            }

            // V3.0: Feedback für Arc-Fitting
            const arcStats = CeraCutPipeline.arcFittingStats;
            if (arcStats && arcStats.totalArcs > 0) {
                const ratio = (result.contours.length > 0) ?
                    ((arcStats.totalArcs + arcStats.totalLines) / result.contours.length).toFixed(1) : '1';
                this.showToast(
                    `⭕ Arc-Fitting: ${arcStats.totalArcs} Bögen, ${arcStats.totalLines} Linien`,
                    'success'
                );
            }

            console.timeEnd('[PERF] runPipeline total');
            // V6.64 (AP4): Waricam-Workflow — Referenz + Nullpunkt laufen beim Import automatisch,
            // danach direkt in die Bearbeitung (① Loch/Scheibe ② Leads ③ Schnittfuge pruefen).
            const autoOk = this._autoSetupAfterImport();
            setTimeout(() => {
                if (autoOk) document.querySelector('.ribbon-tab[data-ribbon="bearbeitung"]')?.click();
                else this.goToStep(2);
            }, 300);
        } else if (contours.length === 0) {
            // Leere DXF-Datei — kein Fehler, nur Info
            this.contours = [];
            this.updateRenderer();
            this.updateContourPanel();
            this.showToast('Datei enthält keine Konturen', 'info');
        } else {
            this.showToast('Pipeline-Fehler: ' + (result.error || 'unbekannt'), 'error');
        }
    }
    
    /**
     * V6.64 (AP4): Automatisches Setup nach dem Import (Waricam-Workflow): Referenz erkennen und Nullpunkt
     * setzen. Nur wenn aktiviert (Checkbox "Auto beim Import") und noch nicht gesetzt. Der Import-Zustand
     * bleibt die Undo-Basis (Stack bleibt leer). Rueckgabe: true, wenn das Setup danach komplett ist.
     */
    _autoSetupAfterImport() {
        const cb = document.getElementById('chk-auto-setup');
        if (cb && !cb.checked) return false;
        if (this.isSetupComplete()) return true;
        if (!this.contours?.length) return false;
        // Einzelmeldungen von autoDetectReference() unterdruecken — es gibt EINE Zusammenfassung unten
        this.showToast = () => {};
        // Fliesen (Layer "Fliese"/"Fliesen") und vorhandene Referenzen NICHT anfassen: autoDetectReference() verkettet
        // Einzellinien und macht EINE Kontur zur Referenz -> eine Fliese verschwindet aus Schnitt/Fliesen-Erkennung.
        // Dann nur den Nullpunkt setzen (unten links der Referenzen bzw. aller Konturen), wie ein Klick auf einen Nullpunkt-Preset (Tab Datei).
        const isTileLayer = c => ['fliese', 'fliesen'].includes(String(c.layer || '').trim().toLowerCase());
        // Auch ohne Layer "Fliese": mehrere aeussere Rechtecke mit Schnitten (Fallback der Fliesen-Erkennung) = Fliesenbogen.
        // Eine Auto-Referenz wuerde dort ein Rechteck herausnehmen -> Fliese fehlt in Erkennung/Schnitt.
        let tileSheet = false;
        try { tileSheet = this._groupPartsForExport(true).length > 0; } catch (e) { /* ignore */ }
        const keepRefs = this.contours.some(c => c.isReference || isTileLayer(c)) || tileSheet;
        try {
            if (keepRefs) this.setOriginToReferenceUL();
            else this.autoDetectReference();
            this.undoManager?.clear();
        } catch (e) {
            console.warn('[App V6.64] Auto-Setup fehlgeschlagen', e);
            return false;
        } finally {
            delete this.showToast;   // zurueck auf die Prototyp-Methode
        }
        const ok = this.isSetupComplete();
        if (ok) this.showToast?.(keepRefs ? 'Auto-Setup: Nullpunkt gesetzt (Fliesen/Referenzen unveraendert) — jetzt pruefen: ① Loch/Scheibe ② Leads ③ Schnittfuge'
            : 'Auto-Setup: Referenz + Nullpunkt gesetzt — jetzt pruefen: ① Loch/Scheibe ② Leads ③ Schnittfuge', 'success');
        return ok;
    }

    updateRenderer() {
        if (!this.renderer) return;
        this.renderer.setContours(this.contours);
        this.renderer.fitToContent();
        document.getElementById('drop-zone')?.classList.remove('visible');
        document.getElementById('start-hint')?.classList.add('hidden');
    }
    
    updateStats(result) {
        const el1 = document.getElementById('stat-contours');
        const el2 = document.getElementById('stat-outer');
        const el3 = document.getElementById('stat-inner');
        if (el1) el1.textContent = result?.totalEntities || this.contours.length;
        if (el2) el2.textContent = result?.outerContours || 0;
        if (el3) el3.textContent = result?.innerContours || 0;
    }
    
    // ════════════════════════════════════════════════════════════════
    // ORIGIN
    // ════════════════════════════════════════════════════════════════
    
    bindOriginEvents() {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.setOriginPreset(btn.dataset.pos);
            });
        });
        
        document.getElementById('origin-x')?.addEventListener('change', () => this.updateOriginFromInputs());
        document.getElementById('origin-y')?.addEventListener('change', () => this.updateOriginFromInputs());
        
        document.getElementById('btn-set-origin-from-snap')?.addEventListener('click', () => {
            // V5.0: Nullpunkt-Modus togglen (wie ct-origin in Canvas-Toolbar)
            if (this.currentStep === 3 && this._originPickActive) {
                this._originPickActive = false;
                this.currentStep = this._stepBeforeOrigin || 1;
                document.getElementById('btn-set-origin-from-snap')?.classList.remove('active');
                document.getElementById('ct-origin')?.classList.remove('active');
                this.showToast('Nullpunkt-Modus beendet', 'info');
            } else {
                this._stepBeforeOrigin = this.currentStep === 3 ? (this._stepBeforeOrigin || 1) : this.currentStep;
                this._originPickActive = true;
                this.currentStep = 3;
                document.getElementById('btn-set-origin-from-snap')?.classList.add('active');
                document.getElementById('ct-origin')?.classList.add('active');
                this.showToast('Klicke auf Canvas für neuen Nullpunkt (Snap aktiv)', 'info');
            }
        });
    }
    
    setOriginFromPoint(point) {
        this.settings.origin = { x: point.x, y: point.y };
        this.settings.originSet = true;
        this.updateOriginDisplay();

        if (this.renderer?.setNullPoint) {
            this.renderer.setNullPoint(point.x, point.y);
            this.renderer.render();
        }

        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
        this.updateStepUI();
    }
    
    setOriginPreset(preset) {
        this.settings.originPreset = preset;
        
        const b = this.getReferenceBounds();
        if (!b) {
            this.showToast('Keine Konturen vorhanden', 'warning');
            return;
        }
        
        let x = 0, y = 0;
        
        switch (preset) {
            case 'top-left':     x = b.minX; y = b.maxY; break;
            case 'top-center':   x = (b.minX + b.maxX) / 2; y = b.maxY; break;
            case 'top-right':    x = b.maxX; y = b.maxY; break;
            case 'center-left':  x = b.minX; y = (b.minY + b.maxY) / 2; break;
            case 'center':       x = (b.minX + b.maxX) / 2; y = (b.minY + b.maxY) / 2; break;
            case 'center-right': x = b.maxX; y = (b.minY + b.maxY) / 2; break;
            case 'bottom-left':  x = b.minX; y = b.minY; break;
            case 'bottom-center': x = (b.minX + b.maxX) / 2; y = b.minY; break;
            case 'bottom-right': x = b.maxX; y = b.minY; break;
        }
        
        this.settings.origin = { x, y };
        this.settings.originSet = true;
        this.updateOriginDisplay();

        if (this.renderer?.setNullPoint) {
            this.renderer.setNullPoint(x, y);
            this.renderer.render();
        }

        this.showToast(`Nullpunkt: ${preset}`, 'success');
        this.updateStepUI();
    }
    
    getReferenceBounds() {
        let sources = this.contours.filter(c => c.isReference);
        // V5.0: Fallback auf ALLE Konturen wenn keine Referenz vorhanden
        if (sources.length === 0) {
            sources = this.contours.filter(c => c.points && c.points.length > 0);
        }
        if (sources.length === 0) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        sources.forEach(c => {
            const points = c.points;
            if (!points) return;
            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
        });
        
        return { minX, minY, maxX, maxY };
    }
    
    updateOriginFromInputs() {
        const x = parseFloat(document.getElementById('origin-x')?.value) || 0;
        const y = parseFloat(document.getElementById('origin-y')?.value) || 0;
        
        this.settings.origin = { x, y };
        this.settings.originSet = true;

        if (this.renderer?.setNullPoint) {
            this.renderer.setNullPoint(x, y);
            this.renderer.render();
        }
        this.updateStepUI();
    }

    updateOriginDisplay() {
        const oxEl = document.getElementById('origin-x');
        const oyEl = document.getElementById('origin-y');
        if (oxEl) oxEl.value = this.settings.origin.x.toFixed(3);
        if (oyEl) oyEl.value = this.settings.origin.y.toFixed(3);
    }
    
    setOriginToReferenceUL() {
        const bounds = this.getReferenceBounds();
        if (!bounds) return;
        
        const x = bounds.minX;
        const y = bounds.minY;
        
        this.settings.origin = { x, y };
        this.settings.originPreset = 'bottom-left';
        this.settings.originSet = true;

        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
        document.querySelector('.preset-btn[data-pos="bottom-left"]')?.classList.add('selected');

        this.updateOriginDisplay();

        if (this.renderer?.setNullPoint) {
            this.renderer.setNullPoint(x, y);
            this.renderer.render();
        }
        this.updateStepUI();
    }

    /** V6.21: Setup-Status — CAM-Funktionen nach Nullpunkt-Setzung freigeschaltet.
     *  V6.29: Referenz optional — Einzelteil-Workflow ohne Plattenrahmen muss funktionieren. */
    isSetupComplete() {
        return !!this.settings.originSet;
    }
    
    // ════════════════════════════════════════════════════════════════
    // REFERENCE
    // ════════════════════════════════════════════════════════════════
    
    bindReferenceEvents() {
        document.getElementById('btn-clear-ref')?.addEventListener('click', () => {
            const wasRef = this.contours.filter(c => c.isReference);
            if (wasRef.length === 0) return;
            const snapshot = wasRef.map(c => ({ contour: c, old: true }));
            wasRef.forEach(c => { c.isReference = false; });
            const app = this;
            const cmd = new FunctionCommand(
                'Referenz löschen',
                () => { snapshot.forEach(s => { s.contour.isReference = false; }); app.renderer?.render(); app.updateContourPanel(); app.updateStepUI(); },
                () => { snapshot.forEach(s => { s.contour.isReference = true; }); app.setOriginToReferenceUL(); app.renderer?.render(); app.updateContourPanel(); app.updateStepUI(); }
            );
            this.undoManager.pushExecuted(cmd);
            this.undoManager.redoStack.length = 0;
            this.undoManager._notifyStateChange();
            this.showToast('Referenz gelöscht (STRG+Z = Rückgängig)', 'success');
            this.renderer?.render();
            this.updateContourPanel();
            this.updateStepUI();
        });
        
        document.getElementById('btn-auto-reference')?.addEventListener('click', () => {
            this.autoDetectReference();
        });
    }
    
    /**
     * V6.83: Verkettet offene Konturen (Einzellinien) per Endpunkt-Abgleich. Entstehen dabei
     * geschlossene Schleifen, ersetzen sie die Quell-Linien (Undo-bar). Offene Reste bleiben.
     */
    _joinOpenContoursIntoClosed() {
        if (typeof DXFParser === 'undefined' || !DXFParser.chainContours || typeof CamContour === 'undefined') return;
        // Nur Linien EINES Layers verketten (Linien anderer Layer duerfen nie verbraucht werden)
        const allOpen = this.contours.filter(c => !c.isClosed && !c.isHatchContour && !c.isReference
            && c.points && c.points.length >= 2);
        const layers = [...new Set(allOpen.map(c => c.layer || ''))];
        for (const layer of layers) this._joinOpenLayer(allOpen.filter(c => (c.layer || '') === layer));
    }

    _joinOpenLayer(open) {
        if (open.length < 2) return;

        const tol = Math.max(this.settings.chainingTolerance || 0.1, 0.5);
        const entities = open.map(c => ({ points: c.points.map(p => ({ x: p.x, y: p.y })), layer: c.layer || '', isClosed: false, type: 'LINE' }));
        let chained;
        try { chained = DXFParser.chainContours(entities, tol); } catch (e) { console.warn('[V6.83] Join fehlgeschlagen', e); return; }

        const closedNew = (chained || []).filter(c => c.isClosed && c.points.length >= 3);
        if (closedNew.length === 0) return;

        // Quell-Linien je neuer Kontur: alle offenen, deren Punkte (Endpunkte) auf der neuen Kontur liegen
        const onContour = (pt, poly) => {
            for (let i = 0; i < poly.length; i++) {
                const a = poly[i], b = poly[(i + 1) % poly.length];
                const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
                let t = l2 > 0 ? ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2 : 0;
                t = Math.max(0, Math.min(1, t));
                if (Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy)) <= tol) return true;
            }
            return false;
        };
        const consumed = new Set();
        const created = [];
        for (const nc of closedNew) {
            const cam = new CamContour(nc.points, { layer: open[0].layer || 'DRAW', name: nc.name, isClosed: true });
            cam.sourceType = nc.sourceType;
            const sources = open.filter(o => !consumed.has(o) && o.points.every(p => onContour(p, nc.points)));
            if (sources.length < 2) continue;
            sources.forEach(o => consumed.add(o));
            // Klassifizierung (disc/hole) ueber Nesting
            let level = 0;
            const tp = Geometry.interiorPoint(cam.points);
            for (const ex of this.contours) {
                if (ex.isClosed && !ex.isReference && !consumed.has(ex) && ex.points?.length >= 3
                    && CeraCutPipeline._pointInPolygon(tp, ex.points)) level++;
            }
            cam.cuttingMode = level % 2 === 0 ? 'disc' : 'hole';
            cam.nestingLevel = level;
            cam.type = level % 2 === 0 ? 'OUTER' : 'INNER';
            created.push({ cam, sources });
        }
        if (created.length === 0) return;

        const app = this;
        const removed = created.flatMap(c => c.sources);
        const added = created.map(c => c.cam);
        const positions = removed.map(c => this.contours.indexOf(c));
        const cmd = new FunctionCommand(
            `${removed.length} Linien zu ${added.length} geschlossener Kontur verbunden`,
            () => {
                removed.forEach(c => { const i = app.contours.indexOf(c); if (i >= 0) app.contours.splice(i, 1); });
                app.contours.push(...added);
                app.rebuildCutOrder(); app.updateContourPanel(); app.renderer?.setContours?.(app.contours);
            },
            () => {
                added.forEach(c => { const i = app.contours.indexOf(c); if (i >= 0) app.contours.splice(i, 1); });
                removed.forEach((c, k) => app.contours.splice(Math.min(positions[k], app.contours.length), 0, c));
                app.rebuildCutOrder(); app.updateContourPanel(); app.renderer?.setContours?.(app.contours);
            }
        );
        cmd.execute?.();
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        this.snapManager?.invalidatePointsCache?.();
        this.showToast(`🔗 ${removed.length} Linien zu ${added.length} geschlossener Kontur verbunden`, 'success');
    }

    autoDetectReference() {
        const mode = document.getElementById('reference-contour-select')?.value || 'auto';
        
        // Snapshot VOR Änderung: alle bisherigen Referenz-Konturen merken
        const oldRefs = this.contours.filter(c => c.isReference);
        
        this.contours.forEach(c => { c.isReference = false; });
        
        let referenceContour = null;
        // V6.83: Fliese aus Einzellinien -> offene Konturen zu geschlossener Kontur verketten
        this._joinOpenContoursIntoClosed();
        const closedContours = this.contours.filter(c => c.isClosed === true);
        
        if (closedContours.length === 0) {
            // Undo für das Zurücksetzen, falls vorher Referenzen existierten
            if (oldRefs.length > 0) {
                const app = this;
                const cmd = new FunctionCommand(
                    'Referenz zurückgesetzt (keine geschlossenen Konturen)',
                    () => { app.contours.forEach(c => { c.isReference = false; }); app._recalcTopologyAfterReferenceChange(); },
                    () => { oldRefs.forEach(c => { c.isReference = true; }); app.setOriginToReferenceUL(); app._recalcTopologyAfterReferenceChange(); }
                );
                this.undoManager.pushExecuted(cmd);
                this.undoManager.redoStack.length = 0;
                this.undoManager._notifyStateChange();
                this.updateStepUI();
            }
            this.showToast('Keine geschlossenen Konturen für Referenz gefunden', 'warning');
            return;
        }
        
        if (mode === 'fliese') {
            referenceContour = closedContours.find(c => 
                c.layer && c.layer.toLowerCase().includes('fliese')
            );
        }
        
        if (!referenceContour && mode !== 'manual') {
            let maxArea = 0;
            closedContours.forEach(c => {
                const area = typeof c.getArea === 'function' ? 
                    Math.abs(c.getArea()) : this.computeArea(c.points);
                if (area > maxArea) {
                    maxArea = area;
                    referenceContour = c;
                }
            });
        }
        
        if (referenceContour) {
            referenceContour.isReference = true;
            this.setOriginToReferenceUL();
            
            // Undo-Command: neue Referenz vs. alte Referenzen
            const newRef = referenceContour;
            const app = this;
            const cmd = new FunctionCommand(
                `Auto-Referenz: ${referenceContour.layer || 'größte Fläche'}`,
                () => { app.contours.forEach(c => { c.isReference = false; }); newRef.isReference = true; app.setOriginToReferenceUL(); app._recalcTopologyAfterReferenceChange(); },
                () => { app.contours.forEach(c => { c.isReference = false; }); oldRefs.forEach(c => { c.isReference = true; }); if (oldRefs.length > 0) app.setOriginToReferenceUL(); app._recalcTopologyAfterReferenceChange(); }
            );
            this.undoManager.pushExecuted(cmd);
            this.undoManager.redoStack.length = 0;
            this.undoManager._notifyStateChange();

            const info = referenceContour.layer || 'größte geschlossene Fläche';
            this.showToast(`Referenz: ${info} (STRG+Z = Rückgängig)`, 'success');
            this._recalcTopologyAfterReferenceChange();
        } else {
            this.showToast('Keine passende Referenz gefunden', 'warning');
        }
    }
    
    computeArea(points) {
        if (!points || points.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area / 2);
    }

    // Hierarchie-Baum für Sortierung: direkter Parent jedes Items (kleinste enthaltende Kontur)
    _applyInsideOutSort(cuttable) {
        if (cuttable.length < 2) return;
        const { parent: ioParent, children: ioChildren } = this._buildParentChildMap(cuttable);

        const bbCenter = (item) => {
            const pts = item.contour.points;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const p of pts) {
                if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            }
            return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        };

        const visited = new Set();
        const dfsPost = (item) => {
            if (visited.has(item)) return [];
            visited.add(item);
            const kids = [...(ioChildren.get(item) || [])].sort((a, b) =>
                this.computeArea(a.contour.points) - this.computeArea(b.contour.points));
            const out = [];
            for (const kid of kids) out.push(...dfsPost(kid));
            out.push(item);
            return out;
        };

        const roots = cuttable.filter(item => ioParent.get(item) === null);
        let maxX = -Infinity, maxY = -Infinity;
        for (const r of roots) { const c = bbCenter(r); if (c.x > maxX) maxX = c.x; if (c.y > maxY) maxY = c.y; }
        let curPos = { x: maxX + 10, y: maxY + 10 };
        const remRoots = [...roots];
        const sortedRoots = [];
        while (remRoots.length > 0) {
            let bi = 0, bd = Infinity;
            for (let i = 0; i < remRoots.length; i++) {
                const c = bbCenter(remRoots[i]);
                const d = (c.x - curPos.x) ** 2 + (c.y - curPos.y) ** 2;
                if (d < bd) { bd = d; bi = i; }
            }
            const best = remRoots.splice(bi, 1)[0];
            sortedRoots.push(best);
            curPos = bbCenter(best);
        }

        const ioResult = [];
        for (const root of sortedRoots) ioResult.push(...dfsPost(root));
        for (const item of cuttable) { if (!visited.has(item)) ioResult.push(item); }

        cuttable.length = 0;
        cuttable.push(...ioResult);
    }

    _buildParentChildMap(cuttable) {
        const children = new Map();
        const parent = new Map();
        for (const item of cuttable) {
            children.set(item, []);
            parent.set(item, null);
        }
        for (const item of cuttable) {
            if (!item.contour.points || item.contour.points.length < 3) continue;
            const testPt = (typeof Geometry !== 'undefined' && Geometry.interiorPoint)
                ? Geometry.interiorPoint(item.contour.points)
                : item.contour.points[0];
            if (!testPt) continue;
            let bestParent = null, bestArea = Infinity;
            for (const candidate of cuttable) {
                if (candidate === item) continue;
                if (!candidate.contour.points || candidate.contour.points.length < 3) continue;
                if (CeraCutPipeline._pointInPolygon(testPt, candidate.contour.points)) {
                    const area = this.computeArea(candidate.contour.points);
                    if (area < bestArea) { bestArea = area; bestParent = candidate; }
                }
            }
            parent.set(item, bestParent);
            if (bestParent) children.get(bestParent).push(item);
        }
        return { parent, children };
    }
    
    // ════════════════════════════════════════════════════════════════
    // CUTTING
    // ════════════════════════════════════════════════════════════════
    
    bindCuttingEvents() {
        document.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setCuttingModeForSelected(mode);
                document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const quality = parseInt(btn.dataset.quality, 10);
                this.setQualityForSelected(quality);
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        document.getElementById('btn-apply-kerf')?.addEventListener('click', () => this.applyKerfWidth());
        document.getElementById('btn-direction-cw')?.addEventListener('click', () => this.setDirectionForSelected('cw'));
        document.getElementById('btn-direction-ccw')?.addEventListener('click', () => this.setDirectionForSelected('ccw'));
        document.getElementById('btn-direction-reverse')?.addEventListener('click', () => this.reverseDirectionForSelected());
    }
    
    // ═══════════════════════════════════════════════════
    // MACHBARKEIT / STRAHLBREITE (V6.49)
    // ═══════════════════════════════════════════════════

    runFeasibility(silent) {
        if (typeof Feasibility === 'undefined') return null;
        const kerf = parseFloat(this.settings.kerfWidth) || 0.8;
        const res = Feasibility.analyze(this.contours, kerf);
        this._feas = res;
        if (this.renderer) this.renderer.feasibilityMap = res.map;
        const n = res.counts;
        const sum = document.getElementById('feas-summary');
        if (sum) {
            sum.innerHTML = `<span style="color:#ff6b6b">${n.narrow + n.both} schmal</span> · ` +
                `<span style="color:#ffb340">${n.close + n.both} nah</span> · ` +
                `<span style="color:#8bc34a">${n.ok} ok</span> / ${n.total}`;
        }
        const kl = document.getElementById('feas-kerf');
        if (kl) kl.textContent = `Strahl ${kerf} mm`;
        this.renderer?.render();
        if (!silent) this.showToast(`Strahlbreite ${kerf} mm: ${n.narrow + n.both} zu schmal, ${n.close + n.both} zu nah, ${n.ok} ok (von ${n.total})`, n.ok === n.total ? 'success' : 'warning');
        return res;
    }

    clearFeasibility() {
        this._feas = null;
        if (this.renderer) this.renderer.feasibilityMap = null;
        const sum = document.getElementById('feas-summary');
        if (sum) { sum.textContent = 'nicht geprüft'; sum.style.color = '#888'; }
        this.renderer?.render();
    }

    selectByCriteria(crit, label) {
        const res = this.runFeasibility(true);
        if (!res) return;
        const hits = new Set(Feasibility.filter(res, crit));
        this.contours.forEach(c => { c.isSelected = hits.has(c); });
        this.renderer?.invalidateGrips?.();
        this.renderer?.render();
        this.updateContourPanel();
        this.showToast(hits.size ? `${hits.size} Konturen gewählt (${label}) — Entf löscht, STRG+Z macht rückgängig` : `Keine Kontur gefunden (${label})`, hits.size ? 'success' : 'info');
    }

    classifyByNesting() {
        const res = this.runFeasibility(true);
        if (!res) return;
        const plan = Feasibility.classifyByNesting(res).filter(x => x.contour.cuttingMode !== x.mode);
        if (plan.length === 0) { this.showToast('Scheibe/Loch passt bereits zur Schachtelung', 'info'); return; }
        this.undoManager.beginGroup('Typ aus Schachtelung');
        plan.forEach(x => {
            this.undoManager.execute(new PropertyChangeCommand(x.contour, 'cuttingMode', x.mode, () => { x.contour.invalidate?.(); }));
        });
        this.undoManager.endGroup();
        const holes = plan.filter(x => x.mode === 'hole').length;
        this.showToast(`${plan.length} Konturen gesetzt (${plan.length - holes} Scheibe, ${holes} Loch) — STRG+Z = Rückgängig`, 'success');
        this.renderer?.render();
        this.updateContourPanel();
    }

    // ═══════════════════════════════════════════════════
    // KONTUREN VEREINFACHEN (V6.50)
    // ═══════════════════════════════════════════════════

    _simpScope() {
        const sel = this.contours.filter(c => c.isSelected && !c.isReference);
        return sel.length ? { list: sel, label: `Auswahl (${sel.length})` }
                          : { list: this.contours.filter(c => !c.isReference), label: 'alle Konturen' };
    }

    _simpPreview(tol) {
        const infoEl = document.getElementById('simp-info');
        const valEl = document.getElementById('simp-tol-val');
        const applyBtn = document.getElementById('btn-simp-apply');
        const cancelBtn = document.getElementById('btn-simp-cancel');
        if (!(tol > 0)) { this._simpClear(); return; }
        if (typeof Simplify === 'undefined' || typeof Feasibility === 'undefined') return;

        const scope = this._simpScope();
        // Nachbar-/Breiten-Schutz einmalig berechnen (ueber ALLE Konturen, damit Nachbarn ausserhalb der Auswahl zaehlen)
        if (!this._simpInfo) {
            const f = Feasibility.analyze(this.contours, parseFloat(this.settings.kerfWidth) || 0.8);
            this._simpInfo = new Map(f.items.map(i => [i.contour, i]));
        }
        const res = Simplify.simplifyContours(scope.list, tol, { info: this._simpInfo });
        this._simpResult = res;
        if (this.renderer) this.renderer.simplifyPreview = res.map;
        if (valEl) valEl.textContent = tol.toFixed(2) + ' mm';
        const pct = res.before ? Math.round((1 - res.after / res.before) * 100) : 0;
        if (infoEl) {
            infoEl.textContent = res.changed
                ? `Punkte ${res.before} → ${res.after} (−${pct} %) · ${res.changed} Konturen`
                : 'Keine Kontur vereinfachbar bei dieser Toleranz';
            infoEl.style.color = res.changed ? '#4fc3f7' : '#888';
        }
        const scopeEl = document.getElementById('simp-scope');
        if (scopeEl) scopeEl.textContent = scope.label;
        if (applyBtn) applyBtn.disabled = !res.changed;
        if (cancelBtn) cancelBtn.disabled = false;
        this.renderer?.render();
    }

    _simpClear() {
        this._simpResult = null;
        this._simpInfo = null;
        if (this.renderer) this.renderer.simplifyPreview = null;
        const slider = document.getElementById('simp-tol');
        if (slider) slider.value = 0;
        const set = (id, t, color) => { const el = document.getElementById(id); if (el) { el.textContent = t; if (color) el.style.color = color; } };
        set('simp-tol-val', 'aus');
        set('simp-info', 'Regler ziehen für Vorschau', '#888');
        set('simp-scope', '');
        const a = document.getElementById('btn-simp-apply'); if (a) a.disabled = true;
        const c = document.getElementById('btn-simp-cancel'); if (c) c.disabled = true;
        this.renderer?.render();
    }

    applySimplify() {
        const res = this._simpResult;
        if (!res || !res.changed) return;
        const list = [...res.map.keys()];
        const cmd = new TransformContoursCommand(list, (c) => {
            const v = res.map.get(c);
            if (v) c.points = v.pts.map(p => ({ x: p.x, y: p.y }));
        }, `Vereinfachen (${res.changed} Konturen)`, () => {
            this.renderer?.invalidateGrips?.();
            this.renderer?.render();
            this.updateContourPanel();
        });
        this.undoManager.execute(cmd);
        const msg = `Vereinfacht: Punkte ${res.before} → ${res.after}, ${res.changed} Konturen (STRG+Z = Rückgängig)`;
        this._simpClear();
        if (this.renderer?.feasibilityMap) this.runFeasibility(true);   // Markierung aktualisieren
        this.showToast(msg, 'success');
    }

    _bindSimplifyUI() {
        const slider = document.getElementById('simp-tol');
        if (!slider) return;
        let raf = 0;
        slider.addEventListener('input', () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => this._simpPreview(parseFloat(slider.value)));
        });
        document.getElementById('btn-simp-apply')?.addEventListener('click', () => this.applySimplify());
        document.getElementById('btn-simp-cancel')?.addEventListener('click', () => this._simpClear());
    }

    _bindFeasibilityUI() {
        const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
        on('btn-feas-check', () => this.runFeasibility(false));
        on('btn-feas-clear', () => this.clearFeasibility());
        on('btn-feas-sel-narrow', () => this.selectByCriteria({ narrow: true }, 'zu schmal'));
        on('btn-feas-sel-close', () => this.selectByCriteria({ close: true }, 'zu nah'));
        on('btn-feas-nesting', () => this.classifyByNesting());
        on('btn-feas-sel-crit', () => {
            const w = parseFloat(document.getElementById('feas-width-lt')?.value);
            const a = parseFloat(document.getElementById('feas-area-lt')?.value);
            const crit = {};
            if (!isNaN(w)) crit.widthLt = w;
            if (!isNaN(a)) crit.areaLt = a;
            if (Object.keys(crit).length === 0) { this.showToast('Bitte Breite oder Fläche eintragen', 'warning'); return; }
            const label = [crit.widthLt != null ? `Breite < ${w} mm` : '', crit.areaLt != null ? `Fläche < ${a} mm²` : ''].filter(Boolean).join(', ');
            this.selectByCriteria(crit, label);
        });
    }

    setCuttingModeForSelected(mode) {
        const selected = this.contours.filter(c => c.isSelected && c.isClosed && !c.isReference);
        
        if (selected.length === 0) {
            const hasOpen = this.contours.some(c => c.isSelected && !c.isClosed && !c.isReference);
            this.showToast(hasOpen ? 'Offene Kontur: CW/CCW gilt nur für geschlossene — bitte ⇄ (Umkehren) nutzen' : 'Bitte erst Konturen auswählen', 'warning');
            return;
        }
        
        // Gruppierte Undo-Aktion
        this.undoManager.beginGroup(`Modus → ${mode === 'hole' ? 'Loch' : 'Scheibe'}`);
        selected.forEach(c => {
            this.undoManager.execute(new PropertyChangeCommand(c, 'cuttingMode', mode, () => {
                c.invalidate?.();
            }));
        });
        this.undoManager.endGroup();
        
        this.showToast(`${selected.length} Konturen: ${mode === 'hole' ? 'Loch' : 'Scheibe'} (STRG+Z = Rückgängig)`, 'success');
        this.renderer?.render();
        this.updateContourPanel();
    }
    
    setQualityForSelected(quality) {
        const selected = this.contours.filter(c => c.isSelected && !c.isReference);
        const targets = selected.length > 0 
            ? selected 
            : this.contours.filter(c => !c.isReference);
        
        if (targets.length === 0) return;
        
        const oldQuality = this.settings.quality;
        
        // Gruppierte Undo-Aktion: Alle Qualitätsänderungen als eine Einheit
        this.undoManager.beginGroup(`Qualität → Q${quality}`);
        
        targets.forEach(c => {
            this.undoManager.execute(new PropertyChangeCommand(c, 'quality', quality));
        });
        
        this.undoManager.endGroup();
        
        this.settings.quality = quality;
        this.renderer?.render();
        this.updateContourPanel();
        
        const label = selected.length > 0 
            ? `Q${quality} für ${selected.length} Konturen` 
            : `Q${quality} für alle`;
        this.showToast(`Qualität ${label} (STRG+Z = Rückgängig)`, 'success');
    }
    
    applyKerfWidth() {
        const newKerf = parseFloat(document.getElementById('kerf-width')?.value) || 0.8;
        const oldKerf = this.settings.kerfWidth;
        const targets = this.contours.filter(c => !c.isReference && c.cuttingMode !== 'none' && !c.isHatchContour);
        
        if (targets.length === 0) return;
        
        // Gruppierte Undo-Aktion
        this.undoManager.beginGroup(`Kerf → ${newKerf} mm`);
        
        targets.forEach(c => {
            this.undoManager.execute(new PropertyChangeCommand(c, 'kerfWidth', newKerf, () => {
                c.invalidate?.();
            }));
        });
        
        this.undoManager.endGroup();
        
        this.settings.kerfWidth = newKerf;
        this.renderer?.render();
        this.showToast(`Kerf: ${newKerf} mm für ${targets.length} Konturen (STRG+Z = Rückgängig)`, 'success');
    }
    
    setDirectionForSelected(direction) {
        const selected = this.contours.filter(c => c.isSelected && c.isClosed && !c.isReference);
        
        if (selected.length === 0) {
            this.showToast('Bitte erst Konturen auswählen', 'warning');
            return;
        }
        
        // Nur Konturen sammeln die tatsächlich umgekehrt werden müssen
        const toReverse = selected.filter(c => {
            if (!c.points || c.points.length < 3) return false;
            const currentCW = this.isClockwise(c.points);
            const wantCW = (direction === 'cw');
            return currentCW !== wantCW;
        });
        
        if (toReverse.length > 0) {
            this.undoManager.beginGroup(`Richtung → ${direction.toUpperCase()}`);
            
            toReverse.forEach(c => {
                this.undoManager.execute(new FunctionCommand(
                    `Richtung umkehren`,
                    () => { c.points = c.points.slice().reverse(); c.invalidate?.(); },
                    () => { c.points = c.points.slice().reverse(); c.invalidate?.(); }
                ));
            });
            
            this.undoManager.endGroup();
        }
        
        this.showToast(`${selected.length} Konturen: ${direction.toUpperCase()} (STRG+Z = Rückgängig)`, 'success');
        this.renderer?.render();
    }
    
    // Schneidrichtung umkehren — auch für offene Konturen (CW/CCW gilt nur für geschlossene)
    reverseDirectionForSelected() {
        const selected = this.contours.filter(c => c.isSelected && !c.isReference && c.points && c.points.length >= 2);
        if (selected.length === 0) {
            this.showToast('Bitte erst Konturen auswählen', 'warning');
            return;
        }
        this.undoManager.beginGroup('Richtung umkehren');
        selected.forEach(c => {
            this.undoManager.execute(new FunctionCommand(
                'Richtung umkehren',
                () => { c.points = c.points.slice().reverse(); c.invalidate?.(); },
                () => { c.points = c.points.slice().reverse(); c.invalidate?.(); }
            ));
        });
        this.undoManager.endGroup();
        this.showToast(`${selected.length} Konturen umgekehrt (STRG+Z = Rückgängig)`, 'success');
        this.renderer?.render();
    }

    isClockwise(points) {
        let sum = 0;
        for (let i = 0; i < points.length - 1; i++) {
            sum += (points[i+1].x - points[i].x) * (points[i+1].y + points[i].y);
        }
        return sum > 0;
    }
    
    // Live-Updates für Lead-Parameter
    bindLeadLiveUpdates() {
        this._leadSnapshot = null; // Snapshot vor erster Änderung
        
        // V3.14: Außen-Lead + Innen-Lead Felder
        // V5.3 Phase B: +piercing params, +dynamic lead
        const extInputs = [
            'lead-type', 'lead-in-length', 'lead-in-radius', 'lead-in-angle', 'lead-arc-angle',
            'corner-lead-type', 'corner-lead-angle', 'corner-degrade',
            'overcut-length', 'lead-out-length', 'lead-out-angle', 'overcut-at-corners', 'lead-out-type', 'lead-out-radius',
            'prefer-corners', 'piercing-type',
            'piercing-stationary-time', 'piercing-circular-radius', 'piercing-circular-time',
            'dynamic-lead-ext', 'dyn-lead-min', 'dyn-lead-max'
        ];
        const intInputs = [
            'int-lead-type', 'int-lead-in-length', 'int-lead-in-radius', 'int-lead-in-angle', 'int-lead-arc-angle',
            'int-overcut-length', 'int-lead-out-length'
        ];
        const allInputs = [...extInputs, ...intInputs];

        allInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this._captureLeadSnapshot(); // Snapshot VOR erster Änderung
                    this._applyLeadValues();      // Live-Preview
                });
                el.addEventListener('change', () => {
                    this._applyLeadValues();      // Finale Werte setzen
                    this._commitLeadChanges();    // Als Undo-Command registrieren
                });
            }
        });

        // V3.14: "= Außen" Checkbox → Settings sync + Live-Update
        document.getElementById('int-like-ext')?.addEventListener('change', (e) => {
            this.settings.internalLeadLikeExternal = e.target.checked;
            this._captureLeadSnapshot();
            this._applyLeadValues();
            this._commitLeadChanges();
            console.log('[CAM V3.14] Innen-Lead:', e.target.checked ? '= Außen (sync)' : 'eigene Parameter');
        });

        // V3.14: Material-Dicke sync
        document.getElementById('material-thickness')?.addEventListener('change', (e) => {
            this.settings.materialThickness = parseFloat(e.target.value) || 8.0;
            console.log('[CAM V3.14] Material-Dicke:', this.settings.materialThickness, 'mm');
        });

        // V4.5: Alternativ-Lead Felder (IGEMS Slot 4)
        const altInputs = [
            'alt-lead-type', 'alt-lead-in-length', 'alt-lead-in-angle',
            'alt-lead-out-length', 'alt-overcut-length'
        ];
        altInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    this._captureLeadSnapshot();
                    this._applyLeadValues();
                });
                el.addEventListener('change', () => {
                    this._applyLeadValues();
                    this._commitLeadChanges();
                });
            }
        });

        // V4.5: "Auto-Fallback" Checkbox
        document.getElementById('alt-lead-enabled')?.addEventListener('change', (e) => {
            this.settings.altLeadEnabled = e.target.checked;
            this._captureLeadSnapshot();
            this._applyLeadValues();
            this._commitLeadChanges();
            console.log('[CAM V4.5] Alternativ-Lead:', e.target.checked ? 'aktiv' : 'deaktiviert');
        });
    }
    
    /** Lead-Werte aus UI lesen (Außen-Parameter)
     *  V5.3 Phase B: +piercingType, +dynamic lead, +piercing R-params */
    _getLeadValuesFromUI() {
        const piercingType = document.getElementById('piercing-type')?.value || 'auto';
        const dynamicLead = document.getElementById('dynamic-lead-ext')?.checked || false;
        return {
            leadInType:    document.getElementById('lead-type')?.value || 'arc',
            leadInLength:  parseFloat(document.getElementById('lead-in-length')?.value) || 4.0,
            leadInRadius:  parseFloat(document.getElementById('lead-in-radius')?.value) || 2.0,
            leadInAngle:   parseFloat(document.getElementById('lead-in-angle')?.value) || 90,
            // V6.63: Bogenwinkel + Ecken-Lead (vorher kein UI-Feld)
            leadInArcAngle: parseFloat(document.getElementById('lead-arc-angle')?.value) || 90,
            cornerLeadType: document.getElementById('corner-lead-type')?.value || 'linear',
            cornerLeadAngle: (() => { const v = parseFloat(document.getElementById('corner-lead-angle')?.value); return isNaN(v) ? 0 : v; })(),
            cornerDegradeThreshold: parseFloat(document.getElementById('corner-degrade')?.value) || 60,
            overcutLength: (() => { const v = parseFloat(document.getElementById('overcut-length')?.value); return isNaN(v) ? 1.0 : v; })(),
            leadOutLength: parseFloat(document.getElementById('lead-out-length')?.value) || 4.0,
            // V5.31: eigener Ausfahrwinkel (0/leer = wie Anfahrt) + Ueberschnitt an Ecken erlauben
            leadOutAngle: (() => { const v = parseFloat(document.getElementById('lead-out-angle')?.value); return (isNaN(v) || v <= 0) ? undefined : v; })(),
            overcutAtCorners: document.getElementById('overcut-at-corners')?.checked ?? false,
            leadOutType: document.getElementById('lead-out-type')?.value || undefined,          // V6.69: '' = wie Anfahrt
            leadOutRadius: (() => { const v = parseFloat(document.getElementById('lead-out-radius')?.value); return (isNaN(v) || v <= 0) ? undefined : v; })(),
            preferCorners: document.getElementById('prefer-corners')?.checked ?? true,
            piercingType:  piercingType,
            // B.1: Piercing R-Parameter
            piercingStationaryTime: parseFloat(document.getElementById('piercing-stationary-time')?.value) || 1.5,
            piercingCircularRadius: parseFloat(document.getElementById('piercing-circular-radius')?.value) || 2.0,
            piercingCircularTime:   parseFloat(document.getElementById('piercing-circular-time')?.value) || 2.0,
            // B.2: Dynamic Lead
            leadInDynamic:    dynamicLead,
            leadInLengthMin:  dynamicLead ? (parseFloat(document.getElementById('dyn-lead-min')?.value) || 1.0) : undefined,
            leadInLengthMax:  dynamicLead ? (parseFloat(document.getElementById('dyn-lead-max')?.value) || 15.0) : undefined
        };
    }

    /** V3.14: Innen-Lead-Werte aus UI lesen (fällt auf Außen zurück wenn "= Außen") */
    _getInternalLeadValuesFromUI() {
        if (this.settings.internalLeadLikeExternal) {
            return this._getLeadValuesFromUI(); // Identisch mit Außen
        }
        const ext = this._getLeadValuesFromUI();
        return {
            leadInType:    document.getElementById('int-lead-type')?.value || ext.leadInType,
            leadInLength:  parseFloat(document.getElementById('int-lead-in-length')?.value) || ext.leadInLength,
            leadInRadius:  parseFloat(document.getElementById('int-lead-in-radius')?.value) || ext.leadInRadius,
            leadInAngle:   parseFloat(document.getElementById('int-lead-in-angle')?.value) || ext.leadInAngle,
            leadInArcAngle: parseFloat(document.getElementById('int-lead-arc-angle')?.value) || ext.leadInArcAngle,
            cornerLeadType: ext.cornerLeadType, cornerLeadAngle: ext.cornerLeadAngle, cornerDegradeThreshold: ext.cornerDegradeThreshold,   // Ecken-Lead gilt fuer Innen wie Aussen
            overcutLength: (() => { const v = parseFloat(document.getElementById('int-overcut-length')?.value); return isNaN(v) ? ext.overcutLength : v; })(),
            leadOutLength: parseFloat(document.getElementById('int-lead-out-length')?.value) || ext.leadOutLength,
            leadOutAngle: ext.leadOutAngle, overcutAtCorners: ext.overcutAtCorners, leadOutType: ext.leadOutType, leadOutRadius: ext.leadOutRadius,
            preferCorners: ext.preferCorners, // Gleiche Ecken-Präferenz für Innen
            piercingType:  ext.piercingType   // Gleicher Piercing-Typ (später per Flächenklasse überschreibbar)
        };
    }
    
    /** V4.5: Alternativ-Lead-Werte direkt aus UI lesen (IGEMS Slot 4 — Fallback bei Kollision)
     *  Liest ALLE Alt-Lead-Parameter direkt aus DOM (kein Settings-Umweg) */
    _getAlternativeLeadValuesFromUI() {
        return {
            altLeadEnabled:   this.settings.altLeadEnabled,
            altLeadType:      document.getElementById('alt-lead-type')?.value || 'linear',
            altLeadInLength:  parseFloat(document.getElementById('alt-lead-in-length')?.value) || 3.0,
            altLeadInAngle:   parseFloat(document.getElementById('alt-lead-in-angle')?.value) || 5,
            altLeadOutLength: parseFloat(document.getElementById('alt-lead-out-length')?.value) || 2.0,
            altOvercutLength: parseFloat(document.getElementById('alt-overcut-length')?.value) || 2.0
        };
    }

    /** Lead-Properties auf eine Kontur anwenden
     *  V4.5: Setzt auch Alternativ-Lead-Parameter für Fallback-Kette
     *  V5.3 Phase B: +piercing R-params, +dynamic lead, +area classes */
    _applyLeadToContour(c, vals) {
        c.leadInType = vals.leadInType;
        c.leadInLength = vals.leadInLength;
        c.leadInRadius = vals.leadInRadius;
        c.leadInAngle = vals.leadInAngle;
        c.overcutLength = vals.overcutLength;
        c.leadOutType = vals.leadOutType ?? vals.leadInType;   // V6.69: eigene Ausfahrform
        c.leadOutLength = vals.leadOutLength;
        c.leadOutRadius = vals.leadOutRadius ?? vals.leadInRadius;
        c.leadOutAngle = vals.leadOutAngle ?? vals.leadInAngle;   // V5.31: eigener Ausfahrwinkel
        c.overcutAtCorners = vals.overcutAtCorners ?? false;
        c.invalidate?.();
        c.leadInArcAngle = vals.leadInArcAngle ?? 90;     // V6.63: Bogenwinkel
        c.leadOutArcAngle = vals.leadInArcAngle ?? 90;
        c.preferCorners = vals.preferCorners;
        c.piercingType = vals.piercingType;
        // B.1: Piercing R-Parameter
        if (vals.piercingStationaryTime !== undefined) c.piercingStationaryTime = vals.piercingStationaryTime;
        if (vals.piercingCircularRadius !== undefined) c.piercingCircularRadius = vals.piercingCircularRadius;
        if (vals.piercingCircularTime !== undefined)   c.piercingCircularTime   = vals.piercingCircularTime;
        // B.2: Dynamic Lead
        if (vals.leadInDynamic !== undefined) {
            c.leadInDynamic    = vals.leadInDynamic;
            c.leadInLengthMin  = vals.leadInLengthMin;
            c.leadInLengthMax  = vals.leadInLengthMax;
        }
        // V6.44/V6.63: Corner-Lead (eigener Slot, cam-contour.js) — Felder jetzt im Ribbon (Ecke:)
        if (vals.cornerLeadType !== undefined) {
            c.cornerLeadType = vals.cornerLeadType;
            c.cornerLeadAngle = vals.cornerLeadAngle;
            c.cornerDegradeThreshold = vals.cornerDegradeThreshold;
        }
        // V4.5: Alternativ-Lead auf Kontur setzen (Undo-safe: aus altVals oder aktuellen UI-Werten)
        if (vals.altLeadEnabled !== undefined) {
            c.altLeadEnabled   = vals.altLeadEnabled;
            c.altLeadType      = vals.altLeadType;
            c.altLeadInLength  = vals.altLeadInLength;
            c.altLeadInAngle   = vals.altLeadInAngle;
            c.altLeadOutLength = vals.altLeadOutLength;
            c.altOvercutLength = vals.altOvercutLength;
        } else {
            const alt = this._getAlternativeLeadValuesFromUI();
            c.altLeadEnabled   = alt.altLeadEnabled;
            c.altLeadType      = alt.altLeadType;
            c.altLeadInLength  = alt.altLeadInLength;
            c.altLeadInAngle   = alt.altLeadInAngle;
            c.altLeadOutLength = alt.altLeadOutLength;
            c.altOvercutLength = alt.altOvercutLength;
        }
        c._cachedLeadInPath = null;
        c._cachedLeadOutPath = null;
        c._cachedOvercutPath = null;
        if (vals.preferCorners && c._rotationCount === 0) {
            c.autoPlaceStartPoint?.(this.contours);
        }
    }
    
    /** Lead-Properties einer Kontur auslesen
     *  V4.5: Inkl. Alternativ-Lead-State
     *  V5.3 Phase B: +piercing R-params, +dynamic lead */
    _readLeadFromContour(c) {
        return {
            leadInType:    c.leadInType,
            leadInLength:  c.leadInLength,
            leadInRadius:  c.leadInRadius,
            leadInAngle:   c.leadInAngle,
            leadInArcAngle: c.leadInArcAngle,
            cornerLeadType: c.cornerLeadType,
            cornerLeadAngle: c.cornerLeadAngle,
            cornerDegradeThreshold: c.cornerDegradeThreshold,
            overcutLength: c.overcutLength,
            leadOutLength: c.leadOutLength,
            preferCorners: c.preferCorners,
            piercingType:  c.piercingType,
            // B.1: Piercing R-params
            piercingStationaryTime: c.piercingStationaryTime,
            piercingCircularRadius: c.piercingCircularRadius,
            piercingCircularTime:   c.piercingCircularTime,
            // B.2: Dynamic Lead
            leadInDynamic:   c.leadInDynamic,
            leadInLengthMin: c.leadInLengthMin,
            leadInLengthMax: c.leadInLengthMax,
            // Alt-Lead
            altLeadEnabled:   c.altLeadEnabled,
            altLeadType:      c.altLeadType,
            altLeadInLength:  c.altLeadInLength,
            altLeadInAngle:   c.altLeadInAngle,
            altLeadOutLength: c.altLeadOutLength,
            altOvercutLength: c.altOvercutLength
        };
    }
    
    /** Snapshot VOR der ersten Slider-Bewegung sichern */
    _captureLeadSnapshot() {
        if (this._leadSnapshot) return; // Nur beim ersten Aufruf
        const targets = this._getLeadTargets();
        this._leadSnapshot = targets.map(c => ({ contour: c, old: this._readLeadFromContour(c) }));
    }
    
    /** Ziel-Konturen für Lead-Änderungen ermitteln */
    _getLeadTargets() {
        const selected = this.contours.filter(c => c.isSelected && !c.isReference && (c.isClosed || c.cuttingMode === 'slit'));
        return selected.length > 0 ? selected : this.contours.filter(c => !c.isReference && (c.isClosed || c.cuttingMode === 'slit'));
    }
    
    /** Lead-Werte aus UI auf Konturen anwenden (Live-Preview)
     *  V3.14: Differenziert Außen/Innen basierend auf cuttingMode
     *  V5.3 Phase B: Flächenklassen-Override für Innenkonturen */
    _applyLeadValues() {
        const extVals = this._getLeadValuesFromUI();
        const intVals = this._getInternalLeadValuesFromUI();
        const useAreaClasses = document.getElementById('use-area-classes')?.checked && this.settings.areaClasses;
        const targets = this._getLeadTargets();
        
        targets.forEach(c => {
            if (c.cuttingMode === 'hole') {
                // B.3: Flächenklassen-Override für Löcher
                if (useAreaClasses && typeof c.getMatchingAreaClass === 'function' && typeof c.applyAreaClass === 'function') {
                    const cls = c.getMatchingAreaClass(this.settings.areaClasses);
                    if (cls) {
                        c.applyAreaClass(cls);
                        console.log(`[Phase B.3] Flächenklasse angewandt auf Kontur #${c.id}: area=${c.getAreaCm2?.().toFixed(2)} cm²`);
                        return; // Flächenklasse hat alle Werte gesetzt
                    }
                }
                this._applyLeadToContour(c, intVals);
            } else {
                this._applyLeadToContour(c, extVals);
            }
        });

        this.renderer?.render();
        this._updateProfileStatus();
    }
    
    /** Backward-Compat: Falls updateLeadPreview() direkt aufgerufen wird */
    updateLeadPreview() {
        this._captureLeadSnapshot();
        this._applyLeadValues();
        this._commitLeadChanges();
    }
    
    /** Lead-Änderungen als Undo-Command registrieren (nach Slider-Release)
     *  V3.14: Speichert Außen/Innen-Werte getrennt */
    _commitLeadChanges() {
        const snapshot = this._leadSnapshot;
        this._leadSnapshot = null; // Reset für nächste Änderung
        
        if (!snapshot || snapshot.length === 0) return;
        
        const newExtVals = this._getLeadValuesFromUI();
        const newIntVals = this._getInternalLeadValuesFromUI();
        const newAltVals = this._getAlternativeLeadValuesFromUI();
        const app = this;
        
        // V4.5: Alt-Lead-Werte in Ext/Int mergen für korrektes Redo
        const extWithAlt = Object.assign({}, newExtVals, newAltVals);
        const intWithAlt = Object.assign({}, newIntVals, newAltVals);
        
        const cmd = new FunctionCommand(
            `Lead-In/Out Parameter ändern (${snapshot.length} Konturen)`,
            () => {
                snapshot.forEach(({ contour }) => {
                    const vals = (contour.cuttingMode === 'hole') ? intWithAlt : extWithAlt;
                    app._applyLeadToContour(contour, vals);
                });
                app.renderer?.render();
            },
            () => {
                snapshot.forEach(({ contour, old }) => app._applyLeadToContour(contour, old));
                app.renderer?.render();
            }
        );
        // Bereits ausgeführt, nur auf Stack legen
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();
        console.log(`[UndoManager V4.5] Lead-Parameter registriert (${snapshot.length} Konturen, Außen/Innen/Alt differenziert)`);

        // V6.41: Multi-Kontur-Kollisionsprüfung lief bisher NUR über den manuellen
        // "Multi-Collision"-Button — Smart-Placement (autoPlaceStartPoint) kennt nur die
        // EIGENE Kontur, nicht eng benachbarte Teile. Bei dicht gepackten Mustern (Intarsien-
        // Raster, enge Stege) blieben dadurch Alt-Leads/Primär-Leads unkontrolliert in
        // Nachbarteile hinein stehen. Läuft jetzt automatisch nach jedem finalen Lead-Apply.
        this._runMultiContourCollisionCheck();
    }

    /** V6.41: Multi-Kontur-Kollisionsprüfung automatisch nach Lead-Apply ausführen
     *  (bisher nur über den manuellen "Multi-Collision"-Button, siehe index.html
     *  btn-multi-collision). Mutiert Lead-Caches direkt wie der Button — kein eigener
     *  Undo-Eintrag, analog zum bisherigen manuellen Verhalten. */
    _runMultiContourCollisionCheck() {
        if (typeof CamContour === 'undefined' || !this.contours?.length) return;
        const margin = parseFloat(document.getElementById('collision-margin')?.value) || 0.5;
        const modified = CamContour.checkAllCollisions(this.contours, margin);
        if (modified > 0) {
            console.log(`[App V6.41] Auto-Multi-Collision: ${modified} Lead(s) angepasst`);
            this.renderer?.render();
        }
    }
    
    // ════════════════════════════════════════════════════════════════
    // LEAD PROFILES (V6.0)
    // ════════════════════════════════════════════════════════════════

    _initLeadProfiles() {
        if (typeof LeadProfiles === 'undefined') return;
        LeadProfiles.init();
        this._populateProfileDropdown();

        // Dropdown-Wechsel → Profil anwenden
        document.getElementById('lead-profile-select')?.addEventListener('change', (e) => {
            const id = e.target.value;
            if (id) {
                LeadProfiles.setActive(id);
                this._applyProfile(id);
            }
        });

        // Speichern-Button
        document.getElementById('btn-lead-profile-save')?.addEventListener('click', () => {
            this._saveCurrentAsProfile();
        });

        // Löschen-Button
        document.getElementById('btn-lead-profile-delete')?.addEventListener('click', () => {
            this._deleteCurrentProfile();
        });

        // Batch-Apply-Button
        document.getElementById('btn-batch-apply')?.addEventListener('click', () => {
            this._applyBatchRules();
        });

        // V6.91: Erweitert-Toggle (Zustand pro Browser merken)
        const advPanel = document.querySelector('.ribbon-panel[data-ribbon="bearbeitung"]');
        // V6.95: Fliesen erkennen (Bearbeitung-Tab)
        this._bindCutOrderUI();   // V6.60
        this._bindTileUI();   // V6.59: Fliesen-Reihenfolge (Presets, Anklicken, Drag&Drop)
        this._bindLeadSimpleUI();   // V6.70: Einfach-Ansicht (Groesse, Klartext-Zusammenfassung)
        const advBtn = document.getElementById('btn-lead-adv-toggle');
        if (advPanel && advBtn) {
            try { if (localStorage.getItem('ceracut_lead_adv') === '1') advPanel.classList.add('lead-adv-open'); } catch (e) { /* ignore */ }
            advBtn.addEventListener('click', () => {
                const open = advPanel.classList.toggle('lead-adv-open');
                try { localStorage.setItem('ceracut_lead_adv', open ? '1' : '0'); } catch (e) { /* ignore */ }
            });
        }

        // V6.47/V6.67: Technologie-Toggle (Gruppe ③ Technologie im Tab Bearbeitung)
        const techBtn = document.getElementById('btn-tech-adv-toggle');
        const techPanel = techBtn?.closest('.ribbon-panel');
        if (techPanel && techBtn) {
            try { if (localStorage.getItem('ceracut_tech_adv') === '1') techPanel.classList.add('tech-adv-open'); } catch (e) { /* ignore */ }
            techBtn.addEventListener('click', () => {
                const open = techPanel.classList.toggle('tech-adv-open');
                try { localStorage.setItem('ceracut_tech_adv', open ? '1' : '0'); } catch (e) { /* ignore */ }
            });
        }

        this._bindFeasibilityUI();
        this._bindSimplifyUI();

        // V6.48: Richtungspfeile Auto/An/Aus
        const arrowBtn = document.getElementById('btn-arrow-mode');
        if (arrowBtn && this.renderer) {
            const modes = ['auto', 'always', 'never'];
            const labels = { auto: '➤ Auto', always: '➤ An', never: '➤ Aus' };
            let mode = 'auto';
            try { const m = localStorage.getItem('ceracut_arrow_mode'); if (modes.includes(m)) mode = m; } catch (e) { /* ignore */ }
            const applyMode = () => {
                this.renderer.directionArrowMode = mode;
                arrowBtn.textContent = labels[mode];
                this.renderer.render();
            };
            arrowBtn.addEventListener('click', () => {
                mode = modes[(modes.indexOf(mode) + 1) % modes.length];
                try { localStorage.setItem('ceracut_arrow_mode', mode); } catch (e) { /* ignore */ }
                applyMode();
            });
            applyMode();
        }

        // V6.61: Schnittfugenband An/Aus (massstaebliche Fuge um Kontur, Leads, Ueberschnitt)
        const kerfBtn = document.getElementById('btn-kerf-band');
        if (kerfBtn && this.renderer) {
            let on = true;
            try { on = localStorage.getItem('ceracut_kerf_band') !== '0'; } catch (e) { /* ignore */ }
            const applyKerf = () => {
                this.renderer.showKerfBand = on;
                kerfBtn.textContent = on ? '▮ Fuge An' : '▯ Fuge Aus';
                this.renderer.render();
            };
            kerfBtn.addEventListener('click', () => {
                on = !on;
                try { localStorage.setItem('ceracut_kerf_band', on ? '1' : '0'); } catch (e) { /* ignore */ }
                applyKerf();
            });
            applyKerf();
        }

        console.debug('[App V6.0] Lead-Profile initialisiert');
    }

    _populateProfileDropdown() {
        const select = document.getElementById('lead-profile-select');
        if (!select || typeof LeadProfiles === 'undefined') return;

        const profiles = LeadProfiles.getAll();
        const active = LeadProfiles.getActive();
        const builtins = profiles.filter(p => p.isBuiltin);
        const custom = profiles.filter(p => !p.isBuiltin);

        let html = '<optgroup label="Standard">';
        builtins.forEach(p => {
            html += `<option value="${p.id}" ${p.id === active?.id ? 'selected' : ''}>${p.name}</option>`;
        });
        html += '</optgroup>';

        if (custom.length > 0) {
            html += '<optgroup label="Benutzerdefiniert">';
            custom.forEach(p => {
                html += `<option value="${p.id}" ${p.id === active?.id ? 'selected' : ''}>${p.name}</option>`;
            });
            html += '</optgroup>';
        }

        select.innerHTML = html;
    }

    _applyProfile(profileId) {
        if (typeof LeadProfiles === 'undefined') return;
        const profile = LeadProfiles.getById(profileId);
        if (!profile) return;

        // Snapshot für Undo
        this._captureLeadSnapshot();

        // Ext-Werte in UI-Felder schreiben
        this._setLeadUIValues(profile.ext, 'ext');

        // Int-like-ext prüfen: gleiche Werte → Checkbox an, sonst aus
        const intSame = profile.ext.leadInType === profile.int.leadInType &&
                        profile.ext.leadInLength === profile.int.leadInLength &&
                        profile.ext.leadInRadius === profile.int.leadInRadius &&
                        profile.ext.leadInAngle === profile.int.leadInAngle &&
                        (profile.ext.leadInArcAngle ?? 90) === (profile.int.leadInArcAngle ?? 90) &&
                        profile.ext.leadOutLength === profile.int.leadOutLength &&
                        profile.ext.overcutLength === profile.int.overcutLength;

        const intLikeExtCb = document.getElementById('int-like-ext');
        if (intLikeExtCb) {
            intLikeExtCb.checked = intSame;
            this.settings.internalLeadLikeExternal = intSame;
            // Int-Felder aktivieren/deaktivieren
            document.querySelectorAll('.int-lead-field input, .int-lead-field select').forEach(el => {
                el.disabled = intSame;
            });
        }

        // Int-Werte setzen (auch wenn disabled — werden bei Bedarf gelesen)
        this._setLeadUIValues(profile.int, 'int');

        // V6.63: Ecken-Lead aus dem Profil in die UI
        if (profile.corner) {
            const cf = { 'corner-lead-type': profile.corner.leadType, 'corner-lead-angle': profile.corner.leadAngle, 'corner-degrade': profile.corner.degradeThreshold };
            for (const [id, val] of Object.entries(cf)) { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; }
        }

        // Alt-Lead-Werte
        if (profile.alt) {
            const altEnabled = document.getElementById('alt-lead-enabled');
            if (altEnabled) altEnabled.checked = profile.alt.altLeadEnabled;
            this.settings.altLeadEnabled = profile.alt.altLeadEnabled;
            const altFields = {
                'alt-lead-type': profile.alt.altLeadType,
                'alt-lead-in-length': profile.alt.altLeadInLength,
                'alt-lead-in-angle': profile.alt.altLeadInAngle,
                'alt-lead-out-length': profile.alt.altLeadOutLength,
                'alt-overcut-length': profile.alt.altOvercutLength
            };
            for (const [id, val] of Object.entries(altFields)) {
                const el = document.getElementById(id);
                if (el) el.value = val;
            }
        }

        // Werte auf Konturen anwenden
        this._applyLeadValues();
        this._commitLeadChanges();

        this._updateProfileStatus();
        console.log(`[App V6.0] Profil angewendet: ${profile.name}`);
    }

    /** V6.70: Einfach-Ansicht der Leads — Groessen-Schnellwahl + verstaendliche Zusammenfassung */
    _bindLeadSimpleUI() {
        const SIZES = {
            s: { 'lead-in-length': 2, 'lead-in-radius': 1, 'lead-out-length': 2, 'overcut-length': 0.5 },
            m: { 'lead-in-length': 4, 'lead-in-radius': 2, 'lead-out-length': 4, 'overcut-length': 1 },
            l: { 'lead-in-length': 8, 'lead-in-radius': 4, 'lead-out-length': 8, 'overcut-length': 1.5 }
        };
        const $ = id => document.getElementById(id);
        const sel = $('lead-size');
        const NAMES = { arc: 'Bogen', linear: 'gerade', tangent: 'tangential' };
        const updateSummary = () => {
            const el = $('lead-summary');
            if (!el) return;
            const num = id => parseFloat($(id)?.value);
            const oc = num('overcut-length');
            const type = NAMES[$('lead-type')?.value] || '';
            let t = `Anschnitt: ${type}, ${isNaN(num('lead-in-length')) ? '?' : num('lead-in-length')} mm`;
            t += oc > 0 ? ` · Überschnitt ${oc} mm` : (oc < 0 ? ` · Schnitt endet ${-oc} mm früher` : ' · ohne Überschnitt');
            t += ' · an Ecken wird automatisch gerade angefahren';
            el.textContent = t;
            // Größen-Auswahl passend zurückstellen
            if (sel) {
                const cur = Object.entries(SIZES).find(([, v]) => Object.entries(v).every(([id, val]) => num(id) === val));
                if (sel.value !== (cur ? cur[0] : '')) sel.value = cur ? cur[0] : '';
            }
        };
        sel?.addEventListener('change', () => {
            const preset = SIZES[sel.value];
            if (!preset) return;
            for (const [id, val] of Object.entries(preset)) {
                const el = $(id);
                if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
            }
            updateSummary();
        });
        ['lead-type', 'lead-in-length', 'lead-in-radius', 'lead-out-length', 'overcut-length'].forEach(id => {
            $(id)?.addEventListener('input', updateSummary);
            $(id)?.addEventListener('change', updateSummary);
        });
        document.getElementById('lead-profile-select')?.addEventListener('change', () => setTimeout(updateSummary, 50));
        updateSummary();
        this._updateLeadSummary = updateSummary;
    }

    _setLeadUIValues(section, type) {
        if (!section) return;
        if (type === 'ext') {
            const fields = {
                'lead-type': section.leadInType,
                'lead-in-length': section.leadInLength,
                'lead-in-radius': section.leadInRadius,
                'lead-in-angle': section.leadInAngle,
                'lead-arc-angle': section.leadInArcAngle ?? 90,
                'lead-out-length': section.leadOutLength,
                'lead-out-angle': section.leadOutAngle ?? section.leadInAngle,
                'overcut-length': section.overcutLength,
                'piercing-type': section.piercingType,
                'piercing-stationary-time': section.piercingStationaryTime,
                'piercing-circular-radius': section.piercingCircularRadius,
                'piercing-circular-time': section.piercingCircularTime,
                'dyn-lead-min': section.leadInLengthMin,
                'dyn-lead-max': section.leadInLengthMax
            };
            for (const [id, val] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if (el && val !== undefined) el.value = val;
            }
            const loT = document.getElementById('lead-out-type');
            if (loT) loT.value = (section.leadOutType && section.leadOutType !== section.leadInType) ? section.leadOutType : '';
            const loR = document.getElementById('lead-out-radius');
            if (loR) loR.value = (section.leadOutRadius && section.leadOutRadius !== section.leadInRadius) ? section.leadOutRadius : '';
            const ocCorners = document.getElementById('overcut-at-corners');
            if (ocCorners) ocCorners.checked = !!section.overcutAtCorners;
            const prefCorners = document.getElementById('prefer-corners');
            if (prefCorners) prefCorners.checked = section.preferCorners;
            const dynLead = document.getElementById('dynamic-lead-ext');
            if (dynLead) dynLead.checked = section.leadInDynamic;
            this._updateLeadSummary?.();
        } else {
            const fields = {
                'int-lead-type': section.leadInType,
                'int-lead-in-length': section.leadInLength,
                'int-lead-in-radius': section.leadInRadius,
                'int-lead-in-angle': section.leadInAngle,
                'int-lead-arc-angle': section.leadInArcAngle ?? 90,
                'int-lead-out-length': section.leadOutLength,
                'int-overcut-length': section.overcutLength
            };
            for (const [id, val] of Object.entries(fields)) {
                const el = document.getElementById(id);
                if (el && val !== undefined) el.value = val;
            }
        }
    }

    _updateProfileStatus() {
        const statusEl = document.getElementById('lead-profile-status');
        if (!statusEl || typeof LeadProfiles === 'undefined') return;

        const profile = LeadProfiles.getActive();
        if (!profile) {
            statusEl.textContent = '';
            return;
        }

        const extVals = this._getLeadValuesFromUI();
        const intVals = this._getInternalLeadValuesFromUI();
        const altVals = this._getAlternativeLeadValuesFromUI();

        if (LeadProfiles.isModified(profile, extVals, intVals, altVals)) {
            statusEl.textContent = `[${profile.name}] + angepasst`;
            statusEl.style.color = '#f0a030';
        } else {
            statusEl.textContent = profile.name;
            statusEl.style.color = '#888';
        }
    }

    _saveCurrentAsProfile() {
        if (typeof LeadProfiles === 'undefined') return;
        const name = prompt('Profilname:');
        if (!name || !name.trim()) return;

        const extVals = this._getLeadValuesFromUI();
        const intVals = this._getInternalLeadValuesFromUI();
        const altVals = this._getAlternativeLeadValuesFromUI();

        const data = {
            ext: { ...extVals },
            int: { ...intVals },
            alt: { ...altVals },
            corner: { leadType: extVals.cornerLeadType, leadAngle: extVals.cornerLeadAngle, degradeThreshold: extVals.cornerDegradeThreshold },
            smallHole: { thresholdDiameter: 8.0, strategy: 'center_pierce' },
            slit: { leadInType: 'on_geometry', overcutLength: 0 }
        };

        const profile = LeadProfiles.saveCustom(name.trim(), data);
        LeadProfiles.setActive(profile.id);
        this._populateProfileDropdown();
        this._updateProfileStatus();
        this.showToast?.(`Profil "${name.trim()}" gespeichert`, 'success');
    }

    _deleteCurrentProfile() {
        if (typeof LeadProfiles === 'undefined') return;
        const profile = LeadProfiles.getActive();
        if (!profile) return;
        if (profile.isBuiltin) {
            this.showToast?.('Standard-Profile können nicht gelöscht werden', 'warning');
            return;
        }
        if (!confirm(`Profil "${profile.name}" löschen?`)) return;

        LeadProfiles.deleteCustom(profile.id);
        this._populateProfileDropdown();
        this._updateProfileStatus();
        this.showToast?.(`Profil "${profile.name}" gelöscht`, 'success');
    }

    _applyBatchRules() {
        if (typeof LeadProfiles === 'undefined') return;
        const profile = LeadProfiles.getActive();
        if (!profile) return;

        const targets = this.contours.filter(c => !c.isReference && (c.isClosed || c.cuttingMode === 'slit'));
        if (targets.length === 0) {
            this.showToast?.('Keine Konturen vorhanden', 'warning');
            return;
        }

        // Snapshot für Undo
        const snapshots = targets.map(c => ({ contour: c, old: this._readLeadFromContour(c) }));

        // Batch-Apply
        const result = LeadProfiles.applyBatchRules(this.contours, profile);

        // Undo-Command
        const app = this;
        const cmd = new FunctionCommand(
            `Lead-Profil Batch: "${profile.name}" (${result.applied} Konturen)`,
            () => {
                LeadProfiles.applyBatchRules(app.contours, profile);
                app.renderer?.render();
            },
            () => {
                snapshots.forEach(({ contour, old }) => app._applyLeadToContour(contour, old));
                app.renderer?.render();
            }
        );
        // Bereits ausgeführt, nur auf Stack legen
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();

        this.renderer?.render();
        this.showToast?.(`Profil "${profile.name}": ${result.applied} angewendet, ${result.skipped} übersprungen`, 'success');
        console.log(`[App V6.0] Batch-Regeln:`, result.details);
    }

    // ════════════════════════════════════════════════════════════════
    // EXPORT
    // ════════════════════════════════════════════════════════════════

    bindExportEvents() {
        document.getElementById('btn-export')?.addEventListener('click', () => this.exportGCode());
        document.getElementById('btn-preview')?.addEventListener('click', () => this.previewGCode());
    }
    
    updateExportSummary() {
        const cuttable = this.contours.filter(c => !c.isReference && (c.isClosed || c.cuttingMode === 'slit'));
        let totalLength = 0;
        
        cuttable.forEach(c => {
            totalLength += this.getContourPerimeter(c);
        });
        
        const feedRate = 2000; // mm/min (Beispiel)
        const timeMin = totalLength / feedRate;
        
        document.getElementById('summary-contours').textContent = cuttable.length;
        document.getElementById('summary-length').textContent = `${totalLength.toFixed(1)} mm`;
        document.getElementById('summary-time').textContent = `${timeMin.toFixed(1)} min`;
    }
    
    /**
     * V5.0: Liefert R-Parameter aus CeraJet-Engine für den Postprozessor.
     * Fallback auf leeres Objekt wenn Engine nicht verfügbar.
     */
    getTechnologyParams() {
        if (typeof CeraJetEngine === 'undefined') {
            console.warn('[App] CeraJetEngine nicht verfügbar — Standard-Template wird verwendet');
            return {};
        }

        const tech = this.settings.technology;
        const result = CeraJetEngine.calculate({
            materialId: tech.materialId,
            nozzleId: tech.nozzleId,
            thickness: this.settings.materialThickness,
            pressure: tech.pressure,
            optMode: tech.optMode,
            abrasiveOverride: tech.abrasiveOverride
        });

        const rParams = CeraJetEngine.toRParameters(result);
        console.log(`[App V5.0] getTechnologyParams: ${result.material.name}, ${this.settings.materialThickness}mm → ${Object.keys(rParams).length} R-Parameter`);
        return rParams;
    }

    /**
     * V6.43: Speichert eine CNC-Datei auf dem Server (Share Wasserstrahl/CNC).
     * @returns {Promise<'saved'|'cancelled'|'unavailable'>} unavailable → Aufrufer nutzt Fallback
     */
    async _saveCNCToServer(filename, code) {
        try {
            let overwrite = false;
            for (let attempt = 0; attempt < 2; attempt++) {
                const resp = await fetch('/api/cnc/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename, content: code, overwrite })
                });
                if (resp.ok) return 'saved';
                if (resp.status === 409 && !overwrite) {
                    if (!confirm(`${filename} existiert bereits im Ordner CNC.\nUeberschreiben?`)) return 'cancelled';
                    overwrite = true;
                    continue;
                }
                const err = await resp.json().catch(() => ({}));
                console.warn('[CNC-Server V6.43] Speichern fehlgeschlagen:', resp.status, err.error);
                return 'unavailable';
            }
        } catch (e) {
            console.warn('[CNC-Server V6.43] Server nicht erreichbar:', e);
        }
        return 'unavailable';
    }

    // ════════════════════════════════════════════════════════════════
    // V6.94: EINZELTEIL-EXPORT — jeder Zuschnitt als eigene CNC-Datei
    // ════════════════════════════════════════════════════════════════

    /**
     * Gruppiert schneidbare Konturen nach FLIESE: Fliese = zusammenhängender Umriss auf Layer
     * "Fliese"/"Fliesen" (4 Einzellinien oder Rechteck), jeder Schnitt gehört zur Fliese, in deren
     * Umriss sein Mittelpunkt liegt. Sortierung der Fliesen: hinten (max Y) → vorne, je Reihe links → rechts.
     * @returns {Array<{contourIdx:number[], bbox, length:number, enabled:boolean}>} leer = keine Fliesen erkannt
     */
    _groupPartsForExport(silent = false) {
        const isTileLayer = (c) => ['fliese', 'fliesen'].includes(String(c.layer || '').trim().toLowerCase());
        const bboxOf = (pts) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const q of pts) { if (q.x < minX) minX = q.x; if (q.y < minY) minY = q.y; if (q.x > maxX) maxX = q.x; if (q.y > maxY) maxY = q.y; }
            return { minX, minY, maxX, maxY };
        };
        // 1) Fliesen-Umrisse = achsparallele Rechtecke aus 4 Linien (gemeinsame Ecken/Fuge 0 erlaubt)
        //    bzw. geschlossene Rechteck-Konturen auf dem Fliesen-Layer
        const outline = this.contours.filter(c => isTileLayer(c) && c.points?.length >= 2);
        const E = 0.05, near = (a, b) => Math.abs(a - b) <= E;
        const hs = [], vs = [], rects = [];
        for (const c of outline) {
            const bb = bboxOf(c.points);
            if (c.isClosed || c.points.length > 2) {
                const w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
                const onEdge = c.points.every(q => near(q.x, bb.minX) || near(q.x, bb.maxX) || near(q.y, bb.minY) || near(q.y, bb.maxY));
                if (c.isClosed && onEdge && w > 1 && h > 1) rects.push(bb);   // V6.58: auch verkettete Rechtecke mit Zusatzpunkten
                continue;
            }
            const [p0, p1] = c.points;
            if (near(p0.y, p1.y) && Math.abs(p1.x - p0.x) > 1) hs.push({ y: (p0.y + p1.y) / 2, x1: Math.min(p0.x, p1.x), x2: Math.max(p0.x, p1.x) });
            else if (near(p0.x, p1.x) && Math.abs(p1.y - p0.y) > 1) vs.push({ x: (p0.x + p1.x) / 2, y1: Math.min(p0.y, p1.y), y2: Math.max(p0.y, p1.y) });
        }
        for (const bottom of hs) {                       // untere Kante suchen, dann links/rechts/oben
            for (const left of vs) {
                if (!near(left.x, bottom.x1) || !near(left.y1, bottom.y)) continue;
                for (const right of vs) {
                    if (!near(right.x, bottom.x2) || !near(right.y1, bottom.y) || !near(right.y2, left.y2)) continue;
                    const top = hs.find(t => near(t.y, left.y2) && near(t.x1, bottom.x1) && near(t.x2, bottom.x2));
                    if (top) rects.push({ minX: bottom.x1, minY: bottom.y, maxX: bottom.x2, maxY: left.y2 });
                }
            }
        }
        // Dubletten entfernen
        const uniq = [];
        for (const r of rects) if (!uniq.some(u => near(u.minX, r.minX) && near(u.minY, r.minY) && near(u.maxX, r.maxX) && near(u.maxY, r.maxY))) uniq.push(r);
        // V6.95: Fallback ohne Fliesen-Layer: aeusserste geschlossene achsparallele Rechtecke (nicht Referenz)
        let fallback = false;
        if (uniq.length === 0) {
            const cand = [];
            for (const c of this.contours) {
                if (c.isReference || c.isHatchContour || c.cuttingMode === 'none' || !c.isClosed || !c.points || c.points.length > 5) continue;
                const bb = bboxOf(c.points);
                if (bb.maxX - bb.minX <= 1 || bb.maxY - bb.minY <= 1) continue;
                if (!c.points.every(q => (near(q.x, bb.minX) || near(q.x, bb.maxX)) && (near(q.y, bb.minY) || near(q.y, bb.maxY)))) continue;
                cand.push(bb);
            }
            const areaOf = (r) => (r.maxX - r.minX) * (r.maxY - r.minY);
            const outer = cand.filter(a => !cand.some(b => b !== a && b.minX <= a.minX + E && b.minY <= a.minY + E &&
                b.maxX >= a.maxX - E && b.maxY >= a.maxY - E && areaOf(b) > areaOf(a) + 1));
            for (const r of outer) if (!uniq.some(u => near(u.minX, r.minX) && near(u.minY, r.minY) && near(u.maxX, r.maxX) && near(u.maxY, r.maxY))) uniq.push(r);
            fallback = true;
        }
        const tiles = uniq.map(b => ({ bbox: b, area: (b.maxX - b.minX) * (b.maxY - b.minY), contourIdx: [] }));
        if (tiles.length === 0) return [];

        // 2) Schnitte den Fliesen zuordnen (kleinste umschließende Fliese)
        const tol = 0.5;
        let orphans = 0;
        for (const i of this.cutOrder) {
            const c = this.contours[i];
            if (!c?.points?.length || c.isReference || c.cuttingMode === 'none' || c.isHatchContour || isTileLayer(c)) continue;
            const b = bboxOf(c.points), cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
            let best = null;
            for (const t of tiles) {
                const tb = t.bbox;
                if (cx < tb.minX - tol || cx > tb.maxX + tol || cy < tb.minY - tol || cy > tb.maxY + tol) continue;
                if (!best || t.area < best.area) best = t;
            }
            if (best) best.contourIdx.push(i); else orphans++;
        }
        this._tileOrphans = orphans;
        if (orphans && !silent) {
            this.showToast(`⚠️ ${orphans} Schnitt(e) liegen auf keiner Fliese und werden nicht exportiert`, 'warning');
        }
        const list = tiles.filter(t => t.contourIdx.length > (fallback ? 1 : 0)).map(t => {
            let len = 0;
            for (const ci of t.contourIdx) {
                const cp = this.contours[ci].points;
                for (let k = 1; k < cp.length; k++) len += Math.hypot(cp[k].x - cp[k - 1].x, cp[k].y - cp[k - 1].y);
            }
            return { contourIdx: t.contourIdx, bbox: t.bbox, length: len, enabled: true };
        });

        if (fallback && list.length < 2) return [];   // Fallback nur bei mehreren Rechtecken
        // 3) Reihen von hinten (hohes Y) nach vorne, in der Reihe links→rechts
        list.sort((a, b) => (b.bbox.minY + b.bbox.maxY) - (a.bbox.minY + a.bbox.maxY));
        const rows = [];
        for (const p of list) {
            const cy = (p.bbox.minY + p.bbox.maxY) / 2, h = p.bbox.maxY - p.bbox.minY;
            const row = rows.find(r => Math.abs(r.cy - cy) <= 0.5 * Math.min(r.h, h));
            if (row) row.items.push(p); else rows.push({ cy, h, items: [p] });
        }
        return rows.flatMap(r => r.items.sort((a, b) => a.bbox.minX - b.bbox.minX));
    }

    // ── V6.95: Fliesen-Liste (Bearbeitung-Tab): Nullpunkt + Reihenfolge je Fliese ──

    /** Programmname einer Fliese: BASE_001_300X600 (Masse gerundet, mm) */
    _tilePlanName(baseName, n, bbox) {
        const w = Math.round(bbox.maxX - bbox.minX), h = Math.round(bbox.maxY - bbox.minY);
        return `${baseName}_${String(n).padStart(3, '0')}_${w}X${h}`;
    }

    /** Fliesen neu erkennen; Nullpunkt, Auswahl und manuelle Reihenfolge bleiben bei gleicher Fliese erhalten */
    refreshTiles(silent = false) {
        this._mergeTiles(this._groupPartsForExport(silent));
        this._tileSigCache = this._tileSig();
        this.regroupCutOrderByTile();
        if (this.tilePickIdx != null && this.tilePickIdx >= this.tiles.length) this.tilePickIdx = null;
        this.renderTilePanel();
        this.renderer?.render();
        return this.tiles;
    }

    /** Erkannte Fliesen mit vorhandenen mergen: Nullpunkt, Auswahl und manuelle Reihenfolge bleiben bei gleicher Fliese erhalten */
    _mergeTiles(found) {
        const E = 0.05, same = (a, b) => Math.abs(a.minX - b.minX) <= E && Math.abs(a.minY - b.minY) <= E &&
            Math.abs(a.maxX - b.maxX) <= E && Math.abs(a.maxY - b.maxY) <= E;
        const merged = [];
        for (const o of (this.tiles || [])) {
            const f = found.find(t => same(t.bbox, o.bbox));
            if (f && !merged.includes(f)) merged.push(Object.assign(f, { origin: o.origin, originAuto: o.originAuto, enabled: o.enabled }));
        }
        for (const f of found) if (!merged.includes(f)) merged.push(f);
        // V6.58: Nullpunkte merken (Schluessel = Fliesenflaeche) → bleiben erhalten, auch wenn die Erkennung kurz ausfaellt
        const mem = (this._tileOriginMem = this._tileOriginMem || new Map());
        const key = (b) => [b.minX, b.minY, b.maxX, b.maxY].map(v => Math.round(v * 10)).join('_');
        for (const o of (this.tiles || [])) if (o.origin) mem.set(key(o.bbox), { origin: o.origin, originAuto: o.originAuto, enabled: o.enabled });
        for (const t of merged) {
            const m = !t.origin && mem.get(key(t.bbox));
            if (m) { t.origin = m.origin; t.originAuto = m.originAuto; t.enabled = m.enabled; }
            if (!t.origin) { t.origin = { x: t.bbox.minX, y: t.bbox.minY }; t.originAuto = true; }
        }
        this.tiles = merged;
        if (merged.length) this._tilesActive = true;
        if (!this.tileOrderManual) this._applyTileOrder();   // V6.59: nur automatische Reihenfolge folgt Geometrie-Änderungen
    }

    /** Billige Signatur des Konturbestands (Anzahl, Punktzahl, Anfang/Mitte/Ende) → erkennt Edits nach der Erkennung */
    _tileSig() {
        let h = this.contours.length + '|' + this.cutOrder.length;
        for (const c of this.contours) {
            const pts = c.points; if (!pts?.length) { h += ';0'; continue; }
            const a = pts[0], m = pts[pts.length >> 1], z = pts[pts.length - 1];
            h += `;${pts.length},${a.x.toFixed(2)},${a.y.toFixed(2)},${m.x.toFixed(2)},${m.y.toFixed(2)},${z.x.toFixed(2)},${z.y.toFixed(2)}`;
        }
        return h;
    }

    /** Fliesen-Zuordnung aktuell halten, falls Konturen nach der Erkennung geändert wurden (Zeichnen, Verschieben, Löschen …) */
    _ensureTilesFresh() {
        if ((!this.tiles?.length && !this._tilesActive) || this._tileSyncing) return;
        const sig = this._tileSig();
        if (sig === this._tileSigCache) return;
        this._tileSyncing = true;
        try {
            this._mergeTiles(this._groupPartsForExport(true));
            this._tileSigCache = this._tileSig();
            this.regroupCutOrderByTile();
            this.renderTilePanel();
        } finally { this._tileSyncing = false; }
    }

    /** Map Konturindex → Fliesenindex (leer ohne Fliesen) */
    getTileOfMap() {
        this._ensureTilesFresh();
        const m = new Map();
        (this.tiles || []).forEach((t, ti) => t.contourIdx.forEach(ci => m.set(ci, ti)));
        return m;
    }

    /** V6.97: Schnittliste fliesenweise ordnen: Fliese 1 komplett, dann Fliese 2 …; innerhalb jeder Fliese bleibt die Reihenfolge */
    regroupCutOrderByTile(noUpdate = false) {
        if (!this.tiles?.length) return;
        const m = this.getTileOfMap();
        const rank = (ci) => m.has(ci) ? m.get(ci) : 1e9;
        const before = this.cutOrder.join(',');
        this.cutOrder = this.cutOrder.map((ci, k) => ({ ci, k })).sort((a, b) => rank(a.ci) - rank(b.ci) || a.k - b.k).map(o => o.ci);
        if (!noUpdate && before !== this.cutOrder.join(',')) { this.updateCutOrderList?.(); this.updateOrderStats?.(); }
    }

    setTileOriginPreset(i, preset) {
        const t = this.tiles?.[i]; if (!t) return;
        const b = t.bbox, mx = (b.minX + b.maxX) / 2, my = (b.minY + b.maxY) / 2;
        const map = { bl: [b.minX, b.minY], br: [b.maxX, b.minY], tl: [b.minX, b.maxY], tr: [b.maxX, b.maxY], c: [mx, my] };
        if (!map[preset]) return;
        t.origin = { x: map[preset][0], y: map[preset][1] };
        t.originAuto = false;
        this.renderTilePanel(); this.renderer?.render();
    }

    startTilePick(i) {
        this.tilePickIdx = (this.tilePickIdx === i) ? null : i;
        if (this.tilePickIdx != null) this.showToast(`Fliese ${i + 1}: Nullpunkt im Zeichenbereich anklicken (Snap aktiv)`, 'info');
        this.renderTilePanel();
    }

    _finishTilePick(point) {
        const i = this.tilePickIdx, t = this.tiles?.[i];
        this.tilePickIdx = null;
        if (!t) return;
        t.origin = { x: point.x, y: point.y };
        t.originAuto = false;
        this.showToast(`Fliese ${i + 1}: Nullpunkt X=${point.x.toFixed(2)}, Y=${point.y.toFixed(2)}`, 'success');
        this.renderTilePanel(); this.renderer?.render();
    }

    moveTile(i, d) {
        const j = i + d;
        if (!this.tiles || j < 0 || j >= this.tiles.length) return;
        [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        this._tileOrderChanged(true);
    }

    // ── V6.59: Fliesen-Reihenfolge: Presets, Anklicken, Drag&Drop, Sperre (manuell) ──

    /** Nach Reihenfolge-Änderung: manuell → gesperrt (Geometrie-Änderungen ordnen die Fliesen nicht mehr um) */
    _tileOrderChanged(manual) {
        this.tileOrderManual = !!manual;
        this.regroupCutOrderByTile();
        this.renderTilePanel(); this.renderer?.render();
    }

    /** Fliese von Index `from` an Position `to` verschieben (Drag&Drop) */
    moveTileTo(from, to) {
        const t = this.tiles;
        if (!t || from === to || from < 0 || to < 0 || from >= t.length || to >= t.length) return;
        t.splice(to, 0, t.splice(from, 1)[0]);
        this._tileOrderChanged(true);
    }

    /** Preset-Reihenfolge berechnen und this.tiles umsortieren (ohne Zustand zu ändern) */
    _applyTileOrder() {
        const tiles = this.tiles;
        if (!tiles || tiles.length < 2) return;
        const preset = this.tileOrderPreset || 'rows', corner = this.tileOrderCorner || 'tl', rev = !!this.tileOrderReverse;
        const top = corner[0] === 't', left = corner[1] === 'l';
        const c = (t) => ({ x: (t.bbox.minX + t.bbox.maxX) / 2, y: (t.bbox.minY + t.bbox.maxY) / 2, w: t.bbox.maxX - t.bbox.minX, h: t.bbox.maxY - t.bbox.minY });
        let out;
        if (preset === 'nearest') {
            // Start: Fliese, die der gewählten Ecke des Gesamtbereichs am nächsten liegt
            let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
            for (const t of tiles) { gx0 = Math.min(gx0, t.bbox.minX); gy0 = Math.min(gy0, t.bbox.minY); gx1 = Math.max(gx1, t.bbox.maxX); gy1 = Math.max(gy1, t.bbox.maxY); }
            let px = left ? gx0 : gx1, py = top ? gy1 : gy0;
            const rest = tiles.slice(); out = [];
            while (rest.length) {
                let best = 0, bd = Infinity;
                rest.forEach((t, k) => { const q = c(t), d = Math.hypot(q.x - px, q.y - py); if (d < bd) { bd = d; best = k; } });
                const t = rest.splice(best, 1)[0]; out.push(t);
                const q = c(t); px = q.x; py = q.y;
            }
        } else {
            const byRows = preset.startsWith('rows'), snake = preset.endsWith('snake');
            const key = (t) => byRows ? c(t).y : c(t).x, ext = (t) => byRows ? c(t).h : c(t).w;
            const dirMajor = byRows ? (top ? -1 : 1) : (left ? 1 : -1);   // Zeilen: oben→unten = Y fällt
            const dirMinor = byRows ? (left ? 1 : -1) : (top ? -1 : 1);
            const minorKey = (t) => byRows ? c(t).x : c(t).y;
            const sorted = tiles.slice().sort((a, b) => dirMajor * (key(a) - key(b)));
            const groups = [];
            for (const t of sorted) {
                const g = groups.find(g => Math.abs(g.k - key(t)) <= 0.5 * Math.min(g.e, ext(t)));
                if (g) g.items.push(t); else groups.push({ k: key(t), e: ext(t), items: [t] });
            }
            out = groups.flatMap((g, gi) => {
                const flip = snake && gi % 2 === 1 ? -1 : 1;
                return g.items.sort((a, b) => dirMinor * flip * (minorKey(a) - minorKey(b)));
            });
        }
        if (rev) out.reverse();
        this.tiles = out;
    }

    _bindTileUI() {
        const $ = (id) => document.getElementById(id);
        const apply = () => {
            this.tileOrderPreset = $('tile-order-preset')?.value || 'rows';
            this.tileOrderCorner = $('tile-order-corner')?.value || 'tl';
            this.tileOrderReverse = !!$('tile-order-reverse')?.checked;
            this._ensureTilesFresh();
            if (!this.tiles?.length) { this.showToast('Keine Fliesen erkannt (Layer "Fliese" oder mehrere Außenrechtecke)', 'warning'); return; }
            this._applyTileOrder();
            this._tileOrderChanged(false);   // Preset = automatisch (hebt die Sperre auf)
        };
        ['tile-order-preset', 'tile-order-corner', 'tile-order-reverse'].forEach(id => $(id)?.addEventListener('change', apply));
        $('btn-tile-seq')?.addEventListener('click', () => this.tileSeqMode ? this.endTileSeq(true) : this.startTileSeq());
    }

    /** Modus „Reihenfolge anklicken“: Fliesen im Bild nacheinander anklicken */
    startTileSeq() {
        this._ensureTilesFresh();
        if (!this.tiles?.length) { this.showToast('Keine Fliesen erkannt (Layer "Fliese" oder mehrere Außenrechtecke)', 'warning'); return; }
        this.tilePickIdx = null;
        this.tileSeqMode = true;
        this.tileSeq = [];
        this._tileSeqKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.endTileSeq(true); }
            else if (e.key === 'Backspace' && e.target?.tagName !== 'INPUT') { e.preventDefault(); e.stopPropagation(); this.tileSeq.pop(); this._tileSeqUI(); }
        };
        document.addEventListener('keydown', this._tileSeqKey, true);
        this.showToast('Fliesen in gewünschter Reihenfolge anklicken · Esc = fertig · Rücktaste = zurück', 'info');
        this._tileSeqUI();
    }

    _tileSeqUI() {
        const b = document.getElementById('btn-tile-seq');
        if (b) { b.textContent = this.tileSeqMode ? `✔ Fertig (${this.tileSeq.length}/${this.tiles.length})` : '🖱 Anklicken'; b.style.background = this.tileSeqMode ? '#0e639c' : ''; b.style.color = this.tileSeqMode ? '#fff' : ''; }
        this.renderTilePanel(); this.renderer?.render();
    }

    /** Klick im Zeichenbereich im Anklick-Modus (kleinste umschließende Fliese) */
    _handleTileSeqClick(pt) {
        let best = -1, area = Infinity;
        this.tiles.forEach((t, i) => {
            const b = t.bbox;
            if (pt.x < b.minX || pt.x > b.maxX || pt.y < b.minY || pt.y > b.maxY) return;
            const a = (b.maxX - b.minX) * (b.maxY - b.minY);
            if (a < area) { area = a; best = i; }
        });
        if (best >= 0 && !this.tileSeq.includes(best)) {
            this.tileSeq.push(best);
            if (this.tileSeq.length >= this.tiles.length) { this.endTileSeq(true); return; }
        }
        this._tileSeqUI();
    }

    endTileSeq(apply) {
        if (!this.tileSeqMode) return;
        document.removeEventListener('keydown', this._tileSeqKey, true);
        const seq = this.tileSeq || [];
        this.tileSeqMode = false; this.tileSeq = [];
        if (apply && seq.length) {
            const picked = seq.map(i => this.tiles[i]);
            this.tiles = [...picked, ...this.tiles.filter(t => !picked.includes(t))];
            this._tileOrderChanged(true);
            this.showToast(`Reihenfolge festgelegt (${seq.length} angeklickt, Rest dahinter) — gesperrt`, 'success');
        }
        this._tileSeqUI();
    }

    renderTilePanel() {
        const el = document.getElementById('tile-list');
        if (!el) return;
        const tiles = this.tiles || [];
        const st = document.getElementById('tile-order-state');
        if (st) st.textContent = tiles.length ? `${tiles.length} Fliesen · ${this.tileOrderManual ? '🔒 manuell' : 'auto'}` : '';
        if (tiles.length === 0) { el.innerHTML = '<span style="color:#888">Keine Fliesen erkannt (Layer „Fliese“ oder Außenrechtecke)</span>'; return; }
        el.innerHTML = '';
        tiles.forEach((t, i) => {
            const w = t.bbox.maxX - t.bbox.minX, h = t.bbox.maxY - t.bbox.minY;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:4px;padding:1px 2px;white-space:nowrap;';
            const picking = this.tilePickIdx === i;
            row.draggable = true;
            row.innerHTML = `<span title="Ziehen = Reihenfolge ändern" style="cursor:grab;color:#888">⠿</span><b style="width:16px;color:#ffd54f">${i + 1}</b>
                <span style="width:78px">${w.toFixed(0)}×${h.toFixed(0)}</span>
                <button class="ribbon-btn-mini" data-a="pick" title="Nullpunkt im Zeichenbereich setzen" style="${picking ? 'background:#0e639c;color:#fff' : ''}">📍</button>
                <select class="ribbon-select" data-a="preset" style="width:62px" title="Nullpunkt-Preset">
                    <option value="">${t.originAuto ? 'auto ⌞' : 'frei'}</option>
                    <option value="bl">⌞ l.u.</option><option value="br">⌟ r.u.</option>
                    <option value="tl">⌜ l.o.</option><option value="tr">⌝ r.o.</option><option value="c">◎ Mitte</option></select>
                <button class="ribbon-btn-mini" data-a="up" title="Reihenfolge früher">↑</button>
                <button class="ribbon-btn-mini" data-a="down" title="Reihenfolge später">↓</button>`;
            row.querySelector('[data-a=pick]').onclick = () => this.startTilePick(i);
            row.querySelector('[data-a=preset]').onchange = (e) => this.setTileOriginPreset(i, e.target.value);
            row.querySelector('[data-a=up]').onclick = () => this.moveTile(i, -1);
            row.querySelector('[data-a=down]').onclick = () => this.moveTile(i, 1);
            row.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; this._tileDragFrom = i; };
            row.ondragover = (e) => { e.preventDefault(); row.style.outline = '1px solid #ffd54f'; };
            row.ondragleave = () => { row.style.outline = ''; };
            row.ondrop = (e) => { e.preventDefault(); row.style.outline = ''; const f = this._tileDragFrom; this._tileDragFrom = null; if (f != null) this.moveTileTo(f, i); };
            row.onmouseenter = () => { this.tileHighlight = i; this.renderer?.render(); };
            row.onmouseleave = () => { this.tileHighlight = null; this.renderer?.render(); };
            el.appendChild(row);
        });
    }

    /** Kontrolldialog: Reihenfolge, Nullpunkt, Dateiname je Fliese prüfen. Export erst nach "geprüft" → Promise<tiles|null> */
    _showPartsDialog(parts, baseName) {
        return new Promise((resolve) => {
            const ov = document.createElement('div');
            ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483000;display:flex;align-items:center;justify-content:center;';
            ov.innerHTML = `<div style="background:#252526;color:#ddd;border:1px solid #555;border-radius:8px;padding:20px;width:680px;max-width:94vw;max-height:88vh;display:flex;flex-direction:column;">
                <h3 style="margin:0 0 4px;font-size:15px;">✂ CNC-Export: ${parts.length} Fliesen → je eine CNC-Datei</h3>
                <div style="font-size:12px;color:#999;margin-bottom:10px;">Jede Fliese: eigener Nullpunkt, eigene Schnittreihenfolge, eigene Datei. Reihenfolge der Fliesen hier prüfen und ggf. mit ↑↓ ändern (bestimmt die Dateinummer).</div>
                <div id="pt-list" style="overflow:auto;border:1px solid #444;border-radius:4px;background:#1e1e1e;font-size:13px;"></div>
                <div id="pt-warn" style="font-size:12px;color:#ffb74d;margin-top:8px;"></div>
                <label style="font-size:12px;margin-top:10px;"><input type="checkbox" id="pt-resort"> Schnittreihenfolge je Fliese neu berechnen (innen → außen). Aus: Reihenfolge aus der Schnittliste wird je Fliese übernommen.</label>
                <label style="font-size:13px;margin-top:8px;color:#8cf;"><input type="checkbox" id="pt-checked"> Reihenfolge, Nullpunkte und Dateinamen geprüft</label>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                    <button id="pt-all" style="margin-right:auto;padding:6px 12px;">Alle an/aus</button>
                    <button id="pt-cancel" style="padding:6px 14px;">Abbrechen</button>
                    <button id="pt-ok" disabled style="padding:6px 14px;background:#0e639c;color:#fff;border:0;border-radius:4px;opacity:.4;">Exportieren</button>
                </div></div>`;
            document.body.appendChild(ov);
            const listEl = ov.querySelector('#pt-list'), chk = ov.querySelector('#pt-checked'), okBtn = ov.querySelector('#pt-ok');
            const syncOk = () => { const on = chk.checked && parts.some(p => p.enabled); okBtn.disabled = !on; okBtn.style.opacity = on ? '1' : '.4'; };
            const render = () => {
                listEl.innerHTML = '';
                const warns = [];
                let n = 0;
                parts.forEach((p, i) => {
                    const w = p.bbox.maxX - p.bbox.minX, h = p.bbox.maxY - p.bbox.minY;
                    const name = p.enabled ? this._tilePlanName(baseName, ++n, p.bbox) + '.CNC' : '— nicht exportiert —';
                    const o = p.origin, tol = 0.01;
                    const inTile = o.x >= p.bbox.minX - tol && o.x <= p.bbox.maxX + tol && o.y >= p.bbox.minY - tol && o.y <= p.bbox.maxY + tol;
                    if (p.enabled && !inTile) warns.push(`Fliese ${i + 1}: Nullpunkt liegt außerhalb der Fliese`);
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid #333;';
                    row.innerHTML = `<input type="checkbox" ${p.enabled ? 'checked' : ''}>
                        <span style="width:24px;color:#ffd54f;">${i + 1}</span>
                        <span style="width:110px;">${w.toFixed(1)} × ${h.toFixed(1)} mm</span>
                        <span style="width:60px;color:#999;">${p.contourIdx.length} Sch.</span>
                        <span style="width:150px;color:${inTile ? '#9c9' : '#ffb74d'};" title="Nullpunkt">0 = ${o.x.toFixed(2)} / ${o.y.toFixed(2)}${p.originAuto ? ' (auto)' : ''}</span>
                        <span style="flex:1;color:#8cf;overflow:hidden;text-overflow:ellipsis;" title="${name}">${name}</span>
                        <button data-d="-1" style="padding:0 8px;">↑</button><button data-d="1" style="padding:0 8px;">↓</button>`;
                    row.querySelector('input').onchange = (e) => { p.enabled = e.target.checked; chk.checked = false; render(); };
                    row.querySelectorAll('button').forEach(b => b.onclick = () => {
                        const j = i + parseInt(b.dataset.d, 10);
                        if (j < 0 || j >= parts.length) return;
                        [parts[i], parts[j]] = [parts[j], parts[i]]; this.tileOrderManual = true; chk.checked = false; this.renderTilePanel(); render();
                    });
                    row.onmouseenter = () => { row.style.background = '#094771'; this.tileHighlight = i; this.renderer?.render(); };
                    row.onmouseleave = () => { row.style.background = ''; this.tileHighlight = null; this.renderer?.render(); };
                    listEl.appendChild(row);
                });
                if (this._tileOrphans) warns.push(`${this._tileOrphans} Schnitt(e) liegen auf keiner Fliese und werden nicht exportiert`);
                ov.querySelector('#pt-warn').innerHTML = warns.join('<br>');
                syncOk();
            };
            render();
            chk.onchange = syncOk;
            const done = (v) => { this.tileHighlight = null; this.renderer?.render(); ov.remove(); resolve(v); };
            ov.querySelector('#pt-all').onclick = () => { const on = !parts.every(p => p.enabled); parts.forEach(p => p.enabled = on); chk.checked = false; render(); };
            ov.querySelector('#pt-cancel').onclick = () => done(null);
            okBtn.onclick = () => {
                if (!chk.checked) return;
                const resort = ov.querySelector('#pt-resort').checked;
                done(parts.filter(p => p.enabled).map(p => Object.assign(p, { resort })));
            };
            ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(null); e.stopPropagation(); });
            ov.addEventListener('keyup', (e) => e.stopPropagation());
            ov.tabIndex = -1; ov.focus();
        });
    }

    /** Alle Teile als Einzeldateien erzeugen und in den Server-CNC-Ordner schreiben */
    async _exportParts(parts, baseName) {
        const chosen = await this._showPartsDialog(parts, baseName);
        if (!chosen) return;
        if (chosen.length === 0) { this.showToast('Keine Fliese ausgewählt', 'warning'); return; }
        this.regroupCutOrderByTile();

        const technologyParams = this.getTechnologyParams();
        const files = [];
        for (let n = 0; n < chosen.length; n++) {
            const part = chosen[n];
            let order = this.cutOrder.filter(i => part.contourIdx.includes(i));
            if (part.resort) {
                const items = order.map(i => ({ contour: this.contours[i], index: i }));
                this._applyInsideOutSort(items);
                order = items.map(it => it.index);
            }
            const pp = new SinumerikPostprocessor();
            const res = pp.generateDownload(this.contours, order, {
                planName: this._tilePlanName(baseName, n + 1, part.bbox),
                dicke: this.settings.materialThickness || 10.0,
                material: this._cerajetResult?.material?.name || 'AALLGEMEIN',
                technologyParams,
                plateBBox: part.bbox,   // V6.62: Plattengroesse = diese Fliese (jede Fliese ist Referenz)
                origin: { x: part.origin.x, y: part.origin.y }   // V6.95: Nullpunkt je Fliese (vom Benutzer gesetzt/geprüft)
            });
            if (!res?.code?.trim()) { this.showToast(`Fliese ${n + 1}: kein G-Code erzeugt`, 'error'); return; }
            files.push({ filename: res.filename, code: res.code, blob: res.blob });
        }

        // Schreiben: erst ohne Überschreiben, vorhandene gesammelt EINMAL nachfragen
        const postCNC = async (f, overwrite) => {
            const resp = await fetch('/api/cnc/save', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: f.filename, content: f.code, overwrite })
            });
            return resp.status === 409 ? 'exists' : (resp.ok ? 'ok' : 'error');
        };
        let ok = 0, skipped = 0, failed = [];
        const existing = [];
        try {
            for (const f of files) {
                const r = await postCNC(f, false);
                if (r === 'ok') ok++; else if (r === 'exists') existing.push(f); else failed.push(f);
            }
            if (existing.length) {
                if (confirm(`${existing.length} von ${files.length} Dateien existieren schon im Ordner CNC.\nAlle überschreiben?`)) {
                    for (const f of existing) (await postCNC(f, true)) === 'ok' ? ok++ : failed.push(f);
                } else skipped = existing.length;
            }
        } catch (e) {
            failed = files.slice(ok + skipped);
        }
        if (failed.length) {
            // Ausnahme: Server nicht erreichbar → lokale Downloads
            this.showToast(`${failed.length} Datei(en) nicht auf Server speicherbar — lokaler Download`, 'warning');
            for (const f of failed) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(f.blob); a.download = f.filename;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }
        }
        this.showToast(`✅ ${ok} CNC-Datei(en) → Server/CNC${skipped ? `, ${skipped} übersprungen` : ''}`, 'success');
    }

    async exportGCode() {
        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen zum Exportieren', 'error');
            return;
        }
        if (!this.cutOrder || this.cutOrder.length === 0) {
            this.showToast('Keine Schneidreihenfolge festgelegt', 'error');
            return;
        }

        // V6.4: Pre-Export Validation
        if (typeof CeraCutPipeline !== 'undefined' && CeraCutPipeline.validate) {
            const validation = CeraCutPipeline.validate(this.contours, {
                kerfWidth: this.settings.kerfWidth || 0.8,
                intarsiaMode: this.settings.intarsiaMode,
                intarsiaPosContours: this.intarsiaPosContours,
                intarsiaNegContours: this.intarsiaNegContours
            });
            if (validation.errors.length > 0 || validation.warnings.length > 0) {
                const proceed = await this._showValidationModal(validation);
                if (!proceed) return;
            }
        }

        const planName = document.getElementById('planname-input')?.value
            || this.dxfFileName?.replace(/\.dxf$/i, '').toUpperCase()
            || 'UNNAMED';

        // V6.94: mehrere Zuschnitte in einer Datei → Einzeldateien
        const parts = this.refreshTiles(true);
        if (parts.length === 0) {
            this.showToast('Keine Fliesen erkannt (Layer "Fliese" oder mehrere Außenrechtecke) — Export als EINE Datei', 'warning');
        }
        if (parts.length >= 1) {
            return this._exportParts(parts, planName.toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
        }

        // V5.0: Technologie-Parameter aus CeraJet-Engine
        const technologyParams = this.getTechnologyParams();

        const pp = new SinumerikPostprocessor();
        const result = pp.generateDownload(this.contours, this.cutOrder, {
            planName,
            dicke: this.settings.materialThickness || 10.0,
            material: this._cerajetResult?.material?.name || 'AALLGEMEIN',
            technologyParams,
            origin: this.settings.origin
        });

        if (!result || !result.code || result.code.trim().length === 0) {
            this.showToast('Export fehlgeschlagen — kein G-Code erzeugt. Sind schneidbare Konturen vorhanden?', 'error');
            return;
        }

        if (result.warnings.length > 0) {
            console.warn('[EXPORT] Warnungen:', result.warnings);
            this.showToast(`Export mit ${result.warnings.length} Warnung(en)`, 'warning');
        }

        // V6.43: Server-CNC-Ordner (Share Wasserstrahl/CNC) hat Vorrang
        const serverState = await this._saveCNCToServer(result.filename, result.code);
        if (serverState === 'saved') {
            this.showToast(`✅ ${result.filename} → Server/CNC (${result.stats.contours} Konturen)`, 'success');
            return;
        }
        if (serverState === 'cancelled') {
            this.showToast('Export abgebrochen', 'warning');
            return;
        }
        this.showToast('Server-CNC-Ordner nicht erreichbar — lokaler Export', 'warning');

        // V5.6: Workspace-CNC-Ordner nutzen wenn verfügbar
        if (this.projectManager?.isWorkspaceOpen && this.projectManager.cncDirHandle) {
            const saved = await this.projectManager.saveCNCFile(result.filename, result.code);
            if (saved) {
                this.showToast(`✅ ${result.filename} → ${this.projectManager.workspaceName}/CNC/ (${result.stats.contours} Konturen)`, 'success');
                return;
            }
            // Fallback: normaler Download
        }

        // Download auslösen
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`✅ ${result.filename} exportiert (${result.stats.contours} Konturen)`, 'success');
    }

    /**
     * V6.4: Validation Modal — zeigt Fehler/Warnungen vor Export
     * @returns {Promise<boolean>} true = weiter exportieren, false = abbrechen
     */
    _showValidationModal(validation) {
        return new Promise(resolve => {
            const hasCritical = validation.errors.length > 0;
            const items = [
                ...validation.errors.map(e => ({ ...e, icon: '⛔' })),
                ...validation.warnings.map(w => ({ ...w, icon: '⚠️' }))
            ];

            let listHTML = items.map(item => {
                const color = item.severity === 'critical' ? '#ef4444' : '#f59e0b';
                return `<div style="padding:6px 8px;margin:4px 0;background:${color}22;border-left:3px solid ${color};border-radius:3px;font-size:12px;">
                    <span>${item.icon}</span>
                    <strong style="color:${color}">[${sanitizeHTML(item.code)}]</strong>
                    <span style="color:#ccc">${sanitizeHTML(item.contourName)}:</span>
                    ${sanitizeHTML(item.message)}
                </div>`;
            }).join('');

            const overlay = document.createElement('div');
            overlay.id = 'validation-modal';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
            overlay.innerHTML = `
                <div style="background:#1e1e1e;border:1px solid #555;border-radius:8px;max-width:560px;width:90%;max-height:70vh;overflow-y:auto;padding:20px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                    <h3 style="margin:0 0 12px;font-size:16px;color:${hasCritical ? '#ef4444' : '#f59e0b'}">
                        ${hasCritical ? '⛔ Export blockiert' : '⚠️ Warnungen vor Export'}
                    </h3>
                    <div style="max-height:40vh;overflow-y:auto;">${listHTML}</div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                        <button id="val-cancel" style="padding:6px 16px;background:#555;border:none;border-radius:4px;color:#ddd;cursor:pointer;">Abbrechen</button>
                        ${!hasCritical ? '<button id="val-proceed" style="padding:6px 16px;background:#f59e0b;border:none;border-radius:4px;color:#000;cursor:pointer;font-weight:600;">Trotzdem exportieren</button>' : ''}
                    </div>
                </div>`;

            document.body.appendChild(overlay);

            const cleanup = (result) => {
                overlay.remove();
                resolve(result);
            };

            overlay.querySelector('#val-cancel').addEventListener('click', () => cleanup(false));
            const proceedBtn = overlay.querySelector('#val-proceed');
            if (proceedBtn) proceedBtn.addEventListener('click', () => cleanup(true));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
        });
    }

    /**
     * V6.26: Zeigt die konkreten Fehler/Warnungen aus ToolpathSimulator.verify() an
     * (Klick auf "Verifizieren"-Ergebnis-Zeile) — vorher war nur die Anzahl sichtbar.
     */
    _showSimVerifyModal(result) {
        const existing = document.getElementById('sim-verify-modal');
        if (existing) existing.remove();

        const items = [
            ...result.errors.map(msg => ({ msg, icon: '⛔', color: '#ef4444' })),
            ...result.warnings.map(msg => ({ msg, icon: '⚠️', color: '#f59e0b' }))
        ];
        const listHTML = items.length
            ? items.map(item => `<div style="padding:6px 8px;margin:4px 0;background:${item.color}22;border-left:3px solid ${item.color};border-radius:3px;font-size:12px;color:#ddd;">
                <span>${item.icon}</span> ${sanitizeHTML(item.msg)}
            </div>`).join('')
            : '<div style="color:#888;font-size:12px;">Keine Fehler oder Warnungen.</div>';

        const overlay = document.createElement('div');
        overlay.id = 'sim-verify-modal';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#1e1e1e;border:1px solid #555;border-radius:8px;max-width:560px;width:90%;max-height:70vh;overflow-y:auto;padding:20px;color:#ddd;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <h3 style="margin:0 0 12px;font-size:16px;color:${result.errors.length ? '#ef4444' : '#f59e0b'}">
                    ${result.valid ? '⚠️ Verifikation: Warnungen' : '⛔ Verifikation: Fehler'}
                </h3>
                <div>${listHTML}</div>
                <div style="display:flex;justify-content:flex-end;margin-top:16px;">
                    <button id="sim-verify-close" style="padding:6px 16px;background:#555;border:none;border-radius:4px;color:#ddd;cursor:pointer;">Schliessen</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        overlay.querySelector('#sim-verify-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    previewGCode() {
        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen für Vorschau', 'error');
            return;
        }
        if (!this.cutOrder || this.cutOrder.length === 0) {
            this.showToast('Keine Schneidreihenfolge festgelegt', 'error');
            return;
        }

        const planName = document.getElementById('planname-input')?.value
            || this.dxfFileName?.replace(/\.dxf$/i, '').toUpperCase()
            || 'UNNAMED';

        // V5.0: Technologie-Parameter aus CeraJet-Engine
        const technologyParams = this.getTechnologyParams();

        const pp = new SinumerikPostprocessor();
        const result = pp.generate(this.contours, this.cutOrder, {
            planName,
            dicke: this.settings.materialThickness || 10.0,
            material: this._cerajetResult?.material?.name || 'AALLGEMEIN',
            technologyParams,
            origin: this.settings.origin
        });

        if (!result.code) {
            this.showToast('Vorschau: Kein Code generiert', 'error');
            return;
        }

        // Vorschau-Modal anzeigen
        this._showPreviewModal(result.code, result.warnings, result.stats);
    }

    // ════════════════════════════════════════════════════════════════
    // V2.0: INTARSIEN — Live-Konturen + Export
    // ════════════════════════════════════════════════════════════════

    /**
     * V2.0: Erzeugt POS- und NEG-Konturen als echte CamContour-Arrays.
     * Werden vom Renderer als halbtransparente Overlay-Konturen gezeichnet.
     *
     * NEG (Aussparung): Behält cuttingMode, Offset +additionalOffset (nach außen → Loch größer)
     * POS (Einleger):   Invertiert cuttingMode, Offset -additionalOffset (nach innen → Teil kleiner)
     */
    regenerateIntarsiaContours() {
        if (!this.settings.intarsiaMode || !this.contours || this.contours.length === 0) {
            this.intarsiaPosContours = null;
            this.intarsiaNegContours = null;
            return;
        }

        const kerf = this.settings.kerfWidth || 0.8;
        const gap = parseFloat(document.getElementById('intarsia-gap')?.value) || this.settings.intarsiaGap || (kerf * 2);
        const additionalOffset = (gap - 2 * kerf) / 2;

        const intarsiaProfile = typeof LeadProfiles !== 'undefined'
            ? LeadProfiles.getById('builtin-intarsia')
            : null;

        const posContours = [];
        const negContours = [];

        for (const c of this.contours) {
            if (c.isReference) continue;
            if (c.isHatchContour || c.cuttingMode === 'none') continue;
            if (!c.isClosed && c.cuttingMode !== 'slit') continue;

            // ─── NEG-Clone: Aussparung — cuttingMode beibehalten, Offset nach außen ───
            const negClone = c.clone();
            negClone._intarsiaType = 'neg';
            if (Math.abs(additionalOffset) >= 0.01 && negClone.isClosed && negClone.cuttingMode !== 'slit') {
                this._applyIntarsiaOffset(negClone, +additionalOffset, c.cuttingMode === 'hole');
            }

            // ─── POS-Clone: Einleger — cuttingMode invertieren, Offset nach innen ───
            const posClone = c.clone();
            posClone._intarsiaType = 'pos';
            if (posClone.cuttingMode === 'disc') {
                posClone.cuttingMode = 'hole';
                posClone.type = 'INNER';
            } else if (posClone.cuttingMode === 'hole') {
                posClone.cuttingMode = 'disc';
                posClone.type = 'OUTER';
            }
            if (Math.abs(additionalOffset) >= 0.01 && posClone.isClosed && posClone.cuttingMode !== 'slit') {
                this._applyIntarsiaOffset(posClone, -additionalOffset, c.cuttingMode === 'hole');
            }

            // Intarsien-Lead-Profil anwenden
            if (intarsiaProfile) {
                LeadProfiles.applyBatchRules([negClone], intarsiaProfile);
                LeadProfiles.applyBatchRules([posClone], intarsiaProfile);
            }

            negContours.push(negClone);
            posContours.push(posClone);
        }

        this.intarsiaPosContours = posContours;
        this.intarsiaNegContours = negContours;

        console.log(`[Intarsia V2.0] Regenerated: ${posContours.length} POS, ${negContours.length} NEG`);
    }

    /**
     * Erzeugt zwei CNC-Dateien für Intarsien-Schnitt:
     * - PLAN_POS.CNC: Einleger (normale cuttingModes)
     * - PLAN_NEG.CNC: Aussparung (invertierte cuttingModes disc↔hole)
     *
     * Prinzip: POS schneidet das Teil aus (disc=Teil, hole=Loch)
     *          NEG schneidet die Aussparung (disc→Loch, hole→Teil)
     *          → Gleiche Geometrie, invertierte Kerf-Kompensation
     *          → Leads flippen automatisch (Pierce immer im Abfall)
     */
    async exportIntarsia() {
        console.time('[Intarsia V2.0] Export');
        console.log('[Intarsia V2.0] exportIntarsia() gestartet');

        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen zum Exportieren', 'error');
            return;
        }
        if (!this.cutOrder || this.cutOrder.length === 0) {
            this.showToast('Keine Schneidreihenfolge festgelegt', 'error');
            return;
        }

        // V6.4: Pre-Export Validation
        if (typeof CeraCutPipeline !== 'undefined' && CeraCutPipeline.validate) {
            const validation = CeraCutPipeline.validate(this.contours, {
                kerfWidth: this.settings.kerfWidth || 0.8,
                intarsiaMode: true,
                intarsiaPosContours: this.intarsiaPosContours,
                intarsiaNegContours: this.intarsiaNegContours
            });
            if (validation.errors.length > 0 || validation.warnings.length > 0) {
                const proceed = await this._showValidationModal(validation);
                if (!proceed) return;
            }
        }

        // Sicherstellen dass Intarsien-Konturen aktuell sind
        this.regenerateIntarsiaContours();

        const baseName = document.getElementById('planname-input')?.value
            || this.dxfFileName?.replace(/\.dxf$/i, '').toUpperCase()
            || 'UNNAMED';

        const technologyParams = this.getTechnologyParams();
        const commonSettings = {
            dicke: this.settings.materialThickness || 10.0,
            material: this._cerajetResult?.material?.name || 'AALLGEMEIN',
            technologyParams,
            origin: this.settings.origin
        };

        // V6.4: Multi-Material Gruppierung
        const materials = (typeof CeraCUT !== 'undefined' && CeraCUT.INTARSIA_MATERIALS) || [];
        const usedGroups = new Set();
        (this.intarsiaPosContours || []).forEach(c => usedGroups.add(c.materialGroup ?? 0));
        (this.intarsiaNegContours || []).forEach(c => usedGroups.add(c.materialGroup ?? 0));

        const isMultiMaterial = usedGroups.size > 1;
        let fileCount = 0;
        let savedFiles = 0;
        let failedFiles = 0;

        // cutOrder indiziert das UNgefilterte Array → auf gefiltertes Array umrechnen
        const remapOrder = (all, filtered) => this.cutOrder
            .map(idx => filtered.indexOf(all[idx]))
            .filter(i => i >= 0);

        for (const groupId of usedGroups) {
            const suffix = isMultiMaterial ? `_M${groupId}` : '';
            const matName = materials[groupId]?.name || `Material ${groupId}`;

            // NEG filtern
            const negAll = this._buildIntarsiaExportContours(this.intarsiaNegContours);
            const negFiltered = isMultiMaterial
                ? negAll.filter(c => c.isReference || (c.materialGroup ?? 0) === groupId)
                : negAll;

            const ppNeg = new SinumerikPostprocessor();
            const negResult = ppNeg.generate(negFiltered, remapOrder(negAll, negFiltered), {
                ...commonSettings,
                planName: baseName + suffix + '_NEG'
            });

            // POS filtern
            const posAll = this._buildIntarsiaExportContours(this.intarsiaPosContours);
            const posFiltered = isMultiMaterial
                ? posAll.filter(c => c.isReference || (c.materialGroup ?? 0) === groupId)
                : posAll;

            const ppPos = new SinumerikPostprocessor();
            const posResult = ppPos.generate(posFiltered, remapOrder(posAll, posFiltered), {
                ...commonSettings,
                planName: baseName + suffix + '_POS'
            });

            // Downloads
            // Sequenziell awaiten (kein setTimeout → Fehler werden gezählt, Toast ehrlich)
            const okPos = await this._downloadIntarsiaFile(posResult.code, baseName + suffix + '_POS.CNC');
            await new Promise(r => setTimeout(r, 300));
            const okNeg = await this._downloadIntarsiaFile(negResult.code, baseName + suffix + '_NEG.CNC');
            if (okPos) savedFiles++; else failedFiles++;
            if (okNeg) savedFiles++; else failedFiles++;
            await new Promise(r => setTimeout(r, 300));
            fileCount++;

            if (isMultiMaterial) {
                console.log(`[Intarsia V2.0] ${matName}: POS=${posResult.stats?.contours} NEG=${negResult.stats?.contours}`);
            }
        }

        const groupLabel = isMultiMaterial ? ` (${usedGroups.size} Materialgruppen)` : '';
        if (failedFiles > 0) {
            this.showToast(`Intarsien: ${savedFiles} Dateien exportiert, ${failedFiles} FEHLGESCHLAGEN${groupLabel}`, 'error');
        } else {
            this.showToast(`Intarsien: ${savedFiles} Dateien exportiert${groupLabel}`, 'success');
        }

        console.log(`[Intarsia V2.0] Export abgeschlossen: ${fileCount} Materialgruppen`);
        console.timeEnd('[Intarsia V2.0] Export');
    }

    /**
     * Baut Export-Konturen-Array aus pre-generierten Intarsien-Konturen.
     * Füllt Referenz-Konturen an den richtigen Positionen ein.
     */
    _buildIntarsiaExportContours(intarsiaContours) {
        if (!intarsiaContours) return this.contours;
        // Map: Intarsien-Konturen an den passenden Indizes, Referenzen/offene Konturen direkt
        let intIdx = 0;
        return this.contours.map(c => {
            if (c.isReference) return c;
            if (c.isHatchContour || c.cuttingMode === 'none') return c;
            if (!c.isClosed && c.cuttingMode !== 'slit') return c;
            return intarsiaContours[intIdx++] || c;
        });
    }

    /**
     * Wendet den Intarsien-Fugen-Offset auf eine geklonte Kontur an.
     * additionalOffset > 0 → Kontur wächst (NEG: Aussparung größer)
     * additionalOffset < 0 → Kontur schrumpft (POS: Einleger kleiner)
     */
    _applyIntarsiaOffset(clone, additionalOffset, isHole = false) {
        // Innenkonturen (Loch/Insel): Material-Wachstum = Polygon-Schrumpfen → Flächenerwartung invertieren
        if (Math.abs(additionalOffset) < 0.001) return;

        const areaOrig = Math.abs(Geometry.getSignedArea(clone.points));
        if (areaOrig < 0.01) return;

        // additionalOffset > 0 → Kontur nach außen (wächst), < 0 → nach innen (schrumpft).
        // offsetPolygon nutzt rechtsseitige Normalen:
        //   CW-Polygon (disc) + d → wächst  ✓
        //   CCW-Polygon (hole) + d → schrumpft → muss negiert werden
        let pts = Geometry.offsetPolygon(clone.points, additionalOffset, true);
        if (pts && pts.length > 2) {
            const areaNew = Math.abs(Geometry.getSignedArea(pts));
            const wantGrow = isHole ? (additionalOffset < 0) : (additionalOffset > 0);
            if ((areaNew > areaOrig) !== wantGrow) {
                pts = Geometry.offsetPolygon(clone.points, -additionalOffset, true);
            }
        }

        if (pts && pts.length > 2) {
            clone.points = pts.map(p => ({ x: p.x, y: p.y }));
        }

        clone._cachedKerfPolyline = null;
        clone._cacheKey = null;
        clone._cachedLeadInPath = null;
        clone._cachedLeadOutPath = null;
        clone._cachedOvercutPath = null;
    }

    /**
     * Einzelne CNC-Datei als Download auslösen.
     * Nutzt FSAPI-Ordner wenn verfügbar (CeraCUT Shim setzt window._cncDirHandle).
     */
    async _downloadIntarsiaFile(code, filename) {
        if (!code) return false;
        if (!this._savingFiles) this._savingFiles = new Set();
        if (this._savingFiles.has(filename)) return false;

        // V6.43: Server-CNC-Ordner zuerst
        this._savingFiles.add(filename);
        try {
            const st = await this._saveCNCToServer(filename, code);
            if (st === 'saved') return true;
            if (st === 'cancelled') return false;
        } finally {
            this._savingFiles.delete(filename);
        }

        // FSAPI-Ordner-Export (wie normaler CNC-Export)
        if (window._cncDirHandle) {
            this._savingFiles.add(filename);
            try {
                const fh = await window._cncDirHandle.getFileHandle(filename, { create: true });
                const w = await fh.createWritable();
                await w.write(code);
                await w.close();
                console.log(`[Intarsia V2.0] FSAPI: ${filename} → ${window._cncDirHandle.name}/`);
                return true;
            } catch (err) {
                console.warn(`[Intarsia V2.0] FSAPI fehlgeschlagen, Fallback auf Download:`, err);
            } finally {
                this._savingFiles.delete(filename);
            }
        }

        // Fallback: normaler Browser-Download
        this._savingFiles?.add(filename);
        try {
            const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`[Intarsia V2.0] Download: ${filename} (${code.length} bytes)`);
            return true;
        } catch (err) {
            console.error(`[Intarsia V2.0] Download fehlgeschlagen: ${filename}`, err);
            return false;
        } finally {
            this._savingFiles?.delete(filename);
        }
    }

    _showPreviewModal(code, warnings, stats) {
        // Existierendes Modal entfernen
        const existing = document.getElementById('gcode-preview-modal');
        if (existing) existing.remove();

        const warningHtml = warnings.length > 0
            ? `<div style="background:#fff3cd;color:#856404;padding:8px;border-radius:4px;margin-bottom:8px;font-size:12px">⚠️ ${warnings.map(sanitizeHTML).join('<br>⚠️ ')}</div>`
            : '';

        const modal = document.createElement('div');
        modal.id = 'gcode-preview-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
        modal.innerHTML = `
            <div style="background:#1e1e1e;border-radius:8px;width:90%;max-width:1200px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
                <div style="padding:16px 20px;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center">
                    <div>
                        <span style="color:#fff;font-weight:600">G-Code Vorschau</span>
                        <span style="color:#888;margin-left:12px;font-size:13px">${stats.contours} Konturen · ${code.split('\n').length} Zeilen · ${(code.length/1024).toFixed(1)} KB</span>
                    </div>
                    <div>
                        <button id="gcode-tab-path" style="background:#0d6efd;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;margin-right:4px;font-size:13px">Toolpath</button>
                        <button id="gcode-tab-code" style="background:#333;color:#aaa;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;margin-right:8px;font-size:13px">G-Code</button>
                        <button id="gcode-copy-btn" style="background:#555;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;margin-right:8px;font-size:13px">Kopieren</button>
                        <button id="gcode-close-btn" style="background:#444;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px">Schliessen</button>
                    </div>
                </div>
                ${warningHtml}
                <div id="gcode-preview-content" style="flex:1;overflow:hidden;position:relative">
                    <canvas id="gcode-toolpath-canvas" style="width:100%;height:100%;background:#111"></canvas>
                    <pre id="gcode-text-view" style="display:none;margin:0;padding:16px 20px;overflow:auto;height:100%;color:#d4d4d4;font-family:'Consolas','Courier New',monospace;font-size:13px;line-height:1.5;white-space:pre">${this._escapeHtml(code)}</pre>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Tab-Switching
        const tabPath = modal.querySelector('#gcode-tab-path');
        const tabCode = modal.querySelector('#gcode-tab-code');
        const canvas = modal.querySelector('#gcode-toolpath-canvas');
        const textView = modal.querySelector('#gcode-text-view');

        tabPath.addEventListener('click', () => {
            canvas.style.display = 'block'; textView.style.display = 'none';
            tabPath.style.background = '#0d6efd'; tabPath.style.color = '#fff';
            tabCode.style.background = '#333'; tabCode.style.color = '#aaa';
        });
        tabCode.addEventListener('click', () => {
            canvas.style.display = 'none'; textView.style.display = 'block';
            tabCode.style.background = '#0d6efd'; tabCode.style.color = '#fff';
            tabPath.style.background = '#333'; tabPath.style.color = '#aaa';
        });

        // Events
        let escHandler;
        const closePreview = () => { modal.remove(); document.removeEventListener('keydown', escHandler); };
        modal.querySelector('#gcode-close-btn').addEventListener('click', closePreview);
        modal.addEventListener('click', (e) => { if (e.target === modal) closePreview(); });
        modal.querySelector('#gcode-copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(code).then(() => {
                this.showToast('G-Code in Zwischenablage kopiert', 'success');
            });
        });

        // ESC zum Schließen
        escHandler = (e) => { if (e.key === 'Escape') closePreview(); };
        document.addEventListener('keydown', escHandler);

        // V6.0: Toolpath zeichnen
        requestAnimationFrame(() => this._renderToolpathPreview(canvas));
    }

    /** V6.0: 2D-Toolpath-Vorschau auf Canvas zeichnen */
    _renderToolpathPreview(canvas) {
        if (!canvas || !this.contours || !this.cutOrder) return;

        const container = canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Bounding Box aller Konturen
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const cuttable = this.cutOrder
            .map(idx => this.contours[idx])
            .filter(c => c && !c.isReference);

        cuttable.forEach(c => {
            if (!c.points) return;
            c.points.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });
        });

        if (!isFinite(minX)) return;

        const margin = 40;
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const scale = Math.min((w - 2 * margin) / rangeX, (h - 2 * margin) / rangeY);
        const offX = margin + ((w - 2 * margin) - rangeX * scale) / 2;
        const offY = margin + ((h - 2 * margin) - rangeY * scale) / 2;

        const tx = (x) => offX + (x - minX) * scale;
        const ty = (y) => offY + (maxY - y) * scale; // Y invertiert

        // Hintergrund
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        // Referenz-Kontur (grau)
        for (const ref of this.contours.filter(c => c.isReference)) {   // V6.62: mehrere Referenzen (Fliesen)
            if (!(ref.points?.length > 1)) continue;
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ref.points.forEach((p, i) => i === 0 ? ctx.moveTo(tx(p.x), ty(p.y)) : ctx.lineTo(tx(p.x), ty(p.y)));
            if (ref.isClosed) ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Nullpunkt
        if (this.settings.origin) {
            const ox = tx(this.settings.origin.x);
            const oy = ty(this.settings.origin.y);
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy + 8); ctx.stroke();
        }

        // Konturen nach Schneidreihenfolge zeichnen
        const colors = {
            disc: '#4fc3f7',  // Cyan
            hole: '#81c784',  // Grün
            slit: '#ffb74d'   // Orange
        };

        let prevEnd = null;
        cuttable.forEach((c, orderIdx) => {
            if (!c.points || c.points.length < 2) return;

            const startPt = c.points[0];
            const color = colors[c.cuttingMode] || '#888';

            // Eilgang (G00) — gepunktete rote Linie
            if (prevEnd) {
                ctx.strokeStyle = '#ff444488';
                ctx.lineWidth = 0.5;
                ctx.setLineDash([2, 4]);
                ctx.beginPath();
                ctx.moveTo(tx(prevEnd.x), ty(prevEnd.y));
                ctx.lineTo(tx(startPt.x), ty(startPt.y));
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Kontur zeichnen
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            c.points.forEach((p, i) => i === 0 ? ctx.moveTo(tx(p.x), ty(p.y)) : ctx.lineTo(tx(p.x), ty(p.y)));
            if (c.isClosed) ctx.closePath();
            ctx.stroke();

            // Startpunkt-Markierung (kleiner Kreis)
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(tx(startPt.x), ty(startPt.y), 3, 0, Math.PI * 2);
            ctx.fill();

            // Reihenfolge-Nummer
            ctx.fillStyle = '#fff8';
            ctx.font = '10px sans-serif';
            const bb = c.points.reduce((a, p) => ({
                cx: a.cx + p.x / c.points.length,
                cy: a.cy + p.y / c.points.length
            }), { cx: 0, cy: 0 });
            ctx.fillText(String(orderIdx + 1), tx(bb.cx) - 4, ty(bb.cy) + 4);

            prevEnd = c.points[c.points.length - 1];
        });

        // Legende
        ctx.font = '11px sans-serif';
        let ly = h - 12;
        ctx.fillStyle = '#4fc3f7'; ctx.fillText('— Disc (Aussen)', margin, ly);
        ctx.fillStyle = '#81c784'; ctx.fillText('— Hole (Innen)', margin + 110, ly);
        ctx.fillStyle = '#ffb74d'; ctx.fillText('— Slit', margin + 220, ly);
        ctx.fillStyle = '#ff444488'; ctx.fillText('--- Eilgang (G00)', margin + 275, ly);
    }

    _escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    // ════════════════════════════════════════════════════════════════
    // UTILS
    // ════════════════════════════════════════════════════════════════
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    
    // ════════════════════════════════════════════════════════════════
    // UNDO/REDO UI-Helfer (V1.0)
    // ════════════════════════════════════════════════════════════════
    
    /**
     * Aktualisiert Undo/Redo Toolbar-Buttons (disabled/enabled + Tooltip)
     * Wird als Callback von UndoManager.onStateChange aufgerufen.
     * @param {{ undoCount: number, redoCount: number, lastAction: string|null }} state
     */
    _updateUndoUI(state) {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        
        if (btnUndo) {
            btnUndo.disabled = !state.undoCount;
            btnUndo.title = state.lastAction
                ? `Rückgängig: ${state.lastAction} (STRG+Z)`
                : 'Rückgängig (STRG+Z)';
        }
        if (btnRedo) {
            btnRedo.disabled = !state.redoCount;
            btnRedo.title = 'Wiederholen (STRG+Y)';
        }
    }

    // ════════════════════════════════════════════════════════════════
    // V3.8: LAYER UI
    // ════════════════════════════════════════════════════════════════

    /** Aktualisiert alle Layer-Dropdowns und Farbpunkte */
    _updateLayerUI() {
        const layers = this.layerManager.getAllLayers();
        const active = this.layerManager.activeLayer;
        const activeLayer = this.layerManager.getActiveLayer();
        const activeColor = activeLayer?.color || '#fff';

        // Live-Zählung: Layer mit Konturen ermitteln (unabhängig von entityCount-Cache)
        const usedLayers = new Set();
        const allContours = this.contours || [];
        const dxfContours = this.dxfResult?.contours || [];
        for (const c of allContours) usedLayers.add(c.layer || '0');
        for (const c of dxfContours) usedLayers.add(c.layer || '0');

        // Alle importierten DXF-Layer einbeziehen (auch TABLES-Layer ohne Entities)
        if (this.dxfResult?.layers) {
            for (const name of this.dxfResult.layers) {
                if (name) usedLayers.add(name);
            }
        }

        // Alle Layer anzeigen (auch leere, manuell erstellte)
        const visibleLayers = layers;

        // Row-HTML generieren (für beide Dropdowns)
        const rowsHtml = visibleLayers.map(l => {
            const isActive = l.name === active;
            const cls = ['layer-dd-row'];
            if (isActive) cls.push('active');
            if (!l.visible) cls.push('dimmed');
            if (l.locked) cls.push('locked');
            const visIcon = l.visible ? '&#128065;' : '&#128065;&#xFE0E;';
            const visTitle = l.visible ? 'Ausblenden' : 'Einblenden';
            const lockIcon = l.locked ? '&#128274;' : '&#128275;';
            const lockTitle = l.locked ? 'Entsperren' : 'Sperren';
            const lockStyle = l.name === '0' ? ' style="visibility:hidden"' : (l.locked ? ' style="color:#e8a020"' : '');
            return `<div class="${cls.join(' ')}" data-layer="${l.name}">` +
                `<span class="layer-dd-vis" title="${visTitle}" style="opacity:${l.visible ? 1 : 0.3}">${visIcon}</span>` +
                `<span class="layer-dd-lock" title="${lockTitle}"${lockStyle}>${lockIcon}</span>` +
                `<span class="layer-dd-row-color" style="background:${l.color}"></span>` +
                `<span class="layer-dd-row-name">${l.name}</span>` +
                `</div>`;
        }).join('');

        // Ribbon-Dropdown Trigger + Panel
        const ribbonTrigger = document.getElementById('ribbon-layer-trigger');
        if (ribbonTrigger) {
            const colorSpan = ribbonTrigger.querySelector('.layer-dd-color');
            const nameSpan = ribbonTrigger.querySelector('.layer-dd-name');
            if (colorSpan) colorSpan.style.background = activeColor;
            if (nameSpan) nameSpan.textContent = active;
        }
        const ribbonPanel = document.getElementById('ribbon-layer-panel');
        if (ribbonPanel) ribbonPanel.innerHTML = rowsHtml;

        // Status-Bar Dropdown Trigger + Panel
        const statusTrigger = document.getElementById('status-layer-trigger');
        if (statusTrigger) {
            const colorSpan = statusTrigger.querySelector('.layer-dd-color');
            const nameSpan = statusTrigger.querySelector('.layer-dd-name');
            if (colorSpan) colorSpan.style.background = activeColor;
            if (nameSpan) nameSpan.textContent = active;
        }
        const statusPanel = document.getElementById('status-layer-panel');
        if (statusPanel) statusPanel.innerHTML = rowsHtml;
    }

    /** Selektierte Konturen auf neuen Layer verschieben */
    _moveSelectedContoursToLayer(newLayer) {
        const selected = this.contours.filter(c => c.isSelected);
        if (selected.length === 0) return;

        // Snapshot für Undo
        const snapshot = selected.map(c => ({ contour: c, oldLayer: c.layer }));
        const app = this;

        // Anwenden
        selected.forEach(c => { c.layer = newLayer; });

        // Undo-Command
        const cmd = new FunctionCommand(
            `Layer → ${newLayer} (${selected.length} Konturen)`,
            () => { snapshot.forEach(s => { s.contour.layer = newLayer; }); app.layerManager.updateEntityCounts(app.contours); app.renderer?.render(); app.updateContourPanel(); },
            () => { snapshot.forEach(s => { s.contour.layer = s.oldLayer; }); app.layerManager.updateEntityCounts(app.contours); app.renderer?.render(); app.updateContourPanel(); }
        );
        this.undoManager.pushExecuted(cmd);
        this.undoManager.redoStack.length = 0;
        this.undoManager._notifyStateChange();

        this.layerManager.updateEntityCounts(this.contours);
        this.renderer?.render();
        this.updateContourPanel();
        this.showToast(`${selected.length} Kontur(en) → Layer "${newLayer}" (STRG+Z = Rückgängig)`, 'success');
        console.log(`[Layer] ${selected.length} Konturen verschoben auf Layer "${newLayer}"`);
    }

    /** Layer-Manager Dialog öffnen */
    openLayerManager() {
        this.layerManager.updateEntityCounts(this.contours);
        this._renderLayerManagerTable();
        document.getElementById('layer-manager-dialog').style.display = 'flex';
    }

    /** Layer-Manager Dialog schließen */
    closeLayerManager() {
        document.getElementById('layer-manager-dialog').style.display = 'none';
    }

    /** Layer-Manager Tabelle rendern */
    _renderLayerManagerTable() {
        const tbody = document.getElementById('lm-table-body');
        if (!tbody) return;
        const layers = this.layerManager.getAllLayers();
        const active = this.layerManager.activeLayer;

        tbody.innerHTML = layers.map((l, idx) => {
            const isActive = l.name === active;
            const rowClass = isActive ? 'lm-active' : '';
            const visClass = l.visible ? '' : ' off';
            const lockClass = l.locked ? ' locked' : '';
            const visIcon = l.visible ? '💡' : '💡';
            const lockIcon = l.locked ? '🔒' : '🔓';
            const isZero = l.name === '0';
            const draggable = isZero ? '' : ' draggable="true"';
            const handle = isZero ? '' : '<span class="lm-drag-handle">≡</span>';
            const safeName = sanitizeHTML(l.name);
            const safeColor = sanitizeHTML(l.color);
            return `<tr class="${rowClass}" data-layer="${safeName}" data-order="${idx}"${draggable}>
                <td>${isActive ? '▶' : ''}${handle}</td>
                <td><button class="lm-visible-btn${visClass}" data-action="toggle-vis" data-layer="${safeName}">${visIcon}</button></td>
                <td><button class="lm-lock-btn${lockClass}" data-action="toggle-lock" data-layer="${safeName}">${lockIcon}</button></td>
                <td>${safeName}</td>
                <td><span class="lm-color-swatch" data-action="change-color" data-layer="${safeName}" style="background:${safeColor}"></span></td>
                <td><select class="lm-linetype-select" data-action="change-linetype" data-layer="${safeName}">
                    <option value="Continuous"${l.lineType === 'Continuous' ? ' selected' : ''}>Continuous</option>
                    <option value="Dashed"${l.lineType === 'Dashed' ? ' selected' : ''}>Dashed</option>
                    <option value="DashDot"${l.lineType === 'DashDot' ? ' selected' : ''}>DashDot</option>
                    <option value="Dotted"${l.lineType === 'Dotted' ? ' selected' : ''}>Dotted</option>
                </select></td>
                <td style="text-align:right">${l.entityCount}</td>
            </tr>`;
        }).join('');

        // Drag-and-Drop initialisieren
        this._initLayerDragAndDrop(tbody);
    }

    /** Drag-and-Drop für Layer-Manager Tabelle */
    _initLayerDragAndDrop(tbody) {
        let draggedRow = null;

        tbody.querySelectorAll('tr[draggable="true"]').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                draggedRow = row;
                row.classList.add('lm-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('lm-dragging');
                tbody.querySelectorAll('tr').forEach(r => r.classList.remove('lm-drag-over'));
                draggedRow = null;
            });
        });

        // dragover/dragleave/drop auf ALLE Rows (außer Layer "0")
        tbody.querySelectorAll('tr').forEach(row => {
            const layerName = row.dataset.layer;
            if (layerName === '0') return; // Nicht auf Layer "0" droppen

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (row !== draggedRow) {
                    row.classList.add('lm-drag-over');
                }
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('lm-drag-over');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('lm-drag-over');
                if (!draggedRow || row === draggedRow) return;

                const fromIdx = parseInt(draggedRow.dataset.order, 10);
                const toIdx = parseInt(row.dataset.order, 10);

                this.layerManager.reorderLayer(fromIdx, toIdx);
                this._renderLayerManagerTable();
                this._updateLayerUI();
                console.log(`[LayerManager V1.1] Reorder: "${draggedRow.dataset.layer}" → Position ${toIdx}`);
            });
        });
    }

    // ════════════════════════════════════════════════════════════════
    // DRUCKEN
    // ════════════════════════════════════════════════════════════════

    /**
     * Canvas-Inhalt drucken — rendert auf ein temporäres Canvas mit weißem
     * Hintergrund und Konturen in Layerfarbe, skaliert auf A4 Landscape.
     */
    printCanvas(region = null, mode = null) {
        // V6.82: Farbmodus waehlen (Farbe / Schwarz-Weiss), danach erneut mit mode aufrufen
        if (!mode) {
            if (!this.contours || this.contours.length === 0) {
                this.showToast('Keine Konturen zum Drucken', 'warning');
                return;
            }
            this._askPrintMode(m => this.printCanvas(region, m));
            return;
        }
        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen zum Drucken', 'warning');
            return;
        }

        const renderer = this.renderer;
        if (!renderer) return;

        // Bounding-Box aller sichtbaren Konturen berechnen
        const lm = this.layerManager;
        const visible = lm
            ? this.contours.filter(c => lm.isVisible(c.layer))
            : this.contours;

        if (visible.length === 0) {
            this.showToast('Keine sichtbaren Konturen zum Drucken', 'warning');
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (region) {
            // V6.79: Bereichsdruck — Ausschnitt statt Gesamt-Bounding-Box
            ({ minX, minY, maxX, maxY } = region);
        } else {
            for (const c of visible) {
                for (const p of c.points) {
                    if (p.x < minX) minX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y > maxY) maxY = p.y;
                }
            }
        }

        const geoW = maxX - minX;
        const geoH = maxY - minY;
        if (geoW < 0.001 || geoH < 0.001) return;

        // A4 Landscape bei 150 DPI — gute Qualität für Druck
        const DPI = 150;
        const pageW = Math.round(277 / 25.4 * DPI); // 277mm bedruckbar (A4L - 2×10mm)
        const pageH = Math.round(190 / 25.4 * DPI); // 190mm bedruckbar (A4L - 2×10mm)

        // Skalierung: Geometrie in Seite einpassen mit 5% Rand
        const margin = 0.05;
        const usableW = pageW * (1 - 2 * margin);
        const usableH = pageH * (1 - 2 * margin);
        const scale = Math.min(usableW / geoW, usableH / geoH);

        // Print-Canvas vorbereiten
        const printCanvas = document.getElementById('print-canvas');
        if (!printCanvas) { console.warn('[App] print-canvas element not found'); return; }
        printCanvas.width = pageW;
        printCanvas.height = pageH;
        const ctx = printCanvas.getContext('2d');

        // Weißer Hintergrund
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);

        // Transformation: Geometrie zentriert auf Seite
        const drawW = geoW * scale;
        const drawH = geoH * scale;
        const offsetX = (pageW - drawW) / 2;
        const offsetY = (pageH - drawH) / 2;

        ctx.save();
        ctx.translate(offsetX, offsetY + drawH); // +drawH weil Y invertiert
        ctx.scale(scale, -scale);
        ctx.translate(-minX, -minY);

        // V6.79: Bereichsdruck — alles ausserhalb des Auswahlrahmens abschneiden
        if (region) {
            ctx.beginPath();
            ctx.rect(minX, minY, geoW, geoH);
            ctx.clip();
        }

        // V6.80: Layerfarben uebernehmen. Sehr helle Farben (z.B. Weiss, Gelb) sind auf
        // weissem Papier unsichtbar -> auf Schwarz bzw. abgedunkelt zurueckfallen.
        const printColor = (layerName) => {
            if (mode === 'bw') return '#000000';
            const col = lm?.getLayer(layerName || '0')?.color;
            const m = /^#?([0-9a-f]{6})$/i.exec((col || '').trim());
            if (!m) return '#000000';
            const n = parseInt(m[1], 16);
            let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (lum > 0.85) return '#000000';
            if (lum > 0.6) { r = Math.round(r * 0.6); g = Math.round(g * 0.6); b = Math.round(b * 0.6); }
            return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        };

        ctx.lineWidth = 1.5 / scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (const contour of visible) {
            const pts = contour.points;
            if (!pts || pts.length < 2) continue;

            ctx.strokeStyle = printColor(contour.layer);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            if (contour.isClosed) ctx.closePath();
            ctx.stroke();
        }

        ctx.restore();

        // Metadaten im Footer
        const footer = document.getElementById('print-footer');
        const fnEl = footer.querySelector('.print-filename');
        const dtEl = footer.querySelector('.print-date');
        fnEl.textContent = (this.loadedFileName || 'Unbenannt') + (region ? ' (Ausschnitt)' : '');
        const now = new Date();
        dtEl.textContent = now.toLocaleDateString('de-DE') + ' ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        // System-Druckdialog
        console.log('[App] Drucken gestartet:', this.loadedFileName || 'Unbenannt');
        window.print();
    }

    /**
     * V6.82: Kleiner Dialog "Farbe / Schwarz-Weiss" vor dem Drucken.
     * Letzte Wahl wird in localStorage gemerkt. Enter = Drucken, ESC = Abbruch.
     * @param {(mode: 'color'|'bw') => void} onConfirm
     */
    _askPrintMode(onConfirm) {
        if (document.getElementById('print-mode-modal')) return;
        let last = 'color';
        try { last = localStorage.getItem('ceracut.printMode') === 'bw' ? 'bw' : 'color'; } catch (_) { /* privat/gesperrt */ }

        const wrap = document.createElement('div');
        wrap.id = 'print-mode-modal';
        wrap.innerHTML = `
            <div class="pm-box" role="dialog" aria-label="Druckoptionen">
                <div class="pm-title">Drucken</div>
                <label><input type="radio" name="pm-mode" value="color"> Farbe (Layerfarben)</label>
                <label><input type="radio" name="pm-mode" value="bw"> Schwarz-Weiß</label>
                <div class="pm-actions">
                    <button type="button" class="pm-cancel">Abbrechen</button>
                    <button type="button" class="pm-ok">Drucken</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        wrap.querySelector(`input[value="${last}"]`).checked = true;

        const close = () => { window.removeEventListener('keydown', onKey, true); wrap.remove(); };
        const confirm = () => {
            const mode = wrap.querySelector('input[name="pm-mode"]:checked')?.value === 'bw' ? 'bw' : 'color';
            try { localStorage.setItem('ceracut.printMode', mode); } catch (_) { /* ignorieren */ }
            close();
            onConfirm(mode);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
            else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); confirm(); }
        };
        window.addEventListener('keydown', onKey, true);
        wrap.querySelector('.pm-ok').addEventListener('click', confirm);
        wrap.querySelector('.pm-cancel').addEventListener('click', close);
        wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
        wrap.querySelector('.pm-ok').focus();
    }

    /**
     * V6.79: Bereichsdruck — Nutzer zieht einen Rahmen auf dem Canvas auf,
     * danach wird nur dieser Ausschnitt (World-Koordinaten) gedruckt.
     * ESC oder Rechtsklick bricht ab.
     */
    startPrintSelection() {
        const renderer = this.renderer;
        const canvas = renderer?.canvas;
        const area = document.getElementById('canvas-area');
        if (!canvas || !area) return;
        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen zum Drucken', 'warning');
            return;
        }
        if (document.getElementById('print-select-overlay')) return; // laeuft bereits

        const overlay = document.createElement('div');
        overlay.id = 'print-select-overlay';
        const box = document.createElement('div');
        box.className = 'print-select-box';
        box.style.display = 'none';
        overlay.appendChild(box);
        area.appendChild(overlay);
        this.showToast('Druckbereich mit der Maus aufziehen (ESC = Abbruch)', 'info');

        let start = null;
        const cleanup = () => {
            window.removeEventListener('keydown', onKey, true);
            overlay.remove();
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(); }
        };
        window.addEventListener('keydown', onKey, true);

        // Position relativ zum Canvas (wie e.offsetX im Renderer) und auf Canvas begrenzt
        const rel = (e) => {
            const r = canvas.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(r.width,  e.clientX - r.left)),
                y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
                left: r.left, top: r.top
            };
        };

        overlay.addEventListener('contextmenu', (e) => { e.preventDefault(); cleanup(); });
        overlay.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            start = rel(e);
            overlay.setPointerCapture(e.pointerId);
            box.style.display = 'block';
        });
        overlay.addEventListener('pointermove', (e) => {
            if (!start) return;
            const cur = rel(e);
            const ar = area.getBoundingClientRect();
            box.style.left   = (start.left + Math.min(start.x, cur.x) - ar.left) + 'px';
            box.style.top    = (start.top  + Math.min(start.y, cur.y) - ar.top)  + 'px';
            box.style.width  = Math.abs(cur.x - start.x) + 'px';
            box.style.height = Math.abs(cur.y - start.y) + 'px';
        });
        overlay.addEventListener('pointerup', (e) => {
            if (!start) return;
            const end = rel(e);
            const s0 = start;
            cleanup();
            if (Math.abs(end.x - s0.x) < 5 || Math.abs(end.y - s0.y) < 5) {
                this.showToast('Bereich zu klein — Auswahl abgebrochen', 'warning');
                return;
            }
            // Bildschirm -> World (Y ist im Renderer invertiert, daher min/max neu bilden)
            const a = renderer.screenToWorld(s0.x, s0.y);
            const b = renderer.screenToWorld(end.x, end.y);
            this.printCanvas({
                minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x),
                minY: Math.min(a.y, b.y), maxY: Math.max(a.y, b.y)
            });
        });
    }

    // ════════════════════════════════════════════════════════════════
    // V3.8: DXF SPEICHERN
    // ════════════════════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════════
    // V6.93: SPEICHERN-POPUP — neue Dateien sofort im Server-Ordner DXF ablegen
    // ════════════════════════════════════════════════════════════════

    /** Bytes → Base64 (chunked, vermeidet Stack-Überlauf bei großen Dateien) */
    _bytesToBase64(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        return btoa(bin);
    }

    /** POST /api/dxf/save → { ok } | { exists } | { error } */
    async _postDxfSave(filename, bytes, overwrite, dir = '') {
        const resp = await fetch('/api/dxf/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dir, filename, content: this._bytesToBase64(bytes), overwrite: !!overwrite })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.status === 409) return { exists: true };
        if (!resp.ok) return { error: data.error || resp.statusText || 'Unbekannter Fehler' };
        return { ok: true, filename: data.filename || filename, dir: data.dir || '' };
    }

    /** Aktuellen Dokumentinhalt als ANSI-1252-Bytes erzeugen (für Speichern in den DXF-Ordner) */
    _currentDxfBytes(filename) {
        const result = this.dxfWriter.generate(this.contours || [], this.layerManager, {
            filename, imageUnderlayManager: this.imageUnderlayManager
        });
        return this.dxfWriter._encodeAnsi1252(result.content);
    }

    /**
     * Popup: Dateiname eingeben und sofort im Server-Ordner DXF speichern.
     * @param {object} opts
     * @param {string} [opts.defaultName] - vorgeschlagener Name
     * @param {string} [opts.content]     - fertiger DXF-Text (CAD-Tools); sonst aktuelles Dokument
     * @param {string} [opts.title]
     * @returns {Promise<boolean>} true = gespeichert
     */
    promptSaveToServer({ defaultName = 'zeichnung.dxf', content = null, title = 'Neue Datei speichern', bind = true } = {}) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483000;display:flex;align-items:center;justify-content:center;';
            overlay.innerHTML = `
                <div style="background:#252526;color:#ddd;border:1px solid #555;border-radius:8px;padding:20px;min-width:360px;max-width:90vw;font-family:inherit;">
                    <h3 style="margin:0 0 6px;font-size:15px;">💾 ${sanitizeHTML(title)}</h3>
                    <div style="font-size:12px;color:#999;margin-bottom:12px;">Speicherort: Server-Ordner <b>DXF</b></div>
                    <div id="srv-save-path" style="font-size:12px;color:#8cf;margin-bottom:4px;word-break:break-all;"></div>
                    <div id="srv-save-dirs" style="max-height:160px;overflow:auto;border:1px solid #444;border-radius:4px;margin-bottom:10px;background:#1e1e1e;font-size:13px;"></div>
                    <input type="text" id="srv-save-name" style="width:100%;box-sizing:border-box;padding:7px;background:#1e1e1e;color:#eee;border:1px solid #555;border-radius:4px;font-size:13px;">
                    <div id="srv-save-msg" style="min-height:18px;margin-top:8px;font-size:12px;color:#f88;"></div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                        <button id="srv-save-local" title="Nur in Ausnahmefällen" style="padding:6px 14px;margin-right:auto;">Lokal (Ausnahme)</button>
                        <button id="srv-save-cancel" style="padding:6px 14px;">Später</button>
                        <button id="srv-save-ok" style="padding:6px 14px;background:#0e639c;color:#fff;border:0;border-radius:4px;">Speichern</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            const input = overlay.querySelector('#srv-save-name');
            const msg = overlay.querySelector('#srv-save-msg');
            const okBtn = overlay.querySelector('#srv-save-ok');
            input.value = defaultName;
            let curDir = '';
            const dirsEl = overlay.querySelector('#srv-save-dirs');
            const pathEl = overlay.querySelector('#srv-save-path');
            const loadDirs = async (dir) => {
                try {
                    const resp = await fetch('/api/dxf/list?path=' + encodeURIComponent(dir));
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data.error || resp.statusText);
                    curDir = dir;
                    pathEl.textContent = '📁 DXF/' + dir;
                    dirsEl.innerHTML = '';
                    const row = (label, target) => {
                        const d = document.createElement('div');
                        d.textContent = label;
                        d.style.cssText = 'padding:5px 8px;cursor:pointer;';
                        d.onmouseenter = () => d.style.background = '#094771';
                        d.onmouseleave = () => d.style.background = '';
                        d.onclick = () => loadDirs(target);
                        dirsEl.appendChild(d);
                    };
                    if (dir) row('⬆ ..', dir.split('/').slice(0, -1).join('/'));
                    for (const it of data.items.filter(i => i.type === 'directory')) row('📁 ' + it.name, dir ? dir + '/' + it.name : it.name);
                    if (!dirsEl.children.length) dirsEl.innerHTML = '<div style="padding:5px 8px;color:#777;">(keine Unterordner)</div>';
                } catch (err) {
                    msg.textContent = 'Ordnerliste: ' + err.message;
                }
            };
            loadDirs('');
            setTimeout(() => { input.focus(); input.setSelectionRange(0, input.value.replace(/\.dxf$/i, '').length); }, 30);

            const done = (v) => { overlay.remove(); resolve(v); };
            const doSave = async (overwrite = false) => {
                let name = input.value.trim();
                if (!name) { msg.textContent = 'Bitte einen Dateinamen eingeben.'; return; }
                if (!/\.dxf$/i.test(name)) name += '.dxf';
                okBtn.disabled = true; msg.textContent = '';
                try {
                    const bytes = content != null
                        ? this.dxfWriter._encodeAnsi1252(content)
                        : this._currentDxfBytes(name);
                    const r = await this._postDxfSave(name, bytes, overwrite, curDir);
                    if (r.exists) {
                        okBtn.disabled = false;
                        if (confirm(`"${name}" existiert bereits im DXF-Ordner. Überschreiben?`)) return doSave(true);
                        msg.textContent = 'Datei existiert bereits — bitte anderen Namen wählen.';
                        return;
                    }
                    if (r.error) { okBtn.disabled = false; msg.textContent = 'Fehler: ' + r.error; return; }
                    if (!bind) { this.showToast(`✅ ${r.filename} im DXF-Ordner gespeichert`, 'success'); done(true); return; }
                    // Dokument an die gespeicherte Datei binden (Strg+S schreibt künftig dorthin)
                    this._dxfServerName = (r.dir ? r.dir + '/' : '') + r.filename;
                    this._dxfFileHandle = null;
                    this.loadedFileName = r.filename;
                    this.currentProjectName = r.filename;
                    this.dxfFileName = r.filename;
                    this.isDirty = false;
                    const fn = document.getElementById('current-filename');
                    if (fn) fn.textContent = `📄 ${r.filename}`;
                    const planInput = document.getElementById('planname-input');
                    if (planInput) planInput.value = r.filename.replace(/\.dxf$/i, '').toUpperCase();
                    this.documentManager?._renderTabs();
                    this.showToast(`✅ ${r.filename} im DXF-Ordner gespeichert`, 'success');
                    done(true);
                } catch (err) {
                    okBtn.disabled = false;
                    msg.textContent = 'Fehler: ' + err.message;
                }
            };
            okBtn.addEventListener('click', () => doSave(false));
            // Ausnahme: lokaler Download (nur auf ausdrücklichen Wunsch des Users)
            overlay.querySelector('#srv-save-local').addEventListener('click', () => {
                let name = input.value.trim() || defaultName;
                if (!/\.dxf$/i.test(name)) name += '.dxf';
                const bytes = content != null ? this.dxfWriter._encodeAnsi1252(content) : this._currentDxfBytes(name);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/dxf' }));
                a.download = name;
                document.body.appendChild(a); a.click();
                setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
                this.showToast(`${name} lokal heruntergeladen (Ausnahme)`, 'warning');
                done(false);
            });
            overlay.querySelector('#srv-save-cancel').addEventListener('click', () => done(false));
            overlay.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') doSave(false);
                else if (e.key === 'Escape') done(false);
                e.stopPropagation();
            });
            overlay.addEventListener('keyup', (e) => e.stopPropagation());
        });
    }

    /** Neue leere Zeichnung: Tab anlegen und sofort zum Speichern auffordern */
    async createNewDrawing() {
        this.documentManager?.createDocument();
        this.showToast('Neue Zeichnung (neuer Tab)', 'success');
        await this.promptSaveToServer({ defaultName: this._nextDrawingName(), title: 'Neue Zeichnung speichern' });
    }

    _nextDrawingName() {
        const d = new Date(), p = (n) => String(n).padStart(2, '0');
        return `Zeichnung_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.dxf`;
    }

    /** Von CAD-Tools erzeugtes DXF laden (neuer Tab) und sofort zum Speichern auffordern */
    async loadGeneratedDXF(filename, content, sizeKB) {
        this.loadDXFContent(filename, content, sizeKB);
        this.isDirty = true;
        await this.promptSaveToServer({ defaultName: filename, content, title: 'Erzeugte Datei speichern' });
    }

    /** Speichern (gleicher Dateiname) — nutzt letzten FileHandle wenn vorhanden */
    async saveDXF() {
        // V6.93: Dokument gehört zu einer Datei im Server-DXF-Ordner → dorthin zurückschreiben
        if (this._dxfServerName && !this._dxfFileHandle) {
            if (this._isSaving) return;
            this._isSaving = true;
            try {
                const full = this._dxfServerName;
                const i = full.lastIndexOf('/');
                const name = full.slice(i + 1), dir = i >= 0 ? full.slice(0, i) : '';
                const r = await this._postDxfSave(name, this._currentDxfBytes(name), true, dir);
                if (r.error) { this.showToast('Speichern fehlgeschlagen: ' + r.error, 'error'); return; }
                this.isDirty = false;
                this.showToast(`✅ ${full} im DXF-Ordner gespeichert`, 'success');
            } catch (err) {
                this.showToast('Speichern fehlgeschlagen: ' + err.message, 'error');
            } finally {
                this._isSaving = false;
            }
            return;
        }
        // Kein FileHandle → "Speichern unter" öffnen
        if (!this._dxfFileHandle) {
            return this.saveDXFAs();
        }

        if (this._isSaving) return;

        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen zum Speichern', 'warning');
            return;
        }

        this._isSaving = true;
        try {
            const filename = this._dxfFileHandle.name;
            const result = this.dxfWriter.generate(this.contours, this.layerManager, {
                filename,
                imageUnderlayManager: this.imageUnderlayManager
            });
            const writable = await this._dxfFileHandle.createWritable();
            await writable.write(this.dxfWriter._encodeAnsi1252(result.content));
            await writable.close();

            this.isDirty = false;
            this.showToast(
                `✅ ${filename} gespeichert (${result.stats.entities} Entities, ${(result.stats.fileSize / 1024).toFixed(1)} KB)`,
                'success'
            );
            if (result.stats.circleFallbacks > 0) {
                this.showToast(`⚠️ ${result.stats.circleFallbacks} Kreis(e) als Polyline exportiert (Validierung fehlgeschlagen)`, 'warning');
            }
            console.log('[DXF-Writer] Export (Save):', result.stats);
        } catch (err) {
            console.warn('[DXF-Writer] Direktes Speichern fehlgeschlagen, Fallback auf Speichern-unter:', err);
            return this.saveDXFAs();
        } finally {
            this._isSaving = false;
        }
    }

    /** Speichern unter... (neuer Dateiname) — öffnet immer Ordnerauswahl */
    async saveDXFAs() {
        if (this._isSaving) return;

        const defaultName = this.currentProjectName || this.loadedFileName || 'zeichnung.dxf';

        // File System Access API (Chrome, Edge, Opera)
        if (window.showSaveFilePicker) {
            try {
                const opts = {
                    id: 'ceracut-dxf',
                    suggestedName: defaultName,
                    types: [{
                        description: 'DXF-Zeichnung',
                        accept: { 'application/dxf': ['.dxf'] }
                    }]
                };
                // Letzten Ordner wiederverwenden
                if (this._lastDirHandle) {
                    opts.startIn = this._lastDirHandle;
                }
                const fileHandle = await window.showSaveFilePicker(opts);
                // Handle merken für "Speichern"
                this._dxfFileHandle = fileHandle;
                const filename = fileHandle.name;
                this.loadedFileName = filename;

                if (!this.contours || this.contours.length === 0) {
                    this.showToast('Keine Konturen zum Speichern', 'warning');
                    return;
                }
                const result = this.dxfWriter.generate(this.contours, this.layerManager, {
                    filename,
                    imageUnderlayManager: this.imageUnderlayManager
                });
                this._isSaving = true;
                try {
                    const writable = await fileHandle.createWritable();
                    await writable.write(this.dxfWriter._encodeAnsi1252(result.content));
                    await writable.close();
                } finally {
                    this._isSaving = false;
                }

                this.isDirty = false;
                this.currentProjectName = filename;
                this.showToast(
                    `✅ ${filename} gespeichert (${result.stats.entities} Entities, ${(result.stats.fileSize / 1024).toFixed(1)} KB)`,
                    'success'
                );
                if (result.stats.circleFallbacks > 0) {
                    this.showToast(`⚠️ ${result.stats.circleFallbacks} Kreis(e) als Polyline exportiert (Validierung fehlgeschlagen)`, 'warning');
                }
                console.log('[DXF-Writer] Export (SaveAs):', result.stats);
                document.getElementById('current-filename').textContent = `📄 ${filename}`;
                return;
            } catch (err) {
                this._isSaving = false;
                if (err.name === 'AbortError') return; // Benutzer hat abgebrochen
                console.warn('[DXF-Writer] File System API fehlgeschlagen, Fallback:', err);
            }
        }

        // Fallback: prompt + Download
        const filename = prompt('Dateiname:', defaultName);
        if (!filename) return;
        const safeName = filename.endsWith('.dxf') ? filename : filename + '.dxf';
        this.loadedFileName = safeName;
        this.currentProjectName = safeName;
        this._doSaveDXF(safeName);
    }

    /** DXF-Export auslösen */
    _doSaveDXF(filename) {
        if (!this.contours || this.contours.length === 0) {
            this.showToast('Keine Konturen zum Speichern', 'warning');
            return;
        }

        try {
            const result = this.dxfWriter.generateDownload(
                this.contours,
                this.layerManager,
                { filename }
            );

            this.isDirty = false;
            const stats = result.stats;
            this.showToast(
                `✅ ${filename} gespeichert (${stats.entities} Entities, ${(stats.fileSize / 1024).toFixed(1)} KB)`,
                'success'
            );
            if (stats.circleFallbacks > 0) {
                this.showToast(`⚠️ ${stats.circleFallbacks} Kreis(e) als Polyline exportiert (Validierung fehlgeschlagen)`, 'warning');
            }
            console.log('[DXF-Writer] Export:', stats);

            // Dateiname aktualisieren
            document.getElementById('current-filename').textContent = `📄 ${filename}`;
        } catch (err) {
            console.error('[DXF-Writer] Fehler:', err);
            this.showToast(`Speichern fehlgeschlagen: ${err.message}`, 'error');
        }
    }
}

// Init App
document.addEventListener('DOMContentLoaded', () => {
    // Tooltips aus zentraler Registry (TOOL_TOOLTIPS in constants.js) auf Buttons setzen
    if (typeof TOOL_TOOLTIPS !== 'undefined') {
        document.querySelectorAll('[data-tool]').forEach(el => {
            const entry = TOOL_TOOLTIPS[el.dataset.tool];
            if (entry) {
                el.setAttribute('data-tip', entry.tip + '\nTaste: ' + entry.shortcut);
                el.removeAttribute('title');
            }
        });
        // Flyout-Eintraege (z.B. Geometrie ▾ / Zuschnitte ▾): Tooltip rechts neben dem Eintrag
        document.querySelectorAll('[data-fly-tool]').forEach(el => {
            const entry = TOOL_TOOLTIPS[el.dataset.flyTool];
            if (entry) {
                el.setAttribute('data-tip', entry.tip + '\nTaste: ' + entry.shortcut);
                el.setAttribute('data-tip-pos', 'right');
            }
        });
        // Sonder-Buttons ohne data-tool
        const measureBtn = document.getElementById('btn-measure-wrap');
        if (measureBtn) {
            measureBtn.setAttribute('data-tip', 'Abstaende und Winkel messen\nTaste: F3');
            measureBtn.removeAttribute('title');
        }
    }

    // V6.73: Ribbon-Tooltips per JS (fixed, an <body>): das CSS-::after wurde vom Ribbon-Panel (overflow hidden) abgeschnitten
    (function initRibbonTips() {
        const tip = document.createElement('div');
        tip.id = 'ribbon-tip';
        tip.style.cssText = 'position:fixed;display:none;z-index:200000;max-width:300px;white-space:pre-line;pointer-events:none;' +
            'background:var(--tooltip-bg,#1e1e1e);color:var(--tooltip-text,#eee);border:1px solid var(--tooltip-border,#555);' +
            'border-radius:4px;padding:6px 10px;font-size:12px;line-height:1.4;box-shadow:0 3px 8px rgba(0,0,0,.4)';
        document.body.appendChild(tip);
        let timer = null, cur = null;
        const hide = () => { clearTimeout(timer); timer = null; cur = null; tip.style.display = 'none'; };
        document.addEventListener('mouseover', (e) => {
            const el = e.target.closest ? e.target.closest('.ribbon-panel [data-tip]') : null;
            if (el === cur) return;
            hide();
            if (!el) return;
            cur = el;
            timer = setTimeout(() => {
                tip.textContent = el.getAttribute('data-tip');
                tip.style.display = 'block';
                const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
                let x, y;
                if (el.getAttribute('data-tip-pos') === 'right') { x = r.right + 8; y = r.top + r.height / 2 - h / 2; }
                else { x = r.left + r.width / 2 - w / 2; y = r.bottom + 6; }
                x = Math.max(4, Math.min(x, window.innerWidth - w - 4));
                y = Math.max(4, Math.min(y, window.innerHeight - h - 4));
                tip.style.left = x + 'px'; tip.style.top = y + 'px';
            }, 400);
        });
        document.addEventListener('mousedown', hide);
        document.addEventListener('mouseleave', hide);
    })();

    window.app = new CeraCutApp();
});
