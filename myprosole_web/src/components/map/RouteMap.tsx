import { Suspense, lazy, useState } from 'react'
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
  const [kartenFehler, setKartenFehler] = useState(false)

  const gezeichnet = (
    <GezeichneteRoute points={points} height={height} leerText={leerText} label={label} live={live} />
  )

  // Die gezeichnete Flaeche aus dem Entwurf ist der Rueckfallweg fuer drei
  // Faelle: kein Schluessel hinterlegt, noch kein GPS-Punkt (sonst saehe man
  // nur eine beliebige Weltkarte), und eine Karte, die nicht zustande kommt.
  // Sie dient ausserdem als Platzhalter, waehrend MapLibre nachgeladen wird.
  if (!MAPTILER_KEY || points.length === 0 || kartenFehler) return gezeichnet

  return (
    <Suspense fallback={gezeichnet}>
      <Kacheln
        points={points}
        height={height}
        label={label}
        live={live}
        onFehler={() => setKartenFehler(true)}
      />
    </Suspense>
  )
}

/** Die Flaeche aus dem Entwurf: angedeutete Strassen, echte Route darueber. */
function GezeichneteRoute({ points, height, leerText, label, live }: Required<Props>) {
  const svgData = pointsToSvgPath(points, 320, height, 20)
  const mitte = height / 2 + 5

  return (
    <div className="md-map">
      <svg viewBox={`0 0 320 ${height}`} fill="none" role="img" aria-label={label}>
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
    </div>
  )
}
