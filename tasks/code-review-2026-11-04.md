# Komplett-Code-Review 2026-11-04 (V6.75)

> **Methode:** 10 parallele Review-Agenten über alle Module (~2,5 MB JS), Fokus: echte Bugs & Logikfehler.
> Nur Funde mit konkretem Fehlschlag-Szenario. Die 10 wichtigsten kritischen Funde wurden zusätzlich
> von Hand am Code verifiziert (Markierung ✅). Generierte Dateien (build-info.js, default-font.js)
> und Fremdbibliotheken (opentype.min.js) ausgeklammert.
>
> **Bilanz:** 91 Funde — 32 kritisch, 42 mittel, 17 gering.
> Schweregrad: K=kritisch, M=mittel, G=gering · Konfidenz: s=sicher, w=wahrscheinlich, m=möglich

---

## TOP-PRIORITÄT (Datenverlust / Ausschuss / Server-Crash)

| # | Stelle | Fund |
|---|--------|------|
| T1 ✅ | app.js:2889 | Strg+S überschreibt falsche Datei (File-Handle-Swap beim Öffnen) |
| T2 ✅ | app.js:4722-4740 | Multi-Material-Intarsien-Export: falsche/fehlende Konturen |
| T3 ✅ | server.js:519-527 | `data/users.json` + `certs/server.key` unauthentifiziert abrufbar |
| T4 ✅ | lib/auth.js:24 | Jedes kaputte Cookie crasht den Server |
| T5 ✅ | sinumerik-pp:498/618 | G41/G42-An-/Abwahl auf Bogensatz → Maschinenalarm |
| T6 ✅ | sinumerik-pp:1079ff | Multi-Head-Export funktionslos (Kopf ≥2 wird nie geschnitten) |
| T7 ✅ | nesting.js:520-531 | Mindestabstand wird real nie geprüft → Teile mit ~0 mm Steg |
| T8 ✅ | cost-calculator.js:142 | Off-by-one Qualität→Vorschub → Angebote systematisch falsch |
| T9 ✅ | arc-fitting.js:92-96 | V3.2-Fix wirkungslos → weiterhin Mini-G01 bei Schriftpfaden |
| T10 ✅ | undo-manager.js:760 | Strg+X ohne Lösch-Tracking → Konturen kehren zurück u. werden geschnitten |

---

## 1. Geometrie (geometry.js, geometry-ops.js, arc-fitting.js, constants.js)

