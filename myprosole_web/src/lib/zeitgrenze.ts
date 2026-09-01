/**
 * Ein Versprechen, das nicht ewig warten darf.
 *
 * Der Befund
 * ----------
 * Am 23.08.2026 blieb ein Lauf von 3:26 beim Speichern haengen. Die Spuren
 * am Geraet zeigten die Kette bis kurz vor den Schluss:
 *
 *   Dienst-Einstellungen leer          -> aufzeichnungStoppen() lief
 *   Dienstspeicher fuer die Sitzung leer -> Punkte abgeholt UND bestaetigt
 *   20 Punkte in der Datenbank          -> Uebertragung lief
 *   Lauf-Zeile: status 'tracking'       -> die Kennzahlen kamen NIE
 *
 * Zwischen "eingesammelt" und "geschrieben" stehen zwei Netzaufrufe, und
 * der Supabase-Client bringt **keine Vorgabe-Zeitgrenze** mit. Haengt einer
 * von beiden - schlechter Mobilfunk, halb offene Verbindung -, haengt das
 * Speichern fuer immer. Auf dem Bildschirm stand weiter "Lauf laeuft".
 *
 * Warum das schlimmer ist als ein Fehler
 * --------------------------------------
 * Ein Fehler wird gemeldet, und der naechste Versuch holt es nach. Ein
 * Haenger sagt nichts und tut nichts. Der Mensch beendet irgendwann die
 * App - und dann ist der Lauf da, wo unserer heute gelandet ist: eine
 * Zeile auf 'tracking', die niemand mehr abschliesst.
 *
 * **Lieber ein sauberer Abbruch als ein stilles Warten.** Was hier
 * abbricht, ist nicht verloren: Die Punkte liegen in der Datenbank oder im
 * Geraetepuffer, und der naechste Start holt den Lauf ab.
 */

/** Der Abbruch, wenn die Zeit abgelaufen ist - kein gewoehnlicher Fehler. */
export class ZeitgrenzeFehler extends Error {
  constructor(was: string, ms: number) {
    super(`${was} hat laenger als ${Math.round(ms / 1000)} Sekunden gedauert`)
    this.name = 'ZeitgrenzeFehler'
  }
}

/**
 * Wie lange ein Netzaufruf beim Speichern hoechstens dauern darf.
 *
 * Zwanzig Sekunden sind der Ausgleich zwischen zwei Fehlern: Zu knapp, und
 * ein langsamer, aber gesunder Umlauf auf schlechtem Mobilfunk wird
 * abgebrochen, obwohl er gleich angekommen waere. Zu grosszuegig, und wer
 * vor einem Bildschirm steht, der nichts sagt, haelt die App fuer kaputt -
 * und sie ist es dann auch.
 *
 * Der Feldfall hing unbegrenzt; jede endliche Zahl ist besser als das.
 */
export const SPEICHERN_GRENZE_MS = 20_000

/**
 * Ein Versprechen mit Zeitgrenze.
 *
 * Ein Fehler des Versprechens kommt **unveraendert** durch: Ein echter
 * Netzfehler soll als solcher ankommen und nicht als Zeitueberschreitung
 * verkleidet werden - sonst sucht der naechste an der falschen Stelle.
 *
 * Was hier NICHT passiert: Der zugrunde liegende Aufruf wird nicht
 * abgebrochen. Er laeuft im Hintergrund weiter und kann durchaus noch
 * ankommen; wir warten nur nicht mehr. Fuer ein `update`, das doch noch
 * durchgeht, ist das harmlos - es schreibt dieselben Werte.
 *
 * `PromiseLike` statt `Promise` in der Signatur ist keine Feinheit: Die
 * Abfrage-Erbauer von Supabase sind Thenables, keine echten Versprechen -
 * sie haben `then`, aber weder `catch` noch `finally`. Mit `Promise<T>`
 * uebersetzt `tsc -b` die Aufrufstellen nicht.
 *
 * @param was Wofuer die Grenze gilt, fuer die Meldung an den Menschen.
 */
export function mitZeitgrenze<T>(
  versprechen: PromiseLike<T>,
  ms: number,
  was = 'Der Vorgang',
): Promise<T> {
  return new Promise<T>((erfuellen, ablehnen) => {
    const zeitgeber = setTimeout(() => ablehnen(new ZeitgrenzeFehler(was, ms)), ms)
    versprechen.then(
      (wert) => {
        clearTimeout(zeitgeber)
        erfuellen(wert)
      },
      (grund) => {
        clearTimeout(zeitgeber)
        ablehnen(grund)
      },
    )
  })
}
