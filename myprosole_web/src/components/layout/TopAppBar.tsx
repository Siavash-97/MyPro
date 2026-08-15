import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import { useSnackbar } from '../ui/Snackbar'

const ROOT_TITLES: Record<string, string> = {
  '/': 'MyProSole',
  '/verlauf': 'Verlauf',
  '/training': 'Übungen',
  '/community': 'Community',
  '/profil': 'Profil',
  '/chat': 'MyProSole-Agent',
}

const SUB_ROUTES: [RegExp, string][] = [
  [/^\/training\/gym$/, 'Gym-Trainingsplan'],
  [/^\/training\/uebung\//, 'Übung'],
  [/^\/training\/plan\/neu$/, 'Neuer Plan'],
  [/^\/training\/plan\//, 'Trainingsplan'],
  [/^\/training\/laufplan$/, 'Lauftraining'],
  [/^\/training\/tagebuch$/, 'Trainingstagebuch'],
  [/^\/anamnese/, 'Anamnese'],
  [/^\/community\/profil/, 'Community-Profil'],
  [/^\/community\/gruppe\/neu$/, 'Gruppe gründen'],
  [/^\/community\/gruppe\/beitreten\//, 'Einladung'],
  [/^\/community\/gruppe\//, 'Gruppe'],
  [/^\/community\//, 'Community'],
  [/^\/zyklus$/, 'Zykluskalender'],
  [/^\/social-studio$/, 'Social-Studio'],
  [/^\/einlagen$/, 'Einlagen kennenlernen'],
  [/^\/einlage\/verbinden$/, 'Einlage verbinden'],
  [/^\/lauf\/tracking$/, 'Live-Tracking'],
  [/^\/lauf\/zusammenfassung$/, 'Laufzusammenfassung'],
  [/^\/lauf\/[^/]+\/analyse$/, 'Laufanalyse'],
  [/^\/lauf\//, 'Laufdetails'],
]

// Aktionen rechts in der Leiste, wie in den Mockups: Glocke auf home.html,
// Filter auf verlauf.html. Beide Funktionen sind noch nicht angeschlossen und
// sagen das beim Antippen, statt wortlos nichts zu tun.
const ROOT_ACTIONS: Record<string, { icon: string; label: string; hint?: string; to?: string }> = {
  // Wie im Entwurf (uebungen.html): Der Gym-Trainingsplan liegt hinter einem
  // eigenen Knopf oben rechts, nicht mitten auf der Uebungsseite.
  '/training': {
    icon: 'lifter',
    label: 'Gym-Trainingsplan',
    to: '/training/gym',
  },
  '/': {
    icon: 'bell',
    label: 'Benachrichtigungen',
    hint: 'Benachrichtigungen sind noch nicht eingerichtet.',
  },
  '/verlauf': {
    icon: 'filter',
    label: 'Filtern',
    hint: 'Weitere Filter kommen noch – nutze so lange die Zeitraum-Auswahl.',
  },
}

export default function TopAppBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const showHint = useSnackbar()

  const rootTitle = ROOT_TITLES[pathname]
  const isRootPage = rootTitle !== undefined

  let title = rootTitle ?? 'MyProSole'
  if (!isRootPage) {
    for (const [pattern, label] of SUB_ROUTES) {
      if (pattern.test(pathname)) {
        title = label
        break
      }
    }
  }

  const action = ROOT_ACTIONS[pathname]

  return (
    <header className="md-app-bar sticky top-0 z-30">
      {!isRootPage && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="md-app-bar__icon-btn"
          aria-label="Zurück"
        >
          <Icon name="back" />
        </button>
      )}
      <h1 className="md-app-bar__title">{title}</h1>
      {action?.to ? (
        <Link
          to={action.to}
          className="md-app-bar__icon-btn md-app-bar__icon-btn--tonal"
          aria-label={action.label}
        >
          <Icon name={action.icon} />
        </Link>
      ) : action ? (
        <button
          type="button"
          onClick={() => showHint(action.hint ?? '')}
          className="md-app-bar__icon-btn"
          aria-label={action.label}
        >
          <Icon name={action.icon} />
        </button>
      ) : null}
    </header>
  )
}
