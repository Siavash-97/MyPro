import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import { kartenSchritt } from '../../lib/kartenaufbau'

setWorkerUrl(workerUrl)

/** Farben aus dem Design-System holen – MapLibre kennt keine CSS-Variablen. */
function farbe(name: string, ersatz: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || ersatz
}

function seiteSichtbar(): boolean {
  return document.visibilityState !== 'hidden'
}

interface Props {
  points: RoutePoint[]
  height: number
  label: string
  /** Live-Ansicht: zeigt zusaetzlich einen Ring um die aktuelle Position. */
  live: boolean
  /**
   * Die gezeichnete Route. Sie liegt unter der Karte und bleibt sichtbar, bis
   * die Karte wirklich steht – und wieder, wenn der Aufbau aufgibt. So sieht
   * der Nutzer nie eine leere graue Flaeche, und die Frist darf grosszuegig
   * sein, ohne dass ihn das Warten etwas kostet.
   */
  rueckfall: ReactNode
}

export default function Kacheln({ points, height, label, live, rueckfall }: Props) {
  const behaelter = useRef<HTMLDivElement | null>(null)
  const karte = useRef<MapLibreMap | null>(null)

  // Immer die neuesten Punkte, auch waehrend die Karte noch laedt. Ohne das
  // ginge alles verloren, was zwischen Aufbau und "fertig" hereinkommt.
  const punkte = useRef(points)
  punkte.current = points

  const [sichtbar, setSichtbar] = useState(seiteSichtbar)
  const [bereit, setBereit] = useState(false)
  // Fuer den Fehlerhorcher, der im Aufbau registriert wird und den
  // Zustandswert von damals eingeschlossen hat.
  const bereitRef = useRef(false)
  const [gescheitert, setGescheitert] = useState(false)
  // Kein Zustand, nur ein Anstoss: Ereignisse, die keine Zustandsgroesse
  // aendern (Frist abgelaufen, Instanz steht), muessen die Lage trotzdem neu
  // bewerten lassen.
  const [takt, setTakt] = useState(0)
  const neuBewerten = () => setTakt((t) => t + 1)

  /** Sichtbare Millisekunden des laufenden Versuchs. */
  const verbraucht = useRef(0)
  /** Wanduhr-Zeitpunkt des letzten Scheiterns, oder null. */
  const gescheitertSeit = useRef<number | null>(null)

  function abraeumen() {
    karte.current?.remove()
    karte.current = null
    bereitRef.current = false
  }

  function scheitern() {
    abraeumen()
    gescheitertSeit.current = performance.now()
    setGescheitert(true)
  }

  // Ohne diesen Horcher merkt die Komponente nie, dass der Bildschirm wieder
  // angeht – genau daran ist die Karte am 23.08.2026 fuer 26 Minuten
  // gestorben.
  useEffect(() => {
    const merken = () => setSichtbar(seiteSichtbar())
    document.addEventListener('visibilitychange', merken)
    return () => document.removeEventListener('visibilitychange', merken)
  }, [])

  // Die Regel selbst steht in lib/kartenaufbau.ts und ist dort geprueft. Hier
  // stehen nur die Nebenwirkungen dazu.
  useEffect(() => {
    const schritt = kartenSchritt({
      sichtbar,
      bereit,
      gescheitert,
      aufgebaut: karte.current !== null,
      seitScheiternMs:
        gescheitertSeit.current === null ? 0 : performance.now() - gescheitertSeit.current,
      verbrauchtMs: verbraucht.current,
    })

    switch (schritt.art) {
      case 'ruhen':
        return

      case 'aufgeben':
        scheitern()
        return

      case 'pause': {
        // Die gescheiterte Instanz darf nicht weiterlaufen und weiter Fehler
        // melden, waehrend wir auf den naechsten Versuch warten.
        abraeumen()
        const id = setTimeout(neuBewerten, schritt.inMs)
        return () => clearTimeout(id)
      }

      case 'aufbauen': {
        abraeumen()
        verbraucht.current = 0
        // Das Scheitern zuruecknehmen und den Aufbau der naechsten Bewertung
        // ueberlassen: Wuerde hier schon ein Einzelbild angefordert, raeumte
        // der Lauf, den setGescheitert ausloest, es sofort wieder ab.
        if (gescheitert) {
          gescheitertSeit.current = null
          setGescheitert(false)
          return
        }
        // Erst im naechsten Einzelbild aufbauen. React baut Effekte in der
        // Entwicklung absichtlich zweimal auf und raeumt dazwischen ab.
        // Entstuende die Karte sofort, wuerde die erste mitten im Laden
        // zerstoert – und die zweite kam danach nachweislich nie zum Ziel:
        // Stil geladen, aber nie eine Kachel angefordert, isStyleLoaded()
        // dauerhaft false.
        const id = requestAnimationFrame(() => {
          if (!behaelter.current) return
          karte.current = bauen(behaelter.current, live)
          // Jetzt steht eine Instanz – ab hier laeuft die Frist.
          neuBewerten()
        })
        return () => cancelAnimationFrame(id)
      }

      case 'warten': {
        const seit = performance.now()
        const id = setTimeout(neuBewerten, schritt.restMs)
        return () => {
          clearTimeout(id)
          // Nur hier wird verbraucht – ein einziger Ort. Der Aufraeumer
          // laeuft sowohl beim Ablauf der Frist als auch beim Wechsel in den
          // unsichtbaren Zustand, und beide Male ist die verstrichene Zeit
          // genau die sichtbare.
          verbraucht.current += performance.now() - seit
        }
      }
    }
    // live und bauen aendern sich waehrend eines Laufs nicht; die Karte
    // deswegen neu zu bauen waere teuer und falsch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar, bereit, gescheitert, takt])

  // Die Karte gehoert nicht dem Bewertungs-Effekt, sondern der Komponente:
  // Sie ueberlebt jede Neubewertung und stirbt erst mit ihr.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => abraeumen(), [])

  // Neue Punkte nachtragen, sobald die Ebenen stehen.
  useEffect(() => {
    if (!bereit || !karte.current) return
    zeichne(karte.current, points)
  }, [points, bereit])

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
    //
    // Und NUR waehrend des Aufbaus. Nach "bereit" waere scheitern() eine
    // Regression, die der Pruefagent am 23.08.2026 gefunden hat: Es raeumt
    // die Instanz ab, kartenSchritt antwortet bei bereit=true aber "ruhen"
    // (kein Neuaufbau, nie), und der gezeichnete Rueckfall haengt an
    // !bereit - uebrig bliebe ein leerer grauer Kasten fuer den Rest der
    // Seite. Ausloeser genuegt eine einzelne 403-Kachel. Eine stehende
    // Karte behaelt, was sie hat; eine fehlende Kachel ist ein Loch im
    // Bild, kein Grund, das Bild wegzuwerfen.
    m.on('error', (ev) => {
      if (bereitRef.current) return
      const text = String((ev as unknown as { error?: Error }).error?.message ?? '')
      if (/WebGL|403|401|Forbidden|Unauthorized|style/i.test(text)) scheitern()
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

      zeichne(m, punkte.current)
      bereitRef.current = true
      setBereit(true)
      // Merkmal fuer die Pruefskripte: Stil geladen, Ebenen stehen, Route
      // gesetzt. Ob WebGL das Bild danach auch malt, zeigt erst das Geraet.
      ziel.setAttribute('data-karte', 'bereit')
    })

    return m
  }

  return (
    <div className="md-map" style={{ height }} role="img" aria-label={label}>
      {!bereit && (
        <div className="md-map__rueckfall" aria-hidden="true">
          {rueckfall}
        </div>
      )}
      <div ref={behaelter} className="md-map__flaeche" />
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
