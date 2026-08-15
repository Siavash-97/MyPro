import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkout } from '../store/workout'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Laufendes Workout: eine Uebung nach der anderen, Satz fuer Satz abhaken.
 *
 * Bewusst schlicht. Waehrend des Trainings will niemand lesen oder tippen –
 * es gibt einen Zaehler, die Kreise und sonst nichts. Ist der letzte Satz
 * abgehakt, springt die App von selbst zur naechsten Uebung; nur am Ende
 * wartet sie auf einen Knopfdruck, damit das Workout nicht unversehens
 * beendet wird.
 *
 * Gespeichert wird nebenbei: Die tatsaechliche Satzzahl geht beim Wechsel ins
 * Protokoll, ohne dass jemand etwas bestaetigen muss.
 */
const SPRUNG_VERZOEGERUNG_MS = 700

export default function WorkoutSession() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const { activeWorkout, completeWorkout, abandonWorkout, updateLogExercise, loading } = useWorkout()

  const [schritt, setSchritt] = useState(0)
  const [erledigt, setErledigt] = useState<Set<number>>(new Set())
  const [beendet, setBeendet] = useState(false)
  const sprungRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uebungen = activeWorkout
    ? [...activeWorkout.workout_log_exercises].sort((a, b) => a.position - b.position)
    : []
  const aktuell = uebungen[schritt]
  const letzte = schritt >= uebungen.length - 1
  const anzahlSaetze = aktuell?.actual_sets ?? 1
  const fertig = aktuell != null && erledigt.size >= anzahlSaetze

  // Weitergehen: Satzzahl nachtragen, Haken zuruecksetzen, naechste Uebung.
  const weiter = () => {
    if (!aktuell) return
    if (erledigt.size > 0 && erledigt.size !== aktuell.actual_sets) {
      updateLogExercise(aktuell.id, { actual_sets: erledigt.size })
    }
    setErledigt(new Set())
    setSchritt((s) => s + 1)
  }

  // Letzter Satz abgehakt: von selbst zur naechsten Uebung. Kurz warten,
  // damit man den Haken noch sieht.
  useEffect(() => {
    if (!fertig || letzte) return
    sprungRef.current = setTimeout(weiter, SPRUNG_VERZOEGERUNG_MS)
    return () => { if (sprungRef.current) clearTimeout(sprungRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertig, letzte, schritt])

  if (loading && !activeWorkout) return <LoadingSpinner />

  if (!activeWorkout || uebungen.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
        <p style={{ margin: '0 0 var(--space-md)', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          {activeWorkout ? 'In diesem Plan stehen keine Übungen.' : 'Kein aktives Workout.'}
        </p>
        <button type="button" onClick={() => navigate('/training/gym')} className="md-button md-button--filled md-button--compact">
          Zu den Plänen
        </button>
      </div>
    )
  }

  const beenden = async () => {
    if (aktuell && erledigt.size > 0 && erledigt.size !== aktuell.actual_sets) {
      await updateLogExercise(aktuell.id, { actual_sets: erledigt.size })
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
          {schritt + 1} von {uebungen.length}
        </span>
      </header>

      <main
        className="flex-1"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-lg)',
          padding: 'var(--space-lg) var(--space-md)',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ margin: 0, font: 'var(--type-title-lg)', color: 'var(--md-on-surface)' }}>
            {aktuell.exercises.name_de}
          </h1>
          <p style={{ margin: '4px 0 0', font: 'var(--type-body-lg)', color: 'var(--md-on-surface-variant)' }}>
            {vorgabe(aktuell)}
          </p>
        </div>

        {/* Die Kreise sind der einzige Bedienteil. Gross genug, um sie mit
            zittrigen Haenden zwischen zwei Saetzen zu treffen. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', justifyContent: 'center' }}>
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
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: 'var(--type-title-md)',
                  transition: 'background 150ms, border-color 150ms',
                  background: an ? 'var(--md-primary)' : 'transparent',
                  color: an ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                  border: `2px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                }}
              >
                {an ? <Icon name="check" size={32} /> : i + 1}
              </button>
            )
          })}
        </div>

        {fertig && !letzte && (
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-primary)' }}>
            Weiter zur nächsten Übung…
          </p>
        )}
      </main>

      <div style={{ padding: '0 var(--space-md) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {letzte ? (
          <button type="button" onClick={beenden} disabled={beendet} className="md-button md-button--filled">
            {beendet ? 'Wird gespeichert…' : 'Workout beenden'}
          </button>
        ) : (
          <button type="button" onClick={weiter} className="md-button md-button--text">
            Übung überspringen
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
