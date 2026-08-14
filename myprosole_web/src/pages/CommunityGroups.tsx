import Icon from '../components/ui/Icon'
import CommunityTabs from '../components/community/CommunityTabs'
import SearchBar from '../components/ui/SearchBar'
import { useSnackbar } from '../components/ui/Snackbar'
import { useState } from 'react'

/**
 * Gruppen (community-gruppen.html): Laufgruppen finden, beitreten, gruenden.
 */
export default function CommunityGroups() {
  const showSnackbar = useSnackbar()
  const [search, setSearch] = useState('')

  return (
    <>
      <CommunityTabs />

      <SearchBar value={search} onChange={setSearch} placeholder="Gruppe suchen…" />

      <section className="md-card" style={{ textAlign: 'center' }}>
        <div className="md-feature-heading__icon" style={{ margin: '0 auto var(--space-md)' }} aria-hidden="true">
          <Icon name="people" className="icon" />
        </div>
        <p className="md-section-title" style={{ marginBottom: 4 }}>Noch keine Gruppen</p>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Sobald die Community offen ist, findest du hier Laufgruppen in deiner Nähe und
          kannst eigene gründen.
        </p>
      </section>

      <button
        type="button"
        className="md-button md-button--filled"
        onClick={() => showSnackbar('Gruppen gründen kommt mit der Community.')}
      >
        Gruppe gründen
      </button>
      <button
        type="button"
        className="md-button md-button--text"
        onClick={() => showSnackbar('Deine Gruppen erscheinen hier, sobald die Community offen ist.')}
      >
        Meine Gruppen
      </button>
    </>
  )
}
