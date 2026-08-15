import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import Icon from '../components/ui/Icon'
import { useRun } from '../store/run'
import {
  PLAN_DAYS,
  hasPlan,
  kmForDate,
  planIndexForDate,
  planTotalKm,
  upcomingDays,
} from '../lib/runningPlan'
import { useRunningPlan } from '../store/runningPlan'

function formatKm(km: number): string {
  return km.toFixed(1).replace('.', ',')
}


export default function Training() {
  // Der Katalog steht nicht mehr hier, sondern nur noch dort, wo man ihn
  // braucht: beim Zusammenstellen eines Plans. Diese Seite zeigt den
  // Wochenplan und die Empfehlungen.
  const fetchReferenceData = useExercises((s) => s.fetchReferenceData)

  const { recentRuns, fetchRecentRuns } = useRun()
  const { plan: weekPlan, fetchPlan } = useRunningPlan()

  useEffect(() => {
    fetchReferenceData()
    fetchRecentRuns(50)
    fetchPlan()
  }, [fetchReferenceData, fetchRecentRuns, fetchPlan])

  const planExists = hasPlan(weekPlan)
  const weekPlanKm = planTotalKm(weekPlan)
  const today = new Date()
  const todayKm = kmForDate(weekPlan, today)
  const todayLabel = PLAN_DAYS[planIndexForDate(today)].label
  const upcoming = upcomingDays(weekPlan)

  // Gelaufene Kilometer der laufenden Woche, ab Montag.
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - planIndexForDate(today))
  weekStart.setHours(0, 0, 0, 0)
  const weekRunKm = recentRuns
    .filter((r) => r.status === 'completed' && new Date(r.started_at) >= weekStart)
    .reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  const weekProgress = weekPlanKm > 0 ? Math.min(100, (weekRunKm / weekPlanKm) * 100) : 0

  return (
    <>
      {/* Wochenplan wie in uebungen.html: erst der Stand, dann heute, dann die
          naechsten Tage. Der Katalog steht darunter und ist nicht mehr das
          Erste, was der Tab zeigt. */}
      {planExists && (
        <>
          <section className="md-card" aria-labelledby="woche-titel">
            <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
              <h2 className="md-section-title" id="woche-titel" style={{ margin: 0 }}>Diese Woche</h2>
              <span style={{ font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                {formatKm(weekRunKm)} / {formatKm(weekPlanKm)} km
              </span>
            </div>
            <div className="md-progress">
              <div className="md-progress__fill" style={{ width: `${weekProgress}%` }} />
            </div>
            <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Offene Einheiten kannst du bis Sonntag nachholen.
            </p>
          </section>

          <div>
            <p className="md-section-title">Heute</p>
            <ol className="md-week-plan">
              <li className="md-week-plan__day md-week-plan__day--today md-week-plan__day--stacked">
                <span className="md-week-plan__label">{todayLabel}</span>
                <span className="md-week-plan__unit">
                  {todayKm > 0 ? `Lauf · ${formatKm(todayKm)} km` : 'Ruhetag'}
                  <small>{todayKm > 0 ? 'Aus deinem Wochenplan' : 'Erholung gehört zum Plan'}</small>
                </span>
                {todayKm > 0 && (
                  <Link className="md-button md-button--filled md-button--compact md-week-plan__action" to="/lauf/tracking">
                    Starten
                  </Link>
                )}
              </li>
            </ol>
          </div>

          <section className="md-card" aria-labelledby="naechste-titel">
            <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
              <p className="md-section-title" id="naechste-titel" style={{ margin: 0 }}>Nächste Tage</p>
              <Link to="/training/laufplan" style={{ font: 'var(--type-label-lg)', color: 'var(--md-primary)', textDecoration: 'none' }}>
                Plan bearbeiten
              </Link>
            </div>
            <ol className="md-week-plan md-week-plan--ahead" aria-label="Die nächsten 7 Tage">
              {upcoming.map((day, i) => (
                <li key={i} className="md-week-plan__day md-week-plan__day--ahead">
                  <span className="md-week-plan__label">{day.label}</span>
                  <span className="md-week-plan__unit">
                    {day.km > 0 ? `Lauf · ${formatKm(day.km)} km` : 'Ruhe oder lockeres Cross-Training'}
                    {day.when && <small>{day.when}</small>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {/* Ein Einstieg statt einer Auswahl: Die Reihenfolge steht fest, wer hier
          aussucht, umgeht sie. Das Videobild zeigt, dass angeleitet wird. */}
      <div>
        <p className="md-section-title">Für dich empfohlen</p>
        <Link className="md-routine-start" to="/training/routine">
          <span className="md-video-placeholder" aria-hidden="true">
            <Icon name="play" size={48} />
          </span>
          <span className="md-routine-start__body">
            <span className="md-routine-start__title">Übungen starten</span>
            <span className="md-routine-start__meta">
              3 Übungen · rund 6 Minuten · mit Videoanleitung
            </span>
          </span>
        </Link>
      </div>
    </>
  )
}
