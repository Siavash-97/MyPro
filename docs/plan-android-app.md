# Weg zur Android-App — Schritte und Kosten

Entscheidungsvorlage, Stand 17.08.2026. **Hier ist noch nichts gebaut.**

Ziel dieser Runde, wie besprochen: **die bestehende Web-App als Android-App,
die mit der Datenbank arbeitet.** Nicht eine zweite App — dieselbe.
Bluetooth und Hintergrund-GPS kommen danach. Die Auswertung in
`myprosole_app` (Streamlit) wird nicht angefasst, solange es keine Hardware
gibt.

---

## Was sich nicht ändert

Damit klar ist, was hier *kein* Risiko ist:

- **Der Web-App-Code bleibt derselbe.** Capacitor legt einen Ordner `android/`
  daneben und packt den fertigen Build hinein. Es gibt keine zweite Codebasis.
- **Vercel läuft weiter.** Die Web-App unter `my-pro-n38r.vercel.app` bleibt
  unverändert erreichbar und wird weiter aus demselben `main` gebaut.
- **Supabase bleibt dasselbe.** Dieselben Tabellen, dieselben Zeilenregeln,
  dieselben Nutzerkonten. Die Android-App ist ein weiterer Client.
- **Die laufenden Kosten bleiben 0 €.** Supabase Free, MapTiler Free, Vercel
  Hobby.

---

## Schritt 0 — Eine Entscheidung, bevor irgendetwas gebaut wird

**Kosten: 0 €. Dauer: eine Überlegung.**

| Entscheidung | Umkehrbar? |
| --- | --- |
| **App-Kennung**, z. B. `de.myprosole.app` | **Nein.** Nach der ersten Veröffentlichung endgültig – siehe unten. |
| **Name im Store** | Ja, jederzeit. |
| **Play-Konto: Firma oder Privatperson** | **Ja, in eine Richtung.** Privat → Organisation geht später im selben Konto. Zurück nicht. Siehe unten. |

Nur die erste muss also wirklich jetzt fallen.

### Die App-Kennung

Sie steht als `applicationId` in der Build-Datei und sieht aus wie eine
umgedrehte Internetadresse: `de.myprosole.app`. Das ist reine Konvention –
Google prüft nicht, ob dir die Domain gehört.

**Was sie bestimmt:**

| | |
| --- | --- |
| **Identität auf dem Gerät** | Der private Datenordner der App heißt danach. Zwei Apps mit derselben Kennung können nicht nebeneinander bestehen – die zweite *ersetzt* die erste. |
| **Identität im Store** | Einmalig über den gesamten Play Store. **Nach der ersten Veröffentlichung nicht mehr änderbar – und auch nach dem Löschen der App nicht wiederverwendbar.** |
| **Bindung an den Signaturschlüssel** | Kennung und Schlüssel gehören fest zusammen. Ein anderer Schlüssel zur selben Kennung heißt: keine Updates mehr. |
| **Google-Anmeldung** | Der Android-OAuth-Zugang wird auf Kennung + Fingerabdruck des Signaturschlüssels registriert. Die Kennung landet also in der Google-Cloud-Konsole und in den Supabase-Einstellungen. |
| **Deep Links** | Der Rücksprung aus der Google-Anmeldung läuft über ein Schema, das von ihr abgeleitet wird (`de.myprosole.app://…`). Genau das braucht Schritt 2. |
| **Später: Firebase** | Die Konfigurationsdatei ist an die Kennung gebunden. |

**Wer sie wo sieht:**

- **Öffentlich** in der Store-Adresse:
  `play.google.com/store/apps/details?id=de.myprosole.app`. Jeder mit dem Link
  sieht sie.
- **Auf dem Telefon** unter Einstellungen → Apps → App-Info, und über `adb`.
- **In Absturzberichten** und Analysewerkzeugen.
- **Nicht in der App selbst.** Normale Nutzer bekommen sie faktisch nie zu
  Gesicht.

