import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import type { AnmeldeHindernisArt } from '../lib/hindernis'

/**
 * Passwort vergessen (Entwurf: design/mockups-neue-farben/passwort-vergessen.html).
 *
 * Am 03.09.2026 auf das neue Design umgestellt - als ZWEITE ERBIN der
 * Fehlerdarstellung von Login.tsx (Register war die erste). Die drei
 * Gestalten sind dort im Kopfkommentar hergeleitet. Hier steht, wie diese
 * Seite sie belegt - und warum sie eine davon NICHT benutzt.
 *
 * Die vier Inline-Stile und dreizehn der achtzehn Klassen-Token sind in
 * Klassen gezogen (styles/components.css, Abschnitt "Erfolgsblock einer
 * Auth-Seite"); der Eintrag dieser Datei in scripts/design_sperrklinke.json
 * ist entfallen - ein neuer Inline-Stil hier faellt ab sofort auf.
 *
 * WARUM GESTALT 1 (die Meldung AM FELD) HIER FEHLT
 * ------------------------------------------------
 * Das Paket verlangt "Meldung direkt beim betroffenen Feld". Diese Seite
 * hat kein betroffenes Feld, und das ist am Quelltext nachgesehen, nicht
 * angenommen:
 *
 * store/auth.ts ruft in `resetPassword` supabase.auth.resetPasswordForEmail
 * auf. Seit dem 07.09.2026 kommt von dort eine ART zurueck (abgelehnt,
 * zu-oft, nicht erreichbar, …) - aber KEIN Zweig, der irgendein Signal
 * ueber Kontoexistenz liest, und genau darauf kaeme es hier an. Die Art
 * sagt, WORAN es lag; sie sagt nicht, dass die Adresse falsch ist. Der
 * Gegenbeweis steht in derselben Datei: signUp prueft ausdruecklich
 * data.user.identities?.length === 0 und begruendet dort ueber zehn Zeilen,
 * dass Supabase eine vergebene Adresse ABSICHTLICH mit gefaelschtem Erfolg
 * beantwortet - sonst liessen sich Konten durchprobieren. resetPassword hat
 * kein Gegenstueck zu dieser Pruefung.
 *
 * Ob GoTrue fuer unbekannte Adressen mit 200 antwortet, ist Verhalten
 * OBERHALB dieses Repositoriums und aus dem Quelltext NICHT belegbar. Es
 * wurde deshalb nicht behauptet und auch nicht gemessen (ein POST gegen die
 * Produktions-Auth verbrauchte die Ratenbegrenzung eines echten Nutzers).
 * Es muss auch nicht: Die Entscheidung haengt nicht daran.
 *
 *   Antwortet Supabase fuer Unbekannte mit 200, kann ein Fehler nie
 *   "Adresse falsch" heissen.
 *   Antwortete es doch mit einem Fehler, koennte die Seite ihn trotzdem
 *   nicht von 429 oder 500 unterscheiden - sie bekommt einen
 *   undifferenzierten Text, den lib/melden.ts:83 nicht anzeigen laesst.
 *
 * In BEIDEN Aesten ist aria-invalid am Feld eine Behauptung ueber eine
 * Tatsache, die niemand hat. So gehoert eine unbeantwortbare Frage
 * behandelt: nicht mit einer Vermutung, sondern indem man zeigt, dass sie
 * die Entscheidung nicht traegt.
 *
 * Der eine Fall, der wirklich an einem Feld haengt, ist ein ungueltiges
 * Adressformat - und den faengt type="email" required ab, BEVOR
 * handleSubmit laeuft. Derselbe Bau wie minLength bei Register. Was
 * handleSubmit je erreicht, ist Ratenbegrenzung, Server oder Netz.
 *
 * Es bleiben also GESTALT 2 (unter dem Ausloeser) und GESTALT 3 (neutral,
 * kein Feld markiert). Die Absicht der Regel ist gebaut, nicht ihr
 * Buchstabe - und das steht hier, statt stillschweigend zu geschehen.
 *
 * KEINE Sammelmeldung, GEMESSEN statt entschieden: Am Entwurf bei 320 x 800
 * (03.09.2026, beide Themen zeichengleich) steht die Unterkante des
 * E-Mail-Feldes bei 286 px, im schlimmsten Fall - beide feldlosen Meldungen
 * gleichzeitig eingesetzt - bei 430 px; das Formular endet bei 716 px.
 * Alles unter 800. Der zweite und staerkere Grund: Die Zahl der betroffenen
 * Felder ist NULL. Eine Sammelmeldung sammelte hier nichts. Die
 * Gegenleistung ist trotzdem gebaut - role="alert" an jeder Meldung. Ein
 * Fokussprung entfaellt mangels betroffenem Feld; der Fokus bleibt auf dem
 * Absendeknopf, unter dem die Meldung erscheint.
 *
 * OFFENER PUNKT, hier bewusst nicht behoben: Die Erfolgsansicht ersetzt das
 * Formular; der Fokus lag auf dem Absendeknopf, der dabei aus dem DOM
 * faellt, und landet auf <body>. role="status" sagt den Text an - der
 * Fokusverlust bleibt. Er trifft ForgotPassword, ConfirmEmail und die
 * Bestaetigungsansicht in Register gleich und gehoert in einen Zug.
 */

