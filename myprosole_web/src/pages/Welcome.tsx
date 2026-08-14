import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Einstiegsseite (welcome.html). Hero-Video mit Logo, drei Wege ins Konto und
 * der Verweis auf die Anmeldung.
 */
export default function Welcome() {
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
  const showSnackbar = useSnackbar()

  return (
    // .md-hero traegt flex:1 und fuellt damit seinen Elternteil. In den
    // Entwuerfen ist das der Geraeterahmen; hier uebernimmt diese Huelle mit
    // voller Fensterhoehe seine Rolle, sonst bliebe unten ein leerer Streifen.
    <div className="flex flex-col min-h-dvh bg-background">
      <div className="md-hero">
      {/* Liegt unter dem Video und wird nur sichtbar, falls die Datei fehlt. */}
      <div className="md-hero__placeholder"><span /><span /></div>
      {/* poster: Standbild aus demselben Video. Es steht sofort und bleibt
          stehen, wenn ein Telefon das Video nicht von selbst startet – etwa im
          Datensparmodus. */}
      <video
        className="md-hero__video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/assets/welcome-running-poster.jpg"
      >
        <source src="/assets/welcome-running.mp4" type="video/mp4" />
      </video>
      <div className="md-hero__scrim" />

      <div className="md-hero__content">
        <img
          className="md-hero__logo"
          src="/icons/logo-myprosole.png"
          alt="MyProSole"
          width={600}
          height={403}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <p className="md-hero__tagline" style={{ textAlign: 'center', marginBottom: 'var(--space-sm)' }}>
            Deine Lauftechnik, verständlich erklärt.
          </p>

          <button
            type="button"
            className="md-oauth-button"
            onClick={() => signInWithGoogle()}
          >
            <span
              className="md-oauth-button__badge"
              style={{ background: 'var(--md-surface-container-high)', color: '#47453F' }}
            >
              G
            </span>
            Mit Google fortfahren
          </button>

          <button
            type="button"
            className="md-oauth-button"
            onClick={() => showSnackbar('Anmeldung mit Facebook ist noch nicht eingerichtet.')}
          >
            <span
              className="md-oauth-button__badge"
              style={{ background: '#1877F2', color: '#FFFFFF' }}
            >
              f
            </span>
            Mit Facebook fortfahren
          </button>

          <Link className="md-oauth-button md-oauth-button--outline" to="/register">
            <Icon name="mail" size={20} className="icon-sm" />
            Mit E-Mail fortfahren
          </Link>

          <Link
            className="md-auth-link"
            to="/login"
            style={{
              textDecoration: 'none',
              color: 'var(--md-on-primary)',
              opacity: 0.9,
              marginTop: 'var(--space-sm)',
            }}
          >
            Ich habe bereits ein Konto · <span style={{ textDecoration: 'underline' }}>Anmelden</span>
          </Link>
        </div>
        </div>
      </div>
    </div>
  )
}
