import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'

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
  [/^\/lauf\/tracking$/, 'Live-Tracking'],
  [/^\/lauf\/zusammenfassung$/, 'Laufzusammenfassung'],
  [/^\/lauf\//, 'Laufdetails'],
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
      <h1 style={{ font: 'var(--type-title-lg)', margin: 0 }}>{title}</h1>
    </header>
  )
}
