import { describe, it, expect } from 'vitest'
import {
  computeSplits,
  mittlereHoehe,
  hoeheAktualisieren,
  MIN_HOEHENSCHRITT_M,
  HOEHEN_FENSTER,
} from '../store/run'
import {
  BEWEGUNG_MPS,
  MAX_LUECKE_S,
  MAX_TEMPO_MPS,
  bewegungszeitAnteilS,
  istOrtungssprung,
} from './bewegung'
import { haversineKm } from './geo'
import messung from './__fixtures__/feldmessung-2026-08-22.json'

/**
 * Die Feldmessung vom 22.08.2026 als Pruefung.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * An diesem Abend liefen unsere App und Strava zwoelf Kilometer lang
 * gleichzeitig auf demselben Telefon - derselbe Empfaenger, dieselben
 * Satelliten, dieselbe Funklage. Jeder Unterschied war damit Software. Der
 * Messbericht dazu steht in
 * `Agent-Reports/2026-08-22_2055_messbericht-tracking-gegen-strava.md`.
 *
 * Seine Befunde standen danach in Prosa. Der Befund des ganzen Tages war
 * aber: **nur was eine Maschine prueft, haelt.** Also stehen sie jetzt hier.
 *
 * Wie die Datei zu lesen ist
 * --------------------------
 * Zwei Sorten Test:
 *
 *   `it(...)`        - was nachweislich funktioniert. Bleibt gruen.
 *   `it.fails(...)`  - ein bekannter Fehler, mit Messdaten festgenagelt.
 *                      Der Test ist gruen, SOLANGE der Fehler besteht.
 *                      Wird er behoben, wird der Test ROT und zwingt dazu,
 *                      ihn in ein normales `it` zu drehen.
 *
 * Die Zahlen in den Erwartungen sind **gemessen, nicht gewaehlt**. Wo eine
 * Toleranz steht, steht daneben, woher sie kommt.
 */

type Punkt = {
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  recorded_at: string
}

const ms = (iso: string) => new Date(iso).getTime()
const sekunden = (a: Punkt, b: Punkt) => (ms(b.recorded_at) - ms(a.recorded_at)) / 1000
const meter = (a: Punkt, b: Punkt) =>
  haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000

/** Punkte eines Zeitfensters. */
function fenster(punkte: Punkt[], von: string, bis: string): Punkt[] {
  return punkte.filter((p) => ms(p.recorded_at) >= ms(von) && ms(p.recorded_at) <= ms(bis))
}

/**
 * Bewegungszeit einer Punktfolge - nach derselben Regel wie die App.
 *
 * Benutzt `bewegungszeitAnteilS` aus dem Modul, rechnet also nicht nach,
 * sondern fragt.
 */
function bewegungszeitS(punkte: Punkt[]): number {
  let summe = 0
  for (let i = 1; i < punkte.length; i++) {
    summe += bewegungszeitAnteilS(sekunden(punkte[i - 1], punkte[i]), meter(punkte[i - 1], punkte[i]))
  }
  return summe
}

/** Strecke einer Punktfolge, mit dem Sprungfilter der App. */
function streckeM(punkte: Punkt[]): number {
  let summe = 0
  for (let i = 1; i < punkte.length; i++) {
    const s = sekunden(punkte[i - 1], punkte[i])
    const m = meter(punkte[i - 1], punkte[i])
    if (istOrtungssprung(m, s)) continue
    summe += m
  }
  return summe
}

/** Hoehengewinn - mit den echten Funktionen aus dem Speicher. */
function hoehengewinnM(punkte: Punkt[]): number {
  let bezug: number | null = null
  let summe = 0
  for (let i = 0; i < punkte.length; i++) {
    const geglaettet = mittlereHoehe(
      punkte.slice(Math.max(0, i - HOEHEN_FENSTER + 1), i + 1) as never,
    )
    if (geglaettet == null) continue
    bezug = hoeheAktualisieren(geglaettet, bezug, (zuwachs) => {
      summe += zuwachs
    })
  }
  return summe
}

