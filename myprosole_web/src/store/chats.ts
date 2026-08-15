import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
  profiles: { display_name: string | null } | null
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
      .select('*, profiles(display_name)')
      .eq('run_id', runId)
      .order('created_at', { ascending: true })
    return (data ?? []) as RunRequest[]
  },

  fetchMyRequest: async (runId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('community_run_requests')
      .select('*, profiles(display_name)')
      .eq('run_id', runId)
      .eq('user_id', user.id)
      .maybeSingle()
    return (data as RunRequest) ?? null
  },

  requestJoin: async (runId, message) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('community_run_requests')
      .insert({ run_id: runId, user_id: user.id, message })
    return error ? error.message : null
  },

  decide: async (request, annehmen) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    if (annehmen) {
      // Erst den Chat, dann den Stand: Andersherum staende die Anfrage auf
      // "angenommen", ohne dass es einen Weg zum Reden gaebe.
      const { error } = await supabase.from('community_chats').insert({
        run_id: request.run_id,
        owner_id: user.id,
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase.from('community_chat_messages').insert({
      chat_id: chatId,
      user_id: user.id,
      kind,
      body: text.trim(),
    })
    return error ? error.message : null
  },

  sendVoice: async (chatId, audio) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    // Der erste Pfadteil muss die Chat-Kennung sein – daran haengt die
    // Zugriffsregel im Behaelter.
    const pfad = `${chatId}/${crypto.randomUUID()}.webm`
    const { error: hochladen } = await supabase.storage
      .from(BEHAELTER)
      .upload(pfad, audio, { contentType: audio.type || 'audio/webm' })

    if (hochladen) return 'Aufnahme konnte nicht gesendet werden: ' + hochladen.message

    const { error } = await supabase.from('community_chat_messages').insert({
      chat_id: chatId,
      user_id: user.id,
      kind: 'voice',
      audio_path: pfad,
    })

    if (error) {
      await supabase.storage.from(BEHAELTER).remove([pfad])
      return error.message
    }
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
