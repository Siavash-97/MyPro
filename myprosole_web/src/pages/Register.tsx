import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import GoogleMark from '../components/ui/GoogleMark'
import CodeConfirmForm from '../components/auth/CodeConfirmForm'
import { merkeBestaetigungsEmail } from '../lib/pendingSignup'
import type { AnmeldeHindernisArt } from '../lib/hindernis'

/**
 * Registrieren (Entwurf: design/mockups-neue-farben/register.html).
 *
 * Am 03.09.2026 auf das neue Design umgestellt - als ERSTE ERBIN der
 * Fehlerdarstellung von Login.tsx. Die drei Gestalten sind dort im
 * Kopfkommentar hergeleitet; hier steht nur, wie diese Seite sie belegt:
 *
 *   Gestalt 1 (.md-feld-fehler, am Feld):  Passwort zu kurz (nur das
 *     Passwortfeld - hier ist bekannt, welches Feld gemeint ist) und
 *     Passwoerter ungleich (BEIDE Passwortfelder: welches von beiden
 *     vertippt wurde, weiss niemand - dieselbe Logik wie Logins
 *     "beide Felder", nur dass hier das Paar ein anderes ist).
 *   Gestalt 2 (.md-formular-fehler, unterm Ausloeser):  signUp wurde
 *     ABGELEHNT (unter dem Registrieren-Knopf) und der Google-Fehlschlag
 *     (unter dem Google-Knopf).
 *   Gestalt 3 (.md-info-note--neutral, kein Feld markiert):  alles andere -
 *     offline, Ratenbegrenzung, der ehrliche Rest. An den Eingaben ist
 *     nichts falsch, also behauptet es auch nichts.
 *
 * Bis zum 07.09.2026 lief die Trennung ueber `navigator.onLine` allein:
 * Alles ausser "Geraet sagt offline" wurde rot. Seitdem gibt `signUp` eine
 * ART zurueck (lib/hindernis.ts), und nur `abgelehnt` bleibt rot.
 *
 * KEINE Sammelmeldung, und zwar GEMESSEN statt entschieden: Die Regel aus
 * Login.tsx macht sie zur Pflicht, sobald nicht alle betroffenen Felder
 * bei 320 px gleichzeitig sichtbar sind. Am Entwurf bei 320 x 800
 * vermessen (03.09.2026, beide Themen zeichengleich): Unterkante des
 * Rechts-Kaestchens bei 528 px (drei Felder) bzw. 630 px (vier Felder,
 * wie hier gebaut) - beides unter 800. Die Gegenleistung ist dieselbe
 * wie bei Login: role="alert" an jeder Meldung, Fokus nach einem
 * Fehlversuch auf das erste betroffene Feld.
 *
 * VIER FELDER, obwohl der Entwurf drei zeigt: "Passwort bestaetigen"
 * samt Gleichheitspruefung ist Verhalten der Live-Seite, und eine
 * Designaenderung aendert kein Verhalten. Ob das Mockup nachgezogen oder
 * das Feld bewusst gestrichen wird, ist als Produktfrage in der
 * Schritt-0-Liste der Uebergabe notiert (design/uebergabe/README.md) -
 * das entscheidet der Nutzer, nicht diese Scheibe.
 *
 * GRENZE der Kurz-Pruefung: Das minLength-Attribut am Passwortfeld
 * laesst den Browser ein zu kurzes Passwort abfangen, BEVOR handleSubmit
 * laeuft - die JS-Pruefung dahinter greift im Browser also praktisch
 * nie. Sie bleibt trotzdem stehen (Bestand, zweites Netz falls das
 * Attribut je faellt), und ihre Gestalt-1-Darstellung ist gebaut. Die
 * Interaktionspruefung (e2e/registrieren-fehler.spec.ts) nutzt deshalb
 * die Ungleich-Pruefung: Sie hat kein natives Gegenstueck und laeuft
 * wirklich durch diesen Code.
 *
 * GRENZE des Google-Zweigs, wortgleich zu Login.tsx: Im Browser leitet
 * supabase-js selbst weiter (`signInWithGoogle` in store/auth.ts,
 * skipBrowserRedirect nur in der Huelle), die Seite ist weg, bevor ein
 * Rueckgabewert ankommt.
 * Der Fehlzweig traegt in der Android-Huelle - und nur dort ist er
 * pruefbar. Bis zum 03.09.2026 wurde der Rueckgabewert hier verworfen:
 * Dieselbe Behebung wie in Login und Welcome, die diese Seite als DRITTE
 * Aufrufstelle uebersehen hatte (Fehlerbericht 2026-09-03_1520, Nachtrag).
 */

