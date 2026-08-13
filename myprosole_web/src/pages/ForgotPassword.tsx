import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const resetPassword = useAuth((s) => s.resetPassword)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const err = await resetPassword(email)
    setSubmitting(false)

    if (err) {
      setError('Anfrage fehlgeschlagen. Bitte prüfe deine E-Mail-Adresse.')
      return
    }

    setSent(true)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-medium text-on-surface text-center mb-2">
          Passwort vergessen
        </h1>
        <p className="text-sm text-on-surface-variant text-center mb-8">
          Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
        </p>

        {sent ? (
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
                <path d="M9 16.17 5.53 12.7l-1.41 1.41L9 19 20.29 7.71l-1.41-1.41z" />
              </svg>
            </div>
            <p className="text-sm text-on-surface text-center">
              Falls ein Konto mit <strong>{email}</strong> existiert, haben wir einen Link zum Zurücksetzen gesendet.
            </p>
            <Link
              to="/login"
              className="h-10 px-6 inline-flex items-center rounded-full bg-primary text-on-primary text-sm font-medium mt-4"
            >
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <>
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

              <button
                type="submit"
                disabled={submitting}
                className="h-12 rounded-full bg-primary text-on-primary font-medium mt-2 disabled:opacity-50"
              >
                {submitting ? 'Wird gesendet…' : 'Link senden'}
              </button>
            </form>

            <p className="text-center text-sm text-on-surface-variant mt-6">
              <Link to="/login" className="text-primary font-medium">
                Zurück zur Anmeldung
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
