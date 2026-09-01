import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAnamnese } from '../../store/anamnese'
import { useZusammenlauf, offeneAnMich } from '../../store/zusammenlauf'
import { eigeneKennung } from '../../lib/eigeneKennung'
import Icon from '../ui/Icon'

/**
 * Die Glocke oben rechts auf der Startseite.
 *
 * Bisher sagte sie nur "ist noch nicht eingerichtet". Jetzt zeigt sie, was
 * offen ist – vor allem die Anamnese: Ein Konto ohne sie bekommt Vorschläge
 * aus Durchschnittswerten statt aus den eigenen Angaben.
 *
 * Bewusst keine Systemmeldung, sondern ein Punkt an der Glocke. Eine Web-App
 * kann nicht von sich aus melden, solange sie geschlossen ist; auf dem iPhone
 * gar nicht, solange sie nicht auf dem Startbildschirm liegt. Ein Punkt, den
 * man beim Öffnen sieht, hält was er verspricht – eine Meldung, die nie
 * ankommt, nicht.
 */

/** Wird beim Verschieben von Block B gesetzt (siehe Anamnese-Seite). */
const BLOCK_B_MERKER = 'myprosole_blockb_reminder'

interface Hinweis {
  id: string
  titel: string
  text: string
  ziel: string
  knopf: string
}

export default function Benachrichtigungen() {
  const { fetchSessions, blockOffen } = useAnamnese()
  const kontaktAnfragen = useZusammenlauf((s) => s.kontaktAnfragen)
  const anfragenLaden = useZusammenlauf((s) => s.anfragenLaden)
  const [offen, setOffen] = useState(false)
  const [geladen, setGeladen] = useState(false)

  useEffect(() => {
    fetchSessions().then(() => setGeladen(true))
    // Scheitert das Laden (Migration fehlt, kein Netz), bleibt der Punkt
    // schlicht aus - die ZusammenLauf-Seite selbst meldet den Fehler laut.
    anfragenLaden()
  }, [fetchSessions, anfragenLaden])

  const hinweise: Hinweis[] = []

  const offeneAnfragen = offeneAnMich(kontaktAnfragen, eigeneKennung())
  if (offeneAnfragen > 0) {
    hinweise.push({
      id: 'zusammenlauf-anfragen',
      titel:
        offeneAnfragen === 1
          ? 'Eine Laufpartner-Anfrage wartet'
          : `${offeneAnfragen} Laufpartner-Anfragen warten`,
      text:
        offeneAnfragen === 1
          ? 'Jemand möchte mit dir laufen. Sieh dir das Profil an und entscheide in Ruhe – ohne Antwort passiert nichts.'
          : 'Mehrere Menschen möchten mit dir laufen. Sieh dir die Profile an und entscheide in Ruhe – ohne Antwort passiert nichts.',
      ziel: '/community/zusammenlauf',
      knopf: 'Anfragen ansehen',
    })
  }

  if (geladen && blockOffen('a')) {
    hinweise.push({
      id: 'anamnese-a',
      titel: 'Anamnese nachholen',
      text:
        'Ein paar Fragen zu Erfahrung, Pensum und früheren Beschwerden. ' +
        'Ohne sie rechnet MyProSole mit Durchschnittswerten – der Laufplan, ' +
        'die Übungsvorschläge und die Einschätzung deiner Läufe passen dann ' +
        'zu irgendwem, aber nicht zu dir. Es dauert wenige Minuten, und du ' +
        'kannst jede Frage überspringen.',
      ziel: '/anamnese',
      knopf: 'Jetzt beantworten',
    })
  } else if (
    geladen &&
    blockOffen('b') &&
    localStorage.getItem(BLOCK_B_MERKER) === 'true'
  ) {
    hinweise.push({
      id: 'anamnese-b',
      titel: 'Zweiter Teil der Anamnese',
      text:
        'Du hattest den zweiten Teil auf später verschoben. Er fragt nach ' +
        'Zielen und Belastbarkeit und macht die Empfehlungen genauer.',
      ziel: '/anamnese?teil=b',
      knopf: 'Weiter machen',
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="md-app-bar__icon-btn"
        aria-label={
          hinweise.length
            ? `Benachrichtigungen, ${hinweise.length} offen`
            : 'Benachrichtigungen'
        }
        aria-expanded={offen}
        style={{ position: 'relative' }}
      >
        <Icon name="bell" />
        {hinweise.length > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', top: 6, right: 6,
              width: 10, height: 10, borderRadius: '50%',
              background: 'var(--md-error)',
              border: '2px solid var(--md-surface)',
            }}
          />
        )}
      </button>

      {offen && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 'var(--space-sm)',
            zIndex: 40, width: 'min(360px, calc(100vw - 2 * var(--space-md)))',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)',
          }}
        >
          {hinweise.length === 0 ? (
            <div className="md-card">
              <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                Nichts offen. Hier stehen Hinweise, wenn etwas fehlt.
              </p>
            </div>
          ) : (
            hinweise.map((h) => (
              <div className="md-card" key={h.id}>
                <div className="md-feature-heading">
                  <div className="md-feature-heading__icon" aria-hidden="true">
                    <Icon name="info" className="icon" />
                  </div>
                  <div>
                    <p className="md-section-title" style={{ margin: '0 0 2px' }}>{h.titel}</p>
                    <p>{h.text}</p>
                  </div>
                </div>
                <Link
                  to={h.ziel}
                  onClick={() => setOffen(false)}
                  className="md-button md-button--filled md-button--compact"
                  style={{ textDecoration: 'none', marginTop: 'var(--space-sm)', width: '100%' }}
                >
                  {h.knopf}
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </>
  )
}
