import { useLocation } from 'react-router-dom'

const TITLES: Record<string, string> = {
  '/': 'MyProSole',
  '/verlauf': 'Verlauf',
  '/training': 'Training',
  '/profil': 'Profil',
  '/chat': 'Coach',
}

export default function TopAppBar() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'MyProSole'

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-surface-container">
      <h1 className="text-lg font-medium text-on-surface">{title}</h1>
    </header>
  )
}
