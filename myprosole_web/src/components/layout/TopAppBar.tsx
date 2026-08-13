import { useLocation, useNavigate } from 'react-router-dom'

const ROOT_TITLES: Record<string, string> = {
  '/': 'MyProSole',
  '/verlauf': 'Verlauf',
  '/training': 'Training',
  '/profil': 'Profil',
  '/chat': 'Coach',
}

const SUB_ROUTES: [RegExp, string][] = [
  [/^\/training\/uebung\//, 'Übung'],
  [/^\/training\/plan\/neu$/, 'Neuer Plan'],
  [/^\/training\/plan\//, 'Trainingsplan'],
  [/^\/training\/tagebuch$/, 'Trainingstagebuch'],
  [/^\/anamnese/, 'Anamnese'],
]

export default function TopAppBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

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

  return (
    <header className="sticky top-0 z-30 flex items-center h-16 px-4 bg-surface-container">
      {!isRootPage && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mr-2 -ml-1 p-1 text-on-surface"
          aria-label="Zurück"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-medium text-on-surface">{title}</h1>
    </header>
  )
}
