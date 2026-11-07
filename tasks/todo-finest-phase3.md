# FINest-Integration — Phase 3: NC erstellen, NC-Editor, Werkstattbericht

> Datum: 2026-11-07 · Konzept: `docs/finest-integration-konzept.md` §1.3

## Erledigt (nc-tools V1.0)
- [x] `NCCheck`: Sinumerik-840D-Parser (MPF/SPF, N-Nummern, G90/G91, G41/G42, I/J inkremental), Schnitt-/Eilganglänge, Grenzen, Struktur (M30/M17, IF/ENDIF, Sprungmarken), Kreis-Konsistenz, NaN. Geprüft an der Waricam-Referenz und 250 zufälligen Dateien aus /mnt/cnc (keine Fehlalarme) sowie am eigenen Postprozessor-Output
- [x] `NCEditor`: Zeilennummern, Befehlserklärung + Position je Zeile, Prüfliste (Klick springt zur Zeile), Speichern (Server-CNC, sonst Download), Zurücksetzen
- [x] `NCDialog` „NC erstellen" (Tab Export): Name, Editor an/aus, Bericht an/aus; Validierung wie CNC Export
- [x] Werkstattbericht (HTML im Modal → Drucken / als PDF speichern)

## Entscheidungen / Grenzen
- Sinumerik kennt keine laufende Programmnummer, das Programm heißt wie der Plan (`%_N_<NAME>_MPF`) → keine Programmnummer-Vergabe (FINest „Program No." entfällt)
- Mehrere Zuschnitte (Fliesenbogen) → weiterhin „CNC Export" (eine Datei je Fliese); NC erstellen meldet das
- Bericht über Browser-Druckdialog; serverseitiges PDF (pdfkit) kommt mit Phase 5 (Kalkulation + Bericht)

## Offen
- [ ] Simulation Zeile ↔ Bahn (Split-View) und Skip/Pause/Next/Feed-Regler im Simulator
- [ ] Werkzeugfolge / Entnahmeposition / Etiketten (FINest „Create NC"-Reiter)
- [ ] Praxistest auf der Maschine (Kollisionsprüfung) — siehe CLAUDE.md Prio 1
