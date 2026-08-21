import Blatt from './Blatt'

/**
 * Ein Blatt mit ein paar Moeglichkeiten, jede mit einem Satz dazu.
 *
 * Entstanden aus zwei fast gleichen Blaettern - eines fuer Beitraege, eines
 * fuer Profile. Zwei Dateien fuer dieselbe Gestalt waeren zwei
 * Schnittstellen fuer einen Gedanken gewesen; wer die eine aendert, haette
 * die andere vergessen.
 *
 * Warum jede Moeglichkeit einen Satz bekommt
 * ------------------------------------------
 * "Verbergen" und "Blockieren" klingen aehnlich und tun Verschiedenes. Wer
 * im Zweifel ist, tippt entweder falsch oder gar nicht. Ein Satz darunter
 * kostet zwei Zeilen und erspart beides.
 */
export interface Aktion {
  text: string
  /** Was passiert, in einem Satz. */
  beschreibung: string
  onWaehlen: () => void
  /** Hervorgehoben - die naheliegende Wahl. Hoechstens eine. */
  betont?: boolean
}

export default function AktionsBlatt({
  offen,
  onSchliessen,
  titel,
  aktionen,
}: {
  offen: boolean
  onSchliessen: () => void
  titel: string
  aktionen: Aktion[]
}) {
  return (
    <Blatt offen={offen} onSchliessen={onSchliessen} titel={titel}>
      <div style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        {aktionen.map((a) => (
          <div key={a.text}>
            <button
              type="button"
              className={a.betont ? 'md-button md-button--tonal' : 'md-button md-button--text'}
              style={{ justifyContent: 'flex-start', width: '100%' }}
              // Erst schliessen, dann handeln: Sonst legt sich ein zweites
              // Blatt ueber das erste, und das darunter bleibt offen zurueck.
              onClick={() => { onSchliessen(); a.onWaehlen() }}
            >
              {a.text}
            </button>
            <p style={{
              margin: '0 0 var(--space-sm)',
              font: 'var(--type-label-md)',
              color: 'var(--md-on-surface-variant)',
            }}>
              {a.beschreibung}
            </p>
          </div>
        ))}
      </div>
    </Blatt>
  )
}
