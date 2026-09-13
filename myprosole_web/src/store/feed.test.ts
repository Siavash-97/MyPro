import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Der leere Text als Erfolg - beim Bild am Beitrag.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Bis zum 09.09.2026 hatte dieser Speicher KEINEN Test. Kein Testlauf hat
 * `store/feed.ts` je geladen.
 *
 * Die Naht zwischen `dateiMitZeile` und seinen Aufrufern wurde dreimal
 * gemessen - dreimal an `setAvatar` (`store/auth.test.ts`, Block
 * "Profilbild"). Die drei ANDEREN Aufrufer waren an keiner Stelle gemessen,
 * und hier stand die Lueckenklasse aus B1 noch offen:
 *
 *     if (fehler) return 'Bild konnte nicht angehängt werden: ' + fehler
 *
 * `Ergebnis.fehler` ist TEXT. Seit R1 (`2f6b75f`) entscheidet
 * `dateiMitZeile` an der EXISTENZ des Fehlerobjekts und rollt bei
 * `{ message: '', code: undefined }` die hochgeladene Datei zurueck - aber
 * `fehler` ist dann der LEERE Text, und der ist falsy. `bilderAnhaengen`
 * zaehlte die Position weiter und lief zum naechsten Bild, als waere das
 * erste angehaengt; am Ende gab `createPost` `null` zurueck - Erfolg. Genau
 * diese Gestalt baut postgrest-js bei leerem Antwortkoerper (Kopf von
 * `Ergebnis.roh` in `lib/dateiAblegen.ts`).
 *
 * Gemessen wird durch `createPost`
 * --------------------------------
 * `bilderAnhaengen` ist nicht ausgefuehrt (`feed.ts:108`). Der oeffentliche
 * Weg dorthin ist `createPost`; das kostet die Nachbauten fuer
 * `community_posts` und `verborgene_beitraege` mit, misst dafuer aber den
 * Weg, den die App wirklich nimmt.
 *
 * Der echte `dateiMitZeile` laeuft hier
 * -------------------------------------
 * Nachgebaut ist nur, was darunter liegt: `../lib/supabase` mit
 * `storage.from(...).upload/remove` und den Ketten der drei Tabellen. Ein
 * gemocktes `dateiAblegen` bewiese, dass ein Nachbau einen Wert
 * durchreicht - nicht, dass die Naht es tut. Dasselbe Vorgehen und derselbe
 * Grund wie in `store/auth.test.ts` (Block "Profilbild").
 *
 * Die Grenze dieser Datei, ausdruecklich
 * --------------------------------------
 * Sie sagt nichts ueber den WORTLAUT der Meldung. Heute ist das ein
 * Rohtext-Vorsatz plus der Text der Bibliothek; ob daraus ein Hindernis
 * wird, ist eine andere Runde (Vertrag, Commit 5). Geprueft wird nur, WAS
 * der Speicher zurueckgibt (`null` oder nicht) und was er im Behaelter
 * hinterlaesst.
 */

/**
 * Mit `status`, obwohl `bilderAnhaengen` heute nur `error` weiterreicht: So
 * antwortet PostgREST wirklich, und ein Nachbau, der freundlicher ist als
 * die Wirklichkeit, misst die Naht nicht. Uebernommen aus
 * `store/auth.test.ts:41-48`.
 */
type Antwort = {
  data: unknown
  error: { message: string; code?: string } | null
  status: number
}

/** Die Antwort auf `community_post_images.insert` - die Zeile zum Bild. */
let zeilenAntwort: Antwort = { data: null, error: null, status: 201 }
/** Die Antwort auf `community_posts.insert(...).select().single()`. */
let beitragAntwort: Antwort = { data: { id: 'post-1' }, error: null, status: 201 }
/** Die Antwort auf das Nachladen in `fetchPosts`. */
let ladeAntwort: Antwort = { data: [], error: null, status: 200 }
let hochladeAntwort: { data: unknown; error: unknown } = { data: { path: 'p' }, error: null }
let entferneAntwort: { data: unknown; error: unknown } = { data: [], error: null }

