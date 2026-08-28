import { useEffect } from 'react'
import Icon from '../components/ui/Icon'
import { useSnackbar } from '../components/ui/Snackbar'
import { schrittrechtAnzeige } from '../lib/schrittrecht'
import { useSchrittrecht } from '../store/schrittrecht'

/**
 * „Was dein Telefon kann" - der Ort, an dem jemand aus eigenem Antrieb
 * nachsieht, und der einzige, an dem erklaert wird, bevor gefragt wird.
 *
 * Warum es diese Seite gibt und nicht nur eine Zeile im Profil
 * ------------------------------------------------------------
 * Zwei Festlegungen verlangen sie, und beide stehen ausserhalb dieser Datei:
 *
 * 1. `docs/messquellen.md`, Abschnitt 4: „Ein Bereich **Was dein Telefon
 *    kann** listet jede Messgroesse mit ihrer Quelle und ihrem Zustand - und
 *    laesst fehlende Berechtigungen direkt dort erteilen." Der Schrittzaehler
 *    ist der erste Eintrag, nicht der einzige; Hoehensensor, Uhr und Einlage
 *    kommen in dieselbe Liste.
 * 2. `lib/schrittrecht.ts`, `bietetImLaufAn`: Android zeigt den
 *    Berechtigungsdialog hoechstens zweimal je Installation. Der Lauf gibt
 *    davon hoechstens einen aus. „Der zweite gehoert dem Bildschirm ‚Was
 *    dein Telefon kann', wo jemand aus eigenem Antrieb ist und liest."
 *
 * Eine Einstellungszeile kann das nicht leisten. Sie traegt eine
 * Beschriftung und einen Wert, keine Erklaerung - und ohne Erklaerung ist
 * der zweite Versuch so viel wert wie der erste, der weggetippt wurde.
 *
 * Klicktiefe (docs/seiten-regeln.md, Punkt 9)
 * -------------------------------------------
 * Home -> Reiter „Profil" (1) -> Zeile „Was dein Telefon kann" (2). Die
 * Seite liegt bei zwei Taps, die Handlung darauf beim dritten - innerhalb
 * der drei Taps, die die Standards fuer seltene Aktionen zulassen. Der
 * Einstieg ist beschriftet und steht in der Gruppe „Geraet", neben
 * „Einlage verbinden" und „Smartwatch verbinden"; kein Menue ohne Aufschrift
 * dazwischen.
 *
 * Warum hier KEIN eigener Wortlaut ueber den Zustand steht
 * -------------------------------------------------------
 * Titel, Satz und Knopfbeschriftung kommen restlos aus
 * `schrittrechtAnzeige`. Der Satz fuer 'nicht-erlaubt' steht woertlich in
 * `docs/messquellen.md` und ist eine Projektfestlegung. Wuerde diese Seite
 * ihn nachbauen, gaebe es zwei Fassungen - und die zweite waere die, die
 * beim naechsten Umformulieren stehen bleibt. Der Laufbildschirm liest
 * dieselbe Funktion.
 */
