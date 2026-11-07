/**
 * CeraCUT CamContour V5.31 - IGEMS-konformes Lead-In/Out System
 * V5.31: Feat — Ueberschnitt an Ecken automatisch gesperrt (isStartAtCorner/isOvercutBlocked, overcutAtCorners/overcutCornerAngle).
 * V5.30: Feat — AP2 Bogenwinkel (leadInArcAngle/leadOutArcAngle, Default 90): Arc-Lead als Viertel- bis 3/4-Kreis
 *        (Waricam "3/4 Kreis"); toJSON/clone mitgefuehrt.
 * V5.29: Refactor — AP1 S7: alte Bogen-Metadaten der Leads (arcCenter/arcRadius/arcStartAngle/arcEndAngle/
 *        arcSweepCCW/hasLinePortion) entfernt; kein Konsument mehr (Renderer/PP/Simulator nutzen segments).
 * V5.28: Feat — AP1 S4b: Leads und Ueberschnitt werden auf der TEILEGEOMETRIE berechnet (_leadBasisPts) statt auf der
 *        Kerf-Offset-Bahn. Waricam-Referenz (HEIDE6000101587.CNC): Geometrie + G41/G42, Lead-In endet exakt auf dem
 *        Konturstart. Neu: getLeadInToolSegments()/getLeadOutToolSegments()/overcut.toolPoints = reale Strahlmitte
 *        (nur Anzeige: Anfahrsatz unkompensiert, Rest um kerf/2 versetzt, G40-Satz unkompensiert). Abstaende:
 *        Nachbar-Margin + Fugenbreite, Engstellen-Kappung minus Fugenbreite (vorher implizit durch Offset-Bahn).
 * V5.27: Fix — _minSelfClearance() wertete Nachbarsegmente einer glatten Kurve als gegenueberliegende
 *        Wand: auf Kreisen/Rundungen wurde jeder Lead auf ~0.5 mm gekappt (V6.43-Kappung). Jetzt zaehlen
 *        nur Segmente, deren Weg ENTLANG der Kontur > 2x ihres direkten Abstands ist (echte Engstelle).
 * V5.26: Fix — _isAtCorner() lieferte Supplementwinkel (gerade = 175 Grad statt 0) -> fast jede Stelle
 *        galt als Ecke, JEDER Arc-Lead wurde zu linear degradiert. Jetzt Drehwinkel (gerade 0,
 *        90-Grad-Ecke 90). Effekt: Arc-Leads entstehen wieder auf glatten Konturen/Kanten-
 *        mitten; an echten Ecken (> cornerDegradeThreshold) weiter cornerLeadType.
 * V5.25: Refactor — AP1 S2: Lead-Builder (linear/arc/tangent In+Out, Center-Pierce/-Exit) erzeugen
 *        jetzt echte Segmente ueber lead-geometry.js (leadPath.segments = Wahrheit, points nur
 *        abgeleitet via toPolyline, Tess-Tol 0.005 mm). Kollisions-Kuerzen trimmt die Segmente
 *        (Bogen bleibt Bogen) statt nur die Punktliste. Alte Felder (arcCenter/arcRadius/
 *        arcStartAngle/arcEndAngle/arcSweepCCW/hasLinePortion) bleiben fuer Renderer/PP.
 *        Verifiziert gegen Golden (279 Szenarien, tests/). Verhalten unveraendert.
 * V5.21: Fix — getPiercingR923(): 'auto' mapped jetzt auf R923=9 (Rotationsanschuss)
 *        statt R923=1 (Linearer Anschuss). L201-Subroutine dieser Maschine kennt R923=1
 *        nicht (oder braucht undokumentierte R918/R919-Parameter) → "fehlende Anschuss-
 *        parameter" Alarm. WARICAM (Referenz) verwendet R923=9 für alle Konturen.
 *        Fallback ?? ebenfalls auf 9 geändert.
 * V5.20: Fix — _truncatePathToHalfLength() indexierte points[0] ohne vorherige
 *        Längenprüfung: bei leerem Array → return [undefined]. Neuer Guard
 *        if (!points || points.length === 0) return [] vor der _pathLength()-Berechnung.
 * V5.19: Refactor — Eigene Corner-Lead-Kategorie (analog IGEMS External/Internal/
 *        Corner/Alternative, Kap. 10.13.2) statt verstreuter Magic-Number-Overrides:
 *        neue Properties cornerLeadType/cornerLeadAngle/cornerDegradeThreshold
 *        (Default 'linear'/0°/60° = 1:1 altes Verhalten), in getLeadInPath()/
 *        getLeadOutPath() referenziert statt hart codierter Werte. Zusaetzlich:
 *        konsolidierter _minSelfClearance()-Helper (Engstellen-Abstandsmessung) —
 *        ersetzt die bisher separate, laengen-proportionale (Bug-anfaellige)
 *        Skip-Radius-Logik in _calcClearanceScore() durch dieselbe fixe Schwelle wie
 *        _capLengthForNarrowChannel() (jetzt duenner Wrapper um den Helper).
 * V5.18: Fix — V5.17 (Halbierung bei Selbst-Kollision) griff nur, wenn der Lead die
 *        gegenueberliegende Kante tatsaechlich KREUZT (Segment-Schnitt-Test). Ein an
 *        Ecken auf 0° (tangential) erzwungener Lead (V5.16) laeuft in einem engen,
 *        gekruemmten Kanal aber LAENGS, ohne je zu kreuzen — lief dadurch ungebremst bis
 *        zum Ende des Kanals (sichtbar als langer Lead, der durch die ganze Kontur
 *        laeuft). Neue _capLengthForNarrowChannel() kappt die Lead-Laenge jetzt VOR der
 *        Pfad-Berechnung direkt auf die Haelfte des kuerzesten Eigenabstands (= halbe
 *        Kanalbreite), unabhaengig von der Lead-Richtung. leadInLength/leadOutLength
 *        werden dabei nur temporaer ueberschrieben und danach wiederhergestellt (wie
 *        bisher bei Dynamic Lead) — keine dauerhafte Mutation der konfigurierten Werte.
 * V5.17: Feat — Bei engen Konturen (Selbst-Kollision in _shortenLeadIfCollision, d.h.
 *        gegenueberliegende Kante derselben Kontur sehr nah) wird der Lead jetzt nur bis
 *        zur HAELFTE der Distanz zur Kante gekuerzt statt bis zur Kante selbst — der Pierce-
 *        Punkt bleibt damit in der Mitte des engen Freiraums statt durch Kerf-Toleranzen
 *        real auf/jenseits der gegenueberliegenden Kante zu landen. Neue
 *        _truncatePathToHalfLength() Helper.
 * V5.16: Feat — Linearer Lead-Winkel an Ecken (isSharpVertexCorner) jetzt 0° (rein
 *        tangential zum Eck-Bisektor) statt vorher 90° (senkrecht zur Verschnittflaeche).
 *        Auf Anfrage: an 90°-Ecken soll der Lead entlang der Eck-Diagonale anlaufen statt
 *        frontal senkrecht (getLeadInPath/getLeadOutPath safeLinearAngle).
 * V5.15: Fix — Arc-Lead an echten Ecken (z.B. 90°-Aussenecken) erzeugte eine unnoetige
 *        S-Schleife (Gerade+Bogen tangential nur zum Bisektor, nicht zur tatsaechlichen
 *        Kante — der Tangentialitaets-Vorteil eines Arcs ist an einer Ecke ohnehin
 *        hinfaellig). Degradier-Schwelle in getLeadInPath()/getLeadOutPath() von >120°
 *        auf >60° gesenkt — normale Rechteckecken (90°) bekommen jetzt automatisch
 *        Linear-Lead, sanfte Knicke (<60°, z.B. grob tessellierte Kurven) behalten Arc.
 * V5.14: Fix — Lead an Konturecken (v.a. konkave "Innenecken") konnte ins Werkstück
 *        schneiden: getLeadInPath()/getLeadOutPath() berechneten Tangente/Normale bisher
 *        NUR aus der auslaufenden Kante — an einer Ecke zeigt das teils auf die falsche
 *        Seite. Neue _getCornerSafeLeadBasis() bildet den Bisektor aus einlaufender UND
 *        auslaufender Kanten-Normale (degeneriert auf gerader Strecke zur alten Normale,
 *        keine Verhaltensaenderung dort). Zusaetzlich: linearer Lead-Winkel wird an
 *        erkannten Ecken auf 90° (rein senkrecht in die Verschnittflaeche) erzwungen,
 *        da ein flacher/tangentialer Winkel an Ecken generell unsicher ist — eigene
 *        vorzeichen-unabhaengige Ecken-Erkennung (Tangenten-Dot-Product), da die
 *        bestehende _isAtCorner() konvex/konkav-blind ist und genau die fraglichen
 *        Innenecken-Faelle nicht erkennt.
 *        Ausserdem: setStartPoint() snappte bisher IMMER auf den naechsten existierenden
 *        Vertex statt auf die tatsaechliche Drag-Position — auf langen geraden Kanten
 *        ohne Zwischenpunkte (z.B. aus DXF) konnte der Startpunkt dadurch nur auf die
 *        Eckpunkte springen, nie dazwischen. Jetzt: Punkt wird bei Bedarf exakt an der
 *        Drag-Position eingefuegt (Segment-Split), Snap auf Vertex nur noch in dessen
 *        unmittelbarer Naehe (MIN_SEGMENT-Toleranz).
 * V5.13: Fix — _getWasteSideNormal() ignorierte kerfFlipped ("Kompensation auf
 *        Gegenseite"): getKerfOffsetPolyline() kehrte bei kerfFlipped=true die
 *        Verschnittseite korrekt um, die Lead-Normale tat das nicht — Innen-Leads
 *        bei geflipptem Loch-Kerf zeigten dadurch ins Werkstück statt in die
 *        (neue) Verschnittseite. Beide Stellen nutzen jetzt die neue
 *        _isEffectivelyHole()-Methode als einzige Quelle der Wahrheit.
 * V5.12: Lead-Überarbeitung — (1) Radius-0-Guard in _calcArcLeadIn/_calcArcLeadOut
 *        (kollabierendes Bogenzentrum erzeugte entryAngle=atan2(0,0)=0 IMMER statt
 *        tangential zur Schnittrichtung), (2) Lead-Out Sicherheitsnetz-Parität mit
 *        Lead-In: Alt-Lead-Fallback + Center-Exit-Fallback in getLeadOutPath(),
 *        Dog-Leg-Routing (_tryDogLegLeadOut) in checkMultiContourCollision(),
 *        leadOutType unterstützt jetzt auch 'tangent'/'on_geometry' (war lautlos
 *        auf 'linear' degradiert, obwohl über leadOutType=leadInType erreichbar)
 * V5.11: entitySeams[] Property — echte Naht-Distanzen aus DXFParser.chainContours() (statt
 *        blinder Punktlisten-Scan), Basis für Gap-Erkennung in ceracut-pipeline.js V3.8
 * V5.10: toJSON()/fromJSON() für Dokument-Persistenz (Multi-Tab) — denylist-basiert,
 *        überträgt alle Datenfelder (auch extern angehängte wie sourceType/_splineData/
 *        microjoints/nestingLevel) außer Cache-/Transient-Feldern
 * V5.9: Fix — effectiveLength wird bei Lead-Verkürzung gesetzt (Validation-Warnung zeigte immer 0%), clone() überträgt startPointIndex
 * Small-Hole: Center-Pierce bei kleinen RUNDEN Bohrungen (Aspekt < 2.5:1)
 * Corner-Lead: linear bei Ecken, Arc bei Segmenten
 * Collision-Detection V2: Distance-based, Lead-In/Out-aware, Fallback
 * Kerf-Flip, Auto-Shorten bei Kontur-Schnitt
 * V4.5: Außen/Innen-Lead Differenzierung, clone(), IGEMS 4-Slot Fallback-Kette
 * V4.6: Alternativ-Lead Property-Rename (altLeadInLength/Angle/OutLength/Overcut)
 * V4.7: Multi-Kontur Collision Detection — Lead vs. ALLE Konturen
 * V4.8: Lead-Routing Strategien A (Rotation) + B (Dog-Leg), isRotated/isAlternative Flags
 * V5.0: leadManualOverride Property für Profil-Batch-Schutz
 * V5.1: Clearance-Scored Lead Placement — beste Position statt erste kollisionsfreie
 * V5.2: Corner-Penalty + Flat-Segment-Bonus
 * V5.3: autoPlace bevorzugt Flat-Segments, Arc-Degradierung nur >120°
 * V5.5: materialGroup + intarsiaRole für Multi-Material Intarsien
 * V5.4: Hatch-Property (Schraffur — reine Visualisierung) + clone()-Support
 * V5.6: Hatch als eigenständige CamContour (cuttingMode='none', isHatchContour)
 * V5.7: Gap Detection — gaps[], healedGaps[] Properties + hasGaps()/clearGapData()
 * Last Modified: 2026-11-06
 * Build: 20261106-arcangle
 */

class CamContour {
    /** V5.25: max. Sehnenfehler (mm) der Lead-Tessellierung (LeadGeometry.toPolyline) */
    static get LEAD_TESS_TOL() { return 0.005; }

