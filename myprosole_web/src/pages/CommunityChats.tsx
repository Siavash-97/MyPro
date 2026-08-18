import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useChats } from '../store/chats'
import { hatNeues } from '../lib/chatGelesen'
import Icon from '../components/ui/Icon'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSnackbar } from '../components/ui/Snackbar'

/**
 * Anfragen und Chats an einem Ort.
 *
 * Lag vorher im Profil. Dort sucht es niemand: Ein Chat entsteht aus einer
 * Verabredung, und die lebt in der Community. Jetzt haengt es an der
 * Kopfleiste der Community-Seiten, mit einem Punkt, sobald etwas offen ist.
 *
 * Die Anfragen stehen oben, weil sie eine Entscheidung verlangen – ein Chat
 * wartet, eine Anfrage nicht.
 */
export default function CommunityChats() {
  const {
    chats, offeneAnfragen, letzteNachricht, loading,
    fetchChats, fetchUebersicht, decide,
  } = useChats()
  const showSnackbar = useSnackbar()

  useEffect(() => {
    fetchChats()
    fetchUebersicht()
  }, [fetchChats, fetchUebersicht])

  if (loading && chats.length === 0) return <LoadingSpinner />

  const nichts = offeneAnfragen.length === 0 && chats.length === 0

  return (
    <>
      {offeneAnfragen.length > 0 && (
        <section>
          <p className="md-section-title">
            {offeneAnfragen.length === 1 ? '1 Anfrage' : `${offeneAnfragen.length} Anfragen`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {offeneAnfragen.map((a) => (
              <div key={a.id} className="md-card">
                <p style={{ margin: 0, font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
                  {a.profiles?.display_name ?? 'Jemand'}
                </p>
                {a.message && (
                  <p style={{ margin: '4px 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                    {a.message}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                  <button
                    type="button"
                    className="md-button md-button--compact"
                    style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
                    onClick={async () => {
                      const err = await decide(a, false)
                      showSnackbar(err ? 'Fehlgeschlagen: ' + err : 'Abgelehnt')
                      if (!err) fetchUebersicht()
                    }}
                  >
                    Ablehnen
                  </button>
                  <button
                    type="button"
                    className="md-button md-button--filled md-button--compact"
                    style={{ flex: 1 }}
                    onClick={async () => {
                      const err = await decide(a, true)
                      showSnackbar(err ? 'Fehlgeschlagen: ' + err : 'Zugesagt – der Chat ist offen')
                      if (!err) { fetchUebersicht(); fetchChats() }
                    }}
                  >
                    Zusagen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="md-section-title">Meine Chats</p>
        {chats.length === 0 ? (
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Sobald du jemandem zusagst oder eine Zusage bekommst, erscheint hier ein Chat.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {chats.map((c) => {
              const neu = hatNeues(c.id, letzteNachricht[c.id])
              return (
                <Link
                  key={c.id}
                  to={`/chat/lauf/${c.id}`}
                  className="md-plan-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="md-avatar md-avatar--sm" aria-hidden="true">
                    <Icon name="chat" size={20} className="icon-sm" />
                  </div>
                  <span className="md-plan-item__body">
                    {c.community_runs?.city ?? 'Verabredung'}
                    <small>
                      {c.community_runs?.starts_at
                        ? new Date(c.community_runs.starts_at).toLocaleString('de-DE', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })
                        : ''}
                    </small>
                  </span>
                  {/* Der Punkt sagt nur "da ist etwas Neues" – nicht wie viel.
                      Eine Zahl waere hier eine Genauigkeit, die wir nicht
                      haben: Gezaehlt wird nach dem letzten Oeffnen, nicht
                      nach dem letzten Lesen. */}
                  {neu && (
                    <span
                      aria-label="Neue Nachricht"
                      style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: 'var(--md-primary)', flexShrink: 0,
                      }}
                    />
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {nichts && (
        <div className="md-info-note md-info-note--neutral">
          <Icon name="info" size={20} className="icon icon-sm" />
          <p>
            Hier sammeln sich Anfragen zu deinen Läufen und die Chats, die daraus
            entstehen. Den genauen Treffpunkt siehst du erst im Chat – erst nach einer
            Zusage.
          </p>
        </div>
      )}
    </>
  )
}
