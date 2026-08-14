import { useNavigate } from 'react-router-dom'
import { useRun, formatPace } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import { pointsToSvgPath } from '../lib/geo'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

export default function RunSummary() {
  const navigate = useNavigate()
  const { liveStats, points, splits, reset } = useRun()
  const showSnackbar = useSnackbar()

  // "Heute, 07:42 Uhr" – der Lauf endet in dem Moment, in dem diese Seite
  // erscheint, deshalb reicht die aktuelle Uhrzeit.
  const savedAt = `Heute, ${new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })} Uhr`

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
      <header className="md-app-bar">
        <button
          type="button"
          onClick={handleHome}
          className="md-app-bar__icon-btn"
          aria-label="Zurück"
        >
          <Icon name="back" className="icon" />
        </button>
        <span className="md-app-bar__title">Laufzusammenfassung</span>
        <button
          type="button"
          onClick={() => showSnackbar('Teilen kommt mit dem Social-Studio.')}
          className="md-app-bar__icon-btn"
          aria-label="Laufdaten teilen"
        >
          <Icon name="share" className="icon" />
        </button>
      </header>

      <main className="md-page-stack flex-1" style={{ paddingTop: 'var(--space-md)' }}>
        {/* Completion header */}
        <section className="md-run-complete">
          <div className="md-run-complete__icon">
            <Icon name="check" className="icon" />
          </div>
          <div>
            <h1>Lauf gespeichert</h1>
            {/* Wie im Entwurf mit Zeitpunkt: "Heute, 07:42 Uhr · App-Modus mit GPS" */}
            <p>{savedAt} · App-Modus mit GPS</p>
          </div>
        </section>

        {/* Metric grid */}
        <div className="md-metric-grid">
          <div className="md-metric">
            <p className="md-metric__label">Strecke</p>
            <p className="md-metric__value">
              {liveStats.distanceKm.toFixed(1).replace('.', ',')} <span>km</span>
            </p>
          </div>
          <div className="md-metric">
            <p className="md-metric__label">Zeit</p>
            <p className="md-metric__value">
              {formatDurationDisplay(liveStats.durationS)} <span>min</span>
            </p>
          </div>
          <div className="md-metric">
            <p className="md-metric__label">Ø Tempo</p>
            <p className="md-metric__value">
              {paceDisplay} <span>min/km</span>
            </p>
          </div>
          <div className="md-metric">
            <p className="md-metric__label">Höhenmeter</p>
            <p className="md-metric__value">
              {Math.round(liveStats.elevationGainM)} <span>m</span>
            </p>
          </div>
        </div>

        {/* Route map */}
        <div className="md-map">
          <svg viewBox="0 0 320 140" fill="none" role="img" aria-label="Aufgezeichnete Laufroute auf der Karte">
            <line className="md-map__street" x1="0" y1="30" x2="320" y2="30" />
            <line className="md-map__street" x1="0" y1="70" x2="320" y2="70" />
            <line className="md-map__street" x1="0" y1="110" x2="320" y2="110" />
            <line className="md-map__street" x1="60" y1="0" x2="60" y2="140" />
            <line className="md-map__street" x1="150" y1="0" x2="150" y2="140" />
            <line className="md-map__street" x1="240" y1="0" x2="240" y2="140" />
            {svgData ? (
              <>
                <path className="md-map__route" d={svgData.path} />
                <circle className="md-map__start" cx={svgData.startX} cy={svgData.startY} r="6" />
                <circle className="md-map__pos" cx={svgData.endX} cy={svgData.endY} r="7" />
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
          <section className="md-card">
            <h2 className="md-section-title">Kilometer-Abschnitte</h2>
            {splits.map((s, i) => (
              <div key={i} className="md-split-row">
                <span>
                  km {i + 1}{s.distance_km < 0.95 ? ` (${s.distance_km.toFixed(1).replace('.', ',')} km)` : ''}
                </span>
                <strong>{formatPace(s.duration_s, s.distance_km)} min/km</strong>
              </div>
            ))}
          </section>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', marginTop: 'auto', paddingTop: 'var(--space-md)' }}>
          <button
            type="button"
            onClick={handleDone}
            className="md-button md-button--filled"
          >
            Zum Verlauf
          </button>
          <button
            type="button"
            onClick={handleHome}
            className="md-button md-button--text"
          >
            Zur Startseite
          </button>
        </div>
      </main>

      {/* Disclaimer */}
      <footer style={{ padding: '0 var(--space-md) var(--space-md)' }}>
        <p style={{ margin: 0, textAlign: 'center', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Trainingsempfehlung, keine medizinische Bewertung.
        </p>
      </footer>
    </div>
  )
}
