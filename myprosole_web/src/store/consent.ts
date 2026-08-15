import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Art9Consent, Art9ConsentScope } from '../types'

interface ConsentState {
  consents: Art9Consent[]
  loading: boolean
  /** Meldung der Datenbank, falls das Laden scheitert. */
  fehler: string | null

  fetchConsents: () => Promise<void>
  grantConsent: (scope: Art9ConsentScope) => Promise<string | null>
  revokeConsent: (id: string) => Promise<string | null>
  hasActiveConsent: (scope: Art9ConsentScope) => boolean
}

/*
 * Achtung bei den Spaltennamen: Die Tabelle heisst sie consent_scope und
 * consented_at, nicht scope und granted_at. Der Store hatte lange die
 * falschen Namen verwendet – beide Abfragen scheiterten, beide Fehler wurden
 * verworfen, und die Folge war: Das Erteilen der Einwilligung tat sichtbar
 * nichts, und die Anamnese liess sich nicht starten.
 */
export const useConsent = create<ConsentState>((set, get) => ({
  consents: [],
  loading: false,
  fehler: null,

  fetchConsents: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('art9_consents')
      .select('*')
      .is('revoked_at', null)
      .order('consented_at', { ascending: false })

    if (error) {
      set({ loading: false, fehler: error.message })
      return
    }

    set({ consents: (data ?? []) as Art9Consent[], loading: false, fehler: null })
  },

  grantConsent: async (scope) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('art9_consents')
      .insert({ user_id: user.id, consent_scope: scope })

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
      (c) => c.revoked_at === null && (c.consent_scope === scope || c.consent_scope === 'all'),
    )
  },
}))
