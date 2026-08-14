import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useConsent } from '../store/consent'
import { useDiary } from '../store/diary'
import { useRun } from '../store/run'
import type { DiaryFeeling, BodyLocation } from '../types'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Icon from '../components/ui/Icon'


const FEELING_OPTIONS: { value: DiaryFeeling; label: string; icon: string }[] = [
  { value: 'gut', label: 'Gut', icon: 'up' },
  { value: 'okay', label: 'Ging so', icon: 'mid' },
  { value: 'schwer', label: 'Schwer', icon: 'down' },
]

const FEELING_LABELS: Record<DiaryFeeling, string> = {
  gut: 'Gut',
  okay: 'Ging so',
  schwer: 'Schwer',
}

const PAIN_LOCATIONS: { value: BodyLocation; label: string }[] = [
  { value: 'knie', label: 'Knie' },
  { value: 'wade', label: 'Wade' },
  { value: 'achillessehne', label: 'Achillessehne' },
  { value: 'schienbein', label: 'Schienbein' },
  { value: 'huefte', label: 'Hüfte' },
  { value: 'fuss', label: 'Fuß' },
  { value: 'ruecken', label: 'Rücken' },
  { value: 'sprunggelenk', label: 'Sprunggelenk' },
  { value: 'sonstiges', label: 'Woanders' },
]

