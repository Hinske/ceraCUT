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

## Offen
- [ ] Geöffneter Plan ist ein normaler DXF-Tab: Änderungen am Plan (Verschieben im Tab) werden nicht in den Plan zurückgeschrieben; Teile-Update (In-Place-Edit, Phase 4) braucht echte Instanzbindung
- [ ] Beim Öffnen gehen Löcher/Stückzahl-Zuordnung (Teilename je Kontur) nicht in den Tab ein — Konturnamen sind generisch
- [ ] Spiegeln erlauben (Engine kennt es nicht), `innerPlacement` (True-Shape) → Phase 2c
- [x] Autonest im Web-Worker (nesting-worker.js, siehe oben „Große Stückzahlen“)
- [ ] Plan-Speichern-Dialog laut FINest (Fälligkeit, Kommentar, Menge, NC-Flag)
- [ ] Blechbibliothek-UI + Anbindung (siehe oben)
- [x] Bestehender Button „Nesting“ (btn-nesting): falsche Config-Keys und `result.utilization` korrigiert (Phase 5, 2026-11-07); danach ENTFERNT (2026-11-07): Der alte Button ordnete die Konturen des geöffneten Tabs per Referenz-Größe neu an, ohne Undo und ohne Plan; Autonest ersetzt ihn (Bibliotheksteile → Plan). Engine `applyPlacements` bleibt in nesting.js (API), wird aber nicht mehr verwendet