// ===========================================================================
// Was nachweislich funktioniert
// ===========================================================================

describe('Feldmessung: was haelt', () => {
  it('erkennt Stillstand - 7 Minuten Stehen ergeben so gut wie keine Bewegungszeit', () => {
    // Der Nutzer stand nachweislich still. Zum Vergleich: Strava hat in
    // diesem Fenster 81 Meter erfunden.
    const w = messung.gehen_und_stehen.wahrheit.stillstand
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)

    expect(bewegungszeitS(punkte)).toBeLessThan(15)
  })

  it('erzeugt im Stillstand keine nennenswerte Strecke', () => {
    // Gemessen wurden 33 m Rauschen ueber 7:26. Die Schwelle steht bei 60 m,
    // damit der Test an einem anderen Tag mit schlechterem Empfang nicht
    // grundlos umkippt - Strava lag bei 81 m in weniger als der Haelfte der
    // Zeit.
    const w = messung.gehen_und_stehen.wahrheit.stillstand
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)

    expect(streckeM(punkte)).toBeLessThan(60)
  })

  it('laesst Luecken nur im Stand entstehen, nie waehrend der Fahrt', () => {
    // Das ist die entscheidende Unterscheidung: Eine Luecke ist entweder ein
    // erkannter Halt (dann ist sie richtig) oder ein Signalausfall waehrend
    // der Fahrt (dann fehlt Strecke).
    //
    // Gemessen ueber zehn Luecken: das implizite Tempo lag zwischen 1,17 und
    // 5,10 km/h, waehrend die Fahrt selbst 50 km/h erreichte. Jede Luecke
    // entstand also im Stand oder im Schritttempo beim Ein- und Ausfahren.
    // Ein Ausfall bei voller Fahrt ergaebe ueber 30 s rund 400 Meter.
    const punkte = messung.zugfahrt.punkte as Punkt[]
    const tempoInDerLuecke: number[] = []
    for (let i = 1; i < punkte.length; i++) {
      const s = sekunden(punkte[i - 1], punkte[i])
      if (s > MAX_LUECKE_S) tempoInDerLuecke.push(meter(punkte[i - 1], punkte[i]) / s)
    }

    expect(tempoInDerLuecke.length).toBeGreaterThanOrEqual(5)
    // 8 km/h - deutlich ueber dem gemessenen Hoechstwert von 5,1, und weit
    // unter jedem Tempo, bei dem eine Luecke Strecke kosten wuerde.
    expect(Math.max(...tempoInDerLuecke) * 3.6).toBeLessThan(8)
  })

  it('bekommt vom Empfaenger brauchbare Tempi - Doppler und Weg stimmen ueberein', () => {
    // Zwei physikalisch unabhaengige Messungen derselben Groesse: die
    // Frequenzverschiebung der Satellitensignale und der zurueckgelegte Weg.
    // Gemessen: 4 % Abweichung im Median ueber 151 Paare.
    const punkte = messung.zugfahrt.punkte as Punkt[]
    const abweichungen: number[] = []
    for (let i = 1; i < punkte.length; i++) {
      const s = sekunden(punkte[i - 1], punkte[i])
      const doppler = punkte[i].speed_mps
      if (s <= 0 || s > 3 || doppler == null || doppler < 3) continue
      abweichungen.push(Math.abs(meter(punkte[i - 1], punkte[i]) / s - doppler) / doppler)
    }
    abweichungen.sort((a, b) => a - b)

    expect(abweichungen.length).toBeGreaterThan(50)
    expect(abweichungen[Math.floor(abweichungen.length / 2)]).toBeLessThan(0.15)
  })
})

// ===========================================================================
// Die Befunde, festgenagelt
// ===========================================================================

