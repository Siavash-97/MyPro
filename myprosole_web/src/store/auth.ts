import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { kontoZustandVergessen } from '../lib/kontoZustand'
// Die Speicher melden sich selbst an - dieser Import sorgt nur dafuer, dass
// die kontogebundenen Module geladen sind, wenn abgemeldet wird.
import './anamnese'
import { dateiMitZeile, verwaistMerken } from '../lib/dateiAblegen'
import { Capacitor } from '@capacitor/core'
import { oauthRedirectUrl, passwortNeuUrl } from '../lib/authRedirect'
import { confirmUrl } from '../lib/authRedirect'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { entwicklerWarnung } from '../lib/entwicklerkonsole'
import {
  ablageHindernis,
  anmeldeHindernis,
  profilHindernis,
  type AblageHindernis,
  type AnmeldeHindernis,
  type ProfilHindernis,
} from '../lib/hindernis'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean

  initialize: () => () => void
  signIn: (email: string, password: string) => Promise<AnmeldeHindernis | null>
  signInWithGoogle: () => Promise<AnmeldeHindernis | null>
  /** Nimmt den Rueckweg aus der Google-Anmeldung entgegen (nur in der Huelle). */
  handleOAuthCallback: (url: string) => Promise<AnmeldeHindernis | null>
  /**
   * Legt das Konto an. `bestaetigungNoetig` ist wahr, wenn Supabase eine
   * E-Mail-Bestaetigung verlangt – dann gibt es noch keine Sitzung, und ein
   * Weiterleiten auf geschuetzte Seiten wuerde vom AuthGuard zurueckgeworfen.
   *
   * Nur das Fehlerfeld wurde zum `hindernis`. Die zwei Wahrheitswerte
   * bleiben, weil sie ERGEBNISSE sind, keine Fehler: `bereitsRegistriert`
   * entsteht sogar aus einer erfolgreichen Antwort (Entwurf, R2-Q2).
   */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{
    hindernis: AnmeldeHindernis | null
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
  verifyCode: (email: string, code: string) => Promise<AnmeldeHindernis | null>
  /** Schickt den Bestaetigungscode noch einmal. */
  resendCode: (email: string) => Promise<AnmeldeHindernis | null>
  signOut: () => Promise<void>
  /**
   * Ist bekannt, OB es ein Profil gibt?
   *
   * `false`, solange kein Laden gelungen ist. Noetig, weil `profile: null`
   * zwei verschiedene Dinge bedeuten koennte - "noch nie geladen" und
   * "geladen, es gibt keins" - und der Unterschied darueber entscheidet, ob
   * jemand in die Einrichtung geschickt wird.
   */
  profilBekannt: boolean

  fetchProfile: () => Promise<void>
  createProfile: (
    data: Pick<Profile, 'display_name' | 'running_level' | 'weekly_goal_km'>,
  ) => Promise<ProfilHindernis | null>
  resetPassword: (email: string) => Promise<AnmeldeHindernis | null>
  /** Neues Passwort setzen – nach dem Link aus der E-Mail. */
  setzePasswort: (passwort: string) => Promise<AnmeldeHindernis | null>
  /**
   * Profilbild hochladen und im Profil hinterlegen.
   *
   * Der Rueckgabetyp ist `AblageHindernis`, obwohl zwei Fachgebiete
   * beteiligt sind: Die Profil-Arten sind eine echte Teilmenge der
   * Ablage-Arten (`lib/hindernis.ts`), ein `ProfilHindernis` passt also ohne
   * Umweg hinein.
   */
  setAvatar: (datei: File) => Promise<AblageHindernis | null>
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  profilBekannt: false,
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
        kontoZustandVergessen()
        set({
          user: null,
          session: null,
          profile: null,
          profilBekannt: false,
          loading: false,
          profileLoading: false,
        })
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
        kontoZustandVergessen()
        set({ profile: null, profilBekannt: false })
      }
    })

    return () => subscription.unsubscribe()
  },

  // Ab hier gilt fuer alle acht Anmelde-Funktionen dasselbe Muster, und es
  // steht einmal statt achtmal:
  //
  //   1. Die GANZE Antwort `{ data, error }` geht in `anmeldeHindernis`,
  //      nicht nur `error`. Das Fehlerobjekt allein traegt bei PostgREST
  //      keinen Status, und der Status trennt Faelle, die der Code nicht
  //      trennt (lib/hindernis.ts, `merkmale`).
  //   2. Ein GEWORFENER Fehler geht genauso hinein.
  //
  //      BERICHTIGT AM 07.09.2026, nachdem hier eine falsche Begruendung
  //      stand ("auth-js wirft den Netzfehler, es gibt ihn nicht
  //      zurueck"). Das stimmt nur eine Ebene tiefer: `_request` wirft den
  //      `AuthRetryableFetchError` (auth-js, fetch.js), aber
  //      sieben der acht Methoden von `GoTrueClient` fangen ihn wieder und
  //      GEBEN IHN ZURUECK - `catch (error) { if (isAuthError(error)) return
  //      this._returnResult({ data, error }); throw error }`. Der
  //      Netzfehler kommt also im NORMALEN Zweig an, nicht im `catch`.
  //
  //      Die achte, `signInWithOAuth`, ist die Ausnahme, und zwar weil sie
  //      gar keine Anfrage stellt: Sie reicht an `_handleProviderSignIn`
  //      weiter, das ueber `_getUrlForProvider` nur eine URL baut und
  //      `{ data: { provider, url, flowId }, error: null }` liefert. Wo
  //      nichts geworfen wird, ist auch nichts zu fangen.
  //
  //      Das `try` bleibt trotzdem richtig, nur aus anderen Gruenden: Was
  //      KEIN AuthError ist, wird von dort weitergeworfen (`throw error`)
  //      - ein Fehler aus der Sperre um die Sitzung, aus dem PKCE-Speicher
  //      oder aus dem Speicher des Browsers. Ohne `try` kaeme beim
  //      Aufrufer eine Ausnahme an statt eines Hindernisses.
  //   3. Ein `catch`, der anspringt, IST ein Fehlschlag. `anmeldeHindernis`
  //      gibt fuer `null` und `undefined` aber `null` zurueck - "es hat
  //      geklappt" -, und ein `throw null` saehe damit wie ein Erfolg aus;
  //      drei Aufrufstellen lesen genau diesen Wert als Erfolg und gingen
  //      weiter. Deshalb steht an jedem `catch` der Rueckfall. Dieselbe
  //      Regel wie im Modul, nur eine Ebene hoeher: die EXISTENZ
  //      entscheidet, nicht der Inhalt.
  //   4. Der Wortlaut fuer den Menschen entsteht hier NICHT. Der Store
  //      liefert die Art; den Satz waehlt die Seite (Entwurf, Q2).
  signIn: async (email, password) => {
    try {
      return anmeldeHindernis(await supabase.auth.signInWithPassword({ email, password }))
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
  },

  signInWithGoogle: async () => {
    const nativ = Capacitor.isNativePlatform()

    try {
      const antwort = await supabase.auth.signInWithOAuth({
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

      const hindernis = anmeldeHindernis(antwort)
      if (hindernis) return hindernis

      // `window.open` steht MIT im try. Bis zum 07.09.2026 stand es
      // darunter: Wirft das System hier (in der Huelle ist es der
      // Browser-Aufruf von Android), bekaeme der Aufrufer eine Ausnahme
      // statt eines Hindernisses - und Welcome.mitGoogle zeigt dann gar
      // nichts an, weil es nichts zu zeigen bekommt. Der Fall ist derselbe
      // wie der leere Fehlerzweig in App.tsx, nur einen Schritt frueher.
      if (nativ && antwort.data?.url) {
        // Das System oeffnet die Adresse; nach der Anmeldung weckt der
        // Rueckweg die App, und der Empfaenger unten setzt die Sitzung.
        window.open(antwort.data.url, '_system')
      }
      return null
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
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
    // DIE DREI AUSGAENGE HIER BAUEN DAS HINDERNIS DIREKT, NICHT UEBER
    // `anmeldeHindernis`. Sie tragen kein Bibliotheksobjekt, sondern einen
    // eigenen Satz: Es ist gar keine Antwort da, die man uebersetzen
    // koennte, die Adresse selbst taugt nicht. `anmeldeHindernis` uebersetzt
    // Objekte der Bibliothek; ein eigener Satz durch dieses Modul wuerde
    // dort als FREMDER TEXT gefuehrt (`merkmale` nimmt einen String als
    // `rohtext` an) - und beim naechsten Umbau von jemandem "korrigiert",
    // der die Regel richtig anwendet. Der `rohtext` bleibt trotzdem, was er
    // ueberall ist: fuer den Entwickler, nie fuer den Bildschirm.
    const fragment = url.split('#')[1]
    if (!fragment) return { art: 'unbekannt', rohtext: 'Kein Anmeldeergebnis in der Adresse' }

    const werte = new URLSearchParams(fragment)
    const fehler = werte.get('error_description') || werte.get('error')
    // Der mitgelieferte Text ist von aussen setzbar und wird deshalb nicht
    // angezeigt, nur der Umstand.
    if (fehler) {
      return { art: 'unbekannt', rohtext: 'Die Anmeldung wurde abgebrochen oder ist abgelaufen.' }
    }

    const access_token = werte.get('access_token')
    const refresh_token = werte.get('refresh_token')
    if (!access_token || !refresh_token) {
      return { art: 'unbekannt', rohtext: 'Unvollstaendiges Anmeldeergebnis' }
    }

    let hindernis: AnmeldeHindernis | null
    try {
      hindernis = anmeldeHindernis(await supabase.auth.setSession({ access_token, refresh_token }))
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
    if (hindernis) return hindernis

    await get().fetchProfile()
    return null
  },

  signUp: async (email, password) => {
    let antwort
    try {
      antwort = await supabase.auth.signUp({
        email,
        password,
        // Wohin der Link aus der Bestaetigungsmail fuehrt. Ohne diese Angabe
        // gilt die Site URL des Supabase-Projekts – und die zeigt auf eine
        // statische Entwurfsseite ausserhalb der App.
        options: { emailRedirectTo: confirmUrl() },
      })
    } catch (grund) {
      return {
        // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
        hindernis: anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null },
        bestaetigungNoetig: false,
        bereitsRegistriert: false,
      }
    }

    const { data, error } = antwort

    // DER ZWEITE WEG, auf dem "diese Adresse hat schon ein Konto" ankommt -
    // und er ist ein FEHLER, kein gefaelschter Erfolg.
    //
    // Ist die E-Mail-Bestaetigung im Supabase-Projekt abgeschaltet, gibt es
    // niemanden zu schuetzen: GoTrue meldet die vergebene Adresse dann
    // offen, mit `email_exists` (oder `user_already_exists`, beide in
    // auth-js `error-codes.d.ts`). Ohne diesen Zweig wuerde daraus die
    // allgemeine Notiz "Die Registrierung hat nicht geklappt. Versuch es
    // noch einmal." - und wer es noch einmal versucht, scheitert genauso.
    // Dieselbe Klasse wie die drei Funde vom 03.09.2026.
    //
    // AM CODE, NIE AM TEXT. Bis zum 07.09.2026 stand die Erkennung auf der
    // SEITE und glich `err.toLowerCase().includes('already registered')`
    // ab; sie ist mit dem Rohtext gefallen, und das war richtig -
    // Fehlertexte sind kein Vertrag (`supabaseFehler.ts`, seit 22.08.2026),
    // der Server hat sie seither zweimal umformuliert. Der Code ist einer.
    // Die Naht liegt deshalb hier im Store, nicht auf der Seite: Der
    // Ausgang ist derselbe wie beim gefaelschten Erfolg unten, und die
    // Seite braucht dafuer nichts Neues.
    const code = error?.code
    if (code === 'email_exists' || code === 'user_already_exists') {
      return { hindernis: null, bestaetigungNoetig: false, bereitsRegistriert: true }
    }

    const hindernis = anmeldeHindernis(antwort)
    if (hindernis) return { hindernis, bestaetigungNoetig: false, bereitsRegistriert: false }

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
      return { hindernis: null, bestaetigungNoetig: false, bereitsRegistriert: true }
    }

    // Kein Fehler, aber auch keine Sitzung: Das Konto existiert, muss aber
    // erst per E-Mail bestaetigt werden.
    return { hindernis: null, bestaetigungNoetig: data.session == null, bereitsRegistriert: false }
  },

  verifyCode: async (email, code) => {
    try {
      const hindernis = anmeldeHindernis(
        await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' }),
      )
      // Die Sitzung steht jetzt; onAuthStateChange holt das Profil nach.
      return hindernis
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
  },

  resendCode: async (email) => {
    try {
      // Dieselbe Zieladresse wie beim Anlegen: Die neue Mail enthaelt wieder
      // beides, Code und Link, und der Link muss genauso in der App landen.
      return anmeldeHindernis(
        await supabase.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: confirmUrl() },
        }),
      )
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
  },

  /**
   * Warum hier KEIN try/catch steht.
   *
   * Aus demselben Grund wie bei `createProfile` - und zusaetzlich, weil
   * `dateiMitZeile` das Geworfene aus `zeileSchreiben` selbst faengt
   * (`lib/dateiAblegen.ts:172-183`) und in `fehler`/`roh` legt. Es tut das
   * nicht aus Hoeflichkeit, sondern weil es sonst am Zurueckrollen vorbei
   * liefe und die Datei fuer immer im Behaelter liegen bliebe. Ein `catch`
   * hier haette also nichts zu fangen, was von dort kaeme.
   */
  setAvatar: async (datei) => {
    const user = get().user
    // Der Waechter baut das Hindernis selbst: Ohne Nutzer wird nichts
    // gesendet, es gibt also keine Antwort, die ein Modul lesen koennte.
    // Er ist zugleich die Voraussetzung, unter der `ablageHindernis` ein
    // `AccessDenied` als `verweigert` lesen darf - ohne ihn kaeme der
    // anon-Schluessel an die Zeilenrechte, und `verweigert` waere die
    // falsche naechste Handlung (Kopf von `ablageHindernis`, Runde 5).
    if (!user) return { art: 'nicht-angemeldet', rohtext: null }

    const alt = get().profile?.avatar_url ?? null

    const ergebnis = await dateiMitZeile({
      behaelter: 'avatars',
      praefix: user.id,
      datei,
      rueckfallEndung: 'jpg',
      rueckfallTyp: 'image/jpeg',
      /**
       * WARUM HIER EIN `select` HINTER DEM `update` STEHT - N1 der zweiten
       * Durchsicht (09.09.2026).
       *
       * Ohne `select()` ist ein `update` BLIND. postgrest-js haengt
       * `Prefer: return=representation` erst in `select()` an
       * (node_modules/@supabase/postgrest-js/dist/index.mjs:684); ohne den
       * Kopf antwortet PostgREST mit 204 und leerem Koerper, und
       * `processResponse` laesst bei `body === ""` Daten UND Fehler auf
       * `null` (:451). NULL GETROFFENE ZEILEN SIND VON EINER NICHT ZU
       * UNTERSCHEIDEN.
       *
       * Dass null Zeilen ueberhaupt vorkommen, liegt an der Regel:
       * `profiles_update_own` (myprosole_app/supabase/migrations/
       * 0001_profiles.sql:141-146, `for update to authenticated using
       * (id = auth.uid())`) FILTERT, sie LEHNT NICHT AB - `using` schneidet
       * die Zeilenmenge, es wirft kein `42501`. Und ablehnen wuerde sie
       * ohnehin nicht am Recht: `authenticated` HAT UPDATE auf `profiles`
       * (gemessen vom Nutzer am 10.09.2026 in der gehosteten Datenbank,
       * `information_schema.role_table_grants`).
       *
       * Der Schaden ohne diese Pruefung war STILLER ERFOLG: Stirbt die
       * Sitzung zwischen Hochladen und Zeile - dasselbe Fenster, das im
       * Kopf von `profilHindernis` unter (a) steht -, trifft das Update
       * null Zeilen, `error` bleibt `null`, `dateiMitZeile` meldet Erfolg,
       * und der Zweig weiter unten loescht DAS ALTE BILD, waehrend
       * `avatar_url` weiter darauf zeigt. Zweiter Weg, ohne jedes
       * Rechteproblem: eine `profiles`-Zeile, die es nicht gibt, oder ein
       * `user.id`, das nicht zur Sitzung passt.
       *
       * VORAUSSETZUNG, damit das `select` nicht selbst zum Hindernis wird:
       * `profiles_select_public` (0022_public_profiles_and_avatars.sql:35-38,
       * `for select to authenticated using (true)`) laesst `authenticated`
       * JEDE Profilzeile lesen. Das `select` scheitert also an keiner Regel;
       * was es zurueckgibt, entscheidet allein das `using` des UPDATE.
       *
       * `keine_zeile` ist unser Bezeichner, kein PostgREST-Code - wer ihn in
       * der Bibliothek sucht, findet nichts. Er bekommt bewusst KEINE eigene
       * Hindernis-Art: `profilHindernis` kennt ihn nicht und gibt
       * `unbekannt` (lib/hindernis.ts, letzter Zweig), und das ist hier
       * richtig, nicht nachlaessig - "Das Bild wurde nicht gespeichert.
       * Versuch es gleich noch einmal." ist der einzige ehrliche Satz,
       * solange Sitzung-tot und Zeile-fehlt an dieser Stelle nicht trennbar
       * sind.
       */
      zeileSchreiben: async (pfad) => {
        const { data, error } = await supabase
          .from('profiles')
          .update({ avatar_url: pfad })
          .eq('id', user.id)
          .select('id')
        if (error) return { data: null, error }
        if (!data || data.length === 0) {
          return {
            data: null,
            error: { message: 'Profilzeile nicht geschrieben (0 Zeilen)', code: 'keine_zeile' },
          }
        }
        return { data: null, error: null }
      },
    })

    // ZWEI PHASEN, ZWEI FACHGEBIETE - und die Phase steht vor der Wahl des
    // Moduls, nicht danach.
    //
    // `dateiMitZeile` tut zwei Dinge nacheinander: hochladen (Storage) und
    // die Zeile schreiben (PostgREST). Die zwei Bibliotheken sprechen
    // verschieden - Storage schickt fuer alles HTTP 400 und den echten
    // Status als String in `statusCode`, PostgREST schickt SQLSTATE-Codes
    // wie `42501`. Ein Modul kann nicht beides lesen: `ablageHindernis` auf
    // einen `42501` gibt `unbekannt`, `profilHindernis` auf ein
    // `EntityTooLarge` ebenso. Deshalb entscheidet nicht der Inhalt des
    // Fehlers, welches Modul fragt, sondern WIE WEIT der Vorgang kam.
    //
    // `pfad === null` heisst: Es liegt keine Datei, das Hochladen ist
    // gescheitert (`dateiAblegen.ts`, der Zweig `if (hochladen)`). Jeder
    // andere Fehler kam danach - also von der Zeile.
    //
    // Das `roh` daneben ist der Grund, warum das ueberhaupt geht: Bis zum
    // 08.09.2026 gab das Modul nur Text zurueck, und ein Text traegt keinen
    // Code (docs/authhindernis-entwurf.md, "Nachgesehen vor 4c").
    //
    // Kein Rueckfall hinter den beiden Aufrufen: `dateiMitZeile` sichert zu,
    // dass `roh` gesetzt ist, wenn `fehler` es ist (Kopf von `Ergebnis.roh`).
    // Ein Rueckfall auf ein unbekanntes Hindernis haette diese Zusicherung
    // nicht gestaerkt, sondern verdeckt, ob sie ueberhaupt gilt - und wo sie
    // nicht gilt, gehoert das Feld gefuellt, nicht der Fehlschlag begradigt.
    if (ergebnis.pfad === null) {
      return ablageHindernis(ergebnis.roh)
    }
    // Derselbe Waechter wie in `dateiMitZeile` (B1, 08.09.2026): Gelesen
    // wird `roh`, nicht `fehler`, weil das Modul zusichert, dass `roh !==
    // null` einen Fehlschlag bedeutet - auch bei `fehler === ''`, dem leeren
    // Text, den postgrest-js bei leerem Antwortkoerper baut und der als
    // Wahrheitswert falsch ist; er kam hier als Erfolg an und loeschte das
    // alte Profilbild, obwohl die Zeile nie geschrieben wurde.
    if (ergebnis.roh !== null) {
      // Ein `ProfilHindernis` ist ein `AblageHindernis`: `verweigert`,
      // `nicht-erreichbar`, `nicht-angemeldet` und `unbekannt` sind eine
      // Teilmenge der sechs Ablage-Arten (`lib/hindernis.ts`).
      //
      // Die Voraussetzung, unter der das hier gilt - dieselbe Art
      // Voraussetzung wie bei `AccessDenied` im Kopf von `ablageHindernis`:
      // Ein `42501` ist an DIESER Stelle immer eine Ablehnung MIT Sitzung,
      // also `verweigert`. Das haelt nur, solange der Waechter `if (!user)`
      // vor dem Senden steht: Ohne Nutzer geht nichts hinaus, und ein
      // abgelaufenes JWT kaeme als `PGRST30x`, nicht als `42501`. Das
      // Fehlerobjekt der Zeile traegt keinen Status, der die beiden sonst
      // trennen wuerde - `createProfile` gibt deshalb die GANZE Antwort
      // weiter, hier gibt es sie nicht. Wer den Waechter entfernt, bekommt
      // beim anon-Zugriff `verweigert` statt `nicht-angemeldet` und schickt
      // den Abgemeldeten in die falsche Richtung.
      //
      // WIE WEIT DIESE VORAUSSETZUNG TRAEGT - nachgesehen bei der
      // Sicherheitspruefung (08.09.2026), weil "solange der Waechter vor dem
      // Senden steht" mehr verspricht, als der Waechter halten kann:
      //
      //   (a) `get().user` ist ein Zustand DIESES Speichers, keine gueltige
      //       Sitzung. Stirbt die Sitzung zwischen Waechter und Antwort -
      //       die Erneuerung scheitert, `SIGNED_OUT` kommt erst ueber den
      //       Zuhoerer -, laesst der Waechter durch, und supabase-js sendet
      //       den API-Schluessel als Bearer (2.112.3, `_getSessionToken`
      //       gibt null, `dist/index.mjs:302`). Die Folge ist ein FALSCHER
      //       SATZ, kein Zugriff: Der Mensch liest "Das Speichern wurde
      //       nicht erlaubt" statt "Deine Anmeldung ist abgelaufen". Die
      //       Zeilenrechte lehnen ab, wie sie sollen.
      //   (b) Ob der Fall stattdessen als 401 ankaeme, haengt am
      //       SCHLUESSELFORMAT, nicht an diesem Waechter: Ein alter
      //       JWT-Schluessel (`eyJ…`, heute in `.env.production`) traegt die
      //       Rolle `anon` und ergibt bei PostgREST 403; ein
      //       `sb_publishable_`-Schluessel traegt keine Rolle. Die Messung
      //       und ihre Grenze stehen im Kopf von `profilHindernis`
      //       (lib/hindernis.ts) - dort, wo der 401-Zweig steht.
      //
      // Der Waechter schaerft also die Diagnose, er sichert sie nicht zu.
      return profilHindernis(ergebnis.roh)
    }

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
    // profilBekannt MUSS mit zurueck: Sonst traegt der naechste Angemeldete
    // die Zusicherung des vorigen, und wenn sein eigenes Laden scheitert,
    // kommt er an der Einrichtung vorbei.
    kontoZustandVergessen()
    set({
      user: null,
      session: null,
      profile: null,
      profilBekannt: false,
    })
  },

  fetchProfile: async () => {
    const user = get().user
    if (!user) {
      set({ profileLoading: false })
      return
    }

    // maybeSingle statt single: `.single()` meldet NULL ZEILEN als Fehler
    // (PGRST116). Damit kaemen "es gibt kein Profil" und "die Abfrage ging
    // schief" als derselbe Zustand an, und genau die zwei muessen hier
    // auseinandergehalten werden.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    // Scheitert die Abfrage, bleibt das bisher Bekannte stehen - es wird
    // NICHT durch "kein Profil" ersetzt. Sonst sieht ein Konto mit laengst
    // gesetztem Anzeigenamen aus wie ein frisch angelegtes, und der Waechter
    // schickt es in die Einrichtung. Genau das war der Fehler vom
    // 25.08.2026, gemeldet aus der laufenden Produktion.
    if (error) {
      entwicklerWarnung(`Profil laden fehlgeschlagen: ${error.message}`)
      set({ profileLoading: false })
      return
    }

    set({
      profile: (data as Profile) ?? null,
      profilBekannt: true,
      profileLoading: false,
    })
  },

  /**
   * Warum hier KEIN try/catch steht - anders als bei den Auth-Funktionen
   * ueber dieser Zeile.
   *
   * postgrest-js GIBT einen Netzfehler ZURUECK, es wirft ihn nicht: Feld
   * `code` vorhanden und leer, `status: 0` daneben (dist/index.cjs,
   * `PostgrestBuilder.then`, der `res.catch`-Zweig ohne `shouldThrowOnError`;
   * abgelesen am 05.09.2026, festgehalten im Kopf von `profilHindernis`).
   * Genau diese Form erkennt das Modul als `nicht-erreichbar`. Ein `catch`
   * haette hier also nichts zu fangen, was ein PostgREST-Fehler waere.
   *
   * Was ein `catch` stattdessen faenge, ist genau eines: ein Programmfehler - ein
   * `user.id` an einem `undefined`, ein Nachbau, der die Kette nicht
   * bereitstellt, ein Aufruf mit falscher Form. Der soll auffallen und nicht
   * als "Speichern hat gerade nicht geklappt" auf dem Bildschirm enden, wo
   * niemand ihn je sieht und der Mensch es dreimal vergeblich versucht.
   *
   * Bei der Anmeldung ist es umgekehrt, und deshalb steht dort ein `catch`:
   * auth-js faengt seine eigenen `AuthError` wieder ein und gibt sie zurueck,
   * WIRFT aber alles andere weiter (`GoTrueClient.js`,
   * `if (isAuthError(error)) return ...; throw error`) - Sperre um die
   * Sitzung, PKCE-Speicher, Speicher des Browsers. Dort ist das Geworfene
   * ein erwartbarer Weg, hier nicht.
   */
  createProfile: async (data) => {
    const user = get().user
    // Der Waechter baut den Satz selbst: Ohne Nutzer wird nichts gesendet,
    // es gibt also keine Antwort, die das Modul lesen koennte.
    if (!user) return { art: 'nicht-angemeldet', rohtext: null }

    // Die GANZE Antwort, nicht nur `error`: `42501` heisst mit Sitzung
    // "verweigert" (403) und ohne "nicht angemeldet" (401) - das Fehlerobjekt
    // traegt keinen Status, die Antwort schon
    // (docs/authhindernis-entwurf.md, Abschnitt 10).
    const antwort = await supabase.from('profiles').upsert({
      id: user.id,
      ...data,
    })

    const hindernis = profilHindernis(antwort)
    if (hindernis) return hindernis

    await get().fetchProfile()
    return null
  },

  resetPassword: async (email) => {
    try {
      // Mit eigenem Ziel. Ohne redirectTo gilt die Site URL des Projekts, und
      // die zeigt auf die Startseite – man war dann zwar angemeldet, hatte
      // aber nirgends ein Feld fuer ein neues Passwort und kam beim naechsten
      // Mal wieder nicht hinein.
      return anmeldeHindernis(
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: passwortNeuUrl() }),
      )
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
  },

  setzePasswort: async (passwort) => {
    try {
      return anmeldeHindernis(await supabase.auth.updateUser({ password: passwort }))
    } catch (grund) {
      // Ein `catch`, der anspringt, IST ein Fehlschlag - nie null (3. oben).
      return anmeldeHindernis(grund) ?? { art: 'unbekannt', rohtext: null }
    }
  },
}))
