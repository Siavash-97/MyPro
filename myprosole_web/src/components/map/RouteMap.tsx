import { Suspense, lazy } from 'react'
import { pointsToSvgPath } from '../../lib/geo'
import { MAPTILER_KEY, type RoutePoint } from './karte'

// MapLibre wiegt rund 350 kB und wird erst geholt, wenn wirklich eine Karte
// zu sehen ist. Wer nie einen Lauf oeffnet, laedt die Bibliothek nie.
const Kacheln = lazy(() => import('./Kacheln'))

export type { RoutePoint }

interface Props {
  points: RoutePoint[]
  /** Hoehe in Pixeln. Die drei Seiten benutzen unterschiedliche. */
  height?: number
  /** Text, solange noch keine Punkte da sind. */
  leerText?: string
  label: string
  /** Live-Ansicht: zeigt zusaetzlich einen Ring um die aktuelle Position. */
  live?: boolean
}

export default function RouteMap({
  points,
  height = 140,
  leerText = 'Keine GPS-Daten',
  label,
  live = false,
}: Props) {
  const gezeichnet = (
    <div className="md-map">
      <RouteZeichnung points={points} height={height} leerText={leerText} label={label} live={live} />
    </div>
  )

  // Ohne Schluessel und ohne einen einzigen GPS-Punkt gibt es nichts zu
  // kacheln – im zweiten Fall saehe man sonst nur eine beliebige Weltkarte.
  if (!MAPTILER_KEY || points.length === 0) return gezeichnet

  // Ob die Karte zustande kommt, entscheidet ab dem 23.08.2026 Kacheln selbst
  // und nicht mehr diese Seite. Vorher stand hier ein kartenFehler-Zustand,
  // der nur in eine Richtung kippte: Nach acht Sekunden ohne Karte war sie
  // fuer den Rest des Laufs weg, auch wenn der Bildschirm wieder anging.
  // Jetzt liegt die gezeichnete Route unter der Karte, und Kacheln zieht sie
  // weg, sobald wirklich Kacheln da sind.
  return (
    <Suspense fallback={gezeichnet}>
      <Kacheln
        points={points}
        height={height}
        label={label}
        live={live}
        rueckfall={
          <RouteZeichnung points={points} height={height} leerText={leerText} live={live} />
        }
      />
    </Suspense>
  )
}

/** Die Flaeche aus dem Entwurf: angedeutete Strassen, echte Route darueber. */
function RouteZeichnung({
  points,
  height,
  leerText,
  label,
  live,
}: Omit<Required<Props>, 'label'> & { label?: string }) {
  const svgData = pointsToSvgPath(points, 320, height, 20)
  const mitte = height / 2 + 5

  return (
    // Ohne Beschriftung ist das ein Untergrund und keine eigene Aussage – die
    // Beschriftung traegt dann der Kartenrahmen darum.
    <svg
      viewBox={`0 0 320 ${height}`}
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <line className="md-map__street" x1="0" y1={height * 0.21} x2="320" y2={height * 0.21} />
      <line className="md-map__street" x1="0" y1={height * 0.5} x2="320" y2={height * 0.5} />
      <line className="md-map__street" x1="0" y1={height * 0.79} x2="320" y2={height * 0.79} />
      <line className="md-map__street" x1="60" y1="0" x2="60" y2={height} />
      <line className="md-map__street" x1="160" y1="0" x2="160" y2={height} />
      <line className="md-map__street" x1="260" y1="0" x2="260" y2={height} />
      {svgData ? (
        <>
          <path className="md-map__route" d={svgData.path} />
          <circle className="md-map__start" cx={svgData.startX} cy={svgData.startY} r="6" />
          {live && <circle className="md-map__pos-ring" cx={svgData.endX} cy={svgData.endY} r="14" />}
          <circle className="md-map__pos" cx={svgData.endX} cy={svgData.endY} r="7" />
        </>
      ) : (
        <text x="160" y={mitte} textAnchor="middle" fill="currentColor" opacity="0.3" fontSize="12">
          {leerText}
        </text>
      )}
    </svg>
  )
}
