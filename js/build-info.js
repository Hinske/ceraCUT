/**
 * CeraCUT Build Info V6.62
 * Version: V6.62
 * Last Modified: 2026-06-26 MEZ
 * Build: 20260626-kreisfix
 *
 * Zeigt Versionsinformationen in der Console
 */

const CERACUT_BUILD = {
    version: '6.62',
    build: '20260626-kreisfix',
    date: '2026-06-26',
    time: '14:30 MEZ',

    // Git-Commit — wird bei jedem Commit aktualisiert (Pflicht-Checkliste)
    git: {
        hash: '2b21004',
        date: '2026-06-26 13:10:05 +0200',
        message: 'fix: Kreisendpunktfehler — G03/G02 jetzt mit CR= statt I/J (sinumerik-pp V2.1, build V6.62)'
    },

    modules: {
        'dxf-parser':         { version: '3.18', build: '20260625-chainsplinedataloss' },
        'geometry':           { version: '2.13', build: '20260624-gapfix' },
        'pipeline':           { version: '3.9', build: '20260624-referencerefresh' },
        'cam-contour':        { version: '5.21', build: '20260626-r923fix' },
        'canvas-renderer':    { version: '3.42', build: '20260625-snapcenterfix' },
        'undo-manager':       { version: '1.3', build: '20260625-deletedcontourguard' },
        'sinumerik-pp':       { version: '2.1', build: '20260626-kreisfix' },
        'command-line':       { version: '1.5', build: '20260624-polarinput' },
        'snap-manager':       { version: '1.5', build: '20260625-snapcenterfix' },
        'geometry-ops':       { version: '2.6', build: '20260624-cadimprovements7' },
        'drawing-tools':      { version: '2.18', build: '20260625-thickerpreview' },
        'drawing-tools-ext':  { version: '1.10', build: '20260625-splineclosedring' },
        'dynamic-input':      { version: '1.1', build: '20260623-autocadfeel' },
        'tool-manager':       { version: '2.2', build: '20260216-0015' },
        'layer-manager':      { version: '1.2', build: '20260324-undofix' },
        'text-tool':          { version: '1.2', build: '20260312-textimport' },
        'dxf-writer':         { version: '1.11', build: '20260625-splineclosedguard' },
        'lead-profiles':      { version: '1.4', build: '20260625-cornerleadslot' },
        'app':                { version: '6.32', build: '20260626-sortfix' },
        'document-manager':   { version: '1.4', build: '20260625-tabswitch-cancel' },
        'project-manager':    { version: '1.0', build: '20260313-workspace' },
        'properties-panel':   { version: '1.5', build: '20260316-hatchentity' },
        'debug-monitor':      { version: '1.1', build: '20260324-gitcommit' },
        'nesting':            { version: '1.1', build: '20260315-bugfix35' },
        'toolpath-simulator': { version: '1.1', build: '20260625-simcrashfix' },
        'cost-calculator':    { version: '1.2', build: '20260623-bugfixaudit' },
        'machine-profiles':   { version: '1.1', build: '20260624-userlogin' },
        'bridge-cutting':     { version: '1.0', build: '20260309' },
        'quality-zones':      { version: '1.1', build: '20260315-bugfix35' },
        'cam-tools':          { version: '1.4', build: '20260625-analyzefix' },
        'advanced-tools':     { version: '1.8', build: '20260625-filletjoin' },
        'arc-fitting':        { version: '3.1', build: '20260315-bugfix35' },
        'measure-tool':       { version: '1.2', build: '20260325-curvcheck' },
        'dimension-tool':     { version: '2.4', build: '20260326-dimedit' },
        'dxf-browser':        { version: '1.1', build: '20260624-userlogin' },
        'server':             { version: '1.6', build: '20260625-slowlorisfix' },
        'user-store':         { version: '1.0', build: '20260624-userlogin' },
        'session-store':      { version: '1.0', build: '20260624-userlogin' },
        'auth-helper':        { version: '1.0', build: '20260624-userlogin' }
    },

    changes: [
        'V6.62: Fix — Kreisendpunktfehler behoben (sinumerik-postprocessor.js V2.1): ' +
        'ArcFitting (Least-Squares) erzeugt Kreise die nicht exakt durch Start/Endpunkt gehen — ' +
        'Δr bis 0.4mm bei großen Radien (202mm), weit über Sinumerik-Toleranz MD21010 (~0.01mm). ' +
        'Folge: Alarm "Kanal 1 Satz N11 Kreisendpunktfehler" — Maschine bricht ab. ' +
        'Fix: CR=-Format statt I/J in allen G02/G03-Ausgaben. Mit CR= berechnet die Sinumerik ' +
        'das Zentrum selbst aus Radius + Start + End — kein Endpunkt-Check. ' +
        'Neue _cr()-Methode berechnet signierten CR-Wert (positiv=kurz, negativ=lang). ' +
        'curX/curY-Tracking in _generateClosedContour() und _generateSlitContour() added.',
        'V6.61: Fix — R923=9 als Standard-Anschlussart (cam-contour.js V5.21): ' +
        'getPiercingR923(): piercingType="auto" lieferte R923=1 (Linearer Anschuss) — ' +
        'L201 dieser Maschine kennt R923=1 nicht, wirft "fehlende Anschlussparameter". ' +
        'WARICAM (Referenz, läuft auf der Maschine) benutzt R923=9 für alle Konturen. ' +
        'Fix: "auto"→9, Fallback ??→9. piercingType="pierce_linear" bleibt auf R923=1 ' +
        '(explizite Wahl des Benutzers, kein Auto-Fallback).',
        'V6.60: Fix — Koordinaten-Normierung im Postprozessor (sinumerik-postprocessor.js V2.0): ' +
        'Der Nullpunkt (settings.origin) wurde nie an den Postprozessor übergeben — alle X/Y-Koordinaten ' +
        'im CNC-Code waren rohe DXF-Weltkoordinaten statt maschinenrelative Koordinaten. ' +
        'Folge: G00 X1085 statt G00 X155 für eine 370mm-Platte — Schneidkopf würde weit außerhalb ' +
        'der Platte ansetzen und mit Verfahrwegfehler abbrechen. ' +
        'Fix: app.js übergibt origin an generate()/generateDownload() (alle 3 Call-Sites). ' +
        'Postprozessor speichert _ox/_oy, neue Methoden _tx(x)/_ty(y) subtrahieren Origin vor Ausgabe. ' +
        'Alle absoluten X/Y-Positionen (G00, G01, G02, G03, G40) nutzen _tx/_ty. ' +
        'Arc I/J-Werte (relative Vektoren) bleiben unverändert (_fc).',
        'V6.58: Feature — Fillet Cross-Contour JOIN (advanced-tools.js V1.8): ' +
        'Fillet-Tool verbindet jetzt zwei separate offene Linien zu einer Kontur. ' +
        'R=0: spitze Ecke (trim/extend zum Schnittpunkt + JOIN). ' +
        'R>0: Bogen einfügen + JOIN. Beide Varianten sind vollständig undo-bar. ' +
        'Preview für R>0 cross-contour ergänzt.',
        'V6.57: UX — Preview-Linie beim Zeichnen dicker (drawing-tools.js V2.18): ' +
        'Rubber-Band lineWidth 1.0→2.0/scale, Opazität 0.6→0.85, Strichlänge [4,4]→[6,3] ' +
        'für bessere Erkennbarkeit von Kreis/Rechteck/Linie/Bogen vor der Bestätigung. ' +
        'Spline-Kurve lineWidth erhöht, Kontrollpolygon bleibt dünn (1.0/scale).',
        'V6.56: Fix — AnalyzeTool 3 Bugs behoben (cam-tools.js V1.4): ' +
        '(1) finish()-Blockade: ModificationTool.finish() brach bei leerer Selektion hart ab — ' +
        'der Fallback "alle Konturen analysieren" war toter Code. Fix: finish() in AnalyzeTool ' +
        'überschreiben, leere Selektion → _executeAnalyze() direkt aufrufen. ' +
        '(2) Same-Contour-Blindheit: Lücke zwischen Start/End einer offenen Polylinie wurde ' +
        'nicht erkannt weil der paarweise Vergleich bei gleicher Kontur komplett übersprang. ' +
        'Fix: Skip nur bei gleichartigem Typ (start↔start, end↔end); start↔end derselben ' +
        'Kontur wird jetzt als Lücke erkannt. Überlappungs-Marker auf gleiche Kontur ausgeschlossen. ' +
        '(3) State-Leak + Undo-Stack-Müll: Alte Marker blieben beim Tool-Neustart sichtbar; ' +
        'jede Analyse schrieb einen neuen Undo-Eintrag ohne den vorherigen zu ersetzen. ' +
        'Fix: start() löscht _analyzeMarkers; _executeAnalyze() prüft ob top-of-stack _isAnalyzeCmd ' +
        'und ersetzt ihn statt aufzustapeln.',
        'V6.55: Fix — SplineTool geschlossener Ringschluss (drawing-tools-ext.js V1.10): ' +
        'handleClick() und handleOption(S) pushten den Startpunkt nicht in fitPoints — ' +
        'die Kurve sah geschlossen aus, points[0] !== points[last] führte aber in der ' +
        'Pipeline zum Slit-Fallback statt Disc/Hole. Fix: Startpunkt exakt als letzten ' +
        'fitPoints-Eintrag anfügen + _tessellate() erzwingt exakten Ringschluss.',
        'V6.54: Fix — Snap-Punkte falsch positioniert (snap-manager.js V1.5, canvas-renderer.js V3.42, app.js V6.31): ' +
        '(1) contour._center/_radius (DXF-Parser-Eigenschaften mit Unterstrich) wurden im Snap-Manager ' +
        'nicht erkannt — contour.center war immer undefined. Center-Snap und Quadrant-Snap für importierte ' +
        'Kreise/Bögen fehlten vollständig. Fix: (contour.center || contour._center). ' +
        '(2) Endpoint-Spam für Kreiskonturen: Alle 32 Tessellations-Punkte wurden als Endpoints ' +
        'registriert statt nur Quadrant- und Center-Snaps (AutoCAD-konform). ' +
        'Fix: Bei Kreiskonturen (isClosed + center + radius) werden Endpoints/Midpoints unterdrückt. ' +
        '(3) _pointsCache nicht invalidiert nach Grip-Editing und nach addDrawnEntities() — ' +
        'Snap-Punkte zeigten alte Positionen. Fix: invalidatePointsCache() nach Grip-Ende ' +
        'und in onChanged() aufgerufen. ' +
        '(4) MouseMove-Guard prüft jetzt auch Array-Länge (nicht nur Referenz-Identität), ' +
        'damit neu gezeichnete Konturen sofort im Snap erscheinen.',
        'V6.53: Fix — Simulation Crash (toolpath-simulator.js V1.1): ' +
        '(1) Trail-Rendering von O(n²) auf O(1) umgestellt: Trail-Array durch Off-Screen-' +
        'History-Canvas ersetzt — jeder Frame zeichnet nur den neuen Abschnitt auf den ' +
        'History-Canvas und compositet ihn per drawImage(). Verhindert UI-Freeze bei langen ' +
        'Schneidpfaden. ' +
        '(2) worldToCanvas-Formel korrigiert: stimmte nicht mit renderer.worldToScreen ueberein, ' +
        'Pfad wurde falsch positioniert. Neue Formel: x=(wx*scale+offsetX)*dpr, y=(-wy*scale+offsetY)*dpr. ' +
        '(3) Simulation benutzt jetzt Overlay-Canvas (Position:absolute ueber canvas-area) ' +
        'statt des Haupt-Canvas — Haupt-UI bleibt erhalten, Stop-Button schließt Overlay. ' +
        '(4) API-Aufruf gefixt: startAnimation(..., 5) uebergab Number statt Object als options, ' +
        'speed-Parameter wurde ignoriert. ' +
        '(5) onComplete-Callback stellt Haupt-Canvas wieder her (renderer.render()).',
        'V6.52: Fix — 3 Robustheitsfixes (agent-gestuetzte Code-Inspektion): ' +
        '(1) app.js V6.30: Startpunkt-Grip-Edit rief undoStack.push()+redoStack=[] ohne ' +
        '_notifyStateChange() — Undo/Redo-Buttons blieben nach Startpunkt-Verschiebung im ' +
        'veralteten State (weder aktiv noch grayed korrekt). ' +
        '(2) app.js V6.30: invalidateGrips() fehlte in 5 Selektions-Pfaden (Cut-Order-Click, ' +
        'btn-select-all, btn-select-none, Konturen-Panel-Click, ESC, STRG+A) — _hasSelection ' +
        'blieb false, Grip-Punkte wurden nach Selektion nicht angezeigt. ' +
        '(3) app.js V6.30: isSetupComplete() verlangte zwingend isReference-Kontur UND originSet ' +
        '— Einzelteil-Workflow ohne Plattenrahmen war vollstaendig gesperrt. Origin-Setzung ' +
        'allein reicht; Referenz ist optional.',
        'V6.51: Fix (Bug-Sweep) — 5 Robustheitsfixes aus systematischer Code-Inspektion: ' +
        '(1) sinumerik-postprocessor.js V1.9: _processArcLeadExact() hatte keinen pts.length-' +
        'Check — bei 1-Punkt-Lead-Pfad wurde pts[1]=undefined indexiert und NaN-I/J in den ' +
        'G-Code geschrieben. Guard ergaenzt, Fallback auf _processContourPoints(). ' +
        '(2) app.js V6.27: getContourPerimeter() zahlte Schliessungssegment (letzter→erster ' +
        'Punkt) bei isClosed-Konturen nicht — Auto-Microjoint-Positionen lagen leicht ' +
        'verschoben. Segment wird jetzt addiert. ' +
        '(3) canvas-renderer.js V3.41: Geometry.interiorPoint() im Disc-Fill-Hole-Cutout ' +
        'ohne Existenz-Check aufgerufen (Guard + Fallback auf points[0] ergaenzt). ' +
        '_drawHatchDots() nutzte Float-Loop-Counter mit Drift-Risiko — auf Integer-Counter ' +
        'umgestellt. ' +
        '(4) cam-contour.js V5.20: _truncatePathToHalfLength() indexierte points[0] ohne ' +
        'vorherige Laengenprüfung bei leerem Array — return [undefined] war möglich. ' +
        'Guard if (!points || points.length === 0) return [] ergaenzt.',
        'V6.50: Feat — Toolpath-Verifikation ("Verifizieren"-Button) zeigte bisher nur die ' +
        'Anzahl der Warnungen/Fehler an (z.B. "11 Warnungen"), ohne deren Inhalt — die Meldung ' +
        'war ohne Konsolen-Zugriff nutzlos. ToolpathSimulator.verify() liefert die konkreten ' +
        'Texte (result.errors/result.warnings) bereits, sie wurden nur nie angezeigt. Klick auf ' +
        'die Ergebnis-Zeile oeffnet jetzt ein Modal mit der vollstaendigen Liste ' +
        '(_showSimVerifyModal() in app.js V6.26); zusaetzlich werden die Listen immer in die ' +
        'Konsole geloggt.',
        'V6.49: Fix — chainContours() verkettete mehrere Original-Entities (z.B. SPLINE + ' +
        'mehrere LINEs) korrekt zu einer durchgehenden Kontur, reichte aber weiterhin nur die ' +
        'rohen _splineData/_fitPoints DES ERSTEN Segments durch. War das erste Segment eine ' +
        'SPLINE, schrieb dxf-writer.js beim Export nur dieses winzige erste Fragment — der ' +
        'Rest der Kontur (alle angeketteten Segmente) wurde komplett verworfen. Das ist die ' +
        'eigentliche Ursache der "verstreuten Bruchstuecke" (Praxisfall Irlich_Entwurf2/3/4.dxf, ' +
        'mit Node-Testfall nachgebaut: SPLINE+4×LINE zu einem 100×100mm-Quadrat verkettet ergab ' +
        '1 Kontur mit 7 Punkten, aber nur 4 Kontrollpunkte vom ersten Mini-Segment wurden ' +
        'weitergereicht). Cache-Felder werden jetzt nur durchgereicht, wenn beim Verketten ' +
        'nichts angehaengt wurde — sonst faellt der Export automatisch auf die vollstaendige ' +
        'Polyline aus der gesamten Punktliste zurueck (dxf-parser V3.18).',
        'V6.48: Fix — SPLINE-Closed-Flag (DXF Gruppencode 70, Bit 1) wurde beim Import blind ' +
        'uebernommen. Manche Vektor-Tools (z.B. aus Illustrator/CorelDraw abgeleitete DXF-' +
        'Exporter) setzen dieses Bit faelschlich auf JEDES einzelne Spline-Segment eines ' +
        'zusammengesetzten Pfades statt nur aufs Gesamtpolygon — Start/Ende eines einzelnen ' +
        'Segments lagen dabei mehrere cm auseinander, obwohl isClosed=true gesetzt war. Da ' +
        'canvas-renderer.js fuer isClosed-Konturen automatisch eine Schluss-Linie vom letzten ' +
        'zum ersten Punkt zeichnet, entstand eine sichtbare falsche Sehne quer durchs Bauteil ' +
        '("verstreute"/falsche Geometrie nach Export — Praxisfall Irlich_Entwurf2.dxf: 39 von ' +
        '39 SPLINE-Entities betroffen, Fehler ueberlebte mehrere Export/Re-Import-Zyklen). ' +
        '_parseSpline() validiert das Closed-Flag jetzt gegen die tatsaechliche Kurven-' +
        'Geometrie (dxf-parser V3.17); dxf-writer.js prueft beim Re-Export defensiv dieselbe ' +
        'Bedingung gegen die Roh-Fit-/Control-Punkte, bevor das Closed-Bit gesetzt wird ' +
        '(dxf-writer V1.11).',
        'V6.47: Fix — Geloeschte Konturen tauchten nach einem Layer-Sichtbarkeits-Toggle ' +
        'wieder auf: applyLayerSelection() baute die Konturliste bei JEDEM Aufruf (auch bei ' +
        'reinem Visibility-Toggle) komplett neu aus dxfResult.contours auf — dem unveraenderten ' +
        'Parse-Output, der bei Loeschungen nie aktualisiert wird (nur app.contours wird per ' +
        'splice() angepasst). Neues persistentes Set app.deletedContourNames (Schluessel: ' +
        'stabiler contour.name, da Objekt-Identitaet ueber Pipeline-Reruns nicht erhalten ' +
        'bleibt) wird von DeleteContoursCommand befuellt/geleert und in applyLayerSelection() ' +
        'als zusaetzlicher Ausschlussfilter angewendet; Reset bei neuem DXF-Import, ' +
        'Persistenz pro Tab im Document-Manager-Swap. Dabei aufgefallen: _runPipelineKeepUndo() ' +
        'wies this.contours bisher ein KOMPLETT NEUES Array zu — Undo-Stack-Commands (z.B. ' +
        'DeleteContoursCommand), die das alte Array-Objekt referenzieren, griffen danach ins ' +
        'Leere, STRG+Z wurde nach einem Sichtbarkeits-Toggle zum stillen No-Op (vorher durch ' +
        'den dxfResult-Bug verdeckt, da die Loeschung ohnehin "von selbst" wieder rueckgaengig ' +
        'wirkte). Jetzt length=0+push() statt Neuzuweisung, Array-Identitaet bleibt erhalten ' +
        '(app V6.25, undo-manager V1.3, document-manager V1.2, drawing-tools V2.16, ' +
        'advanced-tools V1.7).',
        'V6.46: Fix — _writeSpline()/_writeCircle() bevorzugten beim DXF-Export immer die ' +
        'rohen Import-Cache-Felder (_splineData.controlPoints/fitPoints, _fitPoints, _center) ' +
        'vor den aktuellen contour.points. Move/Rotate/Mirror/Scale (drawing-tools.js) ' +
        'transformieren aber AUSSCHLIESSLICH contour.points — der Cache wird dabei nie ' +
        'mitverschoben. Ein verschobenes importiertes Spline/Circle-Objekt wurde beim ' +
        'naechsten DXF-Export also wieder an seiner URSPRUENGLICHEN Position geschrieben ' +
        '(derselbe Bug-Typ wie V6.45, hier durch Tool-Transformationen statt fehlende Import-' +
        'Normalisierung ausgeloest). Neue _isCacheStale()-Pruefung vergleicht die Bounding-' +
        'Box-Zentren von .points und Cache-Rohdaten (Toleranz = eigene Kontur-Diagonale, ' +
        'tolerant genug fuer normale Kontrollpolygon-Abweichung bei gekruemmten Splines) — ' +
        'bei Drift faellt der Export auf eine Polyline aus den aktuellen .points zurueck ' +
        '(dxf-writer V1.10).',
        'V6.45: Fix — Dateien mit Geometrie weit ausserhalb der Plattengroesse (Praxisfall: ' +
        'Quelle lag ~30m vom DXF-Ursprung entfernt, Plattengroesse nur 362x342mm) wurden nicht ' +
        'auto-normalisiert: NORMALIZATION_THRESHOLD griff erst bei absurd grossen Distanzen ' +
        '(1.000.000) statt bei jeder fuer ein Werkstueck unplausiblen Verschiebung — auf 10.000 ' +
        'gesenkt. Zusaetzlich verschob _autoNormalizeEntities() bislang nur entity.points, nicht ' +
        'aber die Rohdaten fuer Re-Export (_splineData.controlPoints/fitPoints, _fitPoints, ' +
        '_center) — dxf-writer.js bevorzugt bei SPLINE/CIRCLE diese Rohdaten vor .points und ' +
        'schrieb dadurch beim Re-Export die urspruengliche, falsche Position zurueck. Symptom: ' +
        'DXF-Export crashte AutoCAD, WariCAM zeigte nur verstreute Bruchstuecke, generierter ' +
        'CNC-Code enthielt Verfahrwege von ueber 29 Metern (dxf-parser V3.16).',
        'V6.44: Refactor — Eigene Corner-Lead-Kategorie statt verstreuter Magic-Number-' +
        'Overrides: Vergleich mit dem IGEMS-Industriestandard (Kap. 10.13.2) zeigte, dass ' +
        'dort External/Internal/Corner/Alternative vier unabhängige Lead-Slots sind — bei ' +
        'uns war die Ecke bisher kein eigener Slot, sondern Laufzeit-Overrides mitten in ' +
        'getLeadInPath()/getLeadOutPath() (Arc→Linear-Degradierung, 0°-Winkel, 60°-' +
        'Schwelle), die in dieser Session viermal nachgebessert werden mussten. Neue ' +
        'Properties cornerLeadType/cornerLeadAngle/cornerDegradeThreshold (Default ' +
        '"linear"/0°/60° = 1:1 altes Verhalten) sowie eigene "corner"-Sektion in allen 8 ' +
        'Lead-Profilen. Zusätzlich: konsolidierter _minSelfClearance()-Helper ersetzt die ' +
        'bisher separate, längen-proportionale Skip-Radius-Logik in _calcClearanceScore() ' +
        '(derselbe Bug-Typ wie V6.43) durch dieselbe feste Schwelle wie ' +
        '_capLengthForNarrowChannel(). Noch ohne UI (Backend-Refactor, Properties-Panel/' +
        'Profil-Editor als Fast-Follow) (cam-contour V5.19, lead-profiles V1.4, app V6.24).',
        'V6.43: Fix — V6.42 (Halbierung bei Selbst-Kollision) griff nur, wenn der Lead die ' +
        'gegenüberliegende Kante tatsächlich KREUZT. Ein an Ecken auf 0° (tangential, V6.40) ' +
        'erzwungener Lead läuft in einem engen, gekrümmten Kanal aber LÄNGS ohne je zu kreuzen ' +
        '— lief dadurch ungebremst bis zum Ende des Kanals (Regression, sichtbar als langer ' +
        'Lead quer durch die ganze Kontur). Neue _capLengthForNarrowChannel() kappt die ' +
        'Lead-Länge jetzt VOR der Pfad-Berechnung direkt auf die Hälfte des kürzesten ' +
        'Eigenabstands, unabhängig von der Lead-Richtung; leadInLength/leadOutLength werden ' +
        'dabei nur temporär überschrieben (wie Dynamic Lead), keine dauerhafte Mutation ' +
        '(cam-contour V5.18).',
        'V6.42: Feat — Bei engen Konturen (Selbst-Kollision: gegenüberliegende Kante derselben ' +
        'Kontur sehr nah, z.B. schmale Stege/Nuten) wird der Lead jetzt nur bis zur HÄLFTE der ' +
        'Distanz zur Kante gekürzt statt bis zur Kante selbst — der Pierce-Punkt bleibt damit ' +
        'mittig im engen Freiraum statt durch Kerf-Toleranzen real auf/jenseits der ' +
        'gegenüberliegenden Kante zu landen (_shortenLeadIfCollision + neue ' +
        '_truncatePathToHalfLength(), cam-contour V5.17).',
        'V6.41: Feat — Multi-Kontur-Kollisionsprüfung (CamContour.checkAllCollisions) lief ' +
        'bisher nur über den manuellen "Multi-Collision"-Button im CAM-Ribbon. autoPlaceStartPoint() ' +
        'nutzt Nachbar-Clearance nur fürs Scoring, der finale Lead/Alt-Lead konnte trotzdem in eine ' +
        'eng benachbarte Kontur laufen (sichtbar bei dicht gepackten Mustern, z.B. Intarsien-Raster) ' +
        '— die Dog-Leg/Rotation/Shortening-Strategien griffen erst nach manuellem Klick. Neue ' +
        '_runMultiContourCollisionCheck() (app.js) läuft jetzt automatisch nach jedem finalen ' +
        'Lead-Apply (_commitLeadChanges(), Wizard-Step-4-Eintritt) (app V6.23).',
        'V6.40: Feat — Linearer Lead-Winkel an Ecken (z.B. 90°-Aussenecken) jetzt 0° (rein ' +
        'tangential zum Eck-Bisektor) statt vorher 90° (senkrecht zur Verschnittflaeche) — ' +
        'Lead laeuft jetzt entlang der Eck-Diagonale an statt frontal senkrecht ' +
        '(cam-contour V5.16).',
        'V6.39: Fix — Arc-Lead an echten Ecken (z.B. 90°-Aussenecken) erzeugte eine ' +
        'unnoetige S-Schleife (Gerade+Bogen tangential nur zum Eck-Bisektor statt zur ' +
        'tatsaechlichen Kante — der Tangentialitaets-Vorteil eines Arc-Leads ist an einer ' +
        'Ecke ohnehin hinfaellig, da es dort zwei Kantenrichtungen statt einer gibt). Die ' +
        'Arc→Linear-Degradierschwelle in getLeadInPath()/getLeadOutPath() wurde von >120° ' +
        'auf >60° gesenkt — normale Rechteckecken (90°) bekommen jetzt automatisch ' +
        'Linear-Lead, sanfte Knicke (<60°, z.B. grob tessellierte Kurven) behalten Arc ' +
        '(cam-contour V5.15).',
        'V6.38: Fix — Arc-Leads an Konturecken (insb. 90°-Aussenecken) wurden in der Vorschau ' +
        'als fast vollstaendige Kreisschleife statt als kleiner 90°-Bogen gezeichnet. Ursache: ' +
        '_drawArcLead() (canvas-renderer.js) uebergab arcSweepCCW direkt als ctx.arc()s ' +
        'anticlockwise-Parameter — die beiden Konventionen sind aber invertiert zueinander ' +
        '(anticlockwise=false sweept bei steigendem Winkel, was unser arcSweepCCW=true meint). ' +
        'sinumerik-postprocessor.js hatte das bereits korrekt beruecksichtigt ("clockwise = ' +
        '!arcSweepCCW"), der Renderer nicht. Reine Darstellungs-Korrektur — Lead-Geometrie ' +
        '(Punkte, G-Code) war bereits korrekt, nur die Canvas-Vorschau zeigte den falschen ' +
        'Bogen-Sweep (canvas-renderer V3.40).',
        'V6.37: Fix — Inselerkennung (disc/hole) wurde nach manuellem Referenz-Setzen/-Wechseln ' +
        '(toggleReference, autoDetectReference in app.js) nicht neu berechnet. Konturen behielten ' +
        'die Nesting-Klassifikation von vor dem Referenz-Wechsel, was zu falscher Kerf-Offset-' +
        'Richtung fuehren konnte. _analyzeTopology() (ceracut-pipeline.js) behandelt die Referenz ' +
        'jetzt immer als "transparent" beim Nesting-Level-Zaehlen (statt nur ueber die inzwischen ' +
        'inaktive _detectReference()-Korrektur), und neue _recalcTopologyAfterReferenceChange() ' +
        '(app.js) triggert die Neuberechnung automatisch nach jedem Referenz-Wechsel inkl. ' +
        'Lead-Cache-Invalidierung bei cuttingMode-Aenderung.',
        'V6.36: Fix — Lead an Konturecken (insb. konkave "Innenecken") schnitt teils ins ' +
        'Werkstück: getLeadInPath()/getLeadOutPath() leiteten Tangente/Normale bisher nur aus ' +
        'der auslaufenden Kante ab. Neue _getCornerSafeLeadBasis() (cam-contour.js) bildet den ' +
        'Bisektor aus einlaufender UND auslaufender Kanten-Normale; degeneriert auf gerader ' +
        'Strecke zur alten Normale (keine Verhaltensaenderung dort). Linearer Lead-Winkel wird ' +
        'an erkannten Ecken zusaetzlich auf 90° (rein senkrecht in die Verschnittflaeche) ' +
        'erzwungen, da ein flacher/tangentialer Winkel an Ecken unsicher ist — eigene ' +
        'vorzeichen-unabhaengige Ecken-Erkennung, da die bestehende _isAtCorner() konvex/' +
        'konkav-blind ist. Zusaetzlich: setStartPoint() snappte bisher immer auf den naechsten ' +
        'existierenden Vertex statt auf die tatsaechliche Drag-Position — auf langen geraden ' +
        'Kanten ohne Zwischenpunkte (z.B. aus DXF) konnte der Startpunkt dadurch nur auf ' +
        'Eckpunkte springen. Jetzt wird bei Bedarf ein neuer Punkt exakt an der Drag-Position ' +
        'eingefuegt; Snap auf existierenden Vertex nur noch in dessen unmittelbarer Naehe ' +
        '(cam-contour V5.14)',
        'V6.35: Fix — _getWasteSideNormal() (cam-contour.js) ignorierte das kerfFlipped-Flag ' +
        '("Kompensation auf Gegenseite"): getKerfOffsetPolyline() und _getKerfCode() (G41/G42) ' +
        'kehren beim Kerf-Flip eines Lochs die Verschnittseite korrekt um, die Lead-Waste-Side-' +
        'Normale tat das nicht — Innen-Leads bei geflipptem Loch-Kerf zeigten dadurch ins ' +
        'Werkstück statt in die tatsächliche Verschnittseite. isHole-Berechnung in ' +
        '_getWasteSideNormal() jetzt identisch zu getKerfOffsetPolyline() (cam-contour V5.13)',
        'V6.34: Fix/Feat — Lead-In/Out-System überarbeitet (Audit ergab mehrere Bugs/Asymmetrien): ' +
        '(1) Radius-0-Bug: _calcArcLeadIn/_calcArcLeadOut kollabierten bei leadInRadius=0 (über Properties-Panel erreichbar, min="0") ' +
        'das Bogenzentrum auf den Entry-/Exit-Punkt, wodurch entryAngle=atan2(0,0)=0 IMMER galt statt tangential zur ' +
        'tatsächlichen Schnittrichtung — Lead degenerierte zu einer Linie Richtung 0°/+X. Beide Funktionen weichen jetzt bei ' +
        'radius<=1e-6 auf einen korrekten tangentialen Lead aus. ' +
        '(2) Lead-Out hatte keine der Sicherheitsnetze von Lead-In: getLeadOutPath() bekommt jetzt dieselbe Alt-Lead- + ' +
        'Center-Exit-Fallback-Kette, checkMultiContourCollision() bekommt Dog-Leg-Routing für Lead-Out (_tryDogLegLeadOut, neu) ' +
        'statt nur stumpfes Kürzen bis zur Quasi-Null-Länge. leadOutType unterstützt jetzt auch tangent/on_geometry ' +
        '(war über leadOutType=leadInType in app.js/lead-profiles.js erreichbar, fiel aber lautlos auf linear zurück). ' +
        '(3) lead-profiles.js: applyBatchRules() crashte bei alten/korrupten Custom-Profilen ohne smallHole/slit/alt-Sektion ' +
        '— init() migriert/validiert jetzt beim Laden (_migrateProfile). Area-Class-Auto-Leads (areaClassApplied) werden nicht ' +
        'mehr von Batch-Profilen überschrieben. isModified() prüft jetzt auch Piercing-Zeiten + Lead-Längen-Grenzen. Lead-Out ' +
        'wird in Small-Hole/Slit-Zweigen jetzt mitgesetzt (vorher nur im Normalzweig) — verhinderte Vermischung aus ' +
        'unterschiedlichen Profilen. smallHole.strategy ausgewertet (war totes Feld). ' +
        '(4) sinumerik-postprocessor.js: unveränderte Arc-Leads nutzen jetzt die exakten arcCenter/arcRadius/arcSweepCCW-' +
        'Metadaten direkt für G02/G03 statt die Tessellierung neu zu fitten (Diskrepanz-Risiko Vorschau vs. Maschinencode). ' +
        '(cam-contour V5.12, lead-profiles V1.3, sinumerik-pp V1.8, canvas-renderer V3.39)',
        'V6.33: Feat — CAD-Improvements Abschnitt 7 komplett abgearbeitet: LineTool setzt bei Enter ohne Eingabe vom letzten Linie/Bogen/Polylinie-Endpunkt fort (DrawingToolManager._lastDrawEndpoint, AutoCAD-LASTPOINT-Verhalten); ModificationTool (Move/Copy/Rotate/Mirror/Scale/Offset/Erase/Explode/Join) akzeptiert jetzt ALL (alle Konturen) und L (zuletzt erzeugte Kontur, app.lastCreatedContour) zusätzlich zu P (Vorherige); RectangleTool bekommt F(illet)/C(hamfer)/R(otation)-Optionen vor der 2. Ecke (nutzt GeometryOps.filletPolyline/neues chamferPolyline + ModificationTool.rotatePoints); PolylineTool-Bogen-Modus (A) erzeugt jetzt tatsächlich Bögen (3-Punkt-Bogen pro Segment: letzter Vertex + Durchgangspunkt + Endpunkt, segments[] statt flachem points[]); ArcTool bekommt 7 neue Konstruktionsarten (SCE/SCA/SCL/SEA/SED/SER/CSE) nach dem CircleTool-Submodus-Vorbild — alle Formeln vorab gegen bekannte geometrische Fälle verifiziert. Nebenbei gefixt: GeometryOps.filletPolyline() verarbeitete bei geschlossenen Konturen die erste Ecke doppelt (off-by-one bei der Schließpunkt-Erkennung) — betraf auch das bestehende FilletTool (geometry-ops V2.6, drawing-tools V2.15, app V6.21)',
        'V6.32: Feat — Login + Benutzerverwaltung: Cookie-Session (server.js, lib/user-store.js, lib/session-store.js, lib/auth.js), neue Routen /api/auth/{login,logout,me} + /api/admin/users* (Rolle admin), / und /api/dxf/* sind jetzt gegated. Server injiziert window.CeraCutCurrentUser direkt in index.html (vor allen Script-Tags), damit Theme/aktives Lead-/Maschinen-Profil pro User schon beim ersten Render korrekt aufgelöst werden (kein Async-Fetch-Wettlauf mit den selbstinitialisierenden IIFEs in lead-profiles.js/machine-profiles.js). Neue Seiten login.html + admin-users.html. Profil-Listen (Maschinenpark, Lead-Presets) bleiben firmenweit geteilt, nur die aktive Auswahl ist pro User (app V6.20, canvas-renderer V3.38, machine-profiles V1.1, lead-profiles V1.2, dxf-browser V1.1, server V1.4)',
        'V6.31: Feat — CircleTool TTT (Tan,Tan,Tan) fertiggestellt: 3 beliebige Tangenten-Objekte (Linie/Kreis gemischt) anklicken, Kreis wird automatisch berechnet. Verallgemeinertes Apollonius-Problem über Newton-Raphson auf (x,y,r) mit 8 Vorzeichen-Kombinationen (innen-/außen-tangential pro Objekt), Lösungsauswahl wie beim bestehenden TTR-Tool über Nähe zu den 3 Klickpunkten. War zuvor nur ein Menüpunkt mit "noch nicht implementiert"-Warnung (drawing-tools V2.14)',
        'V6.30: Fix — DXF-Export: Entities mit Layer-Namen, die nie im LayerManager registriert wurden (z.B. Fallback-Layer "DRAW" aus BoundaryTool/drawing-tools.js bei fehlendem entity.layer), referenzierten im LAYER-Table einen nicht existierenden Eintrag (Code 8 ohne passenden LAYER-Record) — AutoCAD 2017 wies solche Dateien als beschädigt zurück. _writeLayerTable() ergänzt jetzt automatisch jeden von den exportierten Konturen tatsächlich genutzten Layer-Namen, der im LayerManager fehlt (dxf-writer V1.9)',
        'V6.29: Fix — DXF-Speichern via File System Access API (Strg+S / Strg+Shift+S, der Standard-Speicherpfad in Chrome/Edge) schrieb den DXF-Inhalt als rohen JS-String in den Writable-Stream. Der Browser kodiert das intern als UTF-8, obwohl der Header $DWGCODEPAGE=ANSI_1252 deklariert — Umlaute/Sonderzeichen (z.B. in Layer-Namen) wurden dadurch als Mehrbyte-UTF-8 statt Einzelbyte-ANSI geschrieben und von AutoCAD beim Import als beschädigt zurückgewiesen. Der Download-Fallback (generateDownload/Blob) war seit je davon nicht betroffen, da er bereits _encodeAnsi1252() nutzte — daher blieben frühere BLOCK/ENDBLK- und Pflicht-Sektionen-Fixes wirkungslos. Beide FSAPI-Pfade schreiben jetzt ebenfalls über _encodeAnsi1252() kodierte Bytes (app V6.19)',
        'V6.28: Feat — Polar-Koordinaten-Eingabe ("50<45" / "@50<45") in der Command-Line — AutoCAD-Standard für Distanz+Winkel, fehlte bisher komplett und betraf Line/Polyline/Rectangle/Move/Copy/Rotate/Scale gleichermaßen (command-line V1.5)',
        'V6.28: Feat — RotateTool (R/RO/ROTATE): fehlende AutoCAD-Option [C]opy nachgerüstet (Original bleibt erhalten, rotierte Kopie wird hinzugefügt) — gleiches Muster wie zuvor bei ScaleTool (drawing-tools V2.13)',
        'V6.27: Feat — ScaleTool (S/SC/SCALE): fehlende AutoCAD-Optionen [C]opy (Original bleibt erhalten, skalierte Kopie wird hinzugefügt) und [R]eference (Referenzlänge + neue Länge per Punkt-Klick oder Zahlenwert, optional [P]oints für die neue Länge) nachgerüstet (drawing-tools V2.12)',
        'V6.26: Feat — Cross-Dokument Copy/Paste (wie AutoCAD): Konturen können per Strg+C in einem Tab kopiert und per Strg+V in einem anderen Tab eingefügt werden. ClipboardManager-Payload ist jetzt ein geteiltes statisches Feld statt einer pro-Dokument-Instanz; Paste landet weiterhin korrekt auf dem Undo-Stack des Ziel-Dokuments. Fehlende Layer im Ziel-Dokument werden automatisch angelegt (undo-manager V1.2)',
        'V6.25: Fix — Falsch-positive Gap-Marker (orange gestrichelt) bei DXF-Import: Gap-Erkennung scannte bisher blind jeden Punktabstand > 2mm in der fertigen Konturpunktliste, was normale Arc-Sehnenlaengen (grosser Radius → bewusst grobe Tessellierung) und einzelne kurze LINE-Kanten faelschlich als Luecke meldete. Neu: chainContours() zeichnet echte Naht-Distanzen zwischen verschiedenen Source-Entities auf (entitySeams[]), Gap-Klassifizierung nutzt nur noch diese (dxf-parser V3.15, ceracut-pipeline V3.8, cam-contour V5.11, geometry V2.13: toter Code MicroHealing.findInternalGaps() entfernt)',
        'V6.24: Fix — CAM-Export-Artefakt "Anschussfahnen": gesetzte Anschussfahnen werden von manchen CAM-Systemen beim DXF-Export als redundante Arc-Duplikate bzw. freihaengende Kurz-Stubs exportiert, was das Chaining verwirrte (Konturen blieben faelschlich offen). Neue Vorverarbeitung entfernt diese Artefakte vor dem Chaining (dxf-parser V3.14)',
        'V6.23: Fix — dxf-parser.js _parseLine/_parseCircle/_parseArc/_parseEllipse: hartes 30-Zeilen-Lookahead-Limit entfernt; ARC-Entities mit vollem AutoCAD-Eigenschaftssatz (Handle/Owner/Linetype/Color/Lineweight) wurden stillschweigend verworfen (Endwinkel Code 51 fiel ausserhalb des Limits) → Rundungsecken fehlten, Konturen blieben fälschlich offen (dxf-parser V3.13)',
        'V6.22: Fix — CAM-Funktionen (Bearbeitung/Reihenfolge/Extras/Export-Tab, CAM-Kontextmenü) waren sofort nach DXF-Öffnen aktiv statt erst nach abgeschlossenem Setup (Referenz+Nullpunkt); Compatibility-Shim hatte currentStep hart auf 4 erzwungen und damit Step-Gating ausgehebelt — neue, von currentStep entkoppelte app.isSetupComplete()-Prüfung (app V6.18, document-manager V1.1)',
        'V6.21: Feat — Multi-Dokument-Tabs: mehrere DXF-Dateien gleichzeitig offen (wie AutoCAD), neuer document-manager.js V1.0 (Document/DocumentManager, Swap-Pattern)',
        'V6.21: Feat — Tabs werden in eigener IndexedDB "ceracut-tabs" persistiert und beim Neuladen wiederhergestellt (Undo-Historie bewusst ausgenommen)',
        'V6.21: Feat — CamContour V5.10: toJSON()/fromJSON() für Dokument-Persistenz (denylist-basiert, Cache-Felder ausgeschlossen)',
        'V6.21: Feat — Jede neu geöffnete Datei (Dialog/FSAPI/Server-Browse/Drag&Drop) öffnet einen neuen Tab; "Neu" erzeugt einen neuen Tab statt In-Place-Reset (app V6.17)',
        'V6.20: Fix — DXF-Export von AutoCAD 2017 nicht lesbar: BLOCK/ENDBLK in BLOCKS-Sektion hatten keinen Owner-Handle (330) zum BLOCK_RECORD, AC1015-Owner-Kette war unvollständig (dxf-writer V1.8)',
        'V6.20: Fix — OBJECTS-Root-Dictionary erhält expliziten Owner 330=0 (dxf-writer V1.8)',
        'V6.19: Bugfix-Audit — geometry.js const-Reassignment-Crash in offsetPolygon() behoben (geometry V2.12)',
        'V6.19: Bugfix-Audit — Lead-Kollisions-Warnung zeigte immer 0% (effectiveLength nie gesetzt), jetzt korrekt (cam-contour V5.9)',
        'V6.19: Bugfix-Audit — dxf-parser.js meldet NaN-Koordinaten statt sie stillschweigend zu 0 zu kollabieren (dxf-parser V3.12)',
        'V6.19: Bugfix-Audit — Sinumerik-PP blockiert Export bei NaN/Infinity-Koordinaten statt 0.000 zu exportieren (sinumerik-pp V1.7)',
        'V6.19: Bugfix-Audit — Sinumerik-PP prüft Multi-Head-Achsgrenzen vor Export, blockiert bei Überschreitung (sinumerik-pp V1.7)',
        'V6.19: Bugfix-Audit — Haltestege (Bridges) werden im G-Code berücksichtigt: Abrasiv aus/an über Steg-Segmente (sinumerik-pp V1.7)',
        'V6.19: Bugfix-Audit — XSS-Lücken in Validation-Modal, Layer-Manager-Tabelle, Export-Vorschau geschlossen (app V6.16)',
        'V6.19: Bugfix-Audit — server.js: Symlink-Bypass-Schutz + Content-Disposition-Header-Injection behoben (Server V1.3)',
        'V6.19: Bugfix-Audit — CamContour.clone() überträgt startPointIndex (cam-contour V5.9)',
        'V6.19: Bugfix-Audit — SnapManager cacht _collectAllPoints() statt bei jedem Mousemove neu zu berechnen (snap-manager V1.4)',
        'V6.19: Bugfix-Audit — HatchTool.cancel() entfernt Farbpalette (war zuvor nur in finish(), blieb nach ESC sichtbar) (drawing-tools-ext V1.8)',
        'V6.19: Bugfix-Audit — cost-calculator.js: toter d.contour-Verweis entfernt (cost-calculator V1.2)',
        'V6.19: Bugfix-Audit — dxf-writer.js: Kreis-Validierungs-Fallback wird als Warnung sichtbar gemacht (dxf-writer V1.7)',
        'V6.18: AutoCAD-Look&Feel — Enter im Idle wiederholt letzten Befehl (drawing-tools V2.11)',
        'V6.18: AutoCAD-Look&Feel — Command-Echo "_LINE"-Stil in Command-Line (TOOL_ECHO_NAMES, constants V2.10, command-line V1.4)',
        'V6.18: AutoCAD-Look&Feel — Grip-Stil: hohle Quadrate, Cold/Hover/Hot-States (canvas-renderer V3.37)',
        'V6.18: AutoCAD-Look&Feel — Vollbild-Fadenkreuz bei aktivem Zeichentool (canvas-renderer V3.37)',
        'V6.18: AutoCAD-Look&Feel — Dynamic-Input-HUD neutraler Kontrast (dynamic-input V1.1)',
        'V6.18: AutoCAD-Look&Feel — Tooltip-Farben themeabhängig (gedämpftes Gelb im Dark-Theme), Status-Toggle-Bevel',
        'V6.18: AutoCAD-Look&Feel — Statusleiste zeigt Koordinaten (floating Display entfernt)',
        'V6.15: Fix — DXF-Writer AC1015 korrekt: Handles, Pflicht-Tables, MODEL_SPACE, Root-Dict, ANSI_1252 (dxf-writer V1.6)',
        'V6.15: Feat — Dimension Editing: Selektion, Grip-Drag, Text-Override (Doppelklick), DEL-Löschen, Undo/Redo (dimension-tool V2.4)',
        'V6.15: Fix — Window-Selection + Rechtsklick funktionieren im Inneren geschlossener Konturen (canvas-renderer V3.36)',
        'V6.15: Fix — Measure-Tool: Bogen-Rendering, Bounds, Radius-Overlay, Arc-HitTest für Eckenradien (measure-tool V1.1)',
        'V6.15: Fix — Ctrl+Z/Y/DEL funktioniert wenn cmd-input Focus hat (Keyboard-Filter erweitert)',
        'V6.15: Fix — Gezeichnete Splines behalten sourceType SPLINE → DXF-Export mit Fit-Points (drawing-tools V2.10)',
        'V6.15: Fix — Layer-Eigenschaften: Selektion funktioniert jetzt korrekt (querySelector-Priorität)',
        'V6.15: Fix — Layer-Dropdown zeigt alle Layer (auch leere manuell erstellte)',
        'V6.15: Fix — Undo-System: fehlende _notifyStateChange() in cam-tools/canvas-renderer, Layer-Ops undo-fähig',
        'V6.14: Fix — Neu erstellte Layer werden als aktiver Layer gesetzt und im Dropdown angezeigt',
        'V6.13.1: Debug Monitor zeigt Git-Commit-Info im Footer — Hash, Datum, Message (debug-monitor V1.1)',
        'V6.14.1: DXF-Writer R2000 (AC1015) — SPLINE-Entity-Export mit Fit-Points und Control-Points (Roundtrip-fähig)',
        'V6.13.1: Spline Fit-Points Durchreichung in chainContours — Grip-Editing funktioniert jetzt für gezeichnete Splines (dxf-parser V3.11)',
        'V6.13: SplineTool AutoCAD-Overhaul — Dual-Preview (Kontrollpolygon + Kurve), Close-to-Start, Continuous Mode',
        'V6.13: Spline Fit-Points bleiben erhalten → Grip-Editing mit Re-Tessellation in Echtzeit',
        'V6.13: Kontrollpolygon-Overlay bei selektierten Spline-Konturen',
        'V6.12: Boundary Tool (BP) — DCEL-basierte Umgrenzung aus kreuzenden Konturen (AutoCAD BOUNDARY)',
        'V6.12: GeometryOps V2.5 — Planar Graph Builder, Half-Edge Struktur, Face-Tracing',
        'V3.9: Layer-Table Parser — R12/R14/DXF2000+ kompatibel (ab 0/LAYER statt AcDbLayerTableRecord)',
        'V3.9: Layer-Dropdown zeigt alle importierten DXF-Layer (auch ohne Entities)',
        'V3.5: Tier 2 Modification Tools — Move (M), Copy (Shift+C), Rotate (R), Mirror (Shift+M), Scale (S), Erase (DEL)',
        'V3.5: Always-Active ToolManager — Zeichnen + Modifikation ohne F2-Toggle',
        'V3.5: Noun-Verb + Verb-Noun Selektion (AutoCAD-Stil)',
        'V3.5: Window-Selection (Drag-Rechteck): Links→Rechts = Window, Rechts→Links = Crossing',
        'V3.5: Ghost-Preview (halbtransparent) für Move/Copy/Rotate/Mirror/Scale',
        'V3.5: Selektion in allen Steps (nicht nur 4/5) für Noun-Verb Workflow',
        'V3.5: Klick auf leere Fläche → Selektion aufheben',
        'V3.5: Escape-Kaskade: Tool → Messmodus → Startpunkt → Selektion',
        'V3.5: DEL-Taste startet EraseTool (mit Undo) statt hartem Löschen',
        'V3.5: Offset-Tool vorbereitet (Platzhalter für V2.1)',
        'V3.5-fix: Auto-Apply gezeichnete Entities bei Mod-Tool-Start',
        'V3.5-fix: CamContour Klassenname korrigiert (war CAMContour)',
        'V3.5-fix: LineTool S/C = Linienzug schließen (AutoCAD-Stil)',
        'V3.5-fix: Rechtsklick = Bestätigen bei aktivem Tool (AutoCAD-Stil)',
        'V3.5-fix: fileLoaded bei Drawing-Only (Step-Navigation ohne DXF)',
        'V3.7: Tier 4 Aufteilen — CL2D (Halbieren), CLND (N-Teilen), CLDCL (Divided Calculation Dialog)',
        'V3.7: Ribbon-Gruppe "Aufteilen" im Start-Tab mit 3 Werkzeugen',
        'V3.7: CLDCL 5 Modi: Fest-einseitig, Fest-beidseitig, Fest-Mitte, Gleich-Anzahl, Gleich-MaxLänge',
        'V3.7: Joint/Fugen-Berechnung bei Aufteilung',
        'V3.7: Senkrechte Teilungslinien als echte LINE-Entities (direkt nutzbar)',
        'V3.8: Layer-System — AutoCAD-Style Ribbon + Status-Bar Dropdowns',
        'V3.8: Layer-Manager Dialog (Layer CRUD, Farbe, Sichtbarkeit, Lock, Linientyp)',
        'V3.8: DXF-Writer R12 (AC1009) — Speichern + Speichern unter (Strg+S/Strg+Shift+S)',
        'V3.8: Layer-Import aus DXF, Entity-Counts, ACI-Farbkonvertierung',
        'V3.6: Tier 3 Phase A — GeometryOps Engine V1.0 (Intersection, Segment-Modell)',
        'V3.6: Explode (X) — Konturen in Einzelsegmente zerlegen',
        'V3.6: Join (J) — Konturen zu Polylinie verbinden',
        'V3.6: Break (B) — Kontur an Punkt teilen (offen/geschlossen)',
        'V3.6: LineTool S/C = Linienzug schließen',
        'V3.6: Rechtsklick = Bestätigen bei aktivem Tool (AutoCAD-Stil)',
        'V3.6: Toolbar-Buttons für Tier 3 Tools',
        'V3.4: CAD Drawing Tools — Line (L), Circle (C), Rectangle (N), Arc (A), Polyline (P)',
        'V3.4: AutoCAD-style Command-Line UI mit Koordinateneingabe (absolut + relativ)',
        'V3.4: SnapManager V1.0 — Endpoint, Midpoint, Center, Intersection, Nearest',
        'V3.4: Ortho-Modus (F8) für 0°/90° Constraint',
        'Sinumerik 840D Postprozessor V1.0: Echte CNC-Ausgabe im MPF-Format',
        'UndoManager V1.0: Command Pattern (Undo/Redo), Clipboard (Copy/Cut/Paste)',
        'DXF-Parser V3.0: SPLINE Flags Fix (Bit 8=planar, nicht periodic)',
        'DXF-Parser V3.3: CRITICAL FIX — LWPOLYLINE 1000-Zeilen-Limit entfernt (abgeschnittene Konturen)',
        'DXF-Parser V3.3: Layer-aware Chaining — Segmente verschiedener Layer nicht mehr gemischt',
        'DXF-Parser V3.3: Erweiterte Diagnostik (Entity-Typ-Breakdown, Kontur-Details, Vertex-Validierung)',
        'V3.8-fix: tool-manager.js Section 4 Duplikate entfernt (LineTool already declared)',
        'V5.2: Intarsien-Modus — Dual-Export NEG/POS mit invertierter Kerf-Kompensation',
        'V5.2: CuttingMode-Alternation nach Nesting-Level (A/O/B Sonderfälle)',
        'V5.2: CAM-Tab Intarsien-Gruppe (Toggle, Fugenbreite, NEG/POS-Preview)',
        'V5.2: clone() überträgt nestingLevel für Intarsien-Kontur-Klone',
        'V5.3 Phase B: Piercing Types (6 IGEMS: auto/blind/linear/stationary/circular/drilling/air_start)',
        'V5.3 Phase B: R923 dynamisch im Postprozessor (nicht mehr hardcoded 9)',
        'V5.3 Phase B: R924 (Standzeit), R925 (Kreisradius), R926 (Kreiszeit) bei speziellen Typen',
        'V5.3 Phase B: Dynamic Lead (B.2) — Binary-Search Kollisionsvermeidung',
        'V5.3 Phase B: Flächenklassen (B.3) — 6 IGEMS-Standard-Klassen für Löcher',
        'V5.3 Phase B: Properties Panel — Piercing/Lead-In/Area-Class Controls',
        'V5.3 Phase B: clone() für alle B.1/B.2 Properties erweitert',
        'V5.3 Phase B: properties-panel-styles.css verlinkt (war bisher missing)',
        'Debug Monitor V1.0: Globaler Error-Catcher (onerror+unhandledrejection+console.error)',
        'Debug Monitor V1.0: 13 bekannte CeraCUT-Fallen automatisch erkannt und erklärt',
        'Debug Monitor V1.0: Session-Log (200 Fehler), Action-Tracker (50 Aktionen)',
        'Debug Monitor V1.0: Performance-Monitor Frame-Drop-Erkennung (>50ms)',
        'Debug Monitor V1.0: Overlay Strg+Shift+D — 4 Tabs (Fehler/Aktionen/Perf/Fallen)',
        'Debug Monitor V1.0: JSON-Export für Claude Code Analyse',
        'V5.4 Phase B UI: Piercing-Typ Dropdown (5 Typen) + R924/R925/R926 konditionale Felder',
        'V5.4 Phase B UI: Dynamic Lead Checkbox + Min/Max-Eingabefelder',
        'V5.4 Phase B UI: Flächenklassen-Checkbox + Editor-Popup (6 IGEMS-Klassen, editierbar)',
        'V5.4 Phase B UI: Single-Mode Button (manuelle Fahnenplatzierung per Klick + Undo)',
        'V5.4 Phase B UI: Lead-Favoriten (Speichern/Laden/Löschen, localStorage-Persistenz)',
        'V5.4 Phase B UI: Alle B.1-B.6 UI-Handler im Shim verdrahtet + Live-Preview',
        'V5.4.1 Fix: Gelbe Messlinien bleiben nach Messmodus-Ende nicht mehr stehen',
        'V5.4.1 Fix: ACI 7 Layer-Farben invertieren bei Theme-Wechsel (weiß↔schwarz)',
        'V5.4.1: Kontur-Kontextmenü — Nullpunkt → Endpunkt / Nullpunkt → Mittelpunkt',
        'V5.4.1: Echte ctx.arc() Darstellung für Arc-Leads (statt 12-Segment Polyline)',
        'V5.4.1: Arc-Metadaten (arcStartAngle, arcEndAngle, arcSweepCCW) in cam-contour',
        'V5.4.2: Arabeske-Tool (AB) — Parametrische Laternenfliese (8 Kreisbögen) in advanced-tools.js V1.2',
        'V5.4.2: GeometryOps V2.2 — _circumscribedCircle, _arcThrough3Points, createArabeske',
        'V5.4.2: Fugen-Offset für tessellierbare Fliesenverlegung (2mm Standard)',
        'V5.4.2: Ribbon-Button "Arabeske" im CAD-Tab Zeichnen-Gruppe',
        'V5.5.0: Multi-Kontur Collision Detection — Lead vs. ALLE Konturen (cam-contour V4.7)',
        'V5.5.0: DXF TEXT/MTEXT/HATCH Support (dxf-parser V3.5)',
        'V5.5.0: Nesting Engine V1.0 — BLF-Algorithmus, Multi-Rotation, Multi-Sheet',
        'V5.5.0: Toolpath Simulator V1.0 — Pfad-Verifikation, Animation, Kollisionsmatrix',
        'V5.5.0: Cost Calculator V1.0 — Kosten-/Zeitkalkulation mit CeraJet-Integration',
        'V5.5.0: Machine Profiles V1.0 — Maschinenpark-Verwaltung, PP-Profile, localStorage',
        'V5.5.0: Bridge Cutting V1.0 — Haltestege zwischen Teilen (auto/manuell)',
        'V5.5.0: Quality Zones V1.0 — Auto-Erkennung von Ecken/Radien für Speed-Reduktion',
        'V5.5.0: Sinumerik PP V1.3 — Multi-Head Support, Machine-Profile Integration',
        'V5.5.0: WizardStepUndo V1.1 — Verschachteltes Undo pro Wizard-Step',
        'V5.5.0: Ribbon UI — Brücken, Q-Zonen, Kollision (CAM), Nesting/Sim/Kosten/Maschine (Export)',
        'V5.5.0: AutoCAD Aliases — E=Erase, CO=Copy, RO=Rotate, MI=Mirror, SC=Scale, REC=Rectangle, PL=Polyline',
        'V5.5.0: Continuous Mode — Modification Tools starten nach Abschluss automatisch neu',
        'V5.5.0: Previous Selection (P) — Vorherige Auswahl in Modification-Tool Selektionsphase',
        'V5.5.0: Dynamic Input HUD — Koordinaten/Distanz/Winkel am Cursor (DynamicInput V1.0)',
        'V5.5.1: Visuelle Lead-Differenzierung — Cyan/Rot/Grün/Gelb/Magenta nach Zustand (canvas-renderer V3.13)',
        'V5.5.1: Lead-Routing isRotated/isAlternative Flags (cam-contour V4.8)',
        'V5.5.1: Dog-Leg Leads als isAlternative markiert für gelbe Darstellung',
        'V5.5.1: Offset-Tool Ghost-Preview — halbtransparente Vorschau beim Mausbewegen (advanced-tools V1.3)',
        'V5.5.1: Chamfer Continuous Mode — Tool bleibt nach Anwendung aktiv',
        'V5.5.1: Offset-Preview RubberBand-Type im Renderer (grün halbtransparent)',
        'V5.5.1: DXF Chaining Optimierung — Deque-Pattern, adaptive Grid-Zellgröße, Progress-Logging (dxf-parser V3.7)',
        'V5.5.1: BreakTool Finalisierung — Snap-Manager, CAM-Property-Vererbung, Vertex-Split-Fix, Continuous Mode (drawing-tools V2.4)',
        'V5.5.1: splitContourAtPoint Vertex-Degeneration Fix — keine Null-Längen-Segmente bei Vertex-Split (geometry-ops V2.2)',
        'V5.5.1: Overlap Break Tool (OB) — Kontur trennen + tangentiale Überlappung für Wasserstrahl-Einläufe (drawing-tools-ext V1.1)',
        'V5.5.1: splitAndOverlap() — Split + feste tangentiale Verlängerung mit C1-Stetigkeit (geometry-ops V2.3)',
        'V5.5.1: Ghost-Preview (Gelb #FFFF00) mit Pfeilspitze + Längenanzeige für Überlappungsrichtung',
        'V5.5.1: Slit-Modus (kerfWidth=0) automatisch bei Überlappungs-Konturen, Pipeline-Revalidierung',
        'V5.5.1: TEXT/MTEXT Glyph-Import — echte Buchstaben-Konturen via opentype.js (dxf-parser V3.8, text-tool V1.2)',
        'V5.5.1: TEXT Justierung — Group Codes 72/11/21 für Center/Right-Alignment korrekt ausgewertet',
        'V5.5.1: BBox-Fallback-Warnung wenn TEXT-Entities ohne geladenen Font importiert werden',
        'V5.6: ProjectManager V1.0 — Workspace-Verwaltung mit FSAPI Directory Picker',
        'V5.6: Workspace Sidebar — DXF-Dateiliste mit Klick-zum-Laden',
        'V5.6: Auto-Save (.bak.dxf) in regelmässigen Abständen (60s)',
        'V5.6: CNC-Unterordner automatisch im Workspace erstellt',
        'V5.6: IndexedDB Handle-Persistenz über Browser-Sitzungen',
        'V5.6: CNC-Export direkt in Workspace/CNC/ Ordner',
        'V5.7: Properties Panel Sidebar entfernt → CAM-Eigenschaften im Kontextmenu (Step 4)',
        'V5.7: Kontextmenu mit dynamischer CAM-Sektion (Quality, Piercing, Lead-In, Kerf)',
        'V5.7: Kontextmenu-Überlauf-Korrektur (Bildschirmrand-Check)',
        'V5.7: Null-safe DOM-Zugriffe nach Panel-Entfernung',
        'V5.8: Intarsien-Fix — Fugen-Offset wird jetzt angewendet (_applyIntarsiaOffset)',
        'V5.8: Intarsien-Fix — NEG-Export mit Clone statt Direkt-Referenz',
        'V5.8: Intarsien-Fix — Doppelte UI-Bindings (Shim-Block) entfernt',
        'V5.8: Intarsien-Preview — POS/NEG Toggle + Fugen-Offset-Linien im Canvas (orange/blau)',
        'V5.8: Intarsien-Preview — Gap-Änderung löst Canvas-Render aus',
        'V5.9: Bugfix-Audit — 35 Bugs behoben über 16 Dateien',
        'V5.9: KRITISCH — Nesting _ensureCCW Windungsrichtung korrigiert (NFP-Ergebnisse waren falsch)',
        'V5.9: KRITISCH — Sinumerik PP erstes Kontur-Segment nicht mehr übersprungen',
        'V5.9: KRITISCH — Clipboard-Paste im Canvas-Kontextmenu repariert (undoManager→clipboardManager)',
        'V5.9: KRITISCH — Toolpath-Simulator Canvas-ID korrigiert (main-canvas→canvas)',
        'V5.9: KRITISCH — TOTLEN c.selected→c.isSelected korrigiert',
        'V5.9: CNC — Math.abs() für getArea() im PP (NaN bei CW-Holes verhindert)',
        'V5.9: CNC — _fc() Null/NaN-Guard, R995 Integer-Format',
        'V5.9: CamContour — || → ?? für numerische Defaults (kerfWidth:0 etc. funktioniert jetzt)',
        'V5.9: CamContour — Dynamic Lead mutiert leadInLength nicht mehr permanent',
        'V5.9: CamContour — Alt-Lead Radius=0 → direkt Linear statt degenerierter Arc',
        'V5.9: Quality-Zones — Division-by-Zero bei Zero-Length Zones verhindert',
        'V5.9: Cost-Calculator — Quality-Index Off-by-One korrigiert (1-basiert→0-basiert)',
        'V5.9: Arc-Fitting — Zero-Tangent bei Duplikat-Punkten, Arc-Länge CW/CCW-korrekt',
        'V5.9: Canvas-Renderer — Panning early-return (kein Hover/Snap während Pan)',
        'V5.9: Advanced-Tools — NgonTool Fall-Through, ChamferTool Wrap-Around',
        'V5.9: Drawing-Tools — isModTool fehlende Aliases (CO/RO/MI/SC/E)',
        'V5.9: Command-Line — XSS via innerHTML verhindert (HTML-Escaping)',
        'V5.9: Snap-Manager — Null-Check für ARC startAngle/endAngle',
        'V5.9: DXF-Writer — ANSI_1252 Codepage (R12-konform), Closed-Polyline Duplikat-Check',
        'V5.9: Single-Mode — onContourClick wird gesichert/wiederhergestellt statt überschrieben',
        'V5.10 UX: Grössere Klickziele (Buttons, Kontextmenü) für Trackpad-Bedienung',
        'V5.10 UX: Custom CSS-Tooltips [data-tip] mit Beschreibung + Tastenkürzel auf allen Tool-Buttons',
        'V5.10 UX: F1 Shortcut-Hilfe-Dialog (3-Spalten: Zeichnen, Bearbeiten, Allgemein + Maus)',
        'V5.10 UX: Wizard-Step-Indikator im Tab-Strip (Badge + Step-Name)',
        'V5.10 UX: Verständlicherer Command-Line Prompt + Start-Hint mit F1-Verweis',
        'V6.0: Lead-Profiles V1.0 — 7 Built-in Profile (Material/Dicke), Benutzerdefinierte Profile (localStorage)',
        'V6.0: Smart Batch Rules — Automatische Lead-Zuweisung (disc→ext, hole→int, smallHole→center, slit→on_geometry)',
        'V6.0: Profil-Dropdown im CAM-Ribbon mit Abweichungs-Erkennung und Status-Anzeige',
        'V6.0: leadManualOverride Flag — schützt manuell geänderte Konturen vor Batch-Re-Apply (cam-contour V5.0)',
        'V6.0: Sinumerik PP V1.5 — Slit-Rückzug in Schnittrichtung (statt hardcoded X1.0), expliziter F-Code auf Kontur',
        'V6.0: PP _fc() NaN/Infinity-Warnung statt stiller 0.000 — maskiert keine Rechenfehler mehr',
        'V6.0: assertFinite() Guard im Geometrie-Kernel — NaN-Propagation frühzeitig abfangen',
        'V6.0: Math.tan() Guard in computeFillet(), Area NaN-Check in Kerf-Offset, segLen-Guard in Overcut',
        'V6.0: _pointInPolygon Epsilon-Check (1e-12 statt !== 0) — verhindert near-zero Division',
        'V6.0: Wizard-Validierung — warnt bei fehlenden Konturen/Nullpunkt/Schneidmodus vor Schrittwechsel',
        'V6.0: DXF-Fehlermeldungen kategorisiert — Splines, Encoding, Komplexität mit Lösungshinweisen',
        'V6.0: Export-Validierung — prüft ob G-Code tatsächlich erzeugt wurde (nicht leer)',
        'V6.0: Toolpath-Preview — 2D-Visualisierung im Vorschau-Modal (Eilgang, Konturen, Reihenfolge, Legende)',
        'V6.0: Disc-Fuellung — halbtransparente Flaeche fuer Teile in CAM-Modi, Holes werden ausgespart (even-odd)',
        'V6.1: Intarsien V2.0 — automatische POS/NEG-Erzeugung als echte Canvas-Konturen (lead-profiles V1.1, canvas-renderer V3.18)',
        'V6.1: Intarsien-Lead-Profil (builtin-intarsia) — lineare Leads fuer saubere Intarsien-Kanten',
        'V6.1: Offset-Richtung Fix — NEG nach aussen (+offset), POS nach innen (-offset)',
        'V6.1: Beide-Button — POS+NEG gleichzeitig als ueberlagerte Vorschau (Orange/Blau)',
        'V6.1: Live-Regeneration bei Gap-Aenderung (debounced 200ms) und Undo/Redo',
        'V6.1: Lead-Platzierung — Corner-Penalty (×0.4) + Flat-Segment-Bonus (bis ×1.5) für organische Konturen (cam-contour V5.2)',
        'V6.1: Lead-Visualisierung — Text-Labels entfernt, Pfeil am Kontureintritt, breitere Leads, grössere Pfeile (canvas-renderer V3.20)',
        'V6.1: Lead-Platzierung — autoPlace bevorzugt Flat-Segments statt Ecken (cam-contour V5.3)',
        'V6.1: Arc-Leads — Degradierung zu Linear nur noch bei >120° (war >90°), Arc bleibt auf flachen Segmenten erhalten',
        'V6.1: Disc-Füllung Fix — worldToScreen durch direkte World-Koordinaten ersetzt (canvas-renderer V3.21)',
        'V6.1: Waste-Side-Normal — Shoelace-basiert statt centroid-basiert, robust bei nicht-konvexen Konturen (cam-contour V5.3)',
        'V6.2: HatchTool (H) — Schraffur-Werkzeug: Solid/Lines/Cross/Dots auf geschlossene Konturen (drawing-tools-ext V1.2)',
        'V6.2: Hatch-Rendering — Clip-Path mit Even-Odd, Holes automatisch ausgespart (canvas-renderer V3.23)',
        'V6.2: Hatch als Contour-Property — cam-contour V5.4 mit clone()-Support',
        'V6.2: Properties-Panel V1.3 — Schraffur hinzufuegen/entfernen/bearbeiten im Kontextmenu',
        'V6.2: DXF HATCH-Entities werden beim Import übersprungen — reine Visualisierung, keine Schneidgeometrie (dxf-parser V3.10)',
        'V6.2: Disc-Fill in allen Wizard-Modi sichtbar — nicht mehr auf CAM-Steps beschraenkt (canvas-renderer V3.23)',
        'V6.3: interiorPoint() — garantiert-innerer Testpunkt für konkave Polygone (geometry V2.10)',
        'V6.3: Flächengewichteter Centroid (Shoelace) statt arithmetischem Mittelwert — korrekte Topologie bei komplexen Formen',
        'V6.3: Pipeline V3.4 — robuste disc/hole-Erkennung auch bei Löwen-Zacken und ähnlich konkaven Konturen',
        'V6.3: Renderer V3.24 — Hole-Cutout im Disc-Fill/Hatch nutzt interiorPoint()',
        'V6.4: Validation Engine — Pre-Export-Prüfung: Gap<Kerf, scharfe Ecken, Intarsien-Waisen, Lead-Kollisionen, offene Konturen (pipeline V3.5)',
        'V6.4: Validation Modal — Criticals blockieren Export (rot), Warnings erlauben "Trotzdem exportieren" (gelb)',
        'V6.4: CAM-Tools V1.1 — Hit-Test Threshold skaliert mit Zoom-Level (präzise bei Zoom, tolerant bei Übersicht)',
        'V6.4: Properties Panel V1.4 — Live Preview für Lead-Parameter (leadInLength, leadInRadius, overcutLength, leadInAngle)',
        'V6.4: Live Preview — Escape revertiert ohne Undo-Eintrag, Loslassen committet mit korrektem Undo',
        'V6.4: Multi-Material Intarsien — 5 Materialgruppen (A-E) mit eigenen Farben (constants V2.8)',
        'V6.4: CamContour V5.5 — materialGroup + intarsiaRole Properties mit clone()-Support',
        'V6.4: Renderer V3.25 — Intarsien-Overlay Farben aus materialGroup statt hardcoded',
        'V6.4: Intarsien Multi-Material Export — separate POS/NEG-Dateien pro Materialgruppe',
        'V6.6: Hatch als eigenständige CamContour (cuttingMode=none) — AutoCAD-konform, nie geschnitten',
        'V6.6: HatchTool V1.5 — erstellt separate Hatch-Kontur mit eigener Selektion/Löschung/Undo',
        'V6.6: Hatch Live-Preview — halbtransparente Vorschau beim Hover über Konturen',
        'V6.6: Pipeline V3.6 — Hatch-Konturen von Topologie/Slit/Offset ausgeschlossen',
        'V6.6: Renderer V3.28 — Hatch-Konturen als Hintergrund-Layer, gestrichelte Boundary bei Hover/Select',
        'V6.6: Sinumerik PP V1.6 — Hatch-Konturen aus CNC-Export gefiltert',
        'V6.6: HatchTool V1.6 — Floating Farbpalette (8 AutoCAD-Farben + ByLayer) + Pattern-Buttons',
        'V6.11: Cycle-Selection — wiederholter Klick auf gleiche Stelle cycled durch überlappende Konturen (app V6.11, canvas-renderer V3.32)',
        'V6.10: Command-Line History — ArrowUp/Down navigiert durch letzte Befehle (command-line V1.3)',
        'V6.10: Input-Validation-Feedback — rote Fehlermeldung bei ungültiger Eingabe statt Stille',
        'V6.10: Locked-Layer Selection — gesperrte Layer blockieren Hit-Test + Window-Selection (canvas-renderer V3.31, drawing-tools V2.8)',
        'V6.10: Status-Bar Snap-Modi — aktive Snap-Typen (END/MID/CEN/...) gelb hervorgehoben',
        'V6.9: Gap Detection — offene/heilbare/geheilte Gaps visuell markiert (Rot/Amber/Grün)',
        'V6.9: MicroHealing V2.9 — gapReports[] + findInternalGaps() für Gap-Reporting',
        'V6.9: Pipeline V3.7 — Gap-Klassifizierung (healable vs. open), Validation erweitert',
        'V6.9: Renderer V3.30 — Gap-Marker (gefüllte Kreise + Strichlinien, screen-space)',
        'V6.9: CamContour V5.7 — gaps[]/healedGaps[] Properties + hasGaps()/clearGapData()'
    ],
    
    print() {
        const modCount = Object.keys(this.modules).length;
        console.log(
            `%cCeraCUT V${this.version} — Build ${this.build} (${this.date}) — ${modCount} Module`,
            'color: #00aa00; font-weight: bold; font-size: 13px'
        );

        // Module als aufklappbare Gruppe (collapsed = nicht sichtbar ohne Klick)
        console.groupCollapsed('%c[BUILD] Module-Versionen', 'color: #888');
        for (const [name, info] of Object.entries(this.modules)) {
            console.log(`  ${name}: V${info.version} (${info.build})`);
        }
        console.groupEnd();
    }
};

// Auto-Print beim Laden
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        CERACUT_BUILD.print();
        const dtEl = document.getElementById('build-datetime');
        if (dtEl) dtEl.textContent = '(' + CERACUT_BUILD.date + ', ' + CERACUT_BUILD.time + ')';
    });
}

// Export für Node.js Tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CERACUT_BUILD;
}
