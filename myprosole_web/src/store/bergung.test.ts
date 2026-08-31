import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

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
  // `offen` ausdruecklich als `number | null`: Die Bruecke liefert `null`,
  // wenn die native Zaehlung gescheitert ist. Ohne die Angabe legt
  // TypeScript den Mock auf `number` fest, und der Fall waere nicht
  // pruefbar.
  punkteAbholen: vi.fn(async () => ({ punkte: [] as unknown[], offen: 0 as number | null })),
  punkteBestaetigen: vi.fn(async () => {}),
  punkteVerwerfen: vi.fn(async () => {}),
}

// `dienstPunktAlsMessung` wird ausdruecklich NICHT nachgebaut, sondern aus
// dem echten Modul geholt. Sie ist eine reine Feldliste, und genau so eine
// Liste hat am 26.08.2026 den Schrittzaehler verloren - eine Attrappe
// wuerde denselben Fehler wieder verstecken.
vi.mock('../lib/aufzeichnungBruecke', async () => {
  const echt = await vi.importActual<typeof import('../lib/aufzeichnungBruecke')>(
    '../lib/aufzeichnungBruecke',
  )
  return { ...bruecke, dienstPunktAlsMessung: echt.dienstPunktAlsMessung }
})

/** Was am Ende wirklich in der Lauf-Zeile stand. */
let gespeichert: Record<string, unknown> | null = null
/** Laeufe, die die Abfrage nach status=tracking zurueckgibt. */
let haengend: Array<Record<string, unknown>> = []
/** Punkte, die zu einem haengenden Lauf geliefert werden. */
let haengendePunkte: Array<Record<string, unknown>> = []
/** Alle `.eq(...)` des Laufs - fuer die Wache gegen den Wettlauf. */
let bedingungen: Array<{ spalte: string; wert: unknown }> = []
/** Alle Schreibvorgaenge mit Tabelle - fuer das Verwerfen. */
let schreibvorgaenge: Array<{ tabelle?: string; art: string; werte: unknown }> = []
/** Antwort auf das `single()` beim Speichern - fuer den PGRST116-Fall. */
let singleAntwort: { data: unknown; error: { message: string; code?: string } | null } | null = null
/** Was ein spaeteres maybeSingle auf `runs` liefert. */
let schonFertig: unknown = null
/** Laesst das Schreiben der Lauf-Zeile haengen - kein Netz beim Speichern. */
let hangSchreiben = false
// Antwort fuer die Nachholschleife (`bestaetigungNachholen`). Sie endet
// ohne `.single()`, laeuft also ueber `k.then` - und nur darueber, solange
// `hangSchreiben` den regulaeren Weg festhaelt.
let nachholFehler: { message: string; code?: string } | null = null
/** Antwort auf das Anlegen der Lauf-Zeile in `startRun`. */
let zeilenFehler: { message: string; code?: string } | null = null

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
    if (tabelle === 'runs') {
      if (nachholFehler) return Promise.resolve({ data: null, error: nachholFehler }).then(aufloesen)
      return Promise.resolve({ data: haengend, error: null }).then(aufloesen)
    }
    if (tabelle === 'run_points') {
      return Promise.resolve({ data: haengendePunkte, error: null }).then(aufloesen)
    }
    return Promise.resolve({ data: [], error: null }).then(aufloesen)
  }
  // Beide Wege festhalten: Mit vorhandener Lauf-Zeile schreibt stopRun ein
  // update, ohne (kein Netz beim Start) ein insert.
  const merken = (werte: Record<string, unknown>) => {
    if ('distance_km' in werte || 'duration_s' in werte) gespeichert = werte
    // Jeden Schreibvorgang mitschreiben, nicht nur die mit Kennzahlen. Das
    // Verwerfen schreibt `status` und `ended_at` - der Nachbau haette es
    // sonst nicht gesehen und der Test waere gruen geblieben, ohne etwas zu
    // pruefen.
    schreibvorgaenge.push({ tabelle, art: 'update', werte })
    return k
  }
  k.update = vi.fn(merken)
  k.insert = vi.fn((werte: Record<string, unknown>) => {
    merken(werte)
    // `startRun` legt die Zeile ohne `.single()` an und liest nur `error`.
    // Der Nachbau muss deshalb selbst ein Thenable mit genau dieser Antwort
    // liefern, sonst faellt der Aufruf auf `k.then` zurueck und meldet
    // immer Erfolg.
    if (tabelle === 'runs' && 'status' in werte) {
      return { then: (a: (w: unknown) => unknown) => Promise.resolve({ error: zeilenFehler }).then(a) }
    }
    return k
  })
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
  k.single = vi.fn(async () => {
    if (hangSchreiben) return new Promise(() => {})
    return singleAntwort ?? { data: { id: 'lauf-1' }, error: null }
  })
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
  merkerLoeschenFalls: vi.fn(),
  merkerDauerhaftGescheitert: vi.fn(),
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
    schreibvorgaenge = []
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

    // Ein Lauf, der vor zwei Stunden begann, 20 Punkte hat und nie
    // abgeschlossen wurde. Die letzte Messung liegt 90 Minuten zurueck - mit
    // Abstand jenseits von SCHONFRIST_MS (seit dem 29.08.2026 eine Stunde,
    // wegen des Zugfalls vom selben Tag; vorher fuenf Minuten).
    const vorZweiStunden = new Date(Date.now() - 120 * 60_000).toISOString()
    haengend = [{ id: 'haengt-1', status: 'tracking', started_at: vorZweiStunden }]
    haengendePunkte = punktfolge(20, Date.now() - 90 * 60_000).map((x) => ({
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
      // Mit Netz gestartet: Die Zeile steht seit `startRun`. Seit dem
      // 31.08.2026 sagt das `zeileSteht`, nicht mehr `activeRunId` allein.
      zeileSteht: true,
      startedAtMs: Date.now() - 600_000,
      liveStats: { ...useRun.getState().liveStats, distanceKm: 5 },
    } as never)

    const ergebnis = await useRun.getState().stopRun()

    expect(ergebnis.error).toBeNull()
    expect(ergebnis.runId).toBe('lauf-1')
    // Und NICHT zurueck in die Aufzeichnung.
    expect(useRun.getState().phase).not.toBe('tracking')
  })

  it('setzt die Lauf-Zeile beim Verwerfen auf abandoned', async () => {
    // Gefunden vom Agenten `oberflaeche`, 24.08.2026: "Verwerfen" war ohne
    // diese Zeile eine Luege.
    //
    // Die Lauf-Zeile entsteht beim START (damit die Punkte waehrend des
    // Laufs irgendwo hinkoennen) und blieb beim Verwerfen auf 'tracking'
    // stehen. `haengendeLaeufeAbschliessen` sammelt genau die ein - der
    // verworfene Lauf stuende SCHONFRIST_MS spaeter beim naechsten Start im
    // Verlauf.
    //
    // Sollwert-Begruendung: Geprueft wird nicht nur, DASS geschrieben wird,
    // sondern auch die Bedingung `status = 'tracking'`. Ohne sie koennte das
    // Update eine bereits abgeschlossene Zeile ueberschreiben - ein
    // gespeicherter Lauf wuerde nachtraeglich zu 'abandoned'.
    const useRun = await frischerStore()
    useRun.setState({
      phase: 'tracking',
      activeRunId: 'lauf-1',
      zeileSteht: true,
      sitzungId: 's-1',
    } as never)

    useRun.getState().discardRun()

    expect(schreibvorgaenge).toContainEqual(
      expect.objectContaining({ tabelle: 'runs', art: 'update' }),
    )
    const werte = schreibvorgaenge.find((v) => v.tabelle === 'runs' && v.art === 'update')?.werte
    expect((werte as { status?: string })?.status).toBe('abandoned')
    expect(bedingungen).toContainEqual({ spalte: 'status', wert: 'tracking' })
  })

  it('schreibt beim Verwerfen nichts, wenn es keine Lauf-Zeile gibt', async () => {
    // Ohne Netz beim Start entsteht keine Zeile. Dann gibt es auch nichts
    // aufzuraeumen - und ein Update auf `undefined` waere ein Fehler, kein
    // Aufraeumen.
    const useRun = await frischerStore()
    useRun.setState({ phase: 'tracking', activeRunId: null, sitzungId: 's-1' } as never)

    useRun.getState().discardRun()

    expect(schreibvorgaenge.filter((v) => v.tabelle === 'runs')).toEqual([])
  })

  it('startRun raeumt einen laufenden Speichervorgang NICHT ab', async () => {
    // Gefunden von `improve-codebase-architecture`, 24.08.2026.
    //
    // `startRun` setzt `...grundzustand()` - Punkte, Abschnitte,
    // Sitzungskennung auf Anfang. Waehrend eines Speichervorgangs waeren die
    // Puffer damit leer, bevor `stopRun` sie liest.
    //
    // Die Wache stand nur beim Aufrufer (`LiveTracking.tsx`), waehrend ein
    // Kommentar im Store sie als Eigenschaft der Funktion beschrieb. Ein
    // Doppeltipp oder eine gleichzeitige Bergung haette sie nicht gehabt.
    const useRun = await frischerStore()
    const punkte = [{ latitude: 1, longitude: 2, recorded_at: 'x' }]
    useRun.setState({
      phase: 'saving',
      sitzungId: 'sitzung-laeuft',
      points: punkte,
    } as never)

    useRun.getState().startRun()

    expect(useRun.getState().phase).toBe('saving')
    expect(useRun.getState().sitzungId).toBe('sitzung-laeuft')
    expect(useRun.getState().points).toEqual(punkte)
  })

  it('startRun laeuft nach einem gespeicherten Lauf wieder an', async () => {
    // Die Gegenrichtung: 'completed' darf starten, sonst waere nach dem
    // ersten Lauf Schluss.
    const useRun = await frischerStore()
    useRun.setState({ phase: 'completed' } as never)

    useRun.getState().startRun()

    expect(useRun.getState().phase).toBe('tracking')
  })

  it('faengt die zweite Aufzeichnung ohne Zeile an', async () => {
    // Gefunden von einem Lauf des Werkzeugs
    // `improve-codebase-architecture` am 31.08.2026, am Quelltext
    // nachgemessen: `zeileSteht` stand in `grundzustand()` NICHT und wurde
    // von `startRun` nicht gesetzt. Nach einem gespeicherten Lauf
    // (`run.ts:1465` setzt es auf true) blieb es fuer die ganze
    // App-Sitzung true - obwohl es fuer die naechste Aufzeichnung keine
    // Zeile gibt.
    //
    // Was daraus folgte, jede Stelle nachgelesen:
    //   `zeileNachziehen` steigt sofort aus  -> keine `runs`-Zeile
    //   die Aussparung in `punkteUebertragen` greift nicht -> 23503
    //   `stopRun` nimmt den `update`-Zweig   -> 0 Treffer, PGRST116
    //   -> 'ablage', dreimal, dann 'abgebrochen'
    //
    // Also: Der ZWEITE Lauf einer App-Sitzung waere verloren gewesen.
    const useRun = await frischerStore()
    useRun.setState({ phase: 'completed', zeileSteht: true } as never)

    useRun.getState().startRun()

    expect(useRun.getState().zeileSteht).toBe(false)
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
      if (geliefert) return { punkte: [], offen: 0 }
      geliefert = true
      // offen === punkte.length: alles ausgeliefert, nichts wartet mehr.
      return { punkte, offen: punkte.length }
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
      if (geliefert) return { punkte: [], offen: 0 }
      geliefert = true
      // offen === punkte.length: alles ausgeliefert, nichts wartet mehr.
      return { punkte, offen: punkte.length }
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

    bruecke.punkteAbholen.mockResolvedValue({ punkte: [], offen: 0 })

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
      if (geliefert) return { punkte: [], offen: 0 }
      geliefert = true
      // offen === punkte.length: alles ausgeliefert, nichts wartet mehr.
      return { punkte, offen: punkte.length }
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
    if (geliefert) return { punkte: [], offen: 0 }
    geliefert = true
    // offen === punkte.length: alles ausgeliefert, nichts wartet mehr.
    return { punkte, offen: punkte.length }
  })

  const useRun = await frischerStore()
  const ergebnis = await useRun.getState().verwaisteAufzeichnungBergen()

  expect(ergebnis?.ergebnis).toBe('gespeichert')
  expect(gespeichert?.duration_s as number).toBeGreaterThan(3000)
}

