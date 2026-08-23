import { describe, it, expect, vi, beforeEach } from 'vitest'
import { istUebertragungFaellig, UEBERTRAGUNG_TAKT_MS } from './punkteSenden'

/**
 * Der Rueckfall fuer das Auslieferungsfenster.
 *
 * `urteil` kommt mit Migration 0051. Zwischen dem Ausrollen der App und dem
 * Einspielen der Migration wuerde PostgREST sonst JEDE Uebertragung
 * abweisen - eine Spalte im Rumpf, die es nicht gibt (PGRST204).
 *
 * Am 22.08.2026 hat genau diese Klasse Fehler einen Tag gekostet: 42P10
 * traf jede einzelne Uebertragung, unabhaengig von Netz und Anmeldung, und
 * niemand sah es.
 */

const upsert = vi.fn()
vi.mock('./supabase', () => ({ supabase: { from: () => ({ upsert }) } }))

const punkte = [
  {
    client_id: 'a',
    run_id: 'r',
    latitude: 1,
    longitude: 2,
    altitude_m: null,
    accuracy_m: 5,
    speed_mps: 2,
    recorded_at: '2026-08-23T10:00:00Z',
    urteil: 'gezaehlt' as const,
  },
]
const verworfen = vi.fn(async () => {})
vi.mock('./punktePuffer', () => ({
  offenePunkte: async () => punkte,
  punkteVerworfen: (...a: unknown[]) => verworfen(...(a as [])),
}))

describe('offeneSenden', () => {
  beforeEach(() => {
    upsert.mockReset()
    verworfen.mockClear()
  })

  it('schickt das Urteil mit, wenn die Datenbank es kennt', async () => {
    upsert.mockResolvedValue({ error: null })
    const { offeneSenden } = await import('./punkteSenden')

    const ergebnis = await offeneSenden()

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0][0]).toHaveProperty('urteil', 'gezaehlt')
    expect(ergebnis.ohneUrteil).toBe(false)
    expect(ergebnis.uebertragen).toBe(1)
  })

  it('rettet die Punkte ohne Urteil, wenn die Spalte fehlt', async () => {
    upsert
      .mockResolvedValueOnce({ error: { code: 'PGRST204', message: 'column not found' } })
      .mockResolvedValueOnce({ error: null })
    const { offeneSenden } = await import('./punkteSenden')

    const ergebnis = await offeneSenden()

    // Zweiter Versuch, diesmal ohne die Spalte.
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[1][0][0]).not.toHaveProperty('urteil')
    // Ein Urteil laesst sich nachrechnen, ein verlorener Messpunkt nicht.
    expect(ergebnis.uebertragen).toBe(1)
    expect(ergebnis.fehler).toBeNull()
    // Und es bleibt erfahrbar, statt lautlos zu geschehen.
    expect(ergebnis.ohneUrteil).toBe(true)
  })

  it('schickt einen ungueltigen Wert gar nicht erst los', async () => {
    // Ein von Hand veraenderter Geraetespeicher, oder ein spaeterer
    // Codepfad, der die Regel nicht kennt. Wuerde 'unsicher' losgeschickt,
    // scheiterte das ganze Buendel an der Pruefbedingung - und der Punkt
    // bliebe liegen und blockierte jede weitere Uebertragung.
    punkte[0].urteil = 'unsicher' as never
    upsert.mockResolvedValue({ error: null })
    const { offeneSenden } = await import('./punkteSenden')

    await offeneSenden()

    expect(upsert.mock.calls[0][0][0].urteil).toBeNull()
    punkte[0].urteil = 'gezaehlt'
  })

  it('rettet die Punkte auch, wenn die Pruefbedingung sie abweist', async () => {
    // Zweite Reihe: Sollte die Bedingung je strenger sein als unsere Liste,
    // gehen die Punkte ohne Urteil durch, statt fuer immer liegenzubleiben.
    upsert
      .mockResolvedValueOnce({ error: { code: '23514', message: 'check violation' } })
      .mockResolvedValueOnce({ error: null })
    const { offeneSenden } = await import('./punkteSenden')

    const ergebnis = await offeneSenden()

    expect(ergebnis.uebertragen).toBe(1)
    expect(ergebnis.ohneUrteil).toBe(true)
  })

  it('meldet einen echten Fehler weiterhin, statt ihn zu verschlucken', async () => {
    upsert.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } })
    const { offeneSenden } = await import('./punkteSenden')

    const ergebnis = await offeneSenden()

    expect(ergebnis.fehler).toContain('42501')
    expect(ergebnis.uebertragen).toBe(0)
    expect(ergebnis.offen).toBe(1)
  })
})


/**
 * Gemessen am 23.08.2026 im Feld, waehrend der Nutzer im Zug sass:
 *
 *   Lauf gestartet          12:15:22
 *   Punkte im Geraetepuffer      244
 *   Punkte in der Datenbank        0
 *
 * Zwanzig Minuten, keine einzige Uebertragung. Die Ursache stand in einer
 * Zeile in `tick()`:
 *
 *   if (durationS > 0 && durationS % 30 === 0) punkteUebertragen()
 *
 * `durationS` waechst nur, wenn der Anzeigetakt laeuft. Bei ausgeschaltetem
 * Bildschirm drosselt Android den Takt im WebView, und `durationS` springt
 * dann etwa von 100 auf 160 - ein Vielfaches von 30 wird dabei einfach
 * uebersprungen.
 *
 * Es ist also kein "seltener", sondern ein Treffer-oder-nicht: Bei jedem
 * gedrosselten Takt liegt die Chance eins zu dreissig. Im Bericht vom 22.08.
 * stand "der Takt verschlechtert sich von 30 s auf 11 Minuten". Das war zu
 * freundlich - er faellt aus.
 *
 * Die Lehre, allgemeiner als dieser Fall: Eine Modulo-Pruefung auf einem
 * Wert, der springen kann, ist keine Taktung. Gefragt ist nicht "ist die
 * Zahl gerade durch 30 teilbar", sondern "ist genug Zeit vergangen".
 */
describe('istUebertragungFaellig', () => {
  it('ist beim allerersten Mal faellig', () => {
    expect(istUebertragungFaellig(null, 1_000_000)).toBe(true)
  })

  it('ist nach dem Takt faellig', () => {
    const t = 1_000_000
    expect(istUebertragungFaellig(t, t + UEBERTRAGUNG_TAKT_MS)).toBe(true)
  })

  it('ist davor nicht faellig', () => {
    const t = 1_000_000
    expect(istUebertragungFaellig(t, t + UEBERTRAGUNG_TAKT_MS - 1)).toBe(false)
  })

  it('ist auch dann faellig, wenn der Takt Werte uebersprungen hat', () => {
    // DAS ist der Feldbefund. Der alte Ausdruck `durationS % 30 === 0`
    // haette hier NICHT ausgeloest - 137 ist nicht durch 30 teilbar.
    const t = 1_000_000
    expect(istUebertragungFaellig(t, t + 137_000)).toBe(true)
  })

  it('haelt eine rueckwaerts springende Uhr aus', () => {
    // Sommerzeit, Zeitabgleich ueber das Netz. Lieber einmal zu frueh
    // uebertragen als nie wieder.
    const t = 1_000_000
    expect(istUebertragungFaellig(t, t - 500_000)).toBe(true)
  })
})
