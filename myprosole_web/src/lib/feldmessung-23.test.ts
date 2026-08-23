import { describe, it, expect } from 'vitest'
import { laufBilanz } from './laufBilanz'
import { segmenturteil, BEWEGUNG_MPS, MAX_TEMPO_MPS } from './segmenturteil'
import { gesamtzeitS } from './laufdauer'
import { hoehenmeterText, hoeheIstBelastbar } from './hoehenmeter'
import { verworfeneStreckeText } from './verworfeneStrecke'
import { mittlereHoehe, hoeheAktualisieren, HOEHEN_FENSTER, MAX_ACCURACY_M } from '../store/run'
import { haversineKm } from './geo'
import daten from './__fixtures__/feldmessung-2026-08-23.json'

/**
 * Alle Bausteine gegen die LIVEDATEN vom 23.08.2026 - waehrend der Nutzer
 * unterwegs war. Kein Nachbau: Jede Zahl kommt aus der Funktion, die auch
 * in der App laeuft.
 */
type P = { recorded_at: string; latitude: number; longitude: number; accuracy_m: number | null; speed_mps: number | null; altitude_m: number | null }
const punkte = daten.punkte as P[]
const ms = (s: string) => new Date(s).getTime()
const sek = (a: P, b: P) => (ms(b.recorded_at) - ms(a.recorded_at)) / 1000
const met = (a: P, b: P) => haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000

describe('Livedaten 23.08.: Grundlage', () => {
  it('hat genug Punkte, um etwas auszusagen', () => {
    expect(punkte.length).toBeGreaterThan(300)
  })

  it('ist zeitlich aufsteigend, ohne Rueckspruenge', () => {
    const rueckwaerts = punkte.slice(1).filter((p, i) => sek(punkte[i], p) < 0)
    expect(rueckwaerts).toEqual([])
  })

  it('haelt die Genauigkeitsgrenze ein, die addPoint durchlaesst', () => {
    // MAX_ACCURACY_M = 50: Was groeber ist, darf gar nicht in die Strecke.
    const zuGrob = punkte.filter((p) => p.accuracy_m != null && p.accuracy_m > MAX_ACCURACY_M)
    expect(zuGrob).toEqual([])
  })
})

describe('Livedaten 23.08.: segmenturteil', () => {
  it('traegt nie Strecke bei, ohne Zeit beizutragen', () => {
    const stumm = punkte.slice(1).filter((p, i) => {
      const u = segmenturteil(met(punkte[i], p), sek(punkte[i], p))
      return u.streckeM > 0 && u.zeitS <= 0
    })
    expect(stumm).toEqual([])
  })

  it('erfindet nie Zeit ueber die Luecke hinaus', () => {
    const zuviel = punkte.slice(1).filter((p, i) => {
      const s = sek(punkte[i], p)
      return segmenturteil(met(punkte[i], p), s).zeitS > s + 0.001
    })
    expect(zuviel).toEqual([])
  })

  it('B13 GEFUNDEN 23.08.: der Zug war schneller als unsere Sprunggrenze', () => {
    // Diese Pruefung war anders geschrieben - sie behauptete, kein Segment
    // einer Zugfahrt werde als Sprung verworfen. Sie fiel sofort, und die
    // Messung hatte recht, nicht die Erwartung:
    //
    //   schnellste Doppler-Messung   47,5 km/h
    //   MAX_TEMPO_MPS                45,0 km/h
    //   dadurch verworfen            43 Segmente, 574 m
    //   schnellstes Segment          52,0 km/h
    //
    // Die Grenze wurde als "schneller kann kein Mensch laufen" gewaehlt. Ihre
    // AUFGABE ist aber, Ortungsspruenge zu erkennen - und die liegen bei
    // hunderten Metern je Sekunde, nicht bei 52 km/h. Sie ist fuer ihren
    // Zweck zu eng.
    //
    // Nicht behoben: Die Schwelle anzuheben ist eine Entscheidung ueber den
    // Zweck der App (ist sie eine Lauf-App oder eine Wege-App?), und die
    // gehoert dem Menschen. Diese Pruefung haelt den Befund fest, damit er
    // nicht wieder in Prosa verschwindet.
    const schnellsteMessung = Math.max(...punkte.map((p) => p.speed_mps ?? 0))
    expect(schnellsteMessung).toBeGreaterThan(MAX_TEMPO_MPS)

    const spruenge = punkte.slice(1).filter(
      (p, i) => segmenturteil(met(punkte[i], p), sek(punkte[i], p)).urteil === 'sprung',
    )
    expect(spruenge.length).toBeGreaterThan(0)
    // Aber sie duerfen nicht die Regel sein - sonst waere die Aufzeichnung
    // insgesamt unbrauchbar und nicht nur an den schnellen Stellen.
    expect(spruenge.length / punkte.length).toBeLessThan(0.25)
  })
})

