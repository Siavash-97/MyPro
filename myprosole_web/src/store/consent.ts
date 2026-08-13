import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Art9Consent, Art9ConsentScope } from '../types'

interface ConsentState {
  consents: Art9Consent[]
  loading: boolean

  fetchConsents: () => Promise<void>
  grantConsent: (scope: Art9ConsentScope) => Promise<string | null>
  revokeConsent: (id: string) => Promise<string | null>
  hasActiveConsent: (scope: Art9ConsentScope) => boolean
}

export const useConsent = create<ConsentState>((set, get) => ({
  consents: [],
  loading: false,

  fetchConsents: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('art9_consents')
      .select('*')
      .is('revoked_at', null)
      .order('granted_at', { ascending: false })

    set({ consents: (data ?? []) as Art9Consent[], loading: false })
  },

  grantConsent: async (scope) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('art9_consents')
      .insert({ user_id: user.id, scope })

    if (error) return error.message
    await get().fetchConsents()
    return null
  },

  revokeConsent: async (id) => {
    const { error } = await supabase
      .from('art9_consents')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return error.message
    await get().fetchConsents()
    return null
  },

  hasActiveConsent: (scope) => {
    const { consents } = get()
    return consents.some(
      (c) => c.revoked_at === null && (c.scope === scope || c.scope === 'all'),
    )
  },
}))
