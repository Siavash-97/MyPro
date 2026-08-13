import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useWorkout } from '../store/workout'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '–'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60000)
  return `${mins} min`
}

export default function Home() {
  const profile = useAuth((s) => s.profile)
  const { recentWorkouts, fetchRecent, loading } = useWorkout()

  useEffect(() => {
    fetchRecent(5)
  }, [fetchRecent])

  const greeting = getGreeting()
  const completedThisWeek = recentWorkouts.filter((w) => {
    if (w.status !== 'completed') return false
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return new Date(w.started_at) >= weekAgo
  })

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-medium text-on-surface">
          {greeting}{profile ? `, ${profile.display_name}` : ''}!
        </h2>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Bereit für dein nächstes Training?
        </p>
      </div>

      {/* Weekly stats */}
      <div className="rounded-xl bg-surface-container p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-on-surface">Diese Woche</h3>
          <span className="text-sm text-on-surface-variant">
            {completedThisWeek.length} Einheiten
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, (completedThisWeek.length / 4) * 100)}%` }}
          />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/lauf/tracking"
          className="flex flex-col items-center gap-2 rounded-xl bg-primary-container p-4"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container">
            <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.8 0-3.3-.9-4.1-2.3l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z" />
          </svg>
          <span className="text-sm font-medium text-on-primary-container">Lauf</span>
        </Link>
        <Link
          to="/training"
          className="flex flex-col items-center gap-2 rounded-xl bg-secondary-container p-4"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-secondary-container">
            <path d="M20.57 14.86 22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z" />
          </svg>
          <span className="text-sm font-medium text-on-secondary-container">Training</span>
        </Link>
        <Link
          to="/training/tagebuch"
          className="flex flex-col items-center gap-2 rounded-xl bg-surface-container p-4"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
            <path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h5z" />
          </svg>
          <span className="text-sm font-medium text-on-surface-variant">Tagebuch</span>
        </Link>
      </div>

      {/* Recent workouts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-on-surface">Letzte Workouts</h3>
          <Link to="/verlauf" className="text-xs font-medium text-primary">
            Alle anzeigen
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : recentWorkouts.length === 0 ? (
          <div className="rounded-xl bg-surface-container p-4 text-center">
            <p className="text-sm text-on-surface-variant">
              Noch keine Workouts. Starte dein erstes Training!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentWorkouts.slice(0, 3).map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                  w.status === 'completed'
                    ? 'bg-success-container'
                    : w.status === 'in_progress'
                      ? 'bg-warning-container'
                      : 'bg-surface-container-high'
                }`}>
                  {w.status === 'completed' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
                      <path d="M9 16.17 5.53 12.7l-1.41 1.41L9 19 20.29 7.71l-1.41-1.41z" />
                    </svg>
                  ) : w.status === 'in_progress' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-warning-container">
                      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
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
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}
