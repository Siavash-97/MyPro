import { describe, expect, it } from 'vitest'
import { haversineM } from './geo'
import {
  BEWEGUNG_MPS,
  HALTEZEIT_MS,
  MIN_SEGMENT_M,
  NETTO_FENSTER_MS,
  RUHE_MIN_PROBEN,
  Ruhepegel,
  START_ZUSTAND,
  bewegungFortschreiben,
  nettoVerschiebungM,
  stehtStill,
  tempoErmitteln,
  tempoJetztMps,
  torMps,
  type Bewegungszustand,
  type Ortung,
} from './bewegung'

/**
 * Zufall mit festem Startwert.
 *
 * Ein Test, der bei jedem Lauf andere Zahlen zieht, ist entweder manchmal rot
 * ohne Grund oder manchmal gruen ohne Grund. Beides ist wertlos.
 */
function wuerfel(startwert: number) {
  let zustand = startwert
  return () => {
    zustand = (zustand * 1103515245 + 12345) % 2147483648
    return zustand / 2147483648
  }
}

/** Zwei Gleichverteilte zu einer Normalverteilten (Box-Muller). */
function normal(rnd: () => number, streuung: number): number {
  const u = Math.max(rnd(), 1e-9)
  const v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * streuung
}

/**
 * Eine Rauschquelle, die sich wie GPS verhaelt.
 *
 * Der erste Anlauf dieser Tests zog fuer jede Messung unabhaengiges Rauschen.
 * Das ist falsch, und der Test hat es gezeigt: Ein echter Lauf kam mit
 * 3873 statt 1800 Metern heraus, weil bei unabhaengigem Rauschen jeder
 * einzelne Punkt in eine andere Richtung springt und die Summe der Abstaende
 * aufblaeht.
 *
 * Echter GPS-Fehler haengt zusammen: Er stammt aus Mehrwegempfang und
 * Satellitengeometrie und wandert langsam, statt zu springen. Deshalb ein
 * AR(1)-Prozess - jeder Wert traegt den vorigen zu einem grossen Teil weiter.
 * Die Streuung ueber lange Zeit bleibt dabei die angegebene.
 *
 * Genau diese Einschraenkung steht auch bei scripts/gps_drift_messung.py und
 * in docs/gps-genauigkeit.md: Ein Modell mit unabhaengigem Rauschen ist zu
 * hart fuer Distanzschwellen.
 */
function rauschquelle(rnd: () => number, streuung: number, traegheit = 0.9) {
  let wert = 0
  const anteil = Math.sqrt(1 - traegheit * traegheit)
  return () => {
    wert = traegheit * wert + anteil * normal(rnd, streuung)
    return wert
  }
}

const LAT = 52.52
const LON = 13.405
const M_JE_GRAD_LAT = 111_320
const M_JE_GRAD_LON = 111_320 * Math.cos((LAT * Math.PI) / 180)

function ortung(teil: Partial<Ortung> & { zeit: number }): Ortung {
  return {
    latitude: LAT,
    longitude: LON,
    genauigkeitM: 10,
    gemeldetesTempoMps: 0,
    ...teil,
  }
}

/** Eine Ortung, die um `meter` nach Osten versetzt ist. */
function ostwaerts(meter: number, teil: Partial<Ortung> & { zeit: number }): Ortung {
  return ortung({ ...teil, longitude: LON + meter / M_JE_GRAD_LON })
}

