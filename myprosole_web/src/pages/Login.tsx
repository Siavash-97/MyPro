import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || '/'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const err = await signIn(email, password)
    setSubmitting(false)

    if (err) {
      setError('E-Mail oder Passwort falsch.')
      return
    }

    navigate(from, { replace: true })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-medium text-on-surface text-center mb-8">
          Anmelden
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 px-4 rounded-md border border-outline bg-surface text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-12 rounded-full bg-primary text-on-primary font-medium mt-2 disabled:opacity-50"
          >
            {submitting ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>

        <div className="text-center mt-4">
          <Link to="/passwort-vergessen" className="text-sm text-primary font-medium">
            Passwort vergessen?
          </Link>
        </div>

        <p className="text-center text-sm text-on-surface-variant mt-4">
          Noch kein Konto?{' '}
          <Link to="/register" className="text-primary font-medium">
            Registrieren
          </Link>
        </p>
      </div>
    </div>
  )
}
