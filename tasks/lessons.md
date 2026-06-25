# Lessons Learned

> Dieses Dokument wird nach jeder Korrektur/jedem Bug aktualisiert.
> Ziel: Gleiche Fehler nie wiederholen. Bei Session-Start reviewen.

---

## Format

```
### [YYYY-MM-DD] Kurzbeschreibung
- **Fehler:** Was ist passiert?
- **Root Cause:** Warum?
- **Regel:** Was muss in Zukunft anders gemacht werden?
- **Betroffene Module:** Welche Dateien/Bereiche?
```

---

## Eintraege

### [2026-03-16] tasks/lessons.md wurde nie angelegt
- **Fehler:** CLAUDE.md schreibt vor, nach jeder Korrektur `tasks/lessons.md` zu aktualisieren. Die Datei existierte nicht.
- **Root Cause:** Kein initialer Startpunkt, keine Durchsetzung zwischen Sessions.
- **Regel:** Bei Session-Start pruefen ob `tasks/lessons.md` existiert und relevante Eintraege reviewen. Nach jeder User-Korrektur sofort neuen Eintrag schreiben.
- **Betroffene Module:** Workflow

### [2026-03-16] DXF-Parser: Nicht auf Subclass-Marker verlassen
- **Fehler:** `_parseLayerTable` suchte nach `AcDbLayerTableRecord` als Startpunkt für Layer-Records. In R12-DXFs fehlt dieser Marker komplett → 0 Layer gefunden, keine ACI-Farben.
- **Root Cause:** `AcDbLayerTableRecord` ist ein DXF 2000+ Subclass-Marker (Code 100). R12/R14-Dateien haben diesen nicht. Der eigentliche Record-Start ist immer `0/LAYER`.
- **Regel:** DXF-Parsing immer ab den Group-Code-Paaren (`0/ENTITY_TYPE`) aufbauen, nie ab optionalen Subclass-Markern (`100/AcDb...`). Subclass-Marker als zusätzliche Info nutzen, nicht als Anker.
- **Betroffene Module:** `dxf-parser.js` — gilt für alle `_parse*`-Methoden die TABLES-Daten lesen

### [2026-03-16] Layer-UI: Alle definierten Layer anzeigen, nicht nur belegte
- **Fehler:** `_updateLayerUI` filterte Layer ohne Konturen aus dem Dropdown. DXF-Layer mit nur unsupported Entity-Types (DIMENSION, POINT) waren unsichtbar.
- **Root Cause:** Layer-Sichtbarkeit war nur an `contours[].layer` gekoppelt, nicht an die TABLES-Layer-Definition.
- **Regel:** Importierte DXF-Layer (`dxfResult.layers`) immer im Dropdown anzeigen — wie AutoCAD. "Leer" heißt nicht "unwichtig" (Layer kann Entities haben die nicht als Konturen importiert werden).
- **Betroffene Module:** `app.js` (`_updateLayerUI`)

### [2026-03-16] Disc-Füllung: worldToScreen nicht in world-transformiertem ctx verwenden
- **Fehler:** Disc-Fill war unsichtbar/falsch positioniert. Die Füllung nutzte `worldToScreen()` obwohl der Canvas-Kontext bereits `translate()+scale()` hatte → Doppel-Transformation.
- **Root Cause:** `drawContour()` wird innerhalb eines world-transformierten `ctx` aufgerufen (translate+scale in render()). `drawPath()` nutzt korrekt World-Koordinaten direkt, aber der Disc-Fill-Code nutzte `worldToScreen()` → Screen-Koordinaten durch World-Transform = komplett falsche Position.
- **Regel:** Innerhalb von `ctx.save()/translate()/scale()` Blöcken NIE `worldToScreen()` verwenden. Direkte World-Koordinaten nutzen — wie `drawPath()` es tut. `worldToScreen()` ist nur für Code der AUSSERHALB des Transforms zeichnet (z.B. UI-Overlays, Order-Numbers).
- **Betroffene Module:** `canvas-renderer.js` — gilt für jeden neuen Fill/Path-Code in `drawContour()`

### [2026-03-16] Hit-Test Erweiterungen können Click-Routing brechen
- **Fehler:** Click-Selektion von Konturen funktionierte nicht mehr, nachdem `_hitTestStartTriangle` um Pierce-Punkt-Check erweitert wurde.
- **Root Cause:** Erweiterter Hit-Test fing zu viele Klicks ab → `isDraggingStartPoint=true` auf mousedown → obwohl mouseup es zurücksetzt, wurde bei jedem Micro-Move `setStartPoint()` aufgerufen statt Selection. Pierce-Punkte können weit von der Kontur entfernt liegen und fremde Klicks abfangen.
- **Regel:** Hit-Test-Bereiche konservativ halten. Erweiterungen immer gegen Click-Routing testen (Selektion, Kontextmenu, Window-Selection). Neue Hit-Targets nur für Cursor-Feedback (mousemove), nicht für Drag-Initiation (mousedown), es sei denn das Verhalten ist eindeutig gewünscht.
- **Betroffene Module:** `canvas-renderer.js` (`_hitTestStartTriangle`, mousedown-Handler)

### [2026-03-16] Waste-Side-Normal: Centroid-Methode versagt bei nicht-konvexen Konturen
- **Fehler:** Lead zeigte bei Disc nach innen statt nach außen (Waste-Seite).
- **Root Cause:** `_getWasteSideNormal` nutzte Centroid-Richtung zur Bestimmung der Normalenseite. Bei nicht-konvexen Polygonen kann der Centroid außerhalb liegen oder die Richtung zum Centroid an bestimmten Punkten falsch sein.
- **Regel:** Für Innen/Außen-Bestimmung die Shoelace-Formel (Vorzeichen der Fläche = Windungsrichtung) verwenden statt Centroid. `Geometry.getSignedArea() > 0` = CW, Links-Normale zeigt einwärts. Robust für alle Polygon-Formen.
- **Betroffene Module:** `cam-contour.js` (`_getWasteSideNormal`)

### [2026-03-16] Topology/Fill: points[0] als Test-Punkt für pointInPolygon ist unzuverlässig
- **Fehler:** Manche geschlossene Konturen wurden nicht als Loch erkannt. Disc-Fill Even-Odd-Cutout schlug fehl → Fill änderte sich nicht bei Modus-Wechsel.
- **Root Cause:** `_analyzeTopology()` und Disc-Fill-Renderer nutzten `contour.points[0]` als Testpunkt für pointInPolygon. Bei Spline-/Arc-Konturen kann der erste Punkt auf oder nahe der Grenze der Eltern-Kontur liegen → Ray-Casting liefert falsches Ergebnis.
- **Regel:** Für Containment-Tests immer `Geometry.centroid(points)` statt `points[0]` verwenden. Der Schwerpunkt liegt zuverlässig im Inneren der Kontur und nicht auf der Grenze.
- **Betroffene Module:** `ceracut-pipeline.js` (`_analyzeTopology`), `canvas-renderer.js` (Disc-Fill Hole-Cutout)

### [2026-03-16] Layer-Visibility ohne Pipeline-Rebuild — unsichtbare Layer kontaminieren Topology
- **Fehler:** Bemaßungs-Layer (HATCH-Konturen) ausgeschaltet, aber Topology-Klassifikation blieb falsch. Schnitt-Konturen hatten falsche disc/hole-Zuordnung.
- **Root Cause:** Zwei getrennte Layer-Systeme: Import-Checkboxen filtern Pipeline-Input, LayerManager-Visibility steuert nur Renderer-Anzeige. `toggleVisibility()` löste KEINE Pipeline-Neuberechnung aus → `this.contours` und Topology blieben unverändert.
- **Regel:** Layer-Sichtbarkeitsänderungen MÜSSEN die Pipeline neu auslösen (`applyLayerSelection({ visibilityChange: true })`). LayerManager-Visibility muss als zusätzlicher Filter in `applyLayerSelection()` berücksichtigt werden. Zwei Filter-Systeme dürfen nie unabhängig agieren.
- **Betroffene Module:** `app.js` (`applyLayerSelection`, `_runPipelineKeepUndo`), `index.html` (Visibility-Toggle Handler)

