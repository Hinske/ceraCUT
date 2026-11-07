/**
 * CeraCUT V3.52 - Canvas Renderer
 * V3.68: Feat — Fliesenumrisse sind im Tab CAD nicht mehr als Referenz gesperrt (render() ruft CeraCutPipeline.releaseTileRefs), bleiben duenne Linie in Layerfarbe.
 * V3.67: Feat — Fliesenumrisse (automatische Referenz) werden im Tab CAD als normale Linie in Layerfarbe gezeichnet, nicht als gestrichelte Referenz; Referenz-Optik erst in CAM-Tabs.
 * V3.66: Feat — Richtungspfeile klein und rot, max. 4 je Kontur; rote Kerf-Bahn-Dreiecke entfernt (doppelt).
 * V3.64: Fix — Schnittfugenband auch bei offenen Konturen (mittig auf dem Pfad, Breite = Kerf).
 * V3.65: Fix — Fugenband offener Konturen bei Kerf-Seite Links/Rechts neben der Kontur (G41/G42), sonst mittig.
 * V3.62: Feat — AP3 Classic-Theme (Palette #666 ohne Raster, Default), isDark auch fuer classic.
 * V3.61: Feat — AP1 S4b: Leads/Ueberschnitt/Startmarke auf der Teilegeometrie (wie G-Code), Fugenband entlang der realen Strahlmitte (getLeadIn/OutToolSegments, overcut.toolPoints).
 * V3.63: Feat — Hover-Hinweis (Tooltip) am Lead-Warnsymbol mit Grund (gekuerzt/Startpunkt rotiert/Alternativ/Fallback).
 * V3.60: Feat — AP1 S3 (Waricam-Stil): Leads aus echten Segmenten (Bogen immer ctx.arc, kein Polylinien-Fallback), Anschnitt rot / Ausschnitt+Ueberschnitt blau, Pfeil in Schneidrichtung, einheitlicher Anschusspunkt, Warnsymbol (!) statt Zustandsfarben, Schnittfuge massstaeblich als Band (showKerfBand, Schalter btn-kerf-band). Typ-Farben/-Dashes/-Labels entfernt.
 * V3.58: Feat — Reihenfolge-Nummern: Anklick-Modus (cutSeq) grün/gedimmt, ausgewählte Schnitte gelb umrandet
 * V3.57: Feat — Fliesennummer gross mittig, Anklick-Modus zeigt Klick-Reihenfolge (app.tileSeq)
 * V3.52: Fix — Konturen auf Nicht-Schnitt-Layern (Konstruktion/Beschriftung, offene Linien auf Fliese) wurden unsichtbar gezeichnet (nur Hatch-Fuellung); jetzt duenne Linie in Layerfarbe
 * V3.51: Feat — Vereinfachen-Vorschau (simplifyPreview): vereinfachte Kontur Cyan mit Stuetzpunkten ueber dem Original
 * V3.50: Feat — Machbarkeits-Halo (feasibilityMap): zu schmale Konturen rot, zu nahe Nachbarn orange (Strahlbreiten-Check, feasibility.js)
 * V3.49: Fix — Konturen-Auswahl bei vielen kleinen Konturen: findContourAtPoint waehlt jetzt die NAECHSTE Kante (statt die zuletzt gezeichnete im 12-px-Radius), exakter Kantentreffer (5 px) > Flaeche (innerste Kontur) > weiter Kantenradius. Startpunkt-Drag erst nach >4 px Bewegung (Klick verschiebt Anschnitt nicht mehr). Richtungspfeile: directionArrowMode 'auto' (bei >25 Konturen nur Auswahl/Hover) | 'always' | 'never'.
 * V3.48: Feat — Lead-Typ optisch unterscheidbar: Normalzustand nach Typ gefaerbt (Arc Cyan, Linear Orange, Tangential Violett), Pierce-/Exit-Marker als Kreis/Quadrat/Raute. Warnfarben (gekuerzt/rotiert/Alternative/Fallback) unveraendert.
 * V3.47: Feat — Rechteck mit gerundeten Ecken: nur 4 Kanten-Grips (Größe ändern per Ziehen + Maßeingabe, Ecken/Radius laufen mit)
 * V3.44: Feat — Tracking-Overlay (Object Snap Tracking / Polar): gestrichelte Linien, erfasste Punkte, Fadenkreuz am getrackten Punkt
 * Features: Selection, Lead-In/Out, Overcut, Micro-Joints, Travel Paths, Order Numbers,
 *           Startpunkt-Drag im Anschuss-Modus, SLIT Support
 * V3.41: Fix — Geometry.interiorPoint() im Disc-Fill-Hole-Cutout ohne Existenz-Check
 *        aufgerufen (null-safe Guard ergänzt, Fallback auf points[0]). _drawHatchDots()
 *        nutzte Float-Loop-Counter (x += spacing) mit Drift-Risiko bei großen Bounding-Boxes
 *        — umgestellt auf Integer-Counter mit x = xMin + i * spacing.
 * V3.40: Fix — _drawArcLead() übergab arcSweepCCW ungeflippt an ctx.arc()'s
 *        anticlockwise-Parameter. ctx.arc() sweept bei anticlockwise=false mit
 *        STEIGENDEM Winkel, unser arcSweepCCW=true meint aber genau das (Welt-CCW =
 *        steigender Winkel) — die beiden Konventionen sind invertiert zueinander
 *        (sinumerik-postprocessor.js wusste das bereits: "clockwise = !arcSweepCCW").
 *        Sichtbarer Effekt: Arc-Leads an 90°-Aussenecken wurden als 270°-Major-Arc
 *        (fast Vollkreis-Schleife) statt als 90°-Minor-Arc gezeichnet. Fix: !arcSweepCCW.
 * V3.39: _getLeadColor() kennt jetzt isFallbackCenterExit (neues Lead-Out-Fallback-Flag
 *        aus cam-contour.js V5.12) — sonst falsche Farbe statt Fallback-Kennzeichnung
 * V3.38: Theme-Key pro User (_userKey(), Login/User-Management V6.32)
 * V3.37: AutoCAD-Grip-Stil (hohle Quadrate, Cold/Hover/Hot) + Vollbild-Fadenkreuz bei aktivem Tool
 * V3.36: edgeOnly — Window-Selection + Rechtsklick funktionieren im Inneren geschlossener Konturen
 * V3.35: _notifyStateChange() nach Grip-Edit → Undo-Buttons aktualisieren sich korrekt
 * V3.34: Shift-Status am ToolManager zwischenspeichern (für CAM-Tools wie BoundaryTrim)
 * V3.33: Spline Grip-Editing — Fit-Point-Grips + Re-Tessellation + Kontrollpolygon-Overlay
 * V3.32: Cycle-Selection — findAllContoursAtPoint() für Durchklicken überlappender Konturen
 * V3.31: Locked-Layer Guard — gesperrte Layer blockieren Hit-Test + Start-Triangle-Click
 * V3.30: Gap-Marker — visuelle Darstellung offener/heilbarer/geheilter Gaps (Kreis + Strichlinie)
 * V3.29: Disc-Füllung nur in CAM-Modi (nicht im CAD-Zeichenmodus)
 * V3.28: Hatch als eigenständige CamContour — cuttingMode='none' Rendering, Live-Preview
 * V3.27: Flächen-Hit — Point-in-Polygon Fallback in findContourAtPoint() für Klick IN Konturen
 * V3.26: Hatch-Fix — ctx.fill() statt ctx.clip()+fillRect() für robustes Solid-Fill, Try-Catch
 * V3.25: Multi-Material Intarsien-Overlay (materialGroup → Farbe aus INTARSIA_MATERIALS)
 * V3.24: interiorPoint() für Hole-Cutout bei konkaven Polygonen
 * V3.23: Disc-Fill in allen Modi sichtbar (nicht nur CAM), Hatch-Rendering
 * V3.22: Disc-Fill Hole-Cutout — Centroid statt points[0] für robuste Even-Odd Erkennung
 * V3.21: Disc-Füllung Fix (World-Koordinaten statt worldToScreen), Hit-Test Revert
 * V3.19: Arc-Lead Rendering Fix — gekürzte Arcs Polylinien-Fallback, breitere Linear-Dashes
 * V3.16: Notebook-Navigation — Trackpad-Pan (Zwei-Finger), Pinch-to-Zoom, Space+Drag Pan
 * V3.13: Visuelle Lead-Differenzierung (Cyan/Rot/Grün/Gelb/Magenta nach Zustand)
 * V3.12: Dimension Rendering Integration
 * V3.10: Grip Editing System (Vertex, Midpoint, Center, Quadrant)
 *        Anschussfahnen nur in CAM-Modi (nicht im CAD-Zeichenmodus)
 * V3.11: Image Underlay Rendering
 * V3.5: Ghost-Preview + Window-Selection Rendering
 * V3.53: Feat — drawTileOrigins: Fliesen-Umriss + Nullpunkt-Fadenkreuz je Fliese
 * V3.4: Drawing-Overlay + SnapManager-Rendering
 * Last Modified: 2026-11-07 MEZ
 * Build: 20261107-dirarrows
 */

// ════════════════════════════════════════════════════════════════
// CANVAS THEME PALETTES
// ════════════════════════════════════════════════════════════════
const CANVAS_THEMES = {
    dark: {
        background:     '#0f0f1a',
        grid:           '#1a1a2e',
        gridMajor:      '#2d3748',
        disc:           '#00aaff',
        hole:           '#ff6600',
        reference:      '#555555',
        openPath:       '#FF8800',
        slit:           '#FFaa00',
        selected:       '#00ff88',
        hovered:        '#ffff00',
        kerf:           '#ff0000',
        kerfSelected:   '#00ff88',
        kerfHovered:    '#ffff00',
        q1: '#22c55e', q2: '#3b82f6', q3: '#eab308', q4: '#f97316', q5: '#ef4444',
        original:       'rgba(255,255,255,0.4)',
        leadIn:         '#ff3b30',       // V3.60 (Waricam-Stil): Anschnitt rot
        leadOut:        '#3b82f6',       // Ausschnitt/Ueberschnitt blau
        leadWarn:       '#ffb000',       // Warnsymbol (gekuerzt/rotiert/Fallback)
        kerfBand:       '#ffd54a',       // Schnittfugenband
        overcut:        '#3b82f6',
        microjoint:     '#ff8800',
        travel:         '#888888',
        orderNumber:    '#ffffff',
        orderNumberBg:  'rgba(0,100,200,0.9)',
        measurement:    '#00FFFF',
        measurementText:'#FFFFFF',
        snap:           '#FFFF00',
        nullPoint:      '#00ff88',
        grip:           '#4488FF',
        gripHot:        '#FF4444',
        gripHover:      '#FFFF00',
        gapOpen:        '#FF0044',     // Rot — offener Gap
        gapHealable:    '#FFAA00',     // Amber — heilbarer Gap
        gapHealed:      '#44FF88'      // Grün — auto-geheilt
    },
    light: {
        background:     '#e8e8e8',
        grid:           '#cccccc',
        gridMajor:      '#999999',
        disc:           '#0055cc',
        hole:           '#cc3300',
        reference:      '#888888',
        openPath:       '#cc6600',
        slit:           '#bb7700',
        selected:       '#008844',
        hovered:        '#aa8800',
        kerf:           '#cc0000',
        kerfSelected:   '#008844',
        kerfHovered:    '#aa8800',
        q1: '#16a34a', q2: '#1d4ed8', q3: '#b45309', q4: '#c2410c', q5: '#dc2626',
        original:       'rgba(0,0,0,0.35)',
        leadIn:         '#cc0000',
        leadOut:        '#0044cc',
        leadWarn:       '#cc7700',
        kerfBand:       '#b38600',
        overcut:        '#0044cc',
        microjoint:     '#cc5500',
        travel:         '#666666',
        orderNumber:    '#ffffff',
        orderNumberBg:  'rgba(0,80,180,0.9)',
        measurement:    '#006688',
        measurementText:'#000000',
        snap:           '#cc8800',
        nullPoint:      '#008844',
        grip:           '#1155cc',
        gripHot:        '#cc2200',
        gripHover:      '#cc8800',
        gapOpen:        '#CC0033',
        gapHealable:    '#CC8800',
        gapHealed:      '#229955'
    }
};

// V3.62: Classic-Palette (WARICAM-nah): mittelgraue Zeichenflaeche (#666), kein Raster, Farben wie Dark
CANVAS_THEMES.classic = Object.assign({}, CANVAS_THEMES.dark, {
    background: '#666666',
    grid:       '#666666',   // = Hintergrund -> Raster unsichtbar
    gridMajor:  '#696969'
});

/** Pro-User-Namespacing für localStorage-Keys (V6.32 Login/User-Management). */
function _userKey(base) {
    return (typeof window !== 'undefined' && window.CeraCutCurrentUser) ? base + '::' + window.CeraCutCurrentUser : base;
}

class CanvasRenderer {
    static TOLERANCE = {
        SNAP: 8,       // Reduziert von 12 — weniger aggressives Snapping
        HIT_TEST: 12,  // Reduziert von 15
        MIN_DISTANCE: 0.001
    };

    static LINE_WIDTH = {
        BASE: 1.2,
        KERF: 2.0,
        LEAD: 2.5,
        OVERCUT: 2.5,
        HOVER: 2.0,
        MICROJOINT: 4.0,
        TRAVEL: 1.5
    };

    static MARKER_SIZE = {
        ARROW: 10,
        OVERCUT_ARROW: 4,
        PIERCE_POINT: 3,
        START_TRIANGLE: 6,
        SNAP: 5,
        MICROJOINT: 4,
        ORDER_NUMBER: 14
    };

    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.contours = [];
        this.app = null;

        this.scale = 1.0;
        this.showKerfBand = true;   // V3.60: Schnittfuge massstaeblich (Schalter btn-kerf-band)
        this.offsetX = 0;
        this.offsetY = 0;

        // DPR-Tracking (Fix: Cursor-Versatz auf High-DPI / Browser-Zoom)
        this._dpr = window.devicePixelRatio || 1;
        this._logicalWidth = 0;
        this._logicalHeight = 0;

        this.gridEnabled = true;
        this.currentMode = null;
        this.nullPoint = null;
        this.hoveredContour = null;

        // V3.10: Grip Editing State
        this._grips = [];           // Berechnete Grips für selektierte Konturen
        this._hoveredGrip = null;   // Grip unter dem Cursor
        this._draggedGrip = null;   // V3.37: Grip im aktiven Drag (Hot-State)
        this._gripDirty = false;    // Erst dirty wenn Selektion existiert
        this._hasSelection = false; // Schneller Check ohne .some() bei jedem Render

