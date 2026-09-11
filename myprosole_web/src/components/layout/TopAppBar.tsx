import { Link, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import Benachrichtigungen from './Benachrichtigungen'
import DesignSchalter from './DesignSchalter'
import ChatGlocke from './ChatGlocke'
import { useSnackbar } from '../ui/Snackbar'
import { ROOT_TITLES, SUB_ROUTES, ROOT_ACTIONS } from './Seitenkopf'

/**
 * AppShell.tsx rendert seit Paket 00 Stufe 2 den Kopf direkt (Seitenkopf.tsx,
 * dunkle Flaeche statt dieser hellen Leiste) - diese Komponente hat deshalb
 * keinen Aufrufer mehr in der Huelle. Bleibt bestehen, weil so angewiesen
 * (AGENT-PROMPT.md „TopAppBar nicht loeschen"), nicht weil sie noch
 * gebraucht wuerde. ROOT_TITLES/SUB_ROUTES/ROOT_ACTIONS standen hier frueher
 * als eigene Kopie derselben Tabellen - jetzt EIN Weg: Seitenkopf.tsx ist
 * die Quelle, hier nur noch importiert.
 */
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