### [2026-03-16] Disc-Fill nur in CAM-Modi → Füllung fehlt beim Zurücknavigieren
- **Fehler:** Disc-Füllung war im CAD-Bereich (Step 1-3) unsichtbar, erschien erst bei Wechsel zu CAM (Step 4-5).
- **Root Cause:** `isCamMode`-Gate im Disc-Fill Code: `contour.cuttingMode === 'disc' && isCamMode`. Sobald Pipeline gelaufen ist und `cuttingMode` gesetzt hat, sollte die Füllung in allen Steps sichtbar sein — nicht nur in Steps 4/5.
- **Regel:** Visuelle Eigenschaften die an Contour-Properties gebunden sind (cuttingMode, hatch) sollten NICHT zusätzlich an den Wizard-Step gekoppelt werden. Nur interaktive CAM-Elemente (Leads, Kerf, Overcut, Microjoints) gehören hinter `isCamMode`-Gates.
- **Betroffene Module:** `canvas-renderer.js` (Disc-Fill Condition)

### [2026-03-16] DXF HATCH-Entities: Multi-Boundary-Loops dürfen nicht in ein Array
- **Fehler:** Importierte DXF-Dateien mit HATCH-Entities zeigten wirre Verbindungslinien quer durch die Zeichnung.
- **Root Cause:** `_parseHatch()` las alle `10/20`-Koordinatenpaare aus ALLEN Boundary-Loops in ein einziges `boundaryPoints[]`-Array. HATCH-Entities können mehrere getrennte Pfade haben (äußere Grenze + innere Löcher) — die Punkte verschiedener Pfade wurden zu einer einzigen Polylinie verbunden.
- **Regel:** DXF HATCH-Entities sind reine Visualisierung (Schraffur/Füllung), keine Schneidgeometrie. Im CAM-Kontext sollten sie beim Import übersprungen werden (`return null`). Falls sie in Zukunft doch benötigt werden: Boundary-Loops anhand Code 92 (Boundary-Typ) trennen und als separate Konturen zurückgeben — nie alles in ein Array.
- **Betroffene Module:** `dxf-parser.js` (`_parseHatch`)

### [2026-03-16] Hatch-Rendering: ctx.clip()+fillRect() statt ctx.fill() für Solid-Pattern
- **Fehler:** Hatch-Schraffur (Solid-Pattern) war nach Klick auf Kontur visuell nicht sichtbar — weder über HatchTool (H) noch über Properties Panel "Schraffur hinzufügen".
- **Root Cause:** `_drawHatch()` nutzte `ctx.clip('evenodd') + ctx.fillRect()` für das Solid-Pattern. Der funktionierende Disc-Fill direkt darüber nutzt `ctx.fill('evenodd')` direkt. Die Clip+FillRect-Kombination kann bei komplexen/selbstüberschneidenden Pfaden fehlschlagen. Zusätzlich fehlte ein Try-Catch — bei Fehler wurde die gesamte Kontur-Zeichnung abgebrochen. Außerdem kein Toast-Feedback und kein Panel-Refresh nach Hatch-Änderung.
- **Regel:** Für flächendeckende Fills (Solid) immer `ctx.fill('evenodd')` direkt auf den Pfad verwenden — wie beim Disc-Fill. `ctx.clip()` nur für Pattern (Lines/Cross/Dots) verwenden, wo Einzelstriche geclippt werden müssen. Neue Render-Funktionen immer mit Try-Catch umgeben. UI-Feedback (Toast, Panel-Refresh) nach jeder sichtbaren Datenänderung.
- **Betroffene Module:** `canvas-renderer.js` (`_drawHatch`), `drawing-tools-ext.js` (HatchTool), `properties-panel.js` (`_setHatchProperty`)

### [2026-03-16] Falsche disc/hole-Topologie bei konkaven Polygonen (Löwenkopf)
- **Fehler:** Bei komplexen konkaven Formen (z.B. Löwenmähne mit Zacken) wurden Konturen falsch als disc/hole klassifiziert. Disc-Fill erschien auf Holes und umgekehrt.
- **Root Cause:** `Geometry.centroid()` war ein simpler arithmetischer Mittelwert aller Punkte. Bei stark konkaven Formen (Sterne, Zacken, Halbmonde) fällt dieser Punkt **außerhalb** des Polygons. `_pointInPolygon(centroid, parent)` lieferte dann falsche Ergebnisse → falsches Nesting-Level → falsche disc/hole-Zuweisung.
- **Lösung:** `centroid()` durch flächengewichteten Centroid (Shoelace-basiert) ersetzt. Neue Methode `interiorPoint()` mit Horizontal-Scan-Fallback — garantiert einen Punkt innerhalb des Polygons, auch bei extrem konkaven Formen.
- **Regel:** Für Point-in-Polygon-Tests an konkaven Formen NIE den arithmetischen Mittelwert als Testpunkt verwenden. Immer `Geometry.interiorPoint()` nutzen, das einen garantiert-inneren Punkt liefert.
- **Betroffene Module:** `geometry.js` (centroid, interiorPoint), `ceracut-pipeline.js` (_analyzeTopology), `canvas-renderer.js` (Disc-Fill, Hatch Hole-Cutout)

### [2026-03-16] Undo-Granularität: Batch-Import darf nicht als eine einzige Gruppe auf dem Stack landen
- **Fehler:** Undo nach DXF-Import oder Zeichnen entfernte ALLE Konturen auf einmal statt einzeln.
- **Root Cause:** Mehrere Konturen wurden in einer einzigen Undo-Gruppe (`beginGroup/endGroup`) oder als ein Snapshot auf den Stack gelegt. STRG+Z machte die gesamte Gruppe rückgängig.
- **Regel:** Jede Kontur = ein eigener Undo-Eintrag, es sei denn die Aktion ist semantisch unteilbar (z.B. Explode einer Gruppe). Import-Operationen als Snapshot behandeln, aber mit Einzel-Undo pro Kontur. Bei Batch-Operationen prüfen: Will der User wirklich alles auf einmal rückgängig machen?
- **Betroffene Module:** `app.js` (Import/applyEntities), `undo-manager.js`

### [2026-03-16] Flächen-Hit-Test: Nur Kanten-Distanz reicht nicht für geschlossene Konturen
- **Fehler:** Klick innerhalb einer geschlossenen Kontur (z.B. Kreis) wurde nicht erkannt — nur Klicks nahe der Kante funktionierten.
- **Root Cause:** Hit-Test basierte ausschließlich auf Distanz zur nächsten Kante (`distanceToSegment`). Bei großen geschlossenen Konturen ist die Mitte weit von jeder Kante entfernt → kein Hit.
- **Regel:** Geschlossene Konturen brauchen zusätzlich Point-in-Polygon-Test. Erst Kanten-Distanz prüfen, dann für geschlossene Konturen `_pointInPolygon()` als Fallback. Das entspricht AutoCAD-Verhalten (Klick in Fläche = Selektion).
- **Betroffene Module:** `canvas-renderer.js` (`_hitTest`)

### [2026-03-16] Lead-Platzierung: Ecken sind schlechte Startpunkte für Wasserstrahl
- **Fehler:** Leads wurden an scharfen Ecken platziert statt auf geraden Segmenten. Führte zu schlechter Schnittqualität am Einstichpunkt.
- **Root Cause:** `autoPlace()` wählte den Startpunkt ohne Bewertung der lokalen Geometrie. Ecken (hoher Winkel zwischen Segmenten) sind beim Wasserstrahlschneiden problematisch weil der Strahl dort die Richtung wechselt.
- **Regel:** Lead-Platzierung muss Segmentlänge und Geradheit bevorzugen (Flat-Segment-Bonus). Scharfe Ecken bekommen Corner-Penalty. Mindest-Segmentlänge für Lead-Platzierung einhalten. Das ist die `_findBestLeadPosition()`-Logik mit Corner-Penalty und Flat-Segment-Bonus.
- **Betroffene Module:** `cam-contour.js` (`autoPlace`, `_findBestLeadPosition`)

