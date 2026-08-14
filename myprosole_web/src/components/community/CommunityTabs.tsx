import { Link, useLocation } from 'react-router-dom'

/**
 * Segmentierte Umschaltung zwischen Feed, ZusammenLauf und Gruppen
 * (community.html). Drei echte Seiten statt eines Scripts – derselbe Ansatz
 * wie in den Entwuerfen.
 */
const TABS = [
  { to: '/community', label: 'Feed' },
  { to: '/community/zusammenlauf', label: 'ZusammenLauf' },
  { to: '/community/gruppen', label: 'Gruppen' },
] as const

export default function CommunityTabs() {
  const { pathname } = useLocation()

  return (
    <div className="md-segmented">
      {TABS.map((tab) =>
        tab.to === pathname ? (
          <span key={tab.to} className="md-segmented__item md-segmented__item--active">
            {tab.label}
          </span>
        ) : (
          <Link key={tab.to} className="md-segmented__item" to={tab.to} style={{ textDecoration: 'none' }}>
            {tab.label}
          </Link>
        ),
      )}
    </div>
  )
}
