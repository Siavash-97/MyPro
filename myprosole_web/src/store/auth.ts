import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { dateiMitZeile, verwaistMerken } from '../lib/dateiAblegen'
import { Capacitor } from '@capacitor/core'
import { oauthRedirectUrl, passwortNeuUrl } from '../lib/authRedirect'
import { confirmUrl } from '../lib/authRedirect'
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
  /** Nimmt den Rueckweg aus der Google-Anmeldung entgegen (nur in der Huelle). */
  handleOAuthCallback: (url: string) => Promise<string | null>
  /**
   * Legt das Konto an. `bestaetigungNoetig` ist wahr, wenn Supabase eine
   * E-Mail-Bestaetigung verlangt – dann gibt es noch keine Sitzung, und ein
   * Weiterleiten auf geschuetzte Seiten wuerde vom AuthGuard zurueckgeworfen.
   */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{
    error: string | null
    bestaetigungNoetig: boolean
    /** Die Adresse hat schon ein Konto – erkennbar an leeren identities. */
    bereitsRegistriert: boolean
  }>
  /**
   * Bestaetigt die Registrierung mit dem sechsstelligen Code aus der Mail.
   *
   * Der Code ist der Weg, der in der App bleibt: Ein Link oeffnet den
   * Browser, und der Rueckweg in die Android-Huelle braeuchte einen
   * Tiefenverweis. Wer den Link trotzdem anklickt, landet auf `/bestaetigen`
   * im Web – dieselbe Bestaetigung, nur eben dort.
   *
   * Nach dem Bestaetigen ist man angemeldet; ein zweiter Anmeldevorgang
   * entfaellt.
   */
  verifyCode: (email: string, code: string) => Promise<string | null>
  /** Schickt den Bestaetigungscode noch einmal. */
  resendCode: (email: string) => Promise<string | null>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  createProfile: (
    data: Pick<Profile, 'display_name' | 'running_level' | 'weekly_goal_km'>,
  ) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  /** Neues Passwort setzen – nach dem Link aus der E-Mail. */
  setzePasswort: (passwort: string) => Promise<string | null>
  /** Profilbild hochladen und im Profil hinterlegen. */
  setAvatar: (datei: File) => Promise<string | null>
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,

  initialize: () => {
    // getSession liest nur den lokal gespeicherten Anmeldeschein. Der ist
    // selbst signiert und bis zum Ablauf formal gueltig – auch wenn das
    // Konto in der Datenbank geloescht wurde. Die App hielt sich dann fuer
    // angemeldet, fand kein Profil und schickte in die Einrichtung, wo das
    // Speichern scheitern musste.
    //
    // getUser fragt beim Server nach. Antwortet er mit einem Fehler, ist der
    // Schein wertlos und wird verworfen.
    const pruefeSitzung = async () => {
      const { error } = await supabase.auth.getUser()
      if (error) {
        await supabase.auth.signOut()
        set({ user: null, session: null, profile: null, loading: false, profileLoading: false })
        return true
      }
      return false
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && (await pruefeSitzung())) return
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
    const nativ = Capacitor.isNativePlatform()

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectUrl(),
        // In der Huelle darf supabase-js NICHT selbst weiterleiten.
        //
        // Genau das war der Fehler: Es sprang zur Anmeldeseite, Android
        // gab die an Chrome, und dort blieb der Vorgang stehen – die App
        // wartete auf einer Willkommensseite, die sie nie verlassen hatte.
        //
        // Mit skipBrowserRedirect bekommen wir die Adresse zurueck und
        // oeffnen sie selbst. Der Rueckweg landet dann ueber den
        // intent-filter wieder hier, nicht im Browser.
        skipBrowserRedirect: nativ,
      },
    })

    if (error) return error.message

    if (nativ && data?.url) {
      // Das System oeffnet die Adresse; nach der Anmeldung weckt der
      // Rueckweg die App, und der Empfaenger unten setzt die Sitzung.
      window.open(data.url, '_system')
    }
    return null
  },

  /**
   * Nimmt den Rueckweg aus der Google-Anmeldung entgegen.
   *
   * Die Anmeldedaten stehen im Fragment der Adresse (implicit flow, so ist
   * supabase-js in diesem Projekt eingestellt). Im Browser loest die
   * Bibliothek das selbst auf – in der Huelle nicht, weil die Adresse gar
   * nicht als Seitenaufruf ankommt, sondern als geweckte App.
   */
  handleOAuthCallback: async (url) => {
    const fragment = url.split('#')[1]
    if (!fragment) return 'Kein Anmeldeergebnis in der Adresse'

    const werte = new URLSearchParams(fragment)
    const fehler = werte.get('error_description') || werte.get('error')
    // Der mitgelieferte Text ist von aussen setzbar und wird deshalb nicht
    // angezeigt, nur der Umstand.
    if (fehler) return 'Die Anmeldung wurde abgebrochen oder ist abgelaufen.'

    const access_token = werte.get('access_token')
    const refresh_token = werte.get('refresh_token')
    if (!access_token || !refresh_token) return 'Unvollstaendiges Anmeldeergebnis'

    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) return error.message

    await get().fetchProfile()
    return null
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Wohin der Link aus der Bestaetigungsmail fuehrt. Ohne diese Angabe
      // gilt die Site URL des Supabase-Projekts – und die zeigt auf eine
      // statische Entwurfsseite ausserhalb der App.
      options: { emailRedirectTo: confirmUrl() },
    })
    if (error) return { error: error.message, bestaetigungNoetig: false, bereitsRegistriert: false }

    // Supabase meldet nicht, dass eine Adresse schon vergeben ist – es
    // antwortet mit einem gefaelschten Erfolg. Das ist Absicht: Sonst
    // koennte jemand durch Ausprobieren herausfinden, welche Adressen ein
    // Konto haben. Erkennbar ist es nur an einer Stelle: identities ist
    // dann leer. Ein echtes neues Konto hat dort genau einen Eintrag.
    //
    // Wir werten das aus, weil der Nutzer sonst auf eine Mail wartet, die
    // nie kommt. Der Preis ist, dass sich damit wieder herausfinden laesst,
    // ob eine Adresse registriert ist – eine bewusste Abwaegung zugunsten
    // der Verstaendlichkeit, die hier benannt sein soll.
    const bereitsRegistriert = data.user != null && (data.user.identities?.length ?? 0) === 0
    if (bereitsRegistriert) {
      return { error: null, bestaetigungNoetig: false, bereitsRegistriert: true }
    }

    // Kein Fehler, aber auch keine Sitzung: Das Konto existiert, muss aber
    // erst per E-Mail bestaetigt werden.
    return { error: null, bestaetigungNoetig: data.session == null, bereitsRegistriert: false }
  },

  verifyCode: async (email, code) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup',
    })
    if (error) return error.message
    // Die Sitzung steht jetzt; onAuthStateChange holt das Profil nach.
    return null
  },

  resendCode: async (email) => {
    // Dieselbe Zieladresse wie beim Anlegen: Die neue Mail enthaelt wieder
    // beides, Code und Link, und der Link muss genauso in der App landen.
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: confirmUrl() },
    })
    return error ? error.message : null
  },

  setAvatar: async (datei) => {
    const user = get().user
    if (!user) return 'Nicht angemeldet'

    const alt = get().profile?.avatar_url ?? null

    const { fehler } = await dateiMitZeile({
      behaelter: 'avatars',
      praefix: user.id,
      datei,
      rueckfallEndung: 'jpg',
      rueckfallTyp: 'image/jpeg',
      zeileSchreiben: async (pfad) => {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: pfad })
          .eq('id', user.id)
        return { data: null, error }
      },
    })
    if (fehler) return fehler

    // Erst nach dem erfolgreichen Wechsel: Das alte Bild wird nicht mehr
    // gebraucht. Scheitert das Aufraeumen, bleibt nur eine Datei liegen –
    // das Profil stimmt trotzdem. Aber es bleibt nicht unbemerkt: Diese
    // vierte Phase gibt es nur hier, deshalb steht sie ausserhalb des
    // Moduls – und muss sich deshalb selbst an dieselbe Regel halten.
    if (alt) {
      const { error } = await supabase.storage.from('avatars').remove([alt])
      if (error) verwaistMerken('avatars', alt, error.message)
    }

    await get().fetchProfile()
    return null
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
    // Mit eigenem Ziel. Ohne redirectTo gilt die Site URL des Projekts, und
    // die zeigt auf die Startseite – man war dann zwar angemeldet, hatte
    // aber nirgends ein Feld fuer ein neues Passwort und kam beim naechsten
    // Mal wieder nicht hinein.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: passwortNeuUrl(),
    })
    return error ? error.message : null
  },

  setzePasswort: async (passwort) => {
    const { error } = await supabase.auth.updateUser({ password: passwort })
    return error ? error.message : null
  },
}))