describe('tempoErmitteln', () => {
  it('nimmt das gemeldete Tempo, nicht die Rechnung aus zwei Punkten', () => {
    // Die beiden Punkte liegen 50 m auseinander, das waeren 50 m/s. Das
    // Geraet meldet 3 m/s. Gilt das Geraet.
    const vorher = ortung({ zeit: 0 })
    const jetzt = ostwaerts(50, { zeit: 1000, gemeldetesTempoMps: 3 })
    const { mps, ausMessung } = tempoErmitteln(jetzt, vorher)
    expect(mps).toBe(3)
    expect(ausMessung).toBe(true)
  })

  it('nimmt eine gemeldete Null ernst, statt auf die Rechnung auszuweichen', () => {
    // Der wichtigste Fall ueberhaupt: Das Geraet sagt "steht", die Positionen
    // rauschen trotzdem um 12 m. Wer hier auf Distanz durch Zeit umschaltet,
    // legt genau das Werkzeug weg, das er gerade braucht.
    const vorher = ortung({ zeit: 0 })
    const jetzt = ostwaerts(12, { zeit: 1000, gemeldetesTempoMps: 0 })
    expect(tempoErmitteln(jetzt, vorher)).toEqual({ mps: 0, ausMessung: true })
  })

  it('faellt auf Distanz durch Zeit zurueck, wenn nichts gemeldet wird', () => {
    const vorher = ortung({ zeit: 0 })
    const jetzt = ostwaerts(10, { zeit: 2000, gemeldetesTempoMps: null })
    const { mps, ausMessung } = tempoErmitteln(jetzt, vorher)
    expect(mps).toBeCloseTo(5, 1)
    expect(ausMessung).toBe(false)
  })

  it('verwirft ein negatives gemeldetes Tempo', () => {
    // Manche Geraete melden -1 statt null fuer "unbekannt".
    const vorher = ortung({ zeit: 0 })
    const jetzt = ostwaerts(10, { zeit: 1000, gemeldetesTempoMps: -1 })
    expect(tempoErmitteln(jetzt, vorher).ausMessung).toBe(false)
  })

  it('gibt null zurueck statt zu teilen, wenn keine Zeit vergangen ist', () => {
    const vorher = ortung({ zeit: 5000 })
    const jetzt = ostwaerts(10, { zeit: 5000, gemeldetesTempoMps: null })
    expect(tempoErmitteln(jetzt, vorher).mps).toBe(0)
  })

  it('kommt ohne Vorgaenger aus', () => {
    expect(tempoErmitteln(ortung({ zeit: 0, gemeldetesTempoMps: null }), null).mps).toBe(0)
  })
})

describe('torMps', () => {
  it('haelt die belegte Untergrenze, solange nichts gemessen wurde', () => {
    expect(torMps(null)).toBe(BEWEGUNG_MPS)
  })

  it('senkt das Tor nie, auch bei einem sehr ruhigen Geraet', () => {
    // Ein Geraet mit 0,02 m/s Ruhepegel bekommt trotzdem 0,9: Die Zahl
    // beschreibt nicht Rauschen, sondern was als Bewegung gelten soll.
    expect(torMps(0.02)).toBe(BEWEGUNG_MPS)
  })

  it('hebt das Tor bei einem unruhigen Geraet an', () => {
    // 1,3 m/s Ruhepegel: Ohne Anhebung wuerde dieses Telefon im Stand
    // dauerhaft Bewegung melden.
    expect(torMps(1.3)).toBeGreaterThan(BEWEGUNG_MPS)
    expect(torMps(1.3)).toBeCloseTo(1.5, 5)
  })
})

describe('Ruhepegel', () => {
  it('sagt nichts, solange zu wenige Messungen vorliegen', () => {
    const pegel = new Ruhepegel()
    for (let i = 0; i < RUHE_MIN_PROBEN - 1; i++) pegel.hinzufuegen(0.1)
    expect(pegel.wert()).toBeNull()
  })

  it('liefert das 95. Perzentil, nicht den Hoechstwert', () => {
    const pegel = new Ruhepegel()
    // 99 ruhige Messungen und ein Ausreisser. Das Perzentil darf sich vom
    // Ausreisser nicht mitreissen lassen - sonst genuegt ein einziger
    // schlechter Messwert, um das Tor dauerhaft zu verstellen.
    for (let i = 0; i < 99; i++) pegel.hinzufuegen(0.1)
    pegel.hinzufuegen(9)
    expect(pegel.wert()).toBeLessThan(1)
  })

  it('vergisst alte Messungen, damit er sich an neue Umgebungen anpasst', () => {
    const pegel = new Ruhepegel()
    for (let i = 0; i < 500; i++) pegel.hinzufuegen(2)
    for (let i = 0; i < 400; i++) pegel.hinzufuegen(0.05)
    expect(pegel.anzahl()).toBeLessThanOrEqual(300)
    expect(pegel.wert()).toBeLessThan(0.5)
  })

  it('weist unsinnige Werte ab', () => {
    const pegel = new Ruhepegel()
    pegel.hinzufuegen(Number.NaN)
    pegel.hinzufuegen(-3)
    pegel.hinzufuegen(Number.POSITIVE_INFINITY)
    expect(pegel.anzahl()).toBe(0)
  })
})

