
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBluetooth, type GefundenesGeraet } from '../store/bluetooth'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Wie nah ist das Geraet?
 *
 * dBm sagt niemandem etwas. Die Zahl ist aber der einzige Weg, das eigene
 * Geraet aus einer Liste fremder herauszufinden - deshalb steht sie als
 * Entfernung an jedem Eintrag.
 */
function naehe(rssi: number | null): string {
  if (rssi === null) return 'Stärke unbekannt'
  if (rssi >= -60) return 'ganz nah'
  if (rssi >= -75) return 'in der Nähe'
  if (rssi >= -90) return 'weiter weg'
  return 'sehr schwach'
}

/** Eine Zeile in der Fundliste - einmal beschrieben, zweimal benutzt. */
function Geraetezeile({
  geraet,
  onWaehlen,
}: {
  geraet: GefundenesGeraet
  onWaehlen: (g: GefundenesGeraet) => void
}) {
  return (
    <button
      type="button"
      className="md-plan-item"
      style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer' }}
      onClick={() => onWaehlen(geraet)}
    >
      <span className="md-plan-item__body">
        {geraet.name ?? 'Gerät ohne Namen'}
        <small>
          {[geraet.kannPuls ? 'sendet Herzfrequenz' : null, naehe(geraet.rssi)]
            .filter(Boolean)
            .join(' · ')}
        </small>
      </span>
      <Icon name="chevron-right" size={20} className="icon-sm" />
    </button>
  )
}

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
    bereit, hindernis, suchtGerade, gefunden, verbundenMit, herzfrequenz, liefertPuls,
    akkustand, vorbereiten, einschalten, suchen, verbinden, trennen,
  } = useBluetooth()

  const [zeigeNamenlose, setZeigeNamenlose] = useState(false)

  // Nach Signalstaerke, das staerkste zuerst: Was in der Hand liegt, steht
  // oben. Getrennt nach Namen, weil eine Suche vor allem Fremdes findet -
  // gemessen 25 Kontakte, davon 2 mit Namen. Ohne Trennung geht das eigene
  // Geraet in zwei Dutzend "Geraet ohne Namen" unter.
  const nachStaerke = (a: GefundenesGeraet, b: GefundenesGeraet) =>
    (b.rssi ?? -999) - (a.rssi ?? -999)
  const benannte = gefunden.filter((g) => g.name).sort(nachStaerke)
  const namenlose = gefunden.filter((g) => !g.name).sort(nachStaerke)

  const waehlen = async (g: GefundenesGeraet) => {
    const err = await verbinden(g)
    showSnackbar(err ? 'Verbinden fehlgeschlagen: ' + err : 'Verbunden')
  }

  // Bewusst NICHT beim Oeffnen vorbereiten. Android erfragt die Erlaubnis
  // beim Druck, nicht beim Betrachten einer Seite – und wenn das Vorbereiten
  // hier scheiterte, blieb der Knopf abgeschaltet zurueck: Man konnte ihn
  // druecken, er war aber gar nicht drueckbar, ohne jede Erklaerung.
  //
  // Jetzt loest der Druck beides aus: erst vorbereiten, dann suchen.

  return (
    <>
      <section className="md-connect-hero">
        <div className="md-connect-hero__icon">
          <Icon name="bluetooth" className="icon" />
        </div>
        <h1>Gerät verbinden</h1>
        <p>
          Such nach Geräten in der Nähe und verbinde dich – Smartwatch, Brustgurt
          oder später die Einlage.
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
                {liefertPuls
                  ? herzfrequenz != null
                    ? `${herzfrequenz} bpm`
                    : 'Warte auf den ersten Wert…'
                  : 'Verbunden'}
                {akkustand != null && ` · Akku ${akkustand} %`}
              </p>
            </div>
          </div>
          {/* Ehrlich benennen, was dieses Geraet kann. Verbunden zu sein
              heisst noch nicht, dass wir seine Daten lesen koennen –
              dafuer muss jedes Geraet einzeln angebunden werden. */}
          {!liefertPuls && (
            <div className="md-info-note md-info-note--neutral" style={{ marginTop: 'var(--space-sm)' }}>
              <Icon name="info" size={20} className="icon icon-sm" />
              <p>
                Die Verbindung steht. Daten von diesem Gerät auszulesen ist noch nicht
                gebaut – jedes Gerät liefert sie in einem eigenen Format, das einzeln
                angebunden werden muss. Herzfrequenz funktioniert schon, wenn ein Gerät
                sie sendet.
              </p>
            </div>
          )}

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
                <p><strong>Gerät einschalten</strong><br />Uhr am Handgelenk, Brustgurt angelegt – sonst sendet es nichts.</p>
              </li>
              <li>
                <span>2</span>
                <p><strong>Bluetooth erlauben</strong><br />Die App fragt beim ersten Suchen danach.</p>
              </li>
              <li>
                <span>3</span>
                <p><strong>Suchen</strong><br />Es werden alle Geräte in der Nähe gezeigt.</p>
              </li>
            </ol>
          </section>

          {/* Jedes Hindernis bekommt seinen eigenen Satz – und wo es geht,
              einen Knopf, der es aus dem Weg raeumt. "Es geht nicht" ohne
              Grund war der eigentliche Fehler: Bluetooth war schlicht
              ausgeschaltet, und die App sagte es nicht. */}
          {hindernis === 'aus' && (
            <div className="md-info-note">
              <Icon name="warn" size={20} className="icon-sm" />
              <div>
                <p style={{ margin: '0 0 var(--space-sm)' }}>
                  Bluetooth ist an deinem Telefon ausgeschaltet.
                </p>
                <button
                  type="button"
                  className="md-button md-button--filled md-button--compact"
                  onClick={async () => {
                    const grund = await einschalten()
                    if (grund) showSnackbar('Bluetooth blieb aus. Schalt es in den Einstellungen ein.')
                  }}
                >
                  Bluetooth einschalten
                </button>
              </div>
            </div>
          )}

          {hindernis === 'keine-erlaubnis' && (
            <div className="md-info-note">
              <Icon name="warn" size={20} className="icon-sm" />
              <p>
                Die App darf Bluetooth nicht benutzen. Erlaub den Zugriff, wenn Android
                danach fragt – oder in den Telefoneinstellungen unter Apps →
                MyProSole → Berechtigungen.
              </p>
            </div>
          )}

          <button
            type="button"
            className="md-button md-button--filled"
            disabled={suchtGerade}
            onClick={async () => {
              // Erst hier fragt Android nach der Erlaubnis – ausgeloest durch
              // eine Handlung, wie es sein soll.
              const grund = bereit ? null : await vorbereiten()
              if (grund) return
              await suchen()
            }}
            style={{ width: '100%' }}
          >
            <Icon name="bluetooth" size={20} className="icon-sm" />
            {suchtGerade ? 'Sucht…' : 'Suche starten'}
          </button>

          {/* Alle Geraete in Reichweite. Ein Filter waere hier falsch: Er
              hat vorher jede Uhr versteckt, die gerade nicht sendet, und
              die Suche sah leer aus, obwohl Geraete da waren. */}
          {gefunden.length > 0 && (
            <section>
              <p className="md-section-title">Gefunden</p>

              {benannte.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                  {benannte.map((g) => (
                    <Geraetezeile key={g.deviceId} geraet={g} onWaehlen={waehlen} />
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                  Kein Gerät mit Namen in Reichweite. Die meisten Geräte senden ihren
                  Namen erst, während sie sich koppeln lassen – bei Kopfhörern also im
                  Kopplungsmodus, bei einer Uhr in deren Bluetooth-Einstellungen.
                </p>
              )}

              {namenlose.length > 0 && !zeigeNamenlose && (
                <button
                  type="button"
                  className="md-button md-button--text"
                  style={{ marginTop: 'var(--space-sm)' }}
                  onClick={() => setZeigeNamenlose(true)}
                >
                  {namenlose.length} weitere ohne Namen zeigen
                </button>
              )}

              {namenlose.length > 0 && zeigeNamenlose && (
                <div style={{ marginTop: 'var(--space-md)' }}>
                  <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                    Diese Geräte sind echt, aber meist fremd: Telefone, Fernseher und
                    Kopfhörer aus der Nachbarschaft. Sie senden aus Datenschutzgründen
                    ohne Namen. Deins ist – wenn überhaupt – eines der obersten, denn
                    je stärker das Signal, desto näher steht es.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                    {namenlose.map((g) => (
                      <Geraetezeile key={g.deviceId} geraet={g} onWaehlen={waehlen} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {!suchtGerade && gefunden.length === 0 && (
            <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Noch nichts gefunden. Geräte melden sich nur, solange sie aktiv sind –
              ein Brustgurt wacht erst mit Hautkontakt auf, und manche Uhren zeigen
              sich nur, während man sie koppeln lässt.
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
