/**
 * Wann wird die Karte aufgebaut, wann gilt sie als gescheitert, wann wird es
 * noch einmal versucht?
 *
 * Warum diese Datei existiert
 * ---------------------------
 * Am 23.08.2026 zeigte die App waehrend eines 26-Minuten-Laufs durchgehend
 * die gezeichnete Ersatzflaeche statt einer Karte. Am laufenden Geraet wurde
 * einzeln ausgeschlossen: Der Schluessel lag im Buendel, der Kartendienst
 * antwortete auf Stil und Vektorkachel mit 200, `getContext('webgl2')` gab
 * einen Kontext, das nachgeladene Kartenbuendel kam in 132 ms an, und die
 * Punkte waren vollstaendig da.
 *
 * Uebrig blieb die Verdrahtung, und die hatte zwei Fehler, die sich
 * verstaerkten:
 *
 * 1. `Kacheln.tsx` baute die Karte in einem `requestAnimationFrame`. Das
 *    laeuft nicht, waehrend der Bildschirm aus ist – und genau das tut der
 *    Nutzer: Aufzeichnung starten, Telefon einstecken. Es kam nie ein
 *    Einzelbild, also entstand nie eine Karte.
 * 2. Die Frist von 8 s lief trotzdem weiter und rief `onFehler()`. In
 *    `RouteMap.tsx` setzte das `kartenFehler` auf true – und **nie wieder**
 *    zurueck. Ab Sekunde 8 war die Karte fuer den ganzen Lauf verloren.
 *
 * Beides sind Zeitfragen, und Zeitfragen gehoeren nicht als Bedingung mitten
 * in eine Komponente. Die Regel steht deshalb hier, so wie `laufdauer.ts`
 * und `hoehenmeter.ts`: eine reine Funktion, die man ohne Browser pruefen
 * kann.
 *
 * Die zwei Regeln, die daraus folgen
 * ----------------------------------
 * **Eine Frist, die laeuft, waehrend niemand hinsieht, misst nichts.**
 * Verbraucht wird nur *sichtbare* Zeit. Ein Telefon in der Tasche verbraucht
 * nichts.
 *
 * **Ein Scheitern ist vorlaeufig.** Wird die Seite wieder sichtbar, wird neu
 * aufgebaut. Aber nicht sofort und nicht in Schleife: Ein gesperrter
 * Schluessel meldet seinen Fehler in Millisekunden, und "gescheitert und
 * sichtbar heisst aufbauen" waere dann eine Endlosschleife aus
 * Karteninstanzen und Anfragen. Dazwischen liegt eine Pause.
 */

/** Was die Komponente ueber ihren eigenen Stand weiss. */
export interface Kartenlage {
  /** Ist die Seite gerade sichtbar? Sonst stehen rAF und Netz still. */
  sichtbar: boolean
  /** Steht die Karte? Stil geladen, Ebenen gesetzt, Route gezeichnet. */
  bereit: boolean
  /** Gibt es gerade eine Karteninstanz? */
  aufgebaut: boolean
  /** Hat der letzte Versuch aufgegeben – Frist abgelaufen oder harter Fehler? */
  gescheitert: boolean
  /** Wanduhr seit dem Scheitern in ms. Ohne Scheitern bedeutungslos. */
  seitScheiternMs: number
  /** **Sichtbare** ms seit Beginn des laufenden Versuchs. */
  verbrauchtMs: number
}

/**
 * Wie lange die Karte zustande kommen darf – gemessen in **sichtbarer** Zeit.
 *
 * Vorher standen hier 8000 ms. Das war zu knapp, und zwar nicht knapp
 * gegriffen, sondern unter dem realistischen Bestfall: Bis MapLibre `load`
 * meldet, laufen mindestens vier Anfragen nacheinander – `style.json`, dann
 * Sprite (JSON und Bild), dann die Zeichensatzbereiche, dann die ersten
 * Vektorkacheln. Jede haengt am Ergebnis der vorigen. Auf einem gedrosselten
 * Mobilfunkweg – der Fall, der den Fehler ausgeloest hat, war eine Zugfahrt –
 * kostet ein Umlauf 2 bis 4 Sekunden, TLS-Aufbau noch nicht gerechnet. 8 s
 * reichen dafuer nicht einmal im guenstigen Fall.
 *
 * 20 s geben rund fuenf bis acht Umlaeufe Luft. Teuer ist das nicht mehr,
 * seit die gezeichnete Route waehrend des Wartens sichtbar bleibt: Der Nutzer
 * sieht die ganze Zeit seine Strecke, nicht eine graue Flaeche. Und die Frist
 * verbraucht sich nur, solange jemand hinsieht.
 */
export const KARTEN_FRIST_MS = 20_000

/**
 * Wie lange nach einem Scheitern gewartet wird, bevor es neu versucht wird.
 *
 * Deckt beide Faelle mit derselben Zahl ab: Ein gesperrter Schluessel wird
 * hoechstens zweimal pro Minute nachgefragt statt hunderte Male pro Sekunde.
 * Und wer sein Telefon 20 Minuten in der Tasche hatte, ist beim Aufwachen
 * laengst darueber – fuer ihn beginnt der neue Versuch sofort.
 */
export const PAUSE_VOR_NEUEM_VERSUCH_MS = 30_000

export type Kartenschritt =
  /** Nichts zu tun: fertig, oder niemand sieht hin. */
  | { art: 'ruhen' }
  /** Karte (neu) erzeugen. Eine vorhandene Instanz wird vorher abgeraeumt. */
  | { art: 'aufbauen' }
  /** Die Frist laeuft. Nach `restMs` sichtbarer Zeit neu bewerten. */
  | { art: 'warten'; restMs: number }
  /** Nach dem Scheitern zur Ruhe kommen. Nach `inMs` Wanduhr neu bewerten. */
  | { art: 'pause'; inMs: number }
  /** Aufgeben: Karte abraeumen, die gezeichnete Route bleibt stehen. */
  | { art: 'aufgeben' }

/** Der naechste Schritt beim Kartenaufbau – ohne Browser, ohne Uhr, pruefbar. */
export function kartenSchritt(lage: Kartenlage): Kartenschritt {
  // Steht die Karte, ist jede Frist gegenstandslos. Auch eine, die lange
  // gedauert hat: Was da ist, wird nicht nachtraeglich weggeworfen.
  if (lage.bereit) return { art: 'ruhen' }

  // Der Kern des Fehlers vom 23.08.2026. Unsichtbar heisst: kein Einzelbild,
  // also kein Aufbau – und deshalb auch keine Frist, die dagegen laeuft.
  if (!lage.sichtbar) return { art: 'ruhen' }

  if (lage.gescheitert) {
    const inMs = PAUSE_VOR_NEUEM_VERSUCH_MS - lage.seitScheiternMs
    if (inMs > 0) return { art: 'pause', inMs }
    return { art: 'aufbauen' }
  }

  if (!lage.aufgebaut) return { art: 'aufbauen' }

  const restMs = KARTEN_FRIST_MS - lage.verbrauchtMs
  if (restMs <= 0) return { art: 'aufgeben' }
  return { art: 'warten', restMs }
}
