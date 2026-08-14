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
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-medium text-on-surface text-center mb-2">
          Profil einrichten
        </h1>
        <p className="text-center text-on-surface-variant mb-8">
          Erzähl uns etwas über dich.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-on-surface-variant">
              Anzeigename
            </span>
            <input
              type="text"
              required
              maxLength={50}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-on-surface-variant">
              Laufniveau
            </span>
            <select
              value={runningLevel}
              onChange={(e) =>
                setRunningLevel(e.target.value as typeof runningLevel)
              }
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-on-surface-variant">
              Wochenziel in km (optional)
            </span>
            <input
              type="number"
              min={0}
              max={500}
              step={0.1}
              value={weeklyGoal}
              onChange={(e) => setWeeklyGoal(e.target.value)}
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-full bg-primary text-on-primary font-medium mt-2 disabled:opacity-50"
          >
            {submitting ? 'Wird gespeichert…' : 'Weiter'}
          </button>
        </form>
      </div>
    </div>
  )
}
