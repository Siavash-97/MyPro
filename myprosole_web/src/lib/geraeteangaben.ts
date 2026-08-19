import { Capacitor } from '@capacitor/core'

/**
 * Die beiden Angaben, die statt einer IP-Adresse erhoben werden.
 *
 * Sie beantworten dieselben Fragen – aus welchen Laendern kommen die Nutzer,
 * und wie viele nutzen Android, iPhone oder den Browser –, ohne ein
 * personenbezogenes Datum zu speichern. Warum das die bessere Wahl ist,
 * steht ausfuehrlich in Migration 0036.
 *
 * Erhoben wird nur, solange die Erlaubnis 'analyse' gilt. Darum kuemmert
 * sich store/einwilligung.ts – hier steht nur, woher die Werte kommen.
 */

export type Plattform = 'android' | 'ios' | 'web'

/**
 * Womit die App gerade laeuft.
 *
 * Kommt von Capacitor und ist damit exakt – nicht geraten aus einer
 * Browserkennung, die sich faelschen laesst und bei jedem Hersteller anders
 * aussieht.
 */
export function plattform(): Plattform {
  const p = Capacitor.getPlatform()
  return p === 'android' || p === 'ios' ? p : 'web'
}

/**
 * Die Zeitzone des Geraets, etwa 'Europe/Berlin'.
 *
 * Ein Hinweis auf das Land, keine Tatsache: Wer sie umstellt oder verreist,
 * erscheint anderswo. Fuer die Frage "grob woher" reicht das.
 *
 * Null, wenn das Geraet keine liefert. Die Spalte ist nullbar, und eine
 * fehlende Angabe ist ehrlicher als eine erfundene.
 */
export function zeitzone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}
