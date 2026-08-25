import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Ein fehlgeschlagenes Laden ist kein "gibt es nicht".
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Am 24.08.2026 gemeldet: Die Registrierungsseite "Lass uns deinen Laufplan
 * erstellen" kam mitten in der Benutzung wieder - unregelmaessig, ohne
 * erkennbaren Ausloeser, bei einem Konto, das die Anamnese laengst hinter
 * sich hatte.
 *
 * Die Ursache stand in `fetchSessions`:
 *
 *     const { data } = await supabase.from('anamnese_sessions')...
 *     set({ sessions: (data ?? []) as AnamneseSession[] })
 *
 * Der Fehler wurde nicht einmal ausgelesen. Schlaegt die Abfrage fehl - kein
 * Netz, abgelaufenes Token -, ist `data` gleich `null`, und `?? []` schreibt
 * eine LEERE LISTE in den Speicher. Danach sagt `hasCompletedBlock('a')`
 * nein, und der Waechter schickt den Nutzer in die Registrierung.
 *
 * "Ich weiss es nicht" und "es gibt keine" waren derselbe Wert.
 *
 * Und weil das Laden bei JEDER Token-Erneuerung neu lief, traf es genau
 * dann, wenn das Netz schwach war - in der Bahn.
 *
 * Was hier geprueft wird
 * ----------------------
 * Der Speicher beantwortet die Frage, die alle drei Aufrufer wirklich
 * stellen: "ist dieser Block sicher offen?" Auf Unbekannt lautet die
 * Antwort NEIN - denn wer es nicht weiss, darf niemanden wegschicken.
 */

let selectAntwort: { data: unknown; error: { message: string } | null } = {
  data: [],
  error: null,
}

function kette() {
  const k: Record<string, unknown> = {}
  k.select = vi.fn(() => k)
  k.eq = vi.fn(() => k)
  k.order = vi.fn(() => Promise.resolve(selectAntwort))
  return k
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn(() => kette()) },
}))

const sitzung = (block: string, fertig: boolean) => ({
  id: `s-${block}`,
  block,
  completed_at: fertig ? '2026-08-01T10:00:00Z' : null,
  created_at: '2026-08-01T09:00:00Z',
})

async function frisch() {
  vi.resetModules()
  const { useAnamnese } = await import('./anamnese')
  return useAnamnese
}

beforeEach(() => {
  selectAntwort = { data: [], error: null }
})

describe('Anamnese-Speicher', () => {
  it('haelt einen Block NICHT fuer offen, wenn das Laden gescheitert ist', async () => {
    const store = await frisch()
    selectAntwort = { data: null, error: { message: 'Failed to fetch' } }

    await store.getState().fetchSessions()

    // Der Kern: nicht "offen", weil unbekannt. Sonst fliegt ein Nutzer mit
    // laengst erledigter Anamnese zurueck in die Registrierung.
    expect(store.getState().blockOffen('a')).toBe(false)
  })

  it('haelt einen Block fuer offen, wenn das Laden GELANG und nichts da ist', async () => {
    const store = await frisch()
    selectAntwort = { data: [], error: null }

    await store.getState().fetchSessions()

    expect(store.getState().blockOffen('a')).toBe(true)
  })

  it('haelt einen erledigten Block nicht fuer offen', async () => {
    const store = await frisch()
    selectAntwort = { data: [sitzung('a', true)], error: null }

    await store.getState().fetchSessions()

    expect(store.getState().blockOffen('a')).toBe(false)
  })

  it('haelt einen begonnenen, aber unfertigen Block fuer offen', async () => {
    const store = await frisch()
    selectAntwort = { data: [sitzung('a', false)], error: null }

    await store.getState().fetchSessions()

    expect(store.getState().blockOffen('a')).toBe(true)
  })

  it('loescht einen bereits bekannten Stand nicht, wenn ein spaeteres Laden scheitert', async () => {
    const store = await frisch()
    selectAntwort = { data: [sitzung('a', true)], error: null }
    await store.getState().fetchSessions()

    // Token-Erneuerung in der Bahn: die zweite Abfrage geht schief.
    selectAntwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchSessions()

    expect(store.getState().hasCompletedBlock('a')).toBe(true)
    expect(store.getState().blockOffen('a')).toBe(false)
  })

  it('legt den Ladefehler ab, statt ihn zu verschlucken', async () => {
    const store = await frisch()
    expect(store.getState().ladefehler).toBeNull()

    selectAntwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchSessions()
    // Vorher war der Fehler wenigstens falsch SICHTBAR (als ueberfluessige
    // Registrierungsseite). Nach dem Fix von heute frueh war er unsichtbar -
    // ein Neunutzer saesse in einer App mit Durchschnittswerten, und nichts
    // sagte ihm, dass etwas schiefging.
    expect(store.getState().ladefehler).toBe('Failed to fetch')

    selectAntwort = { data: [], error: null }
    await store.getState().fetchSessions()
    expect(store.getState().ladefehler).toBeNull()
  })

  it('vergisst beim Zuruecksetzen auch die Antworten', async () => {
    const store = await frisch()
    selectAntwort = { data: [sitzung('a', true)], error: null }
    await store.getState().fetchSessions()
    store.setState({
      answers: new Map([['s-a', [{ question_key: 'beschwerden' }]]]) as never,
      ladefehler: 'irgendwas',
    })

    store.getState().zuruecksetzen()

    // Die answers-Map traegt die Antworten selbst, also Gesundheitsdaten
    // nach Art. 9. Der Test in auth.test.ts prueft nur sessions und
    // standBekannt - liefe der Inhalt von zuruecksetzen auseinander, merkte
    // es dort niemand. Angestrichen vom Agenten `pruefung`.
    expect(store.getState().answers.size).toBe(0)
    expect(store.getState().sessions).toEqual([])
    expect(store.getState().standBekannt).toBe(false)
    expect(store.getState().ladefehler).toBeNull()
  })

  it('meldet den Stand erst als bekannt, wenn ein Laden gelungen ist', async () => {
    const store = await frisch()
    expect(store.getState().standBekannt).toBe(false)

    selectAntwort = { data: null, error: { message: 'Failed to fetch' } }
    await store.getState().fetchSessions()
    expect(store.getState().standBekannt).toBe(false)

    selectAntwort = { data: [], error: null }
    await store.getState().fetchSessions()
    expect(store.getState().standBekannt).toBe(true)
  })
})
