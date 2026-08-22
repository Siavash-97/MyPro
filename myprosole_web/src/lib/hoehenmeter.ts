/**
 * Ob wir Hoehenmeter zeigen duerfen - und warum derzeit nicht.
 *
 * Der Befund
 * ----------
 * Am 22.08.2026 wurden beide Faelle am selben Abend mit demselben Geraet
 * gemessen:
 *
 *   Zugfahrt durch Koeln, faktisch flach   ->  36,6 Hoehenmeter gemeldet
 *   Drei Etagen Treppe, rund 9 m echt      ->   0,0 Hoehenmeter gemeldet
 *
 * Auf platter Strecke erfinden wir 36 Meter, auf neun echten messen wir null.
 * Das ist kein schwaches Signal, das ist keines.
 *
 * Warum eine bessere Schwelle nicht hilft
 * ---------------------------------------
 * Der Durchlauf an den echten Daten der Zugfahrt:
 *
 *   Fenster  Schwelle   Zug (echt 0)   Treppe (echt 9)
 *        5         3          36,6                0,0   <- heute
 *        5         4          29,4                0,0   <- Schwelle = vAcc
 *       20         8           8,0                0,0
 *       20        12           0,0                0,0
 *
 * Jede Einstellung, die das Erfinden stoppt, erkennt auch den echten Anstieg
 * nicht. Es gibt keine, die beides richtig macht - **auch nicht die, die an
 * der gemeldeten vertikalen Genauigkeit haengt.** Das war der naheliegende
 * Vorschlag und er ist an den Daten gescheitert.
 *
 * Die Ursache ist das Geraet: Das Galaxy A56 hat **kein Barometer**
 * (Sensorliste geprueft), und der GNSS-Empfaenger ist L1-only. Im
 * Treppenhaus steht seine Hoehe konstant auf 106,0 m, waehrend die
 * Genauigkeit auf 46 m einbricht - er haelt einen alten Wert.
 *
 * Was daraus folgt
 * ----------------
 * Die Zahl wird weiter **gerechnet und gespeichert** - sie kostet nichts und
 * kann spaeter aus einem Gelaendemodell korrigiert werden, wenn es eines
 * gibt. Aber sie wird **nicht gezeigt**, und vor allem nicht mit einem
 * Beitrag nach draussen geschickt.
 *
 * Eine falsche Zahl ist schlechter als keine: Sie behauptet, gemessen zu
 * sein.
 *
 * Zum Wiedereinschalten genuegt es, `hoeheIstBelastbar` auf true zu setzen -
 * dann aber bitte mit einer Messung daneben, nicht mit einer Hoffnung.
 */

/**
 * Taugt die Hoehenangabe zur Anzeige?
 *
 * Bewusst eine Funktion und keine Konstante: Wenn spaeter ein Gelaendemodell
 * oder ein Geraet mit Barometer dazukommt, haengt die Antwort von etwas ab -
 * und dann steht schon die richtige Form da.
 */
export function hoeheIstBelastbar(): boolean {
  return false
}

/**
 * Die Hoehenangabe als Text - oder null, wenn nichts gezeigt werden soll.
 *
 * Aufrufer, die null bekommen, lassen die Kachel weg. Nicht "–" und nicht
 * "0 m": Beides sind Aussagen, und wir haben keine.
 */
export function hoehenmeterText(gewinnM: number | null | undefined): string | null {
  if (!hoeheIstBelastbar()) return null
  if (gewinnM == null || !Number.isFinite(gewinnM)) return null
  return `${Math.round(gewinnM)}`
}
