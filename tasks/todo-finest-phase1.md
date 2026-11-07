# FINest-Integration — Phase 1: Datenhaltung & Import

> Datum: 2026-11-07 · Status: **weitgehend umgesetzt** (Stand 2026-11-07, abgeglichen mit Code/Git); offen: Abstimmung 1.0, Pipeline-Anbindung, Blechbibliothek 1.4
> Konzept: `docs/finest-integration-konzept.md`

## 1.0 Abstimmung (Phase 0)
- [ ] Schemas (parts, sheets, technology, orders) mit Praxis abstimmen (Umsetzung steht, Praxis-Abnahme fehlt)
- [x] Entscheidung: JSON-Dateien (umgesetzt in `lib/store.js`; SQLite bleibt Option bei Bedarf)
- [x] PDF per `pdfkit` (in package.json, Phase 5 nutzt es; `npm install` auf Produktion siehe Phase 5)

## 1.1 Server-Store
- [x] `lib/store.js`: JSON-Store mit Atomic-Write (tmp + rename), Locking, `version`-Feld
- [x] Verzeichnisse `data/parts/`, `data/plans/`, `data/sheets.json`, `data/technology.json`, `data/orders.json` (gitignored wie `users.json`)
- [x] `lib/data-api.js` (in server.js eingehängt): `/api/parts*`, `/api/sheets*`, `/api/technology*`, `/api/orders*` hinter Login-Gating; Pfad-/Header-Injection-Schutz wie bei `/api/dxf/*`
- [x] Tests in `tests/` (CRUD, Konflikt via `If-Match`, ungültige IDs)

## 1.2 Technologie-DB (Kern)
- [x] `js/technology-db.js`: `Technology.resolve(machine, material, thickness)` (exakt → nächste Dicke → Material-Default)
- [x] Seed (`lib/seed.js`) aus `CeraJetEngine.MATERIALS` / `NOZZLES`
- [x] Technologie-Manager-Dialog (Reiter inkl. Kosten); Rolle `admin` zum Schreiben
- [ ] Pipeline/Postprozessor lesen Lead-Defaults, Kerf, Qualität aus `resolve` — **offen**: `resolve` wird bisher nur im Teileimport (`part-library.js`) und serverseitig (Kalkulation) genutzt, nicht von app/pipeline beim normalen Schneiden

## 1.3 Teileimport
- [x] `js/part-library.js`: `import()`, `search()`, `get()`, `saveRevision()`
- [x] Import-Dialog: Mehrfachauswahl (Dateidialog + `dxf-browser.js`), Maschine/Material/Technologie/Dicke, Tabelle Status/Datei/Name/Auftrag/Stück, Layer-Auswahl, Summenzeile
- [~] Make-Part-Settings (Umfang gegen Dialog prüfen) (Lead außen/innen, Richtung, Qualität, Bereinigen, Ursprung unten-links)
- [x] Validierung über `ceracut-pipeline.js`; Status ready/warning/error
- [~] `TOOL_TOOLTIPS` (prüfen, ob für alle neuen Ribbon-Buttons vorhanden) / Shortcuts in `constants.js`

## 1.4 Blechbibliothek
- [ ] `js/sheet-library.js` + Dialog (Filter, Bestand, Gewicht, Rest) — **offen**, nur Store/API `/api/sheets` vorhanden; Anbindung an Autonest siehe `todo-finest-phase2a.md`

## 1.5 Pflicht je Änderung (CLAUDE.md)
- [ ] `build-info.js`, Datei-Header, `?v=`, Log-Prefix, `sync-versions.js`, Commit, Push

## Abnahme
6 DXFs importieren → als Teile mit Menge/Auftrag speichern → in neuem Tab laden → Leads kommen aus der Technologie → Export unverändert.

## Nachtrag 2026-11-07
- [x] „Vom Server…" im Teileimport: `DXFBrowser.pickMany()` (Checkboxen, Auswahl über Ordner hinweg, „Alle im Ordner", 4 parallele Downloads, Rohbytes als File); Dekodierung wie beim normalen Öffnen (`PartGeometry.decodeDXF`: AC1021+ UTF-8, sonst ISO-8859-1)
- [x] Mehrfachimport skaliert (part-library V1.4): Tabelle wird beim Einlesen einmal statt je Datei gerendert (200 Dateien 26 s → 3 s, 500 → 6 s im jsdom-Test), Fortschritt „Lese Dateien …"; Speichern in Paketen (≤ 6 MB / 200 Teile je Anfrage, Server-Limit 30 MB), Status je Paket → bei Abbruch keine Duplikate beim erneuten Speichern
- Richtwerte: Datensatz je Teil ≈ 10–15 KB (einfach) bis ≈ 110 KB (feine Kunstmotive mit >5000 Punkten); Speichern ≈ 5 ms/Teil; Speicherbedarf im Browser durch die gemerkten Rohkonturen ≈ 0,05–0,3 MB je Datei
