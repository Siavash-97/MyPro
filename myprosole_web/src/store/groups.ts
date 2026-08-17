import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'

export type JoinPolicy = 'open' | 'request'
export type RequestStatus = 'pending' | 'accepted' | 'declined'

export interface GroupQuestion {
  id: string
  group_id: string
  question: string
  position: number
}

export interface GroupMember {
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  profiles: { display_name: string | null } | null
}

export interface GroupRequest {
  id: string
  group_id: string
  user_id: string
  status: RequestStatus
  message: string | null
  created_at: string
  profiles: { display_name: string | null } | null
  community_group_answers: { question_id: string; answer: string }[]
}

export interface Group {
  id: string
  owner_id: string
  name: string
  description: string | null
  goal: string
  join_policy: JoinPolicy
  requires_questionnaire: boolean
  invite_token: string
  created_at: string
  community_group_members: { user_id: string; role: 'admin' | 'member' }[]
  community_group_questions: GroupQuestion[]
}

interface GroupsState {
  groups: Group[]
  loading: boolean
  fetchGroups: () => Promise<void>
  fetchByToken: (token: string) => Promise<Group | null>
  createGroup: (daten: {
    name: string
    description: string | null
    goal: string
    join_policy: JoinPolicy
    requires_questionnaire: boolean
    questions: string[]
  }) => Promise<{ id: string | null; error: string | null }>
  updateGroup: (id: string, daten: Partial<Pick<Group, 'name' | 'description' | 'goal' | 'join_policy' | 'requires_questionnaire'>>) => Promise<string | null>
  deleteGroup: (id: string) => Promise<string | null>
  join: (group: Group) => Promise<string | null>
  leave: (groupId: string) => Promise<string | null>
  requestJoin: (groupId: string, message: string | null, antworten: Record<string, string>) => Promise<string | null>
  fetchRequests: (groupId: string) => Promise<GroupRequest[]>
  fetchMembers: (groupId: string) => Promise<GroupMember[]>
  decideRequest: (request: GroupRequest, annehmen: boolean) => Promise<string | null>
  removeMember: (groupId: string, userId: string) => Promise<string | null>
  setQuestions: (groupId: string, fragen: string[]) => Promise<string | null>
}

const AUSWAHL = `
  *,
  community_group_members(user_id, role),
  community_group_questions(*)
`

export const useGroups = create<GroupsState>((set, get) => ({
  groups: [],
  loading: false,

  fetchGroups: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('community_groups')
      .select(AUSWAHL)
      .order('created_at', { ascending: false })

    set({ groups: (data ?? []) as Group[], loading: false })
  },

  fetchByToken: async (token) => {
    const { data } = await supabase
      .from('community_groups')
      .select(AUSWAHL)
      .eq('invite_token', token)
      .maybeSingle()
    return (data as Group) ?? null
  },

  createGroup: async ({ questions, ...gruppe }) => {
    const userId = eigeneKennung()
    if (!userId) return { id: null, error: 'Nicht angemeldet' }

    const { data, error } = await supabase
      .from('community_groups')
      .insert({ ...gruppe, owner_id: userId })
      .select('id')
      .single()

    if (error || !data) return { id: null, error: error?.message ?? 'Gruppe konnte nicht angelegt werden' }
    const id = (data as { id: string }).id

    // Der Gruender ist Admin. Ohne diesen Schritt haette die Gruppe niemanden,
    // der sie verwalten darf – auch der Eigentuemer nicht, denn die Rechte
    // haengen an der Mitgliedschaft.
    const { error: mitgliedFehler } = await supabase
      .from('community_group_members')
      .insert({ group_id: id, user_id: userId, role: 'admin' })

    if (mitgliedFehler) {
      await supabase.from('community_groups').delete().eq('id', id)
      return { id: null, error: mitgliedFehler.message }
    }

    if (questions.length) {
      await supabase.from('community_group_questions').insert(
        questions.map((q, i) => ({ group_id: id, question: q, position: i + 1 })),
      )
    }

    await get().fetchGroups()
    return { id, error: null }
  },

  updateGroup: async (id, daten) => {
    const { error } = await supabase.from('community_groups').update(daten).eq('id', id)
    if (error) return error.message
    await get().fetchGroups()
    return null
  },

  deleteGroup: async (id) => {
    const { error } = await supabase.from('community_groups').delete().eq('id', id)
    if (error) return error.message
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }))
    return null
  },

  join: async (group) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('community_group_members')
      .insert({ group_id: group.id, user_id: userId, role: 'member' })

    if (error) return error.message
    await get().fetchGroups()
    return null
  },

  leave: async (groupId) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('community_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)

    if (error) return error.message
    await get().fetchGroups()
    return null
  },

  requestJoin: async (groupId, message, antworten) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('community_group_requests')
      .insert({ group_id: groupId, user_id: userId, message })
      .select('id')
      .single()

    if (error || !data) return error?.message ?? 'Anfrage konnte nicht gestellt werden'

    const eintraege = Object.entries(antworten)
      .filter(([, a]) => a.trim())
      .map(([question_id, answer]) => ({
        request_id: (data as { id: string }).id,
        question_id,
        answer: answer.trim(),
      }))

    if (eintraege.length) {
      const { error: antwortFehler } = await supabase
        .from('community_group_answers')
        .insert(eintraege)
      if (antwortFehler) {
        // Eine Anfrage ohne die verlangten Antworten waere fuer den Admin
        // wertlos – dann lieber ganz zurueckziehen.
        await supabase.from('community_group_requests').delete().eq('id', (data as { id: string }).id)
        return antwortFehler.message
      }
    }
    return null
  },

  fetchRequests: async (groupId) => {
    const { data } = await supabase
      .from('community_group_requests')
      .select('*, profiles(display_name), community_group_answers(question_id, answer)')
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    return (data ?? []) as GroupRequest[]
  },

  fetchMembers: async (groupId) => {
    const { data } = await supabase
      .from('community_group_members')
      .select('*, profiles(display_name)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })
    return (data ?? []) as GroupMember[]
  },

  decideRequest: async (request, annehmen) => {
    if (annehmen) {
      // Erst aufnehmen, dann den Stand setzen. Andersherum stuende die
      // Anfrage auf "angenommen", ohne dass jemand in der Gruppe waere.
      const { error } = await supabase
        .from('community_group_members')
        .insert({ group_id: request.group_id, user_id: request.user_id, role: 'member' })
      if (error) return error.message
    }

    const { error } = await supabase
      .from('community_group_requests')
      .update({ status: annehmen ? 'accepted' : 'declined' })
      .eq('id', request.id)

    if (error) return error.message
    await get().fetchGroups()
    return null
  },

  removeMember: async (groupId, userId) => {
    const { error } = await supabase
      .from('community_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
    if (error) return error.message
    await get().fetchGroups()
    return null
  },

  setQuestions: async (groupId, fragen) => {
    // Ersetzen statt abgleichen: Die Liste ist kurz, und ein Abgleich waere
    // mehr Code fuer denselben Zustand.
    await supabase.from('community_group_questions').delete().eq('group_id', groupId)
    if (fragen.length) {
      const { error } = await supabase.from('community_group_questions').insert(
        fragen.map((q, i) => ({ group_id: groupId, question: q, position: i + 1 })),
      )
      if (error) return error.message
    }
    await get().fetchGroups()
    return null
  },
}))
