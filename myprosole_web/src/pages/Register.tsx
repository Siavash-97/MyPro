import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import GoogleMark from '../components/ui/GoogleMark'
import CodeConfirmForm from '../components/auth/CodeConfirmForm'
import { merkeBestaetigungsEmail } from '../lib/pendingSignup'

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
 *   Gestalt 2 (.md-formular-fehler, unterm Ausloeser):  signUp scheitert
 *     bei bestehendem Netz (unter dem Registrieren-Knopf) und der
 *     Google-Fehlschlag (unter dem Google-Knopf).
 *   Gestalt 3 (.md-info-note--neutral, kein Feld markiert):  das Geraet
 *     sagt selbst, dass es offline ist. An den Eingaben ist nichts
 *     falsch, also behauptet es auch nichts.
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
 * supabase-js selbst weiter (store/auth.ts:175, skipBrowserRedirect nur
 * in der Huelle), die Seite ist weg, bevor ein Rueckgabewert ankommt.
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
type Fehlerart = 'passwort-kurz' | 'passwort-ungleich' | 'server' | 'verbindung'

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
    const { error: err, bestaetigungNoetig, bereitsRegistriert } = await signUp(email, password)
    setSubmitting(false)

    // Supabase meldet eine vergebene Adresse nicht als Fehler, sondern mit
    // einem gefaelschten Erfolg – erkennbar nur an leeren identities. Die
    // Textpruefung unten schlaegt deshalb nie an; sie bleibt nur fuer den
    // Fall stehen, dass Supabase es eines Tages doch als Fehler meldet.
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

    if (err) {
      if (err.toLowerCase().includes('already registered') || err.toLowerCase().includes('already been registered')) {
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
      // navigator.onLine ist nur in EINE Richtung verlaesslich: false
      // heisst sicher "kein Netz", true heisst nicht "erreichbar". Genau
      // so wird es benutzt - erst nachdem der Aufruf gescheitert ist, und
      // nur um den milderen Zustand zu waehlen, wenn das Geraet selbst
      // sagt, dass es nicht senden konnte. (Muster aus Login.tsx; ein
      // nicht erreichbarer Server bei bestehendem Netz kommt weiterhin
      // als Servermeldung an, bis signUp eine Kategorie zurueckgibt.)
      setFehler(navigator.onLine ? 'server' : 'verbindung')
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

        {/* Gestalt 3: kein Feld ist schuld, also markiert nichts ein Feld. */}
        {fehler === 'verbindung' && (
          <div className="md-info-note md-info-note--neutral" role="alert">
            <Icon name="warn" size={20} className="icon icon-sm" />
            <p>{FEHLERTEXT.verbindung}</p>
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
