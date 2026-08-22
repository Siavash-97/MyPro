import { describe, it, expect } from 'vitest'
import { hoehenmeterText, hoeheIstBelastbar } from './hoehenmeter'

/**
 * Gemessen am 22.08.2026, beide Faelle am selben Abend mit demselben Geraet:
 *
 *   Zugfahrt durch Koeln, faktisch flach:  36,6 Hoehenmeter gemeldet
 *   Drei Etagen Treppe, rund 9 m echt:      0,0 Hoehenmeter gemeldet
 *
 * Und der Parameterdurchlauf an den echten Daten zeigt, dass es keine
 * Einstellung gibt, die beides richtig macht - jede, die das Erfinden
 * stoppt, erkennt auch den echten Anstieg nicht.
 */
describe('hoehenmeter', () => {
  it('haelt die Hoehe derzeit nicht fuer belastbar', () => {
    expect(hoeheIstBelastbar()).toBe(false)
  })

  it('zeigt nichts an, solange die Quelle nicht belastbar ist', () => {
    // Auch bei einem Wert, der plausibel aussieht. Gerade der ist gefaehrlich:
    // 120 Hoehenmeter wirken wie eine Messung.
    expect(hoehenmeterText(120)).toBeNull()
  })

  it('zeigt auch bei null nichts an', () => {
    expect(hoehenmeterText(null)).toBeNull()
  })
})
