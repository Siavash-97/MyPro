import { beimAbmeldenVergessen } from './kontoZustand'
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

/**
 * Alle Lesestaende vom Geraet loeschen.
 *
 * Ueber PRAEFIX und nicht ueber eine Kopie davon: Wer den Praefix hier
 * aendert, aendert damit auch, was geloescht wird. Eine zweite Liste an
 * anderer Stelle hoerte still auf zu greifen.
 */
export function alleLesestaendeVergessen(): void {
  try {
    for (const schluessel of Object.keys(localStorage)) {
      if (schluessel.startsWith(PRAEFIX)) localStorage.removeItem(schluessel)
    }
  } catch {
    // Gesperrter Speicher darf das Abmelden nicht anhalten.
  }
}

// Lesezeitpunkte privater Unterhaltungen. Fuer den Naechsten unbrauchbar
// (fremde Chat-Kennungen), aber es sind die Spuren des Vorigen.
beimAbmeldenVergessen(() => alleLesestaendeVergessen())
