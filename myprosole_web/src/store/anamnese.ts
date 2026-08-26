import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { AnamneseBlock, AnamneseSession, AnamneseAnswer } from '../types'

interface AnamneseState {
  sessions: AnamneseSession[]
  answers: Map<string, AnamneseAnswer[]>
  loading: boolean

  /**
   * Ist der Stand ueberhaupt bekannt?
   *
   * `false`, solange kein Laden gelungen ist. Wichtig, weil `sessions: []`
   * zwei verschiedene Dinge bedeuten koennte - "noch nie geladen" und
   * "geladen, es gibt keine" - und der Unterschied darueber entscheidet, ob
   * jemand in die Registrierung geschickt wird.
   */
  standBekannt: boolean

  /**
   * Warum das letzte Laden scheiterte - oder `null`.
   *
   * Ohne dieses Feld war der Fehler nach dem Fix vom 25.08.2026 vollstaendig
   * unsichtbar: Der Waechter leitet nicht mehr um, die Startseite erinnert
   * nicht, die Glocke schweigt. Ein Neunutzer, dessen Laden dauerhaft
   * scheitert, saesse in einer App mit Durchschnittswerten, ohne dass ihm
   * jemand sagt, dass etwas fehlt. Gefunden vom Agenten `pruefung`.
   *
   * Der Speicher hat damit drei UNTERSCHEIDBARE Lagen: unbekannt-mit-Grund,
   * bekannt-leer, bekannt-voll.
   *
   * ABER: Dieses Feld hat noch KEINEN Leser in der Oberflaeche. Es wird
   * geschrieben und ueber `console.warn` protokolliert - der Nutzer sieht
   * nichts davon. Der gemeldete Fehler ist damit von "falsch sichtbar"
   * (ueberfluessige Registrierungsseite) auf "gar nicht sichtbar"
   * verschoben, nicht geloest.
   *
   * Der Agent `pruefung` hat genau das angestrichen, nachdem ein frueherer
   * Kommentar an dieser Stelle das Gegenteil behauptete. Ein Leser oder ein
   * Wiederholversuch fehlt und steht als offener Punkt im Bericht vom
   * 25.08.2026.
   */
  ladefehler: string | null

  fetchSessions: () => Promise<void>
  fetchAnswers: (sessionId: string) => Promise<void>

  startSession: (block: AnamneseBlock) => Promise<AnamneseSession | null>
  completeSession: (sessionId: string) => Promise<string | null>

  saveAnswer: (
    sessionId: string,
    questionKey: string,
    values: string[],
  ) => Promise<string | null>

  /**
   * Alle Antworten eines Durchlaufs auf einmal.
   *
   * Gebraucht, seit die Antworten bis zur Einwilligung auf dem Geraet
   * bleiben (siehe lib/anamneseEntwurf.ts): Am Ende gehen sie in einem Zug
   * hinaus. Eine Anfrage statt siebzehn – und vor allem eine Entscheidung
   * statt siebzehn: Entweder alles kommt an oder nichts.
   */
  antwortenSpeichern: (
    sessionId: string,
    antworten: Record<string, string[]>,
  ) => Promise<string | null>

  getSession: (block: AnamneseBlock) => AnamneseSession | undefined
  hasCompletedBlock: (block: AnamneseBlock) => boolean

  /**
   * Ist dieser Block SICHER offen?
   *
   * Das ist die Frage, die der Waechter, die Startseite und die
   * Benachrichtigungen wirklich stellen - alle drei fragten bisher
   * `!hasCompletedBlock(...)` und bekamen bei einem Ladefehler ein falsches
   * Ja. Auf Unbekannt lautet die Antwort hier nein: Wer es nicht weiss,
   * schickt niemanden weg und erinnert an nichts.
   */
  blockOffen: (block: AnamneseBlock) => boolean

  /**
   * Alles vergessen, was zum bisherigen Konto gehoert.
   *
   * Wird beim Abmelden gerufen. Ohne das traegt der naechste Angemeldete die
   * Zusicherung des vorigen: `standBekannt` bliebe `true`, und wenn sein
   * eigenes Laden scheitert, kaeme er an der Pflicht-Anamnese vorbei.
   * Gefunden vom Agenten `pruefung` am 25.08.2026 - der Fix von heute frueh
   * war an dieser Stelle eine Verschlechterung gegenueber vorher.
   */
  zuruecksetzen: () => void
}