/**
 * Eine Zeile aus der Antwort von `createSignedUrls` - so, wie die Bibliothek
 * sie wirklich baut.
 *
 * Nachgesehen, nicht erinnert: `@supabase/storage-js` 2.112.3,
 * `node_modules/@supabase/storage-js/dist/index.d.mts:1276-1290` - vier
 * Felder je Zeile, darunter ein EIGENES `error` je Pfad, und daneben ein
 * `error` fuer den ganzen Aufruf. Ein Nachbau, der nur `{ path, signedUrl }`
 * kennt, waere freundlicher als die Wirklichkeit: Genau das Zeilen-`error`
 * ist der Fall, an dem ein einzelner Pfad scheitert, ohne dass der Aufruf
 * scheitert (Tag `nachbau-luecke`).
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

/**
 * Was der Nachbau auf `createSignedUrls` antwortet. Als Funktion, weil die
 * Antwort von den angefragten Pfaden abhaengt - ein fester Wert koennte die
 * Zuordnung Pfad -> Adresse gar nicht messen.
 */
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

/**
 * `community_posts` wird auf ZWEI Wegen benutzt:
 * `insert(...).select().single()` beim Anlegen und
 * `select(...).is(...).order(...).limit(...)` beim Nachladen. Ein Nachbau,
 * der nur einen davon kennt, liesse `createPost` an der Stelle sterben, an
 * der es gerade nichts zu messen gibt.
 */
function beitragTabelle() {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => {
          abgefragt.push('community_posts.insert')
          return Promise.resolve(beitragAntwort)
        }),
      })),
    })),
    select: vi.fn(() => {
      const k: Record<string, unknown> = {}
      k.is = vi.fn(() => k)
      k.eq = vi.fn(() => k)
      k.order = vi.fn(() => k)
      k.limit = vi.fn(() => {
        abgefragt.push('community_posts.select')
        return Promise.resolve(ladeAntwort)
      })
      return k
    }),
  }
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    // Eine unbekannte Tabelle WIRFT, statt `undefined` zurueckzugeben: Sonst
    // stuerbe ein Weg, den dieser Nachbau nicht kennt, an einem
    // TypeError irgendwo weiter unten - und der Test pruefte den Nachbau
    // statt den Quelltext.
    from: vi.fn((tabelle: string) => {
      if (tabelle === 'community_posts') return beitragTabelle()
      if (tabelle === 'community_post_images') {
        // `bilderAnhaengen` wartet direkt auf `insert(...)`, ohne `select`
        // oder `single` dahinter.
        return {
          insert: vi.fn(() => {
            abgefragt.push('community_post_images.insert')
            return Promise.resolve(zeilenAntwort)
          }),
        }
      }
      if (tabelle === 'verborgene_beitraege') {
        // `verborgeneLaden` wartet direkt auf `.eq(...)`.
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => {
              abgefragt.push('verborgene_beitraege.select')
              return Promise.resolve({ data: [], error: null })
            }),
          })),
        }
      }
      throw new Error(`Nachbau kennt die Tabelle nicht: ${tabelle}`)
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
 * `store/feed.ts` laedt ueber `lib/eigeneKennung.ts` den Auth-Speicher, und
 * der importiert `@capacitor/core` auf Modulebene. Die Testumgebung ist
 * `node`; ohne diesen Nachbau entschiede die Umgebung mit. Dasselbe Vorgehen
 * wie in `store/auth.test.ts:235-237`.
 */
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}))

