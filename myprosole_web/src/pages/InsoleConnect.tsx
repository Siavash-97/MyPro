import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/** Einlage verbinden (einlage-verbinden.html). */
export default function InsoleConnect() {
  const showSnackbar = useSnackbar()

  return (
    <>
      <section className="md-connect-hero">
        <div className="md-connect-hero__icon">
          <Icon name="bluetooth" className="icon" />
        </div>
        <h1>Bereit zum Verbinden?</h1>
        <p>
          Wenn du bereits MyProSole Einlagen besitzt, kannst du sie hier mit der App koppeln.
        </p>
      </section>

      <section className="md-card" aria-labelledby="connect-preparation-title">
        <h2 className="md-section-title" id="connect-preparation-title">Vorbereitung</h2>
        <ol className="md-step-list">
          <li>
            <span>1</span>
            <p><strong>Einlagen aktivieren</strong><br />Beide Einlagen kurz belasten oder einschalten.</p>
          </li>
          <li>
            <span>2</span>
            <p><strong>In der Nähe bleiben</strong><br />Lege die Einlagen neben dein Smartphone.</p>
          </li>
          <li>
            <span>3</span>
            <p><strong>Bluetooth erlauben</strong><br />Die App fragt erst beim echten Suchvorgang nach Zugriff.</p>
          </li>
        </ol>
      </section>

      <div className="md-info-note">
        <Icon name="shield" size={20} className="icon-sm" />
        <p>
          Die Kopplung mit echten Einlagen ist noch nicht angeschlossen. Sobald sie steht,
          sucht dieser Knopf nach deinen Einlagen in der Nähe.
        </p>
      </div>

      <button
        type="button"
        className="md-button md-button--filled"
        onClick={() => showSnackbar('Die Suche nach Einlagen ist noch nicht angeschlossen.')}
        style={{ width: '100%' }}
      >
        <Icon name="bluetooth" size={20} className="icon-sm" />
        Suche starten
      </button>
      <Link className="md-button md-button--text" to="/einlagen" style={{ textDecoration: 'none' }}>
        Was können die Einlagen?
      </Link>
    </>
  )
}
