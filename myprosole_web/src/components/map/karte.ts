export interface RoutePoint {
  latitude: number
  longitude: number
}

/**
 * Kartenkacheln von MapTiler. Fehlt der Schluessel, zeigt RouteMap die
 * gezeichnete Flaeche aus dem Entwurf – die App laeuft also auch ohne Konto,
 * und die Route selbst ist in beiden Faellen zu sehen.
 */
export const MAPTILER_KEY: string | undefined = import.meta.env.VITE_MAPTILER_KEY

/** Dunkler Kartenstil, passend zum dunklen App-Design. */
export const STYLE_URL = `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
