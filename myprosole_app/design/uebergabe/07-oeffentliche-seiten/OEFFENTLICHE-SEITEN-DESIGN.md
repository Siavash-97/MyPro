# Paket 07 — Öffentliche Seiten

**Voraussetzung:** nur Paket 00, und davon nur der CSS-Teil (`.md-divider`).
**Nicht** der Umbau der App-Hülle — diese Seiten haben keine.

> **Das unabhängigste Paket.** Es berührt keine App-Hülle, keine
> Navigationsleiste und keinen dunklen Seitenkopf. Gut geeignet, um mit dem
> Vorgehen warm zu werden, bevor die riskanteren Pakete drankommen.

| # | Screenshot | Vorlage | Zieldatei |
| --- | --- | --- | --- |
| 1 | `01-willkommen.png` | `welcome.html` | `Welcome.tsx` |
| 2 | `02-login.png` | `login.html` | `Login.tsx` |
| 3 | `03-registrieren.png` | `register.html` | `Register.tsx` |
| 4 | `04-passwort-vergessen.png` | `passwort-vergessen.html` | `ForgotPassword.tsx` |
| 5 | `05-email-bestaetigen.png` | `confirm-email.html` | `ConfirmEmail.tsx` |
| 6 | `06-agb.png` | `agb.html` | `Legal.tsx` (Route `/agb`) |
| 7 | `07-datenschutz.png` | `datenschutz.html` | `Legal.tsx` (Route `/datenschutz`) |

Dazu gibt es `PasswortNeu.tsx` (`/passwort-neu`), für das **kein Entwurf
existiert** — siehe Abschnitt 5.

---

## 1. Willkommen

Die einzige Seite mit einem Vollbild-Hintergrund: ein Laufvideo bzw. ein
Standbild, darüber ein dunkler Verlauf, darauf Logo und die zwei Einstiege.

```
┌────────────────────────────────────────┐
│                                        │
│         [Hintergrundvideo]             │
│                                        │
│              ⬤ Logo                    │
│            MYPROSOLE                   │
│   Deine Lauftechnik, verständlich      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  G   Mit Google fortfahren       │  │  .md-oauth-button
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  ✉   Mit E-Mail fortfahren       │  │  .md-oauth-button--outline
│  └──────────────────────────────────┘  │
│  Ich habe bereits ein Konto · Anmelden │
└────────────────────────────────────────┘
```

**Genau zwei Knöpfe** — Google und E-Mail. Die Live-Seite hat keinen
Facebook-Einstieg; im Entwurf war er ursprünglich drin und wurde entfernt.
Nicht wieder einbauen.

> Der Video-Hintergrund holt sich Daten abschnittsweise. Der Service Worker der
> Mockups lässt solche Anfragen bewusst durch, statt sie zwischenzuspeichern —
> sonst kommt das Video nie an. Falls die App einen Service Worker hat, dort
> dieselbe Ausnahme prüfen.

---

## 2. Anmelden und Registrieren

Beide gleich aufgebaut: Zurück-Pfeil, Titel, Formular, Trennlinie, Google-Knopf,
Wechsel-Link nach unten.

```
  ←
  Willkommen zurück
  Melde dich an, um deinen Fortschritt zu sehen.

  E-Mail        [ name@beispiel.de        ]
  Passwort      [ Dein Passwort           ]
  Passwort vergessen?
  [            Anmelden                   ]
  ──────────────  oder  ──────────────         ← .md-divider
  [  G   Mit Google anmelden               ]
  Noch kein Konto? Registrieren
```

Die Trennlinie ist neu und kommt aus Paket 00:

```css
.md-divider { display: flex; align-items: center; gap: 8px;
              color: var(--md-on-surface-variant); font: var(--type-body-md); }
.md-divider::before, .md-divider::after {
  content: ""; flex: 1; height: 1px; background: var(--md-outline-variant);
}
```

**Registrieren** hat zusätzlich das Feld „Name" und darunter das Kästchen:

> Ich akzeptiere die **Nutzungsbedingungen** und die **Datenschutzerklärung**.

Beide Wörter sind echte Links auf `/agb` und `/datenschutz` — im Entwurf waren
das anfangs tote Platzhalter (`href="#"`), das ist korrigiert. Bitte so lassen.

---

## 3. Passwort vergessen · E-Mail bestätigen

Zwei schlichte Seiten:

- **Passwort vergessen** — Zurück-Pfeil zur Anmeldung, ein E-Mail-Feld, Knopf
  „Link senden", darunter „Zurück zur Anmeldung".
