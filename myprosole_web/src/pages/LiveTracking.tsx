import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useBluetooth } from '../store/bluetooth'
import { useAuth } from '../store/auth'
import { aufTelefon, aufzeichnungStand } from '../lib/aufzeichnungBruecke'
import { merkerWiederVersuchen } from '../lib/laufMerker'
import { useRun, type Stoppfehler } from '../store/run'
import { hindernisMeldung } from '../lib/dienstHindernis'
import { formatDurationDisplay } from '../lib/format'
import { hoehenmeterText } from '../lib/hoehenmeter'
import RouteMap from '../components/map/RouteMap'
import Blatt from '../components/ui/Blatt'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Was ein Mensch mitten im Lauf liest, wenn das Beenden nicht durchging.
 *
 * Bis zum 24.08.2026 stand hier `showSnackbar(error)` - der Rohtext der
 * Ablage, einmal nachweislich als englische PostgREST-Meldung auf dem
 * Bildschirm eines Laufenden. Danach stand hier ein einziger Satz fuer alle
 * Faelle, weil die Ablage nur Text zurueckgab und "am Wortlaut erkennen"
 * genau das ist, wogegen lib/supabaseFehler.ts geschrieben ist.
 *
 * Seit `stopRun` seine `art` mitgibt, sind es drei Saetze. Der Unterschied
 * ist keine Feinheit: "zu lange gedauert" schickt jemanden an einen Ort mit
 * besserem Empfang, "nicht mehr angemeldet" nicht - und wer den Grund nicht
 * erfaehrt, tippt beim zweiten Mal auf denselben Knopf und wundert sich.
 *
 * Drei Regeln haelt diese Tabelle ein:
 *
 * 1. **Derselbe Nachsatz, wortgleich.** "Dein Lauf laeuft weiter." ist die
 *    eine Zusage, auf die es mitten im Lauf ankommt. Sie gilt nur noch mit
 *    einer Bedingung, und die steht seit dem 24.08.2026 im Code:
 *    `abbruchUndWeiterAufzeichnen` (store/run.ts) kennt einen dritten
 *    Ausgang, `zurueckZu: 'abgebrochen'`, und dort laeuft der Lauf gerade
 *    NICHT weiter - der Dienst bleibt gestoppt. Die Tabelle hier gilt
 *    deshalb nur fuer den wiederholbaren Abbruch; wer dauerhaft
 *    gescheitert ist, liest `abbruchGrundText` weiter unten. Geprueft wird
 *    das nicht an der `art`, sondern am Zustand NACH dem Versuch - siehe
 *    `finishRun`.
 * 2. **Kein Wort ueber den naechsten Schritt.** Der steht auf dem
 *    Bildschirm: Die drei Knoepfe kommen zurueck (`finally` in `finishRun`),
 *    der Stopp-Knopf steht wieder da.
 * 3. **Hoechstens zehn Woerter.** Nicht gegriffen: Die 4000 ms der
 *    Kurzeinblendung sind in components/ui/Snackbar.tsx genau an zehn
 *    Woertern gemessen worden (rund drei Sekunden ruhiges Ablesen plus
 *    180 ms Einblendung). Nachgezaehlt am 24.08.2026 im Nachbau, nicht von
 *    Hand: 10 / 9 / 8 Woerter. Der laengste sitzt damit auf der Grenze, und
 *    das ist der Grund, warum kein "versuch es noch einmal" mehr hineinpasst
 *    - siehe Regel 2 darueber.
 *
 * Der technische Grund steht in keinem dieser Saetze. Er geht nach
 * `console.warn`, wo man ihn beim Nachsehen findet - dasselbe Muster wie in
 * lib/dateiAblegen.ts, und dieselbe Regel wie in lib/melden.ts: "Nie eine
 * Datenbankmeldung. Die verraet Tabellennamen und hilft niemandem."
 *
 * `Record<Stoppfehler, string>` und nicht `string | undefined`: Kommt in der
 * Ablage eine vierte Art dazu, faellt hier der Typcheck um. Ein `?? 'etwas
 * ist schiefgelaufen'` wuerde stattdessen stillschweigend das Falsche sagen.
 */
const ABSCHLUSS_GESCHEITERT: Record<Stoppfehler, string> = {
  zeitgrenze: 'Das Speichern hat zu lange gedauert. Dein Lauf läuft weiter.',
  'nicht-angemeldet': 'Du bist nicht mehr angemeldet. Dein Lauf läuft weiter.',
  ablage: 'Beenden hat nicht geklappt. Dein Lauf läuft weiter.',
}