describe('nettoVerschiebung', () => {
  it('bleibt klein, waehrend die Weglaenge durch Rauschen waechst', () => {
    // Das ist der Kern: Ein liegendes Telefon legt eine lange Strecke
    // zurueck, kommt aber nicht vom Fleck.
    const rnd = wuerfel(7)
    const nordFehler = rauschquelle(rnd, 8)
    const ostFehler = rauschquelle(rnd, 8)
    const verlauf: Ortung[] = []
    let weglaenge = 0
    for (let i = 0; i <= 40; i++) {
      const o = ortung({
        zeit: i * 1000,
        latitude: LAT + nordFehler() / M_JE_GRAD_LAT,
        longitude: LON + ostFehler() / M_JE_GRAD_LON,
      })
      const vorher = verlauf.at(-1)
      if (vorher) {
        weglaenge += haversineM(vorher.latitude, vorher.longitude, o.latitude, o.longitude)
      }
      verlauf.push(o)
    }

    // Nicht gegen eine ausgedachte Meterzahl pruefen, sondern gegen das
    // Verhaeltnis - das ist die eigentliche Behauptung: Die zurueckgelegte
    // Weglaenge ist ein Vielfaches dessen, was netto herauskommt. Genau
    // diese Luecke war der Fehler, und genau sie schliesst das Mass.
    const netto = nettoVerschiebungM(verlauf, 40_000)
    expect(netto).not.toBeNull()
    expect(weglaenge).toBeGreaterThan(10 * (netto as number))
    expect(stehtStill(verlauf, 40_000)).toBe(true)
  })

  it('erkennt Gehen als Bewegung', () => {
    // 1,4 m/s ueber 30 Sekunden sind gut 40 Meter.
    const verlauf: Ortung[] = []
    for (let i = 0; i <= 35; i++) {
      verlauf.push(ostwaerts(i * 1.4, { zeit: i * 1000 }))
    }
    expect(stehtStill(verlauf, 35_000)).toBe(false)
  })

  it('urteilt nicht, solange das Fenster nicht voll ist', () => {
    // Sonst waere jeder Laufbeginn ein Stillstand.
    const verlauf = [ortung({ zeit: 0 }), ostwaerts(3, { zeit: 3000 })]
    expect(nettoVerschiebungM(verlauf, 3000)).toBeNull()
    expect(stehtStill(verlauf, 3000)).toBe(false)
  })
})

