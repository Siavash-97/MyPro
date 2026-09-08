import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Ein fehlgeschlagenes Laden ist kein "kein Profil".
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Am 25.08.2026 gemeldet, mit Bildschirmfoto aus der laufenden Produktion:
 * Die App sprang mitten in der Benutzung auf "Profil einrichten" - bei einem
 * Konto, das seit Wochen einen Anzeigenamen hat.
 *
 * Die Ursache stand in `fetchProfile`:
 *
 *     const { data } = await supabase.from('profiles')...single()
 *     set({ profile: (data as Profile) ?? null, profileLoading: false })
 *
 * Der Fehler wurde nicht ausgelesen. Schlaegt die Abfrage fehl, ist `data`
 * gleich `null`, und `?? null` schreibt "kein Profil" in den Speicher.
 * Danach sieht `AuthGuard.tsx:74` keinen Anzeigenamen und leitet in die
 * Einrichtung um.
 *
 * Das ist dasselbe Muster wie in `anamnese.ts` (heute frueh behoben) und in
 * `communityProfile.ts` (gestern behoben): **"ich weiss es nicht" und "es
 * gibt keins" waren derselbe Wert.** Drittes Vorkommen in zwei Tagen.
 *
 * Der Unterschied, der es hier schwerer macht
 * -------------------------------------------
 * `.single()` gibt AUCH dann einen Fehler zurueck, wenn es null Zeilen gibt
 * (PGRST116). "Kein Profil vorhanden" und "Abfrage fehlgeschlagen" kommen
 * also als derselbe Zustand an. Wer beide gleich behandelt, sperrt entweder
 * Bestandsnutzer aus (bisher) oder echte Neunutzer aus der Einrichtung aus
 * (der naheliegende Fix).
 *
 * Deshalb `.maybeSingle()`: Null Zeilen sind damit `data: null, error: null`
 * - ein Ergebnis, kein Fehler. Uebrig bleibt als Fehler nur, was wirklich
 * einer ist.
 */

type Antwort = { data: unknown; error: { message: string; code?: string } | null }

/**
 * Die Antwort von PostgREST traegt einen STATUS neben dem Fehlerobjekt - und
 * nur er trennt `42501` mit Sitzung (403, verweigert) von `42501` ohne (401,
 * nicht angemeldet; dann hat supabase-js den anon-Schluessel geschickt).
 * Belegt in docs/authhindernis-entwurf.md, Abschnitt 10, "42501 ist
 * zweideutig". Ein Nachbau ohne `status` koennte diese Naht nicht messen.
 */
type AntwortMitStatus = Antwort & { status: number }

let profilAntwort: Antwort = { data: null, error: null }
/**
 * Eigene Variable, nicht `profilAntwort`: Die dort gehoert `fetchProfile`,
 * und `createProfile` ruft `fetchProfile` nach dem Anlegen selbst auf. Eine
 * gemeinsame Variable liesse den Erfolgsfall den Ladefall mitbestimmen.
 */
let anlegeAntwort: AntwortMitStatus = { data: null, error: null, status: 201 }
/**
 * Die Zeile, die `setAvatar` nach dem Hochladen schreibt
 * (`update({ avatar_url }).eq('id', …)`). Eigene Variable aus demselben
 * Grund wie `anlegeAntwort`: `setAvatar` ruft am Ende `fetchProfile` auf,
 * und eine gemeinsame Variable liesse den einen Fall den anderen bestimmen.
 *
 * Mit `status`, obwohl `setAvatar` heute nur das Fehlerobjekt weitergibt:
 * So antwortet PostgREST wirklich, und ein Nachbau, der freundlicher ist
 * als die Wirklichkeit, misst die Naht nicht.
 */
let zeilenAntwort: AntwortMitStatus = { data: null, error: null, status: 204 }
const abgefragt: string[] = []

/**
 * Der Behaelter `avatars` ueber Storage - der Teil des Nachbaus, den es bis
 * zum 08.09.2026 nicht gab.
 *
 * Ohne ihn liefe `setAvatar` in einen TypeError, und die einzige Alternative
 * waere gewesen, `../lib/dateiAblegen` zu ersetzen. Das haette bewiesen,
 * dass ein Nachbau ein Objekt durchreicht - nicht, dass die Naht es tut
 * (docs/authhindernis-entwurf.md, "Nachgesehen vor 4c"). Deshalb laeuft
 * hier der echte `dateiMitZeile`.
 */
let hochladeAntwort: { data: unknown; error: unknown } = { data: { path: 'p' }, error: null }
let entferneAntwort: { data: unknown; error: unknown } = { data: [], error: null }
const ablageAufrufe: string[] = []
/**
 * WELCHE Datei entfernt wurde - `ablageAufrufe` sagt nur DASS.
 *
 * Der Unterschied traegt B1 (08.09.2026): Rollt `dateiMitZeile` die NEUE
 * Datei zurueck, steht in `ablageAufrufe` ein `avatars.remove`; loescht
 * `setAvatar` danach das ALTE Bild, steht dort ebenfalls eines. Die beiden
 * sind daran nicht zu unterscheiden - der Datenverlust waere unsichtbar,
 * und beide Ausgaenge ergaeben dieselbe Liste. Eigene Liste mit Pfad,
 * damit die vorhandenen Faelle unveraendert bleiben.
 */
