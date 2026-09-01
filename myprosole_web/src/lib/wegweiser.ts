/**
 * Wohin gehoert jemand, der eine geschuetzte Seite oeffnet?
 *
 * Eine Frage, eine Antwort. `AuthGuard` beantwortet nur noch, WIE umgeleitet
 * wird - hier steht, WOHIN.
 *
 * Die Reihenfolge:
 *
 *   kein Konto          -> /willkommen
 *   Profil unbekannt    -> nirgendwohin (warten)
 *   kein Anzeigename    -> /profil/setup
 *   Anamnese offen      -> /anamnese
 *   sonst               -> nirgendwohin (durchlassen)
 *
 * Der Grund fuer die zweite Zeile
 * -------------------------------
 * Am 25.08.2026 aus der laufenden Produktion gemeldet: Die App sprang mitten
 * in der Benutzung auf "Profil einrichten". Ursache war ein gescheitertes
 * Laden, das als "kein Profil" im Speicher landete.
 *
 * **Wer nicht weiss, ob ein Profil existiert, schickt niemanden weg.** Der
 * Preis ist, dass ein wirklich neues Konto bei einem gescheiterten ersten
 * Laden kurz auf der Startseite landet, bis das naechste Laden gelingt. Der
 * umgekehrte Fehler - ein Bestandskonto immer wieder zurueckwerfen - wiegt
 * schwerer, weil er jedes Mal die Stelle vergisst, an der jemand war.
 *
 * Dieselbe Ueberlegung steckt in `blockAOffen`: Der Aufrufer soll nur dann
 * `true` uebergeben, wenn der Anamnese-Stand SICHER offen ist, nicht wenn er
 * unbekannt ist. Siehe `store/anamnese.ts`, `blockOffen`.
 */

export interface Wegzustand {
  /** Gibt es ein angemeldetes Konto? */
  angemeldet: boolean
  /** Ist bekannt, OB es ein Profil gibt? `false` heisst unbekannt. */
  profilBekannt: boolean
  /** Der Anzeigename aus dem Profil, wenn es eines gibt. */
  anzeigename: string | null | undefined
  /** Ist Block A der Anamnese SICHER offen? */
  blockAOffen: boolean
  /** Der Pfad, der gerade geoeffnet wird. */
  pfad: string
}

/** Der Zielpfad, oder `null` fuer "durchlassen". */
export function wohin(zustand: Wegzustand): string | null {
  if (!zustand.angemeldet) return '/willkommen'

  // Solange nicht feststeht, ob es ein Profil gibt, wird nicht entschieden.
  // Beide folgenden Weichen haengen am Anzeigenamen, und ein unbekannter
  // Anzeigename ist kein fehlender.
  if (!zustand.profilBekannt) return null

  // Geprueft wird der Anzeigename, nicht die blosse Existenz der Zeile: Ein
  // Konto ueber Google bringt seinen Namen schon mit, ein Konto ueber E-Mail
  // nicht.
  const eingerichtet = Boolean(zustand.anzeigename?.trim())
  if (!eingerichtet) {
    return zustand.pfad === '/profil/setup' ? null : '/profil/setup'
  }

  // Der letzte Schritt der Registrierung. Block A reicht - Block B ist
  // ausdruecklich freiwillig und laesst sich spaeter nachholen.
  if (zustand.blockAOffen) {
    return zustand.pfad === '/anamnese' ? null : '/anamnese'
  }

  return null
}
