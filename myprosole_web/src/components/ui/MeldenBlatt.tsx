import { useState } from 'react'
import Blatt from './Blatt'
import { freitextNoetig, gruendeFuer, meldungAbschicken, type Meldeart } from '../../lib/melden'

/**
 * Das Blatt zum Melden.
 *
 * Ein Aufruf, drei Angaben - Art, Ziel, fertig. Die Gruende, die
 * Datenbank, die Fehlerbehandlung liegen dahinter.
 *
 * Warum ein Blatt und kein eigener Bildschirm
 * -------------------------------------------
 * Wer meldet, ist meist aufgebracht. Ein Seitenwechsel reisst aus dem
 * Zusammenhang und laesst den Beitrag verschwinden, um den es geht. Das
 * Blatt legt sich darueber und gibt ihn danach zurueck.
 */
export default function MeldenBlatt({
  offen,
  onSchliessen,
  art,
  zielId,
  onFertig,
}: {
  offen: boolean
  onSchliessen: () => void
  art: Meldeart
  zielId?: string | null
  onFertig: (meldung: string) => void
}) {
  const [grund, setGrund] = useState<string | null>(null)
  const [freitext, setFreitext] = useState('')
  const [schickt, setSchickt] = useState(false)
  const [hindernis, setHindernis] = useState<string | null>(null)

  const gruende = gruendeFuer(art)
  const brauchtText = grund != null && freitextNoetig(grund)

  function zuruecksetzen() {
    setGrund(null)
    setFreitext('')
    setHindernis(null)
  }

  async function abschicken() {
    if (!grund) return
    setSchickt(true)
    const fehler = await meldungAbschicken({ art, zielId, grund, freitext })
    setSchickt(false)
    if (fehler) {
      setHindernis(fehler)
      return
    }
    zuruecksetzen()
    onSchliessen()
    onFertig('Danke. Wir sehen uns das an.')
  }

  return (
    <Blatt
      offen={offen}
      onSchliessen={() => {
        zuruecksetzen()
        onSchliessen()
      }}
      titel={art === 'support' ? 'Problem melden' : 'Melden'}
    >
      <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        {art === 'support'
          ? 'Beschreib kurz, was los ist. Wir melden uns.'
          : 'Was stimmt hier nicht? Wir sehen uns das an. Die gemeldete Person erfährt nicht, wer gemeldet hat.'}
      </p>

      <div role="radiogroup" aria-label="Grund" style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        {gruende.map((g) => (
          <button
            key={g.schluessel}
            type="button"
            role="radio"
            aria-checked={grund === g.schluessel}
            onClick={() => { setGrund(g.schluessel); setHindernis(null) }}
            className={grund === g.schluessel ? 'md-button md-button--tonal' : 'md-button md-button--text'}
            style={{ justifyContent: 'flex-start', width: '100%' }}
          >
            {g.text}
          </button>
        ))}
      </div>

      {brauchtText && (
        <div className="md-field" style={{ marginTop: 'var(--space-md)' }}>
          <label className="md-field__label" htmlFor="melden-freitext">Worum geht es?</label>
          <textarea
            id="melden-freitext"
            className="md-field__input"
            rows={3}
            maxLength={1000}
            value={freitext}
            onChange={(e) => { setFreitext(e.target.value); setHindernis(null) }}
          />
        </div>
      )}

      {hindernis && (
        <p role="alert" style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-error)' }}>
          {hindernis}
        </p>
      )}

      <button
        type="button"
        className="md-button md-button--filled"
        style={{ width: '100%', marginTop: 'var(--space-lg)' }}
        disabled={!grund || schickt || (brauchtText && !freitext.trim())}
        onClick={abschicken}
      >
        {schickt ? 'Wird gesendet …' : 'Melden'}
      </button>
    </Blatt>
  )
}