const entfernteDateien: string[] = []

/**
 * Die acht Auth-Methoden, die der Nachbau bis zum 07.09.2026 NICHT hatte.
 *
 * Bis dahin stellte er `signInWithPassword`, `signInWithOAuth`, `setSession`,
 * `signUp`, `verifyOtp`, `resend`, `resetPasswordForEmail` und `updateUser`
 * gar nicht bereit - die 241 Zeilen dieser Datei sahen wie Abdeckung der
 * Anmeldung aus und deckten `fetchProfile` und `signOut` ab
 * (docs/authhindernis-entwurf.md, Abschnitt 2, "Testbarkeit heute").
 */
type AuthMethode =
  | 'signInWithPassword'
  | 'signInWithOAuth'
  | 'setSession'
  | 'signUp'
  | 'verifyOtp'
  | 'resend'
  | 'resetPasswordForEmail'
  | 'updateUser'

/**
 * Ein Ausgang je Methode - und BEIDE Formen sind noetig.
 *
 * BERICHTIGT AM 07.09.2026. Hier stand: "auth-js WIRFT den Netzfehler, es
 * gibt ihn nicht zurueck." Das ist falsch, und zwar an der Stelle, an der
 * es zaehlt: `_request` wirft den `AuthRetryableFetchError` (fetch.js),
 * aber jede Methode von `GoTrueClient` faengt ihn wieder und gibt ihn
 * zurueck (`catch (error) { if (isAuthError(error)) return
 * this._returnResult({ data, error }); throw error }`). Ein Netzfehler
 * kommt beim Store also als RUECKGABE an - so wird er unten auch gestellt.
 *
 * Geworfen kommt nur an, was KEIN AuthError ist: ein Fehler aus der Sperre
 * um die Sitzung, aus dem PKCE-Speicher, aus dem Speicher des Browsers.
 * Genau den stellt `wirft`, und genau deshalb gibt es beide Formen.
 */
type Ausgang = { rueckgabe: unknown } | { wirft: unknown }

/** Was auth-js bei Erfolg liefert: kein Fehler. */
const OHNE_FEHLER = { data: { user: null, session: null }, error: null }

let authAusgang: Partial<Record<AuthMethode, Ausgang>> = {}

function authNachbau(name: AuthMethode) {
  return vi.fn(async () => {
    const ausgang = authAusgang[name] ?? { rueckgabe: OHNE_FEHLER }
    if ('wirft' in ausgang) throw ausgang.wirft
    return ausgang.rueckgabe
  })
}

/**
 * Die Form eines `AuthError`, an den Feldern abgelesen (auth-js 2.112.3,
 * `AuthError` in dist/module/lib/errors.js) - nicht ueber die Klasse
 * importiert.
 * Dasselbe Vorgehen wie in `lib/hindernis.test.ts`, aus demselben Grund:
 * Erkannt werden soll die FORM, nicht die Herkunft.
 */
function authFehler(code: string | undefined, status: number, message = 'x') {
  return { __isAuthError: true, name: 'AuthApiError', status, code, message }
}

function kette(tabelle: string) {
  const k: Record<string, unknown> = {}
  k.select = vi.fn(() => k)
  k.eq = vi.fn(() => k)
  k.maybeSingle = vi.fn(() => {
    abgefragt.push(`${tabelle}.maybeSingle`)
    return Promise.resolve(profilAntwort)
  })
  // `upsert` wird direkt erwartet (`await supabase.from(...).upsert(...)`),
  // ohne `select` oder `single` dahinter - deshalb gibt es hier die Antwort
  // selbst zurueck und nicht die Kette. Aufgezeichnet wird es, damit
  // "kein Serveraufruf ohne Nutzer" ueberhaupt messbar ist.
  k.upsert = vi.fn(() => {
    abgefragt.push(`${tabelle}.upsert`)
    return Promise.resolve(anlegeAntwort)
  })
  // `update` gibt NICHT die Kette zurueck, sondern ein eigenes Objekt mit
  // eigenem `eq`: `setAvatar` wartet auf das Ergebnis von `.eq(...)`,
  // `fetchProfile` dagegen ruft `.maybeSingle()` darauf. Das gemeinsame
  // `k.eq` kann nicht beides sein, ohne die vorhandenen Faelle zu aendern.
  k.update = vi.fn(() => ({
    eq: vi.fn(() => {
      abgefragt.push(`${tabelle}.update`)
      return Promise.resolve(zeilenAntwort)
    }),
  }))
  k.single = vi.fn(() => {
    abgefragt.push(`${tabelle}.single`)
    // `.single()` meldet null Zeilen als Fehler - genau die Verwechslung,
    // um die es hier geht. Der Nachbau macht es nach, sonst waere er
    // freundlicher als die Wirklichkeit.
    if (profilAntwort.data === null && profilAntwort.error === null) {
      return Promise.resolve({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      })
    }
    return Promise.resolve(profilAntwort)
  })
  return k
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn((tabelle: string) => kette(tabelle)),
    storage: {
      from: vi.fn((behaelter: string) => ({
        upload: vi.fn(() => {
          ablageAufrufe.push(`${behaelter}.upload`)
          return Promise.resolve(hochladeAntwort)
        }),
        remove: vi.fn((pfade: string[]) => {
          ablageAufrufe.push(`${behaelter}.remove`)
          entfernteDateien.push(...pfade)
          return Promise.resolve(entferneAntwort)
        }),
      })),
    },
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      signInWithPassword: authNachbau('signInWithPassword'),
      signInWithOAuth: authNachbau('signInWithOAuth'),
      setSession: authNachbau('setSession'),
      signUp: authNachbau('signUp'),
      verifyOtp: authNachbau('verifyOtp'),
      resend: authNachbau('resend'),
      resetPasswordForEmail: authNachbau('resetPasswordForEmail'),
      updateUser: authNachbau('updateUser'),
    },
  },
}))

