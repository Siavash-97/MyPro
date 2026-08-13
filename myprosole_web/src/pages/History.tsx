import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkout } from '../store/workout'
import { useRun, formatPace } from '../store/run'
import type { Run } from '../types'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import FilterChip from '../components/ui/FilterChip'

type TimeFilter = 'week' | 'month' | 'year' | 'all'

const TIME_LABELS: Record<TimeFilter, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
  all: 'Alle',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '–'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')} h`
}

function formatRunDuration(s: number | null): string {
  if (s == null) return '–'
  const mins = Math.floor(s / 60)
  const secs = s % 60
  if (mins < 60) return `${mins}:${String(secs).padStart(2, '0')} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')} h`
}

function scoreColor(score: number | null): string {
  if (score == null) return 'bg-surface-container-high text-on-surface'
  if (score >= 70) return 'bg-success-container text-on-success-container'
  if (score >= 50) return 'bg-warning-container text-on-warning-container'
  return 'bg-error-container text-on-error-container'
}

function cutoffDate(filter: TimeFilter): Date | null {
  const now = new Date()
  if (filter === 'all') return null
  const cutoff = new Date()
  if (filter === 'week') cutoff.setDate(now.getDate() - 7)
  if (filter === 'month') cutoff.setMonth(now.getMonth() - 1)
  if (filter === 'year') cutoff.setFullYear(now.getFullYear() - 1)
  return cutoff
}

