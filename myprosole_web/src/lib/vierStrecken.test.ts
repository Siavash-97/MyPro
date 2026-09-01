import { describe, it, expect } from 'vitest'
import daten from './__fixtures__/vier-strecken-2026-08-24.json'
import { segmenturteil } from './segmenturteil'
import { haversineM } from './geo'
import { MIN_SEGMENT_M } from './bewegung'
import { MAX_ACCURACY_M } from '../store/run'

/**
 * Feldtest 24.08.2026: viermal dieselbe Strecke, 1080 m.
 *
 * Der Datensatz, der die Ursache gefunden hat
 * -------------------------------------------
 * Die Frage war: Misst die App einen festen BETRAG zu wenig oder einen
 * FAKTOR? Drei Messungen ueber zwei Tage ergaben 92,7 %, 93,9 % und 93,7 % -
 * das sah nach einem Faktor aus, und genau so habe ich es zunaechst
 * aufgeschrieben.
 *
 * Falsch. Rechnet man die Fehlbetraege je ANFAHRT (einmal am Start, einmal
 * je Wende), steht da:
 *
 *   230 m,  1 Anfahrt  ->  17 m fehlen  ->  17 m je Anfahrt
 *   500 m,  2 Anfahrten -> 30 m fehlen  ->  15 m je Anfahrt
 *  1080 m,  4 Anfahrten -> 68 m fehlen  ->  17 m je Anfahrt
 *
 * Es ist ein fester Betrag **pro Losgehen**. Dass es wie ein Faktor aussah,
 * lag daran, dass in diesen Tests die Zahl der Wenden mit der Laenge mitwuchs.
 *
 * Die Ursache steht in `lib/bewegung.ts`: Der Weg zurueck in die Bewegung
 * verlangt Abstand vom Haltepunkt, und zwar
 * `Math.max(MIN_SEGMENT_M, genauigkeitM)`. Waehrend dieser Messung zeigte das
 * Geraet +-12 bis +-18 m - exakt die 15 bis 17 m, die je Anfahrt fehlen.
 *
 * Das ist kein Rechenfehler, sondern der Preis der Drift-Sicherung. Sie ist
 * eine bewusste Entscheidung und im Quelltext begruendet.
 *
 * Was dieser Test bewacht
 * -----------------------
 * Nicht die Genauigkeit - die ist hardwarebegrenzt. Bewacht wird, dass die
 * Rechenkette selbst sauber bleibt: Auf den ROHPUNKTEN (ohne die
 * Bewegungserkennung) trifft sie die Referenz auf ein halbes Prozent.
 * Genau das ist der Beleg dafuer, dass der Fehlbetrag NICHT aus der
 * Streckenrechnung kommt.
 */

type P = {
  recorded_at: string
  latitude: number
  longitude: number
  accuracy_m: number
  tempo_guete_mps: number | null
  altitude_m: number | null
}
const punkte = daten.punkte as P[]
const REFERENZ_M = 1080

/** Genauigkeitsfilter und 10-m-Tor der App - OHNE die Bewegungserkennung. */
function nachDemTor(p: P[]): P[] {
  const raus: P[] = []
  for (const x of p) {
    if (x.accuracy_m > MAX_ACCURACY_M) continue
    const l = raus[raus.length - 1]
    if (!l) { raus.push(x); continue }
    if (haversineM(l.latitude, l.longitude, x.latitude, x.longitude) >= MIN_SEGMENT_M) raus.push(x)
  }
  return raus
}

describe('Vier Strecken, 1080 m, 24.08.2026', () => {
  it('trifft die Referenz, wenn nur die Streckenrechnung laeuft', () => {
    const g = nachDemTor(punkte)
    let m = 0
    for (let i = 1; i < g.length; i++) {
      const s = (Date.parse(g[i].recorded_at) - Date.parse(g[i - 1].recorded_at)) / 1000
      m += segmenturteil(
        haversineM(g[i - 1].latitude, g[i - 1].longitude, g[i].latitude, g[i].longitude),
        s,
      ).streckeM
    }
    // Gemessen 1075 m von 1080 m = 99,5 %.
    //
    // Sollwert-Begruendung: Das Band ist eng gewaehlt, weil es hier NICHT um
    // GPS-Genauigkeit geht - die Punkte sind eingefroren. Es geht darum, ob
    // Tor und Segmenturteil dieselbe Strecke wie am 24.08. ergeben. Wuerde
    // jemand MIN_SEGMENT_M oder MAX_TEMPO_MPS aendern, faellt dieser Test.
    expect(m).toBeGreaterThan(1000)
    expect(m).toBeLessThan(1150)
    expect(m / REFERENZ_M).toBeGreaterThan(0.95)
  })

  it('faellt zu Fuss nie ein Sprung-Urteil', () => {
    const g = nachDemTor(punkte)
    for (let i = 1; i < g.length; i++) {
      const s = (Date.parse(g[i].recorded_at) - Date.parse(g[i - 1].recorded_at)) / 1000
      expect(
        segmenturteil(
          haversineM(g[i - 1].latitude, g[i - 1].longitude, g[i].latitude, g[i].longitude),
          s,
        ).urteil,
      ).not.toBe('sprung')
    }
  })

  it('driftet nicht - Start und Ende liegen aufeinander', () => {
    // Der Beleg, dass die Aufzeichnung sauber ist: nach 1080 m und 15,5
    // Minuten ist der Endpunkt 12 m vom Startpunkt entfernt - unter der
    // Ortsgenauigkeit von 9 bis 18 m.
    //
    // Sollwert-Begruendung: Waere hier eine Drift, koennte man ueber den
    // Fehlbetrag der App gar nichts aussagen - er waere von der Drift nicht
    // zu trennen. Dieser Test schuetzt also die Aussagekraft der anderen.
    const a = punkte[0]
    const b = punkte[punkte.length - 1]
    expect(haversineM(a.latitude, a.longitude, b.latitude, b.longitude)).toBeLessThan(30)
  })
})

describe('Die Messdaten selbst - kein Codetest', () => {
  it('belegt die Hoehe erneut als unbrauchbar', () => {
    // Fuenfter unabhaengiger Beleg an einem Tag. Ebene Altstadtrunde,
    // viermal dieselbe Strecke. Strava - das die Hoehe aus einem
    // Gelaendemodell nachschlaegt statt sie zu messen - nennt 8,2 m.
    const h = punkte.map((p) => p.altitude_m).filter((x): x is number => x !== null)
    expect(Math.max(...h) - Math.min(...h)).toBeGreaterThan(20)
  })

  it('traegt die Guete der Tempoangabe', () => {
    expect(punkte.filter((p) => p.tempo_guete_mps !== null).length).toBe(punkte.length)
  })
})
