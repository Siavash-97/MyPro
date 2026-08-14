import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'

/**
 * Der Community-Bereich ist in den Mockups vollstaendig entworfen (Feed,
 * Beitraege, Gruppen, ZusammenLauf), aber noch nicht gebaut. Der Tab steht wie
 * im Entwurf in der unteren Leiste; diese Seite sagt offen, woran es liegt,
 * statt eine leere Flaeche zu zeigen.
 */
export default function Community() {
  return (
    <>
      <div className="md-greeting">
        <p className="md-greeting__title">Community</p>
        <p className="md-greeting__subtitle">
          Läufe teilen, Tipps fragen, ZusammenLauf und Gruppen in deiner Nähe.
        </p>
      </div>

      <section className="md-info-note md-info-note--neutral">
        <Icon name="info" size={20} className="icon icon-sm" />
        <p>
          Dieser Bereich ist entworfen, aber noch nicht gebaut. Sobald er
          fertig ist, findest du ihn genau hier.
        </p>
      </section>

      <div>
        <p className="md-section-title">Was hier entstehen wird</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div className="md-list-item">
            <div className="md-list-item__thumb">
              <Icon name="people" size={20} className="icon-sm" />
            </div>
            <div className="md-list-item__body">
              <p className="md-list-item__title">Feed</p>
              <p className="md-list-item__meta">Läufe teilen und sehen, was andere machen</p>
            </div>
          </div>
          <div className="md-list-item">
            <div className="md-list-item__thumb">
              <Icon name="location" size={20} className="icon-sm" />
            </div>
            <div className="md-list-item__body">
              <p className="md-list-item__title">ZusammenLauf</p>
              <p className="md-list-item__meta">Verabredungen zum gemeinsamen Laufen in deiner Nähe</p>
            </div>
          </div>
          <div className="md-list-item">
            <div className="md-list-item__thumb">
              <Icon name="people" size={20} className="icon-sm" />
            </div>
            <div className="md-list-item__body">
              <p className="md-list-item__title">Gruppen</p>
              <p className="md-list-item__meta">Laufgruppen gründen und beitreten</p>
            </div>
          </div>
        </div>
      </div>

      <Link className="md-button md-button--tonal" to="/" style={{ textDecoration: 'none' }}>
        Zurück zur Startseite
      </Link>
    </>
  )
}
