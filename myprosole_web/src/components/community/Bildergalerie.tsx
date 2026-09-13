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
 *
 * Was `url: null` heisst
 * ----------------------
 * "Es gibt keine Adresse" – NICHT "die Adresse ist leer". Der Speicher hat
 * sie beim Laden verweigert oder der Stapelaufruf ist als Ganzes gescheitert
 * (`store/feed.ts`, `bildAdressen`). Daraus folgt beides, was diese Galerie
 * damit tut:
 *
 *  - Kein `src`-Attribut, nicht `src=""`. Ein leeres `src` laesst den Browser
 *    die SEITE laden und als Bild verwerfen – ein Netzaufruf fuer ein Bild,
 *    das es nicht gibt.
 *  - Kein `onNachsignieren`. Nachsignieren heilt eine ABGELAUFENE Adresse;
 *    ein Bild ohne Adresse hatte nie eine, die ablaufen konnte. Bis zum
 *    13.09.2026 kam `null` als `''` hier an, jedes leere `src` scheiterte
 *    sofort, und aus EINEM gescheiterten Stapelaufruf wurden so viele
 *    Einzelaufrufe, wie der Feed Bilder hat (Befund 6 der Pruefung).
 */
export interface GalerieBild {
  id: string
  url: string | null
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
  onNachsignieren,
}: {
  bilder: GalerieBild[]
  bearbeitbar?: boolean
  onEntfernen?: (bild: GalerieBild) => void
  /**
   * Wird gerufen, wenn ein Bild nicht geladen werden konnte - hoechstens
   * EINMAL je Kennung, bis dasselbe Bild wieder geladen hat.
   *
   * Seit dem 12.09.2026 sind die Adressen signiert und gelten eine Stunde
   * (Befund B, Scheibe 1). Liegt der Feed laenger offen und fordert der
   * Browser ein Bild neu an, antwortet der Speicher mit einem Fehler. Der
   * Aufrufer laesst dann nachsignieren.
   *
   * Warum die Galerie mitzaehlt und nicht der Aufrufer: Traegt auch die neue
   * Adresse nicht, meldet `onError` sofort wieder - ohne Sperre signierte die
   * App im Kreis, solange die Seite offen ist. Die Sperre gehoert dorthin, wo
   * das Ereignis entsteht.
   *
   * Nicht gerufen wird fuer ein Bild ohne Adresse (`url: null`) - siehe
   * GalerieBild.
   */
  onNachsignieren?: (id: string) => void
}) {
  const spurRef = useRef<HTMLDivElement>(null)
  /**
   * Kennungen, fuer die schon nachsigniert wurde und die seither nicht geladen
   * haben - siehe onNachsignieren.
   *
   * Ein Riegel, kein Schloss: Die frische Adresse laeuft ihrerseits nach einer
   * Stunde ab. Wer den Feed zwei Stunden offen liegen laesst, braucht einen
   * zweiten Versuch - sonst erholt sich das Bild nie mehr, obwohl genau dafuer
   * gebaut wurde (Befund 8 der Pruefung vom 13.09.2026). `onLoad` ist der
   * Beleg, dass die neue Adresse getragen hat, und nur er loest den Riegel.
   */
  const versucht = useRef(new Set<string>())
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
              // `?? undefined` laesst das Attribut ganz weg, `''` waere ein
              // Abruf der Seite selbst - siehe GalerieBild.
              src={bild.url ?? undefined}
              alt={sortiert.length > 1 ? `Bild ${i + 1} von ${sortiert.length}` : ''}
              loading={i === 0 ? 'eager' : 'lazy'}
              onError={() => {
                if (!onNachsignieren) return
                // Nur ein Bild, das eine Adresse HATTE, kann eine abgelaufene
                // haben. Ohne Adresse gibt es nichts nachzusignieren.
                if (bild.url === null) return
                if (versucht.current.has(bild.id)) return
                versucht.current.add(bild.id)
                onNachsignieren(bild.id)
              }}
              onLoad={(e) => {
                // Das Bild traegt wieder: Der Riegel faellt, bevor irgendetwas
                // anderes geprueft wird - er gilt fuer jedes Bild, das
                // Seitenverhaeltnis nur fuer das erste.
                versucht.current.delete(bild.id)
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
