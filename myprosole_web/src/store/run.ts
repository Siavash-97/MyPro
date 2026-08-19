import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'
import { punktMerken, offenePunkte } from '../lib/punktePuffer'
import { offeneSenden } from '../lib/punkteSenden'
import type { Run, RunPoint, RunSplit } from '../types'

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// GPS steht nie still. Ein ruhig liegendes Telefon "wandert" um einige Meter
// pro Minute, und ohne Filter zaehlt die App dieses Rauschen als Strecke –
// nach einer halben Minute Stillstand standen so 0,0 km bei 67:31 min/km auf
// dem Schirm, mit Zickzack auf der Karte.
//
// Drei Schwellen fangen das ab. Die Werte sind bewusst grosszuegig: Sie
// sollen Rauschen wegnehmen, ohne langsames Laufen zu verschlucken.
/** Ungenauere Messungen werden ganz verworfen (Meter). */
const MAX_ACCURACY_M = 25
/** Darunter ist es Rauschen, keine Bewegung (5 m). */
const MIN_SEGMENT_KM = 0.005
/** Darueber ist es ein Sprung, keine Strecke – Tunnel, Neuortung (500 m). */
const MAX_SEGMENT_KM = 0.5
/** Vorher ist jedes Tempo geraten und wird als "--:--" gezeigt (50 m). */
const MIN_PACE_DISTANCE_KM = 0.05

// Die folgenden drei Regeln stammen aus der ueblichen Praxis von
// Lauf-Aufzeichnern (siehe docs/gps-genauigkeit.md).

/**
 * Aeltere Messungen werden verworfen. Das Geraet liefert manchmal einen
 * zwischengespeicherten Standort von vorhin; bei Laufgeschwindigkeit sind
 * 10 Sekunden bereits rund 40 Meter Fehler.
 */
const MAX_ALTER_MS = 10_000

/**
 * Schneller kann niemand laufen (12,5 m/s sind 45 km/h; der Weltrekord ueber
 * 100 m liegt bei rund 10,4 m/s im Schnitt). Was darueber liegt, ist ein
 * Ortungssprung und zaehlt nicht als Strecke.
 */
const MAX_TEMPO_MPS = 12.5

/**
 * Hoehenmeter erst ab diesem Anstieg zaehlen. Die Hoehe ist die mit Abstand
 * unzuverlaessigste Angabe des GPS – deutlich schlechter als Laenge und
 * Breite. Summiert man jede kleine Schwankung auf, kommt ein Vielfaches des
 * echten Anstiegs heraus: Ein bekannter Fall meldete 1316 statt 630 Metern.
 * Verglichen wird mit der letzten GEZAEHLTEN Hoehe, nicht mit dem letzten
 * Punkt – sonst verschluckt die Schwelle einen langen, flachen Anstieg.
 */
const MIN_HOEHENSCHRITT_M = 3

/**
 * Ueber so viele Messungen wird die Hoehe gemittelt, bevor die Schwelle
 * greift. Eine Schwelle allein genuegt nicht: Schwankt die Hoehe um mehr als
 * die Schwelle auf und ab – und das tut sie, echtes Rauschen liegt eher bei
 * 5 bis 10 Metern –, dann zaehlt jeder Ausschlag als Anstieg. Gemessen kamen
 * so 36 Hoehenmeter auf platter Strecke zusammen. Erst glaetten, dann
 * vergleichen; so machen es die Fachprojekte auch.
 */
const HOEHEN_FENSTER = 5

