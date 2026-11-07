# FINest-Integration — Phase 1: Datenhaltung & Import

> Datum: 2026-11-07 · Status: Entwurf, wartet auf Freigabe (Phase 0/1 laut CLAUDE.md)
> Konzept: `docs/finest-integration-konzept.md`

## 1.0 Abstimmung (Phase 0)
- [ ] Schemas (parts, sheets, technology, orders) mit Praxis abstimmen
- [ ] Entscheidung: JSON-Dateien (Start) vs. SQLite
- [ ] Entscheidung: PDF per `pdfkit` (Phase 5) — neue Dependency ok?

## 1.1 Server-Store
- [ ] `lib/store.js`: JSON-Store mit Atomic-Write (tmp + rename), Locking, `version`-Feld
- [ ] Verzeichnisse `data/parts/`, `data/plans/`, `data/sheets.json`, `data/technology.json`, `data/orders.json` (gitignored wie `users.json`)
- [ ] `server.js`: `/api/parts*`, `/api/sheets*`, `/api/technology*`, `/api/orders*` hinter Login-Gating; Pfad-/Header-Injection-Schutz wie bei `/api/dxf/*`
- [ ] Tests in `tests/` (CRUD, Konflikt via `If-Match`, ungültige IDs)

## 1.2 Technologie-DB (Kern)
- [ ] `js/technology-db.js`: `Technology.resolve(machine, material, thickness)` (exakt → nächste Dicke → Material-Default)
- [ ] Seed aus `CeraJetEngine.MATERIALS` / `NOZZLES`
- [ ] Reiter Allgemein, Lead-In/Out, Sonstiges im Manager-Dialog; Rolle `admin` zum Schreiben
- [ ] Pipeline/Postprozessor lesen Lead-Defaults, Kerf, Qualität aus `resolve`

## 1.3 Teileimport
- [ ] `js/part-library.js`: `import()`, `search()`, `get()`, `saveRevision()`
- [ ] Import-Dialog: Mehrfachauswahl (Dateidialog + `dxf-browser.js`), Maschine/Material/Technologie/Dicke, Tabelle Status/Datei/Name/Auftrag/Stück, Layer-Auswahl, Summenzeile
- [ ] Make-Part-Settings (Lead außen/innen, Richtung, Qualität, Bereinigen, Ursprung unten-links)
- [ ] Validierung über `ceracut-pipeline.js`; Status ready/warning/error
- [ ] `TOOL_TOOLTIPS` / Shortcuts in `constants.js`

## 1.4 Blechbibliothek
- [ ] `js/sheet-library.js` + Dialog (Filter, Bestand, Gewicht, Rest)

## 1.5 Pflicht je Änderung (CLAUDE.md)
- [ ] `build-info.js`, Datei-Header, `?v=`, Log-Prefix, `sync-versions.js`, Commit, Push

## Abnahme
6 DXFs importieren → als Teile mit Menge/Auftrag speichern → in neuem Tab laden → Leads kommen aus der Technologie → Export unverändert.