/**
 * Woran die Anfrage gescheitert ist - als Art, nicht als Text.
 * Der Text haengt an der Art und steht an genau einer Stelle. (Muster aus
 * Login.tsx; dort steht, warum er nicht im Zustand liegt.)
 */
type Fehlerart = 'server' | 'verbindung' | 'fehlschlag' | 'zu-oft'

const FEHLERTEXT: Record<Fehlerart, string> = {
  // Bis zum 03.09.2026 stand hier "Anfrage fehlgeschlagen. Bitte pruefe
  // deine E-Mail-Adresse." Das war nicht unverstaendlich, sondern
  // verstaendlich und FALSCH: Es schickte den Menschen los, eine richtige
  // Adresse zu korrigieren, waehrend in Wahrheit die Ratenbegrenzung greift
  // oder der Server schweigt. Wer dem folgte, tippte eine korrekte Adresse
  // um und scheiterte danach genauso. Eigener Fehlerbericht.
  //
  // "Warte einen Moment" statt "Pruef deine Adresse": Der wahrscheinlichste
  // erreichbare Fehler dieser Seite ist die Ratenbegrenzung (429,
  // over_email_send_rate_limit), und derselbe Rat passt auf einen 500er.
  // Er nennt die Ursache nicht - die kennt die Seite nicht - aber er nennt
  // einen naechsten Schritt, der in jedem erreichbaren Fall stimmt.
  server: 'Das hat gerade nicht geklappt. Warte einen Moment und versuch es noch einmal.',
  verbindung:
    'Dein Gerät ist gerade offline. Die Anfrage wurde nicht gesendet – deine E-Mail-Adresse stimmt womöglich.',
  // Derselbe Satz wie `server`, nur in der neutralen Gestalt. Kein neuer
  // Wortlaut - der Unterschied ist die Gestalt, nicht das Wort.
  fehlschlag: 'Das hat gerade nicht geklappt. Warte einen Moment und versuch es noch einmal.',
  // Bei `zu-oft` ist "einen Moment" zu wenig: Die Ratenbegrenzung dauert
  // laenger. Keine Sekundenzahl (Entwurf, R4-Q3).
  'zu-oft': 'Das hat gerade nicht geklappt. Warte ein paar Minuten und probier es dann noch einmal.',
}

