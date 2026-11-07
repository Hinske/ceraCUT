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
