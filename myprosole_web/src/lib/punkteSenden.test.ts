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

  /**
   * Ein dauerhaft abgewiesener Punkt darf die anderen nicht mitnehmen.
   *
   * Offener Befund seit dem 28.08.2026, jetzt faellig: Diese Schleife hoerte
   * beim ERSTEN Fehler auf. Fuer einen Netzabbruch ist das richtig - der
   * Rest scheitert dann ohnehin. Fuer eine Rechteverletzung oder eine
   * Fremdschluessel-Verletzung ist es das Gegenteil von richtig: Der Punkt
   * wird nie besser, und solange er vorn in der Schlange liegt, kommt hinter
   * ihm nichts mehr durch - auch die Punkte spaeterer Laeufe nicht.
   *
   * Der Kopf dieser Datei kennt die Gefahr laengst: "sonst blockiert ein
   * einziger Punkt dauerhaft alle weiteren." Sie stand dort ueber einer
   * anderen Ursache.
   */
  it('laesst die guten Punkte durch, wenn einer dauerhaft abgewiesen wird', async () => {
    // Zwei Punkte, ein Buendel (BUENDEL ist 200). Ohne Einzelpruefung waere
    // das ganze Buendel verloren - auch der Punkt, an dem nichts falsch ist.
    punkte.push({ ...punkte[0], client_id: 'b' })
    try {
      upsert.mockImplementation((zeilen: Array<{ client_id: string }>) => {
        const schlecht = zeilen.some((z) => z.client_id === 'a')
        return Promise.resolve(
          schlecht
            ? { error: { code: '23503', message: 'foreign key violation' } }
            : { error: null },
        )
      })
      const { offeneSenden } = await import('./punkteSenden')

      const ergebnis = await offeneSenden()

      // Der gute Punkt ist angekommen und oertlich geloescht.
      expect(ergebnis.uebertragen).toBe(1)
      expect(verworfen).toHaveBeenCalledWith(['b'])
      // Der schlechte liegt weiter - verwerfen ist eine Handlung des
      // Menschen, kein Standardverhalten (Entscheidung vom 24.08.2026).
      expect(ergebnis.offen).toBe(1)
      // Und es bleibt erfahrbar, statt lautlos zu geschehen.
      expect(ergebnis.fehler).toContain('23503')
    } finally {
      punkte.pop()
      upsert.mockReset()
    }
  })

  /**
   * Ein Fehler, der der ANFRAGE gehoert, nicht dem Punkt.
   *
   * Gefunden vom Agenten `pruefung` am 31.08.2026, am Quelltext nachgeprueft.
   * `istDauerhafterCode` entscheidet ueber die Fehlerklasse - das
   * Einzelnachfassen unterstellte aber, der Fehler gehoere EINEM Punkt. Fuer
   * 42P10 (der teilweise Index vom 22.08., Migration 0050) und fuer 42501
   * stimmt das nicht: Die treffen jede Zeile gleich.
   *
   * Gemessen: 200 Punkte ergaben 201 Aufrufe statt einem - und das je Takt,
   * alle 30 Sekunden, unbegrenzt, weil nichts geloescht wird und
   * `offenePunkte()` stabil sortiert.
   */
  it('gibt das Einzelnachfassen auf, wenn der Fehler jeden Punkt trifft', async () => {
    for (let i = 0; i < 4; i++) punkte.push({ ...punkte[0], client_id: `x${i}` })
    try {
      upsert.mockResolvedValue({ error: { code: '42P10', message: 'no unique constraint' } })
      const { offeneSenden } = await import('./punkteSenden')

      const ergebnis = await offeneSenden()

      // Ein Buendel-Aufruf plus hoechstens MAX_EINZELN_FEHLER Proben.
      // Frueher waren es 1 + 5 = 6, und bei vollem Puffer 10.000.
      expect(upsert.mock.calls.length).toBeLessThanOrEqual(4)
      expect(ergebnis.uebertragen).toBe(0)
      expect(ergebnis.offen).toBe(5)
      expect(ergebnis.fehler).toContain('42P10')
    } finally {
      punkte.length = 1
      upsert.mockReset()
    }
  })

  it('hoert auf, wenn mitten im Nachfassen das Netz wegbricht', async () => {
    // Die Wache stand nur am Buendel, nicht in der Schleife. Gemessen:
    // Buendel 23503, danach jede Einzelanfrage 08006 - 201 Aufrufe, davon
    // 199 sinnlos, und ohne Zeitgrenze hintereinander weg.
    for (let i = 0; i < 4; i++) punkte.push({ ...punkte[0], client_id: `x${i}` })
    try {
      upsert
        .mockResolvedValueOnce({ error: { code: '23503', message: 'fk violation' } })
        .mockResolvedValue({ error: { code: '08006', message: 'connection failure' } })
      const { offeneSenden } = await import('./punkteSenden')

      const ergebnis = await offeneSenden()

      // Buendel plus genau eine Einzelanfrage, dann Schluss.
      expect(upsert).toHaveBeenCalledTimes(2)
      expect(ergebnis.fehler).toContain('08006')
    } finally {
      punkte.length = 1
      upsert.mockReset()
    }
  })

  it('verliert den dauerhaften Fehler nicht, wenn danach das Netz wegbricht', async () => {
    // `dauerhaft` wurde gefuellt, aber auf dem fruehen Rueckgabeweg nicht
    // gelesen. Die Oberflaeche zeigte dann eine voruebergehende Erklaerung
    // fuer eine dauerhafte Blockade - "kommt spaeter" fuer etwas, das nie
    // besser wird. Genau die Klasse, gegen die der Kopf dieser Datei
    // geschrieben ist.
    //
    // Zwei Buendel: BUENDEL ist 200, also 205 Punkte.
    for (let i = 0; i < 204; i++) punkte.push({ ...punkte[0], client_id: `x${i}` })
    try {
      upsert.mockImplementation((zeilen: Array<{ client_id: string }>) => {
        // Erstes Buendel: ein einziger schlechter Punkt darin.
        if (zeilen.length > 1 && zeilen.some((z) => z.client_id === 'a')) {
          return Promise.resolve({ error: { code: '23503', message: 'fk violation' } })
        }
        if (zeilen.length === 1) {
          return Promise.resolve(
            zeilen[0].client_id === 'a'
              ? { error: { code: '23503', message: 'fk violation' } }
              : { error: null },
          )
        }
        // Zweites Buendel: das Netz ist inzwischen weg.
        return Promise.resolve({ error: { code: '08006', message: 'connection failure' } })
      })
      const { offeneSenden } = await import('./punkteSenden')

      const ergebnis = await offeneSenden()

      // Beide muessen erfahrbar bleiben. Der dauerhafte zuerst - er ist der,
      // der eine Handlung verlangt.
      expect(ergebnis.fehler).toContain('23503')
      expect(ergebnis.fehler).toContain('08006')
    } finally {
      punkte.length = 1
      upsert.mockReset()
    }
  })

  it('haelt bei einem voruebergehenden Fehler weiterhin an', async () => {
    // Der Gegenfall. Ohne ihn waere auch eine Fassung gruen, die bei JEDEM
    // Fehler weitermacht - und die liefe bei fehlendem Netz einmal durch den
    // ganzen Puffer, Buendel fuer Buendel, jedes mit eigener Zeitgrenze.
    punkte.push({ ...punkte[0], client_id: 'b' })
    try {
      upsert.mockResolvedValue({ error: { code: '08006', message: 'connection failure' } })
      const { offeneSenden } = await import('./punkteSenden')

      const ergebnis = await offeneSenden()

      expect(ergebnis.fehler).toContain('08006')
      expect(ergebnis.uebertragen).toBe(0)
      // Genau EIN Versuch: kein Einzelnachfassen, kein zweites Buendel.
      expect(upsert).toHaveBeenCalledTimes(1)
    } finally {
      punkte.pop()
    }
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

/**
 * Punkte, deren Lauf-Zeile noch nicht steht.
 *
 * Seit dem 31.08.2026 puffert ein netzlos gestarteter Lauf ab der ersten
 * Sekunde (F1/A2). Damit liegen erstmals Punkte im Puffer, deren
 * `runs`-Zeile es noch nicht gibt - und `run_points.run_id` ist
 * `not null references runs(id)` (0008:44). Ohne Sperre liefe jede
 * Uebertragung in 23503.
 *
 * Die Sperre wirkt je Lauf und nicht global: Punkte eines FRUEHEREN,
 * fertigen Laufs muessen weiter durchgehen. Sonst haelt ein wartender Lauf
 * die Strecke eines abgeschlossenen auf.
 */
describe('offeneSenden mit ausgenommenen Laeufen', () => {
  beforeEach(() => {
    upsert.mockReset()
    verworfen.mockClear()
  })

  it('laesst einen Lauf aus, dessen Zeile noch nicht steht', async () => {
    punkte.push({ ...punkte[0], client_id: 'b', run_id: 'noch-ohne-zeile' })
    try {
      upsert.mockResolvedValue({ error: null })
      const { offeneSenden } = await import('./punkteSenden')

      const ergebnis = await offeneSenden(new Set(['noch-ohne-zeile']))

      // Nur der Punkt des fertigen Laufs ging raus.
      expect(ergebnis.uebertragen).toBe(1)
      expect(verworfen).toHaveBeenCalledWith(['a'])
      expect(upsert.mock.calls[0][0].map((z: { run_id: string }) => z.run_id)).toEqual(['r'])
      // Der andere liegt weiter - und zaehlt als offen, nicht als erledigt.
      expect(ergebnis.offen).toBe(1)
      expect(ergebnis.fehler).toBeNull()
    } finally {
      punkte.length = 1
      upsert.mockReset()
    }
  })

  it('schickt gar nichts los, wenn alles ausgenommen ist', async () => {
    // Der haeufige Fall waehrend eines netzlos gestarteten Laufs. Eine
    // Anfrage mit leerer Liste waere nicht falsch, aber sinnlos - und sie
    // liefe alle 30 Sekunden.
    upsert.mockResolvedValue({ error: null })
    const { offeneSenden } = await import('./punkteSenden')

    const ergebnis = await offeneSenden(new Set(['r']))

    expect(upsert).not.toHaveBeenCalled()
    expect(ergebnis.offen).toBe(1)
    expect(ergebnis.uebertragen).toBe(0)
  })
})
