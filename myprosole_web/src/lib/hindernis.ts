/**
 * Aus einem Fehler ein Hindernis machen - der benannte Grund, warum etwas
 * nicht geht, nie eine rohe Fehlermeldung (docs/ubiquitous-language.md).
 *
 * Warum es das seit dem 06.09.2026 gibt
 * -------------------------------------
 * `store/auth.ts` gab an neun Stellen `Promise<string | null>` zurueck: null
 * oder den rohen Supabase-Text. Keine sagte, WORAN es lag. Zwoelf
 * Aufrufstellen mussten raten und ersetzten den Text durch einen festen
 * Satz - "E-Mail oder Passwort falsch" im Funkloch, "Bitte pruefe deine
 * E-Mail-Adresse" bei einer Ratenbegrenzung. Drei davon zeigten den Rohtext
 * an. Belegt in docs/authhindernis-entwurf.md, Abschnitt 2.
 *
 * Dieses Modul ist die eine Stelle, an der uebersetzt wird. Der Vertrag
 * dafuer steht in docs/authhindernis-entwurf.md, Abschnitt 10; er wurde in
 * vier Runden befragt und vom Nutzer gegengelesen, bevor hier eine Zeile
 * entstand.
 *
 * Die Trennlinie: Existenz, nicht Inhalt
 * --------------------------------------
 * Ob ein Hindernis vorliegt, entscheidet, OB die Bibliothek ein Fehlerobjekt
 * geliefert hat - nicht, was darin steht. Bei Erfolg gibt sie null; alles
 * andere ist ein Fehlschlag, notfalls `unbekannt` ohne Rohtext. Gemessen an
 * postgrest-js (dist/index.cjs, Nicht-OK-Zweig): Ein JSON-Koerper wird
 * ungeprueft als Fehlerobjekt uebernommen, ein leerer Koerper ergibt
 * `{ message: '' }`. Ein leeres Objekt ist hier ein Fehler.
 *
 * `lib/supabaseFehler.ts` (`menschenlesbar`) entscheidet GENAU ANDERSHERUM -
 * leer heisst dort "kein Fehler". Beides ist richtig, und was die beiden
 * trennt, ist die Herkunft der Eingabe: Dort baut der Aufrufer das Objekt
 * selbst, auch bei Erfolg; hier kommt es aus der Bibliothek, die bei Erfolg
 * null gibt. Wer ein Bibliotheksobjekt zu uebersetzen hat, fragt dieses
 * Modul.
 *
 * Woran erkannt wird: am Code oder Status, nie am Wortlaut
 * ---------------------------------------------------------
 * Fehlertexte sind kein Vertrag (`supabaseFehler.ts`, seit 22.08.2026). Die
 * Merkmale sind an den Bibliotheken abgelesen, auth-js 2.112.3:
 *
 *   - `AuthError`: `__isAuthError`, `name`, `status`, `code`, `message`
 *     (dist/module/lib/errors.js:11-17)
 *   - Netzfehler wird GEWORFEN als `AuthRetryableFetchError`, status 0 oder
 *     5xx (fetch.js:22-43) - deshalb nimmt jede Funktion `unknown`
 *   - die 429-Codes: `over_request_rate_limit`, `over_email_send_rate_limit`,
 *     `over_sms_send_rate_limit` (error-codes.d.ts)
 *   - `AuthSessionMissingError` kommt OHNE Code, status 400 (errors.js:100)
 *
 * Eine Grenze, ausdruecklich: Ein geworfener `TypeError` gilt als
 * "nicht erreichbar", weil `fetch` im Browser so scheitert. Ein
 * Programmierfehler, der zufaellig ein TypeError ist, wuerde damit als
 * Netzproblem gemeldet - der Rohtext traegt dann die echte Meldung, und
 * genau dafuer wird er mitgefuehrt. Aus auth-js selbst kommt kein nackter
 * TypeError; die Bibliothek verpackt ihn (fetch.js:28).
 *
 * Die Kategorien, und warum genau diese
 * -------------------------------------
 * Zwei Kategorien sind verschieden, wenn die NAECHSTE HANDLUNG des Menschen
 * verschieden ist (Entwurf, R2-Q1):
 *
 *   abgelehnt         Eingabe pruefen        - die Datenbank hat nein gesagt
 *   zu-oft            warten                 - Ratenbegrenzung
 *   nicht-erreichbar  Empfang suchen         - Netz, Server, Zeitgrenze
 *   nicht-angemeldet  neu anmelden           - Sitzung fehlt oder abgelaufen
 *   nicht-bestaetigt  E-Mail bestaetigen     - registriert, nie bestaetigt (Runde 5)
 *   unbekannt         spaeter noch einmal    - der ehrliche Rest
 *
 * `unbekannt` benennt den Wissensstand, nie einen Ausgang: Eine
 * Zeitueberschreitung nach erfolgreichem Schreiben IST durchgekommen -
 * "nicht durchgekommen" als Name waere die teuerste Art, den Fehler von
 * `bestaetigungNachholen` zu wiederholen.
 *
 * `nicht-bestaetigt` kam in Runde 5 (07.09.2026) dazu: `email_not_confirmed`
 * beim Anmelden. `abgelehnt` haette Adresse und Kennwort beschuldigt, obwohl
 * beide stimmen; `unbekannt` haette einen bekannten Zustand als unbekannt
 * gefuehrt. Das Modul liefert die Art; den Weg zur Bestaetigungsseite
 * entscheidet die Oberflaeche.
 *
 * Der Wortlaut fuer den Menschen steht NICHT hier, sondern an der
 * Oberflaeche: Dieselbe Kategorie heisst auf Login "E-Mail oder Passwort
 * stimmt nicht" und auf Register "Diese E-Mail hat schon ein Konto"
 * (Entwurf, Q2). Der `rohtext` ist fuer den Entwickler - nie fuer den
 * Bildschirm, in der ausgelieferten Fassung nicht fuer die Konsole
 * (DEVELOPMENT_STANDARDS.md, "geschuetzte Logs").
 */

