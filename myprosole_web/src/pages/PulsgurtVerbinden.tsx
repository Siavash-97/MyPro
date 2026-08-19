
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBluetooth, istBrauchbar, type GefundenesGeraet } from '../store/bluetooth'
import Icon from '../components/ui/Icon'
import Blatt from '../components/ui/Blatt'
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
 *
 * Warum das Suchen in einem Blatt steckt
 * --------------------------------------
 * Einschalten, Suchen und Auswaehlen gehoeren zu einer Handlung und dauern
 * zusammen keine halbe Minute. Verteilt auf die Seite hiess das: ein
 * Hinweiskasten hier, ein Knopf da, die Liste darunter, und die Seite sprang
 * bei jedem Schritt. Im Blatt bleibt der Blick an einer Stelle, und danach
 * ist es weg – man baut sich keinen Zustand in eine Seite, den man hinterher
 * wieder aufraeumen muss.
 */
export default function PulsgurtVerbinden() {
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const {
    bereit, hindernis, suchtGerade, gefunden, verbundenMit, herzfrequenz, liefertPuls,
    akkustand, vorbereiten, einschalten, suchen, verbinden, trennen,
  } = useBluetooth()

  const [blattOffen, setBlattOffen] = useState(false)
  const [zeigeAlle, setZeigeAlle] = useState(false)

  // Nach Signalstaerke, das staerkste zuerst: Was in der Hand liegt, steht
  // oben.
  const nachStaerke = (a: GefundenesGeraet, b: GefundenesGeraet) =>
    (b.rssi ?? -999) - (a.rssi ?? -999)
  const brauchbare = gefunden.filter(istBrauchbar).sort(nachStaerke)
  const uebrige = gefunden.filter((g) => !istBrauchbar(g)).sort(nachStaerke)

  const waehlen = async (g: GefundenesGeraet) => {
    const err = await verbinden(g)
    showSnackbar(err ? 'Verbinden fehlgeschlagen: ' + err : 'Verbunden')
    // Bei Erfolg hat das Blatt seinen Zweck erfuellt; darunter steht dann
    // die Karte mit der Verbindung. Bei einem Fehler bleibt es offen, damit
    // man es gleich noch einmal versuchen kann.
    if (!err) setBlattOffen(false)
  }

  // Bewusst NICHT beim Oeffnen der Seite vorbereiten. Android erfragt die
  // Erlaubnis beim Druck, nicht beim Betrachten einer Seite – und wenn das
  // Vorbereiten dort scheiterte, blieb der Knopf abgeschaltet zurueck: Man
  // konnte ihn druecken, er war aber gar nicht drueckbar, ohne jede
  // Erklaerung.
  //
  // Jetzt loest ein Druck die ganze Kette aus: Blatt auf, Erlaubnis fragen,
  // suchen.
  const suchlaufStarten = async () => {
    setZeigeAlle(false)
    setBlattOffen(true)
    const grund = await vorbereiten()
    if (grund) return
    await suchen()
  }

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
                <p><strong>Koppelmodus</strong><br />Viele Geräte senden ihren Namen nur, während sie sich koppeln lassen.</p>
              </li>
              <li>
                <span>3</span>
                <p><strong>Suchen</strong><br />Bluetooth wird dabei eingeschaltet, wenn es aus ist.</p>
              </li>
            </ol>
          </section>

          <button
            type="button"
            className="md-button md-button--filled"
            onClick={suchlaufStarten}
            style={{ width: '100%' }}
          >
            <Icon name="bluetooth" size={20} className="icon-sm" />
            Geräte in der Nähe suchen
          </button>
        </>
      )}

      <button type="button" className="md-button md-button--text" onClick={() => navigate(-1)}>
        Zurück
      </button>

      <Blatt offen={blattOffen} onSchliessen={() => setBlattOffen(false)} titel="Geräte in der Nähe">
        {/* Jedes Hindernis bekommt seinen eigenen Satz – und wo es geht,
            einen Knopf, der es aus dem Weg raeumt. "Es geht nicht" ohne
            Grund war der eigentliche Fehler: Bluetooth war schlicht
            ausgeschaltet, und die App sagte es nicht. */}
        {hindernis === 'aus' && (
          <>
            <div className="md-info-note">
              <Icon name="warn" size={20} className="icon-sm" />
              <p>
                Bluetooth ist an deinem Telefon ausgeschaltet. Zum Einschalten fragt
                Android gleich noch einmal nach – diese Nachfrage gehört dem
                Betriebssystem, nicht der App.
              </p>
            </div>
            <button
              type="button"
              className="md-button md-button--filled"
              style={{ width: '100%' }}
              onClick={async () => {
                const grund = await einschalten()
                if (grund) {
                  showSnackbar('Bluetooth blieb aus.')
                  return
                }
                await suchen()
              }}
            >
              <Icon name="bluetooth" size={20} className="icon-sm" />
              Einschalten und suchen
            </button>
          </>
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

        {suchtGerade && (
          <p className="md-blatt-stand" role="status">
            Sucht… {brauchbare.length > 0 && `${brauchbare.length} gefunden`}
          </p>
        )}

        {brauchbare.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {brauchbare.map((g) => (
              <Geraetezeile key={g.deviceId} geraet={g} onWaehlen={waehlen} />
            ))}
          </div>
        )}

        {!suchtGerade && bereit && brauchbare.length === 0 && (
          <p className="md-blatt-stand">
            Nichts gefunden, mit dem sich eine Verbindung aufbauen lässt. Geräte melden
            sich nur, solange sie aktiv sind – ein Brustgurt wacht erst mit Hautkontakt
            auf, und manche Uhren zeigen sich nur, während man sie koppeln lässt.
          </p>
        )}

        {/* Nicht stillschweigend weglassen: Es ist gemessen worden, also
            gehoert es auch zeigbar zu sein. Wer sein Geraet vermisst, kommt
            hier heran – ohne dass die Liste fuer alle anderen zwei Dutzend
            Eintraege lang wird. */}
        {uebrige.length > 0 && !zeigeAlle && (
          <button
            type="button"
            className="md-button md-button--text"
            onClick={() => setZeigeAlle(true)}
          >
            {uebrige.length} weitere Funkkontakte zeigen
          </button>
        )}

        {uebrige.length > 0 && zeigeAlle && (
          <>
            <p className="md-blatt-stand">
              Diese Signale sind echt, aber keine Geräte zum Verbinden: Kopfhörer im
              Suchruf ihres Herstellers, Fernseher, fremde Telefone, Schlüsselfinder.
              Sie senden ohne Namen, ohne Dienstkennung oder nur ein einziges Mal unter
              einer wechselnden Adresse – deshalb stehen sie nicht oben.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {uebrige.map((g) => (
                <Geraetezeile key={g.deviceId} geraet={g} onWaehlen={waehlen} />
              ))}
            </div>
          </>
        )}

        {!suchtGerade && bereit && (
          <button
            type="button"
            className="md-button md-button--tonal"
            style={{ width: '100%' }}
            onClick={() => { setZeigeAlle(false); suchen() }}
          >
            <Icon name="search" size={20} className="icon-sm" />
            Nochmal suchen
          </button>
        )}
      </Blatt>
    </>
  )
}
