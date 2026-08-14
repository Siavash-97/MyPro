import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkout } from '../store/workout'
import { CATEGORY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'

export default function WorkoutSession() {
  const navigate = useNavigate()
  const { activeWorkout, completeWorkout, abandonWorkout, logExercise, loading } = useWorkout()

  const [currentStep, setCurrentStep] = useState(0)
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [finishing, setFinishing] = useState(false)

  if (loading && !activeWorkout) return <LoadingSpinner className="min-h-dvh" />

  if (!activeWorkout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
        <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Kein aktives Workout.
        </p>
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="md-button md-button--filled md-button--compact"
        >
          Zum Training
        </button>
      </div>
    )
  }

  const exercises = activeWorkout.workout_log_exercises
    .sort((a, b) => a.position - b.position)

  const isComplete = currentStep >= exercises.length
  const currentExercise = exercises[currentStep]
  const progress = exercises.length > 0
    ? Math.round(((currentStep) / exercises.length) * 100)
    : 0

  const handleLogAndNext = async () => {
    if (!currentExercise) return
    await logExercise(activeWorkout.id, currentExercise.exercise_id, {
      position: currentExercise.position,
      actual_sets: sets ? Number(sets) : undefined,
      actual_reps: reps ? Number(reps) : undefined,
      weight_kg: weight ? Number(weight) : undefined,
      notes: notes || undefined,
    })
    setSets('')
    setReps('')
    setWeight('')
    setNotes('')
    setCurrentStep((s) => s + 1)
  }

  const handleSkip = () => {
    setSets('')
    setReps('')
    setWeight('')
    setNotes('')
    setCurrentStep((s) => s + 1)
  }

  const handleComplete = async () => {
    setFinishing(true)
    await completeWorkout(activeWorkout.id)
    navigate('/training')
  }

  const handleAbandon = async () => {
    setFinishing(true)
    await abandonWorkout(activeWorkout.id)
    navigate('/training')
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      {/* Top bar */}
      <header className="md-app-bar">
        <button
          type="button"
          onClick={handleAbandon}
          disabled={finishing}
          className="md-app-bar__icon-btn"
          aria-label="Workout abbrechen"
        >
          <Icon name="remove" className="icon" />
        </button>
        <span className="md-app-bar__title">
          {activeWorkout.gym_plans?.name ?? 'Workout'}
        </span>
      </header>

      <main className="md-page-stack flex-1" style={{ paddingTop: 'var(--space-md)' }}>
        {isComplete ? (
          /* Completion screen */
          <section>
            <div className="md-run-complete" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="md-run-complete__icon">
                <Icon name="check" className="icon" />
              </div>
              <div>
                <h1>Workout erledigt</h1>
                <p>{exercises.length} Übungen abgeschlossen</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleComplete}
              disabled={finishing}
              className="md-button md-button--filled"
              style={{ width: '100%' }}
            >
              {finishing ? 'Wird gespeichert…' : 'Workout abschließen'}
            </button>
          </section>
        ) : currentExercise ? (
          /* Exercise step */
          <section>
            <p className="md-sequence__counter">
              Übung {currentStep + 1} von {exercises.length}
            </p>
            <div className="md-progress" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="md-progress__fill" style={{ width: `${progress}%` }} />
            </div>

            <h1 className="md-sequence__title">
              {currentExercise.exercises.name_de}
            </h1>
            <p className="md-sequence__target">
              {CATEGORY_LABELS[currentExercise.exercises.category as keyof typeof CATEGORY_LABELS] ?? ''}
            </p>

            {/* Input fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', margin: 'var(--space-lg) 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-sm)' }}>
                <div className="md-field">
                  <label className="md-field__label" htmlFor="sets">Sätze</label>
                  <input
                    className="md-field__input"
                    id="sets"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    style={{ textAlign: 'center' }}
                  />
                </div>
                <div className="md-field">
                  <label className="md-field__label" htmlFor="reps">Wdh.</label>
                  <input
                    className="md-field__input"
                    id="reps"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    style={{ textAlign: 'center' }}
                  />
                </div>
                <div className="md-field">
                  <label className="md-field__label" htmlFor="weight">kg</label>
                  <input
                    className="md-field__input"
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    style={{ textAlign: 'center' }}
                  />
                </div>
              </div>

              <div className="md-field">
                <label className="md-field__label" htmlFor="exercise-notes">Notizen (optional)</label>
                <input
                  className="md-field__input"
                  id="exercise-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="z.B. leichter als letzte Woche"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogAndNext}
              className="md-button md-button--filled"
              style={{ width: '100%' }}
            >
              Weiter
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="md-button md-button--text"
              style={{ width: '100%', marginTop: 'var(--space-xs)' }}
            >
              Übung überspringen
            </button>
          </section>
        ) : null}

        <section className="md-info-note md-info-note--neutral">
          <Icon name="info" size={20} className="icon icon-sm" />
          <p>Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.</p>
        </section>
      </main>
    </div>
  )
}
