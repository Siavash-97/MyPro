import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRun } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import { pointsToSvgPath } from '../lib/geo'
import Icon from '../components/ui/Icon'

export default function LiveTracking() {
  const navigate = useNavigate()
  const {
    phase,
    liveStats,
    points,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    abandonRun,
    addPoint,
    tick,
  } = useRun()

  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    if (phase === 'idle') {
      startRun()
    }
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (phase === 'tracking' && watchIdRef.current == null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError(null)
          addPoint(pos)
        },
        (err) => {
          setGpsError(
            err.code === 1
              ? 'GPS-Zugriff verweigert'
              : err.code === 2
                ? 'GPS nicht verfügbar'
                : 'GPS-Zeitüberschreitung',
          )
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
      )
    }

    if (phase === 'tracking' && !timerRef.current) {
      timerRef.current = setInterval(() => tick(), 1000)
    }

    if (phase === 'paused' && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (phase === 'paused' && watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [phase, addPoint, tick])

  const handlePauseResume = () => {
    if (phase === 'tracking') pauseRun()
    else if (phase === 'paused') resumeRun()
  }

  const handleStop = async () => {
    if (!confirmStop) {
      setConfirmStop(true)
      return
    }
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    await stopRun()
    // Wie im Mockup: direkt nach dem Lauf zuerst der Tagebuch-Prompt
    // (mit "Später eintragen"), von dort geht es zur Zusammenfassung.
    navigate('/training/tagebuch?from=tracking', { replace: true })
  }

  const handleAbandon = async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    await abandonRun()
    navigate('/', { replace: true })
  }

  const svgData = pointsToSvgPath(points, 320, 140, 20)

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      {/* Top bar */}
      <header className="md-app-bar">
        <button
          type="button"
          onClick={handleAbandon}
          className="md-app-bar__icon-btn"
          aria-label="Lauf abbrechen"
        >
          <Icon name="back" className="icon" />
        </button>
        <span className="md-app-bar__title">
          {phase === 'paused' ? 'Pausiert' : 'Lauf läuft'}
        </span>
        <div
          className={`md-chip ${gpsError ? 'md-chip--disconnected' : 'md-chip--connected'}`}
          style={{ padding: '4px 10px' }}
        >
          <Icon name="location" size={20} className="icon-sm" />
          GPS
        </div>
      </header>

      <main className="md-page-stack flex-1" style={{ paddingTop: 'var(--space-sm)' }}>
        {/* Timer */}
        <div>
          <p className="md-timer" style={{ margin: 0 }}>
            {formatDurationDisplay(liveStats.durationS)}
          </p>
          <p className="md-timer__label">Laufzeit</p>
        </div>

        {/* Live stats card */}
        <div className="md-card">
          <div className="md-live-stats">
            <div className="md-live-stat">
              <p className="md-live-stat__value">
                {liveStats.distanceKm.toFixed(1).replace('.', ',')}
              </p>
              <p className="md-live-stat__label">km</p>
            </div>
            <div className="md-live-stat">
              <p className="md-live-stat__value">{liveStats.paceDisplay}</p>
              <p className="md-live-stat__label">min/km</p>
            </div>
            <div className="md-live-stat">
              <p className="md-live-stat__value">
                {Math.round(liveStats.elevationGainM)}
              </p>
              <p className="md-live-stat__label">Hm</p>
            </div>
          </div>
        </div>

        {/* Route map */}
        <div className="md-map">
          <svg viewBox="0 0 320 140" fill="none" role="img" aria-label="Live-Route auf der Karte">
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
                <circle className="md-map__pos-ring" cx={svgData.endX} cy={svgData.endY} r="14" />
                <circle className="md-map__pos" cx={svgData.endX} cy={svgData.endY} r="7" />
              </>
            ) : (
              <text x="160" y="75" textAnchor="middle" fill="currentColor" opacity="0.3" fontSize="12">
                Warte auf GPS-Signal…
              </text>
            )}
          </svg>
        </div>

        {/* GPS error */}
        {gpsError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--md-error-container)',
              color: 'var(--md-on-error-container)',
            }}
          >
            <Icon name="warn" size={20} className="icon-sm" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, font: 'var(--type-body-md)' }}>{gpsError}</p>
          </div>
        )}

        {/* Coach banner */}
        <div className="md-coach-banner">
          <div className="md-coach-banner__icon">
            <Icon name="mic" size={20} className="icon-sm" />
          </div>
          <p className="md-coach-banner__text">
            App-Modus aktiv: Route, Zeit und Tempo werden aufgezeichnet.
          </p>
        </div>
      </main>

      {/* Bottom controls */}
      <div className="md-run-controls">
        <button
          type="button"
          onClick={handleStop}
          className="md-run-controls__btn md-run-controls__btn--secondary"
          aria-label="Beenden"
        >
          <Icon name="stop" className="icon" />
        </button>

        <button
          type="button"
          onClick={handlePauseResume}
          disabled={phase === 'saving'}
          className="md-run-controls__btn md-run-controls__btn--primary"
          style={{ opacity: phase === 'saving' ? 0.5 : 1 }}
          aria-label={phase === 'paused' ? 'Fortsetzen' : 'Pausieren'}
        >
          <Icon name={phase === 'paused' ? 'play' : 'pause'} size={32} />
        </button>

        <div style={{ width: 52 }} />
      </div>

      {/* Confirm stop overlay */}
      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/40 p-4 pb-8">
          <div
            className="w-full max-w-sm"
            style={{
              borderRadius: 'var(--radius-lg)',
              background: 'var(--md-surface-container-high)',
              padding: 'var(--space-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-title-md)', color: 'var(--md-on-surface)' }}>
              Lauf beenden?
            </h2>
            <p style={{ margin: '0 0 var(--space-lg)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Dein Lauf wird gespeichert und die Aufzeichnung beendet.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={() => setConfirmStop(false)}
                className="md-button md-button--compact"
                style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
              >
                Weiter laufen
              </button>
              <button
                type="button"
                onClick={handleStop}
                className="md-button md-button--filled md-button--compact"
                style={{ flex: 1 }}
              >
                Beenden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <footer style={{ padding: '0 var(--space-md) var(--space-md)' }}>
        <p style={{ margin: 0, textAlign: 'center', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.
        </p>
      </footer>
    </div>
  )
}
