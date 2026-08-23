import { describe, it, expect } from 'vitest'
import { verwaisteSitzungen, MIN_VERWAISTE_PUNKTE } from './verwaisteSitzungen'

/**
 * Gemessen am 23.08.2026: 611 Punkte vom 21.08. lagen erreichbar im
 * Dienstspeicher und wurden von niemandem geholt. Der Dienst merkt sich in
 * seinen Einstellungen genau EINE Sitzung, und die war laengst
 * ueberschrieben.
 */
describe('verwaisteSitzungen', () => {
  const alt = { laufId: 'alt', anzahl: 611, letzteZeit: 1_000 }
  const jetzt = { laufId: 'jetzt', anzahl: 12, letzteZeit: 9_000 }

  it('findet eine alte Sitzung neben der laufenden', () => {
    expect(verwaisteSitzungen([alt, jetzt], 'jetzt')).toEqual([alt])
  })

  it('nennt die laufende Sitzung nie verwaist', () => {
    expect(verwaisteSitzungen([jetzt], 'jetzt')).toEqual([])
  })

  it('findet auch dann etwas, wenn gar keine Sitzung laeuft', () => {
    // Nach einem Absturz ohne Merker: Es laeuft nichts, aber es liegt etwas.
    expect(verwaisteSitzungen([alt], null)).toEqual([alt])
  })

  it('uebergeht Sitzungen mit zu wenigen Punkten', () => {
    // Ein versehentlicher Tipper hinterlaesst ein paar Punkte. Die als
    // "verlorene Aufzeichnung" zu melden waere Laerm, kein Fund.
    const winzig = { laufId: 'winzig', anzahl: MIN_VERWAISTE_PUNKTE - 1, letzteZeit: 5_000 }
    expect(verwaisteSitzungen([winzig], null)).toEqual([])
  })

  it('gibt die juengste zuerst', () => {
    const aelter = { laufId: 'aelter', anzahl: 200, letzteZeit: 100 }
    expect(verwaisteSitzungen([aelter, alt], null).map((s) => s.laufId)).toEqual(['alt', 'aelter'])
  })

  it('haelt unsinnige Eintraege aus', () => {
    expect(verwaisteSitzungen(undefined, null)).toEqual([])
    expect(verwaisteSitzungen([{ laufId: '', anzahl: 999, letzteZeit: 1 }], null)).toEqual([])
  })
})
