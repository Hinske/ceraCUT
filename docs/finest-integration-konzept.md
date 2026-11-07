# FINest-Funktionen in ceraCUT integrieren — Architektur- und Integrationskonzept

> Stand: 2026-11-07 · Basis: ceraCUT V7.00 (Vanilla JS/HTML5 Canvas, Node.js-Server `server.js`, Sinumerik-840D-Postprozessor, Wasserstrahl) · Referenz: 37 Screenshots `/mnt/dxf/Sonstiges/Screenshots/FINest/` (FiNest Professional, Demo-Plan PLAN_TEST082020)

**Rolle:** Senior-Architekt für CAD/CAM- und Fertigungssysteme.
**Ziel:** Die in FINest gezeigten Funktionsmodule nahtlos in ceraCUT einbinden, ohne Build-Tool/Framework einzuführen (siehe CLAUDE.md: Vanilla JS, kein Bundler) und unter Beachtung der Pflicht-Regeln (Versions-Bump, `?v=`, `TOOL_TOOLTIPS`, Undo über Command-Pattern, Push).

---

## 0. Ausgangslage: was ceraCUT schon hat

| FINest-Funktion | Vorhanden in ceraCUT | Lücke |
|---|---|---|
| DXF-Import (Mehrfach, Layer-Auswahl, "Model space only") | `dxf-parser.js`, `dxf-browser.js`, 6-Step-Wizard (ein Teil/Datei) | Mehrfachimport als **Teile-Batch** mit Status/Qty/Order; Layer-Dialog; persistente Teilebibliothek |
| Blechbibliothek | nur Brutto-Platte im Wizard / `nesting.js` `sheetWidth/Height` | Blech-DB (Rest-/Standardbleche, Bestand, Gewicht) |
| Autonest | `nesting.js` V1.2: BLF + NFP, Multi-Rotation, Multi-Sheet | Prioritäten, Spiegeln, Nesting-Reihenfolge, Innenkontur-Belegung, True-Shape (Roadmap) |
| Manuelles Nesting | Move/Rotate/Mirror/Copy, Array-Tools in `drawing-tools.js`/`advanced-tools.js` | Nesting-Kontext (Teil-Instanzen, Snap an Blechrand, Mindestabstand-Check, Array-Tool für Instanzen) |
| Multifenster | `document-manager.js` (Tabs, IndexedDB) | Kachel-/Split-Ansicht mehrerer Pläne |
| Simulation | `toolpath-simulator.js` V1.5 (Verifikation, Animation, Kollisionsmatrix) | NC-Zeilen-Sync (Code-Liste ↔ Bahn), Skip/Pause/Next, Feed-Regler |
| NC-Generator | `sinumerik-postprocessor.js` V2.9 (MPF), `/api/cnc/save` | NC-Editor, Programmnummern, Werkzeugfolge, Werkstattbericht |
| In-Place-CAD | `drawing-tools*.js`, `text-tool.js`, `document-manager.js` | Teil in Plan editieren + **Update-Propagation** (nur dieses / gleiche Transformation / alle verwandten) |
| Auftragsbibliothek | – (nur Dateisystem via `dxf-browser.js`) | Orders-DB mit Suche/Filter/Vorschau |
| Technologie-DB | `cerajet-engine.js` (MATERIALS, NOZZLES, Q_FACTORS), `lead-profiles.js` (8 Built-in), `machine-profiles.js`, `bridge-cutting.js`, `quality-zones.js` | Zentrale, dickenspezifische Technologie-Records inkl. Lead/Mikroverbindung/Kerf/Rounding |
| Kalkulation | `cost-calculator.js` V1.3 | Aufschlüsselung Fertigung/Material/Verbrauch/Zusatz, Teile-Einzelpreise |
| PDF-Bericht | Roadmap: PDF-Rüstblatt; `svg-print` (Ordner in /root) | PDF-Export Kalkulation + WP-Report |

**Architekturprinzip:** Frontend-Module bleiben IIFE/Klassen-Globals (`const X = (() => {...})()`); neue Persistenz läuft über **Server-API + JSON-Dateien** (analog `data/users.json`, `lib/user-store.js`), mit IndexedDB nur als Offline-Cache. Keine DB-Engine nötig; bei Wachstum (>10k Teile) Wechsel auf SQLite (`better-sqlite3`) hinter derselben Store-Schnittstelle.

---

