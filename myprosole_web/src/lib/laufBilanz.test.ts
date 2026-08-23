import { describe, it, expect } from 'vitest'
import { laufBilanz, LEERE_BILANZ } from './laufBilanz'
import { BEWEGUNG_MPS } from './segmenturteil'

/** Ein Punkt in bekanntem Abstand: 0,001 Grad Breite sind rund 111,2 m. */
function punkt(indexM: number, sekunde: number) {
  return {
    latitude: 50.94 + indexM / 111_195,
    longitude: 6.96,
    recorded_at: new Date(1_000_000_000_000 + sekunde * 1000).toISOString(),
  }
}

describe('laufBilanz', () => {
  it('gibt bei weniger als zwei Punkten eine leere Bilanz', () => {
    expect(laufBilanz([])).toEqual(LEERE_BILANZ)
    expect(laufBilanz([punkt(0, 0)])).toEqual(LEERE_BILANZ)
  })

  it('summiert Gehsegmente in Strecke und Zeit', () => {
    // Drei Punkte, je 20 m in 10 s: 2 m/s, klar Bewegung.
    const punkte = [punkt(0, 0), punkt(20, 10), punkt(40, 20)]
    const b = laufBilanz(punkte)

    expect(b.streckeKm).toBeCloseTo(0.04, 3)
    expect(b.bewegungszeitS).toBeCloseTo(20, 1)
    expect(b.sprungAnzahl).toBe(0)
    expect(b.halteAnzahl).toBe(0)
  })

  it('behaelt bei einem Halt die Strecke und kuerzt nur die Zeit', () => {
    // 20 m in 400 s sind 0,05 m/s. Der Weg ist zurueckgelegt worden, gelaufen
    // wurde er nicht.
    const punkte = [punkt(0, 0), punkt(20, 400)]
    const b = laufBilanz(punkte)

    expect(b.halteAnzahl).toBe(1)
    expect(b.streckeKm).toBeCloseTo(0.02, 3)
    expect(b.bewegungszeitS).toBeCloseTo(20 / BEWEGUNG_MPS, 0)
    // Ein Halt ist kein Verlust - er gehoert nicht in die verworfene Strecke.
    expect(b.verworfeneStreckeM).toBe(0)
  })

  it('verwirft bei einem Sprung Strecke und Zeit und merkt sich die Strecke', () => {
    // 300 m in 2 s sind 540 km/h.
    const punkte = [punkt(0, 0), punkt(300, 2)]
    const b = laufBilanz(punkte)

    expect(b.sprungAnzahl).toBe(1)
    expect(b.streckeKm).toBe(0)
    expect(b.bewegungszeitS).toBe(0)
    // Was verworfen wurde, muss erfahrbar sein - sonst verschwindet es
    // lautlos, und genau das war Befund B5.
    expect(b.verworfeneStreckeM).toBeCloseTo(300, 0)
  })

  it('zaehlt ein Gehsegment voll, egal wie lang die Luecke ist', () => {
    // Der Kern von B1: 60 m in 40 s sind 1,5 m/s. Die alte Regel warf die
    // Zeit weg, weil 40 > 15, und behielt die Strecke.
    const b = laufBilanz([punkt(0, 0), punkt(60, 40)])

    expect(b.bewegungszeitS).toBeCloseTo(40, 0)
    expect(b.streckeKm).toBeCloseTo(0.06, 3)
  })

  it('folgt einem gespeicherten Sprung, auch wenn die Geometrie zaehlen wuerde', () => {
    // 60 m in 40 s waeren gerechnet 'gezaehlt'. Stand beim Aufzeichnen aber
    // 'sprung' da, gilt das - sonst saehe ein alter Lauf nach einer
    // Schwellenaenderung anders aus als am Tag seiner Aufzeichnung.
    const bilanz = laufBilanz([punkt(0, 0), { ...punkt(60, 40), urteil: 'sprung' as const }])

    expect(bilanz.sprungAnzahl).toBe(1)
    expect(bilanz.streckeKm).toBe(0)
    expect(bilanz.bewegungszeitS).toBe(0)
    expect(bilanz.verworfeneStreckeM).toBeCloseTo(60, 0)
  })

  it('folgt einem gespeicherten "gezaehlt", wo die Geometrie einen Halt saehe', () => {
    // 20 m in 400 s waeren gerechnet 'halt' und ergaeben nur 22 s. Steht
    // 'gezaehlt' da, zaehlt die Luecke voll.
    const bilanz = laufBilanz([punkt(0, 0), { ...punkt(20, 400), urteil: 'gezaehlt' as const }])

    expect(bilanz.halteAnzahl).toBe(0)
    expect(bilanz.bewegungszeitS).toBeCloseTo(400, 0)
  })

  it('erfindet auch mit gespeichertem Urteil keine Zeit ueber die Luecke hinaus', () => {
    // Ein erzwungener 'halt' auf einem schnellen Segment: 60 m in 40 s
    // ergaeben ueber die Untergrenze 66,7 s - mehr, als vergangen ist. Der
    // Deckel haelt das ab.
    const bilanz = laufBilanz([punkt(0, 0), { ...punkt(60, 40), urteil: 'halt' as const }])

    expect(bilanz.halteAnzahl).toBe(1)
    expect(bilanz.bewegungszeitS).toBeCloseTo(40, 1)
  })

  it('kommt ohne gespeichertes Urteil zum selben Ergebnis wie mit', () => {
    // Solange die Schwellen unveraendert sind, muessen beide Wege gleich
    // rechnen. Waere das nicht so, haette die neue Spalte still die Zahlen
    // aller Bestandslaeufe geaendert.
    const roh = [punkt(0, 0), punkt(20, 10), punkt(25, 200), punkt(400, 205)]
    const mitUrteil = roh.map((p, i) => ({
      ...p,
      urteil: i === 0 ? null : laufBilanz(roh.slice(i - 1, i + 1)).sprungAnzahl > 0
        ? ('sprung' as const)
        : laufBilanz(roh.slice(i - 1, i + 1)).halteAnzahl > 0
          ? ('halt' as const)
          : ('gezaehlt' as const),
    }))

    expect(laufBilanz(mitUrteil)).toEqual(laufBilanz(roh))
  })

  it('laesst ein gespeichertes "gezaehlt" nie ueber die harten Grenzen hinweg', () => {
    // Der Fall, den der Pruefagent am 23.08.2026 fand: Das Urteil beschreibt
    // das Segment zum Vorgaenger AUF DEM GERAET. Fehlt dazwischen ein Punkt
    // (Puffer voll, Buendel nicht durchgekommen), liegt der Vorgaenger IM
    // ARRAY ganz woanders - und ein gespeichertes "gezaehlt" wuerde ein Loch
    // zudecken, das die Geometrie als Sprung abgewiesen haette.
    //
    // 800 m in 30 s sind 96 km/h. Egal, was am Punkt steht: Das ist keine
    // gelaufene Strecke.
    const bilanz = laufBilanz([punkt(0, 0), { ...punkt(800, 30), urteil: 'gezaehlt' as const }])

    expect(bilanz.sprungAnzahl).toBe(1)
    expect(bilanz.streckeKm).toBe(0)
    expect(bilanz.bewegungszeitS).toBe(0)
    // Und es bleibt erfahrbar statt lautlos.
    expect(bilanz.verworfeneStreckeM).toBeCloseTo(800, 0)
  })

  // Hier stand "rechnet schrittweise dasselbe wie am Stueck". Der Test
  // verglich die Schleife ueber bilanzErweitern mit sich selbst - er konnte
  // per Konstruktion nicht rot werden und hat deshalb auch nicht gefangen,
  // dass der Live-Weg eine ANDERE Zeitrechnung benutzte (B1, Rest). Die
  // echte Pruefung geht durch addPoint: store/liveweg.test.ts.
})