/**
 * Ohne diesen Nachbau laedt `store/auth.ts` das echte `@capacitor/core`.
 * `Capacitor.isNativePlatform()` entscheidet in `signInWithGoogle`, ob
 * supabase-js selbst weiterleiten darf - das gehoert im Test festgelegt,
 * nicht dem Zufall der Umgebung ueberlassen.
 */
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}))

/**
 * Ohne diesen Ersatz misst der Entwurfs-Test NICHTS.
 *
 * Die Testumgebung ist `node`, nicht `jsdom` - es gibt kein `localStorage`.
 * `entwurfMerken` faengt den Fehlschlag selbst ab (bewusst, damit ein voller
 * Speicher den Fragebogen nicht anhaelt), und `entwurfLesen` gibt danach
 * `null` zurueck. Der Test waere also gruen, egal was der Quelltext tut.
 *
 * Genau so ist es beim ersten Versuch passiert. Muster uebernommen aus
 * `lib/laufMerker.test.ts:16-25` - der bisher einzigen Stelle im Projekt,
 * die das richtig macht, bei zehn Modulen, die `localStorage` benutzen.
 */
function speicherErsatz(): Storage {
  const inhalt = new Map<string, string>()
  const api = {
    getItem: (k: string) => inhalt.get(k) ?? null,
    setItem: (k: string, v: string) => void inhalt.set(k, String(v)),
    removeItem: (k: string) => void inhalt.delete(k),
    clear: () => inhalt.clear(),
    key: (i: number) => [...inhalt.keys()][i] ?? null,
    get length() {
      return inhalt.size
    },
  }
  // Der echte localStorage legt die gespeicherten Schluessel als eigene
  // Eigenschaften offen - `Object.keys(localStorage)` liefert sie. Ein
  // Nachbau ohne das waere schwaecher als die Wirklichkeit, und
  // `alleEntwuerfeVergessen` laeuft genau darueber. Dieselbe Luecke, die
  // heute schon einmal einen Test leer gruen gemacht hat.
  return new Proxy(api, {
    ownKeys: () => [...inhalt.keys()],
    getOwnPropertyDescriptor: (_ziel, name) =>
      inhalt.has(name as string)
        ? { value: inhalt.get(name as string), enumerable: true, configurable: true }
        : undefined,
    get: (ziel, name) =>
      name in ziel
        ? (ziel as Record<string | symbol, unknown>)[name]
        : inhalt.get(name as string),
  }) as unknown as Storage
}

const NUTZER = { id: 'nutzer-1', email: 'a@b.c' }
const PROFIL = { id: 'nutzer-1', display_name: 'Sia', running_level: 'beginner' }

async function frisch() {
  vi.resetModules()
  const { useAuth } = await import('./auth')
  return useAuth
}

beforeEach(() => {
  profilAntwort = { data: null, error: null }
  anlegeAntwort = { data: null, error: null, status: 201 }
  zeilenAntwort = { data: null, error: null, status: 204 }
  hochladeAntwort = { data: { path: 'p' }, error: null }
  entferneAntwort = { data: [], error: null }
  abgefragt.length = 0
  ablageAufrufe.length = 0
  entfernteDateien.length = 0
  authAusgang = {}
  vi.stubGlobal('localStorage', speicherErsatz())
  // Die Testumgebung ist `node`, es gibt kein `window`. `lib/authRedirect.ts`
  // liest `window.location.origin` (confirmUrl, oauthRedirectUrl,
  // passwortNeuUrl), und ohne diesen Ersatz stirbt jeder Aufruf von signUp,
  // resendCode, resetPassword und signInWithGoogle an einem ReferenceError -
  // der Test pruefte dann die Umgebung statt den Quelltext. Dieselbe Luecke
  // wie beim `localStorage` darueber, nur ein Modul weiter.
  vi.stubGlobal('window', {
    location: { origin: 'https://test.myprosole.invalid' },
    open: vi.fn(),
  })
})

