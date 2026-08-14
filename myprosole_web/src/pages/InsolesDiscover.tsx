import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'

/** Einlagen kennenlernen (einlagen-entdecken.html). */
export default function InsolesDiscover() {
  return (
    <>
      <section className="md-product-hero">
        <div className="md-product-hero__visual" aria-hidden="true">
          <svg viewBox="0 0 180 120">
            <path d="M72 10c18-2 32 18 34 38 3 25-4 53-20 62-13 8-36 3-40-13-5-20 12-29 12-47 0-16-2-37 14-40z" />
            <circle cx="76" cy="35" r="7" />
            <circle cx="70" cy="60" r="7" />
            <circle cx="72" cy="86" r="7" />
          </svg>
        </div>
        <p className="md-onboarding-step">Optionales Zubehör</p>
        <h1>Mehr verstehen, wenn du mehr wissen möchtest</h1>
        <p>
          MyProSole funktioniert vollständig als Lauf-App. Die Sensoreinlagen ergänzen deine
          GPS-Daten um Informationen direkt unter deinen Füßen.
        </p>
      </section>

      <div className="md-info-note">
        <Icon name="check" size={20} className="icon-sm" />
        <p>Du brauchst keine Einlagen, um Läufe aufzuzeichnen und die App zu verwenden.</p>
      </div>

      <section className="md-card">
        <div className="md-feature-heading">
          <div className="md-feature-heading__icon">
            <Icon name="phone" className="icon" />
          </div>
          <div>
            <p className="md-section-title">Nur mit der App</p>
            <p>GPS-basierte Laufdaten</p>
          </div>
        </div>
        <ul className="md-benefit-list">
          <li>Zeit, Strecke und Tempo</li>
          <li>Route und Wochenfortschritt</li>
          <li>Laufverlauf und persönliche Ziele</li>
        </ul>
      </section>

      <section className="md-card md-card--outlined">
        <div className="md-feature-heading">
          <div className="md-feature-heading__icon">
            <Icon name="sensors" className="icon" />
          </div>
          <div>
            <p className="md-section-title">Zusätzlich mit Einlagen</p>
            <p>Sensorbasierte Laufdetails</p>
          </div>
        </div>
        <ul className="md-benefit-list">
          <li>Druckverteilung während des Laufens</li>
          <li>Aufsatzmuster und Links-rechts-Vergleich</li>
          <li>Detailliertere Technikhinweise auf Basis der Messwerte</li>
        </ul>
      </section>

      <div className="md-info-note md-info-note--neutral">
        <p>
          Die Auswertungen unterstützen das Training und ersetzen keine medizinische Diagnose.
          Kauf und Bezahlung werden in einem späteren Ausbauschritt ergänzt.
        </p>
      </div>

      <Link className="md-button md-button--filled" to="/einlage/verbinden" style={{ textDecoration: 'none' }}>
        Ich habe bereits Einlagen
      </Link>
      <Link className="md-button md-button--text" to="/" style={{ textDecoration: 'none' }}>
        Weiter ohne Einlagen
      </Link>
    </>
  )
}
