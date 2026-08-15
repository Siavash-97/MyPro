import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTraining } from '../store/training'
import { useExercises } from '../store/exercises'
import type { ExerciseWithRelations } from '../types'
import { CATEGORY_LABELS } from '../lib/labels'
import ExercisePicker from '../components/training/ExercisePicker'
import Icon from '../components/ui/Icon'

/**
 * Neuen Plan anlegen – Name und Uebungen in einem Durchgang.
 *
 * Vorher waren es zwei Schritte: Plan anlegen, zur Liste zurueck, Plan
 * oeffnen, Uebungen hinzufuegen. Jetzt sammelt die Seite die Auswahl
 * oertlich, und erst "Plan speichern" schreibt beides in die Datenbank.
 *
 * Uebungen sind bewusst freiwillig: Wer nur schnell einen leeren Plan anlegen
 * will, soll das koennen und spaeter fuellen.
 */

/** Startwerte wie beim Hinzufuegen im bestehenden Plan – siehe GymPlanDetail. */
function startwerte(category: string): { sets?: number; reps?: number; duration_seconds?: number } {
  if (category === 'strength') return { sets: 3, reps: 10 }
  return { duration_seconds: 60 }
}

export default function GymPlanCreate() {
  const navigate = useNavigate()
  const { createPlan, addExerciseToPlan } = useTraining()
  const { exercises, fetchReferenceData, loaded } = useExercises()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [gewaehlt, setGewaehlt] = useState<ExerciseWithRelations[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchReferenceData()
  }, [fetchReferenceData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    const { id, error: planFehler } = await createPlan(name.trim(), description.trim() || undefined)
    if (planFehler || !id) {
      setSaving(false)
      setError(planFehler ?? 'Plan konnte nicht angelegt werden.')
      return
    }

    // Nacheinander, nicht parallel: Die Position jeder Uebung leitet sich aus
    // den bereits vorhandenen ab. Gleichzeitig gesendet bekaemen zwei
    // dieselbe Nummer, und die Datenbank laesst das nicht zu.
    const gescheitert: string[] = []
    for (const ex of gewaehlt) {
      const err = await addExerciseToPlan(id, ex.id, startwerte(ex.category))
      if (err) gescheitert.push(ex.name_de)
    }

    setSaving(false)

    // Der Plan steht auf jeden Fall. Ging eine Uebung nicht durch, sagen wir
    // es und lassen den Nutzer im Plan – dort kann er sie erneut hinzufuegen.
    if (gescheitert.length) {
      setError(`Der Plan wurde angelegt, aber diese Übungen nicht: ${gescheitert.join(', ')}`)
      return
    }

    navigate(`/training/plan/${id}`, { replace: true })
  }

  const gewaehlteIds = new Set(gewaehlt.map((e) => e.id))

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <fieldset className="md-form-section">
        <legend className="md-visually-hidden">Neuer Gym-Plan</legend>
        <p className="md-form-section__title">Neuer Gym-Plan</p>

        <div className="md-field">
          <label className="md-field__label" htmlFor="plan-name">Name</label>
          <input
            className="md-field__input"
            id="plan-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Oberkörper Montag"
            required
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="plan-desc">Beschreibung (optional)</label>
          <textarea
            className="md-field__input"
            id="plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Worum geht es in diesem Plan?"
            rows={3}
            style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
          />
        </div>
      </fieldset>

      {/* Ausgewaehlte Uebungen */}
      <div>
        <p className="md-section-title">
          Übungen ({gewaehlt.length})
        </p>
        {gewaehlt.length === 0 ? (
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Such dir unten Übungen aus. Du kannst den Plan auch leer anlegen und
            später füllen.
          </p>
        ) : (
          <ol className="md-plan-list">
            {gewaehlt.map((ex, i) => (
              <li key={ex.id} className="md-plan-item">
                <span
                  className="md-plan-item__grip"
                  style={{ font: 'var(--type-label-lg)', minWidth: 20, textAlign: 'center' }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="md-plan-item__body">
                  {ex.name_de}
                  <small>{CATEGORY_LABELS[ex.category as keyof typeof CATEGORY_LABELS]}</small>
                </span>
                <button
                  type="button"
                  onClick={() => setGewaehlt((v) => v.filter((e) => e.id !== ex.id))}
                  className="md-plan-item__remove"
                  aria-label={`${ex.name_de} entfernen`}
                >
                  <Icon name="remove" size={20} className="icon-sm" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {loaded && (
        <div className="md-card md-card--outlined">
          <p className="md-section-title">Übung hinzufügen</p>
          <ExercisePicker
            exercises={exercises}
            bereitsDrin={gewaehlteIds}
            onAdd={(ex) => setGewaehlt((v) => [...v, ex])}
          />
        </div>
      )}

      {error && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{error}</p>
      )}

      <button
        className="md-button md-button--filled"
        type="submit"
        disabled={!name.trim() || saving}
      >
        {saving ? 'Wird gespeichert…' : 'Plan speichern'}
      </button>
    </form>
  )
}
