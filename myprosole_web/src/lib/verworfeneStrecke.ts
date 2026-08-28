/**
 * Die eine Zeile, die sagt, wie viel Strecke die Anzeige auslaesst.
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
 * **Nicht "1,2 km fehlen dir".** Ein Teil dieser Strecke wurde nie
 * gelaufen: `docs/gps-genauigkeit.md` misst ein stillliegendes Telefon, das
 * aus reinem Rauschen 7,3 km erzeugt. Sie als fehlende Strecke auszuweisen
 * wuerde dem Menschen Kilometer versprechen, die er nicht gelaufen ist.
 *
 * **Und trotzdem nicht "das war nur ein Messfehler".** Am 24.08.2026 auf
 * einer Strassenbahnfahrt gegen die Gleisgeometrie geprueft
 * (`bahnfahrt.test.ts`): Die 0,90 km, die hier herausfielen, waren **echte
 * Strecke**. Am 27.08.2026 noch einmal, zwei Fahrten: 2,09 km angezeigt,
 * 3,65 km zurueckgelegt, die Rohspur unter 30 m an Strava.
 *
 * Beide Faelle sehen in den Daten gleich aus, und die App kann sie nicht
 * unterscheiden. Deshalb sagt der Satz ueber die Kilometer selbst **gar
 * nichts** - er sagt nur, warum sie nicht in der Anzeige stehen. Jede
 * Deutung in die eine oder andere Richtung waere in der Haelfte der Faelle
 * falsch.
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
 * Die Regel bleibt: erst der Grund, dann die Zahl. Andersherum
 * ("mindestens 1,2 km ...") liest das Auge die Kilometer als etwas, das dem
 * Lauf abgezogen wurde - und genau das sind sie nicht.
 *
 * Warum "verworfen" nicht mehr vorkommt
 * -------------------------------------
 * **Das ist kein Geschmacksurteil, sondern das Glossar.**
 * `docs/ubiquitous-language.md:107` vergibt **Verwerfen** bereits:
 * "Punkte wegwerfen, weil der Lauf abgebrochen wurde" (`punkteVerwerfen`).
 * Genau dieses Wort steht dem Menschen an anderer Stelle auf demselben
 * Geraet gegenueber - `pages/LiveTracking.tsx` beschriftet damit den Knopf
 * "Lauf verwerfen", den Dialog "Lauf verwerfen?" und die Meldung "Lauf
 * verworfen.". Ein Wort, zwei Bedeutungen, beide sichtbar: Wer "verworfen"
 * unter seiner Strecke las, kannte es aus dem Abbruchdialog, wo es
 * tatsaechlich "ist jetzt weg" heisst.
 *
 * Wer hier wieder "verworfen" einsetzt, nimmt diesen Bruch zurueck. Ein
 * Test haelt es fest, damit es nicht aus Versehen passiert.
 *
 * Warum die Eigenschaft vorn steht und nicht das Ereignis
 * -------------------------------------------------------
 * Vorher stand dort "GPS sprang:" - ein Ereignis am Empfaenger, und damit
 * ein Satz, der wie eine Stoerung klingt. Es ist keine. Die App zaehlt
 * Laufstrecke; Strecke oberhalb von `MAX_TEMPO_MPS` (12,5 m/s = 45 km/h,
 * `segmenturteil.ts`) gehoert nicht dazu. Das ist eine **Entscheidung
 * dieser App**, kein Defekt des Geraets, und der Satz sagt es jetzt in
 * dieser Reihenfolge: erst was gezaehlt wird, dann was deshalb aussen
 * blieb.
 *
 * "schneller als Laufen" und nicht "Fahrtempo", nicht "etwa in Bahn oder
 * Auto": Die Geschwindigkeit ist gemessen, das Fahrzeug nicht. Beide
 * Varianten lagen vor und wurden verworfen - "Fahrtempo" unterstellt dem
 * allein Laufenden, dessen Zeile aus Rauschen kommt, eine Fahrt, die es
 * nicht gab. Es ist derselbe Grund, aus dem hier kein Tunnel und kein
 * Empfang steht.
 */

/**
 * Ab wann die Zeile ueberhaupt erscheint, in Metern.
 *
 * Die Schwelle ist nicht gegriffen, sie folgt aus dem Format: Die Zeile
 * nennt Kilometer mit einer Nachkommastelle, wie jede andere Strecke in
 * dieser App. Unter 100 m stuende dort "mindestens 0,0 km" - eine Meldung,
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
  return `Gezählt wird nur Laufstrecke: mindestens ${km} km waren schneller als Laufen.`
}