describe('bewegungFortschreiben', () => {
  const tor = BEWEGUNG_MPS

  it('startet die Bewegung beim ersten Wert ueber dem Tor', () => {
    const z = bewegungFortschreiben(START_ZUSTAND, ortung({ zeit: 0 }), 3, tor)
    expect(z.inBewegung).toBe(true)
  })

  it('haelt nicht wegen eines einzelnen schlechten Messwerts an', () => {
    let z = bewegungFortschreiben(START_ZUSTAND, ortung({ zeit: 0 }), 3, tor)
    z = bewegungFortschreiben(z, ortung({ zeit: 1000 }), 0.1, tor)
    z = bewegungFortschreiben(z, ortung({ zeit: 2000 }), 3, tor)
    expect(z.inBewegung).toBe(true)
  })

  it('haelt nach der Haltezeit an', () => {
    let z = bewegungFortschreiben(START_ZUSTAND, ortung({ zeit: 0 }), 3, tor)
    for (let t = 1000; t <= HALTEZEIT_MS + 1000; t += 1000) {
      z = bewegungFortschreiben(z, ortung({ zeit: t }), 0.1, tor)
    }
    expect(z.inBewegung).toBe(false)
    expect(z.haltepunkt).not.toBeNull()
  })

  it('laeuft NICHT wieder los, wenn nur das Tempo ausschlaegt', () => {
    // Der eigentliche Schutz: Im Stand schlaegt das gemeldete Tempo
    // gelegentlich ueber das Tor - der Ort bleibt aber derselbe. Ohne die
    // Wegbedingung wuerde jeder solche Ausschlag den Lauf neu starten und
    // das Rauschen wieder als Strecke zaehlen.
    let z = bewegungFortschreiben(START_ZUSTAND, ortung({ zeit: 0 }), 3, tor)
    for (let t = 1000; t <= HALTEZEIT_MS + 1000; t += 1000) {
      z = bewegungFortschreiben(z, ortung({ zeit: t }), 0.1, tor)
    }
    expect(z.inBewegung).toBe(false)

    // Ausschlag auf 5 m/s, aber nur 3 m vom Haltepunkt entfernt.
    z = bewegungFortschreiben(z, ostwaerts(3, { zeit: 20_000 }), 5, tor)
    expect(z.inBewegung).toBe(false)
  })

  it('laeuft wieder los, wenn Tempo UND Weg stimmen', () => {
    let z = bewegungFortschreiben(START_ZUSTAND, ortung({ zeit: 0 }), 3, tor)
    for (let t = 1000; t <= HALTEZEIT_MS + 1000; t += 1000) {
      z = bewegungFortschreiben(z, ortung({ zeit: t }), 0.1, tor)
    }
    z = bewegungFortschreiben(z, ostwaerts(25, { zeit: 20_000 }), 3, tor)
    expect(z.inBewegung).toBe(true)
  })

  it('verlangt bei schlechtem Empfang mehr Weg', () => {
    // Wer seine Position nur auf 40 m genau kennt, kann nicht behaupten,
    // sich 15 m bewegt zu haben.
    let z = bewegungFortschreiben(START_ZUSTAND, ortung({ zeit: 0 }), 3, tor)
    for (let t = 1000; t <= HALTEZEIT_MS + 1000; t += 1000) {
      z = bewegungFortschreiben(z, ortung({ zeit: t, genauigkeitM: 40 }), 0.1, tor)
    }
    const knapp = bewegungFortschreiben(
      z, ostwaerts(15, { zeit: 20_000, genauigkeitM: 40 }), 3, tor,
    )
    expect(knapp.inBewegung).toBe(false)

    const deutlich = bewegungFortschreiben(
      z, ostwaerts(45, { zeit: 20_000, genauigkeitM: 40 }), 3, tor,
    )
    expect(deutlich.inBewegung).toBe(true)
  })

  it('setzt auch ohne vorherige Bewegung einen Haltepunkt', () => {
    // Am Laufbeginn steht man, ohne je gelaufen zu sein. Ohne Haltepunkt
    // wuerde dort ein einzelner Rauschausschlag den Lauf starten.
    let z = START_ZUSTAND
    for (let t = 0; t <= HALTEZEIT_MS + 1000; t += 1000) {
      z = bewegungFortschreiben(z, ortung({ zeit: t }), 0.05, tor)
    }
    expect(z.haltepunkt).not.toBeNull()

    z = bewegungFortschreiben(z, ostwaerts(2, { zeit: 20_000 }), 4, tor)
    expect(z.inBewegung).toBe(false)
  })
})

