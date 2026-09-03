import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import GoogleMark from '../components/ui/GoogleMark'

/**
 * Anmelden (Entwurf: design/mockups-neue-farben/login.html).
 *
 * Am 03.09.2026 auf das neue Design umgestellt. Die fuenf Inline-Stile und
 * die neun Tailwind-Hilfsklassen fuer Gestaltung sind in Klassen gezogen
 * (siehe styles/components.css, Abschnitt "Anmelden und Registrieren"); der
 * Eintrag dieser Datei in scripts/design_sperrklinke.json ist entfallen -
 * ein neuer Inline-Stil hier faellt ab sofort auf.
 *
 * DIE FEHLERDARSTELLUNG DIESER SEITE IST DAS MUSTER FUER VIER WEITERE
 * (Register, ForgotPassword, ConfirmEmail, PasswortNeu). Sie hat DREI
 * Gestalten, weil es drei Sorten Fehler gibt:
 *
 *   1. Der Fehler gehoert zu einem Feld. Dann steht er UNTER dem Feld
 *      (.md-feld-fehler), rot, und das Feld traegt aria-invalid.
 *   2. Er gehoert zu keinem Feld, ist aber ein Fehlschlag. Dann steht er
 *      unter dem Bedienelement, das ihn ausgeloest hat
 *      (.md-formular-fehler am Google-Knopf).
 *   3. Er gehoert zu keinem Feld UND ist nicht die Schuld des Menschen.
 *      Dann ist Rot falsch und eine Feldmarkierung eine Behauptung ueber
 *      Eingaben, an denen nichts falsch ist. Dafuer die neutrale Notiz
 *      (.md-info-note--neutral), ohne aria-invalid, mit einem Satz ueber
 *      die Verbindung statt ueber die Eingabe.
 *
 * Die dritte Gestalt braucht KEINE neue Klasse: Das Designsystem hat die
 * neutrale Notiz bereits, und components.css vermerkt an drei gefuellten
 * Meldungen, dass sie zusammengelegt gehoeren. Eine fuenfte waere der
 * falsche Beitrag zu dieser Lage.
 *
 * Warum es die dritte ueberhaupt braucht: DEVELOPMENT_STANDARDS.md:793
 * haelt fest, dass Verfuegbarkeit DREI Zustaende kennt - nicht vorhanden,
 * nicht erreichbar, vorhanden - und dass im Zweifel der mildere gilt. Ohne
 * die dritte Gestalt bekommt jemand im Funkloch gesagt, sein Passwort sei
 * falsch. Er tippt neu, zweifelt, setzt es womoeglich zurueck - wegen
 * einer Verbindung.
 *
 * GRENZE DES AUSLOESERS, ausdruecklich: signIn (store/auth.ts:151) gibt
 * jeden Fehler als Rohtext zurueck, ohne Kategorie. Die Seite kann daraus
 * NICHT ablesen, ob die Zugangsdaten falsch waren oder der Server nicht
 * antwortete. Was sie ohne Auth-Eingriff sicher weiss, ist der eine Fall,
 * in dem das Geraet selbst sagt, dass es kein Netz hat - und nur den
 * benutzt sie unten. Ein nicht erreichbarer Server bei bestehendem Netz
 * kommt weiterhin als Gestalt 1 an. Das aufzuloesen heisst, signIn eine
 * Kategorie zurueckgeben zu lassen (Muster: lib/stoppfehler.ts), und das
 * ist eine eigene Fehlerbehebung, nicht diese Scheibe.
 *
 * Vier Merkmale statt Farbe allein: Farbe, Warndreieck, Wortlaut und
 * aria-invalid. Die Meldung verschwindet NICHT beim Tippen, sondern erst
 * beim naechsten Absenden - sie ist ein Pruefergebnis, kein Kommentar zum
 * Tippen.
 *
 * Bewusst KEINE Sammelmeldung oben. Die Regel dafuer, damit sie auf den
 * vier Erbinnen nicht nach Gefuehl entschieden wird: Die Sammelmeldung
 * ist Pflicht, sobald nicht alle betroffenen Felder bei 320 px
 * GLEICHZEITIG sichtbar sind. Hier sind es zwei, beide im Bild - derselbe
 * Satz stuende sonst zweimal auf einem Bildschirm. Die Gegenleistung
 * dafuer ist nicht optional und steht unten im Code: role="alert" an der
 * Meldung, damit sie angesagt wird, und der Fokus springt nach einem
 * Fehlversuch auf das erste betroffene Feld.
 *
 * Warum BEIDE Felder markiert werden: Supabase sagt bei falschen
 * Zugangsdaten absichtlich nicht, welches von beiden falsch war - sonst
 * liessen sich Konten durchprobieren. Nur das Passwortfeld zu markieren
 * waere eine Behauptung ueber eine Tatsache, die niemand kennt. Der
 * Wortlaut nennt die Unschaerfe deshalb selbst.
 */

