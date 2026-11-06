# CeraCUT an WARICAM 6.38 angleichen — Aufgabenplan

> **Erstellt:** 2026-11-06
> **Quelle:** Screenshots `Sonstiges/Screenshots/Waricam/` (7 Bilder, WARICAM 6.38 Professional II, Maschine RIDDER 840 D S6)
> **Ziel:** CeraCUT wird simpler und optisch schlichter, orientiert sich an Waricam. Sonderfunktionen bleiben nach Rücksprache erhalten.
> **Hoechste Prio:** Korrekte, reale Lead-Darstellung (Richtung, Form, Ueberschnitt).

---

## 1. Analyse WARICAM (aus Screenshots)

**Layout:** Klassische Win32-Optik. Menueleiste oben (Datei, Platten, Darstellen, Elemente, Manipulation, Technol. 1, Technol. 2, Infos, Vermalen, Einstellungen, Optionen, Hilfe). Kompakte Toolleiste. Vertikale Icon-Palette links (ca. 2 Spalten x 25 Icons). Grauer Zeichenbereich, Uebersichtsfenster (Mini-Map) und Zoom-Slider als schwebende Fenster. Koordinatenanzeige x/y unten. Statusleiste mit Maschinenname und Bauteilgroesse (`Maschine: RIDDER 840 D S6 dx*dy = 986 * 999`).

**Menue Technol. 1 (Reihenfolge / Fahnen / Stege):**
- Reihenfolge automatisch / definiere aussen / verzweigt
- 2 Konturen vertauschen / Reihenfolge Konturen / Kontur drehen
- **Fahnenkatalog / Fahnenmanipulation**
- Fahnenlaengen einer Kontur / aller Konturen modifizieren
- Fahnenposition neu bestimmen
- Stege (Untermenue)
- man. Eilgang / Eilgang loeschen / alle Eilgaenge loeschen

**Menue Technol. 2 (Schnitt / Maschine):**
- Schneidparameter / Schneidbedingung fuer gesamtes Bauteil setzen
- Schnittfuge darstellen / modifizieren
- Werkzeugkasten Werkzeuge / Werkzeug Kontur
- Schneiden / Schneiden innen / Schneiden aussen
- Koernen / Pulvern / Markieren
- Bohren / Loch (Anschuss) / Gewinde schneiden / Senken
- Texte / Referenz
- Maschinenfunktionen setzen / modifizieren

**Fahnenkatalog (zentrales Feature):** Zwei getrennte Dialoge, **aussen (19 Eintraege)** und **innen (15 Eintraege)**. Kachelraster mit Vorschaubild je Eintrag, Nummer + Name, Auswahlfeld, OK/Abbruch, zwei Buttons zum Anwenden (vermutlich "alle Konturen" / "Auswahl").
- Aussen: 01 kurz+knapp, 02 Linear 10, 03 Linear 20, 04 Linear 30, 05 Linear 45, 06 Linear 60, 07 Gerade, 08 Gerade, 09 tangential 1, 10 tangential 2, 11 Haken 1A, 12 Haken 1B, 13 Haken 2A, 14 Haken 2B, 15 Haken 3A, 16 Haken 3B, 17 unter, 18 senkrecht, 19 senkrecht 2
- Innen: 01 kurz+knapp, 02 Linear 10, 03 Linear 20, 04 Linear 30, 05 Linear 45, 06 Linear 60, 07 linear, 08 3/4 Kreis, 09 linear 2, 10 3/4 Kreis 2, 11 linear 3, 12 unter, 13 senkrecht, 14 Eckenanschnitt, 15 senkrecht 2
- Kachel-Piktogramm: **gelb = Kontur/Bauteilkante, rot = Anschnitt (Lead-In), blau = Ausschnitt (Lead-Out/Ueberschnitt)**. Faehnchen zeigen Form, Winkel und Bezug zur Ecke. *(Farbbedeutung bitte bestaetigen.)*

**Fahnen im Zeichenfenster:** Winzige rot/blaue Linie am Konturstartpunkt, in 1:1 realer Groesse und Richtung (Screenshots "Anschussfahne mit Schnittfuge aussen/innen"). Dazu Dialog "Schnittfuge modifizieren" (Kontur aussen/innen).

