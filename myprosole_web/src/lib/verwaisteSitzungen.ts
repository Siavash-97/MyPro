/**
 * Welche Aufzeichnungen liegen noch im Dienstspeicher und gehoeren keinem?
 *
 * Der Befund
 * ----------
 * Am 23.08.2026 wurde am Geraet gemessen:
 *
 *   stand({})                       ->  offen:   0   laufId: fb215719 (heute)
 *   stand({laufId: '33f5c523...'})  ->  offen: 611   letzter Punkt: 21.08.
 *
 * **611 Punkte - zehn Minuten Aufzeichnung - lagen abrufbar da und wurden von
 * niemandem geholt.** Sie waren nicht verloren, nur unerreichbar: Der Dienst
 * merkt sich in seinen Einstellungen genau EINE Sitzung, und die war von
 * einer neueren ueberschrieben.
 *
 * Die Bergung vom 22.08. (`sitzungBergen.ts`) hat den Weg zu einer verwaisten
 * Aufzeichnung gebaut - aber nur zur juengsten. Dieses Modul findet alle.
 *
 * Was hier NICHT entschieden wird
 * -------------------------------
 * Zu welchem Lauf die gefundenen Punkte gehoeren. Der Merker kennt nur die
 * aktuelle Sitzung; fuer eine alte gibt es keine Lauf-Kennung mehr. Sie einer
 * Lauf-Zeile ueber die Uhrzeit zuzuordnen waere geraten, nicht gewusst - und
 * geratene Zuordnungen sind genau die Sorte Fehler, die dieses Projekt teuer
 * bezahlt hat. Was mit ihnen geschieht, entscheidet der Mensch.
 */

export interface Dienstsitzung {
  laufId: string
  anzahl: number
  /** Zeit der letzten Messung in Millisekunden. */
  letzteZeit: number
}

/**
 * So viele Punkte braucht es, bevor eine Sitzung als Fund gilt.
 *
 * Dreissig Punkte sind bei einem Mindestabstand von zehn Metern rund 300 m -
 * mehr als ein versehentlicher Tipper hinterlaesst. Darunter waere die
 * Meldung Laerm: Sie riefe nach Aufmerksamkeit fuer etwas, das niemand
 * vermisst.
 */
export const MIN_VERWAISTE_PUNKTE = 30

/**
 * Die verwaisten Sitzungen, juengste zuerst.
 *
 * @param sitzungen Alles, was der Dienst noch haelt.
 * @param aktuelle  Die Sitzung, die gerade laeuft oder geborgen wird - oder
 *                  null, wenn keine bekannt ist.
 */
export function verwaisteSitzungen(
  sitzungen: Dienstsitzung[] | undefined | null,
  aktuelle: string | null,
): Dienstsitzung[] {
  if (!Array.isArray(sitzungen)) return []
  return sitzungen
    .filter(
      (s) =>
        s != null &&
        typeof s.laufId === 'string' &&
        s.laufId.length > 0 &&
        s.laufId !== aktuelle &&
        Number.isFinite(s.anzahl) &&
        s.anzahl >= MIN_VERWAISTE_PUNKTE,
    )
    .sort((a, b) => (b.letzteZeit ?? 0) - (a.letzteZeit ?? 0))
}
