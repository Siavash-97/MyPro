import { describe, it, expect } from 'vitest'
import { haengendeLaeufe, MIN_PUNKTE_ZUM_ABSCHLIESSEN, type HaengenderLauf } from './haengenderLauf'
import { istSpeicherwuerdig } from './speicherwuerdig'

/**
 * Gemessen am 23.08.2026: Ein Lauf blieb beim Speichern haengen. Danach
 * stand er so da:
 *
 *   Lauf-Zeile     status 'tracking', distance_km null
 *   run_points     20 Punkte, vollstaendig, mit Urteilen
 *   Dienst         sauber, offen = 0
 *   Merker         geloescht
 *
 * Beim naechsten Start sagte die Bergung "nichts zu tun" - sie fragt den
 * DIENST, und der hatte nichts mehr. Dass eine Lauf-Zeile auf 'tracking'
 * fuer sich schon ein Fund ist, wusste niemand.
 *
 * Diese Datei ist die Entscheidung: Welche haengenden Laeufe duerfen
 * nachtraeglich abgeschlossen werden - und welche nicht?
 */
const jetzt = Date.parse('2026-08-23T20:00:00Z')
const lauf = (o: Partial<HaengenderLauf> = {}): HaengenderLauf => ({
  id: 'a',
  status: 'tracking',
  started_at: '2026-08-23T19:00:00Z',
  punkte: 20,
  zuletztGemessen: '2026-08-23T19:05:00Z',
  ...o,
})

describe('haengendeLaeufe', () => {
  it('findet einen Lauf, der auf tracking steht und Punkte hat', () => {
    expect(haengendeLaeufe([lauf()], null, jetzt).map((l) => l.id)).toEqual(['a'])
  })

  it('laesst den Lauf in Ruhe, der GERADE laeuft', () => {
    // Der wichtigste Fall: Wer gerade unterwegs ist, darf nicht mitten im
    // Lauf "abgeschlossen" werden. Die laufende Sitzung kennt der Store.
    expect(haengendeLaeufe([lauf()], 'a', jetzt)).toEqual([])
  })

  it('laesst einen Lauf in Ruhe, der noch keine Schonfrist hinter sich hat', () => {
    // Ein Lauf, der vor zwei Minuten begann, koennte gerade erst gestartet
    // worden sein - etwa auf einem zweiten Geraet. Ihn abzuschliessen waere
    // schlimmer als ihn liegen zu lassen.
    const frisch = lauf({
      started_at: '2026-08-23T19:59:00Z',
      zuletztGemessen: '2026-08-23T19:59:30Z',
    })
    expect(haengendeLaeufe([frisch], null, jetzt)).toEqual([])
  })

  it('laesst einen Lauf in Ruhe, in den GERADE NOCH Punkte laufen', () => {
    // Gefunden vom Pruefagenten, 23.08.2026. Die Schonfrist lief vom START.
    // Damit war JEDER Lauf, der laenger als fuenf Minuten dauert, von einem
    // zweiten Geraet aus abschliessbar - und ein Halbmarathon ist zweieinhalb
    // Stunden lang offen.
    //
    // Der Start sagt nur, wann jemand losgelaufen ist. Ob er noch laeuft,
    // sagt die LETZTE MESSUNG. Ein Lauf, dessen letzter Punkt eine Minute
    // alt ist, laeuft - egal, wie lange er schon dauert.
    const laeuft = lauf({
      started_at: '2026-08-23T17:00:00Z',   // vor drei Stunden gestartet
      zuletztGemessen: '2026-08-23T19:59:00Z', // aber vor einer Minute gemessen
    })
    expect(haengendeLaeufe([laeuft], null, jetzt)).toEqual([])
  })

  it('faellt auf den Start zurueck, wenn keine letzte Messung bekannt ist', () => {
    // Ein Lauf ohne einen einzigen Punkt hat keine letzte Messung. Dann ist
    // der Start das Beste, was es gibt - die alte Regel als Rueckfall, nicht
    // als Hauptweg.
    const ohne = lauf({ zuletztGemessen: null })
    expect(haengendeLaeufe([ohne], null, jetzt).map((l) => l.id)).toEqual(['a'])
  })

  it('laesst einen Lauf ohne genug Punkte in Ruhe', () => {
    // Ohne Punkte gibt es nichts zu rechnen. Eine Zeile mit drei Punkten
    // abzuschliessen hiesse, einen Lauf ueber null Komma null zu erfinden.
    expect(haengendeLaeufe([lauf({ punkte: MIN_PUNKTE_ZUM_ABSCHLIESSEN - 1 })], null, jetzt))
      .toEqual([])
  })

  it('ruehrt nichts an, was nicht auf tracking steht', () => {
    expect(haengendeLaeufe([lauf({ status: 'completed' })], null, jetzt)).toEqual([])
  })

  it('haelt unsinnige Angaben aus', () => {
    expect(haengendeLaeufe(undefined, null, jetzt)).toEqual([])
    // Unlesbarer Start: raus, auch mit brauchbarer letzter Messung - er
    // traegt die Sortierung.
    expect(haengendeLaeufe([lauf({ started_at: 'kaputt' })], null, jetzt)).toEqual([])
    expect(haengendeLaeufe([lauf({ zuletztGemessen: 'kaputt' })], null, jetzt).map((l) => l.id))
      .toEqual(['a'])   // unlesbare Messung: Rueckfall auf den Start
  })

  it('gibt aeltere zuerst - sie warten am laengsten', () => {
    const alt = lauf({ id: 'alt', started_at: '2026-08-21T10:00:00Z' })
    const neuer = lauf({ id: 'neu', started_at: '2026-08-23T18:00:00Z' })
    expect(haengendeLaeufe([neuer, alt], null, jetzt).map((l) => l.id)).toEqual(['alt', 'neu'])
  })
})

