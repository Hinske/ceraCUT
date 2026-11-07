# Duschboard-Generator — Design (Phase 1)

> **Stand:** 2026-11-07 | Vorbild: `js/mosaic-generator.js` (Zuschnitt-Generator, gleiche Integration)
> **Ziel:** Maße + Ablauf (oder Rinne) eingeben → Fugenbild wird berechnet → User passt es an → DXF mit allen Zuschnitt-Teilen.
> **Nicht Teil von V1:** Nesting auf Rohplatten (kommt später, eigener Task).

## 1. Befund aus den Kochhan-DXFs

Beispiel `Kochhan_Duschboard_1300X1000.dxf` (ca. 60 Varianten in `/mnt/dxf/Firmen/Kochhan/`):
- Layer `Fliesen`: 12 Polylinien (3–5 Ecken) + 37 Einzellinien. Das sind die Teile: Rechtecke, Trapeze, Dreiecke und Fünfecke.
- Layer `Schnitt`: 12 geschlossene Rechtecke, ca. 897 × 447 mm = Rohplatten (hier von Hand belegt).
- Die Einzellinien sind Diagonalen im 45°-ähnlichen Winkel von den Ablaufecken zu den Boardecken (Gehrung), paarweise symmetrisch.
- Teile haben ca. 2 mm Fuge zueinander (z. B. x = 53392 → 53394).
- Dateinamen enthalten teils den Ablauf (`997x997 Ablauf 124x124`) → Test-Referenz.

## 2. Eingaben (Dialog)

| Gruppe | Feld | Hinweis |
|---|---|---|
| Board | Breite X, Tiefe Y (mm) | frei; Umschalter **Außenmaß** (Teile inkl. Randfuge) oder **Fliesenfeld** (reine Fliesenfläche) |
| Fliese | Format (z. B. 600×300, 300×300, frei), **Fugenbreite (Std. 2 mm, vorab einstellbar)**, **Fliesenabstand/Teileabstand (Std. 2 mm)** | Rastermaß = Fliese + Fuge; Fuge = Einbau, Abstand = Lücke zwischen Teilen im DXF. Gehrung hat dieselbe Fuge |
| Ablauf | Typ: **Punkt** oder **Rinne** | |
| Punktablauf | Form (quadratisch/rechteckig, evtl. rund), Größe, Lage (Mitte X/Y oder Abstand von Kanten) | Std. mittig |
| Rinne | Seite (Std. kurze Seite), Rinnenbreite, Abstand zur Kante (Std. 0 = am Rand), Länge (Std. volle Seitenlänge) | |
| Schnitt | Aufmaß/Kerf, Randabstand | gleiche Defaults wie MosaicGenerator |

## 3. Geometrie-Kern (rein, ohne DOM, Node-testbar)

`js/shower-board-generator.js`, IIFE `ShowerBoardGenerator`, Funktionen:

1. `buildGrid(params)` → **Fugenbild-Modell** (siehe 4): `xLines[]`, `yLines[]` (Fugenmitten).
2. `buildSectors(params)`
   - **Punktablauf:** Board in 4 (bei außermittigem Ablauf ebenfalls 4, nur ungleich große) Trapez-Sektoren teilen. Die Teilungslinien laufen als Diagonalen von den Ablaufecken zu den Boardecken (Gehrung).
   - **Rinne:** Option `gehrung` (Std. **an**). Mit Gehrung laufen Diagonalen von den Rinnenenden zu den Boardecken der Rinnenseite, Sektoren: Mittelfeld (Teile gerade zur Rinne) + zwei Seitendreiecke/-trapeze. Ohne Gehrung: Board minus Rinnenstreifen = ein Rechteck, gerade Schnitte. Bei Rinne über volle Seitenlänge ist keine Gehrung möglich (Diagonale entartet) → Option wird deaktiviert, Hinweis im Dialog. **(Annahme, bitte prüfen)**
