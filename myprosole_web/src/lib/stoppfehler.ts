/**
 * Wiederholbar oder dauerhaft - die eine Frage nach einem gescheiterten
 * Speichervorgang.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `abbruchUndWeiterAufzeichnen` schickte **jeden** gescheiterten Versuch
 * zurueck in die Aufzeichnung. Bei einem dauerhaften Fehler holte die
 * Bergung beim naechsten App-Start denselben Lauf, scheiterte identisch, und
 * das ueber Neustarts hinweg - eine Endlosschleife, die nur durch Loeschen
 * der App-Daten endete.
 *
 * Gefunden von einem Lauf des Werkzeugs
 * `improve-codebase-architecture` am 24.08.2026. Sein Befund war schaerfer
 * als "es fehlt ein Knopf": Der Typ `Stoppfehler` unterscheidet
 * wiederholbare von dauerhaften Fehlern **schon** - der einzige Rueckweg
 * ignorierte die Unterscheidung.
 *
 * Was hier NICHT entschieden wird
 * -------------------------------
 * Was mit einem dauerhaft gescheiterten Lauf geschieht. Diese Datei sagt
 * nur, ob ein weiterer Versuch Aussicht hat. Die Punkte bleiben in jedem
 * Fall liegen (Entscheidung des Nutzers, 24.08.2026): Verwerfen ist eine
 * Handlung des Menschen, kein Standardverhalten.
 */
import type { Stoppfehler } from '../store/run'

/**
 * So viele erfolglose Versuche, dann gilt ein unbekannter Fehler als
 * dauerhaft.
 *
 * Nur ein Rueckfall fuer Fehlerformen ohne verwertbaren Code. Wo ein Code da
 * ist, entscheidet er - eine Rechteverletzung ist beim ersten Mal dauerhaft
 * und wird es durch Zaehlen nicht mehr.
 *
 * Drei, weil die Zahl zwei Fehler gegeneinander abwaegt: Bei eins waere jeder
 * Wackler endgueltig. Bei zehn saesse der Mensch zehn Versuche lang in
 * derselben Schleife, die diese Datei beenden soll.
 */
export const MAX_VERSUCHE = 3

/**
 * PostgreSQL-Fehlerklassen, die durch Wiederholen nicht besser werden.
 *
 * Nachgeschlagen, nicht erfunden - die Klassen stehen im PostgreSQL-Handbuch
 * unter "Appendix A. PostgreSQL Error Codes":
 *
 *   23  integrity_constraint_violation  (unique, foreign key, check, not null)
 *   42  syntax_error_or_access_rule_violation  (u. a. 42501 insufficient_privilege)
 *
 * Beide beschreiben etwas an der ANFRAGE oder an den RECHTEN, nicht an der
 * Verbindung. Dieselben Daten scheitern beim naechsten Mal genauso.
 */
const DAUERHAFTE_KLASSEN = ['23', '42']

/**
 * Hat ein weiterer Versuch Aussicht?
 *
 * @param art       Die Kategorie aus `Stoppergebnis`.
 * @param code      Der Fehlercode der Datenbank, falls einer kam.
 * @param versuche  Wie oft dieser Lauf schon erfolglos gespeichert wurde.
 * @returns `true`, wenn Wiederholen nichts bringt.
 */
export function istDauerhaft(
  art: Stoppfehler,
  code: string | undefined,
  versuche: number,
): boolean {
  // Eine Zeitgrenze sagt nichts ueber die Anfrage, nur ueber das Netz. Sie
  // zaehlt deshalb auch NICHT mit: Wer eine Stunde durch ein Funkloch
  // laeuft, soll seinen Lauf danach speichern koennen.
  if (art === 'zeitgrenze') return false

  // Ohne Anmeldung scheitert der zweite Versuch mit Sicherheit genauso.
  // Aufloesen kann das nur eine fremde Handlung.
  if (art === 'nicht-angemeldet') return true

  if (code && DAUERHAFTE_KLASSEN.includes(code.slice(0, 2))) return true

  // Unbekannte Form: versuchen, aber nicht endlos.
  if (!Number.isFinite(versuche)) return false
  return versuche >= MAX_VERSUCHE
}
