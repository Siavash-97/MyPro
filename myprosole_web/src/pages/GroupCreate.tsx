import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useGroups, type JoinPolicy } from '../store/groups'

/**
 * Gruppe gruenden.
 *
 * Das Ziel ist Pflicht, nicht Beiwerk: Eine Laufgruppe ohne erkennbares Ziel
 * zieht die Falschen an, und wer beitreten will, soll vorher wissen, worauf
 * er sich einlaesst.
 *
 * Der Fragebogen ist nur sinnvoll, wenn ueber den Beitritt entschieden wird –
 * deshalb erscheint er erst, wenn "auf Anfrage" gewaehlt ist.
 */
export default function GroupCreate() {
  const navigate = useNavigate()
  const createGroup = useGroups((s) => s.createGroup)

  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [ziel, setZiel] = useState('')
  const [regel, setRegel] = useState<JoinPolicy>('request')
  const [mitFragebogen, setMitFragebogen] = useState(false)
  const [fragen, setFragen] = useState<string[]>(['Was möchtest du in dieser Gruppe erreichen?'])
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !ziel.trim()) return

    setSpeichert(true)
    setFehler(null)
    const { id, error } = await createGroup({
      name: name.trim(),
      description: beschreibung.trim() || null,
      goal: ziel.trim(),
      join_policy: regel,
      requires_questionnaire: regel === 'request' && mitFragebogen,
      questions: regel === 'request' && mitFragebogen
        ? fragen.map((f) => f.trim()).filter(Boolean)
        : [],
    })
    setSpeichert(false)

    if (error || !id) {
      setFehler(error ?? 'Gruppe konnte nicht angelegt werden.')
      return
    }
    navigate(`/community/gruppe/${id}`, { replace: true })
  }

  return (
    <form onSubmit={absenden} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <fieldset className="md-form-section">
        <legend className="md-visually-hidden">Neue Gruppe</legend>
        <p className="md-form-section__title">Neue Gruppe</p>

        <div className="md-field">
          <label className="md-field__label" htmlFor="gruppe-name">Name</label>
          <input
            className="md-field__input"
            id="gruppe-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Morgenläufer Köln"
            maxLength={80}
            required
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="gruppe-ziel">
            Was ist das Ziel der Gruppe?
          </label>
          <textarea
            className="md-field__input"
            id="gruppe-ziel"
            value={ziel}
            onChange={(e) => setZiel(e.target.value)}
            placeholder="z.B. Gemeinsam auf den ersten Halbmarathon hinarbeiten, zweimal pro Woche"
            rows={3}
            maxLength={300}
            required
            style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
          />
          <p className="md-field__hint">
            Steht ganz oben in der Gruppe. Wer beitreten will, liest das zuerst.
          </p>
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="gruppe-beschreibung">Beschreibung (optional)</label>
          <textarea
            className="md-field__input"
            id="gruppe-beschreibung"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="Wann und wo trefft ihr euch? Für wen ist die Gruppe?"
            rows={3}
            style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
          />
        </div>
      </fieldset>

      <fieldset className="md-form-section">
        <legend className="md-visually-hidden">Beitritt</legend>
        <p className="md-form-section__title">Wer darf beitreten?</p>

        <Wahl
          an={regel === 'request'}
          titel="Auf Anfrage"
          text="Du entscheidest über jede Anfrage. Empfohlen, wenn die Gruppe klein bleiben soll."
          onClick={() => setRegel('request')}
        />
        <Wahl
          an={regel === 'open'}
          titel="Offen"
          text="Wer den Einladungslink hat, ist sofort dabei."
          onClick={() => setRegel('open')}
        />

        {regel === 'request' && (
          <>
            <label className="md-checkbox-row" htmlFor="gruppe-fragebogen" style={{ marginTop: 'var(--space-sm)' }}>
              <input
                className="md-checkbox__input"
                id="gruppe-fragebogen"
                type="checkbox"
                checked={mitFragebogen}
                onChange={(e) => setMitFragebogen(e.target.checked)}
              />
              <span className="md-checkbox-row__label">
                Fragen stellen, bevor jemand beitritt
              </span>
            </label>

            {mitFragebogen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {fragen.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
                    <div className="md-field" style={{ flex: 1 }}>
                      <label className="md-field__label" htmlFor={`frage-${i}`}>Frage {i + 1}</label>
                      <input
                        className="md-field__input"
                        id={`frage-${i}`}
                        type="text"
                        value={f}
                        maxLength={300}
                        onChange={(e) => setFragen((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    </div>
                    {fragen.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFragen((v) => v.filter((_, j) => j !== i))}
                        className="md-plan-item__remove"
                        aria-label={`Frage ${i + 1} entfernen`}
                      >
                        <Icon name="remove" size={20} className="icon-sm" />
                      </button>
                    )}
                  </div>
                ))}
                {fragen.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setFragen((v) => [...v, ''])}
                    className="md-button md-button--text md-button--compact"
                  >
                    <Icon name="plus" size={20} className="icon-sm" />
                    Frage hinzufügen
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </fieldset>

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>
      )}

      <button
        className="md-button md-button--filled"
        type="submit"
        disabled={speichert || !name.trim() || !ziel.trim()}
      >
        {speichert ? 'Wird gegründet…' : 'Gruppe gründen'}
      </button>
    </form>
  )
}

function Wahl({ an, titel, text, onClick }: { an: boolean; titel: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={an}
      className="md-card"
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: `1px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
        background: an ? 'color-mix(in srgb, var(--md-primary) 10%, transparent)' : 'transparent',
      }}
    >
      <p style={{ margin: 0, font: 'var(--type-label-lg)', color: an ? 'var(--md-primary)' : 'var(--md-on-surface)' }}>
        {titel}
      </p>
      <p style={{ margin: '2px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        {text}
      </p>
    </button>
  )
}
