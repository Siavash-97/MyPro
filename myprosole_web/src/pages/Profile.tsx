import MeldenBlatt from '../components/ui/MeldenBlatt'
import { designLesen, designUmschalten } from '../lib/design'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useEinwilligung } from '../store/einwilligung'
import { useAnamnese } from '../store/anamnese'
import { useRun } from '../store/run'
import { useZusammenlauf } from '../store/zusammenlauf'
import SichtbarkeitsBlatt from '../components/community/SichtbarkeitsBlatt'
import Icon from '../components/ui/Icon'
import Avatar from '../components/ui/Avatar'
import { useSnackbar } from '../components/ui/Snackbar'

const ZWECK_LABELS: Record<string, string> = {
  gesundheitsdaten: 'Gesundheitsdaten',
  notwendige_cookies: 'Notwendige Speicherung',
  analyse: 'Nutzung auswerten',
  zusammenlauf: 'Sichtbar für ZusammenLauf',
}

/** Was eine Erlaubnis abdeckt – damit die Zeile ohne Rueckfrage verstaendlich ist. */
const ZWECK_UMFANG: Record<string, string> = {
  gesundheitsdaten: 'Anamnese, Trainingstagebuch, Zykluskalender',
  notwendige_cookies: 'Anmeldung und Betrieb',
  analyse: 'Plattform und Zeitzone',
  zusammenlauf: 'Profil als Laufpartner-Vorschlag',
}

const settingsValueStyle = {
  color: 'var(--md-on-surface-variant)',
  font: 'var(--type-body-md)',
} as const

// Zeilen, deren Funktion noch nicht angeschlossen ist, stehen wie im Mockup da
// und sagen beim Antippen, woran es liegt – statt wortlos nichts zu tun.
// Dasselbe Muster wie prototype-placeholder.js in den Mockups.
const NOT_WIRED = 'Diese Funktion ist noch nicht angeschlossen.'

const rowButtonStyle = {
  width: '100%',
  border: 0,
  textAlign: 'left',
  cursor: 'pointer',
} as const

interface SettingsRowProps {
  icon: string
  label: string
  value?: string
  /** Ziel, wenn die Zeile auf eine Seite fuehrt. */
  to?: string
  /** Handlung, wenn die Zeile keine Seite oeffnet. */
  onClick?: () => void
}

function SettingsRow({ icon, label, value, to, onClick }: SettingsRowProps) {
  const inhalt = (
    <>
      <Icon name={icon} className="icon md-settings-row__icon" />
      <span className="md-settings-row__label">{label}</span>
      {value && <span style={settingsValueStyle}>{value}</span>}
      <Icon name="chevron-right" className="icon md-row__chevron" />
    </>
  )

  // Fuehrt die Zeile auf eine Seite, ist sie ein Link und kein Knopf. Vorher
  // gab es beides nebeneinander: eine Zeile als Link von Hand nachgebaut, der
  // Rest als Knopf. Wer eine neue Zeile ergaenzte, griff zum Knopf - und die
  // Zeile fuehrte nirgendwohin.
  if (to) {
    return (
      <Link className="md-settings-row" to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
        {inhalt}
      </Link>
    )
  }

  return (
    <button type="button" className="md-settings-row" onClick={onClick} style={rowButtonStyle}>
      {inhalt}
    </button>
  )
}