---

## 2. Analyse CeraCUT (Ist)

- Web-App (Browser + Node-Server), ca. 60.000 Zeilen JS, DXF → Sinumerik 840D.
- Grosse Dateien: `app.js` 7445, `drawing-tools.js` 4644, `index.html` 4086, `canvas-renderer.js` 3285, `cam-contour.js` 2647, `styles.css` 2544.
- **Leads:** `cam-contour.js` (`getLeadInPath`, `getLeadOutPath`, `getOvercutPath`, Arc/Linear/Tangent/On-Geometry, Kollisions-Fallbacks Rotation/Dog-Leg/Kuerzung/Alt-Lead, Center-Pierce). Profile in `lead-profiles.js` (8 Built-ins, Ext/Int/Corner/Alt/SmallHole/Slit). Darstellung in `canvas-renderer.js` (`drawLeadIn/Out`, `_drawArcLead`, `_getLeadColor`, `drawPierceSymbol`).
- **Lead-Problem aus Sicht Waricam:** Lead wird nach Parametern *berechnet* (Typ, Laenge, Radius, Winkel) und dann automatisch veraendert (gekuerzt, rotiert, Dog-Leg, Center-Pierce). Dargestellt wird farbkodiert (Cyan/Orange/Violett/Rot/Gruen/Gelb/Magenta) mit Pierce-Symbolen. Das ist **Diagnose-Optik, keine reale Darstellung**. Bei gekuerzten Arc-Leads Polylinien-Fallback. Eine bekannte, mehrfach reparierte Fehlerklasse (Radius-0, Arc-Flip V3.40, Corner-Fallback).
- **Kein Fahnenkatalog** (Suche nach "Fahne" findet nur Import-Artefakt-Bereinigung).
- **UI:** 6-Schritt-Wizard, Properties-Panel, 30 Tools in der Toolbar, Themes, viele Gradients/Shadows (16 Treffer), AutoCAD-Style Command-Line. Deutlich komplexer und "fancy" als Waricam.
- Weitere Sonderfunktionen: Nesting (BLF), Intarsien, Mosaik/Tile-Layout, Kostenkalkulation/CeraJet, Bridge Cutting, Quality Zones, Toolpath-Simulator, Bild-Underlay, Bemassung, Mess-Tool, Multi-User-Login, Multi-Head.

---

## 3. Entscheidungen, die vorab zu klaeren sind (Phase 0)

- [ ] **E1 Fahnen-Modell:** Katalog ersetzt die heutige Lead-Parametrik komplett (Fahne = fester Katalogeintrag + Laengenfaktor), oder bleibt Parametrik als "Experten-Modus"? *Empfehlung: Katalog als Standard, Parametrik nur noch im Eintrag "benutzerdefiniert".*
- [ ] **E2 Farbbedeutung Katalog** (rot/blau/gelb) bestaetigen und ob die Fahnenform in Waricam exakt so geschnitten wird, wie gezeichnet.
- [x] **E3 (entschieden: keine Beispiele/Daten vorhanden → Nachbau aus Piktogrammen, Abnahme per Sichtvergleich mit Waricam-Screenshots; nur Fliesen-relevante Fahnen, siehe AP2.0).** Urspruenglich: Waricam-Katalogdaten: Gibt es die Katalogdatei (Geometrie der 34 Fahnen, Laengen) oder muessen wir sie aus den Piktogrammen nachbauen? Gibt es `.dxf`/`.cnc`-Beispielteile aus Waricam mit bekannten Fahnen zum Abgleich?
- [x] **E4 (entschieden: Auto-Kuerzen bleibt, mit dezenter Warnung).** Automatik wie heute behalten? Auto-Kuerzen/Rotieren/Dog-Leg/Center-Pierce: behalten (als Warnung, nicht stillschweigend) oder streichen?
- [ ] **E5 Sonderfunktionen-Liste durchgehen** (siehe Abschnitt 6) — pro Funktion behalten / verstecken / streichen.
- [ ] **E6 Plattform:** Browser-App bleibt? Optik Win-Classic im Browser (CSS) reicht, kein Umstieg auf Desktop-Framework.
- [x] **E7 Menue:** Struktur darf smarter sein (entschieden); Workflow und Begriffe bleiben wie Waricam.
- [x] **E8 Koordinatensystem:** kein Thema, erledigt.

