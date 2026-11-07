# FINest-Integration — Phase 2a: Autonest

> Datum: 2026-11-07 · Konzept: `docs/finest-integration-konzept.md` · Vorgänger: `tasks/todo-finest-phase1.md`

## Entscheidung Blech
- **Jetzt:** Blech wird im Autonest-Dialog **von Hand** eingegeben (Breite × Länge).
- **Später (festgehalten, Option offen):** Auswahl aus der **Blechbibliothek**.
  - Datenmodell steht schon: `data/sheets.json` + `/api/sheets` (Store + API vorhanden, keine Oberfläche).
  - Im Plan ist `plan.sheet.sheetId` bereits vorgesehen und wird derzeit mit `null` gespeichert; `width`/`length` bleiben immer als Kopie im Plan (Plan bleibt lesbar, auch wenn das Blech gelöscht/geändert wird).
  - Umsetzung später: Dropdown/Dialog „Blech aus Bibliothek“ im Autonest → setzt `sheetId`, Breite, Länge; nach dem Nesting `SheetLibrary.consume(sheetId, n)` (Bestand), Reste (`remnants`) zurück in die Bibliothek; Blechbibliothek-Dialog (Filter, Bestand, Gewicht) laut Konzept §1.1.

## Erledigt
- [x] `nesting.js` V1.3: `order` (große/kleine zuerst/Eingabe), `priority` und `rotationSteps` je Teil, Node-Export; Raster-Kandidaten gedeckelt (300 Teile auf 3000×1500: 68 s → 1,8 s)
- [x] `nesting-plan.js` V1.0: `NestingPlan.run` (Bedarf → Plan), `placePart`, Vorschau-SVG; Dialog „Automatisches Nesting“ (Nesting-Tab → Autonest)
- [x] Plan speichern über `POST /api/plans` (Instanzen mit `sheetIndex`, Stats je Teil)

- [x] Plan öffnen (V1.1): Button „Plan öffnen" im Tab Nesting → Planliste → Blech als DXF (Layer BLECH = Referenz, Teile auf Layer 0) in neuem Tab; exakte Teile-Revision über `?rev=`; „Im Editor öffnen" direkt aus dem Autonest-Dialog

- [x] **Große Stückzahlen** (nesting V1.4 / nesting-plan V1.5, 2026-11-07): Engine um Faktor ~50 schneller (500 gemischte Teile 81 s → 1,7 s, 1000 → 4 s, 2000 → 8 s, gleiche Packungsqualität): Raumindex, vorübersetzte Polygone, Teiletyp-Merker „passt nicht mehr" (typeKey), Suchhinweis je Teil/Variante (eine Teilehöhe Spielraum), numerisches Dedupe. Autonest läuft im **Web Worker** (`nesting-worker.js`): Fortschrittsbalken, Abbrechen, kein „Seite reagiert nicht"
- [x] **Vorschau zoombar** (Mausrad um den Cursor, Ziehen, Einpassen, 50 %…300×) direkt im Autonest-Dialog + „Große Ansicht" (PartViewer mit Legende); `ZoomPane` wiederverwendbar
- [x] **Schachtelplan als PDF** (`POST /api/reports/plan-pdf`): A4 quer, eine Seite je Blech (maßstäblich, Teilenummern, Maße, Legende) + Teileliste; Autonest-Dialog („Plan als PDF") und Planliste („PDF")
- Feine Konturen: Polygon-Vereinfachung für die Platzierung (Douglas-Peucker 0,1 mm, Extrempunkte bleiben → BBox identisch; Abstand +0,4 mm Sicherheitszuschlag, echter Mindestabstand per Brute-Force-Test belegt) + Kanten-Raster je platziertem Teil: 100 echte Kunstteile aus `Examples/` (bis 1900 Punkte, bis 2 m breit) 59 s → 3,3 s; 300 Stück 9,9 s
- Gemessene Richtwerte (Node, 3000×1500, Abstand 3 mm): 500 gemischte Teile ≈ 2 s, 1000 ≈ 4 s, 2000 ≈ 10 s; feine Teile (400 Punkte) 300 Stück ≈ 6 s
- Grenzen: freie 10°-Drehung und sehr große/viele Bleche verlängern die Laufzeit; Rest-Heuristik ist BLF (kein True-Shape), die Packung ist nicht optimal

