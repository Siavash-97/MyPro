import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useRun, formatPace } from '../store/run'
import Icon from '../components/ui/Icon'
import { hasPlan, kmForDate, planTotalKm } from '../lib/runningPlan'
import { useAnamnese } from '../store/anamnese'
import { useRunningPlan } from '../store/runningPlan'

// Wie prototype-profile-state.js in den Mockups: einmal "Später" getippt, und
// der Hinweis bleibt weg. Bewusst dauerhaft (localStorage), nicht nur fuer die
// Sitzung – sonst steht er nach jedem Neustart wieder da.
const REMINDER_DISMISSED_KEY = 'myprosole_home_reminder_dismissed'

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
  const { plan: weekPlan, fetchPlan } = useRunningPlan()
  const { fetchSessions, hasCompletedBlock } = useAnamnese()
  const [reminderDismissed, setReminderDismissed] = useState(
    () => localStorage.getItem(REMINDER_DISMISSED_KEY) === 'true',
  )

  useEffect(() => {
    fetchRecentRuns(50)
    fetchPlan()
    fetchSessions()
  }, [fetchRecentRuns, fetchPlan, fetchSessions])

  const dismissProfileReminder = () => {
    localStorage.setItem(REMINDER_DISMISSED_KEY, 'true')
    setReminderDismissed(true)
  }

  const greeting = getGreeting()

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekRuns = recentRuns.filter(
    (r) => r.status === 'completed' && new Date(r.started_at) >= weekAgo,
  )
  const weekKm = weekRuns.reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  const weekSeconds = weekRuns.reduce((acc, r) => acc + (r.duration_s ?? 0), 0)
  // Der Wochenstand misst gegen die Summe des Laufplans. Ein getrenntes
  // Wochenziel wird nicht mehr abgefragt (siehe umsetzung-offene-punkte.md).
  const goalKm = planTotalKm(weekPlan) || null
  const lastRun = recentRuns.find((r) => r.status === 'completed')

  // Der Hinweis zielt auf die Anamnese: Sie liefert die Werte, mit denen die
  // App statt mit Durchschnitten rechnet.
  const profileIncomplete = !hasCompletedBlock('a')
  const showProfileReminder = profileIncomplete && !reminderDismissed

  const todayPlanKm = kmForDate(weekPlan, new Date())
  const ctaSubline = hasPlan(weekPlan)
    ? todayPlanKm > 0
      ? `Heute geplant: Lauf · ${formatKm(todayPlanKm)} km`
      : 'Heute Ruhetag — ein lockerer Lauf ist trotzdem in Ordnung'
    : lastRun?.distance_km != null && lastRun.avg_pace_s_per_km != null
      ? `Zuletzt ${formatKm(Number(lastRun.distance_km))} km · ${formatPace(lastRun.avg_pace_s_per_km, 1)} min/km`
      : 'GPS an — mehr brauchst du nicht'

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
          {/* Der Plan steht als Unterzeile im Knopf selbst: eine Handlung, ihr
              heutiger Inhalt direkt darunter. Ohne Plan der eigene letzte Lauf
              als Bezugspunkt statt einer leeren Zeile. */}
          <p className="md-cta__plan">{ctaSubline}</p>
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

      <Link
        className="md-card md-row"
        to="/community"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div className="md-row" style={{ gap: 'var(--space-sm)', justifyContent: 'flex-start' }}>
          <div className="md-feature-heading__icon" style={{ width: 40, height: 40 }} aria-hidden="true">
            <Icon name="people" size={20} className="icon-sm" />
          </div>
          <div>
            <p className="md-section-title" style={{ marginBottom: 2 }}>Community</p>
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Läufe teilen, Tipps fragen, ZusammenLauf und Gruppen in deiner Nähe
            </p>
          </div>
        </div>
        <Icon name="chevron-right" className="icon md-row__chevron" />
      </Link>

      {/* Optionaler Hinweis, deshalb ganz unten: er soll den Einstieg nicht vor
          dem Startknopf und dem Wochenstand belegen. Wie im Mockup. */}
      {showProfileReminder && (
        <section className="md-profile-reminder md-profile-reminder--visible" aria-labelledby="profil-hinweis-title">
          <div className="md-profile-reminder__icon" aria-hidden="true">
            <Icon name="profile" className="icon" />
          </div>
          <div className="md-profile-reminder__content">
            <p className="md-profile-reminder__title" id="profil-hinweis-title">
              Damit die Empfehlungen zu dir passen
            </p>
            <p className="md-profile-reminder__text">
              Mit deinem Laufprofil rechnet MyProSole mit deinen Werten statt mit
              Durchschnitten. Tempo, Umfang und Übungen richten sich dann nach dir.
            </p>
            <div className="md-profile-reminder__actions">
              <Link
                className="md-button md-button--filled md-button--compact"
                to="/anamnese"
                style={{ textDecoration: 'none' }}
              >
                Jetzt einrichten
              </Link>
              <button
                type="button"
                className="md-button md-button--text md-button--compact"
                onClick={dismissProfileReminder}
              >
                Später
              </button>
            </div>
          </div>
        </section>
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