3. `clipPieces(grid, sectors, drainCutout)` → Teile = Zelle ∩ Sektor − Ablaufaussparung. Konvexes Polygon-Clipping (Sutherland–Hodgman) reicht, da Zellen, Sektoren und Ablauf konvex bzw. rechteckig sind. Fugen werden als Versatz der Schnittkanten um Fuge/2 erzeugt, auch entlang der Diagonalen (senkrecht zur Diagonale versetzt).
4. `validate(pieces, params)` → Warnungen: Reststreifen < Mindestbreite (Std. 30 mm), Teil kleiner als Mindestfläche, Ablauf außerhalb Board, Teil größer als Fliese.
5. `toDXF(pieces, params)` → DXF-String, Layer `Fliesen` (Farbe 160, Teile als geschlossene LWPOLYLINE) plus optional `Schnitt` (nur Boardumriss als Referenz, bis Nesting existiert). Laden über `app.loadDXFContent()` in neuen Tab, wie beim Zuschnitt.

## 4. Fugenbild anpassen (Kernanforderung)

Das Fugenbild ist kein Nebenprodukt, sondern ein **editierbares Modell**:

```
FugenModell = { xLines: [x0, x1, ...],   // Fugenmitten in Board-Koordinaten
                yLines: [y0, y1, ...],
                locked: Set<index> }       // manuell gesetzte Linien bleiben bei Neuberechnung
```

- **Automatik-Modi** (Auswahl im Dialog):
  - *Vom Ablauf ausgehend* (Std.): Raster beginnt an den Ablaufkanten, Reststreifen landen am Boardrand.
  - *Von links unten*: Raster beginnt in der Ecke, Rest rechts/oben.
  - *Symmetrisch*: Reststreifen links/rechts gleich groß.
  - *Verbandsversatz* (halber Versatz je Reihe) als Option.
- **Manuelle Anpassung in der Vorschau:**
  - Fugenlinie per Maus ziehen (Snap auf 1 mm, Eingabe numerisch möglich).
  - Linie hinzufügen/löschen (Doppelklick/Entf).
  - Tabelle mit allen Linienpositionen (X- und Y-Liste), direkt editierbar.
  - Manuell gesetzte Linien werden gesperrt; „Automatik neu“ berechnet nur die ungesperrten.
  - Undo/Redo über den bestehenden Command-Stack (`beginGroup()/endGroup()` laut Fallenliste).
- **Live-Vorschau** im Dialog (Canvas): Teile farbig, Warnungen rot (zu schmale Reststreifen), Teilezahl und Stückliste (Maße je Teiltyp).

## 5. Integration

- Ribbon CAD → Gruppe „Zuschnitt“, neuer Button + Befehl `DUSCH` (Befehlszeile).
- `TOOL_TOOLTIPS` in `constants.js` (label, tip, shortcut, group).
- Neues Script-Tag in `index.html` mit `?v=`, Eintrag in `build-info.js`, `sync-versions.js` laufen lassen (Checkliste CLAUDE.md).
- Dialog als eigene Datei `js/shower-board-dialog.js` (UI getrennt vom Kern).
- Speichern/Laden der Parameter als JSON im DXF-Dateinamen/Begleitdatei: `Duschboard_1300x1000_Ablauf124.dxf` (Namensschema wie Kochhan).

## 6. Phasen

| Phase | Inhalt | Abnahme |
|---|---|---|
| 2a | Kern: Raster + Punktablauf + 4 Sektoren + Clipping + DXF-Export, Node-Tests | Erzeugte Teile für 997×997 / Ablauf 124 stimmen mit Kochhan-DXF überein (Eckpunkte ±0,1 mm) |
| 2b | Dialog + Live-Vorschau + Automatik-Modi | Eingabe 1300×1000 liefert plausibles Bild |
| 2c | Fugenbild manuell editieren (Ziehen, Tabelle, Sperren, Undo) | Linie verschieben → Teile aktualisieren sofort |
| 2d | Rinne (kurze Seite am Rand, auch lange Seite) | Mit Kochhan-Rinnenbeispiel (falls vorhanden) abgleichen |
| 2e | Außermittiger Ablauf, rechteckiger/runder Ablauf, Validierung/Warnungen | |
| später | Nesting auf Rohplatten (Layer `Schnitt`) | eigener Task |

