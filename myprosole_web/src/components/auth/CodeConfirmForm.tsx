import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import Icon from '../ui/Icon'

/** Laenge des Bestaetigungscodes aus der E-Mail. */
const CODE_LENGTH = 6

interface Props {
  /** Adresse, an die der Code ging. */
  email: string
  /**
   * Gesetzt, wenn die Adresse noch geaendert werden darf – auf der
   * Bestaetigungsseite, wo sie nur aus dem Merkzettel stammt und falsch oder
   * leer sein kann. In der Registrierung ist sie gerade eingetippt worden und
   * bleibt fest.
   */
  onEmailChange?: (email: string) => void
  /** Laeuft nach erfolgreicher Bestaetigung. Die Sitzung steht dann bereits. */
  onConfirmed: () => void
}

/**
 * Supabase antwortet auf Englisch und unterscheidet einen falschen Code nicht
 * von einem abgelaufenen – beide Male kommt "Token has expired or is invalid".
 * Eine Meldung, die "abgelaufen" behauptet, waere deshalb geraten. Der dritte
 * Fall steckt in derselben Antwort: Wer den Link angeklickt hat, hat den Code
 * damit verbraucht.
 */
const CODE_FEHLER =
  'Der Code stimmt nicht oder ist nicht mehr gültig. Prüf die sechs Ziffern aus der E-Mail, oder lass dir einen neuen schicken.'

/**
 * Die dritte Gestalt (Auftrag 4a-ii, 07.09.2026), Aufbau nachgesehen bei
 * Login.tsx (`NEUTRAL_ANFANG`, `gestaltFuer`) und ForgotPassword.tsx.
 *
 * Nur `abgelehnt` ist der Code selbst - otp_expired deckt falsch UND
 * abgelaufen, und Supabase unterscheidet beides nicht (Kopfkommentar von
 * `CODE_FEHLER`). Das bleibt rot. Jede andere Art ist nicht die Schuld des
 * Menschen: Ratenbegrenzung, Netz, ein unbekannter Rest. Rot markierte in
 * keinem dieser Faelle einen Code, an dem etwas falsch ist - die neutrale
 * Notiz sagt das ausdruecklich ("Dein Code stimmt womoeglich"), statt einen
 * Menschen zum Neueintippen eines richtigen Codes zu schicken.
 *
 * Kein neuer Kontrastnachweis noetig: `.md-info-note--neutral` steht hier auf
 * derselben Kartenflaeche wie bei Login und ForgotPassword, nicht auf dem
 * Video-Scrim von Welcome.tsx - dort bleibt die Gestalt deshalb bewusst rot
 * (siehe Kopfkommentar von `googleSatz` in Welcome.tsx).
 *
 * KEINE Sekundenzahl bei `zu-oft` (Entwurf, R4-Q3) - nur "warten" statt
 * "gleich noch einmal".
 */
const CODE_NEUTRAL_ANFANG = 'Die Prüfung hat gerade nicht geklappt. Dein Code stimmt womöglich – '
const CODE_NEUTRAL_FEHLSCHLAG = CODE_NEUTRAL_ANFANG + 'versuch es gleich noch einmal.'
const CODE_NEUTRAL_ZU_OFT =
  CODE_NEUTRAL_ANFANG + 'warte ein paar Minuten und probier es dann noch einmal.'

/** Der heutige Satz von `erneutSenden` - unveraendert, nur die Gestalt folgt jetzt der Art. */
const RESEND_FEHLER = 'Erneut senden hat nicht geklappt. Versuch es in ein paar Minuten noch einmal.'

/**
 * Gestalt und Text zusammen. Nur diese zwei Gestalten kommen hier vor - kein
 * Feld dieses Formulars wird je markiert (`aria-invalid`), der Code ist ein
 * einzelnes Eingabefeld ohne Paarungsproblem wie bei Login.
 */
interface Fehleranzeige {
  gestalt: 'rot' | 'neutral'
  text: string
}

/**
 * Konto mit dem sechsstelligen Code aus der E-Mail bestaetigen.
 *
 * Der Code ist der Weg, der in der App bleibt: Ein Link fuehrt in den Browser
 * des Telefons, und der Rueckweg in die Android-Huelle braeuchte einen
 * Tiefenverweis. Der Link funktioniert trotzdem – er landet dann auf der
 * Bestaetigungsseite im Web, die dieses Formular ebenfalls anbietet.
 */
