import { NavLink } from 'react-router-dom'
import Icon from '../ui/Icon'

const NAV_ITEMS = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/verlauf', label: 'Verlauf', icon: 'history' },
  { to: '/training', label: 'Training', icon: 'training' },
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