## 7. Tests (`tests/`)

- Flächenbilanz: Summe der Teilflächen + Fugen + Ablauf = Boardfläche (Toleranz).
- Keine Überlappung der Teile, jedes Teil konvex, Mindestabstand = Fuge.
- Regression gegen 3–4 reale Kochhan-DXFs (Teilezahl, Eckpunkte).
- Rinne: Teile enden exakt an Rinnenkante minus Fuge.

## 8. Entscheidungen (User, 2026-11-07)

- Rinne hat ebenfalls Gehrung; optional ohne.
- Gehrung läuft vom Ablauf (bzw. Rinnenende) zur Boardecke.
- Maßeingabe wahlweise Außenmaß oder Fliesenfeld.
- Fuge vorab einstellbar, Std. 2 mm; Fliesenabstand Std. 2 mm.
- V1-Ausgabe = Einbaulage, Nesting später.

## 9. Noch offen

1. Rinnen-Gehrung: Diagonalen von den Rinnenenden zu den Boardecken der Rinnenseite (siehe 3.2) – stimmt das? Ein Kochhan-Rinnenbeispiel würde es klären.
2. Sind „Fuge“ und „Fliesenabstand“ zwei getrennte Werte (Einbau-Fuge vs. Lücke im DXF) oder derselbe Wert?
3. Fliesenformate für Voreinstellungen.

## 10. Verlegemuster (V0.2, 2026-11-07)

Muster: Kreuzfuge, Verband (1/2, 1/3, 1/4, frei; Reihen- oder Spaltenversatz; Treppe oder wechselnd; gegenläufig; Startreihe), Wilder Verband (Seed), Fischgrät 90°, Korbgeflecht (ganzzahliges Seitenverhältnis), kein Raster. Dazu Ausrichtung horizontal/vertikal, Drehwinkel (45° = diagonal) und Anker (Ecken, Fliese mittig auf Ablauf, Fugenkreuz auf Ablauf, Kreuzfuge zusätzlich „ab Ablaufkante“).
Modell: Fliese = Zelle − Fuge/2 an allen Seiten, Teil = Fliese ∩ Sektor (Gehrung). Nur die achsparallele Kreuzfuge hat editierbare Fugenlinien (2c); für Verbände/Fischgrät folgt Editieren auf Reihen-/Fliesenebene.
Nicht umgesetzt: Römischer Verband (Mischformate), Fischgrät 45°-Gehrungs-Variante mit Eckfliese, Kreis-/Bogenmuster.

## 11. Fugenbild bearbeiten (V0.3, Phase 2c)

Modell `layout = { strips: 'rows'|'cols', lines[], sub[][], coupled }`: Reihen (bzw. Spalten) mit eigener Fugenliste je Reihe; Kreuzfuge ist `coupled` (Änderung gilt für alle Reihen), Verband/Zufall nicht (Fuge einer Reihe einzeln verschiebbar). Gilt für Kreuzfuge, Verband, Zufall ohne Drehung; Fischgrät/Korb/gedrehte Raster sind nur über Parameter einstellbar.
Dialog: Modi Ansicht / Fuge ziehen (Snap 1 mm) / senkrecht setzen / waagerecht setzen / Fuge löschen; Fugenlisten numerisch editierbar; Undo/Redo (Strg+Z/Y); „Fugenbild zurücksetzen“. Ändert der User Muster, Fliese, Anker, Maße usw., wird das editierte Layout verworfen (Fuge, Randfuge, Warnschwelle, Ablaufmaße/-lage behalten es). Fugen lassen sich nicht über Nachbarfugen oder die Feldkante ziehen (Mindestabstand 1 mm).
Kein Sperren/Teil-Neuberechnen: das editierte Layout gilt komplett bis zum Zurücksetzen.

## 12. Passprüfung Teil → Fliese (V0.3.2)

