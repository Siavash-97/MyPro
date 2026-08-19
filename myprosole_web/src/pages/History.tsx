import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkout } from '../store/workout'
import { useRun, formatPace } from '../store/run'
import type { Run } from '../types'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import FilterChip from '../components/ui/FilterChip'
import Icon from '../components/ui/Icon'

type TimeFilter = 'week' | 'month' | 'year' | 'all'

const TIME_LABELS: Record<TimeFilter, string> = {
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
  all: 'Alle',
}

const SECTION_TITLES: Record<TimeFilter, string> = {
  week: 'Diese Woche',
  month: 'Dieser Monat',
  year: 'Dieses Jahr',
  all: 'Alle Aktivitäten',
}

// Der Score-Text nennt den Zeitraum mit, wie im Mockup ("Aus 4 Läufen dieser
// Woche."). Ohne ihn steht dieselbe Zahl da, egal welcher Filter aktiv ist.
const PERIOD_SUFFIX: Record<TimeFilter, string> = {
  week: ' dieser Woche',
  month: ' dieses Monats',
  year: ' dieses Jahres',
  all: ' insgesamt',
}

const RING_CIRCUMFERENCE = 251.2

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

function scoreBadgeClass(score: number | null): string {
  if (score == null) return 'md-score-badge'
  if (score >= 70) return 'md-score-badge md-score-badge--good'
  if (score >= 50) return 'md-score-badge md-score-badge--ok'
  return 'md-score-badge md-score-badge--low'
}

function workoutStatusIcon(status: string): string {
  if (status === 'completed') return 'check'
  if (status === 'in_progress') return 'clock'
  return 'stop'
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
    avgScore != null
      ? RING_CIRCUMFERENCE * (1 - avgScore / 100)
      : RING_CIRCUMFERENCE

  return (
    <>
      <div className="md-filter-row">
        {(Object.entries(TIME_LABELS) as [TimeFilter, string][]).map(([key, label]) => (
          <FilterChip
            key={key}
            label={label}
            selected={timeFilter === key}
            onClick={() => setTimeFilter(key)}
          />
        ))}
      </div>

      {avgScore != null && (
        <section
          className="md-card md-score"
          aria-label={`Durchschnittlicher Lauf-Score ${avgScore} von 100`}
        >
          <div className="md-score__ring">
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle className="md-score__ring-track" cx="48" cy="48" r="40" />
              <circle
                className="md-score__ring-value"
                cx="48" cy="48" r="40"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="md-score__number">{avgScore}</div>
          </div>
          <div>
            <p className="md-section-title" style={{ marginBottom: 4 }}>Ø Lauf-Score</p>
            <p className="md-analysis-score-copy">
              Aus {scoredRuns.length} {scoredRuns.length === 1 ? 'Lauf' : 'Läufen'}
              {PERIOD_SUFFIX[timeFilter]}.
            </p>
          </div>
        </section>
      )}

      {(filteredRuns.length > 0 || completedWorkouts.length > 0) && (
        <div className="md-metric-grid">
          {filteredRuns.length > 0 && (
            <>
              <div className="md-metric md-metric--accent">
                <p className="md-metric__label">Distanz</p>
                <p className="md-metric__value">
                  {totalRunDistanceKm.toFixed(1).replace('.', ',')} <span>km</span>
                </p>
              </div>
              <div className="md-metric md-metric--accent">
                <p className="md-metric__label">Aktive Zeit</p>
                <p className="md-metric__value">
                  {totalRunSeconds >= 3600
                    ? `${Math.floor(totalRunSeconds / 3600)}:${String(Math.floor((totalRunSeconds % 3600) / 60)).padStart(2, '0')}`
                    : `${Math.floor(totalRunSeconds / 60)}`}
                  {' '}
                  <span>{totalRunSeconds >= 3600 ? 'Stunden' : 'Minuten'}</span>
                </p>
              </div>
            </>
          )}
          {completedWorkouts.length > 0 && (
            <>
              <div className="md-metric">
                <p className="md-metric__label">Routinen</p>
                <p className="md-metric__value">{completedWorkouts.length}</p>
              </div>
              <div className="md-metric">
                <p className="md-metric__label">Übungszeit</p>
                <p className="md-metric__value">
                  {totalWorkoutMinutes < 60
                    ? `${totalWorkoutMinutes}`
                    : `${Math.floor(totalWorkoutMinutes / 60)}:${String(totalWorkoutMinutes % 60).padStart(2, '0')}`}
                  {' '}
                  <span>{totalWorkoutMinutes < 60 ? 'Minuten' : 'Stunden'}</span>
                </p>
              </div>
            </>
          )}
        </div>
      )}

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
        <div>
          <p className="md-section-title">{SECTION_TITLES[timeFilter]}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {merged.map((item) =>
              item.type === 'run' ? (
                <Link
                  key={item.data.id}
                  to={`/lauf/${item.data.id}`}
                  className="md-list-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className={scoreBadgeClass(item.data.score)}>
                    {item.data.score ?? '–'}
                  </div>
                  <div className="md-list-item__body">
                    <p className="md-list-item__title">{formatDate(item.data.started_at)}</p>
                    <p className="md-list-item__meta">
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
                  <Icon name="chevron-right" className="icon md-row__chevron" />
                </Link>
              ) : (
                <div key={item.data.id} className="md-list-item">
                  <div className="md-score-badge" style={{ background: 'var(--md-surface-container-high)', color: 'var(--md-on-surface-variant)' }}>
                    <Icon name={workoutStatusIcon(item.data.status)} size={20} />
                  </div>
                  <div className="md-list-item__body">
                    <p className="md-list-item__title">
                      Workout · {formatDate(item.data.started_at)}
                    </p>
                    <p className="md-list-item__meta">
                      {item.data.status === 'completed' ? 'Abgeschlossen' : item.data.status === 'in_progress' ? 'Läuft' : 'Abgebrochen'}
                      {item.data.ended_at ? ` · ${formatDuration(item.data.started_at, item.data.ended_at)}` : ''}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </>
  )
}