- **E-Mail bestätigen** — Briefsymbol, „Prüfe dein Postfach", sechs Felder für
  den Code, Knopf „Bestätigen", darunter „Code erneut senden".

Beim Code-Feld auf die Tastatur achten: numerisch, und Einfügen aus der
Zwischenablage muss die sechs Stellen verteilen, statt alle in das erste Feld
zu schreiben.

---

## 4. Rechtstexte

`agb.html` und `datenschutz.html` benutzen eine eigene kleine Klasse `.md-legal`,
die **nur auf diesen beiden Seiten** vorkommt:

```css
.md-legal { padding: 0 24px 32px; display: flex;
            flex-direction: column; gap: 24px; }
```
dazu `__stand` (Datumszeile), `__draft-note` (Entwurfshinweis), `__callout`
(hervorgehobener Absatz) und `__data-list` (`<dl>` für Aufzählungen).

Die Datenschutz-Seite hebt den Absatz zur **Einwilligung in
Gesundheitsdaten (DSGVO Art. 9)** in einem violetten Kasten hervor. Das ist
hier kein Verstoß gegen die Farbregel: Violett steht für die
Einlagen-Auswertung, und genau darum geht es in diesem Absatz.

> **Der Text ist Rechtstext.** Wortlaut nicht umformulieren, nicht kürzen, nicht
> „schöner" machen. Nur die Darstellung ändern. Steht im Entwurf ein Hinweis,
> dass der Text noch nicht anwaltlich geprüft ist, bleibt der stehen.

Beide Seiten sind auch **ohne Anmeldung** erreichbar und müssen es bleiben —
sie sind von der Registrierung aus verlinkt.

---

## 5. Inhalte

Diese Seiten haben kaum dynamische Inhalte — sie sind Formulare und feste Texte.
Entsprechend wenig ist zu klären.

### ✅ Vorhanden

| Anzeige | Quelle |
| --- | --- |
| Anmelden / Registrieren / Abmelden | `store/auth.ts`, Supabase-Auth |
| Google-Einstieg | im Auth-Store |
| Passwort zurücksetzen | `ForgotPassword.tsx` / `PasswortNeu.tsx` |
| E-Mail-Bestätigung | `ConfirmEmail.tsx` |
| Rechtstexte | `Legal.tsx` |

### ⚠️ Zu klären

| Punkt | Frage |
| --- | --- |
| **`PasswortNeu.tsx`** | Für diese Seite gibt es **keinen Entwurf**. Sie kommt aus der E-Mail mit dem Zurücksetz-Link. Vorschlag: gleicher Aufbau wie „Passwort vergessen", zwei Passwortfelder. Soll ich einen Entwurf nachliefern? |
| **Fehlermeldungen** | Die Entwürfe zeigen keinen Fehlerfall. Falsches Passwort, E-Mail schon vergeben, Link abgelaufen — wie sehen die aus? Regel: Meldung **am Feld**, nicht nur oben gesammelt. |
| **Video auf der Willkommen-Seite** | Liegt die Datei schon im Projekt, oder ist im Entwurf nur ein Platzhalter? |
| **Stand-Datum der Rechtstexte** | Fest im Text oder gepflegt? |

### Fehlerdarstellung

Das ist der einzige Punkt dieses Pakets, an dem echtes Nachdenken nötig ist. Aus
den Projektregeln:

- Meldung direkt beim betroffenen Feld, nicht nur als Sammelmeldung oben
- Rot ist hier **richtig** — es ist ein technischer Fehler, kein körperlicher
  Befund
- Farbe nie allein: Text dazu, und das Feld über `aria-invalid` kennzeichnen
- Kein Verschwinden beim Tippen, bevor es erneut geprüft wurde

---

## 6. Abnahme

- [ ] Willkommen hat **genau zwei** Einstiege (Google, E-Mail) — kein Facebook
- [ ] Anmelden und Registrieren haben die „oder"-Trennlinie und den Google-Knopf
- [ ] Die AGB- und Datenschutz-Links im Registrieren-Kästchen führen wirklich
      dorthin
- [ ] Rechtstexte im Wortlaut unverändert
- [ ] Rechtstexte ohne Anmeldung erreichbar
- [ ] Code-Eingabe: numerische Tastatur, Einfügen verteilt die Stellen
- [ ] Fehlerfälle sind gebaut und stehen am Feld
- [ ] Hell und dunkel gezeigt
