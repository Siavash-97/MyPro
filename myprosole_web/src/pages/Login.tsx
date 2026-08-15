import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import GoogleMark from '../components/ui/GoogleMark'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const signIn = useAuth((s) => s.signIn)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
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
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <div className="md-app-bar">
        <Link to="/willkommen" className="md-app-bar__icon-btn" aria-label="Zurück">
          <Icon name="back" />
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="md-auth-form">
        <div>
          <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '0 0 4px' }}>
            Willkommen zurück
          </p>
          <p className="md-greeting__subtitle">
            Melde dich an, um deinen Fortschritt zu sehen.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container" style={{ font: 'var(--type-body-md)' }}>
            {error}
          </div>
        )}

        <div className="md-field">
          <label className="md-field__label" htmlFor="login-email">E-Mail</label>
          <input
            className="md-field__input"
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="login-password">Passwort</label>
          <input
            className="md-field__input"
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Dein Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Link
          to="/passwort-vergessen"
          style={{ textDecoration: 'none', color: 'var(--md-on-surface-variant)', font: 'var(--type-body-md)', marginTop: '-8px' }}
        >
          Passwort vergessen?
        </Link>

        <button className="md-button md-button--filled" type="submit" disabled={submitting}>
          {submitting ? 'Wird angemeldet…' : 'Anmelden'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-outline-variant" />
          <span style={{ font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>oder</span>
          <div className="flex-1 h-px bg-outline-variant" />
        </div>

        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="md-button"
          style={{ border: '1px solid var(--md-outline)', background: 'var(--md-surface)', color: 'var(--md-on-surface)', width: '100%' }}
        >
          <GoogleMark />
          Mit Google anmelden
        </button>

        <p className="md-auth-link">
          Noch kein Konto? <Link to="/register">Registrieren</Link>
        </p>
      </form>
    </div>
  )
}
