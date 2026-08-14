import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import { useTraining } from '../store/training'
import { CATEGORY_LABELS, DIFFICULTY_LABELS, MODALITY_LABELS } from '../lib/labels'
import type { ExerciseCategory, ExerciseDifficulty, ExerciseModality } from '../types'
import SearchBar from '../components/ui/SearchBar'
import FilterChip from '../components/ui/FilterChip'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import { useRun } from '../store/run'
import {
  PLAN_DAYS,
  hasPlan,
  kmForDate,
  planIndexForDate,
  planTotalKm,
  readWeekPlan,
  upcomingDays,
} from '../lib/runningPlan'

function formatKm(km: number): string {
  return km.toFixed(1).replace('.', ',')
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ExerciseCategory, string][]
const DIFFICULTIES = Object.entries(DIFFICULTY_LABELS) as [ExerciseDifficulty, string][]
const MODALITIES = Object.entries(MODALITY_LABELS) as [ExerciseModality, string][]

export default function Training() {
  const {
    fetchReferenceData,
    filters,
    setFilter,
    resetFilters,
    filtered,
    muscleGroups,
    loading: exercisesLoading,
    loaded: exercisesLoaded,
  } = useExercises()

  const {
    plans,
    fetchPlans,
    loading: plansLoading,
  } = useTraining()

  const { recentRuns, fetchRecentRuns } = useRun()

  useEffect(() => {
    fetchReferenceData()
    fetchPlans()
    fetchRecentRuns(50)
  }, [fetchReferenceData, fetchPlans, fetchRecentRuns])

  const weekPlan = readWeekPlan()
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

  const exercises = filtered()
  const hasActiveFilters = filters.category || filters.difficulty || filters.modality || filters.muscleGroupId || filters.search

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

      {/* Gym Plans Section */}
      <div>
        <div className="md-row" style={{ marginBottom: 'var(--space-sm)', cursor: 'default' }}>
          <h2 className="md-section-title" style={{ margin: 0 }}>Meine Pläne</h2>
          <Link
            to="/training/plan/neu"
            style={{ font: 'var(--type-label-lg)', color: 'var(--md-primary)', textDecoration: 'none' }}
          >
            + Neuer Plan
          </Link>
        </div>

        {plansLoading ? (
          <LoadingSpinner />
        ) : plans.length === 0 ? (
          <div className="md-card">
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Noch keine Trainingspläne. Erstelle deinen ersten Gym-Plan.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {plans.map((plan) => (
              <Link
                key={plan.id}
                to={`/training/plan/${plan.id}`}
                className="md-list-item"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="md-list-item__thumb">
                  <Icon name="training" size={20} className="icon-sm" />
                </div>
                <div className="md-list-item__body">
                  <p className="md-list-item__title">{plan.name}</p>
                  {plan.description && (
                    <p className="md-list-item__meta">{plan.description}</p>
                  )}
                </div>
                <Icon name="chevron-right" className="icon md-row__chevron" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Exercise Catalog Section */}
      <div>
        <h2 className="md-section-title">Alle Übungen</h2>

        <SearchBar
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
          placeholder="Übung suchen…"
        />

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
          <div className="md-filter-row">
            {CATEGORIES.map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                selected={filters.category === key}
                onClick={() => setFilter('category', filters.category === key ? null : key)}
              />
            ))}
          </div>
          <div className="md-filter-row">
            {DIFFICULTIES.map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                selected={filters.difficulty === key}
                onClick={() => setFilter('difficulty', filters.difficulty === key ? null : key)}
              />
            ))}
            {MODALITIES.map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                selected={filters.modality === key}
                onClick={() => setFilter('modality', filters.modality === key ? null : key)}
              />
            ))}
          </div>
          {muscleGroups.length > 0 && (
            <div className="md-filter-row">
              {muscleGroups.map((mg) => (
                <FilterChip
                  key={mg.id}
                  label={mg.name_de}
                  selected={filters.muscleGroupId === mg.id}
                  onClick={() => setFilter('muscleGroupId', filters.muscleGroupId === mg.id ? null : mg.id)}
                />
              ))}
            </div>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="md-button md-button--text md-button--compact"
              style={{ alignSelf: 'flex-start' }}
            >
              Filter zurücksetzen
            </button>
          )}
        </div>

        {/* Exercise list */}
        {exercisesLoading && !exercisesLoaded ? (
          <LoadingSpinner />
        ) : exercises.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'Keine Übungen gefunden' : 'Keine Übungen verfügbar'}
            description={hasActiveFilters ? 'Versuche andere Filter.' : undefined}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
            {exercises.map((ex) => (
              <Link
                key={ex.id}
                to={`/training/uebung/${ex.slug}`}
                className="md-list-item"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="md-list-item__thumb">
                  <Icon name="play" size={20} className="icon-sm" />
                </div>
                <div className="md-list-item__body">
                  <p className="md-list-item__title">{ex.name_de}</p>
                  <p className="md-list-item__meta">
                    {CATEGORY_LABELS[ex.category]}
                    {' · '}
                    {DIFFICULTY_LABELS[ex.difficulty]}
                    {ex.exercise_muscles.filter((m) => m.role === 'primary').length > 0 && (
                      <>
                        {' · '}
                        {ex.exercise_muscles
                          .filter((m) => m.role === 'primary')
                          .map((m) => m.muscle_groups.name_de)
                          .join(', ')}
                      </>
                    )}
                  </p>
                </div>
                <Icon name="chevron-right" className="icon md-row__chevron" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Ohne Plan bekommt der Weg dorthin einen ruhigen, beschrifteten Ort
          ganz unten – sichtbar, aber nicht aufdringlich. */}
      {!planExists && (
        <Link
          className="md-list-item"
          to="/training/laufplan"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div className="md-list-item__thumb">
            <Icon name="training" size={20} className="icon-sm" />
          </div>
          <div className="md-list-item__body">
            <p className="md-list-item__title">Wochenplan anlegen</p>
            <p className="md-list-item__meta">Kilometer pro Wochentag selbst eintragen</p>
          </div>
          <Icon name="chevron-right" className="icon md-row__chevron" />
        </Link>
      )}
    </>
  )
}
