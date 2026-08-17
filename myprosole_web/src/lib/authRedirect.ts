import { Capacitor } from '@capacitor/core'

/** Route, auf der der Link aus der Bestaetigungsmail landet. */
export const CONFIRM_PATH = '/bestaetigen'

/**
 * Oeffentliche Adresse der ausgelieferten Web-App.
 *
 * Gebraucht wird sie nur in der Android-Huelle: Dort laeuft die App unter
 * `https://localhost` – eine Adresse, die es im Browser des Telefons nicht
 * gibt und die in der Redirect-Liste des Supabase-Projekts auch nicht steht.
 * Ein Link dorthin fuehrt ins Leere.
 */
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL

/**
 * Vollstaendige Adresse fuer `emailRedirectTo` beim Anlegen des Kontos.
 *
 * Im Browser die eigene Herkunft: So bleibt man in der Umgebung, in der man
 * sich registriert hat – lokal, Vorschau-Auslieferung oder Produktion. Jede
 * davon muss in der Redirect-Liste des Supabase-Projekts stehen.
 *
 * Ohne brauchbare Adresse wird `undefined` zurueckgegeben. Supabase nimmt
 * dann die Site URL des Projekts – nicht das Gewuenschte, aber besser als
 * ein zusammengebauter Unsinns-Link.
 */
export function confirmUrl(): string | undefined {
  const origin = Capacitor.isNativePlatform() ? PUBLIC_SITE_URL : window.location.origin
  if (!origin || !/^https?:\/\//.test(origin)) return undefined
  return origin.replace(/\/+$/, '') + CONFIRM_PATH
}