/**
 * Die Einsammelschleife: wann hoert sie auf?
 *
 * Warum es diese Tests gibt
 * -------------------------
 * Die Abbruchbedingung wurde am 28.08.2026 von `punkte.length < 500` auf
 * `offen <= punkte.length` umgestellt. Der Agent `pruefung` hat angestrichen,
 * dass **kein einziger Test mehr als eine Runde der Schleife ausfuehrt** -
 * weder vor noch nach der Umstellung. Jede Zusicherung waere gruen geblieben,
 * wenn man die Bedingung umdreht, streicht oder durch `false` ersetzt.
 *
 * Das ist die teuerste Sorte Luecke: Die Schleife meldet auch dann eine Zahl,
 * wenn sie zu frueh aufgehoert hat. Niemandem faellt etwas auf - die Punkte
 * bleiben einfach liegen.
 */
describe('Einsammelschleife', () => {
  beforeEach(() => {
    bruecke.punkteBestaetigen.mockClear()
  })

  async function schleifeFahren(runden: Array<{ punkte: unknown[]; offen: number | null }>) {
    let i = 0
    bruecke.punkteAbholen.mockImplementation(async () => {
      const r = runden[i] ?? { punkte: [], offen: 0 }
      i++
      return r
    })
    const useRun = await frischerStore()
    useRun.setState({ sitzungId: 'lauf-1', phase: 'tracking' })
    return useRun.getState().punkteEinsammeln()
  }

  it('holt das zweite Buendel, wenn der Dienst mehr offene Punkte meldet', async () => {
    // 600 warten, 500 kommen je Runde. Der Sollwert ist 600 und nicht 500:
    // Bei `offen <= punkte.length` als einzigem Abbruch waere nach der
    // ersten Runde Schluss, und 100 Punkte blieben im Dienstspeicher.
    const gesamt = await schleifeFahren([
      { punkte: punktfolge(500, 1_700_000_000_000), offen: 600 },
      { punkte: punktfolge(100, 1_700_000_600_000), offen: 100 },
    ])
    expect(gesamt).toBe(600)
    expect(bruecke.punkteBestaetigen).toHaveBeenCalledTimes(2)
  })

  it('hoert auf, sobald der Dienst nichts mehr offen hat', async () => {
    // Der Gegenfall zum vorigen Test - ohne ihn wuerde auch eine Schleife
    // bestehen, die einfach nie abbricht.
    const gesamt = await schleifeFahren([
      { punkte: punktfolge(60, 1_700_000_000_000), offen: 60 },
    ])
    expect(gesamt).toBe(60)
    expect(bruecke.punkteBestaetigen).toHaveBeenCalledTimes(1)
  })

  it('laeuft weiter, wenn der Dienst nicht zaehlen konnte', async () => {
    // `offen === null` heisst "unbekannt", nicht "nichts mehr da". Die
    // native Zaehlung lieferte bis zum 28.08.2026 in diesem Fall eine 0 -
    // ununterscheidbar von leer, und die Schleife haette aufgehoert.
    const gesamt = await schleifeFahren([
      { punkte: punktfolge(500, 1_700_000_000_000), offen: null },
      { punkte: punktfolge(40, 1_700_000_600_000), offen: 40 },
    ])
    expect(gesamt).toBe(540)
  })
})

