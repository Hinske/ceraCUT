/**
 * CeraCUT Snap Manager V1.8
 * V1.5: Fix — contour._center/_radius (DXF-Parser Unterstrich-Properties) unterstützt;
 *        Endpoint-Spam für Kreiskonturen unterdrückt (AutoCAD-konform: nur Center+Quadrant);
 *        invalidatePointsCache() Methode für externe Cache-Invalidierung (nach Grip-Editing etc.)
 * V1.4: Fix — _collectAllPoints() gecacht (_pointsCache), lief zuvor bei jedem Mousemove neu
 * Erweitetes Object-Snap System (AutoCAD-Stil)
 * - Endpoint, Midpoint, Center, GeoCenter, Quadrant, Intersection, Perpendicular, Tangent, Nearest
 * - V1.1: Perpendicular + Tangent (7 Kern-Snaps)
 * - V1.2: Quadrant (0°/90°/180°/270° auf Kreisen/Bögen) + Geometrisches Zentrum (Schwerpunkt)
 * - Ortho-Modus (F8)
 * - Grid-Snap
 * - Visuelle Snap-Marker (verschiedene Symbole pro Typ)
 * Created: 2026-02-13 MEZ
 * Last Modified: 2026-11-05
 * Build: 20261105-perptan
 * V1.8: Fix — resolve() uebergibt basePoint an findSnap(): Perpendicular-/Tangent-Fang waren in der App nie aktiv (lastPoint war immer null)
 * V1.7: Feat — Object Snap Tracking (F11, AutoCAD-Stil: Erfassen per Hover, orthogonale Tracking-Linien,
 *        Schnitt zweier Linien), Polar Tracking (F10), Shift = Ortho temporaer umkehren,
 *        Ortho/Polar schliessen sich aus, zentrale resolve()-Methode (Snap > Tracking > Polar/Ortho)
 * V1.6: Fix — Code-Review 2026-11-04 (tasks/code-review-2026-11-04.md)
 */

class SnapManager {

    /** Snap-Typen mit Priorität (niedrig = höher) */
    static SNAP_TYPES = {
        ENDPOINT:      { name: 'Endpoint',      priority: 1, color: '#FFFF00', symbol: 'square' },
        MIDPOINT:      { name: 'Midpoint',      priority: 2, color: '#00FF88', symbol: 'triangle' },
        CENTER:        { name: 'Center',        priority: 3, color: '#FF8800', symbol: 'circle' },
        GEOCENTER:     { name: 'Geo-Center',    priority: 3.5, color: '#FF8800', symbol: 'geocenter' },
        QUADRANT:      { name: 'Quadrant',      priority: 3.8, color: '#00FF00', symbol: 'quadrant' },
        INTERSECTION:  { name: 'Intersection',  priority: 4, color: '#FF00FF', symbol: 'cross' },
        PERPENDICULAR: { name: 'Perpendicular', priority: 5, color: '#00DDFF', symbol: 'perpendicular' },
        TANGENT:       { name: 'Tangent',       priority: 6, color: '#FFAA00', symbol: 'tangent' },
        NEAREST:       { name: 'Nearest',       priority: 7, color: '#00AAFF', symbol: 'diamond' }
    };

    constructor(options = {}) {
        // Welche Snaps aktiv sind
        this.enabledSnaps = {
            endpoint: true,
            midpoint: true,
            center: true,
            geocenter: true,
            quadrant: true,
            intersection: true,
            perpendicular: true,
            tangent: true,
            nearest: false   // Standardmäßig AUS — zu aggressiv für freies Zeichnen
        };

        // Ortho-Modus (F8)
        this.orthoEnabled = false;

        // V1.7: Polar Tracking (F10) + Object Snap Tracking (F11)
        this.polarEnabled = false;
        this.polarIncrement = 45;        // Grad
        this.otrackEnabled = true;       // AutoCAD-Default: EIN (wirkt nur mit erfassten Punkten)
        this.shiftOverride = false;      // Shift gedrueckt → Ortho temporaer umkehren
        this.acquireDelay = 300;         // ms Hover bis Erfassen
        this.maxAcquired = 7;            // AutoCAD: max. 7 Tracking-Punkte
        this.trackState = null;          // Ergebnis der letzten resolve(): {point, kind, lines, text}
        this.onTrackingChange = null;    // Callback (Re-Render nach Erfassen)
        this._acquired = [];             // [{point:{x,y}, name}]
        this._hover = null;
        this._acquireTimer = null;
        this._lastScale = 1;
        this._resolveCache = null;
        this._cfgVer = 0;

        // Grid-Snap
        this.gridSnapEnabled = false;
        this.gridSize = options.gridSize || 10;

        // Toleranz in Pixeln (wird durch scale in World-Koordinaten umgerechnet)
        this.tolerance = options.tolerance || 8;   // Pixel-basiert (reduziert von 12)
        this.nearestTolerance = options.nearestTolerance || 5; // Enger für Nearest-Snap

        // Quellen für Snap-Punkte
        this._contours = [];           // Bestehende Konturen (aus Pipeline)
        this._drawingEntities = [];    // Gerade gezeichnete Entities (Preview)

        // Letzter gefundener Snap
        this.currentSnap = null;

        // V1.2: Smoke-Test neuer Methoden
        try {
            this._computeCentroid([{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10},{x:0,y:0}]);
            this._bulgeToArcInfo({x:0,y:0,bulge:1},{x:10,y:0}, 1);
            console.debug('[SnapManager V1.7] ✅ Initialisiert (9 Snap-Typen: Endpoint, Midpoint, Center, GeoCenter, Quadrant, Intersection, Perpendicular, Tangent, Nearest)');
        } catch(e) {
            console.error('[SnapManager V1.2] ❌ Smoke-Test FEHLER:', e);
        }
    }

    // ════════════════════════════════════════════════════════════════
    // ÖFFENTLICHE API
    // ════════════════════════════════════════════════════════════════

    /** Konturen setzen (für Snap-Berechnung) */
    setContours(contours) {
        this._contours = contours || [];
        this._segmentCache = null; // V5.0: Cache invalidieren
        this._pointsCache = null;  // V1.4: Cache invalidieren
        this._resolveCache = null;
    }

    /** Zusätzliche Drawing-Entities für Snapping */
    setDrawingEntities(entities) {
        this._drawingEntities = entities || [];
        this._segmentCache = null; // V5.0: Cache invalidieren
        this._pointsCache = null;  // V1.4: Cache invalidieren
        this._resolveCache = null;
    }

    /** V1.5: Punkt-Cache invalidieren (nach Grip-Editing, Kontur-Mutation etc.) */
    /** LayerManager (explizit gesetzt oder global) */
    _getLayerManager() {
        return this.layerManager || (typeof window !== 'undefined' ? window.app?.layerManager : null) || null;
    }

