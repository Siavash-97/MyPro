import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import GoogleMark from '../components/ui/GoogleMark'
import CodeConfirmForm from '../components/auth/CodeConfirmForm'
import { merkeBestaetigungsEmail } from '../lib/pendingSignup'

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
  const [bestaetigung, setBestaetigung] = useState(false)

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
    const { error: err, bestaetigungNoetig, bereitsRegistriert } = await signUp(email, password)
    setSubmitting(false)

    // Supabase meldet eine vergebene Adresse nicht als Fehler, sondern mit
    // einem gefaelschten Erfolg – erkennbar nur an leeren identities. Die
    // Textpruefung unten schlaegt deshalb nie an; sie bleibt nur fuer den
    // Fall stehen, dass Supabase es eines Tages doch als Fehler meldet.
    if (bereitsRegistriert) {
      setError('Diese E-Mail ist bereits registriert. Du wirst zur Anmeldung weitergeleitet…')
      setRedirecting(true)
      // Grund und Adresse mitgeben: Sonst steht man auf der Anmeldeseite
      // und weiss nicht, warum man dort gelandet ist – und tippt die
      // Adresse ein zweites Mal.
      setTimeout(
        () => navigate('/login', { replace: true, state: { hinweis: 'bereits-registriert', email } }),
        2000,
      )
      return
    }

    if (err) {
      if (err.toLowerCase().includes('already registered') || err.toLowerCase().includes('already been registered')) {
        setError('Diese E-Mail ist bereits registriert. Du wirst zur Anmeldung weitergeleitet…')
        setRedirecting(true)
        // Grund und Adresse mitgeben: Sonst steht man auf der Anmeldeseite
      // und weiss nicht, warum man dort gelandet ist – und tippt die
      // Adresse ein zweites Mal.
      setTimeout(
        () => navigate('/login', { replace: true, state: { hinweis: 'bereits-registriert', email } }),
        2000,
      )
        return
      }
      setError('Registrierung fehlgeschlagen: ' + err)
      return
    }

    // Verlangt Supabase eine Bestaetigung per E-Mail, gibt es noch keine
    // Sitzung. Frueher ging es trotzdem weiter auf /profil/setup – der
    // AuthGuard warf sofort zurueck auf die Willkommensseite, und es sah aus,
    // als passiere gar nichts. Jetzt sagt die Seite, was zu tun ist.
    if (bestaetigungNoetig) {
      // Der Link aus der Mail oeffnet einen neuen Tab; dieser Formularzustand
      // ist dort weg. Die Bestaetigungsseite holt die Adresse aus der Notiz.
      merkeBestaetigungsEmail(email)
      setBestaetigung(true)
      return
    }

    // Der eingegebene Name wird beim Profil-Einrichten uebernommen, damit er
    // nicht zweimal getippt werden muss.
    navigate('/profil/setup', { replace: true, state: { name: name.trim() } })
  }

  // Konto angelegt, aber noch nicht bestaetigt: Hier endet der Weg vorerst.
  // Ohne Bestaetigung gibt es keine Sitzung, und jede geschuetzte Seite
  // wuerde zurueckwerfen.
  if (bestaetigung) {
    return (
      <div className="flex flex-col min-h-dvh bg-background text-on-background">
        <div className="md-app-bar">
          <Link to="/willkommen" className="md-app-bar__icon-btn" aria-label="Zurück">
            <Icon name="back" />
          </Link>
        </div>

        <div style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
          <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '0 0 4px' }}>
            Fast geschafft
          </p>
          <p className="md-greeting__subtitle">
            Wir haben einen Code an <strong>{email}</strong> geschickt. Trag ihn
            hier ein – oder klick den Link aus derselben E-Mail an.
          </p>
        </div>

        {/* Die Adresse steht fest: Sie ist gerade eingetippt worden und darf
            hier nicht abweichen, sonst bestaetigt der Code ein anderes Konto. */}
        <CodeConfirmForm
          email={email}
          onConfirmed={() =>
            navigate('/profil/setup', { replace: true, state: { name: name.trim() } })
          }
        />
      </div>
    )
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
            Ich akzeptiere die <Link to="/agb">Nutzungsbedingungen</Link> und die{' '}
            <Link to="/datenschutz">Datenschutzerklärung</Link>.
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
          <GoogleMark />
          Mit Google registrieren
        </button>

        <p className="md-auth-link">
          Schon ein Konto? <Link to="/login">Anmelden</Link>
        </p>
      </form>
    </div>
  )
}
