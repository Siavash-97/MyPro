import { describe, expect, it } from 'vitest'
import { ablageHindernis, anmeldeHindernis, profilHindernis } from './hindernis'

/**
 * Die Formen der Eingabe sind an den Bibliotheken abgelesen, nicht
 * erfunden (auth-js 2.112.3, `dist/module/lib/errors.js` und `fetch.js`):
 *
 *   - `AuthError`: `__isAuthError: true`, `name`, `status`, `code`, `message`
 *   - Netzfehler wird GEWORFEN: `AuthRetryableFetchError`, `status` 0 oder
 *     5xx (NETWORK_ERROR_CODES in fetch.js:22)
 *   - die drei 429-Codes stehen in `error-codes.d.ts`
 *
 * Nachgebaut als Objekte mit genau diesen Feldern, nicht ueber die Klassen
 * importiert: Das Modul soll an der FORM erkennen, nicht an der Herkunft -
 * sonst faellt es um, sobald jemand ein Objekt aus einem `catch` hineingibt.
 */
function authFehler(code: string | undefined, status: number, message = 'x') {
  return { __isAuthError: true, name: 'AuthApiError', status, code, message }
}

describe('anmeldeHindernis', () => {
  it('null heisst: es hat geklappt', () => {
    expect(anmeldeHindernis(null)).toBeNull()
    expect(anmeldeHindernis(undefined)).toBeNull()
  })

  it('die Existenz entscheidet, nicht der Inhalt: ein leeres Objekt ist ein Hindernis', () => {
    // postgrest-js baut bei leerem Antwortkoerper `{ message: '' }`; auth-js
    // kann ein Objekt ohne Code liefern. Beides ist ein Fehlschlag, nur
    // ohne Auskunft - nie "kein Fehler". Das ist die Umkehrung von
    // `menschenlesbar`, und der Unterschied ist die Herkunft der Eingabe:
    // hier kommt das Objekt aus der Bibliothek, die bei Erfolg null gibt.
    expect(anmeldeHindernis({})).toEqual({ art: 'unbekannt', rohtext: null })
    expect(anmeldeHindernis({ message: '' })).toEqual({ art: 'unbekannt', rohtext: null })
  })

  it('zu-oft: am Code, nicht am Text - alle drei', () => {
    for (const code of ['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit']) {
      expect(anmeldeHindernis(authFehler(code, 429, 'Request rate limit reached'))).toEqual({
        art: 'zu-oft',
        rohtext: 'Request rate limit reached',
      })
    }
    // 429 ohne bekannten Code: ein Gateway mit JSON-Koerper (Kong) - angenommen,
    // nicht belegt. Ein HTML-Koerper wuerde AuthUnknownError ohne status und
    // damit `unbekannt`, nicht `zu-oft` (fetch.js:39).
    expect(anmeldeHindernis(authFehler(undefined, 429))?.art).toBe('zu-oft')
  })

  it('nicht-erreichbar: geworfener Netzfehler, status 0, 5xx', () => {
    expect(anmeldeHindernis(new TypeError('Failed to fetch'))).toEqual({
      art: 'nicht-erreichbar',
      rohtext: 'Failed to fetch',
    })
    expect(
      anmeldeHindernis({ __isAuthError: true, name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })?.art,
    ).toBe('nicht-erreichbar')
    // 5xx kommt aus auth-js NIE als AuthApiError, sondern als
    // AuthRetryableFetchError mit dem Status (fetch.js:41-43).
    expect(
      anmeldeHindernis({ __isAuthError: true, name: 'AuthRetryableFetchError', status: 502, message: 'HTTP 502' })?.art,
    ).toBe('nicht-erreichbar')
    // Abgebrochen (Zeitgrenze): der Server wurde nicht erreicht.
    expect(anmeldeHindernis(new DOMException('aborted', 'AbortError'))?.art).toBe('nicht-erreichbar')
  })

  it('nicht-angemeldet: Sitzung fehlt oder ist abgelaufen', () => {
    for (const code of ['session_not_found', 'session_expired', 'refresh_token_not_found', 'bad_jwt', 'no_authorization']) {
      expect(anmeldeHindernis(authFehler(code, 401))?.art).toBe('nicht-angemeldet')
    }
    // auth-js wirft AuthSessionMissingError ohne Code, status 400.
    expect(
      anmeldeHindernis({ __isAuthError: true, name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' })?.art,
    ).toBe('nicht-angemeldet')
  })

  it('abgelehnt: die Eingabe stimmt nicht - Passwort, Code, Codeablauf', () => {
    for (const code of ['invalid_credentials', 'otp_expired', 'bad_code_verifier', 'validation_failed']) {
      expect(anmeldeHindernis(authFehler(code, 400))?.art).toBe('abgelehnt')
    }
  })

  it('nicht-bestaetigt: die Adresse ist registriert, aber nie bestaetigt - Runde 5', () => {
    // Naechste Handlung: E-Mail bestaetigen. Weder Eingabe pruefen (abgelehnt -
    // beschuldigt Adresse und Kennwort, obwohl beide stimmen) noch spaeter
    // noch einmal (unbekannt - fuehrt einen bekannten Zustand als unbekannt).
    expect(anmeldeHindernis(authFehler('email_not_confirmed', 400, 'Email not confirmed'))).toEqual({
      art: 'nicht-bestaetigt',
      rohtext: 'Email not confirmed',
    })
  })

  it('unbekannt: der ehrliche Rest, mit Rohtext fuer den Entwickler', () => {
    expect(anmeldeHindernis(authFehler('signup_disabled', 422, 'Signups not allowed'))).toEqual({
      art: 'unbekannt',
      rohtext: 'Signups not allowed',
    })
    // Ein geworfenes Error, das kein Netzfehler ist.
    expect(anmeldeHindernis(new Error('boom'))).toEqual({ art: 'unbekannt', rohtext: 'boom' })
    // Etwas, das gar kein Objekt ist.
    expect(anmeldeHindernis('kaputt')).toEqual({ art: 'unbekannt', rohtext: 'kaputt' })
  })

  it('der Rohtext ist die Meldung - und nie ein leerer String', () => {
    expect(anmeldeHindernis(authFehler('invalid_credentials', 400, ''))?.rohtext).toBeNull()
    expect(anmeldeHindernis(authFehler('invalid_credentials', 400, 'Invalid login credentials'))?.rohtext).toBe(
      'Invalid login credentials',
    )
  })
})

/**
 * PostgREST (Tabelle `profiles`). Abgelesen an postgrest-js 2.112.3,
 * `dist/index.cjs`:
 *
 *   - `PostgrestError`: `code`, `message`, `details`, `hint` - KEIN status
 *     im Fehlerobjekt (der steht in der Antwort daneben)
 *   - ein Netzfehler wird NICHT geworfen, sondern als Objekt mit `code: ''`
 *     und `message: 'TypeError: Failed to fetch'` geliefert (:398-432)
 *   - ein echter PostgREST-Fehler traegt immer einen Code: SQLSTATE
 *     (`42501` insufficient_privilege) oder `PGRSTnnn` (`PGRST301` JWT)
 */
function pgFehler(code: string, message = 'x') {
  return { code, message, details: '', hint: '' }
}

describe('profilHindernis', () => {
  it('null heisst: es hat geklappt', () => {
    expect(profilHindernis(null)).toBeNull()
  })

  it('verweigert: die Zeilenrechte haben nein gesagt (42501)', () => {
    expect(profilHindernis(pgFehler('42501', 'permission denied for table profiles'))).toEqual({
      art: 'verweigert',
      rohtext: 'permission denied for table profiles',
    })
  })

  it('nicht-angemeldet: JWT abgelaufen oder fehlend - PGRST301 und, seit PostgREST 13, PGRST303', () => {
    expect(profilHindernis(pgFehler('PGRST301', 'JWT could not be decoded'))?.art).toBe('nicht-angemeldet')
    expect(profilHindernis(pgFehler('PGRST303', 'JWT expired'))?.art).toBe('nicht-angemeldet')
  })

  it('42501 ist zweideutig - die Antwort daneben entscheidet', () => {
    // PostgREST: 403 mit Sitzung (verweigert), 401 ohne Sitzung - dann hat
    // supabase-js den anon-Schluessel geschickt (nicht angemeldet). Das
    // Fehlerobjekt traegt keinen Status; die Antwort `{ error, status }` schon.
    const rls = pgFehler('42501', 'new row violates row-level security policy')
    expect(profilHindernis({ error: rls, status: 403, data: null })?.art).toBe('verweigert')
    expect(profilHindernis({ error: rls, status: 401, data: null })?.art).toBe('nicht-angemeldet')
    // Nur das Fehlerobjekt, ohne Antwort: verweigert - der ehrlichere der beiden.
    expect(profilHindernis(rls)?.art).toBe('verweigert')
  })

  it('code leer mit Antwort: status 0 ist Netz, status 2xx ist Nicht-JSON', () => {
    expect(profilHindernis({ error: pgFehler('', 'TypeError: Failed to fetch'), status: 0, data: null })?.art).toBe('nicht-erreichbar')
    expect(profilHindernis({ error: pgFehler('', 'x'), status: 200, data: null })?.art).toBe('unbekannt')
  })

  it('nicht-erreichbar: das LEERE Code-Feld ist die Netzfehler-Form von postgrest-js', () => {
    expect(profilHindernis(pgFehler('', 'TypeError: Failed to fetch'))?.art).toBe('nicht-erreichbar')
    // Und der geworfene Fall, falls jemand doch direkt fetch benutzt.
    expect(profilHindernis(new TypeError('Failed to fetch'))?.art).toBe('nicht-erreichbar')
  })

  it('GAR KEIN Code-Feld ist unbekannt, nicht "nicht erreichbar" - wie im Vertrag', () => {
    // Nicht-OK-Antwort mit HTML-Koerper (Gateway): angekommen, unlesbar.
    expect(profilHindernis({ message: '<html>502 Bad Gateway</html>' })?.art).toBe('unbekannt')
    // Ein geworfenes Error ist in jedem Fachgebiet dasselbe.
    expect(profilHindernis(new Error('boom'))).toEqual({ art: 'unbekannt', rohtext: 'boom' })
  })

  it('die Existenz entscheidet: leer ist ein Hindernis, nicht Erfolg', () => {
    expect(profilHindernis({ message: '' })).toEqual({ art: 'unbekannt', rohtext: null })
  })

  it('unbekannt: ein Code, den keine Regel kennt, mit Rohtext', () => {
    expect(profilHindernis(pgFehler('23505', 'duplicate key value'))).toEqual({
      art: 'unbekannt',
      rohtext: 'duplicate key value',
    })
  })
})

/**
 * Storage (Bucket `avatars`). Abgelesen an storage-js 2.112.3
 * (`dist/index.cjs:295-332`) und am Server (supabase/storage, c015666):
 *
 *   - der Server sendet fuer "zu gross", "falsches Format" und Zeilenrechte
 *     IMMER HTTP 400; der eigentliche Status steht nur als String in
 *     `statusCode` ("413" / "415" / "403"), der Code in `code`
 *   - `error.status` (Zahl) ist deshalb nutzlos - erkannt wird am `code`
 *   - Netzfehler: `StorageUnknownError` mit `originalError` (TypeError),
 *     status/statusCode/code undefined
 */
function storageFehler(code: string | undefined, statusCode: string, message = 'x') {
  return { __isStorageError: true, name: 'StorageApiError', status: 400, statusCode, code, message }
}

describe('ablageHindernis', () => {
  it('null heisst: es hat geklappt', () => {
    expect(ablageHindernis(null)).toBeNull()
  })

  it('die Huelle OHNE status - storage-js und auth-js liefern { data, error } - wird ausgepackt', () => {
    // Durchsicht vom 06.09.: Ohne diese Regel wurde der ERFOLG
    // `{ data, error: null }` selbst als Fehlerobjekt gelesen - `unbekannt`.
    // Die Umkehrung, vor der der Modulkopf warnt, an der eigenen Naht.
    expect(ablageHindernis({ data: { path: 'a/b.png' }, error: null })).toBeNull()
    expect(anmeldeHindernis({ data: { user: null, session: null }, error: null })).toBeNull()
    expect(ablageHindernis({ data: null, error: storageFehler('EntityTooLarge', '413', 'too big') })).toEqual({
      art: 'zu-gross',
      rohtext: 'too big',
    })
    expect(anmeldeHindernis({ data: null, error: authFehler('invalid_credentials', 400, 'nope') })?.art).toBe('abgelehnt')
  })

  it('zu-gross: EntityTooLarge, am Code - status ist immer 400', () => {
    expect(ablageHindernis(storageFehler('EntityTooLarge', '413', 'The object exceeded the maximum allowed size'))).toEqual({
      art: 'zu-gross',
      rohtext: 'The object exceeded the maximum allowed size',
    })
    // Rueckfall auf statusCode, falls der Code fehlt.
    expect(ablageHindernis(storageFehler(undefined, '413'))?.art).toBe('zu-gross')
  })

  it('nicht-angemeldet: InvalidJWT - auch das mit HTTP 400, ein 401 kommt vom Server nie', () => {
    expect(ablageHindernis(storageFehler('InvalidJWT', '400', 'Invalid JWT'))?.art).toBe('nicht-angemeldet')
  })

  it('format-abgelehnt: InvalidMimeType', () => {
    expect(ablageHindernis(storageFehler('InvalidMimeType', '415', 'mime type image/bmp is not supported'))?.art).toBe('format-abgelehnt')
    expect(ablageHindernis(storageFehler(undefined, '415'))?.art).toBe('format-abgelehnt')
  })

  it('nicht-erreichbar: StorageUnknownError um einen geworfenen TypeError', () => {
    expect(
      ablageHindernis({ __isStorageError: true, name: 'StorageUnknownError', originalError: new TypeError('Failed to fetch'), message: 'Failed to fetch' }),
    ).toEqual({ art: 'nicht-erreichbar', rohtext: 'Failed to fetch' })
    expect(ablageHindernis(new TypeError('Failed to fetch'))?.art).toBe('nicht-erreichbar')
    // Der Name allein muss reichen: storage-js baut StorageUnknownError immer
    // dann, wenn KEINE Antwort kam - auch bei einem Abbruch, der kein
    // TypeError ist. Eine Mutation am 06.09. zeigte: ohne diesen Fall haengt
    // die Regel nur am originalError.
    expect(
      ablageHindernis({ __isStorageError: true, name: 'StorageUnknownError', originalError: new Error('aborted'), message: 'aborted' })?.art,
    ).toBe('nicht-erreichbar')
    // Echter 500 kommt als HTTP 500 (der eine Fall, den der Server nicht auf 400 legt).
    expect(ablageHindernis({ __isStorageError: true, name: 'StorageApiError', status: 500, statusCode: '500', message: 'x' })?.art).toBe('nicht-erreichbar')
  })

  it('verweigert: AccessDenied - Runde 5', () => {
    // Auf Bibliotheksebene zweideutig (ohne Sitzung schickt supabase-js den
    // anon-Schluessel, ein gueltiges JWT, das in die Zeilenrechte laeuft). Am
    // einzigen Aufrufer nicht: setAvatar (store/auth.ts:262-264) sendet ohne
    // Nutzer nichts. Die Voraussetzung steht im Kopf von ablageHindernis.
    expect(ablageHindernis(storageFehler('AccessDenied', '403', 'new row violates row-level security policy'))).toEqual({
      art: 'verweigert',
      rohtext: 'new row violates row-level security policy',
    })
  })

  it('unbekannt: ein Code, den keine Regel kennt', () => {
    expect(ablageHindernis(storageFehler('SomethingNew', '400', 'weird'))).toEqual({ art: 'unbekannt', rohtext: 'weird' })
  })
})
