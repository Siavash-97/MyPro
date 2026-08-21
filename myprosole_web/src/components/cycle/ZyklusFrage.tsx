import { useState } from 'react'
import { useCycle, offeneFrage, alsTag } from '../../store/cycle'
import Icon from '../ui/Icon'
import { useSnackbar } from '../ui/Snackbar'

/**
 * Die Tagesfrage zum Zykluskalender.
 *
 * Gibt nichts aus, wenn heute nichts zu fragen ist – die Karte kann deshalb
 * ueberall eingebunden werden, ohne dass die Seite selbst wissen muss, ob
 * gerade eine Frage ansteht.
 *
 * Zur "Benachrichtigung": Eine Web-App kann nicht von sich aus melden,
 * solange sie geschlossen ist – auf dem iPhone gar nicht, solange sie nicht
 * auf dem Startbildschirm liegt. Die Frage erscheint deshalb beim Oeffnen
 * der App, oben auf der Startseite. Das ist bewusst so und kein Rueckstand:
 * Eine Frage, die man erst beim Oeffnen sieht, ist ehrlicher als eine
 * versprochene Meldung, die nie ankommt.
 */
export default function ZyklusFrage() {
  const { einstellungen, perioden, beginnAntwort, endeAntwort } = useCycle()
  const showSnackbar = useSnackbar()
  const [arbeitet, setArbeitet] = useState(false)

  const heute = alsTag(new Date())
  const frage = offeneFrage(einstellungen, perioden, heute)
  if (!frage) return null

  const antworten = async (ja: boolean) => {
    setArbeitet(true)
    const err = frage === 'beginn' ? await beginnAntwort(ja) : await endeAntwort(ja)
    setArbeitet(false)
    if (err) {
      showSnackbar('Antwort konnte nicht gespeichert werden: ' + err)
      return
    }
    if (ja) {
      showSnackbar(frage === 'beginn' ? 'Beginn für heute eingetragen' : 'Ende für heute eingetragen')
    } else {
      showSnackbar('Alles klar – morgen wird noch einmal gefragt')
    }
  }

  return (
    <section className="md-card">
      <div className="md-feature-heading">
        <div className="md-feature-heading__icon" aria-hidden="true">
          <Icon name="cycle" className="icon" />
        </div>
        <div>
          <p className="md-section-title" style={{ margin: '0 0 2px' }}>
            {frage === 'beginn'
              ? 'Hat deine Periode heute angefangen?'
              : 'Ist deine Periode vorbei?'}
          </p>
          <p>
            {frage === 'beginn'
              ? 'Sagst du Nein, wird morgen noch einmal gefragt. Sagst du Ja, ist heute als Beginn eingetragen.'
              : 'Sagst du Nein, wird morgen noch einmal gefragt. Sagst du Ja, ist heute als letzter Tag eingetragen.'}
          </p>
        </div>
      </div>

      {/* Zwei Knoepfe, ein Tippen. Kein Datumsfeld, keine Rueckfrage. */}
      <div className="md-row" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
        <button
          type="button"
          className="md-button md-button--filled"
          style={{ flex: 1 }}
          disabled={arbeitet}
          onClick={() => antworten(true)}
        >
          Ja
        </button>
        <button
          type="button"
          className="md-button md-button--tonal"
          style={{ flex: 1 }}
          disabled={arbeitet}
          onClick={() => antworten(false)}
        >
          Noch nicht
        </button>
      </div>
    </section>
  )
}
