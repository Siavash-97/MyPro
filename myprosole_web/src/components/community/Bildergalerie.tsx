import { useRef, useState } from 'react'
import { bildAdresse, type FeedBild } from '../../store/feed'
import Icon from '../ui/Icon'

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
export default function Bildergalerie({
  bilder,
  bearbeitbar = false,
  onEntfernen,
}: {
  bilder: FeedBild[]
  bearbeitbar?: boolean
  onEntfernen?: (bild: FeedBild) => void
}) {
  const spurRef = useRef<HTMLDivElement>(null)
  const [aktiv, setAktiv] = useState(0)

  if (bilder.length === 0) return null

  const sortiert = bilder.slice().sort((a, b) => a.position - b.position)

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
              src={bildAdresse(bild.path)}
              alt={sortiert.length > 1 ? `Bild ${i + 1} von ${sortiert.length}` : ''}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block' }}
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