// Mindestlaenge wie im Entwurf. Kuerzer waere eine stillschweigende
// Absenkung einer Sicherheitsvorgabe.
const MIN_PASSWORD_LENGTH = 8

/**
 * Woran die Registrierung gescheitert ist - als Art, nicht als Text.
 * Der Text haengt an der Art und steht an genau einer Stelle; waere er
 * im Zustand, koennte er zur Markierung der Felder in Widerspruch
 * geraten. (Muster aus Login.tsx.)
 */
type Fehlerart =
  | 'passwort-kurz'
  | 'passwort-ungleich'
  | 'server'
  | 'verbindung'
  | 'fehlschlag'
  | 'zu-oft'

const FEHLERTEXT: Record<Fehlerart, string> = {
  'passwort-kurz': `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`,
  'passwort-ungleich': 'Die Passwörter stimmen nicht überein. Prüf beide.',
  // Kein Rohtext aus Supabase: lib/melden.ts haelt fest, dass eine
  // Datenbankmeldung nie angezeigt wird. Der Rueckgabewert entscheidet
  // OB, nicht WAS. (Bis zum 03.09.2026 stand hier
  // "Registrierung fehlgeschlagen: " + err - englischer Servertext.)
  server: 'Die Registrierung hat nicht geklappt. Versuch es noch einmal.',
  verbindung:
    'Dein Gerät ist gerade offline. Die Registrierung wurde nicht geprüft – deine Eingaben stimmen womöglich.',
  // Derselbe Satz wie `server`, aber in der NEUTRALEN Gestalt. Der
  // Unterschied ist nicht der Wortlaut, sondern die Behauptung: Rot unter
  // dem Knopf sagt "hier ist etwas schiefgegangen, das an dir liegen
  // koennte", die Notiz sagt es nicht.
  fehlschlag: 'Die Registrierung hat nicht geklappt. Versuch es noch einmal.',
  // Bei `zu-oft` heisst die naechste Handlung "warten", nicht "gleich noch
  // einmal". Keine Sekundenzahl - der Server liefert sie nicht verlaesslich
  // (docs/authhindernis-entwurf.md, R4-Q3).
  'zu-oft': 'Die Registrierung hat nicht geklappt. Warte ein paar Minuten und probier es dann noch einmal.',
}

/**
 * Von der Art zur Gestalt. Nur `abgelehnt` bleibt rot unter dem Knopf;
 * alles andere bekommt die neutrale Notiz (Entwurf, R3-Q2).
 *
 * Eine TABELLE statt einer `if`-Kette mit Rest (B2 der Durchsicht,
 * 08.09.2026, Muster aus Login.tsx): `Record<AnmeldeHindernisArt, …>`
 * verlangt jede Art einzeln, ein Rest-Zweig zur Gestalt `fehlschlag` am Ende
 * haette eine siebte Art still verschluckt.
 */
const GESTALT: Record<AnmeldeHindernisArt, Fehlerart> = {
  abgelehnt: 'server',
  'zu-oft': 'zu-oft',
  // Online: der neutrale Satz. Die Offline-Ausnahme steht in `gestaltFuer`.
  'nicht-erreichbar': 'fehlschlag',
  'nicht-angemeldet': 'fehlschlag',
  'nicht-bestaetigt': 'fehlschlag',
  unbekannt: 'fehlschlag',
}