/**
 * Beenden ohne Netz.
 *
 * Der Feldfall vom 28.08.2026: Ein Lauf ueber 6,9 km liess sich im Zug nicht
 * beenden. Im Protokoll des Geraets zweimal
 * "Lauf beenden fehlgeschlagen (zeitgrenze): Die Anmeldung pruefen hat
 * laenger als 20 Sekunden gedauert" - und derselbe Knopf lief 25 Minuten
 * spaeter zu Hause durch. Der Lauf blieb bis dahin offen.
 *
 * Beide Tests hier standen bis zum 29.08.2026 als `it.fails`: Sie pruefen
 * nicht das damalige Verhalten, sondern das gewuenschte - ein Lauf muss sich
 * abschliessen lassen, auch wenn das Netz schweigt. Der erste drehte nach
 * Stufe 2 (die Anmeldepruefung im Beenden-Pfad ist weg), der zweite nach
 * Stufe 4 (eine Zeitgrenze beim SCHREIBEN ist kein Stoppfehler mehr).
 */
describe('Beenden ohne Netz', () => {
  afterEach(() => {
    hangSchreiben = false
  })

  async function beendenVersuchen() {
      const useRun = await frischerStore()
      useRun.setState({
        phase: 'tracking',
        activeRunId: 'lauf-1',
      // Mit Netz gestartet: Die Zeile steht seit `startRun`. Seit dem
      // 31.08.2026 sagt das `zeileSteht`, nicht mehr `activeRunId` allein.
      zeileSteht: true,
        sitzungId: 'sitzung-1',
        startedAtMs: Date.now() - 600_000,
        liveStats: { ...useRun.getState().liveStats, distanceKm: 6.9 },
      } as never)

      const laeuft = useRun.getState().stopRun()
      // Ueber die Zeitgrenze hinweg - ohne echtes Warten.
      await vi.advanceTimersByTimeAsync(25_000)
      return { ergebnis: await laeuft, useRun }
  }

  // Am 29.08.2026 von `it.fails` auf `it` gedreht: Die Anmeldepruefung im
  // Beenden-Pfad ist weg, der Lauf schliesst ohne Netz ab. Genau dafuer ist
  // die Konvention da - der Test wurde ROT, als der Fehler verschwand.
  it('speichert den Lauf, auch wenn die Anmeldepruefung nie antwortet', async () => {
    vi.useFakeTimers()
    try {
      const { supabase } = (await import('../lib/supabase')) as unknown as {
        supabase: { auth: { getUser: ReturnType<typeof vi.fn> } }
      }
      // Kein Netz: die Pruefung antwortet nie. Genau das tat sie im Zug.
      supabase.auth.getUser.mockImplementation(() => new Promise(() => {}))
      const { ergebnis, useRun } = await beendenVersuchen()

      // Das Symptom: Der Lauf muss gespeichert sein.
      expect(gespeichert?.status).toBe('completed')
      expect(ergebnis.art).not.toBe('zeitgrenze')
      expect(useRun.getState().phase).not.toBe('tracking')
    } finally {
      vi.useRealTimers()
    }
  })

  // Am 29.08.2026 von `it.fails` auf `it` gedreht: Eine Zeitgrenze beim
  // SCHREIBEN ist kein Stoppfehler mehr - `stopRun` gibt den Lauf sofort
  // frei (`bestaetigt: false`) und `bestaetigungNachholen` holt die
  // Bestaetigung im Hintergrund nach. Genau dafuer ist die Konvention da -
  // der Test wurde ROT, als die alte Rueckkehr-in-die-Aufzeichnung wegfiel.
  it('speichert den Lauf, auch wenn das Schreiben der Zeile haengt', async () => {
    // Der zweite Befund, und der wichtigere: `getUser` gegen `getSession` zu
    // tauschen wuerde den Feldfall NICHT loesen - die Grenze wanderte nur
    // eine Stelle weiter. Gemessen am 28.08.2026: Anmeldung antwortet,
    // Schreiben haengt, Ergebnis wieder `zeitgrenze`.
    vi.useFakeTimers()
    try {
      hangSchreiben = true
      const { ergebnis, useRun } = await beendenVersuchen()
      expect(gespeichert?.status).toBe('completed')
      expect(ergebnis.art).not.toBe('zeitgrenze')
      expect(ergebnis.art).toBeNull()
      // Noch nicht bestaetigt - die Nutzlast ist raus, die Antwort steht
      // aus. `bestaetigungNachholen` versucht im Hintergrund weiter.
      expect(ergebnis.bestaetigt).toBe(false)
      // Aber die ZEILE steht: Dieser Lauf wurde mit Netz gestartet
      // (`activeRunId: 'lauf-1'`), nur das Beenden lief in die Zeitgrenze.
      // Bis zum 31.08.2026 gab dieser Zweig fuer beide Faelle
      // `bestaetigt: false` zurueck - und der Tagebucheintrag verlor seine
      // Verknuepfung, obwohl der Fremdschluessel erfuellt gewesen waere.
      expect(ergebnis.zeileSteht).toBe(true)
      expect(ergebnis.runId).toBe('lauf-1')
      expect(useRun.getState().phase).toBe('completed')
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * Der Merker und die Zeile, die es noch nicht gibt.
 *
 * Gefunden bei der Durchsicht des Stufe-4-Umbaus am 29.08.2026, am Quelltext
 * nachgeprueft und hier nachgestellt.
 *
 * Seit `stopRun` bei einer Zeitgrenze am Schreiben sofort freigibt, loeschte
 * es den Merker in JEDEM Fall - auch im `upsert`-Fall, in dem die Lauf-Zeile
 * noch gar nicht existiert. Danach war die Lage:
 *
 *   keine `runs`-Zeile   -> `haengendeLaeufeAbschliessen` findet nichts
 *   kein Merker          -> `verwaisteAufzeichnungBergen` findet nichts
 *   Dienst gestoppt      -> auch der Rueckfall ueber den Dienst faellt weg
 *
 * Stirbt die App, bevor `bestaetigungNachholen` durchkommt, ist der Lauf
 * weg. Vorher fuehrte dieser Fall ueber `abbruchUndWeiterAufzeichnen`, und
 * die laesst den Merker ausdruecklich liegen.
 *
 * NACHGETRAGEN am 29.08.2026, 16:40, nach einem Lauf des Agenten `pruefung`
 * -------------------------------------------------------------------------
 * Hier stand, gepufferte Punkte zeigten sonst dauerhaft auf eine nie
 * entstehende Zeile und blockierten ueber den Fremdschluessel jede weitere
 * Uebertragung. **Das war falsch, und der Fehler war meiner.** Im
 * `upsert`-Fall existiert kein einziger gepufferter Punkt: `addPoint`
 * puffert nur `if (runId)` mit `runId = get().activeRunId`, und die ist
 * dort den ganzen Lauf `null`.
 *
 * Und diese Tests belegen weniger, als ihr Name verspricht: Sie pruefen,
 * dass der Merker nicht geloescht WIRD - nicht, dass danach eine Bergung
 * gelingt. Sie gelingt nicht. Der Dienst ist gestoppt und sein Speicher
 * quittiert, also urteilt `bergungsurteil` beim naechsten Start 'nichts'
 * und `verwaisteAufzeichnungBergen` loescht den Merker selbst.
 *
 * Die Tests bleiben, weil die Zusicherung fuer sich richtig ist und die
 * Gegenprobe haelt. Sie sind aber KEIN Beleg dafuer, dass der Lauf gerettet
 * ist. Der wirkliche Verlustweg ist aelter als dieser Diff und steht als
 * eigener offener Punkt.
 */
describe('Merker bei ausstehender Bestaetigung', () => {
  // Ohne dieses Aufraeumen sah der dritte Test den Loeschaufruf des zweiten
  // und war gruen aus dem falschen Grund. Gefunden beim ersten Gruen-Lauf.
  beforeEach(() => {
    merker.merkerLoeschen.mockClear()
    merker.merkerLoeschenFalls.mockClear()
    merker.merkerDauerhaftGescheitert.mockClear()
  })

  afterEach(() => {
    hangSchreiben = false
    nachholFehler = null
  })

  /**
   * @param vorhandeneId `null` stellt den `upsert`-Fall her: kein Netz beim
   *   Start, also keine Lauf-Zeile.
   * @param vorspulenMs 21 s reichen ueber die Zeitgrenze (20 s), aber NICHT
   *   bis zum ersten Nachholversuch (weitere 5 s). Genau dieses Fenster ist
   *   der gefaehrliche Zustand.
   */
  async function beenden(vorhandeneId: string | null, vorspulenMs: number) {
    const useRun = await frischerStore()
    useRun.setState({
      phase: 'tracking',
      activeRunId: vorhandeneId ?? 'sitzung-1',
      zeileSteht: vorhandeneId !== null,
      sitzungId: 'sitzung-1',
      startedAtMs: Date.now() - 600_000,
      liveStats: { ...useRun.getState().liveStats, distanceKm: 6.9 },
    } as never)
    const laeuft = useRun.getState().stopRun()
    await vi.advanceTimersByTimeAsync(vorspulenMs)
    return { ergebnis: await laeuft, useRun }
  }

  it('behaelt den Merker, solange die Lauf-Zeile nicht bestaetigt ist', async () => {
    vi.useFakeTimers()
    try {
      hangSchreiben = true
      const { ergebnis } = await beenden(null, 21_000)

      // Der Lauf ist fuer den Menschen fertig - das ist der Sinn von Stufe 4
      // und bleibt so.
      expect(ergebnis.art).toBeNull()
      expect(ergebnis.bestaetigt).toBe(false)
      // Der Gegenfall zum Test in "Beenden ohne Netz": Hier gab es beim
      // Start kein Netz, also auch keine Zeile - der Fremdschluessel waere
      // verletzt, die Verknuepfung muss wegbleiben.
      expect(ergebnis.zeileSteht).toBe(false)

      // Aber der letzte Weg zurueck darf noch nicht weg sein. Es gibt keine
      // Zeile, auf die eine Bergung sonst noch stossen koennte.
      expect(merker.merkerLoeschen).not.toHaveBeenCalled()
      expect(merker.merkerLoeschenFalls).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('loescht den Merker im update-Fall weiterhin sofort', async () => {
    // Der Gegenfall. Ohne ihn waere auch eine Fassung gruen, die den Merker
    // gar nicht mehr aufraeumt - und die Bergung fragte bei jedem Start nach
    // einem Lauf, der laengst in der Datenbank steht.
    vi.useFakeTimers()
    try {
      hangSchreiben = true
      await beenden('lauf-1', 21_000)
      expect(merker.merkerLoeschen).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('raeumt den Merker nach, sobald die Bestaetigung ankommt', async () => {
    // Und er muss auch wieder weggehen - sonst meldet jeder Start eine
    // Aufzeichnung, die es nicht mehr gibt.
    //
    // Gebunden an die Sitzung, nicht blind: Zwischen dem Beenden und dem
    // Nachholen kann ein NEUER Lauf gestartet sein, der seinen eigenen
    // Merker gesetzt hat. Ein blindes Loeschen traefe dann ihn - derselbe
    // Fehler, nur eine Runde spaeter.
    vi.useFakeTimers()
    try {
      hangSchreiben = true
      await beenden(null, 40_000)
      expect(merker.merkerLoeschenFalls).toHaveBeenCalledWith('sitzung-1')
      expect(merker.merkerLoeschen).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('hoert bei einem dauerhaften Fehler auf, statt eine Stunde anzurennen', async () => {
    // 23503 ist die Fremdschluessel-Verletzung - Klasse 23, dieselbe Liste
    // wie in `lib/stoppfehler.ts`. Sie wird durch Warten nicht besser.
    //
    // Ohne diese Unterscheidung lief die Schleife bis SCHONFRIST_MS (eine
    // Stunde) gegen dieselbe Wand und gab danach stillschweigend auf: Der
    // Mensch hat seinen Lauf gesehen, gespeichert wurde nie etwas, gesagt
    // hat es niemand.
    vi.useFakeTimers()
    try {
      hangSchreiben = true
      nachholFehler = { message: 'verletzt', code: '23503' }
      await beenden(null, 40_000)

      // Die Marke ueberlebt den Neustart. Die Bergung fragt beim naechsten
      // Start den Menschen, statt es blind zu wiederholen.
      expect(merker.merkerDauerhaftGescheitert).toHaveBeenCalled()
      // Und der Merker bleibt liegen - er ist der einzige Rueckweg.
      expect(merker.merkerLoeschen).not.toHaveBeenCalled()
      expect(merker.merkerLoeschenFalls).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * Der Punktepuffer und fremde Laeufe.
 *
 * Gefunden vom Agenten `sicherheit` am 28.08.2026, am Quelltext nachgeprueft:
 * `offenePunkte()` liefert ALLES aus dem Puffer - ohne Filter nach Konto,
 * Sitzung oder Lauf. `stopRun` schreibt daraus jeden Punkt mit fremder
 * Kennung auf den gerade beendeten Lauf um (`run.ts:1033`).
 *
 * Zusammen mit der zweiten Luecke - der Puffer wird beim Abmelden nicht
 * geraeumt - ergibt das einen Weg zwischen Konten:
 *
 *   Konto A laeuft ohne Netz   -> Punkte bleiben im Puffer
 *   A meldet sich ab           -> Puffer bleibt stehen
 *   B meldet sich an, startet ohne Netz, beendet
 *   -> A's Messpunkte tragen B's run_id und passieren die Zeilenrechte,
 *      weil der Lauf dann B gehoert.
 *
 * Die Zeilenrechte greifen hier nicht. Der Fehler liegt davor, in der App.
 */
describe('Punktepuffer und fremde Laeufe', () => {
  it('adoptiert keine Punkte, die zu einem fremden Lauf gehoeren', async () => {
    const puffer = (await import('../lib/punktePuffer')) as unknown as {
      offenePunkte: ReturnType<typeof vi.fn>
      punktMerken: ReturnType<typeof vi.fn>
    }
    puffer.punktMerken.mockClear()
    // Ein Punkt aus einem Lauf, der diesem Konto nicht gehoert.
    puffer.offenePunkte.mockResolvedValue([
      {
        client_id: 'fremd-1',
        run_id: 'lauf-von-konto-A',
        latitude: 50.94,
        longitude: 6.96,
        altitude_m: null,
        accuracy_m: 5,
        speed_mps: 2,
        recorded_at: new Date().toISOString(),
        urteil: 'gezaehlt',
      },
    ])

    const useRun = await frischerStore()
    // activeRunId null heisst: keine Lauf-Zeile, also der Adoptionszweig.
    useRun.setState({
      phase: 'tracking',
      activeRunId: null,
      sitzungId: 'sitzung-B',
      startedAtMs: Date.now() - 600_000,
      liveStats: { ...useRun.getState().liveStats, distanceKm: 3 },
    } as never)

    await useRun.getState().stopRun()

    // Der fremde Punkt darf NICHT auf den eigenen Lauf umgeschrieben werden.
    const umgeschrieben = puffer.punktMerken.mock.calls.filter(
      (aufruf) => (aufruf[0] as { client_id?: string })?.client_id === 'fremd-1',
    )
    expect(umgeschrieben).toEqual([])
  })
})

/**
 * Ein Lauf ohne Netz beim Start - der Wurzelfund.
 *
 * Gefunden am 29.08.2026 beim Entwurf, am Quelltext nachgemessen:
 * `startRun` hatte genau EINEN Schuss auf die `runs`-Zeile, ohne
 * Fehlerbehandlung und ohne Wiederholung. Gelang er nicht, blieb
 * `activeRunId` den ganzen Lauf `null` - und `addPoint` puffert nur
 * `if (runId)`.
 *
 * Die Folge trifft nicht nur den Fehlerfall: Ein so gestarteter Lauf
 * bekommt am Ende eine `runs`-Zeile mit Strecke, Dauer und Hoehenmetern -
 * und NULL `run_points`. Die Karte bleibt leer, die Strecke steht als Zahl
 * daneben.
 *
 * Behoben mit F1/A2 (`docs/lauf-ohne-netz-entwurf.md`): Das Geraet vergibt
 * die Kennung, `activeRunId` steht ab der ersten Sekunde, und ob die ZEILE
 * existiert, sagt das eigene Merkmal `zeileSteht`.
 */
/**
 * Laesst die angestossene, nicht abgewartete Zeilen-Anlage zu Ende laufen.
 *
 * `startRun` ruft `zeileNachziehen` bewusst ohne `await` - der Knopfdruck
 * soll nicht auf das Netz warten. Ein einzelnes `await Promise.resolve()`
 * reicht dafuer nicht: Zwischen Aufruf und `set` liegen mehrere
 * Mikroschritte.
 */
async function durchlaufen() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

describe('Lauf ohne Netz beim Start', () => {
  beforeEach(() => {
    zeilenFehler = null
  })
  afterEach(() => {
    zeilenFehler = null
  })

  async function startenOhneNetz() {
    const useRun = await frischerStore()
    zeilenFehler = { code: '08006', message: 'connection failure' }
    useRun.getState().startRun()
    await durchlaufen()
    return useRun
  }

  it('puffert die Punkte trotzdem - unter der eigenen Kennung', async () => {
    const puffer = (await import('../lib/punktePuffer')) as unknown as {
      punktMerken: ReturnType<typeof vi.fn>
    }
    puffer.punktMerken.mockClear()

    const useRun = await startenOhneNetz()
    const sitzung = useRun.getState().sitzungId

    // Ohne Netz gibt es keine Zeile - aber eine Kennung gibt es sofort.
    expect(useRun.getState().zeileSteht).toBe(false)
    expect(useRun.getState().activeRunId).toBe(sitzung)

    // Die Feldnamen kommen aus `RohMessung` (run.ts:208) - nachgesehen,
    // nicht geraten. Eine erfundene Form haette hier eine Ausnahme aus der
    // Zeitrechnung ergeben und wie ein Fachfehler ausgesehen.
    useRun.getState().addPoint({
      latitude: 52.5,
      longitude: 13.4,
      altitude_m: 40,
      accuracy_m: 5,
      speed_mps: 3,
      zeitMs: Date.now(),
    } as never)

    // Der Wurzelfund: Hier stand vorher NICHTS im Puffer.
    expect(puffer.punktMerken).toHaveBeenCalled()
    expect(puffer.punktMerken.mock.calls[0][0].run_id).toBe(sitzung)
  })

  it('haelt die Zeile fuer vorhanden, wenn sie schon existiert (23505)', async () => {
    // Auflage 1 des Agenten `sicherheit`: Mit der geraetevergebenen Kennung
    // UND dem Nachholversuch im Takt ist der Doppelversuch der NORMALFALL -
    // der erste Versuch landet doch, der zweite trifft den eigenen
    // Schluessel. Waere das ein Fehler, griffe `merkerDauerhaftGescheitert`
    // und der Mensch wuerde gefragt, ob er den Lauf verwirft: ein neuer
    // Verlustpfad, eingebaut durch eine Verbesserung.
    const useRun = await frischerStore()
    zeilenFehler = { code: '23505', message: 'duplicate key' }
    useRun.getState().startRun()
    await durchlaufen()

    expect(useRun.getState().zeileSteht).toBe(true)
  })

  it('setzt zeileSteht NICHT aus dem blossen Ausbleiben eines Fehlers', async () => {
    // Auflage 2: nur aus einer positiven Antwort. Der Gegenfall - ein
    // dauerhafter Fehler, der NICHT 23505 ist, darf die Zeile nicht als
    // stehend gelten lassen, sonst schickt `offeneSenden` Punkte gegen
    // etwas, das es nicht gibt.
    const useRun = await frischerStore()
    zeilenFehler = { code: '42501', message: 'permission denied' }
    useRun.getState().startRun()
    await durchlaufen()

    expect(useRun.getState().zeileSteht).toBe(false)
  })
})
