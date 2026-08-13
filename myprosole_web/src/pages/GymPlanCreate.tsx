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
    <div className="px-4 py-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="plan-name" className="block text-sm font-medium text-on-surface mb-1">
            Name
          </label>
          <input
            id="plan-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Oberkörper Montag"
            required
            className="w-full h-12 px-4 rounded-xl bg-surface-container text-on-surface placeholder:text-on-surface-variant text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div>
          <label htmlFor="plan-desc" className="block text-sm font-medium text-on-surface mb-1">
            Beschreibung (optional)
          </label>
          <textarea
            id="plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Worum geht es in diesem Plan?"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-surface-container text-on-surface placeholder:text-on-surface-variant text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="h-12 rounded-full bg-primary text-on-primary font-medium disabled:opacity-50"
        >
          {saving ? 'Wird erstellt…' : 'Plan erstellen'}
        </button>
      </form>
    </div>
  )
}