        // Starte mit gespeichertem Theme oder Dark als Default
        const savedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem(_userKey('ceracut-theme'))) || 'classic';
        this.colors = Object.assign({}, CANVAS_THEMES[savedTheme] || CANVAS_THEMES.classic);
        this._currentTheme = savedTheme;

        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';

        this.onMouseMove = null;
        this.onClick = null;
        this.onContourClick = null;
        this.onRightClick = null;
        // V2.4: Callback VOR internem mousedown (für Dimension-Grip-Drag)
        // Rückgabe true = Event konsumiert, internes Handling überspringen
        this.onBeforeMouseDown = null;
        this.onBeforeMouseMove = null;
        this.onBeforeMouseUp = null;

        this.initCanvasSize();
        this.initEventListeners();
    }

    initCanvasSize() {
        const resize = () => {
            const container = this.canvas.parentElement;
            const dpr = window.devicePixelRatio || 1;
            const w = container.clientWidth;
            const h = container.clientHeight;

            // Bitmap auf Device-Auflösung skalieren
            this.canvas.width = Math.round(w * dpr);
            this.canvas.height = Math.round(h * dpr);

            // CSS-Größe explizit auf logische Pixel setzen
            this.canvas.style.width = w + 'px';
            this.canvas.style.height = h + 'px';

            // DPR + logische Dimensionen speichern
            this._dpr = dpr;
            this._logicalWidth = w;
            this._logicalHeight = h;

            this.render();
        };
        resize();
        this._resizeHandler = resize;
        window.addEventListener('resize', this._resizeHandler);
    }

    initEventListeners() {
        // V3.16: Trackpad-Navigation — Wheel-Event unterscheidet Pan vs Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            // Pinch-to-Zoom (ctrlKey=true, Browser-Standard für Trackpad-Pinch)
            // ODER reines Mausrad (deltaX===0, nur vertikale Y-Achse)
            const isZoom = e.ctrlKey || e.deltaX === 0;

            if (isZoom) {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Pinch-to-Zoom hat feinere deltaY-Werte → geringere Intensität
                const zoomIntensity = e.ctrlKey ? 0.01 : 0.1;
                const delta = -e.deltaY;
                const factor = delta > 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);

                const worldBefore = this.screenToWorld(mouseX, mouseY);
                this.scale *= factor;
                this.scale = Math.max(0.01, Math.min(1000, this.scale));
                const worldAfter = this.screenToWorld(mouseX, mouseY);

                this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
                this.offsetY -= (worldAfter.y - worldBefore.y) * this.scale;
            } else {
                // Zwei-Finger-Scroll auf Trackpad (deltaX !== 0) → Pan
                this.offsetX -= e.deltaX;
                this.offsetY -= e.deltaY;
            }

            this.render();
        });

        let isPanning = false;
        let lastX, lastY;

        // V3.16: Space+Drag Pan (Photoshop/Figma-Stil)
        this._isSpaceDown = false;
        this._isSpacePanning = false;

        const spaceKeyDown = (e) => {
            if (e.key !== ' ' || e.repeat) return;
            // Nur Space-Pan wenn kein Tool aktiv und cmd-input leer
            const toolMgr = this.app?.drawingTools || this.app?.toolManager;
            const isToolActive = toolMgr?.isToolActive?.();
            const cmdInput = document.getElementById('cmd-input');
            const cmdHasText = cmdInput && cmdInput.value.trim().length > 0;
            if (isToolActive || cmdHasText) return;
            this._isSpaceDown = true;
            this._isSpacePanning = true;
            this.canvas.style.cursor = 'grab';
            e.preventDefault();
        };
        const spaceKeyUp = (e) => {
            if (e.key !== ' ') return;
            if (!this._isSpaceDown) return;
            this._isSpaceDown = false;
            // Cursor erst zurücksetzen wenn nicht mehr in Drag
            if (!isPanning) {
                this._isSpacePanning = false;
                this.canvas.style.cursor = 'default';
            }
        };
        document.addEventListener('keydown', spaceKeyDown);
        document.addEventListener('keyup', spaceKeyUp);

        // V3.44: Masseingabe beim Strecken/Verlaengern (AutoCAD Dynamic Input): Zahl tippen + Enter
        document.addEventListener('keydown', (e) => {
            // Esc bricht Klick-Modus / Drag ab (Rollback)
            if (e.key === 'Escape' && isDraggingGrip && dragContourRef && dragOldPoints) {
                dragContourRef.points = dragOldPoints.map(p => ({x: p.x, y: p.y}));
                if (dragOldFit) dragContourRef._fitPoints = dragOldFit.map(p => ({x: p.x, y: p.y}));
                if (typeof ModificationTool !== 'undefined') ModificationTool.invalidateCache?.(dragContourRef);
                isDraggingGrip = false; gripSticky = false; gripForceCommit = false;
                dragGrip = null; this._draggedGrip = null; dragOldPoints = null; dragOldFit = null; dragContourRef = null;
                this._gripLenBuf = ''; this._gripDirty = true;
                this.canvas.style.cursor = 'default';
                e.preventDefault(); e.stopPropagation();
                this.render();
                return;
            }
            if (!this._draggedGrip || (this._draggedGrip.type !== 'vertex' && this._draggedGrip.type !== 'rr_edge')) return;
            const buf0 = this._gripLenBuf || '';
            if (/^[0-9.,]$/.test(e.key)) {
                this._gripLenBuf = buf0 + (e.key === ',' ? '.' : e.key);
            } else if ((e.key === '-' || e.key === '=') && buf0 === '') {
                this._gripLenBuf = e.key;   // '-' = verkuerzen, '=' = absolute Laenge
            } else if (e.key === 'Backspace') {
                this._gripLenBuf = (this._gripLenBuf || '').slice(0, -1);
            } else if (e.key === 'Enter' && this._gripLenBuf) {
                // V3.44: Standard = Aenderung um x (Delta zur Ausgangslaenge); '-x' kuerzt; '=x' absolute Laenge
                const raw = this._gripLenBuf;
                const grip = this._draggedGrip;
                if (grip.type === 'rr_edge') {
                    // V3.47: Masseingabe Rechteck: Standard = Aenderung (Zugrichtung), '-x' kuerzt, '=x' absolut
                    const dm = this._rrDims(grip);
                    const num = parseFloat(raw.replace(/^[-=]/, ''));
                    const sg = raw[0] === '-' ? -1 : (dm.cur >= dm.orig ? 1 : -1);
                    const dim = raw[0] === '=' ? num : dm.orig + sg * num;
                    if (isFinite(dim) && dim > 0) this._applyGripDrag(grip, this._rrPosForDim(grip, dim), grip.contour);
                    this._gripLenBuf = '';
                    gripForceCommit = true;
                    e.preventDefault(); e.stopPropagation();
                    this.canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
                    return;
                }
                const ref = this._gripRef(grip);
                let len = NaN;
                if (ref) {
                    const num = parseFloat(raw.replace(/^[-=]/, ''));
                    len = raw[0] === '=' ? num : ref.length + this._gripDeltaSign(raw, ref, grip) * num;
                }
                if (ref && isFinite(len) && len > 0) {
                    let dir = ref.dir;
                    const cur = grip.contour.points[ref.idx];
                    if (!(ref.endpoint && this.app?.snapManager?.effectiveOrtho?.())) {
                        const dx = cur.x - ref.fixed.x, dy = cur.y - ref.fixed.y, dl = Math.hypot(dx, dy);
                        if (dl > 1e-9) dir = { x: dx / dl, y: dy / dl };
                    }
                    this._applyGripDrag(grip, { x: ref.fixed.x + dir.x * len, y: ref.fixed.y + dir.y * len }, grip.contour);
                }
                this._gripLenBuf = '';
                gripForceCommit = true;
                e.preventDefault(); e.stopPropagation();
                this.canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
                return;
            } else {
                return;
            }
            e.preventDefault(); e.stopPropagation();
            this.render();
        }, true);

        // Startpunkt-Drag State
        let isDraggingStartPoint = false;
        let startDragDown = null, startDragMoved = false; // V3.49: Drag-Schwelle (4 px)
        let dragContour = null;

        // V3.10: Grip-Drag State
        let isDraggingGrip = false;
        let dragGrip = null;
        let dragOldPoints = null;  // Snapshot für Undo
        let dragOldFit = null;     // Snapshot _fitPoints (Spline) für Undo
        let dragContourRef = null; // Referenz auf Kontur
        let gripDragJustEnded = false; // Guard gegen Click nach Drag
        // V3.45: AutoCAD-Klick-Modus: Klick auf Grip (ohne Ziehen) -> Strecken bis 2. Klick/Enter, Masseingabe moeglich
        let gripSticky = false, gripMoved = false, gripForceCommit = false, gripDownPos = null;

        // V3.5: Window-Selection State
        let isWindowSelecting = false;
        let windowSelectStartScreen = null;
        let windowSelectJustEnded = false;  // V3.11: Guard gegen Click nach Window-Selection

        this.canvas.addEventListener('mousedown', (e) => {
            // V3.45: 2. Klick im Klick-Modus setzt den Grip ab
            if (isDraggingGrip && gripSticky && e.button === 0) {
                gripForceCommit = true;
                this.canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
                return;
            }
            // V2.4: External pre-handler (Dimension-Grip-Drag etc.)
            if (this.onBeforeMouseDown) {
                const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
                if (this.onBeforeMouseDown(worldPos, e)) return;
            }
            // V3.10: Grip-Drag prüfen (VOR allem anderen, NUR wenn Grips existieren)
            if (e.button === 0 && !e.shiftKey && !isDraggingGrip && this._grips.length > 0 && (!this.app?.isGeometryEditAllowed || this.app.isGeometryEditAllowed())) {
                const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
                const toolMgr = this.app?.drawingTools || this.app?.toolManager;
                const isToolActive = toolMgr?.isToolActive?.();
                if (!isToolActive && !this.app?.measureMode) {
                    const hitGrip = this._hitTestGrip(worldPos);
                    if (hitGrip) {
                        isDraggingGrip = true;
                        dragGrip = hitGrip;
                        this._draggedGrip = hitGrip; // V3.37: Hot-State für Rendering
                        dragContourRef = hitGrip.contour;
                        dragOldPoints = dragContourRef.points.map(p => ({x: p.x, y: p.y}));
                        hitGrip._oldPts = dragOldPoints;   // V3.44: Referenz fuer Ortho-Verlaengerung / Laengeneingabe
                        this._gripLenBuf = '';
                        gripSticky = false; gripMoved = false; gripForceCommit = false;
                        gripDownPos = { x: e.offsetX, y: e.offsetY };
                        dragOldFit = Array.isArray(dragContourRef._fitPoints)
                            ? dragContourRef._fitPoints.map(p => ({x: p.x, y: p.y})) : null;
                        this.canvas.style.cursor = 'crosshair';
                        return;
                    }
                }
            }

            // V5.2: Startpunkt-Drag prüfen (VOR Panning) — auch im Reihenfolge-Modus
            if (e.button === 0 && !e.shiftKey && (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge')) {
                const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
                const hit = this._hitTestStartTriangle(worldPos);
                if (hit) {
                    isDraggingStartPoint = true;
                    startDragDown = { x: e.offsetX, y: e.offsetY };
                    startDragMoved = false;
                    dragContour = hit;
                    this.canvas.style.cursor = 'grabbing';
                    return;
                }
            }

            // V3.16: Space+Drag Pan
            if (e.button === 0 && this._isSpaceDown) {
                isPanning = true;
                lastX = e.offsetX;
                lastY = e.offsetY;
                this.canvas.style.cursor = 'grabbing';
                return;
            }

            // V3.5: Pan mit Mittel-Taste, Shift+Links oder PanTool (Hand)
            const _toolMgr = this.app?.drawingTools || this.app?.toolManager;
            const _isPanTool = _toolMgr?.activeTool?.isPanTool;
            if (e.button === 1 || (e.button === 0 && e.shiftKey) || (e.button === 0 && _isPanTool)) {
                isPanning = true;
                lastX = e.offsetX;
                lastY = e.offsetY;
                this.canvas.style.cursor = 'grabbing';
                return;
            }

            // V3.5: Links-Klick auf leere Fläche → Window-Selection starten
            if (e.button === 0 && !e.shiftKey) {
                const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
                const toolMgr = this.app?.drawingTools || this.app?.toolManager;
                const isToolActive = toolMgr?.isToolActive?.();
                // V3.36: edgeOnly — Klick im Inneren einer Kontur erlaubt Window-Selection
                const contourAtPoint = this.findContourAtPoint(worldPos.x, worldPos.y, { edgeOnly: true });
                // Nur Window-Selection wenn KEIN Tool aktiv und KEINE Kante getroffen
                if (!isToolActive && !contourAtPoint && !this.app?.measureMode) {
                    windowSelectStartScreen = { x: e.offsetX, y: e.offsetY };
                    // Noch nicht sofort starten — erst bei Drag-Threshold
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
            this._lastMouseScreen = { x: e.offsetX, y: e.offsetY }; // V3.37: für Vollbild-Crosshair
            // V3.62: Hover-Hinweis am Lead-Warnsymbol (Grund: gekuerzt/rotiert/Fallback)
            {
                const wa = (this._leadWarnAreas || []).find(a => Math.hypot(worldPos.x - a.x, worldPos.y - a.y) <= a.r * 1.3);
                const t = wa ? wa.text : '';
                if (this.canvas.title !== t) this.canvas.title = t;
            }

            // V2.4: External pre-handler (Dimension-Grip-Drag etc.)
            if (this.onBeforeMouseMove) {
                if (this.onBeforeMouseMove(worldPos, e)) return;
            }

            // V3.10: Grip-Drag aktiv
            if (isDraggingGrip && dragGrip && dragContourRef) {
                // Snap live berechnen (nicht stale currentSnap verwenden!)
                let snapPt = worldPos;
                if (this.app?.snapManager) {
                    const snap = this.app.snapManager.findSnap(worldPos.x, worldPos.y, this.scale);
                    if (snap) snapPt = snap.point;
                    // V3.45: waehrend Grip-Drag denselben AutoCAD-Marker zeigen (statt altem Ring)
                    this.app.snapManager.currentSnap = snap || null;
                    this.app.currentSnapPoint = null;
                }
                if (gripDownPos && Math.hypot(e.offsetX - gripDownPos.x, e.offsetY - gripDownPos.y) > 4) gripMoved = true;
                snapPt = this._constrainGripDrag(dragGrip, snapPt);
                this._applyGripDrag(dragGrip, snapPt, dragContourRef);
                // Grips NICHT neu berechnen während Drag (Performance!)
                this.render();
                return;
            }

            // Startpunkt-Drag aktiv
            if (isDraggingStartPoint && dragContour) {
                // V3.49: Startpunkt erst nach >4 px Mausbewegung verschieben — ein einfacher Klick
                // nahe einem Startpunkt darf die Anschnittposition nicht veraendern.
                if (!startDragMoved) {
                    if (startDragDown && Math.hypot(e.offsetX - startDragDown.x, e.offsetY - startDragDown.y) <= 4) return;
                    startDragMoved = true;
                }
                dragContour.setStartPoint(worldPos);
                this.render();
                return;
            }

            // V3.5: Window-Selection Drag
            if (windowSelectStartScreen && e.buttons === 1) {
                const dx = e.offsetX - windowSelectStartScreen.x;
                const dy = e.offsetY - windowSelectStartScreen.y;
                if (!isWindowSelecting && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                    isWindowSelecting = true;
                    const startWorld = this.screenToWorld(windowSelectStartScreen.x, windowSelectStartScreen.y);
                    const toolMgr = this.app?.drawingTools || this.app?.toolManager;
                    toolMgr?.startWindowSelection?.(startWorld);
                }
                if (isWindowSelecting) {
                    const toolMgr = this.app?.drawingTools || this.app?.toolManager;
                    if (toolMgr?.windowSelection) {
                        toolMgr.windowSelection.end = worldPos;
                    }
                    this.render();
                    // Normale Mousemove-Events trotzdem auslösen (Koordinaten-Anzeige)
                }
            }

            // BUG 24 Fix: Panning-Check vor Hover-Detection für Performance
            if (isPanning) {
                this.offsetX += e.offsetX - lastX;
                this.offsetY += e.offsetY - lastY;
                lastX = e.offsetX;
                lastY = e.offsetY;
                this.render();
                return;
            }

            const hovered = this.findContourAtPoint(worldPos.x, worldPos.y);
            let needsRender = false;
            if (hovered !== this.hoveredContour) {
                this.hoveredContour = hovered;
                needsRender = true;
            }

            // V3.10: Grip-Hover — nur prüfen wenn Selektion existiert
            if (!isDraggingGrip && !isWindowSelecting && this._grips.length > 0) {
                const toolMgr = this.app?.drawingTools || this.app?.toolManager;
                if (!toolMgr?.isToolActive?.() && !this.app?.measureMode) {
                    const prevHover = this._hoveredGrip;
                    this._hoveredGrip = this._hitTestGrip(worldPos);
                    if (this._hoveredGrip !== prevHover) {
                        this.canvas.style.cursor = this._hoveredGrip ? 'pointer' : 'default';
                        needsRender = true;
                    }
                }
            }
            if (needsRender) this.render();

            // V5.2: Cursor-Feedback im Anschuss-/Reihenfolge-Modus
            if ((this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge') && !isDraggingStartPoint) {
                const overStart = this._hitTestStartTriangle(worldPos);
                this.canvas.style.cursor = overStart ? 'grab' : 'default';
            }

            const snapPoint = this.findSnapPoint(worldPos.x, worldPos.y);

            if (this.onMouseMove) {
                this.onMouseMove(worldPos.x, worldPos.y, snapPoint, e.clientX, e.clientY);
            }

            if (this.app?.measureMode && this.app?.measureStart) {
                this.render();
            }

            // V3.37: Vollbild-Fadenkreuz folgt dem Cursor bei aktivem Zeichentool
            const _crosshairToolMgr = this.app?.drawingTools || this.app?.toolManager;
            if (!needsRender && _crosshairToolMgr?.isToolActive?.() && !_crosshairToolMgr?.activeTool?.isPanTool) {
                this.render();
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            // V2.4: External pre-handler (Dimension-Grip-Drag etc.)
            if (this.onBeforeMouseUp) {
                const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
                if (this.onBeforeMouseUp(worldPos, e)) return;
            }
            // V3.5: Window-Selection beenden
            if (isWindowSelecting) {
                const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
                const toolMgr = this.app?.drawingTools || this.app?.toolManager;
                toolMgr?.endWindowSelection?.(worldPos, e.shiftKey);
                isWindowSelecting = false;
                windowSelectStartScreen = null;
                windowSelectJustEnded = true;  // V3.11: Click-Event unterdrücken
                return;  // Kein Click-Event feuern
            }
            windowSelectStartScreen = null;

            // V3.45: Klick ohne Ziehen -> Klick-Modus (Grip bleibt "hot" bis 2. Klick / Enter / Esc)
            if (isDraggingGrip && !gripMoved && !gripSticky && !gripForceCommit) {
                gripSticky = true;
                this.render();
                return;
            }
            // V3.10: Grip-Drag beenden + Undo-Command registrieren
            if (isDraggingGrip && dragContourRef && dragOldPoints) {
                gripSticky = false; gripForceCommit = false;
                const contour = dragContourRef;
                const oldPts = dragOldPoints;
                const newPts = contour.points.map(p => ({x: p.x, y: p.y}));
                const oldFit = dragOldFit;
                const newFit = Array.isArray(contour._fitPoints)
                    ? contour._fitPoints.map(p => ({x: p.x, y: p.y})) : null;
                // Cache invalidieren
                if (typeof ModificationTool !== 'undefined') ModificationTool.invalidateCache(contour);
                contour._cachedKerfPolyline = null;
                contour._cacheKey = null;
                // V3.42: Snap-Point-Cache invalidieren (nach Grip-Editing veraltet)
                this.app?.snapManager?.invalidatePointsCache?.();
                // Undo-Command (bereits ausgeführt → push, nicht execute)
                const app = this.app;
                const rerender = () => {
                    if (typeof ModificationTool !== 'undefined') ModificationTool.invalidateCache(contour);
                    contour._cachedKerfPolyline = null;
                    contour._cacheKey = null;
                    app?.snapManager?.invalidatePointsCache?.();
                    app?.renderer?.setContours(app.contours);
                    app?.rebuildCutOrder?.();
                    app?.updateContourPanel?.();
                    app?.renderer?.render();
                };
                const cmd = new FunctionCommand(
                    'Grip Move ' + contour.name,
                    () => {
                        contour.points = newPts.map(p => ({x:p.x, y:p.y}));
                        if (newFit) contour._fitPoints = newFit.map(p => ({x:p.x, y:p.y}));
                        rerender();
                    },
                    () => {
                        contour.points = oldPts.map(p => ({x:p.x, y:p.y}));
                        if (oldFit) contour._fitPoints = oldFit.map(p => ({x:p.x, y:p.y}));
                        rerender();
                    }
                );
                // Bereits ausgeführt → über UndoManager registrieren (Gruppen, Trim, Redo-Reset)
                if (app?.undoManager?.pushExecuted) app.undoManager.pushExecuted(cmd);
                else if (app?.undoManager) {
                    app.undoManager.undoStack.push(cmd);
                    app.undoManager.redoStack.length = 0;
                    app.undoManager._notifyStateChange?.();
                }
                this._gripDirty = true;
                isDraggingGrip = false;
                dragGrip = null;
                this._draggedGrip = null;
                dragOldPoints = null;
                dragOldFit = null;
                dragContourRef = null;
                this.canvas.style.cursor = 'default';
                gripDragJustEnded = true;
                this.render();
                return;
            }

            if (isDraggingStartPoint) {
                isDraggingStartPoint = false;
                dragContour = null;
                startDragDown = null;
                this.canvas.style.cursor = 'default';
            }
            if (isPanning) {
                isPanning = false;
                // V3.16: Space-Pan Cursor-Handling
                if (this._isSpaceDown) {
                    this.canvas.style.cursor = 'grab';
                } else {
                    this._isSpacePanning = false;
                    const _toolMgr2 = this.app?.drawingTools || this.app?.toolManager;
                    const _isPanTool2 = _toolMgr2?.activeTool?.isPanTool;
                    this.canvas.style.cursor = _isPanTool2 ? 'grab' : (this.app?.measureMode ? 'crosshair' : 'default');
                }
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            isPanning = false;
            isDraggingStartPoint = false;
            isWindowSelecting = false;
            windowSelectStartScreen = null;
            dragContour = null;
            this.hoveredContour = null;
            this._hoveredGrip = null;
            // V3.11: Snap-Indikator löschen (verhindert "Endpoint bleibt hängen")
            if (this.app?.snapManager) { this.app.snapManager.currentSnap = null; this.app.snapManager.trackState = null; this.app.snapManager._resolveCache = null; }
            if (this.app) { this.app.currentSnapPoint = null; this.app.currentTrackPoint = null; }
            const snapEl = document.getElementById('snap-indicator');
            if (snapEl) snapEl.style.display = 'none';
            // V3.10: Grip-Drag abbrechen (ohne Commit) — Klick-Modus bleibt beim Verlassen des Canvas bestehen
            if (isDraggingGrip && !gripSticky && dragContourRef && dragOldPoints) {
                dragContourRef.points = dragOldPoints.map(p => ({x: p.x, y: p.y}));
                if (dragOldFit) dragContourRef._fitPoints = dragOldFit.map(p => ({x: p.x, y: p.y}));
                // BUG 21 Fix: Cache nach Rollback invalidieren
                if (typeof ModificationTool !== 'undefined') ModificationTool.invalidateCache?.(dragContourRef);
                this._gripDirty = true;
            }
            isDraggingGrip = false;
            dragGrip = null;
            this._draggedGrip = null;
            dragOldPoints = null;
            dragOldFit = null;
            dragContourRef = null;
            // Window-Selection abbrechen
            const toolMgr = this.app?.drawingTools || this.app?.toolManager;
            if (toolMgr?.windowSelection) {
                toolMgr.windowSelection = null;
            }
            // V2.3: Dynamic Input HUD verstecken
            if (typeof DynamicInput !== 'undefined') DynamicInput.hide();
            this.render();
        });

        this.canvas.addEventListener('click', (e) => {
            if (isPanning || isDraggingStartPoint || isDraggingGrip) return;
            // V3.10: Click nach Grip-Drag unterdrücken
            if (gripDragJustEnded) { gripDragJustEnded = false; return; }
            // V3.11: Click nach Window-Selection unterdrücken
            if (windowSelectJustEnded) { windowSelectJustEnded = false; return; }
            // V2.4: Click nach Dimension-Grip-Drag unterdrücken
            if (this._dimDragJustEnded) { this._dimDragJustEnded = false; return; }

            const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
            const clickedContour = this.findContourAtPoint(worldPos.x, worldPos.y);

            // V3.34: Shift-Status am ToolManager zwischenspeichern (für CAM-Tools wie BoundaryTrim)
            const toolMgrShift = this.app?.drawingTools || this.app?.toolManager;
            if (toolMgrShift) toolMgrShift._lastShift = e.shiftKey;

            // V3.11: Wenn Zeichentool aktiv → immer an onClick (Tool braucht Klick, z.B. TTR)
            const toolMgr2 = this.app?.drawingTools || this.app?.toolManager;
            const toolActive = toolMgr2?.isToolActive?.();
            if (toolActive && this.onClick) {
                this.onClick(worldPos);
            } else if (clickedContour && this.onContourClick) {
                this.onContourClick(clickedContour, worldPos, e.shiftKey);
            } else if (this.onClick) {
                this.onClick(worldPos);
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
            // V3.36: Rechtsklick nur Kanten-Hit → Kontur-Menü, Fläche = Canvas-Menü
            const contour = this.findContourAtPoint(worldPos.x, worldPos.y, { edgeOnly: true });
            if (this.onRightClick) {
                this.onRightClick(contour, worldPos, e.clientX, e.clientY);
            }
        });
    }

    setContours(contours) {
        this.contours = contours || [];
        // V3.10: Grips nur invalidieren wenn Selektion aktiv war
        if (this._hasSelection) this._gripDirty = true;
        this.render();
    }

    setNullPoint(x, y) {
        this.nullPoint = { x, y };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.offsetX) / this.scale,
            y: -(screenY - this.offsetY) / this.scale
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.scale + this.offsetX,
            y: -worldY * this.scale + this.offsetY
        };
    }

    getContourColor(contour) {
        if (contour === this.hoveredContour) return this.colors.hovered;
        if (contour.isSelected) return this.colors.selected;
        if (contour.isReference) return this.colors.reference;
        if (!contour.isClosed && contour.cuttingMode === 'slit') return this.colors.slit;
        if (!contour.isClosed) return this.colors.openPath;

        const quality = contour.quality || 2;
        const qColors = {
            1: this.colors.q1, 2: this.colors.q2, 3: this.colors.q3,
            4: this.colors.q4, 5: this.colors.q5
        };
        return qColors[quality] || this.colors.disc;
    }

    /**
     * V5.24: Kerf-Seiten-Overlay — Verschnittband (Kerf-Breite, Weltkoordinaten) zwischen
     * Originalkontur und Kerf-Bahn + Richtungspfeile mit L/R-Marker.
     */
    _drawKerfSideOverlay(ctx, contour, kerfPoints, baseWidth) {
        if (!kerfPoints || kerfPoints.length < 3 || !contour.points || contour.points.length < 3) return;
        const side = contour.resolveKerfSide ? contour.resolveKerfSide() : 'left';
        const col = this.getKerfColor(contour);
        // Band: Flaeche zwischen Original und Kerf-Bahn (even-odd) — V3.60: entfaellt bei echtem Fugenband
        if (!this.showKerfBand) {
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = col;
        ctx.beginPath();
        [contour.points, kerfPoints].forEach(poly => {
            poly.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.closePath();
        });
        ctx.fill('evenodd');
        ctx.restore();
        }
        // V3.66: Richtungspfeile der Kerf-Bahn entfallen (identisch mit den Richtungspfeilen der Kontur)
    }

    getKerfColor(contour) {
        if (contour === this.hoveredContour) return this.colors.kerfHovered;
        if (contour.isSelected) return this.colors.kerfSelected;
        return this.colors.kerf;
    }

    render() {
        // V3.68: Fliesenumrisse im Tab CAD nicht als Referenz sperren (bearbeitbar); Wiederherstellung beim Tab-Wechsel (index.html)
        if (typeof CeraCutPipeline !== 'undefined' && this.contours?.length && this.app?.isGeometryEditAllowed?.()) CeraCutPipeline.releaseTileRefs(this.contours);
        const ctx = this.ctx;
        const dpr = this._dpr || 1;
        this._leadWarnAreas = [];   // V3.62: Trefferflaechen der Warnsymbole (Hover-Hinweis)

        // DPR-Basistransform: Alle Zeichenoperationen in CSS-Pixel-Raum
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this._logicalWidth, this._logicalHeight);

        if (this.gridEnabled) this.drawGrid(ctx);

        ctx.save();
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, -this.scale);

        // V3.11: Image Underlays (VOR Konturen, unterster Layer)
        if (this.app?.imageUnderlayManager?.underlays?.length > 0) {
            this.app.imageUnderlayManager.drawAll(ctx, this.scale);
        }

        if (this.contours) {
            // V3.8: Layer-Sichtbarkeit filtern
            const lm = this.app?.layerManager;
            const visible = lm 
                ? this.contours.filter(c => lm.isVisible(c.layer))
                : this.contours;
            
            // V3.28: Hatch-Konturen zuerst (Hintergrund), dann Reference, dann Rest
            visible.filter(c => c.isHatchContour || c.cuttingMode === 'none').forEach(c => this.drawContour(ctx, c));
            visible.filter(c => c.isReference).forEach(c => this.drawContour(ctx, c));
            if (this.feasibilityMap) this._drawFeasibilityHalo(ctx, visible);
            visible.filter(c => !c.isReference && !c.isHatchContour && c.cuttingMode !== 'none').forEach(c => this.drawContour(ctx, c));
            if (this.simplifyPreview) this._drawSimplifyPreview(ctx);

            // V3.28: Hatch Live-Preview (halbtransparent während HatchTool-Hover)
            if (this._hatchPreview) {
                const hp = this._hatchPreview;
                if (hp.contour?.points?.length >= 3) {
                    try {
                        this._drawHatch(ctx, { hatch: hp.hatch, layer: hp.contour.layer }, hp.contour.points);
                    } catch (e) {
                        console.error('[CanvasRenderer V3.28] Hatch-Preview Fehler:', e);
                    }
                }
            }

            // V3.25: Intarsien-Konturen als halbtransparentes Overlay (Multi-Material)
            const intarsiaPreview = this.app?.settings?.intarsiaPreview;
            const isCamMode = (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge');
            if (this.app?.settings?.intarsiaMode && intarsiaPreview && isCamMode) {
                const materials = (typeof CeraCUT !== 'undefined' && CeraCUT.INTARSIA_MATERIALS) || [];
                const defaultPosColor = '#ff8c00';
                const defaultNegColor = '#2196f3';
                const sets = [];
                if (intarsiaPreview === 'pos' || intarsiaPreview === 'both')
                    sets.push({ contours: this.app.intarsiaPosContours, isPos: true });
                if (intarsiaPreview === 'neg' || intarsiaPreview === 'both')
                    sets.push({ contours: this.app.intarsiaNegContours, isPos: false });

                ctx.globalAlpha = 0.7;
                for (const set of sets) {
                    if (!set.contours) continue;
                    for (const c of set.contours) {
                        if (c.isReference) continue;
                        // V3.25: Farbe aus materialGroup (POS) oder blasse Variante (NEG)
                        const matColor = materials[c.materialGroup]?.color;
                        const color = set.isPos
                            ? (matColor || defaultPosColor)
                            : (matColor ? matColor + '88' : defaultNegColor);
                        this.drawContour(ctx, c, { overrideColor: color });
                    }
                }
                ctx.globalAlpha = 1;
            }

            if (this.currentMode === 'reihenfolge' && this.app?.cutOrder) {
                this.drawTravelPaths(ctx);
            }
        }

        if (this.app?.measureMode && this.app?.measurements) this.drawMeasurements(ctx);
        if (this.app?.measureMode && this.app?.measureStart) this.drawRubberBand(ctx);

        // V3.12: Dimensions (nach Konturen, vor Grips)
        if (this.app?.dimensionManager?.dimensions?.length > 0 || this.app?.dimensionManager?.isActive()) {
            this.app.dimensionManager.drawAll(ctx, this.scale);
        }

        // V3.12: MeasureManager Overlay (IGEMS 5-Modi)
        if (this.app?.measureManager && (this.app.measureManager.isActive() || this.app.measureManager.results.length > 0)) {
            this.app.measureManager.drawAll(ctx, this.scale);
        }

        // V3.10: Grips für selektierte Konturen zeichnen
        this._drawGrips(ctx);

        ctx.restore();

        if (this.currentMode === 'reihenfolge' && this.app?.cutOrder) {
            this.drawOrderNumbers();
        }

        if (this.nullPoint) this.drawNullPoint();
        if (this.app?.tiles?.length) this.drawTileOrigins();   // V6.95

        // V3.11: Image Underlay Grips (im Screen-Space)
        if (this.app?.imageUnderlayManager?.selectedUnderlay) {
            this.app.imageUnderlayManager.drawGrips(ctx, this);
        }
        // V3.4: Drawing-Overlay (Zeichentools)
        if (this.app?.drawingTools) {
            ctx.save();
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.scale, -this.scale);
            this.app.drawingTools.drawOverlay(ctx, this.scale);
            ctx.restore();
        }

        // V1.2: Snap-Indikator immer anzeigen (Running-OSNAP), Crosshair nur bei Tool
        const snapActive = this.app?.snapManager?.currentSnap;
        if (snapActive) {
            const snap = this.app.snapManager.currentSnap;
            const scr = this.worldToScreen(snap.point.x, snap.point.y);
            // Fadenkreuz nur bei aktivem Tool/Messmodus (Cursor wird hidden)
            const toolMgr = this.app?.drawingTools || this.app?.toolManager;
            if (toolMgr?.isToolActive?.() || toolMgr?.drawMode || this.app?.measureMode) {
                this._drawSnapCrosshair(ctx, scr.x, scr.y);
            }
            // Snap-Symbol + Label immer
            this.app.snapManager.drawSnapIndicator(ctx, scr.x, scr.y);
            // V3.44: Verweilen auf End-/Mittelpunkt -> Laengen der angrenzenden Konturen
            this._updateSnapDwell(snap);
            if (this._dwellShow) this._drawSnapDwellLengths(ctx, snap);
        } else if (this.app?.currentSnapPoint) {
            this.drawSnapIndicator(this.app.currentSnapPoint);
        }

        if (!snapActive) this._updateSnapDwell(null);
        this._drawGripDragHud(ctx);

        // V3.44: Tracking-Overlay (Object Snap Tracking / Polar) — Linien, erfasste Punkte, Label
        let trackedDrawn = false;
        if (this.app?.snapManager?.drawTracking) {
            this.app.snapManager.drawTracking(ctx, (x, y) => this.worldToScreen(x, y), this._logicalWidth, this._logicalHeight);
            // Getrackter Punkt (ohne Objektfang): Fadenkreuz dort statt am nativen Cursor
            const ts = this.app.snapManager.trackState;
            if (!snapActive && ts && ts.point && (ts.kind === 'otrack' || ts.kind === 'polar' || ts.kind === 'otrack-int')) {
                const sc = this.worldToScreen(ts.point.x, ts.point.y);
                this._drawSnapCrosshair(ctx, sc.x, sc.y);
                trackedDrawn = true;
            }
        }

        // V3.37: Vollbild-Fadenkreuz waehrend aktivem Zeichentool (nur wenn kein Snap-Fadenkreuz schon gezeichnet wurde)
        if (!snapActive && !trackedDrawn && this._lastMouseScreen) {
            const toolMgr = this.app?.drawingTools || this.app?.toolManager;
            if (toolMgr?.isToolActive?.() && !toolMgr?.activeTool?.isPanTool) {
                this._drawToolCrosshair(ctx, this._lastMouseScreen.x, this._lastMouseScreen.y);
            }
        }

        if (this.app?.measureMode) this.drawMeasurementLabels();
    }

    drawGrid(ctx) {
        const gridSize = 10;
        const majorEvery = 5;

        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(this._logicalWidth, this._logicalHeight);

        const startX = Math.floor(topLeft.x / gridSize) * gridSize;
        const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
        const startY = Math.floor(bottomRight.y / gridSize) * gridSize;
        const endY = Math.ceil(topLeft.y / gridSize) * gridSize;

        ctx.lineWidth = 1;

        for (let x = startX; x <= endX; x += gridSize) {
            const screenX = this.worldToScreen(x, 0).x;
            const isMajor = Math.abs(x % (gridSize * majorEvery)) < 0.001;
            ctx.strokeStyle = isMajor ? this.colors.gridMajor : this.colors.grid;
            ctx.globalAlpha = isMajor ? 0.5 : 0.2;
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, this._logicalHeight);
            ctx.stroke();
        }

        for (let y = startY; y <= endY; y += gridSize) {
            const screenY = this.worldToScreen(0, y).y;
            const isMajor = Math.abs(y % (gridSize * majorEvery)) < 0.001;
            ctx.strokeStyle = isMajor ? this.colors.gridMajor : this.colors.grid;
            ctx.globalAlpha = isMajor ? 0.5 : 0.2;
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(this._logicalWidth, screenY);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    /** V3.51: Vorschau der vereinfachten Konturen (Cyan, mit Stuetzpunkten) */
    _drawSimplifyPreview(ctx) {
        const lw = 2 / this.scale, r = 2.2 / this.scale;
        ctx.save();
        ctx.setLineDash([]);
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#00e5ff';
        ctx.fillStyle = '#00e5ff';
        for (const [c, v] of this.simplifyPreview) {
            const pts = v.pts;
            if (!pts || pts.length < 2) continue;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            if (c.isClosed) ctx.closePath();
            ctx.stroke();
            for (const p of pts) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    }

    /** V3.50: Machbarkeits-Halo — rot = schmaler als Strahl, orange = Nachbar naeher als Strahl */
    _drawFeasibilityHalo(ctx, list) {
        const lw = 7 / this.scale;
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        ctx.setLineDash([]);
        for (const c of list) {
            const f = this.feasibilityMap.get(c);
            if (!f || (!f.narrow && !f.close) || !c.points || c.points.length < 2) continue;
            ctx.strokeStyle = f.narrow ? 'rgba(255,50,50,0.55)' : 'rgba(255,170,0,0.6)';
            ctx.beginPath();
            ctx.moveTo(c.points[0].x, c.points[0].y);
            for (let i = 1; i < c.points.length; i++) ctx.lineTo(c.points[i].x, c.points[i].y);
            if (c.isClosed) ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
    }

    drawContour(ctx, contour, options) {
        const points = contour.points;
        if (!points || points.length < 2) return;

        const isHovered = contour === this.hoveredContour;
        const isSelected = contour.isSelected;

        let baseWidth = CanvasRenderer.LINE_WIDTH.BASE / this.scale;
        if (isHovered || isSelected) baseWidth = CanvasRenderer.LINE_WIDTH.HOVER / this.scale;

        // V3.28: Hatch-Konturen (cuttingMode='none') — nur Füllung, keine Schneidelinie
        if (contour.isHatchContour || contour.cuttingMode === 'none') {
            if (contour.hatch && points.length >= 3) {
                try {
                    this._drawHatch(ctx, contour, points);
                } catch (e) {
                    console.error('[CanvasRenderer V3.28] Hatch-Kontur Fehler:', e, contour.name);
                }
            }
            // V3.52: Nicht-Schnitt-Layer (Konstruktion/Beschriftung, FLI): dünne Linie in Layerfarbe, nie geschnitten
            if (!contour.hatch && typeof CeraCutPipeline !== 'undefined' && CeraCutPipeline.isNonCutContour(contour) && points.length >= 2) {
                const lc = this.app?.layerManager?.getLayer?.(contour.layer)?.color || '#ff7ad9';
                const pts = (contour.isClosed && points.length > 2) ? [...points, points[0]] : points;
                this.drawPath(ctx, pts, (isHovered || isSelected) ? (isSelected ? this.colors.selected : this.colors.hovered) : lc, baseWidth * 0.7);
                return;
            }
            // Dünne Boundary-Linie bei Hover/Selected
            if (isHovered || isSelected) {
                const color = isSelected ? this.colors.selected : this.colors.hovered;
                ctx.setLineDash([4 / this.scale, 2 / this.scale]);
                this.drawPath(ctx, points, color, baseWidth * 0.7);
                ctx.setLineDash([]);
            }
            return;
        }

        // V3.67: Fliesenumrisse (Layer Fliese/Fliesen) sind intern automatisch Referenz (Pipeline). Im Tab "CAD" nicht als
        // Referenz (gestrichelt grau) zeigen, sondern als normale duenne Linie in Layerfarbe — Referenz-Optik erst in den CAM-Tabs.
        if (contour.isClosed && !isHovered && !isSelected && typeof CeraCutPipeline !== 'undefined'
            && CeraCutPipeline.isTileOutline(contour) && this.app?.isGeometryEditAllowed?.()) {
            const lc = this.app?.layerManager?.getLayer?.(contour.layer)?.color || '#9ab';
            this.drawPath(ctx, points.length > 2 ? [...points, points[0]] : points, lc, baseWidth * 0.7);
            return;
        }

        if (!contour.isReference && contour.isClosed) {
            // CLOSED CONTOUR: Disc/Hole mit Kerf, Leads, Overcut, Microjoints
            let kerfPoints = null;
            try {
                if (typeof contour.getKerfOffsetPolyline === 'function') {
                    const kerf = contour.getKerfOffsetPolyline();
                    if (kerf?.points && kerf.points.length > 2 && !contour.compensationSkipped) {
                        kerfPoints = kerf.points;
                    }
                }
            } catch (e) { /* ignore */ }

            // V3.11: Kerf nur in CAM-Modi anzeigen (nicht im CAD-Zeichenmodus)
            if (kerfPoints && (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge')) {
                if (this.showKerfBand && contour.kerfWidth > 0) {
                    // V3.60: Schnittfuge massstaeblich (Breite = Kerf, zentriert auf der Werkzeugbahn)
                    this._strokeBand(ctx, kerfPoints, contour.kerfWidth);
                } else {
                    ctx.globalAlpha = 0.45;
                    ctx.setLineDash([6 / this.scale, 3 / this.scale]);
                    this.drawPath(ctx, kerfPoints, this.getKerfColor(contour), baseWidth * 0.9);
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;
                }
                this._drawKerfSideOverlay(ctx, contour, kerfPoints, baseWidth);
            }

            // V3.11: Layer-Farbe als Grundfarbe
            const layerName = contour.layer || '0';
            const layerDef = this.app?.layerManager?.getLayer(layerName);
            let displayColor = layerDef?.color || this.colors.disc;

            // V2.0: overrideColor für Intarsien-Overlay-Konturen
            if (options?.overrideColor) {
                displayColor = options.overrideColor;
            }

            const isCamMode = (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge');

            if (isHovered) displayColor = this.colors.hovered;
            if (isSelected) displayColor = this.colors.selected;
            this.drawPath(ctx, points, displayColor, baseWidth);

            // V6.0: Disc-Füllung — halbtransparente Fläche für Teile
            // V3.29: Nur in CAM-Modi (Anschuss/Reihenfolge), nicht im CAD-Zeichenmodus
            // V3.21 Fix: World-Koordinaten direkt (ctx hat bereits World-Transform)
            if (contour.cuttingMode === 'disc' && points.length >= 3 && isCamMode) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x, points[i].y);
                }
                ctx.closePath();

                // Holes innerhalb dieser Disc aussparen (even-odd)
                for (const other of (this.app?.contours || [])) {
                    if (other === contour || !other.isClosed || other.isReference) continue;
                    if (other.cuttingMode !== 'hole') continue;
                    if (other.points?.length < 3) continue;
                    const tp = (typeof Geometry !== 'undefined' && Geometry.interiorPoint)
                        ? Geometry.interiorPoint(other.points)
                        : other.points[0];
                    if (tp && typeof GeometryOps !== 'undefined' && GeometryOps.pointInPolygon?.(tp, points)) {
                        const hp = other.points;
                        ctx.moveTo(hp[hp.length - 1].x, hp[hp.length - 1].y);
                        for (let j = hp.length - 2; j >= 0; j--) {
                            ctx.lineTo(hp[j].x, hp[j].y);
                        }
                        ctx.closePath();
                    }
                }

                ctx.globalAlpha = 0.12;
                ctx.fillStyle = this.colors.disc;
                ctx.fill('evenodd');
                ctx.restore();
            }

            // V3.28: Alter Hatch-Property-Code entfernt — Hatch ist jetzt eigenständige CamContour

            // V3.30: Geheilte Gap-Marker bei geschlossenen Konturen (subtile grüne Dots)
            if (contour.healedGaps?.length > 0) {
                this._drawGapMarkers(ctx, contour);
            }

            const markerPoints = kerfPoints || points;

            // V3.10: Anschussfahnen nur in CAM-Modi (nicht im CAD-Zeichenmodus)
            // V3.61: Leads/Ueberschnitt liegen auf der Teilegeometrie (wie im G-Code, Controller versetzt per G41/G42);
            // das Fugenband zeigt die reale Strahlmitte.
            if (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge') {
                this.drawStartTriangle(ctx, points[0], this.colors.leadIn);
                this.drawSingleDirectionArrow(ctx, points, contour);
                this.drawLeadIn(ctx, contour, points);
                this.drawOvercut(ctx, contour, points);
                this.drawLeadOut(ctx, contour, points);

                if (contour.microjoints && contour.microjoints.length > 0) {
                    this.drawMicrojoints(ctx, contour, markerPoints);
                }
            }

        } else if (contour.isReference) {
            // REFERENCE: Gestrichelt
            ctx.setLineDash([8 / this.scale, 4 / this.scale]);
            this.drawPath(ctx, points, this.colors.reference, baseWidth * 1.5);
            ctx.setLineDash([]);

        } else if (!contour.isClosed) {
            // SLIT/OPEN: Offener Pfad
            // V3.11: Layer-Farbe als Grundfarbe
            const layerNameOpen = contour.layer || '0';
            const layerDefOpen = this.app?.layerManager?.getLayer(layerNameOpen);
            let displayColor = layerDefOpen?.color || this.colors.slit;
            if (isHovered) displayColor = this.colors.hovered;
            if (isSelected) displayColor = this.colors.selected;
            // Schnittfuge massstaeblich als Band (offene Kontur: Werkzeug laeuft mittig auf dem Pfad)
            if (this.showKerfBand && contour.kerfWidth > 0 && points.length > 1 &&
                (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge')) {
                // G41/G42: Fuge liegt neben der Kontur (Werkzeugbahn um kerf/2 versetzt), sonst mittig
                const comp = contour.kerfComp || contour.kerfSide;
                const off = (comp === 'left' || comp === 'right') ? contour.kerfWidth / 2 * (comp === 'left' ? 1 : -1) : 0;
                this._strokeBand(ctx, off ? this._offsetOpenPolyline(points, off) : points, contour.kerfWidth);
            }
            this.drawPath(ctx, points, displayColor, baseWidth);

            // V3.30: Gap-Marker bei offenen Konturen
            this._drawGapMarkers(ctx, contour);

            // V3.10: Anschussfahnen nur in CAM-Modi
            if (this.currentMode === 'anschuss' || this.currentMode === 'reihenfolge') {
                this.drawStartTriangle(ctx, points[0], this.colors.leadIn);
                this.drawSingleDirectionArrow(ctx, points, contour);
                this.drawLeadIn(ctx, contour, points);
                this.drawOvercut(ctx, contour, points);
            }
        }
    }

    // ═══ V3.30: GAP MARKER RENDERING ═══

    _drawGapMarkers(ctx, contour) {
        const allGaps = [
            ...(contour.gaps || []).map(g => ({ ...g, color: g.type === 'healable' ? this.colors.gapHealable : this.colors.gapOpen })),
            ...(contour.healedGaps || []).map(g => ({ ...g, type: 'healed', color: this.colors.gapHealed }))
        ];
        if (allGaps.length === 0) return;

        const dotRadius = 4 / this.scale;  // Screen-space konstant
        const dashLen = 6 / this.scale;
        const gapLen = 4 / this.scale;

        ctx.save();
        for (const gap of allGaps) {
            const color = gap.color;

            // Gestrichelte Linie zwischen den Endpunkten
            ctx.beginPath();
            ctx.setLineDash([dashLen, gapLen]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 / this.scale;
            ctx.moveTo(gap.x1, gap.y1);
            ctx.lineTo(gap.x2, gap.y2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Gefüllte Kreise an beiden Endpunkten
            for (const pt of [{x: gap.x1, y: gap.y1}, {x: gap.x2, y: gap.y2}]) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // ═══ V3.28: HATCH RENDERING (eigenständige CamContour + Live-Preview) ═══

    _drawHatch(ctx, contour, points) {
        const h = contour.hatch;
        if (!h) return;

        const layerName = contour.layer || '0';
        const layerDef = this.app?.layerManager?.getLayer(layerName);
        const fillColor = h.color || layerDef?.color || this.colors.disc;

        ctx.save();

        // Pfad bauen: Kontur + Holes (even-odd)
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();

        // Holes innerhalb dieser Kontur aussparen
        for (const other of (this.app?.contours || [])) {
            if (other === contour || !other.isClosed || other.isReference) continue;
            if (other.cuttingMode !== 'hole') continue;
            if (other.points?.length < 3) continue;
            const tp = typeof Geometry !== 'undefined' ? Geometry.interiorPoint(other.points) : other.points[0];
            if (typeof GeometryOps !== 'undefined' && GeometryOps.pointInPolygon?.(tp, points)) {
                const hp = other.points;
                ctx.moveTo(hp[hp.length - 1].x, hp[hp.length - 1].y);
                for (let j = hp.length - 2; j >= 0; j--) {
                    ctx.lineTo(hp[j].x, hp[j].y);
                }
                ctx.closePath();
            }
        }

        ctx.globalAlpha = h.opacity ?? 0.25;

        if (h.pattern === 'solid') {
            // V3.26 Fix: Direkt ctx.fill() statt ctx.clip()+fillRect()
            // Identisch zur funktionierenden Disc-Fill-Logik (Zeile 860)
            ctx.fillStyle = fillColor;
            ctx.fill('evenodd');
        } else {
            // Linien/Kreuz/Punkte: Clip-Pfad nötig für Einzelstriche
            ctx.clip('evenodd');

            if (h.pattern === 'lines' || h.pattern === 'cross') {
                this._drawHatchLines(ctx, points, fillColor, h.angle ?? 45, h.spacing ?? 3);
                if (h.pattern === 'cross') {
                    this._drawHatchLines(ctx, points, fillColor, (h.angle ?? 45) + 90, h.spacing ?? 3);
                }
            } else if (h.pattern === 'dots') {
                this._drawHatchDots(ctx, points, fillColor, h.spacing ?? 3);
            }
        }

        ctx.restore();
    }

    _hatchBB(points, key) {
        // Cache-freie BB-Berechnung
        let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
        for (const p of points) {
            if (p.x < xMin) xMin = p.x;
            if (p.y < yMin) yMin = p.y;
            if (p.x > xMax) xMax = p.x;
            if (p.y > yMax) yMax = p.y;
        }
        if (key === 'xMin') return xMin;
        if (key === 'yMin') return yMin;
        if (key === 'w') return xMax - xMin;
        if (key === 'h') return yMax - yMin;
        return { xMin, yMin, xMax, yMax };
    }

    _drawHatchLines(ctx, points, color, angleDeg, spacingMm) {
        const bb = this._hatchBB(points, 'all');
        const angle = (angleDeg ?? 45) * Math.PI / 180;
        const spacing = spacingMm || 3;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Diagonale des BB = maximaler Bereich
        const diag = Math.hypot(bb.xMax - bb.xMin, bb.yMax - bb.yMin);
        const cx = (bb.xMin + bb.xMax) / 2;
        const cy = (bb.yMin + bb.yMax) / 2;
        const nLines = Math.ceil(diag / spacing) + 1;

        ctx.strokeStyle = color;
        ctx.lineWidth = 0.5 / this.scale;
        ctx.beginPath();

        for (let i = -nLines; i <= nLines; i++) {
            const offset = i * spacing;
            // Linie durch (cx + offset * perpendicular) in Richtung angle
            const px = cx + offset * (-sin);
            const py = cy + offset * cos;
            ctx.moveTo(px - diag * cos, py - diag * sin);
            ctx.lineTo(px + diag * cos, py + diag * sin);
        }

        ctx.stroke();
    }

    _drawHatchDots(ctx, points, color, spacingMm) {
        const bb = this._hatchBB(points, 'all');
        const spacing = spacingMm || 3;
        const dotRadius = Math.max(0.3 / this.scale, 0.15);

        ctx.fillStyle = color;

        const countX = Math.ceil((bb.xMax - bb.xMin) / spacing);
        const countY = Math.ceil((bb.yMax - bb.yMin) / spacing);
        for (let ix = 0; ix <= countX; ix++) {
            const x = bb.xMin + ix * spacing;
            for (let iy = 0; iy <= countY; iy++) {
                const y = bb.yMin + iy * spacing;
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    drawPath(ctx, points, color, lineWidth) {
        if (!points || points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    drawStartTriangle(ctx, point, color) {
        if (!point) return;
        const size = CanvasRenderer.MARKER_SIZE.START_TRIANGLE / this.scale;

        ctx.beginPath();
        ctx.moveTo(point.x, point.y + size);
        ctx.lineTo(point.x - size * 0.7, point.y - size * 0.5);
        ctx.lineTo(point.x + size * 0.7, point.y - size * 0.5);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1 / this.scale;
        ctx.stroke();
    }

    /**
     * V3.43: Schnittrichtung nach CAD/CAM-Standard (Mastercam/SigmaNEST/Lantek):
     * mehrere gefuellte Pfeilspitzen in gleichem BILDSCHIRM-Abstand entlang der Kontur
     * (konstante Pixelgroesse, zoom-unabhaengig), Tangente ueber ein Fenster gemittelt
     * (stabil auf Kreisen/Splines), dunkler Halo + heller Kern fuer Kontrast auf jedem Hintergrund.
     */
    drawSingleDirectionArrow(ctx, points, contour) {
        if (!points || points.length < 2) return;

        // V3.49: Richtungspfeile — Modus 'auto' (Standard) / 'always' / 'never'.
        // Auto: bei vielen Konturen (> 25) nur fuer ausgewaehlte/gehoverte Kontur, sonst unlesbar.
        const arrowMode = this.directionArrowMode || 'auto';
        if (arrowMode === 'never') return;
        if (arrowMode === 'auto' && (this.contours?.length || 0) > 25 &&
            !(contour && (contour.isSelected || contour === this.hoveredContour))) return;

        const cum = [0];
        for (let i = 1; i < points.length; i++) {
            cum.push(cum[i-1] + Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y));
        }
        const total = cum[cum.length - 1];
        if (total <= 0) return;

        const px = 1 / this.scale;                       // 1 Bildschirm-Pixel in mm
        const screenLen = total / px;
        if (screenLen < 24) return;                      // zu klein fuer einen Pfeil

        const pointAt = (d) => {
            d = Math.max(0, Math.min(total, d));
            let lo = 1;
            while (lo < cum.length - 1 && cum[lo] < d) lo++;
            const segLen = cum[lo] - cum[lo-1] || 1;
            const t = (d - cum[lo-1]) / segLen;
            return { x: points[lo-1].x + (points[lo].x - points[lo-1].x) * t,
                     y: points[lo-1].y + (points[lo].y - points[lo-1].y) * t };
        };

        const n = Math.max(1, Math.min(4, Math.round(screenLen / 60)));   // V3.66: max. 4 je Kontur
        const win = 7 * px;
        for (let k = 0; k < n; k++) {
            const d = total * (k + 0.5) / n;
            const a = pointAt(d - win), b = pointAt(d + win), c = pointAt(d);
            if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-9) continue;
            this._drawDirectionChevron(ctx, c.x, c.y, Math.atan2(b.y - a.y, b.x - a.x));
        }
    }

    _drawDirectionChevron(ctx, x, y, angle) {
        const px = 1 / this.scale;
        const L = 9 * px, W = 4 * px;                   // Laenge / halbe Breite in Pixeln
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(L * 0.6, 0);                          // Spitze
        ctx.lineTo(-L * 0.4, W);
        ctx.lineTo(-L * 0.15, 0);                        // Einzug (Pfeil-Heck)
        ctx.lineTo(-L * 0.4, -W);
        ctx.closePath();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';            // Halo
        ctx.lineWidth = 2 * px;
        ctx.stroke();
        ctx.fillStyle = '#ff3b30';                       // V3.66: klein, rot
        ctx.fill();
        ctx.restore();
    }

    drawSmallArrow(ctx, x, y, angle, color) {
        const size = CanvasRenderer.MARKER_SIZE.ARROW / this.scale;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, size * 0.6);
        ctx.lineTo(-size * 0.3, 0);
        ctx.lineTo(-size * 0.5, -size * 0.6);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.8 / this.scale;
        ctx.stroke();

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════
    // VERFAHRWEGE (Travel Paths) - Step 5
    // ════════════════════════════════════════════════════════════════

    drawTravelPaths(ctx) {
        const tileOf = this.app.getTileOfMap ? this.app.getTileOfMap() : new Map();   // zuerst: kann Fliesen/cutOrder aktualisieren
        const cutOrder = this.app.cutOrder;
        if (!cutOrder || cutOrder.length < 1) return;

        const origin = this.app.settings?.origin || { x: 0, y: 0 };

        ctx.setLineDash([4 / this.scale, 4 / this.scale]);
        ctx.strokeStyle = this.colors.travel;
        ctx.lineWidth = CanvasRenderer.LINE_WIDTH.TRAVEL / this.scale;

        let lastPos = origin;
        const tiles = this.app.tiles || [];
        let curTile = null;
        const backToOrigin = (pos, o) => {   // gedimmter Rückweg zum Nullpunkt
            ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.globalAlpha = 1;
        };

        for (let i = 0; i < cutOrder.length; i++) {
            const contour = this.contours[cutOrder[i]];
            if (!contour || !contour.points || contour.points.length < 1) continue;

            // V6.97: Fliesenwechsel → Weg endet am Nullpunkt der alten, beginnt am Nullpunkt der neuen Fliese
            const tIdx = tileOf.get(cutOrder[i]);
            if (tIdx !== curTile) {
                if (curTile != null && tiles[curTile]?.origin) backToOrigin(lastPos, tiles[curTile].origin);
                curTile = tIdx ?? null;
                lastPos = (curTile != null && tiles[curTile]?.origin) ? tiles[curTile].origin : origin;
            }

            const startPoint = contour.points[0];

            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
            ctx.lineTo(startPoint.x, startPoint.y);
            ctx.stroke();

            const midX = (lastPos.x + startPoint.x) / 2;
            const midY = (lastPos.y + startPoint.y) / 2;
            const angle = Math.atan2(startPoint.y - lastPos.y, startPoint.x - lastPos.x);

            ctx.setLineDash([]);
            this.drawTravelArrow(ctx, midX, midY, angle);
            ctx.setLineDash([4 / this.scale, 4 / this.scale]);

            const endPoint = contour.points[contour.points.length - 1];
            lastPos = endPoint;
        }

        backToOrigin(lastPos, (curTile != null && tiles[curTile]?.origin) ? tiles[curTile].origin : origin);

        ctx.setLineDash([]);
    }

    drawTravelArrow(ctx, x, y, angle) {
        const size = 4 / this.scale;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.closePath();

        ctx.fillStyle = this.colors.travel;
        ctx.fill();

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════
    // REIHENFOLGE-NUMMERN (Order Numbers) - Step 5
    // ════════════════════════════════════════════════════════════════

    drawOrderNumbers() {
        const tileOf = this.app.getTileOfMap ? this.app.getTileOfMap() : new Map();   // zuerst: kann cutOrder aktualisieren
        const cutOrder = this.app.cutOrder;
        if (!cutOrder || cutOrder.length < 1) return;

        const ctx = this.ctx;
        const seqPerTile = new Map();

        for (let i = 0; i < cutOrder.length; i++) {
            const contour = this.contours[cutOrder[i]];
            if (!contour || !contour.points || contour.points.length < 1) continue;
            const tIdx = tileOf.get(cutOrder[i]);
            let seq = i + 1;
            if (tIdx != null) { seq = (seqPerTile.get(tIdx) || 0) + 1; seqPerTile.set(tIdx, seq); }

            let cx = 0, cy = 0;
            for (const p of contour.points) {
                cx += p.x;
                cy += p.y;
            }
            cx /= contour.points.length;
            cy /= contour.points.length;

            const screen = this.worldToScreen(cx, cy);
            let num = seq;
            const size = CanvasRenderer.MARKER_SIZE.ORDER_NUMBER;
            // V3.58: Anklick-Modus (Schnittreihenfolge): Klick-Nummer grün, übrige gedimmt; Auswahl gelb umrandet
            const seqMode = !!this.app.cutSeqMode, sp = seqMode ? this.app.cutSeq.indexOf(cutOrder[i]) : -1;
            if (sp >= 0) num = sp + 1;
            ctx.save();
            if (seqMode && sp < 0) ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, size, 0, Math.PI * 2);
            ctx.fillStyle = sp >= 0 ? '#16a34a' : this.colors.orderNumberBg;
            ctx.fill();
            ctx.strokeStyle = contour.isSelected ? '#ffd54f' : '#fff';
            ctx.lineWidth = contour.isSelected ? 3 : 2;
            ctx.stroke();

            ctx.font = `bold ${size}px sans-serif`;
            ctx.fillStyle = this.colors.orderNumber;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num.toString(), screen.x, screen.y);
            ctx.restore();
        }
    }

    // ════════════════════════════════════════════════════════════════
    // LEAD-IN (IGEMS-Stil: Einfache Linie Pierce → Entry)
    // ════════════════════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════════
    // LEADS / ÜBERSCHNITT (V3.60, Waricam-Stil): echte Segmente, Anschnitt rot,
    // Ausschnitt/Überschnitt blau, Pfeil in Schneidrichtung, Schnittfugenband.
    // Bögen werden IMMER als ctx.arc() gezeichnet (kein Polylinien-Fallback).
    // ════════════════════════════════════════════════════════════════

    /** Pfad aus Segmenten (Linie/Bogen) in den aktuellen ctx-Pfad legen. */
    _traceSegments(ctx, segs) {
        ctx.beginPath();
        ctx.moveTo(segs[0].p0.x, segs[0].p0.y);
        for (const sg of segs) {
            if (sg.kind === 'arc') {
                const a0 = Math.atan2(sg.p0.y - sg.center.y, sg.p0.x - sg.center.x);
                const a1 = sg.ccw ? a0 + sg.span : a0 - sg.span;
                // ctx.arc(anticlockwise=false) laeuft bei STEIGENDEM Winkel = unser ccw=true
                ctx.arc(sg.center.x, sg.center.y, sg.radius, a0, a1, !sg.ccw);
            } else {
                ctx.lineTo(sg.p1.x, sg.p1.y);
            }
        }
    }

    /** Offene Polylinie seitlich versetzen (d > 0 = links der Laufrichtung, Weltkoordinaten). */
    _offsetOpenPolyline(pts, d) {
        const n = pts.length, out = [];
        const nrm = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; };
        for (let i = 0; i < n; i++) {
            const n1 = i > 0 ? nrm(pts[i - 1], pts[i]) : null;
            const n2 = i < n - 1 ? nrm(pts[i], pts[i + 1]) : null;
            let nx, ny, k = 1;
            if (n1 && n2) {
                nx = n1.x + n2.x; ny = n1.y + n2.y;
                const l = Math.hypot(nx, ny);
                if (l < 1e-9) { nx = n1.x; ny = n1.y; } else {
                    nx /= l; ny /= l;
                    k = Math.min(1 / Math.max(nx * n1.x + ny * n1.y, 0.25), 4);
                }
            } else { const m = n1 || n2 || { x: 0, y: 0 }; nx = m.x; ny = m.y; }
            out.push({ x: pts[i].x + nx * d * k, y: pts[i].y + ny * d * k });
        }
        return out;
    }

    /** Schnittfugenband (Breite = Kerf in mm, massstaeblich) entlang Punktliste ODER Segmenten. */
    _strokeBand(ctx, pathOrSegs, kerfWidth) {
        if (!(kerfWidth > 0) || !pathOrSegs || !pathOrSegs.length) return;
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.setLineDash([]);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'butt';
        ctx.strokeStyle = this.colors.kerfBand;
        ctx.lineWidth = kerfWidth;
        if (pathOrSegs[0].kind) {
            this._traceSegments(ctx, pathOrSegs);
        } else {
            ctx.beginPath();
            ctx.moveTo(pathOrSegs[0].x, pathOrSegs[0].y);
            for (let i = 1; i < pathOrSegs.length; i++) ctx.lineTo(pathOrSegs[i].x, pathOrSegs[i].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    /** Hinweistext fuer automatisch veraenderte Leads (null = unveraendert). */
    _leadWarning(lp) {
        if (!lp) return null;
        if (lp.isFallbackCenterPierce || lp.isFallbackCenterExit) return 'Center-Pierce (Fallback)';
        if (lp.shortened) return 'gekuerzt';
        if (lp.isAlternative) return 'Alternativ-Lead';
        if (lp.isRotated) return 'Startpunkt rotiert';
        return null;
    }

    /** Kleines Warnsymbol (!) neben dem Anschuss-/End-Punkt. */
    _drawLeadWarning(ctx, point, lp) {
        const warnText = point ? this._leadWarning(lp) : null;
        if (!warnText) return;
        const r = 5 / this.scale;
        (this._leadWarnAreas || (this._leadWarnAreas = [])).push({ x: point.x + r * 1.6, y: point.y + r * 1.6, r, text: 'Lead: ' + warnText });
        ctx.save();
        ctx.translate(point.x + r * 1.6, point.y + r * 1.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.leadWarn;
        ctx.fill();
        ctx.scale(1, -1);   // Y-Flip der Welt fuer Text zuruecknehmen
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(8, 8 / this.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, 0);
        ctx.restore();
    }

    /** Pfeil am Pfadende in Schneidrichtung. */
    _drawSegmentArrow(ctx, seg, color) {
        const t = LeadGeometry.tangentAt(seg, 'end');
        this.drawSmallArrow(ctx, seg.p1.x, seg.p1.y, Math.atan2(t.y, t.x), color);
    }

    drawLeadIn(ctx, contour, kerfPoints) {
        let leadPath = null;
        try { leadPath = contour.getLeadInPath?.(); } catch (e) { /* ignore */ }
        if (!leadPath) return;

        // "On geometry" -> kein sichtbarer Lead, nur Anschussmarke
        if (leadPath.type === 'on_geometry') {
            if (leadPath.piercingPoint) this.drawPierceSymbol(ctx, leadPath.piercingPoint, this.colors.leadIn, 'on_geometry');
            return;
        }

        const segs = leadPath.segments;
        if (!segs || !segs.length) return;
        const color = this.colors.leadIn;
        const lw = CanvasRenderer.LINE_WIDTH.LEAD / this.scale;

        if (this.showKerfBand) {
            const tool = contour.getLeadInToolSegments?.();
            this._strokeBand(ctx, tool && tool.length ? tool : segs, contour.kerfWidth);
        }

        ctx.save();
        ctx.setLineDash([]);
        this._traceSegments(ctx, segs);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();

        const pierce = segs[0].p0;
        this.drawPierceSymbol(ctx, pierce, color, 'pierce');
        this._drawLeadWarning(ctx, pierce, leadPath);
        this._drawSegmentArrow(ctx, segs[segs.length - 1], color);
    }

    drawLeadOut(ctx, contour, kerfPoints) {
        let leadPath = null;
        try { leadPath = contour.getLeadOutPath?.(); } catch (e) { /* ignore */ }
        const segs = leadPath?.segments;
        if (!segs || !segs.length) return;
        const color = this.colors.leadOut;
        const lw = CanvasRenderer.LINE_WIDTH.LEAD / this.scale;

        if (this.showKerfBand) {
            const tool = contour.getLeadOutToolSegments?.();
            this._strokeBand(ctx, tool && tool.length ? tool : segs, contour.kerfWidth);
        }

        ctx.save();
        ctx.setLineDash([]);
        this._traceSegments(ctx, segs);
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();

        const end = segs[segs.length - 1].p1;
        this.drawPierceSymbol(ctx, end, color, 'exit');
        this._drawLeadWarning(ctx, end, leadPath);
        this._drawSegmentArrow(ctx, segs[segs.length - 1], color);
    }

    /** Anschuss-/Endmarke: kleiner einheitlicher Punkt (on_geometry: zusaetzlich Kreuz). */
    drawPierceSymbol(ctx, point, color, type = 'pierce') {
        if (!point) return;
        const size = CanvasRenderer.MARKER_SIZE.PIERCE_POINT / this.scale;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5 / this.scale;
        ctx.stroke();
        if (type === 'on_geometry') {
            const c = size * 1.6;
            ctx.beginPath();
            ctx.moveTo(point.x - c, point.y); ctx.lineTo(point.x + c, point.y);
            ctx.moveTo(point.x, point.y - c); ctx.lineTo(point.x, point.y + c);
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.8 / this.scale;
            ctx.stroke();
        }
    }

    // ════════════════════════════════════════════════════════════════
    // OVERCUT (entlang Kontur / Slit: rückwärts) — massstaeblich, blau, mit Pfeil
    // ════════════════════════════════════════════════════════════════

    drawOvercut(ctx, contour, kerfPoints) {
        let overcutPath = null;
        try { overcutPath = contour.getOvercutPath?.(); } catch (e) { /* ignore */ }
        if (!overcutPath) return;

        if (overcutPath.type === 'negative') {
            // Negativer Overcut: X-Symbol am Startpunkt (Lücke)
            const p = kerfPoints?.[0];
            if (p) {
                const s = CanvasRenderer.MARKER_SIZE.PIERCE_POINT / this.scale;
                ctx.beginPath();
                ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s);
                ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s);
                ctx.strokeStyle = this.colors.leadIn;
                ctx.lineWidth = 1.5 / this.scale;
                ctx.stroke();
            }
            return;
        }

        const pts = overcutPath.points;
        if (!pts || pts.length < 2) return;

        if (this.showKerfBand) this._strokeBand(ctx, overcutPath.toolPoints || pts, contour.kerfWidth);

        ctx.save();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = this.colors.overcut;
        ctx.lineWidth = CanvasRenderer.LINE_WIDTH.OVERCUT / this.scale;
        ctx.stroke();
        ctx.restore();

        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        this.drawOvercutArrow(ctx, last.x, last.y, Math.atan2(last.y - prev.y, last.x - prev.x));
    }

    drawOvercutArrow(ctx, x, y, angle) {
        const size = CanvasRenderer.MARKER_SIZE.OVERCUT_ARROW / this.scale;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.5, size * 0.5);
        ctx.lineTo(-size * 0.5, -size * 0.5);
        ctx.closePath();

        ctx.fillStyle = this.colors.overcut;
        ctx.fill();

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════
    // MICRO-JOINTS
    // ════════════════════════════════════════════════════════════════

    drawMicrojoints(ctx, contour, kerfPoints) {
        if (!contour.microjoints || contour.microjoints.length === 0) return;
        if (!kerfPoints || kerfPoints.length < 2) return;

        const distances = [0];
        for (let i = 1; i < kerfPoints.length; i++) {
            const d = Math.hypot(kerfPoints[i].x - kerfPoints[i-1].x, kerfPoints[i].y - kerfPoints[i-1].y);
            distances.push(distances[i-1] + d);
        }
        const totalLength = distances[distances.length - 1];

        for (const mj of contour.microjoints) {
            const position = mj.position % totalLength;
            const width = mj.width || 0.5;

            const pointData = this.getPointAtDistance(kerfPoints, distances, position);
            if (!pointData) continue;

            const { x, y } = pointData;
            const size = CanvasRenderer.MARKER_SIZE.MICROJOINT / this.scale;

            ctx.save();
            ctx.translate(x, y);

            ctx.beginPath();
            ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = this.colors.microjoint;
            ctx.globalAlpha = 0.3;
            ctx.fill();
            ctx.globalAlpha = 1;

            ctx.beginPath();
            ctx.moveTo(-size, -size);
            ctx.lineTo(size, size);
            ctx.moveTo(size, -size);
            ctx.lineTo(-size, size);
            ctx.strokeStyle = this.colors.microjoint;
            ctx.lineWidth = 2 / this.scale;
            ctx.stroke();

            ctx.restore();
        }
    }

    getPointAtDistance(points, distances, targetDist) {
        for (let i = 1; i < points.length; i++) {
            if (distances[i] >= targetDist) {
                const t = (targetDist - distances[i-1]) / (distances[i] - distances[i-1] || 1);
                return {
                    x: points[i-1].x + t * (points[i].x - points[i-1].x),
                    y: points[i-1].y + t * (points[i].y - points[i-1].y),
                    angle: Math.atan2(points[i].y - points[i-1].y, points[i].x - points[i-1].x)
                };
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════
    // MESSUNGEN
    // ════════════════════════════════════════════════════════════════

    drawMeasurements(ctx) {
        for (const m of this.app.measurements) {
            ctx.beginPath();
            ctx.moveTo(m.p1.x, m.p1.y);
            ctx.lineTo(m.p2.x, m.p2.y);
            ctx.strokeStyle = this.colors.measurement;
            ctx.lineWidth = 2 / this.scale;
            ctx.stroke();

            const markerSize = CanvasRenderer.MARKER_SIZE.SNAP / this.scale;
            ctx.fillStyle = this.colors.measurement;
            ctx.beginPath();
            ctx.arc(m.p1.x, m.p1.y, markerSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(m.p2.x, m.p2.y, markerSize, 0, Math.PI * 2);
            ctx.fill();

            m._labelWorldPos = { x: (m.p1.x + m.p2.x) / 2, y: (m.p1.y + m.p2.y) / 2 };
        }
    }

    drawRubberBand(ctx) {
        const start = this.app.measureStart;
        const snapPoint = this.app.currentSnapPoint;
        const coordX = parseFloat(document.getElementById('coord-x')?.textContent) || 0;
        const coordY = parseFloat(document.getElementById('coord-y')?.textContent) || 0;
        const end = snapPoint || { x: coordX, y: coordY };

        ctx.setLineDash([5 / this.scale, 5 / this.scale]);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.strokeStyle = this.colors.measurement;
        ctx.lineWidth = 1.5 / this.scale;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = this.colors.measurement;
        ctx.beginPath();
        ctx.arc(start.x, start.y, CanvasRenderer.MARKER_SIZE.SNAP / this.scale, 0, Math.PI * 2);
        ctx.fill();
    }

    /** V6.95: Fliesen-Umriss (gestrichelt), Nummer und Nullpunkt-Fadenkreuz je Fliese */
    drawTileOrigins() {
        this.app._ensureTilesFresh?.();
        const tiles = this.app.tiles, ctx = this.ctx;
        tiles.forEach((t, i) => {
            const hl = this.app.tileHighlight === i || this.app.tilePickIdx === i;
            const a = this.worldToScreen(t.bbox.minX, t.bbox.maxY), b = this.worldToScreen(t.bbox.maxX, t.bbox.minY);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = hl ? '#ffd54f' : 'rgba(255,213,79,0.45)';
            ctx.lineWidth = hl ? 2.5 : 1;
            ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
            ctx.setLineDash([]);
            if (hl) { ctx.fillStyle = 'rgba(255,213,79,0.08)'; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
            // V3.57: grosse Nummer mittig (Anklick-Modus: Klick-Reihenfolge, nicht angeklickte gedimmt)
            const app = this.app, seqPos = app.tileSeqMode ? app.tileSeq.indexOf(i) : -1;
            const label = app.tileSeqMode ? (seqPos >= 0 ? String(seqPos + 1) : '?') : String(i + 1);
            const bw = b.x - a.x, bh = b.y - a.y, fs = Math.max(12, Math.min(96, Math.min(bw, bh) * 0.4));
            if (app.tileSeqMode && seqPos >= 0) { ctx.fillStyle = 'rgba(0,255,136,0.12)'; ctx.fillRect(a.x, a.y, bw, bh); }
            if (Math.min(bw, bh) > 24) {
                ctx.font = `bold ${fs}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = app.tileSeqMode ? (seqPos >= 0 ? 'rgba(0,255,136,0.85)' : 'rgba(255,213,79,0.25)') : 'rgba(255,213,79,0.5)';
                ctx.fillText(label, a.x + bw / 2, a.y + bh / 2);
                ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
            } else {
                ctx.font = 'bold 13px monospace'; ctx.fillStyle = '#ffd54f'; ctx.fillText(label, a.x + 5, a.y + 15);
            }
            ctx.font = 'bold 13px monospace';
            ctx.fillStyle = '#ffd54f';
            if (t.origin) {
                const o = this.worldToScreen(t.origin.x, t.origin.y), L = 14;
                ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(o.x - L, o.y); ctx.lineTo(o.x + L, o.y); ctx.moveTo(o.x, o.y - L); ctx.lineTo(o.x, o.y + L); ctx.stroke();
                ctx.beginPath(); ctx.arc(o.x, o.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
                ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
                ctx.fillStyle = '#00ff88'; ctx.fillText('0·' + (i + 1), o.x + 6, o.y - 6);
            }
            ctx.restore();
        });
    }

    drawNullPoint() {
        const screen = this.worldToScreen(this.nullPoint.x, this.nullPoint.y);
        const ctx = this.ctx;
        const size = 20;

        ctx.save();

        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(screen.x + size * 1.5, screen.y);
        ctx.stroke();

        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(screen.x, screen.y);
        ctx.lineTo(screen.x, screen.y - size * 1.5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#ff0000';
        ctx.fillText('X', screen.x + size * 1.5 + 4, screen.y + 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillText('Y', screen.x - 4, screen.y - size * 1.5 - 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('0', screen.x - 14, screen.y + 14);

        ctx.restore();
    }

    drawSnapIndicator(point) {
        const screen = this.worldToScreen(point.x, point.y);
        const ctx = this.ctx;

        ctx.save();
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = this.colors.snap;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.snap;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screen.x - 10, screen.y);
        ctx.lineTo(screen.x - 5, screen.y);
        ctx.moveTo(screen.x + 5, screen.y);
        ctx.lineTo(screen.x + 10, screen.y);
        ctx.moveTo(screen.x, screen.y - 10);
        ctx.lineTo(screen.x, screen.y - 5);
        ctx.moveTo(screen.x, screen.y + 5);
        ctx.lineTo(screen.x, screen.y + 10);
        ctx.stroke();

        ctx.restore();
    }

    /** V3.37: Vollbild-Fadenkreuz waehrend aktivem Zeichentool (AutoCAD-Stil) */
    _drawToolCrosshair(ctx, sx, sy) {
        const w = this.canvas.width, h = this.canvas.height;
        ctx.save();
        ctx.strokeStyle = this.colors.snap || '#888888';
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, sy); ctx.lineTo(w, sy);
        ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
        ctx.stroke();
        ctx.restore();
    }

    /** V3.4: Fadenkreuz am Snap-Punkt (nur wenn Snap aktiv + nativer Cursor hidden) */
    _drawSnapCrosshair(ctx, sx, sy) {
        const arm = 20;
        const gap = 5;
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(sx - arm, sy); ctx.lineTo(sx - gap, sy);
        ctx.moveTo(sx + gap, sy); ctx.lineTo(sx + arm, sy);
        ctx.moveTo(sx, sy - arm); ctx.lineTo(sx, sy - gap);
        ctx.moveTo(sx, sy + gap); ctx.lineTo(sx, sy + arm);
        ctx.stroke();
        ctx.restore();
    }

    drawMeasurementLabels() {
        if (!this.app?.measurements) return;
        const ctx = this.ctx;
        ctx.save();

        for (const m of this.app.measurements) {
            if (m._labelWorldPos) {
                const screen = this.worldToScreen(m._labelWorldPos.x, m._labelWorldPos.y);
                const text = `${m.distance.toFixed(2)} mm`;

                ctx.font = 'bold 12px monospace';
                const metrics = ctx.measureText(text);
                const padding = 6;
                const width = metrics.width + padding * 2;
                const height = 18;

                ctx.fillStyle = 'rgba(0, 80, 100, 0.95)';
                ctx.fillRect(screen.x - width / 2, screen.y - height / 2, width, height);

                ctx.strokeStyle = this.colors.measurement;
                ctx.lineWidth = 2;
                ctx.strokeRect(screen.x - width / 2, screen.y - height / 2, width, height);

                ctx.fillStyle = this.colors.measurementText;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, screen.x, screen.y);
            }
        }
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════
    // SNAP & HIT-TEST
    // ════════════════════════════════════════════════════════════════

    findSnapPoint(worldX, worldY) {
        const tolerance = CanvasRenderer.TOLERANCE.SNAP / this.scale;
        let closest = null;
        let closestDist = tolerance;

        if (!this.contours) return null;

        for (const contour of this.contours) {
            const points = contour.points;
            if (!points || points.length < 2) continue;

            for (const p of points) {
                const d = Math.hypot(p.x - worldX, p.y - worldY);
                if (d < closestDist) {
                    closestDist = d;
                    closest = { point: { x: p.x, y: p.y }, type: 'endpoint' };
                }
            }

            for (let i = 0; i < points.length - 1; i++) {
                const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
                const d = Math.hypot(mid.x - worldX, mid.y - worldY);
                if (d < closestDist) {
                    closestDist = d;
                    closest = { point: mid, type: 'midpoint' };
                }
            }

            if (contour.center) {
                const d = Math.hypot(contour.center.x - worldX, contour.center.y - worldY);
                if (d < closestDist) {
                    closestDist = d;
                    closest = { point: { x: contour.center.x, y: contour.center.y }, type: 'center' };
                }
            }
        }
        return closest;
    }

    /**
     * @param {number} worldX
     * @param {number} worldY
     * @param {object} [options] - { edgeOnly: true } = nur Kanten-Hit, kein Flächen-Hit
     */
    findContourAtPoint(worldX, worldY, options) {
        const px = 1 / this.scale;
        const tolerance = CanvasRenderer.TOLERANCE.HIT_TEST * px;
        const preciseTol = Math.min(5 * px, tolerance); // exakter Kantentreffer (5 px)
        if (!this.contours) return null;

        // V3.11: LayerManager für Sichtbarkeits-Check
        const lm = this.app?.layerManager;

        // === Pass 1: Kanten-Hit — V3.49: NAECHSTE Kante gewinnt (nicht die zuletzt gezeichnete) ===
        // Bei vielen kleinen Konturen liegen mehrere Kanten innerhalb der Toleranz; frueher
        // wurde die letzte in der Liste gewaehlt, die gewuenschte war so kaum anwaehlbar.
        let bestEdge = null, bestDist = Infinity;
        for (let ci = this.contours.length - 1; ci >= 0; ci--) {
            const contour = this.contours[ci];
            // V3.11: Unsichtbare Layer überspringen, V3.31: Gesperrte Layer blockieren
            if (lm) {
                const ld = lm.getLayer(contour.layer || '0');
                if (ld && (!ld.visible || ld.locked)) continue;
            }
            const points = contour.points;
            if (points && points.length >= 2) {
                for (let i = 0; i < points.length - 1; i++) {
                    const dist = this.pointToSegmentDistance(worldX, worldY, points[i].x, points[i].y, points[i+1].x, points[i+1].y);
                    if (dist < tolerance && dist < bestDist) { bestDist = dist; bestEdge = contour; }
                }
            }

            try {
                const kerf = contour.getKerfOffsetPolyline?.();
                if (kerf?.points && kerf.points.length >= 2) {
                    for (let i = 0; i < kerf.points.length - 1; i++) {
                        const dist = this.pointToSegmentDistance(worldX, worldY,
                            kerf.points[i].x, kerf.points[i].y,
                            kerf.points[i+1].x, kerf.points[i+1].y);
                        if (dist < tolerance && dist < bestDist) { bestDist = dist; bestEdge = contour; }
                    }
                }
            } catch(e) {}
        }

        // Exakter Kantentreffer (oder reiner Kanten-Modus, z.B. Rechtsklick) → sofort
        if (bestEdge && (bestDist <= preciseTol || options?.edgeOnly)) return bestEdge;
        if (options?.edgeOnly) return null;

        // === Pass 2: Flächen-Hit — Klick IN geschlossene Kontur (V3.27) ===
        // V3.49: Flaeche hat Vorrang vor der weiten Kanten-Toleranz → innerste Kontur anwaehlbar
        if (typeof GeometryOps !== 'undefined' && GeometryOps.pointInPolygon) {
            const point = { x: worldX, y: worldY };
            const candidates = [];

            for (let ci = this.contours.length - 1; ci >= 0; ci--) {
                const contour = this.contours[ci];
                if (!contour.isClosed) continue;
                if (!contour.points || contour.points.length < 3) continue;
                if (lm) {
                    const ld = lm.getLayer(contour.layer || '0');
                    if (ld && (!ld.visible || ld.locked)) continue;
                }
                if (GeometryOps.pointInPolygon(point, contour.points)) {
                    candidates.push(contour);
                }
            }

            if (candidates.length > 0) {
                // V3.28: Hatch-Konturen haben Priorität (liegen visuell oben)
                const hatchHit = candidates.find(c => c.isHatchContour || c.cuttingMode === 'none');
                if (hatchHit) return hatchHit;
                // Kleinste Fläche = innerste Kontur (Nesting-Hierarchie)
                candidates.sort((a, b) => a.getArea() - b.getArea());
                return candidates[0];
            }
        }

        // Weite Kanten-Toleranz als Fallback (knapp neben der Kante, ausserhalb jeder Flaeche)
        return bestEdge;
    }

    /**
     * V3.32: Cycle-Selection — sammelt ALLE Konturen an einem Punkt (statt Early-Return)
     * Rückgabe: Array sortiert nach Draw-Order (topmost first), dann Area (kleinste zuerst bei Flächen)
     */
    findAllContoursAtPoint(worldX, worldY) {
        const tolerance = CanvasRenderer.TOLERANCE.HIT_TEST / this.scale;
        if (!this.contours) return [];

        const lm = this.app?.layerManager;
        const edgeHits = new Set();
        const areaHits = [];

        // Pass 1: Kanten-Hits sammeln (rückwärts = topmost first)
        for (let ci = this.contours.length - 1; ci >= 0; ci--) {
            const contour = this.contours[ci];
            if (lm) {
                const ld = lm.getLayer(contour.layer || '0');
                if (ld && (!ld.visible || ld.locked)) continue;
            }
            let hit = false;
            const points = contour.points;
            if (points && points.length >= 2) {
                for (let i = 0; i < points.length - 1; i++) {
                    const dist = this.pointToSegmentDistance(worldX, worldY, points[i].x, points[i].y, points[i+1].x, points[i+1].y);
                    if (dist < tolerance) { hit = true; break; }
                }
            }
            if (!hit) {
                try {
                    const kerf = contour.getKerfOffsetPolyline?.();
                    if (kerf?.points && kerf.points.length >= 2) {
                        for (let i = 0; i < kerf.points.length - 1; i++) {
                            const dist = this.pointToSegmentDistance(worldX, worldY,
                                kerf.points[i].x, kerf.points[i].y,
                                kerf.points[i+1].x, kerf.points[i+1].y);
                            if (dist < tolerance) { hit = true; break; }
                        }
                    }
                } catch(e) {}
            }
            if (hit) edgeHits.add(contour);
        }

        // Pass 2: Flächen-Hits (Point-in-Polygon)
        if (typeof GeometryOps !== 'undefined' && GeometryOps.pointInPolygon) {
            const point = { x: worldX, y: worldY };
            for (let ci = this.contours.length - 1; ci >= 0; ci--) {
                const contour = this.contours[ci];
                if (edgeHits.has(contour)) continue; // bereits erfasst
                if (!contour.isClosed || !contour.points || contour.points.length < 3) continue;
                if (lm) {
                    const ld = lm.getLayer(contour.layer || '0');
                    if (ld && (!ld.visible || ld.locked)) continue;
                }
                if (GeometryOps.pointInPolygon(point, contour.points)) {
                    areaHits.push(contour);
                }
            }
            // Flächen-Hits: kleinste Fläche zuerst (innerste Kontur = wahrscheinlichster Treffer)
            areaHits.sort((a, b) => a.getArea() - b.getArea());
        }

        // Edge-Hits zuerst (präziser), dann Area-Hits
        const result = [...edgeHits, ...areaHits];
        console.debug(`[Renderer V3.32] findAllContoursAtPoint: ${result.length} Treffer (${edgeHits.size} Kante, ${areaHits.length} Fläche)`);
        return result;
    }

    _hitTestStartTriangle(worldPos) {
        if (!this.contours) return null;
        const lm = this.app?.layerManager;
        const hitRadius = CanvasRenderer.MARKER_SIZE.START_TRIANGLE / this.scale * 2;
        for (const contour of this.contours) {
            if (contour.isReference || (!contour.isClosed && contour.cuttingMode !== 'slit')) continue;
            // V3.31: Unsichtbare/gesperrte Layer überspringen
            if (lm) {
                const ld = lm.getLayer(contour.layer || '0');
                if (ld && (!ld.visible || ld.locked)) continue;
            }
            let startPoint = contour.points[0];
            try {
                const kerf = contour.getKerfOffsetPolyline?.();
                if (kerf?.points?.length > 2 && !contour.compensationSkipped) {
                    startPoint = kerf.points[0];
                }
            } catch(e) {}
            if (!startPoint) continue;
            const dist = Math.hypot(worldPos.x - startPoint.x, worldPos.y - startPoint.y);
            if (dist < hitRadius) return contour;
        }
        return null;
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    zoomIn() { this.scale *= 1.3; this.render(); }
    zoomOut() { this.scale /= 1.3; this.render(); }

    fitToContent() {
        if (!this.contours || this.contours.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const c of this.contours) {
            if (!c.points) continue;
            for (const p of c.points) {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            }
        }
        if (!isFinite(minX)) return;
        const w = maxX - minX || 1, h = maxY - minY || 1;
        const cw = this._logicalWidth, ch = this._logicalHeight;
        const margin = 40;
        this.scale = Math.min((cw - 2 * margin) / w, (ch - 2 * margin) / h);
        const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        this.offsetX = cw / 2 - cx * this.scale;
        this.offsetY = ch / 2 + cy * this.scale;
        this.render();
    }

    // ════════════════════════════════════════════════════════════════
    // V3.10: GRIP EDITING SYSTEM
    // ════════════════════════════════════════════════════════════════

    /**
     * Grips für alle selektierten Konturen berechnen.
     * Grip-Objekt: { type, x, y, contour, indices, label }
     *   type: 'vertex' | 'midpoint' | 'center' | 'quadrant'
     *   indices: Array von Punkt-Indizes die beim Drag bewegt werden
     */
    _computeGrips() {
        this._grips = [];
        if (!this.contours) return;

        const selected = this.contours.filter(c => c.isSelected);
        if (selected.length === 0) return;

        for (const contour of selected) {
            const pts = contour.points;
            if (!pts || pts.length < 2) continue;

            // V3.33: Spline Fit-Point Grips
            if (contour._fitPoints && contour._fitPoints.length >= 2) {
                for (let i = 0; i < contour._fitPoints.length; i++) {
                    this._grips.push({
                        type: 'spline_fit',
                        x: contour._fitPoints[i].x,
                        y: contour._fitPoints[i].y,
                        contour: contour,
                        fitIndex: i,
                        label: 'F' + i
                    });
                }
                continue; // Keine normalen Vertex-Grips für Spline-Konturen
            }

            // Kreis-Erkennung
            if (this._isCircleContour(contour)) {
                this._addCircleGrips(contour);
                continue;
            }

            // V3.47: Rechteck mit gerundeten Ecken -> nur 4 Kanten-Grips (Groesse aendern, Ecken laufen mit)
            const rr = this._detectRoundedRect(contour);
            if (rr) {
                this._addRoundedRectGrips(contour, rr);
                continue;
            }

            // Segment-Anzahl (bei geschlossener Kontur: letzter Punkt = erster)
            const segCount = pts.length - 1;
            const vertCount = contour.isClosed ? pts.length - 1 : pts.length;

            // Max-Grips-Limit: Bei >80 Vertices nur Vertex-Grips, keine Midpoints
            const showMidpoints = vertCount <= 80;

            // Vertex-Grips
            for (let i = 0; i < vertCount; i++) {
                this._grips.push({
                    type: 'vertex',
                    x: pts[i].x,
                    y: pts[i].y,
                    contour: contour,
                    indices: contour.isClosed && i === 0
                        ? [0, pts.length - 1]  // Erster + letzter Punkt synchron
                        : [i],
                    label: 'V' + i
                });
            }

            // Midpoint-Grips
            if (showMidpoints) {
                for (let i = 0; i < segCount; i++) {
                    const j = (i + 1) % pts.length;
                    if (contour.isClosed && j >= pts.length - 1 && i !== segCount - 1) continue;
                    const nextIdx = contour.isClosed && i === segCount - 1 ? 0 : i + 1;
                    this._grips.push({
                        type: 'midpoint',
                        x: (pts[i].x + pts[nextIdx].x) / 2,
                        y: (pts[i].y + pts[nextIdx].y) / 2,
                        contour: contour,
                        indices: contour.isClosed && nextIdx === 0
                            ? [i, 0, pts.length - 1]  // Wrap-Around
                            : [i, nextIdx],
                        label: 'M' + i
                    });
                }
            }
        }
        this._gripDirty = false;
    }

    // ════════════════════════════════════════════════════════════════
    // V3.47: Rechteck mit gerundeten Ecken (Polylinie aus Geraden + Bogen-Stuetzpunkten)
    // ════════════════════════════════════════════════════════════════

    /** Erkennt rein geometrisch ein (ggf. gedrehtes) Rechteck mit gleichen Eckradien. */
    _detectRoundedRect(contour) {
        if (!contour.isClosed) return null;
        const pts = contour.points;
        if (!pts || pts.length < 10) return null;
        const n = pts.length - 1;
        let li = 0, ll = 0;
        for (let i = 0; i < n; i++) {
            const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
            if (l > ll) { ll = l; li = i; }
        }
        if (ll < 1e-6) return null;
        const angs = [Math.atan2(pts[li + 1].y - pts[li].y, pts[li + 1].x - pts[li].x), 0];
        for (const a of angs) {
            const rr = this._fitRoundedRect(pts, n, { x: Math.cos(a), y: Math.sin(a) }, { x: -Math.sin(a), y: Math.cos(a) });
            if (rr) return rr;
        }
        return null;
    }

    _fitRoundedRect(pts, n, u, v) {
        let smin = Infinity, smax = -Infinity, tmin = Infinity, tmax = -Infinity;
        const S = [], T = [];
        for (let i = 0; i < n; i++) {
            const s = pts[i].x * u.x + pts[i].y * u.y, t = pts[i].x * v.x + pts[i].y * v.y;
            S.push(s); T.push(t);
            if (s < smin) smin = s; if (s > smax) smax = s;
            if (t < tmin) tmin = t; if (t > tmax) tmax = t;
        }
        const w = smax - smin, h = tmax - tmin;
        if (w < 0.1 || h < 0.1) return null;
        const tol = 0.01 + 1e-4 * Math.max(w, h);
        // Radius: laengstes gerades Segment auf irgendeiner der 4 Kanten (= Strecke zwischen den Tangentenpunkten).
        // Langlochform (R = halbe Kurzseite): Kurzseite hat kein gerades Stueck -> Langseite liefert r.
        let r = NaN, eLen = 0;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const cand = [
                [Math.abs(S[i] - smin) < tol && Math.abs(S[j] - smin) < tol, Math.abs(T[j] - T[i]), Math.min(T[i], T[j]) - tmin],
                [Math.abs(S[i] - smax) < tol && Math.abs(S[j] - smax) < tol, Math.abs(T[j] - T[i]), tmax - Math.max(T[i], T[j])],
                [Math.abs(T[i] - tmin) < tol && Math.abs(T[j] - tmin) < tol, Math.abs(S[j] - S[i]), Math.min(S[i], S[j]) - smin],
                [Math.abs(T[i] - tmax) < tol && Math.abs(T[j] - tmax) < tol, Math.abs(S[j] - S[i]), smax - Math.max(S[i], S[j])]
            ];
            for (const [on, l, rc] of cand) if (on && l > eLen) { eLen = l; r = rc; }
        }
        if (!(r > tol * 2) || 2 * r > Math.min(w, h) + tol) return null;
        let q = 0; // je ein Bit pro Ecke mit mindestens einem echten Bogenpunkt
        for (let i = 0; i < n; i++) {
            const s = S[i], t = T[i];
            const cs = s < smin + r ? smin + r : (s > smax - r ? smax - r : s);
            const ct = t < tmin + r ? tmin + r : (t > tmax - r ? tmax - r : t);
            if (cs === s && ct === t) {
                if (Math.min(Math.abs(s - smin), Math.abs(s - smax), Math.abs(t - tmin), Math.abs(t - tmax)) > tol) return null;
            } else {
                if (Math.abs(Math.hypot(s - cs, t - ct) - r) > tol) return null;
                if (cs !== s && ct !== t && Math.abs(s - cs) > tol && Math.abs(t - ct) > tol) q |= (s < cs ? 1 : 2) << (t < ct ? 0 : 2);
            }
        }
        if (q !== 15) return null; // jede der 4 Ecken braucht echte Bogenpunkte
        const rr = { u, v, smin, smax, tmin, tmax, r, tol };
        // Startpunkt-Klassifikation + Umlaufsinn merken
        let area = 0;
        for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a.x * b.y - b.x * a.y; }
        rr.ccw = area > 0;
        rr.startCls = this._rrClass(S[0], T[0], rr);
        rr.start = { x: pts[0].x, y: pts[0].y };
        return rr;
    }

    _rrClass(s, t, b) {
        const tol = b.tol;
        return {
            sx: (s - b.smin < b.smax - s) ? 0 : 1, tx: (t - b.tmin < b.tmax - t) ? 0 : 1,
            onS: Math.min(Math.abs(s - b.smin), Math.abs(s - b.smax)) < tol,
            onT: Math.min(Math.abs(t - b.tmin), Math.abs(t - b.tmax)) < tol
        };
    }

    /** Baut die Kontur aus Rahmen-Grenzen b neu auf (gleicher Radius, gleiche Punktzahl, gleicher Startpunkt-Typ). */
    _buildRoundedRect(rr, b) {
        const { u, v, r } = rr;
        const W = (s, t) => ({ x: s * u.x + t * v.x, y: s * u.y + t * v.y });
        let c = [W(b.smin, b.tmin), W(b.smax, b.tmin), W(b.smax, b.tmax), W(b.smin, b.tmax)];
        if (!rr.ccw) c = [c[0], c[3], c[2], c[1]];
        const pts = GeometryOps.filletPolyline([...c, { x: c[0].x, y: c[0].y }], true, r);
        const body = pts.slice(0, -1);
        const nb = { smin: b.smin, smax: b.smax, tmin: b.tmin, tmax: b.tmax, tol: rr.tol };
        const k = rr.startCls;
        let best = -1, bd = Infinity;
        for (let i = 0; i < body.length; i++) {
            const s = body[i].x * u.x + body[i].y * u.y, t = body[i].x * v.x + body[i].y * v.y;
            const cl = this._rrClass(s, t, nb);
            if (cl.sx !== k.sx || cl.tx !== k.tx || cl.onS !== k.onS || cl.onT !== k.onT) continue;
            const d = Math.hypot(body[i].x - rr.start.x, body[i].y - rr.start.y);
            if (d < bd) { bd = d; best = i; }
        }
        const out = best > 0 ? body.slice(best).concat(body.slice(0, best)) : body;
        out.push({ x: out[0].x, y: out[0].y });
        return out;
    }

    _rrEdgeMid(rr, side, b) {
        const { u, v } = rr;
        const sm = (b.smin + b.smax) / 2, tm = (b.tmin + b.tmax) / 2;
        const s = side === 'smin' ? b.smin : side === 'smax' ? b.smax : sm;
        const t = side === 'tmin' ? b.tmin : side === 'tmax' ? b.tmax : tm;
        return { x: s * u.x + t * v.x, y: s * u.y + t * v.y };
    }

    _addRoundedRectGrips(contour, rr) {
        for (const side of ['smin', 'smax', 'tmin', 'tmax']) {
            const m = this._rrEdgeMid(rr, side, rr);
            this._grips.push({
                type: 'rr_edge', side, x: m.x, y: m.y, contour, indices: [],
                _rr: rr, label: 'E-' + side
            });
        }
    }

    /** Masse (Breite/Hoehe) der gezogenen Kante: {orig, cur, name} */
    _rrDims(grip) {
        const rr = grip._rr, b = grip._rrCur || rr, isS = grip.side[0] === 's';
        return {
            name: isS ? 'Breite' : 'Höhe',
            orig: isS ? rr.smax - rr.smin : rr.tmax - rr.tmin,
            cur: isS ? b.smax - b.smin : b.tmax - b.tmin
        };
    }

    /** Weltpunkt, der die bewegte Kante auf Masz dim setzt (gegenueberliegende Kante bleibt stehen) */
    _rrPosForDim(grip, dim) {
        const rr = grip._rr, { u, v } = rr;
        let s = (rr.smin + rr.smax) / 2, t = (rr.tmin + rr.tmax) / 2;
        switch (grip.side) {
            case 'smax': s = rr.smin + dim; break;
            case 'smin': s = rr.smax - dim; break;
            case 'tmax': t = rr.tmin + dim; break;
            case 'tmin': t = rr.tmax - dim; break;
        }
        return { x: s * u.x + t * v.x, y: s * u.y + t * v.y };
    }

    _applyRoundedRectDrag(grip, newPos, contour) {
        const rr = grip._rr, { u, v, r } = rr;
        const isS = grip.side[0] === 's';
        const c = isS ? newPos.x * u.x + newPos.y * u.y : newPos.x * v.x + newPos.y * v.y;
        const b = { smin: rr.smin, smax: rr.smax, tmin: rr.tmin, tmax: rr.tmax };
        const minSize = 2 * r + 1;   // mind. 1 mm gerades Stueck, damit die Kontur erkennbar bleibt
        switch (grip.side) {
            case 'smin': b.smin = Math.min(c, b.smax - minSize); break;
            case 'smax': b.smax = Math.max(c, b.smin + minSize); break;
            case 'tmin': b.tmin = Math.min(c, b.tmax - minSize); break;
            case 'tmax': b.tmax = Math.max(c, b.tmin + minSize); break;
        }
        grip._rrCur = b;
        contour.points = this._buildRoundedRect(rr, b);
        const m = this._rrEdgeMid(rr, grip.side, b);
        grip.x = m.x; grip.y = m.y;
    }

    /**
     * Kreis-Heuristik: Geschlossen, ≥8 Punkte, alle Punkte ±3% gleich weit vom Centroid.
     */
    _isCircleContour(contour) {
        if (!contour.isClosed) return false;
        const pts = contour.points;
        const n = pts.length - 1; // Ohne doppelten Schlusspunkt
        if (n < 8) return false;

        // Centroid
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) { cx += pts[i].x; cy += pts[i].y; }
        cx /= n; cy /= n;

        // Distanzen zum Centroid
        const dists = [];
        for (let i = 0; i < n; i++) {
            dists.push(Math.hypot(pts[i].x - cx, pts[i].y - cy));
        }
        const avgR = dists.reduce((s, d) => s + d, 0) / n;
        if (avgR < 0.01) return false; // Degeneriert

        // Alle Distanzen innerhalb ±3%?
        const tolerance = 0.03;
        return dists.every(d => Math.abs(d - avgR) / avgR < tolerance);
    }

    /**
     * Center + 4 Quadranten-Grips für Kreise.
     */
    _addCircleGrips(contour) {
        const pts = contour.points;
        const n = pts.length - 1;

        // Centroid + Radius berechnen
        let cx = 0, cy = 0;
        for (let i = 0; i < n; i++) { cx += pts[i].x; cy += pts[i].y; }
        cx /= n; cy /= n;
        let avgR = 0;
        for (let i = 0; i < n; i++) avgR += Math.hypot(pts[i].x - cx, pts[i].y - cy);
        avgR /= n;

        // Center-Grip: Bewegt alle Punkte
        const allIndices = [];
        for (let i = 0; i < pts.length; i++) allIndices.push(i);
        this._grips.push({
            type: 'center',
            x: cx, y: cy,
            contour: contour,
            indices: allIndices,
            _center: { x: cx, y: cy },
            _radius: avgR,
            label: 'Center'
        });

        // 4 Quadranten-Grips (0°, 90°, 180°, 270°)
        const quadrants = [
            { angle: 0,   x: cx + avgR, y: cy },
            { angle: 90,  x: cx, y: cy + avgR },
            { angle: 180, x: cx - avgR, y: cy },
            { angle: 270, x: cx, y: cy - avgR }
        ];
        for (const q of quadrants) {
            this._grips.push({
                type: 'quadrant',
                x: q.x, y: q.y,
                contour: contour,
                indices: allIndices,
                _center: { x: cx, y: cy },
                _radius: avgR,
                _angle: q.angle,
                label: 'Q' + q.angle
            });
        }
    }

    /**
     * V3.44: Referenz fuer Vertex-Grip: festes Nachbar-Ende, Originalrichtung, Endpunkt-Flag.
     * Bei Endpunkten offener Konturen = Verlaengern/Strecken auf derselben Linie.
     */
    _gripRef(grip) {
        const old = grip && grip._oldPts;
        if (!grip || grip.type !== 'vertex' || !old || old.length < 2) return null;
        const idx = grip.indices[0];
        const n = old.length;
        const open = !grip.contour.isClosed;
        const isEnd = open && (idx === 0 || idx === n - 1);
        const nb = idx === 0 ? 1 : idx - 1;
        const fixed = old[nb];
        const dx = old[idx].x - fixed.x, dy = old[idx].y - fixed.y, dl = Math.hypot(dx, dy);
        if (dl < 1e-9) return { idx, fixed, dir: { x: 1, y: 0 }, endpoint: isEnd, length: 0 };
        return { idx, fixed, dir: { x: dx / dl, y: dy / dl }, endpoint: isEnd, length: dl };
    }

    /** V3.46: Vorzeichen der Aenderung: Maus jenseits der Ausgangslaenge = verlaengern, davor = kuerzen ('-' erzwingt kuerzen) */
    _gripDeltaSign(raw, ref, grip) {
        if (raw && raw[0] === '-') return -1;
        const cur = grip.contour.points[ref.idx];
        const curLen = Math.hypot(cur.x - ref.fixed.x, cur.y - ref.fixed.y);
        return curLen >= ref.length ? 1 : -1;
    }

    /** V3.44: Ortho beim Endpunkt-Strecken => Punkt bleibt auf der Linie (Verlaengerung kollinear) */
    _constrainGripDrag(grip, pos) {
        if (!this.app?.snapManager?.effectiveOrtho?.()) return pos;
        const ref = this._gripRef(grip);
        if (!ref || !ref.endpoint) return pos;
        const t = (pos.x - ref.fixed.x) * ref.dir.x + (pos.y - ref.fixed.y) * ref.dir.y;
        return { x: ref.fixed.x + ref.dir.x * t, y: ref.fixed.y + ref.dir.y * t };
    }

    /** V3.44: HUD waehrend Grip-Drag: Laenge / Winkel / Masseingabe */
    _drawGripDragHud(ctx) {
        const grip = this._draggedGrip;
        if (grip && grip.type === 'rr_edge' && this._lastMouseScreen) { this._drawRrHud(ctx, grip); return; }
        if (!grip || grip.type !== 'vertex' || !this._lastMouseScreen) return;
        const ref = this._gripRef(grip);
        if (!ref) return;
        const cur = grip.contour.points[ref.idx];
        const len = Math.hypot(cur.x - ref.fixed.x, cur.y - ref.fixed.y);
        const ang = Math.atan2(cur.y - ref.fixed.y, cur.x - ref.fixed.x) * 180 / Math.PI;
        const typing = this._gripLenBuf;
        const kind = typing ? (typing[0] === '=' ? 'Länge =' : 'Änderung') : '';
        const num = typing ? typing.replace(/^[-=]/, '') : '';
        const sg = typing && typing[0] !== '=' ? this._gripDeltaSign(typing, ref, grip) : 0;
        const l1 = typing ? `${kind}: ${typing[0] === '=' ? '' : (sg < 0 ? '−' : '+')}${num}\u2588  → ${(typing[0] === '=' ? parseFloat(num) : ref.length + sg * parseFloat(num || 0)).toFixed(2)}`
                            : `Länge: ${len.toFixed(2)}  (tippen: Δ in Zugrichtung, =abs.)`;
        const l2 = `Winkel: ${ang.toFixed(1)}°` + (ref.endpoint && this.app?.snapManager?.effectiveOrtho?.() ? '  Ortho' : '');
        ctx.save();
        ctx.font = '12px Consolas, monospace';
        const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 12;
        const x = this._lastMouseScreen.x + 18, y = this._lastMouseScreen.y + 18;
        ctx.fillStyle = 'rgba(40,40,40,0.92)';
        ctx.strokeStyle = typing ? '#ffe94d' : '#888';
        ctx.fillRect(x, y, w, 38);
        ctx.strokeRect(x + 0.5, y + 0.5, w, 38);
        ctx.fillStyle = typing ? '#ffe94d' : '#e0e0e0';
        ctx.textBaseline = 'middle';
        ctx.fillText(l1, x + 6, y + 11);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(l2, x + 6, y + 28);
        ctx.restore();
    }

    /** V3.47: HUD beim Gross-/Kleinziehen eines gerundeten Rechtecks */
    _drawRrHud(ctx, grip) {
        const dm = this._rrDims(grip), rr = grip._rr;
        const typing = this._gripLenBuf;
        const isS = grip.side[0] === 's';
        const b = grip._rrCur || rr;
        const wv = b.smax - b.smin, hv = b.tmax - b.tmin;
        let l1;
        if (typing) {
            const num = typing.replace(/^[-=]/, '');
            const sg = typing[0] === '-' ? -1 : (dm.cur >= dm.orig ? 1 : -1);
            const res = typing[0] === '=' ? parseFloat(num) : dm.orig + sg * parseFloat(num || 0);
            l1 = `${dm.name} ${typing[0] === '=' ? '=' : (sg < 0 ? '−' : '+')}${num}\u2588  → ${isFinite(res) ? res.toFixed(2) : '?'}`;
        } else {
            l1 = `${dm.name}: ${dm.cur.toFixed(2)}  (tippen: Δ, =abs.)`;
        }
        const l2 = `${wv.toFixed(2)} × ${hv.toFixed(2)}  R${rr.r.toFixed(2)}`;
        ctx.save();
        ctx.font = '12px Consolas, monospace';
        const w = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 12;
        const x = this._lastMouseScreen.x + 18, y = this._lastMouseScreen.y + 18;
        ctx.fillStyle = 'rgba(40,40,40,0.92)';
        ctx.strokeStyle = typing ? '#ffe94d' : '#888';
        ctx.fillRect(x, y, w, 38);
        ctx.strokeRect(x + 0.5, y + 0.5, w, 38);
        ctx.fillStyle = typing ? '#ffe94d' : '#e0e0e0';
        ctx.textBaseline = 'middle';
        ctx.fillText(l1, x + 6, y + 11);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(l2, x + 6, y + 28);
        ctx.restore();
    }

    /** V3.44: Verweil-Timer: nach ~0,65s auf End-/Mittelpunkt werden Laengen angezeigt */
    _updateSnapDwell(snap) {
        const key = snap ? `${snap.type}:${snap.point.x.toFixed(3)}:${snap.point.y.toFixed(3)}` : null;
        if (key === this._dwellKey) return;
        this._dwellKey = key;
        this._dwellShow = false;
        clearTimeout(this._dwellTimer);
        if (key && (snap.type === 'endpoint' || snap.type === 'midpoint')) {
            this._dwellTimer = setTimeout(() => {
                if (this._dwellKey === key) { this._dwellShow = true; this.render(); }
            }, 650);
        }
    }

    _drawSnapDwellLengths(ctx, snap) {
        if (this._draggedGrip || !this.contours) return;
        const p = snap.point, tol = 0.05;
        const items = [];
        const seen = new Set();
        const segLen = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
        for (const c of this.contours) {
            const pts = c.points;
            if (!pts || pts.length < 2 || c.isHatchContour) continue;
            const nSeg = pts.length - 1;
            let total = 0;
            for (let i = 0; i < nSeg; i++) total += segLen(pts[i], pts[i + 1]);
            if (c.isClosed && segLen(pts[0], pts[nSeg]) > 1e-6) total += segLen(pts[nSeg], pts[0]);
            const segs = [];
            if (snap.type === 'endpoint') {
                for (let i = 0; i <= nSeg; i++) {
                    if (Math.hypot(pts[i].x - p.x, pts[i].y - p.y) > tol) continue;
                    if (i > 0) segs.push(i - 1);
                    if (i < nSeg) segs.push(i);
                    if (c.isClosed && i === 0) segs.push(nSeg - 1);
                    if (c.isClosed && i === nSeg) segs.push(0);
                }
            } else {
                for (let i = 0; i < nSeg; i++) {
                    const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
                    if (Math.hypot(mx - p.x, my - p.y) <= tol) segs.push(i);
                }
            }
            if (segs.length === 0) continue;
            const detailed = nSeg <= 4;   // Polylinien/Boegen mit vielen Stuetzpunkten: nur Gesamtlaenge
            for (const i of [...new Set(segs)]) {
                const a = pts[i], b = pts[i + 1];
                const key = `${c.name}:${detailed ? i : 'all'}`;
                if (seen.has(key)) continue;
                seen.add(key);
                items.push({
                    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
                    ang: Math.atan2(b.y - a.y, b.x - a.x),
                    text: detailed ? segLen(a, b).toFixed(2) + ' mm' + (nSeg > 1 ? `  (Σ ${total.toFixed(2)})` : '')
                                   : 'Σ ' + total.toFixed(2) + ' mm'
                });
            }
        }
        if (items.length === 0) return;
        ctx.save();
        ctx.font = '12px Consolas, monospace';
        ctx.textBaseline = 'middle';
        for (const it of items.slice(0, 12)) {
            const s = this.worldToScreen(it.mid.x, it.mid.y);
            // Label seitlich versetzt (senkrecht zur Linie, bildschirmseitig oben)
            let nx = Math.sin(it.ang), ny = -Math.cos(it.ang);   // Weltnormale -> Bildschirm (y gespiegelt)
            if (ny > 0) { nx = -nx; ny = -ny; }
            const lx = s.x + nx * 16, ly = s.y + ny * 16;
            const w = ctx.measureText(it.text).width + 10;
            ctx.strokeStyle = '#ffe94d'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.fillStyle = 'rgba(40,40,40,0.92)';
            ctx.fillRect(lx - w / 2, ly - 9, w, 18);
            ctx.strokeRect(lx - w / 2 + 0.5, ly - 8.5, w, 18);
            ctx.fillStyle = '#ffe94d';
            ctx.textAlign = 'center';
            ctx.fillText(it.text, lx, ly + 0.5);
        }
        ctx.restore();
    }

    /**
     * Hit-Test: Prüft ob ein Weltpunkt auf einem Grip liegt.
     * @returns {Object|null} Grip-Objekt oder null
     */
    _hitTestGrip(worldPos) {
        if (this._gripDirty) this._computeGrips();
        if (this._grips.length === 0) return null;

        const hitRadius = 6 / this.scale; // 6 Pixel Toleranz
        let closest = null;
        let closestDist = hitRadius;

        for (const grip of this._grips) {
            const dist = Math.hypot(worldPos.x - grip.x, worldPos.y - grip.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = grip;
            }
        }
        return closest;
    }

    /**
     * Grip-Drag anwenden: Punkt(e) auf neue Position setzen.
     */
    _applyGripDrag(grip, newPos, contour) {
        const pts = contour.points;

        switch (grip.type) {
            case 'vertex': {
                // Einzelner Punkt (oder erster+letzter bei geschlossen)
                for (const idx of grip.indices) {
                    pts[idx].x = newPos.x;
                    pts[idx].y = newPos.y;
                }
                break;
            }
            case 'midpoint': {
                // Delta berechnen: Differenz zwischen neuem und altem Mittelpunkt
                const dx = newPos.x - grip.x;
                const dy = newPos.y - grip.y;
                for (const idx of grip.indices) {
                    pts[idx].x += dx;
                    pts[idx].y += dy;
                }
                // Grip-Position updaten für nächsten Frame
                grip.x = newPos.x;
                grip.y = newPos.y;
                break;
            }
            case 'center': {
                // Gesamte Kontur verschieben
                const dx = newPos.x - grip._center.x;
                const dy = newPos.y - grip._center.y;
                for (let i = 0; i < pts.length; i++) {
                    pts[i].x += dx;
                    pts[i].y += dy;
                }
                grip._center.x = newPos.x;
                grip._center.y = newPos.y;
                grip.x = newPos.x;
                grip.y = newPos.y;
                break;
            }
            case 'quadrant': {
                // Radius ändern: Abstand newPos zu Center = neuer Radius
                const cx = grip._center.x;
                const cy = grip._center.y;
                const newR = Math.max(0.1, Math.hypot(newPos.x - cx, newPos.y - cy));
                const oldR = grip._radius;
                if (oldR < 0.01) break;
                const scale = newR / oldR;
                for (let i = 0; i < pts.length; i++) {
                    pts[i].x = cx + (pts[i].x - cx) * scale;
                    pts[i].y = cy + (pts[i].y - cy) * scale;
                }
                grip._radius = newR;
                // Grip-Position auf neuen Quadranten-Punkt setzen
                const angleRad = grip._angle * Math.PI / 180;
                grip.x = cx + newR * Math.cos(angleRad);
                grip.y = cy + newR * Math.sin(angleRad);
                break;
            }
            case 'rr_edge': {
                this._applyRoundedRectDrag(grip, newPos, contour);
                break;
            }
            case 'spline_fit': {
                // V3.33: Fit-Point verschieben → Spline re-tessellieren
                contour._fitPoints[grip.fitIndex].x = newPos.x;
                contour._fitPoints[grip.fitIndex].y = newPos.y;
                grip.x = newPos.x;
                grip.y = newPos.y;

                // Re-Tessellation
                if (typeof SplineUtils !== 'undefined' && SplineUtils.interpolate) {
                    let inputPts = contour._fitPoints;
                    if (contour._splineClosed && inputPts.length >= 3) {
                        inputPts = [...inputPts, inputPts[0], inputPts[1]];
                    }
                    const newCurve = SplineUtils.interpolate(inputPts);
                    if (newCurve && newCurve.length >= 2) {
                        pts.length = 0;
                        for (const p of newCurve) pts.push({ x: p.x, y: p.y });
                        // Geschlossene Splines: Schlusspunkt hinzufügen
                        if (contour._splineClosed) {
                            // Trim overlapping end (like SplineTool._tessellate)
                            const first = pts[0];
                            for (let ti = pts.length - 1; ti > pts.length / 2; ti--) {
                                if (Math.hypot(pts[ti].x - first.x, pts[ti].y - first.y) < 0.1) {
                                    pts.length = ti + 1;
                                    break;
                                }
                            }
                        }
                    }
                }
                break;
            }
        }

        // Cache invalidieren
        contour._cachedKerfPolyline = null;
        contour._cacheKey = null;
        contour._cachedLeadInPath = null;
        contour._cachedLeadOutPath = null;
        contour._cachedOvercutPath = null;
    }

    /**
     * Grips zeichnen (blaue Quadrate, rot bei Hover/Drag).
     * Wird im World-Koordinatensystem aufgerufen (ctx ist bereits transformiert).
     */
    _drawGrips(ctx) {
        // Schneller Bail-Out: Keine Selektion → 0 Overhead
        if (!this._hasSelection && this._grips.length === 0) return;

        // Keine Grips wenn Tool aktiv oder Messmodus
        const toolMgr = this.app?.drawingTools || this.app?.toolManager;
        if (toolMgr?.isToolActive?.()) return;
        if (this.app?.measureMode) return;
        if (this.app?.isGeometryEditAllowed && !this.app.isGeometryEditAllowed()) return;   // V6.57: Grips nur im CAD-Tab

        if (this._gripDirty) this._computeGrips();
        if (this._grips.length === 0) return;

        const size = 7 / this.scale;  // V3.37: 7px Quadrat (AutoCAD-Standard ~6-8px)

        // V3.33: Kontrollpolygon für selektierte Spline-Konturen
        const drawnPolygons = new Set();
        for (const grip of this._grips) {
            if (grip.type === 'spline_fit' && !drawnPolygons.has(grip.contour)) {
                drawnPolygons.add(grip.contour);
                const fp = grip.contour._fitPoints;
                if (fp && fp.length >= 2) {
                    ctx.save();
                    ctx.setLineDash([6 / this.scale, 3 / this.scale]);
                    ctx.strokeStyle = 'rgba(100, 140, 255, 0.4)';
                    ctx.lineWidth = 1 / this.scale;
                    ctx.beginPath();
                    ctx.moveTo(fp[0].x, fp[0].y);
                    for (let i = 1; i < fp.length; i++) ctx.lineTo(fp[i].x, fp[i].y);
                    if (grip.contour._splineClosed) ctx.closePath();
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // V3.45: AutoCAD-2013-Stil — GEFUELLTE Quadrate: kalt = blau, Hover = gruen, aktiv (hot) = rot,
        // duenner dunkler Rand, ca. 9 px
        const half = 4.5 / this.scale;
        ctx.lineWidth = 1 / this.scale;
        ctx.strokeStyle = '#101830';
        for (const grip of this._grips) {
            const isDragged = grip === this._draggedGrip;
            const isHovered = grip === this._hoveredGrip;
            ctx.fillStyle = isDragged ? '#ff2a2a' : (isHovered ? '#27c43a' : '#2a56ff');
            ctx.fillRect(grip.x - half, grip.y - half, half * 2, half * 2);
            ctx.strokeRect(grip.x - half, grip.y - half, half * 2, half * 2);
        }
    }

    /**
     * Grips als dirty markieren (extern aufrufbar, z.B. nach Selektionänderung).
     */
    // ════════════════════════════════════════════════════════════════
    // THEME
    // ════════════════════════════════════════════════════════════════

    /**
     * Wechselt die Canvas-Farbpalette.
     * @param {'dark'|'light'|'classic'} theme
     */
    setTheme(theme) {
        const palette = CANVAS_THEMES[theme];
        if (!palette) { console.warn('[CanvasRenderer] Unbekanntes Theme:', theme); return; }
        this.colors = Object.assign({}, palette);
        this._currentTheme = theme;
        console.log('[CanvasRenderer] Theme gewechselt:', theme);

        // V3.12 Fix: ACI 7 Layer-Farben invertieren (AutoCAD-Verhalten)
        // ACI 7 = weiß auf dunklem Hintergrund, schwarz auf hellem Hintergrund
        if (this.app?.layerManager) {
            const lm = this.app.layerManager;
            const isDark = (theme !== 'light');   // dark + classic: dunkler/mittelgrauer Hintergrund
            const aci7Dark = '#ffffff';
            const aci7Light = '#000000';
            const fromColor = isDark ? aci7Light : aci7Dark;
            const toColor   = isDark ? aci7Dark  : aci7Light;
            let changed = 0;
            for (const layer of lm.layers.values()) {
                if (layer.color.toLowerCase() === fromColor.toLowerCase()) {
                    layer.color = toColor;
                    changed++;
                }
            }
            if (changed > 0) {
                console.log(`[CanvasRenderer] ACI 7 invertiert: ${changed} Layer ${fromColor} → ${toColor}`);
                lm._notify();
            }
        }

        this.render();
    }

    invalidateGrips() {
        this._hasSelection = this.contours?.some(c => c.isSelected) || false;
        this._gripDirty = this._hasSelection;
        if (!this._hasSelection) {
            this._grips = [];
            this._hoveredGrip = null;
        }
    }
}