## 1. Funktionsmodule (angepasst an ceraCUT)

### 1.1 Teileimport & Material-Management  → neues Modul `part-library.js`, `sheet-library.js`
- **Import-Dialog „DXF-Teileimport“** (FINest 081146): Mehrfachauswahl (Datei-Dialog **und** `dxf-browser.js`), Dropdowns *Maschine / Material / Technologie / Dicke* (aus `machine-profiles.js` + `CeraJetEngine.MATERIALS`), Tabelle *Status · Vorschau · Datei · Name · Auftrag · Stückzahl*, Summenzeile (Total/Ready/Warnings/Errors/Saved), Layer-Auswahl mit Farbe, Aktionen *Revalidieren · Im CAD bearbeiten · Teile erzeugen · Speichern & Hinzufügen · Nur hinzufügen*.
- Validierung nutzt vorhandene Pipeline (`ceracut-pipeline.js` Validation Engine, Topologie disc/hole/slit, MicroHealing).
- **„Make-Part-Settings“** (FINest 081840): Voreinstellungen pro Teil/Technologie – Qualität, Piercing, Schnittrichtung (CW/CCW), Lead-In/Out-Typ + Länge + Überschnitt getrennt für Außen-/Innenkonturen; Optionen *Geometrie bereinigen*, *Elemente reduzieren*, *Ursprung unten-links*, *Lead-Länge automatisch reduzieren*, *Lead-In vom Kreismittelpunkt*, *Kollisionen vermeiden*, *vorhandene Leads/Reihenfolge/Mikroverbindungen beibehalten*. Abbildung auf `CamContour` (Lead-Metadaten, `leadManualOverride`) und `lead-profiles.js`.
- **Blechbibliothek:** Filter (Typ, Material, Dicke, Breite, Länge, Rest ja/nein), Spalten *Name · Material · Dicke · Verfügbar · Menge · B · L · Gewicht · Fläche*, Excel/Druck/Edit-Modus. Gewicht = B·L·t·ρ aus Technologie (`specificWeight`).
- **Fliesen-Spezifik (Cerasell):** Material-Kategorie „Stein“ (Fliesen Keramik/Feinsteinzeug/Naturstein) bleibt Standard; `tile-layout.js`/`mosaic-generator.js` können Teile direkt in die Teilebibliothek schreiben.

### 1.2 Nesting-Engine (Auto & Manuell)  → `nesting.js` erweitern (V1.3+), neu `nesting-session.js`
- **Autonest-Dialog** (081213): Teileliste mit *Fortschritt (genestet/Soll)*, *erlaubte Winkel* („frei drehen“, feste Winkel), *Spiegeln (nicht erlaubt/erlaubt)*, *Priorität*; Blechliste (neu/laden/entfernen, Verbrauch/Rest); Abstände *Teil–Teil* / *Teil–Rand*; *Reihenfolge* (große/kleine zuerst/Standard); *Teile in Innenkontur platzieren* (erlauben/verhindern/nach Größe); *Rechteck-Optimierung*; *Plan speichern*.
  - Mapping: `DEFAULT_CONFIG.spacing` → `partToPart`, `sheetMargin` → `partToEdge`; `rotationSteps` pro Teil; neue Felder `priority`, `mirror`, `order`, `innerPlacement`.
  - Innenkontur-Belegung = True-Shape-Roadmap (Restgitter-Holes) – Phase 2b.
- **Manueller Modus** (082054–082115): Nesting-Kontextband „Auswahl“ (Bearbeiten, Entfernen, Winkelschritt, ±45/±90/180, Spiegeln, X/Y-Position, Schneidköpfe min/max + Abstand); Statuszeile „Verschieben · R: Rotation 45° · M: Spiegeln“. Teil-Instanzen referenzieren Teilebibliothek (`partId`), Transformation als Matrix `{tx,ty,rot,mirror}`. **Rechteck-Array** (Zeilen/Spalten/Abstand) und *Duplizieren*, *Bottom-Left-Nest* (vorhandener BLF).
- **Schneidköpfe:** Multi-Head ist im Postprozessor vorhanden → Nesting-Option `heads: {min,max,distance}`.
- **Multifenster** (082127): `document-manager.js` erhält Layout-Modus `tile2x2 | splitH | splitV | tabs`; je Fenster eigener `CanvasRenderer`; Plan-Vergleich per synchronisiertem Zoom (optional).
- **Plan-Speichern-Dialog** (081239): Länge/Breite, Nettofläche/-gewicht, Rechteckfläche/-gewicht, Planname, Fälligkeitsdatum, NC-Flag, Löschen erlaubt, Menge, Kommentar, Material, Dicke, Maschine; „letzte Eingabe laden“.
- **Rest- und Schnittoptimierung** (Nesting-Band 081216): Rest erzeugen (auto/manuell → Blechbibliothek mit `remnant:true`), Chain Cut (gemeinsame Schnitte), Brücken/Auto-Brücken (`bridge-cutting.js`), Teile auflösen, Abstand messen, Nesting validieren.

