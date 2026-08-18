import { useRef, useState } from 'react'
import Icon from '../ui/Icon'

/**
 * Ein Bild fuer die Galerie – nur Kennung und Adresse.
 *
 * Bewusst nicht der Datenbanktyp: Beim Schreiben gibt es noch keine
 * gespeicherten Bilder, sondern nur oertliche Vorschau-Adressen. Mit
 * diesem kleinsten gemeinsamen Nenner benutzt die Vorschau dieselbe
 * Galerie wie der fertige Beitrag – und sieht deshalb vorher genauso aus
 * wie nachher.
 */
export interface GalerieBild {
  id: string
  url: string
}

/**
 * Mehrere Bilder eines Beitrags – zum Wischen, mit Punkten darunter.
 *
 * Warum ohne Bibliothek
 * ---------------------
 * Das Wischen macht der Browser selbst: `scroll-snap-type: x mandatory` auf
 * dem Behaelter, `scroll-snap-align: center` auf jedem Bild. Damit rastet
 * jedes Bild ein, der Schwung fuehlt sich an wie ueberall sonst auf dem
 * Geraet, und es gibt nichts, was bei einem Browser-Update brechen kann.
 * Eine Bibliothek dafuer waere ein paar hundert Kilobyte fuer etwas, das
 * drei CSS-Zeilen koennen.
 *
 * Welcher Punkt leuchtet, ergibt sich aus der Scrollposition – nicht aus
 * einem eigenen Zustand, den man mit dem Wischen synchron halten muesste.
 * Eine Ableitung kann nicht auseinanderlaufen.
 */
/**
 * Grenzen des Bildausschnitts, wie es die grossen Netze halten.
 *
 * Instagram und Strava zeigen nicht jedes Bild in seinen Originalmassen –
 * sonst waere ein Hochformat vom Telefon ein Turm, durch den alle anderen
 * hindurchscrollen muessen, und ein Panorama ein Strich. Stattdessen
 * bekommt jeder Beitrag EIN Seitenverhaeltnis, und alle seine Bilder
 * fuellen diesen Rahmen aus (object-fit: cover).
 *
 * Das Verhaeltnis kommt vom ersten Bild, wird aber begrenzt:
 *
 *   0.8  = 4:5    hoechstes erlaubtes Hochformat
 *   1.91 = 1.91:1 breitestes erlaubtes Querformat
 *
 * Ein Hochformat bleibt also hochkant, ein Querformat quer – nur eben nicht
 * unbegrenzt. Und alle Bilder eines Beitrags teilen sich den Rahmen, was
 * fuer eine Galerie zum Wischen ohnehin noetig ist.
 *
 * An der Qualitaet aendert das nichts: Hochgeladen und gespeichert wird
 * unveraendert das Original. Beschnitten wird nur die Anzeige – wie beim
 * Rahmen um ein Foto, nicht wie bei der Schere.
 */
const HOECHSTES_HOCHFORMAT = 0.8
const BREITESTES_QUERFORMAT = 1.91

export default function Bildergalerie({
  bilder,
  bearbeitbar = false,
  onEntfernen,
}: {
  bilder: GalerieBild[]
  bearbeitbar?: boolean
  onEntfernen?: (bild: GalerieBild) => void
}) {
  const spurRef = useRef<HTMLDivElement>(null)
  const [aktiv, setAktiv] = useState(0)
  // Wird vom ersten Bild gesetzt, sobald es geladen ist. Bis dahin ein
  // ruhiges Quadrat – so springt der Aufbau nicht, waehrend geladen wird.
  const [verhaeltnis, setVerhaeltnis] = useState(1)

  if (bilder.length === 0) return null

  const sortiert = bilder

  // Aus der Scrollposition ablesen, welches Bild mittig steht.
  const beimScrollen = () => {
    const spur = spurRef.current
    if (!spur) return
    const index = Math.round(spur.scrollLeft / spur.clientWidth)
    setAktiv(Math.min(Math.max(index, 0), sortiert.length - 1))
  }

  const zeigeBild = (index: number) => {
    const spur = spurRef.current
    if (!spur) return
    spur.scrollTo({ left: index * spur.clientWidth, behavior: 'smooth' })
  }

  return (
    <div style={{ marginTop: 'var(--space-sm)' }}>
      <div
        ref={spurRef}
        onScroll={beimScrollen}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          borderRadius: 'var(--radius-lg)',
          aspectRatio: String(verhaeltnis),
          background: 'var(--md-surface-container-high)',
          // Die Leiste selbst verstecken – die Punkte darunter sagen
          // dasselbe, nur ruhiger.
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {sortiert.map((bild, i) => (
          <div
            key={bild.id}
            style={{
              flex: '0 0 100%',
              scrollSnapAlign: 'center',
              position: 'relative',
              lineHeight: 0,
            }}
          >
            <img
              src={bild.url}
              alt={sortiert.length > 1 ? `Bild ${i + 1} von ${sortiert.length}` : ''}
              loading={i === 0 ? 'eager' : 'lazy'}
              onLoad={(e) => {
                if (i !== 0) return
                const b = e.currentTarget
                if (!b.naturalWidth || !b.naturalHeight) return
                const roh = b.naturalWidth / b.naturalHeight
                setVerhaeltnis(
                  Math.min(Math.max(roh, HOECHSTES_HOCHFORMAT), BREITESTES_QUERFORMAT),
                )
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {bearbeitbar && onEntfernen && (
              <button
                type="button"
                onClick={() => onEntfernen(bild)}
                aria-label={`Bild ${i + 1} entfernen`}
                style={{
                  position: 'absolute', top: 8, right: 8, width: 36, height: 36,
                  borderRadius: '50%', border: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--md-scrim)', color: 'var(--md-on-scrim)',
                }}
              >
                <Icon name="remove" size={20} className="icon-sm" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Punkte nur, wenn es etwas zu wischen gibt. Bei einem Bild waeren
          sie ein Hinweis auf etwas, das es nicht gibt. */}
      {sortiert.length > 1 && (
        <div
          role="tablist"
          aria-label="Bilder"
          style={{
            display: 'flex', justifyContent: 'center', gap: 6,
            marginTop: 'var(--space-sm)',
          }}
        >
          {sortiert.map((bild, i) => (
            <button
              key={bild.id}
              type="button"
              role="tab"
              aria-selected={i === aktiv}
              aria-label={`Bild ${i + 1}`}
              onClick={() => zeigeBild(i)}
              style={{
                width: i === aktiv ? 8 : 6,
                height: i === aktiv ? 8 : 6,
                padding: 0,
                borderRadius: '50%',
                border: 0,
                cursor: 'pointer',
                transition: 'width .15s, height .15s, background .15s',
                background: i === aktiv
                  ? 'var(--md-primary)'
                  : 'var(--md-outline-variant)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