/**
 * Was ein Mensch liest, wenn das Speichern DAUERHAFT gescheitert ist.
 *
 * Der Zustand ist `phase === 'abgebrochen'` (store/run.ts): Der Lauf ist
 * beendet, das Speichern hat nicht geklappt, und lib/stoppfehler.ts hat
 * entschieden, dass ein weiterer Versuch von allein nichts bringt - eine
 * Rechteverletzung (42xxx) oder ein Constraint (23xxx) wird beim
 * Wiederholen nicht besser, eine fehlende Anmeldung auch nicht.
 *
 * Drei Dinge muessen in diesem Satz stehen, und alle drei sind pruefbar:
 *
 * 1. **Der Lauf ist nicht gespeichert.** Steht als eigene Zeile darueber
 *    (`__folge`) und ist deshalb hier nicht wiederholt.
 * 2. **Die Daten sind nicht weg.** Das stimmt: `abbruchUndWeiterAufzeichnen`
 *    setzt bei 'abgebrochen' nur die Marke und laesst alles liegen - die
 *    Punkte im Zustand, im Geraetepuffer (lib/punktePuffer.ts) und, soweit
 *    waehrend des Laufs uebertragen, in `run_points`. Verworfen wird nur
 *    auf Wunsch (Entscheidung des Nutzers, 24.08.2026), und genau das sagt
 *    der Halbsatz "verloren geht sie nur, wenn du sie verwirfst".
 * 3. **Von allein bringt ein weiterer Versuch nichts.** Auch das ist die
 *    Aussage von lib/stoppfehler.ts und nicht mehr. Es heisst NICHT, dass
 *    ein Versuch verboten waere: Die Einordnung ist eine Regel ueber
 *    Fehlerklassen, kein Blick in die Zukunft. Deshalb steht der Knopf da,
 *    und deshalb sagt der Satz "von selbst" statt "es geht nicht mehr".
 *
 * Der Fall `nicht-angemeldet` ist der einzige, der von aussen aufloesbar
 * ist - und er bekommt deshalb zwei Fassungen. Wer abgemeldet ist, liest,
 * dass die Anmeldung fehlt (und findet daneben den Knopf dorthin); wer sich
 * inzwischen angemeldet hat, liest, dass ein neuer Versuch jetzt Aussicht
 * hat. Ohne diese Unterscheidung stuende auf dem Bildschirm nach der
 * Anmeldung immer noch "du bist nicht angemeldet" - die Sackgasse, die
 * dieser Bildschirm gerade aufloesen soll.
 *
 * `art` darf null sein: Die Bergung beim App-Start (components/run/
 * Startbergung.tsx) kann denselben Zustand herstellen, ohne dass jemand
 * hier getippt hat. Dann ist der Grund nicht bekannt, und der allgemeine
 * Satz ist der richtige - er behauptet nichts, was er nicht weiss.
 */
function abbruchGrundText(art: Stoppfehler | null, angemeldet: boolean): string {
  if (art === 'nicht-angemeldet') {
    return angemeldet
      ? 'Beim Speichern warst du nicht angemeldet – jetzt bist du es wieder. Ein neuer Versuch kann jetzt klappen; deine Strecke liegt weiter auf dem Gerät.'
      : 'Du bist nicht mehr angemeldet, und ohne Anmeldung kommt der Lauf nicht in dein Konto. Deine Strecke liegt weiter auf dem Gerät – verloren geht sie nur, wenn du sie verwirfst.'
  }
  return 'Deine Strecke liegt weiter auf dem Gerät – verloren geht sie nur, wenn du sie verwirfst. Von selbst versucht die App es nicht noch einmal: Derselbe Fehler käme wieder.'
}