export interface Hindernis<Art extends string> {
  art: Art
  /** Die Meldung der Bibliothek, wenn sie eine hatte. Nie anzeigen. */
  rohtext: string | null
}

export type AnmeldeHindernisArt =
  | 'abgelehnt'
  | 'zu-oft'
  | 'nicht-erreichbar'
  | 'nicht-angemeldet'
  | 'nicht-bestaetigt'
  | 'unbekannt'

export type AnmeldeHindernis = Hindernis<AnmeldeHindernisArt>

export type ProfilHindernisArt = 'verweigert' | 'nicht-erreichbar' | 'nicht-angemeldet' | 'unbekannt'

export type ProfilHindernis = Hindernis<ProfilHindernisArt>

export type AblageHindernisArt =
  | 'zu-gross'
  | 'format-abgelehnt'
  | 'verweigert'
  | 'nicht-erreichbar'
  | 'nicht-angemeldet'
  | 'unbekannt'

export type AblageHindernis = Hindernis<AblageHindernisArt>

/** Was aus einem `unknown` herauszulesen ist - mehr braucht keine Regel. */
interface Merkmale {
  status: number | null
  code: string | null
  /** Das Feld `code` ist da, aber leer - postgrest-js liefert genau das bei einem Netzfehler. */
  codeLeer: boolean
  /** Storage: der eigentliche Status als String ("413"), weil `status` dort immer 400 ist. */
  statusCode: string | null
  name: string | null
  text: string | null
  /** Geworfen, ohne dass eine Antwort kam: `fetch` selbst oder ein Abbruch. */
  ohneAntwort: boolean
}