Jedes Teil wird geprüft, ob es in beliebiger Drehung in die vorhandene Fliese (lang × kurz, abzüglich Randabstand) passt: es gibt einen Winkel, bei dem die umschließende Box ≤ Fliesenmaß ist (beide Lagen). Damit zählt die längste Kante bei Gehrungs-/Diagonalschnitten (ein 660×10-Streifen passt, ein 670×10 nicht). Angezeigt wird das Teilemaß als kleinste Box (lang × kurz); Teile, die nicht passen, sind rot, die Statuszeile nennt Nummer und Bedarf. „Fuge löschen“ wurde entfernt (kein Anwendungsfall); Fugen lassen sich ziehen und setzen.

## 13. Automatische Rasterlage (V0.4)

Standardfliese 597×597. Anker „Automatisch“ (Standard): Der Generator probiert Rasterlagen je Achse (bündig links/rechts bzw. unten/oben, Fliese mittig, Fuge mittig, Fliesenkante an der Ablaufkante, Fliese/Fuge auf Ablaufmitte, 11 Zwischenversätze) per Koordinatenabstieg und bewertet: ganze Fliesen +100, je angeschnittene Fliese −20, schmale Reste (< Warnschwelle) −250, fast schmale (< 2× Schwelle) −40, je Teil −1. Gewählt wird die beste Lage; die Statuszeile zeigt „N Fliesen (x ganz, y geschnitten)“ und die gewählte Lage. Mit editiertem Fugenbild läuft keine Suche. Die Gehrung schneidet bei den üblichen Boardmaßen alle Fliesen (Sektoren schmaler als die Fliese), ganze Fliesen gibt es erst bei größeren Boards; die Automatik minimiert dann die Zahl der benötigten Fliesen und der schmalen Reste.

## 14. Projekte und Kunden-PDF (V0.5)

**Projekte:** Server-Ablage `data/shower-boards/<id>.json` (DocCollection, versioniert), gemeinsam für alle Benutzer, API `/api/shower/projects` (GET mit Wildcard-Filter, POST, PUT mit If-Match, DELETE nur Ersteller/Admin). Ein Projekt enthält Name, Kunde, Notiz, Vorlage-Kennzeichen („Standard-Duschboard“), den kompletten Dialogstand (alle Eingabefelder + editiertes Fugenbild) und die zuletzt gewählte PDF-Auswahl. Dialog: Projektfelder links oben, „Öffnen…“ (Liste mit Filter, ⭐ = Vorlage), „Speichern“, „Als Kopie“.
**Kunden-PDF:** Button „Kunden-PDF“ → Auswahl der Varianten (Katalog aus `variantCatalog`: Kreuzfuge, Verbände 1/2·1/3·1/4, wilder Verband, Fischgrät, Korbgeflecht, jeweils auch diagonal 45°; identische Ergebnisse werden zusammengefasst; Vorschau-Thumbnails und Fliesen-/Teilezahl je Variante) und der Angaben (für den Kunden: Gesamtmaße, Ablaufmaße, Fugenraster-Maße; intern, Standard aus: Teilenummern, Teilemaße, Gehrungswinkel, Fliesenbedarf, Hinweise). Seite: 1/2/4 Varianten je Seite, A4 quer/hoch, Farbe oder Schwarz-Weiß, Deckblatt, Fußzeile. Erzeugt serverseitig mit pdfkit (`lib/shower-pdf.js`) aus demselben Generator-Code wie die Vorschau.
Offen: Firmenlogo/Kopfzeile, Teileliste als optionale Seite, Mehrsprachigkeit.

## 15. DXF-Layer (V0.5.1)

Die Pipeline (`ceracut-pipeline.isTileOutline`, `app._groupPartsForExport`) behandelt geschlossene Konturen auf Layer „Fliese“/„Fliesen“ als **Fliesenumriss = Referenz, nie Schneidkontur**; geschnitten wird, was auf „Schnitt“ liegt. Der Export folgt dem (Kochhan_Duschboard_1000x1000.dxf, Zuschnitt-Generator): 
- Layer **Fliesen** (ACI 160): je benutzter Fliese der Umriss der **ganzen** Fliese (Rasterfliesen: tx×ty; Randzellen: ganze Fliese ab der Rasterkante, auch über die Boardkante hinaus; ohne Raster („Kein Raster“): das ganze Fliesenfeld als eine Platte).
- Layer **Schnitt** (ACI 10): die Zuschnitte (geschlossene Polylinien mit Gehrung und Fugenversatz) — nur für **geschnittene** Teile; ganze Fliesen haben nur den Umriss, nichts zu schneiden.
Jeder Zuschnitt liegt im Umriss seiner Fliese (Test). Gedrehte Raster (45°, Fischgrät diagonal) haben schräge Umrisse; die Fliesengruppierung für den Einzelteil-Export erkennt nur achsparallele Rechtecke.