### [2026-03-16] CSS overflow-Kaskade: Dropdown in overflow:hidden Parent braucht position:fixed
- **Fehler:** Layer-Dropdown im Ribbon war abgeschnitten — untere Einträge nicht sichtbar. 3 Fixversuche nötig.
- **Root Cause:** Ribbon-Container hatte `overflow-y: hidden` (oder `auto`). Dropdown als Child erbt diesen Clipping-Kontext. `position: absolute` reicht nicht — das Element bleibt im overflow-Kontext des nächsten positioned Parent.
- **Regel:** Dropdowns/Popups die über ihren Container hinausragen MÜSSEN `position: fixed` verwenden und Koordinaten via `getBoundingClientRect()` berechnen. `position: absolute` funktioniert nur wenn KEIN Vorfahre `overflow: hidden/auto/scroll` hat. Bei CSS-Bugs: Erst den Overflow-Kontext der gesamten Parent-Kette prüfen.
- **Betroffene Module:** `index.html` / `styles.css` (Ribbon-Dropdowns)

### [2026-03-16] Drawing Tools: Hardcoded Farbe statt Layer-Farbe für neue Entities
- **Fehler:** Neu gezeichnete Entities (Linien, Kreise, Rechtecke) erschienen in Weiß statt in der Farbe des aktiven Layers.
- **Root Cause:** Drawing Tools nutzten eine hardcoded Farbe (`'#FFFFFF'` oder Default) statt die Farbe des aktuell gewählten Layers abzufragen.
- **Regel:** Neue Entities und Rubber-Band-Vorschauen MÜSSEN die Farbe des aktiven Layers verwenden (`layerManager.getActiveLayer().color`). Hardcoded Farben nur für UI-Elemente (Grips, Selection-Highlights), nie für Geometrie.
- **Betroffene Module:** `drawing-tools.js` (alle Tools die Entities erstellen)

### [2026-03-24] CLAUDE.md Projekt-Version wird nicht aktualisiert
- **Fehler:** Bei Version-Bumps wurde der CLAUDE.md-Header (Zeile 5-7) per `sync-versions.js` aktualisiert, aber die Projekt-Tabelle (Version/Build-Zeile ~Zeile 183) blieb auf der alten Version stehen.
- **Root Cause:** Das `sync-versions.js` Script aktualisiert nur Header, Modul-Tabelle, Dateibaum und Sync-Pruefung — NICHT die Projekt-Tabelle. Die Checkliste erwähnte nur "Modul-Tabelle + Sync-Pruefung", nicht die Projekt-Version.
- **Regel:** Nach `node scripts/sync-versions.js` immer auch die Projekt-Tabelle (`| Version | **VX.Y** — Build ...`) manuell prüfen und aktualisieren. Checkliste-Punkt 5 wurde entsprechend erweitert.
- **Betroffene Module:** `CLAUDE.md`, Workflow

### [2026-03-24] API-Methoden vor Aufruf verifizieren
- **Fehler:** `layerManager.setActiveLayer(name)` aufgerufen — Methode existiert nicht. Heißt `setActive(name)`.
- **Root Cause:** Methodenname geraten statt im Quellcode nachgeschaut. Kein Grep/Read vor dem Aufruf.
- **Regel:** VOR dem Einfügen eines Methodenaufrufs IMMER per Grep verifizieren, dass die Methode mit exakt diesem Namen existiert. Nie Methodennamen raten.
- **Betroffene Module:** `index.html`, `layer-manager.js`

### [2026-03-24] Renderer-Patch: Property-Namen muessen mit der aktuellen Klasse uebereinstimmen
- **Fehler:** `cam-tools.js` Analyze-Marker Renderer-Patch nutzte `this.zoom`, `this.panX`, `this.panY`, `this.dpr` — CanvasRenderer hat aber `this.scale`, `this.offsetX`, `this.offsetY`, `this._dpr`. Marker waren unsichtbar.
- **Root Cause:** Renderer-Patch wurde gegen eine andere/aeltere API geschrieben und nie gegen die aktuelle Klasse verifiziert.
- **Regel:** Bei Monkey-Patching einer Klasse IMMER die aktuellen Property-Namen per Grep verifizieren. Die gleiche Transformation wie die Originalklasse verwenden (copy-paste aus `render()` statt ausdenken).
- **Betroffene Module:** `cam-tools.js`, `canvas-renderer.js`

### [2026-03-24] Direktes undoStack.push() ueberspringt redoStack-Clearing
- **Fehler:** CAM-Tools pushten Commands direkt auf `undoMgr.undoStack` statt `undoMgr.execute()`. Dadurch wurde der `redoStack` nicht geleert → inkonsistenter Undo/Redo-Zustand.
- **Root Cause:** Bei Commands die bereits ausgefuehrt sind (execute() schon gelaufen) wird `undoStack.push()` statt `undoMgr.execute()` genutzt, um doppelte Ausfuehrung zu vermeiden. Aber dabei wird vergessen, den redoStack zu leeren.
- **Regel:** Wenn `undoStack.push(cmd)` direkt genutzt wird (weil Aktion bereits ausgefuehrt), IMMER auch `undoMgr.redoStack.length = 0` ausfuehren.
- **Betroffene Module:** `cam-tools.js`, alle Module mit direktem undoStack-Zugriff

### [2026-03-24] Direktes undoStack.push() ohne _notifyStateChange() — Undo-Buttons bleiben stale
- **Fehler:** Nach CAM-Tool-Aktionen (Edgefix, Replace, Analyze, BoundaryTrim, PolyJoint, Vectorize, ConvexHull) und Grip-Editing blieben die Undo/Redo-Buttons im Header disabled, obwohl Aktionen auf dem Stack lagen. Strg+Z funktionierte, aber die Buttons zeigten falschen Zustand.
- **Root Cause:** `undoStack.push(cmd)` wurde korrekt aufgerufen, aber `undoMgr._notifyStateChange()` fehlte. Der `onStateChange`-Callback (der die Buttons enabled/disabled) wird nur von `execute()`, `undo()`, `redo()` und `endGroup()` automatisch aufgerufen — NICHT bei direktem `push()`.
- **Regel:** Bei direktem `undoStack.push(cmd)` IMMER die Dreier-Sequenz einhalten: (1) `undoStack.push(cmd)`, (2) `redoStack.length = 0`, (3) `_notifyStateChange()`. Keinen der drei Schritte weglassen. Besser: Prüfen ob `undoMgr.execute(cmd)` verwendbar ist (wenn Aktion noch nicht ausgeführt).
- **Betroffene Module:** `cam-tools.js` (8 Stellen), `canvas-renderer.js` (Grip-Edit)

### [2026-03-24] Layer-Operationen ohne Undo-Tracking — Visibility/Lock/Color nicht rückgängig machbar
- **Fehler:** Layer-Sichtbarkeit togglen, Layer sperren/entsperren und Farbänderungen waren nicht per Strg+Z rückgängig machbar. User-Erwartung: Jede UI-Aktion sollte undo-fähig sein.
- **Root Cause:** `LayerManager` hatte keine Referenz auf den `UndoManager`. Alle Mutationen (`toggleVisibility`, `toggleLock`, `setColor`) änderten den State direkt ohne FunctionCommand auf den Undo-Stack zu legen.
- **Regel:** Jede benutzersichtbare Datenänderung MUSS über den UndoManager laufen. Neue Module die State mutieren brauchen eine `undoManager`-Referenz. Bei bestehenden Modulen prüfen: Welche Mutationen sind NICHT undo-fähig?
- **Betroffene Module:** `layer-manager.js`, `app.js` (Verknüpfung)

