import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Art9Consent, Art9ConsentScope } from '../types'
import { eigeneKennung } from '../lib/eigeneKennung'

interface ConsentState {
  /** Die ganze Geschichte, neueste zuerst – nicht nur die geltenden. */
  consents: Art9Consent[]
  loading: boolean
  /** Meldung der Datenbank, falls das Laden scheitert. */
  fehler: string | null

  fetchConsents: () => Promise<void>
  grantConsent: (scope: Art9ConsentScope) => Promise<string | null>
  revokeConsent: (scope: Art9ConsentScope) => Promise<string | null>
  hasActiveConsent: (scope: Art9ConsentScope) => boolean
  /** Die geltenden Einwilligungen – je Bereich die juengste, wenn sie gilt. */
  aktive: () => Art9Consent[]
}

/*
 * Achtung bei den Spaltennamen: Die Tabelle heisst sie consent_scope und
 * consented_at, nicht scope und granted_at. Der Store hatte lange die
 * falschen Namen verwendet – beide Abfragen scheiterten, beide Fehler wurden
 * verworfen, und die Folge war: Das Erteilen der Einwilligung tat sichtbar
 * nichts, und die Anamnese liess sich nicht starten.
 *
 * Seit 0027 ist die Tabelle unveraenderlich: nur lesen und anlegen. Ein
 * Widerruf ist keine Aenderung mehr, sondern eine neue Zeile mit
 * action = 'revoked'. Ob eine Einwilligung gilt, wird deshalb nicht mehr
 * gespeichert, sondern abgeleitet – aus der juengsten Zeile zum jeweiligen
 * Bereich. Eine Ableitung kann nicht von den Daten abweichen, ein
 * gespeicherter Zustand schon.
 */

/**
 * Die juengste Zeile je Bereich.
 *
 * Setzt voraus, dass die Liste neueste zuerst sortiert ist – genau so kommt
 * sie aus fetchConsents.
 */
function juengsteJeBereich(consents: Art9Consent[]): Map<Art9ConsentScope, Art9Consent> {
  const map = new Map<Art9ConsentScope, Art9Consent>()
  for (const c of consents) {
    if (!map.has(c.consent_scope)) map.set(c.consent_scope, c)
  }
  return map
}

export const useConsent = create<ConsentState>((set, get) => ({
  consents: [],
  loading: false,
  fehler: null,

  fetchConsents: async () => {
    set({ loading: true })
    // Ohne Filter auf revoked_at: Gebraucht wird die ganze Geschichte, weil
    // sich erst aus ihr ergibt, was gerade gilt.
    const { data, error } = await supabase
      .from('art9_consents')
      .select('*')
      .order('consented_at', { ascending: false })

    if (error) {
      set({ loading: false, fehler: error.message })
      return
    }

    set({ consents: (data ?? []) as Art9Consent[], loading: false, fehler: null })
  },

  grantConsent: async (scope) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('art9_consents')
      .insert({ user_id: userId, consent_scope: scope, action: 'granted' })

    if (error) return error.message
    await get().fetchConsents()
    return null
  },

  revokeConsent: async (scope) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Eine neue Zeile, kein update: Die alte Erteilung bleibt stehen, mit
    // ihrem urspruenglichen Zeitpunkt. Der Widerruf tritt daneben, nicht an
    // ihre Stelle.
    const { error } = await supabase
      .from('art9_consents')
      .insert({ user_id: userId, consent_scope: scope, action: 'revoked' })

    if (error) return error.message
    await get().fetchConsents()
    return null
  },

  hasActiveConsent: (scope) => {
    const juengste = juengsteJeBereich(get().consents)
    // 'all' deckt jeden Bereich ab – aber nur, solange es selbst gilt.
    const alle = juengste.get('all')
    if (alle?.action === 'granted') return true
    return juengste.get(scope)?.action === 'granted'
  },

  aktive: () => {
    return [...juengsteJeBereich(get().consents).values()].filter(
      (c) => c.action === 'granted',
    )
  },
}))
