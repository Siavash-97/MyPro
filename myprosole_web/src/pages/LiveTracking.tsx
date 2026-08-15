import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRun } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import RouteMap from '../components/map/RouteMap'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

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
    addPoint,
    tick,
  } = useRun()

  const showSnackbar = useSnackbar()
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    // Nur den oertlichen Zustand setzen – in der Datenbank landet der Lauf
    // erst beim Beenden.
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

  // Verlaesst jemand die App, wird der Lauf beendet und gespeichert. Der
  // Browser haelt die Aufzeichnung im Hintergrund ohnehin an – ein Lauf, der
  // scheinbar weiterlaeuft, waere eine Luege. Hintergrund-Aufzeichnung kommt
  // mit der nativen App.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      const { phase: current } = useRun.getState()
      if (current === 'tracking' || current === 'paused') finishRun()
    }

    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  })

  const handlePauseResume = () => {
    if (phase === 'tracking') pauseRun()
    else if (phase === 'paused') resumeRun()
  }

  // Der Stop-Knopf fragt vorher nach; aus dem Hintergrund-Dialog heraus ist
  // die Entscheidung schon getroffen und finishRun wird direkt aufgerufen.
  const handleStop = () => {
    if (!confirmStop) {
      setConfirmStop(true)
      return
    }
    finishRun()
  }

  const finishRun = async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const { runId, error } = await stopRun()

    if (error) {
      showSnackbar(error)
      return
    }

    // Zu kurz: Es wurde nichts gespeichert, und das sagt die App auch, statt
    // einen Lauf ueber 0,0 km in den Verlauf zu stellen.
    if (!runId) {
      showSnackbar('Zu kurz zum Aufzeichnen – es wurde nichts gespeichert.')
      navigate('/', { replace: true })
      return
    }

    // Wie im Mockup: direkt nach dem Lauf zuerst der Tagebuch-Prompt
    // (mit "Später eintragen"), von dort geht es zur Zusammenfassung.
    navigate('/training/tagebuch?from=tracking', { replace: true })
  }

  // Minimieren, nicht abbrechen: Der Lauf zeichnet weiter auf, man geht nur
  // zurueck zur Startseite. Zum Beenden gibt es den Stop-Knopf mit Rueckfrage.
  // Ein versehentlicher Tap kostet so keinen Lauf.
  const handleMinimize = () => {
    navigate('/')
  }


  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      {/* Top bar */}
      <header className="md-app-bar">
        <button
          type="button"
          onClick={handleMinimize}
          className="md-app-bar__icon-btn"
          aria-label="Minimieren"
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
            {/* Herzfrequenz wie im Entwurf: Die Kachel steht immer da und
                zeigt "--", solange kein Geraet verbunden ist. */}
            <div className="md-live-stat">
              <p className="md-live-stat__value md-live-stat__value--no-data">--</p>
              <p className="md-live-stat__label">bpm</p>
            </div>
          </div>
        </div>

        {/* Route map */}
        <RouteMap
          points={points}
          height={140}
          live
          label="Live-Route auf der Karte"
          leerText="Warte auf GPS-Signal…"
        />

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
            Einlagen kannst du jederzeit ergänzen.
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

        <button
          type="button"
          className="md-run-controls__btn md-run-controls__btn--tertiary"
          onClick={() => showSnackbar('Smartwatch verbinden kommt noch.')}
          aria-label="Smartwatch verbinden"
        >
          <Icon name="bluetooth" size={20} className="icon-sm" />
        </button>
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
                onClick={() => { setConfirmStop(false); finishRun() }}
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
          Wenn du die App verlässt, wird der Lauf beendet und gespeichert.
          <br />
          Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.
        </p>
      </footer>
    </div>
  )
}
