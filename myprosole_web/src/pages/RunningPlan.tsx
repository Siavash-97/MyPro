import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRun } from '../store/run'
import Icon from '../components/ui/Icon'
import {
  PLAN_DAYS as DAYS,
  type PlanDayKey as DayKey,
  type WeekPlan,
  readWeekPlan,
  saveWeekPlan,
} from '../lib/runningPlan'

// Grenzen aus dem Entwurf: ab 10 % Zuwachs gegenueber der Vorwoche wird die
// Anzeige gelb, ab 20 % orange. Als Hinweis, nicht als Sperre.
const CAUTION_PERCENT = 10
const HIGH_PERCENT = 20

function formatKm(km: number): string {
  return km.toFixed(1).replace('.', ',')
}

export default function RunningPlan() {
  const navigate = useNavigate()
  const { recentRuns, fetchRecentRuns } = useRun()
  const [week, setWeek] = useState<WeekPlan>(readWeekPlan)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchRecentRuns(50)
  }, [fetchRecentRuns])

  // Vorwoche aus den tatsaechlich gelaufenen Kilometern, nicht aus einer
  // Vorgabe: Der Vergleich soll den echten Sprung zeigen.
  const previousKm = useMemo(() => {
    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - 7)
    return recentRuns
      .filter((r) => r.status === 'completed' && new Date(r.started_at) >= from)
      .reduce((acc, r) => acc + (r.distance_km ?? 0), 0)
  }, [recentRuns])

  const total = DAYS.reduce((acc, d) => acc + (Number(week[d.key]) || 0), 0)
  const deltaPercent = previousKm > 0 ? ((total - previousKm) / previousKm) * 100 : null
  const level =
    deltaPercent == null || deltaPercent < CAUTION_PERCENT
      ? undefined
      : deltaPercent < HIGH_PERCENT
        ? 'caution'
        : 'high'

  // Der Balken ist voll, wenn die Woche die 20-Prozent-Grenze erreicht. So
  // zeigt er nicht irgendeinen Anteil, sondern wie nah der Sprung am Limit ist.
  const barMax = previousKm > 0 ? previousKm * (1 + HIGH_PERCENT / 100) : Math.max(total, 1)
  const fillPercent = Math.min(100, barMax > 0 ? (total / barMax) * 100 : 0)

  const hasRestDay = DAYS.some((d) => (Number(week[d.key]) || 0) === 0)

  const setDay = (key: DayKey, value: string) => {
    setWeek((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = () => {
    saveWeekPlan(week)
    setSaved(true)
    navigate('/training')
  }

  return (
    <>
      <p style={{ margin: '0 0 4px', font: 'var(--type-label-md)', letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--md-primary)' }}>
        Manuelle Bearbeitung
      </p>
      <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Trag ein, wie viele Kilometer du an welchem Tag laufen willst. Ruhetage bleiben auf 0.
      </p>

      <section className="md-week-sum" data-week-level={level} aria-live="polite">
        <div className="md-week-sum__head">
          <p className="md-week-sum__label">Nächste Woche</p>
          <p className="md-week-sum__value">{formatKm(total)} km</p>
        </div>
        <p className="md-week-sum__compare">
          {previousKm > 0 ? (
            <>
              Vorwoche {formatKm(previousKm)} km ·{' '}
              {deltaPercent != null && `${deltaPercent >= 0 ? '+' : ''}${Math.round(deltaPercent)} %`}
            </>
          ) : (
            'Noch keine Vorwoche zum Vergleichen'
          )}
        </p>
        <div className="md-week-sum__bar">
          <div className="md-week-sum__fill" style={{ width: `${fillPercent}%` }} />
        </div>
      </section>

      <section aria-labelledby="raster-titel">
        <p className="md-section-title" id="raster-titel">Deine Woche</p>
        <ol className="md-week-grid">
          {DAYS.map((day) => (
            <li key={day.key} className="md-week-grid__day">
              <label className="md-week-grid__label" htmlFor={`km-${day.key}`}>
                {day.label}
              </label>
              <input
                className="md-week-grid__input"
                id={`km-${day.key}`}
                type="number"
                min="0"
                max="60"
                step="0.5"
                inputMode="decimal"
                value={week[day.key]}
                onChange={(e) => setDay(day.key, e.target.value)}
                aria-describedby="raster-hinweis"
              />
            </li>
          ))}
        </ol>
        <p className="md-field__hint" id="raster-hinweis">
          Ab 10 % Zuwachs gegenüber der Vorwoche wird die Anzeige oben gelb, ab 20 % orange –
          als Hinweis, nicht als Sperre.
        </p>
        {!hasRestDay && (
          <p className="md-field__hint md-field__hint--warning">
            Kein Ruhetag in deiner Woche eingeplant. Mindestens ein Tag auf 0 wird empfohlen.
          </p>
        )}
      </section>

      <button
        type="button"
        className="md-button md-button--filled"
        onClick={handleSave}
        style={{ width: '100%' }}
      >
        {saved ? 'Gespeichert' : 'Plan speichern'}
      </button>

      <section className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          Die App hält dich nicht auf, wenn du mehr einträgst – sie zeigt nur, wie groß der
          Sprung ist.
        </p>
      </section>
    </>
  )
}