function formatPace(totalSeconds: number, distanceKm: number): string {
  if (distanceKm < MIN_PACE_DISTANCE_KM) return '--:--'
  const paceS = totalSeconds / distanceKm
  const mins = Math.floor(paceS / 60)
  const secs = Math.floor(paceS % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export { formatPace }

type TrackingPhase = 'idle' | 'tracking' | 'paused' | 'saving' | 'completed'

interface LiveStats {
  distanceKm: number
  durationS: number
  paceDisplay: string
  elevationGainM: number
}

interface PointBuffer {
  latitude: number
  longitude: number
  altitude_m: number | null
  accuracy_m: number | null
  speed_mps: number | null
  recorded_at: string
}

export interface LiveSplit {
  distance_km: number
  duration_s: number
  pace_s_per_km: number
  elevation_gain_m: number | null
}

interface RunState {
  phase: TrackingPhase
  activeRunId: string | null
  liveStats: LiveStats
  points: PointBuffer[]
  /** Laeuft gerade eine Uebertragung? Verhindert, dass sich zwei ueberholen. */
  sendetGerade: boolean
  splits: LiveSplit[]
  /** Zeitpunkt des Knopfdrucks. Die Uhr laeuft davon an, nicht ab dem ersten
   *  GPS-Punkt – sonst steht sie, bis das Telefon einen Fix hat. */
  startedAtMs: number | null
  /** Letzte gezaehlte Hoehe, Bezug fuer MIN_HOEHENSCHRITT_M. */
  elevationRefM: number | null
  /**
   * Genauigkeit der zuletzt eingegangenen Messung in Metern – auch wenn sie
   * verworfen wurde. Genau dann ist die Angabe naemlich interessant: Sie
   * zeigt, ob das Signal gerade schlecht ist. Vorbild ist der Ring um die
   * eigene Position bei Strava; je kleiner, desto besser.
   */
  lastAccuracyM: number | null
  pauseStart: number | null
  totalPausedMs: number

  recentRuns: Run[]
  selectedRun: Run | null
  selectedRunSplits: RunSplit[]
  selectedRunPoints: RunPoint[]
  loading: boolean

  startRun: () => void
  /** Schickt die gepufferten Punkte. Takt und Laufende rufen es auf. */
  punkteUebertragen: () => Promise<void>
  pauseRun: () => void
  resumeRun: () => void
  /** Speichert den Lauf. runId bleibt null, wenn zu wenig zusammenkam. */
  stopRun: () => Promise<{ runId: string | null; error: string | null }>
  discardRun: () => void
  addPoint: (pos: GeolocationPosition) => void
  tick: () => void

  /**
   * Loescht alle eigenen Laeufe. Punkte und Abschnitte gehen per Kaskade mit.
   * Gibt die Anzahl zurueck, damit die Seite sagen kann, was passiert ist.
   */
  deleteAllRuns: () => Promise<{ anzahl: number; error: string | null }>
  fetchRecentRuns: (limit?: number) => Promise<void>
  fetchRun: (id: string) => Promise<void>
  fetchRunSplits: (runId: string) => Promise<void>
  fetchRunPoints: (runId: string) => Promise<void>
  reset: () => void
}

const INITIAL_LIVE: LiveStats = {
  distanceKm: 0,
  durationS: 0,
  paceDisplay: '--:--',
  elevationGainM: 0,
}

// Unterhalb dieser Werte war es kein Lauf, sondern ein versehentlicher Tipper
// oder ein Blick auf den Bildschirm. Solche Aufzeichnungen werden gar nicht
// erst gespeichert – sonst stehen im Verlauf Laeufe mit 0,0 km.
const MIN_SAVE_DISTANCE_KM = 0.1
const MIN_SAVE_DURATION_S = 60


export const useRun = create<RunState>((set, get) => ({
  phase: 'idle',
  activeRunId: null,
  liveStats: { ...INITIAL_LIVE },
  points: [],
  sendetGerade: false,
  splits: [],
  startedAtMs: null,
  elevationRefM: null,
  lastAccuracyM: null,
  pauseStart: null,
  totalPausedMs: 0,

  recentRuns: [],
  selectedRun: null,
  selectedRunSplits: [],
  selectedRunPoints: [],
  loading: false,

  // Der Lauf laeuft zunaechst nur im Geraet. Geschrieben wird erst beim
  // Beenden (siehe stopRun) – so entsteht kein Eintrag, nur weil jemand den
  // Bildschirm geoeffnet hat.
  startRun: () => {
    set({
      phase: 'tracking',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      startedAtMs: Date.now(),
      elevationRefM: null,
      lastAccuracyM: null,
      pauseStart: null,
      totalPausedMs: 0,
    })

    // Die Zeile entsteht sofort, nicht erst am Ende. Nur so koennen die
    // Punkte waehrend des Laufs geschrieben werden – vorher gab es nichts,
    // woran sie haengen konnten, und ein leerer Akku kostete den ganzen
    // Lauf. Der Status 'tracking' war dafuer von Anfang an vorgesehen.
    //
    // Scheitert es (kein Netz), laeuft die Aufzeichnung trotzdem: Die
    // Punkte sammeln sich auf dem Geraet, und am Ende wird die Zeile
    // nachgeholt.
    const userId = eigeneKennung()
    if (!userId) return
    supabase
      .from('runs')
      .insert({ user_id: userId, status: 'tracking' as const, started_at: new Date().toISOString() })
      .select('id')
      .single()
      .then(({ data }) => {
        if (data) set({ activeRunId: (data as { id: string }).id })
      })
  },

  pauseRun: () => {
    if (get().phase !== 'tracking') return
    set({ phase: 'paused', pauseStart: Date.now() })
  },

  resumeRun: () => {
    const { phase, pauseStart, totalPausedMs } = get()
    if (phase !== 'paused') return
    const extra = pauseStart ? Date.now() - pauseStart : 0
    set({
      phase: 'tracking',
      pauseStart: null,
      totalPausedMs: totalPausedMs + extra,
    })
  },

  stopRun: async () => {
    const { points, liveStats, totalPausedMs, pauseStart, startedAtMs } = get()

    // Zu kurz oder ohne Strecke: nichts speichern. Der Verlauf bleibt sauber,
    // und niemand findet Laeufe, die er nie gemacht hat.
    if (
      liveStats.distanceKm < MIN_SAVE_DISTANCE_KM ||
      liveStats.durationS < MIN_SAVE_DURATION_S
    ) {
      get().discardRun()
      return { runId: null, error: null }
    }

    set({ phase: 'saving' })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ phase: 'tracking' })
      return { runId: null, error: 'Nicht angemeldet' }
    }

    let finalPausedMs = totalPausedMs
    if (pauseStart) finalPausedMs += Date.now() - pauseStart

    const splits = computeSplits(points)
    // Der Knopfdruck ist der Start, nicht der erste GPS-Punkt – sonst waere
    // die gespeicherte Startzeit spaeter als die gemessene Laufzeit.
    const startedAt = new Date(startedAtMs ?? Date.now() - liveStats.durationS * 1000).toISOString()

    const kennzahlen = {
      status: 'completed' as const,
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      paused_duration_s: Math.round(finalPausedMs / 1000),
      distance_km: Math.round(liveStats.distanceKm * 1000) / 1000,
      duration_s: liveStats.durationS,
      avg_pace_s_per_km: Math.round(liveStats.durationS / liveStats.distanceKm),
      elevation_gain_m: Math.round(liveStats.elevationGainM * 10) / 10,
    }

    // Die Zeile gibt es meist schon – sie entsteht beim Start, damit die
    // Punkte waehrend des Laufs irgendwo hinkoennen. Hier bekommt sie ihre
    // Kennzahlen und den Status.
    //
    // Fehlt sie (kein Netz beim Start), wird sie jetzt angelegt. Die
    // gepufferten Punkte tragen dann noch keine Laufkennung; sie gehen
    // gleich unten mit der richtigen raus.
    const vorhandeneId = get().activeRunId
    const { data, error } = vorhandeneId
      ? await supabase.from('runs').update(kennzahlen).eq('id', vorhandeneId).select().single()
      : await supabase.from('runs').insert({ user_id: user.id, ...kennzahlen }).select().single()

    if (error || !data) {
      set({ phase: 'tracking' })
      return { runId: null, error: error?.message ?? 'Lauf konnte nicht gespeichert werden' }
    }

    const runId = (data as Run).id

    // Der Rest aus dem Puffer. Das meiste ist waehrend des Laufs schon
    // uebertragen worden – hier bleiben nur die letzten Sekunden.
    //
    // Falls beim Start kein Netz war und die Lauf-Zeile erst jetzt entstand,
    // haben die gepufferten Punkte eine andere Kennung: Sie werden auf die
    // richtige umgeschrieben, bevor sie rausgehen.
    if (!vorhandeneId) {
      const liegend = await offenePunkte()
      for (const punkt of liegend) {
        if (punkt.run_id !== runId) await punktMerken({ ...punkt, run_id: runId })
      }
    }
    await offeneSenden()

    if (splits.length > 0) {
      await supabase.from('run_splits').insert(
        splits.map((s, i) => ({
          run_id: runId,
          split_number: i + 1,
          distance_km: s.distance_km,
          duration_s: s.duration_s,
          pace_s_per_km: s.pace_s_per_km,
          elevation_gain_m: s.elevation_gain_m,
        })),
      )
    }

    set({ phase: 'completed', splits, activeRunId: runId })
    return { runId, error: null }
  },

  // Verwerfen heisst hier wirklich verwerfen: Es gibt nichts zu loeschen,
  // weil waehrend des Laufs nichts geschrieben wurde.
  discardRun: () => {
    set({
      phase: 'idle',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      startedAtMs: null,
      elevationRefM: null,
      lastAccuracyM: null,
      pauseStart: null,
      totalPausedMs: 0,
    })
  },

  addPoint: (pos) => {
    if (get().phase !== 'tracking') return

    // Zuerst festhalten, wie gut das Signal gerade ist – auch wenn die
    // Messung gleich verworfen wird. Sonst sieht der Laeufer nie, dass sein
    // Empfang das Problem ist.
    const genauigkeit = pos.coords.accuracy
    if (genauigkeit != null && genauigkeit >= 0) set({ lastAccuracyM: genauigkeit })

    // Eine ungenaue Messung ist schlimmer als gar keine: Sie verschiebt den
    // Bezugspunkt, und der naechste Abstand wird davon aus gerechnet.
    // Ein negativer Wert heisst bei manchen Geraeten "ungueltig".
    if (genauigkeit != null && (genauigkeit < 0 || genauigkeit > MAX_ACCURACY_M)) return

    // Zwischengespeicherter Standort von vorhin: verwerfen.
    if (Date.now() - pos.timestamp > MAX_ALTER_MS) return

    const pt: PointBuffer = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude_m: pos.coords.altitude,
      accuracy_m: pos.coords.accuracy,
      speed_mps: pos.coords.speed,
      recorded_at: new Date(pos.timestamp).toISOString(),
    }

    const prev = get().points
    let { distanceKm, elevationGainM } = get().liveStats
    let hoeheRef = get().elevationRefM

    if (prev.length > 0) {
      const last = prev[prev.length - 1]
      const segKm = haversineKm(last.latitude, last.longitude, pt.latitude, pt.longitude)

      // Rauschen: Punkt gar nicht erst aufnehmen. Verglichen wird immer mit
      // dem letzten ANGENOMMENEN Punkt – wer langsam geht, ueberschreitet die
      // Schwelle also nach ein paar Messungen trotzdem, es geht nichts
      // verloren. Nebenbei bleibt die Karte sauber statt zu zappeln.
      if (segKm < MIN_SEGMENT_KM) return

      // Ortungssprung: Der Punkt wird zum neuen Bezug, seine Strecke zaehlt
      // aber nicht. Geprueft wird ueber das Tempo, weil eine feste
      // Streckengrenze bei langer Pause zwischen zwei Messungen zuschlaegt und
      // bei kurzer einen unmoeglichen Satz durchlaesst.
      const sekunden =
        (new Date(pt.recorded_at).getTime() - new Date(last.recorded_at).getTime()) / 1000
      const tempoMps = sekunden > 0 ? (segKm * 1000) / sekunden : Infinity
      const sprung = segKm > MAX_SEGMENT_KM || tempoMps > MAX_TEMPO_MPS

      if (!sprung) {
        distanceKm += segKm
      }
    }

    // Hoehenmeter: erst ueber die letzten Messungen mitteln, dann die
    // Schwelle anlegen.
    const geglaettet = mittlereHoehe([...prev.slice(-(HOEHEN_FENSTER - 1)), pt])
    if (geglaettet != null) {
      hoeheRef = hoeheAktualisieren(geglaettet, hoeheRef, (zuwachs) => {
        elevationGainM += zuwachs
      })
    }

    set({
      points: [...prev, pt],
      liveStats: { ...get().liveStats, distanceKm, elevationGainM },
      elevationRefM: hoeheRef,
    })

    // Sofort auf das Geraet. Das gelingt immer und braucht kein Netz – es
    // ist der eigentliche Schutz gegen Datenverlust. Uebertragen wird
    // spaeter in Buendeln.
    const runId = get().activeRunId
    if (runId) {
      punktMerken({ client_id: crypto.randomUUID(), run_id: runId, ...pt })
        .catch(() => {
          // Schlaegt der Puffer fehl, laeuft die Aufzeichnung weiter: Der
          // Punkt steht im Arbeitsspeicher und geht am Ende mit.
        })
    }
  },

  /**
   * Uebertraegt, was auf dem Geraet liegt. Wird vom Takt alle 30 Sekunden
   * angestossen und am Ende des Laufs noch einmal.
   *
   * Fehler bleiben ohne Folge: Was nicht ankam, liegt weiter auf dem Geraet
   * und geht beim naechsten Versuch mit.
   */
  punkteUebertragen: async () => {
    if (get().sendetGerade) return
    set({ sendetGerade: true })
    try {
      await offeneSenden()
    } finally {
      set({ sendetGerade: false })
    }
  },

  tick: () => {
    const { phase, startedAtMs, liveStats, totalPausedMs } = get()
    if (phase !== 'tracking' || startedAtMs == null) return

    const elapsed = Date.now() - startedAtMs - totalPausedMs
    const durationS = Math.max(0, Math.floor(elapsed / 1000))

    // Alle 30 Sekunden uebertragen. Der Takt laeuft ohnehin jede Sekunde –
    // ein eigener Zeitgeber waere ein zweiter Ort, an dem etwas haengen
    // bleiben kann.
    if (durationS > 0 && durationS % 30 === 0) get().punkteUebertragen()

    set({
      liveStats: {
        ...liveStats,
        durationS,
        paceDisplay: formatPace(durationS, liveStats.distanceKm),
      },
    })
  },

  deleteAllRuns: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { anzahl: 0, error: 'Nicht angemeldet' }

    // Ausdruecklich auf das eigene Konto eingegrenzt. Die Zeilenrechte lassen
    // ohnehin nichts anderes zu, aber ein Loeschbefehl ohne Bedingung soll
    // hier gar nicht erst stehen.
    const { data, error } = await supabase
      .from('runs')
      .delete()
      .eq('user_id', user.id)
      .select('id')

    if (error) return { anzahl: 0, error: error.message }

    set({ recentRuns: [], selectedRun: null, selectedRunSplits: [], selectedRunPoints: [] })
    return { anzahl: (data ?? []).length, error: null }
  },

  fetchRecentRuns: async (limit = 50) => {
    set({ loading: true })
    const { data } = await supabase
      .from('runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    set({ recentRuns: (data ?? []) as Run[], loading: false })
  },

  fetchRun: async (id) => {
    set({ loading: true })
    const { data } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .single()

    set({ selectedRun: (data as Run) ?? null, loading: false })
  },

  fetchRunSplits: async (runId) => {
    const { data } = await supabase
      .from('run_splits')
      .select('*')
      .eq('run_id', runId)
      .order('split_number', { ascending: true })

    set({ selectedRunSplits: (data ?? []) as RunSplit[] })
  },

  fetchRunPoints: async (runId) => {
    const { data } = await supabase
      .from('run_points')
      .select('*')
      .eq('run_id', runId)
      .order('recorded_at', { ascending: true })

    set({ selectedRunPoints: (data ?? []) as RunPoint[] })
  },

  reset: () =>
    set({
      phase: 'idle',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      startedAtMs: null,
      elevationRefM: null,
      lastAccuracyM: null,
      pauseStart: null,
      totalPausedMs: 0,
    }),
}))

