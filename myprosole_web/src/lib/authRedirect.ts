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

/**
 * Adresse, an die Supabase nach der Google-Anmeldung zurueckschickt.
 *
 * In der Huelle ein eigenes Adressschema: Android weiss durch den
 * intent-filter im Manifest, dass `com.myprosole.app://login-callback` zu
 * dieser App gehoert, und weckt sie – statt einen Browser zu oeffnen, aus
 * dem es keinen Rueckweg gibt. Genau daran ist die Anmeldung bisher
 * gescheitert.
 *
 * Im Browser bleibt es bei der eigenen Herkunft, dort funktioniert der
 * normale Rueckweg.
 *
 * Muss in der Redirect-Liste des Supabase-Projekts stehen, sonst weist
 * Supabase die Adresse ab und nimmt die Site URL.
 */
export const NATIVE_LOGIN_CALLBACK = 'com.myprosole.app://login-callback'

export function oauthRedirectUrl(): string {
  return Capacitor.isNativePlatform() ? NATIVE_LOGIN_CALLBACK : window.location.origin
}

/** Route, auf der der Link zum Zuruecksetzen des Passworts landet. */
export const PASSWORT_NEU_PATH = '/passwort-neu'

/**
 * Ziel fuer den Link aus der Passwort-Mail.
 *
 * Dieselbe Ueberlegung wie bei der Bestaetigung: In der Huelle die
 * oeffentliche Adresse, im Browser die eigene Herkunft. Ein Tiefenverweis
 * waere hier falsch – man kommt ueber einen Link aus einer E-Mail, oft am
 * Rechner, nicht auf dem Telefon.
 *
 * Muss in der Redirect-Liste des Supabase-Projekts stehen.
 */
export function passwortNeuUrl(): string | undefined {
  const origin = Capacitor.isNativePlatform() ? PUBLIC_SITE_URL : window.location.origin
  if (!origin || !/^https?:\/\//.test(origin)) return undefined
  return origin.replace(/\/+$/, '') + PASSWORT_NEU_PATH
}
