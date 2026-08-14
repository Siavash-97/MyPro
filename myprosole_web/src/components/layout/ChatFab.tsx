import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'

export default function ChatFab() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (pathname === '/chat') return null

  return (
    <button
      type="button"
      onClick={() => navigate('/chat')}
      aria-label="Mit MyProSole-Agent über deinen Lauf sprechen"
      className="md-fab fixed z-40"
    >
      <Icon name="chat" />
    </button>
  )
}