/**
 * Die Entwicklerkonsole als Liste, nicht als Konsole.
 *
 * `entwicklerWarnung` schreibt nur unter `import.meta.env.DEV` und dann nach
 * `console.warn` (`lib/entwicklerkonsole.ts:34`). Ein Test, der auf die echte
 * Konsole hoert, misst die UMGEBUNG mit - hier interessiert allein, DASS der
 * Fehlerzweig einen Grund meldet. Die Regel "kein fremder Rohtext in der
 * ausgelieferten Fassung" gehoert der Konsolen-Datei und ist dort gemessen
 * (`lib/entwicklerkonsole.test.ts`).
 *
 * `vi.hoisted`, weil `vi.mock` an den Dateianfang gezogen wird: Ohne das
 * stuende die Liste zur Zeit der Fabrik noch nicht.
 */
const { warnungen } = vi.hoisted(() => ({ warnungen: [] as string[] }))
vi.mock('../lib/entwicklerkonsole', () => ({
  entwicklerWarnung: (text: string) => {
    warnungen.push(text)
  },
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
  const { useFeed } = await import('./feed')
  useAuth.setState({ user: NUTZER as never })
  return useFeed
}

beforeEach(() => {
  zeilenAntwort = { data: null, error: null, status: 201 }
  beitragAntwort = { data: { id: 'post-1' }, error: null, status: 201 }
  ladeAntwort = { data: [], error: null, status: 200 }
  hochladeAntwort = { data: { path: 'p' }, error: null }
  entferneAntwort = { data: [], error: null }
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
  warnungen.length = 0
})

describe('Feed-Speicher, Bild anhaengen: die Existenz entscheidet', () => {
  it('leeres Fehlerobjekt: ein Fehlschlag - nicht "Beitrag steht"', async () => {
    const store = await frisch()

    // Kein Code, kein Text - mit Code waere der zusammengesetzte Text
    // " (…)" und damit wahr, und der Fall verschwaende sich selbst.
    zeilenAntwort = { data: null, error: { message: '' }, status: 502 }

    const meldung = await store.getState().createPost('hallo', [BILD()])

    // Der Kern: irgendetwas, nicht `null`. WELCHER Satz, sagt diese Datei
    // ausdruecklich nicht (siehe Kopf).
    expect(meldung).not.toBeNull()
    // Und das Bild liegt nicht verwaist im Behaelter: `dateiMitZeile` rollt
    // genau das zurueck, was eben hochgeladen wurde.
    expect(entfernteDateien).toEqual(hochgeladeneDateien)
    expect(ablageAufrufe).toEqual(['community.upload', 'community.remove'])
  })

  it('echter Fehler der Zeile: ein Fehlschlag, und das Bild wird zurueckgerollt', async () => {
    const store = await frisch()

    zeilenAntwort = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      status: 409,
    }

    const meldung = await store.getState().createPost('hallo', [BILD()])

    // Dieser Fall ist heute schon gruen. Er steht hier, damit das erhaltene
    // Verhalten festgeschrieben ist: Die Aenderung am Tor darf den
    // gewoehnlichen Fehler nicht mitnehmen.
    expect(meldung).not.toBeNull()
    expect(entfernteDateien).toEqual(hochgeladeneDateien)
  })

  it('Erfolg: null - und nichts wird weggeraeumt', async () => {
    const store = await frisch()

    expect(await store.getState().createPost('hallo', [BILD()])).toBeNull()

    expect(abgefragt).toEqual([
      'community_posts.insert',
      'community_post_images.insert',
      'verborgene_beitraege.select',
      'community_posts.select',
    ])
    expect(ablageAufrufe).toEqual(['community.upload'])
    expect(entfernteDateien).toEqual([])
  })
})

/**
 * Eine Beitragszeile, wie PostgREST sie liefert - mit `community_post_images`,
 * aber ohne `url`: Die Spalte gibt es in der Tabelle nicht, die Adresse
 * entsteht erst im Speicher.
 */
function beitragMitBildern(pfade: string[]) {
  return {
    id: 'post-1',
    user_id: 'nutzer-1',
    body: 'hallo',
    image_path: null,
    group_id: null,
    created_at: '2026-09-12T20:00:00Z',
    profiles: { display_name: 'A' },
    community_post_likes: [],
    community_post_awards: [],
    community_post_comments: [],
    community_post_images: pfade.map((pfad, i) => ({
      id: `bild-${i + 1}`,
      post_id: 'post-1',
      path: pfad,
      position: i,
    })),
  }
}

describe('Feed-Speicher, Bilder lesen: signierte Adressen statt oeffentlicher', () => {
  it('fetchPosts haengt je Bild die signierte Adresse an', async () => {
    const store = await frisch()
    ladeAntwort = {
      data: [beitragMitBildern(['nutzer-1/a.jpg', 'nutzer-1/b.jpg'])],
      error: null,
      status: 200,
    }

    await store.getState().fetchPosts()

    const bilder = store.getState().posts[0].community_post_images
    expect(bilder.map((b) => b.url)).toEqual([
      signaturFuer('nutzer-1/a.jpg'),
      signaturFuer('nutzer-1/b.jpg'),
    ])
    // EIN Aufruf fuer die ganze Liste, nicht einer je Bild - und mit der
    // Gueltigkeit aus dem Paket (Weg A, eine Stunde wie chat-audio).
    expect(signaturAufrufe).toEqual([['nutzer-1/a.jpg', 'nutzer-1/b.jpg']])
    expect(ablageAufrufe).toEqual(['community.createSignedUrls(3600)'])
  })

  it('ein Pfad, den Storage verweigert, ergibt url null und keinen Wurf', async () => {
    const store = await frisch()
    ladeAntwort = {
      data: [beitragMitBildern(['nutzer-1/a.jpg', 'fremd/b.jpg'])],
      error: null,
      status: 200,
    }
    // Der Wortlaut, mit dem der Dienst eine Signatur verweigert - Recherche
    // vom 12.09.2026, Frage 1 (getSignedURLs.ts). Der AUFRUF gelingt dabei,
    // nur die eine Zeile traegt einen Fehler.
    signieren = (pfade) => ({
      data: pfade.map((p) => ({
        error: p === 'fremd/b.jpg'
          ? 'Either the object does not exist or you do not have access to it'
          : null,
        path: p,
        signedURL: p === 'fremd/b.jpg' ? null : `/object/sign/community/${p}`,
        signedUrl: p === 'fremd/b.jpg' ? null : signaturFuer(p),
      })),
      error: null,
    })

    await store.getState().fetchPosts()

    const bilder = store.getState().posts[0].community_post_images
    expect(bilder.map((b) => b.url)).toEqual([signaturFuer('nutzer-1/a.jpg'), null])
    // Kein Wurf: Der Feed steht, und der Fehlerkanal des Speichers bleibt leer -
    // ein verweigertes Bild ist kein gescheitertes Laden.
    expect(store.getState().fehler).toBeNull()
    expect(store.getState().loading).toBe(false)
  })

  it('leere Pfadliste ruft Storage nicht auf', async () => {
    const store = await frisch()
    ladeAntwort = { data: [beitragMitBildern([])], error: null, status: 200 }

    await store.getState().fetchPosts()

    expect(store.getState().posts[0].community_post_images).toEqual([])
    // Kein Aufruf mit leerer Liste: Der Dienst antwortete darauf mit einer
    // leeren Menge, und ein Rundgang ueber das Netz fuer nichts ist keiner.
    expect(signaturAufrufe).toEqual([])
    expect(ablageAufrufe).toEqual([])
  })

  it('bildNachsignieren ersetzt die Adresse genau eines Bildes im Speicher', async () => {
    const useFeed = await frisch()
    // Aus DERSELBEN Registrierung wie `frisch()` - nach `resetModules` gaebe
    // ein Import von aussen eine andere Instanz, und die Funktion schriebe in
    // einen anderen Speicher als den gemessenen.
    const { bildNachsignieren } = await import('./feed')
    ladeAntwort = {
      data: [beitragMitBildern(['nutzer-1/a.jpg', 'nutzer-1/b.jpg'])],
      error: null,
      status: 200,
    }
    await useFeed.getState().fetchPosts()

    signieren = (pfade) => ({
      data: pfade.map((p) => ({
        error: null,
        path: p,
        signedURL: `/object/sign/community/${p}`,
        signedUrl: 'https://beispiel.test/frisch/' + p,
      })),
      error: null,
    })

    await bildNachsignieren('nutzer-1/b.jpg')

    const bilder = useFeed.getState().posts[0].community_post_images
    expect(bilder.map((b) => b.url)).toEqual([
      signaturFuer('nutzer-1/a.jpg'),
      'https://beispiel.test/frisch/nutzer-1/b.jpg',
    ])
    // Nur der eine Pfad wird nachsigniert, nicht die ganze Liste.
    expect(signaturAufrufe[1]).toEqual(['nutzer-1/b.jpg'])
  })

  /**
   * Befund 7 der Pruefung vom 13.09.2026: Der Fehlerzweig `if (error || !data)`
   * trug bis hierher keinen Ton. Ein abgelaufenes Token, eine falsche Rolle,
   * ein Behaelter, den es nicht gibt - alles endete in einem Feed, in dem
   * schlicht keine Bilder erscheinen, ohne dass irgendwo stuende, warum.
   * Sichtbar heisst hier: in der Entwicklungsfassung, ueber
   * `entwicklerWarnung`. Die ausgelieferte Fassung schweigt weiterhin.
   */
  it('Totalausfall des Signierens: alle Adressen null - und eine Warnung mit dem Grund', async () => {
    const store = await frisch()
    ladeAntwort = {
      data: [beitragMitBildern(['nutzer-1/a.jpg', 'nutzer-1/b.jpg'])],
      error: null,
      status: 200,
    }
    // Der AUFRUF scheitert, nicht eine Zeile: `data` ist null, `error` gesetzt
    // (`@supabase/storage-js` 2.112.3, dist/index.d.mts:1276-1290).
    signieren = () => ({ data: null, error: { message: 'jwt expired' } })

    await store.getState().fetchPosts()

    const bilder = store.getState().posts[0].community_post_images
    expect(bilder.map((b) => b.url)).toEqual([null, null])
    // Der Feed steht trotzdem: Kein Bild ist kein gescheitertes Laden.
    expect(store.getState().fehler).toBeNull()
    expect(warnungen).toHaveLength(1)
    expect(warnungen[0]).toContain('jwt expired')
    expect(warnungen[0]).toMatch(/signier/i)
  })

  /**
   * Befund 13 der Pruefung vom 13.09.2026: Derselbe Pfad kann zweimal in
   * einer Liste stehen - zwei Beitraege mit demselben Bild, oder ein Beitrag,
   * dessen Zeilen sich ueberschneiden. Der Dienst bekam ihn dann doppelt,
   * antwortete doppelt, und die zweite Zeile ueberschrieb die erste mit
   * demselben Wert. Ein Pfad, einmal gefragt.
   */
  it('derselbe Pfad zweimal: einmal geschickt, beide Bilder tragen die Adresse', async () => {
    const store = await frisch()
    ladeAntwort = {
      data: [beitragMitBildern(['nutzer-1/a.jpg', 'nutzer-1/a.jpg', 'nutzer-1/b.jpg'])],
      error: null,
      status: 200,
    }

    await store.getState().fetchPosts()

    expect(signaturAufrufe).toEqual([['nutzer-1/a.jpg', 'nutzer-1/b.jpg']])
    const bilder = store.getState().posts[0].community_post_images
    expect(bilder.map((b) => b.url)).toEqual([
      signaturFuer('nutzer-1/a.jpg'),
      signaturFuer('nutzer-1/a.jpg'),
      signaturFuer('nutzer-1/b.jpg'),
    ])
  })
})
