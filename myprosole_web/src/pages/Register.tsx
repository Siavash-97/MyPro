import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'

// Mindestlaenge wie im Entwurf. Kuerzer waere eine stillschweigende
// Absenkung einer Sicherheitsvorgabe.
const MIN_PASSWORD_LENGTH = 8

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const signUp = useAuth((s) => s.signUp)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`)
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
      if (err.toLowerCase().includes('already registered') || err.toLowerCase().includes('already been registered')) {
        setError('Diese E-Mail ist bereits registriert. Du wirst zur Anmeldung weitergeleitet…')
        setRedirecting(true)
        setTimeout(() => navigate('/login', { replace: true }), 2000)
        return
      }
      setError('Registrierung fehlgeschlagen: ' + err)
      return
    }

    // Der eingegebene Name wird beim Profil-Einrichten uebernommen, damit er
    // nicht zweimal getippt werden muss.
    navigate('/profil/setup', { replace: true, state: { name: name.trim() } })
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
            Konto erstellen
          </p>
          <p className="md-greeting__subtitle">
            Starte mit deiner ersten Laufanalyse.
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-md bg-error-container text-on-error-container" style={{ font: 'var(--type-body-md)' }}>
            {error}
          </div>
        )}

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-name">Name</label>
          <input
            className="md-field__input"
            id="register-name"
            type="text"
            required
            autoComplete="name"
            placeholder="Vor- und Nachname"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-email">E-Mail</label>
          <input
            className="md-field__input"
            id="register-email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-password">Passwort</label>
          <input
            className="md-field__input"
            id="register-password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Mindestens 8 Zeichen"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-confirm">Passwort bestätigen</label>
          <input
            className="md-field__input"
            id="register-confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {/* Pflichtangabe wie im Entwurf: ohne Zustimmung kein Konto. */}
        <label className="md-checkbox-row" htmlFor="register-consent">
          <input
            className="md-checkbox__input"
            id="register-consent"
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span className="md-checkbox-row__label">
            Ich akzeptiere die <a href="#bedingungen">AGB</a> und die{' '}
            <a href="#datenschutz">Datenschutzerklärung</a>.
          </span>
        </label>

        <button
          className="md-button md-button--filled"
          type="submit"
          disabled={submitting || redirecting || !consent}
        >
          {submitting ? 'Wird registriert…' : 'Registrieren'}
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
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 2.58z"/>
          </svg>
          Mit Google registrieren
        </button>

        <p className="md-auth-link">
          Schon ein Konto? <Link to="/login">Anmelden</Link>
        </p>
      </form>
    </div>
  )
}
