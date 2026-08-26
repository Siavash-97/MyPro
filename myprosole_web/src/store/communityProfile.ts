import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { dateiMitZeile, verwaistMerken } from '../lib/dateiAblegen'
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
  // Wer sieht wen - Migration 0049. `identitaet` bleibt oeffentlich und
  // gehoert deshalb hierher.
  identitaet: string | null
}

/**
 * Die drei EINSTELLUNGEN - bewusst nicht Teil von `CommunityProfil`.
 *
 * Warum sie getrennt liegen
 * -------------------------
 * Migration 0057 entzieht `zeigt_mir`, `sichtbar_fuer` und
 * `zusammenlauf_sichtbar` der Rolle `authenticated`; sie kommen nur noch
 * ueber `meine_profil_einstellungen()` und nur fuer das eigene Konto.
 *
 * Der Grund fuer die TRENNUNG ist aber ein anderer, und er wiegt schwerer:
 * Lagen sie weiter im selben Objekt wie die Bio, koennte ein Speichern der
 * Bio sie mitschicken. Wer sie beim Laden nicht bekommt (fremdes Profil,
 * fehlgeschlagener Aufruf), haette dort `[]` stehen - und `'{}'` heisst
 * laut 0049 ausdruecklich **"alle"**. Aus "nur Frauen duerfen mich sehen"
 * wuerde beim naechsten Bio-Speichern lautlos "alle duerfen mich sehen".
 *
 * Gefunden vom Agenten `sicherheit` am 24.08.2026 - an einem Umbau, der
 * B17 beheben sollte und ihn verschlimmert haette.
 *
 * Durch die Trennung ist dieser Fehler nicht mehr moeglich: `speichern`
 * kennt die Felder nicht, und `einstellungenSpeichern` schreibt nichts
 * anderes.
 */
export interface ProfilEinstellungen {
  zeigt_mir: string[]
  sichtbar_fuer: string[]
  zusammenlauf_sichtbar: boolean
}

