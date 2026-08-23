import { describe, it, expect, vi, beforeEach } from 'vitest'
import { laufBilanz } from '../lib/laufBilanz'

/**
 * Der Live-Weg gegen die Nachrechnung - am Store gemessen, nicht behauptet.
 *
 * Warum es diese Datei gibt
 * -------------------------
 * Am 23.08.2026 fand der Pruefagent: B1 war nur zur Haelfte behoben. Die
 * STRECKE folgte dem Segmenturteil (ueber die gespeicherten Punkte), die
 * ZEIT kam weiter aus `bewegungszeitZuwachsS` (ueber den rohen Messverlauf).
 * Zwei Eingangsstroeme, zwei Regeln - exakt die Bauart, die B1 heisst.
 *
 * Konkret vorfuehrbar am Nachlauf: Nach dem Unterschreiten des Tors gilt
 * noch zehn Sekunden lang "in Bewegung". Punkte werden gespeichert, ihre
 * Strecke zaehlt - aber `tempoMps < tor` gab der Zeit null. Strecke ohne
 * Zeit, unabhaengig von jeder Luecke.
 *
 * Und der Test, der das haette fangen sollen, konnte es nicht: "rechnet
 * schrittweise dasselbe wie am Stueck" verglich die Schleife ueber
 * `bilanzErweitern` mit sich selbst - tautologisch, per Konstruktion gruen.
 *
 * Was dieser Test stattdessen tut
 * -------------------------------
 * Er schickt rohe Messungen durch `addPoint` - mit allen Toren: Genauigkeit,
 * Mindestabstand, Bewegungserkennung, Nachlauf - und verlangt am Ende, dass
 * die Live-Zahlen auf dem Bildschirm dieselben sind wie eine Nachrechnung
 * ueber die gespeicherten Punkte. Das ist die Zusage, die auf der
 * Laufdetailseite sichtbar wird: Was live stand, muss auch hinterher
 * herauskommen.
 */

const stand = {
  offen: 0,
  erlaubt: true,
  gpsAn: true,
  pausiert: false,
  laeuft: false,
  laufId: null as string | null,
  letzterPunktMs: null as number | null,
  startMs: null as number | null,
  beendenGewuenscht: false,
}

vi.mock('../lib/aufzeichnungBruecke', () => ({
  aufTelefon: vi.fn(() => false),
  aufzeichnungStand: vi.fn(async () => stand),
  aufzeichnungStoppen: vi.fn(async () => {}),
  aufzeichnungStarten: vi.fn(async () => ({ gelungen: true, hindernis: null })),
  aufzeichnungPausieren: vi.fn(async () => {}),
  punkteAbholen: vi.fn(async () => []),
  punkteBestaetigen: vi.fn(async () => {}),
  punkteVerwerfen: vi.fn(async () => {}),
}))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({})),
  },
}))
vi.mock('../lib/laufMerker', () => ({
  merkerSetzen: vi.fn(),
  merkerLaufId: vi.fn(),
  merkerLoeschen: vi.fn(),
  merkerLesen: vi.fn(() => null),
}))
vi.mock('../lib/punktePuffer', () => ({
  punktMerken: vi.fn(async () => {}),
  offenePunkte: vi.fn(async () => []),
  punkteVerworfen: vi.fn(async () => {}),
}))
vi.mock('../lib/punkteSenden', async (original) => {
  const echt = (await original()) as Record<string, unknown>
  return { ...echt, offeneSenden: vi.fn(async () => ({ uebertragen: 0, offen: 0, fehler: null, ohneUrteil: false })) }
})
vi.mock('../lib/ruhepegelSpeicher', async () => {
  const { Ruhepegel } = await import('../lib/bewegung')
  return { ruhepegelLaden: () => new Ruhepegel(), ruhepegelSichern: vi.fn() }
})
vi.mock('../lib/eigeneKennung', () => ({ eigeneKennung: () => null }))

const START = 1_700_000_000_000

