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

---

## 6. Fortschritt

- [x] **S1** `lead-geometry.js` + 22 Node-Tests (2026-11-06)
- [x] **S2** Anbindung `cam-contour.js` V5.25: Builder + Kuerzen ueber Segmente. Golden-Regression (`tests/golden/leads-old.json`, 279 Szenarien aus altem Code, `tests/lead-contour-golden.test.js`) gruen. Overcut noch ohne Segmente (folgt mit S4/S5).
- [x] **S3** Renderer (V3.60): rot/blau, echte Boegen, Pfeile, Warnsymbol, Schnittfugenband + Schalter. Bonus-Fix cam-contour V5.27: `_minSelfClearance` kappte Leads auf Kreisen und fast alle Lead-Outs auf ~0.5 mm. Visuell per Headless-Chromium geprueft.
- [x] **S4** Postprozessor V2.8: Leads 1:1 aus Segmenten, Roundtrip-Test (kerf 0) gruen; negativer Ueberschnitt jetzt in der gefahrenen Kontur. **Offener Befund siehe Abschnitt 8.**
- [ ] ~~S4~~ · [ ] **S5** Simulator · [ ] **S6** Roundtrip · [ ] **S7** Aufraeumen

## 7. Befund waehrend S2: Arc-Leads werden nie erzeugt (offen, Entscheidung noetig)

`CamContour._isAtCorner()` (seit Initial-Import) berechnet `deviation = 180° - Drehwinkel`. Eine **gerade** Stelle liefert damit ~175°, ein 90°-Eck 90°. Der Schwellenvergleich (`> cornerDegradeThreshold`, Default 60°) ist damit fuer fast jeden Startpunkt wahr, und `getLeadInPath/getLeadOutPath` degradieren `arc` auf `cornerLeadType` (Default `linear`, Winkel 0). Folge: **der Default-Arc-Lead wird praktisch nie erzeugt**, auch nicht auf Kreisen/Geraden. Nachgewiesen im Golden-Capture (Default-Szenarien: 0 Arc-Leads, erst mit `cornerDegradeThreshold: 999` entstehen sie).
**ERLEDIGT (cam-contour V5.26):** Drehwinkel statt Supplementwinkel verwenden (gerade = 0°, 90°-Ecke = 90°). Aendert das Verhalten sichtbar (Arcs erscheinen wieder) und muss mit dem Fahnenkatalog (AP2) abgestimmt werden.

## 8. Befund S4: Lead-Basis Kerf-Offset vs. Geometrie (Entscheidung noetig)

Leads (und positiver Ueberschnitt) werden auf der **Kerf-Offset-Bahn** (Werkzeugmitte) berechnet und mit diesen Koordinaten in den G-Code geschrieben. Die Kontur selbst steht im G-Code auf der **Teilegeometrie** (Controller-Kompensation G41/G42, Header: "Koordinaten = Teile-Geometrie"). Beispiel Rechteck 100x60, kerf 0,8, linearer Lead-In:

```
N10 G42 G01 X-0.400 Y-0.400    <- Lead-In endet auf der Offset-Ecke
N11 G01 X100.000 Y0.000        <- erste Kante geht von dort zur Geometrie (100,0); Startecke (0,0) wird nie angefahren
...
N15 G01 X0.600 Y-0.400         <- Lead-Out beginnt auf der Offset-Bahn
```
Folge: Sprung kerf/2 (0,4 mm) zwischen Lead-Ende und Konturstart, erste Kante leicht schraeg. Bei Kreisen entstehen verzerrte Verbindungsboegen. Bestand seit vor dem Umbau (alter PP erzeugt identischen Code). Test: `tests/pp-leads.test.js` ("Lead-Ende trifft den Konturstart", skip).
Loesungsvorschlag: Leads fuer den G-Code auf der Geometrie berechnen (Controller versetzt sie), Darstellung zeigt zusaetzlich die versetzte Werkzeugbahn (Segmente um kerf/2 verschoben bzw. Bogenradius +-kerf/2).

### 8.1 Bestaetigung durch Waricam-Referenz `HEIDE6000101587.CNC` (2026-11-06)