function merkmale(fehler: unknown): Merkmale | null {
  if (fehler === null || fehler === undefined) return null
  if (typeof fehler === 'string') {
    return { status: null, code: null, codeLeer: false, statusCode: null, name: null, text: fehler || null, ohneAntwort: false }
  }
  if (typeof fehler !== 'object') {
    return { status: null, code: null, codeLeer: false, statusCode: null, name: null, text: String(fehler), ohneAntwort: false }
  }
  let o = fehler as Record<string, unknown>
  let status = typeof o.status === 'number' ? o.status : null
  // Die ganze Antwort statt nur des Fehlers: `{ data, error }` bei auth-js
  // und storage-js, `{ data, error, status }` bei PostgREST. Erkannt am
  // Schluessel `error` - NICHT am Status: Bis zur Durchsicht vom 06.09.
  // wurde nur mit Status ausgepackt, und ein Erfolg `{ data, error: null }`
  // von storage-js war selbst das "Fehlerobjekt" - `unbekannt`. Der Status
  // ist nur bei PostgREST da, und nur er trennt 42501 mit Sitzung (403,
  // verweigert) von 42501 ohne (401, nicht angemeldet).
  if (Object.prototype.hasOwnProperty.call(o, 'error')) {
    if (o.error === null || o.error === undefined) return null
    if (typeof o.error !== 'object') {
      return { status, code: null, codeLeer: false, statusCode: null, name: null, text: String(o.error), ohneAntwort: false }
    }
    o = o.error as Record<string, unknown>
    fehler = o
  }
  const name = typeof o.name === 'string' ? o.name : null
  const text = typeof o.message === 'string' && o.message !== '' ? o.message : null
  return {
    status: status ?? (typeof o.status === 'number' ? o.status : null),
    code: typeof o.code === 'string' && o.code !== '' ? o.code : null,
    codeLeer: o.code === '',
    statusCode: typeof o.statusCode === 'string' && o.statusCode !== '' ? o.statusCode : null,
    name,
    text,
    // Ein nackter TypeError ist `fetch`, das gar nicht ankam; ein
    // AbortError ist die Zeitgrenze. Beides: kein Server erreicht.
    ohneAntwort:
      fehler instanceof TypeError ||
      (fehler instanceof DOMException && fehler.name === 'AbortError') ||
      // storage-js verpackt das geworfene TypeError in StorageUnknownError.
      name === 'StorageUnknownError' ||
      o.originalError instanceof TypeError,
  }
}

const ZU_OFT = ['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit']
const NICHT_ANGEMELDET = [
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'bad_jwt',
  'no_authorization',
]
const ABGELEHNT = ['invalid_credentials', 'otp_expired', 'bad_code_verifier', 'validation_failed']
const NICHT_BESTAETIGT = ['email_not_confirmed']

function nichtErreichbar(m: Merkmale): boolean {
  return (
    m.ohneAntwort ||
    m.name === 'AuthRetryableFetchError' ||
    m.status === 0 ||
    (m.status !== null && m.status >= 500)
  )
}

/** Anmeldung: signIn, Google, OAuth-Rueckweg, Code, Code erneut, Passwort. */
export function anmeldeHindernis(fehler: unknown): AnmeldeHindernis | null {
  const m = merkmale(fehler)
  if (!m) return null
  const art: AnmeldeHindernisArt = nichtErreichbar(m)
    ? 'nicht-erreichbar'
    : (m.code !== null && ZU_OFT.includes(m.code)) || m.status === 429
      ? 'zu-oft'
      : (m.code !== null && NICHT_ANGEMELDET.includes(m.code)) ||
          m.name === 'AuthSessionMissingError' ||
          m.status === 401
        ? 'nicht-angemeldet'
        : m.code !== null && ABGELEHNT.includes(m.code)
          ? 'abgelehnt'
          : m.code !== null && NICHT_BESTAETIGT.includes(m.code)
            ? 'nicht-bestaetigt'
            : 'unbekannt'
  return { art, rohtext: m.text }
}

/**
 * SQLSTATE-Codes von PostgreSQL und PGRST-Codes von PostgREST, an denen das
 * Profil-Fachgebiet erkennt. `42501` ist insufficient_privilege - die
 * Zeilenrechte haben nein gesagt. `PGRST301` ist das JWT: abgelaufen,
 * fehlend, nicht dekodierbar.
 */
const PG_VERWEIGERT = '42501'
/**
 * PGRST301 (nicht dekodierbar) und seit PostgREST 13 PGRST303 (abgelaufen) -
 * die Hostversion ist unbekannt, deshalb das Muster. Es faengt auch PGRST300
 * (JWT-Geheimnis fehlt) und PGRST302 (anonymer Zugriff abgeschaltet): beides
 * Serverkonfiguration, fuer den Menschen dasselbe - er ist nicht angemeldet.
 */
const PG_NICHT_ANGEMELDET = /^PGRST30\d$/