### 1.3 CAM-Simulation & NC-Code  → `toolpath-simulator.js`, `sinumerik-postprocessor.js`, neu `nc-editor.js`
- **Simulation** (081250): Split-View *NC-Zeilenliste (G00/G01/G02/G03, F)* ↔ *Bahnansicht*; Auswahl einer Zeile hebt Segment hervor und umgekehrt (`_buildAnimationSegments` liefert bereits Segmente → Feld `ncLine` ergänzen); Steuerung *Skip · Pause · Next · Stop*, Vorschub-Regler; Eilgang magenta (wie WP-Report).
- **„NC erstellen“-Dialog** (081319): Name, Entnahmeposition, Programmnummer, Verzeichnis; Tabs *Ausgabeparameter · Werkzeugfolge · Programmnummern*; Schalter *NC bearbeiten* (öffnet NC-Editor), *WP-Daten* (Vorschau/Ausgabe), *Plot*, *Etiketten* (Teile/Reste beschriften); *Auf alle anwenden*.
- **NC-Editor:** Monospace-Editor mit Zeilennummern, Syntax-Highlight für Sinumerik (G/M/R-Parameter), Validierung der Einzelbefehle (Safety-Guards des PP), „Zeile in Simulation anzeigen“. Speichern über `/api/cnc/save`.
- **Werkstattbericht (WP-Report)** (081331/081335): Kopf (Plan, Maschine, Datum), Plan-Info, Blech-Info (X/Y max, Gesamtzeit), Werkzeuge, Kommentar, Planbild; Seite 2: je Teil Name, Auftrag, Menge, dx/dy, Netto-/Rechteckgewicht, Piercings, Schnittlänge.

### 1.4 In-Place-CAD-Editor & Auftragsverwaltung  → `order-library.js`, `inplace-edit.js`
- Rechtsklick auf genestetes Teil → **„Teil bearbeiten“** (am Originalort / an transformierter Position, 081445) → öffnet Teil in neuem Tab (vorhandene Drawing-Tools, Text-Tool für Beschriftung/Markierung). Beim Schließen **Update-Dialog** (081504):
  1. nur das bearbeitete Teil
  2. Teile mit gleicher Transformation
  3. alle verwandten Teile (gleiche `partId`) — Standard
  Umsetzung: Teil-Geometrie ist in der Bibliothek einmal gespeichert (`partRevision` hochzählen); Instanzen lösen nur die Transformation auf → Massenupdate = Revision ersetzen, Einzelupdate = Instanz bekommt Kopie (`partId` neu, `derivedFrom`). Undo als **ein** Group-Command (`beginGroup/endGroup`).
- **Auftragsbibliothek** (081521): Quick-Access/Advanced-Filter (Status mit/ohne Geometrie, Kunde, Maschine, Material, Dicke), Volltext (enthält/gleich/beginnt/endet, UND/ODER), Treffer mit Vorschau (aus `part.thumbnailSvg`), Aktionen Kopieren/Neu/Speichern/Löschen/Öffnen, **Export XML/DXF/Excel/Druck**. Anbindung an `dxf-browser.js` (Server-Pfade).
- Shortcuts/„Zu Benutzermenü hinzufügen“ (081940): optional, per-User in `users.json` → `prefs.shortcuts`.