### [2026-03-25] Layer-Dropdown: Leere manuell erstellte Layer verschwinden
- **Fehler:** Manuell erstellte Layer ohne Konturen verschwanden aus dem Layer-Dropdown sobald ein anderer Layer aktiviert wurde.
- **Root Cause:** `_updateLayerUI()` filterte Layer die weder "0" noch aktiv noch kontur-belegt waren. Manuell erstellte leere Layer fielen durch den Filter.
- **Regel:** Alle Layer im Dropdown anzeigen — keine Filterung nach Belegung. Leere Layer können vom User beabsichtigt sein (Vorbereitung, Organisation). Wie AutoCAD: Jeder definierte Layer ist immer sichtbar.
- **Betroffene Module:** `app.js` (`_updateLayerUI`)

### [2026-03-25] querySelector mit Komma-Selektor: DOM-Reihenfolge statt Selektor-Priorität
- **Fehler:** Layer-Eigenschaften-Dialog: Toolbar-Buttons (Löschen, Umbenennen, Aktuell setzen) operierten immer auf Layer 0 statt auf dem vom User angeklickten Layer.
- **Root Cause:** `querySelector('#lm-table-body tr.lm-selected, #lm-table-body tr.lm-active')` gibt das **erste** matchende Element in DOM-Reihenfolge zurück — nicht den ersten Selektor mit Match. Layer 0 ist immer erste Zeile + hat `lm-active` → wird immer gefunden.
- **Regel:** Für Fallback-Logik (erst X prüfen, dann Y) NIEMALS Komma-Selektoren in `querySelector` verwenden. Stattdessen `querySelector(A) || querySelector(B)`. Komma-Selektoren sind OR in DOM-Reihenfolge, nicht in Selektor-Reihenfolge.
- **Betroffene Module:** `index.html` (Layer-Manager Event-Handler)

### [2026-03-25] _entityToDxfFormat: Typ-Konvertierung löscht Export-Metadaten
- **Fehler:** Gezeichnete Splines wurden als LWPOLYLINE in DXF gespeichert — Fit-Points und Kontrollpunkte gingen verloren. Beim Wiederöffnen war die Spline nicht mehr editierbar.
- **Root Cause:** `_entityToDxfFormat()` konvertierte `type: 'SPLINE'` zu `type: 'LWPOLYLINE'`. Dieser Typ wurde durch `chainContours()` als `sourceType` auf die CamContour übertragen. DXF-Writer prüft `sourceType === 'SPLINE'` → bei `'LWPOLYLINE'` wurde als einfache Polyline exportiert.
- **Regel:** Bei der Entity-Normalisierung den Original-Typ beibehalten wenn Export-relevante Metadaten daran hängen (Fit-Points, Control-Points, Knots). Der `type`-Wert fließt als `sourceType` in den DXF-Writer — eine Typ-Änderung bedeutet Datenverlust beim Export.
- **Betroffene Module:** `drawing-tools.js` (`_entityToDxfFormat`)

### [2026-03-25] Window-Selection im Inneren geschlossener Konturen blockiert
- **Fehler:** Innerhalb eines Rechtecks konnte keine Window-Selection (Aufzieh-Auswahl) gestartet werden. Außerhalb funktionierte es.
- **Root Cause:** `mousedown`-Handler nutzte `findContourAtPoint()` mit Flächen-Hit. Der Point-in-Polygon-Test erkannte den Klick als "auf Kontur" → Window-Selection-Start wurde blockiert. Gleiches Problem bei Rechtsklick: Kontur-Menü statt Canvas-Menü.
- **Regel:** Bei mousedown (Window-Selection-Start) und contextmenu (Rechtsklick) immer `{ edgeOnly: true }` verwenden. Flächen-Hit nur beim click-Event (Selektion per Klick). Und: bei "Auswahl-Werkzeuge" nachfragen was genau gemeint ist — Window-Selection, Grips, Kontextmenü.
- **Betroffene Module:** `canvas-renderer.js` (mousedown, contextmenu), `app.js` (contextmenu)

### [2026-03-25] _detectCircle erkennt Rechteck fälschlich als Kreis
- **Fehler:** Im Radius-Messmodus wird ein Rechteck als Kreis erkannt. Gelber Umkreis wird angezeigt mit falschen Radius-Werten.
- **Root Cause:** `_detectCircle()` berechnet Mittelpunkt als Durchschnitt aller Punkte und prüft ob alle Punkte gleich weit entfernt sind (`relDev`). Bei einem Rechteck sind alle 4 Ecken gleich weit vom Zentrum entfernt (halbe Diagonale) → `relDev = 0` → als Kreis erkannt.
- **Regel:** Geometrische Erkennung muss BEIDE Fälle abfangen: (1) Rechteck ohne Bulge → min 8 Punkte, (2) Rechteck MIT Eckenradien (Bulge) → Bulge-Ratio prüfen. Ein echter Kreis hat 100% Bulge-Segmente, ein Rechteck mit Eckenradien nur 50%. Schwelle: `bulgeRatio >= 0.9`.
- **Betroffene Module:** `measure-tool.js` (`_detectCircle`)

### [2026-03-25] Keyboard-Filter blockiert Ctrl-Shortcuts wenn cmd-input Focus hat
- **Fehler:** Ctrl+Z (Undo) funktionierte nicht nach dem Löschen per DEL-Taste. Auch Ctrl+Y (Redo) und andere Ctrl-Shortcuts waren betroffen.
- **Root Cause:** `bindKeyboardEvents()` filterte bei `isCmdInput` ALLE Tasten außer Escape/F1/F2/F3/F8. Nach `EraseTool` bekam `cmd-input` automatisch Focus (via `commandLine.activate()` in `startTool()`). Danach wurde Ctrl+Z geblockt weil `e.key === 'z'` nicht in der Whitelist war.
- **Regel:** Ctrl-Kombinationen (Ctrl+Z/Y/C/X/V/A/S) und die DEL-Taste MÜSSEN den cmd-input-Filter passieren — sie sind App-Level-Shortcuts, keine Text-Editing-Operationen. Filter-Bedingung: `isCmdInput && !ctrl && e.key !== 'Delete' && ...`.
- **Betroffene Module:** `app.js` (`bindKeyboardEvents`)

### [2026-03-26] DXF-Writer: Fehlende Pflicht-Sektionen crashen AutoCAD
- **Fehler:** Von CeraCUT exportierte DXF-Dateien bringen AutoCAD beim Laden zum Absturz.
- **Root Cause:** DXF-Writer erzeugte nur HEADER → TABLES → ENTITIES → EOF. Die DXF R2000 (AC1015) Spezifikation verlangt aber: HEADER → CLASSES → TABLES → BLOCKS → ENTITIES → OBJECTS → EOF. Ohne BLOCKS/CLASSES/OBJECTS gerät AutoCADs Parser in einen undefinierten Zustand. Zusätzlich war `$DWGCODEPAGE` = `UTF-8` statt dem korrekten `ANSI_1252`.
- **Regel:** DXF-Dateien MÜSSEN alle Pflicht-Sektionen der jeweiligen Version enthalten — auch wenn sie leer sind. Bei AC1015: CLASSES, BLOCKS und OBJECTS sind Pflicht. Codepage muss ein gültiger Autodesk-Wert sein (ANSI_1252, nicht UTF-8).
- **Betroffene Module:** `dxf-writer.js`

