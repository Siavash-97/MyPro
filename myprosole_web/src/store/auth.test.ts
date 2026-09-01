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

let profilAntwort: Antwort = { data: null, error: null }
const abgefragt: string[] = []

function kette(tabelle: string) {
  const k: Record<string, unknown> = {}
  k.select = vi.fn(() => k)
  k.eq = vi.fn(() => k)
  k.maybeSingle = vi.fn(() => {
    abgefragt.push(`${tabelle}.maybeSingle`)
    return Promise.resolve(profilAntwort)
  })
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
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
  },
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
  abgefragt.length = 0
  vi.stubGlobal('localStorage', speicherErsatz())
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

  it('legt den Ladefehler ab, statt ihn zu verschlucken', async () => {
    const store = await frisch()
    store.setState({ user: NUTZER as never })
    expect(store.getState().profilLadefehler).toBeNull()

    profilAntwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchProfile()
    expect(store.getState().profilLadefehler).toBe('Failed to fetch')

    profilAntwort = { data: PROFIL, error: null }
    await store.getState().fetchProfile()
    expect(store.getState().profilLadefehler).toBeNull()
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
