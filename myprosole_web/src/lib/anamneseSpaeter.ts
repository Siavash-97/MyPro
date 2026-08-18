/**
 * Wo jemand in der Anamnese stehengeblieben ist.
 *
 * Die Antworten selbst liegen in der Datenbank – sie werden beim Weiter
 * gespeichert. Was fehlte, war die Stelle: Beim naechsten Oeffnen begann
 * der Ablauf wieder von vorn, obwohl die Antworten laengst da waren.
 *
 * localStorage und nicht sessionStorage: Es soll gerade das Schliessen der
 * App ueberdauern, das ist der ganze Zweck.
 *
 * Der Schluessel enthaelt die Sitzungskennung. Faengt jemand eine neue
 * Anamnese an, gilt der alte Stand nicht mehr.
 */
const PRAEFIX = 'myprosole_anamnese_schritt_'

export function schrittMerken(sessionId: string, schritt: string): void {
  localStorage.setItem(PRAEFIX + sessionId, schritt)
}

export function gemerkterSchritt(sessionId: string): string | null {
  return localStorage.getItem(PRAEFIX + sessionId)
}

export function schrittVergessen(sessionId: string): void {
  localStorage.removeItem(PRAEFIX + sessionId)
}
