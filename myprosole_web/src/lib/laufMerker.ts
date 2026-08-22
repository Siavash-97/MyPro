/**
 * Welcher Lauf gerade aufgezeichnet wird - so, dass es einen Absturz
 * ueberlebt.
 *
 * Warum es dieses Modul gibt
 * --------------------------
 * Sitzungskennung und Lauf-Kennung lebten nur im Arbeitsspeicher. Schiesst
 * Android die App waehrend eines Laufs ab - bei einer Stunde mit
 * ausgeschaltetem Bildschirm der Normalfall -, sind beide weg. Der Dienst
 * sammelt weiter, aber niemand weiss mehr, wohin die Punkte gehoeren.
 *
 * Gemessen am 22.08.2026: 611 verwaiste Punkte im Dienstspeicher, neun von
 * sechzehn Laeufen auf `status: 'tracking'` haengengeblieben.
 *
 * Warum hier und nicht nur im Dienst
 * ----------------------------------
 * Der Dienst kennt seit derselben Aenderung seine Sitzung und gibt sie
 * heraus. Er kennt aber die **Lauf-Zeile in der Datenbank** nicht - die
 * entsteht erst, wenn Netz da ist, und sie ist es, an der die Punkte
 * haengen. Beides zusammen ergibt erst einen vollstaendigen Rueckweg.
 *
 * Warum localStorage und nicht IndexedDB
 * -------------------------------------
 * Zwei Zeichenketten, synchron lesbar, beim Start sofort da. IndexedDB waere
 * asynchron und braeuchte eine Runde, bevor die App entscheiden kann.
 */

const SCHLUESSEL = 'myprosole.laufMerker.v1'

export interface Laufmerker {
  /** Die Kennung, unter der der Dienst sammelt. */
  sitzungId: string
  /** Die Zeile in `runs` - null, solange sie noch nicht angelegt ist. */
  runId: string | null
}

/** Merken, dass eine Aufzeichnung laeuft. */
export function merkerSetzen(sitzungId: string, runId: string | null): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify({ sitzungId, runId }))
  } catch {
    // Kein Speicher, kein Merker. Die Aufzeichnung laeuft trotzdem - sie ist
    // dann nur nach einem Absturz nicht mehr auffindbar.
  }
}

/**
 * Die Lauf-Zeile nachtragen, sobald sie existiert.
 *
 * Legt bewusst **keinen** Merker an, wenn keiner da ist: Ein Merker ohne
 * Sitzung zeigt beim naechsten Start auf nichts.
 */
export function merkerLaufId(runId: string): void {
  const vorhanden = merkerLesen()
  if (!vorhanden) return
  merkerSetzen(vorhanden.sitzungId, runId)
}

/** Was gemerkt ist - oder null. */
export function merkerLesen(): Laufmerker | null {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (!roh) return null
    const wert = JSON.parse(roh) as Partial<Laufmerker>
    if (typeof wert?.sitzungId !== 'string' || !wert.sitzungId) return null
    return { sitzungId: wert.sitzungId, runId: typeof wert.runId === 'string' ? wert.runId : null }
  } catch {
    // Kaputter Inhalt ist dasselbe wie keiner. Er darf die App nicht
    // mitreissen - sonst kostet ein halb geschriebener Eintrag den Start.
    return null
  }
}

/** Vergessen - nach einem sauber beendeten oder verworfenen Lauf. */
export function merkerLoeschen(): void {
  try {
    localStorage.removeItem(SCHLUESSEL)
  } catch {
    // Bleibt er stehen, meldet der naechste Start eine Aufzeichnung, die es
    // nicht mehr gibt. Der Abgleich mit dem Dienst faengt das ab: Sagt der
    // "laeuft nicht", passiert nichts.
  }
}
