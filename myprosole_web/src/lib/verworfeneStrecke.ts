/**
 * Die eine Zeile, die sagt, wie viel Strecke das GPS erfunden hat.
 *
 * Warum diese Datei existiert
 * ---------------------------
 * `laufBilanz` rechnet die verworfene Strecke aus, aber sie zu ZEIGEN ist
 * eine andere Frage als sie zu rechnen: Ab wann lohnt die Zeile, und was
 * genau darf der Satz behaupten? Beides gehoert an eine Stelle, weil die
 * Zeile auf zwei Bildschirmen steht (Laufzusammenfassung, Laufdetail) und
 * zwei Wortlaute derselben Aussage genau der Fehler waeren, gegen den
 * `laufBilanz.ts` selbst geschrieben wurde.
 *
 * Was der Satz NICHT sagt, und warum
 * ----------------------------------
 * **Nicht "1,2 km fehlen dir".** Die verworfene Strecke ist ueberwiegend
 * Strecke, die nie gelaufen wurde: `docs/gps-genauigkeit.md` misst ein
 * stillliegendes Telefon, das aus reinem Rauschen 7,3 km erzeugt. Ein
 * Ortungssprung ist ein Messfehler, den wir wegwerfen - ihn als fehlende
 * Strecke auszuweisen, wuerde dem Menschen Kilometer versprechen, die er
 * nicht gelaufen ist.
 *
 * **Nicht "ohne sicheren Empfang".** Das waere ein Grund, den wir nicht
 * gemessen haben. Gemessen ist der Sprung - schneller als 45 km/h, weiter
 * als 500 m, oder ohne Zeitabstand (`segmenturteil.ts`). Ob dahinter ein
 * Tunnel, eine Neuortung oder Rauschen steckt, weiss die App nicht, und
 * `docs/gps-genauigkeit.md` zeigt sogar das Gegenteil der naheliegenden
 * Erklaerung: **bei gutem Empfang entsteht mehr erfundene Strecke**, nicht
 * weniger.
 *
 * **Nicht "das ist alles, was verworfen wurde".** Deshalb "mindestens", und
 * das ist das wichtigste Wort des Satzes. Vor dieser Rechnung verwirft die
 * Bewegungserkennung (`bewegung.ts`) bereits ganze Messungen, bevor ein
 * Punkt entsteht; diese Strecke kommt hier nie an und ist der groessere
 * Posten. Gemessen am 22.08.2026: 1,73 km angekommen gegen 3,54 km bei
 * Strava auf derselben Aufzeichnung. Eine Zeile kann diesen zweiten Verlust
 * nicht erklaeren - sie kann sich nur weigern, ihn zuzudecken.
 *
 * Warum der Grund vorne steht
 * ---------------------------
 * "GPS sprang:" zuerst, die Zahl danach. Andersherum ("mindestens 1,2 km
 * verworfen ...") liest das Auge die Kilometer als etwas, das dem Lauf
 * abgezogen wurde - und genau das sind sie nicht.
 *
 * "GPS" und nicht "Ortungssprung": `Ortungssprung` ist unser Wort im
 * Quelltext und in `docs/gps-genauigkeit.md`, aber auf dem Bildschirm heisst
 * die Quelle schon "GPS" ("App-Modus mit GPS", "Keine GPS-Daten"). Ein
 * zweites Wort fuer dieselbe Sache waere ein Bruch von
 * `docs/ubiquitous-language.md`, nicht seine Einhaltung.
 *
 * "sprang" statt "Sprünge": Die Zahl kann von einem einzigen Sprung kommen.
 * Das Verb stimmt bei einem wie bei zwanzig, ohne dass der Satz die Anzahl
 * kennen muss.
 */

/**
 * Ab wann die Zeile ueberhaupt erscheint, in Metern.
 *
 * Die Schwelle ist nicht gegriffen, sie folgt aus dem Format: Die Zeile
 * nennt Kilometer mit einer Nachkommastelle, wie jede andere Strecke in
 * dieser App. Unter 100 m stuende dort "0,0 km verworfen" - eine Meldung,
 * die sich selbst widerspricht.
 *
 * Dass die Schwelle deutlich ueber null liegen MUSS, hat einen zweiten,
 * unabhaengigen Grund: Ein Sprung entsteht auch ohne Zeitabstand zwischen
 * zwei Messungen (`segmenturteil.ts`). Dann sind drei Meter ein Sprung -
 * eine Zeile darueber waere eine Meldung ueber nichts.
 */
export const MELDESCHWELLE_M = 100

/**
 * Die Hinweiszeile - oder null, wenn nichts zu melden ist.
 *
 * Aufrufer, die null bekommen, lassen die Zeile weg. Nicht "0,0 km" und
 * nicht "keine Sprünge": Ein sauber aufgezeichneter Lauf hat keinen Grund,
 * ueber Messfehler zu reden, die es nicht gab.
 *
 * Der ganze Satz kommt aus dieser Funktion und nicht in Stuecken aus der
 * Seite - eine Zeile, ein Wortlaut, eine Stelle zum Aendern.
 */
export function verworfeneStreckeText(meterM: number | null | undefined): string | null {
  if (meterM == null || !Number.isFinite(meterM)) return null
  if (meterM < MELDESCHWELLE_M) return null

  const km = (meterM / 1000).toFixed(1).replace('.', ',')
  return `GPS sprang: mindestens ${km} km verworfen`
}
