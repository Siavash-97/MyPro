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

  useEffect(() => {
    fetchReferenceData()
    fetchPlans()
  }, [fetchReferenceData, fetchPlans])

  const exercises = filtered()
  const hasActiveFilters = filters.category || filters.difficulty || filters.modality || filters.muscleGroupId || filters.search

  return (
    <>
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
    </>
  )
}