---

## 4. Aufgabenpakete

### AP1 — Lead/Fahnen-Kern: reale Darstellung (PRIO 1)

**Leitgedanke: Waricam-Leads werden nachgebaut** (Form, Richtung, Ueberschnitt identisch), nicht neu interpretiert.
Ziel: Was auf dem Bildschirm steht = was geschnitten wird. Richtung, Form, Ueberschnitt, Schnittfuge.

- [ ] **1.1 Spezifikation "reale Darstellung":** Pro Fahne definieren: Anschnittpfad (Form, Richtung, Laenge), Ausschnittpfad, Ueberschnitt (Laenge/Richtung/Lage zur Schnittfuge), Seite der Schnittfuge (G41/G42). Mit Waricam-Screenshots und Beispielteilen abgleichen.
- [ ] **1.2 Einheitliche Lead-Geometrie als Single Source of Truth:** Ein Modul liefert fertige Pfadsegmente (Linie/Bogen mit Start, Ende, Mittelpunkt, Drehsinn). Renderer, Simulator und Postprozessor lesen **dieselben Segmente**. Keine getrennte Rekonstruktion aus Winkeln mehr (Ursache der bisherigen Arc-Flip-/Fallback-Fehler).
- [ ] **1.3 Renderer:** Leads immer als echte Linien/Bogen (kein Polylinien-Fallback), exakte Weltgroesse, Pfeilspitze in Schneidrichtung am Lead, Ueberschnitt klar sichtbar ueber den Konturstart hinaus.
- [ ] **1.4 Schnittfuge real:** Schnittfugenbreite massstaeblich als Band/Doppellinie zeichnen (Aussen/Innen-Seite wie "Schnittfuge darstellen" in Waricam), inkl. Lead-In/Out und Ueberschnitt.
- [ ] **1.5 Farben vereinfachen:** Eine Lead-Farbe (Anschnitt) + eine (Ausschnitt/Ueberschnitt), wie Waricam rot/blau. Diagnose-Farben (gekuerzt/rotiert/Fallback) nur als dezente Warnmarkierung oder Info im Panel.
- [ ] **1.6 Pierce-Symbole reduzieren:** Kleiner Marker am Anschusspunkt, keine Typformen.
- [ ] **1.7 Zoom-Verhalten:** Leads auch bei kleinen Fahnen (z. B. 1 mm) in korrekter Proportion; Mindestdicke der Linie, aber Geometrie unveraendert.
- [ ] **1.8 Verifikation:** Referenzteile (Quadrat aussen/innen, Kreis, Ecke, Schlitz). Screenshot-Vergleich CeraCUT vs. Waricam. Pruefung: gezeichneter Pfad == MPF-Code (G-Code per Skript zurueck in Geometrie wandeln und ueberlagern).

### AP2 — Lead-Formen statt Fahnenkatalog (ERLEDIGT 2026-11-06)

**Entscheidung:** Kein Katalog. Die Waricam-Fahnen sind Presets bereits vorhandener Parameter (linear mit Winkel, senkrecht = 90 Grad, Bogen, 3/4-Kreis). Haken, Schleife und "unter" entfallen (nicht benoetigt / durch Winkel und Rotationsanschuss abgedeckt). Umgesetzt statt dessen (cam-contour V5.30, lead-profiles V1.5, app V6.63):
- [x] **Bogenwinkel** fuer Arc-Leads (30–270 Grad, Default 90; Feld "⌒" Aussen/Innen), in Profilen, Undo, clone/toJSON.
- [x] **Ecken-Lead-Oberflaeche** (Gruppe "Ecken-Lead": Typ, Winkel, ab Eckwinkel, "Start an Ecke") + in Profilen speicherbar.
- [x] **Lead-Out folgt dem Lead-In** (Typ/Winkel/Radius/Bogenwinkel; Laenge und Ueberschnitt getrennt) — war im Bestand schon so, jetzt dokumentiert/getestet.
- Tests: `tests/arc-angle.test.js`; UI-Verdrahtung per Headless-Chromium geprueft.

