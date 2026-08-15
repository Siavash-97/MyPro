import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkout } from '../store/workout'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Laufendes Workout: eine Uebung nach der anderen, Satz fuer Satz abhaken.
 *
 * Vorher stand hier ein Formular, in das man Saetze, Wiederholungen und
 * Gewicht nachtragen sollte. Waehrend des Trainings tippt das niemand. Jetzt
 * stehen die Vorgaben aus dem Plan schon da, und pro Satz gibt es einen
 * Kreis - antippen heisst erledigt.
 *
 * Was abgehakt wurde, landet beim Weitergehen als tatsaechliche Satzzahl im
 * Protokoll. Wer einen Satz weglaesst, sieht das spaeter im Verlauf.
 */
export default function WorkoutSession() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { activeWorkout, completeWorkout, abandonWorkout, updateLogExercise, loading } = useWorkout()

  const [schritt, setSchritt] = useState(0)
  const [erledigt, setErledigt] = useState<Set<number>>(new Set())
  const [beendet, setBeendet] = useState(false)

  // Beim Wechsel der Uebung die Haken zuruecksetzen.
  useEffect(() => {
    setErledigt(new Set())
  }, [schritt])

  if (loading && !activeWorkout) return <LoadingSpinner />

  if (!activeWorkout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
        <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Kein aktives Workout.
        </p>
        <button type="button" onClick={() => navigate('/training/gym')} className="md-button md-button--filled md-button--compact">
          Zu den Plänen
        </button>
      </div>
    )
  }

  const uebungen = [...activeWorkout.workout_log_exercises].sort((a, b) => a.position - b.position)

  if (uebungen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
        <p style={{ margin: '0 0 var(--space-md)', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          In diesem Plan stehen keine Übungen. Füg welche hinzu, dann kannst du
          das Workout starten.
        </p>
        <button type="button" onClick={() => navigate('/training/gym')} className="md-button md-button--filled md-button--compact">
          Zu den Plänen
        </button>
      </div>
    )
  }

  const aktuell = uebungen[schritt]
  const letzte = schritt >= uebungen.length - 1
  // Zeitbasierte Uebungen haben keine Saetze - dort genuegt ein Haken.
  const anzahlSaetze = aktuell?.actual_sets ?? 1

  const weiter = async () => {
    // Nur wenn etwas abgehakt wurde, wird die Zahl korrigiert. Sonst bleibt
    // die Vorgabe aus dem Plan stehen - ein uebersprungener Eintrag soll
    // nicht als "0 Saetze" im Verlauf landen.
    if (erledigt.size > 0 && erledigt.size !== aktuell.actual_sets) {
      await updateLogExercise(aktuell.id, { actual_sets: erledigt.size })
    }

    if (!letzte) {
      setSchritt((s) => s + 1)
      return
    }

    setBeendet(true)
    const err = await completeWorkout(activeWorkout.id)
    if (err) {
      setBeendet(false)
      showSnackbar('Speichern fehlgeschlagen: ' + err)
      return
    }
    navigate('/training/gym', { replace: true })
  }

  const abbrechen = async () => {
    await abandonWorkout(activeWorkout.id)
    navigate('/training/gym', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <header className="md-app-bar">
        <button type="button" onClick={abbrechen} className="md-app-bar__icon-btn" aria-label="Workout abbrechen">
          <Icon name="back" className="icon" />
        </button>
        <span className="md-app-bar__title">
          Übung {schritt + 1} von {uebungen.length}
        </span>
      </header>

      <main className="md-page-stack flex-1">
        {/* Fortschritt ueber alle Uebungen */}
        <div className="h-1 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round((schritt / uebungen.length) * 100)}%` }}
          />
        </div>

        <div>
          <h1 style={{ margin: 0, font: 'var(--type-title-lg)', color: 'var(--md-on-surface)' }}>
            {aktuell.exercises.name_de}
          </h1>
          <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            {vorgabe(aktuell)}
          </p>
        </div>

        {aktuell.exercises.image_url && (
          <div className="md-map" style={{ lineHeight: 0 }}>
            <img
              src={aktuell.exercises.image_url}
              alt=""
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        )}

        {/* Saetze abhaken */}
        <section className="md-card">
          <p className="md-section-title">
            {aktuell.duration_seconds != null && aktuell.actual_sets == null ? 'Erledigt?' : 'Sätze'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {Array.from({ length: anzahlSaetze }, (_, i) => {
              const an = erledigt.has(i)
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={an}
                  aria-label={`Satz ${i + 1}${an ? ' erledigt' : ''}`}
                  onClick={() =>
                    setErledigt((v) => {
                      const neu = new Set(v)
                      if (neu.has(i)) neu.delete(i)
                      else neu.add(i)
                      return neu
                    })
                  }
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    font: 'var(--type-title-md)',
                    background: an ? 'var(--md-primary)' : 'transparent',
                    color: an ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                    border: `2px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                  }}
                >
                  {an ? <Icon name="check" size={24} /> : i + 1}
                </button>
              )
            })}
          </div>
          <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
            {erledigt.size} von {anzahlSaetze} erledigt
          </p>
        </section>

        {/* Was noch kommt */}
        {schritt < uebungen.length - 1 && (
          <section>
            <p className="md-section-title">Danach</p>
            <ol className="md-plan-list">
              {uebungen.slice(schritt + 1).map((u) => (
                <li key={u.id} className="md-plan-item">
                  <span
                    className="md-plan-item__grip"
                    style={{ font: 'var(--type-label-lg)', minWidth: 20, textAlign: 'center' }}
                    aria-hidden="true"
                  >
                    {u.position}
                  </span>
                  <span className="md-plan-item__body">
                    {u.exercises.name_de}
                    <small>{vorgabe(u)}</small>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>

      <div style={{ padding: '0 var(--space-md) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <button type="button" onClick={weiter} disabled={beendet} className="md-button md-button--filled">
          {beendet ? 'Wird gespeichert…' : letzte ? 'Workout beenden' : 'Nächste Übung'}
        </button>
        {!letzte && (
          <button type="button" onClick={abbrechen} className="md-button md-button--text">
            Workout abbrechen
          </button>
        )}
      </div>
    </div>
  )
}

/** "3 Sätze · 10 Wdh. · 40 kg" oder "60 Sekunden" */
function vorgabe(u: {
  actual_sets: number | null
  actual_reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
}): string {
  return [
    u.actual_sets != null ? `${u.actual_sets} Sätze` : null,
    u.actual_reps != null ? `${u.actual_reps} Wdh.` : null,
    u.weight_kg != null ? `${String(u.weight_kg).replace('.', ',')} kg` : null,
    u.duration_seconds != null ? `${u.duration_seconds} Sekunden` : null,
  ].filter(Boolean).join(' · ') || 'Ohne Vorgabe'
}
