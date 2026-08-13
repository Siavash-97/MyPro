import { NavLink } from 'react-router-dom'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const ICON_SIZE = 24

const HomeIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12L12 3l9 9" />
    <path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
  </svg>
)

const HistoryIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const TrainingIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6.5 6.5a2 2 0 013 0l.5.5.5-.5a2 2 0 013 0" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M5 12v-2a2 2 0 014 0v4a2 2 0 004 0v-4a2 2 0 014 0v2" />
  </svg>
)

const ProfileIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 00-16 0" />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Start', icon: <HomeIcon /> },
  { to: '/verlauf', label: 'Verlauf', icon: <HistoryIcon /> },
  { to: '/training', label: 'Training', icon: <TrainingIcon /> },
  { to: '/profil', label: 'Profil', icon: <ProfileIcon /> },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around h-20 bg-surface-container border-t border-outline-variant safe-bottom">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 min-w-[64px] py-1 ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`flex items-center justify-center w-16 h-8 rounded-full transition-colors ${
                isActive ? 'bg-primary-container' : ''
              }`}>
                {item.icon}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