export default function LiveTracking() {
  const navigate = useNavigate()
  // Nur fuer den Weg zur Anmeldung und zurueck - siehe den Knopf "Anmelden".
  const hier = useLocation()
  const {
    phase,
    liveStats,
    points,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    discardRun,
    addPoint,
    tick,
    punkteEinsammeln,
    lastAccuracyM,
    ortungsverlauf,
    dienstHindernis,
  } = useRun()
  const herzfrequenz = useBluetooth((s) => s.herzfrequenz)
  // Nur fuer den dauerhaft gescheiterten Fall: Ob jemand angemeldet ist,
  // entscheidet, ob "Anmelden" oder "Nochmal versuchen" der Hauptknopf ist.
  // Aus der Ablage gelesen und nicht aus dem Fehler geschlossen - zwischen
  // dem gescheiterten Versuch und diesem Rendern kann eine Anmeldung liegen.
  const angemeldet = useAuth((z) => z.user !== null)

  // Die Hoehenangabe - oder null, solange sie nicht belastbar ist, und das
  // ist sie derzeit nie. Der Befund steht in lib/hoehenmeter.ts. Gerechnet
  // und gespeichert wird sie weiterhin, gezeigt nicht.
  const hoehenmeter = hoehenmeterText(liveStats.elevationGainM)

  const showSnackbar = useSnackbar()
  const watchIdRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abholRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [confirmStop, setConfirmStop] = useState(false)
  // Die Rueckfrage vor dem Verwerfen. Sie ist keine Foermlichkeit: Der
  // Schritt ist unumkehrbar und der Lauf kann Stunden Arbeit sein - dieselbe
  // Begruendung, aus der schon der Stopp-Knopf fragt.
  const [verwerfenFragen, setVerwerfenFragen] = useState(false)
  // Woran der DAUERHAFT gescheiterte Versuch lag, oder null.
  //
  // Gehoert hierher und nicht in die Ablage, solange der Zustand einen
  // Neustart nicht ueberlebt: `phase` steht nach einem App-Tod wieder auf
  // 'idle'. Kaeme der Grund einmal aus dem Merker zurueck, gehoerte er in
  // die Ablage - dann waere dieser State der zweite Ort fuer dieselbe
  // Wahrheit.
  const [abbruchGrund, setAbbruchGrund] = useState<Stoppfehler | null>(null)

  // Ein Abschluss laeuft.
  //
  // Das ist NICHT dasselbe wie `phase === 'saving'`. Die Ablage setzt
  // 'saving' erst nach `aufzeichnungStoppen()` und `punkteEinsammeln()`
  // (store/run.ts, stopRun) - auf dem Telefon zwei Bruecken-Aufrufe, die
  // spuerbar dauern koennen. In genau diesem Fenster stand bis zum
  // 23.08.2026 weiter "Lauf laeuft" auf dem Bildschirm und beide Knoepfe
  // waren offen. Ein Merker, der an 'saving' haengt, deckt dieses Fenster
  // nicht ab; dieser hier faellt beim Knopfdruck.
  const [abschlussLaeuft, setAbschlussLaeuft] = useState(false)
  // Der Waechter gegen den zweiten Tipper braucht einen Ref, keinen State:
  // Zwei Tipper im selben Takt saehen beide noch den alten State-Wert.
  const abschlussRef = useRef(false)
  // Nach dieser Zeit sagt die Anzeige, dass es laenger dauert als sonst.
  // Kein Fortschrittsbalken gegen die Zeitgrenze aus store/run.ts: Der
  // Normalfall ist unter einer Sekunde fertig, ein Balken, der auf 20 s
  // zulaeuft, verspraeche eine Wartezeit, die es meistens nicht gibt.
  const [dauertLaenger, setDauertLaenger] = useState(false)
  const speichernRef = useRef<HTMLDivElement | null>(null)
  const abbruchAnzeigeRef = useRef<HTMLDivElement | null>(null)

  // Waehrend gespeichert wird, steht die Uhr (der Takt ist gestoppt) und die
  // Knoepfe verschwinden. Ohne sichtbare Arbeitsanzeige ist das von einer
  // haengenden App nicht zu unterscheiden.
  const speichert = abschlussLaeuft || phase === 'saving'

  // Wird gerade aufgezeichnet? Genau diese eine Kante schaltet Ortung, Uhr
  // und Abholtakt - in beide Richtungen. Siehe den Effekt darunter.
  const aufzeichnen = phase === 'tracking' && !speichert

  // Dauerhaft gescheitert: Der Lauf ist beendet, nichts wird mehr gemessen,
  // und ohne eine Entscheidung geht es nicht weiter.
  //
  // Dieser Merker steht neben `speichert` und nicht darin. Beide schalten
  // die drei runden Knoepfe ab, aber sie sagen Gegensaetzliches: `speichert`
  // heisst "warte kurz", dieser hier heisst "es wartet nichts mehr". Bis zum
  // 24.08.2026 hatte er keinen Namen, und der Bildschirm fiel damit in den
  // Standardzweig: Kopfzeile "Lauf laeuft", Uhr steht, drei bedienbare
  // Knoepfe - und der Stopp-Knopf scheiterte still immer wieder gleich.
  const abgebrochen = phase === 'abgebrochen'

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

  // Ortung, Uhr und Abholtakt gehoeren in EINEN Effekt - aufgebaut wie
  // abgeraeumt, an derselben Kante.
  //
  // Bis zum 24.08.2026 raeumte `finishRun` Ortung und Uhr selbst ab, bevor
  // `stopRun()` lief. Zurueck kamen sie nur hier, und dieser Effekt hing
  // allein an `phase`. Bricht das Speichern ab, stellt die Ablage `phase`
  // aber auf genau den Wert zurueck, aus dem gestoppt wurde
  // (`abbruchUndWeiterAufzeichnen`, store/run.ts) - meist 'tracking', also
  // auf sich selbst. Fuer diesen Effekt hatte sich damit nichts geaendert,
  // er lief nicht erneut, und `timerRef` blieb `null`.
  //
  // Die Folge trug den ganzen Rest des Laufs: Die Uhr stand sichtbar still,
  // und weil `tick` (store/run.ts) die einzige Stelle ist, die
  // `punkteUebertragen` anstoesst, ging ab da nichts mehr in die Datenbank - die
  // Punkte sammelten sich nur noch im Geraetepuffer.
  //
  // Jetzt haengen Abbau und Aufbau an `aufzeichnen`. Wer die Uhr anhaelt,
  // wirft sie damit auch wieder an: Ein Zustand "es wird aufgezeichnet, aber
  // die Uhr steht" laesst sich nicht mehr herstellen, unabhaengig davon, ob
  // `phase` sich zwischendurch geaendert hat.
  useEffect(() => {
    // Auf dem Telefon liefert der Dienst, im Browser navigator.geolocation.
    // Nie beide: Sie fragen denselben Empfaenger, und wenn beide zaehlen,
    // steht am Ende die doppelte Strecke.
    if (aufzeichnen && !aufTelefon() && watchIdRef.current == null) {
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

    if (aufzeichnen && !timerRef.current) {
      timerRef.current = setInterval(() => tick(), 1000)
    }

    // Auf dem Telefon im Takt beim Dienst abholen. Zwei Sekunden reichen:
    // Die Anzeige soll mitlaufen, aber jede Abfrage kostet einen Sprung
    // ueber die Bruecke.
    //
    // Waehrend die Seite schlaeft, laeuft dieser Takt nicht - das ist kein
    // Verlust, denn der Dienst sammelt weiter. Beim Zurueckkommen wird
    // nachgeholt, und beim Beenden noch einmal.
    if (aufzeichnen && aufTelefon() && !abholRef.current) {
      abholRef.current = setInterval(() => { punkteEinsammeln() }, 1000)
    }

    // Pausiert oder mitten im Abschluss: alles drei anhalten. Frueher stand
    // hier nur der Pausenfall, den Abschluss raeumte `finishRun` von Hand -
    // das war die Haelfte, die nie zurueckkam.
    //
    // Beim Abschluss faellt damit auch der Abholtakt weg, und das ist kein
    // Verlust: `stopRun` sammelt selbst ein, gleich nachdem es den Dienst
    // gestoppt hat. Vorher liefen beide nebeneinander um dieselben Punkte.
    if (!aufzeichnen) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (abholRef.current) {
        clearInterval(abholRef.current)
        abholRef.current = null
      }
    }
  }, [aufzeichnen, addPoint, tick, punkteEinsammeln])

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
      if (current === 'tracking' || current === 'paused') void finishRun()
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

  // Acht Sekunden ohne Antwort sind kein normales Speichern mehr. Dann
  // wechselt der Satz - nicht, weil etwas kaputt ist, sondern damit
  // niemand raten muss, ob die App noch arbeitet.
  useEffect(() => {
    if (!speichert) {
      setDauertLaenger(false)
      return
    }
    const uhr = setTimeout(() => setDauertLaenger(true), 8000)
    return () => clearTimeout(uhr)
  }, [speichert])

  // Der Fokus, der beim Wechsel heimatlos wird.
  //
  // Die drei Knoepfe verschwinden aus dem DOM. Lag der Fokus auf dem
  // Stopp-Knopf - Tastatur, Schalterzugriff -, faellt er auf <body>: Der
  // naechste Tastendruck fuehrt dann irgendwohin an den Seitenanfang, nicht
  // dorthin, wo eben etwas passiert ist.
  //
  // Uebernommen wird er nur, wenn er wirklich heimatlos ist. Ist er es
  // nicht - jemand hat den Zurueck-Pfeil oder die Karte angetippt -, waere
  // ein Sprung hierher eine Entfuehrung. Genau dieser Unterschied steht in
  // `document.activeElement`: Der entfernte Knopf hinterlaesst <body>.
  //
  // Gilt fuer beide Wechsel: waehrend des Speicherns und beim dauerhaften
  // Abbruch. Im zweiten Fall wiegt es schwerer - dort steht nicht nur eine
  // Anzeige, sondern eine Entscheidung, und der Weg dorthin mit der Tastatur
  // begaenne sonst wieder am Seitenanfang.
  useEffect(() => {
    if (!speichert && !abgebrochen) return
    const jetzt = document.activeElement
    if (jetzt && jetzt !== document.body) return
    const ziel = speichernRef.current ?? abbruchAnzeigeRef.current
    ziel?.focus()
  }, [speichert, abgebrochen])

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
    // `void`, nicht `await`: Der Aufrufer ist ein onClick und kann mit der
    // Zusage nichts anfangen. Ablehnen kann sie nicht mehr - finishRun faengt
    // seit dem 23.08.2026 selbst ab. Das `void` sagt, dass das geprueft ist,
    // statt es dem naechsten Leser als Versehen zu ueberlassen.
    void finishRun()
  }

  const finishRun = async () => {
    // Ein zweiter Tipper, waehrend der erste noch wartet, laeuft ins Leere.
    // Sonst stossen zwei stopRun() nebeneinander an - und der Bildschirm
    // sagte bis zum 23.08.2026 nichts, was davon abgehalten haette.
    if (abschlussRef.current) return
    abschlussRef.current = true
    setAbschlussLaeuft(true)

    // Auf den navigierenden Wegen wird der Merker NICHT zurueckgesetzt: Die
    // Komponente wird dort ohnehin abgebaut, und ein letztes Rendern mit
    // drei Knoepfen waere ein Aufblitzen kurz vor dem Verschwinden.
    let navigiert = false
    try {
      // Hier stand bis zum 24.08.2026 das Abraeumen von Ortung und Uhr. Es
      // steht jetzt im Effekt oben, an derselben Kante wie das Anwerfen -
      // `setAbschlussLaeuft(true)` genuegt, um beides anzuhalten. Der Grund
      // steht dort ausfuehrlich.
      const { runId, error, art } = await stopRun()

      // `art` entscheidet, nicht `error`.
      //
      // Beide waeren heute gleichwertig - aber nur eines von beiden ist der
      // Vertrag. `art` sagt, WORAN es lag; `error` ist der technische
      // Nebentext und traegt ausdruecklich keine Bedeutung fuer die Anzeige.
      // Wer auf `error` prueft, prueft die Nutzlast statt der Auskunft, und
      // ein spaeterer Rueckgabeweg mit `art` ohne `error` faellt lautlos in
      // den Erfolgszweig.
      if (art) {
        console.warn(`Lauf beenden fehlgeschlagen (${art}): ${error}`)

        // Der ZUSTAND entscheidet, was hier zu sagen ist - nicht die `art`.
        //
        // Dieselbe 'ablage' fuehrt beim ersten Mal zurueck in die
        // Aufzeichnung und beim dritten in 'abgebrochen'
        // (lib/stoppfehler.ts). Wer nur die `art` liest, sagt in beiden
        // Faellen "Dein Lauf laeuft weiter" - im zweiten waere das eine
        // Luege, denn der Dienst bleibt dort gestoppt.
        //
        // Frisch aus der Ablage gelesen: Das `phase` der Huelle stammt vom
        // Rendern VOR dem await und kennt den neuen Wert noch nicht.
        if (useRun.getState().phase === 'abgebrochen') {
          // Keine Kurzeinblendung. Sie steht vier Sekunden und ist dann weg;
          // dieser Zustand verlangt eine Entscheidung und bleibt, bis sie
          // getroffen ist. Eine Meldung, die verschwindet, waehrend der
          // Zustand bleibt, ist eine Luege ueber den Zustand - derselbe
          // Grund wie bei .md-row-hinweis in styles/components.css.
          setAbbruchGrund(art)
          return
        }

        // Der Lauf laeuft weiter: Die Ablage stellt bei einem wiederholbaren
        // Abbruch `phase` auf den Wert vor dem Stopp zurueck und wirft auf
        // dem Telefon den Dienst wieder an (`abbruchUndWeiterAufzeichnen`,
        // store/run.ts). Der eigene Merker faellt unten im `finally` - damit
        // kommen Knoepfe, Ortung und Uhr zurueck, und ein zweiter Versuch
        // ist moeglich.
        //
        // Zuruecksetzen, nicht stehenlassen: Nach einem Versuch aus dem
        // Abbruch heraus, der diesmal nur wiederholbar scheiterte, ist der
        // alte Grund ueberholt.
        setAbbruchGrund(null)
        showSnackbar(ABSCHLUSS_GESCHEITERT[art])
        return
      }

      // Zu kurz: Es wurde nichts gespeichert, und das sagt die App auch, statt
      // einen Lauf ueber 0,0 km in den Verlauf zu stellen.
      //
      // Dieser Zweig steht bewusst NACH dem auf `art` und haengt an `runId`
      // allein. `art: null` mit `runId: null` ist kein Fehler, sondern ein
      // Urteil: `discardRun` hat den Lauf verworfen, weil er zu kurz war. Die
      // beiden Faelle waren hier immer getrennt und bleiben es - eine
      // gemeinsame Behandlung hiesse, jemandem "Beenden hat nicht geklappt"
      // zu sagen, waehrend in Wahrheit alles nach Plan lief.
      if (!runId) {
        navigiert = true
        showSnackbar('Zu kurz zum Aufzeichnen – es wurde nichts gespeichert.')
        navigate('/', { replace: true })
        return
      }

      // Wie im Mockup: direkt nach dem Lauf zuerst der Tagebuch-Prompt
      // (mit "Später eintragen"), von dort geht es zur Zusammenfassung.
      // Die Kennung des eben beendeten Laufs mitgeben, damit der
      // Tagebucheintrag daran haengt und nicht nur am Datum.
      navigiert = true
      navigate(`/training/tagebuch?from=tracking&lauf=${runId}`, { replace: true })
    } catch (grund) {
      // Der Boden - und er traegt heute nichts mehr.
      //
      // Hier stand bis zum 24.08.2026 eine Begruendung mit drei
      // Zeilennummern aus store/run.ts und der Behauptung, diese drei
      // Aufrufe staenden "ausserhalb jedes try". Beides ist ueberholt.
      // Nachgesehen am 24.08.2026: `aufzeichnungStoppen()`,
      // `punkteEinsammeln()` und `computeSplits(points)` stehen alle
      // INNERHALB des grossen `try` im Rumpf von `stopRun`, das in
      // derselben Aenderung dazukam.
      //
      // Und keine Zeilennummer mehr, auch keine richtige: Genau daran ist
      // der alte Kommentar gestorben. Er stimmte am Tag, an dem er
      // geschrieben wurde, und log am naechsten. Was hier steht, haengt an
      // Namen - die halten laenger als Zeilen.
      //
      // Nachgesehen wurde auch die Ebene darunter, und dort ist es noch
      // deutlicher: `aufzeichnungStoppen`, `punkteAbholen`, `punkteBestaetigen`
      // und `aufzeichnungStarten` fangen in lib/aufzeichnungBruecke.ts jede
      // Ausnahme selbst ab und geben stattdessen einen Wert zurueck. Damit
      // kann auch `abbruchUndWeiterAufzeichnen` nicht werfen - der einzige
      // Aufruf, der aus dem `catch` von `stopRun` heraus noch laufen wuerde.
      //
      // Erreichbar ist dieser Zweig deshalb praktisch nicht mehr. Er bleibt
      // trotzdem stehen, und zwar als Sperre gegen die Wiederkehr: Faellt in
      // der Ablage oder in der Bruecke einmal ein `catch` weg, ist der
      // Unterschied zwischen "Fehler als Wert" und "Ausnahme" fuer diesen
      // Bildschirm der zwischen "Knoepfe kommen zurueck" und "kein Stopp,
      // keine Pause, kein zweiter Versuch". Ein toter Zweig kostet nichts;
      // sein Fehlen kostete einen Lauf.
      //
      // `ablage` und nicht etwa eine vierte Art: Eine Ausnahme, die an der
      // Zusage von `stopRun` vorbeikommt, ist per Definition keine, die die
      // Ablage benannt hat. Fuer den Menschen ist es derselbe Fall wie ein
      // Schreibfehler - der Lauf ist noch da, der Knopf geht wieder.
      console.warn(`Lauf beenden warf: ${grund instanceof Error ? grund.message : String(grund)}`)
      showSnackbar(ABSCHLUSS_GESCHEITERT.ablage)
    } finally {
      if (!navigiert) {
        abschlussRef.current = false
        setAbschlussLaeuft(false)
      }
    }
  }

  // Noch einmal speichern, nachdem es dauerhaft gescheitert war.
  //
  // Das ist ausdruecklich eine Handlung des Menschen. Die App selbst
  // wiederholt hier nichts mehr - genau dagegen ist der Zustand
  // 'abgebrochen' gebaut, und die Marke im Merker traegt das ueber einen
  // Neustart. Wer tippt, nimmt beides zurueck: erst die Marke, dann derselbe
  // Weg wie beim gewoehnlichen Beenden.
  //
  // Die Marke faellt VOR dem Versuch. Scheitert er wieder dauerhaft, setzt
  // die Ablage sie neu (`merkerDauerhaftGescheitert` in store/run.ts);
  // gelingt er, ist der ganze Merker weg (`merkerLoeschen`). Andersherum -
  // erst versuchen, dann aufraeumen - gaebe es einen Weg, auf dem sie
  // stehenbleibt, ohne dass noch jemand danach sieht.
  const erneutVersuchen = () => {
    merkerWiederVersuchen()
    // Kein `await`: Derselbe Grund wie bei handleStop - der Aufrufer ist ein
    // onClick. Der Waechter gegen den zweiten Tipper steht in finishRun.
    void finishRun()
  }

  // Verwerfen - und dann wirklich weg.
  //
  // Mit 'replace', und das ist kein Feinschliff: Ohne es bliebe diese Seite
  // im Verlauf des Browsers stehen. Ein Tipp auf Zurueck kaeme hierher
  // zurueck, faende `phase === 'idle'` vor und wuerde ueber den Effekt oben
  // einen NEUEN Lauf starten - ausgeloest von einer Geste, die das Gegenteil
  // meint.
  const verwerfen = () => {
    setVerwerfenFragen(false)
    discardRun()
    showSnackbar('Lauf verworfen.')
    navigate('/', { replace: true })
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

  // Konnte der Aufzeichnungsdienst nicht starten, ist dieser Bildschirm die
  // einzige Stelle, an der es jemand erfaehrt – danach ist der Lauf vorbei
  // und womoeglich leer. Im Browser gibt es keinen Dienst; dann ist die
  // Meldung null und es steht nichts da.
  const dienstMeldung = hindernisMeldung(dienstHindernis)


  return (
    // h-dvh statt min-h-dvh: Die Seite ist genau so hoch wie der Bildschirm.
    // Was nicht passt, scrollt IM Inhalt (.md-lauf-inhalt) - der Knopfstreifen
    // darunter bleibt dadurch immer sichtbar. Der Grund steht ausfuehrlich in
    // styles/components.css bei .md-lauf-inhalt.
    <div className="flex flex-col h-dvh bg-background text-on-background">
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
        {/* Der Titel ist der Nebenkanal: Wer nach oben schaut, soll dort
            nicht "Lauf laeuft" lesen, waehrend unten gespeichert wird. Die
            eigentliche Ansage steht unten bei den Knoepfen, dort, wo eben
            getippt wurde. */}
        <span className="md-app-bar__title">
          {speichert
            ? 'Wird gespeichert…'
            : abgebrochen
              ? 'Nicht gespeichert'
              : phase === 'paused'
                ? 'Pausiert'
                : 'Lauf läuft'}
        </span>
        {/* Beim Speichern faellt die Anzeige weg. Zwei Gruende, beide
            zaehlen: Die Ortung ist zu diesem Zeitpunkt abgeschaltet
            (finishRun raeumt watchPosition ab), der Wert ist also von
            gestern – und der laengere Titel "Wird gespeichert…" braucht
            den Platz, sonst kuerzt die Leiste ihn auf 380 px zu
            "Wird gespeic…". */}
        {/* Beim dauerhaften Abbruch faellt sie aus demselben Grund weg wie
            beim Speichern: Es laeuft keine Ortung mehr (der Effekt oben
            haengt an `aufzeichnen`, und der ist in beiden Faellen falsch).
            Ein Empfangswert, der sich nicht mehr aendert, sieht aus wie eine
            Messung und ist keine. */}
        {!speichert && !abgebrochen && (
          <div
            className={`md-chip ${gpsError || keinSignal ? 'md-chip--disconnected' : 'md-chip--connected'}`}
            style={{ padding: '4px 10px' }}
          >
            <Icon name="location" size={20} className="icon-sm" />
            {/* Wie gut das Signal gerade ist, in Metern. Ohne diese Angabe wirkt
                Warten wie Stillstand – man sieht nicht, dass es besser wird. */}
            {lastAccuracyM != null ? `GPS ±${Math.round(lastAccuracyM)} m` : 'GPS'}
          </div>
        )}
      </header>

      <main className="md-page-stack flex-1 md-lauf-inhalt" style={{ paddingTop: 'var(--space-sm)' }}>
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
            {abgebrochen
              ? 'Gesamtzeit · beendet'
              : phase === 'paused'
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
            {/* Ohne belastbare Quelle kein Wert - siehe lib/hoehenmeter.ts.
                Die Reihe traegt drei Werte ohne Zutun: .md-live-stat teilt
                die Breite gleichmaessig auf, die Trennlinien haengen an den
                Nachbarn. */}
            {hoehenmeter && (
              <div className="md-live-stat">
                <p className="md-live-stat__value">
                  {hoehenmeter}
                </p>
                <p className="md-live-stat__label">Hm</p>
              </div>
            )}
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

        {/* Der Dienst konnte nicht starten. Hier und nicht weiter oben: Die
            grossen Zahlen behalten ihren Platz, die Meldung steht trotzdem
            im ersten Bildschirm. Sie bleibt den ganzen Lauf stehen – wer sie
            verpasst, verliert den Lauf.

            role="alert" statt Farbe allein: Vorlesesoftware sagt die Meldung
            an, sobald sie erscheint. */}
        {dienstMeldung && (
          <div className="md-dienst-warnung" role="alert">
            <Icon name="warn" size={20} className="icon-sm md-dienst-warnung__icon" />
            <div className="md-dienst-warnung__text">
              {/* Die Folge zuerst und am groessten: was fuer DIESEN Lauf gilt. */}
              <p className="md-dienst-warnung__folge">{dienstMeldung.folge}</p>
              <p className="md-dienst-warnung__grund">Grund: {dienstMeldung.titel}</p>
              {dienstMeldung.abhilfe && (
                <p className="md-dienst-warnung__abhilfe">{dienstMeldung.abhilfe}</p>
              )}
            </div>
          </div>
        )}

        {/* Route map */}
        <RouteMap
          points={points}
          height={140}
          live
          label="Live-Route auf der Karte"
          leerText={
            // Nach dem Abbruch wartet nichts mehr - weder auf ein Signal
            // noch auf Bewegung. Ein "Warte auf GPS-Signal…" unter einem
            // beendeten Lauf verspricht, dass gleich etwas kommt.
            abgebrochen
              ? 'Keine Strecke aufgezeichnet'
              : keinSignal
                ? 'Kein GPS-Signal'
                : keineBewegung
                  ? 'Noch keine Bewegung erkannt'
                  : 'Warte auf GPS-Signal…'
          }
        />

        {/* Kein Empfang: erklaeren statt schweigen. Die Aufzeichnung laeuft
            weiter, sobald das erste Signal da ist – deshalb kein Abbruch,
            sondern ein Hinweis. */}
        {/* `!abgebrochen` an allen drei Kaesten: Es sind Ratschlaege fuer
            einen laufenden Lauf. "Geh nach draussen" hilft niemandem, dessen
            Lauf vorbei ist und dessen Aufzeichnung nicht mehr laeuft. */}
        {!gpsError && keinSignal && !abgebrochen && (
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
        {!gpsError && keineBewegung && !abgebrochen && (
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
        {gpsError && !abgebrochen && (
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

        {/* Coach banner - nur, solange es stimmt.

            "Route, Zeit und Tempo werden aufgezeichnet" ist nach dem
            dauerhaften Abbruch schlicht falsch: Der Dienst ist gestoppt, die
            Uhr steht, und es kommt nichts mehr dazu. */}
        {!abgebrochen && (
        <div className="md-coach-banner">
          <div className="md-coach-banner__icon">
            <Icon name="mic" size={20} className="icon-sm" />
          </div>
          <p className="md-coach-banner__text">
            App-Modus aktiv: Route, Zeit und Tempo werden aufgezeichnet.
            Einlagen kannst du jederzeit ergänzen.
          </p>
        </div>
        )}
      </main>

      {/* Bottom controls */}
      <div className="md-run-controls">
        {speichert ? (
          /* Waehrend des Speicherns stehen hier keine abgeblendeten Knoepfe,
             sondern eine Arbeitsanzeige.
             Drei tote Knoepfe an derselben Stelle sind von einer haengenden
             App nicht zu unterscheiden - erst recht, weil gleichzeitig die
             Uhr stehenbleibt (der Takt faellt mit `aufzeichnen`). Was
             gebraucht wird, ist Bewegung an der Stelle, an der eben getippt
             wurde, nicht ein Wort in der Kopfzeile.
             Der Balken ist unbestimmt: Die Dauer ist nicht bekannt, also
             darf nichts einen Fortschritt vortaeuschen. */
          /* tabIndex={-1}: nicht mit Tab erreichbar, aber ein Ziel fuer den
             Fokus, der beim Wechsel heimatlos wird. Siehe speichernRef. */
          <div className="md-run-speichern" ref={speichernRef} tabIndex={-1}>
            <div className="md-progress md-progress--unbestimmt" aria-hidden="true">
              <div className="md-progress__fill" />
            </div>
            {/* Kurz genug fuer eine Zeile auf 360 px. Ein Satz, der auf drei
                Zeilen umbricht, schoebe den Balken hoch - die Anzeige waere
                dann selbst die Unruhe, die sie beheben soll. Und kein
                Versprechen ueber die Rettung: Was bei Abbruch passiert,
                sagt danach die Fehlermeldung, nicht diese Zeile. */}
            {/* role="status" sitzt am Satz, nicht am Kasten darum: Nur der
                Satz aendert sich (auf "Das dauert laenger als sonst"). Am
                Kasten haette aria-atomic den unbestimmten Balken bei jeder
                Aenderung mit angesagt. */}
            <p className="md-run-speichern__text" role="status" aria-atomic="true">
              {dauertLaenger ? 'Das dauert länger als sonst.' : 'Lauf wird gespeichert'}
            </p>
          </div>
        ) : abgebrochen ? (
          /* Meldung UND Entscheidung an der Stelle der drei Knoepfe.

             Warum beides hier unten steht und nicht oben im Inhalt: Getippt
             wurde hier, und hier steht die Antwort - dieselbe Regel wie bei
             der Arbeitsanzeige darueber. Und weil einer der beiden Knoepfe
             loescht, darf zwischen ihm und seinem Satz nichts liegen, was
             sich wegscrollen laesst.

             role="alert" statt Farbe allein: Vorlesesoftware sagt die
             Meldung an, sobald sie erscheint - wie bei .md-dienst-warnung.

             tabIndex={-1}: nicht mit Tab erreichbar, aber ein Ziel fuer den
             Fokus, der beim Wechsel heimatlos wird. Siehe abbruchAnzeigeRef. */
          <div className="md-lauf-abbruch" ref={abbruchAnzeigeRef} tabIndex={-1}>
            <div className="md-lauf-abbruch__meldung" role="alert">
              <Icon name="warn" size={20} className="icon-sm md-lauf-abbruch__icon" />
              <div className="md-lauf-abbruch__text">
                <p className="md-lauf-abbruch__folge">Der Lauf ist nicht gespeichert.</p>
                <p className="md-lauf-abbruch__grund">
                  {abbruchGrundText(abbruchGrund, angemeldet)}
                </p>
              </div>
            </div>
            <div className="md-lauf-abbruch__aktionen">
              {/* Der einzige dauerhafte Fehler, den eine fremde Handlung
                  aufloest - und dann fuehrt der Hauptknopf dorthin statt in
                  einen Versuch, der mit Sicherheit genauso scheitert
                  (lib/stoppfehler.ts: "Ohne Anmeldung scheitert der zweite
                  Versuch mit Sicherheit genauso").

                  `state.from` ist der Rueckweg, und er ist nachgesehen,
                  nicht geraten: Login.tsx liest genau dieses Feld
                  (`location.state.from.pathname`) und springt nach der
                  Anmeldung dorthin zurueck - sonst landet man auf der
                  Startseite und muss den Lauf ueber "Laufen starten"
                  wiederfinden. Der Zustand ueberlebt den Weg: Die Ablage
                  liegt im Arbeitsspeicher des Fensters, nicht in dieser
                  Komponente. Zurueck ist der Knopf dann "Nochmal
                  versuchen" - `angemeldet` steht danach auf true. */}
              {abbruchGrund === 'nicht-angemeldet' && !angemeldet ? (
                <button
                  type="button"
                  className="md-button md-button--filled"
                  onClick={() => navigate('/login', { state: { from: hier } })}
                >
                  Anmelden
                </button>
              ) : (
                <button
                  type="button"
                  className="md-button md-button--filled"
                  onClick={erneutVersuchen}
                >
                  Nochmal versuchen
                </button>
              )}
              {/* Umrandet, nicht in Fehlerfarbe: Der Kasten darueber ist
                  schon rot, und zwei Rot mit verschiedener Bedeutung -
                  "das ist der Zustand" und "das hier loescht" - lesen sich
                  als eines. Die Warnung traegt die Rueckfrage dahinter. */}
              <button
                type="button"
                className="md-button md-button--outlined"
                onClick={() => setVerwerfenFragen(true)}
              >
                Lauf verwerfen
              </button>
            </div>
          </div>
        ) : (
          <>
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
              className="md-run-controls__btn md-run-controls__btn--primary"
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
          </>
        )}
      </div>

      {/* Die beiden Rueckfragen dieses Bildschirms.

          Als <Blatt> und nicht mehr als eigener Ueberzug: Bis zum 24.08.2026
          stand hier ein von Hand gebauter Kasten mit sechs inline-Stilen,
          ohne Escape, ohne Fokusfalle und ohne den Schleier, den der Rest
          der App benutzt. Zwei Rueckfragen auf EINEM Bildschirm, von denen
          eine loescht, duerfen nicht verschieden aussehen - und das gebaute
          Blatt ist das bessere von beiden: <dialog> bringt Escape, den
          unbedienbaren Hintergrund und den gehaltenen Tastaturfokus mit.

          Schliessen heisst bei beiden "nichts tun": weiterlaufen, behalten.
          Das ist die sichere Richtung, und Escape wie ein Tipp daneben
          landen genau dort. */}
      <Blatt
        offen={confirmStop}
        onSchliessen={() => setConfirmStop(false)}
        titel="Lauf beenden?"
      >
        <p className="md-blatt__satz">
          Dein Lauf wird gespeichert und die Aufzeichnung beendet.
        </p>
        <div className="md-aktions-zeile">
          <button
            type="button"
            className="md-button md-button--outlined"
            onClick={() => setConfirmStop(false)}
          >
            Weiter laufen
          </button>
          <button
            type="button"
            className="md-button md-button--filled"
            onClick={() => { setConfirmStop(false); void finishRun() }}
          >
            Beenden
          </button>
        </div>
      </Blatt>

      <Blatt
        offen={verwerfenFragen}
        onSchliessen={() => setVerwerfenFragen(false)}
        titel="Lauf verwerfen?"
      >
        {/* Was hier steht, ist die gepruefte Wirkung von `discardRun`
            (store/run.ts) und nicht mehr: Der Dienst wird beendet, sein
            Puffer geleert (`punkteVerwerfen`), der Merker geloescht und der
            Zustand geleert. Deshalb "kommt nicht in deinen Verlauf" und
            nicht "wird geloescht" - was waehrend des Laufs schon in
            `run_points` gelandet ist, raeumt diese Handlung nicht weg. */}
        <p className="md-blatt__satz">
          Dieser Lauf kommt dann nicht in deinen Verlauf, und die
          Aufzeichnung auf dem Gerät wird weggeräumt. Zurückholen lässt er
          sich danach nicht.
        </p>
        <div className="md-aktions-zeile">
          <button
            type="button"
            className="md-button md-button--outlined"
            onClick={() => setVerwerfenFragen(false)}
          >
            Behalten
          </button>
          <button
            type="button"
            className="md-button md-button--gefahr"
            onClick={verwerfen}
          >
            Verwerfen
          </button>
        </div>
      </Blatt>

      {/* Disclaimer */}
      <footer style={{ padding: '0 var(--space-md) var(--space-md)' }}>
        <p style={{ margin: 0, textAlign: 'center', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          {/* Bis zum 22.08.2026 stand hier unbedingt "Wenn du die App
              verlaesst, wird der Lauf beendet und gespeichert." Auf dem
              Telefon stimmt das seit dem Vordergrunddienst nicht mehr - die
              Zeile, die den Lauf beim Verlassen beendete, ist oben durch
              `if (aufTelefon()) return` abgeschaltet. Der Satz riet damit
              ausgerechnet von dem ab, was funktioniert: einstecken und
              loslaufen. */}
          {/* Beide Saetze reden von einer laufenden Aufzeichnung. Nach dem
              dauerhaften Abbruch laeuft keine mehr: Der Dienst ist gestoppt,
              und der Wegseh-Effekt oben fasst nur 'tracking' und 'paused'
              an. Also steht hier dann nichts - und nicht der bequemere
              zweitbeste Satz. */}
          {!abgebrochen && (
            <>
              {aufTelefon()
                ? 'Du kannst das Telefon einstecken – die Aufzeichnung läuft weiter, auch bei ausgeschaltetem Bildschirm.'
                : 'Wenn du die App verlässt, wird der Lauf beendet und gespeichert.'}
              <br />
            </>
          )}
          Trainingsempfehlung, keine medizinische Bewertung. Bei Schmerzen abbrechen.
        </p>
      </footer>
    </div>
  )
}
