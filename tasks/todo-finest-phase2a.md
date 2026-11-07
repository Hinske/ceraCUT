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

## Offen
- [ ] Geöffneter Plan ist ein normaler DXF-Tab: Änderungen am Plan (Verschieben im Tab) werden nicht in den Plan zurückgeschrieben; Teile-Update (In-Place-Edit, Phase 4) braucht echte Instanzbindung
- [ ] Beim Öffnen gehen Löcher/Stückzahl-Zuordnung (Teilename je Kontur) nicht in den Tab ein — Konturnamen sind generisch
- [ ] Spiegeln erlauben (Engine kennt es nicht), `innerPlacement` (True-Shape) → Phase 2c
- [ ] Autonest im Web-Worker (UI friert bei sehr großen Mengen kurz ein)
- [ ] Plan-Speichern-Dialog laut FINest (Fälligkeit, Kommentar, Menge, NC-Flag)
- [ ] Blechbibliothek-UI + Anbindung (siehe oben)
- [ ] Bestehender Button „Nesting“ (btn-nesting in `index.html`) übergibt falsche Config-Keys (`width/height/margin/gap` statt `sheetWidth/sheetHeight/sheetMargin/spacing`) und liest `result.utilization` (heißt `totalUtilization`) → Abstand/Blech wirkungslos; mit Autonest zusammenführen oder fixen
