/*
  Merkzettel fuer die Adresse, deren Bestaetigung noch aussteht.

  Der Link aus der E-Mail oeffnet einen neuen Tab, oft sogar einen anderen
  Browser. Der Formularzustand der Registrierung ist dort weg – die
  Bestaetigungsseite wuesste ohne diese Notiz nicht, an wen der Code ging,
  und `verifyOtp` braucht die Adresse zwingend.

  Bewusst `localStorage` und nicht `sessionStorage`: sessionStorage gilt nur
  fuer den einen Tab und waere im neuen Tab leer. Gespeichert wird
  ausschliesslich die eigene Adresse des Nutzers, und nur bis die
  Bestaetigung durch ist.
*/

const KEY = 'myprosole_pending_confirm_email'

/** Notiert die Adresse, an die gerade ein Bestaetigungscode ging. */
export function merkeBestaetigungsEmail(email: string): void {
  try {
    localStorage.setItem(KEY, email)
  } catch {
    // Privater Modus oder blockierter Speicher: Dann eben ohne Vorbelegung –
    // die Adresse laesst sich auf der Bestaetigungsseite auch eintippen.
  }
}

/** Die notierte Adresse, oder ein leerer String, wenn keine vorliegt. */
export function holeBestaetigungsEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** Loescht die Notiz. Laeuft, sobald die Bestaetigung durch ist. */
export function vergissBestaetigungsEmail(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Siehe merkeBestaetigungsEmail.
  }
}
