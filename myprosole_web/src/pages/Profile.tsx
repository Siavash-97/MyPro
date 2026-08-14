import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useConsent } from '../store/consent'
import { useAnamnese } from '../store/anamnese'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

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

// Zeilen, deren Funktion noch nicht angeschlossen ist, stehen wie im Mockup da
// und sagen beim Antippen, woran es liegt – statt wortlos nichts zu tun.
// Dasselbe Muster wie prototype-placeholder.js in den Mockups.
const NOT_WIRED = 'Diese Funktion ist noch nicht angeschlossen.'

const rowButtonStyle = {
  width: '100%',
  border: 0,
  textAlign: 'left',
  cursor: 'pointer',
} as const

interface SettingsRowProps {
  icon: string
  label: string
  value?: string
  onClick: () => void
}

function SettingsRow({ icon, label, value, onClick }: SettingsRowProps) {
  return (
    <button type="button" className="md-settings-row" onClick={onClick} style={rowButtonStyle}>
      <Icon name={icon} className="icon md-settings-row__icon" />
      <span className="md-settings-row__label">{label}</span>
      {value && <span style={settingsValueStyle}>{value}</span>}
      <Icon name="chevron-right" className="icon md-row__chevron" />
    </button>
  )
}

export default function Profile() {
  const { profile, signOut } = useAuth()
  const { consents, fetchConsents } = useConsent()
  const { fetchSessions, hasCompletedBlock } = useAnamnese()
  const showSnackbar = useSnackbar()
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

  const profileIncomplete = !profile?.running_level || profile?.weekly_goal_km == null

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    const theme = next ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('myprosole_theme', theme)
  }

  const hint = () => showSnackbar(NOT_WIRED)

  return (
    <>
      {profileIncomplete && (
        <section className="md-profile-reminder md-profile-reminder--visible" aria-labelledby="profil-vollstaendigen-title">
          <div className="md-profile-reminder__icon" aria-hidden="true">
            <Icon name="profile" className="icon" />
          </div>
          <div className="md-profile-reminder__content">
            <p className="md-profile-reminder__title" id="profil-vollstaendigen-title">
              Profil vervollständigen
            </p>
            <p className="md-profile-reminder__text">
              Je vollständiger dein Laufprofil, desto genauer passen Tempo, Umfang und Übungen zu dir statt zum Durchschnitt.
            </p>
            <div className="md-profile-reminder__actions">
              <Link
                className="md-button md-button--filled md-button--compact"
                to="/profil/setup"
                style={{ textDecoration: 'none' }}
              >
                Profil jetzt vervollständigen
              </Link>
            </div>
          </div>
        </section>
      )}

      {showBlockBReminder && (
        <section className="md-profile-reminder md-profile-reminder--visible" aria-labelledby="anamnese-nachholen-title">
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
        <button
          type="button"
          className="md-button md-button--tonal"
          onClick={hint}
          style={{ flexShrink: 0 }}
        >
          Upgrade
        </button>
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
        <p className="md-section-title">Zahlungen &amp; Mitgliedschaft</p>
        <div>
          <SettingsRow icon="badge" label="Mitgliedschaft" value="Kostenlos" onClick={hint} />
          <SettingsRow icon="card" label="Zahlungsmethode" value="Keine" onClick={hint} />
          <SettingsRow icon="receipt" label="Rechnungen" onClick={hint} />
        </div>
      </div>

      <div>
        <p className="md-section-title">Gerät</p>
        <div>
          <SettingsRow icon="bluetooth" label="Einlage verbinden" value="Nicht verbunden" onClick={hint} />
          <SettingsRow icon="tune" label="Einlage kalibrieren" onClick={hint} />
          <SettingsRow icon="battery" label="Batterie und Speicher" onClick={hint} />
          <SettingsRow icon="watch" label="Smartwatch verbinden" value="Nicht verbunden" onClick={hint} />
        </div>
      </div>

      <div>
        <p className="md-section-title">Community</p>
        <div>
          {/* Aus, nicht an: Sichtbarkeit fuer ZusammenLauf ist opt-in. Der
              Schalter aendert seinen Zustand bewusst noch nicht – bei einer
              Sichtbarkeitseinstellung waere ein Zustand, der nicht gespeichert
              wird, irrefuehrend. */}
          <button type="button" className="md-settings-row" onClick={hint} style={rowButtonStyle}>
            <Icon name="people" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Sichtbar für ZusammenLauf</span>
            <span className="md-toggle" aria-hidden="true">
              <span className="md-toggle__knob" />
            </span>
          </button>
          <SettingsRow icon="profile" label="Community-Profil" onClick={hint} />
          <SettingsRow icon="people" label="Meine Gruppen" onClick={hint} />
          <SettingsRow icon="shield" label="Blockierte Nutzer:innen" onClick={hint} />
        </div>
      </div>

      <div>
        <p className="md-section-title">Einstellungen</p>
        <div>
          <button type="button" className="md-settings-row" onClick={hint} style={rowButtonStyle}>
            <Icon name="bell" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Benachrichtigungen</span>
            <span className="md-toggle md-toggle--on" aria-hidden="true">
              <span className="md-toggle__knob" />
            </span>
          </button>
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
          <SettingsRow icon="globe" label="Sprache" value="Deutsch" onClick={hint} />
          <SettingsRow icon="shield" label="Datenschutz" onClick={hint} />
        </div>
      </div>

      {/* Nicht im Mockup, bewusst behalten: Diese Uebersicht zeigt die
          tatsaechlich erteilten Art.-9-Einwilligungen. Sie ersatzlos zu
          streichen waere ein Rueckschritt bei der Transparenz ueber
          Gesundheitsdaten. Siehe offene Frage B5. */}
      <div>
        <p className="md-section-title">Deine Einwilligungen</p>
        <div className="md-card">
          <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            DSGVO Art. 9 – Gesundheitsdaten
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
        <Icon name="logout" className="icon" style={{ color: 'var(--md-error)' }} />
        <span className="md-settings-row__label" style={{ textAlign: 'left' }}>Abmelden</span>
      </button>
    </>
  )
}
