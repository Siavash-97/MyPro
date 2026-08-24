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
/** Laeufe, die die Abfrage nach status=tracking zurueckgibt. */
let haengend: Array<Record<string, unknown>> = []
/** Punkte, die zu einem haengenden Lauf geliefert werden. */
let haengendePunkte: Array<Record<string, unknown>> = []
/** Alle `.eq(...)` des Laufs - fuer die Wache gegen den Wettlauf. */
let bedingungen: Array<{ spalte: string; wert: unknown }> = []
/** Antwort auf das `single()` beim Speichern - fuer den PGRST116-Fall. */
let singleAntwort: { data: unknown; error: { message: string; code?: string } | null } | null = null
/** Was ein spaeteres maybeSingle auf `runs` liefert. */
let schonFertig: unknown = null

const kette = (tabelle?: string) => {
  const k: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'order', 'in', 'range'] as const) {
    k[name] = vi.fn(() => k)
  }
  // `eq` wird mitgeschrieben: Die Nachbergung schreibt bedingt
  // (`.eq('status', 'tracking')`), und das ist die Wache gegen den
  // Wettlauf - sie muss pruefbar sein.
  k.eq = vi.fn((spalte: string, wert: unknown) => {
    bedingungen.push({ spalte, wert })
    return k
  })
  // Die Abfragen der Haenger-Bergung enden ohne single/maybeSingle - sie
  // werden direkt erwartet. Deshalb ist die Kette selbst ein Thenable.
  k.then = (aufloesen: (w: unknown) => unknown) => {
    if (tabelle === 'runs') return Promise.resolve({ data: haengend, error: null }).then(aufloesen)
    if (tabelle === 'run_points') {
      return Promise.resolve({ data: haengendePunkte, error: null }).then(aufloesen)
    }
    return Promise.resolve({ data: [], error: null }).then(aufloesen)
  }
  // Beide Wege festhalten: Mit vorhandener Lauf-Zeile schreibt stopRun ein
  // update, ohne (kein Netz beim Start) ein insert.
  const merken = (werte: Record<string, unknown>) => {
    if ('distance_km' in werte || 'duration_s' in werte) gespeichert = werte
    return k
  }
  k.update = vi.fn(merken)
  k.insert = vi.fn(merken)
  // `upsert` gehoert dazu, seit stopRun ohne Netz beim Start eine gemerkte
  // Kennung benutzt (sonst entstuenden bei einem zweiten Versuch zwei
  // Laeufe). Fehlte es hier, brach der Aufruf mit "is not a function" ab und
  // der Test meldete "ungespeichert" - ein Nachbau-Loch, das wie ein
  // Fachfehler aussieht.
  k.upsert = vi.fn(merken)
  k.maybeSingle = vi.fn(async () => ({
    data: schonFertig ?? { started_at: startIso },
    error: null,
  }))
  k.single = vi.fn(async () => singleAntwort ?? { data: { id: 'lauf-1' }, error: null })
  return k
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'nutzer-1' } } })) },
    from: vi.fn((tabelle: string) => kette(tabelle)),
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
    haengend = []
    haengendePunkte = []
    bedingungen = []
    singleAntwort = null
    schonFertig = null
    stand.laeuft = true
    stand.offen = 0
    stand.startMs = 0
    bruecke.aufTelefon.mockReturnValue(true)
    merker.merkerLoeschen.mockClear()
    merker.merkerLesen.mockReturnValue({ sitzungId: 'sitzung-1', runId: 'lauf-1' })
  })

  it('schliesst einen haengengebliebenen Lauf aus der Datenbank ab', async () => {
    // Der Feldfall vom 23.08.2026 abends: Ein Lauf blieb beim Speichern
    // haengen. Danach war der Dienst sauber (offen = 0), der Merker
    // geloescht - und die Bergung sagte "nichts zu tun", weil sie nur den
    // DIENST fragt. Die Lauf-Zeile blieb fuer immer auf 'tracking'.
    stand.laeuft = false
    stand.offen = 0
    merker.merkerLesen.mockReturnValue(null as never)
    bruecke.aufTelefon.mockReturnValue(true)

    // Ein Lauf, der vor einer Stunde begann, 20 Punkte hat und nie
    // abgeschlossen wurde.
    const vorEinerStunde = new Date(Date.now() - 60 * 60_000).toISOString()
    haengend = [{ id: 'haengt-1', status: 'tracking', started_at: vorEinerStunde }]
    haengendePunkte = punktfolge(20, Date.now() - 55 * 60_000).map((x) => ({
      latitude: x.breite,
      longitude: x.laenge,
      recorded_at: new Date(x.zeit).toISOString(),
      urteil: 'gezaehlt',
    }))

    const useRun = await frischerStore()
    const ergebnis = await useRun.getState().haengendeLaeufeAbschliessen()

    expect(ergebnis).toBe(1)
    expect(gespeichert).not.toBeNull()
    expect(gespeichert?.status).toBe('completed')
    expect((gespeichert?.distance_km as number) ?? 0).toBeGreaterThan(0.1)
    // Die Hoehe bleibt leer - sie ist nachweislich unbrauchbar.
    expect(gespeichert?.elevation_gain_m).toBeNull()

    // Bedingt geschrieben: Zwischen dem Waechter und dem Schreiben liegt
    // die Zeitgrenze, und in der Zeit kann die andere Bergung denselben
    // Lauf fortgesetzt haben. Die Datenbank entscheidet im Augenblick des
    // Schreibens - sonst bleibt ein Fenster.
    expect(bedingungen).toContainEqual({ spalte: 'status', wert: 'tracking' })
  })

  it('rechnet NICHT, wenn die Punktliste abgeschnitten sein koennte', async () => {
    // PostgREST schneidet bei max_rows (1000) ab, ohne ein Wort - `data`
    // sieht vollstaendig aus. Waere gerechnet worden, staende ein 15-km-Lauf
    // dauerhaft als 10-km-Lauf im Verlauf, festgeschrieben als 'completed'.
    // Lieber bleibt die Zeile stehen.
    stand.laeuft = false
    stand.offen = 0
    merker.merkerLesen.mockReturnValue(null as never)
    bruecke.aufTelefon.mockReturnValue(true)

    const vorEinerStunde = new Date(Date.now() - 60 * 60_000).toISOString()
    haengend = [{ id: 'zu-lang', status: 'tracking', started_at: vorEinerStunde }]
    haengendePunkte = punktfolge(1000, Date.now() - 55 * 60_000).map((x) => ({
      latitude: x.breite,
      longitude: x.laenge,
      recorded_at: new Date(x.zeit).toISOString(),
      urteil: 'gezaehlt',
    }))

    const useRun = await frischerStore()
    const ergebnis = await useRun.getState().haengendeLaeufeAbschliessen()

    expect(ergebnis).toBe(0)
    expect(gespeichert).toBeNull()
  })

  it('erkennt einen bereits gespeicherten Lauf, statt ihn einzusperren', async () => {
    // Gefunden vom Pruefagenten, 24.08.2026, als KRITISCH.
    //
    // Die Wache `.eq('status','tracking')` schuetzt davor, dass ein
    // verspaeteter erster Schreibvorgang den zweiten ueberschreibt. Sie
    // sperrte aber den Lauf dauerhaft ein, wenn der erste Versuch doch noch
    // ankam: Der zweite Stopp traf dann 0 Zeilen (PGRST116), das galt als
    // Fehler, und es ging zurueck in die Aufzeichnung - bei jedem weiteren
    // Versuch, auch nach einem Neustart.
    //
    // "Keine Zeile getroffen" heisst hier: schon fertig. Nicht: kaputt.
    bruecke.aufTelefon.mockReturnValue(true)
    singleAntwort = { data: null, error: { message: 'no rows', code: 'PGRST116' } }
    schonFertig = { id: 'lauf-1', status: 'completed', distance_km: 5 }

    const useRun = await frischerStore()
    useRun.setState({
      phase: 'tracking',
      activeRunId: 'lauf-1',
      startedAtMs: Date.now() - 600_000,
      liveStats: { ...useRun.getState().liveStats, distanceKm: 5 },
    } as never)

    const ergebnis = await useRun.getState().stopRun()

    expect(ergebnis.error).toBeNull()
    expect(ergebnis.runId).toBe('lauf-1')
    // Und NICHT zurueck in die Aufzeichnung.
    expect(useRun.getState().phase).not.toBe('tracking')
  })

  it('gibt einen Fehler ZURUECK, statt ihn zu werfen', async () => {
    // Die Signatur von stopRun verspricht ein `Stoppergebnis` - also: Fehler
    // kommen als Wert. Drei Stellen im Rumpf hielten sich nicht daran
    // (aufzeichnungStoppen, punkteEinsammeln, computeSplits).
    //
    // Seit die Laufseite die Knopfreihe waehrend des Speicherns durch einen
    // Fortschrittsbalken ersetzt, waere eine Ausnahme hier schlimmer als
    // frueher: Der Bildschirm bliebe fuer immer auf "wird gespeichert",
    // ohne Stopp, ohne Pause, ohne zweiten Versuch.
    bruecke.aufTelefon.mockReturnValue(true)
    bruecke.aufzeichnungStoppen.mockRejectedValueOnce(new Error('Bruecke kaputt') as never)

    const useRun = await frischerStore()
    useRun.setState({ phase: 'tracking', startedAtMs: Date.now() - 600_000 } as never)

    const ergebnis = await useRun.getState().stopRun()

    expect(ergebnis.error).toContain('Bruecke kaputt')
    expect(ergebnis.runId).toBeNull()
    // Und zurueck in die Aufzeichnung, nicht in einen Zwischenzustand.
    expect(useRun.getState().phase).toBe('tracking')
  })

  it('laesst den gerade laufenden Lauf in Ruhe', async () => {
    // Der gefaehrlichste Fehler waere, jemanden mitten im Lauf
    // "abzuschliessen".
    const vorEinerStunde = new Date(Date.now() - 60 * 60_000).toISOString()
    haengend = [{ id: 'laeuft-gerade', status: 'tracking', started_at: vorEinerStunde }]
    const useRun = await frischerStore()
    useRun.setState({ activeRunId: 'laeuft-gerade', phase: 'tracking' } as never)

    const ergebnis = await useRun.getState().haengendeLaeufeAbschliessen()

    expect(ergebnis).toBe(0)
    expect(gespeichert).toBeNull()
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

  it('setzt beim Fortsetzen auch Hoehenbezug und Abschnitte zurueck', async () => {
    // Gefunden vom Architektur-Lauf am 23.08.2026: Die Bergung baute eine
    // fuenfte Kopie des Grundzustands - und sie war schon abgewichen.
    // `elevationRefM` und `splits` fehlten darin. Ein fortgesetzter Lauf
    // startete damit mit der Hoehenreferenz und den Kilometer-Abschnitten
    // des VORIGEN Laufs.
    const jetzt = Date.now()
    stand.laeuft = true
    stand.letzterPunktMs = jetzt - 20_000
    stand.startMs = jetzt - 30 * 60_000
    startIso = new Date(jetzt - 30 * 60_000).toISOString()

    bruecke.punkteAbholen.mockResolvedValue([])

    const useRun = await frischerStore()
    // Reste eines frueheren Laufs, wie sie nach einem Absturz im Speicher
    // stehen koennen.
    useRun.setState({
      elevationRefM: 250,
      splits: [{ distance_km: 1, duration_s: 300, pace_s_per_km: 300, elevation_gain_m: 0 }],
    } as never)

    await useRun.getState().verwaisteAufzeichnungBergen()

    expect(useRun.getState().elevationRefM).toBeNull()
    expect(useRun.getState().splits).toEqual([])
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