/** Mittelwert der Hoehe ueber die uebergebenen Punkte; null, wenn keiner eine hat. */
function mittlereHoehe(punkte: PointBuffer[]): number | null {
  const hoehen = punkte.map((p) => p.altitude_m).filter((h): h is number => h != null)
  if (hoehen.length === 0) return null
  return hoehen.reduce((a, b) => a + b, 0) / hoehen.length
}

/**
 * Hoehenmeter zaehlen, ohne auf Schwankungen hereinzufallen.
 *
 * Der Bezug wandert in BEIDE Richtungen erst, wenn die Aenderung die Schwelle
 * ueberschreitet. Ohne diese Sperre nach unten wuerde ein blosses Auf und Ab
 * als Anstieg gelten: Bei einer Schwelle von 3 m und einem Zappeln um 1,5 m
 * nach oben und unten liegt zwischen Tal und Gipfel genau die Schwelle – die
 * App wuerde bei jedem Ausschlag 3 Hoehenmeter gutschreiben, obwohl es flach
 * ist.
 *
 * Gibt den neuen Bezug zurueck; echten Zuwachs meldet sie ueber `gezaehlt`.
 */
function hoeheAktualisieren(
  hoehe: number,
  bezug: number | null,
  gezaehlt: (zuwachs: number) => void,
): number {
  if (bezug == null) return hoehe
  if (hoehe - bezug >= MIN_HOEHENSCHRITT_M) {
    gezaehlt(hoehe - bezug)
    return hoehe
  }
  // Nur ein echter Abstieg setzt den Bezug nach – sonst muesste er erst
  // wieder aufgeholt werden, bevor der naechste Anstieg zaehlt.
  if (bezug - hoehe >= MIN_HOEHENSCHRITT_M) return hoehe
  return bezug
}

