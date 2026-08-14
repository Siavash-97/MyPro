import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'
import { markRoutineDone } from '../lib/runningPlan'

/**
 * Geführte Mikroroutine (trainingseinheit.html).
 *
 * Bewusst etwas anderes als die Gym-Trainingseinheit: Hier wird nichts
 * eingetragen, sondern angeleitet – eine Übung nach der anderen, mit Bild,
 * Zielangabe und Begründung. Die Gym-Einheit protokolliert dagegen Sätze,
 * Wiederholungen und Gewicht.
 */

// Umfang der Routine. Der Zuschnitt ist eine Produktentscheidung, die Übungen
// selbst kommen aus dem Katalog. Sobald die Übungsauswahl an die Anamnese
// angeschlossen ist, ersetzt sie diese feste Vorgabe.
const ROUTINE_SIZE = 3
const DEFAULT_SETS = '2 Sätze · 12 Wiederholungen'
const ROUTINE_MINUTES = 6

export default function MicroRoutine() {
  const navigate = useNavigate()
  const { exercises, fetchReferenceData, loading, loaded } = useExercises()
  const [step, setStep] = useState(0)

  useEffect(() => {
    fetchReferenceData()
  }, [fetchReferenceData])

  // Erledigt vermerken, sobald der Abschluss erreicht ist. Danach bietet die
  // Laufzusammenfassung die Routine heute nicht noch einmal an.
  const routineLength = exercises.filter(
    (ex) => ex.modality === 'bodyweight' || ex.modality === 'both',
  ).slice(0, ROUTINE_SIZE).length
  useEffect(() => {
    if (routineLength > 0 && step >= routineLength) markRoutineDone()
  }, [step, routineLength])

  // Ohne Geräte, damit die Routine überall direkt nach dem Lauf geht.
  const routine = exercises
    .filter((ex) => ex.modality === 'bodyweight' || ex.modality === 'both')
    .slice(0, ROUTINE_SIZE)

  if (loading && !loaded) return <LoadingSpinner />

  if (routine.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
        <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Für die Routine sind noch keine Übungen hinterlegt.
        </p>
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="md-button md-button--filled md-button--compact"
        >
          Zu den Übungen
        </button>
      </div>
    )
  }

  const isDone = step >= routine.length
  const current = routine[step]
  const progress = Math.round(((step + (isDone ? 0 : 1)) / routine.length) * 100)

  const primaryMuscles = current
    ? current.exercise_muscles
        .filter((m) => m.role === 'primary')
        .map((m) => m.muscle_groups.name_de)
        .join(', ')
    : ''

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <header className="md-app-bar">
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="md-app-bar__icon-btn"
          aria-label="Einheit abbrechen"
        >
          <Icon name="remove" className="icon" />
        </button>
        <span className="md-app-bar__title">Mikroroutine</span>
      </header>

      <main className="md-page-stack flex-1" style={{ paddingTop: 'var(--space-md)' }}>
        {isDone ? (
          <section>
            <div className="md-run-complete" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="md-run-complete__icon">
                <Icon name="check" className="icon" />
              </div>
              <div>
                <h1>Einheit erledigt</h1>
                <p>{routine.length} Übungen · rund {ROUTINE_MINUTES} Minuten</p>
              </div>
            </div>

            <p style={{ margin: '0 0 var(--space-lg)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Im Wochenplan ist diese Einheit jetzt abgehakt.
            </p>

            <button
              type="button"
              className="md-button md-button--filled"
              onClick={() => navigate('/training')}
              style={{ width: '100%' }}
            >
              Zum Wochenplan
            </button>
          </section>
        ) : (
          <section>
            <p className="md-sequence__counter">
              Übung {step + 1} von {routine.length}
            </p>
            <div className="md-progress" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="md-progress__fill" style={{ width: `${progress}%` }} />
            </div>

            <div
              className="md-video-placeholder md-sequence__video"
              role="img"
              aria-label={`Videoanleitung zu ${current.name_de}`}
            >
              <Icon name="play" size={48} />
            </div>

            <h1 className="md-sequence__title">{current.name_de}</h1>
            {primaryMuscles && <p className="md-sequence__target">{primaryMuscles}</p>}
            <p className="md-sequence__sets">{DEFAULT_SETS}</p>

            <details className="md-evidence">
              <summary>Warum das hilft</summary>
              <p>{current.description_de}</p>
            </details>

            <button
              type="button"
              className="md-button md-button--filled"
              onClick={() => setStep((s) => s + 1)}
              style={{ width: '100%' }}
            >
              {step + 1 === routine.length ? 'Einheit abschließen' : 'Weiter'}
            </button>
            <button
              type="button"
              className="md-button md-button--text"
              onClick={() => setStep((s) => s + 1)}
              style={{ width: '100%', marginTop: 'var(--space-xs)' }}
            >
              Übung überspringen
            </button>
          </section>
        )}

        <section className="md-info-note md-info-note--neutral">
          <Icon name="info" size={20} className="icon icon-sm" />
          <p>
            Trainingsempfehlung auf fachlicher Grundlage, keine medizinische Bewertung.
            Ersetzt keine individuelle ärztliche Beratung. Bei Schmerzen abbrechen.
          </p>
        </section>
      </main>
    </div>
  )
}
