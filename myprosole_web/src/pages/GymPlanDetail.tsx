import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTraining } from '../store/training'
import { useExercises } from '../store/exercises'
import { useWorkout } from '../store/workout'
import { CATEGORY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'

export default function GymPlanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { activePlan, fetchPlan, deletePlan, removeExerciseFromPlan, addExerciseToPlan, loading } = useTraining()
  const { exercises, fetchReferenceData, loaded: exercisesLoaded } = useExercises()
  const startWorkout = useWorkout((s) => s.startWorkout)

  const [showAddExercise, setShowAddExercise] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (id) fetchPlan(id)
    fetchReferenceData()
  }, [id, fetchPlan, fetchReferenceData])

  if (loading && !activePlan) return <LoadingSpinner />

  if (!activePlan) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-on-surface-variant">Plan nicht gefunden.</p>
      </div>
    )
  }

  const planExerciseIds = new Set(activePlan.gym_plan_exercises.map((pe) => pe.exercise_id))
  const availableExercises = exercises.filter((ex) => !planExerciseIds.has(ex.id))

  const handleAddExercise = async (exerciseId: string) => {
    if (!id) return
    setAddingId(exerciseId)
    await addExerciseToPlan(id, exerciseId, {})
    setAddingId(null)
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    const err = await deletePlan(id)
    if (!err) {
      navigate('/training')
    }
    setDeleting(false)
  }

  const handleStartWorkout = async () => {
    if (!id) return
    const err = await startWorkout(id)
    if (!err) {
      navigate('/training/workout/aktiv')
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Plan header */}
      <div>
        <h2 className="text-xl font-medium text-on-surface">{activePlan.name}</h2>
        {activePlan.description && (
          <p className="text-sm text-on-surface-variant mt-1">{activePlan.description}</p>
        )}
      </div>

      {/* Start workout button */}
      {activePlan.gym_plan_exercises.length > 0 && (
        <button
          type="button"
          onClick={handleStartWorkout}
          className="h-12 rounded-full bg-primary text-on-primary font-medium"
        >
          Workout starten
        </button>
      )}

      {/* Exercises in plan */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-on-surface">
            Übungen ({activePlan.gym_plan_exercises.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowAddExercise(!showAddExercise)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
            </svg>
            Hinzufügen
          </button>
        </div>

        {activePlan.gym_plan_exercises.length === 0 ? (
          <EmptyState
            title="Noch keine Übungen"
            description="Füge Übungen aus dem Katalog hinzu."
          />
        ) : (
          <ol className="flex flex-col gap-2">
            {activePlan.gym_plan_exercises
              .sort((a, b) => a.position - b.position)
              .map((pe) => (
                <li
                  key={pe.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-container p-3"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xs font-medium shrink-0">
                    {pe.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {pe.exercises.name_de}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {[
                        pe.sets != null ? `${pe.sets} Sätze` : null,
                        pe.reps != null ? `${pe.reps} Wdh.` : null,
                        pe.duration_seconds != null ? `${pe.duration_seconds}s` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || CATEGORY_LABELS[pe.exercises.category as keyof typeof CATEGORY_LABELS] || ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExerciseFromPlan(pe.id)}
                    className="shrink-0 p-1 text-on-surface-variant"
                    aria-label={`${pe.exercises.name_de} entfernen`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </li>
              ))}
          </ol>
        )}
      </section>

      {/* Add exercise panel */}
      {showAddExercise && exercisesLoaded && (
        <section className="rounded-xl border border-outline-variant p-3">
          <h3 className="text-sm font-medium text-on-surface mb-2">Übung hinzufügen</h3>
          {availableExercises.length === 0 ? (
            <p className="text-xs text-on-surface-variant">Alle Übungen sind bereits im Plan.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {availableExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  disabled={addingId === ex.id}
                  onClick={() => handleAddExercise(ex.id)}
                  className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-surface-container-high transition-colors disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-on-surface truncate">{ex.name_de}</p>
                    <p className="text-xs text-on-surface-variant">
                      {CATEGORY_LABELS[ex.category]}
                    </p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-primary shrink-0">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Equipment */}
      {activePlan.gym_plan_equipment.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-on-surface mb-2">Equipment</h3>
          <div className="flex flex-wrap gap-1.5">
            {activePlan.gym_plan_equipment.map((eq) => (
              <span
                key={eq.equipment_id}
                className="inline-flex items-center h-6 px-2.5 rounded-full bg-surface-container-high text-on-surface-variant text-xs"
              >
                {eq.equipment.name_de}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Delete */}
      <div className="pt-4 border-t border-outline-variant">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full h-10 rounded-full border border-error text-error text-sm font-medium disabled:opacity-50"
        >
          {deleting ? 'Wird gelöscht…' : 'Plan löschen'}
        </button>
      </div>
    </div>
  )
}
