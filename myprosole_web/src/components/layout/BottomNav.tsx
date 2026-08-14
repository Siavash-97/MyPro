import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'

// Reihenfolge und Anzahl wie in den Mockups (home.html, verlauf.html,
// profil.html): fuenf Eintraege, Community an dritter Stelle.
const NAV_ITEMS = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/training', label: 'Training', icon: 'training' },
  { to: '/community', label: 'Community', icon: 'people' },
  { to: '/verlauf', label: 'Verlauf', icon: 'history' },
  { to: '/profil', label: 'Profil', icon: 'profile' },
] as const

export default function BottomNav() {
  return (
    <nav className="md-nav fixed bottom-0 inset-x-0 z-30">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `md-nav__item${isActive ? ' md-nav__item--active' : ''}`
          }
        >
          <span className="md-nav__pill">
            <Icon name={item.icon} />
          </span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