/**
 * Woran die Anmeldung gescheitert ist - als Art, nicht als Text.
 *
 * Der Text haengt an der Art und steht deshalb an genau einer Stelle.
 * Waere er im Zustand, koennte er zur Markierung der Felder in
 * Widerspruch geraten.
 */
type Fehlerart = 'zugang' | 'verbindung'

const FEHLERTEXT: Record<Fehlerart, string> = {
  zugang: 'E-Mail oder Passwort stimmt nicht. Prüf beides.',
  verbindung:
    'Dein Gerät ist gerade offline. Die Anmeldung wurde nicht geprüft – deine Eingaben stimmen womöglich.',
}

export default function Login() {
  // Kommt jemand von der Registrierung, weil die Adresse schon vergeben
  // ist, wird sie hier vorbelegt und der Grund genannt.
  const weitergeleitet = (useLocation().state ?? null) as
    { hinweis?: string; email?: string } | null
  const [email, setEmail] = useState(weitergeleitet?.email ?? '')
  const [password, setPassword] = useState('')
  const [fehler, setFehler] = useState<Fehlerart | null>(null)
  const [googleFehler, setGoogleFehler] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Das erste betroffene Feld. Nach einem Fehlversuch bekommt es den
  // Fokus - das ersetzt die Sprungmarke der weggelassenen Sammelmeldung.
  const emailRef = useRef<HTMLInputElement>(null)

  const signIn = useAuth((s) => s.signIn)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || '/'

  // Nur die Zugangs-Gestalt markiert Felder. Bei fehlender Verbindung ist
  // an den Eingaben nichts falsch, und ein roter Rand behauptete es.
  const feldFehler = fehler === 'zugang'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Erst hier faellt die alte Meldung weg, nicht beim Tippen: Das ist
    // der Moment der erneuten Pruefung.
    setFehler(null)
    setSubmitting(true)

    const err = await signIn(email, password)
    setSubmitting(false)

    if (err) {
      // navigator.onLine ist nur in EINE Richtung verlaesslich: false
      // heisst sicher "kein Netz", true heisst nicht "erreichbar".
      // Genau so wird es hier benutzt - erst nachdem der Aufruf bereits
      // gescheitert ist, und nur um den milderen der beiden Zustaende zu
      // waehlen, wenn das Geraet selbst sagt, dass es nicht senden konnte.
      const art: Fehlerart = navigator.onLine ? 'zugang' : 'verbindung'
      setFehler(art)
      if (art === 'zugang') emailRef.current?.focus()
      return
    }

    navigate(from, { replace: true })
  }

  const mitGoogle = async () => {
    setGoogleFehler(false)
    const err = await signInWithGoogle()
    // Bis zum 03.09.2026 stand hier signInWithGoogle() ohne await und ohne
    // Empfaenger. Die Funktion gibt seit jeher eine Fehlermeldung zurueck
    // (store/auth.ts:159, Promise<string | null>); sie wurde verworfen.
    // Derselbe Griff stand in Welcome.tsx und ist dort im selben Zug
    // behoben - nicht nur an der Seite, an der gerade gearbeitet wurde.
    //
    // WO DAS GREIFT: Im Browser leitet supabase-js selbst weiter
    // (skipBrowserRedirect ist dort false), die Seite ist also weg, bevor
    // ein Rueckgabewert ankommen kann - am 03.09.2026 im Browser
    // nachgestellt und belegt. In der Android-Huelle ist
    // skipBrowserRedirect true: supabase-js leitet NICHT weiter, sondern
    // gibt zurueck, und erst die App oeffnet die Adresse. Dort ist dieser
    // Zweig der normale Weg eines Fehlschlags - und dort laeuft die App.
    //
    // Kein Rohtext: Der Rueckgabewert ist error.message aus Supabase,
    // englisch. lib/melden.ts haelt fest, dass eine Datenbankmeldung nie
    // angezeigt wird. Der Rueckgabewert entscheidet OB, nicht WAS.
    if (err) setGoogleFehler(true)
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
            Willkommen zurück
          </p>
          <p className="md-greeting__subtitle">
            Melde dich an, um deinen Fortschritt zu sehen.
          </p>
        </div>

        {/* Der Grund fuer die Weiterleitung. Steht ueber den Feldern,
            weil er kein Fehler ist, sondern eine Erklaerung. */}
        {weitergeleitet?.hinweis === 'bereits-registriert' && !fehler && (
          <div className="md-info-note md-info-note--neutral">
            <Icon name="info" size={20} className="icon icon-sm" />
            <p>
              Diese E-Mail hat schon ein Konto. Melde dich hier an – dein Passwort ist
              das von damals. Weißt du es nicht mehr, hilft „Passwort vergessen".
            </p>
          </div>
        )}

        {/* Gestalt 3: kein Feld ist schuld, also markiert nichts ein Feld.
            Neutral statt rot, und der Satz sagt ausdruecklich, dass die
            Eingaben womoeglich stimmen - "Pruef beides" waere hier ein
            falscher Rat. role="alert", weil er auf eine Handlung folgt. */}
        {fehler === 'verbindung' && (
          <div className="md-info-note md-info-note--neutral" role="alert">
            <Icon name="warn" size={20} className="icon icon-sm" />
            <p>{FEHLERTEXT.verbindung}</p>
          </div>
        )}

        <div className="md-field">
          <label className="md-field__label" htmlFor="login-email">E-Mail</label>
          <input
            ref={emailRef}
            className={
              feldFehler ? 'md-field__input md-field__input--fehler' : 'md-field__input'
            }
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@beispiel.de"
            aria-invalid={feldFehler ? true : undefined}
            aria-describedby={feldFehler ? 'login-zugang-fehler' : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="md-field">
          <label className="md-field__label" htmlFor="login-password">Passwort</label>
          <input
            className={
              feldFehler ? 'md-field__input md-field__input--fehler' : 'md-field__input'
            }
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Dein Passwort"
            aria-invalid={feldFehler ? true : undefined}
            aria-describedby={feldFehler ? 'login-zugang-fehler' : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* Die Meldung steht einmal, unter dem zweiten der beiden
              Felder, und beide verweisen darauf. Zweimal derselbe Satz
              waere zweimal dieselbe Information. */}
          {feldFehler && (
            <p className="md-feld-fehler" id="login-zugang-fehler" role="alert">
              <Icon name="warn" size={16} className="md-feld-fehler__icon" />
              <span className="md-feld-fehler__text">{FEHLERTEXT.zugang}</span>
            </p>
          )}
        </div>

        <Link to="/passwort-vergessen" className="md-auth-form__nebenlink">
          Passwort vergessen?
        </Link>

        <button className="md-button md-button--filled" type="submit" disabled={submitting}>
          {submitting ? 'Wird angemeldet…' : 'Anmelden'}
        </button>

        <div className="md-divider">oder</div>

        {/* .md-oauth-button statt eines Knopfes mit Inline-Rahmen: Entwurf
            und Bildschirmfoto zeigen die weisse Pille, und Welcome.tsx
            benutzt dieselbe Klasse. Damit gibt es einen Google-Knopf in
            der App statt zwei. Die Flaeche ist bewusst in beiden Themen
            weiss - das verlangen Googles Marken-Vorgaben, und die feste
            Farbe steht deshalb in .md-oauth-button, nicht hier. */}
        <button
          type="button"
          onClick={mitGoogle}
          className="md-oauth-button"
          aria-describedby={googleFehler ? 'login-google-fehler' : undefined}
        >
          <GoogleMark />
          Mit Google anmelden
        </button>

        {googleFehler && (
          <p className="md-formular-fehler" id="login-google-fehler" role="alert">
            <Icon name="warn" size={20} className="md-formular-fehler__icon" />
            <span className="md-formular-fehler__text">
              Die Anmeldung mit Google hat nicht geklappt. Versuch es noch einmal.
            </span>
          </p>
        )}

        <p className="md-auth-link">
          Noch kein Konto? <Link to="/register">Registrieren</Link>
        </p>
      </form>
    </div>
  )
}