    constructor(points, options = {}) {
        this.points = points || [];
        this.name = options.name || `Contour_${CamContour.nextId++}`;
        this.cuttingMode = options.cuttingMode || null;  // 'disc' | 'hole' | 'none' | null
        this.kerfWidth = options.kerfWidth ?? 0.8;
        this.kerfSide = 'left';
        this.quality = options.quality ?? 2;
        // options.isClosed===true (Parser-Chaining mit groeberer Toleranz) hat Vorrang vor Eigenerkennung
        this.isClosed = (options.isClosed === true && this.points.length >= 3) ? true : this._detectClosed();
        this.layer = options.layer || '';
        this.isReference = options.isReference || false;
        this.type = options.type || null;

        // ═══ LEAD-IN Parameter (IGEMS-konform) ═══
        this.leadInType = options.leadInType || 'arc';       // 'arc' | 'linear' | 'tangent' | 'on_geometry'
        this.leadInLength = options.leadInLength ?? 4.0;
        this.leadInRadius = options.leadInRadius ?? 2.0;
        this.leadInAngle = options.leadInAngle ?? 90;
        this.leadInArcAngle = options.leadInArcAngle ?? 90;   // V5.30: Bogenwinkel (Grad) des Arc-Leads: 90 = Viertelkreis, 270 = 3/4-Kreis

        // ═══ LEAD-OUT Parameter ═══
        this.leadOutType = options.leadOutType || 'arc';
        this.leadOutLength = options.leadOutLength ?? 4.0;
        this.leadOutRadius = options.leadOutRadius ?? 2.0;
        this.leadOutAngle = options.leadOutAngle ?? 90;
        this.leadOutArcAngle = options.leadOutArcAngle ?? this.leadInArcAngle;

        // ═══ CORNER-LEAD (eigener Slot analog IGEMS External/Internal/Corner/Alternative,
        // Kap. 10.13.2) — vorher als Magic Numbers (60°, 0°) mitten in getLeadInPath()/
        // getLeadOutPath() verstreut, jetzt benannte, konfigurierbare Eck-Kategorie. ═══
        this.cornerLeadType = options.cornerLeadType || 'linear';            // 'linear' | 'arc' | 'tangent'
        this.cornerLeadAngle = options.cornerLeadAngle ?? 0;                 // war hart 0 (V6.40)
        this.cornerDegradeThreshold = options.cornerDegradeThreshold ?? 60;  // war hart 60 (V6.39)

        // ═══ OVERCUT (kann auch negativ sein) ═══
        this.overcutLength = options.overcutLength ?? 1.0;
        this.overcutAtCorners = options.overcutAtCorners ?? false;   // V5.31: false = Ueberschnitt an Ecken automatisch gesperrt
        this.overcutCornerAngle = options.overcutCornerAngle ?? 14;  // V5.31: Knickwinkel (Grad) am Konturstart, ab dem "Ecke" gilt

        // ═══ PIERCING (B.1 — IGEMS 6 Typen) ═══
        // Werte: 'auto'|'blind'|'pierce_linear'|'stationary'|'circular'|'drilling'|'air_start'
        // R923-Mapping: auto=1, blind=9, pierce_linear=1, stationary=2, circular=3, drilling=4, air_start=0
        this.piercingType = options.piercingType || 'auto';
        this.piercingStationaryTime  = options.piercingStationaryTime  ?? 1.5;  // R924 [s]
        this.piercingCircularRadius  = options.piercingCircularRadius  ?? 2.0;  // R925 [mm]
        this.piercingCircularTime    = options.piercingCircularTime    ?? 2.0;  // R926 [s]

        // ═══ DYNAMIC LEAD (B.2) ═══
        this.leadInDynamic   = options.leadInDynamic   ?? false;
        this.leadInLengthMin = options.leadInLengthMin ?? 1.0;   // mm
        this.leadInLengthMax = options.leadInLengthMax ?? 15.0;  // mm

        // ═══ FLÄCHENKLASSEN (B.3) ═══
        // Wird von außen als areaClassApplied gesetzt (kein eigenes Berechnen hier)
        this.areaClassApplied = false;  // true wenn Flächenklasse angewendet wurde

        // ═══ CORNER LEAD ═══
        this.preferCorners = options.preferCorners ?? true;
        this.cornerAngleThreshold = options.cornerAngleThreshold || 30;

        // ═══ ALTERNATIV-LEAD (IGEMS Slot 4 — Fallback bei Kollision) ═══
        this.altLeadEnabled   = options.altLeadEnabled ?? true;
        this.altLeadType      = options.altLeadType || 'linear';
        this.altLeadInLength  = options.altLeadInLength || 3.0;
        this.altLeadInAngle   = options.altLeadInAngle || 5;
        this.altLeadOutLength = options.altLeadOutLength || 2.0;
        this.altOvercutLength = options.altOvercutLength || 2.0;

        // ═══ LEAD MANUAL OVERRIDE (V5.0 — Batch-Schutz) ═══
        this.leadManualOverride = options.leadManualOverride ?? false;

        // ═══ HATCH (Schraffur — eigenständige Kontur mit cuttingMode='none') ═══
        this.hatch = options.hatch || null;
        // Format: { pattern: 'solid'|'lines'|'cross'|'dots', color: null|CSS, angle: 45, spacing: 3, opacity: 0.25 }
        this.isHatchContour = options.isHatchContour ?? false;  // true = Hatch-Entity (wird nie geschnitten)
        this.parentContourName = options.parentContourName || null;  // Name der Eltern-Kontur

        // ═══ MULTI-MATERIAL INTARSIEN (V5.5) ═══
        this.materialGroup = options.materialGroup ?? 0;       // 0-4 (Index in CeraCUT.INTARSIA_MATERIALS)
        this.intarsiaRole = options.intarsiaRole || null;      // 'base'|'insert'|null
        // Format: { pattern: 'solid'|'lines'|'cross'|'dots', color: null|CSS, angle: 45, spacing: 3, opacity: 0.25 }

        // ═══ SPLINE FIT-POINTS (V5.8) ═══
        this._fitPoints = options._fitPoints || null;       // Array<{x,y}> — Original-Klickpunkte
        this._splineClosed = options._splineClosed ?? null; // true/false/null

        // ═══ GAP DETECTION (Offene Konturen) ═══
        this.gaps = [];           // [{x1,y1, x2,y2, distance, type:'open'|'healable'}]
        this.healedGaps = [];     // [{x1,y1, x2,y2, originalDistance}]
        this.entitySeams = [];    // [{x1,y1, x2,y2, distance}] — echte Naht-Distanzen aus dem Chaining (V5.11)

        // ═══ KERF FLIP (Kompensationsseite umkehren) ═══
        this.kerfFlipped = false;  // true = Kerf auf Gegenseite (Legacy, gilt nur bei kerfComp='auto')
        // V5.24: Explizite Kerf-Seite: 'auto' (Scheibe aussen / Loch innen, + kerfFlipped)
        //        | 'left' | 'right' (Werkzeug links/rechts der Schnittrichtung = G41/G42) | 'online' (G40)
        this.kerfComp = options.kerfComp || 'auto';

        // ═══ Interne States ═══
        this.startPointIndex = 0;
        this._rotationCount = 0;  // Zähler für Cache-Invalidierung bei Startpunkt-Rotation
        this.cutOrder = null;
        this.isSelected = false;
        this.isHovered = false;
        this._cachedKerfPolyline = null;
        this._cacheKey = null;
        this._cachedLeadInPath = null;
        this._cachedLeadOutPath = null;
        this._cachedOvercutPath = null;
        this.compensationSkipped = false;
        this.tooSmall = false;
    }

    _detectClosed() {
        if (this.points.length < 3) return false;
        const first = this.points[0];
        const last = this.points[this.points.length - 1];
        return Geometry.distance(first, last) < 0.01;
    }

    // ═══ GAP DETECTION HELPERS ═══
    hasGaps() { return this.gaps.length > 0; }

    clearGapData() {
        this.gaps = [];
        this.healedGaps = [];
    }

    // ════════════════════════════════════════════════════════════════
    // KERF OFFSET
    // ════════════════════════════════════════════════════════════════

    getKerfOffsetPolyline() {
        const cacheKey = `${this.kerfWidth}_${this.kerfSide}_${this.cuttingMode}_${this.points.length}_${this._rotationCount}_${this.kerfFlipped}_${this.kerfComp}`;
        if (this._cachedKerfPolyline && this._cacheKey === cacheKey) {
            return this._cachedKerfPolyline;
        }

        const cacheResult = (result) => {
            this._cachedKerfPolyline = result;
            this._cacheKey = cacheKey;
            return result;
        };

        if (this.kerfSide === 'online' || this.kerfComp === 'online' || this.kerfWidth <= 0) {
            return cacheResult({ points: this.points, flipped: false });
        }
        if (!this.points || this.points.length < 3) {
            return cacheResult({ points: this.points, flipped: false });
        }
        if (!this.isClosed) {
            this.compensationSkipped = true;
            return cacheResult({ points: this.points, flipped: false, isOpen: true });
        }
        if (!this.cuttingMode) {
            return cacheResult({ points: this.points, flipped: false });
        }

        const d = this.kerfWidth / 2;
        const isHole = this._isEffectivelyHole();
        const Area_Original = Math.abs(Geometry.getSignedArea(this.points));

        if (Area_Original < 0.01) {
            this.compensationSkipped = true;
            this.tooSmall = true;
            return cacheResult({ points: this.points, flipped: false });
        }

        let trialOffset = Geometry.offsetPolygon(this.points, d, this.isClosed);
        if (!trialOffset || trialOffset.length < 3) {
            this.compensationSkipped = true;
            return cacheResult({ points: this.points, flipped: false });
        }

        const Area_Trial = Math.abs(Geometry.getSignedArea(trialOffset));
        if (isNaN(Area_Trial) || Area_Trial < 1e-10) {
            this.compensationSkipped = true;
            return cacheResult({ points: this.points, flipped: false });
        }

        const areaTolerance = Area_Original * 0.001;
        let validationFailed = false;
        let finalOffset = trialOffset;
        let flipped = false;

        if (isHole) {
            if (Area_Trial >= Area_Original - areaTolerance) validationFailed = true;
        } else {
            if (Area_Trial <= Area_Original + areaTolerance) validationFailed = true;
        }

        if (validationFailed) {
            finalOffset = Geometry.offsetPolygon(this.points, -d, this.isClosed);
            if (!finalOffset || finalOffset.length < 3) {
                this.compensationSkipped = true;
                return cacheResult({ points: this.points, flipped: false });
            }
            const Area_Flipped = Math.abs(Geometry.getSignedArea(finalOffset));
            if (isNaN(Area_Flipped) || Area_Flipped === 0) {
                this.compensationSkipped = true;
                return cacheResult({ points: this.points, flipped: false });
            }
            if (isHole) {
                if (Area_Flipped >= Area_Original - areaTolerance) {
                    this.compensationSkipped = true;
                    return cacheResult({ points: this.points, flipped: false });
                }
            } else {
                if (Area_Flipped <= Area_Original + areaTolerance) {
                    this.compensationSkipped = true;
                    return cacheResult({ points: this.points, flipped: false });
                }
            }
            flipped = true;
        }

        const Area_Final = Math.abs(Geometry.getSignedArea(finalOffset));
        if (!isFinite(Area_Final) || Area_Original < 1e-10 || Area_Final / Area_Original < 0.01) {
            this.compensationSkipped = true;
            return cacheResult({ points: this.points, flipped: false });
        }

        this.compensationSkipped = false;
        return cacheResult({ points: finalOffset, flipped });
    }

    /**
     * V5.13: Einzige Quelle der Wahrheit für "ist diese Kontur (kerf-technisch) ein Loch?".
     * kerfFlipped ("Kompensation auf Gegenseite") kehrt die Verschnittseite um — JEDE Stelle,
     * die zwischen Loch/Scheibe-Verschnittseite unterscheidet (Kerf-Offset-Richtung, G41/G42,
     * Lead-Waste-Side-Normale), MUSS diese Methode nutzen statt cuttingMode direkt zu prüfen.
     * Sonst genau der Bug aus V5.13: eine Stelle vergisst kerfFlipped, Lead zeigt ins Werkstück.
     */
    _isEffectivelyHole() {
        return this._effectiveFlip()
            ? (this.cuttingMode !== 'hole')
            : (this.cuttingMode === 'hole');
    }

    /**
     * V5.24: Wirksames Flip-Flag. 'auto'/'online' -> kerfFlipped (Legacy).
     * 'left'/'right' -> Flip genau dann, wenn die gewuenschte Seite von der
     * un-geflippten Verschnittseite (disc/hole + Umlaufsinn) abweicht.
     */
    _effectiveFlip() {
        const c = this.kerfComp;
        if (c !== 'left' && c !== 'right') return !!this.kerfFlipped;
        const isCW = Geometry.getSignedArea(this.points) > 0;
        const wasteLeft = ((this.cuttingMode === 'hole') === isCW);   // un-geflippt
        return (c === 'left') !== wasteLeft;
    }

    /** V5.24: Aufgeloeste Seite fuer UI/Postprozessor: 'left' | 'right' | 'online'. */
    resolveKerfSide() {
        if (this.kerfComp === 'online' || this.kerfSide === 'online') return 'online';
        const isCW = Geometry.getSignedArea(this.points) > 0;
        const wasteLeft = (this._isEffectivelyHole() === isCW);
        return wasteLeft ? 'left' : 'right';
    }

    /** V5.24: Kerf-Seite setzen (auto|left|right|online) und Caches invalidieren. */
    setKerfComp(mode) {
        this.kerfComp = mode;
        this.invalidate();
    }

    // ════════════════════════════════════════════════════════════════
    // WASTE-SIDE NORMAL (Centroid-basiert)
    // ════════════════════════════════════════════════════════════════

    /**
     * Bestimmt die Normale an einem Konturpunkt, die zur VERSCHNITTSEITE zeigt.
     * Disc: Verschnitt AUSSEN -> Normale weg vom Centroid
     * Hole: Verschnitt INNEN  -> Normale zum Centroid
     */
    _getWasteSideNormal(point, tangent) {
        // V5.3: Shoelace-basierte Windungsrichtung (robust, auch bei nicht-konvexen Konturen)
        // Links-Normale der Tangente: (-tangent.y, tangent.x)
        let nx = -tangent.y;
        let ny = tangent.x;

        const signedArea = Geometry.getSignedArea(this.points);
        const isCW = signedArea > 0;
        const isHole = this._isEffectivelyHole();

        // CW: Links-Normale zeigt EINWÄRTS, CCW: AUSWÄRTS
        // Disc (Waste=außen): Normale soll AUSWÄRTS → CW: flip
        // Hole (Waste=innen): Normale soll EINWÄRTS → CCW: flip
        if (isHole) {
            if (!isCW) { nx = -nx; ny = -ny; }
        } else {
            if (isCW) { nx = -nx; ny = -ny; }
        }

        return { x: nx, y: ny };
    }

    /**
     * V5.14: Eckpunkt-sichere Tangente/Normale fuer Lead-Berechnung an einem Vertex.
     *
     * _getWasteSideNormal() betrachtet nur EINE Kante (die uebergebene Tangente). An
     * einem Eckpunkt ist das unzureichend: die einlaufende und auslaufende Kante zeigen
     * in unterschiedliche Richtungen, und besonders an konkaven ("Innenecken") Ecken kann
     * eine allein auf der Ausgangskante basierende Normale auf die FALSCHE Seite zeigen
     * (ins Werkstueck statt in die Verschnittflaeche) — siehe Lessons 2026-06-24.
     *
     * Fix: Normale = Bisektor der Verschnitt-Normalen BEIDER angrenzender Kanten. Auf
     * geraden Strecken (t_in ≈ t_out) ist das Ergebnis identisch zur Einzelkanten-Normale
     * (keine Verhaltensaenderung), an Ecken zeigt der Bisektor zuverlaessig in den
     * tatsaechlichen Verschnitt-Keil — auch wenn dieser an einer Innenecke sehr schmal ist.
     *
     * @param {{x,y}} vertex - Punkt an dem die Tangenten zusammentreffen
     * @param {{x,y}} tangentIn - Richtung der EINLAUFENDEN Kante (zeigt zum vertex hin)
     * @param {{x,y}} tangentOut - Richtung der AUSLAUFENDEN Kante (zeigt vom vertex weg)
     * @returns {{tangent:{x,y}, normal:{x,y}}}
     */
    _getCornerSafeLeadBasis(vertex, tangentIn, tangentOut) {
        const normalIn = this._getWasteSideNormal(vertex, tangentIn);
        const normalOut = this._getWasteSideNormal(vertex, tangentOut);

        let bx = normalIn.x + normalOut.x;
        let by = normalIn.y + normalOut.y;
        const bLen = Math.hypot(bx, by);

        // Degenerierter Fall (~180°-Spitze, Normalen heben sich fast auf): Ausgangskante behalten
        const normal = bLen > 0.01 ? { x: bx / bLen, y: by / bLen } : normalOut;
        // Tangente aus Normale rekonstruieren — Umkehrung von _getWasteSideNormal's
        // Links-Normale-Beziehung (-ty,tx): tangent = (ny, -nx)
        // Flip-Faelle (Disc CCW / Hole CW) beruecksichtigen: s=+1 wenn Normale = Links-Normale,
        // sonst -1 (Normale wurde in _getWasteSideNormal gespiegelt).
        const leftDot = normalOut.x * (-tangentOut.y) + normalOut.y * tangentOut.x;
        const s = leftDot >= 0 ? 1 : -1;
        const tangent = { x: s * normal.y, y: -s * normal.x };

        return { tangent, normal };
    }

    // ════════════════════════════════════════════════════════════════
    // CORNER DETECTION
    // ════════════════════════════════════════════════════════════════

    /**
     * Prüft ob der Startpunkt (Index 0) an einer Ecke liegt.
     * Gibt den Eckenwinkel in Grad zurück, oder 0 wenn keine Ecke.
     */
    _isAtCorner(pts) {
        if (!pts || pts.length < 4) return 0;
        const n = pts.length;
        const isClosed = Geometry.distance(pts[0], pts[n - 1]) < 0.01;
        if (!isClosed) return 0;

        // Vorgänger = vorletzter Punkt (da letzter = erster bei closed)
        const prev = pts[n - 2];
        const curr = pts[0];
        const next = pts[1];

        const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
        const len1 = Math.hypot(dx1, dy1), len2 = Math.hypot(dx2, dy2);
        if (len1 < 0.001 || len2 < 0.001) return 0;

        // V5.26 Fix: dot der beiden RICHTUNGSvektoren (prev->curr, curr->next) ergibt den
        // DREHWINKEL (gerade = 0 Grad, 90-Grad-Ecke = 90 Grad). Vorher wurde pi - Drehwinkel
        // verwendet (gerade = 180 Grad) -> fast jede Stelle galt als Ecke und JEDER Arc-Lead
        // wurde zu cornerLeadType (linear) degradiert.
        const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
        const turnDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;

        return turnDeg > this.cornerAngleThreshold ? turnDeg : 0;
    }

    // ════════════════════════════════════════════════════════════════
    // SMALL-HOLE DETECTION
    // ════════════════════════════════════════════════════════════════

