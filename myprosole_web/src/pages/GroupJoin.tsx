import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useGroups, type Group } from '../store/groups'
import { useAuth } from '../store/auth'

/**
 * Beitritt ueber den Einladungslink.
 *
 * Der Link fuehrt nicht blind in die Gruppe: Die Seite zeigt erst Name und
 * Ziel, dann entscheidet man selbst. Bei einer Gruppe auf Anfrage fuehrt sie
 * weiter zur Gruppenseite, wo die Anfrage samt Fragebogen gestellt wird – der
 * Link umgeht die Beitrittsregel also nicht.
 */
export default function GroupJoin() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const { fetchByToken, join } = useGroups()

  const [gruppe, setGruppe] = useState<Group | null>(null)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState<string | null>(null)
  const [tritt, setTritt] = useState(false)

  useEffect(() => {
    if (!token) return
    fetchByToken(token).then((g) => {
      setGruppe(g)
      setLaedt(false)
    })
  }, [token, fetchByToken])

  if (laedt) return <LoadingSpinner />

  if (!gruppe) {
    return (
      <>
        <p style={{ margin: 'var(--space-lg) 0 var(--space-md)', textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Diesen Einladungslink gibt es nicht mehr. Vielleicht wurde die Gruppe
          aufgelöst oder der Link erneuert.
        </p>
        <Link className="md-button md-button--filled" to="/community/gruppen" style={{ textDecoration: 'none' }}>
          Zu den Gruppen
        </Link>
      </>
    )
  }

  const schonDrin = gruppe.community_group_members.some((m) => m.user_id === user?.id)

  const beitreten = async () => {
    setTritt(true)
    const err = await join(gruppe)
    setTritt(false)
    if (err) {
      setFehler(err)
      return
    }
    navigate(`/community/gruppe/${gruppe.id}`, { replace: true })
  }

  return (
    <>
      <div>
        <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          Du wurdest eingeladen
        </p>
        <h2 style={{ margin: '2px 0 0', font: 'var(--type-title-lg)', color: 'var(--md-on-surface)' }}>
          {gruppe.name}
        </h2>
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

      {fehler && <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>{fehler}</p>}

      {schonDrin ? (
        <Link className="md-button md-button--filled" to={`/community/gruppe/${gruppe.id}`} style={{ textDecoration: 'none' }}>
          Du bist schon dabei – zur Gruppe
        </Link>
      ) : gruppe.join_policy === 'open' ? (
        <button type="button" onClick={beitreten} disabled={tritt} className="md-button md-button--filled">
          {tritt ? 'Trittst bei…' : 'Gruppe beitreten'}
        </button>
      ) : (
        <>
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Diese Gruppe entscheidet über jede Anfrage. Auf der Gruppenseite
            kannst du sie stellen.
          </p>
          <Link className="md-button md-button--filled" to={`/community/gruppe/${gruppe.id}`} style={{ textDecoration: 'none' }}>
            Beitritt anfragen
          </Link>
        </>
      )}
    </>
  )
}
