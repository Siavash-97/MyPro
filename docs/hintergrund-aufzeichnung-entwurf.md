# Aufzeichnung im Hintergrund — Entwurf

Stand 20.08.2026. Abschnitte 1 bis 10 sind der **Bauplan**, Abschnitt 11 der
**Baubericht**: was tatsächlich dasteht, was jedes Teil tut, und was am Gerät
gemessen wurde. Wo das Gebaute vom Plan abweicht, steht die Abweichung
ausdrücklich dabei.

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
│ ◉  MyProSole zeichnet auf              │
│    0:12:34 · GPS aktiv                 │
└────────────────────────────────────────┘
```

**Beim Bauen geändert: keine Strecke, keine Pace.** Der ursprüngliche Entwurf
sah beides vor. Der Dienst kennt sie aber nicht — sie entstehen aus der
Bewegungserkennung in JavaScript, und die schläft im Hintergrund. Die letzten
bekannten Werte stehenzulassen hieße, eine eingefrorene Zahl zu zeigen, die
aussieht wie eine Messung. Genau das haben wir in der App schon abgeschafft.

Zeit und Empfang kennt der Dienst selbst. Beides stimmt immer.

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

---

## 11. Was gebaut ist — Teil für Teil (20.08.2026)

Bis hierher war dieses Dokument ein Bauplan. Ab hier steht, was tatsächlich
dasteht und was jedes einzelne Teil tut.

### Die Dateien

| Datei | Zeilen | Aufgabe |
|---|---|---|
| `aufzeichnung/AufzeichnungsDienst.java` | 640 | Sammelt Messungen, hält sich am Leben, zeigt die Benachrichtigung |
| `aufzeichnung/PunkteSpeicher.java` | 220 | SQLite — hier liegt die Wahrheit |
| `aufzeichnung/AufzeichnungPlugin.java` | 220 | Die Brücke nach JavaScript |
| `MainActivity.java` | 54 | Meldet das Plugin an, nimmt den Beenden-Wunsch entgegen |
| `res/layout/benachrichtigung_lauf.xml` | 80 | Die eine Reihe: Name, Uhr, zwei Kreise |
| `res/drawable/ic_aufzeichnung.xml` | | Zeichen für die Statusleiste |
| `res/drawable/ic_{pause,weiter,beenden}_schwarz.xml` | | Die Glyphen in den Kreisen |
| `res/drawable/knopf_kreis_weiss.xml` | | Weißer Kreis mit feiner Kante |
| `lib/aufzeichnungBruecke.ts` | 170 | Typisierter Draht zum Dienst |

---

### 11.1 Der Dienst

**Wie er startet.** `starten(context, laufId)` schickt eine Absicht mit
`startForegroundService`. Das darf nur aus einer sichtbaren App heraus
geschehen — seit Android 12 verweigert das System einen Standortdienst, der
aus dem Hintergrund gestartet wird. Bei uns ist der Auslöser der Druck auf
„Lauf starten", also unproblematisch.

**Wie er sich am Leben hält.** Drei Dinge zusammen:

- `START_STICKY` — räumt Android den Prozess unter Speicherdruck weg, erzeugt
  es den Dienst später neu. Dann kommt `onStartCommand` mit `null` an, und der
  Zustand wird aus den Einstellungen gelesen.
- `android:stopWithTask="false"` im Manifest — **ohne diese Zeile beendet
  Android den Dienst mitsamt der App, wenn man sie aus der Übersicht wischt.**
  Genau das war der Grund, warum die Benachrichtigung nach dem Wegwischen
  lange fehlte. Nicht „sie kommt spät", sondern: der Dienst war tot.
- **Kein gebundener Dienst.** `onBind` gibt `null` zurück. Das gelesene
  Fremdwerk bindet sich an die Oberfläche und beendet sich in `onUnbind` —
  deshalb stirbt dort die Aufzeichnung beim Wegwischen.

**Wie er ortet.** `LocationManager` mit `GPS_PROVIDER`, ein Takt von einer
Sekunde, kein Mindestabstand im Funk. Der Zuhörer ist eine **ausgeschriebene
anonyme Klasse mit allen vier Methoden** — kein Lambda. Ein Lambda erzeugt nur
die eine abstrakte Methode; ruft Android dann `onStatusChanged` auf, was es
unterhalb von API 30 tut, fliegt ein `AbstractMethodError`. Wir unterstützen
ab Android 7.

**Wie er pausiert.** `pausieren(true)` meldet den Empfänger ab und lässt alles
andere stehen: Dienst, Benachrichtigung, gespeicherte Punkte. Der Zustand
liegt in den Einstellungen und überlebt einen Prozesstod. Die Zeitrechnung
bleibt Sache der App — der Dienst mischt sich nicht ein.

**Wie er wach bleibt.** Ein `PARTIAL_WAKE_LOCK`, nur solange ein Lauf läuft.
Ohne ihn verwirft Android im Doze-Zustand Messungen, bevor sie gespeichert
sind. Beim Beenden wird er zurückgegeben — ein vergessener Wachhalter wäre ein
Akkufresser, den niemand findet.

**Wie er endet.** `stopRun` in JavaScript ruft ihn **zuerst und in jedem
Fall**. Das ist keine Aufräumarbeit, sondern Bedingung: Googles Ausnahme für
nutzergestartete Vordergrunddienste verlangt, dass der Dienst „immediately
after the application completes the intended use case" endet. Läuft er weiter,
gilt der Zugriff als gleichwertig mit `ACCESS_BACKGROUND_LOCATION` — und dann
bräuchte die App Googles aufwendiges Sonderverfahren.

---

### 11.2 Der Speicher

Eine Tabelle, neun Spalten:

```sql
id  laufId  zeit  breite  laenge  genauigkeitM  tempoMps  tempoGueteMps  hoeheM
```

Alles außer Ort und Zeit darf fehlen. Fehlend ist etwas anderes als null, und
die Bewegungserkennung rechnet damit.

**`tempoGueteMps`** ist die Güte der Geschwindigkeit selbst — verfügbar ab
Android 8. Kein kostenloses Plugin reicht dieses Feld durch; das
kostenpflichtige wirbt damit. Weil wir selbst gebaut haben, ist es da.
**Benutzt wird es noch nicht** — es zu speichern kostet nichts und macht den
nächsten Schritt möglich.

**Die Übergabe ist zweistufig:** `offene()` liefert, `bestaetigen()` löscht.
Dazwischen passiert nichts. Ein Absturz kostet deshalb keinen Punkt — sie
kommen beim nächsten Abholen erneut. Doppelt ist harmlos, weg wäre es nicht.

`verwerfen()` wirft alles zu einem Lauf weg, für den Fall, dass ein Lauf
verworfen statt gespeichert wird. Ohne das blieben die Punkte für immer
liegen.

---

### 11.3 Die Brücke

**Warum es sie überhaupt braucht**, und das war ein Befund des ersten
Gerätetests: Der Dienst ist `exported="false"`. Ein Startversuch von außen
endet mit

```
Error: Requires permission not exported from uid 10487
```

Das ist richtig so. Es heißt aber, dass sich der Dienst nicht von außen
prüfen lässt — auch nicht mit `adb`. Und selbst wenn man ihn kurz freigäbe,
käme der Start vom Shell-Benutzer, aus Androids Sicht also aus dem
Hintergrund, und das ist seit Android 12 verboten. **Der geplante Schritt
„Dienst allein prüfen" war damit unmöglich**; die Zuordnung sichern
stattdessen Protokollausgaben unter der Marke `MyProSole.Aufzeichnung`.

Sechs Methoden: `starten`, `stoppen`, `pausieren`, `abholen`, `bestaetigen`,
`verwerfen`, dazu `stand` für die Anzeige. Keine Fachlogik — die Brücke reicht
durch und rechnet nicht.

`starten` prüft **vorher** Erlaubnis und GPS-Schalter und gibt ein Hindernis
zurück, statt zu scheitern. Ein Vordergrunddienst, der wegen fehlender
Erlaubnis abgelehnt wird, stürzt auf Android 14+ die App ab, wenn niemand es
abfängt.

`stand` liefert nebenbei den **Beenden-Wunsch** und löscht ihn beim Lesen. Er
ist eine einmalige Nachricht, kein Zustand: Bliebe er stehen, fragte die App
nach jedem Öffnen erneut nach.

---

### 11.4 MainActivity

Zwei Aufgaben. Erstens `registerPlugin` **vor** `super.onCreate` — dort baut
Capacitor die Brücke auf. Danach angemeldet, kennt JavaScript sie nicht.

Zweitens den Beenden-Wunsch entgegennehmen, aus `onCreate` **und**
`onNewIntent`. Beides ist nötig: Läuft die App schon, kommt der Tipper in
`onNewIntent` an, sonst in `onCreate`. Nur eines zu bedienen hieße, dass der
Knopf mal wirkt und mal nicht.

**Der Wunsch wird notiert, nicht ausgeführt.** Der Lauf läuft weiter, bis in
der App bestätigt wurde. Ein Lauf ist Arbeit von einer Stunde; ihn mit einem
Tipper in der Statusleiste wegwerfen zu können — womöglich in der Hosentasche
— wäre ein schlechter Handel. Pausieren ist folgenlos und darf deshalb sofort
wirken; Beenden nicht.

---

### 11.5 Die Benachrichtigung

Eine Reihe: Symbol, Name, Uhr, zwei Kreise. **Es gibt nur diese eine Fassung**
— keine zweite zum Aufklappen.

Das war schwerer als gedacht. Der Aufklapp-Pfeil hielt sich hartnäckig, und
ich habe ihn dreimal an der falschen Stelle gesucht. Die Regel, die dahinter
steht:

> **Jedes von `setContentTitle`, `setContentText` und
> `DecoratedCustomViewStyle` erzeugt hinter den Kulissen eine aufgeklappte
> Standardfassung — und sobald es die gibt, zeichnet Android den Pfeil.**

Beim Antippen erschien genau diese Standardfassung. Erst als alle drei weg
waren, war auch der Pfeil weg.

Daraus folgte das Zweite: Android zeigt die Kopfzeile mit dem App-Namen **nur
im aufgeklappten Zustand**. Ohne Aufklappen erschien „MyProSole" nirgends.
Deshalb steht der Name jetzt im Layout selbst — fett, 17sp, größer als die
Kopfzeile ihn gesetzt hätte.

**Der Timer ist ein `Chronometer`, kein Textfeld.** Er zählt selbst weiter,
ohne dass jemand die Benachrichtigung auffrischt. Mit einem Textfeld müssten
wir die Zeit im Takt neu setzen — das kostet Strom und hinkt trotzdem
hinterher.

**Wegwischen lässt sich nicht verhindern.** Seit Android 13 darf der Nutzer
die Benachrichtigung eines Vordergrunddienstes wegwischen; `setOngoing` hat
diese Wirkung verloren. Was geht: `setDeleteIntent` meldet den Wisch an den
Dienst, und der setzt sie sofort neu. **Am Gerät dreimal gemessen, jedes Mal
sofort zurück.**

Das ist hier auch richtig so: Solange wir den Standort aufzeichnen, muss das
sichtbar sein. Eine Ortung, die man unsichtbar machen kann, wäre genau das,
wovor das [Schutzkonzept](schutzkonzept.md) warnt.

**Was bewusst nicht drinsteht:** Strecke und Pace. Der Dienst kennt sie nicht
— sie entstehen aus der Bewegungserkennung in JavaScript, und die schläft im
Hintergrund. Die letzten bekannten Werte stehenzulassen hieße, eine
eingefrorene Zahl zu zeigen, die aussieht wie eine Messung.

---

### 11.6 Die JavaScript-Seite

`lib/aufzeichnungBruecke.ts` ist der typisierte Draht. Jede Funktion prüft
`aufTelefon()` und tut im Browser nichts — dort gibt es keinen Dienst, und
das ist kein Mangel: Die Web-App wird nicht mehr angeboten, der Browser dient
der Entwicklung.

In `store/run.ts`:

- `startRun` erzeugt eine **eigene Sitzungskennung** und stößt den Dienst an.
  Getrennt von `activeRunId`, und das ist Absicht: Die kommt aus Supabase und
  erst nach einer Netzantwort. Der Dienst muss im selben Augenblick starten,
  in dem der Knopf gedrückt wird — auch ohne Netz.
- `pauseRun` / `resumeRun` reichen die Pause durch. Ohne das orteten wir
  während der Pause weiter.
- `stopRun` beendet den Dienst zuerst, `discardRun` beendet und wirft die
  Punkte weg — in dieser Reihenfolge, sonst schriebe er während des Löschens
  weiter.

In `pages/LiveTracking.tsx` gleicht sich die Seite beim Zurückkommen mit dem
Dienst ab: pausiert, fortgesetzt, Beenden gewünscht. **Der Dienst ist dabei
die Wahrheit, nicht die Seite** — die hat geschlafen.

---

### 11.7 Was am Gerät gemessen wurde

Samsung Galaxy A56, Android 16. Ausdrücklich der schwere Fall: Samsung gehört
zu den Herstellern mit strengem Batteriesparer, und Android 16 setzt die
Diensttypen am strengsten durch.

**Zwei Fehler gefunden, beide in unserem eigenen Code:**

**1. Die App tötete ihren eigenen Lauf.** Bildschirm aus, und die Aufzeichnung
war weg. Das Protokoll war eindeutig — kein Abschuss, kein Absturz:

```
12:02:08  Dienst angestossen fuer Lauf af7be07f...
12:03:11  Dienst gestoppt
12:03:11  Dienst gestoppt
```

In `LiveTracking.tsx` stand ein Zuhörer auf `visibilitychange`, der den Lauf
beim Verlassen der App beendete — mit der Begründung, der Browser halte die
Aufzeichnung ohnehin an und ein scheinbar weiterlaufender Lauf wäre eine
Lüge. **Das war richtig, solange es keinen Dienst gab.** Auf dem Telefon gilt
es nicht mehr; im Browser unverändert.

**2. `stopWithTask` fehlte.** Ohne die Zeile beendet Android den Dienst
mitsamt der App, wenn man sie aus der Übersicht wischt.

**Was danach nachgemessen wurde:**

```
Dienst angestossen fuer Lauf 4c1cd9d7...
Benachrichtigung weggewischt - wird neu gesetzt     (3×, jedes Mal sofort)
Pausiert
Fortgesetzt
Dienst gestoppt
```

Bildschirm aus: läuft weiter. App verlassen: läuft weiter. App aus der
Übersicht gewischt: läuft weiter.

---

### 11.8 Was noch offen ist — und das ist wichtig

**Die Punkte werden gesammelt, aber noch nicht abgeholt.**

Der Dienst schreibt in seine Datenbank. Die App liest sie **nicht** — sie
bezieht ihre Messungen weiterhin aus `navigator.geolocation.watchPosition`,
und die schläft im Hintergrund.

Heißt konkret: Der Lauf **überlebt** jetzt Bildschirm-Aus und App-Wechsel, aber
die Strecke aus der Zeit, in der die Seite schlief, ist noch nicht in der
Anzeige. Sie liegt in der Datenbank des Dienstes und wartet.

Das ist der nächste Schritt: `punkteAbholen` im Takt und beim Zurückkommen
aufrufen, die Punkte durch `addPoint` schicken, danach `punkteBestaetigen`.
Und `watchPosition` auf dem Telefon abschalten, damit nicht zwei Quellen
dieselbe Strecke zählen.

**Der Speicherweg ist noch nie mit echten Daten gelaufen.** Nachgemessen
direkt in der Datei des Dienstes:

```
Tabellen: android_metadata, punkte, sqlite_sequence
Spalten : id, laufId, zeit, breite, laenge, genauigkeitM,
          tempoMps, tempoGueteMps, hoeheM
Punkte  : 0
```

Der Aufbau stimmt, geschrieben wurde noch nichts — alle Tests fanden drinnen
statt, und der Dienst nutzt bewusst nur den reinen GPS-Empfänger ohne
WLAN-Rückfall. **Der erste Test draußen ist damit noch offen**, und er ist
der eigentliche.

**Kleinigkeit:** „Dienst gestoppt" steht zweimal im Protokoll. `stopRun`
beendet ihn, und bei einem zu kurzen Lauf ruft es zusätzlich `discardRun`,
das ihn ebenfalls beendet. Harmlos — der zweite Aufruf trifft einen bereits
beendeten Dienst —, aber es sieht im Protokoll nach mehr aus, als es ist.

**Die Hersteller-Frage ist ungetestet.** Der Hinweis auf die
Akku-Einstellungen ist nicht gebaut. Bei einem Lauf über eine Stunde mit
ausgeschaltetem Bildschirm kann Samsung trotz allem eingreifen.
