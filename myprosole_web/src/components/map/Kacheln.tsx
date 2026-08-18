import { useEffect, useRef } from 'react'
// MapLibre 6 liefert im ESM-Bundle keinen Default-Export, nur benannte. Map
// heisst hier MapLibreMap, damit es nicht mit dem eingebauten Map kollidiert.
import { Map as MapLibreMap, LngLatBounds, setWorkerUrl } from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
// Pflicht bei Vite: MapLibre sucht seinen Worker sonst ueber import.meta.url,
// und das zeigt im Bundle nicht auf die Worker-Datei. Der Worker scheitert
// dann still bei seinem ersten Import – Stil und Sprites kommen noch an, aber
// es wird nie eine Vektorkachel geholt, und die Karte bleibt leer.
//
// "?worker&url" statt nur "?url": Die Worker-Datei laedt eine Geschwister-
// datei nach. Mit "?url" wird sie unveraendert kopiert, ohne diese
// Geschwisterdatei – derselbe Fehler auf anderem Weg.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
// Ausdruecklich importiert statt ueber den globalen Namensraum: Der steht
// unter "tsc -b" nicht zur Verfuegung, nur bei "tsc --noEmit".
import type { Feature } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STYLE_URL, type RoutePoint } from './karte'

setWorkerUrl(workerUrl)

/** Farben aus dem Design-System holen – MapLibre kennt keine CSS-Variablen. */
function farbe(name: string, ersatz: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || ersatz
}

/**
 * Kommt die Karte in dieser Zeit nicht zustande, wird auf die gezeichnete
 * Route zurueckgeschaltet. Lieber die schlichte Flaeche aus dem Entwurf als
 * ein leeres Rechteck – schlechtes Netz, gesperrter Schluessel oder ein
 * Browser ohne WebGL duerfen die Seite nicht kaputtmachen.
 */
const AUFGEBEN_NACH_MS = 8000

interface Props {
  points: RoutePoint[]
  height: number
  label: string
  /** Live-Ansicht: zeigt zusaetzlich einen Ring um die aktuelle Position. */
  live: boolean
  /** Wird gerufen, wenn die Karte nicht zustande kommt. */
  onFehler: () => void
}