### [2026-06-24] Gap-Erkennung scannte blind Punktabstände → Falsch-positive Marker bei normalen Bögen
- **Fehler:** Beim Import von `0.80.DXF` (Praxis-CAM-Export) zeigte die Wizard-Vorschau an mehreren Stellen orange gestrichelte Linien + Punktgruppen entlang an sich korrekt geschlossener Konturen. User vermutete CAM-Anfahrwege ("Anschussfahnen"), die nicht importiert werden dürften.
- **Root Cause:** `MicroHealing.findInternalGaps()` (`geometry.js`, aufgerufen aus `ceracut-pipeline.js:_classifyGaps()`) scannte die FERTIGE, schon verkettete Punktliste jeder Kontur und markierte jeden Abstand zwischen zwei aufeinanderfolgenden Punkten > 2.0mm als "Gap" — ganz ohne Wissen darüber, ob die beiden Punkte (a) normale Tessellierungs-Punkte EINES ARC sind (bei großem Radius liefert `_adaptiveArcSegments()` bewusst Sehnenlängen bis ~2-3mm, um nur 0.01mm Sagitta-Abweichung zu garantieren — völlig normal), (b) Start/Ende eines einzelnen kurzen Entities (z.B. eine einzelne LINE-Kante), oder (c) tatsächlich eine Naht zwischen zwei verschiedenen DXF-Entities sind (das einzige Szenario, das wirklich ein Gap ist). Test-Harness zeigte: alle 8 Konturen chainten beim Parsen exakt (0.1mm Toleranz) — es gab keine echten Defekte, nur False Positives.
- **Regel:** Gap-/Defekt-Erkennung darf niemals nachträglich blind auf rohen Punkt-zu-Punkt-Abständen einer fertigen Polylinie basieren. Sie muss auf Daten beruhen, die im Moment der eigentlichen Operation (hier: Chaining in `chainContours()`) erfasst wurden — dort ist bekannt, welche zwei Punkte zu verschiedenen Source-Entities gehören und mit welcher echten Distanz sie verbunden wurden (`_findGridMatch().dist`). Diese "Seam"-Distanzen (`contour.entitySeams[]`) sind die einzig sinnvolle Datenquelle für Gap-Klassifizierung — nicht der fertige `points`-Array.
- **Betroffene Module:** `dxf-parser.js` (`chainContours`, `_createContour` → neu: `entitySeams[]`), `ceracut-pipeline.js` (`_classifyGaps`), `cam-contour.js` (`entitySeams` Property + `clone()`), `geometry.js` (`findInternalGaps()` als toter Code entfernt)

### [2026-06-24] DXF-Speichern (FSAPI) umging die ANSI_1252-Kodierung des DXF-Writers
- **Fehler:** Trotz mehrerer vorheriger Fixes (Pflicht-Sektionen, BLOCK/ENDBLK Owner-Handle) wies AutoCAD 2017 von CeraCUT gespeicherte DXF-Dateien weiterhin als beschädigt zurück.
- **Root Cause:** `DXFWriter.generate()` liefert reinen Text zurück; nur `generateDownload()` (Blob-Fallback) kodierte ihn über `_encodeAnsi1252()` zu Bytes. Der eigentlich primäre Speicherpfad — `saveDXF()`/`saveDXFAs()` über die File System Access API (`showSaveFilePicker`, Standard in Chrome/Edge) — rief stattdessen `writable.write(result.content)` mit dem rohen JS-String auf. Der Browser kodiert Strings beim Schreiben in einen `FileSystemWritableFileStream` intern als UTF-8. Der DXF-Header deklariert aber `$DWGCODEPAGE=ANSI_1252` — jedes Nicht-ASCII-Zeichen (z.B. Umlaute in Layer-Namen) wurde dadurch als Mehrbyte-UTF-8-Sequenz statt als Einzelbyte-ANSI-Zeichen geschrieben, was AutoCADs Parser an genau dieser Stelle aus dem Tritt brachte. Reine ASCII-Inhalte blieben unauffällig, weshalb der Bug bei einfachen Test-Exporten nicht auffiel.
- **Regel:** Wenn ein Writer/Encoder eine bestimmte Byte-Kodierung garantiert (hier ANSI_1252 via `_encodeAnsi1252()`), MUSS jeder Schreib-Pfad diese Kodierungsfunktion durchlaufen — nicht nur der offensichtliche/zuerst gebaute. Bei mehreren Speicherpfaden (Blob-Download, FSAPI-Direktspeichern, FSAPI-Speichern-unter) immer alle auf doppelte Konsistenz prüfen, besonders wenn ein Pfad nachträglich hinzugefügt wurde.
- **Betroffene Module:** `app.js` (`saveDXF`, `saveDXFAs`)

### [2026-06-24] DXF-Export: Fallback-Layer 'DRAW' nie im LayerManager registriert → undefinierter LAYER-Verweis
- **Fehler:** User meldete erneut "AutoCAD kann die Datei nicht öffnen" — diesmal für eine konkrete Datei (`FliesenMeyer_Logo_Entwurf.dxf`), NACH dem ANSI_1252-Encoding-Fix. Die Datei enthielt aber keine Sonderzeichen, der vorherige Fix konnte also nicht die Ursache sein.
- **Root Cause:** Rund 10 Stellen in `drawing-tools.js`/`advanced-tools.js`/`app.js` verwenden `entity.layer || 'DRAW'` bzw. hart `layer: 'DRAW'` als Fallback, wenn eine neu erzeugte Kontur (z.B. via `BoundaryTool`) keinen expliziten Layer hat. Dieser String wird nie über `layerManager.addLayer()` registriert. `DXFWriter._writeLayerTable()` schrieb bisher nur Layer aus `layerManager.getAllLayers()` in die LAYER-Table — Entities mit Code 8 = `DRAW` referenzierten dadurch im Export einen im LAYER-Table nicht existierenden Eintrag. AutoCAD verlangt aber, dass jeder Entity-Layer-Verweis (Code 8) einen passenden LAYER-Record hat; fehlt er, wird die Datei als beschädigt zurückgewiesen.
- **Regel:** Bei magischen Fallback-Werten (hier: Layer-Name als String-Literal an >10 Call-Sites) nicht jede einzelne Erzeugungsstelle patchen — stattdessen die Konsument-/Export-Seite robust machen: `DXFWriter._writeLayerTable()` ergänzt jetzt automatisch jeden von den zu exportierenden Konturen tatsächlich genutzten Layer-Namen, der im LayerManager fehlt. Bei Verdacht auf "Datei lässt sich nicht öffnen"-Bugs IMMER zuerst die konkrete Datei analysieren (Encoding, LAYER-Table vs. tatsächlich genutzte Code-8-Werte, Handle-Eindeutigkeit) statt pauschal die letzte Fix-Hypothese zu wiederholen.
- **Betroffene Module:** `dxf-writer.js` (`_writeLayerTable`, `generate`)

### [2026-06-24] GeometryOps.filletPolyline(): geschlossene Konturen verarbeiten erste Ecke doppelt
- **Fehler:** Beim Implementieren von RectangleTool-Fillet/Chamfer (Abschnitt 7.5) sollte die bestehende `GeometryOps.filletPolyline()` wiederverwendet werden. Test mit einem 100×100-Quadrat (Fillet-Radius 10) lieferte 166 statt der erwarteten ~136 Punkte — der komplette Bogen der ersten Ecke kam zweimal vor.
- **Root Cause:** Geschlossene Punkt-Arrays folgen in diesem Codebase durchgehend der Konvention "letzter Punkt = Duplikat des ersten" (z.B. `RectangleTool._createRectangle()`, `PolylineTool._createPolyline()` bei `closed=true`). `filletPolyline()`s Schleife ging bei `isClosed` aber bis `endIdx = n - 1` — also bis einschließlich des Duplikat-Punkts — und verarbeitete dadurch denselben physischen Eckpunkt zweimal (einmal bei `i=0`, einmal beim Duplikat bei `i=n-1`, mit identischen `prevIdx`/`nextIdx` durch das `% (n-1)`-Modulo). Bestehender Aufrufer (`advanced-tools.js:398`, FilletTool) hatte das nie bemerkt — vermutlich weil der Effekt (doppelt gezeichneter, identischer Bogen) visuell kaum auffällt.
- **Regel:** Bei "geschlossen = letzter Punkt duplil­ziert ersten"-Konventionen muss die Ecken-Schleife für geschlossene Konturen bis `n - 2` laufen (so viele *distinkte* Ecken wie `n - 1`, Index 0 bis `n - 2`), NICHT bis `n - 1`. Neue Polyline-weite Ecken-Operationen (hier: `chamferPolyline()`) immer gegen ein konkretes Testbeispiel mit bekannter erwarteter Punktzahl verifizieren, bevor sie verdrahtet werden — genau dieser Test deckte den Bug in der als Vorbild kopierten Funktion auf.
- **Betroffene Module:** `geometry-ops.js` (`filletPolyline`, `chamferPolyline`)