- [x] **Fix Überlagerungen** (2026-11-07, Testdatei `HEIDED856000W-115V1.DXF`): Die Datei enthält zwei Stücke (je 140×140 mit 4 Löchern) **und** eine Waricam-Referenzlinie auf Layer `REFERENZ` (240×420). Der Import hat alles als EIN Teil gespeichert, das Nesting nur die größere Außenkontur berücksichtigt → zweites Stück und Referenzlinie wanderten mit und lagen über anderen Teilen (bei 30 Stück 200 Kontur-Überlappungen). Jetzt: (1) Import schließt REFERENZ-/Blech-/Rahmen-Layer standardmäßig aus, (2) mehrere getrennte Außenkonturen werden als eigene Teile importiert, identische Stücke zusammengefasst (Menge × Anzahl; Checkbox „Getrennte Außenkonturen als eigene Teile"), (3) Nesting behandelt Teile mit mehreren Außenkonturen als starre Einheit (konvexe Hülle) und ignoriert REFERENZ-Konturen — schützt auch ältere, schon importierte Teile. Hinweis: Bereits importierte Teile mit Referenzlinie enthalten diese noch in Schnittlänge/Fläche (Kalkulation) → neu importieren empfohlen
- Tests: Brute-Force-Überlappungsprüfung (`tests/helpers/overlap.js`) mit der echten Datei (30 Stück → 0 Überlappungen; alter Code: 80–200)

- [x] **Browser hängt bei 100 Stück der Heide-Testdatei** (2026-11-07): Gemessen (Node/jsdom, Heide-Datei, 200 Stück nach Aufteilen, Blech 3000×1500): Import 0,14 s, Nesting 1,2–1,8 s (im Worker), SVG-Aufbau der Vorschau 0,1 s ABER 1,4 MB / 945 Pfade mit `non-scaling-stroke` — das ist beim Zoomen/Verschieben der Flaschenhals im echten Browser (nicht nachmessbar ohne Browser). Deshalb: Vorschau/Große Ansicht zeichnen große Szenen jetzt auf **Canvas** (Teiletyp einmal als Path2D, je Instanz eine Matrix, nur sichtbare Instanzen; Neuzeichnen per requestAnimationFrame gebündelt; SVG wird gar nicht erst gebaut). Matrix-Mathematik gegen `placePart` geprüft (alle Drehungen). Zusätzlich Rückfrage beim Öffnen von Blechen mit >400 Konturen im Editor (Pipeline + Kollisionsprüfung brauchen dort ≈ 3 s in Node, im Browser mehr)
- Offen/ungemessen: Ladezeit des Editor-Tabs mit ~950 Konturen im echten Browser (Renderer, Konturliste, Lead-Berechnung)

- [x] **Fugen gleichmäßig** (nesting V1.5, 2026-11-07): Ursache der 3…8 mm: das Kandidatenraster ist grob (bis 20 mm) und BBox-basiert; bei nicht rechteckigen Konturen blieb zwischen Kontur und Nachbar mehr als die Fuge. Jetzt schiebt `_slide` jedes Teil nach der Platzierung (erst nach unten, dann zur Seite) bis zum Mindestabstand (Schritt ≤ 2×Fuge, kein Durchtunneln). Polygon-Zuschlag 0,05 mm Toleranz → 0,2 mm. Heide-Datei: Nachbarabstände 163 statt 76 Paare ≤ 3,5 mm, 8–15-mm-Fugen 55 → 1; echter Mindestabstand ≥ 3,1 mm. Test belegt es (alter Stand: 18 von 60 Teilen > 3,6 mm, max 10 mm)
- [x] **Import als Gruppe** (part-library V1.8): Standard ist jetzt „eine Datei = ein Teil"; mehrere Außenkonturen (Heide: zwei Stücke) bleiben als Gruppe zusammen (`geometry.groupSize`, Anzeige „Gruppe aus 2 Konturen" / „Gruppe ×2" in der Bibliothek) und werden als starre Einheit genestet; Menge bleibt wie eingegeben. Aufteilen in Einzelteile (identische zusammengefasst) ist per Kontrollkästchen weiterhin möglich

## Offen
- [ ] Geöffneter Plan ist ein normaler DXF-Tab: Änderungen am Plan (Verschieben im Tab) werden nicht in den Plan zurückgeschrieben; Teile-Update (In-Place-Edit, Phase 4) braucht echte Instanzbindung
- [ ] Beim Öffnen gehen Löcher/Stückzahl-Zuordnung (Teilename je Kontur) nicht in den Tab ein — Konturnamen sind generisch
- [ ] Spiegeln erlauben (Engine kennt es nicht), `innerPlacement` (True-Shape) → Phase 2c
- [x] Autonest im Web-Worker (nesting-worker.js, siehe oben „Große Stückzahlen“)
- [ ] Plan-Speichern-Dialog laut FINest (Fälligkeit, Kommentar, Menge, NC-Flag)
- [ ] Blechbibliothek-UI + Anbindung (siehe oben)
- [x] Bestehender Button „Nesting“ (btn-nesting): falsche Config-Keys und `result.utilization` korrigiert (Phase 5, 2026-11-07); danach ENTFERNT (2026-11-07): Der alte Button ordnete die Konturen des geöffneten Tabs per Referenz-Größe neu an, ohne Undo und ohne Plan; Autonest ersetzt ihn (Bibliotheksteile → Plan). Engine `applyPlacements` bleibt in nesting.js (API), wird aber nicht mehr verwendet
