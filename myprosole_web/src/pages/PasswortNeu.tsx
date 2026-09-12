import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import Icon from '../components/ui/Icon'
import type { AnmeldeHindernisArt } from '../lib/hindernis'

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
 *
 * Seit dem 07.09.2026 zeigt sie den ROHTEXT NICHT MEHR AN. Bis dahin stand
 * hier "Das Passwort konnte nicht gesetzt werden: " + der englische
 * Servertext - eine der drei Rohtext-Anzeigen aus
 * docs/authhindernis-entwurf.md, Abschnitt 2. Der Text ist ersatzlos weg;
 * was er sagen sollte, sagt jetzt die ART (lib/hindernis.ts).
 */

/** Der eine Satz fuer einen Fehlschlag - ohne den Servertext von frueher. */
const NICHT_GESETZT = 'Das Passwort konnte nicht gesetzt werden.'
/**
 * Bei `zu-oft` sagt er zusaetzlich, was jetzt hilft - als EIN Satz, nicht als
 * zwei Ratschlaege hintereinander (Auftrag 4a-ii, dieselbe Korrektur wie bei
 * `CODE_ZU_OFT` in CodeConfirmForm.tsx). Keine Sekundenzahl.
 */
const NICHT_GESETZT_ZU_OFT =
  'Das Passwort konnte gerade nicht gesetzt werden – warte ein paar Minuten und probier es dann noch einmal.'
/**
 * Wortlaut fuer `abgelehnt` (Auftrag 4a-ii, 07.09.2026).
 *
 * BERICHTIGT AM 08.09.2026 (B3 der Durchsicht). Bis dahin stand hier,
 * Supabase liefere `weak_password` UND `same_password` "unter demselben
 * Code" und `validation_failed` decke "beide Faelle gemeinsam ab". Das war
 * falsch, und zwar nachsehbar: `lib/hindernis.ts:216-221` fuehrt in
 * `ABGELEHNT` DREI GETRENNTE Codes nebeneinander - `validation_failed`,
 * `weak_password`, `same_password` (alle drei in `error-codes.d.ts`,
 * auth-js 2.112.3). Zusammengelegt wird nicht der Code, sondern die
 * KATEGORIE, und das mit Absicht: Trennkriterium R2-Q1 des Vertrags - zwei
 * Kategorien sind nur verschieden, wenn die naechste Handlung des Menschen
 * verschieden ist, und die ist hier dreimal dieselbe (ein anderes Passwort
 * waehlen).
 *
 * Die Schlussfolgerung bleibt genau dieselbe: Diese Seite bekommt die
 * KATEGORIE, nicht den Code - sie kann die drei Ursachen also nicht
 * unterscheiden; der Rohtext bleibt weg (lib/melden.ts). Der Satz nennt
 * darum alle drei moeglichen Gruende - zu kurz, zu einfach, dasselbe wie
 * vorher - und die eine Handlung, die in jedem Fall stimmt.
 */
const NICHT_ANGENOMMEN =
  'Dieses Passwort wurde nicht angenommen – zu kurz, zu einfach oder dasselbe wie vorher. Wähl ein anderes.'

/**
 * Was diese Seite auf eine Art hin TUT. Drei Reaktionen, und eine davon ist
 * gar keine Meldung: `link-verbraucht` schaltet die Ansicht "Link nicht mehr
 * gueltig" ein, die es hier schon gibt.
 */
type Reaktion = 'link-verbraucht' | 'abgelehnt' | 'zu-oft' | 'fehlschlag'

/**
 * Von der Art zur Reaktion - als Tabelle, nicht als `if`-Kette mit Rest
 * (B2 der Durchsicht, 08.09.2026, Muster aus Login.tsx).
 * `Record<AnmeldeHindernisArt, Reaktion>` verlangt jede Art einzeln;
 * gemessen: `| 'gesperrt'` an `AnmeldeHindernisArt` gehaengt, und
 * `npx tsc -b` blieb vorher Exit 0.
 *
 * Kein `navigator.onLine` hier: Diese Seite hat keinen Offline-Satz.
 */