    /**
     * Berechnet den effektiven Radius einer geschlossenen Kontur.
     * Nutzt Fläche für Kreise: r = sqrt(A/π)
     * Fallback: halbe Bounding-Box-Diagonale.
     */
    _getEffectiveRadius(pts) {
        if (!pts || pts.length < 3) return Infinity;
        const area = Math.abs(Geometry.getSignedArea(pts));
        if (area < 0.001) return Infinity;
        // Flächenbasierter Radius (exakt für Kreise, konservativ für andere)
        return Math.sqrt(area / Math.PI);
    }

    /**
     * Prüft ob die Kontur ein "kleines Loch" ist.
     * Klein = Lead-Länge oder Arc-Radius größer als der effektive Radius.
     * NUR für annähernd kreisförmige Löcher (Aspekt-Ratio < 2.5:1).
     * Dünne/längliche Formen (Halbmonde, Blätter) werden NICHT als small-hole behandelt.
     */
    _isSmallHole(pts) {
        if (!this._isEffectivelyHole()) return false;
        if (!pts || pts.length < 3) return false;

        // Aspekt-Ratio prüfen: nur annähernd kreisförmige Formen
        const bb = Geometry.boundingBox(pts);
        if (!bb) return false;
        const w = bb.maxX - bb.minX;
        const h = bb.maxY - bb.minY;
        const minDim = Math.min(w, h);
        const maxDim = Math.max(w, h);
        if (minDim < 0.001) return false;
        const aspectRatio = maxDim / minDim;

        // Längliche Formen (> 2.5:1) sind KEINE "kleinen Bohrungen"
        if (aspectRatio > 2.5) return false;

        const r = this._getEffectiveRadius(pts);
        // Klein wenn Lead-Länge > Radius ODER Arc-Radius > halber Radius
        return (this.leadInLength > r) || (this.leadInRadius > r * 0.5);
    }

    /**
     * CENTER-PIERCE Lead-In für kleine Bohrungen.
     * Pierce-Punkt = Centroid, gerader Weg zum Entry-Punkt.
     */
    _calcCenterPierceLeadIn(entry, pts) {
        const centroid = Geometry.centroid(pts);
        return {
            points: [
                { x: centroid.x, y: centroid.y },
                { x: entry.x, y: entry.y }
            ],
            piercingPoint: { x: centroid.x, y: centroid.y },
            entryPoint: { x: entry.x, y: entry.y },
            segments: [LeadGeometry.line(centroid, entry)],
            type: 'center_pierce'
        };
    }

    /**
     * CENTER-EXIT Lead-Out für kleine Bohrungen.
     * Kurze Gerade vom Exit-Punkt Richtung Zentrum (halber Radius).
     */
    _calcCenterExitLeadOut(exit, pts) {
        const centroid = Geometry.centroid(pts);
        const dx = centroid.x - exit.x, dy = centroid.y - exit.y;
        const dist = Math.hypot(dx, dy);
        // Maximal halber Weg zum Zentrum
        const t = dist > 0.001 ? 0.5 : 0; // Halber Weg zum Zentrum
        const endPoint = {
            x: exit.x + dx * t,
            y: exit.y + dy * t
        };
        return {
            points: [
                { x: exit.x, y: exit.y },
                endPoint
            ],
            endPoint,
            segments: [LeadGeometry.line(exit, endPoint)],
            type: 'center_exit'
        };
    }

    // ════════════════════════════════════════════════════════════════
    // LEAD-IN
    // ════════════════════════════════════════════════════════════════

    getLeadInPath() {
        if (this._cachedLeadInPath) return this._cachedLeadInPath;

        // SLIT (offene Pfade): On-Geometry Piercing am Startpunkt (IGEMS Quick→Slit)
        if (!this.isClosed && this.cuttingMode === 'slit') {
            const pts = this.points;
            if (!pts || pts.length < 2) return null;
            const entry = pts[0];
            const next = pts[1];
            const dx = next.x - entry.x, dy = next.y - entry.y;
            const len = Math.hypot(dx, dy);
            const tangent = len > 0.0001 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
            this._cachedLeadInPath = this._calcOnGeometryLead(entry, tangent);
            return this._cachedLeadInPath;
        }

        const pts = this._leadBasisPts();   // V5.28: Leads auf der Teilegeometrie (Controller versetzt per G41/G42)
        if (!pts || pts.length < 3) return null;

        // SMALL HOLE: Pierce im Zentrum der Bohrung
        if (this._isSmallHole(pts)) {
            const leadPath = this._calcCenterPierceLeadIn(pts[0], pts);
            this._cachedLeadInPath = leadPath;
            return leadPath;
        }

        const entry = pts[0];
        const next = pts[1];
        const prevPt = pts[pts.length - 2]; // closed: pts[length-1] === pts[0]

        const dx = next.x - entry.x, dy = next.y - entry.y;
        const len = Math.hypot(dx, dy);
        const tangentOut = len > 0.0001 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };

        const dxIn = entry.x - prevPt.x, dyIn = entry.y - prevPt.y;
        const lenIn = Math.hypot(dxIn, dyIn);
        const tangentIn = lenIn > 0.0001 ? { x: dxIn / lenIn, y: dyIn / lenIn } : tangentOut;

        // V5.14: Eckpunkt-Bisektor statt nur Ausgangskante (siehe _getCornerSafeLeadBasis)
        const { tangent, normal } = this._getCornerSafeLeadBasis(entry, tangentIn, tangentOut);
        // V5.14: Eigene, vorzeichen-unabhaengige Ecken-Erkennung fuer die Winkel-Sicherheit
        // (_isAtCorner() ist Konvex/Konkav-blind und miss-klassifiziert genau die Innenecken-
        // Faelle, um die es hier geht — siehe Lessons 2026-06-24). >14° Tangentenabweichung.
        const isSharpVertexCorner = (tangentIn.x * tangentOut.x + tangentIn.y * tangentOut.y) < 0.97;

        // DYNAMIC LEAD (B.2): effektive Länge berechnen
        // DYNAMIC LEAD (B.2): temporär effektive Länge setzen, nach Berechnung wiederherstellen
        const _origLeadInLength = this.leadInLength;
        if (this.leadInDynamic) {
            this.leadInLength = this._calcDynamicLeadLength(entry, tangent, normal, pts);
        }

        // V6.43: Enge-Kontur-Kappung VOR der Pfad-Berechnung (nicht nur danach per
        // Kollisions-Kuerzung) — _shortenLeadIfCollision findet nur Treffer, wenn der Lead
        // tatsaechlich eine Kontur-Kante KREUZT. Ein tangentialer Lead (0°-Winkel an Ecken,
        // V6.40) laeuft in einem engen, gekruemmten Kanal aber oft LAENGS parallel zur
        // gegenueberliegenden Kante, ohne sie je zu kreuzen — die Kollisionspruefung griff
        // dort nicht und der Lead lief ungebremst bis zum Ende des Kanals. Kappt die Laenge
        // jetzt direkt auf die Haelfte des kuerzesten Eigenabstands (= halbe Kanalbreite).
        this.leadInLength = this._capLengthForNarrowChannel(entry, pts, this.leadInLength);
        // Arc-Radius mitkappen, sonst bleibt der volle 90°-Bogen trotz Laengenkappung bestehen
        const _origLeadInRadius = this.leadInRadius;
        if (this.leadInLength < _origLeadInLength - 1e-9 && this.leadInLength * 2 / Math.PI < this.leadInRadius) {
            this.leadInRadius = Math.max(0, this.leadInLength * 2 / Math.PI);
        }

        // CORNER-LEAD (eigener Slot, siehe Konstruktor): Arc zu cornerLeadType
        // degradieren ab echten Ecken (cornerDegradeThreshold, Default 60°, z.B. 90°-
        // Rechteckecken). Ein Arc-Lead ist tangential zu einer Schnittrichtung
        // konstruiert, an einer Ecke gibt es aber ZWEI Kantenrichtungen statt einer; der
        // Bogen kann nur zum Bisektor tangential sein, nicht zur tatsaechlichen Kante.
        // Der Tangentialitaets-Vorteil eines Arcs geht an der Ecke verloren (sichtbar als
        // unnoetige S-Schleife), waehrend auf flachen/sanften Segmenten (< Threshold,
        // z.B. grob tessellierte Kurven) Arc weiterhin sinnvoll bleibt (unveraendert).
        const cornerAngle = this._isAtCorner(pts);
        let effectiveType = this.leadInType;
        if (cornerAngle > this.cornerDegradeThreshold && effectiveType === 'arc') {
            effectiveType = this.cornerLeadType;
        }
        // An Ecken wird der Lead-Winkel auf cornerLeadAngle (Default 0° = rein tangential
        // zum Eck-Bisektor) erzwungen statt der Normalen — unabhaengig vom konfigurierten
        // leadInAngle.
        const safeLinearAngle = isSharpVertexCorner ? this.cornerLeadAngle : this.leadInAngle;

        let leadPath;
        switch (effectiveType) {
            case 'linear':
                leadPath = this._calcLinearLeadIn(entry, tangent, normal, safeLinearAngle);
                leadPath = this._shortenLeadIfCollision(leadPath, pts);
                break;
            case 'arc':
                leadPath = this._arcLeadInWithFallback(entry, tangent, normal, pts);
                break;
            case 'tangent':
                leadPath = this._calcTangentLeadIn(entry, tangent, normal);
                leadPath = this._shortenLeadIfCollision(leadPath, pts);
                break;
            case 'on_geometry':
                leadPath = this._calcOnGeometryLead(entry, tangent);
                break;
            default:
                leadPath = this._arcLeadInWithFallback(entry, tangent, normal, pts);
        }

        // V4.5: IGEMS Slot 4 — Alternativ-Lead Fallback bei starker Kollision
        if (leadPath?.shortened && this.altLeadEnabled) {
            const primaryLen = this._pathLength(leadPath.points);
            const requestedLen = this.leadInLength;
            // Fallback wenn Primary-Lead auf < 40% gekürzt wurde
            if (primaryLen < requestedLen * 0.4) {
                const altPath = this._tryAlternativeLeadIn(entry, tangent, normal, pts);
                if (altPath && (!altPath.shortened || this._pathLength(altPath.points) > primaryLen)) {
                    leadPath = altPath;
                    console.debug(`[CamContour V5.3] Alt-Lead: ${this.name} (${primaryLen.toFixed(1)}mm < 40% von ${requestedLen}mm)`);
                }
            }
        }

        // V4.5: Letzter Fallback — Center-Pierce wenn Lead immer noch stark kollidiert
        if (leadPath?.shortened && this.altLeadEnabled) {
            const finalLen = this._pathLength(leadPath.points);
            if (finalLen < 0.5) {
                leadPath = this._calcCenterPierceLeadIn(entry, pts);
                leadPath.isFallbackCenterPierce = true;
                console.debug(`[CamContour V5.3] Center-Pierce Fallback: ${this.name}`);
            }
        }

        // DYNAMIC LEAD + V6.43 Enge-Kontur-Kappung: User-Wert wiederherstellen (this.leadInLength
        // wurde oben temporär ueberschrieben — wie leadInDynamic muss auch die Kappung den
        // konfigurierten Wert unveraendert lassen, sonst "vergisst" die Kontur dauerhaft den
        // eingestellten Wert, sobald sie einmal an einer engen Stelle gekappt wurde).
        this.leadInLength = _origLeadInLength;
        this.leadInRadius = _origLeadInRadius;

