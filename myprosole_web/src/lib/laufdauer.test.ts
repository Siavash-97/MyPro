import { describe, it, expect } from 'vitest'
import { gesamtzeitS } from './laufdauer'

describe('gesamtzeitS', () => {
  it('zaehlt die Wanduhr seit dem Start', () => {
    const start = 1_000_000
    expect(gesamtzeitS(start, start + 3_600_000)).toBe(3600)
  })

  it('schneidet ab, statt Sekundenbruchteile aufzurunden', () => {
    const start = 1_000_000
    expect(gesamtzeitS(start, start + 9_999)).toBe(9)
  })

  it('gibt null zurueck, wenn es keine Startzeit gibt', () => {
    // Kein Start, keine Dauer. Nicht raten - das war der Fehler, der die
    // Bergung unbrauchbar gemacht hat.
    expect(gesamtzeitS(null, 1_000_000)).toBe(0)
  })

  it('wird nie negativ, wenn die Uhr zurueckspringt', () => {
    // Sommerzeit, Zeitabgleich ueber das Netz, manuell gestellte Uhr.
    expect(gesamtzeitS(2_000_000, 1_000_000)).toBe(0)
  })

  it('rechnet ohne gueltige Zahlen keine Dauer', () => {
    expect(gesamtzeitS(Number.NaN, 1_000_000)).toBe(0)
    expect(gesamtzeitS(1_000_000, Number.NaN)).toBe(0)
  })
})
