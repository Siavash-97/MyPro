import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Ein fehlgeschlagenes Laden ist kein "gibt es nicht".
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Vierter Fall derselben Klasse in drei Tagen. Vorher:
 * `communityProfile.ts` (24.08.), `anamnese.ts` (24.08.), `auth.ts` (25.08.).
 * Jedes Mal `const { data } = await supabase...` ohne `error`, und `??`
 * machte daraus eine Aussage ueber den Nutzer.
 *
 * Hier sind es zwei Stellen mit zwei verschiedenen Folgen:
 *
 * **`fetchRun`** schrieb `selectedRun: null`. `RunDetail.tsx:84` und
 * `RunAnalysis.tsx:48` pruefen `if (loading || !run)` und zeigen dann den
 * Ladekreis. Nach einem Fehlschlag ist `loading` false und `run` null -
 * **Dauerspinner, ohne Meldung, ohne Ausweg ausser Zurueck.**
 *
 * **`fetchRecentRuns`** schrieb `recentRuns: []`. `History.tsx:246` zeigt
 * dann "Keine Aktivitaeten - Starte deinen ersten Lauf" - jemandem, der
 * seit Monaten laeuft. Das ist schlimmer als der Spinner: Der Spinner sagt
 * "warte", das hier sagt **"du hast nichts"**, ueberzeugt und falsch.
 *
 * Gefunden vom Agenten `pruefung` am 25.08.2026 (fetchRun). `fetchRecentRuns`
 * kam beim Beheben dazu - es stand direkt darueber und war in seiner
 * `.single()`-Suche nicht enthalten, weil es `.limit()` benutzt.
 *
 * Die Entscheidung, die hier anders faellt als bei `auth.ts`
 * ---------------------------------------------------------
 * Dort bleibt bei einem Fehlschlag der zuletzt bekannte Wert stehen. Hier
 * NICHT: `selectedRun` gehoert zu einer bestimmten Lauf-Kennung. Den vorigen
 * Lauf stehenzulassen hiesse, auf der Detailseite von Lauf B die Zahlen von
 * Lauf A zu zeigen. Lieber nichts als das Falsche - und `ladefehler` sagt,
 * warum nichts da ist.
 */

type Antwort = { data: unknown; error: { message: string; code?: string } | null }

let antwort: Antwort = { data: null, error: null }
const aufrufe: string[] = []

function kette(tabelle: string) {
  const k: Record<string, unknown> = {}
  const ende = (art: string) => () => {
    aufrufe.push(`${tabelle}.${art}`)
    return Promise.resolve(antwort)
  }
  k.select = vi.fn(() => k)
  k.eq = vi.fn(() => k)
  k.order = vi.fn(() => k)
  k.limit = ende('limit')
  k.maybeSingle = ende('maybeSingle')
  k.single = vi.fn(() => {
    aufrufe.push(`${tabelle}.single`)
    // `.single()` meldet NULL ZEILEN als Fehler. Der Nachbau macht das nach,
    // sonst waere er freundlicher als die Wirklichkeit.
    if (antwort.data === null && antwort.error === null) {
      return Promise.resolve({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
      })
    }
    return Promise.resolve(antwort)
  })
  return k
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn((t: string) => kette(t)) },
}))

const LAUF = { id: 'lauf-1', distance_km: 5.2, status: 'completed' }

async function frisch() {
  vi.resetModules()
  const { useRun } = await import('./run')
  return useRun
}

beforeEach(() => {
  antwort = { data: null, error: null }
  aufrufe.length = 0
})

describe('Lauf-Speicher, Laden', () => {
  it('legt den Ladefehler ab, statt einen Dauerspinner zu erzeugen', async () => {
    const store = await frisch()
    antwort = { data: null, error: { message: 'Failed to fetch' } }

    await store.getState().fetchRun('lauf-1')

    // Ohne diese Zusicherung sind `loading: false` und `selectedRun: null`
    // nicht von "der Lauf wird noch geladen" zu unterscheiden - und genau
    // daraus entsteht der Dauerspinner.
    expect(store.getState().ladefehler).toBe('Failed to fetch')
    expect(store.getState().loading).toBe(false)
  })

  it('unterscheidet "gibt es nicht" von "ging schief"', async () => {
    const store = await frisch()
    // maybeSingle: null Zeilen sind ein Ergebnis, kein Fehler.
    antwort = { data: null, error: null }

    await store.getState().fetchRun('gibt-es-nicht')

    expect(store.getState().selectedRun).toBeNull()
    expect(store.getState().ladefehler).toBeNull()
  })

  it('fragt einen Lauf ueber maybeSingle ab, nicht ueber single', async () => {
    const store = await frisch()
    antwort = { data: LAUF, error: null }

    await store.getState().fetchRun('lauf-1')

    expect(aufrufe).toEqual(['runs.maybeSingle'])
    expect(store.getState().selectedRun).toEqual(LAUF)
    expect(store.getState().ladefehler).toBeNull()
  })

  it('behauptet nicht "keine Aktivitaeten", wenn die Liste gar nicht geladen wurde', async () => {
    const store = await frisch()
    store.setState({ recentRuns: [LAUF] as never })

    antwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchRecentRuns()

    // Die Verlaufsseite zeigt bei leerer Liste "Starte deinen ersten Lauf".
    // Das darf sie nur sagen, wenn wirklich nichts da ist.
    expect(store.getState().recentRuns).toEqual([LAUF])
    expect(store.getState().ladefehler).toBe('Failed to fetch')
  })

  it('uebernimmt eine wirklich leere Liste', async () => {
    const store = await frisch()
    antwort = { data: [], error: null }

    await store.getState().fetchRecentRuns()

    expect(store.getState().recentRuns).toEqual([])
    expect(store.getState().ladefehler).toBeNull()
  })

  it('raeumt einen alten Ladefehler weg, sobald es wieder klappt', async () => {
    const store = await frisch()
    antwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchRun('lauf-1')
    expect(store.getState().ladefehler).toBe('Failed to fetch')

    antwort = { data: LAUF, error: null }
    await store.getState().fetchRun('lauf-1')

    expect(store.getState().ladefehler).toBeNull()
  })
})
