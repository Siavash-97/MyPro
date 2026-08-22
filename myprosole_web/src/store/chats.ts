import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { dateiMitZeile } from '../lib/dateiAblegen'
import { eigeneKennung } from '../lib/eigeneKennung'

const BEHAELTER = 'chat-audio'

export type RequestStatus = 'pending' | 'accepted' | 'declined'
export type MessageKind = 'text' | 'voice' | 'location'

export interface RunRequest {
  id: string
  run_id: string
  user_id: string
  status: RequestStatus
  message: string | null
  created_at: string
  // avatar_url ist der Pfad im Behaelter, nicht die fertige Adresse – der
  // Avatar-Baustein loest sie auf (siehe Migration 0028).
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export interface ChatMessage {
  id: string
  chat_id: string
  user_id: string
  kind: MessageKind
  body: string | null
  audio_path: string | null
  created_at: string
}

export interface Chat {
  id: string
  run_id: string
  owner_id: string
  guest_id: string
  created_at: string
  community_runs: {
    city: string
    starts_at: string
    pace: string
    distance_km: number | null
  } | null
}

interface ChatState {
  chats: Chat[]
  loading: boolean

  fetchChats: () => Promise<void>
  /**
   * Alles fuer die Uebersicht in einem Zug: offene Anfragen an die eigenen
   * Verabredungen und der Zeitpunkt der letzten Nachricht je Chat.
   *
   * In einem Zug und nicht je Chat einzeln, weil die Uebersicht sonst bei
   * zehn Chats zehn Anfragen stellt – die Kopfleiste zeigt sie ja auf jeder
   * Community-Seite.
   */
  fetchUebersicht: () => Promise<void>
  /** Offene Anfragen an eigene Verabredungen. */
  offeneAnfragen: RunRequest[]
  /** Letzte Nachricht je Chat, nach Chat-Kennung. */
  letzteNachricht: Record<string, string>
  fetchRequests: (runId: string) => Promise<RunRequest[]>
  fetchMyRequest: (runId: string) => Promise<RunRequest | null>
  requestJoin: (runId: string, message: string | null) => Promise<string | null>
  decide: (request: RunRequest, annehmen: boolean) => Promise<string | null>

