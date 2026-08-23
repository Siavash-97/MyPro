import { describe, it, expect } from 'vitest'
import {
  computeSplits,
  mittlereHoehe,
  hoeheAktualisieren,
  MIN_HOEHENSCHRITT_M,
  HOEHEN_FENSTER,
} from '../store/run'
import { MAX_LUECKE_S } from './bewegung'
import { BEWEGUNG_MPS, segmenturteil } from './segmenturteil'
import { laufBilanz } from './laufBilanz'
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
 * Bewegungszeit und Strecke einer Punktfolge - nach derselben Regel wie die
 * App.
 *
 * Beide kommen aus `laufBilanz`, rechnen also nicht nach, sondern fragen.
 * Bis zum 23.08.2026 standen hier zwei getrennte Nachbauten - dieselbe
 * Doppelung, die der Test aufdecken sollte.
 */
const bewegungszeitS = (punkte: Punkt[]) => laufBilanz(punkte).bewegungszeitS
const streckeM = (punkte: Punkt[]) => laufBilanz(punkte).streckeKm * 1000

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
  it('erkennt Stillstand - 7 Minuten Stehen ergeben fast keine Bewegungszeit', () => {
    // Der Nutzer stand nachweislich still. Zum Vergleich: Strava hat in
    // diesem Fenster 81 Meter erfunden.
    //
    // GEMESSENER PREIS DER NEUEN REGEL, 23.08.2026
    // --------------------------------------------
    // Vorher stand hier `toBeLessThan(15)`, und die Rechnung ergab **0**.
    // Das sah aus wie eine gute Stillstandserkennung, war aber keine: Alle
    // Luecken in diesem Fenster sind laenger als 15 Sekunden, also warf die
    // alte Kante sie weg. Dieselbe Kante warf im Gehfenster 1.516 Sekunden
    // echte Gehzeit weg - das war Befund B1.
    //
    // Ohne die Kante schlaegt hier die Drift durch: 23 m Rauschen ueber
    // 439 Sekunden Stehen ergeben ueber die belegbare Untergrenze
    // 23 / 0,9 = **25,3 Sekunden** vermeintliche Bewegung. Das sind 5,8 %
    // des Fensters.
    //
    // Der Handel ist gemessen und wird bewusst eingegangen:
    //   gewonnen  1.516 s echte Gehzeit, die vorher verschwand
    //   verloren     25 s Drift je 7 Minuten Stehen
    //
    // Wichtig: Waehrend eines echten Laufs greift das nicht - dort haelt die
    // Bewegungserkennung den Stillstand ab, bevor ueberhaupt ein Punkt
    // entsteht. Diese Zahl entsteht nur beim Nachrechnen aus gespeicherten
    // Punkten, denen man den Bewegungszustand nicht mehr ansieht.
    const w = messung.gehen_und_stehen.wahrheit.stillstand
    const punkte = fenster(messung.gehen_und_stehen.punkte as Punkt[], w.von, w.bis)
    const spanne = sekunden(punkte[0], punkte[punkte.length - 1])

    expect(bewegungszeitS(punkte) / spanne).toBeLessThan(0.1)
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

  it('B1 BEHOBEN 23.08.: kein Segment traegt Strecke bei, ohne Zeit beizutragen', () => {
    // DAS ist B1, als Physik statt als Schwellenwert.
    //
    // Vorher schuetzten zwei getrennte Waechter zwei Haelften derselben
    // Bewegung: MAX_TEMPO_MPS die Strecke, MAX_LUECKE_S die Zeit. Fiel ein
    // Segment durch den Zeitwaechter, blieb der Weg stehen und die Zeit
    // verschwand - 19 Segmente trugen so 371 m ohne eine einzige Sekunde
    // bei, und das Tempo wurde unmoeglich schnell.
    //
    // Diese Aussage kann keine Toleranz weichklopfen: Wer Strecke
    // zurueckgelegt hat, hat dafuer Zeit gebraucht.
    const alle = [
      ...(messung.zugfahrt.punkte as Punkt[]),
      ...(messung.gehen_und_stehen.punkte as Punkt[]),
    ]

    const stumm: string[] = []
    for (let i = 1; i < alle.length; i++) {
      const u = segmenturteil(meter(alle[i - 1], alle[i]), sekunden(alle[i - 1], alle[i]))
      if (u.streckeM > 0 && u.zeitS <= 0) stumm.push(alle[i].recorded_at)
    }

    expect(stumm).toEqual([])
  })

  it('B1 BEHOBEN 23.08.: die Bewegungszeit eines Fensters uebersteigt nie seine Spanne', () => {
    // Die Gegenprobe. Die belegbare Untergrenze fuer einen Halt darf nie
    // mehr Zeit erzeugen, als ueberhaupt vergangen ist - sonst waere aus der
    // Reparatur eine Erfindung geworden.
    for (const name of ['zugfahrt', 'gehen_und_stehen', 'treppenhaus'] as const) {
      const punkte = messung[name].punkte as Punkt[]
      const spanne = sekunden(punkte[0], punkte[punkte.length - 1])

      expect(laufBilanz(punkte).bewegungszeitS).toBeLessThanOrEqual(spanne)
    }
  })

  it('B1 BEHOBEN 23.08.: das Tempo der Aufzeichnung liegt im menschlichen Bereich', () => {
    // Gemessen am 23.08.2026 an derselben Aufzeichnung, die auch Strava
    // aufgezeichnet hat:
    //
    //   vorher   281 s / 1,729 km  = 2:43 min/km   <- unmoeglich
    //   nachher  460 s / 1,729 km  = 4:26 min/km
    //   Strava   933 s / 3,540 km  = 4:24 min/km   <- Beobachtung, kein Mass
    //
    // Geprueft wird gegen die Physik, nicht gegen Strava: Schneller als
    // 3 min/km laeuft niemand ueber eine Viertelstunde, und langsamer als
    // 15 min/km ist es kein Gehen mehr.
    //
    // Die Strecke bleibt mit 1,73 km gegen 3,54 km weiterhin halbiert. Das
    // ist Befund B12 (Speicher-Tor) und ausdruecklich NICHT behoben - der
    // Verlust trifft Strecke und Zeit im selben Verhaeltnis, deshalb
    // ueberlebt das Tempo ihn.
    const b = laufBilanz(messung.gehen_und_stehen.punkte as Punkt[])
    const tempoSJeKm = b.bewegungszeitS / b.streckeKm

    expect(tempoSJeKm).toBeGreaterThan(3 * 60)
    expect(tempoSJeKm).toBeLessThan(15 * 60)
  })

  it.fails('B2: der erste Punkt darf nicht 90 Sekunden auf sich warten lassen', () => {
    // Knopfdruck 20:12:59, erster Punkt 20:14:29. Strava startete zwei
    // Sekunden spaeter und zeichnete ab Sekunde eins auf - es benutzt den
    // Fused Location Provider, wir den rohen GPS-Anbieter.
    const punkte = messung.gehen_und_stehen.punkte as Punkt[]
    const verzugS = (ms(punkte[0].recorded_at) - ms(messung.gehen_und_stehen.wahrheit.knopfdruck)) / 1000

    expect(verzugS).toBeLessThan(30)
  })

  it('B5 BEHOBEN 23.08.: verworfene Strecke ist erfahrbar, statt lautlos zu verschwinden', () => {
    // Der Test war so geschrieben, dass er faellt, "solange es keinen Weg
    // gibt, das Verworfene zu erfahren" - und gruen wird, "wenn die Strecke
    // entweder nicht mehr verworfen oder das Verwerfen berichtet wird".
    //
    // Berichtet wird es jetzt: `laufBilanz` gibt es heraus, und die
    // Laufzusammenfassung zeigt es.
    //
    // Verworfen wird weiterhin viel - im Zug 1,200 km von 5,203 km. Das ist
    // richtig so: Es sind Ortungsspruenge, dieser Weg ist nicht gefahren
    // worden. Falsch war nur, dass es niemand erfuhr.
    const b = laufBilanz(messung.zugfahrt.punkte as Punkt[])

    expect(b.verworfeneStreckeM).toBeGreaterThan(50)
    expect(b.sprungAnzahl).toBeGreaterThan(0)
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