const REAKTION: Record<AnmeldeHindernisArt, Reaktion> = {
  // Der Link ist zwischen Oeffnen und Absenden verbraucht oder abgelaufen.
  'nicht-angemeldet': 'link-verbraucht',
  abgelehnt: 'abgelehnt',
  'zu-oft': 'zu-oft',
  'nicht-erreichbar': 'fehlschlag',
  'nicht-bestaetigt': 'fehlschlag',
  unbekannt: 'fehlschlag',
}

export default function PasswortNeu() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const setzePasswort = useAuth((s) => s.setzePasswort)

  const [passwort, setPasswort] = useState('')
  const [wiederholung, setWiederholung] = useState('')
  /** Gestalt 1/2, rot: die zwei Eingabepruefungen und `abgelehnt`. */
  const [fehler, setFehler] = useState<string | null>(null)
  /** Gestalt 3, neutral: alles, was nicht die Schuld des Menschen ist. */
  const [neutralerFehler, setNeutralerFehler] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)

  // Ohne Anmeldung ist der Link abgelaufen oder wurde schon benutzt.
  const [geprueft, setGeprueft] = useState(false)
  // Und derselbe Befund, nur spaeter: `nicht-angemeldet` beim Absenden
  // heisst, dass der Link zwischen dem Oeffnen und dem Abschicken
  // verbraucht ist oder ablief. Bis zum 07.09.2026 gab es dafuer keinen
  // Weg in diese Ansicht - der Fall endete in einem roten Satz mit
  // englischem Servertext, obwohl die Seite die richtige Antwort schon
  // hatte: "Fordere einen neuen an."
  const [linkVerbraucht, setLinkVerbraucht] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGeprueft(true), 1500)
    return () => clearTimeout(t)
  }, [])

  /**
   * Von der Art zur Gestalt. Nur `abgelehnt` bleibt rot; alles andere
   * bekommt die neutrale Notiz (Entwurf, R3-Q2), und `nicht-angemeldet`
   * loest gar keine Meldung aus, sondern die Ansicht "Link nicht mehr
   * gueltig", die es hier schon gibt.
   *
   * Die Zuordnung steht in `REAKTION` (oben) - eine TABELLE statt einer
   * `if`-Kette mit Rest (B2 der Durchsicht, 08.09.2026): Der letzte Zweig
   * fing vorher alles auf, was nicht `nicht-angemeldet`, `abgelehnt` oder
   * `zu-oft` war, und eine siebte Art waere still hineingefallen.
   */
  const zeigeHindernis = (art: AnmeldeHindernisArt) => {
    const reaktion = REAKTION[art]
    if (reaktion === 'link-verbraucht') {
      setLinkVerbraucht(true)
      return
    }
    if (reaktion === 'abgelehnt') {
      setFehler(NICHT_ANGENOMMEN)
      return
    }
    setNeutralerFehler(reaktion === 'zu-oft' ? NICHT_GESETZT_ZU_OFT : NICHT_GESETZT)
  }

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    setFehler(null)
    setNeutralerFehler(null)

    if (passwort.length < 8) {
      setFehler('Das Passwort braucht mindestens 8 Zeichen.')
      return
    }
    if (passwort !== wiederholung) {
      setFehler('Die beiden Eingaben stimmen nicht überein.')
      return
    }

    setLaeuft(true)
    const hindernis = await setzePasswort(passwort)
    setLaeuft(false)

    if (hindernis) {
      zeigeHindernis(hindernis.art)
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

  // Zwei Wege in dieselbe Ansicht: gar nicht erst angemeldet angekommen,
  // oder beim Absenden als nicht angemeldet abgewiesen.
  if ((geprueft && !user) || linkVerbraucht) {
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

      {/* Gestalt 3: kein Feld ist schuld. Dieselbe neutrale Notiz, die die
          Erfolgsansicht oben schon benutzt - keine neue Klasse, kein neuer
          Inline-Stil (die Sperrklinke laesst dieser Datei drei, und es
          bleiben drei). */}
      {neutralerFehler && (
        <div className="md-info-note md-info-note--neutral" role="alert">
          <Icon name="warn" size={20} className="icon icon-sm" />
          <p>{neutralerFehler}</p>
        </div>
      )}

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>
      )}

      <button type="submit" className="md-button md-button--filled" disabled={laeuft}>
        {laeuft ? 'Wird gespeichert…' : 'Passwort speichern'}
      </button>
    </form>
  )
}