export default function TelefonKann() {
  const showSnackbar = useSnackbar()
  const stand = useSchrittrecht((s) => s.stand)
  const fragtGerade = useSchrittrecht((s) => s.fragtGerade)
  const pruefen = useSchrittrecht((s) => s.pruefen)
  const anfordern = useSchrittrecht((s) => s.anfordern)
  const einstellungenOeffnen = useSchrittrecht((s) => s.einstellungenOeffnen)

  // Nachsehen, ohne zu fragen: `pruefen` loest nie einen Systemdialog aus
  // (store/schrittrecht.ts). Beim Betreten der Seite ist das richtig - wer
  // aus den Telefoneinstellungen zurueckkommt, saehe sonst weiter den alten
  // Stand.
  useEffect(() => {
    pruefen()
  }, [pruefen])

  const anzeige = schrittrechtAnzeige(stand)

  const erlauben = async () => {
    const vorher = useSchrittrecht.getState().stand
    await anfordern()
    const nachher = useSchrittrecht.getState().stand
    // Nur wenn sich am Bildschirm nichts aendert, braucht es ein Wort.
    // Aendert er sich, IST er die Rueckmeldung - dieselbe Begruendung wie
    // bei `beiOffenemVermerk` in Profile.tsx. Und es ist kein zweiter Satz
    // ueber den Zustand: Der steht weiter in der Karte. Dieser hier sagt
    // nur, dass der Tipp angekommen ist.
    if (vorher === nachher) showSnackbar('Die Erlaubnis wurde nicht erteilt.')
  }

  const einstellungen = async () => {
    const ging = await einstellungenOeffnen()
    // `appEinstellungenOeffnen` meldet, ob es ging (lib/aufzeichnungBruecke).
    // Im Browser geht es nie - und dann darf der Knopf nicht so tun, als
    // waere etwas passiert.
    if (!ging) showSnackbar('Die Telefoneinstellungen ließen sich nicht öffnen.')
  }

  return (
    <>
      <section className="md-connect-hero">
        <div className="md-connect-hero__icon">
          <Icon name="sensors" className="icon" />
        </div>
        {/* Derselbe Wortlaut wie in der Kopfzeile, wie auf /puls-verbinden
            („Geraet verbinden" dort wie hier). Der Bildschirm faengt damit
            an, wovon er handelt, statt mit einer Karte aus dem Nichts. */}
        <h1>Was dein Telefon kann</h1>
        <p>
          Hier steht, welche Messgrößen dein Telefon liefern kann und was
          MyProSole davon gerade lesen darf.
        </p>
      </section>

      {/* Der erste Eintrag der Liste. Weitere Messgroessen kommen als
          weitere Karten daneben - jede mit ihrem eigenen Zustand aus ihrem
          eigenen Modul, keine gemeinsame Sammelaussage. */}
      <section className="md-card" aria-labelledby="schrittzaehler-titel">
        {/* --oben, weil der Satz fuer 'nicht-erlaubt-endgueltig' vier Zeilen
            lang ist: Ohne ihn saesse das Zeichen mitten im Absatz. */}
        <div className="md-feature-heading md-feature-heading--oben">
          <div className="md-feature-heading__icon" aria-hidden="true">
            <Icon name="sensors" className="icon" />
          </div>
          {/* Beides woertlich aus lib/schrittrecht.ts. */}
          <div className="md-feature-heading__text">
            <p className="md-section-title" id="schrittzaehler-titel">
              {anzeige.titel}
            </p>
            <p>{anzeige.satz}</p>
          </div>
        </div>

        {/* Der Grund und der Knopf stehen zusammen, und beides nur dort, wo
            es etwas zu holen gibt.

            Bei 'kein-sensor' waere „was dir entgeht" eine Grausamkeit ohne
            Ausweg, bei 'erteilt' laeuft es laengst, bei 'unbekannt' wissen
            wir nichts. `anzeige.handlung` unterscheidet das bereits - sie
            ist genau in den zwei Zustaenden gesetzt, in denen ein Weg
            existiert. Deshalb haengt der ganze Block daran und nicht an
            einer eigenen Aufzaehlung von Zustaenden, die beim naechsten
            Zustand vergessen wuerde. */}
        {anzeige.handlung && (
          <>
            {/* Eine Messung, keine Aussage ueber den Koerper
                (DEVELOPMENT_STANDARDS.md, „messen, nicht bewerten"). Die
                Zahl ist nicht gegriffen: Sie steht als Befund B7 in
                lib/bewegung.ts, gemessen am 23.08.2026 ueber 15 Neustarts
                derselben Fahrt - 12,3 m je Wiederanfahrt, rund 120 m bei
                zehn Ampeln. */}
            <p className="md-sensorkarte__grund">
              Nach jedem Halt merkt das GPS erst nach einigen Metern, dass du
              wieder läufst. Der Schrittzähler merkt es sofort – bei einem
              Stadtlauf mit zehn Ampeln sind das rund 120 Meter, die sonst in
              der Strecke fehlen.
            </p>
            {/* Warum ausgerechnet HIER erklaert wird, bevor gefragt wird:
                Der Versuch ist knapp. Das gehoert an den Knopf, der ihn
                verbraucht, und nur an ihn - bei 'nicht-erlaubt-endgueltig'
                sind beide Versuche schon weg, dort waere es eine Belehrung
                ohne Nutzen. */}
            {stand === 'nicht-erlaubt' && (
              <p className="md-sensorkarte__grund">
                Android zeigt diese Frage höchstens zweimal, solange die App
                installiert ist. Danach führt der Weg nur noch über die
                Telefoneinstellungen.
              </p>
            )}
            {/* Genau ein Knopf, und welcher, entscheidet `handlung` - nicht
                diese Seite.

                --outlined statt --filled: Der gefuellte Knopf reisst auf
                einer Karte die 3:1 aus WCAG 1.4.11 (docs/seiten-regeln.md,
                offener Befund 1, dort mit 2,26:1 gemessen). Der Umriss
                traegt in allen vier Paletten 3,87 bis 5,35:1. */}
            <button
              type="button"
              className="md-button md-button--outlined md-sensorkarte__aktion"
              onClick={anzeige.handlung === 'anfordern' ? erlauben : einstellungen}
              disabled={fragtGerade}
            >
              {/* Waehrend der Systemdialog offen ist, steht die App still.
                  Ein Knopf, der dann unveraendert dasteht, laedt zum zweiten
                  Tippen ein - und der zweite Tipp kostet den zweiten von zwei
                  Versuchen. */}
              {fragtGerade ? 'Android fragt…' : anzeige.knopf}
            </button>
          </>
        )}
      </section>
    </>
  )
}
