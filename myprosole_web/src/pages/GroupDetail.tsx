import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useFeed } from '../store/feed'
import { BeitragSchreiben, Beitrag } from './Community'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'
import { useGroups, type Group, type GroupMember, type GroupRequest, type JoinPolicy } from '../store/groups'

/**
 * Eine Gruppe: Ziel, Mitglieder, Beitritt – und fuer Admins der Bereich zum
 * Verwalten.
 *
 * Der Einladungslink steht nur Mitgliedern offen. Sonst koennte ihn jeder
 * weitergeben, und die Beitrittsregel waere umgangen, bevor sie greift.
 */
export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const {
    groups, loading, fetchGroups, join, leave, requestJoin,
    fetchRequests, fetchMembers, decideRequest, removeMember, updateGroup, deleteGroup, setQuestions,
  } = useGroups()

  const [mitglieder, setMitglieder] = useState<GroupMember[]>([])
  const gruppenBeitraege = useFeed((s) => s.posts)
  const fetchPosts = useFeed((s) => s.fetchPosts)
  const [anfragen, setAnfragen] = useState<GroupRequest[]>([])
  const [anfrageOffen, setAnfrageOffen] = useState(false)

  const gruppe = groups.find((g) => g.id === id)
  const eigeneRolle = gruppe?.community_group_members.find((m) => m.user_id === user?.id)?.role
  const istMitglied = eigeneRolle !== undefined
  const istAdmin = eigeneRolle === 'admin'

  useEffect(() => {
    if (groups.length === 0) fetchGroups()
  }, [groups.length, fetchGroups])

  useEffect(() => {
    if (!id || !istMitglied) return
    // Nur als Mitglied laden. Die Zeilenregel wuerde ohnehin nichts
    // herausgeben, aber eine Anfrage, die nichts bringen kann, stellt man
    // gar nicht erst.
    fetchPosts(id)
    fetchMembers(id).then(setMitglieder)
    if (istAdmin) fetchRequests(id).then(setAnfragen)
  }, [id, istMitglied, istAdmin, fetchMembers, fetchRequests, fetchPosts, groups])

  if (loading && !gruppe) return <LoadingSpinner />

  if (!gruppe) {
    return (
      <p style={{ margin: 'var(--space-lg) 0', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
        Gruppe nicht gefunden.
      </p>
    )
  }

  const beitreten = async () => {
    const err = await join(gruppe)
    showSnackbar(err ? 'Beitritt fehlgeschlagen: ' + err : `Willkommen bei ${gruppe.name}.`)
  }

  const austreten = async () => {
    const err = await leave(gruppe.id)
    if (err) {
      showSnackbar('Austritt fehlgeschlagen: ' + err)
      return
    }
    navigate('/community/gruppen', { replace: true })
  }

  const linkTeilen = async () => {
    const link = `${window.location.origin}/community/gruppe/beitreten/${gruppe.invite_token}`
    try {
      await navigator.clipboard.writeText(link)
      showSnackbar('Einladungslink kopiert.')
    } catch {
      showSnackbar(link)
    }
  }

  return (
    <>
      <div>
        <h2 style={{ margin: 0, font: 'var(--type-title-lg)', color: 'var(--md-on-surface)' }}>
          {gruppe.name}
        </h2>
        <p style={{ margin: '4px 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          {gruppe.community_group_members.length}{' '}
          {gruppe.community_group_members.length === 1 ? 'Mitglied' : 'Mitglieder'}
          {' · '}
          {gruppe.join_policy === 'open' ? 'offener Beitritt' : 'Beitritt auf Anfrage'}
        </p>
      </div>

      <section className="md-card">
        <p className="md-section-title">Ziel der Gruppe</p>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface)', whiteSpace: 'pre-wrap' }}>
          {gruppe.goal}
        </p>
        {gruppe.description && (
          <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)', whiteSpace: 'pre-wrap' }}>
            {gruppe.description}
          </p>
        )}
      </section>

      {/* Beitritt */}
      {!istMitglied && (
        gruppe.join_policy === 'open' ? (
          <button type="button" onClick={beitreten} className="md-button md-button--filled">
            Gruppe beitreten
          </button>
        ) : anfrageOffen ? (
          <AnfrageFormular
            gruppe={gruppe}
            onAbbrechen={() => setAnfrageOffen(false)}
            onSenden={async (nachricht, antworten) => {
              const err = await requestJoin(gruppe.id, nachricht, antworten)
              if (!err) {
                setAnfrageOffen(false)
                showSnackbar('Anfrage gesendet. Der Admin entscheidet.')
              }
              return err
            }}
          />
        ) : (
          <button type="button" onClick={() => setAnfrageOffen(true)} className="md-button md-button--filled">
            Beitritt anfragen
          </button>
        )
      )}

      {/* Beitraege der Gruppe – nur fuer Mitglieder.
          Dieselben Bausteine wie im oeffentlichen Feed, nur mit der
          Gruppenkennung. Ein zweiter, nachgebauter Feed wuerde mit der Zeit
          auseinanderlaufen: Was hier fehlt, faellt erst auf, wenn es jemand
          vermisst. */}
      {istMitglied && (
        <section>
          <p className="md-section-title">Beiträge</p>
          <BeitragSchreiben gruppeId={gruppe.id} />

          {gruppenBeitraege.length === 0 ? (
            <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              Noch nichts geteilt. Was hier steht, sehen nur Mitglieder dieser Gruppe.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
              {gruppenBeitraege.map((p) => <Beitrag key={p.id} post={p} />)}
            </div>
          )}
        </section>
      )}

      {/* Mitgliederliste – nur fuer die Gruppe selbst */}
      {istMitglied && (
        <section>
          <p className="md-section-title">Mitglieder</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {mitglieder.map((m) => (
              <div key={m.user_id} className="md-plan-item">
                <div className="md-avatar md-avatar--sm" aria-hidden="true">
                  {m.profiles?.display_name?.trim().charAt(0).toUpperCase() || <Icon name="profile" size={20} className="icon-sm" />}
                </div>
                <span className="md-plan-item__body">
                  {m.profiles?.display_name ?? 'Jemand'}
                  <small>{m.role === 'admin' ? 'Admin' : 'Mitglied'}</small>
                </span>
                {istAdmin && m.user_id !== user?.id && (
                  <button
                    type="button"
                    onClick={async () => {
                      const err = await removeMember(gruppe.id, m.user_id)
                      if (err) showSnackbar('Entfernen fehlgeschlagen: ' + err)
                      else setMitglieder((v) => v.filter((x) => x.user_id !== m.user_id))
                    }}
                    className="md-plan-item__remove"
                    aria-label={`${m.profiles?.display_name ?? 'Mitglied'} entfernen`}
                  >
                    <Icon name="remove" size={20} className="icon-sm" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {istMitglied && (
        <button type="button" onClick={linkTeilen} className="md-button md-button--tonal">
          <Icon name="share" size={20} className="icon-sm" />
          Einladungslink teilen
        </button>
      )}

      {istAdmin && (
        <AdminBereich
          gruppe={gruppe}
          anfragen={anfragen}
          onEntscheiden={async (a, annehmen) => {
            const err = await decideRequest(a, annehmen)
            if (err) {
              showSnackbar('Fehlgeschlagen: ' + err)
              return
            }
            setAnfragen((v) => v.filter((x) => x.id !== a.id))
            showSnackbar(annehmen ? 'Aufgenommen.' : 'Abgelehnt.')
          }}
          onEinstellung={async (daten) => {
            const err = await updateGroup(gruppe.id, daten)
            showSnackbar(err ? 'Speichern fehlgeschlagen: ' + err : 'Gespeichert.')
          }}
          onFragen={async (fragen) => {
            const err = await setQuestions(gruppe.id, fragen)
            showSnackbar(err ? 'Speichern fehlgeschlagen: ' + err : 'Fragen gespeichert.')
          }}
          onAufloesen={async () => {
            const err = await deleteGroup(gruppe.id)
            if (err) {
              showSnackbar('Auflösen fehlgeschlagen: ' + err)
              return
            }
            navigate('/community/gruppen', { replace: true })
          }}
        />
      )}

      {istMitglied && !istAdmin && (
        <button type="button" onClick={austreten} className="md-button md-button--text">
          Gruppe verlassen
        </button>
      )}
    </>
  )
}

function AnfrageFormular({
  gruppe, onSenden, onAbbrechen,
}: {
  gruppe: Group
  onSenden: (nachricht: string | null, antworten: Record<string, string>) => Promise<string | null>
  onAbbrechen: () => void
}) {
  const [nachricht, setNachricht] = useState('')
  const [antworten, setAntworten] = useState<Record<string, string>>({})
  const [fehler, setFehler] = useState<string | null>(null)
  const [sendet, setSendet] = useState(false)

  const fragen = [...gruppe.community_group_questions].sort((a, b) => a.position - b.position)
  const alleBeantwortet = !gruppe.requires_questionnaire
    || fragen.every((f) => (antworten[f.id] ?? '').trim())

  const senden = async () => {
    setSendet(true)
    const err = await onSenden(nachricht.trim() || null, antworten)
    setSendet(false)
    if (err) setFehler(err)
  }

  return (
    <section className="md-card md-card--outlined">
      <p className="md-section-title">Beitritt anfragen</p>

      {gruppe.requires_questionnaire && fragen.length > 0 && (
        <>
          <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Die Gruppe möchte vorher etwas von dir wissen.
          </p>
          {fragen.map((f) => (
            <div className="md-field" key={f.id}>
              <label className="md-field__label" htmlFor={`antwort-${f.id}`}>{f.question}</label>
              <textarea
                className="md-field__input"
                id={`antwort-${f.id}`}
                value={antworten[f.id] ?? ''}
                onChange={(e) => setAntworten((v) => ({ ...v, [f.id]: e.target.value }))}
                rows={2}
                maxLength={1000}
                style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
              />
            </div>
          ))}
        </>
      )}

      <div className="md-field">
        <label className="md-field__label" htmlFor="anfrage-nachricht">Nachricht (optional)</label>
        <textarea
          className="md-field__input"
          id="anfrage-nachricht"
          value={nachricht}
          onChange={(e) => setNachricht(e.target.value)}
          placeholder="Kurz zu dir"
          rows={2}
          maxLength={1000}
          style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
        />
      </div>

      {fehler && <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={onAbbrechen}
          disabled={sendet}
          className="md-button md-button--compact"
          style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={senden}
          disabled={sendet || !alleBeantwortet}
          className="md-button md-button--filled md-button--compact"
          style={{ flex: 1 }}
        >
          {sendet ? 'Wird gesendet…' : 'Anfrage senden'}
        </button>
      </div>
    </section>
  )
}

function AdminBereich({
  gruppe, anfragen, onEntscheiden, onEinstellung, onFragen, onAufloesen,
}: {
  gruppe: Group
  anfragen: GroupRequest[]
  onEntscheiden: (a: GroupRequest, annehmen: boolean) => Promise<void>
  onEinstellung: (daten: { join_policy?: JoinPolicy; requires_questionnaire?: boolean }) => Promise<void>
  onFragen: (fragen: string[]) => Promise<void>
  onAufloesen: () => Promise<void>
}) {
  const [fragen, setFragen] = useState<string[]>(
    [...gruppe.community_group_questions].sort((a, b) => a.position - b.position).map((f) => f.question),
  )
  const [aufloesenBestaetigen, setAufloesenBestaetigen] = useState(false)

  const frageZu = (id: string) =>
    gruppe.community_group_questions.find((f) => f.id === id)?.question ?? 'Frage'

  return (
    <section className="md-card md-card--outlined">
      <p className="md-section-title">Verwaltung</p>

      {/* Anfragen */}
      <div>
        <p style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
          Offene Anfragen ({anfragen.length})
        </p>
        {anfragen.length === 0 ? (
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Keine offenen Anfragen.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {anfragen.map((a) => (
              <div key={a.id} className="md-card" style={{ background: 'var(--md-surface-container-high)' }}>
                <p style={{ margin: 0, font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
                  {a.profiles?.display_name ?? 'Jemand'}
                </p>
                {a.message && (
                  <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                    {a.message}
                  </p>
                )}
                {a.community_group_answers.map((ant) => (
                  <div key={ant.question_id} style={{ marginTop: 'var(--space-sm)' }}>
                    <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
                      {frageZu(ant.question_id)}
                    </p>
                    <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>
                      {ant.answer}
                    </p>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                  <button
                    type="button"
                    onClick={() => onEntscheiden(a, false)}
                    className="md-button md-button--compact"
                    style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
                  >
                    Ablehnen
                  </button>
                  <button
                    type="button"
                    onClick={() => onEntscheiden(a, true)}
                    className="md-button md-button--filled md-button--compact"
                    style={{ flex: 1 }}
                  >
                    Aufnehmen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Einstellungen */}
      <div style={{ marginTop: 'var(--space-md)' }}>
        <p style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
          Beitritt
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
          {(['request', 'open'] as JoinPolicy[]).map((w) => {
            const an = gruppe.join_policy === w
            return (
              <button
                key={w}
                type="button"
                aria-pressed={an}
                onClick={() => onEinstellung({ join_policy: w })}
                className="md-choice-chip"
                style={{
                  cursor: 'pointer',
                  background: an ? 'var(--md-primary)' : 'transparent',
                  color: an ? 'var(--md-on-primary)' : 'var(--md-on-surface)',
                  border: `1px solid ${an ? 'var(--md-primary)' : 'var(--md-outline)'}`,
                }}
              >
                {w === 'open' ? 'Offen mit Link' : 'Nur auf Anfrage'}
              </button>
            )
          })}
        </div>

        {gruppe.join_policy === 'request' && (
          <label className="md-checkbox-row" htmlFor="admin-fragebogen" style={{ marginTop: 'var(--space-sm)' }}>
            <input
              className="md-checkbox__input"
              id="admin-fragebogen"
              type="checkbox"
              checked={gruppe.requires_questionnaire}
              onChange={(e) => onEinstellung({ requires_questionnaire: e.target.checked })}
            />
            <span className="md-checkbox-row__label">Fragen stellen, bevor jemand beitritt</span>
          </label>
        )}
      </div>

      {/* Fragebogen pflegen */}
      {gruppe.join_policy === 'request' && gruppe.requires_questionnaire && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <p style={{ margin: '0 0 var(--space-xs)', font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            Fragen an Beitrittswillige
          </p>
          {fragen.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-end', marginBottom: 'var(--space-xs)' }}>
              <div className="md-field" style={{ flex: 1 }}>
                <label className="md-visually-hidden" htmlFor={`admin-frage-${i}`}>Frage {i + 1}</label>
                <input
                  className="md-field__input"
                  id={`admin-frage-${i}`}
                  type="text"
                  value={f}
                  maxLength={300}
                  onChange={(e) => setFragen((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </div>
              <button
                type="button"
                onClick={() => setFragen((v) => v.filter((_, j) => j !== i))}
                className="md-plan-item__remove"
                aria-label={`Frage ${i + 1} entfernen`}
              >
                <Icon name="remove" size={20} className="icon-sm" />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {fragen.length < 5 && (
              <button
                type="button"
                onClick={() => setFragen((v) => [...v, ''])}
                className="md-button md-button--text md-button--compact"
              >
                <Icon name="plus" size={20} className="icon-sm" />
                Frage
              </button>
            )}
            <button
              type="button"
              onClick={() => onFragen(fragen.map((f) => f.trim()).filter(Boolean))}
              className="md-button md-button--tonal md-button--compact"
            >
              Fragen speichern
            </button>
          </div>
        </div>
      )}

      {/* Aufloesen */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        {aufloesenBestaetigen ? (
          <>
            <p style={{ margin: '0 0 var(--space-sm)', font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>
              Die Gruppe wird mit allen Mitgliedschaften, Anfragen und Fragen
              gelöscht. Das lässt sich nicht rückgängig machen.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={() => setAufloesenBestaetigen(false)}
                className="md-button md-button--compact"
                style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={onAufloesen}
                className="md-button md-button--filled md-button--compact"
                style={{ flex: 1, background: 'var(--md-error)', color: 'var(--md-on-error)' }}
              >
                Endgültig auflösen
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setAufloesenBestaetigen(true)}
            className="md-button md-button--text"
            style={{ color: 'var(--md-error)' }}
          >
            Gruppe auflösen
          </button>
        )}
      </div>
    </section>
  )
}
