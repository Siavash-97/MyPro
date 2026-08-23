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
