import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'

/**
 * Zykluskalender. Eingetragen wird ueber eine Frage am Tag, nicht ueber ein
 * Formular:
 *
 *   "Haben die Beschwerden angefangen?"  nein -> morgen nochmal
 *                                         ja  -> Beginn ist heute
 *   fuenf Tage spaeter:
 *   "Ist es vorbei?"                      nein -> morgen nochmal
 *                                         ja  -> Ende ist heute
 *
 * Welche Frage gerade dran ist, wird aus den Daten abgeleitet und nirgends
 * gespeichert – eine gespeicherte Antwort darauf koennte von den Daten
 * abweichen, eine abgeleitete nicht.
 */

/** Ab wann nach dem Beginn nach dem Ende gefragt wird. */
const TAGE_BIS_ENDE_FRAGE = 5

/**
 * Bei unregelmaessigem Zyklus wird ab diesem Tag gefragt – das ist die
 * kuerzeste uebliche Zykluslaenge. Frueher zu fragen waere laestig, spaeter
 * hiesse, einen kurzen Zyklus zu verpassen.
 */
const FRUEHESTER_TAG_UNREGELMAESSIG = 21

export type ZyklusModus = 'regular' | 'irregular'

export interface ZyklusEinstellungen {
  user_id: string
  mode: ZyklusModus
  average_days: number
  last_asked_on: string | null
}

export interface Periode {
  id: string
  user_id: string
  started_on: string
  ended_on: string | null
}

/** Was heute zu fragen ist – oder nichts. */
export type Frage = 'beginn' | 'ende' | null

/** Datum als YYYY-MM-DD in Ortszeit. toISOString() waere UTC und laege
 *  abends einen Tag daneben. */