describe('das eigentliche Fehlerbild: ein Telefon liegt still', () => {
  it('erfindet keine Strecke mehr', () => {
    // Nachgestellt, was gemessen wurde: eine halbe Stunde Stillstand mit
    // 8 m Streuung. Vorher entstanden daraus 7,3 Kilometer.
    //
    // Das Geraet meldet dabei einen kleinen Doppler-Restfehler, wie ihn
    // reale Telefone zeigen - nicht die saubere Null.
    const rnd = wuerfel(23)
    const nordFehler = rauschquelle(rnd, 8)
    const ostFehler = rauschquelle(rnd, 8)
    const verlauf: Ortung[] = []
    let zustand = START_ZUSTAND
    let strecke = 0
    let letzterAufgezeichneter: Ortung | null = null

    for (let i = 0; i < 30 * 60; i++) {
      const o = ortung({
        zeit: i * 1000,
        latitude: LAT + nordFehler() / M_JE_GRAD_LAT,
        longitude: LON + ostFehler() / M_JE_GRAD_LON,
        genauigkeitM: 16,
        gemeldetesTempoMps: Math.abs(normal(rnd, 0.15)),
      })
      verlauf.push(o)
      if (verlauf.length > 60) verlauf.shift()

      const vorherige = verlauf.length > 1 ? verlauf[verlauf.length - 2] : null
      const { mps } = tempoErmitteln(o, vorherige)
      zustand = bewegungFortschreiben(zustand, o, mps, torMps(null))

      if (!zustand.inBewegung) continue
      if (letzterAufgezeichneter) {
        const seg = haversineM(
          letzterAufgezeichneter.latitude,
          letzterAufgezeichneter.longitude,
          o.latitude,
          o.longitude,
        )
        if (seg < MIN_SEGMENT_M) continue
        strecke += seg
      }
      letzterAufgezeichneter = o
    }

    // Die ersten zehn Sekunden zaehlen noch als Bewegung - das ist die
    // Haltezeit und beabsichtigt. Danach ist Schluss.
    expect(strecke).toBeLessThan(100)
    expect(zustand.inBewegung).toBe(false)
  })

  it('laesst einen echten Lauf unangetastet', () => {
    // Gegenprobe. Ein Filter, der Rauschen wegnimmt und dabei auch das
    // Laufen verschluckt, ist kein Fortschritt.
    const rnd = wuerfel(5)
    const nordFehler = rauschquelle(rnd, 5)
    const ostFehler = rauschquelle(rnd, 5)
    const verlauf: Ortung[] = []
    let zustand = START_ZUSTAND
    let strecke = 0
    let letzterAufgezeichneter: Ortung | null = null

    const TEMPO = 3 // m/s, gut 5:30 min/km
    const SEKUNDEN = 600

    for (let i = 0; i < SEKUNDEN; i++) {
      const o = ortung({
        zeit: i * 1000,
        latitude: LAT + nordFehler() / M_JE_GRAD_LAT,
        longitude: LON + (i * TEMPO + ostFehler()) / M_JE_GRAD_LON,
        genauigkeitM: 10,
        gemeldetesTempoMps: TEMPO + normal(rnd, 0.3),
      })
      verlauf.push(o)
      if (verlauf.length > 60) verlauf.shift()

      const vorherige = verlauf.length > 1 ? verlauf[verlauf.length - 2] : null
      const { mps } = tempoErmitteln(o, vorherige)
      zustand = bewegungFortschreiben(zustand, o, mps, torMps(null))

      if (!zustand.inBewegung) continue
      if (letzterAufgezeichneter) {
        const seg = haversineM(
          letzterAufgezeichneter.latitude,
          letzterAufgezeichneter.longitude,
          o.latitude,
          o.longitude,
        )
        if (seg < MIN_SEGMENT_M) continue
        strecke += seg
      }
      letzterAufgezeichneter = o
    }

    // Echte Strecke: 600 s * 3 m/s = 1800 m. Das Rauschen laesst die
    // gemessene Summe etwas darueber liegen, das ist normal und bekannt.
    expect(zustand.inBewegung).toBe(true)
    expect(strecke).toBeGreaterThan(1700)
    expect(strecke).toBeLessThan(2200)
  })
})

describe('Fenstergroessen passen zusammen', () => {
  it('das Netto-Fenster ist laenger als die Haltezeit', () => {
    // Sonst wuerde der Ruhepegel Messungen aufnehmen, die schon zur
    // naechsten Bewegung gehoeren.
    expect(NETTO_FENSTER_MS).toBeGreaterThan(HALTEZEIT_MS)
  })
})

/**
 * Das Tempo im Moment.
 *
 * Anlass: Bahnfahrt und Fussweg am 21.08.2026. Die Anzeige brauchte sehr
 * lange, bis sie das tatsaechliche Tempo zeigte - weil dort der Schnitt des
 * ganzen Laufs stand und nicht das Tempo jetzt. Ein Schnitt kann sich nach
 * zehn Minuten pro Sekunde nur noch um ein Sechshundertstel bewegen.
 *
 * Diese Tests beschreiben, was stattdessen gelten soll. Sie sind vor der
 * Umsetzung geschrieben.
 */
