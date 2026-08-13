import { useNavigate } from 'react-router-dom'
import { useRun, formatPace } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import { pointsToSvgPath } from '../lib/geo'

export default function RunSummary() {
  const navigate = useNavigate()
  const { liveStats, points, splits, reset } = useRun()

  const handleDone = () => {
    reset()
    navigate('/verlauf', { replace: true })
  }

  const handleHome = () => {
    reset()
    navigate('/', { replace: true })
  }

  const svgData = pointsToSvgPath(points, 320, 140, 20)

  const paceDisplay =
    liveStats.distanceKm > 0
      ? formatPace(liveStats.durationS, liveStats.distanceKm)
      : '--:--'

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      {/* Top bar */}
      <header className="flex items-center h-14 px-4 bg-surface-container">
        <button
          type="button"
          onClick={handleHome}
          className="p-1 text-on-surface"
          aria-label="Zurück"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
        </button>
        <span className="flex-1 text-center text-base font-medium text-on-surface">
          Laufzusammenfassung
        </span>
        <div className="w-6" />
      </header>

      <main className="flex-1 flex flex-col gap-5 px-4 py-4">
        {/* Completion header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-container shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
              <path d="M9 16.17 5.53 12.7l-1.41 1.41L9 19 20.29 7.71l-1.41-1.41z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-medium text-on-surface">Lauf gespeichert</h1>
            <p className="text-sm text-on-surface-variant">App-Modus mit GPS</p>
          </div>
        </div>

        {/* Metric grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-container p-3">
            <p className="text-xs text-on-surface-variant">Strecke</p>
            <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
              {liveStats.distanceKm.toFixed(1).replace('.', ',')}
              <span className="text-sm text-on-surface-variant ml-1">km</span>
            </p>
          </div>
          <div className="rounded-xl bg-surface-container p-3">
            <p className="text-xs text-on-surface-variant">Zeit</p>
            <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
              {formatDurationDisplay(liveStats.durationS)}
              <span className="text-sm text-on-surface-variant ml-1">min</span>
            </p>
          </div>
          <div className="rounded-xl bg-surface-container p-3">
            <p className="text-xs text-on-surface-variant">Ø Tempo</p>
            <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
              {paceDisplay}
              <span className="text-sm text-on-surface-variant ml-1">min/km</span>
            </p>
          </div>
          <div className="rounded-xl bg-surface-container p-3">
            <p className="text-xs text-on-surface-variant">Höhenmeter</p>
            <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
              {Math.round(liveStats.elevationGainM)}
              <span className="text-sm text-on-surface-variant ml-1">m</span>
            </p>
          </div>
        </div>

        {/* Route map */}
        <div className="rounded-xl bg-surface-container-high overflow-hidden">
          <svg viewBox="0 0 320 140" fill="none" className="w-full" role="img" aria-label="Aufgezeichnete Laufroute">
            <line x1="0" y1="30" x2="320" y2="30" stroke="currentColor" strokeOpacity="0.08" />
            <line x1="0" y1="70" x2="320" y2="70" stroke="currentColor" strokeOpacity="0.08" />
            <line x1="0" y1="110" x2="320" y2="110" stroke="currentColor" strokeOpacity="0.08" />
            <line x1="60" y1="0" x2="60" y2="140" stroke="currentColor" strokeOpacity="0.08" />
            <line x1="150" y1="0" x2="150" y2="140" stroke="currentColor" strokeOpacity="0.08" />
            <line x1="240" y1="0" x2="240" y2="140" stroke="currentColor" strokeOpacity="0.08" />
            {svgData ? (
              <>
                <path
                  d={svgData.path}
                  stroke="var(--md-primary, #1B6B4A)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx={svgData.startX} cy={svgData.startY} r="5" fill="var(--md-primary, #1B6B4A)" />
                <circle cx={svgData.endX} cy={svgData.endY} r="5" fill="var(--md-primary, #1B6B4A)" />
              </>
            ) : (
              <text x="160" y="75" textAnchor="middle" fill="currentColor" opacity="0.3" fontSize="12">
                Keine GPS-Daten
              </text>
            )}
          </svg>
        </div>

        {/* Kilometer splits */}
        {splits.length > 0 && (
          <section className="rounded-xl bg-surface-container p-4">
            <h2 className="text-sm font-medium text-on-surface mb-3">Kilometer-Abschnitte</h2>
            <div className="flex flex-col gap-2">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant">
                    km {i + 1}{s.distance_km < 0.95 ? ` (${s.distance_km.toFixed(1).replace('.', ',')} km)` : ''}
                  </span>
                  <span className="text-sm font-medium text-on-surface font-[tabular-nums]">
                    {formatPace(s.duration_s, s.distance_km)} min/km
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto pt-4">
          <button
            type="button"
            onClick={handleDone}
            className="h-12 rounded-full bg-primary text-on-primary font-medium"
          >
            Zum Verlauf
          </button>
          <button
            type="button"
            onClick={handleHome}
            className="h-10 rounded-full text-primary text-sm font-medium"
          >
            Zur Startseite
          </button>
        </div>
      </main>

      {/* Disclaimer */}
      <footer className="px-4 pb-4">
        <p className="text-xs text-on-surface-variant text-center">
          Trainingsempfehlung, keine medizinische Bewertung.
        </p>
      </footer>
    </div>
  )
}