function gestaltFuer(art: AnmeldeHindernisArt): Fehlerart {
  // Die eine Ausnahme vor der Tabelle:
  // navigator.onLine ist nur in EINE Richtung verlaesslich: false heisst
  // sicher "kein Netz", true heisst nicht "erreichbar". Deshalb entscheidet
  // es nicht allein, sondern zusammen mit der Art - der Offline-Satz faellt
  // nur, wenn beide dasselbe sagen. (Muster aus Login.tsx.)
  if (art === 'nicht-erreichbar' && !navigator.onLine) return 'verbindung'
  return GESTALT[art]
}

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [fehler, setFehler] = useState<Fehlerart | null>(null)
  const [googleFehler, setGoogleFehler] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [bestaetigung, setBestaetigung] = useState(false)

  // Das erste betroffene Feld beider Passwort-Pruefungen. Nach einem
  // Fehlversuch bekommt es den Fokus - das ersetzt die Sprungmarke der
  // weggemessenen Sammelmeldung.
  const passwortRef = useRef<HTMLInputElement>(null)

  const signUp = useAuth((s) => s.signUp)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
  const navigate = useNavigate()

  // Nur die Passwort-Gestalten markieren Felder - und nur die Felder,
  // ueber die die Meldung wirklich etwas aussagt.
  const pwKurz = fehler === 'passwort-kurz'
  const pwUngleich = fehler === 'passwort-ungleich'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Erst hier faellt die alte Meldung weg, nicht beim Tippen: Das ist
    // der Moment der erneuten Pruefung.
    setFehler(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFehler('passwort-kurz')
      passwortRef.current?.focus()
      return
    }

    if (password !== confirmPassword) {
      setFehler('passwort-ungleich')
      passwortRef.current?.focus()
      return
    }

    setSubmitting(true)
    const { hindernis, bestaetigungNoetig, bereitsRegistriert } = await signUp(email, password)
    setSubmitting(false)

    // Supabase meldet eine vergebene Adresse nicht als Fehler, sondern mit
    // einem gefaelschten Erfolg – erkennbar nur an leeren identities. DAS
    // ist der einzige Weg, auf dem dieser Fall ankommt; die Textpruefung,
    // die bis zum 07.09.2026 darunter stand, hat nie angeschlagen.
    //
    // Die Anzeige dazu ist seit dem 03.09.2026 die NEUTRALE Notiz, kein
    // roter Kasten: An der Eingabe ist nichts falsch, und Login zeigt
    // nach der Weiterleitung dieselbe Information neutral - Rot davor
    // widerspraeche Gruen danach.
    if (bereitsRegistriert) {
      setRedirecting(true)
      // Grund und Adresse mitgeben: Sonst steht man auf der Anmeldeseite
      // und weiss nicht, warum man dort gelandet ist – und tippt die
      // Adresse ein zweites Mal.
      setTimeout(
        () => navigate('/login', { replace: true, state: { hinweis: 'bereits-registriert', email } }),
        2000,
      )
      return
    }

    // HIER STAND BIS ZUM 07.09.2026 EIN TEXTABGLEICH auf "already
    // registered". Er ist mit dem Hindernis gefallen, und zwar aus zwei
    // Gruenden: Es gibt keinen Text mehr, den man abgleichen duerfte
    // (Fehlertexte sind kein Vertrag), und der Zweig war laut dem Vermerk
    // darueber ohnehin tot - Supabase meldet eine vergebene Adresse mit
    // einem gefaelschten Erfolg, den `bereitsRegistriert` oben abfaengt.
    if (hindernis) {
      setFehler(gestaltFuer(hindernis.art))
      return
    }

    // Verlangt Supabase eine Bestaetigung per E-Mail, gibt es noch keine
    // Sitzung. Frueher ging es trotzdem weiter auf /profil/setup – der
    // AuthGuard warf sofort zurueck auf die Willkommensseite, und es sah aus,
    // als passiere gar nichts. Jetzt sagt die Seite, was zu tun ist.
    if (bestaetigungNoetig) {
      // Der Link aus der Mail oeffnet einen neuen Tab; dieser Formularzustand
      // ist dort weg. Die Bestaetigungsseite holt die Adresse aus der Notiz.
      merkeBestaetigungsEmail(email)
      setBestaetigung(true)
      return
    }

    // Der eingegebene Name wird beim Profil-Einrichten uebernommen, damit er
    // nicht zweimal getippt werden muss.
    navigate('/profil/setup', { replace: true, state: { name: name.trim() } })
  }

  const mitGoogle = async () => {
    setGoogleFehler(false)
    // Bis zum 03.09.2026 stand hier signInWithGoogle() ohne await und
    // ohne Empfaenger - die DRITTE Aufrufstelle desselben Fehlers, den
    // der Bericht vom selben Tag in Login und Welcome behoben hatte.
    // Geprueft worden waren damals die zwei genannten Stellen, nicht die
    // Klasse; grep ueber src/ fand diese hier bei der Register-Scheibe.
    // Wo der Zweig traegt und wo nicht, steht im Kopfkommentar.
    const err = await signInWithGoogle()
    if (err) setGoogleFehler(true)
  }

  // Konto angelegt, aber noch nicht bestaetigt: Hier endet der Weg vorerst.
  // Ohne Bestaetigung gibt es keine Sitzung, und jede geschuetzte Seite
  // wuerde zurueckwerfen.
  if (bestaetigung) {
    return (
      <div className="flex flex-col min-h-dvh bg-background text-on-background">
        <div className="md-app-bar">
          <Link to="/willkommen" className="md-app-bar__icon-btn" aria-label="Zurück">
            <Icon name="back" />
          </Link>
        </div>

        <div className="md-auth-kopf">
          <p className="md-greeting__title md-greeting__title--kompakt">
            Fast geschafft
          </p>
          <p className="md-greeting__subtitle">
            Wir haben einen Code an <strong>{email}</strong> geschickt. Trag ihn
            hier ein – oder klick den Link aus derselben E-Mail an.
          </p>
        </div>

        {/* Die Adresse steht fest: Sie ist gerade eingetippt worden und darf
            hier nicht abweichen, sonst bestaetigt der Code ein anderes Konto. */}
        <CodeConfirmForm
          email={email}
          onConfirmed={() =>
            navigate('/profil/setup', { replace: true, state: { name: name.trim() } })
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <div className="md-app-bar">
        <Link to="/willkommen" className="md-app-bar__icon-btn" aria-label="Zurück">
          <Icon name="back" />
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="md-auth-form">
        <div>
          <p className="md-greeting__title md-greeting__title--kompakt">
            Konto erstellen
          </p>
          <p className="md-greeting__subtitle">
            Starte mit deiner ersten Laufanalyse.
          </p>
        </div>

        {/* Der Zwischenstand vor der Weiterleitung. Neutral, weil er kein
            Fehler ist: Das Konto gibt es schon, die Anmeldung ist der
            richtige Ort dafuer. role="alert", weil er auf eine Handlung
            folgt. */}
        {redirecting && (
          <div className="md-info-note md-info-note--neutral" role="alert">
            <Icon name="info" size={20} className="icon icon-sm" />
            <p>
              Diese E-Mail hat schon ein Konto. Du wirst zur Anmeldung
              weitergeleitet…
            </p>
          </div>
        )}

        {/* Gestalt 3: kein Feld ist schuld, also markiert nichts ein Feld.
            Seit dem 07.09.2026 tragen sie DREI Arten: offline, die
            Ratenbegrenzung und der ehrliche Rest. Rot unter dem Knopf
            bleibt nur, was die Datenbank wirklich abgelehnt hat. */}
        {(fehler === 'verbindung' || fehler === 'fehlschlag' || fehler === 'zu-oft') && (
          <div className="md-info-note md-info-note--neutral" role="alert">
            <Icon name="warn" size={20} className="icon icon-sm" />
            <p>{FEHLERTEXT[fehler]}</p>
          </div>
        )}

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-name">Name</label>
          <input
            className="md-field__input"
            id="register-name"
            type="text"
            required
            autoComplete="name"
            placeholder="Vor- und Nachname"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-email">E-Mail</label>
          <input
            className="md-field__input"
            id="register-email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-password">Passwort</label>
          <input
            ref={passwortRef}
            className={
              pwKurz || pwUngleich
                ? 'md-field__input md-field__input--fehler'
                : 'md-field__input'
            }
            id="register-password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Mindestens 8 Zeichen"
            minLength={MIN_PASSWORD_LENGTH}
            aria-invalid={pwKurz || pwUngleich ? true : undefined}
            aria-describedby={
              pwKurz
                ? 'register-pw-kurz-fehler'
                : pwUngleich
                  ? 'register-pw-ungleich-fehler'
                  : undefined
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {pwKurz && (
            <p className="md-feld-fehler" id="register-pw-kurz-fehler" role="alert">
              <Icon name="warn" size={16} className="md-feld-fehler__icon" />
              <span className="md-feld-fehler__text">{FEHLERTEXT['passwort-kurz']}</span>
            </p>
          )}
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="register-confirm">Passwort bestätigen</label>
          <input
            className={
              pwUngleich ? 'md-field__input md-field__input--fehler' : 'md-field__input'
            }
            id="register-confirm"
            type="password"
            required
            autoComplete="new-password"
            aria-invalid={pwUngleich ? true : undefined}
            aria-describedby={pwUngleich ? 'register-pw-ungleich-fehler' : undefined}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {/* Die Meldung steht einmal, unter dem zweiten der beiden
              Felder, und beide verweisen darauf - wie das Feldpaar auf
              der Anmeldeseite. */}
          {pwUngleich && (
            <p className="md-feld-fehler" id="register-pw-ungleich-fehler" role="alert">
              <Icon name="warn" size={16} className="md-feld-fehler__icon" />
              <span className="md-feld-fehler__text">{FEHLERTEXT['passwort-ungleich']}</span>
            </p>
          )}
        </div>

        {/* Pflichtangabe wie im Entwurf: ohne Zustimmung kein Konto. */}
        <label className="md-checkbox-row" htmlFor="register-consent">
          <input
            className="md-checkbox__input"
            id="register-consent"
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span className="md-checkbox-row__label">
            Ich akzeptiere die <Link to="/agb">Nutzungsbedingungen</Link> und die{' '}
            <Link to="/datenschutz">Datenschutzerklärung</Link>.
          </span>
        </label>

        <button
          className="md-button md-button--filled"
          type="submit"
          disabled={submitting || redirecting || !consent}
          aria-describedby={fehler === 'server' ? 'register-server-fehler' : undefined}
        >
          {submitting ? 'Wird registriert…' : 'Registrieren'}
        </button>

        {fehler === 'server' && (
          <p className="md-formular-fehler" id="register-server-fehler" role="alert">
            <Icon name="warn" size={20} className="md-formular-fehler__icon" />
            <span className="md-formular-fehler__text">{FEHLERTEXT.server}</span>
          </p>
        )}

        <div className="md-divider">oder</div>

        {/* .md-oauth-button statt des Knopfes mit Inline-Rahmen: derselbe
            Google-Knopf wie auf Anmelden und Willkommen, die weisse
            Flaeche in beiden Themen verlangen Googles Marken-Vorgaben. */}
        <button
          type="button"
          onClick={mitGoogle}
          className="md-oauth-button"
          aria-describedby={googleFehler ? 'register-google-fehler' : undefined}
        >
          <GoogleMark />
          Mit Google registrieren
        </button>

        {googleFehler && (
          <p className="md-formular-fehler" id="register-google-fehler" role="alert">
            <Icon name="warn" size={20} className="md-formular-fehler__icon" />
            <span className="md-formular-fehler__text">
              Die Registrierung mit Google hat nicht geklappt. Versuch es noch einmal.
            </span>
          </p>
        )}

        <p className="md-auth-link">
          Schon ein Konto? <Link to="/login">Anmelden</Link>
        </p>
      </form>
    </div>
  )
}