/**
 * Von der Art zur Gestalt.
 *
 * Diese Seite kann bis heute nicht wissen, ob es zu der Adresse ein Konto
 * gibt (siehe Kopfkommentar) - `abgelehnt` heisst hier also nicht "Adresse
 * falsch", sondern nur "die Datenbank hat nein gesagt". Deshalb bleibt der
 * heutige Satz stehen und wandert nur zwischen den zwei Gestalten.
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
  // navigator.onLine ist nur in EINE Richtung verlaesslich (Muster aus
  // Login.tsx): Der Offline-Satz faellt nur, wenn Art und Geraet dasselbe
  // sagen.
  if (art === 'nicht-erreichbar' && !navigator.onLine) return 'verbindung'
  return GESTALT[art]
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [fehler, setFehler] = useState<Fehlerart | null>(null)
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const resetPassword = useAuth((s) => s.resetPassword)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // Erst hier faellt die alte Meldung weg, nicht beim Tippen: Das ist der
    // Moment der erneuten Pruefung.
    setFehler(null)
    setSubmitting(true)

    const hindernis = await resetPassword(email)
    setSubmitting(false)

    if (hindernis) {
      setFehler(gestaltFuer(hindernis.art))
      return
    }

    setSent(true)
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <div className="md-app-bar">
        <Link to="/login" className="md-app-bar__icon-btn" aria-label="Zurück">
          <Icon name="back" />
        </Link>
      </div>

      {sent ? (
        // role="status" am ganzen Block, nicht nur am Titel: Die Ansicht
        // ersetzt das Formular, und ohne Live-Region erfaehrt ein
        // Screenreader gar nicht, dass etwas geschehen ist. ConfirmEmail.tsx
        // :95 macht dasselbe fuer denselben Fall.
        <div className="md-auth-erfolg" role="status">
          <span className="md-auth-erfolg__zeichen">
            <Icon name="check" size={28} />
          </span>

          <p className="md-auth-erfolg__titel">Anfrage gesendet</p>

          {/* "Falls ein Konto ... existiert" ist kein Weichmacher, sondern
              der genaue Stand des Wissens: Die Seite erfaehrt nicht, ob es
              die Adresse gibt, und darf deshalb nicht behaupten, dass eine
              Mail unterwegs IST. Der Spam-Hinweis ist der naechste Schritt,
              den die Ansicht sonst schuldig bliebe. */}
          <p className="md-auth-erfolg__text">
            Falls ein Konto mit <strong>{email}</strong> existiert, haben wir einen
            Link zum Zurücksetzen gesendet. Kommt nichts an, schau im Spam-Ordner
            nach.
          </p>

          <Link to="/login" className="md-button md-button--filled">
            Zurück zur Anmeldung
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="md-auth-form">
          <div>
            <p className="md-greeting__title md-greeting__title--kompakt">
              Passwort vergessen
            </p>
            <p className="md-greeting__subtitle">
              Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen.
            </p>
          </div>

          {/* Gestalt 3: kein Feld ist schuld, also markiert nichts ein Feld.
              Neutral statt rot, und der Satz sagt ausdruecklich, dass die
              Adresse womoeglich stimmt. Seit dem 07.09.2026 tragen sie DREI
              Arten: offline, die Ratenbegrenzung und der ehrliche Rest. */}
          {(fehler === 'verbindung' || fehler === 'fehlschlag' || fehler === 'zu-oft') && (
            <div className="md-info-note md-info-note--neutral" role="alert">
              <Icon name="warn" size={20} className="icon icon-sm" />
              <p>{FEHLERTEXT[fehler]}</p>
            </div>
          )}

          <div className="md-field">
            <label className="md-field__label" htmlFor="forgot-email">E-Mail</label>
            {/* KEIN aria-invalid, in keinem Zustand - siehe Kopfkommentar. */}
            <input
              className="md-field__input"
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button
            className="md-button md-button--filled"
            type="submit"
            disabled={submitting}
            aria-describedby={fehler === 'server' ? 'forgot-server-fehler' : undefined}
          >
            {submitting ? 'Wird gesendet…' : 'Link senden'}
          </button>

          {/* Gestalt 2: gehoert zu keinem Feld, aber zu dem Knopf, der ihn
              ausgeloest hat - also steht er darunter. */}
          {fehler === 'server' && (
            <p className="md-formular-fehler" id="forgot-server-fehler" role="alert">
              <Icon name="warn" size={20} className="md-formular-fehler__icon" />
              <span className="md-formular-fehler__text">{FEHLERTEXT.server}</span>
            </p>
          )}

          <p className="md-auth-link">
            <Link to="/login">Zurück zur Anmeldung</Link>
          </p>
        </form>
      )}
    </div>
  )
}