/**
 * Die Kennzahlen eines haengenden Laufs entstehen aus seinen PUNKTEN -
 * denselben, die `laufBilanz` auch sonst liest, samt gespeicherter Urteile
 * (Migration 0051). Kein zweiter Rechenweg: Genau daran ist B1 gescheitert.
 */
describe('kennzahlenAusPunkten', () => {
  // Knopfdruck 30 s vor dem ersten Punkt. So ist es in Wirklichkeit: Der
  // erste Punkt entsteht erst nach GPS-Fix und Bewegungserkennung.
  const START = 1_700_000_000_000 - 30_000
  const punkt = (m: number, s: number, urteil: 'gezaehlt' | 'halt' | 'sprung' | null = null) => ({
    latitude: 50.94 + m / 111_195,
    longitude: 6.96,
    recorded_at: new Date(1_700_000_000_000 + s * 1000).toISOString(),
    urteil,
  })

  it('rechnet Strecke und Zeit aus den Punkten', async () => {
    const { kennzahlenAusPunkten } = await import('./haengenderLauf')
    // Drei Punkte, je 20 m in 10 s: 2 m/s.
    const k = kennzahlenAusPunkten([punkt(0, 0), punkt(20, 10), punkt(40, 20)], START)

    expect(k).not.toBeNull()
    expect(k!.distance_km).toBeCloseTo(0.04, 3)
    // 30 s Wartezeit auf den Fix + 20 s Messung. Die Dauer laeuft ab dem
    // Knopfdruck - genau wie bei stopRun, sonst waere istSpeicherwuerdig
    // wieder zwei Regeln.
    expect(k!.duration_s).toBe(50)
    expect(k!.moving_time_s).toBe(20)   // Bewegungszeit nur, was gemessen wurde
    expect(k!.status).toBe('completed')
  })

  it('gibt null, wenn zu wenig da ist, um etwas zu behaupten', async () => {
    const { kennzahlenAusPunkten } = await import('./haengenderLauf')
    expect(kennzahlenAusPunkten([], START)).toBeNull()
    expect(kennzahlenAusPunkten([punkt(0, 0)], START)).toBeNull()
    // Ohne lesbaren Start gibt es keine Dauer - und keine erfundene.
    expect(kennzahlenAusPunkten([punkt(0, 0), punkt(20, 10)], NaN)).toBeNull()
  })

  it('erfindet keine Hoehenmeter', async () => {
    // Die Hoehe ist seit dem 22.08. nachweislich unbrauchbar. Ein
    // nachtraeglich abgeschlossener Lauf darf nicht schlechter sein als
    // ein normaler - er bekommt null, nicht eine erfundene Zahl.
    const { kennzahlenAusPunkten } = await import('./haengenderLauf')
    const k = kennzahlenAusPunkten([punkt(0, 0), punkt(20, 10)], START)
    expect(k!.elevation_gain_m).toBeNull()
  })

  it('setzt das Ende auf die letzte Messung, nicht auf jetzt', async () => {
    // Sonst zaehlte bei einem Lauf, der ueber Nacht liegenblieb, die ganze
    // Nacht als Laufzeit - derselbe Fehler wie bei der Bergung heute Morgen.
    const { kennzahlenAusPunkten } = await import('./haengenderLauf')
    const k = kennzahlenAusPunkten([punkt(0, 0), punkt(20, 10)], START)
    expect(k!.ended_at).toBe(new Date(1_700_000_000_000 + 10_000).toISOString())
  })
})

describe('istSpeicherwuerdig', () => {
  /**
   * Gefunden vom Pruefagenten, 23.08.2026: **Zwei Regeln fuer eine Frage.**
   *
   * Beim gewoehnlichen Stoppen entschied `store/run.ts` ueber
   * MIN_SAVE_DISTANCE_KM (0,1 km) und MIN_SAVE_DURATION_S (60 s). Die
   * nachtraegliche Bergung entschied ueber MIN_PUNKTE_ZUM_ABSCHLIESSEN (10
   * Punkte). Derselbe Lauf - 12 Punkte, 80 Meter, 40 Sekunden - wurde beim
   * Stoppen verworfen und beim Bergen gespeichert.
   *
   * Das ist genau der Fehler, an dem B1 hing: eine Frage, zwei Rechenwege,
   * die auseinanderlaufen. Die Punktzahl bleibt als VORFILTER (ohne Punkte
   * gibt es nichts zu rechnen); das Urteil faellt jetzt an einer Stelle.
   */
  it('nimmt, was lang und weit genug ist', () => {
    // Der Gehtest vom 23.08.: 213 m in 192 s.
    expect(istSpeicherwuerdig(0.213, 192)).toBe(true)
  })

  it('verwirft, was zu kurz ist - auch wenn die Strecke reicht', () => {
    expect(istSpeicherwuerdig(0.5, 59)).toBe(false)
  })

  it('verwirft, was zu wenig Strecke hat - auch wenn die Zeit reicht', () => {
    // Zehn Minuten auf der Stelle sind kein Lauf.
    expect(istSpeicherwuerdig(0.099, 600)).toBe(false)
  })

  it('haelt unsinnige Angaben aus', () => {
    expect(istSpeicherwuerdig(NaN, 600)).toBe(false)
    expect(istSpeicherwuerdig(1, NaN)).toBe(false)
    expect(istSpeicherwuerdig(-1, 600)).toBe(false)
  })
})