Quelle: `/mnt/cnc/HEIDE6000101587.CNC` (= Kopie in `Sonstiges/Screenshots/Waricam/`), DXF: `Output Waricam/HEIDE6000101587.DXF` (Langloecher aus R14-Boegen, Offene Kontur aus R25-Boegen).

- **Waricam programmiert die Teilegeometrie** (Boegen r = 14,000 wie im DXF, nicht 14 +- 0,4) mit G41/G42; der Controller versetzt. Der Lead-In endet **exakt** auf dem Konturstart: `G41 G01 X134.399 Y22.101` -> `G03 ... I-9.899 J9.899` (Mittelpunkt 124.5/32.0, r = 14,000, Startpunkt liegt auf dem Kreis).
- Kontur 1 (Langloch, Loch/G41): **Lead-In linear 45 Grad, 3,0 mm** (Pierce 132.278/24.222 -> 134.399/22.101), danach Kontur, **Ueberschnitt 3,0 mm** weiter auf demselben Kreisbogen (`G03 X136.278 Y24.432`, Bogenlaenge 3,0), danach **Lead-Out 1,0 mm senkrecht** zur Kontur in den Abfall (`G40 G01 X135.437 Y24.973`).
- Kontur 2/4 (offene Kontur mit R25-Boegen): Lead-In 2,85 mm linear, Schnitt, Ende per `L205` + `G91 G40 G01 X1.0 Y0.0` + `G90` (wie unser Slit-Pfad).
- Stuecktyp: pro Kontur `R957`, `R923=9`, `L201`, `VAKT=R940+0.45*(R938-R940)` und `FLIN H1/H0` — entspricht dem, was unser PP bereits erzeugt.
- Folgerung: Lead-Basis fuer den G-Code = **Geometrie**, nicht Kerf-Offset. Offene Entscheidung zur Umsetzung siehe Abschnitt 8.

### 8.2 Umsetzung S4b (2026-11-06, cam-contour V5.28 / canvas-renderer V3.61 / lead-geometry V1.1)

- Leads und Ueberschnitt werden auf der **Teilegeometrie** berechnet (`_leadBasisPts()`); der G-Code endet den Lead-In exakt auf dem Konturstart (Rechteck: `G42 G01 X0.000 Y0.000`, Ueberschnitt 3 mm `G01 X3.000 Y0.000`, Lead-Out `G40 G01 X3.000 Y-3.000`).
- Anzeige: Leads/Ueberschnitt/Startmarke auf der Geometrie (wie Waricam), Fugenband entlang der **realen Strahlmitte** (`getLeadInToolSegments`, `getLeadOutToolSegments`, `overcut.toolPoints`): Anfahrsatz unkompensiert -> kompensierte Bahn, Rest um kerf/2 versetzt (Bogenradius -/+ kerf/2), G40-Satz endet unkompensiert.
- Abstaende vorher implizit durch die Offset-Bahn, jetzt explizit: Nachbar-Margin + Fugenbreite, Engstellen-Kappung (Abstand - Fugenbreite)/2.
- Abnahme: `tests/waricam-reference.test.js` (Langloch aus `Heide6000101587.dxf`, Waricam: Lead-In 3 mm senkrecht, Ueberschnitt 3 mm, Lead-Out 1 mm senkrecht, G41/G40) und `tests/pp-leads.test.js` (Roundtrip G-Code == Zeichnung mit kerf 0.8, 273 Szenarien).
- Die Waricam-Referenz zeigt: Lead-In ist **90 Grad** (senkrecht), nicht 45 Grad — in der Auswertung 8.1 stand irrtuemlich 45 Grad (Weltrichtung).

**Offen / Folgethemen (ausserhalb S4b):**
- G-Code-Kontur entsteht aus **tesselliertem DXF + Arc-Fitting**: gerade Kanten werden teils als Riesenbogen (z. B. R134) ausgegeben und der Konturstart rastet auf einen Tessellierungspunkt ein (Waricam: exakte G01/G03 aus den DXF-Elementen). Praktisch innerhalb 0,01 mm, aber unsauber -> eigenes Paket "Entity-erhaltender G-Code".
- Der Simulator (S5) liest weiterhin die Punkte der Leads, noch nicht die Segmente.