### 1.5 Technologiedatenbank & Schneidparameter  → `technology-db.js` (baut auf `cerajet-engine.js` auf)
- Baumstruktur **Material → Dicke → Technologie** (081918). Reiter: *Allgemein* (Name, Material, Zerspanbarkeit/`akz`, Dicke, spez. Gewicht, Default-Lead In/Out innen/außen mit Typ + Länge + Überschnitt, Kerf, Z-Höhe nach Schnitt, automatisches Verrunden: Radius/Referenzwinkel/Toleranz), *Lead-In/Out*, *Mikroverbindungen*, *Schnittbedingungen*, *Schnittparameter*, *Nesting*, *Sonstiges* (Mindestabstand Piercings, Mindestfläche „große“ Innenkontur, Werkzeug für Kreise nach Durchmesser, Kantenschnitt: Testpunkt/Überschnitt/Höhenkontrolle), *Kostenkalkulation*, *Maschinenspezifisch*.
- **Wasserstrahl-Mapping (statt Laser/Plasma):** Schnittparameter = `CeraJetEngine.calculate({material, h, quality, nozzle, P, d_a, m_a})` → Vorschub, Ramping (`CORNER_FACTOR`), Piercing-Typ (`getPierceType`), Abrasivfluss, Pumpendruck; Werte aus der DB überschreiben die Formel-Defaults (`overrides`). Laser-/Gas-Parameter entfallen oder erscheinen als „Verbrauchsmaterial“ (Abrasiv, Düse, Fokussierrohr, Strom, Wasser).
- Lead-Typen: die 8 Built-in-Profile aus `lead-profiles.js` bleiben; FINest-Nummerierung (01…08, „07 linear“) als Anzeigename-Mapping. Waricam-Referenz (45°/3 mm/Überschnitt 3 mm/Lead-Out 1 mm senkrecht) als Default-Profil „Waricam“ — siehe `tasks/waricam-angleichung.md`.
- Auflösung: `Technology.resolve(machineId, materialId, thickness)` → nächstgelegener Datensatz (exakt → nächste Dicke → Material-Default).
- Schnittrichtung (CW/CCW), Qualität (1–5 = `Q_NAMES`), Mikroverbindungen (`microJoint {count,width,pos}`), Kerf werden pro Kontur über Pipeline + `PropertyChangeCommand` gesetzt.

### 1.6 Kalkulation & Bericht  → `cost-calculator.js` erweitern (V2.0), neu `report-pdf.js`
- Eingangsgrößen (081354): Material, spez. Gewicht, Blechmaß, Teileanzahl, **Piercings**, **Schnittlänge**, **Eilganglänge**, Markierlänge. Aus Toolpath-Simulator-Statistik (`_calculateStats`) und Pipeline.
- Blöcke mit Ein-/Ausschaltbox (wie FINest):
  - **Fertigung:** Schneiden (Zeit × Maschinenstundensatz), Eilgang, Piercing, Markieren/Bohren/Fräsen
  - **Material:** Blechgewicht × Preis/kg bzw. Blechpreis; Verschnitt (Gewicht + Kosten); Restblech-Gutschrift
  - **Verbrauch (Wasserstrahl):** Strom, Wasser, Abrasiv (g/min aus `m_a` × Zeit), Düse/Fokussierrohr/Dichtungen (Standzeitanteil)
  - **Zusatz:** Piercing-Zuschlag, Rüsten, NC-Programmierung, Entgraten, Arbeit (optional)
  - Gesamtzeit + Gesamtkosten, Balkendiagramm; Kosten je Teil (Stückpreis, Gesamt) über Anteil an Schnittlänge/Piercings/Fläche.
- **PDF-Export:** „Nesting-Kalkulation“ (Kostenübersicht, technische Daten, Zeit/Gewicht, Teileübersicht mit Bild/Menge/Fläche/Schnittzeit/Maße) und **WP-Report/Rüstblatt** (Nullpunkt, Brutto-Platte, Laufzeit, Piercings). Technik: serverseitig via `pdfkit` (Node, nur eine Dependency) **oder** Browser-Druck (`window.print` mit `@media print`, vgl. `svg-print`). Empfehlung: **pdfkit im Server** (reproduzierbar, Teil-/Plan-SVG wird als Vektor eingebettet).

---

## 2. API- & Datenarchitektur

### 2.1 Schemas (JSON, Dateien unter `data/`; Einheit mm, Winkel Grad)

