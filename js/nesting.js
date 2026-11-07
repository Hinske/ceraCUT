/**
 * CeraCUT Nesting Engine V1.2
 * Automatische Teile-Verschachtelung für Wasserstrahlschneiden
 *
 * Algorithmen:
 *   - Bottom-Left Fill (BLF) mit konfigurierbarer Schwerkraftrichtung
 *   - No-Fit Polygon (NFP) für präzise Kollisionsvermeidung
 *   - Multi-Sheet Overflow
 *   - Rotationsoptimierung (0°, 90°, 180°, 270° oder benutzerdefiniert)
 *
 * Last Modified: 2026-11-07
 * Build: 20261107-nestperf
 * V1.4: Perf — Polygon-Vereinfachung (simplifyTol), Kanten-Raster je platziertem Teil (_polysClash), Suchhinweis je Teiletyp/Variante, Variante-passt-nicht-mehr-Merker, Raumindex + vorübersetzte Polygone, Blech-voll-Merker je Teiletyp (typeKey), gemeinsame Rotationsvarianten, numerisches Dedupe, cfg.onProgress(done,total,sheets)
 * V1.3: Feat — cfg.order ('large-first'|'small-first'|'input'), Kontur-Felder priority und rotationSteps (Override je Teil), Node-Export
 * V1.2: Fix — Code-Review 2026-11-04 (tasks/code-review-2026-11-04.md)
 *
 * (c) Cerasell GmbH
 */

