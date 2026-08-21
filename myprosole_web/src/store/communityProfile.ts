import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'

/**
 * Das Community-Profil: was andere von einem sehen.
 *
 * Zwei Faelle, dieselben Daten:
 *  - das eigene Profil wird bearbeitet und gespeichert
 *  - ein fremdes wird nur angesehen
 *
 * Kilometer und laengster Lauf kommen nicht aus einer Tabelle, sondern aus
 * der Funktion community_stats. Die prueft selbst, ob die Person das zeigen
 * will, und gibt sonst nichts zurueck. Ein Aufruf fuer eine Person mit
 * ausgeschaltetem Schalter ist also kein Fehler – er liefert einfach nichts.
 */

/** Auswahl aus dem Entwurf. "+ Andere" ist keine Sportart, sondern der Eingang zum Freitext. */
export const SPORTARTEN = [
  'Radfahren', 'Schwimmen', 'Krafttraining', 'Yoga', 'Wandern', 'Triathlon',
] as const

export interface CommunityProfil {
  user_id: string
  bio: string | null
  running_years: number | null
  sports: string[]
  show_stats: boolean
  // Die sechs Fragen aus Migration 0048. Alle duerfen leer bleiben: Ein
  // Profil ohne Antworten ist gueltig, es bekommt nur weniger passende
  // Vorschlaege.
  km_woche: string | null
  lauf_grund: string | null
  lieber: string | null
  gelaende: string | null
  im_verein: boolean | null
  schoen_am_laufen: string | null
}

export interface ProfilFoto {
  id: string
  user_id: string
  path: string
  position: number
}

export interface CommunityStats {
  kilometer: number
  laengsterLaufKm: number
}

/** Nur die Felder, die das Formular schreibt. */
export type ProfilEingabe = Pick<
  CommunityProfil,
  | 'bio'
  | 'running_years'
  | 'sports'
  | 'show_stats'
  | 'km_woche'
  | 'lauf_grund'
  | 'lieber'
  | 'gelaende'
  | 'im_verein'
  | 'schoen_am_laufen'
>

interface State {
  profil: CommunityProfil | null
  fotos: ProfilFoto[]
  stats: CommunityStats | null
  laedt: boolean
  fehler: string | null

  /** Laedt Profil, Fotos und – falls freigegeben – die zwei Zahlen. */
  laden: (userId: string) => Promise<void>
  speichern: (eingabe: ProfilEingabe) => Promise<string | null>
  fotoHinzufuegen: (datei: File) => Promise<string | null>
  fotoEntfernen: (foto: ProfilFoto) => Promise<string | null>
}

/** Endung aus dem Dateityp, nicht aus dem Namen – der kann alles Moegliche sein. */
function endungVon(datei: File): string {
  const typ = datei.type.split('/')[1]?.toLowerCase()
  if (!typ || !/^[a-z0-9]{2,5}$/.test(typ)) return 'jpg'
  return typ === 'jpeg' ? 'jpg' : typ
}

export const useCommunityProfil = create<State>((set, get) => ({
  profil: null,
  fotos: [],
  stats: null,
  laedt: false,
  fehler: null,

  laden: async (userId) => {
    set({ laedt: true, fehler: null })

    const [{ data: profil, error: profilFehler }, { data: fotos, error: fotoFehler }] =
      await Promise.all([
        supabase.from('community_profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase
          .from('community_profile_photos')
          .select('*')
          .eq('user_id', userId)
          .order('position', { ascending: true }),
      ])

    const fehler = profilFehler ?? fotoFehler
    if (fehler) {
      set({ laedt: false, fehler: fehler.message })
      return
    }

    // Die Zahlen erst danach: Ohne Freigabe kommt eine leere Menge zurueck.
    const { data: stats } = await supabase.rpc('community_stats', { ziel: userId })
    const zeile = Array.isArray(stats) ? stats[0] : null

    set({
      profil: (profil as CommunityProfil) ?? null,
      fotos: (fotos ?? []) as ProfilFoto[],
      stats: zeile
        ? {
            kilometer: Number(zeile.kilometer) || 0,
            laengsterLaufKm: Number(zeile.laengster_lauf_km) || 0,
          }
        : null,
      laedt: false,
      fehler: null,
    })
  },

  speichern: async (eingabe) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // upsert statt insert-oder-update: Beim ersten Speichern gibt es die
    // Zeile noch nicht, danach schon. Der Schluessel ist die Nutzerkennung.
    const { data, error } = await supabase
      .from('community_profiles')
      .upsert({ user_id: userId, ...eingabe }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) return error.message

    set({ profil: data as CommunityProfil })
    // Der Schalter entscheidet ueber die Zahlen – also nach dem Speichern neu holen.
    const { data: stats } = await supabase.rpc('community_stats', { ziel: userId })
    const zeile = Array.isArray(stats) ? stats[0] : null
    set({
      stats: zeile
        ? {
            kilometer: Number(zeile.kilometer) || 0,
            laengsterLaufKm: Number(zeile.laengster_lauf_km) || 0,
          }
        : null,
    })
    return null
  },

  fotoHinzufuegen: async (datei) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const belegt = get().fotos
    if (belegt.length >= 5) return 'Mehr als fünf Fotos gehen nicht.'

    // Die erste freie Position, nicht einfach die Anzahl: Nach dem Loeschen
    // eines mittleren Fotos waere die Anzahl schon vergeben, und die
    // Eindeutigkeitsregel in der Datenbank wuerde das Einfuegen abweisen.
    const genommen = new Set(belegt.map((f) => f.position))
    let position = 0
    while (genommen.has(position)) position += 1

    const pfad = `${userId}/profil-${crypto.randomUUID()}.${endungVon(datei)}`
    const { error: hochladen } = await supabase.storage
      .from('community')
      .upload(pfad, datei, { contentType: datei.type || 'image/jpeg' })
    if (hochladen) return hochladen.message

    const { data, error } = await supabase
      .from('community_profile_photos')
      .insert({ user_id: userId, path: pfad, position })
      .select()
      .single()

    if (error) {
      // Die Datei wieder wegraeumen, sonst liegt sie ohne Eintrag im Behaelter.
      await supabase.storage.from('community').remove([pfad])
      return error.message
    }

    set({ fotos: [...belegt, data as ProfilFoto].sort((a, b) => a.position - b.position) })
    return null
  },

  fotoEntfernen: async (foto) => {
    const { error } = await supabase
      .from('community_profile_photos')
      .delete()
      .eq('id', foto.id)

    if (error) return error.message

    // Erst nach dem erfolgreichen Loeschen des Eintrags. Scheitert das
    // Aufraeumen der Datei, bleibt nur eine verwaiste Datei liegen – das
    // Profil stimmt trotzdem.
    await supabase.storage.from('community').remove([foto.path])
    set({ fotos: get().fotos.filter((f) => f.id !== foto.id) })
    return null
  },
}))
