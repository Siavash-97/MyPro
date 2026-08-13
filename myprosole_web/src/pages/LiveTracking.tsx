import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRun } from '../store/run'

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function pointsToSvgPath(
  points: { latitude: number; longitude: number }[],
  width: number,
  height: number,
  padding: number,
): { path: string; startX: number; startY: number; endX: number; endY: number } | null {
  if (points.length < 2) return null

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude
    if (p.latitude > maxLat) maxLat = p.latitude
    if (p.longitude < minLng) minLng = p.longitude
    if (p.longitude > maxLng) maxLng = p.longitude
  }

  const latRange = maxLat - minLat || 0.001
  const lngRange = maxLng - minLng || 0.001
  const drawW = width - padding * 2
  const drawH = height - padding * 2

  const toX = (lng: number) => padding + ((lng - minLng) / lngRange) * drawW
  const toY = (lat: number) => padding + ((maxLat - lat) / latRange) * drawH

  const segments = points.map((p) => `${toX(p.longitude).toFixed(1)},${toY(p.latitude).toFixed(1)}`)
  const path = `M${segments.join(' L')}`
  const first = points[0]
  const last = points[points.length - 1]

  return {
    path,
    startX: toX(first.longitude),
    startY: toY(first.latitude),
    endX: toX(last.longitude),
    endY: toY(last.latitude),
  }
}

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
    navigate('/lauf/zusammenfassung', { replace: true })
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
      <header className="flex items-center h-14 px-4 bg-surface-container">
        <button
          type="button"
          onClick={handleAbandon}
          className="p-1 text-on-surface"
          aria-label="Lauf abbrechen"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
        </button>
        <span className="flex-1 text-center text-base font-medium text-on-surface">
          {phase === 'paused' ? 'Pausiert' : 'Lauf läuft'}
        </span>
        <div className="flex items-center gap-1 rounded-full bg-success-container px-2.5 py-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-on-success-container">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z" />
          </svg>
          <span className="text-xs font-medium text-on-success-container">GPS</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-5 px-4 py-4">
        {/* Timer */}
        <div className="text-center">
          <p className="text-5xl font-medium text-on-surface font-[tabular-nums] tracking-tight">
            {formatTimer(liveStats.durationS)}
          </p>
          <p className="text-sm text-on-surface-variant mt-1">Laufzeit</p>
        </div>

        {/* Live stats card */}
        <div className="rounded-xl bg-surface-container p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
                {liveStats.distanceKm.toFixed(1).replace('.', ',')}
              </p>
              <p className="text-xs text-on-surface-variant">km</p>
            </div>
            <div>
              <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
                {liveStats.paceDisplay}
              </p>
              <p className="text-xs text-on-surface-variant">min/km</p>
            </div>
            <div>
              <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
                {Math.round(liveStats.elevationGainM)}
              </p>
              <p className="text-xs text-on-surface-variant">Höhenmeter</p>
            </div>
          </div>
        </div>

        {/* Route map */}
        <div className="rounded-xl bg-surface-container-high overflow-hidden">
          <svg viewBox="0 0 320 140" fill="none" className="w-full" role="img" aria-label="Live-Route">
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
                <circle cx={svgData.endX} cy={svgData.endY} r="10" fill="var(--md-primary, #1B6B4A)" opacity="0.25" />
                <circle cx={svgData.endX} cy={svgData.endY} r="5" fill="var(--md-primary, #1B6B4A)" />
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
          <div className="flex items-center gap-2 rounded-xl bg-error-container p-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-on-error-container shrink-0">
              <path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" />
            </svg>
            <p className="text-sm text-on-error-container">{gpsError}</p>
          </div>
        )}

        {/* Coach banner */}
        <div className="flex items-start gap-3 rounded-xl bg-primary-container p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-on-primary-container/10 shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container">
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" />
            </svg>
          </div>
          <p className="text-sm text-on-primary-container">
            App-Modus aktiv: Route, Zeit und Tempo werden aufgezeichnet.
          </p>
        </div>
      </main>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-6 pb-8 pt-4 px-4">
        <button
          type="button"
          onClick={handleStop}
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            confirmStop ? 'bg-error' : 'bg-error-container'
          }`}
          aria-label="Beenden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={confirmStop ? 'text-on-error' : 'text-on-error-container'}>
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handlePauseResume}
          disabled={phase === 'saving'}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary disabled:opacity-50"
          aria-label={phase === 'paused' ? 'Fortsetzen' : 'Pausieren'}
        >
          {phase === 'paused' ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary">
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            </svg>
          )}
        </button>

        <div className="w-14" />
      </div>

      {/* Confirm stop overlay */}
      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/40 p-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-high p-6">
            <h2 className="text-lg font-medium text-on-surface mb-2">Lauf beenden?</h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Dein Lauf wird gespeichert und die Aufzeichnung beendet.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmStop(false)}
                className="flex-1 h-10 rounded-full border border-outline text-on-surface text-sm font-medium"
              >
                Weiter laufen
              </button>
              <button
                type="button"
                onClick={handleStop}
                className="flex-1 h-10 rounded-full bg-primary text-on-primary text-sm font-medium"
              >
                Beenden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <footer className="px-4 pb-4">
        <p className="text-xs text-on-surface-variant text-center">
          Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.
        </p>
      </footer>
    </div>
  )
}
