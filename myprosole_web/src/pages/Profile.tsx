import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useConsent } from '../store/consent'
import { useAnamnese } from '../store/anamnese'
import Icon from '../components/ui/Icon'

const LEVEL_LABELS: Record<string, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschritten',
  erfahren: 'Erfahren',
}

const CONSENT_SCOPE_LABELS: Record<string, string> = {
  anamnese: 'Anamnese',
  training_diary: 'Trainingstagebuch',
}

const settingsValueStyle = {
  color: 'var(--md-on-surface-variant)',
  font: 'var(--type-body-md)',
} as const

export default function Profile() {
  const { profile, signOut } = useAuth()
  const { consents, fetchConsents } = useConsent()
  const { fetchSessions, hasCompletedBlock } = useAnamnese()
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  )

  useEffect(() => {
    fetchConsents()
    fetchSessions()
  }, [fetchConsents, fetchSessions])

  const showBlockBReminder =
    localStorage.getItem('myprosole_blockb_reminder') === 'true' &&
    hasCompletedBlock('a') &&
    !hasCompletedBlock('b')

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    const theme = next ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('myprosole_theme', theme)
  }

  return (
    <>
      {showBlockBReminder && (
        <section
          className="md-profile-reminder md-profile-reminder--visible"
          aria-labelledby="anamnese-nachholen-title"
        >
          <div className="md-profile-reminder__icon" aria-hidden="true">
            <Icon name="profile" className="icon" />
          </div>
          <div className="md-profile-reminder__content">
            <p className="md-profile-reminder__title" id="anamnese-nachholen-title">
              2 offene Fragen zu Motivation und Regeneration
            </p>
            <p className="md-profile-reminder__text">
              Du wolltest später erinnert werden – die beiden freiwilligen Fragen dauern etwa 30 Sekunden.
            </p>
            <div className="md-profile-reminder__actions">
              <Link
                className="md-button md-button--filled md-button--compact"
                to="/anamnese?teil=b"
                style={{ textDecoration: 'none' }}
              >
                Jetzt beantworten
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="md-profile-header">
        <div className="md-avatar" aria-hidden="true">
          <Icon name="profile" className="icon" />
        </div>
        <div>
          <p className="md-profile-header__name">
            {profile?.display_name ?? 'Dein Profil'}
          </p>
          <p className="md-profile-header__meta">Konto und persönliche Einstellungen</p>
        </div>
      </div>

      <div className="md-plan-card">
        <div>
          <p className="md-plan-card__title">Kostenlose Version</p>
          <p className="md-plan-card__desc">Premium schaltet erweiterte Auswertungen frei</p>
        </div>
      </div>

      {profile && (profile.running_level || profile.weekly_goal_km != null) && (
        <div>
          <p className="md-section-title">Laufprofil</p>
          <div>
            {profile.running_level && (
              <div className="md-settings-row">
                <Icon name="training" className="icon md-settings-row__icon" />
                <span className="md-settings-row__label">Laufniveau</span>
                <span style={settingsValueStyle}>
                  {LEVEL_LABELS[profile.running_level] ?? profile.running_level}
                </span>
              </div>
            )}
            {profile.weekly_goal_km != null && (
              <div className="md-settings-row">
                <Icon name="tune" className="icon md-settings-row__icon" />
                <span className="md-settings-row__label">Wochenziel</span>
                <span style={settingsValueStyle}>{profile.weekly_goal_km} km</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="md-section-title">Einstellungen</p>
        <div>
          <label className="md-settings-row" htmlFor="dunkles-design">
            <Icon name="moon" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Dunkles Design</span>
            <input
              className="md-switch"
              id="dunkles-design"
              type="checkbox"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
            <span className="md-toggle" aria-hidden="true">
              <span className="md-toggle__knob" />
            </span>
          </label>
        </div>
      </div>

      <div>
        <p className="md-section-title">Datenschutz</p>
        <div className="md-card">
          <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            DSGVO Art. 9 Einwilligungen
          </p>
          {consents.length === 0 ? (
            <p style={{ margin: 0, ...settingsValueStyle }}>
              Keine aktiven Einwilligungen zur Verarbeitung von Gesundheitsdaten.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {consents.map((c) => (
                <div key={c.id} className="md-row" style={{ cursor: 'default' }}>
                  <span style={settingsValueStyle}>
                    {CONSENT_SCOPE_LABELS[c.scope] ?? 'Alle Bereiche'}
                  </span>
                  <span style={{ font: 'var(--type-body-md)', color: 'var(--md-success)' }}>
                    Aktiv
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => signOut()}
        className="md-settings-row"
        style={{
          color: 'var(--md-error)',
          borderRadius: 'var(--radius-md)',
          border: 0,
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <Icon name="logout" className="icon" />
        <span className="md-settings-row__label" style={{ textAlign: 'left' }}>Abmelden</span>
      </button>
    </>
  )
}