    /** Darf auf Geometrie dieses Layers gesnappt werden? (sichtbar und nicht gesperrt) */
    _isLayerSnappable(layerName) {
        const lm = this._getLayerManager();
        const ld = lm?.layers?.get?.(layerName || '0');
        return !(ld && (!ld.visible || ld.locked));
    }

    /** Caches verwerfen, wenn sich Sichtbarkeit/Sperre von Layern geändert hat. */
    _checkLayerState() {
        const lm = this._getLayerManager();
        if (!lm?.layers) return;
        let sig = '';
        for (const [n, l] of lm.layers) sig += n + (l.visible ? 'v' : '-') + (l.locked ? 'l' : '-') + '|';
        if (sig !== this._layerSig) {
            this._layerSig = sig;
            this._pointsCache = null;
            this._segmentCache = null;
        }
    }

    invalidatePointsCache() {
        this._pointsCache = null;
        this._segmentCache = null;
        this._resolveCache = null;
    }

    /** Ortho-Modus umschalten (F8) — schliesst Polar aus (AutoCAD) */
    toggleOrtho() {
        return this.setOrtho(!this.orthoEnabled);
    }

    setOrtho(on) {
        this.orthoEnabled = !!on;
        if (this.orthoEnabled) this.polarEnabled = false;
        this._cfgVer++;
        return this.orthoEnabled;
    }

    /** Polar Tracking umschalten (F10) — schliesst Ortho aus (AutoCAD) */
    togglePolar() {
        return this.setPolar(!this.polarEnabled);
    }

    setPolar(on) {
        this.polarEnabled = !!on;
        if (this.polarEnabled) this.orthoEnabled = false;
        this._cfgVer++;
        return this.polarEnabled;
    }

    /** Object Snap Tracking umschalten (F11) */
    toggleOtrack() {
        this.otrackEnabled = !this.otrackEnabled;
        if (!this.otrackEnabled) this.clearTracking();
        this._cfgVer++;
        return this.otrackEnabled;
    }

    /** Shift-Override setzen (temporaer Ortho umkehren) */
    setShiftOverride(on) {
        on = !!on;
        if (this.shiftOverride !== on) {
            this.shiftOverride = on;
            this._cfgVer++;
        }
    }

    /** Effektiver Ortho-Zustand (Modus XOR Shift) */
    effectiveOrtho() {
        return !!this.orthoEnabled !== !!this.shiftOverride;
    }

    /** Effektiver Polar-Zustand (Ortho hat Vorrang) */
    effectivePolar() {
        return !!this.polarEnabled && !this.effectiveOrtho();
    }

    /** Alle erfassten Tracking-Punkte verwerfen */
    clearTracking() {
        this._clearHover();
        if (this._acquired.length) this._cfgVer++;
        this._acquired = [];
        this.trackState = null;
        this._resolveCache = null;
    }

    getAcquiredPoints() {
        return this._acquired;
    }

    /** Grid-Snap umschalten */
    toggleGridSnap() {
        this.gridSnapEnabled = !this.gridSnapEnabled;
        return this.gridSnapEnabled;
    }

    /**
     * Snap-Punkt suchen
     * @param {number} worldX - Welt-X
     * @param {number} worldY - Welt-Y
     * @param {number} scale - Aktuelle Zoom-Skala (für Toleranz-Umrechnung)
     * @param {{x:number, y:number}|null} lastPoint - Letzter Punkt (für Ortho + Perp/Tan)
     * @returns {{ point: {x:number, y:number}, type: string, typeDef: object } | null}
     */
    findSnap(worldX, worldY, scale, lastPoint = null) {
        const toleranceWorld = this.tolerance / scale;
        let candidates = [];

        // Alle Punkt-Quellen sammeln (V1.1: inkl. arcs-Daten)
        let allPoints;
        try {
            this._checkLayerState();
            if (!this._pointsCache) this._pointsCache = this._collectAllPoints();
            allPoints = this._pointsCache;
        } catch (err) {
            console.error('[SnapManager] _collectAllPoints ERROR:', err);
            return null;
        }

        // 1. Endpoint Snaps
        if (this.enabledSnaps.endpoint) {
            for (const source of allPoints) {
                if (source.endpoints) {
                    for (const p of source.endpoints) {
                        const d = Math.hypot(p.x - worldX, p.y - worldY);
                        if (d < toleranceWorld) {
                            candidates.push({
                                point: { x: p.x, y: p.y },
                                type: 'endpoint',
                                typeDef: SnapManager.SNAP_TYPES.ENDPOINT,
                                distance: d
                            });
                        }
                    }
                }
            }
        }

        // 2. Midpoint Snaps
        if (this.enabledSnaps.midpoint) {
            for (const source of allPoints) {
                if (source.midpoints) {
                    for (const p of source.midpoints) {
                        const d = Math.hypot(p.x - worldX, p.y - worldY);
                        if (d < toleranceWorld) {
                            candidates.push({
                                point: { x: p.x, y: p.y },
                                type: 'midpoint',
                                typeDef: SnapManager.SNAP_TYPES.MIDPOINT,
                                distance: d
                            });
                        }
                    }
                }
            }
        }

        // 3. Center Snaps
        if (this.enabledSnaps.center) {
            for (const source of allPoints) {
                if (source.centers) {
                    for (const p of source.centers) {
                        const d = Math.hypot(p.x - worldX, p.y - worldY);
                        if (d < toleranceWorld) {
                            candidates.push({
                                point: { x: p.x, y: p.y },
                                type: 'center',
                                typeDef: SnapManager.SNAP_TYPES.CENTER,
                                distance: d
                            });
                        }
                    }
                }
            }
        }

        // 3b. Geometric Center Snaps (Schwerpunkt geschlossener Konturen)
        if (this.enabledSnaps.geocenter) {
            for (const source of allPoints) {
                if (source.geoCenter) {
                    const p = source.geoCenter;
                    const d = Math.hypot(p.x - worldX, p.y - worldY);
                    if (d < toleranceWorld) {
                        candidates.push({
                            point: { x: p.x, y: p.y },
                            type: 'geocenter',
                            typeDef: SnapManager.SNAP_TYPES.GEOCENTER,
                            distance: d
                        });
                    }
                }
            }
        }

        // 3c. Quadrant Snaps (0°/90°/180°/270° auf Kreisen/Bögen)
        if (this.enabledSnaps.quadrant) {
            for (const source of allPoints) {
                if (source.quadrants) {
                    for (const p of source.quadrants) {
                        const d = Math.hypot(p.x - worldX, p.y - worldY);
                        if (d < toleranceWorld) {
                            candidates.push({
                                point: { x: p.x, y: p.y },
                                type: 'quadrant',
                                typeDef: SnapManager.SNAP_TYPES.QUADRANT,
                                distance: d
                            });
                        }
                    }
                }
            }
        }

        // 4. Intersection Snaps
        if (this.enabledSnaps.intersection) {
            const intersections = this._findIntersections(worldX, worldY, toleranceWorld);
            for (const p of intersections) {
                candidates.push({
                    point: p,
                    type: 'intersection',
                    typeDef: SnapManager.SNAP_TYPES.INTERSECTION,
                    distance: Math.hypot(p.x - worldX, p.y - worldY)
                });
            }
        }

        // 5. Perpendicular Snaps (nur wenn lastPoint existiert)
        if (this.enabledSnaps.perpendicular && lastPoint) {
            const perpPoints = this._findPerpendicularSnaps(worldX, worldY, toleranceWorld, lastPoint, allPoints);
            for (const p of perpPoints) {
                candidates.push({
                    point: p,
                    type: 'perpendicular',
                    typeDef: SnapManager.SNAP_TYPES.PERPENDICULAR,
                    distance: Math.hypot(p.x - worldX, p.y - worldY)
                });
            }
        }

        // 6. Tangent Snaps (nur wenn lastPoint existiert)
        if (this.enabledSnaps.tangent && lastPoint) {
            const tanPoints = this._findTangentSnaps(worldX, worldY, toleranceWorld, lastPoint, allPoints);
            for (const p of tanPoints) {
                candidates.push({
                    point: p,
                    type: 'tangent',
                    typeDef: SnapManager.SNAP_TYPES.TANGENT,
                    distance: Math.hypot(p.x - worldX, p.y - worldY)
                });
            }
        }

        // 7. Nearest Snaps (niedrigste Priorität, engere Toleranz)
        if (this.enabledSnaps.nearest && candidates.length === 0) {
            const nearestToleranceWorld = this.nearestTolerance / scale;
            for (const source of allPoints) {
                if (source.segments) {
                    for (const seg of source.segments) {
                        const proj = this._projectPointOnSegment(worldX, worldY, seg.p1, seg.p2);
                        const d = Math.hypot(proj.x - worldX, proj.y - worldY);
                        if (d < nearestToleranceWorld) {
                            candidates.push({
                                point: proj,
                                type: 'nearest',
                                typeDef: SnapManager.SNAP_TYPES.NEAREST,
                                distance: d
                            });
                        }
                    }
                }
            }
        }

        // Grid-Snap als Fallback
        if (this.gridSnapEnabled && candidates.length === 0) {
            const gx = Math.round(worldX / this.gridSize) * this.gridSize;
            const gy = Math.round(worldY / this.gridSize) * this.gridSize;
            const d = Math.hypot(gx - worldX, gy - worldY);
            if (d < toleranceWorld) {
                candidates.push({
                    point: { x: gx, y: gy },
                    type: 'grid',
                    typeDef: { name: 'Grid', priority: 10, color: '#666666', symbol: 'dot' },
                    distance: d
                });
            }
        }

        if (candidates.length === 0) {
            this.currentSnap = null;
            return null;
        }

        // Sortieren: Priorität zuerst, dann Distanz
        candidates.sort((a, b) => {
            const prioA = a.typeDef.priority || 99;
            const prioB = b.typeDef.priority || 99;
            // Bei sehr ähnlicher Distanz (<30% Unterschied): Priorität entscheidet
            // Sonst: näherer Snap gewinnt (Distanz-basiert)
            const distRatio = Math.min(a.distance, b.distance) / (Math.max(a.distance, b.distance) || 1);
            if (distRatio > 0.7) return prioA - prioB;
            return a.distance - b.distance;
        });

        this.currentSnap = candidates[0];
        return candidates[0];
    }