describe('Feldmessung: bekannte Fehler', () => {
  it('B3: die Summe der Abschnitte ergibt die Strecke des Laufs — BEHOBEN 22.08.', () => {
    // War: Auf dem Bildschirm stand "4,0 km" und darunter sechs
    // Kilometer-Abschnitte, die sich auf 5,2 km summierten. Bei einer
    // zweiten Aufzeichnung 2,5 km gegen 3,2 km.
    //
    // Ursache: addPoint warf Segmente ueber MAX_TEMPO_MPS aus der Strecke,
    // computeSplits kannte nur die Entfernungsgrenze. Zwei Regeln fuer
    // dieselbe Frage.
    //
    // Behoben: beide fragen jetzt `istOrtungssprung` in bewegung.ts.
    // Dieser Test ist von `it.fails` auf `it` gedreht worden - genau dazu
    // war er da.
    const splits = computeSplits(messung.zugfahrt.punkte as never)
    const summe = splits.reduce((a, s) => a + s.distance_km, 0)

    expect(summe).toBeCloseTo(messung.zugfahrt.gespeichert.distance_km, 1)
  })

  it.fails('B4: eine flache Zugstrecke darf keine Hoehenmeter erzeugen', () => {
    // Gemessen: 36,6 Hoehenmeter auf einer Bahnstrecke durch Koeln.
    // Ursache: MIN_HOEHENSCHRITT_M = 3 liegt unter dem Rauschen von 5-10 m.
    // Das Geraet hat kein Barometer.
    expect(hoehengewinnM(messung.zugfahrt.punkte as Punkt[])).toBeLessThan(10)
  })

  it.fails('B4: drei Etagen Treppe muessen als Anstieg ankommen', () => {
    // Die Gegenprobe zum Test darueber, und die eigentliche Pointe: Auf
    // platter Strecke erfinden wir 36 Meter, auf neun echten messen wir null.
    // Im Treppenhaus steht die Rohhoehe konstant bei 106,0 m.
    expect(hoehengewinnM(messung.treppenhaus.punkte as Punkt[])).toBeGreaterThan(4)
  })

  it.fails('B1: beim Gehen darf die Zeit nicht verworfen werden, waehrend die Strecke bleibt', () => {
    // Der schwerste Befund. Die Strecke schuetzt MAX_TEMPO_MPS, die Zeit
    // schuetzt MAX_LUECKE_S - zwei Waechter fuer zwei Haelften derselben
    // Bewegung. Faellt ein Segment durch den Zeitwaechter, bleibt der Weg
    // und die Zeit verschwindet. Das Tempo wird dadurch zu schnell.
    //
    // Gemessen im Fenster "gehen_2": 227 m in 3:34 gegangen (5,3 km/h), die
    // App rechnet mit 1:31 - also 6:41 min/km fuer einen Spaziergang.
    const w = messung.gehen_und_stehen.wahrheit.gehen_2
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)

    const strecke = streckeM(punkte)
    const zeit = bewegungszeitS(punkte)
    const tempoSJeKm = zeit / (strecke / 1000)

    // Langsamer als 8 min/km. Wer 5 km/h geht, laeuft 12 min/km - alles
    // unter 8 ist fuer einen Spaziergang unmoeglich.
    expect(tempoSJeKm).toBeGreaterThan(8 * 60)
  })

  it.fails('B1: die gezaehlte Bewegungszeit muss den Grossteil der Gehzeit abdecken', () => {
    // Dieselbe Ursache, direkter gemessen: Von 3:34 Gehen kamen 1:31 an.
    // Erwartet wird, dass mindestens 70 % einer Gehphase als Bewegung zaehlen.
    const w = messung.gehen_und_stehen.wahrheit.gehen_2
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)
    const spanne = sekunden(punkte[0], punkte[punkte.length - 1])

    expect(bewegungszeitS(punkte) / spanne).toBeGreaterThan(0.7)
  })

  it.fails('B2: der erste Punkt darf nicht 90 Sekunden auf sich warten lassen', () => {
    // Knopfdruck 20:12:59, erster Punkt 20:14:29. Strava startete zwei
    // Sekunden spaeter und zeichnete ab Sekunde eins auf - es benutzt den
    // Fused Location Provider, wir den rohen GPS-Anbieter.
    const punkte = messung.gehen_und_stehen.punkte as Punkt[]
    const verzugS = (ms(punkte[0].recorded_at) - ms(messung.gehen_und_stehen.wahrheit.knopfdruck)) / 1000

    expect(verzugS).toBeLessThan(30)
  })

  it.fails('B5: verworfene Strecke darf nicht unbemerkt verschwinden', () => {
    // 1,200 km von 5,203 km wurden im Zug verworfen - 23 %, lautlos.
    // Strava hat denselben Sachverhalt erkannt und einen sichtbaren
    // Warnhinweis gesetzt.
    //
    // Dieser Test faellt, solange es keinen Weg gibt, das Verworfene zu
    // erfahren. Er wird gruen, wenn die Strecke entweder nicht mehr
    // verworfen oder das Verwerfen berichtet wird.
    const punkte = messung.zugfahrt.punkte as Punkt[]
    let verworfen = 0
    for (let i = 1; i < punkte.length; i++) {
      const s = sekunden(punkte[i - 1], punkte[i])
      const m = meter(punkte[i - 1], punkte[i])
      if (s > 0 && m / s > MAX_TEMPO_MPS) verworfen += m
    }

    expect(verworfen).toBeLessThan(50)
  })
})

