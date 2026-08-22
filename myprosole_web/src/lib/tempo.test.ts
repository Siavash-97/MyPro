import { describe, it, expect } from 'vitest'
import { durchschnittstempoText } from './tempo'

/**
 * Die Zahlen stammen aus der Scooter-Fahrt vom 22.08.2026, 12:44-12:52:
 * 2,28 km, 509 s an der Uhr, davon rund 60 s an einer Ampel gestanden.
 * Die Splits standen bei 3:07 und 3:06 - und der Durchschnitt darueber bei
 * 3:43, also langsamer als jeder einzelne Kilometer.
 */
describe('durchschnittstempoText', () => {
  it('rechnet mit der Bewegungszeit, nicht mit der Uhr', () => {
    const text = durchschnittstempoText({
      streckeKm: 2.28,
      gesamtzeitS: 509,
      gespeichertesTempoSJeKm: 187,
    })

    expect(text).toBe('3:07')
  })
})

describe('durchschnittstempoText, ohne gespeicherten Wert', () => {
  it('nimmt die Bewegungszeit, wenn noch nichts gespeichert ist', () => {
    // Der Bildschirm direkt nach dem Lauf: die Zeile ist noch nicht
    // geschrieben, aber die Bewegungszeit steht im laufenden Zustand.
    const text = durchschnittstempoText({
      streckeKm: 2.28,
      bewegungszeitS: 426,
      gesamtzeitS: 509,
    })

    expect(text).toBe('3:06')
  })

  it('faellt auf die Uhr zurueck, wenn es keine Bewegungszeit gibt', () => {
    // Bestandslaeufe von vor der Bewegungszeit. Lieber ein zu langsamer
    // Wert als gar keiner.
    const text = durchschnittstempoText({ streckeKm: 2.28, gesamtzeitS: 509 })

    expect(text).toBe('3:43')
  })
})

describe('durchschnittstempoText, Grenzfaelle', () => {
  it('sagt nichts, wenn die Strecke zu kurz fuer eine Aussage ist', () => {
    // 20 m: eine Sekunde Unterschied macht hier Minuten je Kilometer aus.
    const text = durchschnittstempoText({ streckeKm: 0.02, bewegungszeitS: 12 })

    expect(text).toBe('--:--')
  })

  it('traut auch dem gespeicherten Wert nicht, wenn die Strecke zu kurz ist', () => {
    const text = durchschnittstempoText({
      streckeKm: 0.02,
      gespeichertesTempoSJeKm: 187,
    })

    expect(text).toBe('--:--')
  })
})