_(Urspruenglicher Plan unten nur noch als Historie.)_

### AP2 (historisch) — Fahnenkatalog

- [ ] **2.0 Auswahl Phase 1 (Fliesenzuschnitt, entschieden):** Fliese = sproedes Material, Anschuss immer im Abfall, flacher Einlauf, keine Ruecklaeufe in der Kontur. Daher nur diese Fahnen:
  - **Aussen (9 von 19):** 01 kurz+knapp (kleine Teile, Mosaik), 02 Linear 10, 03 Linear 20, 04 Linear 30, 05 Linear 45 (Standard-Einlauf), 07 Gerade, 09 tangential 1, 10 tangential 2 (sanfter Einlauf, bruchschonend), 18 senkrecht (Ecken/enge Abfallstege).
  - **Innen (8 von 15):** 01 kurz+knapp, 02 Linear 10, 03 Linear 20, 05 Linear 45, 07 linear, 08 3/4 Kreis (Standard fuer Ausschnitte/Bohrungen), 13 senkrecht, 14 Eckenanschnitt (Rechteck-Ausschnitte, Steckdosen).
  - **Spaeter (Phase 2, nur bei Bedarf):** Linear 60, Haken 1A–3B, unter, senkrecht 2, weitere Linear/3/4-Kreis-Varianten. Der Katalog-Dialog zeigt sie zunaechst nicht; Datenmodell ist fuer alle 34 ausgelegt.
  - Standardvorbelegung: Aussen = 05 Linear 45 bzw. 09 tangential 1, Innen = 08 3/4 Kreis, Ecke = 14 Eckenanschnitt.
- [ ] **2.1 Datenmodell:** `flag-catalog.js` mit `outer[19]` und `inner[15]`, je Eintrag `{id, nr, name, lead-in-Segmente, lead-out-Segmente, ueberschnitt, laengenParameter}` in lokalen Koordinaten (Tangente/Normale am Startpunkt), skalierbar mit Fahnenlaenge.
- [ ] **2.2 Katalogeintraege nachbauen (nur 2.0-Auswahl):** Linear 10/20/30/45, Gerade, tangential 1/2, 3/4-Kreis, senkrecht, Eckenanschnitt, kurz+knapp. Abgleich per Sichtvergleich mit den Waricam-Piktogrammen, Fliesen-Testteile (Rechteck, Ausschnitt, Kreis, L-Form).
- [ ] **2.3 Dialog "Fahnenkatalog aussen/innen":** Kachelraster mit Vorschau (Canvas-Piktogramm gelb/rot/blau), Nummer+Name, Auswahlfeld, OK/Abbruch, "auf alle" / "auf Auswahl".
- [ ] **2.4 Zuordnung:** Aussen-/Innenkontur automatisch bestimmen (existiert: disc/hole), passenden Katalog anwenden, Fahne Undo-faehig (Undo-Group).
- [ ] **2.5 Fahnenmanipulation:** Laenge einer Kontur / aller Konturen aendern, Position neu bestimmen (Startpunkt auf Kontur verschieben, bestehendes Start-Punkt-Drag nutzen), Fahne drehen/spiegeln.
- [ ] **2.6 Speicherung:** Fahne pro Kontur in Projekt/CNC-Export (`toJSON`/`fromJSON`), Migration alter Lead-Parameter → naechster Katalogeintrag oder "benutzerdefiniert".
- [ ] **2.7 Lead-Profile umbauen:** Profil = Material/Dicke + Standard-Fahne aussen + Standard-Fahne innen + Fahnenlaenge, statt 12 Einzelfelder.
- [ ] **2.8 Postprozessor:** Katalogfahne in G-Code (G41/G42, Linie/Bogen, Ueberschnitt) — Praxisvalidierung an Maschine.

### AP3 — Optik vereinfachen