describe('Auth-Speicher, Profil', () => {
  it('haelt das Profil NICHT fuer fehlend, wenn das Laden gescheitert ist', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never, profile: PROFIL as never })

    profilAntwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchProfile()

    // Der Kern: das bekannte Profil bleibt stehen. Sonst fliegt jemand mit
    // laengst gesetztem Anzeigenamen in die Einrichtung.
    expect(store.getState().profile).toEqual(PROFIL)
    expect(store.getState().profilBekannt).toBe(false)
  })

  it('meldet ein fehlendes Profil als sicher fehlend, wenn die Abfrage GELANG', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })

    // maybeSingle: null Zeilen sind ein Ergebnis, kein Fehler.
    profilAntwort = { data: null, error: null }
    await store.getState().fetchProfile()

    expect(store.getState().profile).toBeNull()
    expect(store.getState().profilBekannt).toBe(true)
  })

  it('uebernimmt ein geladenes Profil und meldet es als bekannt', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })

    profilAntwort = { data: PROFIL, error: null }
    await store.getState().fetchProfile()

    expect(store.getState().profile).toEqual(PROFIL)
    expect(store.getState().profilBekannt).toBe(true)
  })

  it('fragt ueber maybeSingle, damit null Zeilen kein Fehler sind', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })
    profilAntwort = { data: PROFIL, error: null }

    await store.getState().fetchProfile()

    expect(abgefragt).toEqual(['profiles.maybeSingle'])
  })

  it('loescht beim Abmelden die Fragebogen-Entwuerfe vom Geraet', async () => {
    const store = await frisch()
    const { entwurfMerken, entwurfLesen } = await import('../lib/anamneseEntwurf')
    entwurfMerken('a', {
      antworten: { beschwerden: ['Knie', 'Achillessehne'] },
      schritt: 'frage-3',
      begonnenAm: '2026-08-25T09:00:00Z',
    })
    store.setState({ user: NUTZER as never })

    // Erst nachweisen, dass ueberhaupt etwas da ist - sonst wuerde der Test
    // auch dann bestehen, wenn das Merken gar nicht funktioniert.
    expect(entwurfLesen('a')?.antworten.beschwerden).toEqual(['Knie', 'Achillessehne'])

    await store.getState().signOut()

    // Gesundheitsdaten nach Art. 9 DSGVO. Bricht A mitten im Fragebogen ab
    // und meldet sich ab, darf B auf demselben Geraet A's Antworten zu
    // Schmerzen und Beschwerden nicht vorausgefuellt sehen.
    expect(entwurfLesen('a')).toBeNull()
    expect(entwurfLesen('b')).toBeNull()
    // Und nichts mit dem Praefix bleibt liegen - auch kein Block, den es
    // heute noch nicht gibt.
    expect(Object.keys(localStorage).filter((k) => k.includes('anamnese_entwurf'))).toEqual([])
  })

  it('vergisst beim Abmelden auch den Anamnese-Stand', async () => {
    const store = await frisch()
    const { useAnamnese } = await import('./anamnese')
    useAnamnese.setState({
      sessions: [{ id: 's', block: 'a', completed_at: 'x' }] as never,
      standBekannt: true,
    })
    store.setState({ user: NUTZER as never })

    await store.getState().signOut()

    // Sonst traegt der naechste Angemeldete die Zusicherung des vorigen und
    // kommt an der Pflicht-Anamnese vorbei, falls sein Laden scheitert.
    expect(useAnamnese.getState().standBekannt).toBe(false)
    expect(useAnamnese.getState().sessions).toEqual([])
  })

  it('vergisst beim Abmelden alles, was zum vorigen Konto gehoert', async () => {
    const store = await frisch()
    store.setState({
      user: NUTZER as never,
      profile: PROFIL as never,
      profilBekannt: true,
    })

    await store.getState().signOut()

    // Sonst sieht der NAECHSTE Angemeldete das Profil des vorigen - und
    // kommt an der Einrichtung vorbei, falls sein eigenes Laden scheitert.
    expect(store.getState().profile).toBeNull()
    expect(store.getState().profilBekannt).toBe(false)
  })
})

/**
 * Der Store gibt die ART zurueck, nicht den Text.
 *
 * Was hier geprueft wird, ist NICHT die Uebersetzungstabelle - die steht in
 * `lib/hindernis.test.ts` und ist dort mit 26 Faellen belegt. Hier steht die
 * NAHT: dass jede der acht Funktionen ihren Fehler ueberhaupt durch
 * `anmeldeHindernis` schickt, dass sie dabei die GANZE Antwort hineingibt
 * (der Status trennt Faelle, die das blosse Fehlerobjekt nicht trennt), und
 * dass ein GEWORFENER Fehler nicht durchfaellt.
 *
 * Die Grenze dieser Datei, ausdruecklich: Sie sagt nichts darueber, welchen
 * SATZ eine Seite daraus macht. Das entscheidet die Oberflaeche
 * (docs/authhindernis-entwurf.md, Q2), und geprueft wird es im Browser
 * (`e2e/anmelden-fehler.spec.ts`).
 */
