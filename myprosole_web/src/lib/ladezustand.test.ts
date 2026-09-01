import { describe, it, expect } from 'vitest'
import { ladezustand } from './ladezustand'

/**
 * Die Reihenfolge IST der Inhalt dieser Funktion.
 *
 * Vier Lagen sahen auf Laufdetails und Laufanalyse bis zum 26.08.2026 gleich
 * aus - alle vier als Spinner. Sie hier einzeln festzunageln ist billiger als
 * dieselbe if-Kette in zwei Seiten von Hand gleich zu halten.
 */
describe('ladezustand', () => {
  const grund = { geprueft: true, laedt: false, vorhanden: false, fehler: null }

  it('zeigt den Lauf, sobald der richtige da ist', () => {
    expect(ladezustand({ ...grund, vorhanden: true })).toBe('da')
  })

  it('laedt, solange der erste Versuch noch nicht durch ist', () => {
    // Der Effekt laeuft NACH dem ersten Malen. Ohne diese Zeile blitzt
    // "Diesen Lauf gibt es nicht" auf, bevor ueberhaupt gefragt wurde.
    expect(ladezustand({ ...grund, geprueft: false })).toBe('laedt')
  })

  it('laedt, solange die Abfrage laeuft', () => {
    expect(ladezustand({ ...grund, laedt: true })).toBe('laedt')
  })

  it('meldet den Fehler, wenn das Laden scheiterte', () => {
    expect(ladezustand({ ...grund, fehler: 'network error' })).toBe('gescheitert')
  })

  it('sagt "gibt es nicht", wenn die Abfrage nichts fand', () => {
    expect(ladezustand(grund)).toBe('fehlt')
  })

  it('laesst einen fremden Ladefehler den geladenen Lauf nicht verdraengen', () => {
    // `ladefehler` ist EIN Feld fuer fetchRun UND fetchRecentRuns. Scheitert
    // im Hintergrund die Liste, waehrend die Detailseite offen ist, darf das
    // die Detailseite nicht in einen Fehler kippen.
    expect(ladezustand({ ...grund, vorhanden: true, fehler: 'network error' })).toBe('da')
  })

  it('laesst ein fremdes Laden den geladenen Lauf nicht verdraengen', () => {
    // Dasselbe fuer `loading`: auch das ist ein gemeinsames Feld.
    expect(ladezustand({ ...grund, vorhanden: true, laedt: true })).toBe('da')
  })
})
