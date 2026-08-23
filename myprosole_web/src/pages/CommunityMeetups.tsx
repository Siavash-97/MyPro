import { useEffect, useState } from 'react'
import Icon from '../components/ui/Icon'
import Avatar from '../components/ui/Avatar'
import CommunityTabs from '../components/community/CommunityTabs'
import ZusammenlaufBereich from '../components/community/Zusammenlauf'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'
import { useCommunityRuns, TEMPO_ARTEN, TEMPO_LABEL, type TempoArt, type CommunityRun, type LaufEingabe, type LaufAenderung } from '../store/communityRuns'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'
import { useChats, type RunRequest } from '../store/chats'

/**
 * ZusammenLauf (community-zusammenlauf.html): Laufpartner finden und
 * Verabredungen zum gemeinsamen Laufen.
 *
 * Oben der Vorschlagsstapel samt Anfragen und Sicherheitserklaerung
 * (components/community/Zusammenlauf.tsx), darunter die Verabredungen als
 * Reihe zum Wischen.
 *
 * Sichtbarkeit: Alle angemeldeten Nutzer sehen alle Verabredungen – aber nur
 * Stadt oder Stadtteil, Zeit und Tempo. Der genaue Treffpunkt liegt in einer
 * eigenen Tabelle mit eigenen Rechten (Migration 0018) und wird erst
 * weitergegeben, wenn der Ersteller jemandem zusagt.
 *
 * Der Hinweis dazu steht bewusst VOR den Eingabefeldern: Wer tippt, soll
 * vorher wissen, was oeffentlich wird.
 *
 * Der Weg: anfragen, der Ersteller sagt zu, daraus entsteht ein Chat – und
 * erst dort steht der genaue Treffpunkt.
 */
export default function CommunityMeetups() {
  const showSnackbar = useSnackbar()
  const { runs, loading, fetchRuns, createRun } = useCommunityRuns()
  const [formularOffen, setFormularOffen] = useState(false)

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  return (
    <>
      <CommunityTabs />

      <ZusammenlaufBereich />

      <div className="md-kopfzeile">
        <p className="md-section-title">Kommende Läufe</p>
        <button
          type="button"
          onClick={() => showSnackbar('Der Umkreis lässt sich einstellen, sobald wir nach Stadt filtern.')}
          className="md-button md-button--text md-button--compact"
        >
          <Icon name="tune" size={20} className="icon-sm" />
          Filter
        </button>
      </div>

      {loading && runs.length === 0 ? (
        <LoadingSpinner />
      ) : runs.length === 0 ? (
        <section className="md-card" style={{ textAlign: 'center' }}>
          <div className="md-feature-heading__icon" style={{ margin: '0 auto var(--space-md)' }} aria-hidden="true">
            <Icon name="location" className="icon" />
          </div>
          <p className="md-section-title" style={{ marginBottom: 4 }}>Noch keine Verabredungen</p>
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Schlag den ersten Lauf vor – mit Treffpunkt, Uhrzeit und Tempo.
          </p>
        </section>
      ) : (
        // Waagerecht statt untereinander: Die Verabredungen teilen sich die
        // Seite jetzt mit dem Vorschlagsstapel, und eine Reihe zum Wischen
        // laesst beide sichtbar bleiben. Die angeschnittene naechste Karte
        // zeigt, dass es weitergeht.
        <div className="md-karussell">
          {runs.map((r) => <Verabredung key={r.id} lauf={r} />)}
        </div>
      )}

      {formularOffen ? (
        <LaufFormular
          onAbbrechen={() => setFormularOffen(false)}
          onSpeichern={async (daten) => {
            // Beim Anlegen ist der Treffpunkt Pflicht. Ohne
            // `treffpunktUnbekannt` laesst das Formular gar nicht absenden,
            // solange das Feld leer ist - hier kann er also nicht fehlen.
            const err = await createRun({ ...daten, meetingPoint: daten.meetingPoint ?? '' })
            if (!err) {
              setFormularOffen(false)
              showSnackbar('Verabredung eingetragen.')
            }
            return err
          }}
        />
      ) : (
        <button
          type="button"
          className="md-button md-button--filled"
          onClick={() => setFormularOffen(true)}
        >
          Lauf vorschlagen
        </button>
      )}
    </>
  )
}