export default function History() {
  const navigate = useNavigate()
  const { recentWorkouts, fetchRecent, loading: workoutLoading } = useWorkout()
  const { recentRuns, fetchRecentRuns, loading: runLoading } = useRun()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')

  useEffect(() => {
    fetchRecent(100)
    fetchRecentRuns(100)
  }, [fetchRecent, fetchRecentRuns])

  const loading = workoutLoading || runLoading
  const cutoff = cutoffDate(timeFilter)

  const filteredWorkouts = recentWorkouts.filter((w) => {
    if (!cutoff) return true
    return new Date(w.started_at) >= cutoff
  })

  const filteredRuns = recentRuns.filter((r) => {
    if (r.status !== 'completed') return false
    if (!cutoff) return true
    return new Date(r.started_at) >= cutoff
  })

  const completedWorkouts = filteredWorkouts.filter((w) => w.status === 'completed')
  const totalWorkoutMinutes = completedWorkouts.reduce((acc, w) => {
    if (!w.ended_at) return acc
    return acc + Math.round(
      (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000,
    )
  }, 0)

  const totalRunDistanceKm = filteredRuns.reduce(
    (acc, r) => acc + (r.distance_km ?? 0),
    0,
  )
  const totalRunSeconds = filteredRuns.reduce(
    (acc, r) => acc + (r.duration_s ?? 0),
    0,
  )

  const scoredRuns = filteredRuns.filter((r) => r.score != null)
  const avgScore =
    scoredRuns.length > 0
      ? Math.round(scoredRuns.reduce((a, r) => a + (r.score ?? 0), 0) / scoredRuns.length)
      : null

  type HistoryItem =
    | { type: 'workout'; date: string; data: (typeof recentWorkouts)[number] }
    | { type: 'run'; date: string; data: Run }

  const merged: HistoryItem[] = [
    ...filteredWorkouts.map((w) => ({
      type: 'workout' as const,
      date: w.started_at,
      data: w,
    })),
    ...filteredRuns.map((r) => ({
      type: 'run' as const,
      date: r.started_at,
      data: r,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const ringOffset =
    avgScore != null ? 251.2 * (1 - avgScore / 100) : 251.2

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Time filter */}
      <div className="flex gap-2">
        {(Object.entries(TIME_LABELS) as [TimeFilter, string][]).map(([key, label]) => (
          <FilterChip
            key={key}
            label={label}
            selected={timeFilter === key}
            onClick={() => setTimeFilter(key)}
          />
        ))}
      </div>

      {/* Average run score */}
      {avgScore != null && (
        <div className="flex items-center gap-4 rounded-xl bg-surface-container p-4">
          <div className="relative flex items-center justify-center">
            <svg width="80" height="80" viewBox="0 0 96 96" aria-hidden="true">
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.1"
                strokeWidth="6"
              />
              <circle
                cx="48" cy="48" r="40"
                fill="none"
                stroke="var(--md-primary, #1B6B4A)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="251.2"
                strokeDashoffset={ringOffset}
                transform="rotate(-90 48 48)"
              />
            </svg>
            <span className="absolute text-xl font-medium text-on-surface font-[tabular-nums]">
              {avgScore}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">Ø Lauf-Score</p>
            <p className="text-xs text-on-surface-variant">
              Aus {scoredRuns.length} {scoredRuns.length === 1 ? 'Lauf' : 'Läufen'}
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        {filteredRuns.length > 0 && (
          <>
            <div className="rounded-xl bg-primary-container p-3">
              <p className="text-xs text-on-primary-container/80">Distanz</p>
              <p className="text-xl font-medium text-on-primary-container font-[tabular-nums]">
                {totalRunDistanceKm.toFixed(1).replace('.', ',')} km
              </p>
            </div>
            <div className="rounded-xl bg-primary-container p-3">
              <p className="text-xs text-on-primary-container/80">Laufzeit</p>
              <p className="text-xl font-medium text-on-primary-container font-[tabular-nums]">
                {totalRunSeconds >= 3600
                  ? `${Math.floor(totalRunSeconds / 3600)}:${String(Math.floor((totalRunSeconds % 3600) / 60)).padStart(2, '0')} h`
                  : `${Math.floor(totalRunSeconds / 60)} min`}
              </p>
            </div>
          </>
        )}
        {completedWorkouts.length > 0 && (
          <>
            <div className="rounded-xl bg-surface-container p-3">
              <p className="text-xs text-on-surface-variant">Workouts</p>
              <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
                {completedWorkouts.length}
              </p>
            </div>
            <div className="rounded-xl bg-surface-container p-3">
              <p className="text-xs text-on-surface-variant">Gym-Zeit</p>
              <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
                {totalWorkoutMinutes < 60
                  ? `${totalWorkoutMinutes} min`
                  : `${Math.floor(totalWorkoutMinutes / 60)}:${String(totalWorkoutMinutes % 60).padStart(2, '0')} h`}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Combined list */}
      {loading ? (
        <LoadingSpinner />
      ) : merged.length === 0 ? (
        <EmptyState
          title="Keine Aktivitäten"
          description={
            timeFilter === 'all'
              ? 'Starte deinen ersten Lauf oder dein erstes Workout.'
              : 'In diesem Zeitraum keine Einheiten.'
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {merged.map((item) =>
            item.type === 'run' ? (
              <button
                key={item.data.id}
                type="button"
                onClick={() => navigate(`/lauf/${item.data.id}`)}
                className="flex items-center gap-3 rounded-xl bg-surface-container p-3 text-left w-full"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 text-xs font-bold font-[tabular-nums] ${scoreColor(item.data.score)}`}>
                  {item.data.score ?? '–'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">
                    {formatDate(item.data.started_at)}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {item.data.distance_km != null
                      ? `${Number(item.data.distance_km).toFixed(1).replace('.', ',')} km`
                      : '–'}
                    {' · '}
                    {formatRunDuration(item.data.duration_s)}
                    {item.data.avg_pace_s_per_km != null
                      ? ` · ${formatPace(item.data.avg_pace_s_per_km, 1)} min/km`
                      : ''}
                  </p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant shrink-0">
                  <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            ) : (
              <div
                key={item.data.id}
                className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                  item.data.status === 'completed'
                    ? 'bg-success-container'
                    : item.data.status === 'in_progress'
                      ? 'bg-warning-container'
                      : 'bg-error-container'
                }`}>
                  {item.data.status === 'completed' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
                      <path d="M9 16.17 5.53 12.7l-1.41 1.41L9 19 20.29 7.71l-1.41-1.41z" />
                    </svg>
                  ) : item.data.status === 'in_progress' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-on-warning-container">
                      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-error-container">
                      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">
                    Workout · {formatDate(item.data.started_at)}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {item.data.status === 'completed' ? 'Abgeschlossen' : item.data.status === 'in_progress' ? 'Läuft' : 'Abgebrochen'}
                    {item.data.ended_at ? ` · ${formatDuration(item.data.started_at, item.data.ended_at)}` : ''}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