**Was das für die Wahl heißt:** Nimm eine Domain, die euch wirklich gehört.
`myprosole.de` wird im Projektplaner schon als E-Mail-Domain benutzt, also
passt `de.myprosole.app`. Das ist nicht nur Kosmetik: Wenn die
Gruppen-Einladungslinks später direkt in der App aufgehen sollen statt im
Browser, braucht es *verifizierte* Links – und die verlangen, dass ihr die
Domain kontrolliert und dort eine Datei hinterlegen könnt.

Nicht nehmen: `com.example.*` – das weist Google zurück.

### Privat oder Firma

Ich hatte das zuerst als endgültige Entscheidung dargestellt. Das war falsch.

**Privat → Organisation geht später**, im selben Konto, über „Kontotyp ändern"
in der Play Console. Nötig ist dafür ein Zahlungsprofil der Firma mit
**D-U-N-S-Nummer**; nach dem Wechsel sollte man rund 72 Stunden warten, bevor
neue Apps eingereicht werden. **Umgekehrt geht es nicht** – von Organisation
zurück auf privat müsste man ein neues Konto anlegen.

Der eigentliche Unterschied: Bei Privatkonten, die nach dem 13.11.2023
angelegt wurden, verlangt Google vor dem Schritt **in die Produktion** einen
geschlossenen Test mit zwölf Testern über vierzehn zusammenhängende Tage.
Organisationskonten sind davon ausgenommen.

**Wichtig für euren Fall:** Diese Hürde steht vor der *Produktion*, nicht vor
dem internen Test. Für bis zu 100 eigene Tester spielt sie keine Rolle.