    /**
     * Ortho-Constraint anwenden
     * Beschränkt Punkt auf 0°/90° relativ zum lastPoint
     * @param {number} worldX
     * @param {number} worldY
     * @param {{x:number, y:number}} lastPoint
     * @returns {{x:number, y:number}}
     */
    applyOrtho(worldX, worldY, lastPoint) {
        if (!this.effectiveOrtho() || !lastPoint) return { x: worldX, y: worldY };

        const dx = Math.abs(worldX - lastPoint.x);
        const dy = Math.abs(worldY - lastPoint.y);

        // Horizontal oder Vertikal — je nachdem was näher ist
        if (dx > dy) {
            return { x: worldX, y: lastPoint.y };
        } else {
            return { x: lastPoint.x, y: worldY };
        }
    }

    // ════════════════════════════════════════════════════════════════
    // V1.7: ZENTRALE PUNKT-AUFLOESUNG (Snap > Tracking > Polar/Ortho)
    // ════════════════════════════════════════════════════════════════

    _clearHover() {
        if (this._acquireTimer) clearTimeout(this._acquireTimer);
        this._acquireTimer = null;
        this._hover = null;
    }

    /** Hover auf Fangpunkt → nach acquireDelay erfassen (oder bei erneutem Hover wieder loesen) */
    _updateAcquisition(snap) {
        if (!this.otrackEnabled || !snap) { this._clearHover(); return; }
        const p = snap.point;
        const key = p.x + ',' + p.y;
        if (this._hover && this._hover.key === key) return;
        this._clearHover();
        this._hover = { key };
        this._acquireTimer = setTimeout(() => {
            this._acquireTimer = null;
            const idx = this._acquired.findIndex(a => Math.hypot(a.point.x - p.x, a.point.y - p.y) < 1e-6);
            if (idx >= 0) {
                this._acquired.splice(idx, 1);            // erneutes Hovern loest den Punkt
            } else {
                this._acquired.push({ point: { x: p.x, y: p.y }, name: snap.typeDef.name });
                if (this._acquired.length > this.maxAcquired) this._acquired.shift();
            }
            this._cfgVer++;
            this._resolveCache = null;
            if (typeof this.onTrackingChange === 'function') this.onTrackingChange();
        }, this.acquireDelay);
    }

    /** Schnittpunkt zweier unendlicher Linien (origin + t*dir); null wenn parallel */
    static _lineIntersect(l1, l2) {
        const det = l1.dx * l2.dy - l1.dy * l2.dx;
        if (Math.abs(det) < 1e-9) return null;
        const t = ((l2.ox - l1.ox) * l2.dy - (l2.oy - l1.oy) * l2.dx) / det;
        return { x: l1.ox + t * l1.dx, y: l1.oy + t * l1.dy };
    }

    /** Abstand Punkt → unendliche Linie */
    static _distToLine(px, py, l) {
        return Math.abs((px - l.ox) * l.dy - (py - l.oy) * l.dx);
    }

    static _project(px, py, l) {
        const t = (px - l.ox) * l.dx + (py - l.oy) * l.dy;
        return { x: l.ox + t * l.dx, y: l.oy + t * l.dy };
    }

