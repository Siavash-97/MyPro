import Icon from '../components/ui/Icon'
import CommunityTabs from '../components/community/CommunityTabs'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * ZusammenLauf (community-zusammenlauf.html): Verabredungen zum gemeinsamen
 * Laufen in der Naehe. Sichtbarkeit ist opt-in und steht im Profil.
 */
export default function CommunityMeetups() {
  const showSnackbar = useSnackbar()

  return (
    <>
      <CommunityTabs />

      <div className="md-row" style={{ cursor: 'default' }}>
        <p className="md-section-title" style={{ margin: 0 }}>In deiner Nähe</p>
        <button
          type="button"
          onClick={() => showSnackbar('Der Umkreis lässt sich einstellen, sobald die Community offen ist.')}
          className="md-button md-button--text md-button--compact"
        >
          <Icon name="tune" size={20} className="icon-sm" />
          Filter
        </button>
      </div>

      <section className="md-card" style={{ textAlign: 'center' }}>
        <div className="md-feature-heading__icon" style={{ margin: '0 auto var(--space-md)' }} aria-hidden="true">
          <Icon name="location" className="icon" />
        </div>
        <p className="md-section-title" style={{ marginBottom: 4 }}>Noch keine Verabredungen</p>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Hier stehen später Läufe, zu denen du dich verabreden kannst – mit Treffpunkt,
          Uhrzeit und Tempo.
        </p>
      </section>

      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          Du bist für ZusammenLauf nur sichtbar, wenn du es im Profil einschaltest. Ohne
          diese Zustimmung sieht niemand mehr von dir als im Feed.
        </p>
      </div>

      <button
        type="button"
        className="md-button md-button--filled"
        onClick={() => showSnackbar('Verabredungen erstellen kommt mit der Community.')}
      >
        Lauf vorschlagen
      </button>
    </>
  )
}
