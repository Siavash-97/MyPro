/**
 * Was ein Supabase-Fehler bedeutet - an seinem Code, nicht an seinem Text.
 */

/** Verstoss gegen eine Eindeutigkeit (unique_violation). */
const DOPPELT = '23505'

/**
 * Ist dieser Fehler ein „gibt es schon"?
 *
 * Warum am Code und nicht am Wortlaut
 * -----------------------------------
 * Bis zum 22.08.2026 stand in `chats.ts` `error.message.includes('duplicate')`.
 * Das haengt an einer englischen Meldung von PostgreSQL. Aendert sich Wortlaut
 * oder Sprache, kippt die Pruefung lautlos ins Gegenteil - sie meldete dann
 * einen Fehler, wo keiner ist: bei einer zweiten Zusage, die nur herstellt,
 * was ohnehin schon gilt.
 *
 * Der Code ist Teil des SQL-Standards und aendert sich nicht.
 */
export function istDoppelt(
  // `message` steht bewusst im Typ, obwohl die Funktion ihn nicht liest:
  // Sie KOENNTE danach gehen und tut es nicht. Genau das prueft ein Test.
  fehler: { code?: string | null; message?: string } | null | undefined,
): boolean {
  return fehler?.code === DOPPELT
}
