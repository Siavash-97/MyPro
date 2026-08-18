/**
 * Wann ein Chat zuletzt geoeffnet wurde.
 *
 * Damit laesst sich sagen, ob seither etwas Neues kam – das ist der Punkt
 * an der Kopfleiste.
 *
 * Bewusst oertlich (localStorage) und nicht in der Datenbank: Ein
 * "gelesen bis"-Zeitpunkt je Person und Chat waere eine eigene Spalte und
 * eine Migration. Fuer den jetzigen Stand reicht das Geraet – der Preis
 * ist, dass ein Wechsel auf ein anderes Telefon alles wieder als ungelesen
 * zeigt.
 *
 * Wenn es stoert, ist die Aenderung klar umrissen: eine Spalte
 * last_read_at an der Chat-Teilnahme, und diese Datei ruft dann sie statt
 * localStorage. Der Rest der App merkt davon nichts.
 */
const PRAEFIX = 'myprosole_chat_gelesen_'

export function chatGelesen(chatId: string): void {
  localStorage.setItem(PRAEFIX + chatId, new Date().toISOString())
}

export function gelesenBis(chatId: string): string | null {
  return localStorage.getItem(PRAEFIX + chatId)
}

/** Kam seit dem letzten Oeffnen etwas Neues? */
export function hatNeues(chatId: string, letzteNachricht: string | undefined): boolean {
  if (!letzteNachricht) return false
  const bis = gelesenBis(chatId)
  return bis === null || letzteNachricht > bis
}