```jsonc
// data/parts/<partId>.json  — Teilebibliothek
{
  "partId": "P-000123", "revision": 3,
  "name": "KOMM-0005-2", "orderId": "O-KOMM-0005-2", "customer": "Heide",
  "source": { "file": "KOMM-0005.dxf", "importedAt": "2026-11-07T08:12:00Z", "layers": ["0","TEXT"] },
  "technologyRef": { "machineId": "cerajet-1", "materialId": 21, "thickness": 10, "technologyId": "T-21-10" },
  "geometry": {
    "contours": [ { "id": "c1", "role": "disc|hole|slit|ref|text", "closed": true,
                    "points": [[0,0],[258.82,0]], "arcs": [ { "seg": 0, "cx":0,"cy":0,"r":5,"ccw":true } ] } ],
    "bbox": { "w": 258.82, "l": 130.0 },
    "netArea": 0.0336, "rectArea": 0.0336, "cutLength": 0.83, "piercings": 2
  },
  "cam": { "contourOverrides": { "c1": { "quality": 3, "dir": "CW",
            "leadIn": { "profile": "waricam", "type": "linear", "length": 9, "angle": 45 },
            "leadOut": { "type": "perp", "length": 1 }, "overcut": 3,
            "microJoints": { "count": 2, "width": 1.0 } } } },
  "thumbnailSvg": "<svg…/>", "status": "ready|warning|error", "warnings": []
}
```

```jsonc
// data/sheets.json  — Blechbibliothek
[ { "sheetId": "S-ALU-10-3000x1500", "name": "ALUMINIUM_10mm_3000x1500", "materialId": 5,
    "thickness": 10, "width": 1500, "length": 3000, "stock": 4, "available": 3,
    "remnant": false, "weightKg": 121.5, "pricePerSheet": 0, "contour": null } ]
// Restblech: remnant:true, contour = Polygon (nicht-rechteckig)
```

```jsonc
// data/plans/<planId>.json  — Schachtelplan
{
  "planId": "PLAN_TEST082020", "version": 7, "machineId": "cerajet-1", "materialId": 21,
  "thickness": 10, "dueDate": "2026-11-20", "ncAllowed": true, "deleteAllowed": true, "comment": "",
  "sheet": { "sheetId": "S-ALU-10-3000x1500", "width": 3000, "length": 1500 },
  "config": { "partToPart": 10, "partToEdge": 10, "order": "large-first", "innerPlacement": "by-size",
              "heads": { "min": 1, "max": 1, "distance": 0 }, "rectOptimize": false },
  "instances": [ { "instId": "i1", "partId": "P-000123", "revision": 3,
                   "tx": 100, "ty": 50, "rot": 90, "mirror": false, "derivedFrom": null } ],
  "demand": { "P-000123": { "qty": 50, "priority": "high", "angles": "free", "mirror": false } },
  "cutOrder": ["i3","i1"], "remnants": [ { "polygon": [[0,0],[…]] } ],
  "stats": { "nested": 130, "surfaceNet": 3.04, "weightNet": 82.17, "cutLength": 125.97,
             "rapidLength": 74.47, "piercings": 1062, "time": { "cut": 13347, "pierce": 1486, "total": 18156 } },
  "nc": { "program": 4711, "file": "PLAN_TEST082020.MPF", "createdAt": null }
}
```

```jsonc
// data/technology.json  — Technologiedatenbank (Material → Dicke → Technologie)
{ "materials": [ { "materialId": 21, "name": "Fliesen (Feinsteinzeug)", "cat": "Stein",
                    "specificWeight": 2.4, "pricePerKg": 0.0, "machinability": 200, "bkz": 75, "akz": 200 } ],
  "technologies": [ {
    "technologyId": "T-21-10", "materialId": 21, "thickness": 10, "machineId": "cerajet-1",
    "general": { "kerf": 0.8, "zAfterCut": 40,
                 "leadDefault": { "outer": { "type": "straight", "in": 9, "out": 0, "overcut": 0 },
                                   "inner": { "type": "linear",   "in": 9, "out": 0, "overcut": 0 } },
                 "rounding": { "radius": 0.5, "refAngle": 75, "tol": 75 } },
    "microJoints": { "enabled": false, "count": 2, "width": 1.0 },
    "cutting": { "quality": 3, "nozzleId": 4, "pressure": 2900, "abrasiveRate": 200,
                 "feedOverride": null, "cornerFactor": 0.333, "pierceType": "auto" },
    "nesting": { "partToPart": 10, "partToEdge": 10, "rotations": [0,90,180,270] },
    "misc": { "minPierceClearance": 10, "bigInnerAreaCm2": 5000,
              "circleTools": [ { "tool": "drill", "dMin": 0.1, "dMax": 2.299 } ] },
    "cost": { "machineRatePerH": 0, "abrasivePerKg": 0, "nozzleLifeH": 0, "nozzlePrice": 0,
              "powerKw": 0, "waterPerH": 0, "setupMin": 0, "ncProgMin": 0, "laborPerH": 0 }
  } ] }
```