describe('tempoJetztMps – das Tempo im Moment', () => {
  const BASIS = 1_700_000_000_000
  /** Ein Grad Breite sind rund 111.320 Meter. */
  const GRAD_PRO_METER = 1 / 111_320

  /** Messungen im Sekundentakt, jede mit gemeldetem Tempo. */
  function reihe(tempi: number[]): Ortung[] {
    return tempi.map((mps, i) => ({
      latitude: 52.5,
      longitude: 13.4,
      zeit: BASIS + i * 1000,
      genauigkeitM: 5,
      gemeldetesTempoMps: mps,
    }))
  }

  /** Messungen ohne gemeldetes Tempo, dafuer mit echtem Ortswechsel. */
  function reiheOhneTempo(mps: number, anzahl: number): Ortung[] {
    return Array.from({ length: anzahl }, (_, i) => ({
      latitude: 52.5 + i * mps * GRAD_PRO_METER,
      longitude: 13.4,
      zeit: BASIS + i * 1000,
      genauigkeitM: 5,
      gemeldetesTempoMps: null,
    }))
  }

  const zuletzt = (v: Ortung[]) => v[v.length - 1].zeit

  it('folgt einem Tempowechsel binnen fuenf Sekunden', () => {
    // Eine Minute gemuetlich, dann verdoppelt. Ein Schnitt haenge hier noch
    // bei rund 1,6 m/s fest; das Tempo jetzt muss oben sein.
    const verlauf = reihe([...new Array(60).fill(1.5), ...new Array(5).fill(3.0)])
    expect(tempoJetztMps(verlauf, zuletzt(verlauf))).toBeCloseTo(3.0, 1)
  })

  it('faellt nach einer Bahnfahrt binnen fuenf Sekunden auf Gehtempo', () => {
    // Der Fall vom 21.08.: erst Bahn, dann zu Fuss. Der Verlauf haelt nur
    // die letzten 60 Sekunden, deshalb der Schnitt.
    const alles = reihe([...new Array(300).fill(20), ...new Array(5).fill(1.4)])
    const verlauf = alles.slice(-60)
    expect(tempoJetztMps(verlauf, zuletzt(verlauf))).toBeCloseTo(1.4, 1)
  })

  it('laesst sich von einem einzelnen Ausreisser nicht kippen', () => {
    // Ein Sprung auf 12 m/s ist Empfangsrauschen, kein Sprint.
    const verlauf = reihe([2.0, 2.1, 12.0, 2.0, 2.1])
    const wert = tempoJetztMps(verlauf, zuletzt(verlauf))
    expect(wert).not.toBeNull()
    expect(wert!).toBeLessThan(3)
  })

  it('rechnet aus Positionen, wenn das Geraet kein Tempo meldet', () => {
    const verlauf = reiheOhneTempo(2.0, 6)
    expect(tempoJetztMps(verlauf, zuletzt(verlauf))).toBeCloseTo(2.0, 1)
  })

  it('meldet Stillstand als null Meter je Sekunde, nicht als Unwissen', () => {
    const verlauf = reihe([0, 0, 0, 0, 0])
    expect(tempoJetztMps(verlauf, zuletzt(verlauf))).toBe(0)
  })

  it('gibt nichts zurueck, wenn die juengste Messung zu alt ist', () => {
    const verlauf = reihe([2, 2, 2, 2, 2])
    expect(tempoJetztMps(verlauf, zuletzt(verlauf) + 30_000)).toBeNull()
  })

  it('urteilt nicht ueber eine einzelne Messung', () => {
    const verlauf = reihe([2.0])
    expect(tempoJetztMps(verlauf, zuletzt(verlauf))).toBeNull()
  })

  it('urteilt nicht ueber einen leeren Verlauf', () => {
    expect(tempoJetztMps([], BASIS)).toBeNull()
  })
})