    /**
     * Punkt aufloesen: Objektfang > Tracking-Linien (Schnitt/Projektion) > Polar > Ortho.
     * @param {number} worldX
     * @param {number} worldY
     * @param {number} scale
     * @param {{x,y}|null} basePoint - letzter Punkt des aktiven Tools (Ortho/Polar-Basis)
     * @param {boolean} commit - true: Hover/Erfassen aktualisieren (nur Mouse-Move); false: Klick, reine Abfrage
     * @param {boolean} active - false: nur Objektfang (kein Tool aktiv → kein Tracking/Ortho/Polar)
     * @returns {{ snap: object|null, point: {x,y}, trackState: object|null }}
     */
    resolve(worldX, worldY, scale, basePoint = null, commit = true, active = true) {
        this._lastScale = scale;
        const ck = this._resolveCache;
        if (ck && ck.x === worldX && ck.y === worldY && ck.s === scale && ck.act === active &&
            ck.bx === (basePoint ? basePoint.x : null) && ck.by === (basePoint ? basePoint.y : null) &&
            ck.v === this._cfgVer) {
            if (commit) this._updateAcquisition(ck.res.snap);
            this.currentSnap = ck.res.snap;
            this.trackState = ck.res.trackState;
            return ck.res;
        }

        // V1.8: letzter Punkt des Tools → aktiviert Perpendicular- und Tangent-Fang (brauchen lastPoint)
        const snap = this.findSnap(worldX, worldY, scale, active ? basePoint : null);
        if (commit) this._updateAcquisition(active ? snap : null);

        let res;
        if (!active) {
            res = { snap, point: snap ? snap.point : { x: worldX, y: worldY }, trackState: null };
        } else {
            res = this._resolveTracking(worldX, worldY, scale, basePoint, snap);
        }
        this.trackState = res.trackState;
        this._resolveCache = {
            x: worldX, y: worldY, s: scale, act: active,
            bx: basePoint ? basePoint.x : null, by: basePoint ? basePoint.y : null,
            v: this._cfgVer, res
        };
        return res;
    }

    _resolveTracking(worldX, worldY, scale, basePoint, snap) {
        const tol = this.tolerance / scale;
        const ortho = !!(this.effectiveOrtho() && basePoint);
        const polar = !!(this.effectivePolar() && basePoint);
        const D2R = Math.PI / 180;

        // Tracking-Linien sammeln
        const lines = [];
        if (this.otrackEnabled) {
            for (const a of this._acquired) {
                lines.push({ ox: a.point.x, oy: a.point.y, dx: 1, dy: 0, kind: 'otrack', name: a.name });
                lines.push({ ox: a.point.x, oy: a.point.y, dx: 0, dy: 1, kind: 'otrack', name: a.name });
            }
        }
        if (polar) {
            const inc = Math.max(1, Math.min(180, this.polarIncrement || 45));
            for (let ang = 0; ang < 180 - 1e-9; ang += inc) {
                lines.push({ ox: basePoint.x, oy: basePoint.y, dx: Math.cos(ang * D2R), dy: Math.sin(ang * D2R), kind: 'polar', ang });
            }
        }

        const labelFor = (pt, line) => {
            const d = Math.hypot(pt.x - line.ox, pt.y - line.oy);
            let a = Math.atan2(pt.y - line.oy, pt.x - line.ox) / D2R;
            if (a < 0) a += 360;
            const src = line.kind === 'polar' ? 'Polar' : (line.name || 'Tracking');
            return `${src}: ${d.toFixed(2)} < ${a.toFixed(1)}°`;
        };

        // 1) Objektfang hat Vorrang; Tracking-Linien nur anzeigen, wenn der Snap-Punkt darauf liegt
        if (snap) {
            const on = lines.filter(l => SnapManager._distToLine(snap.point.x, snap.point.y, l) < tol * 0.25);
            return { snap, point: snap.point, trackState: on.length ? { kind: 'snap', point: snap.point, lines: on, text: null } : null };
        }

        // 2) Ortho: harte Achse durch Basispunkt, Tracking-Linien schneiden die Achse
        if (ortho) {
            const dx = Math.abs(worldX - basePoint.x), dy = Math.abs(worldY - basePoint.y);
            const horiz = dx >= dy;
            const axis = { ox: basePoint.x, oy: basePoint.y, dx: horiz ? 1 : 0, dy: horiz ? 0 : 1 };
            const c = horiz ? { x: worldX, y: basePoint.y } : { x: basePoint.x, y: worldY };
            let best = null;
            for (const l of lines) {
                const I = SnapManager._lineIntersect(axis, l);
                if (!I) continue;
                const d = Math.hypot(I.x - c.x, I.y - c.y);
                if (d < tol && (!best || d < best.d)) best = { l, I, d };
            }
            if (best) return { snap: null, point: best.I, trackState: { kind: 'otrack-int', point: best.I, lines: [best.l], text: labelFor(best.I, best.l) } };
            return { snap: null, point: c, trackState: { kind: 'ortho', point: c, lines: [], text: null } };
        }

        // 3) Tracking-/Polar-Linien nahe am Cursor
        const near = [];
        for (const l of lines) {
            const d = SnapManager._distToLine(worldX, worldY, l);
            if (d < tol) near.push({ l, d });
        }
        if (!near.length) return { snap: null, point: { x: worldX, y: worldY }, trackState: null };
        near.sort((a, b) => a.d - b.d);

        // Schnitt zweier Linien (verschiedene Ursprungspunkte/Richtungen) nahe am Cursor
        let bestI = null;
        for (let i = 0; i < near.length; i++) {
            for (let j = i + 1; j < near.length; j++) {
                const a = near[i].l, b = near[j].l;
                if (a.ox === b.ox && a.oy === b.oy) continue;
                const I = SnapManager._lineIntersect(a, b);
                if (!I) continue;
                const d = Math.hypot(I.x - worldX, I.y - worldY);
                if (d < tol * 1.5 && (!bestI || d < bestI.d)) bestI = { a, b, I, d };
            }
        }
        if (bestI) {
            return { snap: null, point: bestI.I, trackState: { kind: 'otrack-int', point: bestI.I, lines: [bestI.a, bestI.b], text: labelFor(bestI.I, bestI.a) } };
        }

        const best = near[0].l;
        const P = SnapManager._project(worldX, worldY, best);
        return { snap: null, point: P, trackState: { kind: best.kind, point: P, lines: [best], text: labelFor(P, best) } };
    }

    // ════════════════════════════════════════════════════════════════
    // RENDERING (wird vom Renderer aufgerufen)
    // ════════════════════════════════════════════════════════════════

