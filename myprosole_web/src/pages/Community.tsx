import Icon from '../components/ui/Icon'
import CommunityTabs from '../components/community/CommunityTabs'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'

/**
 * Community-Feed (community.html).
 *
 * Beitraege, Antworten und Likes brauchen eigene Tabellen, die es noch nicht
 * gibt. Statt erfundener Beitraege zeigt die Seite ihren Leerzustand – der
 * Aufbau bleibt derselbe wie im Entwurf.
 */
export default function Community() {
  const showSnackbar = useSnackbar()
  const profile = useAuth((s) => s.profile)
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase() ?? ''

  return (
    <>
      <CommunityTabs />

      <button
        type="button"
        className="md-card md-row"
        onClick={() => showSnackbar('Beiträge schreiben kommt mit der Community.')}
        style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
      >
        <div className="md-row" style={{ gap: 'var(--space-sm)', justifyContent: 'flex-start' }}>
          <div className="md-avatar md-avatar--sm" aria-hidden="true">
            {initial || <Icon name="profile" size={20} className="icon-sm" />}
          </div>
          <span style={{ font: 'var(--type-body-lg)', color: 'var(--md-on-surface-variant)' }}>
            Frage stellen oder Lauf teilen…
          </span>
        </div>
        <Icon name="photo" size={20} className="icon-sm" style={{ color: 'var(--md-on-surface-variant)' }} />
      </button>

      <section className="md-card" style={{ textAlign: 'center' }}>
        <div className="md-feature-heading__icon" style={{ margin: '0 auto var(--space-md)' }} aria-hidden="true">
          <Icon name="people" className="icon" />
        </div>
        <p className="md-section-title" style={{ marginBottom: 4 }}>Noch keine Beiträge</p>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Sobald die Community offen ist, stehen hier geteilte Läufe und Fragen aus deiner
          Umgebung.
        </p>
      </section>
    </>
  )
}
