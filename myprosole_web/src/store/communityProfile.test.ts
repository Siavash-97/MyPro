import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Der leere Text als Erfolg - beim Profilfoto der Community.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Bis zum 09.09.2026 hatte dieser Speicher KEINEN Test. Kein Testlauf hat
 * `store/communityProfile.ts` je geladen.
 *
 * Die Naht zwischen `dateiMitZeile` und seinen Aufrufern wurde dreimal
 * gemessen - dreimal an `setAvatar` (`store/auth.test.ts`, Block
 * "Profilbild"). Die drei ANDEREN Aufrufer waren an keiner Stelle gemessen,
 * und hier stand die Lueckenklasse aus B1 noch offen:
 *
 *     if (fehler) return fehler
 *
 * `Ergebnis.fehler` ist TEXT. Seit R1 (`2f6b75f`) entscheidet
 * `dateiMitZeile` an der EXISTENZ des Fehlerobjekts und rollt bei
 * `{ message: '', code: undefined }` die hochgeladene Datei zurueck - aber
 * `fehler` ist dann der LEERE Text, und der ist falsy. Genau diese Gestalt
 * baut postgrest-js bei leerem Antwortkoerper (Kopf von `Ergebnis.roh` in
 * `lib/dateiAblegen.ts`).
 *
 * Der Schaden ist hier groesser als bei den beiden anderen Aufrufern: Nach
 * dem Tor steht
 *
 *     set({ fotos: [...belegt, daten as ProfilFoto].sort((a, b) => a.position - b.position) })
 *
 * und `daten` ist im Fehlschlag `null`. Das `as ProfilFoto` verschweigt es
 * dem Typpruefer; in der Liste liegt danach ein `null`, und der naechste
 * Aufruf faellt an `a.position` des naechsten Sortierdurchgangs - oder die
 * Anzeige an derselben Stelle.
 *
 * Der echte `dateiMitZeile` laeuft hier
 * -------------------------------------
 * Nachgebaut ist nur, was darunter liegt: `../lib/supabase` mit
 * `storage.from(...).upload/remove` und der Kette
 * `from(...).insert(...).select().single()`. Ein gemocktes `dateiAblegen`
 * bewiese, dass ein Nachbau einen Wert durchreicht - nicht, dass die Naht es
 * tut. Dasselbe Vorgehen und derselbe Grund wie in `store/auth.test.ts`
 * (Block "Profilbild").
 *
 * Die Grenze dieser Datei, ausdruecklich
 * --------------------------------------
 * Sie sagt nichts ueber den WORTLAUT der Meldung. Heute reicht der Speicher
 * den Rohtext der Bibliothek unveraendert durch; ob daraus ein Hindernis
 * wird, ist eine andere Runde (Vertrag, Commit 5). Geprueft wird nur, WAS
 * der Speicher zurueckgibt (`null` oder nicht), was in `fotos` steht und was
 * er im Behaelter hinterlaesst.
 */

/**
 * Mit `status`, obwohl `fotoHinzufuegen` heute nur `error` weiterreicht: So
 * antwortet PostgREST wirklich, und ein Nachbau, der freundlicher ist als
 * die Wirklichkeit, misst die Naht nicht. Uebernommen aus
 * `store/auth.test.ts:41-48`.
 */
type Antwort = {
  data: unknown
  error: { message: string; code?: string } | null
  status: number
}

const FOTO = { id: 'foto-1', user_id: 'nutzer-1', path: 'nutzer-1/profil-neu.jpg', position: 0 }

let zeilenAntwort: Antwort = { data: FOTO, error: null, status: 201 }
let hochladeAntwort: { data: unknown; error: unknown } = { data: { path: 'p' }, error: null }
let entferneAntwort: { data: unknown; error: unknown } = { data: [], error: null }
/** Die Antwort auf `community_profile_photos.select(...).eq(...).order(...)`. */
let fotoListe: Antwort = { data: [], error: null, status: 200 }
/** Die Antwort auf `community_profiles.select(...).eq(...).maybeSingle()`. */
let profilAntwort: Antwort = { data: null, error: null, status: 200 }
/** Die Antwort auf `rpc('community_stats')`. */
let statsAntwort: { data: unknown; error: unknown } = { data: [], error: null }

