import { describe, it, expect } from 'vitest'
import { nachLaufZiel } from './nachLaufZiel'

/**
 * Wohin nach dem Beenden - und wann die Lauf-Kennung mitdarf.
 *
 * Der Fehler, den diese Tests festhalten (29.08.2026, Agent `pruefung`):
 * `LiveTracking` haengte die Kennung bedingungslos an die Adresse, auch wenn
 * die `runs`-Zeile noch gar nicht existierte. Das Trainingstagebuch schickte
 * sie als `run_id` mit, `fk_diary_run` (Migration 0008) wies es mit 23503 ab,
 * und der getippte Eintrag war weg.
 *
 * Warum die Sollwerte als vollstaendige Zeichenketten dastehen und nicht
 * zusammengesetzt werden: Ein Test, der das Ziel genauso baut wie die
 * Funktion, prueft nur, dass zweimal dasselbe herauskommt. Die Adresse ist
 * ein Vertrag mit `TrainingDiary` (`from`, `lauf`), und Vertraege stehen
 * ausgeschrieben da.
 */
describe('nachLaufZiel', () => {
  it('gibt die Kennung mit, sobald die Zeile bestaetigt ist', () => {
    expect(nachLaufZiel({ runId: 'lauf-1', zeileSteht: true })).toBe(
      '/training/tagebuch?from=tracking&lauf=lauf-1',
    )
  })

  it('laesst die Kennung weg, solange es die Zeile nicht gibt', () => {
    // Der eigentliche Fund. Der Mensch kommt trotzdem ins Tagebuch - der
    // Eintrag haengt dann am Datum statt am Lauf. Weniger, als gemeint war,
    // aber `run_id` ist dort nullbar, und ein Eintrag ohne Verknuepfung ist
    // besser als ein abgewiesener.
    expect(nachLaufZiel({ runId: 'lauf-1', zeileSteht: false })).toBe(
      '/training/tagebuch?from=tracking',
    )
  })

  it('nennt kein Ziel, wenn nichts gespeichert wurde', () => {
    // `runId: null` heisst "zu kurz, verworfen" - kein Fehler, aber auch
    // kein Tagebuch. Diese Funktion erfindet dafuer keine Adresse; der
    // Aufrufer sagt es mit einer Kurzeinblendung und geht zur Startseite.
    expect(nachLaufZiel({ runId: null, zeileSteht: true })).toBeNull()
    expect(nachLaufZiel({ runId: null, zeileSteht: false })).toBeNull()
  })

  it('haengt die Kennung nie ohne from-Angabe an', () => {
    // `TrainingDiary` entscheidet an `from=tracking`, ob es der Prompt nach
    // einem Lauf ist. Ginge das verloren, stuende der Eintrag zwar richtig
    // verknuepft da, aber der Weg dorthin waere ein anderer.
    for (const zeileSteht of [true, false]) {
      expect(nachLaufZiel({ runId: 'lauf-1', zeileSteht })).toContain('from=tracking')
    }
  })
})
