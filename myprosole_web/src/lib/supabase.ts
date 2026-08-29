import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/**
 * Nach dieser Zeit wird eine Anfrage abgebrochen - wirklich abgebrochen.
 *
 * Warum es das seit dem 29.08.2026 gibt
 * -------------------------------------
 * Am 28.08. liess sich ein Lauf ueber 6,9 km im Zug nicht beenden. Der
 * Beenden-Pfad hatte zwar eine Zeitgrenze (`lib/zeitgrenze.ts`), aber die
 * kann nur **aufgeben**, nicht abbrechen: Sie legt ein `setTimeout` neben
 * das Versprechen und lehnt ab, wenn es zuerst laeuft. Die Anfrage selbst
 * lief weiter.
 *
 * Abbrechen laesst sich nur hier. Belegt im installierten Quelltext von
 * `@supabase/auth-js` (`lib/fetch.ts`): `_getRequestParams` steigt bei GET
 * aus, **bevor** die Parameter zusammengefuehrt werden - ein `signal` kann
 * dort gar nicht ankommen. Der einzige Weg fuehrt ueber das eigene `fetch`,
 * und dieses wird nachweislich an Auth, PostgREST und Storage gleichermassen
 * durchgereicht (`SupabaseClient.ts`).
 *
 * Warum dreissig Sekunden, und nicht zwanzig: `SPEICHERN_GRENZE_MS` in
 * `lib/zeitgrenze.ts` liegt bei zwanzig. Diese Grenze ist die AEUSSERE - sie
 * soll erst greifen, wenn die fachliche Grenze schon entschieden hat, und
 * dann aufraeumen. Waere sie kuerzer, entschiede das Netz statt der
 * Fachlogik, und die Fehlermeldungen wuerden ungenauer.
 *
 * Was sie NICHT tut: einen Lauf ohne Netz abschliessen. Sie sorgt nur
 * dafuer, dass ein haengender Aufruf endet, statt im Hintergrund
 * weiterzulaufen. Der netzfreie Abschluss ist eine eigene Aufgabe.
 */
const ANFRAGE_GRENZE_MS = 30_000

/**
 * `fetch` mit Abbruch nach der Grenze.
 *
 * Ein bereits mitgegebenes `signal` wird nicht verworfen, sondern mit dem
 * eigenen verbunden - sonst nimmt diese Zeile einem Aufrufer die
 * Moeglichkeit, selbst abzubrechen.
 */
function fetchMitGrenze(eingabe: RequestInfo | URL, optionen?: RequestInit): Promise<Response> {
  const abbruch = new AbortController()
  const zeitgeber = setTimeout(() => abbruch.abort(), ANFRAGE_GRENZE_MS)

  const fremdes = optionen?.signal
  if (fremdes) {
    if (fremdes.aborted) abbruch.abort()
    else fremdes.addEventListener('abort', () => abbruch.abort(), { once: true })
  }

  return fetch(eingabe, { ...optionen, signal: abbruch.signal }).finally(() =>
    clearTimeout(zeitgeber),
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchMitGrenze },
})
