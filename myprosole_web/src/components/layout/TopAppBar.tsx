import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import Benachrichtigungen from './Benachrichtigungen'
import DesignSchalter from './DesignSchalter'
import ChatGlocke from './ChatGlocke'
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
  [/^\/training\/uebung\//, 'Übung'],
  [/^\/training\/laufplan$/, 'Lauftraining'],
  [/^\/training\/tagebuch$/, 'Trainingstagebuch'],
  [/^\/anamnese/, 'Anamnese'],
  [/^\/puls-verbinden$/, 'Gerät verbinden'],
  [/^\/community\/chats$/, 'Anfragen & Chats'],
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
// Filter auf verlauf.html. Die Glocke steht nicht in dieser Tabelle – sie hat
// einen eigenen Zustand (Punkt bei offenen Hinweisen, aufklappbare Liste) und
// sitzt deshalb in einer eigenen Komponente.
const ROOT_ACTIONS: Record<string, { icon: string; label: string; hint?: string; to?: string }> = {
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
  const glocke = pathname === '/'
  // Auf allen Community-Seiten, nicht nur auf der Startseite der Community:
  // Eine Anfrage soll auffallen, egal wo man sich gerade umsieht.
  const chatGlocke = pathname.startsWith('/community') && pathname !== '/community/chats'

  return (
    // Die Leiste ist schon sticky (Klasse oben) und damit Bezugspunkt fuer
    // die aufgeklappte Hinweisliste – die richtet sich daran aus und nicht
    // am Seitenanfang. Deshalb hier keine zusaetzliche Positionsangabe.
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
      {glocke && <DesignSchalter />}
      {glocke && <Benachrichtigungen />}
      {chatGlocke && <ChatGlocke />}
    </header>
  )
}
