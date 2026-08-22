/**
 * Eine Aufzeichnung bergen, die die App nicht mehr kennt.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * Die Sitzungskennung lebte nur im Arbeitsspeicher. Schiesst Android die App
 * waehrend eines Laufs ab - bei einer Stunde mit ausgeschaltetem Bildschirm
 * der Normalfall, nicht die Ausnahme -, sammelt der Vordergrunddienst weiter,
 * aber niemand kann seine Punkte je abholen. Sie liegen dann fuer immer im
 * Dienstspeicher.
 *
 * Gemessen am 22.08.2026: 611 verwaiste Punkte vom Vortag lagen noch da, und
 * neun von sechzehn Laeufen hingen auf `status: 'tracking'`.
 *
 * Der Dienst wusste die Kennung die ganze Zeit - er hielt sie in seinen
 * Einstellungen. Er gab sie nur nie heraus.
 */

/** Was der Dienst beim Start ueber sich sagt. */
export interface Dienstbefund {
  /** Haelt der Dienst noch eine Aufzeichnung? */
  laeuft: boolean
  /** Welche - oder null, wenn er es nicht sagt. */
  laufId: string | null
  /** Wann kam die letzte Messung? Null heisst: gar keine. */
  letzterPunktMs: number | null
  /** Kennt die App diesen Lauf schon? Dann ist nichts zu bergen. */
  bekannt?: boolean
}

export type Bergungsurteil = 'nichts' | 'fortsetzen' | 'abschliessen'

/**
 * Bis hierhin gilt eine Aufzeichnung als noch am Laufen.
 *
 * Drei Minuten sind bewusst grosszuegig: Beim Gehen entsteht nur alle 7 bis
 * 12 Sekunden ein Punkt, und an einer langen Ampel kann eine Minute ohne
 * Messung vergehen. Wer laenger als drei Minuten keinen Punkt geliefert hat,
 * laeuft nicht mehr - dann ist Abschliessen richtiger als Fortsetzen.
 */
export const NOCH_UNTERWEGS_MS = 3 * 60_000

/**
 * Was mit einer gefundenen Aufzeichnung zu geschehen hat.
 *
 * Die Entscheidung haengt allein daran, wie frisch die letzte Messung ist -
 * nicht daran, wie lange der Lauf schon dauert. Eine Stunde Laufen mit einem
 * Punkt vor zehn Sekunden ist laufend; zehn Minuten Laufen mit dem letzten
 * Punkt von gestern ist vorbei.
 */
export function bergungsurteil(befund: Dienstbefund, jetztMs: number): Bergungsurteil {
  if (!befund.laeuft || !befund.laufId) return 'nichts'
  if (befund.bekannt) return 'nichts'

  // Ohne eine einzige Messung gibt es nichts fortzusetzen - aber die
  // Lauf-Zeile haengt trotzdem und gehoert aufgeraeumt.
  if (befund.letzterPunktMs == null) return 'abschliessen'

  return jetztMs - befund.letzterPunktMs <= NOCH_UNTERWEGS_MS ? 'fortsetzen' : 'abschliessen'
}
