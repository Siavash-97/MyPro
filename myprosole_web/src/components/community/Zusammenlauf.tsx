import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { eigeneKennung } from '../../lib/eigeneKennung'
import { useZusammenlauf } from '../../store/zusammenlauf'
import type { CommunityProfil } from '../../store/communityProfile'
import { FRAGEN } from '../../lib/profilFragen'
import Avatar from '../ui/Avatar'
import Icon from '../ui/Icon'
import LoadingSpinner from '../ui/LoadingSpinner'
import { useSnackbar } from '../ui/Snackbar'

/**
 * Der ZusammenLauf-Bereich: Anfragen an mich und der Vorschlagsstapel.
 *
 * Wischen ist eine Entscheidung, kein Blaettern (siehe Kopf von
 * store/zusammenlauf.ts): links heisst dauerhaft weg, rechts heisst
 * Anfrage. Beides gibt es zusaetzlich als Knopf - eine Geste, die man
 * nicht sieht und mit Hilfstechnik nicht ausfuehren kann, darf nie der
 * einzige Weg sein.
 *
 * Namen und Bilder kommen aus `profiles`, nicht aus dem Store: Die
 * Vorschlagsfunktion (Migration 0052) gibt mit Absicht nur die Spalten des
 * Community-Profils heraus. Dieselbe Nachschlage-Stelle benutzt auch die
 * Anfragenliste - deshalb wohnt sie hier als gemeinsamer Hook.
 */

/** Name und Bild einer Person, wie ueberall sonst aus `profiles`. */
interface Kopf {
  id: string
  display_name: string | null
  avatar_url: string | null
}

/**
 * Namen und Bilder zu einer Liste von Kennungen, einmal geholt und dann
 * gemerkt. Scheitert das Holen, bleibt der Eintrag leer und die Oberflaeche
 * sagt "Jemand" - derselbe Rueckfall wie bei den Verabredungen.
 */
function useKoepfe(ids: string[]): Record<string, Kopf> {
  const [koepfe, setKoepfe] = useState<Record<string, Kopf>>({})
  const angefragt = useRef(new Set<string>())
  const fehlend = ids.filter((id) => !angefragt.current.has(id))
  const schluessel = fehlend.join('|')

  useEffect(() => {
    if (schluessel === '') return
    const jetzt = schluessel.split('|')
    for (const id of jetzt) angefragt.current.add(id)
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', jetzt)
      .then(({ data }) => {
        if (!data) return
        setKoepfe((vorher) => {
          const neu = { ...vorher }
          for (const kopf of data as Kopf[]) neu[kopf.id] = kopf
          return neu
        })
      })
  }, [schluessel])

  return koepfe
}

/* ------------------------------------------------------------------ */
/* Sicherheitserklaerung                                               */
/* ------------------------------------------------------------------ */

const SICHERHEIT_MERKER = 'myprosole_zusammenlauf_sicherheit_gesehen'

/**
 * Beim ersten Besuch ausgeschrieben, danach hinter dem "!"-Kreis.
 *
 * Der Text ist kein Zierat: Er begruendet, warum sich die Seite gefahrlos
 * benutzen laesst - vor allem, dass der genaue Treffpunkt erst nach einer
 * Zusage geteilt wird. Wer das nicht weiss, traut sich zu Recht nicht.
 */