// ===========================================================================
// Konstanten gegen das, was das Geraet wirklich liefert
// ===========================================================================

describe('Feldmessung: sind die Schwellen gegen das Geraet geeicht?', () => {
  const alle = [
    ...(messung.zugfahrt.punkte as Punkt[]),
    ...(messung.gehen_und_stehen.punkte as Punkt[]),
  ]

  it('MIN_HOEHENSCHRITT_M liegt unter dem Hoehenrauschen des Geraets', () => {
    // Kein Fehler-Test, sondern eine Feststellung mit Zahlen: Die Schwelle
    // soll Rauschen abweisen und liegt darunter. Der Test haelt die
    // Begruendung fest, damit sie beim naechsten Anfassen dasteht.
    const hoehen = alle.map((p) => p.altitude_m).filter((h): h is number => h != null)
    const spanne = Math.max(...hoehen) - Math.min(...hoehen)

    expect(spanne).toBeGreaterThan(MIN_HOEHENSCHRITT_M * 3)
  })

  it('MAX_LUECKE_S liegt im Bereich der Punktabstaende beim Gehen', () => {
    // MIN_SEGMENT_M = 10 erzeugt beim Gehen Abstaende von 7-12 s. Genau
    // dort liegt MAX_LUECKE_S = 15. Die eine Regel schiebt die Abstaende in
    // den Bereich, den die andere verwirft - das ist die Ursache von B1.
    const w = messung.gehen_und_stehen.wahrheit.gehen_1
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)
    const abstaende = punkte.slice(1).map((p, i) => sekunden(punkte[i], p))
    const groesster = Math.max(...abstaende)

    // Der groesste Abstand beim ruhigen Gehen liegt bereits ueber der Grenze.
    expect(groesster).toBeGreaterThan(MAX_LUECKE_S)
  })

  it('BEWEGUNG_MPS liegt mitten im Gehtempo, nicht darunter', () => {
    // 0,9 m/s sind 3,24 km/h. Gemuetliches Gehen liegt genau auf dieser
    // Kante, die Erkennung flackert deshalb. Gemessen: 18 % der
    // Gehmessungen fielen unter das Tor.
    const w = messung.gehen_und_stehen.wahrheit.gehen_2
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)
    const tempi = punkte.map((p) => p.speed_mps).filter((t): t is number => t != null)
    const darunter = tempi.filter((t) => t < BEWEGUNG_MPS).length

    expect(darunter / tempi.length).toBeGreaterThan(0)
  })
})