### [2026-06-24] _calcArcLeadIn/_calcArcLeadOut: radius=0 kollabiert Bogenzentrum auf Entry/Exit-Punkt
- **Fehler:** User meldete generelles Unwohlsein mit der Lead-In/Out-Sektion ("hier ist einiges im Argen") ohne konkreten Reproduktionsfall. Drei parallele Audit-Agenten (Geometrie, Profile/UI, Rendering/PP) fanden unabhängig voneinander denselben Root-Cause-Verdacht.
- **Root Cause:** `cam-contour.js` `_calcArcLeadIn()`/`_calcArcLeadOut()` setzen das Bogenzentrum als `entry + normal * radius`. Bei `radius === 0` (über Properties-Panel mit `min="0"` erreichbar, z.B. wenn User von `arc` auf einen sehr kleinen Radius geht oder ein Custom-Profil `leadInRadius: 0` mit `leadInType: 'arc'` kombiniert) kollabiert das Zentrum exakt auf den Entry-/Exit-Punkt. `entryAngle = Math.atan2(0, 0)` liefert in JS IMMER `0`, unabhängig von der tatsächlichen Schnittrichtung — der gesamte Lead degenerierte zu einer Linie Richtung 0°/+X-Achse statt tangential zur Kontur. Kein Guard gegen `radius <= 0` vorhanden, kein NaN (daher in Tests/Logs nicht aufgefallen) — nur eine geometrisch falsche, aber gültig aussehende Zahl.
- **Regel:** Bei jeder Bogenzentrum-Berechnung der Form `center = point + direction * radius` IMMER einen Guard für `radius <= EPSILON` einbauen, der auf den geometrisch sinnvollen Grenzfall (hier: tangentialer linearer Lead) ausweicht — NICHT auf die Bogenformel mit Radius 0 verlassen, auch wenn sie keinen Crash/NaN erzeugt. Degenerierte Geometrie ohne NaN ist gefährlicher als ein Crash, weil sie unbemerkt durchläuft (Renderer zeigt scheinbar plausible Linie, PP exportiert gültige aber falsche Koordinaten).
- **Betroffene Module:** `cam-contour.js` (`_calcArcLeadIn`, `_calcArcLeadOut`)

### [2026-06-24] Lead-In bekam über Jahre alle Robustheits-Features, Lead-Out wurde vergessen
- **Fehler:** Audit deckte auf, dass `getLeadInPath()` eine 3-stufige Fallback-Kette (Alt-Lead <40%, Center-Pierce <0.5mm) UND bei Multi-Kontur-Kollision zwei Routing-Strategien (Startpunkt-Rotation, Dog-Leg) hat — `getLeadOutPath()` hatte historisch NICHTS davon, nur stumpfes Kürzen bis zur Quasi-Null-Länge. Zusätzlich unterstützte `leadOutType` nur 2 von 4 Typen (fehlend: `tangent`/`on_geometry`), obwohl über `leadOutType = leadInType` (app.js/lead-profiles.js) alle 4 erreichbar waren.
- **Root Cause:** Lead-In und Lead-Out wurden über mehrere Versionen (V4.5 bis V5.3) hinweg als zwei separate Funktionspaare entwickelt statt von Anfang an parametrisiert (Richtung als Parameter). Jedes neue Feature (Fallback-Kette V4.5, Routing-Strategien V4.8) wurde nur in die Lead-In-Funktion eingebaut, weil Lead-In der "Hauptfall" (Anschuss) ist — Lead-Out wurde nie nachgezogen, fiel aber bei jedem Audit/Feature-Review durchs Raster, weil es ohne aktiven Vergleich der beiden Funktionen nicht auffällt.
- **Regel:** Wenn ein Feature für eine "Hälfte" eines symmetrischen Systems (Lead-In/Out, Vorwärts/Rückwärts, Start/Ende) gebaut wird, IMMER sofort prüfen ob die andere Hälfte das gleiche Feature braucht — nicht erst beim nächsten Audit. Bei neuen Lead-Features künftig: Funktion direkt für beide Richtungen schreiben oder zumindest einen TODO-Kommentar im Pendant hinterlassen.
- **Betroffene Module:** `cam-contour.js` (`getLeadOutPath`, `_tryAlternativeLeadOut`, `_tryDogLegLeadOut`)

### [2026-06-24] _getWasteSideNormal() ignorierte kerfFlipped — Innen-Leads schnitten ins Werkstück
- **Fehler:** User meldete nach dem vorherigen Lead-Audit-Sweep: "innen leads bei löchern werden falsch dargestellt, der lead schneidet ins werkstück." Kein konkretes Reproduktionsschema genannt.
- **Root Cause:** Es gibt im Code drei Stellen, die die "Verschnittseite" einer Kontur (innen bei Loch, außen bei Scheibe) aus `cuttingMode` ableiten: `getKerfOffsetPolyline()` (Kerf-Versatz-Richtung), `_getKerfCode()` (G41/G42 im Postprozessor) und `_getWasteSideNormal()` (Lead-Richtung). Die ersten beiden berücksichtigen korrekt das `kerfFlipped`-Flag ("Kompensation auf Gegenseite", User-Toggle): `isHole = kerfFlipped ? mode!=='hole' : mode==='hole'`. `_getWasteSideNormal()` prüfte aber nur `this.cuttingMode === 'hole'` direkt, ohne `kerfFlipped` — bei einem geflippten Loch-Kerf zeigte die Lead-Normale dadurch weiterhin in die ALTE (jetzt falsche) Richtung, während Kerf-Offset und G41/G42 bereits korrekt auf die neue Seite gewechselt waren. Drei eng verwandte Funktionen, die dieselbe Bedingung redundant in unterschiedlicher Vollständigkeit implementierten — klassisches Symptom fehlender Konsolidierung.
- **Regel:** Wenn ein Flag (hier `kerfFlipped`) eine bestimmte Bedingung an mehreren Stellen im Code umkehrt, IMMER per Grep ALLE Stellen mit der gleichen Basis-Bedingung (`cuttingMode === 'hole'`) suchen und prüfen, ob sie das Flag ebenfalls berücksichtigen müssten — nicht nur die Stelle fixen, die im Bug-Report konkret auffällt. Besser noch: so eine Bedingung in eine einzige Hilfsfunktion (`_isEffectivelyHole()`) auslagern, damit es nur eine Stelle zum Vergessen gibt.
- **Betroffene Module:** `cam-contour.js` (`_getWasteSideNormal`)

