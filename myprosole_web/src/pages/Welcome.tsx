import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import GoogleMark from '../components/ui/GoogleMark'
import Icon from '../components/ui/Icon'

/**
 * Einstiegsseite (Entwurf: design/mockups-neue-farben/welcome.html).
 * Hero-Video mit Logo, die Wege ins Konto und der Verweis auf die Anmeldung.
 *
 * GENAU ZWEI Einstiege: Google und E-Mail. Facebook wurde am 15.08.2026
 * entfernt. Der Kopfkommentar des Entwurfs nennt ihn noch – das ist ein
 * ueberholter Stand, den das Markup darunter selbst nicht mehr traegt.
 * Massgeblich ist die Abnahmeliste des Pakets 07.
 *
 * Am 03.09.2026 sind die letzten fuenf Inline-Stile in Klassen gezogen
 * (siehe styles/components.css, Abschnitt "Willkommen"). Diese Datei traegt
 * seitdem keinen einzigen mehr, und ihr Eintrag in
 * scripts/design_sperrklinke.json ist entfallen – ein neuer Inline-Stil hier
 * laesst die Pruefung ab sofort auffallen.
 *
 * Dabei ist ein gemessener Fehler herausgefallen: Der Verweis unten trug
 * `color: var(--md-on-primary)`. In der Palette setb ist dieses Token im
 * dunklen Thema derselbe Ton wie --md-scrim; am 03.09.2026 im Browser
 * gemessen, Kontrastverhaeltnis 1.00 zu 1 – die Zeile war nicht zu lesen.
 * Jetzt traegt sie --md-on-scrim, das keine Palette ueberschreibt.
 *
 * Zwei Fussangeln der Prueftore, damit sie niemand erneut tritt: Beide
 * lesen zeilenweise und sehen Kommentare wie Code. Eine erklaerende Zeile
 * mit einem Farbwert in Rautenschreibweise faellt check_page_rules.py als
 * "feste Farbe" auf, und die Zeichenfolge, auf die check_design_system.py
 * die Inline-Stile zaehlt, erhoeht die Sperrklinke. Die Werte gehoeren
 * deshalb nach styles/components.css; dort wird beides nicht geprueft.
 */
export default function Welcome() {
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
  const [googleFehler, setGoogleFehler] = useState<string | null>(null)

  // Bis zum 03.09.2026 stand hier onClick={() => signInWithGoogle()}: ohne
  // await und ohne Empfaenger. Die Funktion gibt seit jeher eine
  // Fehlermeldung zurueck (store/auth.ts:159, Promise<string | null>), und
  // beide Aufrufstellen - hier und Login.tsx - haben sie verworfen. Schlug
  // die Anmeldung fehl, passierte sichtbar NICHTS.
  //
  // Angezeigt wird ein fester deutscher Satz, nicht der Rueckgabewert:
  // Der ist error.message aus Supabase, englisch, und lib/melden.ts haelt
  // fest, dass eine Datenbankmeldung nie angezeigt wird. Der Rueckgabewert
  // entscheidet OB, nicht WAS.
  //
  // WO DAS GREIFT, nachgestellt und nicht angenommen: Im Browser leitet
  // supabase-js selbst weiter (skipBrowserRedirect ist dort false) - die
  // Seite ist weg, bevor ein Rueckgabewert ankommen kann. Am 03.09.2026
  // im Browser geprueft: Der Klick erzeugt genau eine Navigation zu
  // /auth/v1/authorize, keinen Fehlerwert. In der Android-Huelle ist
  // skipBrowserRedirect true, supabase-js gibt zurueck statt zu leiten,
  // und die App oeffnet die Adresse selbst (store/auth.ts:180). DORT ist
  // dieser Zweig der normale Weg eines Fehlschlags - und dort laeuft die
  // App. Der Zweig ist also nicht im Browser pruefbar, aber deshalb nicht
  // ueberfluessig.
  const mitGoogle = async () => {
    setGoogleFehler(null)
    const err = await signInWithGoogle()
    if (err) {
      setGoogleFehler('Die Anmeldung mit Google hat nicht geklappt. Versuch es noch einmal.')
    }
  }

  return (
    // .md-hero traegt flex:1 und fuellt damit seinen Elternteil. In den
    // Entwuerfen ist das der Geraeterahmen; hier uebernimmt diese Huelle mit
    // voller Fensterhoehe seine Rolle, sonst bliebe unten ein leerer Streifen.
    <div className="flex flex-col min-h-dvh bg-background">
      <div className="md-hero">
        {/* Liegt unter dem Video und wird nur sichtbar, falls die Datei fehlt. */}
        <div className="md-hero__placeholder"><span /><span /></div>
        {/* poster: Standbild aus demselben Video. Es steht sofort und bleibt
            stehen, wenn ein Telefon das Video nicht von selbst startet – etwa
            im Datensparmodus. Beide Dateien liegen in public/assets; die
            absoluten Pfade sind richtig, der relative Pfad des Entwurfs
            (../mockups/assets/) gilt nur dort. */}
        <video
          className="md-hero__video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/assets/welcome-running-poster.jpg"
        >
          <source src="/assets/welcome-running.mp4" type="video/mp4" />
        </video>
        <div className="md-hero__scrim" />

        <div className="md-hero__content">
          <img
            className="md-hero__logo"
            src="/icons/logo-myprosole.png"
            alt="MyProSole"
            width={600}
            height={403}
          />

          <div className="md-hero__actions">
            <p className="md-hero__tagline md-hero__tagline--centered">
              Deine Lauftechnik, verständlich erklärt.
            </p>

            <button
              type="button"
              className="md-oauth-button"
              onClick={mitGoogle}
              aria-describedby={googleFehler ? 'welcome-google-fehler' : undefined}
            >
              {/* Die weisse Flaeche hinter dem Google-Zeichen steht als
                  feste Farbe in .md-oauth-button__badge--google. */}
              <span className="md-oauth-button__badge md-oauth-button__badge--google">
                <GoogleMark />
              </span>
              Mit Google fortfahren
            </button>

            {/* Die Meldung liegt hier ueber dem Scrim des Videos. Sie ist
                deckend, der Scrim liegt also NICHT unter der Schrift -
                das ist der Unterschied zum Fehler vom 03.09.2026, bei dem
                die Verweiszeile ohne eigene Flaeche auf dem Scrim stand.
                Am fertigen Bild in beiden Themen nachgemessen; deshalb
                braucht .md-formular-fehler hier keinen eigenen
                Scrim-Modifikator. */}
            {googleFehler && (
              <p className="md-formular-fehler" id="welcome-google-fehler" role="alert">
                <Icon name="warn" size={20} className="md-formular-fehler__icon" />
                <span className="md-formular-fehler__text">{googleFehler}</span>
              </p>
            )}

            {/* Facebook ist bewusst entfernt (15.08.2026): Der Weg war nicht
                eingerichtet und zeigte nur einen Hinweis – ein Knopf, der
                nichts tut, ist schlechter als keiner. */}

            <Link className="md-oauth-button md-oauth-button--outline" to="/register">
              <Icon name="mail" size={20} className="icon-sm" />
              Mit E-Mail fortfahren
            </Link>

            <Link className="md-auth-link md-auth-link--on-scrim" to="/login">
              Ich habe bereits ein Konto ·{' '}
              <span className="md-auth-link__action">Anmelden</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
