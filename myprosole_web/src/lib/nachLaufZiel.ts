/**
 * Wohin es nach dem Beenden eines Laufs geht.
 *
 * Warum das eine eigene Funktion ist und nicht eine Zeile in LiveTracking
 * ---------------------------------------------------------------------
 * Weil an ihr ein Datenverlust hing und es keinen Ort gab, an dem man ihn
 * haette pruefen koennen. `LiveTracking.tsx` hat keine eigene Testdatei; die
 * Entscheidung stand als Zeichenkette mitten in einem `try`-Block.
 *
 * Der Fall, 29.08.2026, gefunden vom Agenten `pruefung`
 * ------------------------------------------------------
 * Seit `stopRun` bei einer Zeitgrenze am Schreiben sofort freigibt, kann es
 * eine Lauf-Kennung zurueckgeben, zu der es **noch keine Zeile gibt** - der
 * `upsert`-Fall, wenn beim Start kein Netz da war. Die Kennung wanderte
 * trotzdem in die Adresse:
 *
 *   /training/tagebuch?from=tracking&lauf=<id>
 *      -> TrainingDiary: createEntry({ run_id: laufKennung, ... })
 *      -> fk_diary_run (Migration 0008)  ->  Fehlercode 23503
 *      -> der Tagebucheintrag ist weg, und der Mensch hat ihn getippt.
 *
 * Ohne den Parameter haengt der Eintrag nur am Datum. Das ist weniger, als
 * gemeint war - aber `run_id` ist dort ausdruecklich nullbar (`on delete set
 * null`), und ein Eintrag ohne Verknuepfung ist besser als keiner.
 *
 * Was hier NICHT entschieden wird: ob die Verknuepfung spaeter nachgetragen
 * wird, sobald die Bestaetigung ankommt. Das braucht einen Ort, an dem der
 * unverknuepfte Eintrag wartet, und ist eine eigene Frage
 * (`docs/lauf-ohne-netz-entwurf.md`, F4/D3).
 */

/** Was `stopRun` zurueckgibt, soweit es fuer das Ziel zaehlt. */
export interface Laufausgang {
  /** Die Lauf-Kennung. `null` heisst: nichts gespeichert (zu kurz). */
  runId: string | null
  /**
   * Gibt es die `runs`-Zeile in der Datenbank?
   *
   * Das ist NICHT dieselbe Frage wie `bestaetigt`. Nach einer Zeitgrenze am
   * Schreiben ist die Bestaetigung offen - die Zeile kann trotzdem seit dem
   * Start existieren (`update`-Fall). Nur wenn sie es NICHT tut
   * (`upsert`-Fall, kein Netz beim Start), darf kein Fremdschluessel auf
   * sie zeigen.
   *
   * Beide Fragen in ein Feld zu legen hat am 31.08.2026 die Verknuepfung im
   * haeufigen Fall gekostet: Zugfahrt, Zeile stand seit dem Start, und der
   * Tagebucheintrag verlor sie trotzdem. Gefunden vom Agenten `pruefung`.
   */
  zeileSteht: boolean
}

/**
 * Die Adresse nach einem gespeicherten Lauf.
 *
 * Gibt `null` zurueck, wenn es keinen Lauf gibt - der Aufrufer entscheidet
 * dann selbst (heute: Kurzeinblendung "zu kurz" und zurueck zur Startseite).
 * Diese Funktion erfindet dafuer keine Adresse; ein Ziel, das nur eine von
 * zwei Bedeutungen traegt, war schon einmal der Fehler.
 */
export function nachLaufZiel(ausgang: Laufausgang): string | null {
  if (!ausgang.runId) return null

  const ziel = '/training/tagebuch?from=tracking'

  // Die Kennung nur mitgeben, wenn eine Zeile dahintersteht. Sonst wuerde
  // der Tagebucheintrag auf etwas zeigen, das es (noch) nicht gibt.
  //
  // `zeileSteht` und nicht `bestaetigt`: Der Fremdschluessel `fk_diary_run`
  // verweist auf `runs(id)` und ist statusunabhaengig. Ihm genuegt, DASS
  // die Zeile existiert - ob ihre Kennzahlen schon bestaetigt sind, geht
  // ihn nichts an.
  return ausgang.zeileSteht ? `${ziel}&lauf=${ausgang.runId}` : ziel
}