describe('Auth-Speicher, Anmeldung: Hindernis statt Rohtext', () => {
  it('signIn: falsche Zugangsdaten sind abgelehnt - mit Rohtext, nie fuer den Bildschirm', async () => {
    const store = await frisch()
    authAusgang.signInWithPassword = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('invalid_credentials', 400, 'Invalid login credentials'),
      },
    }

    expect(await store.getState().signIn('a@b.c', 'falsch')).toEqual({
      art: 'abgelehnt',
      rohtext: 'Invalid login credentials',
    })
  })

  it('signIn: Ratenbegrenzung ist zu-oft, nicht "Passwort falsch"', async () => {
    const store = await frisch()
    authAusgang.signInWithPassword = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('over_request_rate_limit', 429, 'Request rate limit reached'),
      },
    }

    // Der Fehler vom 03.09.: Wer zu oft getippt hat, las "E-Mail oder
    // Passwort falsch" und tippte weiter - genau das Falsche.
    expect(await store.getState().signIn('a@b.c', 'x')).toEqual({
      art: 'zu-oft',
      rohtext: 'Request rate limit reached',
    })
  })

  it('signIn: eine nie bestaetigte Adresse ist nicht-bestaetigt, nicht abgelehnt', async () => {
    const store = await frisch()
    authAusgang.signInWithPassword = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('email_not_confirmed', 400, 'Email not confirmed'),
      },
    }

    // `abgelehnt` beschuldigte Adresse UND Kennwort, obwohl beide stimmen.
    expect((await store.getState().signIn('a@b.c', 'richtig'))?.art).toBe('nicht-bestaetigt')
  })

  it('signIn: ein GEWORFENER Fehler faellt nicht durch, sondern wird ein Hindernis', async () => {
    const store = await frisch()
    // BERICHTIGT AM 07.09.2026. Hier stand ein geworfener
    // `TypeError('Failed to fetch')` mit der Erwartung `nicht-erreichbar` -
    // ein Fall, den es so nicht gibt: `GoTrueClient` faengt jeden AuthError
    // wieder und GIBT ihn zurueck; nur was KEIN AuthError ist, kommt
    // geworfen an. Der Test stellte damit einen Weg, den die Bibliothek
    // nicht nimmt, und behauptete danach etwas ueber die Wirklichkeit.
    //
    // Was wirklich geworfen ankommt, ist ein Fehler ohne Code und ohne
    // Bibliotheksform - eine Zeitgrenze der Sperre um die Sitzung, ein
    // Fehler aus dem PKCE-Speicher. Der ist `unbekannt`, nicht "nicht
    // erreichbar": Das Modul erkennt am Code oder Status, nie am Wortlaut,
    // und "lock timeout" traegt keinen von beiden.
    authAusgang.signInWithPassword = { wirft: new Error('lock timeout') }

    expect(await store.getState().signIn('a@b.c', 'x')).toEqual({
      art: 'unbekannt',
      rohtext: 'lock timeout',
    })
  })

  it('signIn: ein geworfenes null ist ein Fehlschlag, kein Erfolg', async () => {
    const store = await frisch()
    authAusgang.signInWithPassword = { wirft: null }

    // `anmeldeHindernis(null)` heisst "es hat geklappt" - richtig fuer eine
    // Antwort, falsch fuer ein `catch`. Ohne den Rueckfall bekaeme die
    // Seite hier `null` und schickte weiter, ohne dass jemand angemeldet
    // waere: Login navigiert dann auf die geschuetzte Startseite, App.tsx
    // auf `/`. Die EXISTENZ entscheidet, nicht der Inhalt - eine Ebene
    // hoeher als im Modul, aus demselben Grund.
    expect(await store.getState().signIn('a@b.c', 'x')).toEqual({
      art: 'unbekannt',
      rohtext: null,
    })
  })

  it('signInWithGoogle: der wiederholbare Netzfehler ist nicht-erreichbar', async () => {
    const store = await frisch()
    authAusgang.signInWithOAuth = {
      rueckgabe: {
        data: null,
        error: {
          __isAuthError: true,
          name: 'AuthRetryableFetchError',
          status: 0,
          message: 'Failed to fetch',
        },
      },
    }

    expect((await store.getState().signInWithGoogle())?.art).toBe('nicht-erreichbar')
  })

  it('handleOAuthCallback: ein untaugliches Token ist nicht-angemeldet', async () => {
    const store = await frisch()
    authAusgang.setSession = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('bad_jwt', 401, 'invalid JWT'),
      },
    }

    const hindernis = await store
      .getState()
      .handleOAuthCallback('com.myprosole.app://login-callback#access_token=a&refresh_token=r')

    expect(hindernis).toEqual({ art: 'nicht-angemeldet', rohtext: 'invalid JWT' })
  })

  it('handleOAuthCallback: der eigene Satz ohne Fragment bleibt eigener Satz', async () => {
    const store = await frisch()

    // Dieser Ausgang traegt KEIN Bibliotheksobjekt. Er baut das Hindernis
    // deshalb direkt - der Grund steht im Quelltext an der Stelle.
    expect(await store.getState().handleOAuthCallback('com.myprosole.app://login-callback')).toEqual({
      art: 'unbekannt',
      rohtext: 'Kein Anmeldeergebnis in der Adresse',
    })
  })

  it('signUp: das Feld heisst hindernis, und die zwei Wahrheitswerte bleiben Ergebnisse', async () => {
    const store = await frisch()
    authAusgang.signUp = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('over_email_send_rate_limit', 429, 'email rate limit exceeded'),
      },
    }

    expect(await store.getState().signUp('a@b.c', 'geheim123')).toEqual({
      hindernis: { art: 'zu-oft', rohtext: 'email rate limit exceeded' },
      bestaetigungNoetig: false,
      bereitsRegistriert: false,
    })
  })

  it('signUp: Erfolg ohne Sitzung heisst hindernis null und bestaetigungNoetig', async () => {
    const store = await frisch()
    authAusgang.signUp = {
      rueckgabe: {
        data: { user: { id: 'neu', identities: [{ id: 'i' }] }, session: null },
        error: null,
      },
    }

    // null heisst: es hat geklappt. Der fehlende Sitzungsteil ist ein
    // ERGEBNIS, kein Fehler - deshalb wird er kein Hindernis (R2-Q2).
    expect(await store.getState().signUp('a@b.c', 'geheim123')).toEqual({
      hindernis: null,
      bestaetigungNoetig: true,
      bereitsRegistriert: false,
    })
  })

  it('signUp: email_exists heisst bereits registriert - erkannt am Code, nie am Text', async () => {
    const store = await frisch()
    // Der lebende Fall des Zweiges, der am 07.09.2026 mit dem Textabgleich
    // auf der Seite gefallen war: Ist die E-Mail-Bestaetigung im Projekt
    // ABGESCHALTET, gibt es niemanden zu schuetzen, und GoTrue meldet die
    // vergebene Adresse offen als Fehler. Ohne diesen Zweig wuerde daraus
    // "Die Registrierung hat nicht geklappt. Versuch es noch einmal." -
    // und der zweite Versuch scheiterte genauso.
    authAusgang.signUp = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('email_exists', 422, 'Email address already registered by another user'),
      },
    }

    // Derselbe Ausgang wie beim gefaelschten Erfolg - die Seite braucht
    // nichts Neues, und `hindernis` bleibt null, weil es kein Hindernis
    // ist, sondern ein Ergebnis: Das Konto gibt es.
    expect(await store.getState().signUp('a@b.c', 'geheim123')).toEqual({
      hindernis: null,
      bestaetigungNoetig: false,
      bereitsRegistriert: true,
    })
  })

  it('signUp: user_already_exists ebenso - beide Codes, nicht nur der haeufige', async () => {
    const store = await frisch()
    authAusgang.signUp = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('user_already_exists', 422, 'User already registered'),
      },
    }

    // Beide stehen in `error-codes.d.ts`, und welchen GoTrue schickt, haengt
    // am Weg im Server. Einen zu pruefen und den anderen zu vergessen waere
    // dieselbe halbe Abdeckung, die diese Datei bis heute frueh hatte.
    expect(await store.getState().signUp('a@b.c', 'geheim123')).toEqual({
      hindernis: null,
      bestaetigungNoetig: false,
      bereitsRegistriert: true,
    })
  })

  it('verifyCode: ein falscher oder abgelaufener Code ist abgelehnt', async () => {
    const store = await frisch()
    authAusgang.verifyOtp = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('otp_expired', 403, 'Token has expired or is invalid'),
      },
    }

    expect((await store.getState().verifyCode('a@b.c', '123456'))?.art).toBe('abgelehnt')
  })

  it('resendCode: die Absperre fuer E-Mails ist zu-oft', async () => {
    const store = await frisch()
    authAusgang.resend = {
      rueckgabe: {
        data: { user: null, session: null },
        error: authFehler('over_email_send_rate_limit', 429, 'For security purposes, you can only request this after 51 seconds.'),
      },
    }

    // Die Sekundenzahl bleibt im Rohtext und wird NICHT versprochen: Sie
    // steht nur bei einer von drei Varianten im Satz (Entwurf, R4-Q3).
    expect(await store.getState().resendCode('a@b.c')).toEqual({
      art: 'zu-oft',
      rohtext: 'For security purposes, you can only request this after 51 seconds.',
    })
  })

  it('resetPassword: ein 503 ist nicht-erreichbar, nicht "pruef deine Adresse"', async () => {
    const store = await frisch()
    authAusgang.resetPasswordForEmail = {
      rueckgabe: {
        data: null,
        error: {
          __isAuthError: true,
          name: 'AuthRetryableFetchError',
          status: 503,
          message: 'Service Unavailable',
        },
      },
    }

    expect((await store.getState().resetPassword('a@b.c'))?.art).toBe('nicht-erreichbar')
  })

  it('setzePasswort: eine fehlende Sitzung ist nicht-angemeldet - der verbrauchte Link', async () => {
    const store = await frisch()
    authAusgang.updateUser = {
      rueckgabe: {
        data: { user: null },
        error: {
          __isAuthError: true,
          name: 'AuthSessionMissingError',
          status: 400,
          message: 'Auth session missing!',
        },
      },
    }

    // Ohne Code, nur am Namen erkennbar (`AuthSessionMissingError` in
    // auth-js errors.js).
    expect((await store.getState().setzePasswort('neuesGeheimnis1'))?.art).toBe('nicht-angemeldet')
  })

  it('setzePasswort: ein Fehler ohne Code und ohne Meldung ist unbekannt - nie null', async () => {
    const store = await frisch()
    authAusgang.updateUser = { rueckgabe: { data: { user: null }, error: {} } }

    // Die Existenz entscheidet, nicht der Inhalt. Wuerde hier null
    // herauskommen, saehe ein Fehlschlag wie ein Erfolg aus - und die Seite
    // schickte weiter, statt zu melden.
    expect(await store.getState().setzePasswort('neuesGeheimnis1')).toEqual({
      art: 'unbekannt',
      rohtext: null,
    })
  })
})

