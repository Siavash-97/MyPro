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
    })),
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
  abgefragt.length = 0
  ablageAufrufe.length = 0
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

    expect(store.getState().fotos).toEqual([FOTO])
    expect(abgefragt).toEqual(['community_profile_photos.insert.select.single'])
    expect(ablageAufrufe).toEqual(['community.upload'])
    expect(entfernteDateien).toEqual([])
  })
})
