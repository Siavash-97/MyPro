import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkout } from '../store/workout'
import { CATEGORY_LABELS } from '../lib/labels'
import LoadingSpinner from '../components/ui/LoadingSpinner'

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
        <p className="text-on-surface-variant mb-4">Kein aktives Workout.</p>
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="h-10 px-6 rounded-full bg-primary text-on-primary text-sm font-medium"
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
      <header className="flex items-center h-14 px-4 bg-surface-container">
        <button
          type="button"
          onClick={handleAbandon}
          disabled={finishing}
          className="p-1 text-on-surface"
          aria-label="Workout abbrechen"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
        <span className="flex-1 text-center text-base font-medium text-on-surface">
          {activeWorkout.gym_plans?.name ?? 'Workout'}
        </span>
        <div className="w-6" />
      </header>

      <main className="flex-1 px-4 py-6">
        {isComplete ? (
          /* Completion screen */
          <div className="flex flex-col items-center gap-4 pt-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-container">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
                <path d="M9 16.17 5.53 12.7l-1.41 1.41L9 19 20.29 7.71l-1.41-1.41z" />
              </svg>
            </div>
            <h1 className="text-xl font-medium text-on-surface">Workout erledigt</h1>
            <p className="text-sm text-on-surface-variant">
              {exercises.length} Übungen abgeschlossen
            </p>
            <button
              type="button"
              onClick={handleComplete}
              disabled={finishing}
              className="w-full h-12 mt-4 rounded-full bg-primary text-on-primary font-medium disabled:opacity-50"
            >
              {finishing ? 'Wird gespeichert…' : 'Workout abschließen'}
            </button>
          </div>
        ) : currentExercise ? (
          /* Exercise step */
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm text-on-surface-variant mb-2">
                Übung {currentStep + 1} von {exercises.length}
              </p>
              <div className="h-1 rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div>
              <h1 className="text-xl font-medium text-on-surface">
                {currentExercise.exercises.name_de}
              </h1>
              <p className="text-sm text-on-surface-variant mt-1">
                {CATEGORY_LABELS[currentExercise.exercises.category as keyof typeof CATEGORY_LABELS] ?? ''}
              </p>
            </div>

            {/* Input fields */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="sets" className="block text-xs text-on-surface-variant mb-1">
                    Sätze
                  </label>
                  <input
                    id="sets"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm text-center outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label htmlFor="reps" className="block text-xs text-on-surface-variant mb-1">
                    Wdh.
                  </label>
                  <input
                    id="reps"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm text-center outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label htmlFor="weight" className="block text-xs text-on-surface-variant mb-1">
                    kg
                  </label>
                  <input
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm text-center outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="exercise-notes" className="block text-xs text-on-surface-variant mb-1">
                  Notizen (optional)
                </label>
                <input
                  id="exercise-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="z.B. leichter als letzte Woche"
                  className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface placeholder:text-on-surface-variant text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={handleLogAndNext}
                className="h-12 rounded-full bg-primary text-on-primary font-medium"
              >
                Weiter
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="h-10 rounded-full text-primary text-sm font-medium"
              >
                Übung überspringen
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Disclaimer */}
      <footer className="px-4 pb-6">
        <p className="text-xs text-on-surface-variant text-center">
          Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.
        </p>
      </footer>
    </div>
  )
}
