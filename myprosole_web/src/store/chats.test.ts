import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Der leere Text als Erfolg - bei der Sprachnachricht.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Bis zum 09.09.2026 hatte dieser Speicher KEINEN Test. Kein Testlauf hat
 * `store/chats.ts` je geladen; die einzige Erwaehnung stand in einem
 * Kommentar (`lib/kontoZustand.test.ts:19`).
 *
 * Die Naht zwischen `dateiMitZeile` und seinen Aufrufern wurde dreimal
 * gemessen - dreimal an `setAvatar` (`store/auth.test.ts`, Block
 * "Profilbild"). Die drei ANDEREN Aufrufer (`chats.ts`,
 * `communityProfile.ts`, `feed.ts`) waren an keiner Stelle gemessen, und
 * genau dort stand die Lueckenklasse aus B1 noch offen:
 *
 *     if (fehler) return 'Aufnahme konnte nicht gesendet werden: ' + fehler
 *
 * `Ergebnis.fehler` ist TEXT. Seit R1 (`2f6b75f`) entscheidet
 * `dateiMitZeile` an der EXISTENZ des Fehlerobjekts und rollt bei
 * `{ message: '', code: undefined }` die hochgeladene Datei zurueck - aber
 * `fehler` ist dann der LEERE Text, und der ist falsy. `sendVoice` meldete
 * "gesendet", waehrend die Aufnahme weder als Zeile noch als Datei
 * existierte. Genau diese Gestalt baut postgrest-js bei leerem
 * Antwortkoerper (Kopf von `Ergebnis.roh` in `lib/dateiAblegen.ts`).
 *
 * Der echte `dateiMitZeile` laeuft hier
 * -------------------------------------
 * Nachgebaut ist nur, was darunter liegt: `../lib/supabase` mit
 * `storage.from(...).upload/remove` und `from(...).insert(...)`. Ein
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
 * Mit `status`, obwohl `sendVoice` heute nur `error` weiterreicht: So
 * antwortet PostgREST wirklich, und ein Nachbau, der freundlicher ist als
 * die Wirklichkeit, misst die Naht nicht. Uebernommen aus
 * `store/auth.test.ts:41-48`.
 */
type Antwort = {
  data: unknown
  error: { message: string; code?: string } | null
  status: number
}

let zeilenAntwort: Antwort = { data: null, error: null, status: 201 }
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
    from: vi.fn((tabelle: string) => ({
      // `sendVoice` wartet direkt auf `insert(...)`, ohne `select` oder
      // `single` dahinter - deshalb gibt es hier die Antwort selbst zurueck
      // und keine Kette.
      insert: vi.fn(() => {
        abgefragt.push(`${tabelle}.insert`)
        return Promise.resolve(zeilenAntwort)
      }),
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
 * `store/chats.ts` laedt ueber `lib/eigeneKennung.ts` den Auth-Speicher, und
 * der importiert `@capacitor/core` auf Modulebene. Die Testumgebung ist
 * `node`; ohne diesen Nachbau entschiede die Umgebung mit. Dasselbe Vorgehen
 * wie in `store/auth.test.ts:235-237`.
 */
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}))

const NUTZER = { id: 'nutzer-1', email: 'a@b.c' }
const CHAT = 'chat-1'
const AUFNAHME = () => new File(['x'], 'ton.webm', { type: 'audio/webm' })

/**
 * Beide Speicher aus DERSELBEN frischen Modulregistrierung: `eigeneKennung()`
 * liest `useAuth.getState()`, und nach `resetModules` gaebe ein Import von
 * aussen eine ANDERE Instanz - der Nutzer waere dort gesetzt und hier nicht.
 */
async function frisch() {
  vi.resetModules()
  const { useAuth } = await import('./auth')
  const { useChats } = await import('./chats')
  useAuth.setState({ user: NUTZER as never })
  return useChats
}

beforeEach(() => {
  zeilenAntwort = { data: null, error: null, status: 201 }
  hochladeAntwort = { data: { path: 'p' }, error: null }
  entferneAntwort = { data: [], error: null }
  abgefragt.length = 0
  ablageAufrufe.length = 0
  hochgeladeneDateien.length = 0
  entfernteDateien.length = 0
})

describe('Chat-Speicher, Sprachnachricht: die Existenz entscheidet', () => {
  it('leeres Fehlerobjekt: ein Fehlschlag - nicht "gesendet"', async () => {
    const store = await frisch()

    // Kein Code, kein Text - mit Code waere der zusammengesetzte Text
    // " (…)" und damit wahr, und der Fall verschwaende sich selbst.
    zeilenAntwort = { data: null, error: { message: '' }, status: 502 }

    const meldung = await store.getState().sendVoice(CHAT, AUFNAHME())

    // Der Kern: irgendetwas, nicht `null`. WELCHER Satz, sagt diese Datei
    // ausdruecklich nicht (siehe Kopf).
    expect(meldung).not.toBeNull()
    // Und die Aufnahme liegt nicht verwaist im Behaelter: `dateiMitZeile`
    // rollt sie zurueck - genau die, die eben hochgeladen wurde.
    expect(entfernteDateien).toEqual(hochgeladeneDateien)
    expect(ablageAufrufe).toEqual(['chat-audio.upload', 'chat-audio.remove'])
  })

  it('echter Fehler der Zeile: ein Fehlschlag, und die Datei wird zurueckgerollt', async () => {
    const store = await frisch()

    zeilenAntwort = {
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
      status: 409,
    }

    const meldung = await store.getState().sendVoice(CHAT, AUFNAHME())

    // Dieser Fall ist heute schon gruen. Er steht hier, damit das erhaltene
    // Verhalten festgeschrieben ist: Die Aenderung am Tor darf den
    // gewoehnlichen Fehler nicht mitnehmen.
    expect(meldung).not.toBeNull()
    expect(entfernteDateien).toEqual(hochgeladeneDateien)
  })

  it('Erfolg: null - und nichts wird weggeraeumt', async () => {
    const store = await frisch()

    expect(await store.getState().sendVoice(CHAT, AUFNAHME())).toBeNull()

    expect(abgefragt).toEqual(['community_chat_messages.insert'])
    expect(ablageAufrufe).toEqual(['chat-audio.upload'])
    expect(entfernteDateien).toEqual([])
  })
})