function computeSplits(points: PointBuffer[]): LiveSplit[] {
  if (points.length < 2) return []

  const splits: LiveSplit[] = []
  let splitStart = 0
  let splitDist = 0
  let splitElev = 0
  // Bezugshoehe laeuft ueber die Abschnittsgrenze hinweg weiter: Der Anstieg
  // hoert am Kilometerstein ja nicht auf.
  let splitHoeheRef: number | null = null

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const seg = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
    if (seg > MAX_SEGMENT_KM) continue

    splitDist += seg

    // Dieselbe Regel wie live, sonst meldet die Summe der Abschnitte mehr
    // Hoehenmeter als der Lauf insgesamt.
    const geglaettet = mittlereHoehe(points.slice(Math.max(0, i - HOEHEN_FENSTER + 1), i + 1))
    if (geglaettet != null) {
      splitHoeheRef = hoeheAktualisieren(geglaettet, splitHoeheRef, (zuwachs) => {
        splitElev += zuwachs
      })
    }

    if (splitDist >= 1.0) {
      const durMs =
        new Date(curr.recorded_at).getTime() - new Date(points[splitStart].recorded_at).getTime()
      const durS = Math.round(durMs / 1000)

      splits.push({
        distance_km: Math.round(splitDist * 1000) / 1000,
        duration_s: durS,
        pace_s_per_km: splitDist > 0 ? Math.round(durS / splitDist) : 0,
        elevation_gain_m: Math.round(splitElev * 10) / 10,
      })

      splitStart = i
      splitDist = 0
      splitElev = 0
    }
  }

  if (splitDist > 0.05) {
    const durMs =
      new Date(points[points.length - 1].recorded_at).getTime() -
      new Date(points[splitStart].recorded_at).getTime()
    const durS = Math.round(durMs / 1000)

    splits.push({
      distance_km: Math.round(splitDist * 1000) / 1000,
      duration_s: durS,
      pace_s_per_km: splitDist > 0 ? Math.round(durS / splitDist) : 0,
      elevation_gain_m: Math.round(splitElev * 10) / 10,
    })
  }

  return splits
}
