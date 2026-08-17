import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import CodeConfirmForm from '../components/auth/CodeConfirmForm'
import { holeBestaetigungsEmail, vergissBestaetigungsEmail } from '../lib/pendingSignup'

/** So lange bleibt die Erfolgsmeldung stehen, bevor es weitergeht. */
const WEITERLEITUNG_MS = 1200

/**
 * Was der Link aus der E-Mail mitgebracht hat – aber nur der Fehlerfall.
 *
 * Supabase haengt das Ergebnis als Fragment an die Adresse. Im Erfolgsfall
 * sind das die Sitzungstoken; die liest der Supabase-Client beim Start selbst
 * aus und raeumt das Fragment danach auf. Uebrig bleibt hier also nur, was
 * schiefging.
 *
 * Die mitgelieferte `error_description` wird bewusst nicht angezeigt: Sie
 * kommt aus der Adresszeile, ist damit von aussen setzbar, und ihr englischer
 * Wortlaut hilft ohnehin niemandem weiter.
 */
function linkFehlerAusUrl(): string | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null

  const params = new URLSearchParams(hash)
  if (!params.get('error') && !params.get('error_code')) return null

  return params.get('error_code') === 'otp_expired'
    ? 'Der Link ist abgelaufen. Trag den Code aus der E-Mail ein oder lass dir einen neuen schicken.'
    : 'Der Link hat nicht funktioniert. Trag stattdessen den Code aus der E-Mail ein.'
}

/**
 * E-Mail-Bestaetigung.
 *
 * Zwei Wege fuehren hierher:
 *
 * 1. Der Link aus der Mail. Supabase leitet mit den Sitzungstoken im Fragment
 *    auf diese Route; der Supabase-Client hat sie beim Start der App schon
 *    eingeloest, hier steht dann nur noch das Ergebnis.
 * 2. Der sechsstellige Code, falls der Link nicht ging oder der Tab mit der
 *    Registrierung nicht mehr offen ist.
 *
 * Danach geht es in die App und nicht auf eine Entwurfsseite: `/profil/setup`
 * legt das Profil an und schickt weiter zur Startseite, falls schon eines da
 * ist.
 */
export default function ConfirmEmail() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const loading = useAuth((s) => s.loading)

  const [email, setEmail] = useState(holeBestaetigungsEmail)
  const [ueberCode, setUeberCode] = useState(false)
  // Einmal beim Aufbau lesen: Der Supabase-Client raeumt das Fragment weg,
  // sobald er es eingeloest hat.
  const [linkFehler] = useState(linkFehlerAusUrl)

  // Steht eine Sitzung, ist die Adresse bestaetigt – egal ob ueber Link oder
  // Code. Solange der Client noch laedt, ist das unentschieden.
  const bestaetigt = ueberCode || (!loading && user != null)

  useEffect(() => {
    if (!bestaetigt) return
    vergissBestaetigungsEmail()
    const timer = setTimeout(() => navigate('/profil/setup', { replace: true }), WEITERLEITUNG_MS)
    return () => clearTimeout(timer)
  }, [bestaetigt, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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

      {bestaetigt ? (
        <div className="md-auth-form" style={{ alignItems: 'center' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container">
            <Icon name="check" size={28} className="text-on-success-container" />
          </div>
          <p
            style={{ font: 'var(--type-title-lg)', color: 'var(--md-on-surface)', margin: 0, textAlign: 'center' }}
            role="status"
          >
            E-Mail bestätigt
          </p>
          <p
            style={{ font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)', margin: 0, textAlign: 'center' }}
          >
            Dein Konto ist freigeschaltet. Es geht gleich weiter…
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: '0 var(--space-lg) var(--space-md)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container">
              <Icon name="mail" size={28} className="text-on-primary-container" />
            </div>
            <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '16px 0 4px' }}>
              E-Mail bestätigen
            </p>
            <p className="md-greeting__subtitle">
              Trag den sechsstelligen Code aus der E-Mail ein. Damit ist dein
              Konto freigeschaltet und du bist angemeldet.
            </p>
          </div>

          {linkFehler && (
            <div
              className="px-4 py-3 rounded-md bg-error-container text-on-error-container"
              style={{ font: 'var(--type-body-md)', margin: '0 var(--space-lg) var(--space-md)' }}
              role="alert"
            >
              {linkFehler}
            </div>
          )}

          <CodeConfirmForm
            email={email}
            onEmailChange={setEmail}
            onConfirmed={() => setUeberCode(true)}
          />
        </>
      )}
    </div>
  )
}
