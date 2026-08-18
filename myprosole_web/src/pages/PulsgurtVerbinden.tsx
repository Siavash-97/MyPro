import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBluetooth } from '../store/bluetooth'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Ein Geraet mit Herzfrequenz verbinden – Brustgurt oder Uhr im Sendemodus.
 *
 * Warum getrennt von "Einlage verbinden"
 * --------------------------------------
 * Die Herzfrequenz ist ein genormter Bluetooth-Dienst (0x180D): Jedes Geraet,
 * das ihn anbietet, spricht dasselbe Format – unabhaengig vom Hersteller.
 * Deshalb funktioniert das hier schon heute mit jedem Brustgurt.
 *
 * Die Einlage ist eigene Hardware mit eigenem Dienst. Sie kommt in dieselbe
 * Struktur, sobald die Firmware da ist; das Geruest darunter ist dasselbe.
 * Beides in einer Seite zu vermischen wuerde bedeuten, dass die eine Haelfte
 * dauerhaft "kommt noch" sagt.
 *
 * Was hier NICHT geht, und das gehoert dazugesagt: Schlaf, Trainings und
 * Schritte von einer Uhr. Die kommen nicht ueber Bluetooth, sondern ueber
 * Health Connect beziehungsweise HealthKit.
 */
export default function PulsgurtVerbinden() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const {
    bereit, suchtGerade, gefunden, verbundenMit, herzfrequenz, akkustand, fehler,
    vorbereiten, suchen, verbinden, trennen,
  } = useBluetooth()

  useEffect(() => {
    vorbereiten()
  }, [vorbereiten])

  return (
    <>
      <section className="md-connect-hero">
        <div className="md-connect-hero__icon">
          <Icon name="bluetooth" className="icon" />
        </div>
        <h1>Puls messen</h1>
        <p>
          Verbinde einen Brustgurt oder eine Uhr im Sendemodus. Der Puls erscheint
          dann während des Laufs.
        </p>
      </section>

      {verbundenMit ? (
        <section className="md-card">
          <div className="md-feature-heading">
            <div className="md-feature-heading__icon" aria-hidden="true">
              <Icon name="check" className="icon" />
            </div>
            <div>
              <p className="md-section-title" style={{ margin: '0 0 2px' }}>
                {verbundenMit.name ?? 'Gerät'} verbunden
              </p>
              <p>
                {herzfrequenz != null ? `${herzfrequenz} bpm` : 'Warte auf den ersten Wert…'}
                {akkustand != null && ` · Akku ${akkustand} %`}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="md-button md-button--text md-button--compact"
            style={{ marginTop: 'var(--space-sm)' }}
            onClick={() => trennen()}
          >
            Verbindung trennen
          </button>
        </section>
      ) : (
        <>
          <section className="md-card">
            <h2 className="md-section-title">Vorbereitung</h2>
            <ol className="md-step-list">
              <li>
                <span>1</span>
                <p><strong>Gurt anlegen</strong><br />Die Elektroden leicht anfeuchten, sonst findet er kein Signal.</p>
              </li>
              <li>
                <span>2</span>
                <p><strong>Uhr im Sendemodus</strong><br />Bei Garmin und Polar heißt das „Herzfrequenz senden".</p>
              </li>
              <li>
                <span>3</span>
                <p><strong>Bluetooth erlauben</strong><br />Die App fragt beim ersten Suchen danach.</p>
              </li>
            </ol>
          </section>

          {fehler && (
            <div className="md-info-note">
              <Icon name="warn" size={20} className="icon-sm" />
              <p>
                Bluetooth ist nicht bereit. Prüf, ob es eingeschaltet ist und die App
                die Erlaubnis hat.
              </p>
            </div>
          )}

          <button
            type="button"
            className="md-button md-button--filled"
            disabled={!bereit || suchtGerade}
            onClick={() => suchen()}
            style={{ width: '100%' }}
          >
            <Icon name="bluetooth" size={20} className="icon-sm" />
            {suchtGerade ? 'Sucht…' : 'Suche starten'}
          </button>

          {/* Nur Geraete mit Herzfrequenz-Dienst stehen hier. Ohne diesen
              Filter waere die Liste voller Kopfhoerer und Fernseher. */}
          {gefunden.length > 0 && (
            <section>
              <p className="md-section-title">Gefunden</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                {gefunden.map((g) => (
                  <button
                    key={g.deviceId}
                    type="button"
                    className="md-plan-item"
                    style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer' }}
                    onClick={async () => {
                      const err = await verbinden(g)
                      showSnackbar(err ? 'Verbinden fehlgeschlagen: ' + err : 'Verbunden')
                    }}
                  >
                    <span className="md-plan-item__body">
                      {g.name ?? 'Gerät ohne Namen'}
                      <small>Herzfrequenz</small>
                    </span>
                    <Icon name="chevron-right" size={20} className="icon-sm" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {!suchtGerade && gefunden.length === 0 && bereit && (
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Es werden nur Geräte gezeigt, die Herzfrequenz senden. Findet die Suche
              nichts, ist der Gurt meist noch nicht aktiv – er wacht erst auf, wenn er
              Hautkontakt hat.
            </p>
          )}
        </>
      )}

      <button type="button" className="md-button md-button--text" onClick={() => navigate(-1)}>
        Zurück
      </button>
    </>
  )
}
