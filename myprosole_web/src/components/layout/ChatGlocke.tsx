import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useChats } from '../../store/chats'
import { hatNeues } from '../../lib/chatGelesen'
import Icon from '../ui/Icon'

/**
 * Anfragen und Chats, erreichbar von jeder Community-Seite.
 *
 * Lag vorher im Profil – dort sucht es niemand, denn ein Chat entsteht aus
 * einer Verabredung und die lebt in der Community.
 *
 * Der Punkt erscheint, wenn eine Anfrage offen ist oder seit dem letzten
 * Oeffnen eines Chats etwas Neues kam. Kein Zaehler: Gezaehlt wird nach dem
 * letzten Oeffnen, nicht nach dem letzten Lesen – eine Zahl waere eine
 * Genauigkeit, die wir nicht haben.
 */
export default function ChatGlocke() {
  const { chats, offeneAnfragen, letzteNachricht, fetchChats, fetchUebersicht } = useChats()
  const { pathname } = useLocation()

  // Beim Wechsel zwischen den Community-Seiten neu nachsehen: So aendert
  // sich der Punkt, ohne dass die App neu geladen werden muss.
  useEffect(() => {
    fetchChats()
    fetchUebersicht()
  }, [pathname, fetchChats, fetchUebersicht])

  const offen =
    offeneAnfragen.length > 0
    || chats.some((c) => hatNeues(c.id, letzteNachricht[c.id]))

  return (
    <Link
      to="/community/chats"
      className="md-app-bar__icon-btn"
      aria-label={offen ? 'Anfragen und Chats, Neues vorhanden' : 'Anfragen und Chats'}
      style={{ position: 'relative' }}
    >
      <Icon name="chat" />
      {offen && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', top: 6, right: 6,
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--md-error)',
            border: '2px solid var(--md-surface)',
          }}
        />
      )}
    </Link>
  )
}
