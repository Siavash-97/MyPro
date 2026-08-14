import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'

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
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <div className="md-app-bar">
        <Link to="/login" className="md-app-bar__icon-btn" aria-label="Zurück">
          <Icon name="back" />
        </Link>
      </div>

      {sent ? (
        <div className="md-auth-form" style={{ alignItems: 'center' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container">
            <Icon name="check" size={28} className="text-on-success-container" />
          </div>
          <p style={{ font: 'var(--type-body-md)', color: 'var(--md-on-surface)', textAlign: 'center' }}>
            Falls ein Konto mit <strong>{email}</strong> existiert, haben wir einen Link zum Zurücksetzen gesendet.
          </p>
          <Link to="/login" className="md-button md-button--filled">
            Zurück zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="md-auth-form">
          <div>
            <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '0 0 4px' }}>
              Passwort vergessen
            </p>
            <p className="md-greeting__subtitle">
              Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container" style={{ font: 'var(--type-body-md)' }}>
              {error}
            </div>
          )}

          <div className="md-field">
            <label className="md-field__label" htmlFor="forgot-email">E-Mail</label>
            <input
              className="md-field__input"
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button className="md-button md-button--filled" type="submit" disabled={submitting}>
            {submitting ? 'Wird gesendet…' : 'Link senden'}
          </button>

          <p className="md-auth-link">
            <Link to="/login">Zurück zur Anmeldung</Link>
          </p>
        </form>
      )}
    </div>
  )
}