### [2026-06-24] Lead-Tangente/Normale nur aus auslaufender Kante — Ecken (v.a. konkave) konnten ins Werkstück schneiden
- **Fehler:** User meldete nach dem Kerf-Flip-Fix weiterhin "die Darstellung in einer Innenecke ist immer noch falsch", zusätzlich dass der Lead-Startpunkt nur auf Ecken, nicht auf geraden Kanten verschiebbar war.
- **Root Cause (Startpunkt):** `setStartPoint()` nutzte `Geometry.closestPointOnPolyline()` nur um den nächstgelegenen Punkt zu FINDEN, rotierte dann aber auf den nächstgelegenen EXISTIERENDEN Vertex (`this.points[i]`) statt die tatsächliche Drag-Position zu verwenden. Auf langen geraden DXF-Kanten ohne Zwischenpunkte gab es zwischen den Eckpunkten schlicht keinen Vertex, auf den man hätte snappen können — daher der Eindruck "nur auf Ecken verschiebbar".
- **Root Cause (Innenecke):** `getLeadInPath()`/`getLeadOutPath()` berechneten Tangente und Verschnitt-Normale ausschließlich aus der AUSLAUFENDEN Kante ab dem Start-/Exit-Vertex — die einlaufende Kante wurde komplett ignoriert. An einem geraden Streckenabschnitt ist das unproblematisch (beide Kanten zeigen praktisch gleich), aber GENAU AN einer Ecke (zwingend dort, wo der User den Startpunkt gerade hingezogen hat) weichen ein- und auslaufende Kante ab. Bei einer konkaven ("Innen-")Ecke kann die allein auf der Ausgangskante basierende Normale auf die FALSCHE Seite zeigen, weil der tatsächliche Verschnitt-Keil an einer konkaven Ecke schmal und von BEIDEN Kanten begrenzt ist — eine Einzelkanten-Normale "sieht" diese zweite Begrenzung nicht. Zusätzlich ignorierte `_calcLinearLeadIn`/`_calcLinearLeadOut` bei `leadInAngle=0`/`leadOutAngle=0` die Normale komplett (reines Tangenten-Retreat) — bei einer Ecke ist das praktisch nie sicher.
- **Regel:** Geometrieberechnungen, die "die nächste Kante" an einem Vertex verwenden, müssen explizit prüfen, ob der Vertex eine ECKE ist (einlaufende ≠ auslaufende Kante) — an Ecken reicht eine Einzelkanten-Basis nicht, der Bisektor beider Kanten-Normalen ist nötig (degeneriert auf gerader Strecke automatisch zur alten Einzelkanten-Normale, also keine Regression). Bestehende Ecken-Erkennungs-Helper (hier `_isAtCorner()`) vor Wiederverwendung genau prüfen: diese war vorzeichen-unabhängig vom Dot-Product abgeleitet und konnte daher NICHT zwischen konvexer und konkaver Ecke unterscheiden — für sicherheitskritische Richtungsentscheidungen ungeeignet, dafür eine eigene, einfachere Tangenten-Dot-Product-Prüfung verwendet.
- **Betroffene Module:** `cam-contour.js` (`setStartPoint`, `getLeadInPath`, `getLeadOutPath`, `_calcLinearLeadIn`, `_calcLinearLeadOut`, neu: `_getCornerSafeLeadBasis`)

### [2026-06-25] Tangentialer Lead an Ecken (0°, V6.40) lief in engen, gekrümmten Kanälen ungebremst längs durch — Kollisions-Kürzung griff nicht
- **Fehler:** Direkt nach dem Fix "Lead bei engen Konturen nur bis zur Hälfte der Kanten-Distanz kürzen" meldete der User per Screenshot: "Ergebnis schlechter, nicht besser" — der Lead lief jetzt noch weiter durch die Kontur als vorher.
- **Root Cause:** Die vorherige Fix-Iteration (`_truncatePathToHalfLength` in `_shortenLeadIfCollision`) wirkt nur, wenn der Lead die gegenüberliegende Kontur-Kante per Segment-Schnitt-Test tatsächlich KREUZT. Eine frühere, in derselben Session umgesetzte Anforderung ("0°-Lead an 90°-Ecken statt 90°") erzwingt an Ecken einen rein TANGENTIALEN Lead-Winkel. In einem engen, gekrümmten Kanal (schmaler Steg/Nut mit gerundetem Ende) läuft ein tangentialer Lead aber LÄNGS PARALLEL zur gegenüberliegenden Wand statt sie zu queren — er kreuzt nie eine Kante, die Kollisionsprüfung fand daher nie einen Treffer und der Lead lief komplett ungebremst bis zum Ende des Kanals. Zwei in sich korrekte Fixes (0°-Tangente an Ecken; Halbierung bei Kollision) negierten sich gegenseitig in genau dieser Kombination — keiner der beiden Einzeltests deckte das auf, weil sie isoliert getestet wurden statt in Kombination am tatsächlichen Problemfall (enger UND gekrümmter Kanal MIT Ecke am Anfang).
- **Regel:** Wenn ein Fix die LÄNGE eines Pfads anhand von Kollision/Schnittpunkt begrenzt, aber ein anderer (auch unabhängig korrekter) Fix die RICHTUNG dieses Pfads ändert, IMMER prüfen ob die neue Richtung die Kollisions-Erkennungsmethode noch erreichen kann — ein Schnittpunkt-Test setzt voraus, dass der Pfad die Kante überhaupt KREUZT, das ist bei tangentialen/parallelen Richtungen nicht garantiert. Robuster: Länge VOR der Pfad-Berechnung anhand des reinen Abstands zur nächsten (nicht direkt angrenzenden) eigenen Kontur-Kante kappen (`_capLengthForNarrowChannel`, richtungsunabhängig), statt sich allein auf nachträgliche Pfad-Kante-Schnittpunkt-Erkennung zu verlassen. Bei mehreren Fixes am selben Subsystem in einer Session: am Ende immer den ungünstigsten KOMBINIERTEN Fall testen, nicht nur jeden Fix einzeln.
- **Betroffene Module:** `cam-contour.js` (`getLeadInPath`, `getLeadOutPath`, neu: `_capLengthForNarrowChannel`)

### [2026-06-25] DXF-Import normalisierte Geometrie ~30m vom Ursprung entfernt nicht — Export crashte AutoCAD, CNC-Code enthielt 29m-Verfahrwege
- **Fehler:** User meldete: exportierte `Irlich_Test.dxf` crasht AutoCAD, WariCAM zeigt nur verstreute Bruchstücke statt der vollständigen Kontur. Bereitgestellt: die DXF-Datei, ein WariCAM-Screenshot und der erzeugte CNC-Code zum Vergleich.
- **Root Cause:** Analyse der Rohdaten zeigte, dass ALLE Entities (inkl. der 362×342mm-Plattenkontur selbst) bei X≈-29.964 bis -29.601, Y≈17.868 bis 18.211 lagen — die Quelle war original ~30 Meter vom Zeichnungsursprung entfernt (z.B. aus einem größeren Lageplan/Assembly importiert) und wurde nie auf den Werkstückbereich zentriert. Der generierte CNC-Code bestätigte das 1:1 (`G00 X-29859.966 Y17927.207`) — der Bug betraf nicht nur den DXF-Export, sondern die GESAMTE Pipeline ab dem Import. `_autoNormalizeEntities()` (dxf-parser.js) existiert genau für diesen Fall, aber `NORMALIZATION_THRESHOLD` stand auf 1.000.000 — viel zu hoch für ein Werkstück im Bereich von wenigen hundert/tausend mm. Zusätzlich verschob die Funktion, selbst wenn sie ausgelöst würde, nur `entity.points` — nicht aber `_splineData.controlPoints/fitPoints`, `_fitPoints` oder `_center`. `dxf-writer.js` bevorzugt bei SPLINE/CIRCLE-Export genau diese Rohfelder vor `.points` — ein normalisierter Import hätte beim Re-Export also wieder die alte, falsche Position zurückgeschrieben (latenter Folgefehler, der durch den hohen Threshold bisher nie sichtbar wurde).
- **Regel:** Bei Bug-Reports mit konkreten Artefakten (Datei + Screenshot + Vergleichsdatei) IMMER zuerst die Rohkoordinaten der bereitgestellten Datei vermessen (min/max je Entity-Typ), bevor man Hypothesen über Rendering/Parsing-Logik aufstellt — die Größenordnung der Zahlen verrät den Bug oft direkt. Schwellenwerte für "ist das plausibel für ein Werkstück" (hier `NORMALIZATION_THRESHOLD`) müssen an der tatsächlichen Domäne (Wasserstrahl-Platten, typischerweise <3000mm) kalibriert werden, nicht an einem beliebig großen Sicherheitsabstand. Wenn eine Normalisierungs-/Transform-Funktion `.points` verschiebt, IMMER alle redundant gespeicherten Rohdaten-Felder (hier: `_splineData`, `_fitPoints`, `_center`) im selben Schritt mitverschieben — sonst entsteht ein stiller Re-Export-Bug, der erst beim nächsten Export sichtbar wird.
- **Betroffene Module:** `dxf-parser.js` (`NORMALIZATION_THRESHOLD`, `_autoNormalizeEntities`)

