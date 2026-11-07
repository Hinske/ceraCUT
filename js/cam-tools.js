/**
 * CeraCUT CAM-Tools V1.7 — IGEMS Kap. 6 Geometrie-Vorbereitungstools
 * 7 Tools für Analyse, Optimierung und Vorbereitung der Schnittgeometrie
 *
 * Tools:
 *   Edgefix     (EF)   — Polylinien-Abschnitt durch Arc/Line ersetzen (Glättung)
 *   Replace     (REP)  — Objekte durch Quell-Objekt ersetzen (per Schwerpunkt)
 *   Analyze     (AN)   — Lücken (rot) und Überlappungen (gelb) anzeigen
 *   BoundaryTrim(BT)   — Objekte innerhalb/außerhalb Grenze trimmen/löschen
 *   PolyJoint   (PJ)   — Geschlossene Polylinien verbinden oder aufteilen
 *   Vectorize   (VZ)   — Kurven/Arcs in Liniensegmente umwandeln (Toleranz)
 *   ConvexHull  (HULL) — Konvexes Hüllpolygon um selektierte Objekte
 *
 * Benötigt: geometry-ops.js V2.1, drawing-tools.js V2.2, ceracut-pipeline.js V3.1
 *
 * V1.4: AnalyzeTool — 3 Bugs behoben: finish()-Blockade (leere Selektion), same-contour
 *       Lücken-Blindheit, Marker-State-Leak beim Neustart + Undo-Stack-Müll
 * V1.3: _notifyStateChange() nach jedem undoStack.push() — UI-Buttons aktualisieren sich korrekt
 * V1.2: Renderer-Patch fix (scale/offsetX/offsetY), Edgefix nutzt zentrale Hit-Test-Methode,
 *       Shift-Tracking für BoundaryTrim, Redo-Stack-Clearing nach Undo-Push, alle TOOL_TOOLTIPS
 * V1.1: Hit-Test Scaling — Klick-Threshold skaliert mit Zoom-Level
 * Created: 2026-02-17 MEZ
 * Last Modified: 2026-11-07
 * Build: 20261107-camtab
 * V1.7: Praxis-Check — REP (Flaechenschwerpunkt statt Punktemittel, vorher ~48 mm Versatz), BT (Eckpunkt-/Kantentest statt
 *       Mittelwert; Kreuzende bleiben), PJ (Join: Steg-Flaeche je Drehsinn korrekt; Split: 2 geschlossene Konturen),
 *       VZ (Punktreduktion via Simplify; bulge-Pfad war wirkungslos), AN (BBox-Vorfilter: 97 s -> 32 ms),
 *       EF (A/B-Reihenfolge egal, Pfeilhoehen-Teilung). Tools jetzt im Tab CAM (Analyze-Button hatte keinen Handler).
 * V1.5: Fix — Code-Review 2026-11-04 (tasks/code-review-2026-11-04.md)
 */

// ════════════════════════════════════════════════════════════════════════════
//  HELFER (V1.7)
// ════════════════════════════════════════════════════════════════════════════

/** Vorzeichenbehaftete Flaeche (CCW positiv); Schlusspunkt = Startpunkt wird toleriert. */
function _camSignedArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
}

/** Flaechenschwerpunkt (geschlossen) bzw. Bounding-Box-Mitte (offen/entartet). Der Punktemittelwert
 *  waere bei ungleichmaessiger Punktdichte (Bogen vs. Gerade) um mehrere mm verschoben. */