/**
 * Dasselbe eine Ebene weiter: die Tabelle `profiles` ueber PostgREST.
 *
 * Auch hier steht die NAHT, nicht die Uebersetzungstabelle (die ist in
 * `lib/hindernis.test.ts` belegt): dass `createProfile` seinen Fehler durch
 * `profilHindernis` schickt, dass es dabei die GANZE Antwort hineingibt, und
 * dass der Waechter ohne Nutzer gar nicht erst sendet.
 *
 * Der Fall, der die ganze Antwort erzwingt, ist `42501` - zweimal derselbe
 * Fehler, zweimal eine andere naechste Handlung des Menschen: bei 401 neu
 * anmelden, bei 403 warten und spaeter wieder. Wer nur `antwort.error`
 * weiterreicht, bekommt beide Male `verweigert` und schickt den
 * Abgemeldeten in die falsche Richtung.
 */
describe('Auth-Speicher, Profil anlegen: Hindernis statt Rohtext', () => {
  it('ohne Nutzer: nicht-angemeldet, und es wird gar nicht erst gesendet', async () => {
    const store = await frisch()

    // Kein `setState` - niemand ist angemeldet. Den Satz baut der Waechter
    // selbst; das Modul zu fragen haette nichts zu lesen.
    expect(await store.getState().createProfile({
      display_name: 'Sia',
      running_level: null,
      weekly_goal_km: null,
    })).toEqual({ art: 'nicht-angemeldet', rohtext: null })

    // Der zweite Teil ist der wichtigere: keine Anfrage. Ohne ihn koennte
    // der Waechter fehlen und der Test bliebe gruen, sobald der Server
    // zufaellig auch 401 antwortet.
    expect(abgefragt).toEqual([])
  })

  it('42501 heisst nicht-angemeldet bei 401 und verweigert bei 403 - derselbe Fehler', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })
    const daten = { display_name: 'Sia', running_level: null, weekly_goal_km: null }

    // Ohne Sitzung schickt supabase-js den anon-Schluessel; die Zeilenrechte
    // sagen nein, PostgREST antwortet 401. Die naechste Handlung ist "neu
    // anmelden".
    anlegeAntwort = {
      data: null,
      error: { message: 'permission denied for table profiles', code: '42501' },
      status: 401,
    }
    expect(await store.getState().createProfile(daten)).toEqual({
      art: 'nicht-angemeldet',
      rohtext: 'permission denied for table profiles',
    })

    // Derselbe Fehler, derselbe Code, andere Antwort: mit Sitzung 403. Die
    // naechste Handlung ist "spaeter noch einmal" - und die Eingabe war in
    // Ordnung. Das Fehlerobjekt allein trennt die beiden NICHT.
    anlegeAntwort = {
      data: null,
      error: { message: 'permission denied for table profiles', code: '42501' },
      status: 403,
    }
    expect(await store.getState().createProfile(daten)).toEqual({
      art: 'verweigert',
      rohtext: 'permission denied for table profiles',
    })
  })

  it('Erfolg: null - und das Profil wird danach nachgeladen', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })
    profilAntwort = { data: PROFIL, error: null }
    anlegeAntwort = { data: null, error: null, status: 201 }

    expect(await store.getState().createProfile({
      display_name: 'Sia',
      running_level: null,
      weekly_goal_km: null,
    })).toBeNull()

    // Ohne das Nachladen bliebe der Speicher auf "kein Profil" stehen, und
    // der Waechter schickte sofort wieder in die Einrichtung.
    expect(abgefragt).toEqual(['profiles.upsert', 'profiles.maybeSingle'])
    expect(store.getState().profile).toEqual(PROFIL)
  })

  it('leeres Code-Feld mit Status 0 ist nicht-erreichbar - die Netzfehler-Form', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })

    // So und nicht anders liefert postgrest-js einen Netzfehler: Feld `code`
    // vorhanden, Inhalt leer, `status: 0` daneben (dist/index.cjs,
    // `PostgrestBuilder.then`, der `res.catch`-Zweig). Er WIRFT nicht -
    // deshalb steht um den Aufruf kein try/catch.
    anlegeAntwort = {
      data: null,
      error: { message: 'TypeError: Failed to fetch', code: '' },
      status: 0,
    }

    expect(await store.getState().createProfile({
      display_name: 'Sia',
      running_level: null,
      weekly_goal_km: null,
    })).toEqual({ art: 'nicht-erreichbar', rohtext: 'TypeError: Failed to fetch' })
  })
})

