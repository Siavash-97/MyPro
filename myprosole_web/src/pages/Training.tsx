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
    <div className="flex flex-col gap-6 px-4 py-4">
      {/* Gym Plans Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-medium text-on-surface">Meine Pläne</h2>
          <Link
            to="/training/plan/neu"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
            </svg>
            Neuer Plan
          </Link>
        </div>

        {plansLoading ? (
          <LoadingSpinner />
        ) : plans.length === 0 ? (
          <div className="rounded-xl bg-surface-container p-4">
            <p className="text-sm text-on-surface-variant">
              Noch keine Trainingspläne. Erstelle deinen ersten Gym-Plan.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                to={`/training/plan/${plan.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface-container p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14zM5 8V6h14v2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{plan.name}</p>
                  {plan.description && (
                    <p className="text-xs text-on-surface-variant truncate">{plan.description}</p>
                  )}
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant shrink-0">
                  <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Exercise Catalog Section */}
      <section>
        <h2 className="text-base font-medium text-on-surface mb-3">Übungen</h2>

        <SearchBar
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
          placeholder="Übung suchen…"
        />

        {/* Filters */}
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map(([key, label]) => (
              <FilterChip
                key={key}
                label={label}
                selected={filters.category === key}
                onClick={() => setFilter('category', filters.category === key ? null : key)}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
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
            <div className="flex gap-2 overflow-x-auto pb-1">
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
              className="self-start text-xs text-primary font-medium"
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
          <div className="mt-3 flex flex-col gap-2">
            {exercises.map((ex) => (
              <Link
                key={ex.id}
                to={`/training/uebung/${ex.slug}`}
                className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-container shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-secondary-container">
                    <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.8 0-3.3-.9-4.1-2.3l-1-1.6c-.4-.6-1-1-.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{ex.name_de}</p>
                  <p className="text-xs text-on-surface-variant">
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant shrink-0">
                  <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
