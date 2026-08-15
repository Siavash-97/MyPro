import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { GymPlanExercise, Exercise } from '../../types'
import Icon from '../ui/Icon'

/**
 * Vorgaben einer Planuebung aendern: Saetze, Wiederholungen, Dauer, Pause und
 * Gewicht. Dazu der Weg zur Uebungsbeschreibung.
 *
 * Leeres Feld heisst "nicht vorgegeben" und wird als NULL gespeichert – nicht
 * als 0. Eine Pause von 0 Sekunden waere etwas anderes als keine Vorgabe, und
 * die Datenbank laesst 0 dort ohnehin nicht zu.
 */

interface Props {
  planExercise: GymPlanExercise & { exercises: Exercise }
  onSave: (werte: Partial<GymPlanExercise>) => Promise<string | null>
  onCancel: () => void
}

/** Leerer Text wird zu null, sonst zur Zahl. Ungueltiges bleibt null. */
function zahlOderNull(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function PlanExerciseEditor({ planExercise, onSave, onCancel }: Props) {
  const [sets, setSets] = useState(planExercise.sets?.toString() ?? '')
  const [reps, setReps] = useState(planExercise.reps?.toString() ?? '')
  const [dauer, setDauer] = useState(planExercise.duration_seconds?.toString() ?? '')
  const [pause, setPause] = useState(planExercise.rest_seconds?.toString() ?? '')
  const [gewicht, setGewicht] = useState(
    planExercise.weight_kg != null ? String(planExercise.weight_kg).replace('.', ',') : '',
  )
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  const handleSave = async () => {
    const werte = {
      sets: zahlOderNull(sets),
      reps: zahlOderNull(reps),
      duration_seconds: zahlOderNull(dauer),
      rest_seconds: zahlOderNull(pause),
      weight_kg: zahlOderNull(gewicht),
    }

    // Dieselbe Bedingung wie in der Datenbank, nur frueher und verstaendlicher:
    // Ohne Saetze und ohne Dauer weiss niemand, was zu tun ist.
    if (werte.sets == null && werte.duration_seconds == null) {
      setFehler('Trag entweder Sätze oder eine Dauer ein – sonst fehlt die Vorgabe.')
      return
    }
    if (werte.weight_kg != null && (werte.weight_kg < 0 || werte.weight_kg > 500)) {
      setFehler('Das Gewicht muss zwischen 0 und 500 kg liegen.')
      return
    }
    if (werte.rest_seconds != null && (werte.rest_seconds <= 0 || werte.rest_seconds > 3600)) {
      setFehler('Die Pause muss zwischen 1 Sekunde und einer Stunde liegen.')
      return
    }

    setFehler(null)
    setSpeichert(true)
    const err = await onSave(werte)
    setSpeichert(false)
    if (err) setFehler('Speichern fehlgeschlagen: ' + err)
  }

  return (
    <div className="md-card md-card--outlined" style={{ marginBottom: 'var(--space-sm)' }}>
      <p className="md-section-title" style={{ marginBottom: 'var(--space-sm)' }}>
        {planExercise.exercises.name_de}
      </p>

      <div className="md-field-grid">
        <Feld id="pe-saetze" label="Sätze" wert={sets} setWert={setSets} platzhalter="3" />
        <Feld id="pe-wdh" label="Wiederholungen" wert={reps} setWert={setReps} platzhalter="10" />
        <Feld id="pe-dauer" label="Dauer (Sek.)" wert={dauer} setWert={setDauer} platzhalter="60" />
        <Feld id="pe-pause" label="Pause (Sek.)" wert={pause} setWert={setPause} platzhalter="90" />
        <Feld id="pe-gewicht" label="Gewicht (kg)" wert={gewicht} setWert={setGewicht} platzhalter="20" komma />
      </div>

      {fehler && (
        <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-error)' }}>
          {fehler}
        </p>
      )}

      <Link
        to={`/training/uebung/${planExercise.exercises.slug}`}
        className="md-button md-button--text"
        style={{ width: '100%', marginTop: 'var(--space-sm)', textDecoration: 'none' }}
      >
        <Icon name="info" size={20} className="icon-sm" />
        So geht die Übung
      </Link>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={speichert}
          className="md-button md-button--compact"
          style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={speichert}
          className="md-button md-button--filled md-button--compact"
          style={{ flex: 1 }}
        >
          {speichert ? 'Wird gespeichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  )
}

function Feld({
  id, label, wert, setWert, platzhalter, komma = false,
}: {
  id: string
  label: string
  wert: string
  setWert: (v: string) => void
  platzhalter: string
  komma?: boolean
}) {
  return (
    <div className="md-field">
      <label className="md-field__label" htmlFor={id}>{label}</label>
      <input
        className="md-field__input"
        id={id}
        type="text"
        // Zifferntastatur statt voller Tastatur; "decimal" laesst das Komma zu.
        inputMode={komma ? 'decimal' : 'numeric'}
        value={wert}
        placeholder={platzhalter}
        onChange={(e) => setWert(e.target.value)}
      />
    </div>
  )
}