export const useAnamnese = create<AnamneseState>((set, get) => ({
  sessions: [],
  answers: new Map(),
  loading: false,
  standBekannt: false,
  ladefehler: null,

  fetchSessions: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('anamnese_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    // Scheitert die Abfrage, bleibt der bisherige Stand stehen - er wird
    // NICHT durch eine leere Liste ersetzt. Sonst sieht ein Konto mit
    // laengst erledigter Anamnese aus wie ein frisch registriertes, und der
    // Waechter schickt es zurueck in die Registrierung. Genau das war der
    // Fehler vom 24.08.2026: die Seite kam mitten in der Benutzung wieder,
    // immer dann, wenn eine Token-Erneuerung auf schwaches Netz traf.
    if (error) {
      // console.warn, wo man ihn beim Nachsehen findet - dasselbe Muster wie
      // in LiveTracking.tsx. Ohne das ist ein dauerhaft scheiterndes Laden
      // von aussen nicht von "es gibt nichts" zu unterscheiden.
      console.warn(`Anamnese-Stand laden fehlgeschlagen: ${error.message}`)
      set({ ladefehler: error.message, loading: false })
      return
    }

    set({
      sessions: (data ?? []) as AnamneseSession[],
      standBekannt: true,
      ladefehler: null,
      loading: false,
    })
  },

  fetchAnswers: async (sessionId) => {
    const { data } = await supabase
      .from('anamnese_answers')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    const answers = new Map(get().answers)
    answers.set(sessionId, (data ?? []) as AnamneseAnswer[])
    set({ answers })
  },

  startSession: async (block) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('anamnese_sessions')
      .insert({
        user_id: user.id,
        block,
        questionnaire_version: 1,
      })
      .select()
      .single()

    if (error || !data) return null

    const session = data as AnamneseSession
    set({ sessions: [session, ...get().sessions] })
    return session
  },

  completeSession: async (sessionId) => {
    const { error } = await supabase
      .from('anamnese_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', sessionId)

    if (error) return error.message

    set({
      sessions: get().sessions.map((s) =>
        s.id === sessionId
          ? { ...s, completed_at: new Date().toISOString() }
          : s,
      ),
    })
    return null
  },

  saveAnswer: async (sessionId, questionKey, values) => {
    // Delete existing answers for this question first (upsert pattern)
    await supabase
      .from('anamnese_answers')
      .delete()
      .eq('session_id', sessionId)
      .eq('question_key', questionKey)

    if (values.length === 0) return null

    const rows = values.map((v) => ({
      session_id: sessionId,
      question_key: questionKey,
      answer_value: v,
    }))

    const { error } = await supabase.from('anamnese_answers').insert(rows)
    if (error) return error.message
    return null
  },

  antwortenSpeichern: async (sessionId, antworten) => {
    const rows = Object.entries(antworten).flatMap(([question_key, values]) =>
      // Leere Antworten gar nicht erst mitschicken. Eine Frage, die
      // uebersprungen wurde, soll keine Zeile bekommen – sonst laesst sich
      // spaeter "nicht beantwortet" nicht von "mit nichts beantwortet"
      // unterscheiden.
      (values ?? [])
        .filter((v) => v !== '' && v != null)
        .map((answer_value) => ({ session_id: sessionId, question_key, answer_value })),
    )

    if (rows.length === 0) return null

    const { error } = await supabase.from('anamnese_answers').insert(rows)
    return error ? error.message : null
  },

  getSession: (block) =>
    get().sessions.find((s) => s.block === block),

  hasCompletedBlock: (block) =>
    get().sessions.some((s) => s.block === block && s.completed_at !== null),

  blockOffen: (block) => get().standBekannt && !get().hasCompletedBlock(block),

  zuruecksetzen: () =>
    set({
      sessions: [],
      answers: new Map(),
      standBekannt: false,
      ladefehler: null,
      loading: false,
    }),
}))
