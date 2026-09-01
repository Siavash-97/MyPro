# Entwürfe in Arbeit

Hier liegt, was **noch nicht fertig** ist. Der Unterschied zu den beiden
anderen Ordnern:

| Ordner | Was er ist |
| --- | --- |
| `mockups/` | Die geprüfte Sammlung. Zehn Regelsätze der Prüfsuite laufen über jede Datei darin, und jeder Name steht in `EXPECTED_MOCKUPS`. |
| `mockups-neue-farben/` | Eine **fertige, kuratierte** Sammlung mit eigenem Index (`index.html#einstieg`). Kein Sammelbecken für laufende Arbeit. |
| `mockups-entwurf/` | **Dieser Ordner.** Laufende Arbeit, ungeprüft, ohne Anspruch auf Vollständigkeit. |

## Was hier gilt

- **Die Prüfsuite fasst diesen Ordner nicht an.** `MOCKUPS_ROOT` in
  `tests/test_design_mockups.py:13` zeigt fest auf `design/mockups`, und die
  zehn Regelsätze laufen über `MOCKUPS_ROOT.glob("*.html")` — nicht rekursiv.
  Nachgesehen am 25.08.2026.
- **Ausnahme, harmlos:** Ein Test läuft rekursiv über `design/` und prüft nur
  die Dateigröße gegen Cloudflares 25-MB-Grenze.

## Was hier NICHT gilt: privat

`scripts/deploy_prototype.py` lädt den **gesamten** `design/`-Baum hoch
(`UPLOAD_ROOT.rglob("*")`), ausgeschlossen sind nur `.pdf`, `.docx`, `.xlsx`,
`.pptx`, `.csv`, `.env`, `.key`, `.pem`. **HTML nicht.**

Nach einem Prototyp-Deploy ist alles hier unter
`https://main.myprosole-prototyp.pages.dev/mockups-entwurf/…` erreichbar.
`X-Robots-Tag: noindex` hält es aus Suchmaschinen, aber wer die Adresse hat,
sieht es.

**Also: nichts hier ablegen, was niemand sehen soll.** Ein Ausschluss im
Deploy-Skript ist ein offener Punkt, kein gebauter Zustand.

## Der Weg nach `mockups/`

Wird ein Entwurf zum echten Bildschirm, sind zehn Regelsätze zu erfüllen —
unter anderem `<meta name="color-scheme" content="only light">`, Manifest,
Service-Worker-Anmeldung — und der Name gehört in `EXPECTED_MOCKUPS`. Das ist
eine eigene Aufgabe mit dem Agenten `oberflaeche`, nicht ein Verschieben.
