# Lead-In/Out Überarbeitung — Audit-Ergebnisse & Fix-Plan

> **Datum:** 2026-06-24
> **Status:** Audit abgeschlossen (3 parallele Agenten), Fixes werden jetzt umgesetzt
> **Auslöser:** User-Feedback "Sektion Leads muss überarbeitet werden, hier ist einiges im argen"

---

## Reihenfolge (Priorität)

1. Radius-0-Bug (Root-Cause-Verdacht)
2. Lead-Out Sicherheitsnetz-Parität mit Lead-In
3. Lead-Profile Robustheit & Konfliktschutz
4. Mittel-Punkte (PP Arc-Refit, NaN-Guards, totes Feld)
5. Duplikations-/Kosmetik-Sweep

---

## 1. ✅ Radius-0-Bug — `cam-contour.js` `_calcArcLeadIn`/`_calcArcLeadOut` (ERLEDIGT)

- [x] Bei `leadInRadius === 0` (oder `leadOutRadius === 0`) kollabiert Bogenzentrum exakt auf Entry-/Exit-Punkt → `entryAngle = atan2(0,0) = 0` IMMER, unabhängig von tatsächlicher Schnittrichtung. Lead degeneriert zu Linie Richtung 0°/+X statt tangential zur Kontur.
- [x] Guard eingebaut: bei `radius <= 1e-6` weicht beide Funktionen auf tangentialen Lead aus (Pierce/Endpunkt entlang `tangent`) statt Bogenformel mit Radius 0 zu rechnen.
- [x] Bestätigt: über UI erreichbar (`properties-panel.js:308` `min="0"` für `leadInRadius`).
- [ ] Noch zu verifizieren nach Fertigstellung aller Punkte: Renderer + Postprozessor folgen automatisch (nutzen `arcCenter`/`arcStartAngle` aus cam-contour.js) — manueller Test mit Radius 0 im Wizard ausstehend.

**Betroffene Dateien:** `js/cam-contour.js`

---

## 2. ✅ Lead-Out Sicherheitsnetz-Parität — `cam-contour.js` (ERLEDIGT)

- [x] Alt-Lead-Fallback (<40% Länge) + Center-Exit-Fallback (<0.5mm, via bestehendem `_calcCenterExitLeadOut`) in `getLeadOutPath()` nachgezogen — `_tryAlternativeLeadOut()` neu (Pendant zu `_tryAlternativeLeadIn`).
- [x] Dog-Leg-Routing (Strategy B) für Lead-Out nachgezogen — `_tryDogLegLeadOut()` neu, eingebunden in `checkMultiContourCollision()`. Strategy A (Startpunkt-Rotation) bewusst NICHT für Lead-Out-only-Kollisionen ausgelöst (würde einen bereits passenden Lead-In wieder verändern) — dokumentiert im Code-Kommentar.
- [x] `leadOutType` Switch um `tangent`/`on_geometry` ergänzt (`_calcTangentLeadOut`, `_calcOnGeometryLeadOut` neu) — war über `app.js:3709`/`lead-profiles.js:509` (`leadOutType = leadInType`) tatsächlich erreichbar, da `leadInType` im Properties-Panel alle 4 Typen anbietet.
- [x] Postprozessor VAKT-Asymmetrie geprüft: Speed-Ramping nur beim Lead-In (Beschleunigungsrampe nach dem Anschuss) ist plausibel beabsichtigt — Lead-Out braucht keine Rampe, da bereits auf Normalgeschwindigkeit. Nicht verändert (Praxis-Validierung am Maschinencode wäre nötig, bevor PP-Verhalten geändert wird — siehe CLAUDE.md "Praxis-Validierung").

**Betroffene Dateien:** `js/cam-contour.js`, `js/properties-panel.js`, `js/sinumerik-postprocessor.js`

---

## 3. ✅ Lead-Profile Robustheit & Konfliktschutz — `lead-profiles.js` (ERLEDIGT)

- [x] `applyBatchRules()` crashte bei alten/korrupten Custom-Profilen — `init()` ruft jetzt `_migrateProfile()` auf, ergänzt fehlende `ext/int/alt/smallHole/slit`-Sektionen aus dem Default-Profil, verwirft Profile ohne `id`. Slit-Zweig zusätzlich defensiv mit `profile.slit || {}`. Small-Hole-Check prüft jetzt `profile.smallHole?.thresholdDiameter !== undefined` statt nur Truthy-Check auf `profile.smallHole`.
- [x] Area-Class-Schutz ergänzt: `applyBatchRules()` skippt jetzt Konturen mit `c.areaClassApplied === true` analog zu `leadManualOverride`.
- [x] `isModified()` `extKeys` um `piercingStationaryTime`, `piercingCircularRadius`, `piercingCircularTime`, `leadInLengthMin`, `leadInLengthMax` ergänzt.
- [x] Lead-Out wird jetzt auch im Small-Hole-Zweig (`leadOutType/Radius/Angle`) und Slit-Zweig (`leadOutType = leadInType`) mitgesetzt.
- [x] Magic String zentralisiert in `DEFAULT_PROFILE_ID`-Konstante (ersetzt beide Vorkommen in `init()`/`deleteCustom()`).
- [ ] `smallHole.strategy`-Feld bleibt vorerst totes Konfigurationsfeld — siehe Punkt 4 (Mittel).

