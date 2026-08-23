import { describe, it, expect } from 'vitest'
import { verworfeneStreckeText, MELDESCHWELLE_M } from './verworfeneStrecke'
import { laufBilanz, type Bilanzpunkt } from './laufBilanz'

/**
 * Die Zeile behauptet drei Dinge, und alle drei sind hier festgehalten:
 * eine Zahl in Kilometern, das Wort "mindestens" und einen Grund, den die
 * App tatsaechlich gemessen hat. Faellt eines davon weg, faellt ein Test.
 */
describe('verworfeneStreckeText', () => {
  it('schweigt bei drei verworfenen Metern', () => {
    // Drei Meter ohne Zeitabstand sind ein Sprung (segmenturteil.ts) und
    // trotzdem keine Meldung wert.
    expect(verworfeneStreckeText(3)).toBeNull()
  })

  it('nennt die Strecke in Kilometern und sagt, woher sie kommt', () => {
    expect(verworfeneStreckeText(1234)).toBe('GPS sprang: mindestens 1,2 km verworfen')
  })

  it('sagt nie "0,0 km" - genau darum liegt die Schwelle bei 100 m', () => {
    expect(verworfeneStreckeText(MELDESCHWELLE_M - 1)).toBeNull()
    expect(verworfeneStreckeText(MELDESCHWELLE_M)).toBe(
      'GPS sprang: mindestens 0,1 km verworfen',
    )
  })

  it('sagt "mindestens" - der groessere Verlust liegt vor dieser Rechnung', () => {
    // Kein Schoenheitswort: Die Bewegungserkennung verwirft Messungen,
    // bevor ein Punkt entsteht. Ohne "mindestens" behauptet die Zeile eine
    // Vollstaendigkeit, die sie nicht hat (1,73 km angekommen gegen
    // 3,54 km bei Strava, 22.08.2026).
    expect(verworfeneStreckeText(2000)).toContain('mindestens')
  })

  it('verspricht keine fehlende Strecke - verworfen ist nicht gelaufen', () => {
    // Ein stillliegendes Telefon erzeugt aus Rauschen 7,3 km
    // (docs/gps-genauigkeit.md). Wer daraus "7,3 km fehlen dir" macht,
    // schreibt dem Menschen Kilometer gut, die er nie gelaufen ist.
    const text = verworfeneStreckeText(7300) ?? ''
    expect(text).not.toMatch(/fehl|nicht mitgezählt|nicht gezählt/i)
    expect(text).toContain('verworfen')
  })

  it('nennt keinen Grund, den die App nicht gemessen hat', () => {
    // Gemessen ist der Sprung, nicht der Empfang. Laut
    // docs/gps-genauigkeit.md entsteht bei GUTEM Empfang sogar mehr
    // erfundene Strecke.
    expect(verworfeneStreckeText(1200) ?? '').not.toMatch(/Empfang|Signal|Tunnel/i)
  })

  it('schweigt bei fehlendem und unsinnigem Wert', () => {
    expect(verworfeneStreckeText(null)).toBeNull()
    expect(verworfeneStreckeText(undefined)).toBeNull()
    expect(verworfeneStreckeText(NaN)).toBeNull()
    expect(verworfeneStreckeText(-500)).toBeNull()
  })
})

/**
 * Die Zeile wird nicht aus einer Zahl gebaut, die jemand von Hand eintippt,
 * sondern aus `laufBilanz`. Dieser Test haelt fest, dass die beiden Teile
 * zusammenpassen - und dass ein sauberer Lauf schweigt.
 */
describe('verworfeneStreckeText an einer echten Bilanz', () => {
  /** Ein Punkt, verschoben um `gradOst` Laengengrad, `sekunden` spaeter. */
  function punkt(sekunden: number, gradOst: number): Bilanzpunkt {
    return {
      latitude: 50.9,
      longitude: 6.9 + gradOst,
      recorded_at: new Date(Date.UTC(2026, 7, 23, 6, 0, sekunden)).toISOString(),
    }
  }

  it('schweigt bei einem Lauf ohne Sprung', () => {
    // Rund 70 m in 30 s - laufbares Tempo, nichts zu verwerfen.
    const punkte = [punkt(0, 0), punkt(30, 0.001), punkt(60, 0.002)]
    const bilanz = laufBilanz(punkte)

    expect(bilanz.verworfeneStreckeM).toBe(0)
    expect(verworfeneStreckeText(bilanz.verworfeneStreckeM)).toBeNull()
  })

  it('meldet den Sprung eines Laufs, der einen hatte', () => {
    // 0,05 Grad Laenge sind rund 3,5 km - in 10 s unmoeglich, also Sprung.
    const punkte = [punkt(0, 0), punkt(10, 0.05)]
    const bilanz = laufBilanz(punkte)

    expect(bilanz.verworfeneStreckeM).toBeGreaterThan(MELDESCHWELLE_M)
    expect(verworfeneStreckeText(bilanz.verworfeneStreckeM)).toMatch(
      /^GPS sprang: mindestens \d+,\d km verworfen$/,
    )
  })
})
