import { describe, it, expect, vi } from 'vitest'
import { mitZeitgrenze, ZeitgrenzeFehler, SPEICHERN_GRENZE_MS } from './zeitgrenze'

/**
 * Gemessen am 23.08.2026 im Feld: Ein Lauf von 3:26 blieb beim Speichern
 * haengen. Die Spuren am Geraet zeigten, wie weit die Kette kam -
 * Dienst gestoppt, Punkte eingesammelt und bestaetigt, 20 Punkte in der
 * Datenbank - und wo sie stehenblieb: vor dem Schreiben der Kennzahlen.
 *
 * Dort stehen zwei Netzaufrufe, und der Supabase-Client hat KEINE
 * Vorgabe-Zeitgrenze. Haengt einer, haengt das Speichern fuer immer.
 */
describe('mitZeitgrenze', () => {
  it('gibt das Ergebnis zurueck, wenn es rechtzeitig kommt', async () => {
    await expect(mitZeitgrenze(Promise.resolve('da'), 1000)).resolves.toBe('da')
  })

  it('reicht einen Fehler des Versprechens unveraendert durch', async () => {
    // Ein echter Netzfehler soll als solcher ankommen, nicht als
    // Zeitueberschreitung verkleidet - sonst sucht jemand an der falschen
    // Stelle.
    const grund = new Error('kein Netz')
    await expect(mitZeitgrenze(Promise.reject(grund), 1000)).rejects.toBe(grund)
  })

  it('bricht ab, wenn die Zeit ablaeuft', async () => {
    vi.useFakeTimers()
    const nie = new Promise(() => {})
    const lauf = mitZeitgrenze(nie, 5000)
    const erwartung = expect(lauf).rejects.toBeInstanceOf(ZeitgrenzeFehler)
    await vi.advanceTimersByTimeAsync(5001)
    await erwartung
    vi.useRealTimers()
  })

  it('nennt im Fehler, was zu lange gedauert hat', async () => {
    vi.useFakeTimers()
    const lauf = mitZeitgrenze(new Promise(() => {}), 1000, 'Lauf speichern')
    const erwartung = expect(lauf).rejects.toThrow(/Lauf speichern/)
    await vi.advanceTimersByTimeAsync(1001)
    await erwartung
    vi.useRealTimers()
  })

  it('raeumt den Zeitgeber auf, wenn das Ergebnis zuerst da ist', async () => {
    vi.useFakeTimers()
    const aufraeumen = vi.spyOn(globalThis, 'clearTimeout')
    await mitZeitgrenze(Promise.resolve(1), 1000)
    expect(aufraeumen).toHaveBeenCalled()
    aufraeumen.mockRestore()
    vi.useRealTimers()
  })

  it('haelt eine Grenze bereit, die zum Speichern passt', () => {
    // Nicht zu knapp: Auf schlechtem Mobilfunk sind zehn Sekunden fuer
    // einen Umlauf nicht ungewoehnlich. Nicht zu grosszuegig: Wer eine
    // Minute vor einem Bildschirm steht, der nichts sagt, haelt die App
    // fuer kaputt - und sie IST es dann auch.
    expect(SPEICHERN_GRENZE_MS).toBeGreaterThanOrEqual(10_000)
    expect(SPEICHERN_GRENZE_MS).toBeLessThanOrEqual(30_000)
  })
})