/** Was gilt, wenn es noch kein Community-Profil gibt (Vorgaben aus 0049). */
export const EINSTELLUNGEN_VORGABE: ProfilEinstellungen = {
  zeigt_mir: [],
  sichtbar_fuer: [],
  zusammenlauf_sichtbar: false,
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
  | 'identitaet'
>

/** Die 14 Spalten, die ein Fremder sehen darf - Migration 0057. */
const OEFFENTLICHE_SPALTEN =
  'user_id, bio, running_years, sports, show_stats, created_at, updated_at, ' +
  'lauf_grund, km_woche, lieber, gelaende, im_verein, schoen_am_laufen, identitaet'

interface State {
  profil: CommunityProfil | null
  fotos: ProfilFoto[]
  stats: CommunityStats | null
  /**
   * Die eigenen Einstellungen - null, solange sie nicht geladen sind.
   *
   * Null heisst ausdruecklich "unbekannt", nicht "leer". Wer daraus `[]`
   * macht und speichert, gibt sein Profil frei (siehe ProfilEinstellungen).
   */
  einstellungen: ProfilEinstellungen | null
  laedt: boolean
  fehler: string | null

  /** Laedt Profil, Fotos und – falls freigegeben – die zwei Zahlen. */
  laden: (userId: string) => Promise<void>
  /** Holt die eigenen Einstellungen. Nur fuer das angemeldete Konto. */
  einstellungenLaden: () => Promise<void>
  /**
   * Schreibt NUR die zwei Praeferenzen - nicht den Schalter.
   *
   * Der Schalter hat einen eigenen Weg (`zusammenlauf.sichtbarkeitSetzen`),
   * weil er an einer Einwilligungszeile haengt und von einer anderen Seite
   * bedient wird. Wer ihn hier mitschickte, ueberschriebe eine Aenderung,
   * die gerade auf einem zweiten Geraet passiert ist.
   */
  einstellungenSpeichern: (
    werte: Pick<ProfilEinstellungen, 'zeigt_mir' | 'sichtbar_fuer'>,
  ) => Promise<string | null>
  speichern: (eingabe: ProfilEingabe) => Promise<string | null>
  fotoHinzufuegen: (datei: File) => Promise<string | null>
  fotoEntfernen: (foto: ProfilFoto) => Promise<string | null>
}

export const useCommunityProfil = create<State>((set, get) => ({
  profil: null,
  fotos: [],
  stats: null,
  einstellungen: null,
  laedt: false,
  fehler: null,

  laden: async (userId) => {
    set({ laedt: true, fehler: null })

    const [{ data: profil, error: profilFehler }, { data: fotos, error: fotoFehler }] =
      await Promise.all([
        // KEIN `select('*')` mehr: `*` verlangt Leserecht auf JEDE Spalte,
        // und seit 0057 fehlt es fuer drei. Ein Stern haette danach das
        // Laden JEDES Profils mit 42501 beendet - auch des eigenen.
        supabase
          .from('community_profiles')
          .select(OEFFENTLICHE_SPALTEN)
          .eq('user_id', userId)
          .maybeSingle(),
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
      // `as unknown as`: Der Supabase-Client leitet den Rueckgabetyp aus
      // dem select-STRING ab. Steht dort eine Konstante statt eines
      // Literals, kann er es nicht und faellt auf GenericStringError
      // zurueck. Die Alternative waere, die 14 Spalten an jeder Aufrufstelle
      // auszuschreiben - also genau die Doppelung, die OEFFENTLICHE_SPALTEN
      // vermeidet.
      profil: (profil as unknown as CommunityProfil) ?? null,
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

  einstellungenLaden: async () => {
    // Ueber die Funktion, nicht ueber die Tabelle: Seit 0057 darf
    // `authenticated` diese drei Spalten nicht mehr lesen. Die Funktion
    // laeuft mit erhoehten Rechten und nimmt ABSICHTLICH keinen Parameter -
    // es gibt keinen Weg, sie fuer eine fremde Kennung zu fragen.
    const { data, error } = await supabase.rpc('meine_profil_einstellungen')

    if (error) {
      // `einstellungen` bleibt null - "unbekannt", nicht "leer". Die
      // Oberflaeche darf in diesem Zustand nichts speichern, was diese
      // Felder beruehrt.
      set({ fehler: error.message })
      return
    }

    // `returns table` liefert ein ARRAY mit null oder einer Zeile, kein
    // Objekt. Wer hier `data.zusammenlauf_sichtbar` liest, bekommt aus einem
    // gesetzten `true` ein `undefined` - und die Oberflaeche zeigt den
    // Schalter faelschlich als aus.
    const zeile = Array.isArray(data) ? data[0] : null

    // Leere Menge heisst: noch kein Community-Profil. Dann gelten die
    // Vorgaben der Datenbank, und das ist eine Aussage - kein Fehler.
    set({
      einstellungen: zeile
        ? {
            zeigt_mir: (zeile.zeigt_mir as string[]) ?? [],
            sichtbar_fuer: (zeile.sichtbar_fuer as string[]) ?? [],
            zusammenlauf_sichtbar: (zeile.zusammenlauf_sichtbar as boolean) ?? false,
          }
        : { ...EINSTELLUNGEN_VORGABE },
    })
  },

  einstellungenSpeichern: async (werte) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Die Wache, die den eigentlichen Fehler unmoeglich macht.
    //
    // Wer die Einstellungen nie geladen hat, darf sie nicht schreiben. Sonst
    // schriebe eine Seite, die sie nicht kennt, die Vorgaben hinein - und
    // `sichtbar_fuer = '{}'` heisst laut 0049 "alle". Ein Speichern ohne
    // vorheriges Laden waere damit eine stille Freigabe des Profils.
    if (get().einstellungen === null) {
      return 'Die Einstellungen sind nicht geladen – bitte die Seite neu öffnen.'
    }

    // Ueber die Funktion, NICHT ueber einen upsert.
    //
    // Ein `upsert` auf diese Spalten scheitert seit 0057 mit 42501, und der
    // Grund ist eine Feinheit, die zwei Agenten aus dem Postgres-Quelltext
    // falsch abgeleitet haben: `on conflict do update set spalte = ...`
    // verlangt SELECT auf die ZIELSPALTE der Zuweisung. Die EXCLUDED-Seite
    // ist rechtefrei - die linke Seite nicht.
    //
    // Gemessen, nicht abgeleitet: upsert mit zusammenlauf_sichtbar -> 42501,
    // upsert mit bio -> 200. Gefunden vom Agenten `oberflaeche` am
    // 24.08.2026 gegen eine lokale Datenbank.
    const { error } = await supabase.rpc('meine_profil_einstellungen_setzen', {
      p_zeigt_mir: werte.zeigt_mir,
      p_sichtbar_fuer: werte.sichtbar_fuer,
    })

    if (error) return error.message
    // Der Schalter bleibt, wie er war - diese Funktion fasst ihn nicht an.
    const vorher = get().einstellungen ?? EINSTELLUNGEN_VORGABE
    set({ einstellungen: { ...vorher, ...werte } })
    return null
  },

  speichern: async (eingabe) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // upsert statt insert-oder-update: Beim ersten Speichern gibt es die
    // Zeile noch nicht, danach schon. Der Schluessel ist die Nutzerkennung.
    const { data, error } = await supabase
      .from('community_profiles')
      .upsert({ user_id: userId, ...eingabe }, { onConflict: 'user_id' })
      // Ausgeschrieben statt `.select()`: Ohne Argument ist das `select=*`
      // und setzt `Prefer: return=representation` - PostgREST liest mit
      // RETURNING zurueck und scheitert seit 0057 an den drei Spalten.
      // Geschrieben werden duerfen sie weiterhin, nur zurueckgelesen nicht.
      .select(OEFFENTLICHE_SPALTEN)
      .single()

    if (error) return error.message

    set({ profil: data as unknown as CommunityProfil })
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

    const { daten, fehler } = await dateiMitZeile<ProfilFoto>({
      behaelter: 'community',
      praefix: userId,
      // Wird nirgends ausgewertet - aber Profilfotos und Beitragsbilder
      // liegen im selben Behaelter unter demselben Praefix und waeren sonst
      // fuer einen Menschen nicht auseinanderzuhalten.
      namensvorsatz: 'profil-',
      datei,
      rueckfallEndung: 'jpg',
      rueckfallTyp: 'image/jpeg',
      zeileSchreiben: async (pfad) =>
        await supabase
          .from('community_profile_photos')
          .insert({ user_id: userId, path: pfad, position })
          .select()
          .single(),
    })
    if (fehler) return fehler

    set({ fotos: [...belegt, daten as ProfilFoto].sort((a, b) => a.position - b.position) })
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
    // Profil stimmt trotzdem. Unbemerkt bleibt es nicht.
    const { error: aufraeumen } = await supabase.storage.from('community').remove([foto.path])
    if (aufraeumen) verwaistMerken('community', foto.path, aufraeumen.message)
    set({ fotos: get().fotos.filter((f) => f.id !== foto.id) })
    return null
  },
}))