const NestingEngine = (() => {
    'use strict';

    const VERSION = 'V1.4';
    const LOG_PREFIX = `[Nesting ${VERSION}]`;
    const EPSILON = 1e-8;
    const MAX_GRID_CELLS = 6000;   // Obergrenze Raster-Kandidaten je Platzierungsversuch

    // ═══════════════════════════════════════════════════════════════════
    // Standardkonfiguration
    // ═══════════════════════════════════════════════════════════════════

    const DEFAULT_CONFIG = {
        sheetWidth: 1000,       // mm
        sheetHeight: 500,       // mm
        sheetMargin: 5,         // mm Rand an jeder Seite
        spacing: 2,             // mm Abstand zwischen Teilen
        rotationSteps: [0, 90, 180, 270],  // Grad
        gravity: 'bottom-left', // 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
        maxSheets: 100,         // Maximale Anzahl Bleche
        mergeToleranceNFP: 0.1, // Toleranz für NFP-Vereinfachung
        simplifyTol: 0.1        // mm: Polygon-Vereinfachung für die Platzierung (0 = aus); Abstand wird um 4×tol erhöht (garantiert den echten Mindestabstand)
    };

    // ═══════════════════════════════════════════════════════════════════
    // Geometrie-Hilfsfunktionen (fallback wenn Geometry nicht verfügbar)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Bounding-Box eines Punkt-Arrays berechnen
     */
    function _boundingBox(points) {
        if (typeof Geometry !== 'undefined' && Geometry?.boundingBox) {
            return Geometry.boundingBox(points);
        }
        if (!points || points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    /**
     * Vorzeichenbehaftete Fläche (Shoelace)
     */
    function _signedArea(points) {
        if (typeof Geometry !== 'undefined' && Geometry?.getSignedArea) {
            return Geometry.getSignedArea(points);
        }
        if (!points || points.length < 3) return 0;
        let area = 0;
        const n = points.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return area / 2;
    }

    /**
     * Punkte um einen Winkel (Grad) um ein Zentrum rotieren
     */
    function _rotatePoints(points, angleDeg, cx, cy) {
        if (!points || points.length === 0) return [];
        const rad = angleDeg * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return points.map(p => ({
            x: cos * (p.x - cx) - sin * (p.y - cy) + cx,
            y: sin * (p.x - cx) + cos * (p.y - cy) + cy
        }));
    }

    /**
     * Punkte translieren
     */
    function _translatePoints(points, dx, dy) {
        return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }

    /**
     * Konvexe Hülle (Andrew's Monotone Chain)
     */
    function _convexHull(points) {
        if (!points || points.length < 3) return points ? [...points] : [];

        const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
        const n = sorted.length;

        if (n < 3) return sorted;

        const cross = (o, a, b) =>
            (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        // Untere Hülle
        const lower = [];
        for (const p of sorted) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        // Obere Hülle
        const upper = [];
        for (let i = n - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        // Letzten Punkt jeder Hälfte entfernen (Duplikat)
        lower.pop();
        upper.pop();

        return lower.concat(upper);
    }

    /**
     * Punkt-in-Polygon Test (Ray-Casting)
     */
    function _pointInPolygon(point, polygon) {
        if (typeof GeometryOps !== 'undefined' && GeometryOps?.pointInPolygon) {
            return GeometryOps.pointInPolygon(point, polygon);
        }
        let inside = false;
        const n = polygon.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;
            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Polygon-Fläche (absolut)
     */
    function _polygonArea(points) {
        return Math.abs(_signedArea(points));
    }

    // ═══════════════════════════════════════════════════════════════════
    // No-Fit Polygon (NFP) Berechnung
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Minkowski-Differenz zur NFP-Berechnung.
     * Berechnet das NFP von stationärem Polygon A und orbitierendem Polygon B.
     * Der Referenzpunkt von B ist dessen Bounding-Box-Minimum.
     *
     * Vereinfachte Variante: Verwendet konvexe Hüllen für robuste Ergebnisse.
     * Für nicht-konvexe Formen wird die konvexe Hülle als konservative Annäherung genutzt.
     *
     * @param {Array<{x,y}>} polyA - Stationäres Polygon (CCW)
     * @param {Array<{x,y}>} polyB - Orbitierendes Polygon (CCW)
     * @returns {Array<{x,y}>} NFP-Polygon
     */
    function _computeNFP(polyA, polyB) {
        // Konvexe Hüllen für robuste Berechnung
        const hullA = _convexHull(polyA);
        const hullB = _convexHull(polyB);

        if (hullA.length < 3 || hullB.length < 3) {
            // Fallback: Bounding-Box-basiertes NFP
            return _computeBBoxNFP(polyA, polyB);
        }

        // B spiegeln am Ursprung (für Minkowski-Differenz)
        const negB = hullB.map(p => ({
            x: -p.x,
            y: -p.y
        }));

        // Minkowski-Summe von A und (-B)
        return _minkowskiSum(hullA, negB);
    }

    /**
     * Minkowski-Summe zweier konvexer Polygone
     * Beide müssen CCW sein.
     */
    function _minkowskiSum(polyA, polyB) {
        // CCW sicherstellen
        const a = _ensureCCW(polyA);
        const b = _ensureCCW(polyB);

        const na = a.length;
        const nb = b.length;

        // Startpunkte: jeweils niedrigster Punkt
        let ia = 0, ib = 0;
        for (let i = 1; i < na; i++) {
            if (a[i].y < a[ia].y || (a[i].y === a[ia].y && a[i].x < a[ia].x)) ia = i;
        }
        for (let i = 1; i < nb; i++) {
            if (b[i].y < b[ib].y || (b[i].y === b[ib].y && b[i].x < b[ib].x)) ib = i;
        }

        const result = [];
        let ca = 0, cb = 0;

        while (ca < na || cb < nb) {
            const idxA = (ia + ca) % na;
            const idxB = (ib + cb) % nb;

            result.push({
                x: a[idxA].x + b[idxB].x,
                y: a[idxA].y + b[idxB].y
            });

            if (ca >= na) { cb++; continue; }
            if (cb >= nb) { ca++; continue; }

            const nextA = (ia + ca + 1) % na;
            const nextB = (ib + cb + 1) % nb;

            const edgeA = { x: a[nextA].x - a[idxA].x, y: a[nextA].y - a[idxA].y };
            const edgeB = { x: b[nextB].x - b[idxB].x, y: b[nextB].y - b[idxB].y };

            const cross = edgeA.x * edgeB.y - edgeA.y * edgeB.x;

            if (cross > EPSILON) {
                ca++;
            } else if (cross < -EPSILON) {
                cb++;
            } else {
                ca++;
                cb++;
            }

            // Sicherheit: Endlos-Schleifen-Schutz
            if (result.length > na + nb + 2) break;
        }

        return result;
    }

    /**
     * Bounding-Box-basiertes NFP (Fallback für degenerierte Polygone)
     */
    function _computeBBoxNFP(polyA, polyB) {
        const bbA = _boundingBox(polyA);
        const bbB = _boundingBox(polyB);
        const wB = bbB.maxX - bbB.minX;
        const hB = bbB.maxY - bbB.minY;

        return [
            { x: bbA.minX - wB, y: bbA.minY - hB },
            { x: bbA.maxX,      y: bbA.minY - hB },
            { x: bbA.maxX,      y: bbA.maxY },
            { x: bbA.minX - wB, y: bbA.maxY }
        ];
    }

    /**
     * Polygon in CCW-Reihenfolge bringen
     */
    function _ensureCCW(polygon) {
        if (_signedArea(polygon) < 0) {
            return [...polygon].reverse();
        }
        return polygon;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Inner-Fit Polygon (IFP) — Teil innerhalb des Blechs
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Berechnet den Bereich auf dem Blech, in dem der Referenzpunkt eines Teils
     * platziert werden darf, sodass das Teil vollständig innerhalb liegt.
     *
     * @param {Object} sheet - { width, height, margin }
     * @param {Object} partBBox - Bounding-Box des Teils (normalisiert auf Referenzpunkt 0,0)
     * @returns {{ minX, minY, maxX, maxY }} Erlaubter Bereich für Referenzpunkt
     */
    function _innerFitRect(sheet, partBBox) {
        const m = sheet.margin || 0;
        const usableW = sheet.width - 2 * m;
        const usableH = sheet.height - 2 * m;

        const partW = partBBox.maxX - partBBox.minX;
        const partH = partBBox.maxY - partBBox.minY;

        return {
            minX: m - partBBox.minX,
            minY: m - partBBox.minY,
            maxX: m + usableW - partW,
            maxY: m + usableH - partH
        };
    }

    /**
     * Vereinfachte IFP: Maximaler Platzierungsbereich für ein Teil
     */
    function _placementBounds(sheet, partBBox) {
        const m = sheet.margin || 0;
        return {
            minX: m - partBBox.minX,
            minY: m - partBBox.minY,
            maxX: sheet.width - m - partBBox.maxX,
            maxY: sheet.height - m - partBBox.maxY
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Teile-Vorbereitung
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Teil normalisieren: Punkte so verschieben, dass der BBox-Ursprung bei (0,0) liegt.
     * Gibt normalisierte Punkte und Offset zurück.
     */
    function _normalizePart(points) {
        const bb = _boundingBox(points);
        const normalized = points.map(p => ({
            x: p.x - bb.minX,
            y: p.y - bb.minY
        }));
        return {
            points: normalized,
            offsetX: bb.minX,
            offsetY: bb.minY,
            width: bb.maxX - bb.minX,
            height: bb.maxY - bb.minY
        };
    }

    /**
     * Teil mit Abstand (spacing) aufblasen — vergrößert die effektive BBox
     */
    function _inflatePartBBox(bbox, spacing) {
        return {
            minX: bbox.minX - spacing / 2,
            minY: bbox.minY - spacing / 2,
            maxX: bbox.maxX + spacing / 2,
            maxY: bbox.maxY + spacing / 2
        };
    }

    // ═══════════════════════════════════════════════════════════════════
    // BLF (Bottom-Left Fill) Platzierung
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Ermittelt die beste Position für ein Teil auf einem Blech
     * unter Berücksichtigung bereits platzierter Teile.
     *
     * @param {Array<{x,y}>} partPoints - Normalisierte Teil-Punkte (mit Spacing)
     * @param {Object} sheet - Blech-Konfiguration
     * @param {Array} placedParts - Bereits platzierte Teile [{points, position, bbox}]
     * @param {string} gravity - Schwerkraftrichtung
     * @param {number} spacing - Abstand zwischen Teilen
     * @returns {{x, y}|null} Beste Position oder null wenn kein Platz
     */
    function _findBLFPosition(partPoints, sheet, placedParts, gravity, spacing, grid, hint) {
        const partBBox = _boundingBox(partPoints);
        const bounds = _placementBounds(sheet, partBBox);

        // Prüfe ob das Teil überhaupt auf das Blech passt
        if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
            return null;
        }

        // Raster-Auflösung für Kandidatenpositionen
        const partW = partBBox.maxX - partBBox.minX;
        const partH = partBBox.maxY - partBBox.minY;
        let stepX = Math.max(0.5, Math.min(partW / 4, 5));
        let stepY = Math.max(0.5, Math.min(partH / 4, 5));
        // V1.3: Raster deckeln — bei großen Blechen (3000×1500, Schritt 5 mm = 180k Kandidaten je Teil)
        // war das Nesting unbenutzbar langsam. Enge Packung kommt aus den Kandidaten neben platzierten Teilen.
        const gridCells = ((bounds.maxX - bounds.minX) / stepX + 1) * ((bounds.maxY - bounds.minY) / stepY + 1);
        if (gridCells > MAX_GRID_CELLS) {
            const f = Math.sqrt(gridCells / MAX_GRID_CELLS);
            stepX *= f; stepY *= f;
        }

        // V1.4: Hinweis = Position der letzten Platzierung desselben Teils (gleiche Variante) auf diesem Blech.
        // Alles "vor" dieser Zeile war damals belegt und ist es heute erst recht → nicht erneut absuchen.
        let genBounds = bounds;
        if (hint) {
            if (gravity === 'top-left' || gravity === 'top-right') genBounds = { ...bounds, maxY: Math.min(bounds.maxY, hint.y + partH + EPSILON) };
            else genBounds = { ...bounds, minY: Math.max(bounds.minY, hint.y - partH - EPSILON) };   // eine Teilehöhe Spielraum: Lücken neben neu platzierten Nachbarn (sonst ~1 Blech mehr bei 2000 Teilen)
            if (genBounds.minY > genBounds.maxY) return null;
        }

        // Kandidatenpositionen generieren
        const candidates = _generateCandidatePositions(
            genBounds, placedParts, partBBox, stepX, stepY, gravity, spacing
        );

        // Gravitations-Sortierung
        _sortByGravity(candidates, gravity);

        // Beste kollisionsfreie Position finden
        for (const candidate of candidates) {
            if (hint && (genBounds.minY - EPSILON > candidate.y || candidate.y > genBounds.maxY + EPSILON)) continue;   // Kandidaten neben Nachbarn außerhalb der Suchzeile
            const testBBox = {
                minX: partBBox.minX + candidate.x,
                minY: partBBox.minY + candidate.y,
                maxX: partBBox.maxX + candidate.x,
                maxY: partBBox.maxY + candidate.y
            };

            // Blech-Grenzen prüfen
            if (testBBox.minX < sheet.margin - EPSILON ||
                testBBox.minY < sheet.margin - EPSILON ||
                testBBox.maxX > sheet.width - sheet.margin + EPSILON ||
                testBBox.maxY > sheet.height - sheet.margin + EPSILON) {
                continue;
            }

            // Kollision mit platzierten Teilen prüfen
            if (!_collidesWithPlaced(testBBox, partPoints, candidate, placedParts, spacing, grid)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Kandidatenpositionen für BLF generieren.
     * Enthält Raster-Positionen und NFP-basierte Eckpositionen an platzierten Teilen.
     */
    function _generateCandidatePositions(bounds, placedParts, partBBox, stepX, stepY, gravity, spacing) {
        const candidates = [];
        const partW = partBBox.maxX - partBBox.minX;
        const partH = partBBox.maxY - partBBox.minY;

        // 1) Raster-Positionen
        for (let y = bounds.minY; y <= bounds.maxY + EPSILON; y += stepY) {
            for (let x = bounds.minX; x <= bounds.maxX + EPSILON; x += stepX) {
                candidates.push({ x, y });
            }
        }

        // 2) Kritische Positionen: direkt neben platzierten Teilen
        for (const placed of placedParts) {
            const pb = placed.bbox;
            const gap = spacing;

            // Rechts neben dem platzierten Teil
            candidates.push({ x: pb.maxX + gap - partBBox.minX, y: pb.minY - partBBox.minY });
            candidates.push({ x: pb.maxX + gap - partBBox.minX, y: pb.maxY - partBBox.maxY });

            // Links neben dem platzierten Teil
            candidates.push({ x: pb.minX - gap - partBBox.maxX, y: pb.minY - partBBox.minY });
            candidates.push({ x: pb.minX - gap - partBBox.maxX, y: pb.maxY - partBBox.maxY });

            // Über dem platzierten Teil
            candidates.push({ x: pb.minX - partBBox.minX, y: pb.maxY + gap - partBBox.minY });
            candidates.push({ x: pb.maxX - partBBox.maxX, y: pb.maxY + gap - partBBox.minY });

            // Unter dem platzierten Teil
            candidates.push({ x: pb.minX - partBBox.minX, y: pb.minY - gap - partBBox.maxY });
            candidates.push({ x: pb.maxX - partBBox.maxX, y: pb.minY - gap - partBBox.maxY });
        }

        // 3) Ecke des Blechs als Startposition
        candidates.push({ x: bounds.minX, y: bounds.minY });

        // Duplikate entfernen (auf stepX/2 Genauigkeit)
        return _deduplicateCandidates(candidates, Math.min(stepX, stepY) / 4);
    }

    /**
     * Duplikate aus Kandidatenliste entfernen
     */
    function _deduplicateCandidates(candidates, tolerance) {
        const result = [];
        const seen = new Set();
        for (const c of candidates) {
            const key = Math.round(c.x / tolerance) * 1048576 + Math.round(c.y / tolerance);   // numerisch: keine String-Allokation je Kandidat
            if (!seen.has(key)) {
                seen.add(key);
                result.push(c);
            }
        }
        return result;
    }

    /**
     * Kandidatenpositionen nach Schwerkraftrichtung sortieren
     */
    function _sortByGravity(candidates, gravity) {
        switch (gravity) {
            case 'bottom-left':
                candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
                break;
            case 'bottom-right':
                candidates.sort((a, b) => (a.y - b.y) || (b.x - a.x));
                break;
            case 'top-left':
                candidates.sort((a, b) => (b.y - a.y) || (a.x - b.x));
                break;
            case 'top-right':
                candidates.sort((a, b) => (b.y - a.y) || (b.x - a.x));
                break;
            default:
                candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
        }
    }


    // ═══════════════════════════════════════════════════════════════════
    // V1.4 Performance: Raumindex + vorübersetzte Polygone
    // ═══════════════════════════════════════════════════════════════════

    /** Gleichmäßiges Raster über den platzierten BBoxen: Kollisionsprüfung nur gegen Nachbarn statt gegen alle. */
    function _makeGrid(cell) {
        const map = new Map();
        let stamp = 0;
        const key = (cx, cy) => (cx + 4096) * 8192 + (cy + 4096);
        return {
            add(entry) {
                const b = entry.bbox;
                for (let cx = Math.floor(b.minX / cell); cx <= Math.floor(b.maxX / cell); cx++) {
                    for (let cy = Math.floor(b.minY / cell); cy <= Math.floor(b.maxY / cell); cy++) {
                        const k = key(cx, cy);
                        const l = map.get(k);
                        if (l) l.push(entry); else map.set(k, [entry]);
                    }
                }
            },
            /** Kandidaten, deren Zellen die um `gap` erweiterte BBox berühren (ohne Duplikate). */
            query(b, gap) {
                const out = [];
                stamp++;
                for (let cx = Math.floor((b.minX - gap) / cell); cx <= Math.floor((b.maxX + gap) / cell); cx++) {
                    for (let cy = Math.floor((b.minY - gap) / cell); cy <= Math.floor((b.maxY + gap) / cell); cy++) {
                        const l = map.get(key(cx, cy));
                        if (!l) continue;
                        for (const e of l) if (e._q !== stamp) { e._q = stamp; out.push(e); }
                    }
                }
                return out;
            }
        };
    }

    function _translate(points, pos) {
        const out = new Array(points.length);
        for (let i = 0; i < points.length; i++) out[i] = { x: points[i].x + pos.x, y: points[i].y + pos.y };
        return out;
    }

    /** Überlappung zweier bereits verschobener Polygone; die BBoxen beschneiden die Prüfungen. */
    function _polysOverlapAbs(A, bboxA, B, bboxB) {
        for (const p of A) {
            if (p.x > bboxB.minX && p.x < bboxB.maxX && p.y > bboxB.minY && p.y < bboxB.maxY && _pointInPolygon(p, B)) return true;
        }
        for (const p of B) {
            if (p.x > bboxA.minX && p.x < bboxA.maxX && p.y > bboxA.minY && p.y < bboxA.maxY && _pointInPolygon(p, A)) return true;
        }
        // Kantenschnitt nur im gemeinsamen Bereich beider BBoxen
        const rx0 = Math.max(bboxA.minX, bboxB.minX), rx1 = Math.min(bboxA.maxX, bboxB.maxX);
        const ry0 = Math.max(bboxA.minY, bboxB.minY), ry1 = Math.min(bboxA.maxY, bboxB.maxY);
        if (rx0 > rx1 || ry0 > ry1) return false;
        const inRegion = (a, b) => !(Math.max(a.x, b.x) < rx0 || Math.min(a.x, b.x) > rx1 || Math.max(a.y, b.y) < ry0 || Math.min(a.y, b.y) > ry1);
        const nA = A.length, nB = B.length;
        for (let i = 0; i < nA; i++) {
            const a1 = A[i], a2 = A[(i + 1) % nA];
            if (!inRegion(a1, a2)) continue;
            for (let j = 0; j < nB; j++) {
                const b1 = B[j], b2 = B[(j + 1) % nB];
                if (inRegion(b1, b2) && _segmentsIntersect(a1, a2, b1, b2)) return true;
            }
        }
        return false;
    }

    /** Mindestabstand zwischen verschobenen Polygonen: nur Punkte nahe der anderen BBox werden gegen deren Kanten geprüft. */
    function _polysCloserAbs(A, bboxA, B, bboxB, minDist) {
        for (const [P, Q, bq] of [[A, B, bboxB], [B, A, bboxA]]) {
            const x0 = bq.minX - minDist, x1 = bq.maxX + minDist, y0 = bq.minY - minDist, y1 = bq.maxY + minDist;
            const n = Q.length;
            for (const p of P) {
                if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
                for (let j = 0; j < n; j++) {
                    if (_distPointSeg(p, Q[j], Q[(j + 1) % n]) < minDist) return true;
                }
            }
        }
        return false;
    }


    /** Raster über die Kanten eines Polygons: Abstands-/Schnittprüfung nur gegen Kanten in der Nähe (statt alle n·m Paare). */
    function _makeSegGrid(pts, bbox, cell) {
        const n = pts.length;
        const nx = Math.max(1, Math.ceil((bbox.maxX - bbox.minX) / cell) + 1);
        const ny = Math.max(1, Math.ceil((bbox.maxY - bbox.minY) / cell) + 1);
        const cells = new Array(nx * ny);
        for (let i = 0; i < n; i++) {
            const a = pts[i], b = pts[(i + 1) % n];
            const cx0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - bbox.minX) / cell)), cx1 = Math.min(nx - 1, Math.floor((Math.max(a.x, b.x) - bbox.minX) / cell));
            const cy0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - bbox.minY) / cell)), cy1 = Math.min(ny - 1, Math.floor((Math.max(a.y, b.y) - bbox.minY) / cell));
            for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
                const k = cx * ny + cy;
                (cells[k] || (cells[k] = [])).push(i);
            }
        }
        return { cell, nx, ny, minX: bbox.minX, minY: bbox.minY, cells, seen: new Int32Array(n), stamp: 0 };
    }

    /**
     * Prüft, ob Polygon A (verschoben) mit dem platzierten Polygon B kollidiert: Kantenschnitt, Abstand < minDist
     * oder vollständige Umschließung. Gleiches Ergebnis wie _polysOverlapAbs + _polysCloserAbs, aber O(n·lokal).
     */
    function _polysClash(A, bboxA, placed, minDist) {
        const B = placed.abs, bboxB = placed.bbox, g = placed.sg;
        const nA = A.length, nB = B.length;
        for (let i = 0; i < nA; i++) {
            const a1 = A[i], a2 = A[(i + 1) % nA];
            const x0 = Math.min(a1.x, a2.x) - minDist, x1 = Math.max(a1.x, a2.x) + minDist;
            const y0 = Math.min(a1.y, a2.y) - minDist, y1 = Math.max(a1.y, a2.y) + minDist;
            if (x1 < bboxB.minX || x0 > bboxB.maxX || y1 < bboxB.minY || y0 > bboxB.maxY) continue;
            const cx0 = Math.max(0, Math.floor((x0 - g.minX) / g.cell)), cx1 = Math.min(g.nx - 1, Math.floor((x1 - g.minX) / g.cell));
            const cy0 = Math.max(0, Math.floor((y0 - g.minY) / g.cell)), cy1 = Math.min(g.ny - 1, Math.floor((y1 - g.minY) / g.cell));
            g.stamp++;
            for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
                const list = g.cells[cx * g.ny + cy];
                if (!list) continue;
                for (const j of list) {
                    if (g.seen[j] === g.stamp) continue;
                    g.seen[j] = g.stamp;
                    const b1 = B[j], b2 = B[(j + 1) % nB];
                    if (_segmentsIntersect(a1, a2, b1, b2)) return true;
                    if (_distPointSeg(a1, b1, b2) < minDist || _distPointSeg(a2, b1, b2) < minDist ||
                        _distPointSeg(b1, a1, a2) < minDist || _distPointSeg(b2, a1, a2) < minDist) return true;
                }
            }
        }
        // Keine Kante berührt: bleibt nur vollständige Umschließung
        if (A[0].x > bboxB.minX && A[0].x < bboxB.maxX && A[0].y > bboxB.minY && A[0].y < bboxB.maxY && _pointInPolygon(A[0], B)) return true;
        if (B[0].x > bboxA.minX && B[0].x < bboxA.maxX && B[0].y > bboxA.minY && B[0].y < bboxA.maxY && _pointInPolygon(B[0], A)) return true;
        return false;
    }

    /**
     * Prüft Kollision eines Teils (an Kandidatenposition) mit allen platzierten Teilen.
     * Verwendet erst BBox-Check (schnell), dann Polygon-Check (genau).
     */
    function _collidesWithPlaced(testBBox, partPoints, position, placedParts, spacing, grid) {
        const list = grid ? grid.query(testBBox, spacing) : placedParts;
        let A = null;                                     // Teil an Kandidatenposition, einmal je Kandidat verschoben
        for (const placed of list) {
            // Schneller BBox-Check mit Spacing
            if (!_bboxOverlap(testBBox, placed.bbox, spacing)) continue;
            if (!A) A = _translate(partPoints, position);
            if (spacing > 0 && placed.sg) {
                if (_polysClash(A, testBBox, placed, spacing)) return true;
                continue;
            }
            const B = placed.abs || _translate(placed.points, placed.position);
            // Genauerer Check: Polygon-Überlappung
            if (_polysOverlapAbs(A, testBBox, B, placed.bbox)) return true;
            // Mindestabstand gegen die ECHTE Kontur (BBox allein lässt ~0 mm Steg zu)
            if (spacing > 0 && _polysCloserAbs(A, testBBox, B, placed.bbox, spacing)) return true;
        }
        return false;
    }

    /**
     * BBox-Überlappungsprüfung (mit optionalem Mindestabstand)
     */
    function _bboxOverlap(bboxA, bboxB, gap) {
        const g = gap || 0;
        return !(bboxA.maxX + g <= bboxB.minX ||
                 bboxB.maxX + g <= bboxA.minX ||
                 bboxA.maxY + g <= bboxB.minY ||
                 bboxB.maxY + g <= bboxA.minY);
    }

    /**
     * Polygon-Überlappungsprüfung (SAT-basiert für konvexe Approximation)
     * Prüft ob ein Eckpunkt von A in B liegt oder umgekehrt.
     */
    /** Kleinster Abstand Punkt–Segment */
    function _distPointSeg(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        let t = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    /** true, wenn der Kantenabstand zweier (nicht überlappender) Polygone < minDist ist */
    function _polygonsCloserThan(pointsA, posA, pointsB, posB, minDist) {
        const A = pointsA.map(p => ({ x: p.x + posA.x, y: p.y + posA.y }));
        const B = pointsB.map(p => ({ x: p.x + posB.x, y: p.y + posB.y }));
        for (const [P, Q] of [[A, B], [B, A]]) {
            for (const p of P) {
                for (let j = 0; j < Q.length; j++) {
                    if (_distPointSeg(p, Q[j], Q[(j + 1) % Q.length]) < minDist) return true;
                }
            }
        }
        return false;
    }

    function _polygonsOverlap(pointsA, posA, pointsB, posB) {
        // Punkte an Position verschieben
        const translatedA = pointsA.map(p => ({ x: p.x + posA.x, y: p.y + posA.y }));
        const translatedB = pointsB.map(p => ({ x: p.x + posB.x, y: p.y + posB.y }));

        // Vertex-in-Polygon Test (schnell, fängt die meisten Fälle)
        for (const p of translatedA) {
            if (_pointInPolygon(p, translatedB)) return true;
        }
        for (const p of translatedB) {
            if (_pointInPolygon(p, translatedA)) return true;
        }

        // Segment-Schnitt-Test für Randfälle
        return _edgesIntersect(translatedA, translatedB);
    }

    /**
     * Prüft ob Kanten zweier Polygone sich schneiden
     */
    function _edgesIntersect(polyA, polyB) {
        const nA = polyA.length;
        const nB = polyB.length;

        for (let i = 0; i < nA; i++) {
            const a1 = polyA[i];
            const a2 = polyA[(i + 1) % nA];

            for (let j = 0; j < nB; j++) {
                const b1 = polyB[j];
                const b2 = polyB[(j + 1) % nB];

                if (_segmentsIntersect(a1, a2, b1, b2)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Segment-Schnitt-Test (exklusive Endpunkte)
     */
    function _segmentsIntersect(p1, p2, p3, p4) {
        const d1 = _cross2D(p3, p4, p1);
        const d2 = _cross2D(p3, p4, p2);
        const d3 = _cross2D(p1, p2, p3);
        const d4 = _cross2D(p1, p2, p4);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
            ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }

        // Kollineare Fälle
        if (Math.abs(d1) < EPSILON && _onSegment(p3, p4, p1)) return true;
        if (Math.abs(d2) < EPSILON && _onSegment(p3, p4, p2)) return true;
        if (Math.abs(d3) < EPSILON && _onSegment(p1, p2, p3)) return true;
        if (Math.abs(d4) < EPSILON && _onSegment(p1, p2, p4)) return true;

        return false;
    }

    function _cross2D(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function _onSegment(p, q, r) {
        return r.x <= Math.max(p.x, q.x) + EPSILON &&
               r.x >= Math.min(p.x, q.x) - EPSILON &&
               r.y <= Math.max(p.y, q.y) + EPSILON &&
               r.y >= Math.min(p.y, q.y) - EPSILON;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Teile-Sortierung (Optimierung der Platzierungsreihenfolge)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Teile nach Fläche (absteigend) sortieren — größte Teile zuerst
     * platzieren führt typischerweise zu besserer Auslastung.
     */
    function _sortPartsByArea(parts) {
        return [...parts].sort((a, b) => {
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            return areaB - areaA;
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Haupt-Nesting-Algorithmus
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Hauptfunktion: Verschachtelt Konturen auf Blech(e).
     *
     * @param {Array<CamContour>} contours - Array von CamContour-Objekten
     * @param {Object} [config] - Konfiguration (wird mit DEFAULT_CONFIG gemergt)
     * @returns {{
     *   placements: Array<{contourIndex, sheetIndex, position: {x,y}, rotation, bbox}>,
     *   sheets: Array<{index, utilization, partCount}>,
     *   unplaced: Array<number>,
     *   totalUtilization: number
     * }}
     */
    function nest(contours, config = {}) {
        const cfg = { ...DEFAULT_CONFIG, ...config };
        const startTime = performance.now();

        console.log(`${LOG_PREFIX} Starte Nesting: ${contours.length} Konturen auf ${cfg.sheetWidth}×${cfg.sheetHeight}mm Blech`);
        console.log(`${LOG_PREFIX} Spacing: ${cfg.spacing}mm, Margin: ${cfg.sheetMargin}mm, Rotationen: [${cfg.rotationSteps.join('°, ')}°]`);

        // Validierung
        if (!contours || contours.length === 0) {
            console.warn(`${LOG_PREFIX} Keine Konturen zum Verschachteln`);
            return { placements: [], sheets: [], unplaced: [], totalUtilization: 0 };
        }

        if (cfg.sheetWidth <= 2 * cfg.sheetMargin || cfg.sheetHeight <= 2 * cfg.sheetMargin) {
            console.error(`${LOG_PREFIX} Blech zu klein für den konfigurierten Rand`);
            return { placements: [], sheets: [], unplaced: contours.map((_, i) => i), totalUtilization: 0 };
        }

        const sheetConfig = {
            width: cfg.sheetWidth,
            height: cfg.sheetHeight,
            margin: cfg.sheetMargin
        };

        // Teile vorbereiten: normalisieren und Rotationsvarianten erzeugen
        const preparedParts = _prepareParts(contours, cfg);

        // Reihenfolge: Priorität (höher zuerst), dann nach cfg.order
        //   'large-first' (Standard) | 'small-first' | 'input' (Eingabereihenfolge)
        const orderDir = cfg.order === 'small-first' ? 1 : -1;
        const sortedIndices = preparedParts
            .map((p, i) => ({ index: i, area: p.width * p.height, priority: p.priority }))
            .sort((a, b) => (b.priority - a.priority)
                || (cfg.order === 'input' ? a.index - b.index : orderDir * (a.area - b.area)))
            .map(item => item.index);

        // Platzierung
        const placements = [];
        const unplaced = [];
        const gridCell = Math.max(40, Math.max(cfg.sheetWidth, cfg.sheetHeight) / 40);
        const newSheet = (index) => ({ index, placedParts: [], usedArea: 0, grid: _makeGrid(gridCell) });
        const sheets = [newSheet(0)];
        const variantsByType = new Map();      // typeKey → Rotationsvarianten (identische Teile teilen sie)
        const fullFor = new Set();             // `${typeKey}|${blech}`: Teil dieses Typs passt dort nicht mehr (Blech nur voller geworden)

        const collSpacing = cfg.spacing + (cfg.simplifyTol > 0 ? 4 * cfg.simplifyTol : 0);   // Sicherheitszuschlag für die vereinfachten Polygone
        const place = (part, variant, position, si) => {
            const bbox = _boundingBox(variant.points);
            const placedBBox = {
                minX: bbox.minX + position.x, minY: bbox.minY + position.y,
                maxX: bbox.maxX + position.x, maxY: bbox.maxY + position.y
            };
            placements.push({
                contourIndex: part.originalIndex, sheetIndex: si,
                position: { x: position.x, y: position.y }, rotation: variant.rotation, bbox: placedBBox
            });
            const abs = _translate(variant.points, position);
            const entry = { points: variant.points, position, bbox: placedBBox, abs };
            if (collSpacing > 0) {
                const dim = Math.max(placedBBox.maxX - placedBBox.minX, placedBBox.maxY - placedBBox.minY);
                entry.sg = _makeSegGrid(abs, placedBBox, Math.max(2 * collSpacing, dim / 40, 1));
            }
            sheets[si].placedParts.push(entry);
            sheets[si].grid.add(entry);
            sheets[si].usedArea += _polygonArea(variant.points);
        };

        const variantFailed = new Set();       // `${typeKey}|${blech}|${variante}`: Variante passt dort nicht mehr
        const variantHint = new Map();         // dito → {x, y} der letzten Platzierung
        const tryOn = (part, variants, si) => {
            for (let vi = 0; vi < variants.length; vi++) {
                const key = part.typeKey + '|' + si + '|' + vi;
                if (variantFailed.has(key)) continue;
                const variant = variants[vi];
                const position = _findBLFPosition(variant.points, sheetConfig, sheets[si].placedParts, cfg.gravity, collSpacing,
                    sheets[si].grid, variantHint.get(key));
                if (position) {
                    variantHint.set(key, { x: position.x, y: position.y });
                    place(part, variant, position, si);
                    return true;
                }
                variantFailed.add(key);
            }
            return false;
        };

        let processed = 0;
        for (const partIdx of sortedIndices) {
            const part = preparedParts[partIdx];
            let placed = false;

            // Rotationsvarianten (je Teiletyp einmal)
            let rotationVariants = variantsByType.get(part.typeKey);
            if (!rotationVariants) {
                rotationVariants = _getRotationVariants(part, part.rotationSteps || cfg.rotationSteps);
                variantsByType.set(part.typeKey, rotationVariants);
            }

            // Auf existierenden Blechen versuchen (Bleche, auf denen dieser Typ schon scheiterte, überspringen)
            for (let si = 0; si < sheets.length && !placed; si++) {
                const memo = part.typeKey + '|' + si;
                if (fullFor.has(memo)) continue;
                if (tryOn(part, rotationVariants, si)) placed = true; else fullFor.add(memo);
            }

            // Neues Blech versuchen
            if (!placed && sheets.length < cfg.maxSheets) {
                const newSheetIdx = sheets.length;
                sheets.push(newSheet(newSheetIdx));
                if (tryOn(part, rotationVariants, newSheetIdx)) placed = true; else fullFor.add(part.typeKey + '|' + newSheetIdx);
            }

            if (!placed) {
                console.warn(`${LOG_PREFIX} Kontur ${part.originalIndex} (${part.name}) konnte nicht platziert werden`);
                unplaced.push(part.originalIndex);
            }
            processed++;
            if (cfg.onProgress && (processed % 5 === 0 || processed === sortedIndices.length)) cfg.onProgress(processed, sortedIndices.length, sheets.length);
        }

        // Leere Bleche am Ende entfernen
        const usedSheets = sheets.filter(s => s.placedParts.length > 0);

        // Statistiken berechnen
        const sheetArea = cfg.sheetWidth * cfg.sheetHeight;
        const sheetStats = usedSheets.map(s => ({
            index: s.index,
            utilization: sheetArea > 0 ? Math.round((s.usedArea / sheetArea) * 10000) / 100 : 0,
            partCount: s.placedParts.length
        }));

        const totalUsedArea = usedSheets.reduce((sum, s) => sum + s.usedArea, 0);
        const totalSheetArea = usedSheets.length * sheetArea;
        const totalUtilization = totalSheetArea > 0
            ? Math.round((totalUsedArea / totalSheetArea) * 10000) / 100
            : 0;

        const elapsed = Math.round(performance.now() - startTime);

        console.log(`${LOG_PREFIX} Ergebnis: ${placements.length}/${contours.length} Teile auf ${usedSheets.length} Blech(en) platziert`);
        console.log(`${LOG_PREFIX} Auslastung: ${totalUtilization}% gesamt`);
        for (const ss of sheetStats) {
            console.log(`${LOG_PREFIX}   Blech ${ss.index + 1}: ${ss.partCount} Teile, ${ss.utilization}%`);
        }
        if (unplaced.length > 0) {
            console.warn(`${LOG_PREFIX} ${unplaced.length} Teile konnten nicht platziert werden`);
        }
        console.log(`${LOG_PREFIX} Laufzeit: ${elapsed}ms`);

        return {
            placements,
            sheets: sheetStats,
            unplaced,
            totalUtilization
        };
    }

    /**
     * Polygon für die Platzierung vereinfachen (Douglas-Peucker, geschlossener Ring): Kunstmotive haben tausende Punkte,
     * die Kollisionsprüfung ist aber O(n·m). Die vier Extrempunkte (min/max X/Y) bleiben erhalten → BBox identisch,
     * damit Position/Drehung exakt auf die Originalkontur übertragbar sind. Abweichung ≤ tol je Punkt.
     */
    function _simplifyRing(points, tol) {
        const n = points.length;
        if (!(tol > 0) || n < 12) return points;
        let iMinX = 0, iMaxX = 0, iMinY = 0, iMaxY = 0;
        for (let i = 1; i < n; i++) {
            if (points[i].x < points[iMinX].x) iMinX = i;
            if (points[i].x > points[iMaxX].x) iMaxX = i;
            if (points[i].y < points[iMinY].y) iMinY = i;
            if (points[i].y > points[iMaxY].y) iMaxY = i;
        }
        const anchors = [...new Set([iMinX, iMaxX, iMinY, iMaxY])].sort((a, b) => a - b);
        const keep = new Uint8Array(n);
        for (const a of anchors) keep[a] = 1;
        // Je Kette zwischen aufeinanderfolgenden Ankern (zyklisch) Douglas-Peucker
        for (let k = 0; k < anchors.length; k++) {
            const from = anchors[k];
            const to = anchors[(k + 1) % anchors.length];
            const stack = [[from, to]];
            while (stack.length) {
                const [a, b] = stack.pop();
                const len = ((b - a) % n + n) % n;
                if (len < 2) continue;
                let worst = -1, wd = tol;
                for (let step = 1; step < len; step++) {
                    const idx = (a + step) % n;
                    const d = _distPointSeg(points[idx], points[a], points[b]);
                    if (d > wd) { wd = d; worst = idx; }
                }
                if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
            }
        }
        const out = [];
        for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
        return out.length >= 3 ? out : points;
    }

    /** Teiletyp-Schlüssel aus Form + Drehwinkeln (0,01 mm gerundet), wenn der Aufrufer keinen typeKey mitgibt. */
    function _signature(points, rotationSteps) {
        let h = 5381;
        for (const p of points) {
            h = (Math.imul(h, 33) ^ Math.round(p.x * 100)) | 0;
            h = (Math.imul(h, 33) ^ Math.round(p.y * 100)) | 0;
        }
        return `${points.length}:${h}:${rotationSteps ? rotationSteps.join(',') : '-'}`;
    }

    /**
     * Konturen für die Platzierung vorbereiten
     */
    function _prepareParts(contours, cfg) {
        const simplifyCache = new Map();
        return contours.map((contour, index) => {
            const points = contour?.points || [];
            if (points.length === 0) {
                console.warn(`${LOG_PREFIX} Kontur ${index} hat keine Punkte`);
                return {
                    originalIndex: index,
                    points: [],
                    width: 0,
                    height: 0,
                    area: 0,
                    typeKey: `leer-${index}`,
                    name: contour?.name || `Contour_${index}`
                };
            }

            const typeKey = contour?.typeKey != null ? String(contour.typeKey) : _signature(points, contour?.rotationSteps);
            let nestPts = simplifyCache.get(typeKey);
            if (!nestPts) { nestPts = _simplifyRing(points, cfg.simplifyTol); simplifyCache.set(typeKey, nestPts); }
            const norm = _normalizePart(nestPts);

            return {
                originalIndex: index,
                points: norm.points,
                originalOffset: { x: norm.offsetX, y: norm.offsetY },
                width: norm.width,
                height: norm.height,
                area: _polygonArea(norm.points),
                isClosed: contour?.isClosed ?? true,
                name: contour?.name || `Contour_${index}`,
                typeKey,
                priority: Number(contour?.priority) || 0,                       // V1.3: höher = zuerst
                rotationSteps: Array.isArray(contour?.rotationSteps) && contour.rotationSteps.length
                    ? contour.rotationSteps : null                                // V1.3: Override je Teil
            };
        });
    }

    /**
     * Rotationsvarianten eines Teils erzeugen
     */
    function _getRotationVariants(part, rotationSteps) {
        if (!part.points || part.points.length === 0) return [];

        const variants = [];
        const bb = _boundingBox(part.points);
        const cx = (bb.minX + bb.maxX) / 2;
        const cy = (bb.minY + bb.maxY) / 2;

        for (const angle of rotationSteps) {
            let rotatedPoints;
            if (angle === 0) {
                rotatedPoints = part.points.map(p => ({ x: p.x, y: p.y }));
            } else {
                rotatedPoints = _rotatePoints(part.points, angle, cx, cy);
            }

            // Erneut normalisieren (Rotation verschiebt BBox)
            const norm = _normalizePart(rotatedPoints);

            variants.push({
                points: norm.points,
                rotation: angle,
                width: norm.width,
                height: norm.height
            });
        }

        // Nach Flächen-Effizienz sortieren (kompakteste Variante zuerst)
        // Bevorzuge Varianten mit kleinerem BBox-Aspektverhältnis
        variants.sort((a, b) => {
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            return areaA - areaB;
        });

        return variants;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Platzierungen anwenden
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Platzierungen auf CamContour-Objekte anwenden (in-place Modifikation).
     * Transformiert die Konturen gemäß den Nesting-Ergebnissen.
     *
     * ACHTUNG: Modifiziert die Punkte der Konturen direkt.
     * Für Undo-Support vorher Snapshots erstellen.
     *
     * @param {Array<CamContour>} contours - Originale Konturen
     * @param {Array} placements - Platzierungs-Ergebnis aus nest()
     * @param {Object} [options] - Optionen
     * @param {number} [options.sheetIndex=0] - Nur Platzierungen dieses Blechs anwenden
     * @returns {Array<CamContour>} Die modifizierten Konturen (gleiche Referenzen)
     */
    function applyPlacements(contours, placements, options = {}) {
        const targetSheet = options.sheetIndex;
        const filteredPlacements = (targetSheet !== undefined && targetSheet !== null)
            ? placements.filter(p => p.sheetIndex === targetSheet)
            : placements;

        console.log(`${LOG_PREFIX} Wende ${filteredPlacements.length} Platzierungen an`);

        for (const placement of filteredPlacements) {
            const contour = contours[placement.contourIndex];
            if (!contour || !contour.points || contour.points.length === 0) {
                console.warn(`${LOG_PREFIX} Kontur ${placement.contourIndex} nicht gefunden oder leer`);
                continue;
            }

            const points = contour.points;

            // 1) Normalisieren (auf Ursprung verschieben)
            const bb = _boundingBox(points);
            const cx = (bb.minX + bb.maxX) / 2;
            const cy = (bb.minY + bb.maxY) / 2;

            // Zum Zentrum verschieben
            for (const p of points) {
                p.x -= cx;
                p.y -= cy;
            }

            // 2) Rotation anwenden
            if (placement.rotation !== 0) {
                const rad = placement.rotation * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                for (const p of points) {
                    const nx = cos * p.x - sin * p.y;
                    const ny = sin * p.x + cos * p.y;
                    p.x = nx;
                    p.y = ny;
                }
            }

            // 3) Auf BBox-Ursprung normalisieren
            const rotBB = _boundingBox(points);
            for (const p of points) {
                p.x -= rotBB.minX;
                p.y -= rotBB.minY;
            }

            // 4) An Zielposition verschieben
            for (const p of points) {
                p.x += placement.position.x;
                p.y += placement.position.y;
            }

            // Cache invalidieren (CeraCUT-Pattern)
            if (typeof ModificationTool !== 'undefined' && ModificationTool?.invalidateCache) {
                ModificationTool.invalidateCache(contour);
            } else {
                // Manuelle Cache-Invalidierung
                contour._cachedKerfPolyline = null;
                contour._cacheKey = null;
                contour._cachedLeadInPath = null;
                contour._cachedLeadOutPath = null;
                contour._cachedOvercutPath = null;
            }
        }

        return contours;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Utility-Funktionen
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Blech-Auslastung für eine gegebene Platzierung berechnen
     */
    function getSheetUtilization(contours, placements, sheetConfig, sheetIndex) {
        const sheetArea = (sheetConfig.sheetWidth || sheetConfig.width) *
                          (sheetConfig.sheetHeight || sheetConfig.height);
        if (sheetArea <= 0) return 0;

        const sheetPlacements = placements.filter(p => p.sheetIndex === (sheetIndex || 0));
        let usedArea = 0;

        for (const p of sheetPlacements) {
            const contour = contours[p.contourIndex];
            if (contour?.points) {
                usedArea += _polygonArea(contour.points);
            }
        }

        return Math.round((usedArea / sheetArea) * 10000) / 100;
    }

    /**
     * Prüft ob ein Teil (BBox) auf ein Blech passt
     */
    function partFitsSheet(partPoints, sheetConfig) {
        const bb = _boundingBox(partPoints);
        const w = bb.maxX - bb.minX;
        const h = bb.maxY - bb.minY;
        const cfg = {
            width: sheetConfig.sheetWidth || sheetConfig.width || 0,
            height: sheetConfig.sheetHeight || sheetConfig.height || 0,
            margin: sheetConfig.sheetMargin || sheetConfig.margin || 0
        };
        const usableW = cfg.width - 2 * cfg.margin;
        const usableH = cfg.height - 2 * cfg.margin;

        // Prüfe auch rotiert (90°)
        return (w <= usableW && h <= usableH) ||
               (h <= usableW && w <= usableH);
    }

    /**
     * Erzeugt eine Vorschau der Platzierung als Punkt-Arrays
     * (nützlich für Rendering ohne die Konturen zu modifizieren)
     */
    function getPlacementPreview(contours, placements) {
        const preview = [];

        for (const placement of placements) {
            const contour = contours[placement.contourIndex];
            if (!contour?.points || contour.points.length === 0) continue;

            const points = contour.points;
            const bb = _boundingBox(points);
            const cx = (bb.minX + bb.maxX) / 2;
            const cy = (bb.minY + bb.maxY) / 2;

            // Kopie erstellen, transformieren
            let transformed = points.map(p => ({ x: p.x - cx, y: p.y - cy }));

            if (placement.rotation !== 0) {
                transformed = _rotatePoints(transformed, placement.rotation, 0, 0);
            }

            // Normalisieren
            const rotBB = _boundingBox(transformed);
            transformed = transformed.map(p => ({
                x: p.x - rotBB.minX + placement.position.x,
                y: p.y - rotBB.minY + placement.position.y
            }));

            preview.push({
                contourIndex: placement.contourIndex,
                sheetIndex: placement.sheetIndex,
                points: transformed,
                rotation: placement.rotation,
                bbox: placement.bbox,
                name: contour.name || `Contour_${placement.contourIndex}`
            });
        }

        return preview;
    }

    /**
     * Berechnet das NFP zweier Konturen (öffentliche API)
     */
    function computeNFP(contourA, contourB) {
        const pointsA = contourA?.points || contourA;
        const pointsB = contourB?.points || contourB;
        if (!pointsA || !pointsB || pointsA.length < 3 || pointsB.length < 3) {
            return null;
        }
        return _computeNFP(pointsA, pointsB);
    }

    // ═══════════════════════════════════════════════════════════════════
    // Öffentliche API
    // ═══════════════════════════════════════════════════════════════════

    console.debug(`${LOG_PREFIX} Modul geladen`);

    return {
        // Haupt-API
        nest,
        applyPlacements,

        // Utility
        getSheetUtilization,
        partFitsSheet,
        getPlacementPreview,
        computeNFP,

        // Konfiguration
        DEFAULT_CONFIG: { ...DEFAULT_CONFIG },

        // Version
        VERSION
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NestingEngine;
}
