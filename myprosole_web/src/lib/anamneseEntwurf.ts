import type { AnamneseBlock } from '../types'

/**
 * Der angefangene Fragebogen – solange er nur auf dem Geraet liegt.
 *
 * Warum die Antworten nicht mehr sofort gespeichert werden
 * -------------------------------------------------------
 * Bisher ging jede Antwort beim "Weiter" in die Datenbank, und die
 * Einwilligung stand deshalb ganz am Anfang: Ohne sie durfte nichts
 * uebertragen werden.
 *
 * Der Einwilligungsschirm steht jetzt am Ende, nach der letzten Frage. Das
 * geht nur, wenn vorher nichts uebertragen wird – eine Erlaubnis, die man
 * erteilt, nachdem die Daten schon da sind, ist keine. Art. 9 DSGVO
 * verlangt sie vor der Verarbeitung, nicht danach.
 *
 * Also bleiben die Antworten hier: im Speicher des Geraets, in der Hand
 * dessen, der sie eingetippt hat. Erst mit der Einwilligung gehen sie in
 * einem Zug in die Datenbank.
 *
 * localStorage und nicht sessionStorage: Der Entwurf soll das Schliessen
 * der App ueberdauern – genau dafuer ist er da.
 *
 * Was das kostet
 * --------------
 * Ein angefangener Fragebogen folgt nicht auf ein anderes Geraet. Bei drei
 * bis fuenf Minuten Ausfuelldauer ist das vertretbar; der Preis dafuer ist,
 * dass vor der Einwilligung nichts das Geraet verlaesst.
 *
 * Der Schluessel haengt am Block, nicht an einer Sitzungskennung – die gibt
 * es zu diesem Zeitpunkt noch gar nicht, weil auch die Sitzung erst mit der
 * Einwilligung angelegt wird.
 */

const PRAEFIX = 'myprosole_anamnese_entwurf_'

export interface AnamneseEntwurf {
  /** Frageschluessel auf die gewaehlten Werte. */
  antworten: Record<string, string[]>
  /** Wo im Ablauf zuletzt gehalten wurde. */
  schritt: string
  /** Wann angefangen wurde – wird spaeter der Beginn der Sitzung. */
  begonnenAm: string
}

function schluessel(block: AnamneseBlock): string {
  return PRAEFIX + block
}

export function entwurfMerken(block: AnamneseBlock, entwurf: AnamneseEntwurf): void {
  try {
    localStorage.setItem(schluessel(block), JSON.stringify(entwurf))
  } catch {
    // Voller oder gesperrter Speicher darf den Fragebogen nicht anhalten.
    // Der Preis ist, dass ein Neustart dann von vorn beginnt – aergerlich,
    // aber besser als ein Ablauf, der mittendrin stehenbleibt.
  }
}

export function entwurfLesen(block: AnamneseBlock): AnamneseEntwurf | null {
  try {
    const roh = localStorage.getItem(schluessel(block))
    if (!roh) return null
    const gelesen = JSON.parse(roh) as Partial<AnamneseEntwurf>
    // Geprueft statt geglaubt: Der Inhalt stammt aus dem Geraetespeicher und
    // kann von einer aelteren Fassung der App stammen oder veraendert sein.
    if (!gelesen || typeof gelesen !== 'object') return null
    if (typeof gelesen.schritt !== 'string') return null
    if (!gelesen.antworten || typeof gelesen.antworten !== 'object') return null
    return {
      antworten: gelesen.antworten as Record<string, string[]>,
      schritt: gelesen.schritt,
      begonnenAm: gelesen.begonnenAm ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function entwurfVergessen(block: AnamneseBlock): void {
  try {
    localStorage.removeItem(schluessel(block))
  } catch {
    // Bleibt er liegen, wird er beim naechsten Durchlauf ueberschrieben.
  }
}
