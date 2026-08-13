import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const signUp = useAuth((s) => s.signUp)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }

    setSubmitting(true)
    const err = await signUp(email, password)
    setSubmitting(false)

    if (err) {
      setError('Registrierung fehlgeschlagen. Bitte versuche es erneut.')
      return
    }

    navigate('/profil/setup', { replace: true })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-medium text-on-surface text-center mb-8">
          Registrieren
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container text-sm">
              {error}
            </div>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-on-surface-variant">
              E-Mail
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-on-surface-variant">
              Passwort
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-on-surface-variant">
              Passwort bestätigen
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-full bg-primary text-on-primary font-medium mt-2 disabled:opacity-50"
          >
            {submitting ? 'Wird registriert…' : 'Konto erstellen'}
          </button>
        </form>

        <p className="text-center text-sm text-on-surface-variant mt-6">
          Bereits ein Konto?{' '}
          <Link to="/login" className="text-primary font-medium">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
