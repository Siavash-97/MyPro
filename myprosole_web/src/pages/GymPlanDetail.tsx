import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTraining } from '../store/training'
import { useExercises } from '../store/exercises'
import { useWorkout } from '../store/workout'
import { CATEGORY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'
import PlanExerciseEditor from '../components/training/PlanExerciseEditor'
import ExercisePicker from '../components/training/ExercisePicker'
import type { GymPlanExercise, Exercise } from '../types'

/**
 * Startwerte beim Hinzufuegen aus dem Katalog.
 *
 * Die Datenbank verlangt, dass entweder Saetze oder eine Dauer gesetzt ist
 * (Bedingung gym_plan_exercises_sets_or_duration in Migration 0005). Ohne
 * Werte wies sie die Zeile ab, und weil die Seite den Fehler nicht auswertete,
 * passierte beim Tippen sichtbar gar nichts.
 *
 * Kraftuebungen bekommen Saetze und Wiederholungen, Technik und Beweglichkeit
 * eine Dauer – so werden sie tatsaechlich ausgefuehrt. Anpassen laesst sich
 * das danach im Plan.
 */
function startwerte(category: string): { sets?: number; reps?: number; duration_seconds?: number } {
  if (category === 'strength') return { sets: 3, reps: 10 }
  return { duration_seconds: 60 }
}

/** Kurzfassung der Vorgaben unter dem Uebungsnamen. */
function vorgabeText(pe: GymPlanExercise & { exercises: Exercise }): string {
  const teile = [
    pe.sets != null ? `${pe.sets} Sätze` : null,
    pe.reps != null ? `${pe.reps} Wdh.` : null,
    pe.weight_kg != null ? `${String(pe.weight_kg).replace('.', ',')} kg` : null,
    pe.duration_seconds != null ? `${pe.duration_seconds} Sek.` : null,
    pe.rest_seconds != null ? `${pe.rest_seconds} Sek. Pause` : null,
  ].filter(Boolean)
  return teile.join(' · ') || CATEGORY_LABELS[pe.exercises.category as keyof typeof CATEGORY_LABELS] || ''
}

export default function GymPlanDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { activePlan, fetchPlan, deletePlan, removeExerciseFromPlan, addExerciseToPlan, updatePlanExercise, loading } = useTraining()
  const { exercises, fetchReferenceData, loaded: exercisesLoaded } = useExercises()
  const startWorkout = useWorkout((s) => s.startWorkout)
  const showSnackbar = useSnackbar()

  const [showAddExercise, setShowAddExercise] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null)

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

  const handleAddExercise = async (exercise: { id: string; category: string; name_de: string }) => {
    if (!id) return
    setAddingId(exercise.id)
    const err = await addExerciseToPlan(id, exercise.id, startwerte(exercise.category))
    setAddingId(null)
    // Fehler nicht verschlucken: Vorher blieb ein abgewiesener Eintrag
    // vollkommen unsichtbar, und der Knopf wirkte kaputt.
    if (err) showSnackbar(`${exercise.name_de} konnte nicht hinzugefügt werden: ${err}`)
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
                <li key={pe.id}>
                  {bearbeiteId === pe.id ? (
                    <PlanExerciseEditor
                      planExercise={pe}
                      onSave={async (werte) => {
                        const err = await updatePlanExercise(pe.id, werte)
                        if (!err) setBearbeiteId(null)
                        return err
                      }}
                      onCancel={() => setBearbeiteId(null)}
                    />
                  ) : (
                    <div className="md-plan-item">
                      {/* Die Zeile selbst oeffnet die Bearbeitung. Vorher liess
                          sich an einer Planuebung nichts mehr aendern. */}
                      <button
                        type="button"
                        onClick={() => setBearbeiteId(pe.id)}
                        style={{ display: 'contents', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left' }}
                        aria-label={`${pe.exercises.name_de} bearbeiten`}
                      >
                        <span
                          className="md-plan-item__grip"
                          style={{ font: 'var(--type-label-lg)', minWidth: 20, textAlign: 'center' }}
                          aria-hidden="true"
                        >
                          {pe.position}
                        </span>
                        <span className="md-plan-item__body">
                          {pe.exercises.name_de}
                          <small>{vorgabeText(pe)}</small>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExerciseFromPlan(pe.id)}
                        className="md-plan-item__remove"
                        aria-label={`${pe.exercises.name_de} entfernen`}
                      >
                        <Icon name="remove" size={20} className="icon-sm" />
                      </button>
                    </div>
                  )}
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
          <ExercisePicker
            exercises={exercises}
            bereitsDrin={planExerciseIds}
            onAdd={handleAddExercise}
            laueftId={addingId}
          />
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
