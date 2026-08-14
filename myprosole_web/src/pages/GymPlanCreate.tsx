import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTraining } from '../store/training'

export default function GymPlanCreate() {
  const navigate = useNavigate()
  const createPlan = useTraining((s) => s.createPlan)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)
    const err = await createPlan(name.trim(), description.trim() || undefined)
    setSaving(false)

    if (err) {
      setError(err)
    } else {
      navigate('/training')
    }
  }

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

      {error && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{error}</p>
      )}

      <button
        className="md-button md-button--filled"
        type="submit"
        disabled={!name.trim() || saving}
      >
        {saving ? 'Wird erstellt…' : 'Plan erstellen'}
      </button>
    </form>
  )
}