/**
 * Eine Zeile aus der Antwort von `createSignedUrls` - so, wie die Bibliothek
 * sie wirklich baut.
 *
 * Nachgesehen, nicht erinnert: `@supabase/storage-js` 2.112.3,
 * `node_modules/@supabase/storage-js/dist/index.d.mts:1276-1290` - vier
 * Felder je Zeile, darunter ein EIGENES `error` je Pfad, und daneben ein
 * `error` fuer den ganzen Aufruf. Ein Nachbau, der nur `{ path, signedUrl }`
 * kennt, waere freundlicher als die Wirklichkeit (Tag `nachbau-luecke`).
 */
type SignaturZeile = {
  error: string | null
  path: string | null
  signedURL: string | null
  signedUrl: string | null
}
type SignaturAntwort =
  | { data: SignaturZeile[]; error: null }
  | { data: null; error: { message: string } }

/** Die Adresse, die der Nachbau fuer einen Pfad ausstellt. */
const signaturFuer = (pfad: string) =>
  `https://beispiel.test/storage/v1/object/sign/community/${pfad}?token=tok`

let signieren: (pfade: string[]) => SignaturAntwort = (pfade) => ({
  data: pfade.map((p) => ({
    error: null,
    path: p,
    signedURL: `/object/sign/community/${p}`,
    signedUrl: signaturFuer(p),
  })),
  error: null,
})

const abgefragt: string[] = []
const ablageAufrufe: string[] = []
/** Die Pfadlisten, mit denen `createSignedUrls` gerufen wurde - je Aufruf eine. */
const signaturAufrufe: string[][] = []
/**
 * WELCHE Datei hochgeladen und WELCHE entfernt wurde - `ablageAufrufe` sagt
 * nur DASS. Der Pfad traegt eine Zufallskennung, ist also nur zur Laufzeit
 * bekannt; ohne diese beiden Listen liesse sich "zurueckgerollt wurde genau
 * das eben Hochgeladene" nicht messen.
 */
const hochgeladeneDateien: string[] = []
const entfernteDateien: string[] = []

vi.mock('../lib/supabase', () => ({
  supabase: {
    // `fotoHinzufuegen` schreibt ueber `insert(...).select().single()` - die
    // Zeile kommt zurueck, weil `daten` in `fotos` landet. Ein Nachbau, der
    // die Antwort schon bei `insert` gibt, liefe an dieser Kette vorbei.
    from: vi.fn((tabelle: string) => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => {
            abgefragt.push(`${tabelle}.insert.select.single`)
            return Promise.resolve(zeilenAntwort)
          }),
        })),
      })),
      // `laden` liest zwei Tabellen mit zwei verschiedenen Enden derselben
      // Kette: `maybeSingle()` beim Profil, `order(...)` bei den Fotos. Ein
      // Nachbau, der nur eines kennt, liesse `laden` am anderen sterben.
      select: vi.fn(() => {
        const k: Record<string, unknown> = {}
        k.eq = vi.fn(() => k)
        k.maybeSingle = vi.fn(() => {
          abgefragt.push(`${tabelle}.select.maybeSingle`)
          return Promise.resolve(profilAntwort)
        })
        k.order = vi.fn(() => {
          abgefragt.push(`${tabelle}.select.order`)
          return Promise.resolve(fotoListe)
        })
        return k
      }),
    })),
    rpc: vi.fn((name: string) => {
      abgefragt.push(`rpc.${name}`)
      return Promise.resolve(statsAntwort)
    }),
    storage: {
      from: vi.fn((behaelter: string) => ({
        upload: vi.fn((pfad: string) => {
          ablageAufrufe.push(`${behaelter}.upload`)
          hochgeladeneDateien.push(pfad)
          return Promise.resolve(hochladeAntwort)
        }),
        remove: vi.fn((pfade: string[]) => {
          ablageAufrufe.push(`${behaelter}.remove`)
          entfernteDateien.push(...pfade)
          return Promise.resolve(entferneAntwort)
        }),
        createSignedUrls: vi.fn((pfade: string[], gueltigS: number) => {
          ablageAufrufe.push(`${behaelter}.createSignedUrls(${gueltigS})`)
          signaturAufrufe.push(pfade)
          return Promise.resolve(signieren(pfade))
        }),
      })),
    },
  },
}))