function _camCentroid(pts) {
    if (!pts || pts.length === 0) return { x: 0, y: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const bbox = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        const f = p.x * q.y - q.x * p.y;
        a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
    }
    if (Math.abs(a) < 1e-9) return bbox;
    return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Punkt-in-Polygon (Strahlverfahren). */
function _camPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y, xj = polygon[j].x, yj = polygon[j].y;
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

/** Konturpunkte ohne doppelten Schlusspunkt. */
function _camOpenRing(pts) {
    const r = pts.map(p => ({ x: p.x, y: p.y }));
    if (r.length > 1 && Math.hypot(r[0].x - r[r.length - 1].x, r[0].y - r[r.length - 1].y) < 1e-9) r.pop();
    return r;
}

// ════════════════════════════════════════════════════════════════════════════
//  EDGEFIX TOOL (EF) — Polylinien-Abschnitt durch Arc/Line ersetzen
//  IGEMS Kap. 6.2: Punkt A, Punkt B auf Kontur, dann Punkt C → neuer Arc
// ════════════════════════════════════════════════════════════════════════════

class EdgefixTool extends BaseTool {
    constructor(manager) {
        super(manager);
        this.state = 'pickContour';  // pickContour → pickA → pickB → pickC
        this.contour = null;
        this.contourIndex = -1;
        this.segA = null;   // { segmentIndex, point }
        this.segB = null;
        console.log('[CAM-Tools V1.2] EdgefixTool erstellt');
    }

    start() {
        console.log('[CAM-Tools V1.2] Edgefix gestartet');
        this.cmd?.setPrompt('EDGEFIX — Kontur anklicken:');
        this.cmd?.log('🔧 Edgefix: Kontur-Abschnitt durch Arc/Line ersetzen', 'info');
    }

    handleClick(point) {
        const _t0 = performance.now();
        const app = this.manager.app;
        const contours = app?.contours;
        if (!contours) return;

        if (this.state === 'pickContour') {
            // Kontur finden (zentrale Methode des DrawingToolManagers)
            const found = this.manager.findContourAtPoint(point);
            if (!found || found.isReference) {
                this.cmd?.log('Keine Kontur gefunden', 'error');
                return;
            }
            this.contour = found;
            this.contourIndex = this.manager.app?.contours?.indexOf(found) ?? -1;
            this.state = 'pickA';
            this.cmd?.setPrompt('EDGEFIX — Startpunkt A auf Kontur anklicken:');
            console.log('[CAM-Tools V1.2] Edgefix: Kontur selektiert, idx=' + found.index);
        }
        else if (this.state === 'pickA') {
            this.segA = this._nearestOnContour(point);
            if (!this.segA) { this.cmd?.log('Punkt nicht auf Kontur', 'error'); return; }
            this.state = 'pickB';
            this.cmd?.setPrompt('EDGEFIX — Endpunkt B auf Kontur anklicken:');
            console.log('[CAM-Tools V1.2] Edgefix: Punkt A bei Segment ' + this.segA.segmentIndex);
        }
        else if (this.state === 'pickB') {
            this.segB = this._nearestOnContour(point);
            if (!this.segB) { this.cmd?.log('Punkt nicht auf Kontur', 'error'); return; }
            // V1.7: Reihenfolge egal — A/B werden entlang der Kontur sortiert
            const sameSeg = this.segB.segmentIndex === this.segA.segmentIndex;
            const pts = this.contour.points;
            const segStart = pts[this.segA.segmentIndex];
            const dA = Math.hypot(this.segA.point.x - segStart.x, this.segA.point.y - segStart.y);
            const dB = Math.hypot(this.segB.point.x - segStart.x, this.segB.point.y - segStart.y);
            if (this.segB.segmentIndex < this.segA.segmentIndex || (sameSeg && dB < dA)) {
                const t = this.segA; this.segA = this.segB; this.segB = t;
            }
            if (sameSeg && Math.abs(dA - dB) < 1e-6) {
                this.cmd?.log('Punkte A und B liegen aufeinander', 'error');
                return;
            }
            this.state = 'pickC';
            this.cmd?.setPrompt('EDGEFIX — Kurvenpunkt C zwischen A und B anklicken:');
            console.log('[CAM-Tools V1.2] Edgefix: Punkt B bei Segment ' + this.segB.segmentIndex);
        }
        else if (this.state === 'pickC') {
            this._executeEdgefix(point);
            // Zurück zum Anfang für nächste Aktion
            this.state = 'pickContour';
            this.contour = null;
            this.cmd?.setPrompt('EDGEFIX — Kontur anklicken (ESC = Ende):');
        }
        console.log('[CAM-Tools] Edgefix.handleClick: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _nearestOnContour(point) {
        const pts = this.contour.points;
        const scale = this.manager?.app?.renderer?.scale || 1;
        const threshold = Math.max(2.0, 5.0 / scale);
        return GeometryOps.findNearestSegment(pts, point.x, point.y, threshold);
    }

    _executeEdgefix(pointC) {
        const _t0 = performance.now();
        const pts = this.contour.points;
        const pA = this.segA.point;
        const pB = this.segB.point;

        // 3-Punkt Arc-Fitting: A, C, B → Kreisbogen berechnen
        const arc = this._fitArc(pA, pointC, pB);

        // Alte Punkte sichern für Undo
        const oldPoints = pts.map(p => ({ x: p.x, y: p.y }));

        // Segment-Bereich A→B durch neuen Arc/Linie ersetzen
        const newPoints = [];
        // Punkte VOR A
        for (let i = 0; i <= this.segA.segmentIndex; i++) {
            newPoints.push({ x: pts[i].x, y: pts[i].y });
        }
        newPoints.push({ x: pA.x, y: pA.y });

        if (arc) {
            // Arc-Punkte einfügen (tesselliert)
            const arcPts = this._tessellateArc(arc.cx, arc.cy, arc.r, arc.startAngle, arc.endAngle, arc.ccw);
            for (const ap of arcPts) {
                newPoints.push({ x: ap.x, y: ap.y });
            }
        }
        // Sonst: gerade Linie (nur pB wird eingefügt)

        newPoints.push({ x: pB.x, y: pB.y });
        // Punkte NACH B
        for (let i = this.segB.segmentIndex + 1; i < pts.length; i++) {
            newPoints.push({ x: pts[i].x, y: pts[i].y });
        }

        // Undo-Command
        const contour = this.contour;
        const undoMgr = this.manager.app?.undoManager;
        if (undoMgr) {
            const cmd = {
                execute() {
                    contour.points = newPoints;
                    ModificationTool.invalidateCache(contour);
                },
                undo() {
                    contour.points = oldPoints;
                    ModificationTool.invalidateCache(contour);
                }
            };
            cmd.execute();
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
            this.cmd?.log('✅ Edgefix: Abschnitt ersetzt (' + (arc ? 'Arc' : 'Linie') + ')', 'info');
        }
        this.manager.renderer?.render();
        console.log('[CAM-Tools] Edgefix._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _fitArc(pA, pC, pB) {
        // 3-Punkt Kreisberechnung (Umkreis des Dreiecks A-C-B)
        const ax = pA.x, ay = pA.y;
        const bx = pC.x, by = pC.y;
        const cx = pB.x, cy = pB.y;

        const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(D) < 1e-8) return null; // Kollinear → Linie statt Arc

        const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
        const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
        const r = Math.hypot(ax - ux, ay - uy);

        // Maximalen Radius begrenzen (wenn fast gerade → Linie)
        if (r > 50000) return null;

        const startAngle = Math.atan2(ay - uy, ax - ux);
        const endAngle = Math.atan2(cy - uy, cx - ux);

        // CCW-Richtung bestimmen über Kreuzprodukt
        const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        const ccw = cross > 0;

        return { cx: ux, cy: uy, r, startAngle, endAngle, ccw };
    }

    _tessellateArc(cx, cy, r, sa, ea, ccw) {
        const pts = [];
        let sweep = ea - sa;
        if (ccw && sweep < 0) sweep += 2 * Math.PI;
        if (!ccw && sweep > 0) sweep -= 2 * Math.PI;

        // V1.7: Teilung nach Pfeilhoehe (0.02 mm) statt fester 2-mm-Sehne (bei kleinem Radius zu grob)
        const stepAng = 2 * Math.acos(Math.max(0, Math.min(1, 1 - 0.02 / r)));
        const steps = Math.max(8, Math.ceil(Math.abs(sweep) / Math.max(stepAng, 1e-3)));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const angle = sa + sweep * t;
            pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
        }
        return pts;
    }
}


// ════════════════════════════════════════════════════════════════════════════
//  REPLACE TOOL (REP) — Objekte durch Quell-Objekt ersetzen
//  IGEMS Kap. 6.3: Source wählen, Targets wählen → Targets = Kopie(Source)
// ════════════════════════════════════════════════════════════════════════════

class ReplaceTool extends ModificationTool {
    constructor(manager) {
        super(manager);
        this.state = 'pickSource';
        this.sourceContour = null;
        this.targetContours = [];
        console.log('[CAM-Tools V1.2] ReplaceTool erstellt');
    }

    getToolName() { return 'REPLACE'; }

    start() {
        console.log('[CAM-Tools V1.2] Replace gestartet');
        this.state = 'pickSource';
        this.cmd?.setPrompt('REPLACE — Quell-Objekt (A) anklicken:');
        this.cmd?.log('🔄 Replace: Objekte durch Quell-Objekt ersetzen', 'info');
    }

    handleClick(point) {
        const _t0 = performance.now();
        const contours = this.manager.app?.contours;
        if (!contours) return;

        if (this.state === 'pickSource') {
            const found = this.manager.findContourAtPoint(point);
            if (!found || found.isReference) {
                this.cmd?.log('Kein gültiges Quell-Objekt', 'error');
                return;
            }
            this.sourceContour = found;
            this.state = 'pickTargets';
            this.cmd?.setPrompt('REPLACE — Ziel-Objekte (B,C,...) anklicken, Enter = ausführen:');
            console.log('[CAM-Tools V1.2] Replace: Quell-Objekt gewählt');
        }
        else if (this.state === 'pickTargets') {
            const found = this.manager.findContourAtPoint(point);
            if (!found || found.isReference || found === this.sourceContour) {
                this.cmd?.log('Ungültiges Ziel (gleich wie Quelle oder Referenz)', 'error');
                return;
            }
            if (this.targetContours.indexOf(found) === -1) {
                this.targetContours.push(found);
                found.isSelected = true;
                this.manager.renderer?.render();
                this.cmd?.setPrompt('REPLACE — ' + this.targetContours.length + ' Ziel(e) gewählt (Klick=+, Enter=ausführen):');
                console.log('[CAM-Tools V1.2] Replace: +1 Ziel, gesamt=' + this.targetContours.length);
            }
        }
        console.log('[CAM-Tools] Replace.handleClick: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    finish() {
        if (this.state === 'pickTargets' && this.targetContours.length > 0) {
            this._executeReplace();
        } else if (this.state === 'pickSource') {
            this.cmd?.log('Kein Quell-Objekt gewählt', 'error');
        } else {
            this.cmd?.log('Keine Ziel-Objekte gewählt', 'error');
        }
    }

    _executeReplace() {
        const _t0 = performance.now();
        const app = this.manager.app;
        const contours = app?.contours;
        const undoMgr = app?.undoManager;
        if (!contours || !undoMgr) return;

        const source = this.sourceContour;
        const sourceCentroid = this._centroid(source.points);
        const sourcePointsCopy = source.points.map(p => ({ x: p.x, y: p.y }));

        // Für jedes Target: Schwerpunkt berechnen, Verschiebungsvektor, Punkte kopieren
        const replacements = [];
        for (const target of this.targetContours) {
            const targetCentroid = this._centroid(target.points);
            const dx = targetCentroid.x - sourceCentroid.x;
            const dy = targetCentroid.y - sourceCentroid.y;
            const newPoints = sourcePointsCopy.map(p => ({ x: p.x + dx, y: p.y + dy }));
            replacements.push({
                contour: target,
                oldPoints: target.points.map(p => ({ x: p.x, y: p.y })),
                oldIsClosed: target.isClosed,
                newPoints: newPoints,
                newIsClosed: source.isClosed
            });
        }

        const cmd = {
            execute() {
                for (const r of replacements) {
                    r.contour.points = r.newPoints.map(p => ({ x: p.x, y: p.y }));
                    r.contour.isClosed = r.newIsClosed;
                    ModificationTool.invalidateCache(r.contour);
                }
            },
            undo() {
                for (const r of replacements) {
                    r.contour.points = r.oldPoints.map(p => ({ x: p.x, y: p.y }));
                    r.contour.isClosed = r.oldIsClosed;
                    ModificationTool.invalidateCache(r.contour);
                }
            }
        };
        cmd.execute();
        undoMgr.pushExecuted(cmd);
        undoMgr.redoStack.length = 0;
        undoMgr._notifyStateChange();

        // Selektion aufheben
        for (const t of this.targetContours) t.isSelected = false;
        this.manager.renderer?.render();
        this.cmd?.log('✅ Replace: ' + replacements.length + ' Objekt(e) ersetzt', 'info');

        // Reset
        this.state = 'pickSource';
        this.sourceContour = null;
        this.targetContours = [];
        this.cmd?.setPrompt('REPLACE — Quell-Objekt (A) anklicken (ESC = Ende):');
        console.log('[CAM-Tools] Replace._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _centroid(points) { return _camCentroid(points); }
}


// ════════════════════════════════════════════════════════════════════════════
//  ANALYZE TOOL (AN) — Lücken und Überlappungen visualisieren
//  IGEMS Kap. 6.4: Rote Kreise = Lücken, Gelbe Kreise = Überlappungen
// ════════════════════════════════════════════════════════════════════════════

class AnalyzeTool extends ModificationTool {
    constructor(manager) {
        super(manager);
        console.log('[CAM-Tools V1.2] AnalyzeTool erstellt');
    }

    getToolName() { return 'ANALYZE'; }

    start() {
        console.log('[CAM-Tools V1.4] Analyze gestartet');
        // Alte Marker sofort löschen, damit kein State-Leak beim Neustart bleibt
        const renderer = this.manager.renderer;
        if (renderer && renderer._analyzeMarkers) {
            renderer._analyzeMarkers = null;
            renderer.render();
        }
        // Prüfe ob Konturen selektiert sind (Noun-Verb)
        const preSelected = this.manager.getSelectedContours();
        if (preSelected.length > 0) {
            this.selectedContours = [...preSelected];
            this._executeAnalyze();
        } else {
            this.state = 'select';
            this.cmd?.setPrompt('ANALYZE — Objekte wählen, Enter = alle analysieren:');
            this.cmd?.log('🔍 Analyze: Lücken und Überlappungen anzeigen', 'info');
        }
    }

    // Bug #1: finish() überschreiben — leere Selektion → alle Konturen analysieren
    finish() {
        if (this.state === 'select') {
            const selected = this.manager.getSelectedContours();
            this.selectedContours = [...selected]; // ggf. leer → _executeAnalyze nimmt alle
            this._executeAnalyze();
        }
    }

    _onSelectionComplete(contours) {
        this._executeAnalyze();
    }

    _executeAnalyze() {
        const _t0 = performance.now();
        const contours = this.selectedContours.length > 0 ? this.selectedContours : this.manager.app?.contours;
        if (!contours || contours.length === 0) {
            this.cmd?.log('Keine Objekte zum Analysieren', 'error');
            return;
        }

        const tolerance = 0.1; // Chaining-Toleranz
        const overlapTolerance = 0.05;
        const gaps = [];
        const overlaps = [];

        // Alle Endpunkte sammeln und paarweise prüfen
        const endpoints = [];
        for (const c of contours) {
            if (c.isReference || !c.points || c.points.length < 2) continue;
            const pts = c.points;
            if (!c.isClosed) {
                endpoints.push({ point: pts[0], contour: c, type: 'start' });
                endpoints.push({ point: pts[pts.length - 1], contour: c, type: 'end' });
            }
            // Geschlossene Konturen: Prüfe ob Start/Ende zusammenpassen
            if (c.isClosed && pts.length >= 2) {
                const d = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
                if (d > tolerance && d < 2.0) {
                    gaps.push({
                        x: (pts[0].x + pts[pts.length - 1].x) / 2,
                        y: (pts[0].y + pts[pts.length - 1].y) / 2,
                        distance: d,
                        type: 'gap'
                    });
                }
            }
        }

        // Paarweise Endpunkt-Vergleich
        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                const sameContour = endpoints[i].contour === endpoints[j].contour;
                // Bug #2 fix: Bei gleicher Kontur nur Start↔End prüfen (Lücke an eigener Öffnung).
                // Gleichartige Punkte (start↔start, end↔end) können nicht vorkommen (je 1 pro Kontur).
                // Überlappung (d ≤ overlapTolerance) an eigenen Endpunkten ignorieren.
                if (sameContour && endpoints[i].type === endpoints[j].type) continue;
                const d = Math.hypot(
                    endpoints[i].point.x - endpoints[j].point.x,
                    endpoints[i].point.y - endpoints[j].point.y
                );
                if (d > overlapTolerance && d <= tolerance * 10) {
                    // Lücke erkannt
                    gaps.push({
                        x: (endpoints[i].point.x + endpoints[j].point.x) / 2,
                        y: (endpoints[i].point.y + endpoints[j].point.y) / 2,
                        distance: d,
                        type: 'gap'
                    });
                } else if (d <= overlapTolerance && !sameContour) {
                    // Nahezu identische Endpunkte verschiedener Konturen — Überlappung
                    overlaps.push({
                        x: endpoints[i].point.x,
                        y: endpoints[i].point.y,
                        distance: d,
                        type: 'overlap'
                    });
                }
            }
        }

        // Segment-Überlappungen prüfen (parallele, überlagerte Segmente)
        // V1.7: Bounding-Box-Vorfilter — vorher 97 s bei 400 Konturen, jetzt nur Paare mit sich berührenden Boxen
        const boxes = contours.map(c => {
            if (!c || c.isReference || !c.points || c.points.length < 2) return null;
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const p of c.points) {
                if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
                if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
            }
            return { x0: x0 - overlapTolerance, y0: y0 - overlapTolerance, x1: x1 + overlapTolerance, y1: y1 + overlapTolerance };
        });
        for (let i = 0; i < contours.length; i++) {
            const bi = boxes[i];
            if (!bi) continue;
            for (let j = i + 1; j < contours.length; j++) {
                const bj = boxes[j];
                if (!bj) continue;
                if (bi.x1 < bj.x0 || bj.x1 < bi.x0 || bi.y1 < bj.y0 || bj.y1 < bi.y0) continue;
                const ptsA = contours[i].points;
                const ptsB = contours[j].points;

                // Stichproben-Check: Mittelpunkte einiger Segmente von A auf B prüfen
                const sampleStep = Math.max(1, Math.floor(ptsA.length / 10));
                for (let s = 0; s < ptsA.length - 1; s += sampleStep) {
                    const mx = (ptsA[s].x + ptsA[s + 1].x) / 2;
                    const my = (ptsA[s].y + ptsA[s + 1].y) / 2;
                    if (mx < bj.x0 || mx > bj.x1 || my < bj.y0 || my > bj.y1) continue;
                    const nearest = GeometryOps.findNearestSegment(ptsB, mx, my, overlapTolerance);
                    if (nearest && nearest.distance < overlapTolerance) {
                        overlaps.push({ x: mx, y: my, distance: nearest.distance, type: 'overlap' });
                    }
                }
            }
        }

        // Ergebnis als Analyse-Markierungen speichern (im Renderer)
        const markers = [];
        for (const g of gaps) {
            markers.push({ x: g.x, y: g.y, radius: Math.max(1.5, g.distance * 3), color: '#FF0000', type: 'gap' });
        }
        for (const o of overlaps) {
            markers.push({ x: o.x, y: o.y, radius: 2.0, color: '#FFFF00', type: 'overlap' });
        }

        // Deduplizieren (nur einzigartige Positionen, Radius 1mm)
        const unique = [];
        for (const m of markers) {
            const dup = unique.find(u => Math.hypot(u.x - m.x, u.y - m.y) < 1.0 && u.type === m.type);
            if (!dup) unique.push(m);
        }

        // Im Renderer als temporäre Overlays speichern
        const renderer = this.manager.renderer;
        if (renderer) {
            renderer._analyzeMarkers = unique;
            renderer.render();
        }

        // Undo: Markierungen hinzufügen/entfernen.
        // Bug #3 fix: Vorherigen Analyze-Eintrag ersetzen statt aufstapeln.
        const undoMgr = this.manager.app?.undoManager;
        if (undoMgr) {
            const cmd = {
                _isAnalyzeCmd: true,
                execute() { if (renderer) { renderer._analyzeMarkers = unique; renderer.render(); } },
                undo() { if (renderer) { renderer._analyzeMarkers = null; renderer.render(); } }
            };
            // Vorherigen Analyze-Cmd vom Stack-Top entfernen (kein doppelter Eintrag)
            if (undoMgr.undoStack.length > 0 &&
                undoMgr.undoStack[undoMgr.undoStack.length - 1]._isAnalyzeCmd) {
                undoMgr.undoStack.pop();
            }
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
        }

        const gapCount = unique.filter(m => m.type === 'gap').length;
        const overlapCount = unique.filter(m => m.type === 'overlap').length;
        this.cmd?.log('✅ Analyze: ' + gapCount + ' Lücke(n) 🔴, ' + overlapCount + ' Überlappung(en) 🟡', 'info');
        if (gapCount === 0 && overlapCount === 0) {
            this.cmd?.log('✅ Geometrie ist sauber — keine Probleme gefunden', 'info');
        }

        this.cancel();
        console.log('[CAM-Tools] Analyze._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }
}


// ════════════════════════════════════════════════════════════════════════════
//  BOUNDARY TRIM TOOL (BT) — Objekte innerhalb/außerhalb Grenze löschen
//  IGEMS Kap. 6.6: Klick auf Begrenzung → alles innerhalb löschen
//  SHIFT = invertiert (alles außerhalb löschen)
// ════════════════════════════════════════════════════════════════════════════

class BoundaryTrimTool extends BaseTool {
    constructor(manager) {
        super(manager);
        this.state = 'pickBoundary';
        this.boundaryContour = null;
        console.log('[CAM-Tools V1.2] BoundaryTrimTool erstellt');
    }

    start() {
        console.log('[CAM-Tools V1.2] BoundaryTrim gestartet');
        this.cmd?.setPrompt('BOUNDARY TRIM — Geschlossene Begrenzung anklicken (SHIFT = invertiert):');
        this.cmd?.log('✂️ Boundary Trim: Objekte innerhalb/außerhalb einer Grenze löschen', 'info');
    }

    handleClick(point) {
        const _t0 = performance.now();
        const app = this.manager.app;
        const contours = app?.contours;
        if (!contours) return;

        if (this.state === 'pickBoundary') {
            // Begrenzungskontur finden
            const found = this.manager.findContourAtPoint(point);
            if (!found || !found.isClosed) {
                this.cmd?.log('Bitte eine geschlossene Kontur als Begrenzung wählen', 'error');
                return;
            }
            this.boundaryContour = found;

            // Shift-Status aus letztem Event (wird von ToolManager/Renderer gesetzt)
            const shiftHeld = this.manager._lastShift || false;
            this._executeBoundaryTrim(shiftHeld);

            // Reset für nächste Aktion
            this.boundaryContour = null;
            this.cmd?.setPrompt('BOUNDARY TRIM — Begrenzung anklicken (ESC = Ende):');
        }
        console.log('[CAM-Tools] BoundaryTrim.handleClick: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _executeBoundaryTrim(invertMode) {
        const _t0 = performance.now();
        const app = this.manager.app;
        const contours = app.contours;
        const boundary = this.boundaryContour;
        const boundaryPts = boundary.points;

        // Alle Konturen prüfen die nicht die Boundary sind
        const toDelete = [];
        let straddling = 0;

        for (let i = 0; i < contours.length; i++) {
            const c = contours[i];
            if (c === boundary || c.isReference) continue;
            if (!c.points || c.points.length < 2) continue;

            // V1.7: Alle Eckpunkte pruefen (Schwerpunkt-Mittelwert lag bei umschliessenden/konkaven Konturen daneben).
            // Punkte auf der Grenze (<= 0.05 mm) zaehlen neutral. Nur komplett innen bzw. komplett aussen
            // wird geloescht; Konturen, die die Grenze kreuzen, bleiben stehen und werden gemeldet.
            let nIn = 0, nOut = 0;
            for (const p of c.points) {
                const near = GeometryOps.findNearestSegment(boundaryPts, p.x, p.y, 0.05);
                if (near) continue;
                if (this._pointInPolygon(p, boundaryPts)) nIn++; else nOut++;
            }
            if (nIn > 0 && nOut > 0) { straddling++; continue; }
            // Alle Eckpunkte auf einer Seite, aber Kanten koennen die Grenze trotzdem kreuzen (z.B. langer Streifen)
            if (nIn + nOut > 0 && this._edgesCross(c.points, boundaryPts)) { straddling++; continue; }
            if (nIn === 0 && nOut === 0) continue;   // liegt auf der Grenze
            const inside = nIn > 0;

            // invertMode: SHIFT = alles AUSSERHALB löschen
            const shouldDelete = invertMode ? !inside : inside;

            if (shouldDelete) {
                toDelete.push({ contour: c, index: i });
            }
        }

        if (straddling > 0) {
            this.cmd?.log('⚠ ' + straddling + ' Kontur(en) kreuzen die Grenze und bleiben unverändert', 'warning');
        }
        if (toDelete.length === 0) {
            this.cmd?.log('Keine Objekte zum Löschen gefunden', 'info');
            console.log('[CAM-Tools] BoundaryTrim._execute: 0ms (nichts zu tun)');
            return;
        }

        // Undo-Command: Konturen löschen (mit Position-Restore)
        const undoMgr = app.undoManager;
        if (undoMgr) {
            const deleted = toDelete.map(d => ({
                contour: d.contour,
                index: contours.indexOf(d.contour)
            }));
            // Rückwärts sortieren für korrektes Splicing
            deleted.sort((a, b) => b.index - a.index);

            const cmd = {
                execute() {
                    for (const d of deleted) {
                        const idx = contours.indexOf(d.contour);
                        if (idx !== -1) contours.splice(idx, 1);
                    }
                },
                undo() {
                    for (let i = deleted.length - 1; i >= 0; i--) {
                        contours.splice(deleted[i].index, 0, deleted[i].contour);
                    }
                }
            };
            cmd.execute();
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
        }

        this.manager.renderer?.render();
        app.updateContourPanel?.();
        const mode = invertMode ? 'außerhalb' : 'innerhalb';
        this.cmd?.log('✅ Boundary Trim: ' + toDelete.length + ' Objekt(e) ' + mode + ' gelöscht', 'info');
        console.log('[CAM-Tools] BoundaryTrim._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _centroid(points) { return _camCentroid(points); }

    _pointInPolygon(point, polygon) { return _camPointInPolygon(point.x, point.y, polygon); }

    /** Schneidet irgendeine Kante von a eine Kante von b? (echte Kreuzung) */
    _edgesCross(a, b) {
        const orient = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (const p of b) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y); }
        for (let i = 0; i < a.length - 1; i++) {
            const p = a[i], q = a[i + 1];
            if (Math.max(p.x, q.x) < bx0 || Math.min(p.x, q.x) > bx1 || Math.max(p.y, q.y) < by0 || Math.min(p.y, q.y) > by1) continue;
            for (let j = 0; j < b.length - 1; j++) {
                const r = b[j], t = b[j + 1];
                if (orient(p, q, r) * orient(p, q, t) < 0 && orient(r, t, p) * orient(r, t, q) < 0) return true;
            }
        }
        return false;
    }
}


// ════════════════════════════════════════════════════════════════════════════
//  POLY JOINT TOOL (PJ) — Geschlossene Polylinien verbinden oder aufteilen
//  IGEMS Kap. 6.8: Breite → A→B: Außen→Außen = Split, Innen→Innen = Join
// ════════════════════════════════════════════════════════════════════════════

class PolyJointTool extends BaseTool {
    constructor(manager) {
        super(manager);
        this.state = 'width';  // width → pickA → pickB
        this.width = 1.0;
        this.pointA = null;
        console.log('[CAM-Tools V1.2] PolyJointTool erstellt');
    }

    start() {
        console.log('[CAM-Tools V1.2] PolyJoint gestartet');
        this.cmd?.setPrompt('POLY JOINT — Brückenbreite <' + this.width + '>:');
        this.cmd?.log('🔗 Poly Joint: Geschlossene Polylinien verbinden oder aufteilen', 'info');
    }

    handleRawInput(value) {
        if (this.state === 'width') {
            const num = parseFloat(value.trim());
            if (!isNaN(num) && num > 0) {
                this.width = num;
            }
            this.state = 'pickA';
            this.cmd?.setPrompt('POLY JOINT W=' + this.width.toFixed(2) + ' — Punkt A anklicken:');
            return true;
        }
        return false;
    }

    finish() {
        if (this.state === 'width') {
            this.state = 'pickA';
            this.cmd?.setPrompt('POLY JOINT W=' + this.width.toFixed(2) + ' — Punkt A anklicken:');
        }
    }

    handleClick(point) {
        const _t0 = performance.now();
        if (this.state === 'width') {
            this.state = 'pickA';
            this.cmd?.setPrompt('POLY JOINT W=' + this.width.toFixed(2) + ' — Punkt A anklicken:');
        }

        if (this.state === 'pickA') {
            this.pointA = { x: point.x, y: point.y };
            this.state = 'pickB';
            this.cmd?.setPrompt('POLY JOINT — Punkt B anklicken:');
            console.log('[CAM-Tools V1.2] PolyJoint: Punkt A gesetzt');
        }
        else if (this.state === 'pickB') {
            this._executePolyJoint(point);
            // Reset
            this.state = 'pickA';
            this.pointA = null;
            this.cmd?.setPrompt('POLY JOINT W=' + this.width.toFixed(2) + ' — Punkt A anklicken (ESC = Ende):');
        }
        console.log('[CAM-Tools] PolyJoint.handleClick: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    handleMouseMove(point) {
        if (this.state === 'pickB' && this.pointA) {
            this.manager.rubberBand = {
                type: 'line',
                data: { start: this.pointA, end: point }
            };
            this.manager.renderer?.render();
        }
    }

    _executePolyJoint(pointB) {
        const _t0 = performance.now();
        const app = this.manager.app;
        const contours = app?.contours;
        if (!contours) return;

        // Finde Konturen an Punkt A und B
        const contourA = this.manager.findContourAtPoint(this.pointA);
        const contourB = this.manager.findContourAtPoint(pointB);

        if (!contourA || !contourA.isClosed) {
            this.cmd?.log('Punkt A muss auf geschlossener Kontur liegen', 'error');
            return;
        }

        if (contourA === contourB || !contourB) {
            // SPLIT: Beide Punkte auf gleicher Kontur oder B nicht auf Kontur
            this._splitContour(contourA, this.pointA, pointB);
        } else if (contourB && contourB.isClosed) {
            // JOIN: Zwei verschiedene geschlossene Konturen
            this._joinContours(contourA, contourB, this.pointA, pointB);
        } else {
            this.cmd?.log('Punkt B muss auf geschlossener Kontur liegen', 'error');
        }
        console.log('[CAM-Tools] PolyJoint._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _splitContour(contour, pA, pB) {
        const pts = contour.points;
        const nearA = GeometryOps.findNearestSegment(pts, pA.x, pA.y, Infinity);
        const nearB = GeometryOps.findNearestSegment(pts, pB.x, pB.y, Infinity);
        if (!nearA || !nearB) return;
        if (nearA.segmentIndex === nearB.segmentIndex) {
            this.cmd?.log('Punkte A und B liegen auf demselben Segment — Trennschnitt nicht möglich', 'error');
            return;
        }

        // V1.7: Ergebnis sind ZWEI GESCHLOSSENE Konturen (Sehne A-B als gemeinsame Trennkante).
        // Vorher: zwei offene Teilstuecke, nur das zweite als Slit markiert — nicht schneidbar als Teile.
        const first = nearA.segmentIndex < nearB.segmentIndex ? nearA : nearB;
        const second = first === nearA ? nearB : nearA;
        const ring = pts;                       // Schlusspunkt = Startpunkt vorausgesetzt
        const f = { x: first.point.x, y: first.point.y }, g = { x: second.point.x, y: second.point.y };

        const part1 = [f];
        for (let i = first.segmentIndex + 1; i <= second.segmentIndex; i++) part1.push({ x: ring[i].x, y: ring[i].y });
        part1.push({ x: g.x, y: g.y }, { x: f.x, y: f.y });

        const part2 = [{ x: g.x, y: g.y }];
        for (let i = second.segmentIndex + 1; i < ring.length; i++) part2.push({ x: ring[i].x, y: ring[i].y });
        for (let i = 1; i <= first.segmentIndex; i++) part2.push({ x: ring[i].x, y: ring[i].y });
        part2.push({ x: f.x, y: f.y }, { x: g.x, y: g.y });

        const oldPoints = pts.map(p => ({ x: p.x, y: p.y }));
        const undoMgr = this.manager.app?.undoManager;
        const appRef = this.manager.app;
        if (undoMgr && appRef) {
            const contourRef = contour;
            const idxOld = appRef.contours.indexOf(contourRef);
            // Zweite Kontur erbt Typ/Layer/Leads der Originalkontur
            let newContour;
            if (typeof contourRef.clone === 'function') {
                newContour = contourRef.clone();
                newContour.points = part2;
            } else {
                newContour = new CamContour(part2, { isClosed: true });
                newContour.cuttingMode = contourRef.cuttingMode;
            }
            newContour.isClosed = true;
            newContour.isSelected = false;
            ModificationTool.invalidateCache(newContour);
            const cmd = {
                execute() {
                    contourRef.points = part1;
                    contourRef.isClosed = true;
                    ModificationTool.invalidateCache(contourRef);
                    appRef.contours.splice(idxOld + 1, 0, newContour);
                },
                undo() {
                    contourRef.points = oldPoints;
                    ModificationTool.invalidateCache(contourRef);
                    const idx = appRef.contours.indexOf(newContour);
                    if (idx !== -1) appRef.contours.splice(idx, 1);
                }
            };
            cmd.execute();
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
        }

        this.manager.renderer?.render();
        appRef?.updateContourPanel?.();
        this.cmd?.log('✅ Poly Joint: Kontur in 2 geschlossene Konturen geteilt (Split)', 'info');
    }

    _joinContours(contourA, contourB, pA, pB) {
        // V1.7: Beide Ringe gleich orientieren und die Bruecke so fuehren, dass der Steg wirklich
        // zwischen den Ringen steht (Flaeche = A + B + Steg). Vorher: je nach Drehsinn Steg-Flaeche
        // negativ (Kanal von der eigenen Kontur wieder zugeschnitten) — fehlerhafter Schnitt.
        let ringA = _camOpenRing(contourA.points);
        let ringB = _camOpenRing(contourB.points);
        if (ringA.length < 3 || ringB.length < 3) return;
        const sA = _camSignedArea(ringA) >= 0 ? 1 : -1;
        if ((_camSignedArea(ringB) >= 0 ? 1 : -1) !== sA) ringB.reverse();
        const closedA = ringA.concat([{ ...ringA[0] }]);
        const closedB = ringB.concat([{ ...ringB[0] }]);

        const nearA = GeometryOps.findNearestSegment(closedA, pA.x, pA.y, Infinity);
        const nearB = GeometryOps.findNearestSegment(closedB, pB.x, pB.y, Infinity);
        if (!nearA || !nearB) return;

        const bdx = nearB.point.x - nearA.point.x, bdy = nearB.point.y - nearA.point.y;
        const bLen = Math.hypot(bdx, bdy);
        if (bLen < 1e-9) { this.cmd?.log('Punkte A und B liegen aufeinander', 'error'); return; }
        const hw = this.width / 2;
        // k = -sA: bei CCW-Ringen laeuft die Bruecke hin ueber die "hintere", zurueck ueber die "vordere" Seite
        const k = -sA;
        const ox = k * (-bdy / bLen) * hw, oy = k * (bdx / bLen) * hw;

        const newPoints = [];
        // A: ab Segmentende rund herum bis zum Segmentanfang des Bruecken-Segments
        for (let i = nearA.segmentIndex + 1; i < ringA.length; i++) newPoints.push({ x: ringA[i].x, y: ringA[i].y });
        for (let i = 0; i <= nearA.segmentIndex; i++) newPoints.push({ x: ringA[i].x, y: ringA[i].y });
        // Bruecke hin (A -> B)
        newPoints.push({ x: nearA.point.x + ox, y: nearA.point.y + oy });
        newPoints.push({ x: nearB.point.x + ox, y: nearB.point.y + oy });
        // B komplett umfahren
        for (let i = nearB.segmentIndex + 1; i < ringB.length; i++) newPoints.push({ x: ringB[i].x, y: ringB[i].y });
        for (let i = 0; i <= nearB.segmentIndex; i++) newPoints.push({ x: ringB[i].x, y: ringB[i].y });
        // Bruecke zurueck (B -> A)
        newPoints.push({ x: nearB.point.x - ox, y: nearB.point.y - oy });
        newPoints.push({ x: nearA.point.x - ox, y: nearA.point.y - oy });
        // Schliessen
        newPoints.push({ x: newPoints[0].x, y: newPoints[0].y });

        const oldPointsA = contourA.points.map(p => ({ x: p.x, y: p.y }));
        const oldClosedA = contourA.isClosed;
        const appRef = this.manager.app;
        const undoMgr = appRef?.undoManager;

        if (undoMgr) {
            const cA = contourA;
            const cB = contourB;
            const oldPointsB = contourB.points.map(p => ({ x: p.x, y: p.y }));
            const oldClosedB = contourB.isClosed;
            const idxB = appRef.contours.indexOf(contourB);

            const cmd = {
                execute() {
                    cA.points = newPoints.map(p => ({ x: p.x, y: p.y }));
                    cA.isClosed = true;
                    ModificationTool.invalidateCache(cA);
                    const idx = appRef.contours.indexOf(cB);
                    if (idx !== -1) appRef.contours.splice(idx, 1);
                },
                undo() {
                    cA.points = oldPointsA;
                    cA.isClosed = oldClosedA;
                    ModificationTool.invalidateCache(cA);
                    cB.points = oldPointsB;
                    cB.isClosed = oldClosedB;
                    ModificationTool.invalidateCache(cB);
                    if (appRef.contours.indexOf(cB) === -1) appRef.contours.splice(idxB, 0, cB);
                }
            };
            cmd.execute();
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
        }

        this.manager.renderer?.render();
        appRef?.updateContourPanel?.();
        this.cmd?.log('✅ Poly Joint: 2 Konturen verbunden (Join, Steg ' + this.width + ' mm)', 'info');
    }
}


// ════════════════════════════════════════════════════════════════════════════
//  VECTORIZE TOOL (VZ) — Kurven/Arcs in Liniensegmente umwandeln
//  IGEMS Kap. 6.9: Gegenteil von Curvefit — Toleranz bestimmt Genauigkeit
// ════════════════════════════════════════════════════════════════════════════

class VectorizeTool extends ModificationTool {
    constructor(manager) {
        super(manager);
        this.tolerance = 0.1;  // mm
        this.state = 'tolerance';
        console.log('[CAM-Tools V1.2] VectorizeTool erstellt');
    }

    getToolName() { return 'VECTORIZE'; }

    start() {
        console.log('[CAM-Tools V1.2] Vectorize gestartet');
        this.state = 'tolerance';
        this.cmd?.setPrompt('VECTORIZE — Toleranz <' + this.tolerance + ' mm>:');
        this.cmd?.log('📐 Vectorize: Kurven in Liniensegmente umwandeln', 'info');
    }

    handleRawInput(value) {
        if (this.state === 'tolerance') {
            const num = parseFloat(value.trim());
            if (!isNaN(num) && num > 0) {
                this.tolerance = num;
            }
            this.state = 'select';
            this.cmd?.setPrompt('VECTORIZE T=' + this.tolerance + 'mm — Objekte wählen, Enter = umwandeln:');
            return true;
        }
        return false;
    }

    finish() {
        if (this.state === 'tolerance') {
            this.state = 'select';
            this.cmd?.setPrompt('VECTORIZE T=' + this.tolerance + 'mm — Objekte wählen, Enter = umwandeln:');
            return;
        }
        // Selektion abschließen
        if (this.state === 'select') {
            const selected = this.manager.getSelectedContours();
            if (selected.length === 0) {
                this.cmd?.log('Keine Objekte ausgewählt', 'error');
                return;
            }
            this.selectedContours = [...selected];
            this._executeVectorize();
        }
    }

    handleClick(point) {
        if (this.state === 'tolerance') {
            this.state = 'select';
            this.cmd?.setPrompt('VECTORIZE T=' + this.tolerance + 'mm — Objekte wählen, Enter = umwandeln:');
        }
        if (this.state === 'select') {
            // Kontur selektieren/deselektieren
            const contour = this.manager.findContourAtPoint(point);
            if (contour && !contour.isReference) {
                contour.isSelected = !contour.isSelected;
                this.manager.renderer?.render();
                const count = this.manager.getSelectedContours().length;
                this.cmd?.setPrompt('VECTORIZE — ' + count + ' Objekt(e) (Enter = umwandeln):');
            }
        }
    }

    _executeVectorize() {
        const _t0 = performance.now();
        const contours = this.selectedContours;
        const tol = this.tolerance;
        let totalBefore = 0;
        let totalAfter = 0;

        const undoData = [];

        // V1.7: Der DXF-Parser liefert Boegen/Splines bereits als Polylinie (kein bulge mehr) — die
        // alte bulge-Tessellierung war damit wirkungslos (73 -> 73 Punkte). Jetzt: Punktreduktion
        // mit Toleranz ueber Simplify (Ecken/Startpunkt bleiben, kein Selbstschnitt, Nachbarschutz).
        const res = (typeof Simplify !== 'undefined' && Simplify.simplifyContours)
            ? Simplify.simplifyContours(contours.filter(c => c && c.points && c.points.length >= 2), tol) : null;
        for (const c of contours) {
            if (!c.points || c.points.length < 2) continue;
            const oldPoints = c.points.map(p => ({ x: p.x, y: p.y, bulge: p.bulge }));
            totalBefore += oldPoints.length;
            let newPoints = null;
            const hit = res && res.map.get(c);
            if (hit) {
                newPoints = hit.pts.map(p => ({ x: p.x, y: p.y }));
            } else if (!res) {
                // Fallback ohne Simplify: vorhandene bulge-Segmente tessellieren
                newPoints = [];
                for (let i = 0; i < c.points.length; i++) {
                    const p = c.points[i];
                    newPoints.push({ x: p.x, y: p.y });
                    if (p.bulge && i < c.points.length - 1) {
                        for (const ap of this._tessellateArcFromBulge(p, c.points[i + 1], p.bulge, tol)) newPoints.push({ x: ap.x, y: ap.y });
                    }
                }
            }
            if (!newPoints || newPoints.length === oldPoints.length) { totalAfter += oldPoints.length; continue; }
            totalAfter += newPoints.length;
            undoData.push({ contour: c, oldPoints, newPoints });
        }
        if (undoData.length === 0) {
            this.cmd?.log('Vectorize: nichts zu vereinfachen bei Toleranz ' + tol + ' mm (Kreise/Bögen, Ecken und Startpunkte bleiben unverändert)', 'info');
            for (const c of contours) c.isSelected = false;
            this.cancel();
            return;
        }

        // Undo-Command
        const undoMgr = this.manager.app?.undoManager;
        if (undoMgr) {
            const cmd = {
                execute() {
                    for (const d of undoData) {
                        d.contour.points = d.newPoints.map(p => ({ x: p.x, y: p.y }));
                        ModificationTool.invalidateCache(d.contour);
                    }
                },
                undo() {
                    for (const d of undoData) {
                        d.contour.points = d.oldPoints.map(p => ({ x: p.x, y: p.y, bulge: p.bulge }));
                        ModificationTool.invalidateCache(d.contour);
                    }
                }
            };
            cmd.execute();
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
        }

        // Selektion aufheben
        for (const c of contours) c.isSelected = false;
        this.manager.renderer?.render();
        this.manager.app?.updateContourPanel?.();
        this.cmd?.log('✅ Vectorize: ' + contours.length + ' Kontur(en), ' + totalBefore + ' → ' + totalAfter + ' Punkte (Tol=' + tol + 'mm)', 'info');
        this.cancel();
        console.log('[CAM-Tools] Vectorize._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    _tessellateArcFromBulge(p1, p2, bulge, tol) {
        const pts = [];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const chord = Math.hypot(dx, dy);
        if (chord < 1e-8) return pts;

        const theta = 4 * Math.atan(Math.abs(bulge));
        const r = chord / (2 * Math.sin(theta / 2));
        if (r < 1e-8) return pts;

        // Schrittanzahl basierend auf Toleranz: n ≈ θ / (2·acos(1 - tol/r))
        const sagitta = r * (1 - Math.cos(theta / (2 * Math.max(2, Math.ceil(theta / (2 * Math.acos(Math.max(-1, Math.min(1, 1 - tol / r)))))))));
        const stepAngle = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tol / r)));
        const steps = Math.max(2, Math.ceil(theta / stepAngle));

        // Arc-Center berechnen
        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const d = r * Math.cos(theta / 2);
        const sign = bulge > 0 ? 1 : -1;
        const cx = mx - sign * d * dy / chord;
        const cy = my + sign * d * dx / chord;

        const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
        const sweep = bulge > 0 ? theta : -theta;

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const angle = startAngle + sweep * t;
            pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
        }
        return pts;
    }
}


// ════════════════════════════════════════════════════════════════════════════
//  CONVEX HULL TOOL (HULL) — Konvexes Hüllpolygon um selektierte Objekte
//  IGEMS Kap. 6.11: Andrew's Monotone Chain Algorithmus
// ════════════════════════════════════════════════════════════════════════════

class ConvexHullTool extends ModificationTool {
    constructor(manager) {
        super(manager);
        console.log('[CAM-Tools V1.2] ConvexHullTool erstellt');
    }

    getToolName() { return 'CONVEX HULL'; }

    start() {
        console.log('[CAM-Tools V1.2] ConvexHull gestartet');
        const preSelected = this.manager.getSelectedContours();
        if (preSelected.length > 0) {
            this.selectedContours = [...preSelected];
            this._executeConvexHull();
        } else {
            this.state = 'select';
            this.cmd?.setPrompt('CONVEX HULL — Objekte wählen, Enter = Hull erzeugen:');
            this.cmd?.log('⬡ Convex Hull: Konvexes Hüllpolygon um Objekte', 'info');
        }
    }

    _onSelectionComplete(contours) {
        this._executeConvexHull();
    }

    _executeConvexHull() {
        const _t0 = performance.now();
        const contours = this.selectedContours;
        if (!contours || contours.length === 0) {
            this.cmd?.log('Keine Objekte ausgewählt', 'error');
            return;
        }

        // Alle Punkte sammeln
        const allPoints = [];
        for (const c of contours) {
            if (!c.points) continue;
            for (const p of c.points) {
                allPoints.push({ x: p.x, y: p.y });
            }
        }

        if (allPoints.length < 3) {
            this.cmd?.log('Mindestens 3 Punkte benötigt', 'error');
            return;
        }

        // Andrew's Monotone Chain
        const hull = this._andrewsMonotoneChain(allPoints);

        if (hull.length < 3) {
            this.cmd?.log('Konvexe Hülle konnte nicht berechnet werden', 'error');
            return;
        }

        // Hülle schließen (letzter Punkt = erster Punkt)
        const hullPoints = hull.map(p => ({ x: p.x, y: p.y }));
        hullPoints.push({ x: hull[0].x, y: hull[0].y });

        // Neue Kontur erstellen
        const app = this.manager.app;
        const undoMgr = app?.undoManager;

        if (app && undoMgr) {
            const newContour = new CamContour(hullPoints, { isClosed: true });
            newContour.cuttingMode = 'disc';

            const cmd = {
                execute() {
                    app.contours.push(newContour);
                },
                undo() {
                    const idx = app.contours.indexOf(newContour);
                    if (idx !== -1) app.contours.splice(idx, 1);
                }
            };
            cmd.execute();
            undoMgr.pushExecuted(cmd);
            undoMgr.redoStack.length = 0;
            undoMgr._notifyStateChange();
        }

        // Selektion aufheben
        for (const c of contours) c.isSelected = false;
        this.manager.renderer?.render();
        app?.updateContourPanel?.();
        this.cmd?.log('✅ Convex Hull: Hüllpolygon erzeugt (' + hull.length + ' Ecken, ' + allPoints.length + ' Eingabe-Punkte)', 'info');
        this.cancel();
        console.log('[CAM-Tools] ConvexHull._execute: ' + (performance.now() - _t0).toFixed(2) + 'ms');
    }

    /**
     * Andrew's Monotone Chain Convex Hull — O(n log n)
     * Mathematisch bewiesen, numerisch stabil
     */
    _andrewsMonotoneChain(points) {
        const _t0 = performance.now();
        // Deduplizieren
        const unique = [];
        const seen = new Set();
        for (const p of points) {
            const key = Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000);
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(p);
            }
        }

        if (unique.length < 3) {
            console.log('[CAM-Tools] ConvexHull.andrew: ' + (performance.now() - _t0).toFixed(2) + 'ms (< 3 Punkte)');
            return unique;
        }

        // Sortieren: x aufsteigend, bei Gleichheit y aufsteigend
        unique.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

        const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);

        // Untere Hülle
        const lower = [];
        for (const p of unique) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        // Obere Hülle
        const upper = [];
        for (let i = unique.length - 1; i >= 0; i--) {
            const p = unique[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        // Zusammenfügen (letzten Punkt jeder Hälfte weglassen, da er der erste der anderen ist)
        lower.pop();
        upper.pop();
        const result = lower.concat(upper);
        console.log('[CAM-Tools] ConvexHull.andrew: ' + (performance.now() - _t0).toFixed(2) + 'ms (' + result.length + ' Hull-Punkte)');
        return result;
    }
}


// ════════════════════════════════════════════════════════════════════════════
//  LAZY-PATCH REGISTRATION — Tools in DrawingToolManager einbinden
//  Gleiches Pattern wie advanced-tools.js / drawing-tools-ext.js
// ════════════════════════════════════════════════════════════════════════════

if (typeof DrawingToolManager !== 'undefined') {
    const _origStartToolCam = DrawingToolManager.prototype.startTool;

    DrawingToolManager.prototype.startTool = function(shortcut) {
        // Einmalig registrieren
        if (!this._camToolsRegistered) {
            this._camToolsRegistered = true;

            this.tools['EF']         = () => new EdgefixTool(this);
            this.tools['EDGEFIX']    = () => new EdgefixTool(this);
            this.tools['REP']        = () => new ReplaceTool(this);
            this.tools['REPLACE']    = () => new ReplaceTool(this);
            this.tools['AN']         = () => new AnalyzeTool(this);
            this.tools['ANALYZE']    = () => new AnalyzeTool(this);
            this.tools['BT']         = () => new BoundaryTrimTool(this);
            this.tools['BTRIM']      = () => new BoundaryTrimTool(this);
            this.tools['PJ']         = () => new PolyJointTool(this);
            this.tools['POLYJOINT']  = () => new PolyJointTool(this);
            this.tools['VZ']         = () => new VectorizeTool(this);
            this.tools['VECTORIZE']  = () => new VectorizeTool(this);
            this.tools['HULL']       = () => new ConvexHullTool(this);
            this.tools['CONVEXHULL'] = () => new ConvexHullTool(this);

            console.debug('[CAM-Tools V1.7] ✅ 7 CAM-Vorbereitungstools registriert (EF, REP, AN, BT, PJ, VZ, HULL)');
        }

        // Auto-Apply gezeichnete Entities bei Mod-Tool-Start
        var key = shortcut.toUpperCase();
        var camModTools = ['REP', 'REPLACE', 'AN', 'ANALYZE', 'BT', 'BTRIM',
                           'VZ', 'VECTORIZE', 'HULL', 'CONVEXHULL'];
        if (camModTools.indexOf(key) !== -1 && this.entities.length > 0) {
            this.commandLine?.log('Auto-Apply: ' + this.entities.length + ' Objekte übernommen', 'info');
            this.applyEntities();
        }

        return _origStartToolCam.call(this, shortcut);
    };

    console.debug('[CAM-Tools V1.2] ✅ Lazy-Patch installiert');
} else {
    console.warn('[CAM-Tools V1.2] ⚠️ DrawingToolManager nicht gefunden — Lazy-Patch übersprungen');
}


// ════════════════════════════════════════════════════════════════════════════
//  RENDERER-ERWEITERUNG: Analyze-Markierungen zeichnen
//  Patcht render() um rote/gelbe Kreise zu zeichnen
// ════════════════════════════════════════════════════════════════════════════

if (typeof CanvasRenderer !== 'undefined') {
    const _origRenderCam = CanvasRenderer.prototype.render;

    CanvasRenderer.prototype.render = function() {
        // Original-Render aufrufen
        const result = _origRenderCam.apply(this, arguments);

        // Analyze-Markierungen zeichnen (falls vorhanden)
        if (this._analyzeMarkers && this._analyzeMarkers.length > 0) {
            const ctx = this.ctx;
            if (!ctx) return result;

            const dpr = this._dpr || 1;
            ctx.save();
            // Viewport-Transformation anwenden (gleiche Transformation wie render())
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.translate(this.offsetX, this.offsetY);
            ctx.scale(this.scale, -this.scale);

            for (const m of this._analyzeMarkers) {
                const screenRadius = Math.max(m.radius, 4 / this.scale);
                ctx.beginPath();
                ctx.arc(m.x, m.y, screenRadius, 0, Math.PI * 2);
                ctx.strokeStyle = m.color;
                ctx.lineWidth = 2 / this.scale;
                ctx.stroke();
                // Halbtransparente Füllung
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = m.color;
                ctx.fill();
                ctx.globalAlpha = 1.0;
            }

            ctx.restore();
        }

        return result;
    };

    console.debug('[CAM-Tools V1.2] ✅ Renderer-Patch für Analyze-Markierungen installiert');
}
