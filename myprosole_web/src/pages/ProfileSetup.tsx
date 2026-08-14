import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

const LEVELS = [
  { value: 'anfaenger', label: 'Anfänger' },
  { value: 'fortgeschritten', label: 'Fortgeschritten' },
  { value: 'erfahren', label: 'Erfahren' },
] as const

export default function ProfileSetup() {
  const [displayName, setDisplayName] = useState('')
  const [runningLevel, setRunningLevel] = useState<
    'anfaenger' | 'fortgeschritten' | 'erfahren'
  >('anfaenger')
  const [weeklyGoal, setWeeklyGoal] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const createProfile = useAuth((s) => s.createProfile)
  const profile = useAuth((s) => s.profile)
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) navigate('/', { replace: true })
  }, [profile, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = displayName.trim()
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      setError('Der Name muss zwischen 1 und 50 Zeichen lang sein.')
      return
    }

    const goal = weeklyGoal ? parseFloat(weeklyGoal) : null
    if (goal !== null && (goal < 0 || goal > 500)) {
      setError('Das Wochenziel muss zwischen 0 und 500 km liegen.')
      return
    }

    setSubmitting(true)
    const err = await createProfile({
      display_name: trimmedName,
      running_level: runningLevel,
      weekly_goal_km: goal,
    })
    setSubmitting(false)

    if (err) {
      setError('Profil-Fehler: ' + err)
      return
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <div className="md-app-bar">
        <h1 style={{ font: 'var(--type-title-lg)', margin: 0 }}>Profil einrichten</h1>
      </div>

      <form onSubmit={handleSubmit} className="md-auth-form">
        <div>
          <p className="md-greeting__subtitle">
            Erzähl uns etwas über dich.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container" style={{ font: 'var(--type-body-md)' }}>
            {error}
          </div>
        )}

        <div className="md-field">
          <label className="md-field__label" htmlFor="setup-name">Anzeigename</label>
          <input
            className="md-field__input"
            id="setup-name"
            type="text"
            required
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="setup-level">Laufniveau</label>
          <select
            className="md-field__input"
            id="setup-level"
            value={runningLevel}
            onChange={(e) => setRunningLevel(e.target.value as typeof runningLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="setup-goal">Wochenziel in km (optional)</label>
          <input
            className="md-field__input"
            id="setup-goal"
            type="number"
            min={0}
            max={500}
            step={0.1}
            value={weeklyGoal}
            onChange={(e) => setWeeklyGoal(e.target.value)}
          />
        </div>

        <button className="md-button md-button--filled" type="submit" disabled={submitting}>
          {submitting ? 'Wird gespeichert…' : 'Weiter'}
        </button>
      </form>
    </div>
  )
}
