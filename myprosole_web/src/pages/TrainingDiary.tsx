import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConsent } from '../store/consent'
import { useDiary } from '../store/diary'
import type { DiaryFeeling, BodyLocation } from '../types'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const FEELING_OPTIONS: { value: DiaryFeeling; label: string; icon: string }[] = [
  { value: 'gut', label: 'Gut', icon: 'M2 20h2.5a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H2zm19.6-9.4a2 2 0 0 0-1.6-.8h-5l.8-3.8.02-.26a1.5 1.5 0 0 0-.44-1.06L14.2 3 7.6 9.6A2 2 0 0 0 7 11v7a2 2 0 0 0 2 2h9a2 2 0 0 0 1.84-1.22l3.02-7.05.14-.73z' },
  { value: 'okay', label: 'Ging so', icon: 'M4 10.5h16v3H4z' },
  { value: 'schwer', label: 'Schwer', icon: 'M22 4h-2.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1H22zM2.4 13.4a2 2 0 0 0 1.6.8h5l-.8 3.8-.02.26c0 .41.17.79.44 1.06L9.8 21l6.6-6.6A2 2 0 0 0 17 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-1.84 1.22L1.14 12.27 1 13z' },
]

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
  const { hasActiveConsent, grantConsent, fetchConsents, loading: consentLoading } = useConsent()
  const { entries, fetchEntries, createEntry } = useDiary()

  const [feeling, setFeeling] = useState<DiaryFeeling | null>(null)
  const [hasPain, setHasPain] = useState<boolean | null>(null)
  const [painLocations, setPainLocations] = useState<Set<BodyLocation>>(new Set())
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consentGranting, setConsentGranting] = useState(false)

  useEffect(() => {
    fetchConsents()
    fetchEntries(10)
  }, [fetchConsents, fetchEntries])

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
      navigate('/training')
    }
  }

  if (consentLoading) return <LoadingSpinner />

  if (!hasConsent) {
    return (
      <div className="flex flex-col gap-5 px-4 py-4">
        <div className="rounded-xl bg-surface-container p-5">
          <div className="flex items-start gap-3 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-primary shrink-0 mt-0.5">
              <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5z" />
            </svg>
            <div>
              <h2 className="text-base font-medium text-on-surface mb-1">
                Einwilligung erforderlich
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
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
            className="w-full h-12 rounded-full bg-primary text-on-primary font-medium disabled:opacity-50"
          >
            {consentGranting ? 'Wird gespeichert…' : 'Einwilligung erteilen'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/training')}
            className="w-full h-10 mt-2 rounded-full text-on-surface-variant text-sm"
          >
            Zurück
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Date */}
      <p className="text-sm text-on-surface-variant">
        Heute, {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* Distance + Duration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="diary-distance" className="block text-xs text-on-surface-variant mb-1">
            Distanz (km)
          </label>
          <input
            id="diary-distance"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="8.2"
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div>
          <label htmlFor="diary-duration" className="block text-xs text-on-surface-variant mb-1">
            Dauer (min)
          </label>
          <input
            id="diary-duration"
            type="number"
            inputMode="numeric"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="48"
            className="w-full h-10 px-3 rounded-lg bg-surface-container text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Feeling */}
      <fieldset>
        <legend className="text-sm font-medium text-on-surface mb-2">Wie war's?</legend>
        <div className="grid grid-cols-3 gap-2">
          {FEELING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFeeling(feeling === opt.value ? null : opt.value)}
              className={`flex flex-col items-center gap-1.5 rounded-xl p-3 transition-colors ${
                feeling === opt.value
                  ? 'bg-primary-container'
                  : 'bg-surface-container'
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={
                feeling === opt.value ? 'text-on-primary-container' : 'text-on-surface-variant'
              }>
                <path d={opt.icon} />
              </svg>
              <span className={`text-xs font-medium ${
                feeling === opt.value ? 'text-on-primary-container' : 'text-on-surface-variant'
              }`}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Pain */}
      <fieldset>
        <legend className="text-sm font-medium text-on-surface mb-2">Hattest du Schmerzen?</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setHasPain(false); setPainLocations(new Set()) }}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${
              hasPain === false ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Nein
          </button>
          <button
            type="button"
            onClick={() => setHasPain(true)}
            className={`h-10 rounded-xl text-sm font-medium transition-colors ${
              hasPain === true ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            Ja
          </button>
        </div>

        {hasPain && (
          <div className="mt-3">
            <p className="text-xs text-on-surface-variant mb-2">Wo?</p>
            <div className="flex flex-wrap gap-1.5">
              {PAIN_LOCATIONS.map((loc) => (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => togglePainLocation(loc.value)}
                  className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                    painLocations.has(loc.value)
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {/* Notes */}
      <div>
        <label htmlFor="diary-notes" className="block text-xs text-on-surface-variant mb-1">
          Notizen (optional)
        </label>
        <textarea
          id="diary-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="z.B. außen am Knie, beim Bergablaufen"
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-surface-container text-on-surface placeholder:text-on-surface-variant text-sm outline-none resize-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="h-12 rounded-full bg-primary text-on-primary font-medium disabled:opacity-50"
      >
        {saving ? 'Wird gespeichert…' : 'Eintrag speichern'}
      </button>

      {/* Previous entries */}
      {entries.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-on-surface mb-2">Letzte Einträge</h3>
          <div className="flex flex-col gap-2">
            {entries.slice(0, 5).map((entry) => (
              <div key={entry.id} className="rounded-xl bg-surface-container p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-on-surface">
                    {new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  {entry.feeling && (
                    <span className="text-xs text-on-surface-variant">
                      {entry.feeling === 'gut' ? 'Gut' : entry.feeling === 'okay' ? 'Ging so' : 'Schwer'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">
                  {[
                    entry.distance_km != null ? `${entry.distance_km} km` : null,
                    entry.duration_minutes != null ? `${entry.duration_minutes} min` : null,
                    entry.has_pain ? 'Schmerzen' : null,
                  ].filter(Boolean).join(' · ') || 'Keine Details'}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Privacy notice */}
      <div className="flex items-start gap-2 rounded-xl bg-surface-container p-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-on-surface-variant shrink-0 mt-0.5">
          <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5z" />
        </svg>
        <p className="text-xs text-on-surface-variant">
          Angaben zu Schmerzen sind Gesundheitsdaten. Sie werden verschlüsselt gespeichert und nur für deine Übungsauswahl verwendet.
        </p>
      </div>
    </div>
  )
}