export default function Profile() {
  const { profile, signOut, setAvatar } = useAuth()
  const { eintraege, laden: einwilligungenLaden, gilt } = useEinwilligung()
  const { fetchSessions, blockOffen } = useAnamnese()
  const showSnackbar = useSnackbar()
  const deleteAllRuns = useRun((s) => s.deleteAllRuns)
  const [laeufeBestaetigen, setLaeufeBestaetigen] = useState(false)
  const [laeufeLoeschen, setLaeufeLoeschen] = useState(false)
  const [bildLaedt, setBildLaedt] = useState(false)
  const bildRef = useRef<HTMLInputElement>(null)
  const [darkMode, setDarkMode] = useState(
    () => designLesen() === 'dunkel',
  )

  // Profilbild wechseln. Der Pfad beginnt mit der eigenen Kennung – daran
  // haengt die Regel im Behaelter. Das alte Bild wird danach entfernt, sonst
  // sammeln sich mit jedem Wechsel Dateien an, die niemand mehr sieht.
  const bildWaehlen = async (datei: File | null) => {
    if (!datei) return
    setBildLaedt(true)
    const err = await setAvatar(datei)
    setBildLaedt(false)
    if (err) showSnackbar('Bild konnte nicht gespeichert werden: ' + err)
  }

  const handleLaeufeLoeschen = async () => {
    setLaeufeLoeschen(true)
    const { anzahl, error } = await deleteAllRuns()
    setLaeufeLoeschen(false)
    setLaeufeBestaetigen(false)
    if (error) {
      showSnackbar('Löschen fehlgeschlagen: ' + error)
      return
    }
    showSnackbar(
      anzahl === 0
        ? 'Es gab keine Läufe zu löschen.'
        : `${anzahl} ${anzahl === 1 ? 'Lauf' : 'Läufe'} gelöscht.`,
    )
  }

  useEffect(() => {
    einwilligungenLaden()
    fetchSessions()
  }, [einwilligungenLaden, fetchSessions])

  const showBlockBReminder =
    localStorage.getItem('myprosole_blockb_reminder') === 'true' &&
    !blockOffen('a') &&
    blockOffen('b')

  // Der Hinweis zielt auf die Anamnese, nicht mehr auf Profilfelder – dort
  // stehen Pensum, Erfahrung und Beschwerden.
  const profileIncomplete = blockOffen('a')
  // Je Zweck die juengste Zeile, und nur, wenn sie eine Erteilung ist.
  // Die Liste selbst ist eine Geschichte und enthaelt auch Widerrufe –
  // wuerde man sie roh anzeigen, stuende hinter einer zurueckgenommenen
  // Erlaubnis weiterhin "Aktiv".
  const aktiveEinwilligungen = (['gesundheitsdaten', 'notwendige_cookies', 'analyse', 'zusammenlauf'] as const)
    .filter((zweck) => gilt(zweck))
    .map((zweck) => ({
      zweck,
      seit: eintraege.find((e) => e.zweck === zweck && e.entscheidung === 'erteilt')?.zeitpunkt,
    }))

  const [meldenOffen, setMeldenOffen] = useState(false)

  // Sichtbar fuer ZusammenLauf. null heisst "noch nicht geladen" und wird
  // nicht als "aus" dargestellt - ein Schalter, der raet, luegt.
  const sichtbar = useZusammenlauf((s) => s.sichtbar)
  const sichtbarkeitLaden = useZusammenlauf((s) => s.sichtbarkeitLaden)
  const sichtbarkeitSetzen = useZusammenlauf((s) => s.sichtbarkeitSetzen)
  const [sichtbarBlattOffen, setSichtbarBlattOffen] = useState(false)

  // Der Widerruf steht noch aus.
  //
  // Zwei Quellen, weil jede allein eine Luecke hat:
  //
  // 1. `widerrufFehler` – was gerade eben passiert ist. Gilt auch dann, wenn
  //    ueberhaupt nichts geladen werden konnte; kein Netz ist ja der
  //    Normalfall dieses Zustands.
  // 2. Abgeleitet: Der Schalter steht auf aus, aber die juengste
  //    Einwilligungszeile sagt weiter "erteilt". Genau dieser Widerspruch
  //    ist das Problem – und er steht in den Daten, nicht in einem Merker.
  //    Deshalb ueberlebt er den Neustart der App, den (1) nicht ueberlebt.
  //
  // Absichtlich KEIN neues Feld im Speicher: Ein gespeicherter Zustand kann
  // von den Daten abweichen, eine Ableitung nicht. Dieselbe Begruendung, mit
  // der store/einwilligung.ts `gilt` ableitet, statt es zu speichern.
  //
  // Und absichtlich nicht am Fehlertext erkannt: Ein Zustand, den man aus
  // einer Zeichenkette liest, bricht beim naechsten Umformulieren still.
  const [widerrufFehler, setWiderrufFehler] = useState<string | null>(null)
  const [widerrufLaeuft, setWiderrufLaeuft] = useState(false)
  const widerrufOffen =
    widerrufFehler !== null || (sichtbar === false && gilt('zusammenlauf'))

  useEffect(() => {
    sichtbarkeitLaden()
  }, [sichtbarkeitLaden])

  // Drei Ausgaenge – und sie sind NICHT am Fehlertext auseinanderzuhalten,
  // sondern am Schalterstand daneben:
  //
  //   kein Fehler           beides hat geklappt
  //   Fehler, Schalter AN   das Ausschalten selbst ist gescheitert
  //   Fehler, Schalter AUS  aus ist sie, nur der Vermerk fehlt
  //
  // Bis zum 23.08.2026 bekamen alle drei dasselbe Praefix "Ausschalten
  // fehlgeschlagen: " – vorangestellt einem Satz, der mit "Die Sichtbarkeit
  // ist aus" begann. Der Mensch las einen Widerspruch in einer Zeile, und
  // wer daraus "hat nicht geklappt, nochmal tippen" schloss, wurde wieder
  // sichtbar: Der Schalter stand ja schon auf aus.
  //
  // `beiOffenemVermerk` gibt es nur fuer die Wiederholung, und das ist kein
  // Versehen: Beim ersten Mal ERSCHEINT der Standhinweis - die Aenderung auf
  // dem Bildschirm ist die Rueckmeldung. Bei der Wiederholung steht er schon
  // da und aendert sich womoeglich nicht; ohne ein Wort waere der Knopf tot.
  const widerrufAuswerten = (beiErfolg: string, beiOffenemVermerk?: string) => {
    const { fehler, sichtbar: jetzt } = useZusammenlauf.getState()
    if (!fehler) {
      setWiderrufFehler(null)
      showSnackbar(beiErfolg)
      return
    }
    if (jetzt) {
      // Noch sichtbar: Der Schutz ist nicht eingetreten. Hier ist "nochmal
      // antippen" richtig – und schreibt keine neue Einwilligungszeile, weil
      // der Schalter dann wieder in den Ausschalt-Zweig laeuft.
      showSnackbar('Ausschalten hat nicht geklappt. Bitte noch einmal antippen.')
      return
    }
    // Aus, aber ohne Vermerk. Ab hier uebernimmt der Standhinweis unter der
    // Zeile. Bewusst keine Kurzeinblendung daneben: Zwei Meldungen zum selben
    // Vorgang, und die kuerzere verschwindet nach vier Sekunden.
    setWiderrufFehler(fehler)
    if (beiOffenemVermerk) showSnackbar(beiOffenemVermerk)
  }

  const sichtbarkeitUmschalten = async () => {
    if (sichtbar === null) return
    if (!sichtbar) {
      // Einschalten nur ueber das Blatt: Erst den Wortlaut sehen, dann
      // einwilligen - ein stiller Boolean waere keine Einwilligung.
      setSichtbarBlattOffen(true)
      return
    }
    // Ausschalten sofort, ohne Rueckfrage - einen Schutz zurueckzunehmen
    // braucht keine Huerde.
    await sichtbarkeitSetzen(false)
    widerrufAuswerten('Du wirst nicht mehr als Laufpartner vorgeschlagen.')
  }

  // Den Widerruf nachreichen, ohne den Schalter anzufassen.
  //
  // `sichtbarkeitSetzen(false)` auf einem bereits ausgeschalteten Schalter
  // wiederholt nur den Widerruf (store/zusammenlauf.ts). Der frueher
  // angebotene Weg – "einmal wieder ein- und ausschalten" – schrieb dagegen
  // beim Einschalten eine zweite unveraenderliche "erteilt"-Zeile. Der
  // Nachweis nach Art. 7 Abs. 1 DSGVO haette danach durchgehende
  // Einwilligung behauptet, obwohl die Person zweimal widerrufen hat.
  const widerrufWiederholen = async () => {
    setWiderrufLaeuft(true)
    await sichtbarkeitSetzen(false)
    setWiderrufLaeuft(false)
    widerrufAuswerten('Widerruf vermerkt.', 'Der Widerruf kam noch nicht durch.')
  }

  const toggleDarkMode = () => setDarkMode(designUmschalten() === 'dunkel')

  const hint = () => showSnackbar(NOT_WIRED)

  return (
    <>
      {profileIncomplete && (
        <section className="md-profile-reminder md-profile-reminder--visible" aria-labelledby="profil-vollstaendigen-title">
          <div className="md-profile-reminder__icon" aria-hidden="true">
            <Icon name="profile" className="icon" />
          </div>
          <div className="md-profile-reminder__content">
            <p className="md-profile-reminder__title" id="profil-vollstaendigen-title">
              Profil vervollständigen
            </p>
            <p className="md-profile-reminder__text">
              Je vollständiger dein Laufprofil, desto genauer passen Tempo, Umfang und Übungen zu dir statt zum Durchschnitt.
            </p>
            <div className="md-profile-reminder__actions">
              <Link
                className="md-button md-button--filled md-button--compact"
                to="/anamnese"
                style={{ textDecoration: 'none' }}
              >
                Profil jetzt vervollständigen
              </Link>
            </div>
          </div>
        </section>
      )}

      {showBlockBReminder && (
        <section className="md-profile-reminder md-profile-reminder--visible" aria-labelledby="anamnese-nachholen-title">
          <div className="md-profile-reminder__icon" aria-hidden="true">
            <Icon name="profile" className="icon" />
          </div>
          <div className="md-profile-reminder__content">
            <p className="md-profile-reminder__title" id="anamnese-nachholen-title">
              2 offene Fragen zu Motivation und Regeneration
            </p>
            <p className="md-profile-reminder__text">
              Du wolltest später erinnert werden – die beiden freiwilligen Fragen dauern etwa 30 Sekunden.
            </p>
            <div className="md-profile-reminder__actions">
              <Link
                className="md-button md-button--filled md-button--compact"
                to="/anamnese?teil=b"
                style={{ textDecoration: 'none' }}
              >
                Jetzt beantworten
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="md-profile-header">
        <button
          type="button"
          onClick={() => bildRef.current?.click()}
          aria-label="Profilbild ändern"
          style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}
        >
          <Avatar name={profile?.display_name} pfad={profile?.avatar_url} groesse={64} />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', right: -2, bottom: -2, width: 24, height: 24,
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--md-primary)', color: 'var(--md-on-primary)',
            }}
          >
            <Icon name="photo" size={14} />
          </span>
        </button>
        <input
          ref={bildRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => bildWaehlen(e.target.files?.[0] ?? null)}
        />
        <div>
          <p className="md-profile-header__name">
            {profile?.display_name ?? 'Dein Profil'}
          </p>
          <p className="md-profile-header__meta">
            {bildLaedt ? 'Bild wird hochgeladen…' : 'Konto und persönliche Einstellungen'}
          </p>
        </div>
      </div>

      <div className="md-plan-card">
        <div>
          <p className="md-plan-card__title">Kostenlose Version</p>
          <p className="md-plan-card__desc">Premium schaltet erweiterte Auswertungen frei</p>
        </div>
        <button
          type="button"
          className="md-button md-button--tonal"
          onClick={hint}
          style={{ flexShrink: 0 }}
        >
          Upgrade
        </button>
      </div>

      <div>
        <p className="md-section-title">Zahlungen &amp; Mitgliedschaft</p>
        <div>
          <SettingsRow icon="badge" label="Mitgliedschaft" value="Kostenlos" onClick={hint} />
          <SettingsRow icon="card" label="Zahlungsmethode" value="Keine" onClick={hint} />
          <SettingsRow icon="receipt" label="Rechnungen" onClick={hint} />
        </div>
      </div>

      <div>
        <p className="md-section-title">Gerät</p>
        <div>
          <SettingsRow icon="bluetooth" label="Einlage verbinden" value="Nicht verbunden" to="/einlage/verbinden" />
          <SettingsRow icon="tune" label="Einlage kalibrieren" onClick={hint} />
          <SettingsRow icon="battery" label="Batterie und Speicher" onClick={hint} />
          <SettingsRow icon="watch" label="Smartwatch verbinden" value="Nicht verbunden" to="/puls-verbinden" />
        </div>
      </div>

      <div>
        <p className="md-section-title">Community</p>
        <div>
          {/* Opt-in mit Nachweis: Einschalten geht nur ueber das Blatt mit
              dem Einwilligungswortlaut, Ausschalten sofort. Solange der
              Stand nicht geladen ist (null), zeigt die Zeile keinen
              Schalter - ein geratener Zustand waere eine Luege. */}
          <button
            type="button"
            className="md-settings-row"
            onClick={sichtbarkeitUmschalten}
            disabled={sichtbar === null}
            aria-pressed={sichtbar === true}
            style={rowButtonStyle}
          >
            <Icon name="people" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Sichtbar für ZusammenLauf</span>
            {sichtbar === null ? (
              <span style={settingsValueStyle}>Wird geladen…</span>
            ) : (
              <span className={sichtbar ? 'md-toggle md-toggle--on' : 'md-toggle'} aria-hidden="true">
                <span className="md-toggle__knob" />
              </span>
            )}
          </button>
          {/* Der Reparaturweg fuer den Widerruf, der nicht ankam.
              Er steht hier und nicht in einer Kurzeinblendung, weil der
              Zustand andauert (bis Netz da ist) und eine Handlung traegt.
              Und er steht unter der Zeile, auf die er sich bezieht – nicht
              oben auf der Seite: Wer eben getippt hat, schaut hierher. */}
          {widerrufOffen && (
            <div className="md-row-hinweis" role="alert">
              <Icon name="warn" size={20} className="icon-sm md-row-hinweis__icon" />
              <div className="md-row-hinweis__text">
                <p className="md-row-hinweis__titel">Widerruf noch nicht vermerkt</p>
                {/* Woertlich aus dem Speicher, nicht zusammengesetzt: Dort
                    steht der Grund mit drin, und ein selbst gebauter Satz
                    daraus verloere ihn. Der Rueckfall greift nach einem
                    Neustart, wenn nur noch die Ableitung uebrig ist. */}
                <p className="md-row-hinweis__meldung">
                  {widerrufFehler ??
                    'Die Sichtbarkeit ist aus, aber der Widerruf ist noch nicht vermerkt.'}
                </p>
                {/* Damit niemand raetselt, warum die Erlaubnis weiter unten
                    trotzdem als "Aktiv" dasteht. Sie tut es zu Recht: Der
                    Nachweis kennt den Widerruf noch nicht. */}
                <p className="md-row-hinweis__zusatz">
                  Bis er ankommt, steht die Erlaubnis unter „Deine Einwilligungen“ weiter als aktiv.
                </p>
                <button
                  type="button"
                  className="md-button md-button--compact md-row-hinweis__aktion"
                  onClick={widerrufWiederholen}
                  disabled={widerrufLaeuft}
                >
                  {widerrufLaeuft ? 'Wird gesendet…' : 'Erneut senden'}
                </button>
              </div>
            </div>
          )}
          {/* Der Weg zu uns, wenn es kein einzelnes Konto betrifft. */}
          <button type="button" className="md-settings-row" onClick={() => setMeldenOffen(true)} style={rowButtonStyle}>
            <Icon name="warn" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Problem melden</span>
            <Icon name="chevron-right" className="icon md-row__chevron" />
          </button>
          {/* Beide fuehrten vorher nur zu einem Hinweis. */}
          <Link className="md-settings-row" to="/community/profil" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name="profile" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Community-Profil</span>
            <Icon name="chevron-right" className="icon md-row__chevron" />
          </Link>
          <Link className="md-settings-row" to="/community/gruppen" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name="people" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Meine Gruppen</span>
            <Icon name="chevron-right" className="icon md-row__chevron" />
          </Link>
          <SettingsRow icon="shield" label="Blockierte Nutzer:innen" onClick={hint} />
        </div>
      </div>

      <div>
        <p className="md-section-title">Gesundheit</p>
        <div>
          <Link
            className="md-settings-row"
            to="/zyklus"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Icon name="cycle" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Zykluskalender</span>
            <span style={settingsValueStyle}>Nicht eingerichtet</span>
            <Icon name="chevron-right" className="icon md-row__chevron" />
          </Link>
        </div>
      </div>

      <div>
        <p className="md-section-title">Einstellungen</p>
        <div>
          <button type="button" className="md-settings-row" onClick={hint} style={rowButtonStyle}>
            <Icon name="bell" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Benachrichtigungen</span>
            <span className="md-toggle md-toggle--on" aria-hidden="true">
              <span className="md-toggle__knob" />
            </span>
          </button>
          <label className="md-settings-row" htmlFor="dunkles-design">
            <Icon name="moon" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Dunkles Design</span>
            <input
              className="md-switch"
              id="dunkles-design"
              type="checkbox"
              checked={darkMode}
              onChange={toggleDarkMode}
            />
            <span className="md-toggle" aria-hidden="true">
              <span className="md-toggle__knob" />
            </span>
          </label>
          <SettingsRow icon="globe" label="Sprache" value="Deutsch" onClick={hint} />
          {/* Beides oeffentlich erreichbar und hier verlinkt – vorher zeigte
              "Datenschutz" nur einen Hinweis, dass es die Seite nicht gibt. */}
          <Link className="md-settings-row" to="/datenschutz" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name="shield" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Datenschutz</span>
            <Icon name="chevron-right" className="icon md-row__chevron" />
          </Link>
          <Link className="md-settings-row" to="/agb" style={{ textDecoration: 'none', color: 'inherit' }}>
            <Icon name="info" className="icon md-settings-row__icon" />
            <span className="md-settings-row__label">Nutzungsbedingungen</span>
            <Icon name="chevron-right" className="icon md-row__chevron" />
          </Link>
        </div>
      </div>

      {/* Nicht im Mockup, bewusst behalten: Diese Uebersicht zeigt die
          tatsaechlich erteilten Art.-9-Einwilligungen. Sie ersatzlos zu
          streichen waere ein Rueckschritt bei der Transparenz ueber
          Gesundheitsdaten. Siehe offene Frage B5. */}
      <div>
        <p className="md-section-title">Deine Einwilligungen</p>
        <div className="md-card">
          <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            Deine Erlaubnisse
          </p>
          {aktiveEinwilligungen.length === 0 ? (
            <p style={{ margin: 0, ...settingsValueStyle }}>
              Es gilt gerade keine Erlaubnis.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {aktiveEinwilligungen.map((e) => (
                <div key={e.zweck} className="md-row" style={{ cursor: 'default' }}>
                  <span style={settingsValueStyle}>
                    {ZWECK_LABELS[e.zweck]}
                    {' · '}
                    {ZWECK_UMFANG[e.zweck]}
                    {e.seit && ' · seit ' + new Date(e.seit).toLocaleDateString('de-DE')}
                  </span>
                  <span style={{ font: 'var(--type-body-md)', color: 'var(--md-success)' }}>
                    Aktiv
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Laufverlauf zuruecksetzen. Zweistufig, weil es nicht rueckgaengig zu
          machen ist: Der erste Tipp benennt die Folge, der zweite fuehrt sie
          aus. Das Konto selbst bleibt bestehen. */}
      <div>
        <p className="md-section-title">Laufverlauf</p>
        {!laeufeBestaetigen ? (
          <button
            type="button"
            onClick={() => setLaeufeBestaetigen(true)}
            className="md-settings-row"
            style={{ borderRadius: 'var(--radius-md)', border: 0, width: '100%', cursor: 'pointer' }}
          >
            <Icon name="history" className="icon" />
            <span className="md-settings-row__label" style={{ textAlign: 'left' }}>
              Alle Läufe löschen
            </span>
          </button>
        ) : (
          <div className="md-card md-card--outlined">
            <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>
              Alle deine Läufe werden endgültig gelöscht – auch Strecken,
              Abschnitte und Höhenmeter. Dein Konto, dein Profil und die
              Anamnese bleiben erhalten. Das lässt sich nicht rückgängig machen.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={() => setLaeufeBestaetigen(false)}
                disabled={laeufeLoeschen}
                className="md-button md-button--compact"
                style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleLaeufeLoeschen}
                disabled={laeufeLoeschen}
                className="md-button md-button--filled md-button--compact"
                style={{ flex: 1, background: 'var(--md-error)', color: 'var(--md-on-error)' }}
              >
                {laeufeLoeschen ? 'Wird gelöscht…' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => signOut()}
        className="md-settings-row"
        style={{
          color: 'var(--md-error)',
          borderRadius: 'var(--radius-md)',
          border: 0,
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <Icon name="logout" className="icon" style={{ color: 'var(--md-error)' }} />
        <span className="md-settings-row__label" style={{ textAlign: 'left' }}>Abmelden</span>
      </button>

      <MeldenBlatt
        offen={meldenOffen}
        onSchliessen={() => setMeldenOffen(false)}
        art="support"
        onFertig={showSnackbar}
      />

      <SichtbarkeitsBlatt
        offen={sichtbarBlattOffen}
        onSchliessen={() => setSichtbarBlattOffen(false)}
      />
    </>
  )
}
