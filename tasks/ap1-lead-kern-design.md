# AP1 Lead-Kern — Design (Phase 1)

> **Stand:** 2026-11-06 | Basis: Code-Analyse `cam-contour.js` V5.x, `canvas-renderer.js`, `sinumerik-postprocessor.js`, `toolpath-simulator.js`
> **Leitgedanke:** Waricam-Leads nachbauen. Was gezeichnet wird = was gefahren wird.

## 1. Befund (Ist)

**Datenfluss heute**
`CamContour.getLeadInPath()/getLeadOutPath()/getOvercutPath()` liefern ein Objekt
`{points[], piercingPoint, entryPoint, type, arcCenter, arcRadius, arcStartAngle, arcEndAngle, arcSweepCCW, hasLinePortion, shortened, isRotated, isAlternative, isFallback*}`.
Konsumenten: Renderer, Postprozessor (`sinumerik-postprocessor.js` 440/610/630/699), Simulator (`toolpath-simulator.js`, 10+ Stellen), Pipeline (587).

**Schwaechen**
1. **Zwei Wahrheiten pro Lead:** Bogen als Metadaten (Center/Winkel) *und* als 12-Punkt-Polylinie. Renderer nimmt Metadaten, Simulator/PP je nach Fall Punkte oder Metadaten. Sobald `shortened`/`rotated`, passen Metadaten nicht mehr → Polylinien-Fallback (Renderer 1783, PP 793). Genau hier sind die Arc-Flip-/Radius-0-Fehler entstanden.
2. **Parametrik statt Form:** Lead entsteht aus `leadInType/Length/Radius/Angle` plus Ecken-Sonderlogik (`cornerLeadType/Angle`, Bisektor, 60°-Schwelle) und Kuerzung. Eine feste Fahnenform (Katalog) gibt es nicht.
3. **Mutation beim Rechnen:** `getLeadInPath()` ueberschreibt temporaer `this.leadInLength/Radius` und stellt sie danach wieder her (Zeilen 603-682). Fehleranfaellig.
4. **Darstellung = Diagnose:** 7 Farben, Pierce-Formen nach Typ, Overcut/Lead-Out ohne Schnittfugenband.
5. **Overcut:** `getOvercutPath()` (ab 988) laeuft entlang der Kontur ueber den Startpunkt hinaus (positiv) bzw. zurueck (negativ), bei Ecken keiner. Wird nicht als Teil der Fahne modelliert.

## 2. Zielarchitektur

### 2.1 Neues Modul `js/lead-geometry.js` (rein, ohne DOM, ohne Contour-State)

```
LeadSegment = { kind: 'line',  p0, p1 }
            | { kind: 'arc',   p0, p1, center, radius, ccw }   // ccw = Welt-CCW (steigender Winkel)

LeadPath    = { role: 'in'|'out'|'overcut',
                segments: LeadSegment[],      // lueckenlos, p1(i) == p0(i+1)
                pierce, join,                 // Anfang / Anschluss an Kontur
                flagId, flagName,             // Katalogeintrag (AP2) oder 'param'
                status: { shortened, rotated, alternative, fallback } }   // nur Info
```

Funktionen (rein, Eingabe = Anschlusspunkt, Tangente, Normale zur Abfallseite, Parameter):
- `buildLine(...)`, `buildArc(...)`, `buildFlag(flagDef, join, tangent, normal, scale)`
- `toPolyline(path, tol)` — **einzige** Stelle, die Boegen tesselliert (fuer Kollision/Simulator)
- `length(path)`, `shorten(path, dist)` — kuerzt segmentweise **und bleibt dabei ein echter Bogen** (Radius/Mitte bleiben, nur Winkelspanne kleiner)
- `validate(path)` — Lueckenfreiheit, Tangentialitaet am Anschluss, Drehsinn

### 2.2 Anbindung ohne Big-Bang
`CamContour.getLeadInPath()` etc. bleiben als Schnittstelle bestehen und liefern weiterhin die alten Felder (`points`, `type`, ...), **zusaetzlich `segments`** aus `lead-geometry.js`. `points` wird nur noch aus `segments` abgeleitet (`toPolyline`). Dadurch:
- Alt-Konsumenten laufen unveraendert weiter.
- Renderer und PP werden einzeln auf `segments` umgestellt.
- Am Ende werden die Alt-Metadaten (`arcCenter` & Co.) entfernt.

