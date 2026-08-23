import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRun } from '../../store/run'
import { useSnackbar } from '../ui/Snackbar'

/**
 * Was beim Start liegengeblieben ist, nachreichen – und es sagen.
 *
 * Steht als eigene Komponente da und nicht in App.tsx, weil es den
 * SnackbarProvider braucht: App.tsx rendert den Provider selbst und liegt
 * damit ueber ihm. Ein useSnackbar() dort bekaeme den leeren Vorgabewert aus
 * Snackbar.tsx – kein Fehler, keine Meldung, nur Stille.
 */

/** Die Vollbildseite der laufenden Aufzeichnung (Route in App.tsx). */
const LIVE_SEITE = '/lauf/tracking'

/**
 * "Messpunkte", nicht "Punkte": In einer Lauf-App liest sich "611 Punkte"
 * wie eine Wertung, nicht wie eine Messung.
 */
function messpunkte(anzahl: number): string {
  return anzahl === 1 ? '1 Messpunkt' : `${anzahl.toLocaleString('de-DE')} Messpunkte`
}

export default function Startbergung() {
  const navigate = useNavigate()
  const melden = useSnackbar()
  const { pathname } = useLocation()

  // Der Weg zur Bergung ist asynchron; bis die Antwort da ist, kann jemand
  // schon woanders stehen. Ueber einen Merker gelesen statt als Abhaengigkeit,
  // damit die Bergung nicht bei jedem Seitenwechsel erneut anlaeuft.
  const pfad = useRef(pathname)
  useEffect(() => { pfad.current = pathname }, [pathname])

  // Auch `navigate` und `melden` laufen ueber Merker, und zwar aus demselben
  // Grund: `useNavigate` ist unter BrowserRouter NICHT stabil - react-router
  // haengt den aktuellen Pfad in seine Abhaengigkeiten. Als Abhaengigkeit
  // eingetragen lief dieser Effekt bei JEDEM Seitenwechsel erneut, samt
  // Bruecken- und Netzaufruf. Der Merker daneben sollte genau das
  // verhindern und konnte es nicht.
  const gehe = useRef(navigate)
  gehe.current = navigate
  const sagen = useRef(melden)
  sagen.current = melden

  useEffect(() => {
    // Nachreichen, was von einem frueheren Lauf liegengeblieben ist – etwa
    // weil der Akku leer wurde oder Android die App beendet hat. Im
    // Hintergrund, ohne dass jemand darauf wartet; scheitert es, liegt es
    // weiter und geht beim naechsten Start mit.
    //
    // Ueber den Speicher statt direkt: So wird ein Fehler festgehalten und
    // ist spaeter auf der Laufseite lesbar, statt hier zu verschwinden.
    useRun.getState().punkteUebertragen().catch(() => {})

    // Und nachsehen, ob eine Aufzeichnung ohne Besitzer dasteht.
    //
    // Der Fall: Android hat die App waehrend eines Laufs abgeschossen. Der
    // Dienst sammelt weiter, aber niemand kennt mehr seine Sitzung. Bis zum
    // 22.08.2026 waren die Punkte damit fuer immer verloren - gemessen lagen
    // 611 davon im Dienstspeicher und neun Laeufe hingen auf 'tracking'.
    //
    // Hier und nicht spaeter: Es ist die einzige Stelle, die bei jedem Start
    // laeuft, egal auf welcher Seite jemand landet.
    useRun.getState().verwaisteAufzeichnungBergen()
      .then((fund) => {
        if (!fund) return

        if (fund.ergebnis === 'fortgesetzt') {
          // Springen, nicht fragen, und nicht nur einen Hinweis zeigen.
          //
          // Die letzte Messung ist keine drei Minuten alt: Der Mensch laeuft
          // gerade und hat die App aufgemacht, um seinen Lauf zu sehen. Genau
          // dorthin geht es. Ein Hinweis allein waere die schlechteste Wahl –
          // die Schnellmeldung ist nach 2,6 Sekunden weg und nimmt keine
          // Beruehrung an; wer sie verpasst, verliert die Stunde. Und einen
          // Dialog gibt es in dieser App nirgends: ihn fuer diesen einen Fall
          // zu erfinden, hiesse den Start hinter einer Rueckfrage zu sperren.
          //
          // Ohne 'replace', damit die Vorseite erhalten bleibt. Zurueck heisst
          // dann genau das, was LiveTracking selbst "minimieren" nennt: Die
          // Aufzeichnung laeuft weiter, man steht wieder auf der Startseite.
          // Der Sprung ist damit zurueckzunehmen, ohne den Lauf zu kosten.
          if (pfad.current !== LIVE_SEITE) gehe.current(LIVE_SEITE)

          // Die Meldung erklaert den Sprung. Verpasst man sie, ist nichts
          // verloren – der Bildschirm darunter sagt dasselbe noch einmal.
          sagen.current(
            fund.punkte > 0
              ? `Dein Lauf läuft weiter – ${messpunkte(fund.punkte)}.`
              : 'Dein Lauf läuft weiter.',
          )
          return
        }

        // Der Lauf ist vorbei und wurde eben gespeichert. Niemand muss etwas
        // entscheiden, also stoert auch nichts: eine Schnellmeldung reicht.
        //
        // Sie muss aber drei Fragen beantworten, denn der Lauf kann Stunden
        // her sein: Wovon ist die Rede (von einem unterbrochenen Lauf), ist
        // etwas verloren (nein, so viele Messpunkte), und wo ist er jetzt (im
        // Verlauf – so heisst der Eintrag in der unteren Leiste).
        //
        // Die Laenge ist gemessen, nicht geschaetzt: Auf einem 412-px-Geraet
        // ist .md-snackbar 206 px breit - nicht die 340 px, die die Klasse
        // ankuendigt (siehe Bericht: 'left: 50%' ohne 'right' deckelt die
        // Breite auf die Haelfte). Drei Zeilen ist damit das Hausmass, auch
        // fuer die bestehenden Meldungen. Jede Meldung hier bleibt darunter;
        // "3.412 Messpunkte, jetzt im Verlauf" waeren vier gewesen.
        //
        // Welcher der drei Ausgaenge es war, sagt die Bergung selbst - sie
        // weiss es. Frueher stand hier ein Blick in den Zustand; das war ein
        // Seitenkanal und haette bei jeder Aenderung an stopRun brechen
        // koennen, ohne dass es jemand merkt.
        if (fund.ergebnis === 'gespeichert') {
          sagen.current(
            fund.punkte > 0
              ? `Unterbrochener Lauf gesichert – ${messpunkte(fund.punkte)} im Verlauf.`
              : 'Unterbrochener Lauf gesichert – jetzt im Verlauf.',
          )
        } else if (fund.ergebnis === 'zu-kurz') {
          // Verworfen, weil zu kurz. Die Zahl bleibt hier weg: Sie waere kein
          // Beleg mehr, dass nichts verloren ging, sondern einer dafuer, dass
          // doch etwas weg ist. Wortlaut wie auf der Laufseite.
          sagen.current('Der unterbrochene Lauf war zu kurz – nichts gespeichert.')
        } else {
          sagen.current('Unterbrochener Lauf noch nicht gespeichert – der nächste Start holt es nach.')
        }
      })
      .catch(() => {})
  // Leer, und das ist der Punkt: Der Effekt gehoert genau einmal ausgefuehrt,
  // beim Start der App. Alles Veraenderliche steht in Merkern darueber.
  }, [])

  return null
}
