/**
 * Wie lange hat dieser Lauf gedauert?
 *
 * Warum diese Datei existiert
 * ---------------------------
 * Die Frage wurde bis zum 23.08.2026 im **Anzeigetakt** beantwortet:
 * `tick()` rechnete jede Sekunde `(jetzt - startedAtMs)` aus und legte das
 * Ergebnis in `liveStats.durationS` ab. Alles andere las diese Zahl - auch
 * das Speichern.
 *
 * Das ging so lange gut, wie der Takt lief. Er laeuft aber nur, solange die
 * Laufseite montiert ist. Auf dem Weg, der eine **abgeschossene Aufzeichnung
 * birgt**, ist sie das nie: Dort wurde `liveStats` zurueckgesetzt, die Punkte
 * eingesammelt und sofort gespeichert - ohne dass je ein Takt lief.
 *
 * `durationS` stand deshalb auf 0, `stopRun` verglich mit
 * MIN_SAVE_DURATION_S = 60 und verwarf. **Jeder** geborgene, beendete Lauf
 * ging so verloren, und `discardRun` loeschte dabei den Dienstspeicher
 * gleich mit - genau der Datenverlust, gegen den die Bergung gebaut worden
 * war.
 *
 * Gefunden hat das der Pruefagent, nicht ein Test: Beide Seiten waren fuer
 * sich richtig, falsch war die Verdrahtung.
 *
 * Was daraus folgt
 * ----------------
 * Eine Anzeigegroesse darf nichts speisen, was gespeichert wird. Die Dauer
 * entsteht ab jetzt hier, aus der Startzeit, und `tick()` fragt dieselbe
 * Funktion wie `stopRun`. Ein Ort, eine Antwort.
 *
 * Was diese Datei NICHT beantwortet
 * ---------------------------------
 * Wie viel von dieser Zeit Bewegung war. Das ist eine andere Frage mit einer
 * anderen Regel; sie steht in `bewegung.ts`. Beide getrennt zu halten ist
 * Absicht - Strava macht es genauso.
 */

/**
 * Die Gesamtzeit eines Laufs in Sekunden.
 *
 * Reine Wanduhr: Ausdrueckliche Pausen werden **nicht** abgezogen. Die
 * Gesamtzeit soll sagen, wie lange der Lauf gedauert hat, Ampel inbegriffen.
 * Was davon Bewegung war, steht daneben.
 *
 * Ohne Startzeit ist die Antwort **null** und nicht geschaetzt. Eine
 * geratene Dauer sieht aus wie eine gemessene - dieselbe Falle wie bei den
 * Hoehenmetern.
 *
 * @param startedAtMs Zeitpunkt des Knopfdrucks, oder null.
 * @param jetztMs     Bezugszeitpunkt in Millisekunden.
 */
export function gesamtzeitS(startedAtMs: number | null, jetztMs: number): number {
  if (startedAtMs == null || !Number.isFinite(startedAtMs)) return 0
  if (!Number.isFinite(jetztMs)) return 0
  return Math.max(0, Math.floor((jetztMs - startedAtMs) / 1000))
}