1. ✅ **arc-fitting.js:92-96 | K | s** — Kollinear-Merge (V3.2) wirkungslos: `_distToLine()` (Z.356-362) klemmt t auf [0,1] und misst den Abstand zum SEGMENT statt zur Geraden; der Kandidat liegt immer hinter dem Segmentende → Abstand ≈ Punktraster (0,1 mm) > Toleranz (0,01) → Abbruch in der 1. Iteration. Schriftpfade erzeugen weiter ein Mini-G01 pro Punktpaar (Sinumerik „Bahnkomponente = Null"). Fix: unclamped Abstand zur unendlichen Geraden.
2. **geometry-ops.js:1035-1042 | K | s** — `_extractBetween()`: liegen beide Schnittpunkte auf demselben Segment (si==endSeg), werden 0 Zwischenpunkte gesammelt statt des kompletten Umlaufs → Boolean-Op (union/subtract) verliert den ganzen Körper von A. Standard-Fall: zwei achsparallele Rechtecke, Überlappung an einer Kante.
3. **geometry-ops.js:1012-1015 | K | w** — Subtract nutzt in beiden Zweigen `partB1`; bei a1Inside=true wäre partB2 (B-Teil innerhalb A) nötig → A\B liefert Umriss ähnlich A∪B. Orientierung von B wird nie geprüft/normalisiert.
4. **geometry-ops.js:999-1000 | M | w** — Innen/Außen-Test nimmt Vertex `partA1[len/2]`; bei 2-Punkte-Teil ist das ein Schnittpunkt exakt auf dem Rand von B → Ray-Casting kippt zufällig. Fix: Parametermitte der Kurve testen.
5. **geometry.js:78-79 vs. geometry-ops.js:886-887 | M | s** — Entgegengesetzte Offset-Konventionen: `offsetPolygon` positiv=RECHTS, `offsetContour` positiv=LINKS der Fahrtrichtung. Wechsel zwischen beiden (Preview vs. Export) = Kerf auf falscher Seite (0,8 mm Maßfehler).
6. **geometry.js:31,53-55 | M | w** — `isClockwise()` für Y-nach-oben-Welt invertiert (Shoelace>0 ist CCW, Kommentar behauptet CW); widerspricht `ArcFitting._isClockwise()` (korrekt, speist G02/G03).
7. **geometry-ops.js:541-553, 649-658 | M | s** — `trimContour()`: Nachbar-Hit-Suche nicht zyklisch — Klick auf den Abschnitt über die Naht (zwischen letztem Hit und Konturanfang) → Trim/Preview tun nichts.
8. **arc-fitting.js:304-306 + 683-691 | M | w** — Vollkreis: geschlossene Kreis-Polyline → Arc mit start==end → span=0 statt 2π → `toPolyline()` kollabiert den Kreis zu einem Punkt.
9. **geometry.js:106-143 | M | w** — `offsetPolygon()` ohne Miter-Limit und ohne Selbstschnitt-Bereinigung (offsetContour hat 20×-Guard): Haarnadel-Ecke → Offset-Spike, Strahl fährt weit aus der Kontur.
10. **arc-fitting.js:754-764 | G | s** — `getStats()`-Spannenkorrektur mathematisch falsch (CCW<π → 2π−span): Viertelkreis meldet 3-fache Länge → verfälscht Längen-/Zeitabschätzung.
- Nebenbefund: `findCorners()` (geometry.js:391-394) meldet bei geschlossenen Konturen die Naht-Ecke doppelt.

## 2. CAM-Kern (cam-contour.js, cam-tools.js, ceracut-pipeline.js, lead-profiles.js)

1. **cam-contour.js:391-394 | K | s/w** — `_getCornerSafeLeadBasis()`: Tangente wird aus der Waste-Normalen rekonstruiert, ignoriert aber deren bedingten Flip in `_getWasteSideNormal()` → in den Flip-Fällen (Disc CCW bzw. Hole CW) ist die Tangente exakt umgekehrt: Arc-Lead-In mündet anti-tangential (Anschussdelle), Linear-Leads ≠90° gespiegelt. Betrifft auch getLeadOutPath (Z.1094-1096).
2. **cam-contour.js:453-454 | K | w** — `_isSmallHole()` prüft `cuttingMode!=='hole'` direkt statt `_isEffectivelyHole()` (verletzt die eigene V5.13-Regel): bei kerfFlipped-Loch (Einleger behalten!) pierct Center-Pierce im Zentroid = im Produkt. Analog Center-Exit Z.1055-1060.
3. **ceracut-pipeline.js:268 + 357-364 | K | m** — Doppelte Referenz-Korrektur: Nesting-Zählung überspringt Referenzen immer UND `_detectReference()` dekrementiert nochmal, wenn skipReference falsy (öffentlicher `process()`-Pfad) → Loch wird als disc eingestuft, Kerf auf falscher Seite. (Aktuelle app.js-Aufrufer nutzen skipReference:true — latent.)
4. **ceracut-pipeline.js:44-47 | M | w** — Kerf-Änderung invalidiert Lead-Caches nicht (nur cuttingMode-Wechsel tut das): Lead endet neben dem neu kompensierten Konturstart.
5. **cam-tools.js:830-855 | M | s** — PolyJointTool: abgefragte Brückenbreite wird nie verwendet; Join erzeugt Null-Breite-Brücke (Hin- und Rückweg identisch) → selbstberührendes Polygon, kein Steg bleibt stehen.
6. **cam-contour.js:2448-2507 | M | s** — `clone()` verliert `_fitPoints`, `_splineClosed`, `sourceType`, `_splineData`, `cutOrder`, `_arcSegments`/`_originalPoints` (toJSON persistiert sie): Duplikat/Intarsien-Klon exportiert Sehnen statt G2/G3, Spline-Nachbearbeitung unmöglich.
7. **ceracut-pipeline.js:648-681 | M | w** — `_classifyGaps()` leert c.gaps/healedGaps nie → jeder autoProcess-Lauf dupliziert alle Gap-Einträge/-Warnungen.
8. **cam-contour.js:109 | M | m** — Konstruktor ignoriert `options.isClosed` (harte 0,01-mm-Eigenerkennung vs. 0,1-mm-Chaining des Parsers): Kontur mit 0,05 mm Restlücke → 'slit', keine Kerf-Kompensation. Zudem übergeben PolyJointTool/ConvexHullTool boolean als options-Objekt.
9. **cam-contour.js:581 + 729-741 | M | w** — Engstellen-Kappung (V6.43) kappt nur die Länge, der Arc-Lead baut immer einen vollen 90°-Bogen mit festem Radius → Kappung bei Arc-Leads wirkungslos.
10. **cam-contour.js:1027-1033 + 1067 | G | m** — Negativer Overcut (Microjoint): Lead-Out ankert am nominellen Konturende statt shortenBy früher → Strahl überfährt den Steg.

## 3. CAM-Features (bridge-cutting, quality-zones, nesting, cost-calculator, machine-profiles, toolpath-simulator)

1. ✅ **nesting.js:520-531 | K | s** — spacing nur im BBox-Vorfilter, nie gegen echte Kontur; `_inflatePartBBox` ist toter Code → nicht-rechteckige Teile werden bis 0 mm Abstand platziert, Kerf frisst ins Nachbarteil.
2. ✅ **cost-calculator.js:142-150 | K | s** — `tech.feeds[quality]` indiziert 0-basiertes Array mit 1-basierter Qualität (Fallback darunter macht korrekt `quality-1`): Schnittzeit ~28 % zu kurz, Angebote zu billig; quality=5 → undefined → inkonsistent.
3. **toolpath-simulator.js:700-705 | M | s** — gleicher Off-by-one in `_getFeedRate` → Simulation widerspricht Postprozessor.
4. **quality-zones.js:227-242 | M | s** — `_detectCorners` prüft die Naht-Ecke (points[n-2],points[0],points[1]) nie → Startecke geschlossener Konturen bekommt keine CORNER-Zone → Ausbruch exakt an der Startecke.
5. **bridge-cutting.js:290-298 | M | w** — Bridge-Intervalle werden auf [0,totalLength] geclampt statt bei geschlossenen Konturen zu wrappen: Steg am Startpunkt halbiert/einseitig.
6. **bridge-cutting.js:436-439 | G | w** — nach Bridge fest `G01 Z0` statt cutZ aus Maschinenprofil (3/5 mm) → Düse zu tief.
7. **toolpath-simulator.js:843-846 | G | s** — Animation nimmt fix 60 fps an (statt Framezeit zu messen): 120-Hz-Display → doppelte Geschwindigkeit.
8. **machine-profiles.js:469-499 + 706-710 | G | m** — `_loadFromStorage` ohne Validierung; Profil ohne postprocessor-Objekt → TypeError beim Export bis LocalStorage geleert wird.

## 4. Import (dxf-parser, svg-parser, cnc-reader, image-underlay)

1. **svg-parser.js:317-320 | K | s** — Pfad-Tokenizer kennt keine kompakten Arc-Flags ("011-1"), Negativzahlen ohne Trenner ("L10-5") oder ".5.5" → ab da alle Token verschoben; jedes minifizierte SVG (SVGO/Illustrator/Figma) wird falsch importiert.
2. **svg-parser.js:562-575 | K | s** — `_combineTransform` verkettet nicht: Kind-transform verwirft Parent-`localMatrix` → Inkscape-Export (translate im g, matrix im path) landet ~1052 Einheiten versetzt.
3. **cnc-reader.js:119+132 | K | s** — Vollkreise (G2/G3 Start=Ziel, auch "G2 I-10" ohne X/Y) werden stillschweigend verworfen → alle Bohrungen fehlen ohne Warnung.
4. **dxf-parser.js (fehlt) | K | s** — `$INSUNITS` wird nirgends gelesen; Zoll-DXF wird 25,4× zu klein importiert, ohne Warnung.
5. **dxf-parser.js:1164-1174 | K | w** — ELLIPSE: fehlende `endAngle += 2π`-Normalisierung bei End<Start (bei ARC Z.971 vorhanden) → komplementärer Ellipsenbogen in Gegenrichtung.
6. **image-underlay.js:326-333 vs. 352-358 | M | s** — drawAll flippt Y (Bild in Welt [ip.y−h, ip.y]), hitTest/drawGrips rechnen [ip.y, ip.y+h] → Grips über dem Bild, Klick aufs Bild selektiert nichts.
7. **svg-parser.js:100-109 + 591-595 | M | s** — Y-Flip ignoriert viewBox-minY (und vbY wird nie kompensiert): `viewBox="0 100 200 100"` → Zeichnung landet im Negativen.
8. **svg-parser.js:389-421 | M | s** — S/T spiegeln cpx/cpy bedingungslos (Spec: nur nach C/S bzw. Q/T); L/H/V/M resetten nie → wilde Ausbeulung nach "M…L…S…".
9. **cnc-reader.js:88 | M | w** — Radius-Regex `(?<![A-Z])R…` schließt Sinumerik `CR=` aus → Bogen fehlt, Kontur offen; G20/G70 (Zoll) unausgewertet.
10. **dxf-parser.js:373-401 | M | s** — BLOCKS-Parser ohne case INSERT: verschachtelte Blöcke verlieren Unterreferenzen stillschweigend (auch kein _ignoredEntities-Tracking).
- Nebenbefunde: app.js:2920 liest DXF fest als ISO-8859-1 → Mojibake bei UTF-8-DXF (AC1021+); `\U+00E4`-Escapes werden nicht dekodiert; `_removeDanglingLeadTabs` (dxf-parser.js:528ff) kann legitime kurze Gravurstriche (≤5 mm) am Konturknoten löschen.

## 5. Export (dxf-writer, sinumerik-postprocessor, cerajet-engine)

1. **sinumerik-pp:676-711 | K | s** — Slit-Konturen: Segmente 0, 1 und letztes werden IMMER als G01 geschrieben (Schleife läuft i=2..len-2), auch wenn Arc-Fitting Bögen lieferte → Sehne statt Bogen, mehrere mm Abweichung; curX/curY-Tracking danach falsch.
2. ✅ **sinumerik-pp:498 (u. 618) | K | s** — G41/G42-Anwahl auf G02/G03-Satz bzw. G40-Abwahl auf Bogensatz: Sinumerik erlaubt WRK-An-/Abwahl nur im Linearsatz (Alarm 10775/10776). Tritt auf bei Arc-Lead ohne Linienanteil.
3. **sinumerik-pp:505-508 | K | w** — Fallback ohne Lead-In: `F=VAKT`, aber VAKT wird nur im Lead-In-Zweig gesetzt → Vorschub 0 (Alarm) oder Restwert der Vorkontur.
4. ✅ **sinumerik-pp:1079-1115 | K | s** — Multi-Head tot: KOPF_ANZAHL/ABSTAND stehen NACH M30 des Headers; Header ruft fest nur PART1 → Köpfe ≥2 werden nie geschnitten; PARTs 2..n ohne TRANS/AROT-Vorspann.
5. **sinumerik-pp:670 | M | w** — minArcRadius-Fix (V2.4) fehlt im Slit-Pfad (`_processContourPoints(pts)` ohne minArcR) → Error 10763 bei engen Bögen unter G41/G42.
6. **sinumerik-pp:621-623 (u. 592-593) | M | w** — G40-Fallback fährt Nullweg-Satz auf aktueller Position → „Bahnkomponente = Null"-Alarm; Kompensationsrücknahme verletzt die Teilekante.
7. **cerajet-engine.js:135-139 | M | s** — `calcPierceTime(akz,…)`: akz wird nie verwendet, Formel reproduziert die Kalibrierpunkte nicht (Stahl 2,2 s statt 4,3 s) → unvollständige Durchdringung beim Anstich.
8. **sinumerik-pp:857-871 | M | m** — G41/G42 nur aus cuttingMode, Umlaufrichtung wird nie geprüft/normalisiert → bei „falsch" orientiertem Import Kerf auf falscher Seite, ohne Alarm (kerfFlipped existiert als manueller Workaround).
9. **dxf-writer.js:338-347 | M | m** — `_isCacheStale`-Toleranz = ganze BBox-Diagonale → veralteter _center-Cache wird praktisch nie erkannt; CIRCLE landet an alter Position.
- Entwarnung (geprüft): Zahlenformatierung durchgehend locale-sicher (toFixed, keine Exponentialnotation), I/J korrekt inkrementell, Vollkreis-I/J ok, Layer-Sanitisierung TABLES/ENTITIES konsistent (_nameMap), EOF-Newline vorhanden.

## 6. app.js (Hauptmodul)

1. ✅ **app.js:2889 | K | s** — `openFilePicker()` setzt `_dxfFileHandle` VOR der Tab-Erzeugung; `_captureFromApp` schreibt das Handle der NEUEN Datei in den ALTEN Tab → Strg+S in Tab A überschreibt B.dxf kommentarlos mit Tab-A-Inhalt (Toast meldet sogar Erfolg). **Datenverlust.**
2. ✅ **app.js:4723-4740 | K | s** — Multi-Material-Export: gefiltertes Kontur-Array + UNgefilterte cutOrder (PP macht `cutOrder.map(idx => contours[idx])`) → M0-Datei enthält M1-Konturen, hintere Indizes → undefined → Konturen fehlen. Ausschuss an der Maschine.
3. **app.js:4798-4804 | K | w** — V6.35-Fugen-Offset: Flächencheck erzwingt NEG=+/POS=− einheitlich — für verschachtelte Konturen (Insel/Innenloch) invertiert → Ring-Einleger passt nicht (2× offset Übermaß am Innenstoß). Preview und Export identisch falsch.
4. **app.js:4629-4664 | K | m** — NEG/POS-Modusinversion widerspricht dem eigenen Docstring (POS invertiert statt NEG) → je nach Interpretation pierct POS im Einleger (Sichtteil beschädigt) und Kerf falschseitig. Klären, welche Seite gewollt ist!
5. **app.js:1757 | M | s** — `_lastReversedContours` wird nie zurückgesetzt → Undo einer Nicht-TSP-Sortierung kehrt fremde Konturen um (Kerf-Seite kippt).
6. **app.js:3269-3279 | M | s** — Nullpunkt-Pick setzt `currentStep=0` → Steps 2-6 gesperrt, „Weiter" springt zu Step 1.
7. **app.js:944-957 | M | w** — Startpunkt-Rotation dupliziert alten Nahtpunkt → Null-Längen-Segment in der Kontur.
8. **app.js:1417-1431/2488-2494 | M | w** — Intarsien-Overlay wird bei Delete/Add/Duplicate nicht regeneriert → Preview ≠ Modell/Export.
9. **app.js:2792 + 3982-4003 | M | w** — Step-4-Eintritt überschreibt per-Kontur-Lead-Einstellungen aller Konturen ohne Snapshot/Undo.
10. **app.js:4746-4750 | M | m** — Intarsien-Mehrfach-Download ohne User-Geste (setTimeout) → Browser blockt Folgedateien; `_downloadIntarsiaFile` unawaited → Erfolgs-Toast trotz Fehler.
11. **app.js:1260 | G | s** — Kontextmenü prüft nicht-existente `clipboardManager.clipboard` → „Einfügen" wirkt immer deaktiviert.
12. **app.js:2758-2761 | G | s** — F1-Dialog: `{once:true}`-Listener wird von jedem Klick konsumiert; Close-Listener akkumulieren bei ESC.

## 7. Zeichenwerkzeuge (drawing-tools, drawing-tools-ext, text-tool)

1. **text-tool.js:113-117+165-199 | K | s** — Options-Submachine toter Code: SP/AL/BR/ZA-Eingaben erreichen `_handleOption` nie; „L"/„C"/„R" starten stattdessen Linien-/Kreis-/Rotate-Tool, Text verloren. Spacing/Align/Brückenbreite unbedienbar.
2. **text-tool.js:449-487+662 | K | s** — Stencil-Brücken erzeugen keine Lücke: Punkte werden nur gefiltert, die Polylinie bleibt EINE geschlossene Kontur → Inselbuchstaben („O") fallen trotzdem heraus; `closed:!stencil` öffnet zusätzlich brückenfreie Buchstaben unnötig.
3. **drawing-tools.js:597-604/692-701 vs. 3804-3816 | M | s** — Bogen-Preview/Entity: `ctx.arc(..., entity.ccw)` müsste `!entity.ccw` sein → Rubber-Band und pending Entity zeigen den Komplementärbogen; erst nach Apply stimmt es.
4. **drawing-tools.js:2163-2226 | M | s** — Mirror mit „Quelle löschen": Add und Delete als 2 getrennte Undo-Schritte (keine Gruppe) → 1× Strg+Z erzeugt doppelte Geometrie.
5. **drawing-tools.js:2765-2771 | M | s** — `LineTool.cancel()` löscht ALLE bestätigten Segmente der Sitzung bei Toolwechsel/ESC — ohne Undo. XLineTool analog.
6. **drawing-tools.js:1944-1950 | M | w** — RotateTool Referenzmodus: getippter Winkel wird absolut angewandt (fehlt `- referenceAngle`).
7. **text-tool.js:341-352 vs. 713-719 | M | s** — Interaktiver Text ohne Kerning (Glyphen einzeln), DXF-Import mit Kerning → zwei Geometrien für denselben Text.
8. **text-tool.js:341+719 | M | w** — „Schrifthöhe" = Em-Size statt Versalhöhe → Buchstaben ~30 % kleiner als eingegeben (auch Import von TEXT height).
9. **drawing-tools-ext.js:1282 | G | s** — Hatch-Registrierung überschreibt Pan-Shortcut 'H'.
10. **drawing-tools-ext.js:315-325 | G | m** — Spline-Schließen: Ringschluss-Suche kann fehlschlagen → offener Überhang bis fitPoints[1].

## 8. Mess-/Spezialtools (advanced-tools, measure-tool, dimension-tool)

1. **advanced-tools.js:246-251 (u. 914-917) | K | s** — Fillet/Chamfer an der Wrap-Ecke (cornerIdx=0) aktualisiert den duplizierten Schlusspunkt nicht → alte Ecke bleibt als Endpunkt (Spike/Sliver an der Naht).
2. **dimension-tool.js:455-464 | K | s** — `_findCircleAtPoint`: JEDE geschlossene Kontur ≥8 Punkte gilt als Kreis (ohne Rundheits-Check) → „R55" auf einem Quadrat.
3. **advanced-tools.js (mehrfach) | K | w** — Alle Modifikations-/Array-Tools kopieren Punkte als `{x,y}` und verwerfen `bulge` — auch im Undo-Snapshot → Bögen werden irreversibel zu Sehnen geplättet. (Korrektes Muster: cam-tools.js:983.)
4. **measure-tool.js:740-744 | M | s** — `_bulgeToArc`: Zentrum bei |bulge|>1 auf falscher Chord-Seite (unsignierter d; korrekt: r−sagitta wie dimension-tool.js:529-533) → Overlay/Bounds gespiegelt.
5. **dimension-tool.js:745 | M | w** — `_renderAngular`: Bogen mit −sa/−ea im Welt-Transform → gespiegelter Komplementärbogen, trifft die Pfeile nicht.
6. **advanced-tools.js:762-773 | M | s** — Offset-Seitenwahl ignoriert Umlaufrichtung: bei CCW-Konturen ist Klick-innen/außen exakt invertiert.
7. **advanced-tools.js:1320-1321 | M | s** — Polar-Array: Schritt `totalAngle/count` statt `/(count-1)` → Füllwinkel wird nie erreicht.
8. **advanced-tools.js:428-432, 1026-1028 | M | s** — Endewahl via Segment-Index statt Klickabstand: bei 2-Punkt-Linien wählt FilletTool IMMER 'end', ZeroFilletTool IMMER 'start'.
9. **advanced-tools.js:1615-1631 | M | s** — Lengthen Total/Prozent: Verkürzung > Endsegment faltet die Polyline auf sich zurück (Endpunkt wandert über den vorletzten Vertex hinaus).
10. **measure-tool.js:251+666-675 | G | s** — Bogenlänge tessellierter Bögen = Länge des ±4-Segment-Fensters (zusätzlich auf ≤180° geklemmt), nicht des Bogens.

## 9. UI / Canvas / State (canvas-renderer, snap-manager, undo-manager, properties-panel, layer-manager, tool-manager)

1. ✅ **undo-manager.js:760 | K | s** — `ClipboardManager.cut()` erzeugt DeleteContoursCommand OHNE `app`-Parameter (alle anderen Aufrufer übergeben ihn) → kein deletedContourNames-Tracking: Layer-Toggle baut die ausgeschnittene Kontur wieder auf, sie wird mitgeschnitten; Paste dupliziert zusätzlich.
2. **snap-manager.js:950-955 | M | s** — Tangent-Snap: `baseAngle + π ± α` statt `baseAngle ± α` → Tangentenpunkte auf der kreisabgewandten Seite; gesnappte „Tangente" ist keine.
3. **canvas-renderer.js:343,544-545,2409-2411 | M | s** — Spline-Grip-Undo sichert nur `points`, nicht `_fitPoints` → nach Undo re-tesselliert der nächste Drag die alte Form zurück.
4. **layer-manager.js:239-249 | M | w** — Layer-Sichtbarkeits-Undo flippt nur das Flag; der UI-Flow baut contours via applyLayerSelection physisch neu → nach Strg+Z Auge „sichtbar", Konturen fehlen trotzdem (Snapshot/Command vermischt).
5. **snap-manager.js:488-576 (+renderer:1922-1959) | M | s** — Snapping ohne Layer-Filter: rastet auf unsichtbare/gesperrte Geometrie (Hit-Test filtert korrekt, Snap nicht).
6. **layer-manager.js:172-211 | M | s** — Rename/Delete eines Layers hängt Entities nie um; updateEntityCounts legt den alten Namen automatisch neu an → Rename/Delete „macht sich rückgängig".
7. **snap-manager.js:976-991+1042-1064 | M | s** — `_isAngleInArc` ignoriert Bogenrichtung (testet immer CCW-Bereich) → bei CW-Bulge Quadrant-Snaps auf der leeren Seite, Perpendicular-Fuß verworfen.
8. **undo-manager.js:189-196 | M | w** — `DeleteContoursCommand.undo()` fügt in Selektions- statt Positionsreihenfolge ein → Array-Reihenfolge/cutOrder nach Undo verschoben.
9. **undo-manager.js:525-546 | G | m** — Gruppen-Nesting asymmetrisch: inneres endGroup() schließt die ÄUSSERE Gruppe vorzeitig.
10. **properties-panel.js:63-123 | G | m** — Kontur-Binding über data-idx ohne Revalidierung → nach Undo/Delete trifft die Änderung die falsche Kontur.
- Nebenbefund: layer-manager/canvas-renderer/Move/Rotate/Scale pushen Commands direkt auf undoStack vorbei an execute() (kein _trimStack, ignoriert offene Gruppen).

## 10. Server & Infrastruktur (server.js, lib/, Client-Manager)

> Kontext: App hängt via Cloudflare-Tunnel im Internet. Positiv: Session-Tokens kryptografisch (randomBytes 32), Passwörter scrypt+Salt+timingSafeEqual, Admin-Gate serverseitig, SameSite=Lax.

1. ✅ **server.js:519-527 | K | s** — Static-Handler liefert das GESAMTE Projektverzeichnis ungated aus — inkl. `data/users.json` (Passwort-Hashes+Salts) und `certs/server.key` (TLS-Key). Unauthentifizierter GET genügt. **Sofort fixen: Blockliste für /data, /certs, /lib (+ server.js, .git).**
2. ✅ **lib/auth.js:24 | K | s** — `decodeURIComponent(value)` in parseCookies ohne try/catch; getCurrentUser läuft bei JEDEM Request → `Cookie: x=%` crasht den Prozess.
3. **server.js:412 + lib/user-store.js:54,77,92 | K | s** — Login-Body ungeprüft: Body `null` / username als Zahl / password als Zahl → TypeError in async handleLogin ohne catch → Unhandled Rejection → Prozess-Exit. Crash ohne Login möglich.
4. **server.js:474→360 | K | s** — `%00` im Pfad: decodeURIComponent liefert `\0`, fs.stat wirft SYNCHRON → uncaughtException → Crash (unauthentifiziert).
5. **server.js:510,514 + safePath:202 | K | s** — `?path=a&path=b` → Array → path.resolve TypeError → Crash (eingeloggt).
6. **lib/user-store.js:32-45 | M | w** — users.json: jeder Lesefehler → `[]`, writeFileSync nicht atomar → Crash beim Schreiben kann alle Benutzerkonten still löschen (bootstrapIfEmpty legt neuen Admin an). Fix: temp+rename, Parse-Fehler hart melden.
7. **server.js:206-214 | M | w** — safePath vergleicht realpath gegen nicht-aufgelöstes DXF_ROOT: ist DXF_ROOT selbst ein Symlink, antwortet die ganze DXF-API 403. (Root einmalig realpath-normalisieren.)
8. **lib/session-store.js:20-48 | M | s** — Sessions-Map wächst unbegrenzt (kein Sweep, kein Limit) → Speicherwachstum bis OOM.
9. **document-manager.js:408-432 | M | w** — restoreAll: EIN korrupter IndexedDB-Eintrag → kein aktiver Tab, keine Tab-Leiste (Fallback nur bei size===0).
10. **command-line.js:173-184 | M | s** — `"100,"` → Punkt (100,0) statt Fehler (Number('')===0); Infinity wird akzeptiert.
11. **server.js:496-498 | G | s** — /api/health leakt DXF_ROOT-Pfad an Unauthentifizierte.
12. **project-manager.js:272-292 | G | w** — Auto-Save nur fürs aktive Dokument; unbenannte Tabs teilen sich `zeichnung.bak.dxf` (gegenseitiges Überschreiben).
13. **dxf-browser.js:115-162 | G | w** — currentPath wird vor Fetch-Erfolg persistiert; gelöschtes Verzeichnis → Dialog dauerhaft in Fehler-Sackgasse ohne Breadcrumb.

---

## Empfohlene Reihenfolge

1. **Sofort (Sicherheit/Datenverlust):** §10.1 Static-Blockliste + Key rotieren falls exponiert, §10.2-5 Server-Crash-Pfade, §6.1 File-Handle-Swap, §9.1 cut()-Tracking.
2. **Vor dem nächsten Schneiden:** §6.2 Multi-Material-cutOrder, §5.2/5.3/5.6 WRK-Anwahl/VAKT/G40, §3.1 Nesting-Abstand, §2.1/2.2 Lead-Basis/Center-Pierce, §8.1/8.3 Fillet-Naht/bulge-Verlust.
3. **Kalkulation/Import:** §3.2/3.3 Qualitäts-Off-by-one, §5.7 Anschusszeit, §4.1-5 Import-Fehler.
4. **Rest nach Priorität** (UI/Undo/Snap/Bemaßung).

> Hinweis: §5.4 (Multi-Head) und §6.4 (NEG/POS-Invertierung) brauchen eine fachliche Entscheidung, was gewollt ist, bevor gefixt wird.
