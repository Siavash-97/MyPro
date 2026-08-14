import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTraining } from '../store/training'
import { useExercises } from '../store/exercises'
import { useWorkout } from '../store/workout'
import { CATEGORY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'

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
      <p style={{ margin: 'var(--space-lg) 0', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Plan nicht gefunden.
      </p>
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
    <>
      {/* Plan header */}
      <div>
        <h2 style={{ margin: 0, font: 'var(--type-title-lg)', color: 'var(--md-on-surface)' }}>
          {activePlan.name}
        </h2>
        {activePlan.description && (
          <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            {activePlan.description}
          </p>
        )}
      </div>

      {/* Start workout button */}
      {activePlan.gym_plan_exercises.length > 0 && (
        <button
          type="button"
          onClick={handleStartWorkout}
          className="md-button md-button--filled"
        >
          Workout starten
        </button>
      )}

      {/* Exercises in plan */}
      <div>
        <p className="md-section-title">
          Übungen ({activePlan.gym_plan_exercises.length})
        </p>

        {activePlan.gym_plan_exercises.length === 0 ? (
          <EmptyState
            title="Noch keine Übungen"
            description="Füge Übungen aus dem Katalog hinzu."
          />
        ) : (
          <ol className="md-plan-list">
            {activePlan.gym_plan_exercises
              .sort((a, b) => a.position - b.position)
              .map((pe) => (
                <li key={pe.id} className="md-plan-item">
                  <span
                    className="md-plan-item__grip"
                    style={{ font: 'var(--type-label-lg)', minWidth: 20, textAlign: 'center' }}
                    aria-hidden="true"
                  >
                    {pe.position}
                  </span>
                  <span className="md-plan-item__body">
                    {pe.exercises.name_de}
                    <small>
                      {[
                        pe.sets != null ? `${pe.sets} Sätze` : null,
                        pe.reps != null ? `${pe.reps} Wiederholungen` : null,
                        pe.duration_seconds != null ? `${pe.duration_seconds} Sekunden` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || CATEGORY_LABELS[pe.exercises.category as keyof typeof CATEGORY_LABELS] || ''}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExerciseFromPlan(pe.id)}
                    className="md-plan-item__remove"
                    aria-label={`${pe.exercises.name_de} entfernen`}
                  >
                    <Icon name="remove" size={20} className="icon-sm" />
                  </button>
                </li>
              ))}
          </ol>
        )}

        <button
          type="button"
          onClick={() => setShowAddExercise(!showAddExercise)}
          className="md-button md-button--text"
          style={{ width: '100%' }}
        >
          <Icon name="plus" size={20} className="icon-sm" />
          Übung hinzufügen
        </button>
      </div>

      {/* Add exercise panel */}
      {showAddExercise && exercisesLoaded && (
        <div className="md-card md-card--outlined">
          <p className="md-section-title">Übung hinzufügen</p>
          {availableExercises.length === 0 ? (
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Alle Übungen sind bereits im Plan.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', maxHeight: 256, overflowY: 'auto' }}>
              {availableExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  disabled={addingId === ex.id}
                  onClick={() => handleAddExercise(ex.id)}
                  className="md-plan-item"
                  style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer', opacity: addingId === ex.id ? 0.5 : 1 }}
                >
                  <span className="md-plan-item__body">
                    {ex.name_de}
                    <small>{CATEGORY_LABELS[ex.category]}</small>
                  </span>
                  <Icon name="plus" size={20} className="icon-sm" style={{ color: 'var(--md-primary)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Equipment */}
      {activePlan.gym_plan_equipment.length > 0 && (
        <div>
          <p className="md-section-title">Equipment</p>
          <div className="md-chip-set">
            {activePlan.gym_plan_equipment.map((eq) => (
              <span key={eq.equipment_id} className="md-choice-chip" style={{ cursor: 'default' }}>
                {eq.equipment.name_de}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="md-button"
        style={{
          width: '100%',
          border: '1px solid var(--md-error)',
          background: 'transparent',
          color: 'var(--md-error)',
          opacity: deleting ? 0.5 : 1,
        }}
      >
        {deleting ? 'Wird gelöscht…' : 'Plan löschen'}
      </button>
    </>
  )
}