/**
 * Schritte als zweiter Zeuge.
 *
 * Das GPS sagt, ob sich der ORT aendert. Der Schrittsensor sagt, ob sich die
 * BEINE bewegen. Beides zusammen ist besser als eines allein - besonders
 * dort, wo der Empfang schwach ist und das GPS faelschlich Stillstand meldet.
 *
 * Wichtig: Der Sensor wird hier nur befragt, OB sich jemand bewegt. Eine
 * Schrittzahl zeigt die App nicht an; Schritte als Kennzahl kommen aus der
 * Einlage. Siehe messquellen.md.
 */
describe('bewegungFortschreiben mit Schrittsensor', () => {
  const BASIS = 1_700_000_000_000

  function ortung(zeit: number): Ortung {
    return {
      latitude: 52.5,
      longitude: 13.4,
      zeit,
      genauigkeitM: 50,
      gemeldetesTempoMps: 0,
    }
  }

  it('glaubt den Schritten, auch wenn das GPS Stillstand meldet', () => {
    // Haeuserschlucht: Der Empfaenger meldet null, die Person geht trotzdem.
    const zustand = { inBewegung: false, unterTorSeit: BASIS, haltepunkt: { latitude: 52.5, longitude: 13.4 } }
    const neu = bewegungFortschreiben(zustand, ortung(BASIS + 1000), 0, BEWEGUNG_MPS, 1.6)
    expect(neu.inBewegung).toBe(true)
  })

  it('verlangt bei Schritten keinen Mindestweg', () => {
    // Ohne Schritte braeuchte es zehn bis fuenfzig Meter Abstand zum
    // Haltepunkt. Schritte sind der direktere Beweis.
    const zustand = { inBewegung: false, unterTorSeit: BASIS, haltepunkt: { latitude: 52.5, longitude: 13.4 } }
    const ohne = bewegungFortschreiben(zustand, ortung(BASIS + 1000), 2.5, BEWEGUNG_MPS, null)
    const mit = bewegungFortschreiben(zustand, ortung(BASIS + 1000), 2.5, BEWEGUNG_MPS, 1.6)
    expect(ohne.inBewegung).toBe(false)
    expect(mit.inBewegung).toBe(true)
  })

  it('laesst sich von vereinzelten Schritten nicht taeuschen', () => {
    // Gewicht verlagern, im Stehen wippen: einzelne Ereignisse, kein Gehen.
    const zustand = { inBewegung: false, unterTorSeit: BASIS, haltepunkt: { latitude: 52.5, longitude: 13.4 } }
    const neu = bewegungFortschreiben(zustand, ortung(BASIS + 1000), 0, BEWEGUNG_MPS, 0.4)
    expect(neu.inBewegung).toBe(false)
  })

  it('haelt den Lauf, solange Schritte kommen - auch bei GPS-Ausfall', () => {
    // Der Halt darf nur eintreten, wenn BEIDE Zeugen schweigen.
    let zustand: Bewegungszustand = { inBewegung: true, unterTorSeit: null, haltepunkt: null }
    for (let i = 1; i <= 30; i++) {
      zustand = bewegungFortschreiben(zustand, ortung(BASIS + i * 1000), 0, BEWEGUNG_MPS, 1.6)
    }
    expect(zustand.inBewegung).toBe(true)
  })

  it('haelt an, wenn beide Zeugen schweigen', () => {
    let zustand: Bewegungszustand = { inBewegung: true, unterTorSeit: null, haltepunkt: null }
    for (let i = 1; i <= 30; i++) {
      zustand = bewegungFortschreiben(zustand, ortung(BASIS + i * 1000), 0, BEWEGUNG_MPS, 0)
    }
    expect(zustand.inBewegung).toBe(false)
  })

  it('verhaelt sich ohne Sensor genau wie bisher', () => {
    // Kein Schrittsensor im Geraet, oder Berechtigung fehlt: null.
    let zustand: Bewegungszustand = { inBewegung: true, unterTorSeit: null, haltepunkt: null }
    for (let i = 1; i <= 30; i++) {
      zustand = bewegungFortschreiben(zustand, ortung(BASIS + i * 1000), 0, BEWEGUNG_MPS, null)
    }
    expect(zustand.inBewegung).toBe(false)
  })
})
