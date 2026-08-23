import { useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useRun, formatPace } from '../store/run'
import { durchschnittstempoText } from '../lib/tempo'
import { hoehenmeterText } from '../lib/hoehenmeter'
import { laufBilanz } from '../lib/laufBilanz'
import { verworfeneStreckeText } from '../lib/verworfeneStrecke'
import { useDiary } from '../store/diary'
import type { DiaryFeeling } from '../types'
import { formatDurationDisplay } from '../lib/format'
import RouteMap from '../components/map/RouteMap'
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
    punkteFehler,
    punkteOffen,
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

  // Was das GPS an unmoeglicher Strecke gemeldet hat - oder null, wenn es zu
  // wenig war, um darueber zu reden. Wortlaut und Schwelle:
  // lib/verworfeneStrecke.ts.
  //
  // Nachgerechnet und nicht gelesen, weil `runs` die Zahl nicht speichert;
  // die Punkte tragen ihr Urteil aber seit Migration 0051 bei sich, sodass
  // laufBilanz es LIEST statt neu zu entscheiden. Solange die Punkte noch
  // laden, ist die Bilanz leer und die Zeile bleibt weg - richtig so: eine
  // Aussage ueber Sprünge, bevor die Punkte da sind, waere geraten.
  //
  // Der Merker steht vor dem fruehen Aussteigen, weil Hooks nicht hinter
  // einem `return` stehen duerfen.
  const verworfenText = useMemo(
    () => verworfeneStreckeText(laufBilanz(points).verworfeneStreckeM),
    [points],
  )

  if (loading || !run) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }


  // Warum die Karte leer ist, ist nicht immer dasselbe. Bis zum 22.08.2026
  // stand hier in allen drei Faellen "Keine GPS-Daten" - auch dann, wenn die
  // Punkte auf dem Geraet lagen und die Uebertragung scheiterte.
  const streckeLeerText = punkteFehler
    ? punkteOffen > 0
      ? `${punkteOffen} Punkte liegen noch auf dem Geraet: ${punkteFehler}`
      : `Strecke nicht verfuegbar: ${punkteFehler}`
    : punkteOffen > 0
      ? `${punkteOffen} Punkte liegen noch auf dem Geraet und gehen beim naechsten Versuch mit`
      : 'Keine GPS-Daten'

  const paceDisplay = durchschnittstempoText({
    streckeKm: run.distance_km,
    gespeichertesTempoSJeKm: run.avg_pace_s_per_km,
    bewegungszeitS: run.moving_time_s,
    gesamtzeitS: run.duration_s,
  })

  // Die Hoehenangabe - oder null, solange sie nicht belastbar ist, und das
  // ist sie derzeit nie. Der Befund steht in lib/hoehenmeter.ts. Gerechnet
  // und gespeichert wird sie weiterhin, gezeigt nicht.
  const hoehenmeter = hoehenmeterText(run.elevation_gain_m)

  // Der Tagebucheintrag zu diesem Lauf.
  //
  // Zuerst ueber run_id: Seit die Verknuepfung beim Speichern mitgeschrieben
  // wird, ist sie eindeutig. Aeltere Eintraege haben sie nicht - fuer die
  // bleibt das Datum als Rueckfall. Wer an zwei Laeufen desselben Tages
  // beide Male etwas eintraegt, bekommt dort den ersten; genau deshalb ist
  // das der Rueckfall und nicht der Weg.
  const runDate = run.started_at.slice(0, 10)
  const diaryEntry =
    entries.find((e) => e.run_id === run.id)
    ?? entries.find((e) => e.run_id == null && e.entry_date === runDate)

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
          {/* Der Hinweis gehoert unter die Zahl, auf die er sich bezieht,
              und nicht in eine eigene Karte: Er ist kein Befund ueber den
              Lauf, sondern eine Einschraenkung dieses einen Wertes. */}
          {verworfenText && <p className="md-metric__sub">{verworfenText}</p>}
        </div>
        <div className="md-metric">
          <p className="md-metric__label">Gesamtzeit</p>
          <p className="md-metric__value">
            {run.duration_s != null ? formatDurationDisplay(run.duration_s) : '–'} <span>min</span>
          </p>
          {/* Bestandslaeufe haben keine Bewegungszeit. Dann steht hier nichts:
              ohne sie rechnet durchschnittstempoText mit der Uhr, es gibt also
              nur eine Zeit und nichts zu unterscheiden. Ein leerer Strich
              wuerfe die Frage auf, die diese Zeile beantworten soll. */}
          {run.moving_time_s != null && run.moving_time_s > 0 && (
            <p className="md-metric__sub">
              davon in Bewegung {formatDurationDisplay(run.moving_time_s)}
            </p>
          )}
        </div>
        <div className="md-metric">
          <p className="md-metric__label">Ø Tempo</p>
          <p className="md-metric__value">
            {paceDisplay} <span>min/km</span>
          </p>
        </div>
        {/* Faellt die Kachel weg, bleiben drei - .md-metric-grid zieht dann
            die Strecke ueber beide Spalten, damit kein Loch entsteht. */}
        {hoehenmeter && (
          <div className="md-metric">
            <p className="md-metric__label">Höhenmeter</p>
            <p className="md-metric__value">
              {hoehenmeter} <span>m</span>
            </p>
          </div>
        )}
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
      <RouteMap
        points={points}
        height={160}
        label="Laufroute auf der Karte"
        leerText={streckeLeerText}
      />

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