### [2026-06-25] DXF-Writer bevorzugte Import-Cache (_splineData/_center) immer vor contour.points — Move/Rotate desynct den Cache
- **Fehler:** Direkter Folge-Fix zum 30m-Offset-Bug von eben (siehe Eintrag oben). User fragte, ob "unser Export" grundsätzlich das Problem sei.
- **Root Cause:** `dxf-writer.js` `_writeSpline()`/`_writeCircle()` lesen für den Re-Export bevorzugt die ROHEN Import-Felder (`_splineData.controlPoints/fitPoints`, `_fitPoints`, `_center`) statt der aktuellen `contour.points` — in der Annahme, das sei "originalgetreuer". Aber: `MoveTool`/`RotateTool`/`MirrorTool`/`ScaleTool` (`drawing-tools.js`) transformieren beim Verschieben/Drehen einer Kontur AUSSCHLIESSLICH `contour.points` — die Cache-Felder bleiben unangetastet. Verschiebt ein User eine importierte Spline/einen Kreis auf dem Canvas, laufen Cache und tatsächliche Position auseinander; der nächste DXF-Export schrieb dann wieder die ALTE, vor-Verschiebung-Position. Gleicher Bug-Typ wie der Import-Normalisierungs-Bug von eben, nur über einen anderen Auslöser (Tool-Transform statt fehlende Import-Normalisierung) — zwei unabhängige Wege zum selben Symptom, weil beide Subsysteme dieselbe (falsche) Grundannahme teilten: "Cache-Felder sind immer aktuell".
- **Regel:** Wenn ein System redundante Datenfelder für dieselbe Geometrie hält (hier: `.points` vs. `_splineData`/`_center`), darf der Export NIE blind dem "spezielleren" Feld vertrauen, ohne zu prüfen, ob es noch zur aktuellen Quelle (`.points`) passt — Konsument robust machen statt jede Erzeuger-Stelle (Move/Rotate/Mirror/Scale/zukünftige Tools) einzeln synchron halten zu müssen (gleiches Prinzip wie beim Layer-Table-Fix V6.30). Konkret: Bounding-Box-Zentren vergleichen, Toleranz = eigene Diagonale der Kontur (tolerant genug für normale Kontrollpolygon-Abweichung bei Splines, strikt genug für Meter-Offsets), bei Drift verlustbehafteten aber korrekten Polyline-Fallback nutzen statt eine falsche Position zu schreiben.
- **Betroffene Module:** `dxf-writer.js` (`_writeSpline`, `_writeCircle`, neu: `_isCacheStale`, `_bbox`)

### [2026-06-25] SPLINE-Closed-Flag aus DXF-Quelle blind übernommen — Quelldateien setzen es oft pro Pfad-Segment statt fürs Gesamtpolygon
- **Fehler:** User meldete erneut "Export funktioniert immer noch nicht" für `Irlich_Entwurf2.dxf` — Symptom: falsche/verstreute Geometrie. Datei war bereits ein CeraCUT-Export (3. Iteration nach `Irlich_Test.dxf` → `Irlich_Test2.dxf`), enthielt 39 SPLINE-Entities, **alle 39** mit Gruppencode 70 = geschlossen (Bit 1), aber **keine einzige** mit zusammenfallenden Start-/Endpunkten (z.B. 25.6mm Lücke), Knotenvektor war zudem ein klassischer offener (clamped) Vektor — strukturell widersprüchlich zum Closed-Flag.
- **Root Cause:** `dxf-parser.js::_parseSpline()` übernahm `isClosed = (flags & 1) === 1` (bzw. Periodic-Bit) ungeprüft aus der DXF-Quelle. Manche Vektor-Tools (aus Illustrator/CorelDraw abgeleitete DXF-Exporter) setzen dieses Bit fälschlich auf JEDES einzelne Spline-Segment eines zusammengesetzten Pfades statt nur aufs Gesamtpolygon. `canvas-renderer.js` zeichnet für jede Kontur mit `isClosed=true` automatisch ein Schluss-Segment vom letzten zum ersten Punkt — bei 25mm Lücke entsteht eine sichtbare falsche Sehne quer durchs Bauteil. `dxf-writer.js::_writeSpline()` schrieb das (weiterhin falsche) Flag beim Re-Export ungeprüft zurück, wodurch der Fehler jeden Export/Re-Import-Zyklus überlebt und sich sogar vermehrt (35 → 35 → 39 Splines über drei Testdateien).
- **Regel:** Flags aus einer Fremdformat-Quelle (DXF, aber auch SVG/sonstige Importe) NIE blind übernehmen, wenn sie geometrisch prüfbar sind — bei SPLINE/Closed-Bit: tessellierte Start-/Endpunkte vergleichen (Toleranz = `TOLERANCES.CHAIN`), bei Abweichung das Flag verwerfen statt es weiterzutragen. Gleiches Prinzip defensiv auch beim Schreiben anwenden (`dxf-writer.js`), falls eine Kontur über einen anderen Pfad mit inkonsistenten Rohdaten ankommt — nicht nur den Import absichern. Gleiche Fehlerklasse wie der `_isCacheStale()`-Fix (V1.10): Konsument robust machen statt der Quelle/dem Cache blind zu vertrauen.
- **Betroffene Module:** `dxf-parser.js` (`_parseSpline`, V3.17), `dxf-writer.js` (`_writeSpline`, neu: `_dist`, V1.11)

### [2026-06-25] chainContours() reicht beim Verketten nur die Roh-Cache-Felder DES ERSTEN Segments durch — Rest der Kontur geht beim SPLINE-Export verloren
- **Fehler:** User testete den Closed-Flag-Fix (siehe Eintrag direkt oben) mit neuen Exports (`Irlich_Entwurf3.dxf`, `Irlich_Entwurf4.dxf`) — Screenshot aus ShareCAD zeigte weiterhin exakt dasselbe "verstreute Bruchstücke"-Bild. Der Closed-Flag-Fix war korrekt (Closed-Anteil sank von 39/39 auf 3-4/35), behob aber nicht das eigentliche Symptom — ich hatte vorschnell angenommen, das Ergebnis sei jetzt richtig, ohne den tatsächlichen Re-Export zu prüfen.
- **Root Cause:** `chainContours()` verkettet mehrere Original-DXF-Entities (z.B. SPLINE + mehrere LINEs) korrekt zu EINER durchgehenden Kontur (`chain.points` enthält alle Punkte, `isClosed` stimmt) — reicht aber für `_splineData`/`_fitPoints`/`sourceType` immer nur die Felder DES SEED-SEGMENTS (`segments[i]`) durch, nie der angeketteten Segmente. War das Seed-Segment eine SPLINE, wurde die GESAMTE gekettete Kontur als `sourceType='SPLINE'` markiert — `dxf-writer.js::_writeSpline()` schreibt dann ausschließlich die paar rohen Kontrollpunkte des winzigen ersten Segments und verwirft den Rest der eigentlich korrekt verketteten Kontur komplett. Mit Node nachgebaut: SPLINE (4 Kontrollpunkte) + 4×LINE zu einem 100×100mm-Quadrat verkettet → 1 Kontur mit 7 Punkten, aber nur die 4 Kontrollpunkte des ersten Mini-Segments wurden weitergereicht.
- **Regel:** Bei jeder Datenverlust-Vermutung den tatsächlichen Export/Re-Import-Output prüfen statt der Logik zu vertrauen, die nur EIN Symptom behebt — ein Fix kann technisch korrekt sein und trotzdem das eigentliche Problem nicht lösen, wenn zwei unabhängige Bugs dasselbe Symptom erzeugen. Konkret: Cache-/Rohdaten-Felder bei Mehrfach-Segment-Strukturen (Chaining, Merging, Gruppierung) nur durchreichen, wenn sie nachweislich die GESAMTE resultierende Struktur abdecken — sonst auf den vollständigen, garantiert korrekten Punkte-/Daten-Satz zurückfallen (gleiches Prinzip wie `_isCacheStale()`, aber hier auf Vollständigkeit statt nur Position geprüft).
- **Betroffene Module:** `dxf-parser.js` (`chainContours`, V3.18)
