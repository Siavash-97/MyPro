import { useAuth } from '../store/auth'

const LEVEL_LABELS: Record<string, string> = {
  anfaenger: 'Anfänger',
  fortgeschritten: 'Fortgeschritten',
  erfahren: 'Erfahren',
}

export default function Profile() {
  const { profile, signOut } = useAuth()

  return (
    <div className="px-4 py-6">
      <h2 className="text-2xl font-medium text-on-surface mb-4">Profil</h2>

      {profile && (
        <div className="flex flex-col gap-3">
          <div className="p-4 rounded-lg bg-surface-container">
            <p className="text-sm text-on-surface-variant">Anzeigename</p>
            <p className="text-on-surface font-medium">{profile.display_name}</p>
          </div>

          {profile.running_level && (
            <div className="p-4 rounded-lg bg-surface-container">
              <p className="text-sm text-on-surface-variant">Laufniveau</p>
              <p className="text-on-surface font-medium">
                {LEVEL_LABELS[profile.running_level] ?? profile.running_level}
              </p>
            </div>
          )}

          {profile.weekly_goal_km != null && (
            <div className="p-4 rounded-lg bg-surface-container">
              <p className="text-sm text-on-surface-variant">Wochenziel</p>
              <p className="text-on-surface font-medium">
                {profile.weekly_goal_km} km
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => signOut()}
            className="h-12 rounded-full border border-outline text-on-surface font-medium mt-4"
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