Belege:
[Kontotyp wählen](https://support.google.com/googleplay/android-developer/answer/13634885),
[Testanforderungen für neue Privatkonten](https://support.google.com/googleplay/android-developer/answer/14151465),
[Kontodaten aktuell halten](https://support.google.com/googleplay/android-developer/answer/13634888).

---

## Schritt 1 — Capacitor einrichten

**Kosten: 0 €. Aufwand: 1 Tag.**

- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` als Abhängigkeiten
- `capacitor.config.ts` mit Kennung, Name und `webDir: 'dist'`
- `npx cap add android` legt den Ordner `android/` an
- Bauen: `npm run build && npx cap sync && npx cap open android`

**Ergebnis:** Eine installierbare Debug-APK auf deinem Telefon. Die App
startet, zeigt die Oberfläche, lässt sich bedienen.

**Was hier noch nicht geht:** Anmelden mit Google, teilen, Sprachnachrichten.
Siehe Schritt 2 und 3 — das ist erwartbar, nicht kaputt.

---

## Schritt 2 — Die Datenbank aus der App heraus

**Kosten: 0 €. Aufwand: 1–2 Tage.**

Das ist dein eigentliches Ziel, und es ist *nicht* automatisch da. Der Grund:
In der Hülle heißt die Adresse der App nicht mehr
`https://my-pro-n38r.vercel.app`, sondern etwas wie `https://localhost`. Alles,
was an dieser Adresse hängt, muss angefasst werden.

Ich habe nachgesehen, welche Stellen das sind:

| Stelle | Was heute passiert | Was zu tun ist |
| --- | --- | --- |
| [`store/auth.ts:82`](../myprosole_web/src/store/auth.ts) | Google-Anmeldung springt zurück nach `window.location.origin` | In der Hülle wäre das `localhost` — der Nutzer landet im Browser statt in der App. Braucht einen Deep Link (`intent-filter` im Manifest) und dieselbe Adresse in den Supabase-Einstellungen. |
| [`pages/GroupDetail.tsx:70`](../myprosole_web/src/pages/GroupDetail.tsx) | Einladungslink für Gruppen wird aus `window.location.origin` gebaut | Aus der App käme `https://localhost/...` heraus — ein Link, den niemand öffnen kann. Muss fest auf die Web-Adresse zeigen. |
| Supabase-Sitzung | liegt in `localStorage` | Im WebView kann das System den Speicher leeren; man wäre dann ausgeloggt. Gehört in `@capacitor/preferences`. |
| E-Mail/Passwort-Anmeldung | — | Funktioniert sofort, ohne Änderung. |

**Ergebnis:** Anmelden, Profil und Läufe lesen und schreiben — aus der
installierten App, gegen dieselbe Datenbank.

---

## Schritt 3 — Was das WebView anders macht als der Browser

**Kosten: 0 €. Aufwand: 1–2 Tage.**

Vier Stellen der App benutzen Browserfunktionen, die in einer nativen Hülle
nicht oder anders vorhanden sind. Jede ist ein Einzeiler-Austausch gegen ein
Capacitor-Plugin, aber jede fällt sonst still aus:

| Stelle | Funktion | In der Hülle |
| --- | --- | --- |
| [`pages/SocialStudio.tsx:110`](../myprosole_web/src/pages/SocialStudio.tsx) | `navigator.share` | **Gibt es im WebView nicht.** Teilen bricht ab. → `@capacitor/share` |
| [`pages/GroupDetail.tsx:72`](../myprosole_web/src/pages/GroupDetail.tsx) | `navigator.clipboard` | Eingeschränkt. → `@capacitor/clipboard` |
| [`pages/RunChat.tsx:222`](../myprosole_web/src/pages/RunChat.tsx) | Mikrofon für Sprachnachrichten | Braucht `RECORD_AUDIO` im Manifest und einen Laufzeit-Dialog |
| [`pages/LiveTracking.tsx:50`](../myprosole_web/src/pages/LiveTracking.tsx) | `navigator.geolocation` | Läuft, braucht aber `ACCESS_FINE_LOCATION` im Manifest und den Berechtigungsdialog |

Dazu drei Dinge, ohne die es sich wie eine Webseite anfühlt statt wie eine App:

- **Zurück-Taste des Telefons** muss in der App navigieren, nicht die App
  schließen
- **Profilbild und Community-Fotos**: Der Dateidialog verhält sich im WebView
  anders → `@capacitor/camera`
- **Icon und Startbildschirm**

**Ergebnis:** Alles, was die Web-App kann, kann auch die Android-App.

---

## Schritt 4 — Signieren und verteilen

**Kosten: 25 USD einmalig. Aufwand: 1–2 Tage, plus Wartezeit bei Google.**

- **Keystore anlegen** und sicher ablegen — **nicht ins Repository.** Eine
  App-Kennung hängt an genau einem Signaturschlüssel; wer ihn verliert, kann
  die App nie wieder aktualisieren und zwingt jeden Nutzer zur Neuinstallation.
  **Play App Signing einschalten**, dann ist der Upload-Schlüssel ersetzbar.
- **Google Play Console: 25 USD**, einmalig, lebenslang gültig.
- **Internes Testing**: bis 100 Tester, Freigabe in Minuten. Debug-Builds nimmt
  der Store nicht — ab hier sind es Release-Builds.
- **Datenschutzerklärung und „Data Safety"-Formular**: Pflicht, und bei
  Gesundheitsdaten nach Art. 9 kein Formalismus. Rechne mit Rückfragen.

**Ergebnis:** Die App landet über den Store auf fremden Telefonen und
aktualisiert sich selbst.

---

## Aufgabenliste bis einschließlich Schritt 3

Zum Abhaken. Jede Aufgabe ist einzeln prüfbar; die App bleibt nach jedem
Abschnitt lauffähig.

### Schritt 1 — Capacitor einrichten · **erledigt am 17.08.2026**

- [x] `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` hinzugefügt
      (Capacitor 8.5.0)
- [x] `capacitor.config.ts`: `appId: 'com.myprosole.app'`, `appName:
      'MyProSole'`, `webDir: 'dist'`
- [x] `npx cap add android` — der Ordner `myprosole_web/android/` steht
- [x] `.gitignore` geprüft — **und korrigiert**, siehe unten
- [x] npm-Skripte `android:sync` und `android:open`
- [x] Gegenprobe: Testsuite 7/7, Web-Build unverändert grün, an
      `src/`, `vite.config.ts` und `vercel.json` nichts geändert
- [ ] Erster Debug-Build per Kabel aufs Telefon — braucht Android Studio,
      offen

**Der Fund beim `.gitignore`.** Die Android-Vorlage, die Capacitor mitbringt,
lässt die Zeilen für Signaturschlüssel **auskommentiert**:

```
# Uncomment the following lines if you do not want to check your keystore files in.
#*.jks
#*.keystore
```

Ein Schlüssel wäre also mitcommittet worden. Wer ihn hat, kann Updates unter
unserer App-Kennung veröffentlichen. Die Zeilen sind jetzt aktiv, dazu
`keystore.properties`. Das war kein Zufallsfund: Genau dafür steht der Punkt
in der Aufgabenliste.

**Zur App-Kennung.** Entschieden: `com.myprosole.app`. Zum Vergleich —
Strava nutzt `com.strava`, komoot `de.komoot.android`, adidas Running
`com.runtastic.android` (aus der Zeit vor der Übernahme, weil sich die
Kennung nach der Veröffentlichung nicht mehr ändern lässt).

**Neue Abhängigkeiten, wie es die Regel verlangt.** `npm audit` meldet drei
Funde mittleren Grades, alle auf demselben Pfad:
`@capacitor/cli` → `xcode` → `uuid`. Betroffen ist die Kommandozeile, nicht
die ausgelieferte App, und `xcode` bearbeitet iOS-Projektdateien, die es hier
nicht gibt. Kein Grund zu blockieren, aber festgehalten statt übersehen.

### Schritt 2 — Datenbank aus der App heraus

- [ ] Supabase-Sitzung von `localStorage` auf `@capacitor/preferences`
      umstellen (eigener Speicher-Adapter, im Web unverändert)
- [ ] Anmeldung mit E-Mail und Passwort auf dem Gerät prüfen
- [ ] Deep-Link-Schema `de.myprosole.app://` im `AndroidManifest.xml`
- [ ] [`store/auth.ts`](../myprosole_web/src/store/auth.ts): `redirectTo` je
      nach Plattform — Web-Adresse im Browser, Schema in der App
- [ ] Supabase-Verwaltung: die neue Rücksprungadresse eintragen
- [ ] Google Cloud: Android-OAuth-Zugang auf App-Kennung **und
      SHA-1-Fingerabdruck** anlegen — zuerst für den Debug-Schlüssel, später
      zusätzlich für den Play-Schlüssel
- [ ] Google-Anmeldung auf dem Gerät prüfen: springt sie in die App zurück?
- [ ] [`GroupDetail.tsx`](../myprosole_web/src/pages/GroupDetail.tsx):
      Einladungslink auf eine feste Web-Adresse statt `window.location.origin`
- [ ] Durchgang: Lauf aufzeichnen, speichern, im Verlauf wiederfinden;
      Profil ändern; Beitrag im Feed anlegen

**Fertig, wenn:** Beide Anmeldewege funktionieren auf dem Gerät, und ein Lauf
liegt danach nachweislich in der Datenbank.

### Schritt 3 — Was das WebView anders macht

- [ ] Berechtigungen ins Manifest: `ACCESS_FINE_LOCATION`, `RECORD_AUDIO`,
      Kamera/Fotos
- [ ] Laufzeit-Dialoge, und ein verständlicher Zustand, wenn abgelehnt wird
- [ ] `navigator.share` → `@capacitor/share`
      ([SocialStudio](../myprosole_web/src/pages/SocialStudio.tsx))
- [ ] `navigator.clipboard` → `@capacitor/clipboard`
      ([GroupDetail](../myprosole_web/src/pages/GroupDetail.tsx))
- [ ] Mikrofon und Aufnahme auf dem Gerät prüfen
      ([RunChat](../myprosole_web/src/pages/RunChat.tsx))
- [ ] Dateiauswahl für Profilbild und Community-Fotos → `@capacitor/camera`
- [ ] Zurück-Taste des Telefons: navigiert in der App, schließt sie nicht
- [ ] Sichere Ränder: Die Oberfläche darf nicht unter Status- und
      Navigationsleiste laufen
- [ ] App-Icon und Startbildschirm
- [ ] Standort auf dem Gerät prüfen: Live-Tracking zeichnet auf

**Fertig, wenn:** Jede Funktion, die im Browser geht, geht auch in der App —
auf einem echten Gerät nachgewiesen, nicht im Emulator.

### Regeln, die für alle drei Schritte gelten

- **Die Web-App darf nicht schlechter werden.** Capacitor-Plugins bringen eine
  Web-Umsetzung mit; ein Aufruf, zwei Plattformen. Wo es keine gibt, wird
  abgefragt statt verzweigt kopiert.
- **Eine Aufgabe pro Änderung**, Testsuite grün, bevor die nächste beginnt.
- **Kein Schlüssel und keine Kennung ins Repository.**

---

## Danach — nicht Teil dieser Runde

| Schritt | Kosten | Wann |
| --- | --- | --- |
| **Bluetooth / Einlage** | 0 € (`@capacitor-community/bluetooth-le`) | Sobald es Firmware gibt. Ohne Hardware nicht sinnvoll testbar. |
| **Hintergrund-GPS + Absicherung gegen Datenverlust** | 0 € mit `@capgo/background-geolocation` | Wenn Läufe mit dem Handy in der Tasche aufgezeichnet werden sollen. Die beiden Teile gehören zusammen — siehe [Bewertung](bewertung-web-app-zu-echter-app.md). |
| **Ersatz-Plugin Transistorsoft** | 399 USD | **Nur falls** Capgo im Test auf Samsung/Xiaomi nicht trägt. Entscheidung nach dem Test. |
| **Auswertungs-Schnittstelle (FastAPI)** | 0 € | Wenn es echte Messungen gibt. |
| **iOS** | 99 USD/Jahr + Mac | Wenn jemand danach fragt. |
| **Supabase Pro** | 25 USD/Monat | Wenn die Datenbank wirklich voll läuft — nach der Umstellung des GPS-Datenmodells dauert das lange. |

---

## Kosten zusammengefasst

| Was | Wann fällig | Betrag |
| --- | --- | --- |
| Schritte 0 bis 3 | — | **0 €** |
| Google Play Console | erst beim Verteilen an andere (Schritt 4) | **25 USD einmalig** |
| Laufender Betrieb | — | **0 €/Monat** |
| **Bis zur ersten installierten App auf deinem Telefon** | | **0 €** |
| **Bis zur App auf fremden Telefonen** | | **25 USD** |

Alles andere in der Liste oben kostet erst dann, wenn es tatsächlich gebraucht
wird — kein Konto, das brachliegt.

**Aufwand gesamt für die Schritte 1 bis 4: etwa 4 bis 7 Arbeitstage**, ohne
Bluetooth und ohne Hintergrund-GPS.

---

## Was ich vor Schritt 1 von dir brauche

1. **App-Kennung** — Vorschlag: `de.myprosole.app`. Das ist die einzige
   endgültige Festlegung.
2. **Freigabe für Schritt 1** — er fügt Abhängigkeiten und den Ordner
   `android/` hinzu und ändert sonst nichts an der Web-App.

Nicht jetzt nötig: der Kontotyp. Für die Schritte 1 bis 3 braucht es
**überhaupt kein Play-Konto** — Debug-Builds gehen per Kabel direkt aufs
Telefon. Die Frage stellt sich erst bei Schritt 4, und sie ist dann immer noch
in eine Richtung korrigierbar.

Offen und noch nicht eingespielt: die Migration **0029** (0028 ist erledigt).
Solange sie fehlt, scheitert jede Einwilligung — auch in der Android-App.