    /**
     * V1.7: Tracking-Overlay zeichnen (Screen-Koordinaten): erfasste Punkte (+), gestrichelte Linien, Label
     * @param {CanvasRenderingContext2D} ctx
     * @param {(x:number,y:number)=>{x:number,y:number}} worldToScreen
     * @param {number} width - logische Canvas-Breite
     * @param {number} height - logische Canvas-Hoehe
     */
    drawTracking(ctx, worldToScreen, width, height) {
        const acquired = this._acquired;
        const ts = this.trackState;
        if (!acquired.length && !(ts && ts.lines && ts.lines.length)) return;
        const ext = (width + height) * 2;

        ctx.save();
        // Linien
        if (ts && ts.lines) {
            ctx.strokeStyle = 'rgba(190,190,190,0.75)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 4]);
            for (const l of ts.lines) {
                const o = worldToScreen(l.ox, l.oy);
                const sdx = l.dx, sdy = -l.dy;   // Y-Achse gespiegelt (Welt → Screen)
                ctx.beginPath();
                ctx.moveTo(o.x - sdx * ext, o.y - sdy * ext);
                ctx.lineTo(o.x + sdx * ext, o.y + sdy * ext);
                ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        // Erfasste Punkte als "+"
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        for (const a of acquired) {
            const s = worldToScreen(a.point.x, a.point.y);
            ctx.beginPath();
            ctx.moveTo(s.x - 5, s.y); ctx.lineTo(s.x + 5, s.y);
            ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x, s.y + 5);
            ctx.stroke();
        }
        // Marker + Label am getrackten Punkt
        if (ts && ts.point && (ts.kind === 'otrack' || ts.kind === 'polar' || ts.kind === 'otrack-int')) {
            const s = worldToScreen(ts.point.x, ts.point.y);
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(s.x - 4, s.y - 4); ctx.lineTo(s.x + 4, s.y + 4);
            ctx.moveTo(s.x - 4, s.y + 4); ctx.lineTo(s.x + 4, s.y - 4);
            ctx.stroke();
            if (ts.text) {
                ctx.font = '11px sans-serif';
                const tw = ctx.measureText(ts.text).width;
                const bx = s.x + 12, by = s.y - 24;
                ctx.fillStyle = 'rgba(30,30,30,0.85)';
                ctx.fillRect(bx - 3, by - 11, tw + 6, 16);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(ts.text, bx, by);
            }
        }
        ctx.restore();
    }

    /**
     * Snap-Indikator auf Canvas zeichnen (Screen-Koordinaten)
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} screenX - Screen-X
     * @param {number} screenY - Screen-Y
     */
    drawSnapIndicator(ctx, screenX, screenY) {
        if (!this.currentSnap) return;

        const snap = this.currentSnap;
        const size = 8;
        const color = snap.typeDef.color;

        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';

        switch (snap.typeDef.symbol) {
            case 'square': // Endpoint
                ctx.fillRect(screenX - size, screenY - size, size * 2, size * 2);
                ctx.strokeRect(screenX - size, screenY - size, size * 2, size * 2);
                break;

            case 'triangle': // Midpoint
                ctx.beginPath();
                ctx.moveTo(screenX, screenY - size);
                ctx.lineTo(screenX - size, screenY + size);
                ctx.lineTo(screenX + size, screenY + size);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

            case 'circle': // Center
                ctx.beginPath();
                ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                break;

            case 'cross': // Intersection
                ctx.beginPath();
                ctx.moveTo(screenX - size, screenY - size);
                ctx.lineTo(screenX + size, screenY + size);
                ctx.moveTo(screenX + size, screenY - size);
                ctx.lineTo(screenX - size, screenY + size);
                ctx.stroke();
                break;

            case 'diamond': // Nearest
                ctx.beginPath();
                ctx.moveTo(screenX, screenY - size);
                ctx.lineTo(screenX + size, screenY);
                ctx.lineTo(screenX, screenY + size);
                ctx.lineTo(screenX - size, screenY);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;

            case 'perpendicular': // Perpendicular — L-Form (⊥)
                ctx.beginPath();
                // Horizontale Linie
                ctx.moveTo(screenX - size, screenY + size);
                ctx.lineTo(screenX + size, screenY + size);
                // Vertikale Linie (Mitte nach oben)
                ctx.moveTo(screenX, screenY + size);
                ctx.lineTo(screenX, screenY - size);
                ctx.stroke();
                break;

            case 'tangent': // Tangent — Kreis mit tangentialer Linie
                ctx.beginPath();
                ctx.arc(screenX, screenY, size * 0.6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Tangentiale Linie oben
                ctx.beginPath();
                ctx.moveTo(screenX - size, screenY - size * 0.6);
                ctx.lineTo(screenX + size, screenY - size * 0.6);
                ctx.stroke();
                break;

            case 'quadrant': // Quadrant — Raute mit Punkt (AutoCAD-Stil)
                ctx.beginPath();
                ctx.moveTo(screenX, screenY - size);
                ctx.lineTo(screenX + size, screenY);
                ctx.lineTo(screenX, screenY + size);
                ctx.lineTo(screenX - size, screenY);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // Punkt in der Mitte
                ctx.beginPath();
                ctx.arc(screenX, screenY, 2, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                break;

            case 'geocenter': // Geometrisches Zentrum — Kreis mit Kreuz
                ctx.beginPath();
                ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Kreuz im Kreis
                ctx.beginPath();
                ctx.moveTo(screenX - size * 0.6, screenY);
                ctx.lineTo(screenX + size * 0.6, screenY);
                ctx.moveTo(screenX, screenY - size * 0.6);
                ctx.lineTo(screenX, screenY + size * 0.6);
                ctx.stroke();
                break;

            default: // Grid / Dot
                ctx.beginPath();
                ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                break;
        }

        // Snap-Type Label
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(snap.typeDef.name, screenX + size + 4, screenY - 4);

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════
    // PRIVATE HELFER
    // ════════════════════════════════════════════════════════════════

    /**
     * Alle Snap-relevanten Punkte aus Konturen + Entities sammeln
     * V1.1: Liefert jetzt auch 'arcs' Array für Perpendicular/Tangent
     */
    _collectAllPoints() {
        const sources = [];

        // Aus bestehenden Konturen
        for (const contour of this._contours) {
            const pts = contour.points;
            if (!pts || pts.length < 2) continue;
            if (!this._isLayerSnappable(contour.layer)) continue; // unsichtbar/gesperrt

            const endpoints = [];
            const midpoints = [];
            const centers = [];
            const segments = [];
            const arcs = [];       // V1.1: Bogen/Kreis-Geometrie für Perp/Tan
            const quadrants = [];  // V1.2: Quadrant-Punkte
            let geoCenter = null;  // V1.2: Geometrisches Zentrum

            // V1.5: DXF-Parser speichert Center/Radius als _center/_radius (Unterstrich)
            const _ctr = contour.center || contour._center;
            const _rad = contour.radius || contour._radius;
            // Kreis-Kontur: isClosed + center + radius → kein Endpoint-Spam (AutoCAD-konform)
            const isCircleContour = !!_ctr && !!_rad && contour.isClosed;

            if (!isCircleContour) {
                // Normale Polylinie/Bogen: Endpoints, Midpoints, Segments
                for (let i = 0; i < pts.length; i++) {
                    endpoints.push({ x: pts[i].x, y: pts[i].y });

                    if (i < pts.length - 1) {
                        midpoints.push({
                            x: (pts[i].x + pts[i + 1].x) / 2,
                            y: (pts[i].y + pts[i + 1].y) / 2
                        });
                        segments.push({ p1: pts[i], p2: pts[i + 1] });
                    }
                }
            } else {
                // Kreis: nur Segments für Nearest-Snap (kein Endpoint-Spam)
                for (let i = 0; i < pts.length - 1; i++) {
                    segments.push({ p1: pts[i], p2: pts[i + 1] });
                }
            }

            if (_ctr) {
                centers.push({ x: _ctr.x, y: _ctr.y });

                // V1.1: Wenn Kontur ein Kreis ist (center + radius vorhanden)
                if (_rad) {
                    const cx = _ctr.x, cy = _ctr.y, r = _rad;
                    arcs.push({ center: { x: cx, y: cy }, radius: r });

                    // V1.2: Quadrant-Punkte (0°, 90°, 180°, 270°)
                    quadrants.push(
                        { x: cx + r, y: cy },  // 0° (rechts)
                        { x: cx, y: cy + r },  // 90° (oben)
                        { x: cx - r, y: cy },  // 180° (links)
                        { x: cx, y: cy - r }   // 270° (unten)
                    );
                }
            }

            // V1.2: Quadrant-Punkte für Bulge-Segmente (Bogen in Polylinien)
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i + 1];
                if (p1.bulge && Math.abs(p1.bulge) > 0.01) {
                    const arcInfo = this._bulgeToArcInfo(p1, p2, p1.bulge);
                    if (arcInfo) {
                        // Center auch als Snap registrieren falls noch nicht vorhanden
                        if (!_ctr) {
                            centers.push({ x: arcInfo.cx, y: arcInfo.cy });
                        }
                        arcs.push({ center: { x: arcInfo.cx, y: arcInfo.cy }, radius: arcInfo.r, startAngle: arcInfo.startAngle, endAngle: arcInfo.endAngle });
                        // Quadrant-Punkte nur wenn innerhalb des Bogenbereichs
                        const qAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
                        for (const qa of qAngles) {
                            if (this._isAngleInArc(qa, arcInfo.startAngle, arcInfo.endAngle)) {
                                quadrants.push({ x: arcInfo.cx + arcInfo.r * Math.cos(qa), y: arcInfo.cy + arcInfo.r * Math.sin(qa) });
                            }
                        }
                    }
                }
            }

            // V1.2: Geometrisches Zentrum (Schwerpunkt) für geschlossene Konturen
            if (contour.isClosed && pts.length >= 4 && !_ctr) {
                geoCenter = this._computeCentroid(pts);
            }

            sources.push({ endpoints, midpoints, centers, segments, arcs, quadrants, geoCenter });
        }

        // Aus Drawing-Entities
        for (const entity of this._drawingEntities) {
            const endpoints = [];
            const midpoints = [];
            const centers = [];
            const segments = [];
            const arcs = [];       // V1.1
            const quadrants = [];  // V1.2
            let geoCenter = null;  // V1.2

            if (entity.type === 'LINE') {
                endpoints.push(entity.start, entity.end);
                midpoints.push({
                    x: (entity.start.x + entity.end.x) / 2,
                    y: (entity.start.y + entity.end.y) / 2
                });
                segments.push({ p1: entity.start, p2: entity.end });

            } else if (entity.type === 'CIRCLE') {
                const r = entity.radius;
                const cx = entity.center.x, cy = entity.center.y;
                centers.push({ x: cx, y: cy });

                // V1.2: Quadrant-Punkte (nicht mehr als Endpoints, eigener Snap-Typ)
                quadrants.push(
                    { x: cx + r, y: cy },  // 0°
                    { x: cx, y: cy + r },  // 90°
                    { x: cx - r, y: cy },  // 180°
                    { x: cx, y: cy - r }   // 270°
                );

                // V1.1: Voller Kreis für Perp/Tan
                arcs.push({ center: { x: cx, y: cy }, radius: r });

            } else if (entity.type === 'ARC') {
                endpoints.push(entity.startPoint, entity.endPoint);
                centers.push({ x: entity.center.x, y: entity.center.y });
                midpoints.push(entity.midPoint || {
                    x: (entity.startPoint.x + entity.endPoint.x) / 2,
                    y: (entity.startPoint.y + entity.endPoint.y) / 2
                });

                // V1.1: Bogen-Geometrie für Perp/Tan
                const arcDef = {
                    center: { x: entity.center.x, y: entity.center.y },
                    radius: entity.radius,
                    startAngle: entity.startAngle,
                    endAngle: entity.endAngle
                };
                arcs.push(arcDef);

                // V1.2: Quadrant-Punkte innerhalb des Bogens
                const qAngles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];
                for (const qa of qAngles) {
                    if (arcDef.startAngle != null && arcDef.endAngle != null && this._isAngleInArc(qa, arcDef.startAngle, arcDef.endAngle)) {
                        quadrants.push({
                            x: entity.center.x + entity.radius * Math.cos(qa),
                            y: entity.center.y + entity.radius * Math.sin(qa)
                        });
                    }
                }

            } else if (entity.type === 'POLYLINE' || entity.type === 'RECTANGLE') {
                const pts = entity.points || [];
                for (let i = 0; i < pts.length; i++) {
                    endpoints.push(pts[i]);
                    if (i < pts.length - 1) {
                        midpoints.push({
                            x: (pts[i].x + pts[i + 1].x) / 2,
                            y: (pts[i].y + pts[i + 1].y) / 2
                        });
                        segments.push({ p1: pts[i], p2: pts[i + 1] });
                    }
                }
                // V1.2: Geometrisches Zentrum für Rechtecke und geschlossene Polylinien
                if (entity.type === 'RECTANGLE' || (pts.length >= 4 && entity.closed)) {
                    geoCenter = this._computeCentroid(pts);
                }
            }

            sources.push({ endpoints, midpoints, centers, segments, arcs, quadrants, geoCenter });
        }

        return sources;
    }

    /** Segment-Segment Schnittpunkte suchen (für INTERSECTION Snap) */
    /**
     * V5.0: Segment-Cache invalidieren (nach Kontur-Änderung aufrufen)
     */
    invalidateSegmentCache() {
        this._segmentCache = null;
    }

    /**
     * V5.0: Gecachte Segmente mit Kontur-ID für Skip-Logik
     */
    _getSegmentCache() {
        this._checkLayerState();
        if (this._segmentCache) return this._segmentCache;

        const allSegments = [];
        for (let ci = 0; ci < this._contours.length; ci++) {
            const pts = this._contours[ci].points;
            if (!pts || pts.length < 2) continue;
            if (!this._isLayerSnappable(this._contours[ci].layer)) continue;
            for (let i = 0; i < pts.length - 1; i++) {
                allSegments.push({ p1: pts[i], p2: pts[i + 1], cid: ci, sid: i });
            }
        }
        for (let ei = 0; ei < this._drawingEntities.length; ei++) {
            const entity = this._drawingEntities[ei];
            const ecid = 10000 + ei; // Eigene ID-Range
            if (entity.type === 'LINE' && entity.start && entity.end) {
                allSegments.push({ p1: entity.start, p2: entity.end, cid: ecid, sid: 0 });
            } else if (entity.points) {
                for (let i = 0; i < entity.points.length - 1; i++) {
                    allSegments.push({ p1: entity.points[i], p2: entity.points[i + 1], cid: ecid, sid: i });
                }
            }
        }

        this._segmentCache = allSegments;
        return allSegments;
    }

    _findIntersections(worldX, worldY, tolerance) {
        const results = [];
        const allSegments = this._getSegmentCache();

        if (allSegments.length < 2) return results;

        // V5.0 Performance: Bei sehr vielen Segmenten (Splines) Suche begrenzen
        const MAX_NEARBY = 40;
        const searchDist = tolerance * 10;
        const nearby = [];

        for (let i = 0; i < allSegments.length; i++) {
            if (this._pointToSegmentDist(worldX, worldY, allSegments[i].p1, allSegments[i].p2) < searchDist) {
                nearby.push(allSegments[i]);
                if (nearby.length >= MAX_NEARBY) break; // Cap!
            }
        }

        // V5.0: Intersection-Check mit Skip für benachbarte Segmente gleicher Kontur
        for (let i = 0; i < nearby.length; i++) {
            for (let j = i + 1; j < nearby.length; j++) {
                const a = nearby[i], b = nearby[j];
                // Skip: Gleiche Kontur + benachbarte Segmente (teilen Vertex)
                if (a.cid === b.cid && Math.abs(a.sid - b.sid) <= 1) continue;

                const inter = this._segmentIntersection(a, b);
                if (inter) {
                    const d = Math.hypot(inter.x - worldX, inter.y - worldY);
                    if (d < tolerance) {
                        results.push(inter);
                    }
                }
            }
        }

        // DEBUG (einmalig pro Sekunde)
        if (!this._lastIntDebug || Date.now() - this._lastIntDebug > 1000) {
            if (nearby.length >= 2) {
                console.log(`[Snap Intersection] segs=${allSegments.length}, nearby=${nearby.length}/${MAX_NEARBY}, results=${results.length}, tol=${tolerance.toFixed(2)}`);
            }
            this._lastIntDebug = Date.now();
        }

        return results;
    }

    /** Punkt-zu-Segment Abstand (für Intersection-Vorfilter) */
    _pointToSegmentDist(px, py, p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-10) return Math.hypot(px - p1.x, py - p1.y);
        const t = Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
        return Math.hypot(px - (p1.x + t * dx), py - (p1.y + t * dy));
    }

