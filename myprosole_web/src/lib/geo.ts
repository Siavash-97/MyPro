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