export function alsTag(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${t}`
}

function tageDazu(tag: string, tage: number): string {
  const d = new Date(tag + 'T00:00:00')
  d.setDate(d.getDate() + tage)
  return alsTag(d)
}

/** Ganze Tage zwischen zwei Tagen. Beide in Ortszeit, daher ohne Zeitzonenfalle. */
export function tageZwischen(von: string, bis: string): number {
  const a = new Date(von + 'T00:00:00').getTime()
  const b = new Date(bis + 'T00:00:00').getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * Welche Frage heute ansteht.
 *
 * Reine Funktion, damit sie sich ohne Datenbank pruefen laesst – die
 * Reihenfolge der Bedingungen ist der eigentliche Ablauf.
 */
export function offeneFrage(
  einstellungen: ZyklusEinstellungen | null,
  perioden: Periode[],
  heute: string,
): Frage {
  if (!einstellungen) return null
  // Eine Frage pro Tag. Nach einem "nein" ist erst morgen wieder etwas zu tun.
  if (einstellungen.last_asked_on === heute) return null

  const offen = perioden.find((p) => p.ended_on === null)
  if (offen) {
    return tageZwischen(offen.started_on, heute) >= TAGE_BIS_ENDE_FRAGE ? 'ende' : null
  }

  // Ohne jeden Eintrag gibt es keinen Bezugspunkt – dann wird nicht
  // gefragt, sondern beim Einrichten nach dem letzten Beginn gefragt.
  const letzte = perioden[0]
  if (!letzte) return null

  const abstand =
    einstellungen.mode === 'regular'
      ? einstellungen.average_days
      : FRUEHESTER_TAG_UNREGELMAESSIG

  return tageZwischen(letzte.started_on, heute) >= abstand ? 'beginn' : null
}

/** Voraussichtlicher naechster Beginn. Nur bei regelmaessigem Zyklus. */
export function naechsterBeginn(
  einstellungen: ZyklusEinstellungen | null,
  perioden: Periode[],
): string | null {
  if (!einstellungen || einstellungen.mode !== 'regular') return null
  const letzte = perioden[0]
  if (!letzte) return null
  return tageDazu(letzte.started_on, einstellungen.average_days)
}

interface State {
  einstellungen: ZyklusEinstellungen | null
  perioden: Periode[]
  laedt: boolean
  fehler: string | null

  laden: () => Promise<void>
  /** Richtet den Kalender ein: Modus und der letzte bekannte Beginn. */
  einrichten: (modus: ZyklusModus, letzterBeginn: string) => Promise<string | null>
  /** Antwort auf die Beginn-Frage. */
  beginnAntwort: (ja: boolean) => Promise<string | null>
  /** Antwort auf die Ende-Frage. */
  endeAntwort: (ja: boolean) => Promise<string | null>
  /** Kalender beenden und alle Zyklusdaten loeschen. */
  beenden: () => Promise<string | null>
}

async function eigeneId(): Promise<string | null> {
  return eigeneKennung()
}

export const useCycle = create<State>((set, get) => ({
  einstellungen: null,
  perioden: [],
  laedt: false,
  fehler: null,

  laden: async () => {
    set({ laedt: true, fehler: null })
    const [{ data: e, error: eFehler }, { data: p, error: pFehler }] = await Promise.all([
      supabase.from('cycle_settings').select('*').maybeSingle(),
      supabase.from('cycle_periods').select('*').order('started_on', { ascending: false }),
    ])

    const fehler = eFehler ?? pFehler
    if (fehler) {
      set({ laedt: false, fehler: fehler.message })
      return
    }
    set({
      einstellungen: (e as ZyklusEinstellungen) ?? null,
      perioden: (p ?? []) as Periode[],
      laedt: false,
    })
  },

  einrichten: async (modus, letzterBeginn) => {
    const id = await eigeneId()
    if (!id) return 'Nicht angemeldet'

    const { error: eFehler } = await supabase
      .from('cycle_settings')
      .upsert({ user_id: id, mode: modus, last_asked_on: null }, { onConflict: 'user_id' })
    if (eFehler) return eFehler.message

    // Der genannte Beginn ist der Bezugspunkt fuer die erste Frage. Er gilt
    // als abgeschlossen – sonst stuende sofort die Ende-Frage im Raum, und
    // zwar rueckwirkend fuer eine Periode, die laengst vorbei ist.
    const { error: pFehler } = await supabase
      .from('cycle_periods')
      .upsert(
        { user_id: id, started_on: letzterBeginn, ended_on: tageDazu(letzterBeginn, 4) },
        { onConflict: 'user_id,started_on' },
      )
    if (pFehler) return pFehler.message

    await get().laden()
    return null
  },

  beginnAntwort: async (ja) => {
    const id = await eigeneId()
    if (!id) return 'Nicht angemeldet'
    const heute = alsTag(new Date())

    if (ja) {
      const { error } = await supabase
        .from('cycle_periods')
        .insert({ user_id: id, started_on: heute })
      if (error) return error.message
    }

    // In beiden Faellen: heute ist beantwortet. Bei "nein" ist das der
    // ganze Zweck – morgen wird neu gefragt.
    const { error } = await supabase
      .from('cycle_settings')
      .update({ last_asked_on: heute })
      .eq('user_id', id)
    if (error) return error.message

    await get().laden()
    return null
  },

  endeAntwort: async (ja) => {
    const id = await eigeneId()
    if (!id) return 'Nicht angemeldet'
    const heute = alsTag(new Date())

    if (ja) {
      const offen = get().perioden.find((p) => p.ended_on === null)
      if (offen) {
        const { error } = await supabase
          .from('cycle_periods')
          .update({ ended_on: heute })
          .eq('id', offen.id)
        if (error) return error.message
      }
    }

    const { error } = await supabase
      .from('cycle_settings')
      .update({ last_asked_on: heute })
      .eq('user_id', id)
    if (error) return error.message

    await get().laden()
    return null
  },

  beenden: async () => {
    const id = await eigeneId()
    if (!id) return 'Nicht angemeldet'

    // Erst die Eintraege, dann die Einstellung. Andersherum bliebe bei
    // einem Abbruch dazwischen genau das liegen, was geloescht werden
    // sollte – die Gesundheitsdaten.
    const { error: pFehler } = await supabase.from('cycle_periods').delete().eq('user_id', id)
    if (pFehler) return pFehler.message

    const { error } = await supabase.from('cycle_settings').delete().eq('user_id', id)
    if (error) return error.message

    set({ einstellungen: null, perioden: [] })
    return null
  },
}))
