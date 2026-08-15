import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'

export default function ChatFab() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === '/chat') return null

  // Positioniert wird in .md-fab, nicht hier: components.css laedt nach
  // Tailwind, und bei gleicher Spezifitaet gewinnt die spaetere Regel – eine
  // Klasse wie "fixed" am Knopf bliebe wirkungslos.
  return (
    <button
      type="button"
      onClick={() => navigate('/chat')}
      aria-label="Mit MyProSole-Agent über deinen Lauf sprechen"
      className="md-fab z-40"
    >
      <Icon name="chat" />
    </button>
  )
}
