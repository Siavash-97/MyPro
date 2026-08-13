import { useEffect, useState } from 'react'
import { useWorkout } from '../store/workout'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import FilterChip from '../components/ui/FilterChip'

type TimeFilter = 'week' | 'month' | 'all'

const TIME_LABELS: Record<TimeFilter, string> = {
  week: 'Woche',
  month: 'Monat',
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

export default function History() {
  const { recentWorkouts, fetchRecent, loading } = useWorkout()
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')

  useEffect(() => {
    fetchRecent(100)
  }, [fetchRecent])

  const filtered = recentWorkouts.filter((w) => {
    if (timeFilter === 'all') return true
    const now = new Date()
    const cutoff = new Date()
    if (timeFilter === 'week') cutoff.setDate(now.getDate() - 7)
    if (timeFilter === 'month') cutoff.setMonth(now.getMonth() - 1)
    return new Date(w.started_at) >= cutoff
  })

  const completed = filtered.filter((w) => w.status === 'completed')
  const totalMinutes = completed.reduce((acc, w) => {
    if (!w.ended_at) return acc
    return acc + Math.round(
      (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000,
    )
  }, 0)

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

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Einheiten</p>
          <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
            {completed.length}
          </p>
        </div>
        <div className="rounded-xl bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Aktive Zeit</p>
          <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
            {totalMinutes < 60
              ? `${totalMinutes} min`
              : `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')} h`}
          </p>
        </div>
      </div>

      {/* Workout list */}
      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Workouts"
          description={timeFilter === 'all' ? 'Starte dein erstes Training.' : 'In diesem Zeitraum keine Einheiten.'}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                w.status === 'completed'
                  ? 'bg-success-container'
                  : w.status === 'in_progress'
                    ? 'bg-warning-container'
                    : 'bg-error-container'
              }`}>
                {w.status === 'completed' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
                    <path d="M9 16.17 5.53 12.7l-1.41 1.41L9 19 20.29 7.71l-1.41-1.41z" />
                  </svg>
                ) : w.status === 'in_progress' ? (
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
                  {formatDate(w.started_at)}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {w.status === 'completed' ? 'Abgeschlossen' : w.status === 'in_progress' ? 'Läuft' : 'Abgebrochen'}
                  {w.ended_at ? ` · ${formatDuration(w.started_at, w.ended_at)}` : ''}
                  {w.notes ? ` · ${w.notes}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