/**
 * Eine Verabredung in der Liste.
 *
 * Der Ersteller sieht offene Anfragen und entscheidet. Alle anderen sehen
 * einen Knopf zum Anfragen, den Stand ihrer Anfrage oder – nach einer
 * Zusage – den Weg in den Chat.
 */
function Verabredung({ lauf }: { lauf: CommunityRun }) {
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const { deleteRun, updateRun, fetchMeetingPoint } = useCommunityRuns()
  const [bearbeiten, setBearbeiten] = useState<LaufEingabe | null>(null)
  const [laedtOrt, setLaedtOrt] = useState(false)
  const [ortUnbekannt, setOrtUnbekannt] = useState(false)
  const { chats, fetchChats, fetchRequests, fetchMyRequest, requestJoin, decide } = useChats()

  const [anfragen, setAnfragen] = useState<RunRequest[]>([])
  const [meine, setMeine] = useState<RunRequest | null>(null)
  const [nachricht, setNachricht] = useState('')
  const [formular, setFormular] = useState(false)

  const eigen = lauf.user_id === user?.id
  const chat = chats.find((c) => c.run_id === lauf.id)

  useEffect(() => {
    if (eigen) fetchRequests(lauf.id).then((a) => setAnfragen(a.filter((x) => x.status === 'pending')))
    else fetchMyRequest(lauf.id).then(setMeine)
    fetchChats()
  }, [eigen, lauf.id, fetchRequests, fetchMyRequest, fetchChats])

  // Der genaue Treffpunkt steht in der geschuetzten Tabelle und ist nicht
  // Teil der Liste. Er wird erst geholt, wenn wirklich bearbeitet wird –
  // sonst laedt die Seite ihn fuer jede eigene Verabredung mit, obwohl ihn
  // niemand sehen will.
  const bearbeitenStarten = async () => {
    setLaedtOrt(true)
    const { treffpunkt, fehler } = await fetchMeetingPoint(lauf.id)
    setLaedtOrt(false)
    setOrtUnbekannt(fehler != null)
    setBearbeiten({
      city: lauf.city,
      meetingPoint: treffpunkt ?? '',
      starts_at: lauf.starts_at,
      distance_km: lauf.distance_km,
      pace: lauf.pace,
      note: lauf.note,
    })
  }

  const anfrageSenden = async () => {
    const err = await requestJoin(lauf.id, nachricht.trim() || null)
    if (err) {
      showSnackbar('Anfrage fehlgeschlagen: ' + err)
      return
    }
    setFormular(false)
    setNachricht('')
    setMeine(await fetchMyRequest(lauf.id))
    showSnackbar('Anfrage gesendet.')
  }

  const entscheiden = async (a: RunRequest, annehmen: boolean) => {
    const err = await decide(a, annehmen)
    if (err) {
      showSnackbar('Fehlgeschlagen: ' + err)
      return
    }
    setAnfragen((v) => v.filter((x) => x.id !== a.id))
    showSnackbar(annehmen ? 'Zugesagt – ihr könnt jetzt schreiben.' : 'Abgesagt.')
  }

  return (
    <article className="md-card">
      {/* Kopf der Karte: Bild gross nach links, darueber der Name.
          Die Verabredung ist eine Sache zwischen Menschen - wer sie
          vorschlaegt, steht deshalb oben und nicht als Fussnote unter den
          Angaben. Ort, Zeit und Tempo folgen darunter. */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
        <Avatar
          name={lauf.profiles?.display_name}
          pfad={lauf.profiles?.avatar_url}
          groesse={64}
          vergroesserbar
        />

        {/* minWidth 0, damit ein langer Ortsname die Spalte nicht aufblaeht
            und die Knoepfe rechts aus der Karte schiebt. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="md-row" style={{ cursor: 'default', marginBottom: 2 }}>
            <p className="md-section-title" style={{ margin: 0 }}>
              {lauf.profiles?.display_name ?? 'Jemand'}
            </p>
            {eigen && !bearbeiten && (
              <>
                <button
                  type="button"
                  onClick={bearbeitenStarten}
                  disabled={laedtOrt}
                  className="md-plan-item__remove"
                  aria-label="Verabredung bearbeiten"
                >
                  <Icon name="tune" size={20} className="icon-sm" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const err = await deleteRun(lauf.id)
                    showSnackbar(err ? 'Löschen fehlgeschlagen: ' + err : 'Verabredung gelöscht.')
                  }}
                  className="md-plan-item__remove"
                  aria-label="Verabredung löschen"
                >
                  <Icon name="remove" size={20} className="icon-sm" />
                </button>
              </>
            )}
          </div>

          <p style={{ margin: 0, font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            {lauf.city}
          </p>
          <p style={{ margin: '2px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            {zeitpunkt(lauf.starts_at)}
            {' · '}
            {TEMPO_LABEL[lauf.pace]}
            {lauf.distance_km != null && ` · ${String(lauf.distance_km).replace('.', ',')} km`}
          </p>
          {lauf.note && (
            <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>
              {lauf.note}
            </p>
          )}
        </div>
      </div>

      {bearbeiten && (
        <div style={{ marginTop: 'var(--space-sm)' }}>
          <LaufFormular
            start={bearbeiten}
            treffpunktUnbekannt={ortUnbekannt}
            knopf="Änderungen speichern"
            onAbbrechen={() => setBearbeiten(null)}
            onSpeichern={async (daten) => {
              const err = await updateRun(lauf.id, daten)
              if (!err) {
                setBearbeiten(null)
                showSnackbar('Verabredung geändert.')
              }
              return err
            }}
          />
        </div>
      )}


      {eigen && anfragen.length > 0 && (
        <div style={{ marginTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <p style={{ margin: 0, font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            {anfragen.length === 1 ? '1 Anfrage' : `${anfragen.length} Anfragen`}
          </p>
          {anfragen.map((a) => (
            <div key={a.id} className="md-card" style={{ background: 'var(--md-surface-container-high)' }}>
              {/* Auch hier ein Gesicht: Ueber eine Anfrage entscheidet man,
                  ob man sich mit dieser Person trifft. Ein Name allein ist
                  dafuer eine duenne Grundlage. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <Avatar
                  name={a.profiles?.display_name}
                  pfad={a.profiles?.avatar_url}
                  groesse={40}
                  vergroesserbar
                />
                <p style={{ margin: 0, font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
                  {a.profiles?.display_name ?? 'Jemand'}
                </p>
              </div>
              {a.message && (
                <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                  {a.message}
                </p>
              )}
              <div className="md-aktions-zeile md-aktions-zeile--abgesetzt">
                <button
                  type="button"
                  onClick={() => entscheiden(a, false)}
                  className="md-button md-button--outlined md-button--compact"
                >
                  Absagen
                </button>
                <button
                  type="button"
                  onClick={() => entscheiden(a, true)}
                  className="md-button md-button--filled md-button--compact"
                >
                  Zusagen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {chat && (
        <Link
          className="md-button md-button--tonal md-button--compact"
          to={`/chat/lauf/${chat.id}`}
          style={{ width: '100%', marginTop: 'var(--space-sm)', textDecoration: 'none' }}
        >
          <Icon name="chat" size={20} className="icon-sm" />
          Zum Chat
        </Link>
      )}

      {!eigen && !chat && (
        meine ? (
          <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
            {meine.status === 'pending' && 'Anfrage gesendet – warte auf Antwort.'}
            {meine.status === 'declined' && 'Diesmal hat es nicht gepasst.'}
            {meine.status === 'accepted' && 'Zugesagt.'}
          </p>
        ) : formular ? (
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <div className="md-field">
              <label className="md-field__label" htmlFor={`anfrage-${lauf.id}`}>Nachricht (optional)</label>
              <textarea
                className="md-field__input"
                id={`anfrage-${lauf.id}`}
                value={nachricht}
                onChange={(e) => setNachricht(e.target.value)}
                placeholder="Kurz zu dir und deinem Tempo"
                rows={2}
                maxLength={500}
                style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
              />
            </div>
            <div className="md-aktions-zeile">
              <button
                type="button"
                onClick={() => setFormular(false)}
                className="md-button md-button--outlined md-button--compact"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={anfrageSenden}
                className="md-button md-button--filled md-button--compact"
              >
                Anfrage senden
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFormular(true)}
            className="md-button md-button--filled md-button--compact"
            style={{ width: '100%', marginTop: 'var(--space-sm)' }}
          >
            Mitlaufen anfragen
          </button>
        )
      )}
    </article>
  )
}

/** "Sa., 16. Aug., 09:00 Uhr" */
function zeitpunkt(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}

/** Vorgabe fuer das Datumsfeld: morgen, 09:00. */
function morgenFrueh(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  // Ortszeit im Format, das datetime-local erwartet.
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Ein gespeicherter Zeitpunkt (UTC) im Format, das datetime-local erwartet:
 * Ortszeit ohne Zeitzone. toISOString() waere hier falsch – das Feld wuerde
 * dann je nach Zeitzone Stunden danebenliegen.
 */
function alsEingabezeit(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

interface FormularProps {
  onSpeichern: (daten: LaufAenderung) => Promise<string | null>
  onAbbrechen: () => void
  /** Vorbelegung beim Bearbeiten. Fehlt sie, ist es eine neue Verabredung. */
  start?: LaufEingabe
  knopf?: string
  /**
   * Der Treffpunkt konnte nicht gelesen werden.
   *
   * Dann ist das leere Feld keine Aussage: Es bleibt leer, das Speichern
   * bleibt trotzdem moeglich, und der Treffpunkt wird nicht mitgeschickt -
   * sonst ueberschriebe man blind, was man nie gesehen hat.
   */
  treffpunktUnbekannt?: boolean
}

/**
 * Dasselbe Formular fuers Anlegen und fuers Bearbeiten. Zwei getrennte
 * Formulare wuerden bei jeder Aenderung auseinanderlaufen – und die Regeln,
 * was ein gueltiger Zeitpunkt oder eine gueltige Strecke ist, gaebe es dann
 * doppelt.
 */
function LaufFormular({
  onSpeichern,
  onAbbrechen,
  start,
  knopf,
  treffpunktUnbekannt = false,
}: FormularProps) {
  const [stadt, setStadt] = useState(start?.city ?? '')
  const [treffpunkt, setTreffpunkt] = useState(start?.meetingPoint ?? '')
  const [wann, setWann] = useState(start ? alsEingabezeit(start.starts_at) : morgenFrueh())
  const [km, setKm] = useState(start?.distance_km == null ? '' : String(start.distance_km))
  const [tempo, setTempo] = useState<TempoArt>(start?.pace ?? 'easy')
  const [notiz, setNotiz] = useState(start?.note ?? '')
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stadt.trim() || (!treffpunktUnbekannt && !treffpunkt.trim())) return

    const zeit = new Date(wann)
    if (Number.isNaN(zeit.getTime())) {
      setFehler('Bitte Datum und Uhrzeit angeben.')
      return
    }
    if (zeit.getTime() < Date.now()) {
      setFehler('Der Zeitpunkt liegt in der Vergangenheit.')
      return
    }

    const strecke = km.trim() === '' ? null : Number(km.replace(',', '.'))
    if (strecke != null && (!Number.isFinite(strecke) || strecke <= 0 || strecke > 300)) {
      setFehler('Die Strecke muss zwischen 0 und 300 km liegen.')
      return
    }

    setFehler(null)
    setSpeichert(true)
    const err = await onSpeichern({
      city: stadt.trim(),
      // Leer und unbekannt heisst: nicht anfassen.
      meetingPoint:
        treffpunktUnbekannt && !treffpunkt.trim() ? undefined : treffpunkt.trim(),
      starts_at: zeit.toISOString(),
      distance_km: strecke,
      pace: tempo,
      note: notiz.trim() || null,
    })
    setSpeichert(false)
    if (err) setFehler('Speichern fehlgeschlagen: ' + err)
  }

  return (
    <form onSubmit={absenden} className="md-card md-card--outlined">
      <p className="md-section-title">Lauf vorschlagen</p>

      {/* Der wichtigste Hinweis steht vor den Feldern, nicht darunter: Wer
          hier tippt, soll vorher wissen, was sichtbar wird. */}
      <div className="md-info-note md-info-note--neutral" style={{ marginBottom: 'var(--space-sm)' }}>
        <Icon name="shield" size={20} className="icon icon-sm" />
        <p>
          Öffentlich stehen nur Stadt oder Stadtteil, Zeit und Tempo. Den
          genauen Treffpunkt bekommt nur, wem du zusagst – vorher sieht ihn
          niemand.
        </p>
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-stadt">
          Stadt oder Stadtteil <span style={{ color: 'var(--md-on-surface-variant)' }}>(für alle sichtbar)</span>
        </label>
        <input
          className="md-field__input"
          id="lauf-stadt"
          type="text"
          value={stadt}
          onChange={(e) => setStadt(e.target.value)}
          placeholder="z.B. Köln-Ehrenfeld"
          required
        />
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-treffpunkt">
          Genauer Treffpunkt <span style={{ color: 'var(--md-on-surface-variant)' }}>(nur nach deiner Zusage)</span>
        </label>
        <input
          className="md-field__input"
          id="lauf-treffpunkt"
          type="text"
          value={treffpunkt}
          onChange={(e) => setTreffpunkt(e.target.value)}
          placeholder={
            treffpunktUnbekannt
              ? 'Konnte nicht geladen werden – bleibt unverändert'
              : 'z.B. Stadtpark, Nordeingang am Brunnen'
          }
          required={!treffpunktUnbekannt}
        />
        {treffpunktUnbekannt && (
          <p className="md-field__hint md-field__hint--warning">
            Der bisherige Treffpunkt konnte nicht geladen werden. Lässt du das Feld leer,
            bleibt er unverändert.
          </p>
        )}
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-wann">Wann</label>
        <input
          className="md-field__input"
          id="lauf-wann"
          type="datetime-local"
          value={wann}
          onChange={(e) => setWann(e.target.value)}
          required
        />
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-km">Strecke in km (optional)</label>
        <input
          className="md-field__input"
          id="lauf-km"
          type="text"
          inputMode="decimal"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="z.B. 8"
        />
      </div>

      {/* Tempo als Auswahl statt als Zahl: "locker" versteht jeder, eine
          Pace-Angabe in min/km schreckt Anfaenger ab und passt bei einer
          Gruppe ohnehin nie genau. */}
      <div>
        <p style={{ margin: '0 0 4px', font: 'var(--type-label-lg)', color: 'var(--md-on-surface-variant)' }}>
          Tempo
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
          {TEMPO_ARTEN.map((t) => {
            const an = tempo === t.wert
            return (
              <button
                key={t.wert}
                type="button"
                aria-pressed={an}
                onClick={() => setTempo(t.wert)}
                className="md-choice-chip"
                title={t.hinweis}
                style={{
                  cursor: 'pointer',
                  background: an ? 'var(--md-primary)' : 'transparent',
                  color: an ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                  border: `1px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '4px 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          {TEMPO_ARTEN.find((t) => t.wert === tempo)?.hinweis}
        </p>
      </div>

      <div className="md-field">
        <label className="md-field__label" htmlFor="lauf-notiz">Notiz (optional)</label>
        <textarea
          className="md-field__input"
          id="lauf-notiz"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Wer mitkommen will, gern melden"
          rows={2}
          maxLength={500}
          style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
        />
      </div>

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>
      )}

      <div className="md-aktions-zeile">
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={speichert}
          className="md-button md-button--outlined md-button--compact"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={speichert || !stadt.trim() || (!treffpunktUnbekannt && !treffpunkt.trim())}
          className="md-button md-button--filled md-button--compact"
        >
          {speichert ? 'Wird gespeichert…' : (knopf ?? 'Eintragen')}
        </button>
      </div>
    </form>
  )
}