- [ ] **3.1 Design-Tokens zentralisieren** in `styles.css` (Farben, Abstaende, Fonts) — Grundlage fuer Umstellung.
- [ ] **3.2 "Classic"-Theme als Standard:** hellgrau (#d4d0c8-artig), flache Raender, keine Gradients/Schatten/Rundungen, 1-px-Abstufungsrahmen, System-Schrift 11–12 px. Dunkles Theme optional entfernen.
- [ ] **3.3 Zeichenflaeche:** dunkelgrau wie Waricam, Konturen einfarbig (Teil gelb/gruen, Platte orange), kein Glow, keine Hover-Animationen.
- [ ] **3.4 Menue smarter:** Keine 1:1-Kopie der Waricam-Menues. Ziel ist der etablierte **Workflow** (Teil laden → Fahnen/Katalog → Reihenfolge → Stege → Schneidbedingung → Export), moderner und uebersichtlicher gruppiert. Begriffe (Fahne, Schnittfuge, Eilgang, Stege) bleiben.
- [ ] **3.5 Icon-Palette links:** feste Doppelspalte, 24-px-Icons, schlichte monochrom/2-farbig, Tooltip. 30 Tools → thematisch gruppiert.
- [ ] **3.6 Schwebende Fenster:** Uebersicht (Mini-Map) und Zoom-Slider wie Waricam; Properties-Panel durch Dialoge ersetzen oder schmal einklappbar.
- [ ] **3.7 Statusleiste:** x/y-Koordinaten, Maschine, Bauteilmasse (dx*dy), Meldezeile fuer aktive Funktion.
- [ ] **3.8 Wizard abloesen:** 6 Schritte werden Menuefunktionen (Technol. 1/2). Optional: "Auto-Funktion" (Screenshot "Startbild nach Autofunktion"): ein Klick fuehrt Referenz → Nullpunkt → Fahnen → Reihenfolge aus.

### AP4 — Basis-Tools laut Waricam-Palette

- [x] **4.1/4.2 Palette/Icon-Abgleich:** entfaellt, Basis-Tools sind in CeraCUT bereits vorhanden (entschieden).
- [ ] **4.3 Tools aus Waricam, die fehlen koennten:** Schneiden innen/aussen, Koernen, Pulvern, Markieren, Bohren/Loch/Gewinde/Senken, Referenz, Maschinenfunktionen setzen, Eilgang manuell, Stege (Untermenue), Reihenfolge verzweigt, Kontur drehen, 2 Konturen vertauschen. (Mehrere davon sind fuer Wasserstrahl evtl. irrelevant → mit dir klaeren.)
- [ ] **4.4 Menue "Technol. 1/2" implementieren** wie Abschnitt 1, soweit fuer Wasserstrahl sinnvoll: Reihenfolge (auto, manuell, tauschen, drehen), Eilgang manuell/loeschen, Stege, Schneidparameter, Schneidbedingung Bauteil.
- [ ] **4.5 Tastenkuerzel/Command-Line:** AutoCAD-Style optional ausblendbar, Waricam-Bedienung (Klick auf Icon, Meldezeile) als Standard.

### AP5 — Sonderfunktionen sichten (nach Rücksprache; alle bleiben unveraendert bis vor dem Menue-Umbau)

Liste zur Entscheidung (behalten / unter "Erweitert" verstecken / streichen):

| Funktion | Datei | Vorschlag |
|---|---|---|
| Nesting (BLF) | nesting.js | behalten, verstecken unter "Platten" |
| Intarsien / Mosaik / Tile-Layout | app.js, mosaic-generator.js, tile-*.js | behalten (Sonderfunktion) |
| Kostenkalkulation / CeraJet | cost-calculator.js, cerajet-engine.js | behalten, unter "Infos" |
| Bridge Cutting (Stege) | bridge-cutting.js | auf Waricam-"Stege" mappen |
| Quality Zones | quality-zones.js | klaeren |
| Toolpath-Simulator | toolpath-simulator.js | behalten |
| Bild-Underlay | image-underlay.js | klaeren |
| Bemassung / Messen | dimension-tool.js, measure-tool.js | behalten, vereinfachen |
| Multi-Head, Maschinenprofile | machine-profiles.js | behalten |
| Login / Multi-User | lib/, login.html | behalten |
| Workspace/Projekt-Autosave | project-manager.js | behalten |
| Debug-Monitor | debug-monitor.js | nur Entwickler |
| AutoCAD Command-Line / Noun-Verb | command-line.js | optional |

### AP6 — Technik / Aufraeumen

- [ ] **6.1 `index.html` (4086 Zeilen) und `app.js` (7445 Zeilen) aufteilen**, bevor die UI umgebaut wird (Menue, Toolbar, Dialoge als eigene Module).
- [ ] **6.2 Lead-Code entflechten:** `cam-contour.js` (2647 Zeilen) → `lead-geometry.js` (reine Pfadberechnung), `flag-catalog.js`, Kollisionslogik separat.
- [ ] **6.3 Tests:** Automatisierte Geometrietests fuer jede Katalogfahne (Start/Ende/Tangentialitaet/Drehsinn) und Roundtrip Geometrie → MPF → Geometrie.
- [ ] **6.4 Pflicht-Regeln aus CLAUDE.md** bei jedem Schritt: build-info, Header, `?v=`, sync-versions, lessons.md.

---

## 5. Reihenfolge / Meilensteine

1. **M0 Phase 0:** E1–E7 klaeren, Waricam-Katalogdaten besorgen (du).
2. **M1 Lead-Kern (AP1.1–1.8):** reale Darstellung + Postprozessor-Gleichheit. *Auch ohne Katalog sofort ein Gewinn.*
3. **M2 Fahnenkatalog (AP2):** Datenmodell → Dialog → Anwendung → Export.
4. **M3 Optik (AP3.1–3.3):** Classic-Theme, flache Zeichenflaeche.
5. **M4 Menue/Palette (AP3.4–3.8, AP4):** Waricam-Struktur, Wizard abloesen.
6. **M5 Sonderfunktionen (AP5)** einordnen, **AP6** laufend.

## 6. Risiken

- Fahnenform/Ueberschnitt der Waricam-Maschine muss **an der Maschine** validiert werden (CLAUDE.md: bisher keine Praxis-Validierung).
- Katalog nur aus Piktogrammen nachgebaut = Abweichungen moeglich. Originaldaten (E3) sind der groesste Hebel.
- Umbau Wizard → Menue beruehrt `app.js` stark (7.4k Zeilen) → AP6.1 zuerst.

## 7. Offene Rueckfragen an dich

1. Farbbedeutung im Katalog (rot/blau/gelb) so richtig?
2. Gibt es die Waricam-Katalogdaten / Beispielteile mit Fahnen?
4. Welche Sonderfunktionen aus Abschnitt AP5 sind dir wichtig?


---

## Fortschritt (Stand 2026-11-06)

- **AP1 Lead-Kern** ✔ (Segmente, Geometrie-Basis wie Waricam, Renderer, Postprozessor, Simulator, Roundtrip, Abnahme gegen `HEIDE6000101587.CNC`).
- **AP2** ✔ in geaenderter Form: kein Fahnenkatalog; stattdessen Bogenwinkel (bis 3/4-Kreis) + Ecken-Lead-Oberflaeche.
- **AP3 Optik** ✔ Classic-Theme (flach, grau, Standard); Seitenpanel/Dialoge im Classic-Theme noch nicht durchgesehen.
- **AP4 Workflow** (Teil 1 ✔): Waricam-Ablauf: *DXF-Import → Referenz + Nullpunkt automatisch → pruefen: Loch/Scheibe → Lead (Art/Laenge) → Schnittfuge → Reihenfolge → Export*. Umgesetzt: Auto-Setup beim Import (Checkbox "Auto beim Import"), automatischer Wechsel in Bearbeitung, Bearbeitung-Tab in Reihenfolge ① Loch/Scheibe ② Leads ③ Schnittfuge/Qualitaet. Offen: Reihenfolge-/Export-Tab im selben Stil nummerieren (④/⑤), Dialoge/Seitenpanel pruefen, evtl. "Weiter"-Leiste.

- **Setup-Tab entfaellt** (2026-11-06, app V6.67): Referenz + Nullpunkt (laufen beim Import automatisch) liegen im Tab **Datei** (manuelle Korrektur), Technologie (Material/Dicke/Druck/Duese) als Gruppe **③ Technologie** in Bearbeitung. Tabs: Datei · CAD · Bearbeitung · Reihenfolge · Extras · Export · Ansicht.

- **Offene Punkte:** siehe `todo-waricam.md`.