/**
 * Die dritte Naht, und die laengste: `setAvatar` geht durch `dateiMitZeile`
 * (`lib/dateiAblegen.ts`) und damit durch ZWEI Fachgebiete nacheinander -
 * erst Storage, dann PostgREST.
 *
 * Deshalb laeuft hier der ECHTE `dateiMitZeile`, und nachgebaut ist nur, was
 * darunter liegt (`storage.from(...).upload/remove` und
 * `from('profiles').update(...).eq(...)`). Ein gemocktes `dateiAblegen`
 * bewiese, dass ein Nachbau ein Objekt durchreicht - nicht, dass die Naht es
 * tut. Genau diese Naht hat bis zum 08.09.2026 jedes Fehlerobjekt zu Text
 * geflacht; `zu-gross` konnte nie entstehen
 * (docs/authhindernis-entwurf.md, "Nachgesehen vor 4c").
 *
 * Die zwei mittleren Faelle sind ein Paar: Sie belegen, dass die PHASE das
 * Fachgebiet waehlt. Wer beide durch `ablageHindernis` schickt, bekommt beim
 * `42501` ein `unbekannt`; wer beide durch `profilHindernis` schickt, beim
 * `EntityTooLarge` auch. Nur die Aufteilung macht beide gruen.
 */
describe('Auth-Speicher, Profilbild: Hindernis statt Rohtext', () => {
  const BILD = () => new File(['x'], 'bild.png', { type: 'image/png' })

  it('ohne Nutzer: nicht-angemeldet, und es wird gar nicht erst gesendet', async () => {
    const store = await frisch()

    // Kein `setState` - niemand ist angemeldet. Den Satz baut der Waechter
    // selbst; ohne Anfrage gibt es keine Antwort, die ein Modul lesen
    // koennte. Zugleich die Voraussetzung, unter der `ablageHindernis`
    // `AccessDenied` als `verweigert` lesen darf (Kopf von `hindernis.ts`).
    expect(await store.getState().setAvatar(BILD())).toEqual({
      art: 'nicht-angemeldet',
      rohtext: null,
    })

    expect(ablageAufrufe).toEqual([])
    expect(abgefragt).toEqual([])
  })

  it('Phase 1, Hochladen scheitert: der Storage-Fehler wird zu zu-gross', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })

    // Die Form von storage-js: HTTP 400 fuer alles, der eigentliche Status
    // als String in `statusCode`, der Code in `code` (Kopf von
    // `ablageHindernis`). Genau diese drei Felder verliert ein Text.
    hochladeAntwort = {
      data: null,
      error: {
        name: 'StorageApiError',
        message: 'The object exceeded the maximum allowed size',
        status: 400,
        statusCode: '413',
        code: 'EntityTooLarge',
      },
    }

    expect(await store.getState().setAvatar(BILD())).toEqual({
      art: 'zu-gross',
      rohtext: 'The object exceeded the maximum allowed size',
    })

    // Kein Zeilenschreiben: Es liegt nichts, worauf die Zeile zeigen koennte.
    expect(ablageAufrufe).toEqual(['avatars.upload'])
    expect(abgefragt).toEqual([])
  })

  it('Phase 2, Zeile scheitert: der PostgREST-Fehler wird zu verweigert', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })

    zeilenAntwort = {
      data: null,
      error: { message: 'permission denied for table profiles', code: '42501' },
      status: 403,
    }

    // `42501` ist ein SQLSTATE. `ablageHindernis` kennt ihn nicht und gaebe
    // `unbekannt` - dass hier `verweigert` steht, ist der Beweis, dass die
    // zweite Phase durch `profilHindernis` geht.
    expect(await store.getState().setAvatar(BILD())).toEqual({
      art: 'verweigert',
      rohtext: 'permission denied for table profiles',
    })

    // Und die Datei wird zurueckgerollt - das tut der echte `dateiMitZeile`.
    expect(ablageAufrufe).toEqual(['avatars.upload', 'avatars.remove'])
  })

  /**
   * B1 der Durchsicht vom 08.09.2026, die Ebene ueber dem Modul.
   *
   * Die Zeile antwortet mit einem leeren Fehlerobjekt - der Gestalt, die
   * postgrest-js bei leerem Antwortkoerper baut. `dateiMitZeile` erkennt den
   * Fehlschlag an der Existenz und rollt die neue Datei zurueck; `setAvatar`
   * fragte danach `ergebnis.fehler`, und der ist der LEERE Text. Falsy -
   * also kein Hindernis, `fetchProfile`, und das alte Profilbild geloescht,
   * obwohl `avatar_url` weiter darauf zeigt.
   */
  it('Phase 2, leeres Fehlerobjekt: ein Hindernis - und das alte Bild bleibt', async () => {
    const store = await frisch()
    // Mit altem Bild: Ohne eines gaebe es nichts zu verlieren, und genau
    // dessen Verlust ist der Schaden.
    store.setState({
      user: NUTZER as never,
      profile: { ...PROFIL, avatar_url: 'nutzer-1/alt.jpg' } as never,
    })

    // Kein Code, kein Text - mit Code waere der zusammengesetzte Text
    // " (…)" und damit wahr, und der Fall verschwaende sich selbst.
    zeilenAntwort = { data: null, error: { message: '' }, status: 502 }

    // `unbekannt` mit `rohtext: null` ist gemessen, nicht geraten:
    // `hindernis.test.ts:220-222`, "die Existenz entscheidet: leer ist ein
    // Hindernis, nicht Erfolg". Ohne Code und ohne Text hat
    // `profilHindernis` nichts zu erkennen - und meldet trotzdem ein
    // Hindernis, weil das Objekt da ist.
    expect(await store.getState().setAvatar(BILD())).toEqual({
      art: 'unbekannt',
      rohtext: null,
    })

    // Der eigentliche Schaden: Die Zeile wurde nie geschrieben, `avatar_url`
    // zeigt weiter auf das alte Bild. Wer es loescht, laesst das Profil auf
    // eine geloeschte Datei zeigen - und `verwaisteDateien()` bleibt leer,
    // weil niemand es als Fehlschlag gesehen hat.
    expect(entfernteDateien).not.toContain('nutzer-1/alt.jpg')
  })

  it('Erfolg: null - und das Profil wird danach nachgeladen', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })
    profilAntwort = { data: PROFIL, error: null }

    expect(await store.getState().setAvatar(BILD())).toBeNull()

    // Ohne das Nachladen zeigte die Seite weiter das alte Bild.
    expect(abgefragt).toEqual(['profiles.update', 'profiles.maybeSingle'])
    expect(store.getState().profile).toEqual(PROFIL)
  })
})