export default function Kacheln({ points, height, label, live, onFehler }: Props) {
  const behaelter = useRef<HTMLDivElement | null>(null)
  const karte = useRef<MapLibreMap | null>(null)
  const bereit = useRef(false)

  // Immer die neuesten Punkte, auch waehrend die Karte noch laedt. Ohne das
  // ginge alles verloren, was zwischen Aufbau und "fertig" hereinkommt.
  const punkte = useRef(points)
  punkte.current = points

  useEffect(() => {
    if (karte.current) return

    // Erst im naechsten Einzelbild aufbauen. React baut Effekte in der
    // Entwicklung absichtlich zweimal auf und raeumt dazwischen ab. Entstuende
    // die Karte sofort, wuerde die erste mitten im Laden zerstoert – und die
    // zweite kam danach nachweislich nie zum Ziel: Stil geladen, aber nie eine
    // Kachel angefordert, isStyleLoaded() dauerhaft false. So hebt das
    // Abraeumen die Anforderung auf, bevor ueberhaupt eine Karte existiert.
    let abgebrochen = false
    let m: MapLibreMap | null = null

    const angefordert = requestAnimationFrame(() => {
      if (abgebrochen || !behaelter.current) return
      m = bauen(behaelter.current, live)
      karte.current = m
    })

    const aufgeben = setTimeout(() => {
      if (!abgebrochen && !bereit.current) onFehler()
    }, AUFGEBEN_NACH_MS)

    return () => {
      abgebrochen = true
      cancelAnimationFrame(angefordert)
      clearTimeout(aufgeben)
      m?.remove()
      karte.current = null
      bereit.current = false
    }
    // Absichtlich nur einmal: Der Aufbau ist teuer, neue Punkte kommen unten
    // nach, ohne die Karte neu zu bauen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Neue Punkte nachtragen, sobald die Ebenen stehen.
  useEffect(() => {
    const m = karte.current
    if (!m || !bereit.current) return
    zeichne(m, points)
  }, [points])

  function bauen(ziel: HTMLDivElement, mitRing: boolean): MapLibreMap {
    const m = new MapLibreMap({
      container: ziel,
      style: STYLE_URL,
      center: [punkte.current[0].longitude, punkte.current[0].latitude],
      zoom: 14,
      attributionControl: { compact: true },
      // Drehen und Neigen bleiben aus – eine schraeg stehende Route hilft
      // niemandem. Zoomen ist dagegen erwuenscht.
      dragRotate: false,
      pitchWithRotate: false,
      // Zwei Finger fuer die Karte, ein Finger scrollt die Seite weiter.
      // Ohne das faengt die Karte jeden Wisch ab, und man kommt an der Stelle
      // nicht mehr durch die Seite.
      cooperativeGestures: true,
      locale: {
        'CooperativeGesturesHandler.MobileHelpText': 'Zum Zoomen zwei Finger benutzen',
        'CooperativeGesturesHandler.WindowsHelpText': 'Zum Zoomen Strg + Mausrad benutzen',
        'CooperativeGesturesHandler.MacHelpText': 'Zum Zoomen ⌘ + Mausrad benutzen',
      },
    })
    m.touchZoomRotate.disableRotation()

    // Nur echte Ausfaelle: Ein fehlendes Schriftzeichen soll die Karte nicht
    // wegwerfen, ein gesperrter Schluessel oder fehlendes WebGL schon.
    m.on('error', (ev) => {
      const text = String((ev as unknown as { error?: Error }).error?.message ?? '')
      if (/WebGL|403|401|Forbidden|Unauthorized|style/i.test(text)) onFehler()
    })

    m.on('load', () => {
      // feste-farbe-ok: Rueckfallwert: Die Karte zeichnet auf Canvas und kann CSS-Werte nicht selbst lesen
      const linienfarbe = farbe('--md-primary', '#43AFD8')

      m.addSource('route', { type: 'geojson', data: leereLinie() })
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': linienfarbe, 'line-width': 4 },
      })

      m.addSource('enden', { type: 'geojson', data: leerePunkte() })
      if (mitRing) {
        m.addLayer({
          id: 'position-ring',
          type: 'circle',
          source: 'enden',
          filter: ['==', ['get', 'art'], 'ende'],
          paint: { 'circle-radius': 14, 'circle-color': linienfarbe, 'circle-opacity': 0.15 },
        })
      }
      m.addLayer({
        id: 'enden',
        type: 'circle',
        source: 'enden',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'case', ['==', ['get', 'art'], 'start'],
            // feste-farbe-ok: Rueckfallwert wie oben
            farbe('--md-surface-variant', '#2A3138'),
            linienfarbe,
          ],
          'circle-stroke-width': 3,
          'circle-stroke-color': linienfarbe,
        },
      })

      bereit.current = true
      zeichne(m, punkte.current)
      // Merkmal fuer die Pruefskripte: Stil geladen, Ebenen stehen, Route
      // gesetzt. Ob WebGL das Bild danach auch malt, zeigt erst das Geraet.
      ziel.setAttribute('data-karte', 'bereit')
    })

    return m
  }

  return (
    <div className="md-map" style={{ height }} role="img" aria-label={label}>
      <div ref={behaelter} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}

function leereLinie() {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: [] as number[][] },
  }
}

function leerePunkte() {
  return { type: 'FeatureCollection' as const, features: [] as Feature[] }
}

function zeichne(m: MapLibreMap, points: RoutePoint[]) {
  if (points.length === 0) return

  const koordinaten = points.map((p) => [p.longitude, p.latitude])
  const linie = m.getSource('route') as GeoJSONSource | undefined
  linie?.setData({ ...leereLinie(), geometry: { type: 'LineString', coordinates: koordinaten } })

  const erster = points[0]
  const letzter = points[points.length - 1]
  const enden = m.getSource('enden') as GeoJSONSource | undefined
  enden?.setData({
    type: 'FeatureCollection',
    features: [
      punkt(erster, 'start'),
      ...(points.length > 1 ? [punkt(letzter, 'ende')] : []),
    ],
  })

  // Immer die ganze Strecke im Bild behalten. Bei einem einzelnen Punkt gibt
  // es nichts einzupassen – dann nur zentrieren, sonst zoomt MapLibre bis auf
  // Strassenlaternen-Niveau.
  if (points.length < 2) {
    m.setCenter([erster.longitude, erster.latitude])
    return
  }
  const grenzen = koordinaten.reduce(
    (b, c) => b.extend(c as [number, number]),
    new LngLatBounds(koordinaten[0] as [number, number], koordinaten[0] as [number, number]),
  )
  m.fitBounds(grenzen, { padding: 32, maxZoom: 16, duration: 400 })
}

function punkt(p: RoutePoint, art: 'start' | 'ende'): Feature {
  return {
    type: 'Feature',
    properties: { art },
    geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
  }
}
