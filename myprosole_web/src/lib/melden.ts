import { supabase } from './supabase'

/**
 * Melden.
 *
 * Ein tiefes Modul: Wer etwas melden laesst, muss nicht wissen, wie die
 * Tabelle heisst, welche Gruende zu welcher Art gehoeren, wie man an die
 * eigene Kennung kommt oder was zu tun ist, wenn die Datenbank meckert.
 * Zwei Aufrufe genuegen - Gruende holen, Meldung abschicken.
 *
 * Deshalb kostet der vierte Ort, an dem gemeldet werden soll, drei Zeilen
 * und keine Ueberlegung.
 *
 * Warum die Gruende von der Art abhaengen
 * ---------------------------------------
 * Ein Mensch kann beleidigen, ein Beitrag nicht. Ein Beitrag kann
 * Gewaltdarstellung sein, ein Mensch nicht. Wer beide Listen zusammenwirft,
 * zwingt jeden Meldenden, an Gruenden vorbeizulesen, die nicht passen - und
 * je laenger die Liste, desto eher bricht jemand ab.
 */

export type Meldeart = 'beitrag' | 'kommentar' | 'profil' | 'support'

export interface Meldegrund {
  /** Was in der Datenbank steht. Nie uebersetzt. */
  schluessel: string
  /** Was der Mensch liest. */
  text: string
}

/** Gilt fuer Menschen wie fuer Inhalte. */
const GEGEN_ALLE: Meldegrund[] = [
  { schluessel: 'beschimpfung', text: 'Beschimpfung' },
  { schluessel: 'belaestigung', text: 'Belästigung' },
  { schluessel: 'gewalt', text: 'Gewalt oder Drohung' },
  { schluessel: 'spam', text: 'Spam' },
]

/** Nur gegen Inhalte - denn das sind Dinge, die wir verbreiten. */
const NUR_INHALTE: Meldegrund[] = [
  { schluessel: 'gewaltdarstellung', text: 'Gewaltdarstellung' },
  { schluessel: 'terror', text: 'Terror oder Extremismus' },
  { schluessel: 'nicht_jugendfrei', text: 'Nicht jugendfrei' },
  { schluessel: 'selbstgefaehrdung', text: 'Selbstgefährdung' },
  { schluessel: 'urheberrecht', text: 'Urheberrecht' },
]

/** Nur gegen Menschen. */
const NUR_MENSCHEN: Meldegrund[] = [
  { schluessel: 'gefaelschtes_konto', text: 'Gefälschtes Konto' },
]

const ANDERES: Meldegrund = { schluessel: 'anderes', text: 'Etwas anderes' }

/**
 * Welche Gruende zu dieser Art gehoeren - in der Reihenfolge, in der sie
 * angezeigt werden. "Etwas anderes" steht immer zuletzt, weil es sonst die
 * bequemste Antwort waere und die Liste darueber niemand mehr liest.
 */
export function gruendeFuer(art: Meldeart): Meldegrund[] {
  if (art === 'support') return [ANDERES]
  const inhalt = art === 'beitrag' || art === 'kommentar'
  return [...GEGEN_ALLE, ...(inhalt ? NUR_INHALTE : NUR_MENSCHEN), ANDERES]
}

/** Braucht dieser Grund eine Erklaerung? */
export function freitextNoetig(grund: string): boolean {
  return grund === ANDERES.schluessel
}

export interface Meldung {
  art: Meldeart
  /** Bei 'support' bleibt es leer: Man wendet sich an uns, nicht gegen jemanden. */
  zielId?: string | null
  grund: string
  freitext?: string
}

/**
 * Abschicken.
 *
 * @returns null, wenn es geklappt hat - sonst ein Satz, den man einem
 *          Menschen zeigen kann. Nie eine Datenbankmeldung: Die verraet
 *          Tabellennamen und hilft niemandem.
 */
export async function meldungAbschicken(meldung: Meldung): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Zum Melden musst du angemeldet sein.'

  const text = meldung.freitext?.trim()
  if (freitextNoetig(meldung.grund) && !text) {
    return 'Schreib kurz, worum es geht.'
  }

  const { error } = await supabase.from('meldungen').insert({
    melder_id: user.id,
    art: meldung.art,
    ziel_id: meldung.art === 'support' ? null : meldung.zielId,
    grund: meldung.grund,
    freitext: text || null,
  })

  if (error) return 'Die Meldung konnte nicht gespeichert werden. Versuch es noch einmal.'
  return null
}