**Betroffene Dateien:** `js/lead-profiles.js`, `js/properties-panel.js`

---

## 4. ✅ Mittel (ERLEDIGT)

- [x] PP nutzt jetzt bei unverändertem Arc-Lead (`type==='arc' && !shortened`) die exakten `arcCenter`/`arcRadius`/`arcSweepCCW`-Metadaten direkt für G02/G03 (`_processArcLeadExact()` neu) statt die Tessellierung zu refitten. Gekürzte/alternative/Dog-Leg-Leads fallen weiterhin auf `ArcFitting.fitPolyline()` zurück, da ihre Metadaten nicht mehr zur Punktliste passen.
- [x] NaN/Infinity-Guard bereits vorhanden (`_fc()`, `sinumerik-postprocessor.js:863-871`, seit PP V1.7) — blockiert Export über `_hasFatalError`. Audit-Befund war veraltet, kein Handlungsbedarf.
- [x] Radius-0-Guard bereits durch Punkt 1 abgedeckt (gleiche Fix-Stelle in `_calcArcLeadIn`/`_calcArcLeadOut`).
- [x] `smallHole.strategy` wird jetzt in `applyBatchRules()` ausgewertet — nur `'center_pierce'` (Default) löst die Small-Hole-Regel aus, unbekannte Strategien greifen bewusst NICHT (kein stilles Fallback-Verhalten).
- [x] `getLeadOutPath()` Kommentar ergänzt: offene Konturen (Slit) brauchen keinen Lead-Out, Rückzug erfolgt inkrementell ohne Kerf im PP.

**Betroffene Dateien:** `js/sinumerik-postprocessor.js`, `js/cam-contour.js`, `js/lead-profiles.js`

---

## 5. ✅ Duplikations-/Kosmetik-Sweep (BEARBEITET — bewusst reduzierter Scope)

- [x] **Folgefehler aus Punkt 2 gefixt:** `canvas-renderer.js` `_getLeadColor()` kannte das neue `isFallbackCenterExit`-Flag (Lead-Out-Fallback) nicht — Center-Exit-Fallback hätte die falsche Farbe bekommen. Jetzt analog zu `isFallbackCenterPierce` behandelt.
- [ ] **Bewusst NICHT angefasst** (Risiko/Nutzen-Abwägung — `CLAUDE.md` Prinzip "Minimal Impact"): Konsolidierung `_calcArcLeadIn`/`_calcArcLeadOut` + `*WithFallback`-Varianten, PP Lead-In/Out-Block-Dedup, `toolpath-simulator.js` Helper-Bündelung. Alle drei sind reine Strukturverbesserungen ohne Verhaltensänderung — nach den funktionalen Fixes in Punkt 1–4 ist das Risiko einer Regression durch einen großen Refactor höher als der Nutzen. Empfehlung: separater Techdebt-Sweep nach Praxistest der funktionalen Fixes.
- [ ] **Geprüft, kein Bug:** Dash-Pattern-Redundanz bei gekürzten Arc-Leads (`canvas-renderer.js:1513-1521`) — rein kosmetisch, keine Funktionsgefahr, nicht geändert.
- [ ] **Geprüft, kein Bug:** Uneinheitliche `leadInRadius`-Werte bei `linear`-Profilen in `lead-profiles.js` (teils 0, teils >0) — plausibel als "vorausgefüllter" Radius gedacht, falls User später auf `arc` umschaltet. Kein funktionaler Fehler, nicht geändert.

**Betroffene Dateien:** `js/canvas-renderer.js`

---

## Nach Abschluss (PFLICHT-REGELN beachten!)

- [ ] `build-info.js` — Versionen hochzählen (cam-contour, lead-profiles, sinumerik-pp, canvas-renderer, properties-panel je nach Betroffenheit)
- [ ] Datei-Header in geänderten Modulen aktualisieren
- [ ] `index.html` Cache-Busting `?v=` hochzählen
- [ ] `node scripts/sync-versions.js` + Projekt-Tabelle in CLAUDE.md manuell prüfen
- [ ] `tasks/lessons.md` ergänzen (Radius-0-Bug, Lead-In/Out-Asymmetrie als Lessons)
- [ ] git commit + push
