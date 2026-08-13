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
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
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

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-xs text-on-surface-variant">oder</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="h-12 w-full rounded-full border border-outline bg-surface text-on-surface font-medium flex items-center justify-center gap-3"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z"/>
            </svg>
            Mit Google registrieren
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