/**
 * `store/communityProfile.ts` laedt ueber `lib/eigeneKennung.ts` den
 * Auth-Speicher, und der importiert `@capacitor/core` auf Modulebene. Die
 * Testumgebung ist `node`; ohne diesen Nachbau entschiede die Umgebung mit.
 * Dasselbe Vorgehen wie in `store/auth.test.ts:235-237`.
 */
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}))

const NUTZER = { id: 'nutzer-1', email: 'a@b.c' }
const BILD = () => new File(['x'], 'bild.jpg', { type: 'image/jpeg' })

/**
 * Beide Speicher aus DERSELBEN frischen Modulregistrierung: `eigeneKennung()`
 * liest `useAuth.getState()`, und nach `resetModules` gaebe ein Import von
 * aussen eine ANDERE Instanz - der Nutzer waere dort gesetzt und hier nicht.
 */
async function frisch() {
  vi.resetModules()
  const { useAuth } = await import('./auth')
  const { useCommunityProfil } = await import('./communityProfile')
  useAuth.setState({ user: NUTZER as never })
  return useCommunityProfil
}

beforeEach(() => {
  zeilenAntwort = { data: FOTO, error: null, status: 201 }
  hochladeAntwort = { data: { path: 'p' }, error: null }
  entferneAntwort = { data: [], error: null }
  fotoListe = { data: [], error: null, status: 200 }
  profilAntwort = { data: null, error: null, status: 200 }
  statsAntwort = { data: [], error: null }
  signieren = (pfade) => ({
    data: pfade.map((p) => ({
      error: null,
      path: p,
      signedURL: `/object/sign/community/${p}`,
      signedUrl: signaturFuer(p),
    })),
    error: null,
  })
  abgefragt.length = 0
  ablageAufrufe.length = 0
  signaturAufrufe.length = 0
  hochgeladeneDateien.length = 0
  entfernteDateien.length = 0
})