/**
 * Die Bewegungszeit fuer die `runs`-Zeile - gedeckelt gegen die BEREITS
 * gerundete Laufzeit.
 *
 * Warum nicht einfach `Math.round`
 * --------------------------------
 * `runs_moving_time_plausibel` (Migration 0044) sichert
 * `moving_time_s <= duration_s` zu. In exakter Arithmetik gilt das immer:
 * `segmenturteil.ts` laesst kein Segment mehr Zeit beitragen, als die
 * Luecke zwischen zwei Messungen lang war ("nie mehr Zeit, als die Luecke
 * lang war", dort ausdruecklich als Zusage geschrieben).
 *
 * Gebrochen hat es die RUNDUNG: `duration_s` entstand mit `Math.floor`
 * (siehe `gesamtzeitS`), `moving_time_s` mit `Math.round`. Zwei
 * verschiedene, nicht ordnungserhaltende Richtungen.
 *
 * Wie oft das zuschlaegt - ausgerechnet, nicht geschaetzt
 * ------------------------------------------------------
 *     round(M) > floor(D)  <=>  Nachkomma(D) > 0,5  UND  (D - M) < 0,5 s
 *
 * `D - M` ist mindestens die Wartezeit auf den ersten GPS-Fix, beim
 * gewoehnlichen Abschluss zusaetzlich der Nachlauf zwischen letzter
 * Messung und Knopfdruck. Beides sind Sekunden. **Im Feld praktisch
 * unerreichbar.**
 *
 * Hier stand bis zum 02.09.2026 "Getroffen haette es den Normalfall, einen
 * Lauf ohne nennenswerten Halt." Das war falsch und blieb nach der
 * Korrektur stehen - gefunden vom Agenten `pruefung`. Ein Lauf ohne Halt
 * ist der Normalfall; die ZEITBEDINGUNG ist es nicht. Wer die beiden
 * verwechselt, gewichtet die naechste aehnliche Meldung falsch.
 *
 * Warum Deckeln und nicht beide auf `Math.floor`
 * ----------------------------------------------
 * Gleiches Runden reicht fuer die HERLEITUNG. Die Zusicherung gilt aber der
 * Datenbank gegenueber, und die kennt die Herleitung nicht. Eine verstellte
 * Geraeteuhr oder ein beschaedigter Zwischenstand koennte `M > D` liefern.
 *
 * **Vorbedingung: `dauerS >= 0`.** Bei negativem `dauerS` haelt die Zusage
 * NICHT - der Rueckgabewert waere 0, und `0 <= -3` ist falsch. Erfuellt ist
 * sie an beiden Aufrufstellen (`gesamtzeitS` klemmt auf 0) und in der
 * Datenbank (`runs_duration_s_non_negative`, 0011). Hier stand vorher, der
 * Deckel halte "ohne diese Voraussetzung" - auch das war falsch.
 *
 * Die Regel dahinter, damit die naechste Kennzahl sie nicht neu lernt:
 * **Wer eine Ordnung zwischen zwei Zahlen zusichert, rundet beide in
 * dieselbe Richtung - oder deckelt die kleinere gegen die bereits
 * gerundete groessere.**
 *
 * Warum ein Ueberschuss ueber 1 s gemeldet wird
 * ---------------------------------------------
 * Der Rundungsueberschuss ist beweisbar hoechstens 1 s
 * (`round(M) - floor(D) < 1,5`). Alles darueber ist per Definition KEIN
 * Rundungsfehler, sondern ein echter Defekt - und den wuerde ein stiller
 * Deckel in eine falsche Zahl verwandeln, wo vorher ein 23514 laut
 * aufgeschlagen waere. Das ist das Muster "verschluckter Fehler": Die
 * Zeile wird gespeichert, die Zahl ist falsch, niemand erfaehrt es.
 *
 * Deshalb ist der Deckel bis 1 s stillschweigend und darueber laut.
 * Gemeldet wird in die Konsole, nicht auf den Bildschirm - einem Laufenden
 * sagt das nichts, und `lib/melden.ts` verbietet Datenbankmeldungen in der
 * Oberflaeche. Gefunden vom Agenten `pruefung` am 02.09.2026: Meine erste
 * Fassung machte aus einem lauten Fehler eine stille falsche Zahl.
 *
 * @param bewegungRealS Ungerundete Bewegungszeit in Sekunden.
 * @param dauerS Die BEREITS gerundete Laufzeit, wie sie in die Zeile geht.
 *   Muss `>= 0` sein.
 */
export function bewegungszeitFuerZeile(bewegungRealS: number, dauerS: number): number {
  // Nicht-endlich: laut, und "unbekannt" statt einer Zahl.
  //
  // Hier stand bis zum 02.09.2026 `return 0`, still. Das waren ZWEI
  // Fehler auf einmal, beide von einer Nachbarsitzung benannt:
  //
  //   1. 0 ist fuer diese Spalte ausdruecklich die unehrliche Angabe.
  //      `0044:24-27`: "dort ist die Angabe unbekannt, nicht null".
  //   2. Die Funktion gab auf DIESELBE Frage zwei entgegengesetzte
  //      Antworten - hier still fuer eine unerreichbare Eingabe, zwoelf
  //      Zeilen tiefer laut fuer einen ebenso unerreichbaren Ueberschuss.
  //
  // NaN wird von `JSON.stringify` zu `null` - und null ist genau die
  // Angabe, die `0044` fuer "unbekannt" vorsieht. Beide Aufrufer halten
  // das aus: `run.ts` rechnet die Pace aus `liveStats.bewegungszeitS`,
  // `haengenderLauf.ts:189` faengt sie mit `bewegungS || dauerS` ab.
  //
  // Die Eingabe ist unerreichbar - `segmenturteil` gibt fuer jede
  // nicht-endliche Messung `NICHTS` zurueck, die Summe kann nicht NaN
  // werden. Nachgesehen, nicht angenommen. Genau deshalb muss sie laut
  // sein: Was nicht vorkommen kann und doch vorkommt, ist ein Befund.
  if (!Number.isFinite(bewegungRealS) || !Number.isFinite(dauerS)) {
    console.warn(
      `Bewegungszeit oder Laufzeit ist keine Zahl (${bewegungRealS} / ${dauerS}) - ` +
        `gespeichert wird "unbekannt".`,
    )
    return Number.NaN
  }

  const gerundet = Math.round(bewegungRealS)
  const gedeckelt = Math.max(0, Math.min(gerundet, dauerS))
  if (gerundet - dauerS > 1) {
    console.warn(
      `Bewegungszeit ueberholt die Laufzeit um ${gerundet - dauerS} s ` +
        `(${gerundet} gegen ${dauerS}) - das ist kein Rundungsfehler. ` +
        `Gespeichert wird ${gedeckelt}.`,
    )
  }
  return gedeckelt
}
