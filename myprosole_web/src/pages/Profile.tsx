import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useConsent } from '../store/consent'
import { useAnamnese } from '../store/anamnese'

const LEVEL_LABELS: Record<string, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschritten',
  erfahren: 'Erfahren',
}

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
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light')
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Profile header */}
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container">
            <path d="M12 12c2.7 0 8 1.34 8 4v2H4v-2c0-2.66 5.3-4 8-4zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-medium text-on-surface">
            {profile?.display_name ?? 'Profil'}
          </p>
          <p className="text-sm text-on-surface-variant">
            Konto und Einstellungen
          </p>
        </div>
      </div>

      {/* Profile info */}
      {profile && (
        <section className="flex flex-col gap-2">
          {profile.running_level && (
            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <span className="text-sm text-on-surface-variant">Laufniveau</span>
              <span className="text-sm font-medium text-on-surface">
                {LEVEL_LABELS[profile.running_level] ?? profile.running_level}
              </span>
            </div>
          )}
          {profile.weekly_goal_km != null && (
            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <span className="text-sm text-on-surface-variant">Wochenziel</span>
              <span className="text-sm font-medium text-on-surface">
                {profile.weekly_goal_km} km
              </span>
            </div>
          )}
        </section>
      )}

      {/* Settings */}
      <section>
        <h3 className="text-sm font-medium text-on-surface mb-2">Einstellungen</h3>
        <div className="flex flex-col gap-1">
          <label className="flex items-center justify-between rounded-xl bg-surface-container p-4 cursor-pointer">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant">
                <path d="M12.3 2a9 9 0 1 0 9.7 9.7 7 7 0 0 1-9.7-9.7z" />
              </svg>
              <span className="text-sm text-on-surface">Dunkles Design</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              onClick={toggleDarkMode}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                darkMode ? 'bg-primary' : 'bg-outline-variant'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </label>
        </div>
      </section>

      {/* Block B reminder */}
      {showBlockBReminder && (
        <Link
          to="/anamnese?teil=b"
          className="flex items-center gap-3 rounded-xl bg-primary-container p-4"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container shrink-0">
            <path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 15h-2v-6h2zm0-8h-2V7h2z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-on-primary-container">Anamnese vervollständigen</p>
            <p className="text-xs text-on-primary-container/80">2 kurze Zusatzfragen zu Motivation und Regeneration</p>
          </div>
        </Link>
      )}

      {/* DSGVO Art. 9 Consents */}
      <section>
        <h3 className="text-sm font-medium text-on-surface mb-2">Datenschutz</h3>
        <div className="rounded-xl bg-surface-container p-4">
          <p className="text-sm text-on-surface mb-2">DSGVO Art. 9 Einwilligungen</p>
          {consents.length === 0 ? (
            <p className="text-xs text-on-surface-variant">
              Keine aktiven Einwilligungen zur Verarbeitung von Gesundheitsdaten.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {consents.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">
                    {c.scope === 'anamnese' ? 'Anamnese' : c.scope === 'training_diary' ? 'Trainingstagebuch' : 'Alle Bereiche'}
                  </span>
                  <span className="text-xs text-success">Aktiv</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => signOut()}
        className="flex items-center justify-center gap-2 h-12 rounded-full border border-error text-error font-medium mt-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 7l-1.41 1.41L17.17 10H8v2h9.17l-1.58 1.59L17 15l4-4zM4 5h8V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8v-2H4z" />
        </svg>
        Abmelden
      </button>
    </div>
  )
}
