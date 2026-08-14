import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useRun } from '../store/run'
import Icon from '../components/ui/Icon'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Heute'
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
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

function formatHours(totalSeconds: number): string {
  const mins = Math.round(totalSeconds / 60)
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

function formatKm(km: number): string {
  return km.toFixed(1).replace('.', ',')
}

export default function Home() {
  const profile = useAuth((s) => s.profile)
  const { recentRuns, fetchRecentRuns } = useRun()

  useEffect(() => {
    fetchRecentRuns(50)
  }, [fetchRecentRuns])

  const greeting = getGreeting()

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekRuns = recentRuns.filter(
    (r) => r.status === 'completed' && new Date(r.started_at) >= weekAgo,
  )
  const weekKm = weekRuns.reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  const weekSeconds = weekRuns.reduce((acc, r) => acc + (r.duration_s ?? 0), 0)
  const goalKm = profile?.weekly_goal_km ?? null
  const lastRun = recentRuns.find((r) => r.status === 'completed')

  return (
    <>
      <div className="md-greeting">
        <p className="md-greeting__title">
          {greeting}{profile ? `, ${profile.display_name}` : ''}!
        </p>
        <p className="md-greeting__subtitle">Bereit für deinen nächsten Lauf?</p>
      </div>

      <div className="md-chip md-chip--connected">
        <Icon name="check" className="icon-sm" />
        App-Modus · ohne Einlagen nutzbar
      </div>

      <Link className="md-cta" to="/lauf/tracking" style={{ textDecoration: 'none' }}>
        <div className="md-cta__icon">
          <Icon name="training" className="icon" />
        </div>
        <div className="md-cta__body">
          <p className="md-cta__title">Laufen starten</p>
          <p className="md-cta__plan">GPS-Tracking mit Live-Statistiken</p>
        </div>
      </Link>

      <div className="md-card">
        <div className="md-row" style={{ marginBottom: 'var(--space-md)' }}>
          <p className="md-section-title" style={{ margin: 0 }}>Diese Woche</p>
          <span style={{ font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            {goalKm != null ? `${formatKm(weekKm)} / ${goalKm} km` : `${formatKm(weekKm)} km`}
          </span>
        </div>
        {goalKm != null && goalKm > 0 && (
          <div className="md-progress">
            <div
              className="md-progress__fill"
              style={{ width: `${Math.min(100, (weekKm / goalKm) * 100)}%` }}
            />
          </div>
        )}
        <div className="md-metric-grid" style={{ marginTop: 'var(--space-md)' }}>
          <div className="md-metric md-metric--accent">
            <p className="md-metric__label">Läufe</p>
            <p className="md-metric__value">
              {weekRuns.length} <span>diese Woche</span>
            </p>
          </div>
          <div className="md-metric md-metric--accent">
            <p className="md-metric__label">Aktive Zeit</p>
            <p className="md-metric__value">
              {formatHours(weekSeconds)} <span>Stunden</span>
            </p>
          </div>
        </div>
      </div>

      {lastRun && (
        <Link
          className="md-card md-row"
          to={`/lauf/${lastRun.id}`}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div>
            <p className="md-section-title" style={{ marginBottom: 4 }}>Letzter Lauf</p>
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              {formatDate(lastRun.started_at)}
              {lastRun.distance_km != null ? ` · ${formatKm(Number(lastRun.distance_km))} km` : ''}
              {` · ${formatRunDuration(lastRun.duration_s)}`}
            </p>
          </div>
          <Icon name="chevron-right" className="icon md-row__chevron" />
        </Link>
      )}
    </>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Guten Morgen'
  if (h < 18) return 'Guten Tag'
  return 'Guten Abend'
}
