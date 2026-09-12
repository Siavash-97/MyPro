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

const abgefragt: string[] = []
const ablageAufrufe: string[] = []
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
  abgefragt.length = 0
  ablageAufrufe.length = 0
  hochgeladeneDateien.length = 0
  entfernteDateien.length = 0
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
