import { describe, it, expect, vi } from 'vitest'
import { gesamtzeitS, bewegungszeitFuerZeile } from './laufdauer'

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

/**
 * Die Bewegungszeit fuer die `runs`-Zeile.
 *
 * **Die Herleitung steht NICHT hier**, sondern am Kommentarkopf von
 * `bewegungszeitFuerZeile`. Sie stand bis zum 02.09.2026 an beiden Stellen
 * fast wortgleich - und war schon am ersten Tag auseinandergelaufen: Die
 * Kopie hier trug den Abschnitt "Warum Deckeln und nicht beide auf
 * Math.floor" nicht, die andere einen Satz, der bereits zurueckgezogen war.
 *
 * Zwei Begruendungen fuer eine Sache sind dieselbe Bauart, gegen die dieser
 * ganze Umbau geht - nur in Prosa. Gefunden vom Agenten `pruefung`.
 */
describe('bewegungszeitFuerZeile', () => {
  it('bleibt unter der Laufzeit, wenn das Aufrunden sie sonst ueberholt', () => {
    // 100,9 s Wanduhr -> duration_s = 100. 100,6 s Bewegung -> round = 101.
    // Genau der Fall, der 23514 ausloest.
    expect(bewegungszeitFuerZeile(100.6, gesamtzeitS(0, 100_900))).toBe(100)
  })

  it('rundet sonst wie bisher', () => {
    // Ohne Konflikt darf sich nichts aendern - sonst waere die Behebung
    // eine stille Aenderung der Kennzahl.
    expect(bewegungszeitFuerZeile(80.4, 100)).toBe(80)
    expect(bewegungszeitFuerZeile(80.6, 100)).toBe(81)
  })

  it('wird nie negativ', () => {
    // Eine negative Bewegungszeit ist eine Zahl, nur keine sinnvolle -
    // anders als NaN, siehe den Test darunter.
    expect(bewegungszeitFuerZeile(-5, 100)).toBe(0)
  })

  it('meldet eine nicht-endliche Eingabe und schreibt "unbekannt"', () => {
    // Bis zum 02.09.2026 gab die Funktion hier still 0 zurueck. Zwei
    // Fehler auf einmal:
    //
    //   1. `0044:24-27` nennt fuer diese Spalte 0 ausdruecklich die
    //      unehrliche Angabe - null heisst "unbekannt".
    //   2. Dieselbe Funktion war hier STILL fuer eine unerreichbare
    //      Eingabe und zwoelf Zeilen tiefer LAUT fuer einen ebenso
    //      unerreichbaren Ueberschuss. Zwei entgegengesetzte Antworten
    //      auf dieselbe Frage.
    //
    // NaN wird von `JSON.stringify` zu null - genau die Angabe, die 0044
    // vorsieht.
    const warnungen = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(bewegungszeitFuerZeile(Number.NaN, 100)).toBeNaN()
      expect(bewegungszeitFuerZeile(50, Number.NaN)).toBeNaN()
      expect(warnungen).toHaveBeenCalledTimes(2)
      expect(String(warnungen.mock.calls[0]?.[0])).toContain('unbekannt')
      // Und der Beleg, dass daraus wirklich null wird - nicht die
      // Herleitung, sondern die Messung.
      expect(JSON.parse(JSON.stringify({ m: bewegungszeitFuerZeile(Number.NaN, 100) }))).toEqual({
        m: null,
      })
    } finally {
      warnungen.mockRestore()
    }
  })

  it('haelt die Zusage bei einer Laufzeit von null', () => {
    // Die Vorbedingung ist `dauerS >= 0`. Der Randfall 0 gehoert dazu und
    // muss halten: 0 <= 0.
    expect(bewegungszeitFuerZeile(0.4, 0)).toBe(0)
    expect(bewegungszeitFuerZeile(30, 0)).toBe(0)
  })

  it('deckelt auch, wenn die Bewegungszeit die Laufzeit klar ueberholt', () => {
    // Sollte in exakter Arithmetik nicht vorkommen - aber die Zusicherung
    // gilt der Datenbank gegenueber, nicht der Herleitung.
    expect(bewegungszeitFuerZeile(5000, 100)).toBe(100)
  })

  it('meldet einen Ueberschuss, der kein Rundungsfehler mehr sein kann', () => {
    // DER WICHTIGE TEST an dieser Funktion.
    //
    // Der Rundungsueberschuss ist beweisbar hoechstens 1 s. Alles darueber
    // ist ein echter Defekt - und ohne Meldung haette die erste Fassung
    // dieser Behebung ihn in eine stille falsche Zahl verwandelt, wo vorher
    // ein 23514 laut aufgeschlagen waere. Die Zeile wird gespeichert, die
    // Zahl ist falsch, niemand erfaehrt es.
    //
    // Gefunden vom Agenten `pruefung` am 02.09.2026 - der Test darueber
    // schrieb den stillen Fall sogar als Sollwert fest.
    const warnungen = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // 1 s Ueberschuss: das ist noch Rundung, also still.
      bewegungszeitFuerZeile(101, 100)
      expect(warnungen).not.toHaveBeenCalled()

      // 2 s: kann keine Rundung mehr sein.
      bewegungszeitFuerZeile(102, 100)
      expect(warnungen).toHaveBeenCalledTimes(1)
      expect(String(warnungen.mock.calls[0]?.[0])).toContain('kein Rundungsfehler')
    } finally {
      warnungen.mockRestore()
    }
  })
})
