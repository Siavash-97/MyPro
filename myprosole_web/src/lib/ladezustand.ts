/**
 * Welche der vier Lagen liegt gerade an?
 *
 * Warum es diese Funktion gibt
 * ----------------------------
 * `RunDetail.tsx` und `RunAnalysis.tsx` fragten beide nur
 * `if (loading || !run)` und zeigten dann einen Spinner. Nach einem
 * gescheiterten Laden ist `loading` false und `run` null - der Spinner drehte
 * sich fuer immer, ohne Meldung und ohne Ausweg.
 *
 * Die Behebung ist eine if-Kette, in der die REIHENFOLGE die eigentliche
 * Aussage traegt. Dieselbe Kette in zwei Seiten von Hand gleich zu halten
 * geht schief; hier steht sie einmal und ist einzeln geprueft.
 */
export type Ladezustand = 'laedt' | 'gescheitert' | 'fehlt' | 'da'

export interface Ladelage {
  /**
   * Ist fuer DIESE Kennung schon ein Ladeversuch zu Ende gegangen?
   *
   * Ohne diese Angabe gibt es keinen ehrlichen Anfangszustand: Beim ersten
   * Malen steht `loading` noch auf false, `selectedRun` auf null und
   * `ladefehler` auf null - also genau die Lage "gibt es nicht". Der
   * Ladeeffekt laeuft erst NACH diesem Malen. Der Satz "Diesen Lauf gibt es
   * nicht" blitzte damit einmal auf, bevor ueberhaupt gefragt wurde.
   */
  geprueft: boolean
  /** `loading` aus dem Speicher. */
  laedt: boolean
  /**
   * Liegt der Lauf mit der GESUCHTEN Kennung vor?
   *
   * Nicht bloss "irgendein Lauf". `selectedRun` ueberlebt den Seitenwechsel:
   * Wer Lauf A ansieht, zurueckgeht und Lauf B oeffnet, hat beim ersten Malen
   * noch A im Speicher. Ohne den Abgleich der Kennung zeigte die Seite von B
   * kurz die Zahlen von A.
   */
  vorhanden: boolean
  /** `ladefehler` aus dem Speicher, oder null. */
  fehler: string | null
}

/**
 * Die Reihenfolge und warum sie so ist:
 *
 * 1. **Der richtige Lauf ist da** - dann wird er gezeigt, Punkt. `laedt` und
 *    `fehler` sind gemeinsame Felder fuer `fetchRun` UND `fetchRecentRuns`.
 *    Scheitert im Hintergrund die Liste, waehrend die Detailseite offen ist,
 *    darf das die Detailseite weder in einen Spinner noch in einen Fehler
 *    kippen.
 * 2. **Es wird geladen** - einschliesslich "der erste Versuch laeuft noch
 *    an", siehe `geprueft`.
 * 3. **Es ist schiefgegangen** - Wiederholen kann helfen.
 * 4. **Es gibt ihn nicht** - Wiederholen kann nicht helfen.
 */
export function ladezustand({ geprueft, laedt, vorhanden, fehler }: Ladelage): Ladezustand {
  if (vorhanden) return 'da'
  if (!geprueft || laedt) return 'laedt'
  if (fehler) return 'gescheitert'
  return 'fehlt'
}
