/**
 * Sicherung des laufenden Laufs auf dem Geraet.
 *
 * Warum es das braucht: Waehrend des Laufs steht bewusst nichts in der
 * Datenbank (siehe store/run.ts). Bisher lag der Lauf damit ausschliesslich im
 * Arbeitsspeicher – wenn der Browser die Seite einfriert oder verwirft, weil
 * jemand die App in den Hintergrund schiebt, war der Lauf ersatzlos weg.
 *
 * Diese Datei sichert den Zwischenstand lokal und stellt ihn beim Zurueckkommen
 * wieder her. Sie kennt absichtlich nur einfache Daten und keinen Speicher,
 * damit sie fuer sich pruefbar bleibt.
 */
const SESSION_KEY = 'myprosole_laufender_lauf'

/** Aelter als das: Der Lauf gilt als vergessen und wird nicht angeboten. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface RunSessionPoint {
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  recorded_at: string
}

export interface RunSession {
  /** Zeitpunkt der letzten Sicherung – zeigt beim Zurueckkommen die Luecke. */
  savedAt: number
  distanceKm: number
  durationS: number
  elevationGainM: number
  totalPausedMs: number
  points: RunSessionPoint[]
}

export function saveRunSession(session: RunSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Kein Platz oder gesperrter Speicher: Der Lauf laeuft weiter, er ist nur
    // nicht gesichert. Das darf die Aufzeichnung nicht abbrechen.
  }
}

export function loadRunSession(): RunSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null

    const session = JSON.parse(raw) as RunSession
    if (typeof session?.savedAt !== 'number' || !Array.isArray(session.points)) {
      clearRunSession()
      return null
    }
    if (Date.now() - session.savedAt > MAX_AGE_MS) {
      clearRunSession()
      return null
    }
    return session
  } catch {
    clearRunSession()
    return null
  }
}

export function clearRunSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // siehe oben
  }
}
