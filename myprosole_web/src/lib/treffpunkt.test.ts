import { describe, it, expect } from 'vitest'
import { treffpunktAusAntwort } from './treffpunkt'

/**
 * Die Unterscheidung, um die es hier geht, hat am 22.08.2026 einen stillen
 * Datenverlust ermoeglicht: Das Bearbeiten-Formular oeffnete mit
 * `meetingPoint: ort ?? ''`, und Speichern schrieb die Leere per upsert
 * zurueck. Ein Netzhaenger beim Oeffnen loeschte den Treffpunkt.
 *
 * "Es gibt keinen" und "ich konnte nicht nachsehen" duerfen nicht dieselbe
 * Antwort sein.
 */
describe('treffpunktAusAntwort', () => {
  it('unterscheidet "kein Treffpunkt" von "konnte nicht nachsehen"', () => {
    const keiner = treffpunktAusAntwort({ data: null, error: null })
    const gescheitert = treffpunktAusAntwort({
      data: null,
      error: { message: 'network error', code: '08006' },
    })

    expect(keiner).toEqual({ treffpunkt: null, fehler: null })
    expect(gescheitert.fehler).toBe('network error (08006)')
  })

  it('gibt den Treffpunkt heraus, wenn einer dasteht', () => {
    const antwort = treffpunktAusAntwort({
      data: { meeting_point: 'Am Brunnen, Ehrenfeld' },
      error: null,
    })

    expect(antwort).toEqual({ treffpunkt: 'Am Brunnen, Ehrenfeld', fehler: null })
  })
})
