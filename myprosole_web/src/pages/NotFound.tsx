import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
      <p className="text-6xl font-medium text-on-surface-variant">404</p>
      <p className="text-base text-on-surface-variant mt-2 mb-6">
        Seite nicht gefunden
      </p>
      <Link
        to="/"
        className="h-10 px-6 inline-flex items-center rounded-full bg-primary text-on-primary text-sm font-medium"
      >
        Zur Startseite
      </Link>
    </div>
  )
}