/**
 * Profil: die Tabelle `profiles` ueber PostgREST.
 *
 * Eine Regel, die es nur hier gibt: Ein LEERES Code-Feld (`code: ''`) ist
 * die Form, in der postgrest-js einen Netzfehler liefert (dist/index.cjs:
 * 398-432, Feld vorhanden, Inhalt leer, `status: 0` daneben). Ein echter
 * PostgREST-Fehler traegt immer einen Code (SQLSTATE oder PGRSTnnn). Ohne
 * Antwort daneben gilt das leere Feld als "nicht erreichbar"; MIT Antwort
 * und Status >= 200 ist es ein Nicht-JSON-Koerper - angekommen, unlesbar,
 * `unbekannt`. Ein Objekt GANZ OHNE Code-Feld (Gateway-HTML, geworfenes
 * Error) ist `unbekannt`, wie im Vertrag - nicht "nicht erreichbar": Bis zur
 * Durchsicht vom 06.09. stand hier "kein Code heisst keine Antwort", und
 * `new Error('boom')` war damit je nach Fachgebiet etwas anderes.
 */
export function profilHindernis(fehler: unknown): ProfilHindernis | null {
  const m = merkmale(fehler)
  if (!m) return null
  const art: ProfilHindernisArt = nichtErreichbar(m)
    ? 'nicht-erreichbar'
    : m.code === null
      // Leeres Code-Feld ohne Antwort daneben: die Netzfehler-Form von
      // postgrest-js. Alles andere ohne Code: unbekannt (Vertrag).
      ? m.codeLeer && m.status === null ? 'nicht-erreichbar' : 'unbekannt'
      : PG_NICHT_ANGEMELDET.test(m.code)
        ? 'nicht-angemeldet'
        : m.code === PG_VERWEIGERT
          ? m.status === 401 ? 'nicht-angemeldet' : 'verweigert'
          : 'unbekannt'
  return { art, rohtext: m.text }
}

/**
 * Ablage: der Behaelter `avatars` ueber Storage.
 *
 * Der Storage-Server sendet fuer "zu gross", "falsches Format" und
 * Zeilenrechte IMMER HTTP 400 (supabase/storage, error-handler.ts) - der
 * eigentliche Status steht nur als String in `statusCode`, der Code in
 * `code`. `status` ist hier deshalb nutzlos; erkannt wird am Code, mit
 * `statusCode` als Rueckfall. Ein echter 500 kommt als HTTP 500 und faellt
 * in den Kern.
 *
 * Ein fehlendes oder kaputtes JWT meldet der Server als `InvalidJWT` -
 * ebenfalls mit HTTP 400 (supabase/storage c015666, codes.ts:172-177). Ein
 * 401 kommt von dort nie; bis zur Durchsicht vom 06.09. stand hier eine
 * 401-Regel ohne Beleg.
 *
 * `AccessDenied` (statusCode "403") ist `verweigert` - unter einer
 * VORAUSSETZUNG, die hier steht, weil sie sonst nirgends steht: Auf
 * Bibliotheksebene ist AccessDenied zweideutig. Ohne Sitzung schickt
 * supabase-js den anon-Schluessel, ein gueltiges signiertes JWT mit Rolle
 * anon (kein InvalidJWT), und das laeuft in die Zeilenrechte; Postgres 42501
 * wird im Server rollenunabhaengig zu AccessDenied (storage/database/
 * errors.ts:18-22). Am einzigen Aufrufer ist es NICHT zweideutig: setAvatar
 * (store/auth.ts:262-264) sendet ohne Nutzer nichts an den Server und
 * liefert dort selbst `nicht-angemeldet`. Diese Regel gilt, solange das so
 * bleibt. Wer ablageHindernis ohne diesen Waechter benutzt, bekommt bei
 * anon-Zugriff `verweigert` statt `nicht-angemeldet` - dann gehoert der
 * Waechter dorthin, nicht eine Ausnahme hierher. (Runde 5, 07.09.2026)
 */
export function ablageHindernis(fehler: unknown): AblageHindernis | null {
  const m = merkmale(fehler)
  if (!m) return null
  const art: AblageHindernisArt = nichtErreichbar(m)
    ? 'nicht-erreichbar'
    : m.code === 'EntityTooLarge' || m.statusCode === '413'
      ? 'zu-gross'
      : m.code === 'InvalidMimeType' || m.statusCode === '415'
        ? 'format-abgelehnt'
        : m.code === 'InvalidJWT'
          ? 'nicht-angemeldet'
          : m.code === 'AccessDenied'
            ? 'verweigert'
            : 'unbekannt'
  return { art, rohtext: m.text }
}
