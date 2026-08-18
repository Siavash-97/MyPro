import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'

/**
 * Neues Passwort vergeben, nach dem Klick auf den Link aus der E-Mail.
 *
 * Der Link meldet an – supabase-js loest das Fragment beim Start selbst auf.
 * Danach fehlte bisher der zweite Teil: Man war angemeldet, stand auf der
 * Startseite und hatte nirgends ein Feld fuer ein neues Passwort. Wer sein
 * altes vergessen hatte, kam beim naechsten Mal wieder nicht hinein.
 *
 * Diese Seite ist bewusst nicht hinter dem Waechter: Sie wird ueber einen
 * Link erreicht, und der Waechter wuerde jemanden ohne abgeschlossene
 * Anamnese vorher woanders hinschicken.
 */
export default function PasswortNeu() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const setzePasswort = useAuth((s) => s.setzePasswort)

  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)

  // Ohne Anmeldung ist der Link abgelaufen oder wurde schon benutzt.
  const [geprueft, setGeprueft] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGeprueft(true), 1500)
    return () => clearTimeout(t)
  }, [])

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)

    if (passwort.length < 8) {
      setFehler('Das Passwort braucht mindestens 8 Zeichen.')
      return
    }
    if (passwort !== wiederholung) {
      setFehler('Die beiden Eingaben stimmen nicht überein.')
      return
    }

    setLaeuft(true)
    const err = await setzePasswort(passwort)
    setLaeuft(false)

    if (err) {
      setFehler('Das Passwort konnte nicht gesetzt werden: ' + err)
      return
    }
    setFertig(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  if (fertig) {
    return (
      <div className="md-auth-form">
        <div className="md-info-note md-info-note--neutral">
          <Icon name="check" size={20} className="icon icon-sm" />
          <p>Passwort geändert. Du bist angemeldet und wirst weitergeleitet…</p>
        </div>
      </div>
    )
  }

  if (geprueft && !user) {
    return (
      <div className="md-auth-form">
        <div>
          <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '0 0 4px' }}>
            Link nicht mehr gültig
          </p>
          <p className="md-greeting__subtitle">
            Der Link aus der E-Mail ist abgelaufen oder wurde schon benutzt. Fordere
            einen neuen an.
          </p>
        </div>
        <button
          type="button"
          className="md-button md-button--filled"
          onClick={() => navigate('/passwort-vergessen', { replace: true })}
        >
          Neuen Link anfordern
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={absenden} className="md-auth-form">
      <div>
        <p className="md-greeting__title" style={{ font: 'var(--type-title-lg)', margin: '0 0 4px' }}>
          Neues Passwort
        </p>
        <p className="md-greeting__subtitle">
          Vergib ein neues Passwort. Danach bist du angemeldet.
        </p>
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="passwort-neu">Neues Passwort</label>
        <input
          className="md-field__input"
          id="passwort-neu"
          type="password"
          autoComplete="new-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
        />
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="passwort-wdh">Noch einmal</label>
        <input
          className="md-field__input"
          id="passwort-wdh"
          type="password"
          autoComplete="new-password"
          value={wiederholung}
          onChange={(e) => setWiederholung(e.target.value)}
        />
      </div>

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>
      )}

      <button type="submit" className="md-button md-button--filled" disabled={laeuft}>
        {laeuft ? 'Wird gespeichert…' : 'Passwort speichern'}
      </button>
    </form>
  )
}
