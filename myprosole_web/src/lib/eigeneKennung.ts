import { useAuth } from '../store/auth'

/**
 * Die eigene Nutzerkennung – ohne Anfrage ans Netz.
 *
 * Warum es das gibt
 * -----------------
 * Vorher stand in dreissig Stores dieselbe Zeile:
 *
 *   const { data: { user } } = await supabase.auth.getUser()
 *
 * `getUser()` fragt jedes Mal beim Server nach. Dreissig Aufrufe auf den
 * ueblichen Wegen heisst: dreissig zusaetzliche Anfragen, nur um zu
 * erfahren, wer man selbst ist – und das steht laengst im Auth-Store, der
 * beim Start einmal gefuellt und ueber onAuthStateChange aktuell gehalten
 * wird. Bei gutem Empfang faellt das kaum auf, bei schlechtem macht es
 * jede Aktion spuerbar traeger.
 *
 * Warum das gefahrlos ist
 * -----------------------
 * Diese Kennung entscheidet nichts. Sie wird nur mitgeschickt, damit die
 * Zeile den richtigen Eigentuemer bekommt. Ob jemand etwas lesen oder
 * schreiben darf, entscheiden allein die Zeilenrechte in der Datenbank –
 * und die pruefen `auth.uid()` aus dem mitgesendeten Anmeldeschein, nicht
 * das, was die App behauptet. Eine gefaelschte Kennung wuerde dort
 * abgewiesen.
 *
 * Die Gueltigkeit der Sitzung selbst wird weiterhin beim Start gegen den
 * Server geprueft (siehe `initialize` in store/auth.ts). Genau dort
 * gehoert sie hin: einmal, an einer Stelle.
 */
export function eigeneKennung(): string | null {
  return useAuth.getState().user?.id ?? null
}
