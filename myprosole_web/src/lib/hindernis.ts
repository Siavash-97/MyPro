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
 *     (dist/module/lib/errors.js, Konstruktor von `AuthError`)
 *   - Netzfehler: `AuthRetryableFetchError`, status 0 oder 5xx. Geworfen
 *     wird er in `_request` (genauer: in `_handleRequest` und `handleError`,
 *     fetch.js) - beim AUFRUFER kommt er trotzdem nicht geworfen an.
 *     Berichtigt am 07.09.2026: Bis dahin stand hier "wird GEWORFEN", und
 *     das war an der falschen Stelle nachgesehen.
 *   - Wer wirft, entscheidet `GoTrueClient.js`, nicht `fetch.js`: sieben der
 *     acht hier benutzten Methoden (`signInWithPassword`, `signUp`,
 *     `verifyOtp`, `resend`, `resetPasswordForEmail`, `updateUser`,
 *     `setSession`) fangen ihn mit
 *     `catch (error) { if (isAuthError(error)) return this._returnResult({ data, error }); throw error }`
 *     und GEBEN ihn zurueck. Die achte, `signInWithOAuth`, stellt gar keine
 *     Anfrage - sie baut ueber `_handleProviderSignIn` nur eine URL und
 *     liefert immer `error: null`.
 *   - Geworfen kommt beim Aufrufer deshalb nur an, was KEIN `AuthError` ist
 *     (`isAuthError` prueft das Feld `__isAuthError`) - oder alles, wenn
 *     jemand `throwOnError` setzt, denn dann wirft `_returnResult` selbst.
 *     DESHALB nimmt jede Funktion hier `unknown`: nicht weil der Netzfehler
 *     geworfen kaeme, sondern weil das Geworfene das Unbekannte ist.
 *   - die 429-Codes: `over_request_rate_limit`, `over_email_send_rate_limit`,
 *     `over_sms_send_rate_limit` (error-codes.d.ts)
 *   - `AuthSessionMissingError` kommt OHNE Code, status 400 (errors.js,
 *     Konstruktor von `AuthSessionMissingError`)
 *
 * Eine Grenze, ausdruecklich: Ein geworfener `TypeError` gilt als
 * "nicht erreichbar", weil `fetch` im Browser so scheitert. Ein
 * Programmierfehler, der zufaellig ein TypeError ist, wuerde damit als
 * Netzproblem gemeldet - der Rohtext traegt dann die echte Meldung, und
 * genau dafuer wird er mitgefuehrt. Aus auth-js selbst kommt kein nackter
 * TypeError; die Bibliothek verpackt ihn (fetch.js, `handleError`: was nicht
 * `looksLikeFetchResponse` ist, wird zum `AuthRetryableFetchError`).
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
/**
 * Die naechste Handlung ist bei allen dieselbe: EINGABE AENDERN. Genau das
 * ist das Trennkriterium des Vertrags (docs/authhindernis-entwurf.md, R2-Q1:
 * "Zwei Kategorien sind verschieden, wenn die naechste Handlung des Menschen
 * verschieden ist") - also eine Kategorie, keine zweite daneben.
 *
 * Die letzten drei kamen am 07.09.2026 dazu, entschieden vom Nutzer:
 * `weak_password` (zu kurz/zu einfach), `same_password` (das neue ist das
 * alte), `email_address_invalid` (die Adresse taugt nicht). Alle drei stehen
 * in `error-codes.d.ts` (auth-js 2.112.3). `weak_password` kommt dabei nicht
 * als AuthApiError, sondern als eigene Klasse `AuthWeakPasswordError` mit
 * einem Feld `reasons`; den Code setzt sie selbst (errors.js), er ist also
 * da - erkannt wird am Code, nicht am Klassennamen.
 */
