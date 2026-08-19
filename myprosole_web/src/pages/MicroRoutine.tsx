import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExercises } from '../store/exercises'
import { useWorkout, mikroroutineZaehlt } from '../store/workout'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'
import { markRoutineDone } from '../lib/runningPlan'

/**
 * Geführte Mikroroutine (trainingseinheit.html).
 *
 * Hier wird nichts eingetragen, sondern angeleitet – eine Übung nach der
 * anderen, mit Bild, Zielangabe und Begründung. Am Ende hält die Routine in
 * einem Zug fest, was gemacht wurde; einen Zwischenstand gibt es nicht.
 *
 * Seit Migration 0038 ist sie die einzige Einheit in der App. Der
 * Gym-Trainingsplan, der Sätze, Wiederholungen und Gewicht protokollierte,
 * ist weggefallen.
 */

// Umfang der Routine – eine vorläufige Vorgabe, kein Ergebnis.
//
// Die Übungen kommen aus dem Katalog, ausgewählt über einen festen Filter
// (siehe unten). Was hier stehen SOLL, ist eine Auswahl aus der Anamnese:
// Beschwerden und Schmerzstellen bestimmen, welche Übungen jemand bekommt –
// und welche ausdrücklich nicht. Solange diese Verbindung fehlt, sind die
// drei Übungen ein Beispiel, keine Empfehlung.
const ROUTINE_SIZE = 3
const ROUTINE_SETS = 2
const ROUTINE_REPS = 12
const DEFAULT_SETS = `${ROUTINE_SETS} Sätze · ${ROUTINE_REPS} Wiederholungen`
const ROUTINE_MINUTES = 6

export default function MicroRoutine() {
  const navigate = useNavigate()
  const { exercises, fetchReferenceData, loading, loaded } = useExercises()
  const mikroroutineFesthalten = useWorkout((s) => s.mikroroutineFesthalten)
  const [step, setStep] = useState(0)

  // Nur die wirklich gemachten Übungen, nicht die übersprungenen. Sonst wäre
  // Durchklicken dasselbe wie Trainieren.
  const [erledigt, setErledigt] = useState<string[]>([])

  // Der Beginn der Einheit, damit im Protokoll eine echte Dauer steht statt
  // zweier gleicher Zeitpunkte.
  const begonnenAm = useRef(new Date().toISOString())
  // Geschrieben wird genau einmal – auch wenn React den Effekt zweimal
  // ausführt oder jemand den Abbruchknopf doppelt trifft.
  const gespeichert = useRef(false)

  useEffect(() => {
    fetchReferenceData()
  }, [fetchReferenceData])

  // Ohne Geräte, damit die Routine überall direkt nach dem Lauf geht.
  const routine = exercises
    .filter((ex) => ex.modality === 'bodyweight' || ex.modality === 'both')
    .slice(0, ROUTINE_SIZE)
  const routineLength = routine.length

  /**
   * Die Einheit festhalten – beim Abschluss wie beim Abbruch, mit dem Stand
   * von diesem Moment. Erst am Ende zu schreiben hieße, dass eine
   * abgebrochene Routine nie eine Zeile bekommt; genau die soll aber zählen,
   * wenn mindestens die Hälfte geschafft ist.
   */
  const festhalten = async () => {
    if (gespeichert.current || routineLength === 0) return
    gespeichert.current = true

    if (mikroroutineZaehlt(erledigt.length, routineLength)) markRoutineDone()

    await mikroroutineFesthalten(
      erledigt.map((exerciseId) => ({
        exerciseId,
        sets: ROUTINE_SETS,
        reps: ROUTINE_REPS,
      })),
      routineLength,
      begonnenAm.current,
    )
  }

  const abbrechen = async () => {
    await festhalten()
    navigate('/training')
  }

  // Der Abschluss ist ein Verlassen wie jedes andere – hier ist nur sicher,
  // dass alle Übungen vorbei sind.
  useEffect(() => {
    if (routineLength > 0 && step >= routineLength) void festhalten()
    // festhalten haengt an erledigt und routineLength; beide sind zum
    // Zeitpunkt des Abschlusses endgueltig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, routineLength])

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
  const zaehlt = mikroroutineZaehlt(erledigt.length, routine.length)
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
          onClick={abbrechen}
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
                <h1>{zaehlt ? 'Einheit erledigt' : 'Einheit beendet'}</h1>
                <p>
                  {erledigt.length === routine.length
                    ? `${routine.length} Übungen · rund ${ROUTINE_MINUTES} Minuten`
                    : `${erledigt.length} von ${routine.length} Übungen`}
                </p>
              </div>
            </div>

            {/* Ehrlich statt freundlich: Wer die Hälfte übersprungen hat, soll
                nicht lesen, es sei abgehakt. */}
            <p style={{ margin: '0 0 var(--space-lg)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              {zaehlt
                ? 'Zählt für diese Woche. Im Wochenplan ist die Einheit abgehakt.'
                : 'Weniger als die Hälfte geschafft – diese Einheit zählt für die Woche nicht mit.'}
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
              onClick={() => {
                setErledigt((vorher) => [...vorher, current.id])
                setStep((s) => s + 1)
              }}
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