  fetchMessages: (chatId: string) => Promise<ChatMessage[]>
  sendText: (chatId: string, text: string, kind?: MessageKind) => Promise<string | null>
  sendVoice: (chatId: string, audio: Blob) => Promise<string | null>
  /** Zeitlich begrenzte Adresse zum Abspielen. */
  audioAdresse: (pfad: string) => Promise<string | null>
  /** Den genauen Treffpunkt holen – geht nur mit Zusage. */
  fetchMeetingPoint: (runId: string) => Promise<string | null>
}

export const useChats = create<ChatState>((set, get) => ({
  chats: [],
  loading: false,

  offeneAnfragen: [],
  letzteNachricht: {},

  fetchUebersicht: async () => {
    const userId = eigeneKennung()
    if (!userId) return

    // Anfragen an meine Verabredungen. Die Zeilenregel gibt ohnehin nur
    // her, was mich betrifft – der Filter auf den Status ist die
    // eigentliche Auswahl.
    const { data: anfragen } = await supabase
      .from('community_run_requests')
      .select('*, profiles(display_name, avatar_url), community_runs!inner(user_id)')
      .eq('status', 'pending')
      .eq('community_runs.user_id', userId)

    // Zeitpunkte der Nachrichten. Nur created_at, nicht der Inhalt: Fuer
    // den Punkt an der Kopfleiste genuegt, WANN zuletzt geschrieben wurde.
    const { data: nachrichten } = await supabase
      .from('community_chat_messages')
      .select('chat_id, created_at')
      .order('created_at', { ascending: false })

    const letzte: Record<string, string> = {}
    for (const n of (nachrichten ?? []) as { chat_id: string; created_at: string }[]) {
      if (!letzte[n.chat_id]) letzte[n.chat_id] = n.created_at
    }

    set({
      offeneAnfragen: (anfragen ?? []) as RunRequest[],
      letzteNachricht: letzte,
    })
  },

  fetchChats: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('community_chats')
      .select('*, community_runs(city, starts_at, pace, distance_km)')
      .order('created_at', { ascending: false })

    set({ chats: (data ?? []) as Chat[], loading: false })
  },

  fetchRequests: async (runId) => {
    const { data } = await supabase
      .from('community_run_requests')
      .select('*, profiles(display_name, avatar_url)')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
    return (data ?? []) as RunRequest[]
  },

  fetchMyRequest: async (runId) => {
    const userId = eigeneKennung()
    if (!userId) return null
    const { data } = await supabase
      .from('community_run_requests')
      .select('*, profiles(display_name, avatar_url)')
      .eq('run_id', runId)
      .eq('user_id', userId)
      .maybeSingle()
    return (data as RunRequest) ?? null
  },

  requestJoin: async (runId, message) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('community_run_requests')
      .insert({ run_id: runId, user_id: userId, message })
    return error ? error.message : null
  },

  decide: async (request, annehmen) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    if (annehmen) {
      // Erst den Chat, dann den Stand: Andersherum staende die Anfrage auf
      // "angenommen", ohne dass es einen Weg zum Reden gaebe.
      const { error } = await supabase.from('community_chats').insert({
        run_id: request.run_id,
        owner_id: userId,
        guest_id: request.user_id,
      })
      // Doppelte Zusage ist kein Fehler – der Chat existiert dann schon.
      if (error && !error.message.includes('duplicate')) return error.message
    }

    const { error } = await supabase
      .from('community_run_requests')
      .update({ status: annehmen ? 'accepted' : 'declined' })
      .eq('id', request.id)

    if (error) return error.message
    await get().fetchChats()
    return null
  },

  fetchMessages: async (chatId) => {
    const { data } = await supabase
      .from('community_chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
    return (data ?? []) as ChatMessage[]
  },

  sendText: async (chatId, text, kind = 'text') => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase.from('community_chat_messages').insert({
      chat_id: chatId,
      user_id: userId,
      kind,
      body: text.trim(),
    })
    return error ? error.message : null
  },

  sendVoice: async (chatId, audio) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Der erste Pfadteil muss die Chat-Kennung sein – daran haengt die
    // Zugriffsregel im Behaelter.
    const { fehler } = await dateiMitZeile({
      behaelter: BEHAELTER,
      praefix: chatId,
      datei: audio,
      // Nicht mehr fest '.webm': MediaRecorder liefert auf Safari
      // 'audio/mp4'. Der Rueckfall ist trotzdem Pflicht und trotzdem 'webm',
      // damit aus einer typlosen Aufnahme keine '.jpg' wird.
      rueckfallEndung: 'webm',
      rueckfallTyp: 'audio/webm',
      zeileSchreiben: async (pfad) => {
        const { error } = await supabase.from('community_chat_messages').insert({
          chat_id: chatId,
          user_id: userId,
          kind: 'voice',
          audio_path: pfad,
        })
        return { data: null, error }
      },
    })
    if (fehler) return 'Aufnahme konnte nicht gesendet werden: ' + fehler
    return null
  },

  audioAdresse: async (pfad) => {
    // Eine Stunde reicht zum Anhoeren und laeuft danach ab.
    const { data } = await supabase.storage.from(BEHAELTER).createSignedUrl(pfad, 3600)
    return data?.signedUrl ?? null
  },

  fetchMeetingPoint: async (runId) => {
    const { data } = await supabase
      .from('community_run_meeting_points')
      .select('meeting_point')
      .eq('run_id', runId)
      .maybeSingle()
    return (data as { meeting_point: string } | null)?.meeting_point ?? null
  },
}))