## 16. PDF-Varianten nach Rasterlage (V0.6)

Im Kunden-PDF ist das **Raster** das Auswahlkriterium, nicht das Verlegemuster: Das Verlegemuster bleibt wie im Dialog, die Varianten sind die Rasterlagen — Automatisch (wenig Schnitte), Ecke links/rechts unten/oben, Fliese bzw. Fugenkreuz in Boardmitte, Fliese bzw. Fugenkreuz auf dem Ablauf, bei der Kreuzfuge zusätzlich „ab Ablaufkante“ — jeweils bei Rechteckfliesen als „Fliese liegend“ und „hochkant“. Gleiche Ergebnisse werden zusammengefasst. Andere Verlegemuster gibt es nur auf Wunsch (Haken „Zusätzlich andere Verlegemuster anbieten“). Neue Anker `bmitte`/`bfuge` auch im Dialog.

## 17. Schnitte im DXF (V0.7)

Layer **Schnitt** enthält nur noch echte Schnittkanten, als **offene Einzellinien bzw. Ketten** (keine geschlossenen Teilekonturen mehr):
- **Keine Doppelung:** Kanten eines Zuschnitts, die auf der Originalkante der Fliese liegen (Layer Fliesen), werden nicht nochmal geschnitten. Ganze Fliesen (bis auf < 1 mm² Eckanschnitt) haben nur den Umriss.
- **Ketten:** Aufeinanderfolgende Schnittkanten bleiben verbunden und werden in einem Zug geschnitten — z. B. Gehrung + Ablaufkante + Gehrung (wie Kochhan_Duschboard_1000x1000.dxf). Gerade Schnitte sind Einzellinien (LINE, 2 Punkte). Geschlossen nur, wenn ein Teil ganz im Inneren der Fliese liegt.
- **Overlap Break** (Werkzeug OB, `GeometryOps.splitAndOverlap`) auf **jeden** Schnitt, gebrochen in der **Mitte der Schneidkontur** (halbe Pfadlänge; bei der Kochhan-Platte genau Mitte der Ablaufkante): zwei Teile von außen nach innen, kurze Seite am Bruch um die Überlappung verlängert (Standard 5 mm), aussenliegende Enden um 5 mm verlängert. Einstellbar im Dialog (an/aus, Überlappung, Außenverlängerung). Schnitte unter 4 × Überlappung werden nicht gebrochen (nur Enden verlängert).
- Vorschau: rote Linien = Schnitte im DXF, ○ = Bruchstelle. Statuszeile: Anzahl Schnitte und Gesamtlänge.

## 18. Schnittketten an Ecken trennen (V0.8)

Eine Kette (verbundene Schnittkanten eines Zuschnitts) wird an jedem inneren Punkt mit **Richtungswechsel > 75°** getrennt (`eckenTrennen`, 180 = nie). Damit sind die **Diagonale**, der **waagerechte** und der **senkrechte** Schnitt je **ein eigener Schnitt** (z. B. wenn die Boardecke auf einer Fliese liegt: senkrechter Rand, waagerechter Rand, Diagonale = drei Schnitte), jeder einzeln per Overlap Break in seiner Mitte gebrochen (geschnitten von außen und von innen). Sanfte Übergänge bleiben verbunden — Gehrung → Ablaufkante (36–53°) bleibt eine Kette. Da die Teile konvex sind, liegt die Aussenverlängerung an einer getrennten Ecke immer im Abfall (außerhalb des Teils).
