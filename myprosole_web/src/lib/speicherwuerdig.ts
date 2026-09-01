/**
 * Die eine Frage: Ist diese Aufzeichnung eine Zeile im Verlauf wert?
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Es gab zwei Antworten darauf. Beim gewoehnlichen Stoppen entschied
 * `store/run.ts` ueber Strecke und Dauer. Bei der nachtraeglichen Bergung
 * eines haengengebliebenen Laufs entschied `haengenderLauf.ts` ueber die
 * ANZAHL DER PUNKTE - eine ganz andere Groesse.
 *
 * Derselbe Lauf, zwei Ausgaenge: 12 Punkte auf 80 Metern in 40 Sekunden
 * wurde beim Stoppen verworfen und beim Bergen gespeichert. Wer die App
 * regulaer beendete, verlor ihn; wer sie abstuerzen liess, behielt ihn.
 *
 * Das ist derselbe Fehler wie B1: eine Frage, zwei Rechenwege, die
 * auseinanderlaufen. Gefunden vom Pruefagenten am 23.08.2026.
 *
 * Die Punktzahl bleibt als VORFILTER bestehen (`MIN_PUNKTE_ZUM_ABSCHLIESSEN`)
 * - ohne Punkte gibt es nichts zu rechnen. Aber sie ist kein Urteil mehr.
 */

/**
 * Unterhalb dieser Werte war es kein Lauf, sondern ein versehentlicher
 * Tipper oder ein Blick auf den Bildschirm.
 *
 * 0,1 km deshalb, weil das Speicher-Tor Segmente unter 10 m verwirft
 * (MIN_SEGMENT_M) - unter hundert Metern misst diese App nicht ehrlich
 * genug, um eine Zeile zu rechtfertigen.
 */
export const MIN_SAVE_DISTANCE_KM = 0.1
export const MIN_SAVE_DURATION_S = 60

/**
 * @param streckeKm Gesamtstrecke in Kilometern.
 * @param dauerS    Gesamtdauer in Sekunden (Wanduhr, nicht Bewegungszeit).
 */
export function istSpeicherwuerdig(streckeKm: number, dauerS: number): boolean {
  if (!Number.isFinite(streckeKm) || !Number.isFinite(dauerS)) return false
  return streckeKm >= MIN_SAVE_DISTANCE_KM && dauerS >= MIN_SAVE_DURATION_S
}