const ABGELEHNT = [
  'invalid_credentials', 'otp_expired', 'bad_code_verifier', 'validation_failed',
  'weak_password',
  'same_password',
  'email_address_invalid',
]
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
 * die Form, in der postgrest-js einen Netzfehler liefert (dist/index.cjs,
 * `PostgrestBuilder.then`, der `res.catch`-Zweig ohne `shouldThrowOnError`:
 * Feld vorhanden, Inhalt leer, `status: 0` daneben). Ein echter
 * PostgREST-Fehler traegt immer einen Code (SQLSTATE oder PGRSTnnn). Ohne
 * Antwort daneben gilt das leere Feld als "nicht erreichbar"; MIT Antwort
 * und Status >= 200 ist es ein Nicht-JSON-Koerper - angekommen, unlesbar,
 * `unbekannt`. Ein Objekt GANZ OHNE Code-Feld (Gateway-HTML, geworfenes
 * Error) ist `unbekannt`, wie im Vertrag - nicht "nicht erreichbar": Bis zur
 * Durchsicht vom 06.09. stand hier "kein Code heisst keine Antwort", und
 * `new Error('boom')` war damit je nach Fachgebiet etwas anderes.
 *
 * WORAN DER 401-ZWEIG HAENGT: AM SCHLUESSELFORMAT, NICHT AM WAECHTER
 * ------------------------------------------------------------------
 * Nachgesehen bei der Sicherheitspruefung (08.09.2026). `42501` mit Status
 * 401 heisst "nicht angemeldet" - aber ob dieser Status ueberhaupt je
 * ankommt, entscheidet nicht der Aufrufer, sondern das FORMAT des
 * API-Schluessels:
 *
 *   - PostgREST antwortet auf `42501` mit 403, wenn die Anfrage eine Rolle
 *     traegt, sonst mit 401 (`Error.hs:247`, `"42501" -> if authed then 403
 *     else 401`; `authed = containsRole` in `Auth.hs:81-82` - ein JWT traegt
 *     `role`). Belegt ist das an PostgREST 9.0.1; welche Version die
 *     gehostete Instanz faehrt, ist unbekannt (dieselbe Luecke wie bei
 *     `PG_NICHT_ANGEMELDET` darueber). Gemessen hat das die
 *     Sicherheitspruefung, nicht dieses Repository.
 *   - Ein ALTER JWT-Schluessel (`eyJ…`) IST ein signiertes JWT mit Rolle
 *     `anon`. Er geht als Bearer hinaus, PostgREST sieht eine Rolle -
 *     also 403, nie 401. Genau so ein Schluessel steht heute in
 *     `.env.production`.
 *   - Ein Schluessel im neuen Format (`sb_publishable_…`) ist kein JWT und
 *     traegt keine Rolle. Wo er nicht als Bearer mitgeht, sieht PostgREST
 *     keine Rolle - dann kommt 401.
 *
 * MESSGRENZE, ausdruecklich, weil sie den Zweig anders schneidet als
 * erwartet: In supabase-js 2.112.3 haengt das Weglassen des Bearer an der
 * Option `omitApiKeyAsBearer`, und der Client setzt sie NUR fuer die
 * Edge-Functions (`dist/index.mjs:657`). Der `fetch`, den PostgREST und
 * Storage benutzen, wird ohne sie gebaut (`:656`), damit ist
 * `allowKeyAsBearer` dort immer wahr (`:296`) - auch ein
 * `sb_publishable_`-Schluessel ginge als Bearer hinaus. Nach dieser Messung
 * ist der 401-Zweig also mit KEINEM der beiden Formate erreichbar, solange
 * diese Bibliotheksfassung PostgREST bedient.
 *
 * DER STAERKERE GRUND, an EINER der beiden Aufrufstellen: DER STATUS KOMMT
 * HIER GAR NICHT AN (N3 der zweiten Durchsicht, 09.09.2026)
 * ---------------------------------------------------------------------
 * Die zwei Messungen darueber haengen an Schluesselformat und
 * Bibliotheksfassung - beides kann sich aendern. Auf dem Weg
 * `setAvatar` Phase 2 gibt es einen Grund, der von beidem unabhaengig ist:
 * Was dort ankommt, TRAEGT NIE EINEN STATUS, egal was der Server schickt.
 *
 *   - `Auftrag.zeileSchreiben` gibt laut Typ nur `{ data, error }` zurueck
 *     (`lib/dateiAblegen.ts:111-113`) - die Antworthuelle mit `status`
 *     daneben ist in der Signatur gar nicht vorgesehen.
 *   - `dateiMitZeile` legt in `Ergebnis.roh` genau dieses `error`, nackt
 *     (`lib/dateiAblegen.ts:293`, `roh = ergebnis.error`).
 *   - `setAvatar` reicht `ergebnis.roh` weiter (`store/auth.ts:563`).
 *   - postgrest-js 2.112.3 legt in das Fehlerobjekt selbst nie einen
 *     Status: Es ist entweder der geparste Fehlerkoerper von PostgREST
 *     (`{ code, details, hint, message }`) oder `{ message: body }`; der
 *     Status steht ausserhalb, in der Huelle
 *     (`dist/index.mjs:489-509`, `processResponse`, und `:420-432` fuer den
 *     Netzfehler).
 *   - `merkmale` liest `status` vom uebergebenen Objekt (`:157`, `:176`).
 *     Ohne Huelle also `null`.
 *
 * Auf DIESEM Weg ist der 401-Zweig somit nicht nur heute unerreichbar,
 * sondern bleibt es auch nach einem Schluesselwechsel - `m.status` ist
 * `null`, und `42501` ergibt immer `verweigert`. Die andere Aufrufstelle
 * ist davon nicht betroffen: `createProfile` uebergibt die GANZE Antwort
 * (`store/auth.ts:668`, `profilHindernis(antwort)`), dort traegt `status`
 * einen Wert, und dort wuerde ein Schluesselwechsel den Zweig beleben.
 *
 * NEBENWIRKUNG derselben Ursache, damit sie niemand fuer einen Fehler
 * haelt: Auch `nichtErreichbar` sieht auf diesem Weg keinen Status, also
 * kann `m.status >= 500` hier nie `nicht-erreichbar` ergeben. Das faellt
 * nicht auf, und zwar aus zwei getrennten Gruenden: Online tragen
 * `nicht-erreichbar` und `unbekannt` denselben Satz
 * (`pages/Profile.tsx:58-59`, beide auf `fehlschlag`), und offline scheitert
 * `fetch` vor jedem Status - postgrest-js baut dann ein Fehlerobjekt mit
 * LEEREM `code` (`dist/index.mjs:420-432`), und der Zweig `codeLeer &&
 * status === null` unten faengt es als `nicht-erreichbar`.
 *
 * Der Zweig bleibt trotzdem stehen: Er kostet nichts, er ist richtig, wenn
 * der Status kommt - bei `createProfile` kommt er -, und beide Bedingungen
 * darueber koennen sich aendern: ein Schluesselwechsel, eine
 * Bibliotheksfassung, ein Zwischenstueck, das den Kopf setzt. Was NICHT
 * bleiben darf, ist der Eindruck, hier haenge etwas am Waechter des
 * Aufrufers: Das tut es nicht.
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
 * ebenfalls mit HTTP 400 (`src/internal/errors/codes.ts`, `ErrorCode.InvalidJWT`
 * und die Fabrik `InvalidJWT:` mit `httpStatusCode: 400`; supabase/storage,
 * c015666). Ein 401 kommt von dort nie; bis zur Durchsicht vom 06.09. stand
 * hier eine 401-Regel ohne Beleg.
 *
 * `AccessDenied` (statusCode "403") ist `verweigert` - unter einer
 * VORAUSSETZUNG, die hier steht, weil sie sonst nirgends steht: Auf
 * Bibliotheksebene ist AccessDenied zweideutig. Ohne Sitzung schickt
 * supabase-js den anon-Schluessel, ein gueltiges signiertes JWT mit Rolle
 * anon (kein InvalidJWT), und das laeuft in die Zeilenrechte; Postgres 42501
 * wird im Server rollenunabhaengig zu AccessDenied
 * (`src/storage/database/errors.ts`, `fromDBError`, Zweig `case '42501'` ->
 * `ERRORS.AccessDenied`; supabase/storage, c015666). Am einzigen Aufrufer
 * ist es NICHT zweideutig: setAvatar (store/auth.ts, Waechter `if (!user)`)
 * sendet ohne Nutzer nichts und liefert heute den Satz 'Nicht angemeldet';
 * mit Commit 4c wird daraus `{ art: 'nicht-angemeldet' }`, ohne dieses Modul
 * zu fragen. Diese Regel gilt, solange das so bleibt. Wer ablageHindernis
 * ohne diesen Waechter benutzt, bekommt bei anon-Zugriff `verweigert` statt
 * `nicht-angemeldet` - dann gehoert der Waechter dorthin, nicht eine
 * Ausnahme hierher. (Runde 5, 07.09.2026)
 *
 * WIE WEIT DER WAECHTER TRAEGT - nachgesehen bei der Sicherheitspruefung
 * (08.09.2026), weil der Satz darueber mehr verspricht, als er halten kann
 * ------------------------------------------------------------------------
 * `get().user` in `setAvatar` ist ein ZUSTAND DES SPEICHERS, keine gueltige
 * Sitzung. Zwischen dem Waechter und der Antwort kann die Sitzung sterben:
 * Die Erneuerung scheitert, und `SIGNED_OUT` erreicht den Speicher erst
 * ueber den Zuhoerer - also spaeter. In diesem Fenster steht `user` noch da,
 * der Waechter laesst durch, und supabase-js sendet, was es dann hat.
 * Gemessen an supabase-js 2.112.3: `_getSessionToken` (dist/index.mjs) gibt
 * `null`, wenn `getSession()` keine Sitzung mehr liefert; in `fetchWithAuth`
 * (:302) wird daraus `Bearer <API-Schluessel>` statt `Bearer <JWT>`.
 *
 * DIE FOLGE IST EIN FALSCHER SATZ, KEIN ZUGRIFF: Der anon-Schluessel traegt
 * die Rolle `anon`, die Zeilenrechte lehnen ab, und der Mensch liest "Das
 * Speichern wurde nicht erlaubt" statt "Deine Anmeldung ist abgelaufen".
 * Er sucht den Fehler bei der Berechtigung statt bei der Anmeldung. Nichts
 * geht dabei hinaus, was nicht hinaus darf - die Zeilenrechte entscheiden,
 * nicht der Waechter. Der Waechter schaerft die Diagnose, er ersetzt sie
 * nicht.
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
