# Paket 04 — Profil

**Vorlage:** `myprosole_app/design/mockups-neue-farben/profil.html`
**Zieldatei:** `myprosole_web/src/pages/Profile.tsx`
**Voraussetzung:** Paket 00 (Fundament) ist abgenommen.

Gemeinsame Farben, Tokens und der Seitenkopf stehen in
[`../00-fundament/FUNDAMENT-DESIGN.md`](../00-fundament/FUNDAMENT-DESIGN.md).

| Screenshot | Zustand |
| --- | --- |
| `screenshots/01-profil-hell.png` | helles Thema, ganze Seite |
| `screenshots/02-profil-dunkel.png` | dunkles Thema |

> **Das kleinste Paket.** Die echte Seite hat bereits jeden Abschnitt, den das
> Mockup zeigt, mit denselben Bezeichnungen. Zu tun ist im Wesentlichen eins:
> der Avatar-Kopf wandert in die dunkle Fläche.

---

## 1. Die eigentliche Änderung

Heute steht der Avatar in einer eigenen hellen Zeile (`.md-profile-header`)
**unterhalb** der Kopfleiste. Neu sitzt er **im** dunklen Kopf:

```
┌ .md-page-hero ─────────────────────────────────┐
│ MYPROSOLE                     [Thema] [Glocke] │
│  ⬤   Sia                                       │  ← .md-page-hero__profile
│      Konto und persönliche Einstellungen       │     Avatar 52 × 52
└────────────────────────────────────────────────┘
```

Der bisherige helle `.md-profile-header`-Block **entfällt ersatzlos** — sonst
steht der Name zweimal da.

```css
.md-page-hero__profile { display: flex; align-items: center; gap: 8px; }
.md-page-hero__avatar {
  width: 52px; height: 52px; border-radius: 999px;
  background: rgba(255,255,255,0.14);
  color: #FFFFFF;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
```

Die Komponente `Avatar` gibt es schon (`components/ui/Avatar.tsx`) — prüfen, ob
sie sich auf dunklem Grund einfügt, statt sie zu ersetzen.

---

## 2. Der Rest bleibt, wie er ist

Die Seite hat bereits alle Abschnitte in dieser Reihenfolge:

```
  Profil-Hinweis (nur wenn Anamnese offen)
  .md-plan-card        „Kostenlose Version"            [Upgrade]
  Zahlungen & Mitgliedschaft   Mitgliedschaft · Zahlungsmethode · Rechnungen
  Gerät                        Einlage verbinden · kalibrieren · Batterie
  Community                    Sichtbar für ZusammenLauf · Problem melden ·
                               Community-Profil · Meine Gruppen
  Gesundheit                   Zykluskalender
  Einstellungen                Benachrichtigungen · Dunkles Design ·
                               Datenschutz · Nutzungsbedingungen
  Deine Einwilligungen         4 Zeilen mit grüner „Aktiv"-Pille
  Laufverlauf                  Alle Läufe löschen              (in Rot)
  Abmelden
```

Alle bekommen die neuen Farben automatisch über die Tokens. **Keine Struktur
anfassen.**

### Die Einwilligungs-Zeilen

Vier Zeilen mit Titel, Beschreibung, Datum und einer grünen Pille rechts:

```
Gesundheitsdaten                              ⊘ Aktiv
Anamnese, Trainingstagebuch, Zykluskalender · seit 24.8.2026
```

Die Pille:
```css
background: var(--md-success-container);
color: var(--md-on-success-container);
border-radius: 999px;
padding: 3px 10px 3px 8px;
```
mit kleinem Häkchen-Icon davor.

Die Beschriftungen stehen schon in `Profile.tsx` als `ZWECK_LABELS` und
`ZWECK_UMFANG` — sie stimmen **exakt** mit dem Mockup überein. Nicht neu tippen.

### „Alle Läufe löschen"

`.md-settings-row` mit `color: var(--md-error)` und Papierkorb-Icon. Das ist
eine der wenigen berechtigten Rot-Verwendungen: hier wird wirklich etwas
zerstört.