        this._ensureSegments(leadPath);
        this._cachedLeadInPath = leadPath;
        return leadPath;
    }

    /**
     * LINEAR LEAD-IN - Gerade vom Pierce-Punkt zur Kontur
     * @param {number} [angleOverride] - V5.14: ersetzt this.leadInAngle (z.B. an scharfen
     *        Ecken auf 90° erzwungen — ein flacher/tangentialer Winkel ist dort unsicher,
     *        siehe getLeadInPath CORNER DETECTION)
     */
    _calcLinearLeadIn(entry, tangent, normal, angleOverride) {
        const segs = LeadGeometry.leadInLinear({
            join: entry, tangent, normal, length: this.leadInLength,
            angleDeg: (angleOverride !== undefined ? angleOverride : this.leadInAngle)
        });
        return this._leadFromSegments(segs, 'in', 'linear');
    }

    /**
     * ARC LEAD-IN (IGEMS Standard) - Kreisbogen tangential in die Kontur.
     * V5.25: Geometrie liegt in lead-geometry.js (echte Segmente). V5.29: alte Bogen-Metadaten
     * (arcCenter/arcRadius/...) entfernt — Renderer, Postprozessor und Simulator lesen `segments`.
     */
    /** V5.30: Bogenwinkel (Grad) -> Spannweite (rad), auf 30..300 Grad begrenzt, Default 90. */
    _arcSpan(deg) {
        const d = Number.isFinite(+deg) && +deg > 0 ? +deg : 90;
        return Math.min(300, Math.max(30, d)) * Math.PI / 180;
    }

    _calcArcLeadIn(entry, tangent, normal) {
        const radius = this.leadInRadius;
        const totalLength = this.leadInLength;
        // Radius <= 0: tangentialer Lead (V5.12), Typ bleibt 'arc'
        const segs = (radius <= 1e-6)
            ? LeadGeometry.leadInTangent({ join: entry, tangent, length: totalLength })
            : LeadGeometry.leadInArc({ join: entry, tangent, normal, radius, length: totalLength, span: this._arcSpan(this.leadInArcAngle) });
        return this._leadFromSegments(segs, 'in', 'arc');
    }

    /**
     * V5.25: Segmentliste -> Lead-Objekt. `points` ist NUR abgeleitet (einzige Tessellierung
     * in LeadGeometry.toPolyline), `segments` ist die Wahrheit.
     */
    _leadFromSegments(segs, role, type) {
        const points = LeadGeometry.toPolyline(segs, CamContour.LEAD_TESS_TOL);
        const first = points[0], last = points[points.length - 1];
        const lp = { points, segments: segs, type };
        if (role === 'in') { lp.piercingPoint = first; lp.entryPoint = { x: last.x, y: last.y }; }
        else { lp.endPoint = last; }
        return lp;
    }

    /** V5.25: Lead ohne Segmente (Dog-Leg, Fallbacks) -> Linien-Segmente aus points. */
    _ensureSegments(lp) {
        if (!lp || lp.segments) return lp;
        const pts = lp.points || [];
        lp.segments = [];
        for (let i = 1; i < pts.length; i++) lp.segments.push(LeadGeometry.line(pts[i - 1], pts[i]));
        return lp;
    }

    /**
     * V5.25: Gekuerzte Punktliste uebernehmen UND die Segmente passend kuerzen — Boegen
     * bleiben echte Boegen (kein Polylinien-Fallback). role: 'in' | 'out'.
     */
    _applyShortenedPoints(lp, newPts, role) {
        const oldPts = lp.points;
        if (!lp.segments || lp.segments.length === 0) {
            lp.points = newPts;
            lp.segments = null;
            this._ensureSegments(lp);
            return;
        }
        const oldPoly = this._pathLength(oldPts);
        const trueLen = LeadGeometry.pathLength(lp.segments);
        const removed = oldPoly > 1e-12 ? (oldPoly - this._pathLength(newPts)) * (trueLen / oldPoly) : 0;
        const trimmed = LeadGeometry.trim(lp.segments, Math.max(0, removed), role === 'in' ? 'start' : 'end');
        if (!trimmed.length) {
            lp.points = newPts;
            lp.segments = null;
            this._ensureSegments(lp);
            return;
        }
        lp.segments = trimmed;
        lp.points = LeadGeometry.toPolyline(trimmed, CamContour.LEAD_TESS_TOL);
    }

    /**
     * TANGENTIAL LEAD-IN - Gerade entlang umgekehrter Schnittrichtung
     */
    _calcTangentLeadIn(entry, tangent, normal) {
        return this._leadFromSegments(
            LeadGeometry.leadInTangent({ join: entry, tangent, length: this.leadInLength }), 'in', 'tangent');
    }

    /**
     * ON-GEOMETRY LEAD (IGEMS Piercing Type 0) - Kein sichtbarer Lead-In
     */
    _calcOnGeometryLead(entry, tangent) {
        return {
            points: [{ x: entry.x, y: entry.y }],
            piercingPoint: { x: entry.x, y: entry.y },
            entryPoint: { x: entry.x, y: entry.y },
            segments: [],
            type: 'on_geometry',
            linearPiercingLength: this.leadInLength
        };
    }

    /**
     * ARC LEAD-IN mit progressivem Fallback:
     * 1) Voller Arc → Collision-Check
     * 2) Wenn Lead zu kurz gekürzt → halber Radius
     * 3) Wenn immer noch Collision → Linear-Fallback
     */
    _arcLeadInWithFallback(entry, tangent, normal, contourPts) {
        const origRadius = this.leadInRadius;

        // 1) Voller Arc versuchen
        let leadPath = this._calcArcLeadIn(entry, tangent, normal);
        const fullLen = this._pathLength(leadPath.points);
        leadPath = this._shortenLeadIfCollision(leadPath, contourPts);
        if (!leadPath.shortened) return leadPath;  // Passt → fertig
        if (this._pathLength(leadPath.points) > fullLen * 0.5) return leadPath;  // Leicht gekürzt → OK

        // 2) Halber Radius versuchen
        this.leadInRadius = origRadius * 0.5;
        leadPath = this._calcArcLeadIn(entry, tangent, normal);
        this.leadInRadius = origRadius;
        const halfLen = this._pathLength(leadPath.points);
        leadPath = this._shortenLeadIfCollision(leadPath, contourPts);
        if (!leadPath.shortened) return leadPath;
        if (this._pathLength(leadPath.points) > halfLen * 0.5) return leadPath;

        // 3) Linear-Fallback
        leadPath = this._calcLinearLeadIn(entry, tangent, normal);
        return this._shortenLeadIfCollision(leadPath, contourPts);
    }

    /** Gesamtlänge eines Punkt-Pfads */
    _pathLength(pts) {
        if (!pts || pts.length < 2) return 0;
        let len = 0;
        for (let i = 1; i < pts.length; i++) {
            len += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
        }
        return len;
    }

    /**
     * V5.2: Flat-Segment-Bonus — bevorzugt Startpunkte auf langen geraden Abschnitten.
     * Misst den Geradenlauf (Winkelabweichung < threshold) in beide Richtungen.
     * @returns {number} Bonus 0..0.5 (0 = keine Gerade, 0.5 = lange Gerade ≥40mm)
     */
    _calcFlatSegmentBonus(idx, points, n) {
        const threshold = 10 * Math.PI / 180; // 10° max Abweichung

        // Winkel am Kandidatenpunkt prüfen
        const pPrev = points[(idx - 1 + n) % n];
        const pCurr = points[idx];
        const pNext = points[(idx + 1) % n];
        const angleIn = Math.atan2(pCurr.y - pPrev.y, pCurr.x - pPrev.x);
        const angleOut = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
        let deviation = Math.abs(angleOut - angleIn);
        if (deviation > Math.PI) deviation = 2 * Math.PI - deviation;
        if (deviation > threshold) return 0;

        // Geradenlauf in beide Richtungen messen
        let runLength = Math.hypot(pNext.x - pPrev.x, pNext.y - pPrev.y);
        const maxSteps = 20;

        // Vorwärts
        for (let s = 1; s < maxSteps; s++) {
            const a = points[(idx + s) % n];
            const b = points[(idx + s + 1) % n];
            const segAngle = Math.atan2(b.y - a.y, b.x - a.x);
            let diff = Math.abs(segAngle - angleOut);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff > threshold) break;
            runLength += Math.hypot(b.x - a.x, b.y - a.y);
        }

        // Rückwärts
        for (let s = 1; s < maxSteps; s++) {
            const a = points[(idx - s + n) % n];
            const b = points[(idx - s - 1 + n) % n];
            const segAngle = Math.atan2(b.y - a.y, b.x - a.x);
            let diff = Math.abs(segAngle - angleIn);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff > threshold) break;
            runLength += Math.hypot(b.x - a.x, b.y - a.y);
        }

        return Math.min(0.5, runLength / 40);
    }

    /**
     * V4.5: IGEMS Slot 4 — Alternativ-Lead-In berechnen.
     * Sichert/restauriert Primär-Parameter, verwendet Alt-Parameter temporär.
     * Typisch: Linear, kurz (3mm), flacher Winkel (5°) — Blind-Lead-Stil.
     */
    _tryAlternativeLeadIn(entry, tangent, normal, contourPts) {
        // Primär-Werte sichern
        const orig = {
            type: this.leadInType,
            length: this.leadInLength,
            radius: this.leadInRadius,
            angle: this.leadInAngle
        };

        // Alt-Parameter einsetzen (V4.6: neue Property-Namen)
        this.leadInType = this.altLeadType;
        this.leadInLength = this.altLeadInLength;
        this.leadInRadius = this.altLeadInRadius ?? 0;  // IGEMS Blind Lead: kein Radius — arc wird unten zu linear degradiert
        this.leadInAngle = this.altLeadInAngle;

        let altPath;
        if (this.altLeadType === 'arc' && this.altLeadInLength > 0 && this.leadInRadius > 0) {
            altPath = this._arcLeadInWithFallback(entry, tangent, normal, contourPts);
        } else {
            altPath = this._calcLinearLeadIn(entry, tangent, normal);
            altPath = this._shortenLeadIfCollision(altPath, contourPts);
        }

        // Primär-Werte restaurieren
        this.leadInType = orig.type;
        this.leadInLength = orig.length;
        this.leadInRadius = orig.radius;
        this.leadInAngle = orig.angle;

        if (altPath) altPath.isAlternative = true;
        return altPath;
    }

    // ════════════════════════════════════════════════════════════════
    // OVERCUT - Entlang der Kontur
    // ════════════════════════════════════════════════════════════════

    /**
     * V5.31: Liegt der Konturstart an einer Ecke (Knick > overcutCornerAngle)?
     * Ein Ueberschnitt/Lead mit Ueberlauf macht dort keinen Sinn (Strahl wuerde die erste Kante doppelt schneiden).
     */
    isStartAtCorner() {
        if (!this.isClosed) return false;
        const pts = this._leadBasisPts();
        if (!pts || pts.length < 3) return false;
        const e = pts[0], n = pts[1], pr = pts[pts.length - 2];
        const l1 = Math.hypot(e.x - pr.x, e.y - pr.y), l2 = Math.hypot(n.x - e.x, n.y - e.y);
        if (l1 < 1e-4 || l2 < 1e-4) return false;
        const dot = ((e.x - pr.x) * (n.x - e.x) + (e.y - pr.y) * (n.y - e.y)) / (l1 * l2);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        return angle > (this.overcutCornerAngle ?? 14);
    }

    /** V5.31: Ueberschnitt an dieser Kontur automatisch gesperrt? (Ecke und nicht ausdruecklich erlaubt) */
    isOvercutBlocked() {
        return !this.overcutAtCorners && this.isStartAtCorner();
    }

    getOvercutPath() {
        if (this._cachedOvercutPath) return this._cachedOvercutPath;

        // SLIT: Overcut = am Ende zurück entlang des Pfads (IGEMS: "cut two times")
        if (!this.isClosed && this.cuttingMode === 'slit') {
            const overcutLen = this.overcutLength;
            if (overcutLen <= 0) return null;
            const pts = this.points;
            if (!pts || pts.length < 2) return null;

            // Vom letzten Punkt rückwärts entlang des Pfads laufen
            const overcutPoints = [{ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y }];
            let remaining = overcutLen;
            for (let i = pts.length - 1; i > 0 && remaining > 0; i--) {
                const p1 = pts[i];
                const p2 = pts[i - 1];
                const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                if (segLen < 1e-10) continue;  // Skip zero-length segments
                if (segLen <= remaining) {
                    overcutPoints.push({ x: p2.x, y: p2.y });
                    remaining -= segLen;
                } else {
                    const t = remaining / segLen;
                    overcutPoints.push({
                        x: p1.x + t * (p2.x - p1.x),
                        y: p1.y + t * (p2.y - p1.y)
                    });
                    remaining = 0;
                }
            }
            this._cachedOvercutPath = {
                points: overcutPoints,
                endPoint: overcutPoints[overcutPoints.length - 1],
                type: 'slit_reverse'
            };
            return this._cachedOvercutPath;
        }

        if (!this.isClosed) return null;

        // Bei Ecken: kein Overcut (IGEMS-Verhalten) - V5.31: jetzt tatsaechlich gesperrt
        if (this.isOvercutBlocked()) return null;
        const checkPts = this._leadBasisPts();

        const overcutLen = this.overcutLength;
        if (overcutLen === 0) return null;

        const pts = checkPts;
        if (!pts || pts.length < 3) return null;

        if (overcutLen > 0) {
            // POSITIVER Overcut: Entlang der Kontur über Startpunkt hinaus
            const overcutPoints = [{ x: pts[0].x, y: pts[0].y }];
            let remaining = overcutLen;
            let endSeg = 0, endT = 0;

            for (let i = 0; i < pts.length - 1 && remaining > 0; i++) {
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                if (segLen <= remaining) {
                    overcutPoints.push({ x: p2.x, y: p2.y });
                    remaining -= segLen;
                    endSeg = i + 1; endT = 0;
                } else {
                    const t = remaining / segLen;
                    overcutPoints.push({
                        x: p1.x + t * (p2.x - p1.x),
                        y: p1.y + t * (p2.y - p1.y)
                    });
                    remaining = 0;
                    endSeg = i; endT = t;
                }
            }

            this._cachedOvercutPath = {
                points: overcutPoints,
                endPoint: overcutPoints[overcutPoints.length - 1],
                type: 'positive',
                endSeg, endT   // V5.28: Lage des Endes auf der Geometrie (fuer Werkzeugbahn-Abbildung)
            };
            // V5.28: versetzte Punkte (Anzeige der realen Strahlmitte), Index-gleich zur Geometrie
            const kp = this.getKerfOffsetPolyline();
            if (kp?.points && !this.compensationSkipped && kp.points.length === pts.length && this._compensation()) {
                const tp = [];
                for (let i = 0; i < overcutPoints.length - 1; i++) tp.push({ x: kp.points[i].x, y: kp.points[i].y });
                const e = this._offsetPointAt(endSeg, endT);
                if (e) { tp.push(e); this._cachedOvercutPath.toolPoints = tp; }
            }
        } else {
            // NEGATIVER Overcut: Kontur wird nicht ganz geschlossen
            this._cachedOvercutPath = {
                points: [],
                shortenBy: Math.abs(overcutLen),
                type: 'negative'
            };
        }

        return this._cachedOvercutPath;
    }

    // ════════════════════════════════════════════════════════════════
    // LEAD-OUT - Ab Overcut-Ende
    // ════════════════════════════════════════════════════════════════

    /**
     * V5.28: Basis-Polylinie fuer alle Lead-/Ueberschnitt-Berechnungen = TEILEGEOMETRIE.
     * Waricam (Referenz HEIDE6000101587.CNC) programmiert die Geometrie mit G41/G42, der Controller
     * versetzt um kerf/2; der Lead-In endet exakt auf dem Konturstart. Vorher lagen Leads auf der
     * Kerf-Offset-Bahn -> Sprung kerf/2 zwischen Lead-Ende und Konturstart im G-Code.
     */
    _leadBasisPts() { return this.points; }

    /** Kompensationsseite wie im Postprozessor (_getKerfCode): { d, left } oder null (online/kein Kerf). */
    _compensation() {
        if (this.kerfComp === 'online' || this.kerfSide === 'online' || !(this.kerfWidth > 0)) return null;
        if (!this.cuttingMode || this.cuttingMode === 'none') return null;
        const flipped = this._effectiveFlip();
        const g41 = this.cuttingMode === 'hole' ? !flipped : flipped;   // hole: G41, disc/slit: G42 (flip kehrt um)
        return { d: this.kerfWidth / 2, left: g41 };
    }

    /** Versetzter (kompensierter) Punkt auf Segment idx..idx+1 bei Parameter u (0..1), sonst null. */
    _offsetPointAt(idx, u) {
        const kp = this.getKerfOffsetPolyline();
        const pts = this.points;
        if (!kp?.points || this.compensationSkipped || kp.points.length !== pts.length) return null;
        const a = kp.points[idx], b = kp.points[Math.min(idx + 1, kp.points.length - 1)];
        if (!a || !b) return null;
        return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }

    /** Fallback fuer den versetzten Punkt: Geometriepunkt + d * Verschnitt-Normale. */
    _offsetFallback(point, tangent, d) {
        const n = this._getWasteSideNormal(point, tangent);
        return { x: point.x + n.x * d, y: point.y + n.y * d };
    }

    /**
     * V5.28: Reale Strahlmitte des Lead-In (nur Anzeige). Programmiert ist die Geometrie (getLeadInPath().segments);
     * der Controller versetzt. Anfahrsatz unkompensiert -> kompensierte Bahn, Rest um kerf/2 versetzt.
     */
    getLeadInToolSegments() {
        const lp = this.getLeadInPath();
        if (!lp?.segments?.length) return [];
        const c = this._compensation();
        if (!c) return lp.segments;
        const join = lp.segments[lp.segments.length - 1].p1;
        let joinOff = this._offsetPointAt(0, 0);
        if (!joinOff) {
            const t = LeadGeometry.tangentAt(lp.segments[lp.segments.length - 1], 'end');
            joinOff = this._offsetFallback(join, t, c.d);
        }
        return LeadGeometry.toolPathIn(lp.segments, { d: c.d, left: c.left, joinOff });
    }

    /** V5.28: Reale Strahlmitte des Lead-Out (nur Anzeige). */
    getLeadOutToolSegments() {
        const lp = this.getLeadOutPath();
        if (!lp?.segments?.length) return [];
        const c = this._compensation();
        if (!c) return lp.segments;
        let exitOff = null;
        const oc = this.getOvercutPath();
        const pts = this._leadBasisPts();
        if (oc?.type === 'positive' && oc.toolPoints?.length) {
            exitOff = oc.toolPoints[oc.toolPoints.length - 1];
        } else if (oc?.type === 'negative' && oc.shortenBy > 0) {
            const r = this._pointAtDistanceFromEnd(pts, oc.shortenBy);
            if (r) exitOff = this._offsetPointAt(r.segIndex, r.u);
        } else {
            exitOff = this._offsetPointAt(0, 0);
        }
        if (!exitOff) {
            const first = lp.segments[0];
            exitOff = this._offsetFallback(first.p0, LeadGeometry.tangentAt(first, 'start'), c.d);
        }
        return LeadGeometry.toolPathOut(lp.segments, { d: c.d, left: c.left, exitOff });
    }

    /** Punkt + Tangente in Abstand dist (entlang der Kontur) vor dem Konturende. */
    _pointAtDistanceFromEnd(pts, dist) {
        let rem = dist;
        for (let i = pts.length - 1; i > 0; i--) {
            const a = pts[i - 1], b = pts[i];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len < 1e-9) continue;
            if (rem <= len) {
                const t = rem / len;
                return {
                    point: { x: b.x + (a.x - b.x) * t, y: b.y + (a.y - b.y) * t },
                    tangent: { x: (b.x - a.x) / len, y: (b.y - a.y) / len },
                    segIndex: i - 1, u: 1 - t   // V5.28: Lage auf Segment a->b (fuer Offset-Abbildung)
                };
            }
            rem -= len;
        }
        return null;
    }

    getLeadOutPath() {
        if (this._cachedLeadOutPath) return this._cachedLeadOutPath;
        // Offene Konturen (Slit) brauchen keinen Lead-Out: das Schneiden endet am
        // letzten Punkt des Pfads, der Rückzug erfolgt inkrementell ohne Kerf
        // (siehe SinumerikPostprocessor._calcSlitRetractDirection / G91 G40).
        if (!this.isClosed) return null;

        const pts = this._leadBasisPts();   // V5.28: Leads auf der Teilegeometrie (Controller versetzt per G41/G42)
        if (!pts || pts.length < 3) return null;

        // SMALL HOLE: Lead-Out Richtung Zentrum
        if (this._isSmallHole(pts)) {
            const exitPt = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
            const leadPath = this._calcCenterExitLeadOut(exitPt, pts);
            this._cachedLeadOutPath = leadPath;
            return leadPath;
        }

        // 1. Overcut-Endpunkt bestimmen
        const overcut = this.getOvercutPath();
        let exitPoint, exitTangent, normal;
        let isSharpVertexCorner = false;

        if (overcut?.points?.length >= 2) {
            const op = overcut.points;
            exitPoint = op[op.length - 1];
            const prev = op[op.length - 2];
            const dx = exitPoint.x - prev.x, dy = exitPoint.y - prev.y;
            const len = Math.hypot(dx, dy);
            exitTangent = len > 0.001 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
            // Bei Overcut liegt der Exit-Punkt i.d.R. NICHT mehr exakt auf dem Start-
            // Vertex (pts[0]) — die auslaufende Kante fuer einen Eckpunkt-Bisektor ist
            // hier nicht eindeutig bestimmbar, daher Einzelkanten-Normale wie bisher.
            normal = this._getWasteSideNormal(exitPoint, exitTangent);
        } else if (overcut?.type === 'negative' && overcut.shortenBy > 0 && this._pointAtDistanceFromEnd(pts, overcut.shortenBy)) {
            // Negativer Overcut: Kontur endet shortenBy frueher -> Lead-Out dort verankern
            const r = this._pointAtDistanceFromEnd(pts, overcut.shortenBy);
            exitPoint = r.point;
            exitTangent = r.tangent;
            normal = this._getWasteSideNormal(exitPoint, exitTangent);
        } else {
            exitPoint = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
            const prev = pts[pts.length - 2];
            const dx = exitPoint.x - prev.x, dy = exitPoint.y - prev.y;
            const len = Math.hypot(dx, dy);
            exitTangent = len > 0.001 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };

            // V5.14: Ohne Overcut liegt der Exit-Punkt exakt auf dem Start-Vertex (pts[0])
            // — Eckpunkt-Bisektor wie bei getLeadInPath anwenden (auslaufende Kante = pts[0]→pts[1]).
            const next = pts[1];
            const dxOut = next.x - exitPoint.x, dyOut = next.y - exitPoint.y;
            const lenOut = Math.hypot(dxOut, dyOut);
            const tangentOut = lenOut > 0.0001 ? { x: dxOut / lenOut, y: dyOut / lenOut } : exitTangent;
            // V5.14: siehe getLeadInPath — vorzeichen-unabhaengige Ecken-Erkennung VOR
            // dem Ueberschreiben von exitTangent durch die Bisektor-Tangente pruefen.
            isSharpVertexCorner = (exitTangent.x * tangentOut.x + exitTangent.y * tangentOut.y) < 0.97;
            const basis = this._getCornerSafeLeadBasis(exitPoint, exitTangent, tangentOut);
            normal = basis.normal;
            exitTangent = basis.tangent;
        }

        // V6.43: siehe getLeadInPath — Enge-Kontur-Kappung VOR der Pfad-Berechnung, deckt
        // auch tangentiale Leads ab, die laengs durch einen engen Kanal laufen statt eine
        // Kante zu kreuzen (dort greift _shortenLeadIfCollision sonst nicht). Temporär wie
        // bei getLeadInPath — am Ende wieder auf den konfigurierten Wert zurueckgesetzt.
        const _origLeadOutLength = this.leadOutLength;
        this.leadOutLength = this._capLengthForNarrowChannel(exitPoint, pts, this.leadOutLength);
        const _origLeadOutRadius = this.leadOutRadius;
        if (this.leadOutLength < _origLeadOutLength - 1e-9 && this.leadOutLength * 2 / Math.PI < this.leadOutRadius) {
            this.leadOutRadius = Math.max(0, this.leadOutLength * 2 / Math.PI);
        }

        // 3. CORNER-LEAD: Arc zu cornerLeadType degradieren ab echten Ecken — siehe
        // getLeadInPath fuer die Begruendung (Bisektor-Tangente statt Kantentangente).
        const cornerAngle = this._isAtCorner(pts);
        let effectiveType = this.leadOutType;
        if (cornerAngle > this.cornerDegradeThreshold && effectiveType === 'arc') {
            effectiveType = this.cornerLeadType;
        }
        // siehe getLeadInPath — Winkel an Ecken auf cornerLeadAngle (Default 0°/tangential) erzwungen
        const safeLinearAngle = isSharpVertexCorner ? this.cornerLeadAngle : this.leadOutAngle;

        // 4. Lead-Out berechnen
        let leadPath;
        switch (effectiveType) {
            case 'linear':
                leadPath = this._calcLinearLeadOut(exitPoint, exitTangent, normal, safeLinearAngle);
                leadPath = this._shortenLeadIfCollision(leadPath, pts);
                break;
            case 'arc':
                leadPath = this._arcLeadOutWithFallback(exitPoint, exitTangent, normal, pts);
                break;
            case 'tangent':
                leadPath = this._calcTangentLeadOut(exitPoint, exitTangent, normal);
                leadPath = this._shortenLeadIfCollision(leadPath, pts);
                break;
            case 'on_geometry':
                leadPath = this._calcOnGeometryLeadOut(exitPoint);
                break;
            default:
                leadPath = this._arcLeadOutWithFallback(exitPoint, exitTangent, normal, pts);
        }

        // V5.12: Alt-Lead Fallback bei starker Kollision — Parität mit Lead-In (siehe getLeadInPath)
        if (leadPath?.shortened && this.altLeadEnabled) {
            const primaryLen = this._pathLength(leadPath.points);
            const requestedLen = this.leadOutLength;
            if (primaryLen < requestedLen * 0.4) {
                const altPath = this._tryAlternativeLeadOut(exitPoint, exitTangent, normal, pts);
                if (altPath && (!altPath.shortened || this._pathLength(altPath.points) > primaryLen)) {
                    leadPath = altPath;
                    console.debug(`[CamContour V5.12] Alt-Lead-Out: ${this.name} (${primaryLen.toFixed(1)}mm < 40% von ${requestedLen}mm)`);
                }
            }
        }

        // V5.12: Letzter Fallback — Center-Exit wenn Lead-Out immer noch stark kollidiert
        if (leadPath?.shortened && this.altLeadEnabled) {
            const finalLen = this._pathLength(leadPath.points);
            if (finalLen < 0.5) {
                leadPath = this._calcCenterExitLeadOut(exitPoint, pts);
                leadPath.isFallbackCenterExit = true;
                console.debug(`[CamContour V5.12] Center-Exit Fallback: ${this.name}`);
            }
        }

        // V6.43: konfigurierten Wert wiederherstellen (siehe getLeadInPath)
        this.leadOutLength = _origLeadOutLength;
        this.leadOutRadius = _origLeadOutRadius;

        this._ensureSegments(leadPath);
        this._cachedLeadOutPath = leadPath;
        return leadPath;
    }

    /**
     * TANGENTIAL LEAD-OUT - Gerade weiter in Schnittrichtung (Pendant zu _calcTangentLeadIn)
     */
    _calcTangentLeadOut(exit, tangent, normal) {
        return this._leadFromSegments(
            LeadGeometry.leadOutTangent({ join: exit, tangent, length: this.leadOutLength }), 'out', 'tangent');
    }

    /**
     * ON-GEOMETRY LEAD-OUT (IGEMS Piercing Type 0) - Kein sichtbarer Lead-Out (Pendant zu _calcOnGeometryLead)
     */
    _calcOnGeometryLeadOut(exit) {
        return {
            points: [{ x: exit.x, y: exit.y }],
            endPoint: { x: exit.x, y: exit.y },
            type: 'on_geometry'
        };
    }

    /**
     * V5.12: Alternativ-Lead-Out berechnen — Pendant zu _tryAlternativeLeadIn.
     */
    _tryAlternativeLeadOut(exit, tangent, normal, contourPts) {
        const orig = {
            type: this.leadOutType,
            length: this.leadOutLength
        };

        this.leadOutType = this.altLeadType;
        this.leadOutLength = this.altLeadOutLength;

        let altPath;
        if (this.altLeadType === 'arc' && this.altLeadOutLength > 0 && this.leadOutRadius > 0) {
            altPath = this._arcLeadOutWithFallback(exit, tangent, normal, contourPts);
        } else {
            altPath = this._calcLinearLeadOut(exit, tangent, normal);
            altPath = this._shortenLeadIfCollision(altPath, contourPts);
        }

        this.leadOutType = orig.type;
        this.leadOutLength = orig.length;

        if (altPath) altPath.isAlternative = true;
        return altPath;
    }

    /**
     * @param {number} [angleOverride] - V5.14: siehe _calcLinearLeadIn
     */
    _calcLinearLeadOut(exit, tangent, normal, angleOverride) {
        const segs = LeadGeometry.leadOutLinear({
            join: exit, tangent, normal, length: this.leadOutLength,
            angleDeg: (angleOverride !== undefined ? angleOverride : this.leadOutAngle)
        });
        return this._leadFromSegments(segs, 'out', 'linear');
    }

    _calcArcLeadOut(exit, tangent, normal) {
        const radius = this.leadOutRadius;
        const totalLength = this.leadOutLength;
        const segs = (radius <= 1e-6)
            ? LeadGeometry.leadOutTangent({ join: exit, tangent, length: totalLength })
            : LeadGeometry.leadOutArc({ join: exit, tangent, normal, radius, length: totalLength, span: this._arcSpan(this.leadOutArcAngle) });
        return this._leadFromSegments(segs, 'out', 'arc');
    }

    /**
     * ARC LEAD-OUT mit progressivem Fallback (gleiche Logik wie Lead-In).
     */
    _arcLeadOutWithFallback(exit, tangent, normal, contourPts) {
        const origRadius = this.leadOutRadius;

        // 1) Voller Arc
        let leadPath = this._calcArcLeadOut(exit, tangent, normal);
        const fullLen = this._pathLength(leadPath.points);
        leadPath = this._shortenLeadIfCollision(leadPath, contourPts);
        if (!leadPath.shortened) return leadPath;
        if (this._pathLength(leadPath.points) > fullLen * 0.5) return leadPath;

        // 2) Halber Radius
        this.leadOutRadius = origRadius * 0.5;
        leadPath = this._calcArcLeadOut(exit, tangent, normal);
        this.leadOutRadius = origRadius;
        const halfLen = this._pathLength(leadPath.points);
        leadPath = this._shortenLeadIfCollision(leadPath, contourPts);
        if (!leadPath.shortened) return leadPath;
        if (this._pathLength(leadPath.points) > halfLen * 0.5) return leadPath;

        // 3) Linear-Fallback
        leadPath = this._calcLinearLeadOut(exit, tangent, normal);
        return this._shortenLeadIfCollision(leadPath, contourPts);
    }

    // ════════════════════════════════════════════════════════════════
    // COLLISION DETECTION & AUTO-SHORTEN (V4.4 - Robust)
    // ════════════════════════════════════════════════════════════════

    /**
     * Findet den Anschlusspunkt eines Lead-Pfades an die Kontur.
     * Lead-In: letzter Punkt liegt auf der Kontur
     * Lead-Out: erster Punkt liegt auf der Kontur
     * Erkennung: welcher Endpunkt liegt näher an einem Konturpunkt?
     */
    _findConnectionPoint(leadPts, contourPts) {
        const first = leadPts[0];
        const last = leadPts[leadPts.length - 1];

        // Distanz zum nächsten Konturpunkt messen
        let minDistFirst = Infinity, minDistLast = Infinity;
        for (let i = 0; i < Math.min(contourPts.length, 50); i++) {
            const cp = contourPts[i];
            const df = Math.hypot(first.x - cp.x, first.y - cp.y);
            const dl = Math.hypot(last.x - cp.x, last.y - cp.y);
            if (df < minDistFirst) minDistFirst = df;
            if (dl < minDistLast) minDistLast = dl;
        }
        // Auch letzten Bereich der Kontur prüfen (für geschlossene Konturen)
        for (let i = Math.max(0, contourPts.length - 50); i < contourPts.length; i++) {
            const cp = contourPts[i];
            const df = Math.hypot(first.x - cp.x, first.y - cp.y);
            const dl = Math.hypot(last.x - cp.x, last.y - cp.y);
            if (df < minDistFirst) minDistFirst = df;
            if (dl < minDistLast) minDistLast = dl;
        }

        return minDistFirst < minDistLast ? first : last;
    }

    /**
     * Prüft ob ein Lead-Pfad die eigene Kontur schneidet.
     * Distance-based: Skippt Kontur-Segmente geometrisch nah am
     * Anschlusspunkt. Findet den FRÜHESTEN Schnittpunkt.
     *
     * "Frühester" = am weitesten vom Kontur-Anschlusspunkt entfernt
     * entlang des Lead-Pfads (nächster zum Pierce/End-Punkt).
     */
    _shortenLeadIfCollision(leadPath, contourPts) {
        if (!leadPath?.points || leadPath.points.length < 2) return leadPath;
        if (!contourPts || contourPts.length < 4) return leadPath;

        const lPts = leadPath.points;
        const n = contourPts.length;

        // Anschlusspunkt automatisch erkennen (Lead-In vs Lead-Out)
        const connectionPt = this._findConnectionPoint(lPts, contourPts);
        const isLeadOut = (connectionPt === lPts[0]);

        // Skip-Radius: Kontursegmente näher als diese Distanz überspringen
        // Etwas größer für Arcs wegen Bogen-Tangente am Anschluss
        const maxParam = Math.max(this.leadInRadius, this.leadInLength,
                                  this.leadOutRadius || 0, this.leadOutLength || 0);
        const skipRadius = maxParam * 0.12;

        let bestHit = null;  // { li, t, point }

        for (let li = 0; li < lPts.length - 1; li++) {
            const la = lPts[li], lb = lPts[li + 1];

            for (let ci = 0; ci < n - 1; ci++) {
                const ca = contourPts[ci], cb = contourPts[ci + 1];

                // Distance-based Skip: beide Endpunkte nah am Anschluss?
                const distA = Math.hypot(ca.x - connectionPt.x, ca.y - connectionPt.y);
                const distB = Math.hypot(cb.x - connectionPt.x, cb.y - connectionPt.y);
                if (distA < skipRadius && distB < skipRadius) continue;

                const hit = this._segmentIntersect(la, lb, ca, cb);
                if (hit) {
                    // Frühester Treffer:
                    // Lead-In:  frühester = kleinster li, kleinster t (nächster zum Pierce)
                    // Lead-Out: frühester = größter li, größter t (nächster zum End-Punkt)
                    const isBetter = isLeadOut
                        ? (!bestHit || li > bestHit.li || (li === bestHit.li && hit.t > bestHit.t))
                        : (!bestHit || li < bestHit.li || (li === bestHit.li && hit.t < bestHit.t));

                    if (isBetter) {
                        bestHit = { li, t: hit.t, point: hit };
                    }
                }
            }
        }

        if (bestHit) {
            if (isLeadOut) {
                // Lead-Out: Behalte Anfang (Kontur-Anschluss) bis Schnittpunkt
                const newPoints = [];
                for (let i = 0; i <= bestHit.li; i++) {
                    newPoints.push(lPts[i]);
                }
                newPoints.push(bestHit.point);
                // V6.42: Bei engen Konturen (Selbst-Kollision = gegenueberliegende Kante
                // derselben Kontur sehr nah) nur bis zur HAELFTE der Distanz zur Kante
                // kuerzen, nicht bis zur Kante selbst — sonst landet der Pierce-Punkt durch
                // Kerf-Toleranzen real auf/jenseits der gegenueberliegenden Kante. newPoints
                // ist bereits Anschluss-zuerst geordnet (Anschluss bleibt fix).
                const halfPoints = this._truncatePathToHalfLength(newPoints);
                this._applyShortenedPoints(leadPath, halfPoints, 'out');
                leadPath.endPoint = leadPath.points[leadPath.points.length - 1];
            } else {
                // Lead-In: Behalte Schnittpunkt bis Ende (Kontur-Anschluss)
                const newPoints = [bestHit.point];
                for (let i = bestHit.li + 1; i < lPts.length; i++) {
                    newPoints.push(lPts[i]);
                }
                // V6.42: siehe oben — newPoints ist hier Anschluss-zuletzt geordnet (Treffer
                // zuerst, Kontur-Anschluss am Ende), daher umgedreht kuerzen und zurueckdrehen.
                const halfPoints = this._truncatePathToHalfLength([...newPoints].reverse()).reverse();
                this._applyShortenedPoints(leadPath, halfPoints, 'in');
                leadPath.piercingPoint = leadPath.points[0];
            }
            leadPath.shortened = true;
            leadPath.effectiveLength = this._pathLength(leadPath.points);
        }

        return leadPath;
    }

    /**
     * V6.42: Kuerzt einen Pfad auf die HAELFTE seiner aktuellen Laenge. points[0] ist
     * der fixe Anschlusspunkt (Kontur-Seite), das letzte Element der bisherige Endpunkt
     * (z.B. Kollisionspunkt mit der gegenueberliegenden Kante) — der neue Endpunkt liegt
     * exakt in der Mitte zwischen beiden, nicht an der Kante selbst.
     */
    _truncatePathToHalfLength(points) {
        if (!points || points.length === 0) return [];
        const total = this._pathLength(points);
        const target = total / 2;
        if (!(target > 0)) return [points[0]];
        let acc = 0;
        for (let i = 1; i < points.length; i++) {
            const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
            if (acc + segLen >= target) {
                const t = segLen > 1e-9 ? (target - acc) / segLen : 0;
                const cut = {
                    x: points[i - 1].x + t * (points[i].x - points[i - 1].x),
                    y: points[i - 1].y + t * (points[i].y - points[i - 1].y)
                };
                return [...points.slice(0, i), cut];
            }
            acc += segLen;
        }
        return points;
    }

    /**
     * V6.44: Minimaler Abstand von `point` zu den NICHT unmittelbar angrenzenden
     * Segmenten von `contourPts` — zentrale Engstellen-/Eigenkollisions-Messung.
     * Ersetzt drei zuvor eigenstaendige Skip-Radius-Implementierungen
     * (_capLengthForNarrowChannel, _calcClearanceScore) mit unterschiedlicher (und im
     * Fall des laengenproportionalen Skip-Radius fehleranfaelliger) Robustheit.
     *
     * Ausschluss der eigenen, unmittelbar angrenzenden Kante(n) per FIXEM Radius (nicht
     * von einer angeforderten Laenge abhaengig — sonst wuerde bei einer grossen Laenge
     * die nahe gegenueberliegende Wand selbst ausgeschlossen und die Engstelle bliebe
     * unerkannt, siehe Lessons 2026-06-25). Zwei Faelle: (a) Segment, auf dem `point`
     * selbst liegt (Distanz ≈ 0, das andere Segment-Ende kann beliebig weit weg sein —
     * z.B. eine lange Kanalwand) UND (b) kurze, eng tessellierte Nachbarsegmente (beide
     * Endpunkte nah an point).
     * @param {{x,y}} point
     * @param {Array} contourPts - eigene (Kerf-Offset-)Punktliste, geschlossen
     * @returns {number} kuerzester Abstand, oder Infinity wenn keine Engstelle gefunden
     */
    _minSelfClearance(point, contourPts) {
        const n = contourPts ? contourPts.length - 1 : 0; // closed: letzter=erster
        if (n < 3) return Infinity;

        const skipRadius = Math.max(this.kerfWidth * 2, 1.0);
        const onSegEps = 1e-6;

        // V5.27: Kontur-Laengenposition des Punkts + kumulierte Segmentlaengen. Dient dazu, die
        // eigene Kruemmung von echten Engstellen zu unterscheiden: Nachbarsegmente einer glatten
        // Kurve (Kreis!) liegen euklidisch nur ~Bogenlaenge entfernt und wurden bisher als
        // "gegenueberliegende Wand" gewertet -> Lead auf Kreisen auf ~0.5 mm gekappt.
        const cum = [0];
        for (let i = 0; i < n; i++) {
            cum.push(cum[i] + Math.hypot(contourPts[i + 1].x - contourPts[i].x, contourPts[i + 1].y - contourPts[i].y));
        }
        const total = cum[n];
        let s0 = 0, bestD = Infinity;
        for (let i = 0; i < n; i++) {
            const d = this._pointToSegDist(point, contourPts[i], contourPts[i + 1]);
            if (d < bestD) {
                bestD = d;
                const a = contourPts[i], b = contourPts[i + 1];
                const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
                const t = l2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / l2)) : 0;
                s0 = cum[i] + t * Math.sqrt(l2);
            }
        }
        // Nur Segmente zaehlen, deren Weg ENTLANG der Kontur deutlich laenger ist als der direkte
        // Abstand (Kontur laeuft weg und kommt wieder = Kanalwand). Glatte Kruemmung: Verhaeltnis <= pi/2.
        const WALL_RATIO = 2.0;

        let minDist = Infinity;
        for (let i = 0; i < n; i++) {
            const a = contourPts[i], b = contourPts[i + 1];
            const distA = Math.hypot(a.x - point.x, a.y - point.y);
            const distB = Math.hypot(b.x - point.x, b.y - point.y);
            if (distA < skipRadius && distB < skipRadius) continue;          // (b)
            const d = this._pointToSegDist(point, a, b);
            if (d < onSegEps) continue;                                     // (a)
            if (d >= minDist) continue;
            // Laengenposition des naechsten Segmentpunkts
            const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
            const t = l2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / l2)) : 0;
            const pos = cum[i] + t * Math.sqrt(l2);
            const along = Math.abs(pos - s0);
            const arcDist = Math.min(along, total - along);
            if (arcDist <= WALL_RATIO * d) continue;                        // (c) eigene Kruemmung
            minDist = d;
        }
        return minDist;
    }

    /**
     * V6.43: Kappt eine angeforderte Lead-Laenge auf maximal die HAELFTE des kuerzesten
     * Eigenabstands zur gegenueberliegenden Kontur-Kante (= halbe Kanalbreite an einer
     * engen Stelle). Laeuft VOR der eigentlichen Pfad-Berechnung, deckt damit auch
     * tangentiale Leads ab, die laengs durch einen engen, gekruemmten Kanal verlaufen
     * ohne dessen Kante je zu KREUZEN — _shortenLeadIfCollision (Segment-Schnitt-Test)
     * greift dort nicht, weil schlicht kein Schnittpunkt existiert.
     * @param {{x,y}} point - Anschlusspunkt (Entry/Exit)
     * @param {Array} contourPts - eigene (Kerf-Offset-)Punktliste
     * @param {number} requestedLength - aktuell konfigurierte Lead-Laenge
     */
    _capLengthForNarrowChannel(point, contourPts, requestedLength) {
        if (!(requestedLength > 0)) return requestedLength;
        const minDist = this._minSelfClearance(point, contourPts);
        if (!(minDist < Infinity)) return requestedLength;
        // V5.28: Geometrie-Abstand abzueglich Fugenbreite (vorher durch die Offset-Bahn implizit)
        return Math.min(requestedLength, Math.max(0, minDist - (this.kerfWidth > 0 ? this.kerfWidth : 0)) / 2);
    }

    /**
     * Segment-Segment-Schnitt. Gibt Schnittpunkt mit t-Parameter zurück.
     */
    _segmentIntersect(a1, a2, b1, b2) {
        const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
        const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
        const denom = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(denom) < 1e-10) return null;  // parallel

        const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
        const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;

        if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) {
            return {
                x: a1.x + t * dx1,
                y: a1.y + t * dy1,
                t  // speichere t für Frühest-Vergleich
            };
        }
        return null;
    }

    // ════════════════════════════════════════════════════════════════
    // MULTI-KONTUR COLLISION DETECTION (V4.7)
    // Lead-In/Out gegen ALLE Nachbar-Konturen prüfen
    // ════════════════════════════════════════════════════════════════

    /**
     * Prüft Lead-In/Out gegen ALLE anderen Konturen (nicht nur eigene).
     * Kürzt Leads bei Kollision mit Nachbar-Konturen.
     * @param {CamContour[]} allContours - Alle Konturen im Arbeitsbereich
     * @param {number} [safetyMargin=0.5] - Mindestabstand zu Nachbar-Konturen (mm)
     */
    checkMultiContourCollision(allContours, safetyMargin = 0.5) {
        if (!allContours || allContours.length < 2) return false;

        // V5.28: Leads/Nachbarn liegen jetzt auf der Teilegeometrie (vorher Kerf-Offset-Bahn, was
        // implizit die Fugenbreite von der Luecke abzog) -> Fugenbreite explizit zum Abstand addieren.
        safetyMargin = safetyMargin + (this.kerfWidth > 0 ? this.kerfWidth : 0);

        // Nachbar-Konturen mit BBox vorfiltern (einmalig)
        const neighbors = this._getNeighborContours(allContours, safetyMargin);
        if (neighbors.length === 0) return false;

        // Lead-In prüfen — mit erweiterter Fallback-Kette
        let leadInModified = false;
        const leadIn = this.getLeadInPath();

        if (leadIn?.points?.length >= 2 && !leadIn.isFallbackCenterPierce) {
            const collision = this._checkLeadAgainstNeighbors(leadIn, neighbors, 'in', safetyMargin);
            if (collision) {
                // ── Strategy A: Startpunkt rotieren ──
                const rotated = this._tryRotateStartPoint(allContours, neighbors, safetyMargin);
                if (rotated) {
                    leadInModified = true;
                    // Lead-In nach Rotation neu holen und als rotiert markieren
                    const rotatedLead = this.getLeadInPath();
                    if (rotatedLead) rotatedLead.isRotated = true;
                    console.log(`[CamContour V5.3] Lead-Routing A: Startpunkt rotiert für ${this.name}`);
                } else {
                    // ── Strategy B: Dog-Leg Routing ──
                    const dogLeg = this._tryDogLegLeadIn(neighbors, safetyMargin);
                    if (dogLeg) {
                        this._cachedLeadInPath = this._ensureSegments(dogLeg);
                        leadInModified = true;
                        console.log(`[CamContour V5.3] Lead-Routing B: Dog-Leg für ${this.name}`);
                    } else {
                        // Kein Routing möglich → konventionelles Shortening
                        for (const nb of neighbors) {
                            if (this._shortenLeadAgainstContour(leadIn, nb.pts, 'in', safetyMargin)) {
                                leadInModified = true;
                            }
                        }
                    }
                }
            }
        }

        // Lead-Out prüfen — V5.12: Dog-Leg-Routing-Parität mit Lead-In (Strategy A/
        // Startpunkt-Rotation bewusst ausgelassen — würde auch den ggf. bereits
        // angepassten Lead-In wieder verändern; nur Strategy B + Shortening-Fallback).
        let leadOutModified = false;
        const leadOut = this.getLeadOutPath();

        if (leadOut?.points?.length >= 2 && !leadOut.isFallbackCenterExit) {
            const outCollision = this._checkLeadAgainstNeighbors(leadOut, neighbors, 'out', safetyMargin);
            if (outCollision) {
                const dogLeg = this._tryDogLegLeadOut(neighbors, safetyMargin);
                if (dogLeg) {
                    this._cachedLeadOutPath = this._ensureSegments(dogLeg);
                    leadOutModified = true;
                    console.log(`[CamContour V5.12] Lead-Routing B: Dog-Leg (Out) für ${this.name}`);
                } else {
                    for (const nb of neighbors) {
                        if (this._shortenLeadAgainstContour(leadOut, nb.pts, 'out', safetyMargin)) {
                            leadOutModified = true;
                        }
                    }
                }
            }
        }

        const modified = leadInModified || leadOutModified;
        if (modified) {
            console.log(`[CamContour V5.3] Multi-Collision: Lead angepasst für ${this.name}`);
        }
        return modified;
    }

    // ════════════════════════════════════════════════════════════════
    // LEAD-ROUTING STRATEGIEN (V4.8)
    // ════════════════════════════════════════════════════════════════

    /**
     * Sammelt Nachbar-Konturen mit vorberechneter BBox + Kerf-Punkten.
     * BBox-Quick-Reject gegen eigene Kontur-BBox + Lead-Reichweite.
     */
    _getNeighborContours(allContours, margin) {
        const selfBB = this._getBBox(this.points);
        if (!selfBB) return [];

        // Suchradius: eigene BBox + maximale Lead-Länge + Margin
        const reach = Math.max(this.leadInLength, this.leadInRadius, this.leadOutLength, 10) + margin;
        const searchBB = {
            minX: selfBB.minX - reach, minY: selfBB.minY - reach,
            maxX: selfBB.maxX + reach, maxY: selfBB.maxY + reach
        };

        const neighbors = [];
        for (const other of allContours) {
            if (other === this || other.isReference) continue;
            const bbox = this._getBBox(other.points);
            if (!bbox) continue;
            if (!this._bboxOverlap(searchBB, bbox, 0)) continue;
            neighbors.push({
                contour: other,
                bbox,
                pts: other.points
            });
        }
        return neighbors;
    }

    /**
     * Prüft ob ein Lead-Pfad mit irgendeiner Nachbar-Kontur kollidiert.
     * Gibt true zurück wenn Kollision gefunden.
     */
    _checkLeadAgainstNeighbors(leadPath, neighbors, direction, margin) {
        if (!leadPath?.points || leadPath.points.length < 2) return false;
        const leadBB = this._getBBox(leadPath.points);
        if (!leadBB) return false;

        for (const nb of neighbors) {
            if (!this._bboxOverlap(leadBB, nb.bbox, margin)) continue;
            if (this._leadIntersectsContour(leadPath.points, nb.pts, margin)) return true;
        }
        return false;
    }

    /**
     * Prüft ob Lead-Punkte eine Kontur schneiden oder zu nah kommen.
     * Wie _shortenLeadAgainstContour, aber ohne Mutation — nur Detection.
     */
    _leadIntersectsContour(leadPts, contourPts, margin) {
        // Intersection check
        for (let li = 0; li < leadPts.length - 1; li++) {
            const la = leadPts[li], lb = leadPts[li + 1];
            for (let ci = 0; ci < contourPts.length - 1; ci++) {
                if (this._segmentIntersect(la, lb, contourPts[ci], contourPts[ci + 1])) {
                    return true;
                }
            }
        }
        // Proximity check
        for (const p of leadPts) {
            for (let ci = 0; ci < contourPts.length - 1; ci++) {
                if (this._pointToSegDist(p, contourPts[ci], contourPts[ci + 1]) < margin) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Berechnet den minimalen Abstand aller Lead-Punkte zu allen Nachbar-Konturen.
     * Höherer Score = mehr Freiraum = bessere Position.
     * @param {Array} leadPts - Lead-In Punkte
     * @param {Array} neighbors - Nachbar-Konturen (aus _getNeighborContours)
     * @param {number} margin - Safety-Margin
     * @returns {number} Minimaler Abstand (Clearance-Score)
     */
    _calcClearanceScore(leadPts, neighbors, margin) {
        let minDist = Infinity;

        // Abstand zu allen Nachbar-Konturen
        for (const p of leadPts) {
            for (const nb of neighbors) {
                for (let i = 0; i < nb.pts.length - 1; i++) {
                    const d = this._pointToSegDist(p, nb.pts[i], nb.pts[i + 1]);
                    if (d < minDist) minDist = d;
                }
            }
        }

        // Selbst-Kollision: Lead vs. eigene Kontur (Skip nahe Startpunkt)
        // V6.44: Skip-Radius FIX statt laengen-proportional (Math.max(leadInLength,
        // leadInRadius)*0.15) — bei grosser angeforderter Lead-Laenge wuerde sonst die
        // gegenueberliegende, eng benachbarte Kante selbst ausgeschlossen werden (siehe
        // _minSelfClearance / Lessons 2026-06-25, derselbe Bug-Typ). Gleicher Radius wie
        // _minSelfClearance, fuer konsistentes Verhalten beider Engstellen-Pruefungen.
        const selfPts = this.points;
        const skipRadius = Math.max(this.kerfWidth * 2, 1.0);
        const entry = leadPts[leadPts.length - 1]; // Letzter Punkt = Entry
        for (let i = 0; i < selfPts.length - 1; i++) {
            if (this._pointToSegDist(entry, selfPts[i], selfPts[i + 1]) < skipRadius) continue;
            for (const p of leadPts) {
                const d = this._pointToSegDist(p, selfPts[i], selfPts[i + 1]);
                if (d < minDist) minDist = d;
            }
        }

        return minDist;
    }

    /**
     * Strategy A: Startpunkt in 5°-Schritten rotieren.
     * Wählt die Position mit dem höchsten Clearance-Score (meister Freiraum).
     * Prüft zuerst Ecken (bevorzugte Positionen), dann gleichverteilt.
     */
    _tryRotateStartPoint(allContours, neighbors, margin) {
        if (!this.isClosed || !this.points || this.points.length < 4) return false;

        const n = this.points.length - 1; // Closed: letzter = erster
        const totalLen = this._pathLength(this.points);
        if (totalLen < 1) return false;

        // Originalzustand sichern
        const origPoints = this.points.map(p => ({ x: p.x, y: p.y }));
        const origRotation = this._rotationCount;

        // Kandidaten sammeln: erst Ecken, dann 5°-Schritte (= Umfangsanteile)
        const candidates = [];

        // Ecken als bevorzugte Kandidaten (Index > 0, da 0 = aktueller Startpunkt)
        const corners = typeof Geometry !== 'undefined' && Geometry.findCorners
            ? Geometry.findCorners(this.points, this.cornerAngleThreshold)
            : [];
        for (const c of corners) {
            if (c.index > 0 && c.index < n) candidates.push(c.index);
        }

        // Gleichverteilte Positionen (5°-Schritte → 72 Positionen)
        const step = Math.max(1, Math.round(n / 72));
        for (let i = step; i < n; i += step) {
            if (!candidates.includes(i)) candidates.push(i);
        }

        // Jeden Kandidaten testen — beste Position nach Clearance-Score wählen
        let bestIdx = -1;
        let bestScore = -Infinity;
        let bestPoints = null;
        let bestRotation = origRotation;

        for (const idx of candidates) {
            // Punkte rotieren
            const rotated = [];
            for (let i = 0; i < n; i++) {
                rotated.push(origPoints[(idx + i) % n]);
            }
            rotated.push({ x: rotated[0].x, y: rotated[0].y });
            this.points = rotated;
            this._rotationCount = origRotation + idx; // Eindeutiger Cache-Key
            this.invalidate();

            // Lead-In an neuer Position generieren und bewerten
            const testLead = this.getLeadInPath();
            if (testLead?.points?.length >= 2 && !testLead.isFallbackCenterPierce) {
                const score = this._calcClearanceScore(testLead.points, neighbors, margin);
                // Corner-Penalty + Flat-Segment-Bonus (V5.2)
                const isCorner = corners.some(c => c.index === idx);
                const flatBonus = this._calcFlatSegmentBonus(idx, origPoints, n);
                const adjustedScore = isCorner ? score * 0.4 : score * (1.0 + flatBonus);

                if (adjustedScore > bestScore && score > margin) {
                    bestScore = adjustedScore;
                    bestIdx = idx;
                    bestPoints = rotated.map(p => ({ x: p.x, y: p.y }));
                    bestRotation = this._rotationCount;
                }
            }
        }

        if (bestIdx >= 0) {
            this.points = bestPoints;
            this._rotationCount = bestRotation;
            this.invalidate();
            this.startPointIndex = 0;
            console.log(`[CamContour V5.3] Clearance-Scored: idx=${bestIdx}, score=${bestScore.toFixed(1)}mm`);
            return true;
        }

        // Keine Position mit ausreichendem Clearance → Original wiederherstellen
        this.points = origPoints;
        this._rotationCount = origRotation;
        this.invalidate();
        return false;
    }

    /**
     * Strategy B: Dog-Leg Lead-In mit Waypoint auf der Verschnittseite.
     * Erstellt einen geknickten Pfad: Pierce → Waypoint → Entry.
     * Der Waypoint liegt seitlich versetzt auf der Abfallseite.
     */
    _tryDogLegLeadIn(neighbors, margin) {
        if (!this.isClosed) return null;

        const pts = this._leadBasisPts();
        if (!pts || pts.length < 3) return null;

        const entry = pts[0];
        const next = pts[1];
        const dx = next.x - entry.x, dy = next.y - entry.y;
        const tLen = Math.hypot(dx, dy);
        if (tLen < 1e-6) return null;
        const tangent = { x: dx / tLen, y: dy / tLen };
        const normal = this._getWasteSideNormal(entry, tangent);

        const leadLen = this.leadInLength;

        // Verschiedene Dog-Leg-Konfigurationen testen:
        // Winkel (15°, 30°, 45°, 60°) × Seite (links/rechts relativ zur Normalen)
        const angles = [30, 45, 15, 60];
        const sides = [1, -1]; // 1 = normal, -1 = gespiegelt

        for (const angleDeg of angles) {
            for (const side of sides) {
                const angleRad = angleDeg * Math.PI / 180;

                // Waypoint: Lead-Länge in Normalenrichtung + seitlicher Versatz
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                // Richtung: Normale rotiert um angleDeg
                const dirX = normal.x * cosA + side * tangent.x * sinA;
                const dirY = normal.y * cosA + side * tangent.y * sinA;

                const waypoint = {
                    x: entry.x + dirX * leadLen * 0.6,
                    y: entry.y + dirY * leadLen * 0.6
                };

                // Pierce-Punkt: Von Waypoint weiter in Normalenrichtung
                const pierce = {
                    x: waypoint.x + normal.x * leadLen * 0.4,
                    y: waypoint.y + normal.y * leadLen * 0.4
                };

                const testPoints = [pierce, waypoint, entry];

                // Kollisionscheck gegen alle Nachbarn
                let collision = false;
                for (const nb of neighbors) {
                    if (this._leadIntersectsContour(testPoints, nb.pts, margin)) {
                        collision = true;
                        break;
                    }
                }

                // Auch gegen eigene Kontur prüfen
                if (!collision) {
                    collision = this._leadIntersectsContour(testPoints, pts, margin);
                }

                if (!collision) {
                    return {
                        points: testPoints,
                        piercingPoint: pierce,
                        entryPoint: entry,
                        type: 'dog_leg',
                        dogLegAngle: angleDeg,
                        shortened: false,
                        multiContourCollision: false,
                        isAlternative: true
                    };
                }
            }
        }
        return null; // Kein Dog-Leg möglich
    }

    /**
     * V5.12: Strategy B für Lead-Out — Dog-Leg mit Waypoint auf der Verschnittseite.
     * Pendant zu _tryDogLegLeadIn: Exit → Waypoint → End-Punkt.
     */
    _tryDogLegLeadOut(neighbors, margin) {
        if (!this.isClosed) return null;

        const pts = this._leadBasisPts();   // V5.28: Leads auf der Teilegeometrie (Controller versetzt per G41/G42)
        if (!pts || pts.length < 3) return null;

        const overcut = this.getOvercutPath();
        let exit, prev;
        if (overcut?.points?.length >= 2) {
            const op = overcut.points;
            exit = op[op.length - 1];
            prev = op[op.length - 2];
        } else {
            exit = pts[pts.length - 1];
            prev = pts[pts.length - 2];
        }
        const dx = exit.x - prev.x, dy = exit.y - prev.y;
        const tLen = Math.hypot(dx, dy);
        if (tLen < 1e-6) return null;
        const tangent = { x: dx / tLen, y: dy / tLen };
        const normal = this._getWasteSideNormal(exit, tangent);

        const leadLen = this.leadOutLength;
        const angles = [30, 45, 15, 60];
        const sides = [1, -1];

        for (const angleDeg of angles) {
            for (const side of sides) {
                const angleRad = angleDeg * Math.PI / 180;
                const cosA = Math.cos(angleRad);
                const sinA = Math.sin(angleRad);

                const dirX = normal.x * cosA + side * tangent.x * sinA;
                const dirY = normal.y * cosA + side * tangent.y * sinA;

                const waypoint = {
                    x: exit.x + dirX * leadLen * 0.6,
                    y: exit.y + dirY * leadLen * 0.6
                };
                const endPoint = {
                    x: waypoint.x + normal.x * leadLen * 0.4,
                    y: waypoint.y + normal.y * leadLen * 0.4
                };

                const testPoints = [{ x: exit.x, y: exit.y }, waypoint, endPoint];

                let collision = false;
                for (const nb of neighbors) {
                    if (this._leadIntersectsContour(testPoints, nb.pts, margin)) {
                        collision = true;
                        break;
                    }
                }
                if (!collision) {
                    collision = this._leadIntersectsContour(testPoints, pts, margin);
                }

                if (!collision) {
                    return {
                        points: testPoints,
                        endPoint,
                        type: 'dog_leg',
                        dogLegAngle: angleDeg,
                        shortened: false,
                        multiContourCollision: false,
                        isAlternative: true
                    };
                }
            }
        }
        return null; // Kein Dog-Leg möglich
    }

    /**
     * Kürzt einen Lead-Pfad bei Schnitt mit einer Nachbar-Kontur.
     */
    _shortenLeadAgainstContour(leadPath, contourPts, direction, margin) {
        if (!leadPath?.points || leadPath.points.length < 2) return false;
        if (!contourPts || contourPts.length < 3) return false;

        const lPts = leadPath.points;
        let bestHit = null;
        const isOut = (direction === 'out');

        for (let li = 0; li < lPts.length - 1; li++) {
            const la = lPts[li], lb = lPts[li + 1];

            for (let ci = 0; ci < contourPts.length - 1; ci++) {
                const ca = contourPts[ci], cb = contourPts[ci + 1];
                const hit = this._segmentIntersect(la, lb, ca, cb);
                if (hit) {
                    const isBetter = isOut
                        ? (!bestHit || li > bestHit.li || (li === bestHit.li && hit.t > bestHit.t))
                        : (!bestHit || li < bestHit.li || (li === bestHit.li && hit.t < bestHit.t));
                    if (isBetter) {
                        bestHit = { li, t: hit.t, point: hit };
                    }
                }
            }
        }

        if (!bestHit) {
            // Proximity Check: Lead-Punkt zu nah an Kontur?
            for (let i = 0; i < lPts.length; i++) {
                const p = lPts[i];
                for (let ci = 0; ci < contourPts.length - 1; ci++) {
                    const dist = this._pointToSegDist(p, contourPts[ci], contourPts[ci + 1]);
                    if (dist < margin) {
                        // Behandeln wie Kollision am nächsten Punkt
                        bestHit = { li: Math.max(0, i - 1), t: 0.5, point: { x: p.x, y: p.y } };
                        break;
                    }
                }
                if (bestHit) break;
            }
        }

        if (bestHit) {
            if (isOut) {
                const newPts = [];
                for (let i = 0; i <= bestHit.li; i++) newPts.push(lPts[i]);
                newPts.push(bestHit.point);
                this._applyShortenedPoints(leadPath, newPts, 'out');
                leadPath.endPoint = leadPath.points[leadPath.points.length - 1];
            } else {
                const newPts = [bestHit.point];
                for (let i = bestHit.li + 1; i < lPts.length; i++) newPts.push(lPts[i]);
                this._applyShortenedPoints(leadPath, newPts, 'in');
                leadPath.piercingPoint = leadPath.points[0];
            }
            leadPath.shortened = true;
            leadPath.multiContourCollision = true;
            leadPath.effectiveLength = this._pathLength(leadPath.points);
            return true;
        }
        return false;
    }

    /** Punkt-zu-Segment Distanz */
    _pointToSegDist(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1e-10) return Math.hypot(p.x - a.x, p.y - a.y);
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }

    /** Bounding-Box eines Punkt-Arrays */
    _getBBox(pts) {
        if (!pts || pts.length === 0) return null;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
        return { minX, minY, maxX, maxY };
    }

    /** BBox-Overlap mit Margin */
    _bboxOverlap(a, b, margin = 0) {
        return !(a.maxX + margin < b.minX || a.minX - margin > b.maxX ||
                 a.maxY + margin < b.minY || a.minY - margin > b.maxY);
    }

    /**
     * Statische Methode: Multi-Collision für ALLE Konturen auf einmal.
     * Aufrufen in Pipeline/App nach Kerf-Offset + Lead-Berechnung.
     */
    static checkAllCollisions(contours, safetyMargin = 0.5) {
        let totalModified = 0;
        for (const c of contours) {
            if (c.isReference) continue;
            if (c.checkMultiContourCollision(contours, safetyMargin)) {
                totalModified++;
            }
        }
        if (totalModified > 0) {
            console.log(`[CamContour V5.3] Lead-Routing: ${totalModified}/${contours.length} Leads angepasst`);
        }
        return totalModified;
    }

    // ════════════════════════════════════════════════════════════════
    // STARTPUNKT
    // ════════════════════════════════════════════════════════════════

    setStartPoint(worldPoint) {
        if (!this.isClosed || !this.points || this.points.length < 4) return;

        const result = Geometry.closestPointOnPolyline(worldPoint, this.points);
        if (!result) return;

        // V5.14 Fix: Bisher wurde immer der naechstliegende EXISTIERENDE Vertex gewaehlt
        // statt der tatsaechlichen Drag-Position auf der Kontur — auf langen geraden
        // Kanten ohne Zwischenpunkte (z.B. aus DXF) konnte der Startpunkt dadurch nur
        // auf die beiden Eckpunkte des Segments springen, NIE auf einen Punkt dazwischen.
        const segIdx = result.segmentIndex;
        const n = this.points.length - 1; // Letzter = erster bei closed
        const p1 = this.points[segIdx];
        const p2 = this.points[(segIdx + 1) % (n + 1)];
        const distToP1 = Geometry.distance(result.point, p1);
        const distToP2 = Geometry.distance(result.point, p2);
        // Snap auf existierenden Vertex nur in dessen unmittelbarer Naehe (MIN_SEGMENT-
        // Toleranz) — sonst wuerde jeder Drag in Richtung Ecke einen Mikro-Punkt knapp
        // daneben einfuegen statt exakt auf der Ecke zu landen.
        const SNAP_DIST = (typeof CeraCUT !== 'undefined' && CeraCUT.TOLERANCES?.MIN_SEGMENT) || 1.0;

        let pts = this.points;
        let bestIdx;
        if (distToP1 <= SNAP_DIST && distToP1 <= distToP2) {
            bestIdx = segIdx;
        } else if (distToP2 <= SNAP_DIST) {
            bestIdx = (segIdx + 1) % n;
        } else {
            // Drag-Position liegt auf einer geraden Strecke zwischen zwei Vertices —
            // neuen Punkt exakt dort einfuegen (Segment splitten), statt zu snappen.
            pts = this.points.slice();
            pts.splice(segIdx + 1, 0, { x: result.point.x, y: result.point.y });
            bestIdx = segIdx + 1;
        }

        if (bestIdx === 0 && pts === this.points) return;

        const newN = pts.length - 1;
        const rotated = [];
        for (let i = 0; i < newN; i++) {
            rotated.push(pts[(bestIdx + i) % newN]);
        }
        rotated.push({ x: rotated[0].x, y: rotated[0].y });
        this.points = rotated;
        this.startPointIndex = 0;
        this._rotationCount++;

        this.invalidate();
    }

    autoPlaceStartPoint(allContours) {
        if (!this.isClosed) return;

        const n = this.points.length - 1; // Closed: letzter = erster
        if (n < 4) return;

        const corners = Geometry.findCorners(this.points, this.cornerAngleThreshold);

        // Kandidaten sammeln: Ecken + gleichverteilte Positionen (alle 5°)
        const candidates = [];
        for (const c of corners) {
            if (c.index > 0 && c.index < n) candidates.push({ index: c.index, isCorner: true });
        }
        const step = Math.max(1, Math.round(n / 72));
        for (let i = step; i < n; i += step) {
            if (!candidates.some(c => c.index === i)) {
                candidates.push({ index: i, isCorner: false });
            }
        }

        if (candidates.length === 0) return;

        const origPoints = this.points.map(p => ({ x: p.x, y: p.y }));
        const origRotation = this._rotationCount;

        // Nachbarn für Clearance-Scoring (falls vorhanden)
        const neighbors = (allContours && allContours.length >= 2)
            ? this._getNeighborContours(allContours, 0.5)
            : [];

        let bestIdx = -1;
        let bestScore = -Infinity;
        let bestPoints = null;
        let bestRotation = origRotation;

        for (const cand of candidates) {
            // Punkte rotieren
            const rotated = [];
            for (let i = 0; i < n; i++) {
                rotated.push(origPoints[(cand.index + i) % n]);
            }
            rotated.push({ x: rotated[0].x, y: rotated[0].y });
            this.points = rotated;
            this._rotationCount = origRotation + cand.index;
            this.invalidate();

            const testLead = this.getLeadInPath();
            if (testLead?.points?.length >= 2 && !testLead.isFallbackCenterPierce) {
                // Clearance-Score (mit oder ohne Nachbarn)
                const clearance = neighbors.length > 0
                    ? this._calcClearanceScore(testLead.points, neighbors, 0.5)
                    : 100; // Ohne Nachbarn: kein Clearance-Limit

                // Flat-Segment-Bonus (V5.3): bevorzugt gerade Strecken
                const flatBonus = this._calcFlatSegmentBonus(cand.index, origPoints, n);

                // Corner-Penalty: Ecken werden abgewertet (×0.4)
                const adjustedScore = cand.isCorner
                    ? clearance * 0.4
                    : clearance * (1.0 + flatBonus);

                if (adjustedScore > bestScore) {
                    bestScore = adjustedScore;
                    bestIdx = cand.index;
                    bestPoints = rotated.map(p => ({ x: p.x, y: p.y }));
                    bestRotation = this._rotationCount;
                }
            }
        }

        if (bestIdx >= 0) {
            this.points = bestPoints;
            this._rotationCount = bestRotation;
            this.invalidate();
            this.startPointIndex = 0;
            console.debug(`[CamContour V5.3] autoPlace: idx=${bestIdx}, score=${bestScore.toFixed(1)}, flat-preferred`);
        } else {
            // Fallback: Original wiederherstellen
            this.points = origPoints;
            this._rotationCount = origRotation;
            this.invalidate();
        }
    }

    // ════════════════════════════════════════════════════════════════
    // CACHE + UTILS
    // ════════════════════════════════════════════════════════════════

    invalidate() {
        this._cachedKerfPolyline = null;
        this._cacheKey = null;
        this._cachedLeadInPath = null;
        this._cachedLeadOutPath = null;
        this._cachedOvercutPath = null;
        this.compensationSkipped = false;
    }

    get polyline() {
        const offsetResult = this.getKerfOffsetPolyline();
        if (!offsetResult || !offsetResult.points || offsetResult.points.length === 0) {
            return { points: this.points, isClockwise: Geometry.isClockwise(this.points) };
        }
        return { points: offsetResult.points, isClockwise: Geometry.isClockwise(offsetResult.points), flipped: offsetResult.flipped || false };
    }

    getCentroid() { return Geometry.centroid(this.points); }
    getBoundingBox() { return Geometry.boundingBox(this.points); }
    getArea() { return Math.abs(Geometry.getSignedArea(this.points)); }

    /** V4.5: Fläche in cm² (Vorbereitung Flächenklassen Phase 4) */
    getAreaCm2() { return this.getArea() / 100; }

    // ════════════════════════════════════════════════════════════════
    // PIERCING TYPE → R923-Wert (B.1)
    // ════════════════════════════════════════════════════════════════

    /** Gibt den R923-Wert für diesen Piercing-Typ zurück (Sinumerik 840D) */
    getPiercingR923() {
        const MAP = {
            'air_start':     0,
            'auto':          9,  // Rotationsanschuss — L201 dieser Maschine braucht R923=9
            'pierce_linear': 1,
            'stationary':    2,
            'circular':      3,
            'drilling':      4,
            'blind':         9
        };
        return MAP[this.piercingType] ?? 9;
    }

    // ════════════════════════════════════════════════════════════════
    // FLÄCHENKLASSEN (B.3)
    // ════════════════════════════════════════════════════════════════

    /**
     * Gibt die passende Flächenklasse für diese Kontur zurück.
     * Nur für Innen-Konturen (hole). Scheiben = null.
     *
     * @param {Array} areaClasses - Array von 6 Klassen:
     *   { maxAreaCm2, leadType, leadLength, leadRadius, leadAngle,
     *     overcut, piercingType, enabled }
     * @returns {Object|null} Passende Klasse oder null
     */
    getMatchingAreaClass(areaClasses) {
        if (this.cuttingMode !== 'hole') return null;
        if (!areaClasses || !Array.isArray(areaClasses)) return null;
        const areaCm2 = this.getAreaCm2();

        // Klassen sind nach maxAreaCm2 aufsteigend sortiert
        // Die erste Klasse die passt (areaCm2 <= maxAreaCm2) wird verwendet
        for (const cls of areaClasses) {
            if (!cls.enabled) continue;
            if (areaCm2 <= cls.maxAreaCm2) return cls;
        }
        return null; // Keine Klasse passt (größer als alle Maxima)
    }

    /**
     * Wendet eine Flächenklasse auf diese Kontur an.
     * Setzt Lead-Parameter basierend auf Flächenklasse.
     * @param {Object} cls - Flächenklasse aus getMatchingAreaClass()
     */
    applyAreaClass(cls) {
        if (!cls) return false;
        console.log(`[CamContour B.3] Flächenklasse angewendet: ${this.name}, Fläche=${this.getAreaCm2().toFixed(2)}cm², maxArea=${cls.maxAreaCm2}cm²`);

        if (cls.leadType)   this.leadInType   = cls.leadType;
        if (cls.leadLength !== undefined) this.leadInLength  = cls.leadLength;
        if (cls.leadRadius !== undefined) this.leadInRadius  = cls.leadRadius;
        if (cls.leadAngle  !== undefined) this.leadInAngle   = cls.leadAngle;
        if (cls.overcut    !== undefined) this.overcutLength = cls.overcut;
        if (cls.piercingType) this.piercingType = cls.piercingType;

        this.areaClassApplied = true;
        this.invalidate();
        return true;
    }

    /**
     * Standard-Flächenklassen nach CeraCUT Kap. 6.2 / IGEMS Handbuch.
     * Kann überschrieben werden durch user-Einstellungen in settings.areaClasses.
     */
    static defaultAreaClasses() {
        return [
            { maxAreaCm2: 1,    enabled: true, leadType: 'linear', leadLength: 2.0, leadRadius: 0,   leadAngle: 90, overcut: 0.5, piercingType: 'blind',   label: '< 1 cm²' },
            { maxAreaCm2: 4,    enabled: true, leadType: 'linear', leadLength: 4.0, leadRadius: 0,   leadAngle: 90, overcut: 1.0, piercingType: 'auto',    label: '1–4 cm²' },
            { maxAreaCm2: 10,   enabled: true, leadType: 'arc',    leadLength: 5.0, leadRadius: 2.0, leadAngle: 90, overcut: 1.0, piercingType: 'auto',    label: '4–10 cm²' },
            { maxAreaCm2: 25,   enabled: true, leadType: 'arc',    leadLength: 8.0, leadRadius: 3.0, leadAngle: 90, overcut: 1.0, piercingType: 'auto',    label: '10–25 cm²' },
            { maxAreaCm2: 100,  enabled: true, leadType: 'arc',    leadLength: 12.0,leadRadius: 4.0, leadAngle: 90, overcut: 1.5, piercingType: 'auto',    label: '25–100 cm²' },
            { maxAreaCm2: 9999, enabled: true, leadType: 'arc',    leadLength: 15.0,leadRadius: 5.0, leadAngle: 90, overcut: 1.5, piercingType: 'auto',    label: '> 100 cm²' }
        ];
    }

    // ════════════════════════════════════════════════════════════════
    // DYNAMIC LEAD RESOLUTION (B.2)
    // ════════════════════════════════════════════════════════════════

    /**
     * Berechnet die effektive Lead-In-Länge für Dynamic Lead (B.2).
     * Findet den maximalen Platz ab Entry-Punkt ohne Kollision (binomial search),
     * klemmt dann auf [leadInLengthMin, leadInLengthMax].
     *
     * Wird automatisch in getLeadInPath() gerufen wenn leadInDynamic=true.
     */
    _calcDynamicLeadLength(entry, tangent, normal, contourPts) {
        const MIN = this.leadInLengthMin;
        const MAX = this.leadInLengthMax;
        const origLen = this.leadInLength;

        // Binäre Suche: Maximal mögliche Länge ohne Kollision
        let lo = MIN, hi = MAX, best = MIN;
        for (let iter = 0; iter < 8; iter++) {  // 8 Iterationen = ~1% Genauigkeit
            const mid = (lo + hi) / 2;
            this.leadInLength = mid;
            const testPath = this.leadInType === 'arc'
                ? this._calcArcLeadIn(entry, tangent, normal)
                : this._calcLinearLeadIn(entry, tangent, normal);
            const shortened = this._shortenLeadIfCollision({ ...testPath, points: [...testPath.points] }, contourPts);
            if (!shortened.shortened) {
                best = mid;
                lo = mid;  // Vergrößern
            } else {
                hi = mid;  // Verkleinern
            }
        }

        this.leadInLength = origLen;  // Restore
        const dynamicLen = Math.max(MIN, Math.min(MAX, best));
        console.log(`[CamContour B.2] Dynamic Lead: ${this.name}, L=${dynamicLen.toFixed(2)}mm (min=${MIN}, max=${MAX})`);
        return dynamicLen;
    }

    /** V4.5: Gibt das aktive Lead-Set als Debug-Info zurück */
    getLeadSetInfo() {
        return {
            cuttingMode: this.cuttingMode,
            isInternal: this._isEffectivelyHole(),
            leadInType: this.leadInType,
            leadInLength: this.leadInLength,
            leadInRadius: this.leadInRadius,
            leadInAngle: this.leadInAngle,
            leadInArcAngle: this.leadInArcAngle,
            leadOutLength: this.leadOutLength,
            overcutLength: this.overcutLength,
            piercingType: this.piercingType,
            piercingR923: this.getPiercingR923(),
            areaCm2: this.getAreaCm2(),
            areaClassApplied: this.areaClassApplied,
            leadInDynamic: this.leadInDynamic,
            altLeadEnabled:   this.altLeadEnabled,
            altLeadType:      this.altLeadType,
            altLeadInLength:  this.altLeadInLength,
            altLeadInAngle:   this.altLeadInAngle,
            altLeadOutLength: this.altLeadOutLength,
            altOvercutLength: this.altOvercutLength
        };
    }

    /** V4.5: Deep-Clone inkl. aller Lead-Properties */
    clone() {
        const pts = this.points.map(p => ({ ...p }));
        const c = new CamContour(pts, {
            name: this.name,
            cuttingMode: this.cuttingMode,
            kerfWidth: this.kerfWidth,
            quality: this.quality,
            layer: this.layer,
            isReference: this.isReference,
            type: this.type,
            leadInType: this.leadInType,
            leadInLength: this.leadInLength,
            leadInRadius: this.leadInRadius,
            leadInAngle: this.leadInAngle,
            leadInArcAngle: this.leadInArcAngle,
            leadOutArcAngle: this.leadOutArcAngle,
            leadOutType: this.leadOutType,
            leadOutLength: this.leadOutLength,
            leadOutRadius: this.leadOutRadius,
            leadOutAngle: this.leadOutAngle,
            cornerLeadType: this.cornerLeadType,
            cornerLeadAngle: this.cornerLeadAngle,
            cornerDegradeThreshold: this.cornerDegradeThreshold,
            overcutLength: this.overcutLength,
            overcutAtCorners: this.overcutAtCorners,
            overcutCornerAngle: this.overcutCornerAngle,
            piercingType: this.piercingType,
            preferCorners: this.preferCorners,
            cornerAngleThreshold: this.cornerAngleThreshold,
            altLeadEnabled:   this.altLeadEnabled,
            altLeadType:      this.altLeadType,
            altLeadInLength:  this.altLeadInLength,
            altLeadInAngle:   this.altLeadInAngle,
            altLeadOutLength: this.altLeadOutLength,
            altOvercutLength: this.altOvercutLength,
            // B.1 Piercing (piercingType bereits oben gesetzt)
            piercingStationaryTime:  this.piercingStationaryTime,
            piercingCircularRadius:  this.piercingCircularRadius,
            piercingCircularTime:    this.piercingCircularTime,
            // B.2 Dynamic Lead
            leadInDynamic:   this.leadInDynamic,
            leadInLengthMin: this.leadInLengthMin,
            leadInLengthMax: this.leadInLengthMax
        });
        c.kerfSide = this.kerfSide;
        c.startPointIndex = this.startPointIndex;
        c.leadManualOverride = this.leadManualOverride;
        c.areaClassApplied = this.areaClassApplied;
        c.kerfFlipped = this.kerfFlipped;
        c.kerfComp = this.kerfComp;
        c.isClosed = this.isClosed;
        c.isSelected = false;
        c.microjoints = this.microjoints ? this.microjoints.map(j => ({ ...j })) : [];
        c._rotationCount = this._rotationCount;
        c.nestingLevel = this.nestingLevel;  // V5.2: Intarsien braucht Nesting-Level
        c.hatch = this.hatch ? { ...this.hatch } : null;
        c.isHatchContour = this.isHatchContour;  // V5.6: Hatch-Entity
        c.parentContourName = this.parentContourName;
        c.materialGroup = this.materialGroup;    // V5.5: Multi-Material
        c.intarsiaRole = this.intarsiaRole;      // V5.5: base/insert
        c.gaps = this.gaps.map(g => ({ ...g }));           // V5.7: Gap Detection
        c.healedGaps = this.healedGaps.map(g => ({ ...g })); // V5.7: Gap Detection
        c.entitySeams = (this.entitySeams || []).map(s => ({ ...s })); // V5.11: Gap Detection (echte Naht-Distanzen)
        // Spline-/Arc-/Sortier-Metadaten (analog toJSON)
        c._fitPoints = this._fitPoints ? this._fitPoints.map(p => ({ ...p })) : null;
        c._splineClosed = this._splineClosed;
        if (this.sourceType !== undefined) c.sourceType = this.sourceType;
        if (this._splineData !== undefined) c._splineData = this._splineData ? JSON.parse(JSON.stringify(this._splineData)) : this._splineData;
        c.cutOrder = this.cutOrder;
        if (this._arcSegments) c._arcSegments = JSON.parse(JSON.stringify(this._arcSegments));
        if (this._originalPoints) c._originalPoints = this._originalPoints.map(p => ({ ...p }));
        return c;
    }

    /**
     * Serialisiert alle Datenfelder (auch extern angehängte wie sourceType,
     * _splineData, microjoints, nestingLevel) — denylist statt allowlist, damit
     * neue/extern angehängte Properties automatisch mit-persistiert werden.
     * Cache-/Transient-Felder werden ausgeschlossen (werden bei Bedarf neu berechnet).
     */
    toJSON() {
        const data = {};
        for (const key of Object.keys(this)) {
            if (CamContour._TRANSIENT_KEYS.includes(key)) continue;
            data[key] = this[key];
        }
        return data;
    }

    /** Rekonstruiert eine CamContour-Instanz aus toJSON()-Daten (V5.10 — Dokument-Persistenz) */
    static fromJSON(data) {
        const points = (data.points || []).map(p => ({ ...p }));
        const c = new CamContour(points, {});
        Object.assign(c, data);
        c.points = points;
        c.isSelected = false;
        c.isHovered = false;
        c._cachedKerfPolyline = null;
        c._cacheKey = null;
        c._cachedLeadInPath = null;
        c._cachedLeadOutPath = null;
        c._cachedOvercutPath = null;
        return c;
    }

    isNearPoint(point, tolerance = 5) {
        if (!point || !this.points || this.points.length < 2) return false;
        const result = Geometry.closestPointOnPolyline(point, this.points);
        return result && result.distance <= tolerance;
    }

    getCornersForLooping() { return []; }

    /**
     * Kerf-Seite umkehren (Kompensation flippen)
     * Loch: normalerweise innen -> flippt nach außen
     * Scheibe: normalerweise außen -> flippt nach innen
     */
    toggleKerfSide() {
        this.kerfFlipped = !this.kerfFlipped;
        this.invalidate();
    }
}

CamContour.nextId = 1;

// V5.10: Cache-/Transient-Felder, die toJSON() von der Persistenz ausschließt
CamContour._TRANSIENT_KEYS = [
    '_cachedKerfPolyline', '_cacheKey', '_cachedLeadInPath', '_cachedLeadOutPath',
    '_cachedOvercutPath', 'isSelected', 'isHovered'
];

if (typeof module !== 'undefined' && module.exports) { module.exports = CamContour; }
