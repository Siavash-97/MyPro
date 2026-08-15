import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import CommunityTabs from '../components/community/CommunityTabs'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useAuth } from '../store/auth'
import { useGroups, type Group } from '../store/groups'

/**
 * Gruppenuebersicht (community-gruppen.html).
 *
 * Oben die eigenen Gruppen, darunter die anderen zum Entdecken. Wer keine
 * hat, sieht zuerst den Weg zum Gruenden.
 */
export default function CommunityGroups() {
  const user = useAuth((s) => s.user)
  const { groups, loading, fetchGroups } = useGroups()

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const drin = (g: Group) => g.community_group_members.some((m) => m.user_id === user?.id)
  const meine = groups.filter(drin)
  const andere = groups.filter((g) => !drin(g))

  return (
    <>
      <CommunityTabs />

      {loading && groups.length === 0 ? (
        <LoadingSpinner />
      ) : (
        <>
          <section>
            <p className="md-section-title">Meine Gruppen</p>
            {meine.length === 0 ? (
              <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                Du bist noch in keiner Gruppe. Gründe eine oder tritt unten einer bei.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {meine.map((g) => <GruppenZeile key={g.id} gruppe={g} userId={user?.id} />)}
              </div>
            )}
          </section>

          <section>
            <p className="md-section-title">Gruppen entdecken</p>
            {andere.length === 0 ? (
              <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                Zurzeit gibt es keine weiteren Gruppen.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {andere.map((g) => <GruppenZeile key={g.id} gruppe={g} userId={user?.id} />)}
              </div>
            )}
          </section>
        </>
      )}

      <Link className="md-button md-button--filled" to="/community/gruppe/neu" style={{ textDecoration: 'none' }}>
        <Icon name="plus" size={20} className="icon-sm" />
        Gruppe gründen
      </Link>
    </>
  )
}

function GruppenZeile({ gruppe, userId }: { gruppe: Group; userId?: string }) {
  const admin = gruppe.community_group_members.some((m) => m.user_id === userId && m.role === 'admin')
  return (
    <Link
      to={`/community/gruppe/${gruppe.id}`}
      className="md-list-item"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="md-list-item__thumb">
        <Icon name="people" size={20} className="icon-sm" />
      </div>
      <div className="md-list-item__body">
        <p className="md-list-item__title">
          {gruppe.name}
          {admin && (
            <span style={{ marginLeft: 6, font: 'var(--type-label-md)', color: 'var(--md-primary)' }}>
              Admin
            </span>
          )}
        </p>
        <p className="md-list-item__meta">
          {gruppe.community_group_members.length}{' '}
          {gruppe.community_group_members.length === 1 ? 'Mitglied' : 'Mitglieder'}
          {' · '}
          {gruppe.join_policy === 'open' ? 'offen' : 'auf Anfrage'}
        </p>
      </div>
      <Icon name="chevron-right" className="icon md-row__chevron" />
    </Link>
  )
}
