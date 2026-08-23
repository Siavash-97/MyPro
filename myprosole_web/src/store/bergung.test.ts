import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Die Bergung einer abgeschossenen Aufzeichnung - am Store gepruefft.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * `verwaisteAufzeichnungBergen` hat vier Ausgaenge und hatte null Tests. Am
 * 23.08.2026 fand der Pruefagent, dass der wichtigste davon nie funktioniert
 * hat: Ein geborgener, beendeter Lauf wurde IMMER als "zu kurz" verworfen -
 * und `discardRun` loescht dabei den Dienstspeicher.
 *
 * Die Ursache war eine Groesse, die am falschen Ort entstand:
 * `liveStats.durationS` wurde ausschliesslich im Anzeigetakt `tick()`
 * geschrieben, und `tick()` laeuft nur, solange die Laufseite montiert ist.
 * Auf dem Bergungsweg ist sie das nie. `stopRun` las diese Null und verwarf.
 *
 * Der Fehler war aus reinen Funktionen heraus nicht zu sehen: Beide Seiten
 * waren fuer sich richtig. Falsch war die Verdrahtung. Deshalb steht der
 * Test hier am Store und nicht an einer Hilfsfunktion.
 */

const stand = {
  offen: 0,
  erlaubt: true,
  gpsAn: true,
  pausiert: false,
  laeuft: true,
  laufId: 'sitzung-1' as string | null,
  letzterPunktMs: 0 as number | null,
  startMs: 0 as number | null,
  beendenGewuenscht: false,
}

const bruecke = {
  aufTelefon: vi.fn(() => true),
  aufzeichnungStand: vi.fn(async () => stand),
  aufzeichnungStoppen: vi.fn(async () => {}),
  aufzeichnungStarten: vi.fn(async () => ({ gelungen: true, hindernis: null })),
  aufzeichnungPausieren: vi.fn(async () => {}),
  punkteAbholen: vi.fn(async () => [] as unknown[]),
  punkteBestaetigen: vi.fn(async () => {}),
  punkteVerwerfen: vi.fn(async () => {}),
}
vi.mock('../lib/aufzeichnungBruecke', () => bruecke)

/** Was am Ende wirklich in der Lauf-Zeile stand. */
let gespeichert: Record<string, unknown> | null = null

const kette = () => {
  const k: Record<string, unknown> = {}
  for (const name of ['select', 'eq']) k[name] = vi.fn(() => k)
  // Beide Wege festhalten: Mit vorhandener Lauf-Zeile schreibt stopRun ein
  // update, ohne (kein Netz beim Start) ein insert.
  const merken = (werte: Record<string, unknown>) => {
    if ('distance_km' in werte || 'duration_s' in werte) gespeichert = werte
    return k
  }
  k.update = vi.fn(merken)
  k.insert = vi.fn(merken)
  k.maybeSingle = vi.fn(async () => ({ data: { started_at: startIso }, error: null }))
  k.single = vi.fn(async () => ({ data: { id: 'lauf-1' }, error: null }))
  return k
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'nutzer-1' } } })) },
    from: vi.fn(() => kette()),
  },
}))

const merker = {
  merkerSetzen: vi.fn(),
  merkerLaufId: vi.fn(),
  merkerLoeschen: vi.fn(),
  merkerLesen: vi.fn(() => ({ sitzungId: 'sitzung-1', runId: 'lauf-1' })),
}
vi.mock('../lib/laufMerker', () => merker)

vi.mock('../lib/punktePuffer', () => ({
  punktMerken: vi.fn(async () => {}),
  offenePunkte: vi.fn(async () => []),
  punkteVerworfen: vi.fn(async () => {}),
}))
vi.mock('../lib/punkteSenden', () => ({
  offeneSenden: vi.fn(async () => ({ uebertragen: 0, offen: 0, fehler: null })),
}))
vi.mock('../lib/ruhepegelSpeicher', async () => {
  const { Ruhepegel } = await import('../lib/bewegung')
  return { ruhepegelLaden: () => new Ruhepegel(), ruhepegelSichern: vi.fn() }
})
vi.mock('../lib/eigeneKennung', () => ({ eigeneKennung: () => 'nutzer-1' }))

let startIso = ''

/**
 * Eine Punktfolge, die zweifelsfrei ein Lauf ist.
 *
 * Fuenfzehn Meter alle fuenf Sekunden sind 3 m/s - deutlich ueber dem Tor von
 * 0,9 und ueber MIN_SEGMENT_M. Die Bewegungserkennung muss das durchlassen,
 * sonst prueft der Test etwas anderes als gemeint.
 */
function punktfolge(anzahl: number, endeMs: number) {
  const punkte = []
  for (let i = 0; i < anzahl; i++) {
    punkte.push({
      id: i + 1,
      zeit: endeMs - (anzahl - 1 - i) * 5_000,
      // 15 m je Schritt: 0,000135 Grad Breite sind rund 15 m.
      breite: 50.94 + i * 0.000135,
      laenge: 6.96,
      genauigkeitM: 5,
      tempoMps: 3,
      tempoGueteMps: 0.1,
      hoeheM: 50,
    })
  }
  return punkte
}

async function frischerStore() {
  vi.resetModules()
  const { useRun } = await import('./run')
  return useRun
}