export default function CodeConfirmForm({ email, onEmailChange, onConfirmed }: Props) {
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<Fehleranzeige | null>(null)
  const [pruefung, setPruefung] = useState(false)
  const [erneutGesendet, setErneutGesendet] = useState(false)

  const verifyCode = useAuth((s) => s.verifyCode)
  const resendCode = useAuth((s) => s.resendCode)

  const adresse = email.trim()

  const bestaetigen = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)

    if (!adresse) {
      setFehler({ gestalt: 'rot', text: 'Trag zuerst die E-Mail-Adresse ein, an die der Code ging.' })
      return
    }

    setPruefung(true)
    const hindernis = await verifyCode(adresse, code)
    setPruefung(false)

    if (hindernis) {
      // Nur `abgelehnt` bleibt rot (der Code selbst). Alles andere ist
      // nicht die Schuld des Menschen und bekommt die neutrale Notiz
      // (Entwurf, R3-Q2) - `zu-oft` sagt zusaetzlich, was jetzt hilft.
      setFehler(
        hindernis.art === 'abgelehnt'
          ? { gestalt: 'rot', text: CODE_FEHLER }
          : {
              gestalt: 'neutral',
              text: hindernis.art === 'zu-oft' ? CODE_NEUTRAL_ZU_OFT : CODE_NEUTRAL_FEHLSCHLAG,
            },
      )
      return
    }

    onConfirmed()
  }

  const erneutSenden = async () => {
    setFehler(null)

    if (!adresse) {
      setFehler({
        gestalt: 'rot',
        text: 'Trag zuerst die E-Mail-Adresse ein, an die der Code gehen soll.',
      })
      return
    }

    // Derselbe Satz in jedem Fall - er nennt bereits den einen naechsten
    // Schritt, der in jedem erreichbaren Fall stimmt, und die Wartezeit
    // steht schon darin. Nur die Gestalt folgt der Art: `abgelehnt` bleibt
    // rot, alles andere ist nicht die Schuld des Menschen (Entwurf, R3-Q2).
    const hindernis = await resendCode(adresse)
    if (hindernis) {
      setFehler({ gestalt: hindernis.art === 'abgelehnt' ? 'rot' : 'neutral', text: RESEND_FEHLER })
      return
    }
    setErneutGesendet(true)
  }

  return (
    <form className="md-auth-form" onSubmit={bestaetigen}>
      {onEmailChange && (
        <div className="md-field">
          <label className="md-field__label" htmlFor="confirm-email">E-Mail</label>
          <input
            className="md-field__input"
            id="confirm-email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@beispiel.de"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>
      )}

      <div className="md-field">
        <label className="md-field__label" htmlFor="confirm-code">Bestätigungscode</label>
        <input
          className="md-field__input"
          id="confirm-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ letterSpacing: '0.3em', textAlign: 'center', font: 'var(--type-title-lg)' }}
        />
      </div>

      {fehler?.gestalt === 'rot' && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>
          {fehler.text}
        </p>
      )}

      {/* Gestalt 3: nicht die Schuld des Menschen, also markiert nichts ein
          Feld. role="alert", kein aria-invalid - Aufbau wie Login.tsx und
          ForgotPassword.tsx. */}
      {fehler?.gestalt === 'neutral' && (
        <div className="md-info-note md-info-note--neutral" role="alert">
          <Icon name="warn" size={20} className="icon icon-sm" />
          <p>{fehler.text}</p>
        </div>
      )}

      <button
        type="submit"
        className="md-button md-button--filled"
        disabled={pruefung || code.length < CODE_LENGTH}
      >
        {pruefung ? 'Wird geprüft…' : 'Bestätigen'}
      </button>

      <button
        type="button"
        className="md-button md-button--text"
        disabled={erneutGesendet}
        onClick={erneutSenden}
      >
        {erneutGesendet ? 'Neuer Code ist unterwegs' : 'Code erneut senden'}
      </button>

      <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Keine E-Mail bekommen? Sieh im Spam-Ordner nach. Manchmal dauert es ein
        paar Minuten.
      </p>

      {/* Wer den Link angeklickt hat, ist im Browser bestaetigt – in der App
          bleibt dieser Schritt dann trotzdem stehen, und der Code aus
          derselben Mail ist verbraucht. Ohne diesen Ausgang waere man hier
          eingesperrt. */}
      <p className="md-auth-link" style={{ margin: 0 }}>
        Schon über den Link bestätigt? <Link to="/login">Anmelden</Link>
      </p>
    </form>
  )
}
