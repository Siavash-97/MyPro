import { useMemo, useState } from 'react'
import type { ExerciseWithRelations } from '../../types'
import { CATEGORY_LABELS } from '../../lib/labels'
import Icon from '../ui/Icon'

/**
 * Uebungen suchen und auswaehlen.
 *
 * Der Katalog hat rund 80 Eintraege – ohne Filter scrollt man an allem
 * vorbei. Gefiltert wird in zwei Richtungen, weil die Daten genau das
 * hergeben: nach Koerperregion ueber die Muskelgruppen und nach Art ueber die
 * Kategorie. Beides laesst sich kombinieren, dazu eine Textsuche.
 *
 * Geprueft, bevor gebaut: Jede Uebung im Katalog hat mindestens eine
 * Muskelzuordnung, keine faellt durch das Raster. Verteilung zum Zeitpunkt
 * des Baus – Beine 69, Oberkoerper 14, Ruecken 12, Bauch 10; Kraft 58,
 * Beweglichkeit 24, Technik 4, Praevention 3.
 */

/**
 * Koerperregionen als Buendel von Muskelgruppen. "Beine" ist keine Gruppe in
 * der Datenbank, sondern die Zusammenfassung mehrerer – deshalb steht die
 * Zuordnung hier und nicht dort.
 */
const REGIONEN: Record<string, string[]> = {
  Beine: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'hip_flexors', 'tibialis'],
  Rücken: ['upper_back', 'lats', 'lower_back'],
  Bauch: ['abs', 'obliques'],
  Oberkörper: ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'lats', 'upper_back'],
}

/** Kategorien in der Reihenfolge, in der sie fuer Laufende zaehlen. */
const ARTEN = ['strength', 'mobility', 'technique', 'injury_prevention'] as const

interface Props {
  exercises: ExerciseWithRelations[]
  /** Bereits im Plan – wird ausgeblendet. */
  bereitsDrin: Set<string>
  onAdd: (exercise: ExerciseWithRelations) => void
  /** Kennung der Uebung, die gerade hinzugefuegt wird. */
  laueftId?: string | null
}

export default function ExercisePicker({ exercises, bereitsDrin, onAdd, laueftId = null }: Props) {
  const [region, setRegion] = useState<string | null>(null)
  const [art, setArt] = useState<string | null>(null)
  const [suche, setSuche] = useState('')
  // Die Suche reicht meistens. Die Chips stehen darunter erst, wenn jemand
  // sie aufklappt – sonst fuellen sie den halben Bildschirm, bevor ueberhaupt
  // eine Uebung zu sehen ist.
  const [filterOffen, setFilterOffen] = useState(false)

  const gefiltert = useMemo(() => {
    const suchbegriff = suche.trim().toLowerCase()
    return exercises.filter((ex) => {
      if (bereitsDrin.has(ex.id)) return false
      if (art && ex.category !== art) return false
      if (region) {
        const gruppen = REGIONEN[region]
        const trifft = ex.exercise_muscles?.some((m) => gruppen.includes(m.muscle_groups.slug))
        if (!trifft) return false
      }
      if (suchbegriff && !ex.name_de.toLowerCase().includes(suchbegriff)) return false
      return true
    })
  }, [exercises, bereitsDrin, region, art, suche])

  // Zaehlt nur die Chips – die Suche steht ohnehin sichtbar da.
  const aktiveFilter = (region ? 1 : 0) + (art ? 1 : 0)
  const zuruecksetzen = region || art || suche.trim()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <div className="md-field">
        <label className="md-field__label" htmlFor="uebung-suche">Übung suchen</label>
        <input
          className="md-field__input"
          id="uebung-suche"
          type="search"
          value={suche}
          placeholder="Name eingeben"
          onChange={(e) => setSuche(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={() => setFilterOffen((v) => !v)}
        aria-expanded={filterOffen}
        className="md-button md-button--text md-button--compact"
        style={{ alignSelf: 'flex-start' }}
      >
        <Icon name="tune" size={20} className="icon-sm" />
        Filter
        {aktiveFilter > 0 && ` (${aktiveFilter})`}
        <Icon name={filterOffen ? 'up' : 'chevron-down'} size={20} className="icon-sm" />
      </button>

      {filterOffen && (
        <>
          <Chipreihe
            titel="Körperregion"
            werte={Object.keys(REGIONEN)}
            beschriftung={(w) => w}
            aktiv={region}
            onWaehle={setRegion}
          />

          <Chipreihe
            titel="Art"
            werte={[...ARTEN]}
            beschriftung={(w) => CATEGORY_LABELS[w as keyof typeof CATEGORY_LABELS] ?? w}
            aktiv={art}
            onWaehle={setArt}
          />
        </>
      )}

      <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
        {gefiltert.length === 1 ? '1 Übung' : `${gefiltert.length} Übungen`}
        {zuruecksetzen && (
          <>
            {' · '}
            <button
              type="button"
              onClick={() => { setRegion(null); setArt(null); setSuche('') }}
              style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--md-primary)', font: 'inherit' }}
            >
              Filter zurücksetzen
            </button>
          </>
        )}
      </p>

      {gefiltert.length === 0 ? (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Keine Übung passt zu dieser Auswahl. Nimm einen Filter heraus.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', maxHeight: 320, overflowY: 'auto' }}>
          {gefiltert.map((ex) => (
            <button
              key={ex.id}
              type="button"
              disabled={laueftId === ex.id}
              onClick={() => onAdd(ex)}
              className="md-plan-item"
              style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer', opacity: laueftId === ex.id ? 0.5 : 1 }}
            >
              <span className="md-plan-item__body">
                {ex.name_de}
                <small>
                  {[
                    CATEGORY_LABELS[ex.category as keyof typeof CATEGORY_LABELS],
                    ex.exercise_muscles?.find((m) => m.role === 'primary')?.muscle_groups.name_de,
                  ].filter(Boolean).join(' · ')}
                </small>
              </span>
              <Icon name="plus" size={20} className="icon-sm" style={{ color: 'var(--md-primary)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Eine Reihe Filter-Chips. Nochmal antippen hebt die Auswahl auf. */
function Chipreihe({
  titel, werte, beschriftung, aktiv, onWaehle,
}: {
  titel: string
  werte: string[]
  beschriftung: (w: string) => string
  aktiv: string | null
  onWaehle: (w: string | null) => void
}) {
  return (
    <div>
      <p style={{ margin: '0 0 4px', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
        {titel}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
        {werte.map((w) => {
          const an = aktiv === w
          return (
            <button
              key={w}
              type="button"
              aria-pressed={an}
              onClick={() => onWaehle(an ? null : w)}
              className="md-choice-chip"
              style={{
                cursor: 'pointer',
                background: an ? 'var(--md-primary)' : 'transparent',
                color: an ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                border: `1px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
              }}
            >
              {beschriftung(w)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
