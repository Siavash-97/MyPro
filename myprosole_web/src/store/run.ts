import { create } from 'zustand'
import { supabase } from '../lib/supabase'
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

function formatPace(totalSeconds: number, distanceKm: number): string {
  if (distanceKm <= 0) return '--:--'
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
  splits: LiveSplit[]
  pauseStart: number | null
  totalPausedMs: number

  recentRuns: Run[]
  selectedRun: Run | null
  selectedRunSplits: RunSplit[]
  selectedRunPoints: RunPoint[]
  loading: boolean

  startRun: () => Promise<string | null>
  pauseRun: () => void
  resumeRun: () => void
  stopRun: () => Promise<string | null>
  abandonRun: () => Promise<string | null>
  addPoint: (pos: GeolocationPosition) => void
  tick: () => void

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

export const useRun = create<RunState>((set, get) => ({
  phase: 'idle',
  activeRunId: null,
  liveStats: { ...INITIAL_LIVE },
  points: [],
  splits: [],
  pauseStart: null,
  totalPausedMs: 0,

  recentRuns: [],
  selectedRun: null,
  selectedRunSplits: [],
  selectedRunPoints: [],
  loading: false,

  startRun: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('runs')
      .insert({ user_id: user.id, status: 'tracking' as const })
      .select()
      .single()

    if (error) return error.message

    set({
      phase: 'tracking',
      activeRunId: (data as Run).id,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
      pauseStart: null,
      totalPausedMs: 0,
    })
    return null
  },

  pauseRun: () => {
    if (get().phase !== 'tracking') return
    set({ phase: 'paused', pauseStart: Date.now() })

    const runId = get().activeRunId
    if (runId) {
      supabase.from('runs').update({ status: 'paused' as const }).eq('id', runId).then(() => {})
    }
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

    const runId = get().activeRunId
    if (runId) {
      supabase.from('runs').update({ status: 'tracking' as const }).eq('id', runId).then(() => {})
    }
  },

  stopRun: async () => {
    const { activeRunId, points, liveStats, totalPausedMs, pauseStart } = get()
    if (!activeRunId) return 'Kein aktiver Lauf'

    set({ phase: 'saving' })

    let finalPausedMs = totalPausedMs
    if (pauseStart) finalPausedMs += Date.now() - pauseStart

    const splits = computeSplits(points)

    if (points.length > 0) {
      const batchSize = 500
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize).map((p) => ({
          run_id: activeRunId,
          latitude: p.latitude,
          longitude: p.longitude,
          altitude_m: p.altitude_m,
          accuracy_m: p.accuracy_m,
          speed_mps: p.speed_mps,
          recorded_at: p.recorded_at,
        }))
        await supabase.from('run_points').insert(batch)
      }
    }

    if (splits.length > 0) {
      await supabase.from('run_splits').insert(
        splits.map((s, i) => ({
          run_id: activeRunId,
          split_number: i + 1,
          distance_km: s.distance_km,
          duration_s: s.duration_s,
          pace_s_per_km: s.pace_s_per_km,
          elevation_gain_m: s.elevation_gain_m,
        })),
      )
    }

    const avgPace =
      liveStats.distanceKm > 0
        ? Math.round(liveStats.durationS / liveStats.distanceKm)
        : null

    const { error } = await supabase
      .from('runs')
      .update({
        status: 'completed' as const,
        ended_at: new Date().toISOString(),
        paused_duration_s: Math.round(finalPausedMs / 1000),
        distance_km: Math.round(liveStats.distanceKm * 1000) / 1000,
        duration_s: liveStats.durationS,
        avg_pace_s_per_km: avgPace,
        elevation_gain_m: Math.round(liveStats.elevationGainM * 10) / 10,
      })
      .eq('id', activeRunId)

    if (error) return error.message

    set({ phase: 'completed', splits })
    return null
  },

  abandonRun: async () => {
    const { activeRunId } = get()
    if (!activeRunId) return 'Kein aktiver Lauf'

    const { error } = await supabase
      .from('runs')
      .update({
        status: 'abandoned' as const,
        ended_at: new Date().toISOString(),
      })
      .eq('id', activeRunId)

    if (error) return error.message
    set({
      phase: 'idle',
      activeRunId: null,
      liveStats: { ...INITIAL_LIVE },
      points: [],
      splits: [],
    })
    return null
  },

  addPoint: (pos) => {
    if (get().phase !== 'tracking') return

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

    if (prev.length > 0) {
      const last = prev[prev.length - 1]
      const segKm = haversineKm(last.latitude, last.longitude, pt.latitude, pt.longitude)
      if (segKm < 0.5) {
        distanceKm += segKm
      }
      if (
        last.altitude_m != null &&
        pt.altitude_m != null &&
        pt.altitude_m > last.altitude_m
      ) {
        elevationGainM += pt.altitude_m - last.altitude_m
      }
    }

    set({
      points: [...prev, pt],
      liveStats: { ...get().liveStats, distanceKm, elevationGainM },
    })
  },

  tick: () => {
    const { phase, points, liveStats, totalPausedMs } = get()
    if (phase !== 'tracking' || points.length === 0) return

    const startMs = new Date(points[0].recorded_at).getTime()
    const elapsed = Date.now() - startMs - totalPausedMs
    const durationS = Math.max(0, Math.floor(elapsed / 1000))

    set({
      liveStats: {
        ...liveStats,
        durationS,
        paceDisplay: formatPace(durationS, liveStats.distanceKm),
      },
    })
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
      pauseStart: null,
      totalPausedMs: 0,
    }),
}))

function computeSplits(points: PointBuffer[]): LiveSplit[] {
  if (points.length < 2) return []

  const splits: LiveSplit[] = []
  let splitStart = 0
  let splitDist = 0
  let splitElev = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const seg = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude)
    if (seg >= 0.5) continue

    splitDist += seg

    if (prev.altitude_m != null && curr.altitude_m != null && curr.altitude_m > prev.altitude_m) {
      splitElev += curr.altitude_m - prev.altitude_m
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