export default function TrainingDiary() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { hasActiveConsent, grantConsent, fetchConsents, loading: consentLoading } = useConsent()
  const { entries, fetchEntries, createEntry } = useDiary()
  const liveStats = useRun((s) => s.liveStats)
  const recentRuns = useRun((s) => s.recentRuns)
  const fetchRecentRuns = useRun((s) => s.fetchRecentRuns)

  // Direkt nach dem Lauf (SPA-Navigation aus dem Tracking): Werte aus dem
  // Lauf vorbelegen und danach zur Zusammenfassung statt zum Training.
  const fromTracking = searchParams.get('from') === 'tracking'
  const prefilled = fromTracking && liveStats.distanceKm > 0

  const [feeling, setFeeling] = useState<DiaryFeeling | null>(null)
  const [hasPain, setHasPain] = useState<boolean | null>(null)
  const [painLocations, setPainLocations] = useState<Set<BodyLocation>>(new Set())
  const [distance, setDistance] = useState(() =>
    prefilled ? liveStats.distanceKm.toFixed(1) : '',
  )
  const [duration, setDuration] = useState(() =>
    prefilled ? String(Math.max(1, Math.round(liveStats.durationS / 60))) : '',
  )
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consentGranting, setConsentGranting] = useState(false)

  useEffect(() => {
    fetchConsents()
    fetchEntries(10)
    fetchRecentRuns(50)
  }, [fetchConsents, fetchEntries, fetchRecentRuns])

  const hasConsent = hasActiveConsent('training_diary')

  const handleGrantConsent = async () => {
    setConsentGranting(true)
    await grantConsent('training_diary')
    setConsentGranting(false)
  }

  const togglePainLocation = (loc: BodyLocation) => {
    setPainLocations((prev) => {
      const next = new Set(prev)
      if (next.has(loc)) next.delete(loc)
      else next.add(loc)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const today = new Date().toISOString().slice(0, 10)
    const err = await createEntry({
      date: today,
      distance_km: distance ? Number(distance) : undefined,
      duration_minutes: duration ? Number(duration) : undefined,
      feeling: feeling ?? undefined,
      has_pain: hasPain === true,
      pain_locations: hasPain ? [...painLocations] : undefined,
      notes: notes || undefined,
    })

    setSaving(false)
    if (err) {
      setError(err)
    } else {
      navigate(fromTracking ? '/lauf/zusammenfassung' : '/training')
    }
  }

  if (consentLoading) return <LoadingSpinner />

  if (!hasConsent) {
    return (
      <div className="md-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <Icon name="shield" className="icon" style={{ color: 'var(--md-primary)', flexShrink: 0 }} />
          <div>
            <p style={{ margin: '0 0 4px', font: 'var(--type-title-md)', color: 'var(--md-on-surface)' }}>
              Einwilligung erforderlich
            </p>
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Das Trainingstagebuch speichert Gesundheitsdaten (Schmerzen, Befinden).
              Gemäß DSGVO Art. 9 benötigen wir deine ausdrückliche Einwilligung.
              Deine Daten werden verschlüsselt gespeichert und nur für deine Übungsauswahl verwendet.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGrantConsent}
          disabled={consentGranting}
          className="md-button md-button--filled"
          style={{ width: '100%' }}
        >
          {consentGranting ? 'Wird gespeichert…' : 'Einwilligung erteilen'}
        </button>
        <button
          type="button"
          onClick={() => navigate(fromTracking ? '/lauf/zusammenfassung' : '/training')}
          className="md-button md-button--text"
          style={{ width: '100%', marginTop: 'var(--space-xs)' }}
        >
          {fromTracking ? 'Später eintragen' : 'Zurück'}
        </button>
      </div>
    )
  }

  return (
    <>
      <form
        className="md-diary"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <p className="md-diary__date">
          Heute, {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {/* Distance + Duration */}
        <div className="md-field-grid">
          <div className="md-field">
            <label className="md-field__label" htmlFor="diary-distance">Distanz (km)</label>
            <input
              className="md-field__input"
              id="diary-distance"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="8,2"
            />
          </div>
          <div className="md-field">
            <label className="md-field__label" htmlFor="diary-duration">Dauer (min)</label>
            <input
              className="md-field__input"
              id="diary-duration"
              type="number"
              inputMode="numeric"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="48"
            />
          </div>
        </div>
        {prefilled && (
          <p className="md-diary__source" style={{ marginTop: 'calc(-1 * var(--space-sm))' }}>
            Aus deinem Lauf übernommen.
          </p>
        )}

        {/* Feeling */}
        <fieldset className="md-diary__rating">
          <legend className="md-section-title">Wie war's?</legend>
          <div className="md-rating">
            {FEELING_OPTIONS.map((opt) => (
              <label key={opt.value} className="md-rating__option" htmlFor={`diary-${opt.value}`}>
                <input
                  className="md-rating__input"
                  id={`diary-${opt.value}`}
                  type="radio"
                  name="gefuehl"
                  value={opt.value}
                  checked={feeling === opt.value}
                  onChange={() => setFeeling(opt.value)}
                />
                <span className="md-rating__face">
                  <Icon name={opt.icon} className="icon" />
                </span>
                <span className="md-rating__label">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Pain */}
        <fieldset className="md-diary__pain">
          <legend className="md-section-title">Irgendwelche körperlichen Beschwerden?</legend>
          <div className="md-rating md-rating--pair">
            <label className="md-rating__option" htmlFor="schmerz-nein">
              <input
                className="md-rating__input"
                id="schmerz-nein"
                type="radio"
                name="schmerz"
                value="nein"
                checked={hasPain === false}
                onChange={() => { setHasPain(false); setPainLocations(new Set()) }}
              />
              <span className="md-rating__label">Nein</span>
            </label>
            <label className="md-rating__option" htmlFor="schmerz-ja">
              <input
                className="md-rating__input"
                id="schmerz-ja"
                type="radio"
                name="schmerz"
                value="ja"
                checked={hasPain === true}
                onChange={() => setHasPain(true)}
              />
              <span className="md-rating__label">Ja</span>
            </label>
          </div>

          <div className="md-diary__pain-details">
            <p className="md-field__label" id="schmerz-ort-titel">Wo?</p>
            <div className="md-chip-set" role="group" aria-labelledby="schmerz-ort-titel">
              {PAIN_LOCATIONS.map((loc) => (
                <label key={loc.value} className="md-choice-chip" htmlFor={`ort-${loc.value}`}>
                  <input
                    id={`ort-${loc.value}`}
                    type="checkbox"
                    name="ort"
                    value={loc.value}
                    checked={painLocations.has(loc.value)}
                    onChange={() => togglePainLocation(loc.value)}
                  />
                  {loc.label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {/* Notes */}
        <div className="md-field">
          <label className="md-field__label" htmlFor="diary-notes">Notizen (optional)</label>
          <input
            className="md-field__input"
            id="diary-notes"
            type="text"
            maxLength={120}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z.B. außen am Knie, beim Bergablaufen"
          />
        </div>

        {error && (
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{error}</p>
        )}

        <button
          className="md-button md-button--filled"
          type="submit"
          disabled={saving}
          style={{ width: '100%' }}
        >
          {saving ? 'Wird gespeichert…' : 'Eintrag speichern'}
        </button>

        {fromTracking && (
          <p className="md-diary__manual">
            <Link to="/lauf/zusammenfassung">Später eintragen</Link>
          </p>
        )}
      </form>

      {/* Previous entries */}
      {entries.length > 0 && (
        <div>
          <p className="md-section-title">Letzte Einträge</p>
          <ol className="md-week-plan">
            {entries.slice(0, 5).map((entry) => {
              // Wie im Mockup fuehrt jeder Eintrag auf den Lauf des Tages.
              // Eintraege sind nicht fest an Laeufe gekoppelt (siehe
              // docs/trainingsplan-kopplung.md), deshalb verbindet das Datum.
              const run = recentRuns.find(
                (r) => r.status === 'completed' && r.started_at.slice(0, 10) === entry.date,
              )
              const label = new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'short' })
              const body = (
                <>
                  <span className="md-week-plan__label">{label}</span>
                  <span className="md-week-plan__unit">
                    {[
                      entry.distance_km != null ? `${String(entry.distance_km).replace('.', ',')} km` : null,
                      entry.duration_minutes != null ? `${entry.duration_minutes} min` : null,
                      entry.has_pain ? 'Beschwerden' : null,
                    ].filter(Boolean).join(' · ') || 'Keine Details'}
                    {entry.feeling && <small>{FEELING_LABELS[entry.feeling]}</small>}
                  </span>
                </>
              )

              return (
                <li key={entry.id}>
                  {run ? (
                    <Link
                      className="md-week-plan__day md-week-plan__day--done"
                      to={`/lauf/${run.id}`}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {body}
                      <Icon name="chevron-right" className="icon md-row__chevron" />
                    </Link>
                  ) : (
                    <span className="md-week-plan__day md-week-plan__day--done">{body}</span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Privacy notice */}
      <section className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          Angaben zu Schmerzen sind Gesundheitsdaten. Sie werden verschlüsselt gespeichert und nur für deine Übungsauswahl verwendet.
        </p>
      </section>
    </>
  )
}