/**
 * Eine Messung in bekanntem Abstand: `nordM` Meter noerdlich des Starts.
 * 0,000135 Grad Breite sind rund 15 m.
 */
function messung(nordM: number, sekunde: number, tempoMps: number) {
  return {
    latitude: 50.94 + nordM / 111_195,
    longitude: 6.96,
    altitude_m: null,
    accuracy_m: 5,
    speed_mps: tempoMps,
    tempo_guete_mps: 0.1,
    zeitMs: START + sekunde * 1000,
    // ausPuffer umgeht nur die Frische-Pruefung gegen die Wanduhr - die
    // Messungen hier sind synthetisch und "alt".
    ausPuffer: true,
  }
}

async function frischerStore() {
  vi.resetModules()
  const { useRun } = await import('./run')
  useRun.setState({ phase: 'tracking', startedAtMs: START, sitzungId: 'sitzung-1' } as never)
  return useRun
}

describe('Live-Weg gegen Nachrechnung', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('zaehlt im Nachlauf Strecke und Zeit gemeinsam, nicht die Strecke allein', async () => {
    const useRun = await frischerStore()
    const { addPoint } = useRun.getState()

    // Zuerst echtes Gehen: 15 m alle 5 s sind 3 m/s, klar ueber dem Tor.
    addPoint(messung(0, 0, 3))
    addPoint(messung(15, 5, 3))
    addPoint(messung(30, 10, 3))

    // Dann faellt das gemeldete Tempo unter das Tor, aber die Position
    // wandert weiter (Auslauf, GPS-Traegheit). Innerhalb der Haltezeit gilt
    // weiter "in Bewegung" - die Punkte werden gespeichert.
    addPoint(messung(45, 15, 0.3))
    addPoint(messung(60, 20, 0.3))

    const { liveStats, points } = useRun.getState()
    expect(points.length).toBeGreaterThanOrEqual(4)

    const nachgerechnet = laufBilanz(points)

    // Die Zusage: Live-Anzeige und Nachrechnung ueber dieselben Punkte
    // ergeben dasselbe. Vor der Behebung: Strecke 60 m in beiden, aber
    // Zeit 10 s live gegen 20 s nachgerechnet - Strecke ohne Zeit.
    expect(liveStats.distanceKm).toBeCloseTo(nachgerechnet.streckeKm, 6)
    expect(liveStats.bewegungszeitS).toBeCloseTo(nachgerechnet.bewegungszeitS, 3)
  })

  it('zaehlt im Stand weder Strecke noch Zeit', async () => {
    const useRun = await frischerStore()
    const { addPoint } = useRun.getState()

    // Stillstand: Tempo null, Position fest. Es darf nie ein Punkt
    // gespeichert werden - und damit auch nichts wachsen.
    for (let i = 0; i < 20; i++) addPoint(messung(0, i, 0))

    const { liveStats, points } = useRun.getState()
    expect(points).toEqual([])
    expect(liveStats.distanceKm).toBe(0)
    expect(liveStats.bewegungszeitS).toBe(0)
  })

  it('bleibt mit der Nachrechnung im Gleichschritt, wenn Messungen aussortiert werden', async () => {
    const useRun = await frischerStore()
    const { addPoint } = useRun.getState()

    addPoint(messung(0, 0, 3))
    addPoint(messung(15, 5, 3))
    // Zu ungenau fuer Strecke und Karte - darf nicht gespeichert werden.
    addPoint({ ...messung(30, 10, 3), accuracy_m: 80 })
    // Zu nah am letzten GESPEICHERTEN Punkt (unter 10 m).
    addPoint(messung(20, 12, 3))
    // Und weiter im Takt.
    addPoint(messung(45, 20, 3))

    const { liveStats, points } = useRun.getState()
    const nachgerechnet = laufBilanz(points)

    expect(liveStats.distanceKm).toBeCloseTo(nachgerechnet.streckeKm, 6)
    expect(liveStats.bewegungszeitS).toBeCloseTo(nachgerechnet.bewegungszeitS, 3)
  })
})