```jsonc
// data/orders.json  — Aufträge (Index; Geometrie liegt in parts/)
[ { "orderId": "O-KOMM-0005-2", "partId": "P-000123", "customer": "Heide", "commission": "KOMM-0005",
    "machineId": "cerajet-1", "materialId": 21, "thickness": 10, "qty": 50,
    "status": "withGeometry", "created": "2026-11-07", "history": [] } ]
```

### 2.2 REST-Schnittstellen (Erweiterung von `server.js`; Auth/Session-Gating wie `/api/dxf/*`)

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/parts/import` | Batch (Metadaten + DXF base64); Server validiert optional, speichert, liefert Status je Datei |
| GET/POST/DELETE | `/api/parts`, `/api/parts/:id` | Teilebibliothek; `?q=&order=&customer=&machine=&material=&thickness=&limit=` |
| GET | `/api/parts/:id/dxf` · POST `/api/parts/:id/revision` | DXF-Export; neue Revision (In-Place-Update) |
| GET/POST/PUT/DELETE | `/api/sheets`, `/api/sheets/:id` | Blechbibliothek |
| GET/POST/PUT/DELETE | `/api/plans`, `/api/plans/:id` | Schachtelpläne (`If-Match: version` gegen Überschreiben) |
| POST | `/api/plans/:id/update-parts` | `{partId, mode: "single\|sameTransform\|allRelated"}` |
| GET/POST/PUT/DELETE | `/api/orders` | Auftragsbibliothek, Filter wie oben; `GET /api/orders/export?fmt=xml\|dxf\|xlsx` |
| GET/PUT | `/api/technology`, `/api/technology/resolve?machine=&material=&thickness=` | Technologiedatenbank; `resolve` liefert wirksamen Datensatz |
| POST | `/api/nc/generate` (Plan → MPF-Text) · existierend `/api/cnc/save` | Generierung ist clientseitig (PP), Server nur speichern/Programmnummer vergeben (`/api/nc/next-program-no`) |
| POST | `/api/reports/cost-pdf` · `/api/reports/wp-pdf` | PDF-Erzeugung (pdfkit); Body = Plan-ID oder Plan-JSON, Antwort `application/pdf` |

Client-Bibliotheks-API (kein Netzwerkzwang, offline via IndexedDB-Cache):

```
PartLibrary.import(files, techRef, opts) → ImportResult[]
PartLibrary.search(filter) / get(id) / saveRevision(part)
SheetLibrary.search / get / consume(sheetId, qty) / addRemnant(polygon)
Technology.resolve(machineId, materialId, thickness) → TechnologyRecord
NestingEngine.run(plan, {onProgress, signal}) → NestResult      // Autonest
NestingSession.place/move/rotate/mirror/array(...)                // manuell, Command-Pattern
CostCalculator.calculate(plan, tech, opts) → CostBreakdown
ReportPdf.cost(plan) / ReportPdf.workshop(plan) → Blob
```

---

## 3. Integrations-Phasenplan

| Phase | Inhalt | Ergebnis / Abnahme |
|---|---|---|
| **0 – Abstimmung** | Datenmodell mit Praxis (Cerasell) abstimmen; Koordinatenkonflikt 90° klären (bleibt offen laut Roadmap) | freigegebene Schemas |
| **1 – Datenhaltung & Import** (1.1, 1.5-Kern) | `lib/store.js` (JSON-Store mit Locking), APIs `parts/sheets/technology/orders`; Import-Dialog + Make-Part-Settings; Technologie-Manager (Allgemein, Lead, Misc); `Technology.resolve` an Pipeline/PP anbinden | 6 DXFs importieren, als Teile mit Qty/Order speichern, Leads aus Technologie sichtbar; Tests in `tests/` |
| **2a – Nesting Auto** | Plan-Schema, Autonest-Dialog, Prioritäten/Spiegeln/Reihenfolge, Multi-Sheet, Plan-Speichern | Plan mit ≥100 Instanzen < Zeitbudget; Ergebnis reproduzierbar |
| **2b – Nesting manuell + Multifenster** | `nesting-session.js`, Selektionsband, Rechteck-Array, Mindestabstand-Check, Kachelansicht | Drag/Rotation/Array mit Undo; 2×2-Kacheln |
| **2c – True-Shape / Innenkonturen** | NFP mit Restgitter-Holes, Chain-Cut/Brücken | Kleinteile in Ausschnitten; Platzgewinn messbar |
| **3 – CAM-Simulation & NC** | Simulator-Split-View mit NC-Zeilen, Steuerung, `nc-editor.js`, NC-Erstellen-Dialog, Programmnummern, Werkzeugfolge | NC bearbeitbar, Zeile↔Bahn synchron, Export via `/api/cnc/save`; **Praxis-Test auf Maschine** (Kollisionsprüfung) |
| **4 – In-Place-CAD & Aufträge** | `inplace-edit.js`, Update-Dialog (3 Modi), Auftragsbibliothek | Textmarkierung ändern → Einzel- und Massenupdate, Undo als Gruppe |
| **5 – Kalkulation & Berichte** | `cost-calculator` V2.0 mit Technologie-Kostenblock, Teil-Einzelpreise, `pdfkit`-Reports (Kalkulation, WP-Report/Rüstblatt) | Kalkulation gegen reale CeraJet-Daten kalibriert; PDF vollständig |
| **6 – Härtung** | Rechte (Rolle `admin` für Technologie/Preise), Backup der `data/`-Dateien, Performance (500+ Konturen), Techdebt-Sweep, CLAUDE.md-Update | Grill-Review, `sync-versions.js --check` grün |

Querschnitt je Phase: Versions-Bump + `?v=` + `build-info.js`, `TOOL_TOOLTIPS`/Shortcuts für neue Tools, `tasks/lessons.md` bei Korrekturen, Push nach jeder Änderung.

---

## 4. Code-Skelette (Pseudo-Code, ceraCUT-Stil)

### 4.1 Datenfluss DXF → NC

```js
// 1) Import
async function importParts(files, techRef, opts) {
  const results = [];
  for (const f of files) {
    const ents  = DXFParser.parse(await f.text(), { modelSpaceOnly: opts.modelSpaceOnly,
                                                     layers: opts.layers });
    const cont  = CeraCutPipeline.buildContours(ents);        // chainContours → CamContour[]
    const issues = CeraCutPipeline.validate(cont);            // Warnings/Errors → Status
    const tech  = Technology.resolve(techRef.machineId, techRef.materialId, techRef.thickness);
    applyMakePartSettings(cont, tech, opts.makePartSettings); // Lead, Richtung, Qualität, Rounding
    results.push(PartLibrary.toRecord(f.name, cont, tech, issues, opts));
  }
  return results;                                              // UI zeigt Status; "Speichern" → POST /api/parts/import
}

