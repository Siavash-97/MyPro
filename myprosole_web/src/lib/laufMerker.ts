import { beimAbmeldenVergessen } from './kontoZustand'
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
  /**
   * Das Speichern ist dauerhaft gescheitert - Wiederholen bringt nichts.
   *
   * Diese Marke muss den Neustart ueberleben, sonst waere die Endlosschleife
   * nur auf dem Bildschirm beendet: Der Zustand im Arbeitsspeicher ist nach
   * einem App-Tod weg, die Bergung faende den Lauf wieder und scheiterte
   * identisch. Deshalb liegt sie hier, im localStorage, neben der
   * Sitzungskennung.
   *
   * Wer sie sieht, versucht NICHT von selbst noch einmal - er fragt den
   * Menschen. Die Punkte bleiben liegen; verwerfen ist eine Handlung, kein
   * Standardverhalten (Entscheidung des Nutzers, 24.08.2026).
   */
  dauerhaftGescheitert?: boolean
}

/** Festhalten, dass Wiederholen nichts bringt. */
export function merkerDauerhaftGescheitert(): void {
  try {
    const m = merkerLesen()
    if (!m) return
    localStorage.setItem(SCHLUESSEL, JSON.stringify({ ...m, dauerhaftGescheitert: true }))
  } catch {
    // Wie ueberall hier: Ein nicht schreibbarer Speicher darf keinen Lauf
    // kosten. Dann greift der Rueckfall - beim naechsten Start wird es
    // erneut versucht, was schlechter ist als diese Marke, aber besser als
    // ein Absturz.
  }
}

/** Die Marke zuruecknehmen - nach einer Anmeldung oder auf Wunsch. */
export function merkerWiederVersuchen(): void {
  try {
    const m = merkerLesen()
    if (!m) return
    const { dauerhaftGescheitert: _weg, ...rest } = m
    localStorage.setItem(SCHLUESSEL, JSON.stringify(rest))
  } catch {
    // siehe oben
  }
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
    // `dauerhaftGescheitert` MUSS mit heraus.
    //
    // Diese Zeile baute das Objekt aus zwei Feldern neu und liess die Marke
    // liegen - sie war damit schreibbar, aber fuer jeden Leser unsichtbar,
    // und der Neustart-Kreislauf blieb offen. Gefunden vom Agenten
    // `oberflaeche` am 24.08.2026, in Code, den ich eine Stunde zuvor
    // geschrieben hatte.
    //
    // Feld fuer Feld statt mit Spread: Ein Spread wuerde alles
    // durchreichen, was im Speicher steht - auch Reste einer aelteren
    // Fassung. Was hier steht, ist bewusst gewaehlt.
    return {
      sitzungId: wert.sitzungId,
      runId: typeof wert.runId === 'string' ? wert.runId : null,
      dauerhaftGescheitert: wert.dauerhaftGescheitert === true,
    }
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

// Die Lauf-Kennung des vorigen Kontos. Ohne das versucht
// Startbergung.tsx beim naechsten Kaltstart, dessen Lauf unter der neuen
// Sitzung zu bergen - RLS weist es ab, der Versuch laeuft trotzdem.
beimAbmeldenVergessen(() => merkerLoeschen())