describe('Community-Profil, Foto hinzufuegen: die Existenz entscheidet', () => {
  it('leeres Fehlerobjekt: ein Fehlschlag - und kein null in der Fotoliste', async () => {
    const store = await frisch()

    // Kein Code, kein Text - mit Code waere der zusammengesetzte Text
    // " (…)" und damit wahr, und der Fall verschwaende sich selbst.
    zeilenAntwort = { data: null, error: { message: '' }, status: 502 }

    const meldung = await store.getState().fotoHinzufuegen(BILD())

    // Der Kern: irgendetwas, nicht `null`. WELCHER Satz, sagt diese Datei
    // ausdruecklich nicht (siehe Kopf).
    expect(meldung).not.toBeNull()
    // Und der zweite Schaden: `daten` ist im Fehlschlag `null`, und
    // `as ProfilFoto` haette es in die Liste gelassen.
    expect(store.getState().fotos).toEqual([])
    // Die Datei liegt nicht verwaist im Behaelter: `dateiMitZeile` rollt
    // genau die zurueck, die eben hochgeladen wurde.
    expect(entfernteDateien).toEqual(hochgeladeneDateien)
    expect(ablageAufrufe).toEqual(['community.upload', 'community.remove'])
  })

  it('echter Fehler der Zeile: ein Fehlschlag, Liste unveraendert, Datei zurueckgerollt', async () => {
    const store = await frisch()

    zeilenAntwort = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      status: 409,
    }

    const meldung = await store.getState().fotoHinzufuegen(BILD())

    // Dieser Fall ist heute schon gruen. Er steht hier, damit das erhaltene
    // Verhalten festgeschrieben ist: Die Aenderung am Tor darf den
    // gewoehnlichen Fehler nicht mitnehmen.
    expect(meldung).not.toBeNull()
    expect(store.getState().fotos).toEqual([])
    expect(entfernteDateien).toEqual(hochgeladeneDateien)
  })

  it('Erfolg: null, genau ein neues Foto - und nichts wird weggeraeumt', async () => {
    const store = await frisch()

    expect(await store.getState().fotoHinzufuegen(BILD())).toBeNull()

    // Mit Adresse, seit `fotoHinzufuegen` die neue Zeile selbst signiert
    // (12.09.2026, Nachtrag zu Scheibe 1). Der Fall darunter misst genau das;
    // hier steht es mit, weil dieser Fall die ganze Liste vergleicht und ein
    // `toEqual` ohne `url` die Zeile stillschweigend durchgehen liesse.
    expect(store.getState().fotos).toEqual([{ ...FOTO, url: signaturFuer(FOTO.path) }])
    expect(abgefragt).toEqual(['community_profile_photos.insert.select.single'])
    expect(ablageAufrufe).toEqual(['community.upload', 'community.createSignedUrls(3600)'])
    expect(entfernteDateien).toEqual([])
  })

  it('fotoHinzufuegen liefert das neue Foto mit signierter Adresse', async () => {
    const store = await frisch()

    expect(await store.getState().fotoHinzufuegen(BILD())).toBeNull()

    // Ohne diese Zeile bliebe das eben hochgeladene Foto bis zum naechsten
    // `laden` ohne Adresse - ein leeres Feld dort, wo gerade ein Bild
    // gewaehlt wurde (Ruecklauf Scheibe 1, OFFEN 1).
    expect(store.getState().fotos).toEqual([{ ...FOTO, url: signaturFuer(FOTO.path) }])
    expect(signaturAufrufe).toEqual([[FOTO.path]])
    expect(ablageAufrufe).toEqual(['community.upload', 'community.createSignedUrls(3600)'])
  })

  it('Signieren scheitert: url null, das Foto steht trotzdem im Speicher', async () => {
    const store = await frisch()
    // Der ganze Aufruf scheitert - nicht nur eine Zeile. Der Upload ist da
    // durch, die Zeile geschrieben; eine fehlende Adresse darf ihn nicht
    // nachtraeglich zum Fehlschlag machen.
    signieren = () => ({ data: null, error: { message: 'Netz weg' } })

    expect(await store.getState().fotoHinzufuegen(BILD())).toBeNull()

    expect(store.getState().fotos).toEqual([{ ...FOTO, url: null }])
    // Kein Rueckrollen: Die Datei bleibt liegen, weil sie dazugehoert.
    expect(entfernteDateien).toEqual([])
  })
})

describe('Community-Profil, Fotos lesen: signierte Adressen statt oeffentlicher', () => {
  it('laden haengt je Foto die signierte Adresse an - in EINEM Aufruf', async () => {
    const store = await frisch()
    fotoListe = {
      data: [
        { id: 'f1', user_id: 'nutzer-1', path: 'nutzer-1/profil-a.jpg', position: 0 },
        { id: 'f2', user_id: 'nutzer-1', path: 'nutzer-1/profil-b.jpg', position: 1 },
      ],
      error: null,
      status: 200,
    }

    await store.getState().laden('nutzer-1')

    expect(store.getState().fotos.map((f) => f.url)).toEqual([
      signaturFuer('nutzer-1/profil-a.jpg'),
      signaturFuer('nutzer-1/profil-b.jpg'),
    ])
    expect(signaturAufrufe).toEqual([['nutzer-1/profil-a.jpg', 'nutzer-1/profil-b.jpg']])
    expect(ablageAufrufe).toEqual(['community.createSignedUrls(3600)'])
  })

  it('ein Foto, das Storage verweigert, ergibt url null und keinen Wurf', async () => {
    const store = await frisch()
    fotoListe = {
      data: [{ id: 'f1', user_id: 'nutzer-1', path: 'nutzer-1/profil-a.jpg', position: 0 }],
      error: null,
      status: 200,
    }
    // Der Wortlaut, mit dem der Dienst eine Signatur verweigert - Recherche
    // vom 12.09.2026, Frage 1 (getSignedURLs.ts).
    signieren = (pfade) => ({
      data: pfade.map((p) => ({
        error: 'Either the object does not exist or you do not have access to it',
        path: p,
        signedURL: null,
        signedUrl: null,
      })),
      error: null,
    })

    await store.getState().laden('nutzer-1')

    expect(store.getState().fotos.map((f) => f.url)).toEqual([null])
    expect(store.getState().fehler).toBeNull()
    expect(store.getState().laedt).toBe(false)
  })

  it('ohne Fotos wird Storage nicht gerufen', async () => {
    const store = await frisch()

    await store.getState().laden('nutzer-1')

    expect(store.getState().fotos).toEqual([])
    expect(signaturAufrufe).toEqual([])
    expect(ablageAufrufe).toEqual([])
  })
})