### 2.3 Kuerzen/Rotieren/Dog-Leg/Alt-Lead (bleibt, siehe E4)
Logik bleibt, arbeitet aber auf `LeadPath` und liefert `status`-Flags. Auto-Kuerzen kuerzt Boegen als echte Boegen. Anzeige: dezentes Warn-Symbol am Pierce plus Zeile im Info-Panel, keine eigene Farbe pro Zustand.

### 2.4 Schnittfuge/Kompensation
Leads werden wie heute auf der Werkzeugmittelpunktbahn (Kerf-Offset-Polylinie, `getKerfOffsetPolyline`) berechnet. Der Renderer zeichnet zusaetzlich das Schnittfugenband (Breite = Kerf, massstaeblich) entlang Lead-In, Kontur, Lead-Out und Ueberschnitt. Damit ist im Bild erkennbar, auf welcher Seite der Abfall liegt und wo der Strahl real schneidet.

### 2.5 Ueberschnitt
Wird Teil des Austritts: eigenes `LeadPath` mit `role:'overcut'`, gleiche Darstellung wie Lead-Out (blau), mit Richtungspfeil. Regel "bei Ecken kein Overcut" bleibt.

## 3. Darstellung (Waricam-Stil)

| Element | Darstellung |
|---|---|
| Anschnitt (Lead-In) | rot, durchgezogen, Pfeil in Schneidrichtung am Anschluss |
| Ausschnitt/Ueberschnitt | blau, durchgezogen, Pfeil |
| Kontur | wie bisher (gelb/gruen je Zustand) |
| Schnittfuge | halbtransparentes Band in Kerfbreite (umschaltbar) |
| Pierce | kleiner einheitlicher Kreis, keine Formen nach Typ |
| Warnung | kleines Ausrufezeichen am Pierce bei gekuerzt/rotiert/Fallback |
| Linienstaerke | Geometrie exakt, Linie min. 1 px (Zoom-unabhaengig) |

Alle Boegen als echte `ctx.arc()` (kein Polylinien-Fallback mehr).

## 4. Umsetzungsschritte (Reihenfolge)

1. **S1 `lead-geometry.js` + Unit-Tests** (Node, ohne Browser): Linie, Bogen, tangential, Kuerzen, Validierung. *Kein Eingriff in die App.*
2. **S2 Contour-Anbindung:** `_calcLinear/_calcArc/_calcTangent*` und Out-Varianten erzeugen `segments` ueber das Modul. `points` daraus abgeleitet. Mutation von `this.leadIn*` in `getLeadInPath()` entfernen (Parameter statt State).
3. **S3 Renderer:** `drawLeadIn/Out/Overcut` auf `segments`, Farben/Pierce vereinfacht, Schnittfugenband.
4. **S4 Postprozessor:** G01/G02/G03 direkt aus `segments` (kein Sonderpfad "Arc exakt vs. Polylinie").
5. **S5 Simulator:** liest `segments`/`toPolyline`.
6. **S6 Roundtrip-Test:** MPF erzeugen → G-Code zurueck in Geometrie → mit gezeichneten `segments` vergleichen (Toleranz 0,001 mm), fuer Testteile Rechteck, Ausschnitt, Kreis, L-Form, jeweils aussen/innen.
7. **S7 Aufraeumen:** Alt-Felder entfernen, Pflicht-Checkliste aus CLAUDE.md (build-info, Header, `?v=`, sync-versions, lessons).

Danach AP2 (Katalog) setzt direkt auf `buildFlag()` auf.

## 5. Offene Punkte / Entscheidungen

- **Schnittfugenband standardmaessig an?** Vorschlag: an, per Schalter in der Statusleiste abschaltbar.
- **Warn-Symbol** statt Farbcode — einverstanden? (Vorschlag: ja.)
- **Tests:** Es gibt kein Test-Framework im Projekt. Vorschlag: leichte Node-Tests (`node --test`), keine neue Abhaengigkeit.
- **Git:** `/opt/ceraCUT` Repo-Status pruefen, bevor S2 beginnt (CLAUDE.md verlangt Commit/Push je Aenderung).