// 2) Nesting (Autonest)
async function autoNest(plan, signal) {
  const tech   = Technology.resolve(plan.machineId, plan.materialId, plan.thickness);
  const demand = Object.entries(plan.demand).map(([partId, d]) => ({
      part: PartLibrary.get(partId), qty: d.qty, priority: d.priority,
      rotations: d.angles === 'free' ? stepAngles(tech.nesting.rotations) : d.angles,
      mirror: d.mirror }));
  const cfg = { ...NestingEngine.DEFAULT_CONFIG, ...plan.config, ...tech.nesting };
  const sheets = plan.sheets.map(SheetLibrary.get);
  return NestingEngine.run({ demand, sheets, cfg }, { signal, onProgress: ui.progress });
  // → { placements:[{partId,sheetIdx,tx,ty,rot,mirror}], unplaced:[], stats }
}

// 3) CAM + NC
function buildNc(plan, opts) {
  const contours = PlanBuilder.instantiate(plan);               // Instanzen → CamContour mit Transformation
  CeraCutPipeline.applyKerfAndLeads(contours, plan);            // Leads gegen Nachbarn prüfen (Kollision)
  plan.cutOrder = opts.manualOrder ?? CutSequencer.tsp(contours); // TSP, Inside-Out
  const verify = ToolpathSimulator.verify(contours, plan.cutOrder, { bounds: plan.sheet });
  if (verify.errors.length) throw new ValidationError(verify);
  const nc = SinumerikPostprocessor.generate(contours, plan.cutOrder, {
        machine: MachineProfiles.get(plan.machineId), program: opts.programNo,
        technology: Technology.resolve(...), toolSequence: opts.toolSequence });
  return { nc, lineMap: nc.lineMap /* NC-Zeile → Segment, für Simulator/Editor */, stats: verify.stats };
}
```

### 4.2 Manuelles Nesting mit Undo

```js
class NestingSession {
  constructor(plan, undo) { this.plan = plan; this.undo = undo; }
  move(instIds, dx, dy)  { return this._tx(instIds, i => ({ tx: i.tx + dx, ty: i.ty + dy })); }
  rotate(instIds, deg)   { return this._tx(instIds, i => ({ rot: (i.rot + deg) % 360 })); }
  array(instId, rows, cols, dx, dy) {
    this.undo.beginGroup('Array');
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
      if (r || c) this.undo.execute(new AddInstanceCommand(this.plan, cloneInst(instId, c * dx, r * dy)));
    this.undo.endGroup();
  }
  _tx(ids, fn) {
    const snaps = ids.map(id => ({ id, old: pick(this.plan.inst(id)) }));
    ids.forEach(id => Object.assign(this.plan.inst(id), fn(this.plan.inst(id))));
    this.undo.undoStack.push(new FunctionCommand('Nesting', redo(snaps), undo(snaps))); // Aktion schon ausgeführt
    NestingChecks.minDistance(this.plan);          // Teil–Teil / Teil–Rand, rot markieren
  }
}
```

### 4.3 In-Place-Update

```js
async function closePartEditor(editedPart, mode /* single | sameTransform | allRelated */) {
  const rev = await PartLibrary.saveRevision(editedPart);       // revision+1
  undo.beginGroup('Teil aktualisieren');
  for (const inst of plan.instances) {
    if (mode === 'allRelated'    && inst.partId === editedPart.partId)         inst.revision = rev;
    if (mode === 'sameTransform' && sameTransform(inst, editedInst))           inst.revision = rev;
    if (mode === 'single'        && inst.instId === editedInst.instId) { inst.partId = forkPart(editedPart); inst.derivedFrom = editedPart.partId; }
  }
  undo.endGroup();
  PlanBuilder.invalidateCaches(plan);  // ModificationTool.invalidateCache je Kontur
}
```

### 4.4 Kalkulation

```js
function calculate(plan, tech, opts) {
  const s = plan.stats, c = tech.cost;
  const tCut = s.cutLength / feedAvg(tech), tRapid = s.rapidLength / rapidFeed, tPierce = s.piercings * pierceTime(tech);
  const manufacturing = (tCut + tRapid + tPierce) / 3600 * c.machineRatePerH;
  const material = sheetWeight(plan) * mat.pricePerKg - remnantCredit(plan);
  const consumable = abrasiveKg(tech, tCut + tPierce) * c.abrasivePerKg + wear(c.nozzleLifeH, c.nozzlePrice, tCut) + power(c, tCut) + water(c, tCut);
  const additional = opts.labor ? (c.setupMin + c.ncProgMin) / 60 * c.laborPerH + laborCost(plan) : 0;
  const perPart = splitCostByShare(plan, { cutLength: .6, piercings: .2, area: .2 });
  return { manufacturing, material, consumable, additional, total: sum(...), time: {...}, perPart };
}
```

---

## 5. Risiken & offene Punkte

- **Nesting-Qualität:** BLF + Bounding-Box reicht für Fliesen/Rechtecke; Innenkontur-Belegung braucht True-Shape (Phase 2c, höchstes Risiko).
- **Kalibrierung:** `cost-calculator` und `cerajet-engine` müssen mit realen Maschinen-/Preisdaten abgeglichen werden (FINest-Zahlen sind Laser-Demo: Gas/Linsen entfallen).
- **Nicht in den Screenshots sichtbar:** Inhalte der Technology-Reiter *Microjoints, Cutting Conditions, Cutting Parameters*; hier eigenes Design nötig (Mikroverbindungen: ceraCUT hat `MicroJoints` im Schritt 4).
- **Nebenläufigkeit:** Mehrere Benutzer schreiben Pläne/Technologie → `version`/`If-Match` und Datei-Locking im Store.
- **Koordinatensystem:** bleibt separat (laut Memory „fein“, nicht erneut aufmachen).
- **Lizenz/Urheberrecht:** FINest dient nur als funktionale Referenz; Oberfläche und Texte nicht kopieren, eigene Gestaltung im ceraCUT-Dark-Theme.
