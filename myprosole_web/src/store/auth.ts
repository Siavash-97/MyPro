import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean

  initialize: () => () => void
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  /**
   * Legt das Konto an. `bestaetigungNoetig` ist wahr, wenn Supabase eine
   * E-Mail-Bestaetigung verlangt – dann gibt es noch keine Sitzung, und ein
   * Weiterleiten auf geschuetzte Seiten wuerde vom AuthGuard zurueckgeworfen.
   */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; bestaetigungNoetig: boolean }>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  createProfile: (
    data: Pick<Profile, 'display_name' | 'running_level' | 'weekly_goal_km'>,
  ) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // profileLoading muss im selben Update stehen wie der User: sonst sieht
      // der AuthGuard kurz einen User ohne Profil und leitet bei einem Reload
      // tiefer Routen fälschlich über /profil/setup auf die Startseite um.
      set({
        session,
        user: session?.user ?? null,
        loading: false,
        profileLoading: Boolean(session?.user),
      })
      if (session?.user) get().fetchProfile()
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        profileLoading: Boolean(session?.user) && !get().profile,
      })
      if (session?.user) {
        get().fetchProfile()
      } else {
        set({ profile: null })
      }
    })

    return () => subscription.unsubscribe()
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? error.message : null
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return error ? error.message : null
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message, bestaetigungNoetig: false }
    // Kein Fehler, aber auch keine Sitzung: Das Konto existiert, muss aber
    // erst per E-Mail bestaetigt werden.
    return { error: null, bestaetigungNoetig: data.session == null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },

  fetchProfile: async () => {
    const user = get().user
    if (!user) {
      set({ profileLoading: false })
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    set({ profile: (data as Profile) ?? null, profileLoading: false })
  },

  createProfile: async (data) => {
    const user = get().user
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      ...data,
    })

    if (error) return error.message

    await get().fetchProfile()
    return null
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return error ? error.message : null
  },
}))
