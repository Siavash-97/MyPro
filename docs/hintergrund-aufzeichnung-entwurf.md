# Aufzeichnung im Hintergrund — Entwurf

Stand 20.08.2026. **Nichts davon ist gebaut**, das hier ist der Bauplan.

Ziel: Der Lauf zeichnet weiter auf, wenn der Bildschirm ausgeht, wenn jemand
zur Musik-App wechselt, und wenn Android die Oberfläche wegräumt.

Grundlage: die Recherche in [gps-genauigkeit.md](gps-genauigkeit.md) Teil 3,
die Plugin-Untersuchung vom 20.08.2026, und zwei gelesene Fremdwerke —
`capacitor-community/background-geolocation` (MIT, 522 Zeilen Java) und
`Cap-go/capacitor-background-geolocation` (MPL-2.0, ~1500 Zeilen).

---

## 1. Der Befund, der den Bauplan bestimmt

**Capacitor friert eine im Hintergrund liegende Seite nach fünf Minuten ein.**
Ereignisse, die nativer Code danach an JavaScript schickt, werden gepuffert
statt zugestellt und feuern alle auf einmal, sobald die App wieder sichtbar
wird.

Belegt: [ionic-team/capacitor#6234](https://github.com/ionic-team/capacitor/issues/6234),
eröffnet 19.01.2023, am 24.02.2026 als **„wird nicht behoben"** geschlossen.
Bestätigt vom Autor des kostenpflichtigen Plugins für sein eigenes Produkt:
*„This is not a problem with the plug-in. It's due to Capacitor."*

Daraus folgt die wichtigste Regel dieses Entwurfs:

> **Der Dienst schreibt selbst auf die Platte. JavaScript ist Anzeige, nicht
> Aufzeichnung.**

Ein Dienst, der Punkte nur an JavaScript weiterreicht, verlagert das Problem,
statt es zu lösen. Genau daran scheitern beide gelesenen Fremdwerke: Das
Community-Werk sendet über `LocalBroadcastManager` an die Brücke und speichert
nichts; Capgo schreibt im eigenen Quelltext *„no on-disk queue and no
automatic retry. Failed POSTs are logged and dropped."*

---

## 2. Warum selbst bauen

Der Kauf von `@transistorsoft` ($399 einmalig) ist auf die Zeit nach einer
Förderung verschoben. Damit bleiben zwei Wege, und beide verlangen, dass wir
den schweren Teil selbst verantworten:

**Capgo** wäre kostenlos und wird täglich gepflegt, hat aber keinen Puffer auf
der Platte und verlangt `useLegacyBridge: true` — eine Rückstufung der
Brückensicherheit, die Capacitor selbst als solche benennt und die unseren
Sicherheitsstandards widerspricht. Der Ausweg, die Punkte nativ direkt an
Supabase zu senden, hat eine Falle: Das Anmeldetoken im Kopf der Anfrage
läuft nach einer Stunde ab. Bei einem langen Lauf gingen Punkte verloren, und
niemand merkte es.

**Eigenbau** ist gemessen rund 520 Zeilen Java für unseren Funktionsumfang.
Wir brauchen weder Geofencing noch Sensor-Bewegungserkennung — die haben wir
in JavaScript — noch eine eingebaute Serverübertragung.

Dazu ein Vorteil, der leicht übersehen wird: `Location` liefert ab Android 8
**`getSpeedAccuracyMetersPerSecond()`** — die Güte der Geschwindigkeit selbst.
Kein kostenloses Plugin reicht dieses Feld durch; es ist eines der Merkmale,
mit denen das kostenpflichtige wirbt. Bauen wir selbst, bekommen wir es
geschenkt, und unsere Bewegungserkennung kann Doppler-Werte nach ihrer
eigenen Güte gewichten statt nur nach `accuracy`.

**Was wir dabei nicht geschenkt bekommen** und offen benennen: das Wissen über
Hersteller, die Apps abschießen. Xiaomi, Huawei, Samsung und Oppo beenden
Hintergrund-Apps schärfer, als Android es vorsieht, jeder anders. Das
kostenpflichtige Plugin hat dafür eine fertige API aus elf Jahren
Supportmails. Wir haben sie nicht. Das ist der Punkt, an dem wir den Kauf
wieder aufgreifen sollten, falls es an echten Geräten scheitert.

---

## 3. Aufbau

```
   ┌──────────────────────────────────────────────┐
   │  Android-Dienst (Vordergrund, Typ location)  │
   │                                              │
   │   LocationManager, GPS_PROVIDER              │
   │        │                                     │
   │        ├──► SQLite  (die Wahrheit)           │
   │        │                                     │
   │        └──► Benachrichtigung (Zeit, Strecke) │
   └────────────────┬─────────────────────────────┘
                    │  nur wenn die Seite wach ist
                    ▼
   ┌──────────────────────────────────────────────┐
   │  WebView: Bewegungserkennung, Anzeige,       │
   │  Übertragung an Supabase                     │
   └──────────────────────────────────────────────┘
```

**Der Dienst kennt keine Bewegungserkennung.** Er sammelt rohe Messungen und
legt sie ab. Alles Fachliche — Doppler-Tor, Ruhepegel, Strecke, Pace — bleibt
in [`lib/bewegung.ts`](../myprosole_web/src/lib/bewegung.ts), wo es getestet
ist. Der Umbau fasst diese Logik **nicht** an.

Das ist Absicht: Die Fachlogik gehört dorthin, wo sie prüfbar ist, und Java
ohne Emulator ist es schlecht.

### Warum GPS_PROVIDER statt Fused

Der Fused-Anbieter mischt GPS, WLAN, Mobilfunk und Sensoren und leitet
`speed` teils ab, statt sie zu messen. Für unsere Doppler-Auswertung ist der
rohe GNSS-Wert der richtige. Capgo hat sich ebenfalls dafür entschieden.

Nebeneffekt: keine Abhängigkeit von Google Play Services. Die App läuft dann
auch auf Geräten ohne Google-Dienste.

Preis, offen benannt: kein Rückfall auf andere Quellen. Kein GPS-Empfang,
keine Messung. Für Laufaufzeichnung im Freien ist das richtig; der erste Fix
unter Bäumen dauert länger. Die Anzeige sagt das bereits („Warte auf
GPS-Signal").

### Die Übergabe an JavaScript

Zweistufig, damit kein Punkt verloren geht:

1. JavaScript ruft `punkteAbholen()` → Dienst liefert die offenen Zeilen
2. JavaScript speichert sie und ruft `punkteBestaetigen(ids)`
3. Erst dann löscht der Dienst sie

Ein Absturz zwischen 1 und 3 kostet nichts — die Punkte kommen beim nächsten
Abholen erneut. Doppelt ist harmlos, weg ist es nicht.

Zusätzlich sendet der Dienst jede Messung als Ereignis an JavaScript, **nur
für die Anzeige**. Kommt es nicht an, weil die Seite schläft, ist nichts
verloren — es steht in der Datenbank des Dienstes.

---

## 4. Die neun Fallstricke und unsere Antwort

Jeder stammt aus einem echten Fehlerbericht eines der Fremdwerke.

**1. Der WebView-Einfrierer nach fünf Minuten.**
→ Gelöst durch Abschnitt 3: Der Dienst schreibt selbst. Kein
`useLegacyBridge`, keine Sicherheitsrückstufung.

**2. `startForeground` während der Berechtigungsdialog noch offen ist.**
Führt auf Android 14+ zu `SecurityException`, reproduzierbar **nur beim
allerersten Start** — ein Fehler, den man im eigenen Test meist nicht sieht.
→ Der Dienst wird erst gestartet, nachdem der Berechtigungs-Rückruf
zurückgekommen **und** die Erlaubnis erteilt ist. Nie im selben Zug wie die
Anfrage.

**3. `startForeground` ohne Diensttyp.**
Ab Android 10 gibt es die Überladung mit Typ, ab Android 14 ist sie Pflicht.
Das gelesene Community-Werk importiert `ServiceInfo`, benutzt es aber
nirgends — eine steckengebliebene Anpassung, und genau dazu passen dessen
offene Abstürze.
→ Ab API 29 mit `ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION`, darunter
ohne. Eine Fallunterscheidung, ein Kommentar.

**4. Lambda als `LocationListener` stürzt unter API 30 ab.**
`AbstractMethodError` beim ersten `onStatusChanged`, in Produktion auf
Android 8.1 gesehen. **Wir unterstützen ab Android 7** — das trifft uns
direkt.
→ Eine ausgeschriebene anonyme Klasse mit **allen vier** Methoden, nie ein
Lambda. Mit Kommentar, warum.

**5. Das Benachrichtigungssymbol.**
Ein Rastersymbol ohne transparenten Hintergrund wirft keine Ausnahme, sondern
verursacht drei stille Fehlfunktionen: Die Benachrichtigung wird wegwischbar
— und damit der Dienst beendbar —, das Antippen öffnet die Einstellungen
statt der App, und der Text stimmt nicht. Der fremde Betreuer nennt es selbst
„diese Sprengfalle".
→ Eigenes Vektorsymbol, einfarbig weiß auf transparent, in `res/drawable`.
Wird beim Bauen geprüft.

**6. Kein Dienststart aus dem Hintergrund** (seit Android 12).
→ Trifft uns nicht: Der Nutzer tippt „Lauf starten", die App ist sichtbar.
Aber der Wiederanlauf nach einem Prozessende darf **nicht** versuchen, den
Dienst selbst neu zu starten. `START_STICKY` erledigt das über das System.

**7. Hersteller, die Apps abschießen.**
→ Wir können es nicht verhindern, nur ansprechen: einmalig, beim ersten Lauf,
ein Hinweis mit Knopf in die Akku-Einstellungen. Androids Doku nennt
„uneingeschränkte Akkunutzung" selbst *„the single most effective reliability
measure available on Android"*. Kein Versprechen, das wir nicht halten können.

**8. Prozesstod mit leerem Zustand.**
→ Der Dienst hält nichts Wichtiges im Speicher. Laufkennung und Einstellungen
liegen in `SharedPreferences`, die Punkte in SQLite. Nach dem Neustart durch
`START_STICKY` liest er beides und macht weiter.

**9. Kein HTTP aus dem WebView im Hintergrund.**
→ Übertragen wird erst, wenn die Seite wieder wach ist. Die Punkte warten
solange in SQLite. Bei einem Lauf über eine Stunde sind das rund 3600 Zeilen —
für SQLite nichts.

---

## 5. Die Benachrichtigung

Sie ist Pflicht, aber sie soll nützlich sein.

```
┌────────────────────────────────────────┐
│ ▶  MyProSole zeichnet auf              │
│    12:34 · 2,4 km · 5:08 min/km        │
└────────────────────────────────────────┘
```

- Nicht wegwischbar (`setOngoing(true)`) — das verlangt Android
- Antippen führt **zurück in den laufenden Lauf**, nicht auf die Startseite
- Wird im Takt der Messungen aktualisiert, nicht sekündlich — sonst kostet sie
  selbst Strom
- Eigener Benachrichtigungskanal mit niedriger Wichtigkeit: keine Töne, kein
  Vibrieren, kein Einblenden über anderen Apps

Und sie ist mehr als eine Auflage: Ein dauerhaftes, nicht wegwischbares
Zeichen, dass die App gerade den Standort aufzeichnet, ist genau die
Offenheit, die zum [Schutzkonzept](schutzkonzept.md) gehört.

---

## 6. Berechtigungen

Ins **eigene** Manifest — heute steht dort keine einzige Standortberechtigung,
sie kommt zufällig über das Bluetooth-Plugin herein:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-feature android:name="android.hardware.location.gps" />
```

**`ACCESS_BACKGROUND_LOCATION` kommt bewusst NICHT hinein.**

Google verlangt dafür ein aufwendiges Sonderverfahren mit Video und
inhaltlicher Prüfung. Die Ausnahme beschreibt unseren Ablauf wörtlich: *„The
use of foreground service must be initiated as a continuation of an in-app,
user-initiated action"* und *„must be terminated immediately after the
application completes the intended use case"*.

Daraus eine Bauregel, die eingehalten werden **muss**: Beim Beenden des Laufs
endet der Dienst wirklich. Läuft er weiter, gilt der Zugriff laut Google als
*„equivalent to ACCESS_BACKGROUND_LOCATION"* — und dann greifen die vollen
Anforderungen doch.

### Reihenfolge beim ersten Lauf

1. `ACCESS_FINE_LOCATION` erfragen — mit einem Satz davor, wofür
2. Auf Android 13+ `POST_NOTIFICATIONS` erfragen — sonst sieht niemand die
   Benachrichtigung, und der Dienst wirkt unsichtbar
3. Beide erteilt → Dienst starten
4. Einmalig der Hinweis zur Akku-Einstellung, abstellbar

---

## 7. Was NICHT gebaut wird

Damit es keinen Wildwuchs gibt:

- **Kein Geofencing.** Brauchen wir nicht.
- **Keine Bewegungserkennung im Dienst.** Die steht in JavaScript und ist
  getestet. Der Beschleunigungssensor kommt später — dann als eigener Schritt,
  nicht nebenbei.
- **Keine Serverübertragung im Dienst.** Supabase spricht JavaScript, mit dem
  Anmeldetoken des Nutzers. Nativ nachzubauen hieße, die Token-Erneuerung
  zweimal zu haben.
- **Kein Weiterlaufen nach dem Beenden des Laufs.** Siehe Abschnitt 6 — das
  wäre nicht nur unnötig, es wäre eine andere Rechtslage.
- **Keine Aufzeichnung ohne sichtbaren Start.** Kein Selbststart nach dem
  Hochfahren des Telefons.

---

## 8. Wie geprüft wird

**Was sich ohne Gerät prüfen lässt:** die JavaScript-Seite — Abholen,
Bestätigen, Einordnen in den vorhandenen Ablauf. Kommt zu den 26 Prüfungen
dazu.

**Was nur am Gerät geht**, und zwar in dieser Reihenfolge:

1. **Fünf Minuten Bildschirm aus.** Der einfachste Fall, und genau die Grenze,
   an der es bisher scheitern würde.
2. **45 Minuten Runde**, Bildschirm nach zwei Minuten aus, nach zwanzig
   Minuten eine andere App öffnen.
   **Das Erfolgskriterium sind nicht die Punkte, sondern die Abstände ihrer
   Zeitstempel.** Eine Lücke über 30 Sekunden ist ein Ausfall. Ein Haufen
   gleicher Zeitstempel bei der Rückkehr ist der Beweis, dass die Seite
   geschlafen und dann alles auf einmal ausgespuckt hat.
3. **Fünf Minuten Flugmodus** mitten im Lauf. Trennt „Punkt nie erfasst" von
   „Punkt erfasst, aber beim Senden verloren".
4. **App aus der Übersicht wegwischen**, während der Lauf läuft. Der Dienst
   muss weiterlaufen und die Benachrichtigung stehen bleiben.
5. **Auf einem Nicht-Pixel.** Der Autor des kostenpflichtigen Plugins schreibt
   offen: *„I always develop on Pixel devices."* Wer nur auf Pixel testet,
   testet den einfachen Fall.

Mitgelesen wird über `adb logcat`, nicht über Vermutungen.

---

## 9. Reihenfolge des Bauens

1. Manifest, Berechtigungen, Vektorsymbol
2. Der Dienst: Start, Benachrichtigung, Ortung, SQLite — noch ohne Brücke
3. Am Gerät prüfen, dass er allein läuft (`adb logcat`, `adb shell dumpsys`)
4. Erst dann die Brücke zu JavaScript: abholen, bestätigen, Ereignisse
5. `run.ts` von `watchPosition` auf den Dienst umstellen
6. Prüfungen 1 bis 5 aus Abschnitt 8

Schritt 3 vor Schritt 4 ist wichtig: Wenn der Dienst und die Brücke gleichzeitig
neu sind, weiß bei einem Fehler niemand, welche Hälfte schuld ist.

---

## 10. Was offen bleibt

- **Der Browser-Pfad.** `navigator.geolocation` bleibt für `npm run dev`, als
  Entwicklungshilfe gekennzeichnet. Nutzer bekommen ihn nicht — die Web-App
  wird nicht mehr angeboten.
- **Das iPhone.** Dieser Entwurf ist Android. Auf dem iPhone gilt anderes
  (Hintergrundmodus statt Dienst, keine Benachrichtigungspflicht). Eigener
  Schritt, wenn es soweit ist.
- **Der Kauf des Plugins** bleibt die Rückfallebene, falls es an
  Herstellergeräten scheitert. Zahlen stehen in der Übergabe.
