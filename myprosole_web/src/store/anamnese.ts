import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { AnamneseBlock, AnamneseSession, AnamneseAnswer } from '../types'

interface AnamneseState {
  sessions: AnamneseSession[]
  answers: Map<string, AnamneseAnswer[]>
  loading: boolean

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
}

export const useAnamnese = create<AnamneseState>((set, get) => ({
  sessions: [],
  answers: new Map(),
  loading: false,

  fetchSessions: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('anamnese_sessions')
      .select('*')
      .order('created_at', { ascending: false })

    set({ sessions: (data ?? []) as AnamneseSession[], loading: false })
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
}))
