import { useEffect, useState } from 'react'
import Icon from '../components/ui/Icon'
import CommunityTabs from '../components/community/CommunityTabs'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'
import { useCommunityRuns, TEMPO_ARTEN, TEMPO_LABEL, type TempoArt } from '../store/communityRuns'
import LoadingSpinner from '../components/ui/LoadingSpinner'

/**
 * ZusammenLauf (community-zusammenlauf.html): Verabredungen zum gemeinsamen
 * Laufen.
 *
 * Sichtbarkeit: Vorerst sehen alle angemeldeten Nutzer alle Verabredungen –
 * so entschieden am 15.08.2026. Ein Zuschnitt nach Stadt und Umkreis kommt
 * spaeter. Der Treffpunkt ist deshalb ein freier Text und kein Standort aus
 * dem Geraet: So entscheidet jeder selbst, wie genau er wird.
 */
export default function CommunityMeetups() {
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const { runs, loading, fetchRuns, createRun, deleteRun } = useCommunityRuns()
  const [formularOffen, setFormularOffen] = useState(false)

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  return (
    <>
      <CommunityTabs />

      <div className="md-row" style={{ cursor: 'default' }}>
        <p className="md-section-title" style={{ margin: 0 }}>Kommende Läufe</p>
        <button
          type="button"
          onClick={() => showSnackbar('Der Umkreis lässt sich einstellen, sobald wir nach Stadt filtern.')}
          className="md-button md-button--text md-button--compact"
        >
          <Icon name="tune" size={20} className="icon-sm" />
          Filter
        </button>
      </div>

      {loading && runs.length === 0 ? (
        <LoadingSpinner />
      ) : runs.length === 0 ? (
        <section className="md-card" style={{ textAlign: 'center' }}>
          <div className="md-feature-heading__icon" style={{ margin: '0 auto var(--space-md)' }} aria-hidden="true">
            <Icon name="location" className="icon" />
          </div>
          <p className="md-section-title" style={{ marginBottom: 4 }}>Noch keine Verabredungen</p>
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Schlag den ersten Lauf vor – mit Treffpunkt, Uhrzeit und Tempo.
          </p>
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {runs.map((r) => (
            <article key={r.id} className="md-card">
              <div className="md-row" style={{ cursor: 'default', marginBottom: 4 }}>
                <p className="md-section-title" style={{ margin: 0 }}>{r.location}</p>
                {r.user_id === user?.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      const err = await deleteRun(r.id)
                      showSnackbar(err ? 'Löschen fehlgeschlagen: ' + err : 'Verabredung gelöscht.')
                    }}
                    className="md-plan-item__remove"
                    aria-label="Verabredung löschen"
                  >
                    <Icon name="remove" size={20} className="icon-sm" />
                  </button>
                )}
              </div>
              <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                {zeitpunkt(r.starts_at)}
                {' · '}
                {TEMPO_LABEL[r.pace]}
                {r.distance_km != null && ` · ${String(r.distance_km).replace('.', ',')} km`}
              </p>
              {r.note && (
                <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>
                  {r.note}
                </p>
              )}
              <p style={{ margin: '4px 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
                von {r.profiles?.display_name ?? 'jemandem'}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="md-info-note md-info-note--neutral">
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          Was du hier einträgst, sehen alle angemeldeten Nutzer – dein Anzeigename,
          der Treffpunkt und die Uhrzeit. Wähl den Treffpunkt so, wie du ihn
          Fremden nennen würdest.
        </p>
      </div>

      {formularOffen ? (
        <LaufFormular
          onAbbrechen={() => setFormularOffen(false)}
          onSpeichern={async (daten) => {
            const err = await createRun(daten)
            if (!err) {
              setFormularOffen(false)
              showSnackbar('Verabredung eingetragen.')
            }
            return err
          }}
        />
      ) : (
        <button
          type="button"
          className="md-button md-button--filled"
          onClick={() => setFormularOffen(true)}
        >
          Lauf vorschlagen
        </button>
      )}
    </>
  )
}

/** "Sa., 16. Aug., 09:00 Uhr" */
function zeitpunkt(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}

/** Vorgabe fuer das Datumsfeld: morgen, 09:00. */
function morgenFrueh(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  // Ortszeit im Format, das datetime-local erwartet.
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface FormularProps {
  onSpeichern: (daten: {
    location: string
    starts_at: string
    distance_km: number | null
    pace: TempoArt
    note: string | null
  }) => Promise<string | null>
  onAbbrechen: () => void
}

function LaufFormular({ onSpeichern, onAbbrechen }: FormularProps) {
  const [ort, setOrt] = useState('')
  const [wann, setWann] = useState(morgenFrueh())
  const [km, setKm] = useState('')
  const [tempo, setTempo] = useState<TempoArt>('easy')
  const [notiz, setNotiz] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ort.trim()) return

    const zeit = new Date(wann)
    if (Number.isNaN(zeit.getTime())) {
      setFehler('Bitte Datum und Uhrzeit angeben.')
      return
    }
    if (zeit.getTime() < Date.now()) {
      setFehler('Der Zeitpunkt liegt in der Vergangenheit.')
      return
    }

    const strecke = km.trim() === '' ? null : Number(km.replace(',', '.'))
    if (strecke != null && (!Number.isFinite(strecke) || strecke <= 0 || strecke > 300)) {
      setFehler('Die Strecke muss zwischen 0 und 300 km liegen.')
      return
    }

    setFehler(null)
    setSpeichert(true)
    const err = await onSpeichern({
      location: ort.trim(),
      starts_at: zeit.toISOString(),
      distance_km: strecke,
      pace: tempo,
      note: notiz.trim() || null,
    })
    setSpeichert(false)
    if (err) setFehler('Speichern fehlgeschlagen: ' + err)
  }

  return (
    <form onSubmit={absenden} className="md-card md-card--outlined">
      <p className="md-section-title">Lauf vorschlagen</p>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-ort">Treffpunkt</label>
        <input
          className="md-field__input"
          id="lauf-ort"
          type="text"
          value={ort}
          onChange={(e) => setOrt(e.target.value)}
          placeholder="z.B. Stadtpark, Nordeingang"
          required
        />
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-wann">Wann</label>
        <input
          className="md-field__input"
          id="lauf-wann"
          type="datetime-local"
          value={wann}
          onChange={(e) => setWann(e.target.value)}
          required
        />
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-km">Strecke in km (optional)</label>
        <input
          className="md-field__input"
          id="lauf-km"
          type="text"
          inputMode="decimal"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="z.B. 8"
        />
      </div>

      {/* Tempo als Auswahl statt als Zahl: "locker" versteht jeder, eine
          Pace-Angabe in min/km schreckt Anfaenger ab und passt bei einer
          Gruppe ohnehin nie genau. */}
      <div>
        <p style={{ margin: '0 0 4px', font: 'var(--type-label-lg)', color: 'var(--md-on-surface-variant)' }}>
          Tempo
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
          {TEMPO_ARTEN.map((t) => {
            const an = tempo === t.wert
            return (
              <button
                key={t.wert}
                type="button"
                aria-pressed={an}
                onClick={() => setTempo(t.wert)}
                className="md-choice-chip"
                title={t.hinweis}
                style={{
                  cursor: 'pointer',
                  background: an ? 'var(--md-primary)' : 'transparent',
                  color: an ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                  border: `1px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '4px 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          {TEMPO_ARTEN.find((t) => t.wert === tempo)?.hinweis}
        </p>
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-notiz">Notiz (optional)</label>
        <textarea
          className="md-field__input"
          id="lauf-notiz"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Wer mitkommen will, gern melden"
          rows={2}
          maxLength={500}
          style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
        />
      </div>

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={speichert}
          className="md-button md-button--compact"
          style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={speichert || !ort.trim()}
          className="md-button md-button--filled md-button--compact"
          style={{ flex: 1 }}
        >
          {speichert ? 'Wird eingetragen…' : 'Eintragen'}
        </button>
      </div>
    </form>
  )
}
