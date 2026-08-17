import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/auth'

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
 * Konto mit dem sechsstelligen Code aus der E-Mail bestaetigen.
 *
 * Der Code ist der Weg, der in der App bleibt: Ein Link fuehrt in den Browser
 * des Telefons, und der Rueckweg in die Android-Huelle braeuchte einen
 * Tiefenverweis. Der Link funktioniert trotzdem – er landet dann auf der
 * Bestaetigungsseite im Web, die dieses Formular ebenfalls anbietet.
 */
export default function CodeConfirmForm({ email, onEmailChange, onConfirmed }: Props) {
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pruefung, setPruefung] = useState(false)
  const [erneutGesendet, setErneutGesendet] = useState(false)

  const verifyCode = useAuth((s) => s.verifyCode)
  const resendCode = useAuth((s) => s.resendCode)

  const adresse = email.trim()

  const bestaetigen = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)

    if (!adresse) {
      setFehler('Trag zuerst die E-Mail-Adresse ein, an die der Code ging.')
      return
    }

    setPruefung(true)
    const err = await verifyCode(adresse, code)
    setPruefung(false)

    if (err) {
      setFehler(CODE_FEHLER)
      return
    }

    onConfirmed()
  }

  const erneutSenden = async () => {
    setFehler(null)

    if (!adresse) {
      setFehler('Trag zuerst die E-Mail-Adresse ein, an die der Code gehen soll.')
      return
    }

    const err = await resendCode(adresse)
    if (err) {
      setFehler('Erneut senden hat nicht geklappt. Versuch es in ein paar Minuten noch einmal.')
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

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>
          {fehler}
        </p>
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