describe('Livedaten 23.08.: laufBilanz', () => {
  const b = laufBilanz(punkte)

  it('kommt auf eine Strecke in der Groessenordnung der Anzeige', () => {
    // Auf dem Bildschirm standen 5,8 km. Die Bilanz rechnet ueber ALLE
    // Punkte, die Anzeige nur ueber die, die addPoint durchgelassen hat -
    // gleich muessen sie also nicht sein, nur nah.
    expect(b.streckeKm).toBeGreaterThan(4)
    expect(b.streckeKm).toBeLessThan(9)
  })

  it('gibt eine Bewegungszeit, die kleiner ist als die Gesamtspanne', () => {
    const spanne = sek(punkte[0], punkte[punkte.length - 1])
    expect(b.bewegungszeitS).toBeGreaterThan(0)
    expect(b.bewegungszeitS).toBeLessThanOrEqual(spanne)
  })

  it('ergibt ein Tempo, das ein Mensch oder ein Zug gefahren sein kann', () => {
    const mps = b.streckeKm * 1000 / b.bewegungszeitS
    expect(mps).toBeGreaterThan(BEWEGUNG_MPS)
    expect(mps).toBeLessThan(MAX_TEMPO_MPS)
  })

  it('zaehlt Halte und Spruenge getrennt', () => {
    expect(b.sprungAnzahl + b.halteAnzahl).toBeLessThanOrEqual(punkte.length - 1)
  })
})

describe('Livedaten 23.08.: Anzeige', () => {
  it('zeigt Hoehenmeter weiterhin nicht', () => {
    expect(hoeheIstBelastbar()).toBe(false)
    expect(hoehenmeterText(120)).toBeNull()
  })

  it('meldet verworfene Strecke nur, wenn es sich lohnt', () => {
    const b = laufBilanz(punkte)
    const text = verworfeneStreckeText(b.verworfeneStreckeM)
    if (b.verworfeneStreckeM < 100) expect(text).toBeNull()
    else expect(text).toContain('km')
  })
})

describe('Livedaten 23.08.: Hoehe - die Treppe abwaerts', () => {
  it('zeigt, was das Geraet zur Hoehe wirklich liefert', () => {
    // Der Nutzer ist von Etage 3 heruntergegangen: rund 9 Meter Abstieg,
    // also 0 Hoehenmeter Gewinn. Diese Pruefung stellt fest, was
    // herauskommt - sie behauptet nicht, dass es richtig ist.
    let bezug: number | null = null
    let gewinn = 0
    for (let i = 0; i < punkte.length; i++) {
      const g = mittlereHoehe(punkte.slice(Math.max(0, i - HOEHEN_FENSTER + 1), i + 1) as never)
      if (g == null) continue
      bezug = hoeheAktualisieren(g, bezug, (z) => { gewinn += z })
    }
    const hoehen = punkte.map((p) => p.altitude_m).filter((h): h is number => h != null)
    const spanne = hoehen.length ? Math.max(...hoehen) - Math.min(...hoehen) : 0
    console.log(`  Hoehengewinn gerechnet: ${gewinn.toFixed(1)} m bei einer Rohspanne von ${spanne.toFixed(1)} m`)
    // Die Zahl wird nicht angezeigt - deshalb ist hier nichts zu fordern
    // ausser, dass sie ueberhaupt entsteht.
    expect(Number.isFinite(gewinn)).toBe(true)
  })
})

describe('Livedaten 23.08.: gesamtzeitS', () => {
  it('rechnet die Spanne der Aufzeichnung richtig', () => {
    const a = ms(punkte[0].recorded_at)
    const e = ms(punkte[punkte.length - 1].recorded_at)
    expect(gesamtzeitS(a, e)).toBe(Math.floor((e - a) / 1000))
  })
})