    /** Zwei Liniensegmente schneiden */
    _segmentIntersection(seg1, seg2) {
        const x1 = seg1.p1.x, y1 = seg1.p1.y;
        const x2 = seg1.p2.x, y2 = seg1.p2.y;
        const x3 = seg2.p1.x, y3 = seg2.p1.y;
        const x4 = seg2.p2.x, y4 = seg2.p2.y;

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(denom) < 1e-10) return null; // parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: x1 + t * (x2 - x1),
                y: y1 + t * (y2 - y1)
            };
        }
        return null;
    }

    /** Punkt auf Segment projizieren */
    _projectPointOnSegment(px, py, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-10) return { x: p1.x, y: p1.y };

        let t = ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));

        return {
            x: p1.x + t * dx,
            y: p1.y + t * dy
        };
    }

    // ════════════════════════════════════════════════════════════════
    // PERPENDICULAR SNAP (V1.1)
    // Findet den Punkt auf einem Segment/Bogen, der senkrecht zu
    // lastPoint steht und nahe genug am Cursor ist.
    // ════════════════════════════════════════════════════════════════

    /**
     * Perpendicular-Snap-Punkte suchen
     * AutoCAD-Verhalten: Fußpunkt des Lots von lastPoint auf Segment/Bogen,
     * aber nur wenn dieser Fußpunkt nahe am Cursor liegt.
     */
    _findPerpendicularSnaps(worldX, worldY, tolerance, lastPoint, allPoints) {
        const results = [];

        for (const source of allPoints) {
            // Perpendicular auf Liniensegmente
            if (source.segments) {
                for (const seg of source.segments) {
                    const foot = this._perpendicularFootOnSegment(lastPoint, seg.p1, seg.p2);
                    if (foot) {
                        const distToCursor = Math.hypot(foot.x - worldX, foot.y - worldY);
                        if (distToCursor < tolerance) {
                            results.push({ x: foot.x, y: foot.y });
                        }
                    }
                }
            }

            // Perpendicular auf Kreise/Bögen
            if (source.arcs) {
                for (const arc of source.arcs) {
                    const foot = this._perpendicularFootOnArc(lastPoint, arc);
                    if (foot) {
                        const distToCursor = Math.hypot(foot.x - worldX, foot.y - worldY);
                        if (distToCursor < tolerance) {
                            results.push({ x: foot.x, y: foot.y });
                        }
                    }
                }
            }
        }

        return results;
    }

    /**
     * Fußpunkt des Lots von Punkt P auf Liniensegment (p1→p2)
     * Gibt null zurück wenn Projektion außerhalb des Segments liegt
     */
    _perpendicularFootOnSegment(P, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-10) return null;

        // Parametrischer t-Wert der Projektion
        const t = ((P.x - p1.x) * dx + (P.y - p1.y) * dy) / lenSq;

        // Nur innerhalb des Segments (mit kleiner Toleranz an den Enden)
        if (t < 0.001 || t > 0.999) return null;

        return {
            x: p1.x + t * dx,
            y: p1.y + t * dy
        };
    }

    /**
     * Fußpunkt des Lots von Punkt P auf Bogen/Kreis
     * Perpendicular auf Kreis = Punkt auf Kreis entlang Linie Center→P
     * (der dem P nächste der beiden Punkte auf dem Kreis)
     */
    _perpendicularFootOnArc(P, arc) {
        const cx = arc.center.x, cy = arc.center.y;
        const r = arc.radius;

        // Vektor Center → P
        const dx = P.x - cx;
        const dy = P.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 1e-10) return null; // P liegt auf Center

        // Punkt auf Kreis in Richtung P (nächster Punkt)
        const px = cx + (dx / dist) * r;
        const py = cy + (dy / dist) * r;

        // Prüfe ob Punkt innerhalb des Bogen-Bereichs liegt
        if (arc.startAngle !== undefined && arc.endAngle !== undefined) {
            const angle = Math.atan2(py - cy, px - cx);
            if (!this._isAngleInArc(angle, arc.startAngle, arc.endAngle)) {
                // Gegenüberliegenden Punkt prüfen
                const px2 = cx - (dx / dist) * r;
                const py2 = cy - (dy / dist) * r;
                const angle2 = Math.atan2(py2 - cy, px2 - cx);
                if (this._isAngleInArc(angle2, arc.startAngle, arc.endAngle)) {
                    return { x: px2, y: py2 };
                }
                return null;
            }
        }

        return { x: px, y: py };
    }

    // ════════════════════════════════════════════════════════════════
    // TANGENT SNAP (V1.1)
    // Findet Tangentenpunkte auf Kreisen/Bögen von lastPoint aus.
    // ════════════════════════════════════════════════════════════════

    /**
     * Tangent-Snap-Punkte suchen
     * AutoCAD-Verhalten: Von lastPoint aus die Tangentenpunkte auf
     * Kreisen/Bögen finden, aber nur wenn nahe am Cursor.
     */
    _findTangentSnaps(worldX, worldY, tolerance, lastPoint, allPoints) {
        const results = [];

        for (const source of allPoints) {
            if (!source.arcs) continue;

            for (const arc of source.arcs) {
                const tangentPts = this._tangentPointsFromExternal(lastPoint, arc);
                for (const tp of tangentPts) {
                    const distToCursor = Math.hypot(tp.x - worldX, tp.y - worldY);
                    if (distToCursor < tolerance) {
                        results.push({ x: tp.x, y: tp.y });
                    }
                }
            }
        }

        return results;
    }

    /**
     * Tangentenpunkte von einem externen Punkt P auf einen Kreis/Bogen
     * Geometrische Konstruktion: Thaleskreis über Strecke P-Center
     * cos(α) = r / dist → α = arccos(r/dist)
     * @returns {Array<{x:number, y:number}>} 0, 1 oder 2 Tangentenpunkte
     */
    _tangentPointsFromExternal(P, arc) {
        const cx = arc.center.x, cy = arc.center.y;
        const r = arc.radius;

        const dx = P.x - cx;
        const dy = P.y - cy;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq);

        // P muss außerhalb des Kreises liegen (mit kleiner Toleranz)
        if (dist <= r * 1.01) return [];

        // Winkelberechnung über Thaleskreis
        // α = Winkel zwischen Verbindungslinie und Tangente
        const alpha = Math.acos(r / dist);
        const baseAngle = Math.atan2(dy, dx); // Winkel Center → P

        // Zwei Tangentenpunkte: links und rechts der Verbindungslinie
        // Die Tangentenpunkte liegen auf dem Kreis bei (baseAngle ± α)
        const results = [];
        const angles = [baseAngle + alpha, baseAngle - alpha];

        for (const a of angles) {
            const tx = cx + r * Math.cos(a);
            const ty = cy + r * Math.sin(a);

            // Bei Bögen: Prüfen ob Punkt im Bogenbereich liegt
            if (arc.startAngle !== undefined && arc.endAngle !== undefined) {
                if (!this._isAngleInArc(a, arc.startAngle, arc.endAngle)) continue;
            }

            results.push({ x: tx, y: ty });
        }

        return results;
    }

    /**
     * Prüft ob ein Winkel innerhalb eines Bogenbereichs liegt
     * Berücksichtigt Wrap-Around (z.B. 350° → 10°)
     */
    _isAngleInArc(angle, startAngle, endAngle) {
        // Normalisiere alle Winkel auf [0, 2π)
        const TWO_PI = Math.PI * 2;
        const norm = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

        const a = norm(angle);
        const s = norm(startAngle);
        const e = norm(endAngle);

        if (s <= e) {
            return a >= s && a <= e;
        } else {
            // Wrap-around (z.B. 350° → 10°)
            return a >= s || a <= e;
        }
    }

    // ════════════════════════════════════════════════════════════════
    // V1.2: GEOMETRISCHES ZENTRUM + BULGE-ARC HELFER
    // ════════════════════════════════════════════════════════════════

    /**
     * Schwerpunkt (Centroid) einer geschlossenen Kontur berechnen
     * Verwendet Shoelace-Formel für Flächenschwerpunkt
     * @param {Array} pts - Punktarray [{x,y}, ...]
     * @returns {{x:number, y:number}|null}
     */
    _computeCentroid(pts) {
        if (!pts || pts.length < 3) return null;

        // Prüfe ob letzter Punkt = erster (geschlossen)
        const first = pts[0], last = pts[pts.length - 1];
        const isClosed = Math.hypot(first.x - last.x, first.y - last.y) < 0.01;
        const n = isClosed ? pts.length - 1 : pts.length;
        if (n < 3) return null;

        let area = 0, cx = 0, cy = 0;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
            area += cross;
            cx += (pts[i].x + pts[j].x) * cross;
            cy += (pts[i].y + pts[j].y) * cross;
        }

        area /= 2;
        if (Math.abs(area) < 1e-10) {
            // Degeneriert → einfacher Durchschnitt
            let sx = 0, sy = 0;
            for (let i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; }
            return { x: sx / n, y: sy / n };
        }

        cx /= (6 * area);
        cy /= (6 * area);
        return { x: cx, y: cy };
    }

    /**
     * Bulge-Wert in Arc-Info umrechnen (Center, Radius, Start/End-Winkel)
     * @param {{x:number,y:number,bulge:number}} p1
     * @param {{x:number,y:number}} p2
     * @param {number} bulge
     * @returns {{cx:number, cy:number, r:number, startAngle:number, endAngle:number}|null}
     */
    _bulgeToArcInfo(p1, p2, bulge) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const chord = Math.sqrt(dx * dx + dy * dy);
        if (chord < 1e-10) return null;

        const sagitta = Math.abs(bulge) * chord / 2;
        if (sagitta < 1e-10) return null; // Degenerierter Bogen (bulge ≈ 0)
        const r = (chord * chord / 4 + sagitta * sagitta) / (2 * sagitta);

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;
        const d = Math.sqrt(Math.max(0, r * r - (chord / 2) * (chord / 2)));
        const nx = -dy / chord;
        const ny = dx / chord;
        const sign = bulge > 0 ? 1 : -1;
        const cx = mx + sign * d * nx;
        const cy = my + sign * d * ny;

        let startAngle = Math.atan2(p1.y - cy, p1.x - cx);
        let endAngle = Math.atan2(p2.y - cy, p2.x - cx);
        // CW-Bogen (bulge < 0): als CCW-Bogen von p2 nach p1 liefern, da
        // _isAngleInArc immer den CCW-Bereich start→end prüft.
        if (bulge < 0) { const t = startAngle; startAngle = endAngle; endAngle = t; }

        return { cx, cy, r, startAngle, endAngle };
    }
}