describe('Bergung einer abgeschossenen Aufzeichnung', () => {
  beforeEach(() => {
    gespeichert = null
    stand.laeuft = true
    stand.offen = 0
    stand.startMs = 0
    bruecke.aufTelefon.mockReturnValue(true)
    merker.merkerLoeschen.mockClear()
    merker.merkerLesen.mockReturnValue({ sitzungId: 'sitzung-1', runId: 'lauf-1' })
  })

  it('speichert einen beendeten Lauf, statt ihn als "zu kurz" zu verwerfen', async () => {
    const jetzt = Date.now()
    // Letzte Messung vor zehn Minuten: der Lauf ist erkennbar vorbei.
    const letzterPunktMs = jetzt - 10 * 60_000
    // Gestartet vor einer Stunde - unstrittig laenger als die Mindestdauer.
    startIso = new Date(jetzt - 60 * 60_000).toISOString()

    stand.laeuft = true
    stand.letzterPunktMs = letzterPunktMs

    const punkte = punktfolge(60, letzterPunktMs)
    let geliefert = false
    bruecke.punkteAbholen.mockImplementation(async () => {
      if (geliefert) return []
      geliefert = true
      return punkte
    })

    const useRun = await frischerStore()
    const ergebnis = await useRun.getState().verwaisteAufzeichnungBergen()

    // Die Punkte muessen ueberhaupt angekommen sein - sonst prueft der Test
    // die Dauer an einer leeren Strecke. Nicht ueber den Zustand geprueft:
    // Auf dem Fehlerweg hat discardRun ihn bereits geraeumt.
    expect(ergebnis?.punkte).toBe(60)

    expect(ergebnis?.ergebnis).toBe('gespeichert')
    expect(gespeichert).not.toBeNull()
    expect((gespeichert?.distance_km as number) ?? 0).toBeGreaterThan(0.1)
    // Die Gesamtzeit muss aus der Startzeit kommen, nicht aus dem
    // Anzeigetakt - der lief auf diesem Weg nie.
    expect(gespeichert?.duration_s as number).toBeGreaterThan(3000)
  })

  it('nimmt die Startzeit vom Dienst, wenn es keinen Merker gibt', () => {
    // Der Rueckfall: Geraetespeicher geleert, oder beim Start war kein Netz.
    // Vorher wurde hier auf die Zeit der LETZTEN Messung geraten - ein Lauf
    // von einer Stunde galt damit als Sekunden lang und fiel unter die
    // Mindestdauer. Der Dienst kennt die richtige Zeit.
    return pruefeOhneMerker()
  })

  it('setzt fort, solange die Aufzeichnung frisch ist', async () => {
    const jetzt = Date.now()
    stand.laeuft = true
    // Letzte Messung vor zwanzig Sekunden: da laeuft jemand.
    stand.letzterPunktMs = jetzt - 20_000
    stand.startMs = jetzt - 30 * 60_000
    startIso = new Date(jetzt - 30 * 60_000).toISOString()

    let geliefert = false
    const punkte = punktfolge(20, jetzt - 20_000)
    bruecke.punkteAbholen.mockImplementation(async () => {
      if (geliefert) return []
      geliefert = true
      return punkte
    })

    const useRun = await frischerStore()
    const ergebnis = await useRun.getState().verwaisteAufzeichnungBergen()

    expect(ergebnis?.ergebnis).toBe('fortgesetzt')
    // Und der Lauf laeuft wirklich weiter, statt gespeichert zu werden.
    expect(useRun.getState().phase).toBe('tracking')
    expect(gespeichert).toBeNull()
  })

  it('holt Punkte auch dann, wenn der Dienst schon gestoppt ist', async () => {
    // Der Fall aus Befund 2: stopRun hat den Dienst beendet, danach ist das
    // Schreiben gescheitert. Der Schluessel ist weg (`laeuft: false`), die
    // Punkte liegen aber noch da. Vorher lautete das Urteil "nichts", der
    // Merker wurde geloescht - und damit war der letzte Weg zu diesen
    // Punkten zu, waehrend auf dem Bildschirm stand "der naechste Start holt
    // es nach".
    const jetzt = Date.now()
    stand.laeuft = false
    stand.offen = 60
    stand.letzterPunktMs = jetzt - 10 * 60_000
    stand.startMs = null
    startIso = new Date(jetzt - 60 * 60_000).toISOString()

    let geliefert = false
    const punkte = punktfolge(60, jetzt - 10 * 60_000)
    bruecke.punkteAbholen.mockImplementation(async () => {
      if (geliefert) return []
      geliefert = true
      return punkte
    })

    const useRun = await frischerStore()
    const ergebnis = await useRun.getState().verwaisteAufzeichnungBergen()

    // merkerLoeschen wird hier sehr wohl gerufen - aber erst am Ende von
    // stopRun, wenn wirklich nichts mehr zu bergen ist. Falsch war das
    // Loeschen VOR dem Bergen.
    expect(ergebnis?.ergebnis).toBe('gespeichert')
    expect(gespeichert).not.toBeNull()
  })
})

/** Ausgelagert, weil zwei Tests denselben Aufbau brauchen. */
async function pruefeOhneMerker() {
  const jetzt = Date.now()
  stand.laeuft = true
  stand.letzterPunktMs = jetzt - 10 * 60_000
  // Der Dienst weiss, wann es losging: vor einer Stunde.
  stand.startMs = jetzt - 60 * 60_000
  merker.merkerLesen.mockReturnValue(null as never)

  let geliefert = false
  const punkte = punktfolge(60, jetzt - 10 * 60_000)
  bruecke.punkteAbholen.mockImplementation(async () => {
    if (geliefert) return []
    geliefert = true
    return punkte
  })

  const useRun = await frischerStore()
  const ergebnis = await useRun.getState().verwaisteAufzeichnungBergen()

  expect(ergebnis?.ergebnis).toBe('gespeichert')
  expect(gespeichert?.duration_s as number).toBeGreaterThan(3000)
}