/**
 * Profilfotos bekommen denselben Erholungsweg wie Beitragsbilder.
 *
 * Befund 9 der Pruefung vom 13.09.2026: Seit Scheibe 1 laufen auch die
 * Adressen der Profilfotos nach einer Stunde ab - nur hatte der Feed einen
 * Weg zurueck (`bildNachsignieren`) und das Profil keinen. Wer ein Profil
 * laenger offen liegen liess, sah graue Kaesten bis zum Neuladen der Seite.
 *
 * Dieselbe Gestalt wie im Feed, mit Absicht: ein Pfad hinein, ein
 * Stapelaufruf ueber genau diesen einen, und bei Misserfolg bleibt die alte
 * Adresse stehen statt `null` zu werden.
 */
describe('Community-Profil, Foto nachsignieren: einer, nicht alle', () => {
  const ZWEI_FOTOS = {
    data: [
      { id: 'f1', user_id: 'nutzer-1', path: 'nutzer-1/profil-a.jpg', position: 0 },
      { id: 'f2', user_id: 'nutzer-1', path: 'nutzer-1/profil-b.jpg', position: 1 },
    ],
    error: null,
    status: 200,
  }

  it('ersetzt die Adresse genau eines Fotos im Speicher', async () => {
    const store = await frisch()
    // Aus DERSELBEN Registrierung wie `frisch()` - nach `resetModules` gaebe
    // ein Import von aussen eine andere Instanz, und die Funktion schriebe in
    // einen anderen Speicher als den gemessenen.
    const { fotoNachsignieren } = await import('./communityProfile')
    fotoListe = ZWEI_FOTOS
    await store.getState().laden('nutzer-1')

    signieren = (pfade) => ({
      data: pfade.map((p) => ({
        error: null,
        path: p,
        signedURL: `/object/sign/community/${p}`,
        signedUrl: 'https://beispiel.test/frisch/' + p,
      })),
      error: null,
    })

    await fotoNachsignieren('nutzer-1/profil-b.jpg')

    expect(store.getState().fotos.map((f) => f.url)).toEqual([
      signaturFuer('nutzer-1/profil-a.jpg'),
      'https://beispiel.test/frisch/nutzer-1/profil-b.jpg',
    ])
    // Nur der eine Pfad, nicht die ganze Liste.
    expect(signaturAufrufe[1]).toEqual(['nutzer-1/profil-b.jpg'])
  })

  it('scheitert auch das Nachsignieren, bleibt die alte Adresse stehen', async () => {
    const store = await frisch()
    const { fotoNachsignieren } = await import('./communityProfile')
    fotoListe = ZWEI_FOTOS
    await store.getState().laden('nutzer-1')

    signieren = () => ({ data: null, error: { message: 'jwt expired' } })

    await fotoNachsignieren('nutzer-1/profil-b.jpg')

    // Kein `null`: Das Foto ist schon gebrochen - aus einer abgelaufenen
    // Adresse eine fehlende zu machen, aendert nichts zum Besseren und macht
    // aus einem voruebergehenden Fehler einen dauerhaften Zustand.
    expect(store.getState().fotos.map((f) => f.url)).toEqual([
      signaturFuer('nutzer-1/profil-a.jpg'),
      signaturFuer('nutzer-1/profil-b.jpg'),
    ])
  })
})
