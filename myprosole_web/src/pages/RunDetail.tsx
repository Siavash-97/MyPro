import { useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useRun, formatPace } from '../store/run'
import { useDiary } from '../store/diary'
import type { DiaryFeeling } from '../types'
import { formatDurationDisplay } from '../lib/format'
import { pointsToSvgPath } from '../lib/geo'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'

const FEELING_LABELS: Record<DiaryFeeling, string> = {
  gut: 'Gut',
  okay: 'Ging so',
  schwer: 'Schwer',
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

function scoreBadgeClass(score: number): string {
  if (score >= 70) return 'md-score-badge md-score-badge--good'
  if (score >= 50) return 'md-score-badge md-score-badge--ok'
  return 'md-score-badge md-score-badge--low'
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
  const { entries, fetchEntries } = useDiary()

  useEffect(() => {
    if (!id) return
    fetchRun(id)
    fetchRunSplits(id)
    fetchRunPoints(id)
    fetchEntries(50)
  }, [id, fetchRun, fetchRunSplits, fetchRunPoints, fetchEntries])

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

  // Tagebucheintrag desselben Tages (Einträge sind nicht an Läufe gekoppelt,
  // siehe docs/trainingsplan-kopplung.md – bis dahin zählt das Datum).
  const runDate = run.started_at.slice(0, 10)
  const diaryEntry = entries.find((e) => e.date === runDate)

  return (
    <>
      {/* Header */}
      <div className="md-profile-header">
        <div className="md-avatar" aria-hidden="true">
          <Icon name="training" className="icon" />
        </div>
        <div>
          <h1 className="md-profile-header__name">{formatDate(run.started_at)}</h1>
          <p className="md-profile-header__meta">
            {formatTime(run.started_at)} Uhr
            {run.ended_at ? ` – ${formatTime(run.ended_at)} Uhr` : ''}
          </p>
        </div>
      </div>

      {/* Score */}
      {run.score != null && (
        <section
          className="md-card"
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}
          aria-label={`Lauf-Score ${run.score} von 100`}
        >
          <div className={scoreBadgeClass(run.score)}>{run.score}</div>
          <div>
            <p className="md-section-title" style={{ marginBottom: 2 }}>Lauf-Score</p>
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              {run.score >= 70 ? 'Guter Lauf' : run.score >= 50 ? 'Solider Lauf' : 'Ausbaufähig'}
            </p>
          </div>
        </section>
      )}

      {/* Metric grid */}
      <div className="md-metric-grid">
        <div className="md-metric">
          <p className="md-metric__label">Strecke</p>
          <p className="md-metric__value">
            {run.distance_km != null ? run.distance_km.toFixed(1).replace('.', ',') : '–'} <span>km</span>
          </p>
        </div>
        <div className="md-metric">
          <p className="md-metric__label">Zeit</p>
          <p className="md-metric__value">
            {run.duration_s != null ? formatDurationDisplay(run.duration_s) : '–'} <span>min</span>
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
            {run.elevation_gain_m != null ? Math.round(run.elevation_gain_m) : '–'} <span>m</span>
          </p>
        </div>
      </div>

      {/* Pause duration */}
      {run.paused_duration_s > 0 && (
        <div className="md-card md-row" style={{ cursor: 'default' }}>
          <span style={{ font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>Pausenzeit</span>
          <span style={{ font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            {formatDurationDisplay(run.paused_duration_s)}
          </span>
        </div>
      )}

      {/* Route map */}
      <div className="md-map">
        <svg viewBox="0 0 320 160" fill="none" role="img" aria-label="Laufroute auf der Karte">
          <line className="md-map__street" x1="0" y1="30" x2="320" y2="30" />
          <line className="md-map__street" x1="0" y1="80" x2="320" y2="80" />
          <line className="md-map__street" x1="0" y1="130" x2="320" y2="130" />
          <line className="md-map__street" x1="60" y1="0" x2="60" y2="160" />
          <line className="md-map__street" x1="160" y1="0" x2="160" y2="160" />
          <line className="md-map__street" x1="260" y1="0" x2="260" y2="160" />
          {svgData ? (
            <>
              <path className="md-map__route" d={svgData.path} />
              <circle className="md-map__start" cx={svgData.startX} cy={svgData.startY} r="6" />
              <circle className="md-map__pos" cx={svgData.endX} cy={svgData.endY} r="7" />
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
        <section className="md-card">
          <h2 className="md-section-title">Kilometer-Abschnitte</h2>
          {splits.map((s) => (
            <div key={s.id} className="md-split-row">
              <span>
                km {s.split_number}
                {s.distance_km < 0.95 ? ` (${s.distance_km.toFixed(1).replace('.', ',')} km)` : ''}
              </span>
              <strong>{formatPace(s.duration_s, s.distance_km)} min/km</strong>
            </div>
          ))}
        </section>
      )}

      {/* Trainingstagebuch des Lauftages */}
      <Link
        className="md-card md-row"
        to="/training/tagebuch"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div>
          <p className="md-section-title" style={{ marginBottom: 4 }}>Trainingstagebuch</p>
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            {diaryEntry
              ? [
                  diaryEntry.feeling ? FEELING_LABELS[diaryEntry.feeling] : null,
                  diaryEntry.has_pain ? 'Beschwerden vermerkt' : 'Keine Beschwerden',
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Noch kein Eintrag für diesen Tag'}
          </p>
        </div>
        <Icon name="chevron-right" className="icon md-row__chevron" />
      </Link>

      {/* Notes */}
      {run.notes && (
        <section className="md-card">
          <h2 className="md-section-title">Notizen</h2>
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)', whiteSpace: 'pre-wrap' }}>
            {run.notes}
          </p>
        </section>
      )}

      {/* Einziger Weg von hier in die Laufanalyse, wie im Entwurf. */}
      <Link
        className="md-button md-button--tonal"
        to={`/lauf/${run.id}/analyse`}
        style={{ textDecoration: 'none' }}
      >
        Laufanalyse anschauen
      </Link>

      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/verlauf', { replace: true })}
        className="md-button md-button--text"
      >
        Zurück zum Verlauf
      </button>
    </>
  )
}
