import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useBluetooth } from '../store/bluetooth'
import { aufTelefon, aufzeichnungStand } from '../lib/aufzeichnungBruecke'
import { useRun } from '../store/run'
import { formatDurationDisplay } from '../lib/format'
import RouteMap from '../components/map/RouteMap'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

export default function LiveTracking() {
  const navigate = useNavigate()
  const {
    phase,
    liveStats,
    points,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    addPoint,
    tick,
    punkteEinsammeln,
    lastAccuracyM,
    ortungsverlauf,
  } = useRun()
  const herzfrequenz = useBluetooth((s) => s.herzfrequenz)

  const showSnackbar = useSnackbar()
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abholRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)

  useEffect(() => {
    // Nur den oertlichen Zustand setzen – in der Datenbank landet der Lauf
    // erst beim Beenden.
    if (phase === 'idle') {
      startRun()
    }
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (abholRef.current) {
        clearInterval(abholRef.current)
        abholRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    // Auf dem Telefon liefert der Dienst, im Browser navigator.geolocation.
    // Nie beide: Sie fragen denselben Empfaenger, und wenn beide zaehlen,
    // steht am Ende die doppelte Strecke.
    if (phase === 'tracking' && !aufTelefon() && watchIdRef.current == null) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsError(null)
          addPoint({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            altitude_m: pos.coords.altitude,
            accuracy_m: pos.coords.accuracy,
            speed_mps: pos.coords.speed,
            zeitMs: pos.timestamp,
          })
        },
        (err) => {
          setGpsError(
            err.code === 1
              ? 'GPS-Zugriff verweigert'
              : err.code === 2
                ? 'GPS nicht verfügbar'
                : 'GPS-Zeitüberschreitung',
          )
        },
        // maximumAge: 0 – lieber auf eine frische Messung warten als einen
        // zwischengespeicherten Standort von vorhin nehmen. Bei Laufgeschwindig-
        // keit sind selbst wenige Sekunden Alter schon zweistellige Meter.
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
      )
    }

    if (phase === 'tracking' && !timerRef.current) {
      timerRef.current = setInterval(() => tick(), 1000)
    }

    // Auf dem Telefon im Takt beim Dienst abholen. Zwei Sekunden reichen:
    // Die Anzeige soll mitlaufen, aber jede Abfrage kostet einen Sprung
    // ueber die Bruecke.
    //
    // Waehrend die Seite schlaeft, laeuft dieser Takt nicht - das ist kein
    // Verlust, denn der Dienst sammelt weiter. Beim Zurueckkommen wird
    // nachgeholt, und beim Beenden noch einmal.
    if (phase === 'tracking' && aufTelefon() && !abholRef.current) {
      abholRef.current = setInterval(() => { punkteEinsammeln() }, 1000)
    }
    if (phase !== 'tracking' && abholRef.current) {
      clearInterval(abholRef.current)
      abholRef.current = null
    }

    if (phase === 'paused' && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (phase === 'paused' && watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [phase, addPoint, tick, punkteEinsammeln])

  // Frueher stand hier: "Verlaesst jemand die App, wird der Lauf beendet und
  // gespeichert. Der Browser haelt die Aufzeichnung im Hintergrund ohnehin
  // an – ein Lauf, der scheinbar weiterlaeuft, waere eine Luege.
  // Hintergrund-Aufzeichnung kommt mit der nativen App."
  //
  // Die native App ist da, und der Dienst laeuft. Genau diese Zeilen haben
  // beim ersten Geraetetest den Lauf gekillt: Bildschirm aus, und die Seite
  // beendete ihren eigenen Lauf. Im Protokoll stand "Dienst gestoppt" -
  // nicht von Samsung abgeschossen, sondern von uns selbst.
  //
  // Auf dem Telefon laeuft die Aufzeichnung jetzt weiter; der Dienst
  // sammelt, auch wenn die Seite schlaeft. Im Browser gilt der alte Grund
  // unveraendert - dort gibt es keinen Dienst, und ein Lauf, der scheinbar
  // weiterlaeuft, waere eine Luege. Der Browser ist aber nur noch
  // Entwicklungsumgebung.
  useEffect(() => {
    if (aufTelefon()) return

    const onHidden = () => {
      if (document.visibilityState !== 'hidden') return
      const { phase: current } = useRun.getState()
      if (current === 'tracking' || current === 'paused') finishRun()
    }

    document.addEventListener('visibilitychange', onHidden)
    return () => document.removeEventListener('visibilitychange', onHidden)
  })

  // Waehrend die Seite schlief, kann in der Benachrichtigung etwas passiert
  // sein: pausiert, fortgesetzt, oder "Beenden" getippt. Beim Zurueckkommen
  // wird abgeglichen.
  //
  // Der Dienst ist dabei die Wahrheit, nicht die Seite. Ein Zustand, den man
  // an zwei Stellen fuehrt, laeuft irgendwann auseinander - und die Seite ist
  // die, die geschlafen hat.
  useEffect(() => {
    if (!aufTelefon()) return

    const abgleichen = async () => {
      if (document.visibilityState !== 'visible') return
      const { phase: jetzt, sitzungId } = useRun.getState()
      if (jetzt !== 'tracking' && jetzt !== 'paused') return

      const stand = await aufzeichnungStand(sitzungId ?? undefined)
      if (!stand) return

      // Zuerst nachholen, was waehrend des Schlafs zusammengekommen ist -
      // sonst springt die Anzeige erst beim naechsten Takt.
      await punkteEinsammeln()

      if (stand.pausiert && jetzt === 'tracking') pauseRun()
      if (!stand.pausiert && jetzt === 'paused') resumeRun()

      // Nur fragen, nicht beenden. Der Lauf laeuft weiter, bis jemand in der
      // App bestaetigt - ein Tipper in der Statusleiste, womoeglich in der
      // Hosentasche, soll keine Stunde Arbeit wegwerfen koennen.
      if (stand.beendenGewuenscht) setConfirmStop(true)
    }

    abgleichen()
    document.addEventListener('visibilitychange', abgleichen)
    return () => document.removeEventListener('visibilitychange', abgleichen)
  }, [pauseRun, resumeRun, punkteEinsammeln])

  const handlePauseResume = () => {
    if (phase === 'tracking') pauseRun()
    else if (phase === 'paused') resumeRun()
  }

  // Der Stop-Knopf fragt vorher nach; aus dem Hintergrund-Dialog heraus ist
  // die Entscheidung schon getroffen und finishRun wird direkt aufgerufen.
  const handleStop = () => {
    if (!confirmStop) {
      setConfirmStop(true)
      return
    }
    finishRun()
  }

  const finishRun = async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const { runId, error } = await stopRun()

    if (error) {
      showSnackbar(error)
      return
    }

    // Zu kurz: Es wurde nichts gespeichert, und das sagt die App auch, statt
    // einen Lauf ueber 0,0 km in den Verlauf zu stellen.
    if (!runId) {
      showSnackbar('Zu kurz zum Aufzeichnen – es wurde nichts gespeichert.')
      navigate('/', { replace: true })
      return
    }

    // Wie im Mockup: direkt nach dem Lauf zuerst der Tagebuch-Prompt
    // (mit "Später eintragen"), von dort geht es zur Zusammenfassung.
    // Die Kennung des eben beendeten Laufs mitgeben, damit der
    // Tagebucheintrag daran haengt und nicht nur am Datum.
    navigate(`/training/tagebuch?from=tracking&lauf=${runId}`, { replace: true })
  }

  // Minimieren, nicht abbrechen: Der Lauf zeichnet weiter auf, man geht nur
  // zurueck zur Startseite. Zum Beenden gibt es den Stop-Knopf mit Rueckfrage.
  // Ein versehentlicher Tap kostet so keinen Lauf.
  const handleMinimize = () => {
    navigate('/')
  }

  // Nach einer Viertelminute ohne einen einzigen brauchbaren Punkt ist es kein
  // Warten mehr, sondern fehlender Empfang. Das gehoert gesagt, statt weiter
  // "Warte auf GPS-Signal" anzuzeigen. Der Zaehler laeuft ab Knopfdruck, es
  // braucht also keinen eigenen Zustand.
  // Zwei verschiedene Zustaende, die frueher denselben Satz bekamen.
  //
  // "Kein GPS-Signal" hiess bisher schlicht "keine Punkte" - und Punkte
  // entstehen erst, wenn Bewegung erkannt wird. Am 21.08.2026 stand deshalb
  // "Kein GPS-Signal" auf der Karte, waehrend oben "GPS +/-4 m" leuchtete.
  // Der Hinweis schickte den Laeufer nach draussen, wo er laengst war.
  const hatMessung = ortungsverlauf.length > 0
  const langGenug = liveStats.durationS >= 15
  const keinSignal = !hatMessung && langGenug
  const keineBewegung = hatMessung && points.length === 0 && langGenug


  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      {/* Top bar */}
      <header className="md-app-bar">
        <button
          type="button"
          onClick={handleMinimize}
          className="md-app-bar__icon-btn"
          aria-label="Minimieren"
        >
          <Icon name="back" className="icon" />
        </button>
        <span className="md-app-bar__title">
          {phase === 'paused' ? 'Pausiert' : 'Lauf läuft'}
        </span>
        <div
          className={`md-chip ${gpsError || keinSignal ? 'md-chip--disconnected' : 'md-chip--connected'}`}
          style={{ padding: '4px 10px' }}
        >
          <Icon name="location" size={20} className="icon-sm" />
          {/* Wie gut das Signal gerade ist, in Metern. Ohne diese Angabe wirkt
              Warten wie Stillstand – man sieht nicht, dass es besser wird. */}
          {lastAccuracyM != null ? `GPS ±${Math.round(lastAccuracyM)} m` : 'GPS'}
        </div>
      </header>

      <main className="md-page-stack flex-1" style={{ paddingTop: 'var(--space-sm)' }}>
        {/* Timer */}
        <div>
          <p className="md-timer" style={{ margin: 0 }}>
            {formatDurationDisplay(liveStats.durationS)}
          </p>
          {/* Beim Stehen bleiben Strecke und Pace stehen. Ohne einen Hinweis
              sieht das aus, als haenge die App – deshalb steht hier, was
              gerade gilt. Die Uhr laeuft weiter, das ist die Laufzeit; was
              davon unterwegs war, steht darunter, sobald es sich lohnt. */}
          <p className="md-timer__label">
            {phase === 'paused'
              ? 'Gesamtzeit · pausiert'
              : phase === 'tracking' && !liveStats.inBewegung
                ? 'Gesamtzeit · steht'
                : 'Gesamtzeit'}
          </p>
          {/* Zwei Zeiten nebeneinander, wie bei Strava: Die Gesamtzeit sagt,
              wie lange der Lauf gedauert hat - Ampel inbegriffen. Die
              Bewegungszeit sagt, wie viel davon Laufen war. Aus ihr rechnet
              sich der Schnitt fuer die Zusammenfassung; waehrend des Laufs
              steht dagegen das Tempo JETZT auf dem Bildschirm. */}
          {liveStats.durationS - Math.round(liveStats.bewegungszeitS) >= 5 && (
            <p className="md-timer__label">
              davon {formatDurationDisplay(Math.round(liveStats.bewegungszeitS))} in Bewegung
            </p>
          )}
        </div>

        {/* Live stats card */}
        <div className="md-card">
          <div className="md-live-stats">
            <div className="md-live-stat">
              <p className="md-live-stat__value">
                {liveStats.distanceKm.toFixed(1).replace('.', ',')}
              </p>
              <p className="md-live-stat__label">km</p>
            </div>
            <div className="md-live-stat">
              <p className="md-live-stat__value">{liveStats.paceDisplay}</p>
              <p className="md-live-stat__label">min/km</p>
            </div>
            <div className="md-live-stat">
              <p className="md-live-stat__value">
                {Math.round(liveStats.elevationGainM)}
              </p>
              <p className="md-live-stat__label">Hm</p>
            </div>
            {/* Herzfrequenz wie im Entwurf: Die Kachel steht immer da und
                zeigt "--", solange kein Geraet verbunden ist. Jetzt mit
                echtem Wert, sobald ein Brustgurt oder eine Uhr im
                Sendemodus verbunden ist. */}
            {/* Ohne Geraet fuehrt die Kachel zum Verbinden. Der Einstieg
                gehoert dorthin, wo er gebraucht wird – wer waehrend des
                Laufs auf "--" schaut, will genau das. */}
            {herzfrequenz == null ? (
              <Link
                to="/puls-verbinden"
                className="md-live-stat"
                style={{ textDecoration: 'none', color: 'inherit' }}
                aria-label="Pulsgurt verbinden"
              >
                {/* Das Zeichen steht an der Stelle des Wertes, nicht im
                    Label darunter. "bpm verbinden" stand vorher dort und
                    lief aus der Kachel heraus: Vier Kacheln teilen sich die
                    Breite, und Label brechen bewusst nie um. Ein Zeichen
                    braucht keine Breite und sagt dasselbe. */}
                <p className="md-live-stat__value md-live-stat__value--zeichen">
                  <Icon name="bluetooth" size={24} className="icon-sm" />
                </p>
                <p className="md-live-stat__label">bpm</p>
              </Link>
            ) : (
              <div className="md-live-stat">
                <p className="md-live-stat__value">{herzfrequenz}</p>
                <p className="md-live-stat__label">bpm</p>
              </div>
            )}
          </div>
        </div>

        {/* Route map */}
        <RouteMap
          points={points}
          height={140}
          live
          label="Live-Route auf der Karte"
          leerText={
            keinSignal
              ? 'Kein GPS-Signal'
              : keineBewegung
                ? 'Noch keine Bewegung erkannt'
                : 'Warte auf GPS-Signal…'
          }
        />

        {/* Kein Empfang: erklaeren statt schweigen. Die Aufzeichnung laeuft
            weiter, sobald das erste Signal da ist – deshalb kein Abbruch,
            sondern ein Hinweis. */}
        {!gpsError && keinSignal && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--md-surface-container-high)',
              color: 'var(--md-on-surface-variant)',
            }}
          >
            <Icon name="location" size={20} className="icon-sm" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, font: 'var(--type-body-md)' }}>
              Noch kein GPS-Signal. In Gebäuden findet das Handy oft keine
              Satelliten – geh nach draußen und halte es frei in der Hand, nicht
              in der Tasche. Sobald ein Signal da ist, zeichnet die App
              automatisch weiter auf.
            </p>
          </div>
        )}

        {/* Empfang ist da, aber nichts gilt als Bewegung. Frueher trug dieser
            Fall den Kein-Signal-Text und schickte Menschen nach draussen, wo
            sie schon waren. */}
        {!gpsError && keineBewegung && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--md-surface-container-high)',
              color: 'var(--md-on-surface-variant)',
            }}
          >
            <Icon name="info" size={20} className="icon-sm" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, font: 'var(--type-body-md)' }}>
              GPS ist da, aber es wird noch keine Bewegung erkannt. Beim Gehen
              dauert das ein paar Schritte. Bleibt es dabei, obwohl du läufst,
              sag uns bitte Bescheid – dann stimmt etwas mit der Erkennung
              nicht.
            </p>
          </div>
        )}

        {/* GPS error */}
        {gpsError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--md-error-container)',
              color: 'var(--md-on-error-container)',
            }}
          >
            <Icon name="warn" size={20} className="icon-sm" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, font: 'var(--type-body-md)' }}>{gpsError}</p>
          </div>
        )}

        {/* Coach banner */}
        <div className="md-coach-banner">
          <div className="md-coach-banner__icon">
            <Icon name="mic" size={20} className="icon-sm" />
          </div>
          <p className="md-coach-banner__text">
            App-Modus aktiv: Route, Zeit und Tempo werden aufgezeichnet.
            Einlagen kannst du jederzeit ergänzen.
          </p>
        </div>
      </main>

      {/* Bottom controls */}
      <div className="md-run-controls">
        <button
          type="button"
          onClick={handleStop}
          className="md-run-controls__btn md-run-controls__btn--secondary"
          aria-label="Beenden"
        >
          <Icon name="stop" className="icon" />
        </button>

        <button
          type="button"
          onClick={handlePauseResume}
          disabled={phase === 'saving'}
          className="md-run-controls__btn md-run-controls__btn--primary"
          style={{ opacity: phase === 'saving' ? 0.5 : 1 }}
          aria-label={phase === 'paused' ? 'Fortsetzen' : 'Pausieren'}
        >
          <Icon name={phase === 'paused' ? 'play' : 'pause'} size={32} />
        </button>

        <button
          type="button"
          className="md-run-controls__btn md-run-controls__btn--tertiary"
          // Sagte "kommt noch", seit das Verbinden gebaut ist aber
          // schlicht falsch. Derselbe Weg wie ueber die bpm-Kachel: Wer
          // waehrend des Laufs auf das Bluetooth-Zeichen tippt, will ein
          // Geraet verbinden, nicht darueber lesen.
          onClick={() => navigate('/puls-verbinden')}
          aria-label="Gerät verbinden"
        >
          <Icon name="bluetooth" size={20} className="icon-sm" />
        </button>
      </div>

      {/* Confirm stop overlay */}
      {confirmStop && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/40 p-4 pb-8">
          <div
            className="w-full max-w-sm"
            style={{
              borderRadius: 'var(--radius-lg)',
              background: 'var(--md-surface-container-high)',
              padding: 'var(--space-lg)',
            }}
          >
            <h2 style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-title-md)', color: 'var(--md-on-surface)' }}>
              Lauf beenden?
            </h2>
            <p style={{ margin: '0 0 var(--space-lg)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Dein Lauf wird gespeichert und die Aufzeichnung beendet.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={() => setConfirmStop(false)}
                className="md-button md-button--compact"
                style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
              >
                Weiter laufen
              </button>
              <button
                type="button"
                onClick={() => { setConfirmStop(false); finishRun() }}
                className="md-button md-button--filled md-button--compact"
                style={{ flex: 1 }}
              >
                Beenden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <footer style={{ padding: '0 var(--space-md) var(--space-md)' }}>
        <p style={{ margin: 0, textAlign: 'center', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Wenn du die App verlässt, wird der Lauf beendet und gespeichert.
          <br />
          Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.
        </p>
      </footer>
    </div>
  )
}
