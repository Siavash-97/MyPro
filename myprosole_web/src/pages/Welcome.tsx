import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import GoogleMark from '../components/ui/GoogleMark'
import Icon from '../components/ui/Icon'
import type { AnmeldeHindernisArt } from '../lib/hindernis'

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
/**
 * Der eine Satz dieser Seite fuer einen Fehlschlag mit Google.
 *
 * KEINE neutrale Notiz, obwohl `signInWithGoogle` seit dem 07.09.2026 eine
 * ART liefert und der Entwurf fuer alles ausser `abgelehnt` die dritte
 * Gestalt vorsieht: Diese Meldung liegt ueber dem Scrim des Hero-Videos.
 * `.md-formular-fehler` ist dort gemessen und deckend (Kopfkommentar oben);
 * `.md-info-note--neutral` ist es nicht, und eine ungemessene Flaeche auf
 * dem Scrim ist genau der Fehler vom 03.09.2026, bei dem eine Zeile mit
 * Kontrast 1.00 : 1 unlesbar war. Die Messung ist ein eigener Auftrag
 * (4a-ii) - bis dahin bleibt die Gestalt, und nur der Wortlaut folgt der
 * Art.
 */
function googleSatz(art: AnmeldeHindernisArt): string {
  return art === 'zu-oft'
    ? 'Die Anmeldung mit Google hat nicht geklappt. Warte ein paar Minuten und probier es dann noch einmal.'
    : 'Die Anmeldung mit Google hat nicht geklappt. Versuch es noch einmal.'
}

export default function Welcome() {
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)

  // Der Rueckweg aus der Google-Anmeldung landet in der Huelle bei
  // App.tsx; scheitert er dort, schickt er die Art hierher. Gelesen wie
  // Login.tsx den `hinweis` liest - aus dem Zustand der Navigation.
  const ort = useLocation()
  const navigate = useNavigate()
  const weitergeleitet = (ort.state ?? null) as { hindernis?: AnmeldeHindernisArt } | null
  const [googleFehler, setGoogleFehler] = useState<string | null>(
    weitergeleitet?.hindernis ? googleSatz(weitergeleitet.hindernis) : null,
  )

  // UND DANACH VERBRAUCHT, anders als bei Login.
  //
  // Der Zustand haengt am Verlaufseintrag, nicht am Bildschirm: Er ueberlebt
  // jedes Verlassen und Zurueckkommen, und der Satz stuende dann wieder da -
  // fuer einen Fehlschlag, der laengst vorbei ist. Bei Login ist derselbe
  // Bau harmlos, weil dort eine ERKLAERUNG steht ("Diese E-Mail hat schon
  // ein Konto"), die auch beim zweiten Lesen stimmt. Hier steht ein FEHLER,
  // und der stimmt beim zweiten Lesen nicht mehr.
  //
  // Nachgesehen am 07.09.2026: Im Haus gibt es dafuer noch kein Muster -
  // AuthGuard, Login und ProfileSetup lesen alle drei, keiner raeumt auf.
  // Dies ist die erste Stelle, und sie steht deshalb hier begruendet.
  useEffect(() => {
    if (!weitergeleitet?.hindernis) return
    navigate(ort.pathname, { replace: true, state: null })
  }, [weitergeleitet?.hindernis, navigate, ort.pathname])

  // Bis zum 03.09.2026 stand hier onClick={() => signInWithGoogle()}: ohne
  // await und ohne Empfaenger. Die Funktion gibt seit jeher einen
  // Fehlschlag zurueck, und beide Aufrufstellen - hier und Login.tsx -
  // haben ihn verworfen. Schlug die Anmeldung fehl, passierte sichtbar
  // NICHTS.
  //
  // Angezeigt wird ein fester deutscher Satz, nie der `rohtext`: Der ist
  // die englische Meldung aus Supabase, und lib/melden.ts haelt fest, dass
  // eine Datenbankmeldung nie angezeigt wird. Seit dem 07.09.2026
  // entscheidet der Rueckgabewert nicht nur OB, sondern auch WELCHER der
  // zwei Saetze - der Wortlaut bleibt trotzdem hier.
  //
  // WO DAS GREIFT, nachgestellt und nicht angenommen: Im Browser leitet
  // supabase-js selbst weiter (skipBrowserRedirect ist dort false) - die
  // Seite ist weg, bevor ein Rueckgabewert ankommen kann. Am 03.09.2026
  // im Browser geprueft: Der Klick erzeugt genau eine Navigation zu
  // /auth/v1/authorize, keinen Fehlerwert. In der Android-Huelle ist
  // skipBrowserRedirect true, supabase-js gibt zurueck statt zu leiten,
  // und die App oeffnet die Adresse selbst (`window.open` in
  // `signInWithGoogle`, store/auth.ts). DORT ist
  // dieser Zweig der normale Weg eines Fehlschlags - und dort laeuft die
  // App. Der Zweig ist also nicht im Browser pruefbar, aber deshalb nicht
  // ueberfluessig.
  const mitGoogle = async () => {
    setGoogleFehler(null)
    const hindernis = await signInWithGoogle()
    if (hindernis) setGoogleFehler(googleSatz(hindernis.art))
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
