# FINest-Integration — Phase 4: In-Place-CAD & Teilebibliothek

> Datum: 2026-11-07 · Konzept: `docs/finest-integration-konzept.md` §1.4

## Erledigt
- [x] **Teil bearbeiten**: Planliste → „Teile" → „Bearbeiten" (öffnet die Revision, die im Plan steckt), Teilebibliothek → „Bearbeiten", Autonest-Treffer → „Bearbeiten". Teil wird als DXF in neuem Tab geöffnet (Layer erhalten); Sitzung ist über den Tab-Dateinamen gebunden (`TEIL_<Name>_r<Rev>.dxf`)
- [x] **Teil aktualisieren** (Nesting-Tab → Gruppe Plan): Geometrie des Tabs → neue Teil-Revision (Historie bleibt); Update-Dialog: alle verwandten (optional auch andere Pläne) · nur Teile mit gleicher Transformation · nur die Referenz-Instanz. Warnung bei geändertem Umriss (Plan ggf. neu nesten)
- [x] Server: `POST /api/plans/:id/update-parts` (If-Match), Logik in `plan-update.js`; Instanzen referenzieren Teil + Revision → andere Instanzen behalten ihre Geometrie (kein Fork nötig; `derivedFrom` = alte Revision)
- [x] **Teilebibliothek** (Datei-Tab): Suche/Filter (Name/Auftrag/Kunde/Kommission, Material, Dicke, Status), Vorschau, DXF-Export, Löschen, Nachladen
- [x] UI-Test (jsdom): Plan → Teile → Bearbeiten → Textmarke → Aktualisieren (gleiche Transformation) → Plan-Revisionen geprüft

## Grenzen
- Die Tab-Sitzung hängt am Dateinamen; „Speichern unter" mit anderem Namen löst die Bindung (Hinweis erscheint)
- Textmarken/Gravuren sind als Konturen im Teil (Innenkontur → `hole`); Gravurmodus ohne Durchschnitt nicht modelliert
- Teilebibliothek zeigt Teile (Auftrag = Feld `orderId` am Teil); die separate Auftrags-Liste (`/api/orders`) hat noch keine Oberfläche; XML/Excel-Export fehlt
- Das Löschen eines Teils entfernt die Historie nicht, Pläne bleiben über `?rev=` lesbar

## Offen
- [ ] Auftrags-Export XML/Excel; Aufträge (`orders.json`) beim Import mit anlegen
- [ ] Manuelles Nesting + Mehrfachfenster (Phase 2b)
