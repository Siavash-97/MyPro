import { describe, it, expect } from 'vitest'
import { bergungsurteil } from './sitzungBergen'

/**
 * Am 22.08.2026 wurde gemessen: Die Sitzungskennung lebt nur im
 * Arbeitsspeicher. Schiesst Android die App waehrend eines Laufs ab, sammelt
 * der Dienst weiter - aber niemand kann seine Punkte je abholen.
 *
 * Belege aus dem Feld: 611 verwaiste Punkte vom 21.08. lagen noch im
 * Dienstspeicher, und neun von sechzehn Laeufen hingen auf status 'tracking'.
 *
 * Das hier ist die Entscheidung, die beim Start zu treffen ist.
 */
describe('bergungsurteil', () => {
  it('tut nichts, wenn der Dienst gar nichts laufen hat', () => {
    expect(bergungsurteil({ laeuft: false, laufId: null, letzterPunktMs: null }, 0)).toBe('nichts')
  })

  it('tut nichts, wenn der Dienst zwar laeuft, aber die App den Lauf schon kennt', () => {
    // Der Normalfall: Die Seite wurde nur neu gezeichnet. Bergen waere hier
    // falsch - es gibt nichts zu bergen.
    expect(
      bergungsurteil(
        { laeuft: true, laufId: 'abc', letzterPunktMs: 1000, bekannt: true },
        2000,
      ),
    ).toBe('nichts')
  })

  it('setzt fort, wenn die Aufzeichnung noch frisch ist', () => {
    // Jemand laeuft gerade, und Android hat die App abgeschossen. Er soll
    // weiterlaufen koennen, ohne etwas zu verlieren.
    const jetzt = 1_000_000
    expect(
      bergungsurteil({ laeuft: true, laufId: 'abc', letzterPunktMs: jetzt - 60_000 }, jetzt),
    ).toBe('fortsetzen')
  })

  it('schliesst ab, wenn die Aufzeichnung lange still ist', () => {
    // Der Lauf ist erkennbar vorbei - niemand laeuft eine halbe Stunde ohne
    // einen einzigen Punkt. Die Daten sind trotzdem da und gehoeren
    // gespeichert, nicht weggeworfen.
    const jetzt = 1_000_000
    expect(
      bergungsurteil({ laeuft: true, laufId: 'abc', letzterPunktMs: jetzt - 30 * 60_000 }, jetzt),
    ).toBe('abschliessen')
  })

  it('schliesst ab, wenn der Dienst steht, aber noch Punkte haelt', () => {
    // Der Fall, der am 23.08.2026 aufgefallen ist: stopRun hat den Dienst
    // beendet - der Schluessel ist weg, `laeuft` also false -, aber das
    // Schreiben nach Supabase ist gescheitert. Die Punkte liegen weiter im
    // Dienstspeicher.
    //
    // Vorher lautete das Urteil 'nichts', der Merker wurde geloescht, und
    // damit war der letzte Weg zu diesen Punkten zu. Die Meldung auf dem
    // Bildschirm versprach trotzdem "der naechste Start holt es nach".
    const jetzt = 1_000_000
    expect(
      bergungsurteil(
        { laeuft: false, laufId: 'abc', letzterPunktMs: jetzt - 30 * 60_000, offen: 42 },
        jetzt,
      ),
    ).toBe('abschliessen')
  })

  it('tut nichts, wenn der Dienst steht und nichts mehr haelt', () => {
    // Die Gegenprobe: Ohne offene Punkte ist wirklich nichts zu holen, und
    // der Merker gehoert weg - sonst fragt jeder Start erneut.
    expect(
      bergungsurteil({ laeuft: false, laufId: 'abc', letzterPunktMs: 500, offen: 0 }, 1_000_000),
    ).toBe('nichts')
  })

  it('schliesst ab, wenn gar kein Punkt kam', () => {
    // Gestartet, nie eine Messung bekommen, dann abgeschossen. Es gibt nichts
    // fortzusetzen, aber die Lauf-Zeile haengt und gehoert aufgeraeumt.
    const jetzt = 1_000_000
    expect(bergungsurteil({ laeuft: true, laufId: 'abc', letzterPunktMs: null }, jetzt)).toBe(
      'abschliessen',
    )
  })
})
