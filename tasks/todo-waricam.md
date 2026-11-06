# Offene Punkte — CeraCUT an Waricam angleichen

> Stand: 2026-11-06 · Plan/Verlauf: `waricam-angleichung.md` · Lead-Kern: `ap1-lead-kern-design.md`
> Erledigt: AP1 Lead-Kern, AP2 Bogenwinkel/Ecken-Lead (kein Katalog), AP3 Classic-Theme, AP4 Workflow (Auto-Setup, Setup-Tab entfaellt).

## Praxis-Validierung (wichtigster naechster Schritt)
- [ ] Ganzen Ablauf mit echten Fliesenteilen durchspielen: Import → Auto-Setup → Loch/Scheibe → Leads → Schnittfuge → Reihenfolge → Export.
- [ ] Erzeugten G-Code gegen eine Waricam-CNC desselben Teils vergleichen (Lead-In/Out, Ueberschnitt, G41/G42, Start-Punkt).
- [ ] G-Code an der Maschine pruefen (bisher nie an der echten Maschine validiert; Geometrie-basierte Leads sind neu).
- [ ] Echtes DXF zum Screenshot `Cerasell/Screenshots/Unbenannt.png` pruefen: Fliesen-Erkennung (Fall "Sortieren nicht gedrueckt"?).

## Fliesen-Erkennung
- [ ] Entscheiden: Fliesen schon beim Import erkennen (ohne "Sortieren")? Heute: Erkennung ueber `refreshTiles` (Sortieren/Export). `goToStep` wird vom Ribbon-Shim (`index.html`) ueberschrieben → `onStepEnter(4)` (dort steht `refreshTiles`) laeuft nie.
- [ ] Fallback-Erkennung (ohne Layer "Fliese"): nur Rechtecke mit **mehr als einem** Schnitt zaehlen als Fliese — Fliesen mit genau einem Schnitt fallen heraus.
- [ ] Auto-Setup: bei Fliesenboegen nur Nullpunkt (erledigt); pruefen, ob weitere Heuristiken noetig sind (gedrehte Fliesen, andere Layernamen).
- [ ] `npm run check:import` (Browser-Check) in den Ablauf aufnehmen (braucht Chromium, nicht in `npm test`).

## Lead / G-Code (aus AP1)
- [ ] Entity-erhaltender G-Code: Kontur entsteht aus tesselliertem DXF + Arc-Fitting (gerade Kanten teils als Riesenbogen, z. B. R134; Konturstart rastet auf Tessellierungspunkt). Waricam gibt exakte G01/G03 aus den DXF-Elementen aus.
- [ ] Warnsymbol am Lead: Hovertext mit Grund (gekuerzt/rotiert/Fallback) fehlt noch.
- [ ] Vorschau-Galerie der Fahnenformen (nur Bedienkomfort, aus den vorhandenen Parametern) — nur bei Bedarf.
- [ ] Haken/Schleife/"unter" bewusst nicht umgesetzt (nicht benoetigt).

## AP3 Optik
- [ ] Classic-Theme: Seitenpanel (Konturen), CNC-/SVG-Import-Dialoge, Export-Dialoge einzeln durchsehen.
- [ ] AP3.5 Icon-Palette links (feste Doppelspalte, 24 px, schlicht, Tooltip), gruppiert.
- [ ] AP3.6 Schwebende Fenster wie Waricam: Uebersicht (Mini-Map), Zoom-Regler; Properties-Panel einklappbar/schmal.
- [ ] AP3.7 Statusleiste: x/y, Maschine, Bauteilmasse (dx*dy), Meldezeile fuer aktive Funktion.
- [ ] Bearbeitung-Leiste wird lang (Auf <1900 px Breite scrollt sie) — ggf. "Vereinfachen"/"Strahlbreite" in anderen Tab.
- [ ] Mehrere Import-Hinweise ueberlagern kurz das Ribbon (Toast-Position/Dauer pruefen).

## AP4 Workflow / Menue
- [ ] "Weiter"-Leiste durch die Schritte ①–⑤ (Loch/Scheibe → Leads → Schnittfuge → Reihenfolge → Export) pruefen/bauen.
- [ ] AP4.3/4.4 Waricam-Funktionen: Eilgang manuell/loeschen, Stege (an Bridge Cutting anbinden), Reihenfolge "verzweigt"/Konturen tauschen/drehen, Schneidbedingung fuer gesamtes Bauteil, Koernen/Pulvern/Markieren/Bohren (nur falls fuer Wasserstrahl noetig).
- [ ] Tastenkuerzel/Command-Line: AutoCAD-Style optional ausblendbar.

## AP5 Sonderfunktionen (erst vor dem Menue-Umbau durchgehen)
- [ ] Tabelle in `waricam-angleichung.md` (Nesting, Intarsien/Mosaik, Kalkulation, Bridge Cutting, Q-Zonen, Simulator, Underlay, Bemassung, Multi-Head, Login, Autosave, Debug-Monitor, Command-Line): behalten / verstecken / streichen.

## AP6 Technik
- [ ] `index.html` (~4000 Zeilen) und `app.js` (~7500 Zeilen) aufteilen; `cam-contour.js` (~2700) in Lead-Berechnung / Kollision trennen.
- [ ] Ribbon-Shim in `index.html` (`goToStep`-Override, Tab-Handler) in ein Modul ziehen und mit `onStepEnter` zusammenfuehren.
- [ ] Browser-Pruefskripte (`scripts/check-import-workflow.js`) um Lead-Darstellung/Export erweitern.
