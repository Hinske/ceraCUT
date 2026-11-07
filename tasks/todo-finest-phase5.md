# FINest-Integration — Phase 5: Kalkulation & PDF-Bericht

> Datum: 2026-11-07 · Konzept: `docs/finest-integration-konzept.md` §1.6

## Erledigt
- [x] `cost-plan.js` V1.0 (`PlanCost.calculate`): Fertigung (Schneiden/Eilgang/Anstechen), Material (Blechgewicht, Verschnitt), Verbrauch (Strom/Wasser/Abrasiv/Düse), Zusatz (Anstich, Rüsten, NC, Arbeit optional), Teile-Einzelpreise (Anteil nach Schnittlänge 60 % / Anstichen 20 % / Fläche 20 %; Material nach Rechteckfläche). Fehlende Preise → Richtwerte, in `defaultsUsed` gemeldet
- [x] `POST /api/reports/cost` (JSON) und `/api/reports/cost-pdf` (pdfkit) — Plan per `planId` oder inline; Teile in exakter Revision, Technologie über `resolve`
- [x] `cost-dialog.js`: Blöcke ein-/ausschaltbar, Zeit/Kosten-Balken, Teiletabelle, PDF; erreichbar aus Autonest und Planliste
- [x] `lib/report-pdf.js`: Kostenübersicht, technische Daten, Zeit/Gewicht, Aufschlüsselung, Plan-Zeichnung, Teileübersicht
- [x] Alter Kalkulations-Button (Ribbon Export) las falsche Felder (`result.totalTime/totalCost/utilization`) → korrigiert

## Offen
- [ ] **Kalibrierung** mit echten Zahlen (Maschinenstundensatz, Abrasiv-/Düsenpreise, Strom/Wasser, Materialpreise) im Technologie-Datensatz (`cost`) bzw. Material (`pricePerKg`) — bis dahin Richtwerte (siehe Hinweis im Dialog/PDF)
- [ ] Eilganglänge ist geschätzt (nächster Nachbar über Teil-Mittelpunkte), nicht aus Schneidreihenfolge/NC
- [ ] Technologie-Manager-Oberfläche (Kosten/Material pflegen) — bisher nur über API
- [ ] Werkstattbericht (Phase 3) als serverseitiges PDF
- [ ] `npm install` auf dem Produktionsserver (neue Abhängigkeit pdfkit)
