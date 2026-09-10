# Übergabe: neues Design in die echte App

Diese Mappe beschreibt, wie die Web-App (`myprosole_web`) auf das neue
Farbsystem umgebaut wird — Paket für Paket, damit ein Agent an klar getrennten
Stücken arbeiten kann und nichts kaputt geht.

**Vorlage ist immer:** `myprosole_app/design/mockups-neue-farben/`
Der Nachbar-Ordner `mockups/` trägt den **alten** Stand und ist nie gemeint.

Zum Anschauen im Browser:
`myprosole_app/design/mockups-neue-farben/showcase.html` zeigt alle Screens
nebeneinander mit Hell/Dunkel-Umschalter.

---

## Die Reihenfolge ist nicht verhandelbar

```
   00 FUNDAMENT          ← zuerst, allein, abnehmen lassen
        │                  Designsystem + App-Hülle. Betrifft ALLE Seiten.
        ▼
   01 STARTSEITE         ← die aufwendigste Seite, aber isoliert
        │
        ├──────────┬──────────┬──────────┐
        ▼          ▼          ▼          ▼
   02 TRAINING  03 VERLAUF  04 PROFIL  05 COMMUNITY
                                          │
                                          ▼
                                   06 UNTERSEITEN
        
   07 ÖFFENTLICHE SEITEN   ← unabhängig, jederzeit möglich
```

**Paket 00 muss fertig und abgenommen sein, bevor irgendeine Seite beginnt.**
Es ändert `AppShell.tsx` und das gemeinsame CSS — beides wirkt auf jede Seite.
Wer das parallel zu einer Seite anfasst, sucht Fehler an der falschen Stelle.

**02 bis 05 sind voneinander unabhängig** und können in beliebiger Reihenfolge
oder parallel laufen — sie berühren verschiedene Dateien.

**06 setzt 05 voraus** (gleiche Komponenten, gleicher kompakter Kopf).

**07 ist von allem unabhängig** — die öffentlichen Seiten haben keine App-Hülle
und keine Navigationsleiste. Gutes Paket zum Warmlaufen.

---

## Die Pakete

| # | Paket | Zieldateien | Umfang |
| --- | --- | --- | --- |
| 00 | [Fundament](00-fundament/) | `styles/components.css`, `layout/AppShell.tsx`, `layout/TopAppBar.tsx` | groß, riskant |
| 01 | [Startseite](01-startseite/) | `pages/Home.tsx` | groß |
| 02 | [Training](02-training/) | `pages/Training.tsx` | mittel |
| 03 | [Verlauf](03-verlauf/) | `pages/History.tsx` | mittel |
| 04 | [Profil](04-profil/) | `pages/Profile.tsx` | mittel |
| 05 | [Community](05-community/) | `pages/Community.tsx`, `CommunityMeetups.tsx`, `CommunityGroups.tsx` | mittel |
| 06 | [Community-Unterseiten](06-community-unterseiten/) | 7 Seiten, u. a. `GroupDetail`, `GroupCreate`, `CommunityProfile` | klein je Seite |
| 07 | [Öffentliche Seiten](07-oeffentliche-seiten/) | `Welcome`, `Login`, `Register`, `ForgotPassword`, `ConfirmEmail`, `Legal` | mittel |

Jedes Paket enthält:

- `*-DESIGN.md` — wie es aussehen soll, plus **welche Daten es wirklich gibt**
- `AGENT-PROMPT.md` — der Auftrag zum Kopieren
- `screenshots/` — hell und dunkel

Dazu einmalig für alle:

- [`PROMPT-REGELN.md`](PROMPT-REGELN.md) — die Regeln, die in **jedem** Paket
  gelten. Die Paket-Prompts verweisen darauf, statt sie zu wiederholen.

---

## Der wichtigste Grundsatz

**Die Zahlen und Texte in den Screenshots sind erfunden.** „31,6 km", „Gesund",
„Regenerationslauf", „Jana", „Frühaufsteher München" — nichts davon übernehmen.

Für jeden angezeigten Wert gilt: Quelle im Code suchen, vorhandene Quelle
benutzen, und **wenn keine da ist: fragen, nicht erfinden.** Jedes Design-Dokument
hat dafür einen Abschnitt „Inhalte — was ist echt, was ist Platzhalter" mit einer
Liste der offenen Punkte, die ich beim Prüfen schon gefunden habe.

---

## Was ich beim Prüfen der echten App gefunden habe

Die App ist **weiter, als die Mockups vermuten lassen**. Die meisten Daten sind
schon da; die Arbeit ist überwiegend gestalterisch, nicht datentechnisch.

Dabei sind vier Stellen aufgefallen, an denen **das Mockup weniger zeigt als
die echte App schon kann** (drei von mir beim Abgleich gegen die öffentliche
Vorschau-Seite, die vierte am 03.09.2026 beim Bau der Register-Scheibe gegen
den Code). Alle vier brauchen eine Entscheidung von dir,
bevor gebaut wird:

| Wo | Die echte App hat … | Das Mockup zeigt … |
| --- | --- | --- |
| **Verlauf** | einen Lauf-Score-Ring (`Run.score`, `md-score`) und je Lauf ein Score-Abzeichen | keinen Score — ich hatte ihn entfernt |
| **Training** | „Diese Woche", „Heute", „Nächste Tage" aus dem Laufplan und einen Routinen-Abschnitt | nur den Übungs-Katalog und die Einlagen-Werbung |
| **Community** | drei Reaktionen je Beitrag: Like, Kommentar, **Goldmedaille** | nur Like und Kommentar |
| **Registrieren** | ein viertes Feld „Passwort bestätigen" samt Gleichheitsprüfung | nur drei Felder — kein Bestätigen-Feld |

Jeweils zwei Möglichkeiten: Das Mockup nachziehen (Funktion bleibt) oder die
Funktion bewusst streichen. Steht in den jeweiligen Design-Dateien nochmal.

---

## Sicherheit

Es ist die echte App mit echten Nutzerdaten.

- Eigener Branch je Paket, nie auf `main`.
- Keine Änderungen an Auth, an Datenbank-Schreibpfaden oder an Migrationen.
  Fehlt ein Feld: melden, nicht selbst anlegen.
- Keine Datei anfassen, die nicht zum Paket gehört.
- `npm run lint` und `npm run test:unit` müssen durchlaufen.

---

## Abnahme je Paket

- [ ] Sieht in **beiden** Themen wie die Screenshots aus
- [ ] Kein fest verdrahteter Inhalt — alles aus Store oder Datenbank
- [ ] Leere Zustände gebaut (keine Daten, kein Plan, keine Verbindung)
- [ ] Kein horizontales Scrollen bei 320 px Breite
- [ ] Jede geteilte CSS-Klasse, die angefasst wurde, ist auf den **anderen**
      Seiten nachgeprüft
- [ ] Offene Punkte beantwortet, nicht geraten
- [ ] Nachweis gezeigt: hell und dunkel