---

## 3. Nicht übernehmen

Das Mockup hat in den Einstellungen zusätzlich **Paletten-Schalter**
(„Logo-Farben (Violett)", „Vital-Farben"). Die waren nur für die Farbabstimmung
da. Set B ist entschieden — sie gehören nicht in die App und sind in der echten
Seite auch nicht vorhanden. Nicht nachbauen.

---

## 4. Offener Punkt: zwei Schalter für dasselbe Thema

Der Kopf trägt oben rechts einen Thema-Umschalter (Sonne/Mond). Die
Einstellungen haben die Zeile „Dunkles Design" mit Schalter. Beide steuern
dasselbe.

**Entweder** beide behalten — dann müssen sie sich gegenseitig spiegeln:
Umschalten im Kopf muss den Schalter unten mitziehen und umgekehrt.
**Oder** die Zeile in den Einstellungen fällt weg.

> Im Mockup war die Spiegelung anfangs kaputt: beide hingen am selben Ereignis,
> liefen in falscher Reihenfolge, und der eine setzte den anderen zurück. Falls
> beide bleiben, ist das die Stelle zum genauen Hinsehen.

Die echte Seite benutzt `designLesen()` / `designUmschalten()` aus
`lib/design.ts`. Diesen Weg verwenden, keinen zweiten bauen.

---

## 5. Inhalte — was ist echt, was ist Platzhalter

### ✅ Vorhanden

| Anzeige | Quelle |
| --- | --- |
| Name und Avatar | `useAuth().profile`, Komponente `Avatar` |
| Tarif-Karte | in `Profile.tsx` gebaut |
| Einwilligungen (4 Zeilen, Datum, Status) | `useEinwilligung()`, `ZWECK_LABELS`, `ZWECK_UMFANG` |
| Sichtbar für ZusammenLauf | `useZusammenlauf()`, `SichtbarkeitsBlatt` |
| Problem melden | `MeldenBlatt` |
| Thema-Schalter | `designLesen()` / `designUmschalten()` |
| Anamnese-Hinweis | `useAnamnese()` |
| Alle Läufe löschen | `useRun()` |
| Rückmeldungen nach Aktionen | `useSnackbar()` |
| Nicht angeschlossene Zeilen | Konstante `NOT_WIRED` — sagen beim Antippen, woran es liegt |

Die Seite ist **datentechnisch vollständig.**

### ⚠️ Zu klären

| Punkt | Frage |
| --- | --- |
| **„Sia" im Kopf** | `profile.display_name`. Was steht dort, solange das Profil lädt oder kein Name gesetzt ist? |
| **Glocke im Kopf** | Wie auf allen Seiten: es gibt kein Benachrichtigungssystem. Weglassen, bis es eins gibt. |
| **Zwei Thema-Schalter** | Siehe Abschnitt 4. |
| **Datum der Einwilligung** | Im Mockup „seit 24.8.2026". Prüfen, welches Feld das liefert und wie es formatiert wird. |

### Leere Zustände

- **Profil lädt** → Avatar und Name?
- **Kein Anzeigename gesetzt** → Platzhalter oder Initiale?
- **Keine Einwilligungen geladen** → Abschnitt ausblenden oder Ladezustand?

---

## 6. Abnahme

- [ ] Avatar und Name sitzen im dunklen Kopf
- [ ] Der alte helle `.md-profile-header`-Block ist **weg** (kein doppelter Name)
- [ ] Alle Abschnitte sind noch da und in derselben Reihenfolge
- [ ] Die grünen „Aktiv"-Pillen sind in beiden Themen lesbar
- [ ] „Alle Läufe löschen" ist rot und fragt vor dem Löschen nach
- [ ] Keine Paletten-Schalter eingebaut
- [ ] Thema-Umschaltung funktioniert, beide Schalter (falls beide bleiben)
      zeigen denselben Stand
- [ ] Hell und dunkel gezeigt