function Sicherheitserklaerung() {
  const [offen, setOffen] = useState(
    () => localStorage.getItem(SICHERHEIT_MERKER) !== 'true',
  )

  // Der Besuch zaehlt ab jetzt als gesehen - beim naechsten Mal ist der
  // Text eingeklappt und wartet hinter dem Kreis.
  useEffect(() => {
    localStorage.setItem(SICHERHEIT_MERKER, 'true')
  }, [])

  return (
    <>
      <div className="md-kopfzeile">
        <p className="md-section-title">Laufpartner in deiner Nähe</p>
        <button
          type="button"
          className="md-hinweis-kreis"
          aria-expanded={offen}
          aria-controls="zusammenlauf-sicherheit"
          aria-label={
            offen ? 'Sicherheitshinweis verbergen' : 'Sicherheitshinweis anzeigen'
          }
          onClick={() => setOffen((v) => !v)}
        >
          <Icon name="warn" size={22} />
        </button>
      </div>
      {offen && (
        <div className="md-info-note" id="zusammenlauf-sicherheit">
          <Icon name="shield" size={20} className="icon icon-sm" />
          <div className="md-sicherheitstext">
            <p>
              Hier siehst du nur Menschen, die selbst gefunden werden wollen:
              Sichtbar ist, wer den Schalter in seinem Profil ausdrücklich
              eingeschaltet hat – niemand steht ungefragt in diesem Stapel.
            </p>
            <p>
              Öffentlich sind dabei nur das Community-Profil und bei
              Verabredungen Stadt oder Stadtteil, Zeit und Tempo. Der genaue
              Treffpunkt wird erst geteilt, wenn du einer Person zusagst –
              vorher sieht ihn niemand. Du kannst hier also stöbern und
              anfragen, ohne preiszugeben, wo du läufst.
            </p>
            <p>
              Wen du wegwischst, wird dir nicht mehr vorgeschlagen. Blockieren
              und melden kannst du jede Person jederzeit über ihr Profil.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Anfragen an mich                                                    */
/* ------------------------------------------------------------------ */

/** "3. Aug." - kurz, weil die Karte der Person gehoert, nicht dem Datum. */
function anfrageDatum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

/**
 * Offene Anfragen an mich, mit sichtbarem Absender.
 *
 * Der Absender ist eine Zeile mit Gesicht und fuehrt auf sein volles
 * Community-Profil - ueber eine Laufverabredung mit einem Fremden
 * entscheidet man nicht anhand eines Namens.
 */
function AnfragenAnMich() {
  const showSnackbar = useSnackbar()
  const kontaktAnfragen = useZusammenlauf((s) => s.kontaktAnfragen)
  const antworten = useZusammenlauf((s) => s.antworten)
  const ich = eigeneKennung()

  const offene = kontaktAnfragen.filter(
    (a) => a.an_id === ich && a.stand === 'offen',
  )
  const koepfe = useKoepfe(offene.map((a) => a.von_id))

  if (offene.length === 0) return null

  const entscheiden = async (anfrageId: string, antwort: 'angenommen' | 'abgelehnt') => {
    await antworten(anfrageId, antwort)
    const fehler = useZusammenlauf.getState().fehler
    if (fehler) {
      showSnackbar('Antworten fehlgeschlagen: ' + fehler)
      return
    }
    showSnackbar(
      antwort === 'angenommen'
        ? 'Angenommen – ihr könnt euch jetzt zu einem Lauf verabreden.'
        : 'Abgelehnt.',
    )
  }

  return (
    <section>
      <p className="md-section-title">
        {offene.length === 1 ? 'Eine Anfrage an dich' : `${offene.length} Anfragen an dich`}
      </p>
      <div className="md-stapelbereich">
        {offene.map((a) => {
          const kopf = koepfe[a.von_id]
          return (
            <article key={a.id} className="md-card md-anfragekarte">
              <Link className="md-personzeile" to={`/community/profil/${a.von_id}`}>
                <Avatar name={kopf?.display_name} pfad={kopf?.avatar_url} groesse={40} />
                <p className="md-personzeile__name">{kopf?.display_name ?? 'Jemand'}</p>
                <p className="md-personzeile__zeit">{anfrageDatum(a.created_at)}</p>
                <Icon name="chevron-right" className="icon md-row__chevron" />
              </Link>
              <div className="md-aktions-zeile">
                <button
                  type="button"
                  className="md-button md-button--outlined md-button--compact"
                  onClick={() => entscheiden(a.id, 'abgelehnt')}
                >
                  Ablehnen
                </button>
                <button
                  type="button"
                  className="md-button md-button--filled md-button--compact"
                  onClick={() => entscheiden(a.id, 'angenommen')}
                >
                  Annehmen
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Der Vorschlagsstapel                                                */
/* ------------------------------------------------------------------ */

/** Ab dieser Zugweite gilt das Loslassen als Entscheidung. */
const WISCH_SCHWELLE = 80

/** Antworttext zu einem gespeicherten Wert, nachgeschlagen statt erraten. */
function antwortText(schluessel: string, wert: string | null): string | null {
  if (!wert) return null
  const frage = FRAGEN.find((f) => f.schluessel === schluessel)
  return frage?.antworten?.find((a) => a.wert === wert)?.text ?? null
}

/** Die Zeile unter dem Namen: Umfang, Gegend, Erfahrung - was da ist. */
function metaZeile(p: CommunityProfil): string {
  const teile: string[] = []
  const km = antwortText('km_woche', p.km_woche)
  if (km) teile.push(`${km} km die Woche`)
  const gelaende = antwortText('gelaende', p.gelaende)
  if (gelaende) teile.push(gelaende)
  if (p.running_years != null) {
    teile.push(p.running_years === 1 ? 'läuft seit 1 Jahr' : `läuft seit ${p.running_years} Jahren`)
  }
  return teile.join(' · ')
}

function Vorschlagsstapel() {
  const showSnackbar = useSnackbar()
  const stapel = useZusammenlauf((s) => s.stapel)
  const laedt = useZusammenlauf((s) => s.laedt)
  const fehler = useZusammenlauf((s) => s.fehler)
  const sichtbar = useZusammenlauf((s) => s.sichtbar)
  const wegwischen = useZusammenlauf((s) => s.wegwischen)
  const anfragen = useZusammenlauf((s) => s.anfragen)
  const vorschlaegeLaden = useZusammenlauf((s) => s.vorschlaegeLaden)

  const [fliegt, setFliegt] = useState<'links' | 'rechts' | null>(null)
  const [entscheidung, setEntscheidung] = useState<'anfragen' | 'wegwischen' | null>(null)
  const zug = useRef({ x0: 0, dx: 0, aktiv: false })

  const koepfe = useKoepfe(stapel.slice(0, 3).map((p) => p.user_id))

  const abschliessen = async (art: 'anfragen' | 'wegwischen', userId: string) => {
    if (art === 'wegwischen') {
      await wegwischen(userId)
      const f = useZusammenlauf.getState().fehler
      // Die Karte ist so oder so weg (siehe Store-Kopf) - aber ein Fehler
      // wird gesagt, nicht verschluckt.
      showSnackbar(
        f
          ? 'Gemerkt, aber nicht gespeichert: ' + f
          : 'Wird dir nicht mehr vorgeschlagen.',
      )
      return
    }
    await anfragen(userId)
    const f = useZusammenlauf.getState().fehler
    // Bei einem Fehler bleibt die Karte bewusst liegen: Die Anfrage ist
    // nie angekommen, und das soll man sehen.
    showSnackbar(f ? 'Anfrage nicht angekommen: ' + f : 'Anfrage gesendet.')
  }

  const entscheiden = (art: 'anfragen' | 'wegwischen') => {
    if (fliegt) return
    const oberste = useZusammenlauf.getState().stapel[0]
    if (!oberste) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void abschliessen(art, oberste.user_id)
      return
    }
    setFliegt(art === 'anfragen' ? 'rechts' : 'links')
    window.setTimeout(() => {
      setFliegt(null)
      void abschliessen(art, oberste.user_id)
    }, 230)
  }

  const zugStart = (e: React.PointerEvent<HTMLElement>) => {
    if (fliegt) return
    // Knoepfe und Verweise in der Karte bleiben Knoepfe und Verweise.
    if ((e.target as HTMLElement).closest('a, button')) return
    zug.current = { x0: e.clientX, dx: 0, aktiv: true }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('md-stapel__karte--zieht')
  }

  const zugBewegt = (e: React.PointerEvent<HTMLElement>) => {
    if (!zug.current.aktiv) return
    const dx = e.clientX - zug.current.x0
    zug.current.dx = dx
    e.currentTarget.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`
    const jetzt = dx > WISCH_SCHWELLE ? 'anfragen' : dx < -WISCH_SCHWELLE ? 'wegwischen' : null
    setEntscheidung((vorher) => (vorher === jetzt ? vorher : jetzt))
  }

  const zugEnde = (e: React.PointerEvent<HTMLElement>) => {
    if (!zug.current.aktiv) return
    zug.current.aktiv = false
    e.currentTarget.classList.remove('md-stapel__karte--zieht')
    e.currentTarget.style.transform = ''
    setEntscheidung(null)
    if (zug.current.dx > WISCH_SCHWELLE) entscheiden('anfragen')
    else if (zug.current.dx < -WISCH_SCHWELLE) entscheiden('wegwischen')
  }

  if (laedt && stapel.length === 0) return <LoadingSpinner />

  // Leer WEIL kaputt ist etwas anderes als leer: Hier fehlt nicht die
  // Nachbarschaft, sondern die Verbindung oder die Tabelle (Migration noch
  // nicht eingespielt). Das wird gesagt, nicht als Leere verkauft.
  if (stapel.length === 0 && fehler) {
    return (
      <section className="md-card md-leer">
        <div className="md-feature-heading__icon" aria-hidden="true">
          <Icon name="warn" className="icon" />
        </div>
        <p className="md-section-title">Vorschläge lassen sich gerade nicht laden</p>
        <p className="md-leer__text">{fehler}</p>
        <button
          type="button"
          className="md-button md-button--tonal"
          onClick={() => vorschlaegeLaden()}
        >
          Erneut versuchen
        </button>
      </section>
    )
  }

  // Ehrlich leer: keine Platzhalterprofile. Anfangs ist der Stapel immer
  // leer, weil Sichtbarkeit Opt-in ist - der Weg hinaus ist, selbst
  // sichtbar zu werden.
  if (stapel.length === 0) {
    return (
      <section className="md-card md-leer">
        <div className="md-feature-heading__icon" aria-hidden="true">
          <Icon name="people" className="icon" />
        </div>
        <p className="md-section-title">Noch niemand in deiner Nähe sichtbar</p>
        {/* Drei Staende, nicht zwei. `null` heisst "noch nicht geladen" und
            faellt seit dem 23.08.2026 nicht mehr in den Aus-Zweig: Der fordert
            zum Sichtbarwerden auf, und wer das bereits IST, bekam damit eine
            Einladung zu etwas, das er laengst getan hat – ein Tipp darauf
            fuehrt auf die Profilseite zu einem Schalter, der schon an steht.
            Vorbild ist Profile.tsx, wo `null` den Schalter gar nicht erst
            zeigt, statt ihn zu raten. */}
        {sichtbar === null ? (
          // Ueber den eigenen Stand ist hier nichts bekannt, also steht hier
          // auch nichts darueber. Was gilt, gilt in jedem Fall.
          <p className="md-leer__text">
            Sobald jemand dazukommt, der gefunden werden will, erscheint die
            Person hier.
          </p>
        ) : sichtbar ? (
          <p className="md-leer__text">
            Du bist sichtbar. Sobald jemand dazukommt, der gefunden werden
            will, erscheint die Person hier.
          </p>
        ) : (
          <>
            <p className="md-leer__text">
              Vorgeschlagen wird nur, wer selbst sichtbar sein will – und das
              hat hier noch niemand eingeschaltet. Werde du der Anfang: Sobald
              du sichtbar bist, können andere dich finden.
            </p>
            <Link className="md-button md-button--tonal" to="/profil">
              Sichtbar werden
            </Link>
          </>
        )}
      </section>
    )
  }

  const oberste = stapel[0]
  const dahinter = stapel[1]
  const obersterKopf = koepfe[oberste.user_id]
  const meta = metaZeile(oberste)

  return (
    <div className="md-stapelbereich">
      <div className="md-stapel">
        {dahinter && (
          <article
            key={dahinter.user_id}
            className="md-card md-stapel__karte md-stapel__karte--dahinter"
            aria-hidden="true"
          >
            <div className="md-stapel__kopf">
              <Avatar
                name={koepfe[dahinter.user_id]?.display_name}
                pfad={koepfe[dahinter.user_id]?.avatar_url}
                groesse={64}
              />
              <div className="md-stapel__wer">
                <p className="md-stapel__name">
                  {koepfe[dahinter.user_id]?.display_name ?? 'Jemand'}
                </p>
              </div>
            </div>
          </article>
        )}

        <article
          key={oberste.user_id}
          className={
            'md-card md-stapel__karte' +
            (fliegt === 'links' ? ' md-stapel__karte--fliegt-links' : '') +
            (fliegt === 'rechts' ? ' md-stapel__karte--fliegt-rechts' : '')
          }
          data-entscheidung={entscheidung ?? undefined}
          onPointerDown={zugStart}
          onPointerMove={zugBewegt}
          onPointerUp={zugEnde}
          onPointerCancel={zugEnde}
        >
          <span className="md-stapel__siegel md-stapel__siegel--anfragen" aria-hidden="true">
            Anfragen
          </span>
          <span className="md-stapel__siegel md-stapel__siegel--weg" aria-hidden="true">
            Nicht mehr
          </span>

          <div className="md-stapel__kopf">
            <Avatar
              name={obersterKopf?.display_name}
              pfad={obersterKopf?.avatar_url}
              groesse={64}
            />
            <div className="md-stapel__wer">
              <p className="md-stapel__name">{obersterKopf?.display_name ?? 'Jemand'}</p>
              {meta && <p className="md-stapel__meta">{meta}</p>}
            </div>
          </div>

          {oberste.bio && <p className="md-stapel__bio">{oberste.bio}</p>}

          {oberste.sports.length > 0 && (
            <div className="md-chip-set">
              {oberste.sports.map((sport) => (
                <span className="md-chip" key={sport}>{sport}</span>
              ))}
            </div>
          )}

          <Link
            className="md-button md-button--text md-button--compact"
            to={`/community/profil/${oberste.user_id}`}
          >
            Ganzes Profil ansehen
          </Link>
        </article>
      </div>

      <div className="md-aktions-zeile">
        <button
          type="button"
          className="md-button md-button--outlined"
          disabled={fliegt !== null}
          onClick={() => entscheiden('wegwischen')}
        >
          Kein Interesse
        </button>
        <button
          type="button"
          className="md-button md-button--filled"
          disabled={fliegt !== null}
          onClick={() => entscheiden('anfragen')}
        >
          Kontakt anfragen
        </button>
      </div>
      <p className="md-stapel__dauerhinweis">
        „Kein Interesse“ ist endgültig – dieses Profil wird dir nicht mehr
        vorgeschlagen. Wischen geht auch: nach links weg, nach rechts anfragen.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Der ganze Bereich                                                   */
/* ------------------------------------------------------------------ */

export default function ZusammenlaufBereich() {
  const showSnackbar = useSnackbar()
  const vorschlaegeLaden = useZusammenlauf((s) => s.vorschlaegeLaden)
  const anfragenLaden = useZusammenlauf((s) => s.anfragenLaden)
  const sichtbarkeitLaden = useZusammenlauf((s) => s.sichtbarkeitLaden)

  useEffect(() => {
    void Promise.all([vorschlaegeLaden(), anfragenLaden(), sichtbarkeitLaden()]).then(() => {
      const fehler = useZusammenlauf.getState().fehler
      // Fehlt die Tabelle noch (Migration nicht eingespielt) oder das Netz,
      // steht das hier - nicht in der Konsole.
      if (fehler) showSnackbar('ZusammenLauf konnte nicht laden: ' + fehler)
    })
  }, [vorschlaegeLaden, anfragenLaden, sichtbarkeitLaden, showSnackbar])

  return (
    <>
      <AnfragenAnMich />
      <section className="md-stapelbereich">
        <Sicherheitserklaerung />
        <Vorschlagsstapel />
      </section>
    </>
  )
}
