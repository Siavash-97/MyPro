import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRun, formatPace } from '../store/run'
import LoadingSpinner from '../components/ui/LoadingSpinner'

function formatDurationDisplay(totalS: number): string {
  const h = Math.floor(totalS / 3600)
  const m = Math.floor((totalS % 3600) / 60)
  const s = totalS % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
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

export default function RunDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    selectedRun: run,
    selectedRunSplits: splits,
    selectedRunPoints: points,
    loading,
    fetchRun,
    fetchRunSplits,
    fetchRunPoints,
  } = useRun()

  useEffect(() => {
    if (!id) return
    fetchRun(id)
    fetchRunSplits(id)
    fetchRunPoints(id)
  }, [id, fetchRun, fetchRunSplits, fetchRunPoints])

  if (loading || !run) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  const svgData = pointsToSvgPath(points, 320, 160, 20)

  const paceDisplay =
    run.distance_km && run.duration_s && run.distance_km > 0
      ? formatPace(run.duration_s, run.distance_km)
      : '--:--'

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container shrink-0">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container">
            <path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.8 0-3.3-.9-4.1-2.3l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-medium text-on-surface">
            {formatDate(run.started_at)}
          </h1>
          <p className="text-sm text-on-surface-variant">
            {formatTime(run.started_at)} Uhr
            {run.ended_at ? ` – ${formatTime(run.ended_at)} Uhr` : ''}
          </p>
        </div>
      </div>

      {/* Score */}
      {run.score != null && (
        <div className="flex items-center gap-3 rounded-xl bg-surface-container p-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold font-[tabular-nums] ${
            run.score >= 70
              ? 'bg-success-container text-on-success-container'
              : run.score >= 50
                ? 'bg-warning-container text-on-warning-container'
                : 'bg-error-container text-on-error-container'
          }`}>
            {run.score}
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">Lauf-Score</p>
            <p className="text-xs text-on-surface-variant">
              {run.score >= 70 ? 'Guter Lauf' : run.score >= 50 ? 'Solider Lauf' : 'Ausbaufähig'}
            </p>
          </div>
        </div>
      )}

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Strecke</p>
          <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
            {run.distance_km != null
              ? run.distance_km.toFixed(1).replace('.', ',')
              : '–'}
            <span className="text-sm text-on-surface-variant ml-1">km</span>
          </p>
        </div>
        <div className="rounded-xl bg-surface-container p-3">
          <p className="text-xs text-on-surface-variant">Zeit</p>
          <p className="text-xl font-medium text-on-surface font-[tabular-nums]">
            {run.duration_s != null ? formatDurationDisplay(run.duration_s) : '–'}
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
            {run.elevation_gain_m != null ? Math.round(run.elevation_gain_m) : '–'}
            <span className="text-sm text-on-surface-variant ml-1">m</span>
          </p>
        </div>
      </div>

      {/* Pause duration */}
      {run.paused_duration_s > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-surface-container p-3">
          <span className="text-sm text-on-surface-variant">Pausenzeit</span>
          <span className="text-sm font-medium text-on-surface font-[tabular-nums]">
            {formatDurationDisplay(run.paused_duration_s)}
          </span>
        </div>
      )}

      {/* Route map */}
      <div className="rounded-xl bg-surface-container-high overflow-hidden">
        <svg viewBox="0 0 320 160" fill="none" className="w-full" role="img" aria-label="Laufroute">
          <line x1="0" y1="30" x2="320" y2="30" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="0" y1="80" x2="320" y2="80" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="0" y1="130" x2="320" y2="130" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="60" y1="0" x2="60" y2="160" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="160" y1="0" x2="160" y2="160" stroke="currentColor" strokeOpacity="0.08" />
          <line x1="260" y1="0" x2="260" y2="160" stroke="currentColor" strokeOpacity="0.08" />
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
            <text x="160" y="85" textAnchor="middle" fill="currentColor" opacity="0.3" fontSize="12">
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
            {splits.map((s) => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">
                  km {s.split_number}
                  {s.distance_km < 0.95 ? ` (${s.distance_km.toFixed(1).replace('.', ',')} km)` : ''}
                </span>
                <span className="text-sm font-medium text-on-surface font-[tabular-nums]">
                  {formatPace(s.duration_s, s.distance_km)} min/km
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {run.notes && (
        <section className="rounded-xl bg-surface-container p-4">
          <h2 className="text-sm font-medium text-on-surface mb-2">Notizen</h2>
          <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{run.notes}</p>
        </section>
      )}

      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/verlauf', { replace: true })}
        className="h-12 rounded-full bg-primary text-on-primary font-medium mt-2"
      >
        Zurück zum Verlauf
      </button>
    </div>
  )
}
