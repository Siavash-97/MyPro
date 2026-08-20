export function pointsToSvgPath(
  points: { latitude: number; longitude: number }[],
  width: number,
  height: number,
  padding: number,
): { path: string; startX: number; startY: number; endX: number; endY: number } | null {
  if (points.length < 2) return null

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude
    if (p.latitude > maxLat) maxLat = p.latitude
    if (p.longitude < minLng) minLng = p.longitude
    if (p.longitude > maxLng) maxLng = p.longitude
  }

  const latRange = maxLat - minLat || 0.001
  const lngRange = maxLng - minLng || 0.001
  const drawW = width - padding * 2
  const drawH = height - padding * 2

  const toX = (lng: number) => padding + ((lng - minLng) / lngRange) * drawW
  const toY = (lat: number) => padding + ((maxLat - lat) / latRange) * drawH

  const segments = points.map((p) => `${toX(p.longitude).toFixed(1)},${toY(p.latitude).toFixed(1)}`)
  const path = `M${segments.join(' L')}`
  const first = points[0]
  const last = points[points.length - 1]

  return {
    path,
    startX: toX(first.longitude),
    startY: toY(first.latitude),
    endX: toX(last.longitude),
    endY: toY(last.latitude),
  }
}

/**
 * Abstaende zwischen zwei Punkten auf der Erde.
 *
 * Warum das hier steht und nicht im Laufspeicher: Der Abstand wird an drei
 * Stellen gebraucht – beim Aufzeichnen, bei den Kilometer-Abschnitten und in
 * der Bewegungserkennung. Dreimal dieselbe Formel waere dreimal die
 * Gelegenheit, sie unterschiedlich zu schreiben.
 *
 * Bekannte Abweichung, bewusst in Kauf genommen
 * ---------------------------------------------
 * Haversine rechnet auf einer Kugel, die Erde ist aber ein abgeplattetes
 * Ellipsoid. Nachgerechnet gegen WGS84: bei 50° Nord auf Ost-West-Strecken
 * −0,308 %, also 31 Meter auf 10 Kilometer. Auf Nord-Sued-Strecken nur
 * −0,031 %.
 *
 * Der Betrag liegt unter dem GPS-Rauschen. Unangenehm ist etwas anderes: Der
 * Fehler ist richtungsabhaengig und systematisch, mittelt sich auf einer
 * Hin-und-Rueck-Strecke also nicht heraus.
 *
 * Android bringt dafuer Location.distanceTo() mit, das auf dem Ellipsoid
 * rechnet – im WebView kommen wir nicht daran. Wenn fuer die
 * Hintergrundaufzeichnung ohnehin ein natives Plugin dazukommt, faellt die
 * bessere Formel mit ab. Siehe docs/gps-genauigkeit.md, Teil 3.
 */

const ERDRADIUS_KM = 6371

function inBogenmass(grad: number): number {
  return (grad * Math.PI) / 180
}

/** Abstand in Kilometern. */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = inBogenmass(lat2 - lat1)
  const dLon = inBogenmass(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(inBogenmass(lat1)) * Math.cos(inBogenmass(lat2)) * Math.sin(dLon / 2) ** 2
  return ERDRADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Abstand in Metern. Dieselbe Rechnung, nur die Einheit, die man meist meint. */
export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return haversineKm(lat1, lon1, lat2, lon2) * 1000
}
