import { useEffect, useRef, useState } from 'react'
import Icon from '../components/ui/Icon'
import CommunityTabs from '../components/community/CommunityTabs'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'
import { useFeed, bildAdresse, type FeedPost } from '../store/feed'
import LoadingSpinner from '../components/ui/LoadingSpinner'

/**
 * Community-Feed (community.html).
 *
 * Beitraege mit Text und Bild, dazu drei Reaktionen: Like, Kommentar und
 * Goldmedaille. Die Medaille ist absichtlich getrennt vom Like – sie soll
 * spaeter Vergunstigungen ausloesen, und dabei darf nichts mitgezaehlt
 * werden, was keine ist.
 */
export default function Community() {
  const { posts, loading, fehler, fetchPosts } = useFeed()

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return (
    <>
      <CommunityTabs />

      <BeitragSchreiben />

      {/* Ein Ladefehler darf nicht wie ein leerer Feed aussehen. */}
      {fehler && (
        <div
          style={{
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--md-error-container)',
            color: 'var(--md-on-error-container)',
            font: 'var(--type-body-md)',
          }}
        >
          Der Feed lässt sich gerade nicht laden: {fehler}
        </div>
      )}

      {loading && posts.length === 0 ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <section className="md-card" style={{ textAlign: 'center' }}>
          <div className="md-feature-heading__icon" style={{ margin: '0 auto var(--space-md)' }} aria-hidden="true">
            <Icon name="people" className="icon" />
          </div>
          <p className="md-section-title" style={{ marginBottom: 4 }}>Noch keine Beiträge</p>
          <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Schreib den ersten – teil einen Lauf oder stell eine Frage.
          </p>
        </section>
      ) : (
        posts.map((p) => <Beitrag key={p.id} post={p} />)
      )}
    </>
  )
}

function BeitragSchreiben() {
  const profile = useAuth((s) => s.profile)
  const createPost = useFeed((s) => s.createPost)
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase() ?? ''

  const [offen, setOffen] = useState(false)
  const [text, setText] = useState('')
  const [bild, setBild] = useState<File | null>(null)
  const [vorschau, setVorschau] = useState<string | null>(null)
  const [sendet, setSendet] = useState(false)
  // Der Fehler bleibt im Formular stehen, statt als Kurzeinblendung zu
  // verschwinden. Ein Beitrag, der nicht ankommt, ist zu wichtig, um ihn zu
  // uebersehen – und der Text bleibt erhalten, sodass nichts verloren geht.
  const [fehler, setFehler] = useState<string | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)

  const bildWaehlen = (datei: File | null) => {
    if (vorschau) URL.revokeObjectURL(vorschau)
    setBild(datei)
    setVorschau(datei ? URL.createObjectURL(datei) : null)
  }

  const senden = async () => {
    if (!text.trim() && !bild) return
    setSendet(true)
    setFehler(null)
    const err = await createPost(text, bild)
    setSendet(false)
    if (err) {
      setFehler(err)
      return
    }
    setText('')
    bildWaehlen(null)
    setOffen(false)
  }

  if (!offen) {
    return (
      <button
        type="button"
        className="md-card md-row"
        onClick={() => setOffen(true)}
        style={{ width: '100%', border: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
      >
        <div className="md-row" style={{ gap: 'var(--space-sm)', justifyContent: 'flex-start' }}>
          <div className="md-avatar md-avatar--sm" aria-hidden="true">
            {initial || <Icon name="profile" size={20} className="icon-sm" />}
          </div>
          <span style={{ font: 'var(--type-body-lg)', color: 'var(--md-on-surface-variant)' }}>
            Frage stellen oder Lauf teilen…
          </span>
        </div>
        <Icon name="photo" size={20} className="icon-sm" style={{ color: 'var(--md-on-surface-variant)' }} />
      </button>
    )
  }

  return (
    <section className="md-card md-card--outlined">
      <div className="md-field">
        <label className="md-field__label" htmlFor="beitrag-text">Dein Beitrag</label>
        <textarea
          className="md-field__input"
          id="beitrag-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Wie war dein Lauf? Was beschäftigt dich?"
          rows={4}
          maxLength={2000}
          style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
        />
      </div>

      {vorschau && (
        <div className="md-map" style={{ lineHeight: 0, position: 'relative' }}>
          <img src={vorschau} alt="Vorschau deines Bildes" style={{ display: 'block', width: '100%', height: 'auto' }} />
          <button
            type="button"
            onClick={() => bildWaehlen(null)}
            aria-label="Bild entfernen"
            style={{
              position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: '50%',
              border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--md-scrim)', color: 'var(--md-on-scrim)',
            }}
          >
            <Icon name="remove" size={20} className="icon-sm" />
          </button>
        </div>
      )}

      <input
        ref={dateiRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => bildWaehlen(e.target.files?.[0] ?? null)}
      />
      {/* "capture" oeffnet direkt die Kamera statt der Galerie. Zwei
          getrennte Felder, weil ein einzelnes entweder das eine oder das
          andere kann – nicht beides zur Wahl. */}
      <input
        ref={kameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => bildWaehlen(e.target.files?.[0] ?? null)}
      />

      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => kameraRef.current?.click()}
          className="md-button md-button--text md-button--compact"
        >
          <Icon name="photo" size={20} className="icon-sm" />
          Foto aufnehmen
        </button>
        <button
          type="button"
          onClick={() => dateiRef.current?.click()}
          className="md-button md-button--text md-button--compact"
        >
          <Icon name="image" size={20} className="icon-sm" />
          {bild ? 'Anderes wählen' : 'Aus Galerie'}
        </button>
      </div>

      {fehler && (
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-error)' }}>
          Beitrag konnte nicht gespeichert werden: {fehler}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          type="button"
          onClick={() => { setOffen(false); setText(''); bildWaehlen(null); setFehler(null) }}
          disabled={sendet}
          className="md-button md-button--compact"
          style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={senden}
          disabled={sendet || (!text.trim() && !bild)}
          className="md-button md-button--filled md-button--compact"
          style={{ flex: 1 }}
        >
          {sendet ? 'Wird geteilt…' : 'Teilen'}
        </button>
      </div>
    </section>
  )
}

function Beitrag({ post }: { post: FeedPost }) {
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const { toggleReaktion, addComment, deleteComment, deletePost } = useFeed()
  const [kommentarOffen, setKommentarOffen] = useState(false)
  const [kommentar, setKommentar] = useState('')

  const eigen = post.user_id === user?.id
  const geliked = post.community_post_likes.some((l) => l.user_id === user?.id)
  const ausgezeichnet = post.community_post_awards.some((a) => a.user_id === user?.id)

  const kommentieren = async () => {
    if (!kommentar.trim()) return
    const err = await addComment(post.id, kommentar)
    if (err) {
      showSnackbar('Kommentar konnte nicht gespeichert werden: ' + err)
      return
    }
    setKommentar('')
  }

  return (
    <article className="md-card">
      <div className="md-row" style={{ cursor: 'default', gap: 'var(--space-sm)', justifyContent: 'flex-start' }}>
        <div className="md-avatar md-avatar--sm" aria-hidden="true">
          {post.profiles?.display_name?.trim().charAt(0).toUpperCase() || <Icon name="profile" size={20} className="icon-sm" />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, font: 'var(--type-label-lg)', color: 'var(--md-on-surface)' }}>
            {post.profiles?.display_name ?? 'Jemand'}
          </p>
          <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
            {zeitpunkt(post.created_at)}
          </p>
        </div>
        {eigen && (
          <button
            type="button"
            onClick={async () => {
              const err = await deletePost(post)
              if (err) showSnackbar('Löschen fehlgeschlagen: ' + err)
            }}
            className="md-plan-item__remove"
            aria-label="Beitrag löschen"
          >
            <Icon name="remove" size={20} className="icon-sm" />
          </button>
        )}
      </div>

      {post.body && (
        <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface)', whiteSpace: 'pre-wrap' }}>
          {post.body}
        </p>
      )}

      {post.image_path && (
        <BeitragsBild pfad={post.image_path} />
      )}

      <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-sm)' }}>
        <Reaktion
          icon="check"
          an={geliked}
          anzahl={post.community_post_likes.length}
          label="Gefällt mir"
          onClick={() => toggleReaktion(post.id, 'like')}
        />
        <Reaktion
          icon="sparkles"
          an={ausgezeichnet}
          anzahl={post.community_post_awards.length}
          label="Goldmedaille"
          gold
          onClick={() => toggleReaktion(post.id, 'award')}
        />
        <Reaktion
          icon="chat"
          an={kommentarOffen}
          anzahl={post.community_post_comments.length}
          label="Kommentare"
          onClick={() => setKommentarOffen((v) => !v)}
        />
      </div>

      {kommentarOffen && (
        <div style={{ marginTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {post.community_post_comments
            .slice()
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((k) => (
              <div key={k.id} className="md-row" style={{ cursor: 'default', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
                    {k.profiles?.display_name ?? 'Jemand'} · {zeitpunkt(k.created_at)}
                  </p>
                  <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>{k.body}</p>
                </div>
                {k.user_id === user?.id && (
                  <button
                    type="button"
                    onClick={() => deleteComment(k.id)}
                    className="md-plan-item__remove"
                    aria-label="Kommentar löschen"
                  >
                    <Icon name="remove" size={20} className="icon-sm" />
                  </button>
                )}
              </div>
            ))}

          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <input
              className="md-field__input"
              type="text"
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') kommentieren() }}
              placeholder="Antworten…"
              maxLength={1000}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={kommentieren}
              disabled={!kommentar.trim()}
              className="md-button md-button--filled md-button--compact"
            >
              <Icon name="send" size={20} className="icon-sm" />
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

/**
 * Bild eines Beitrags. Laedt es nicht, steht dort ein Hinweis statt einer
 * leeren Flaeche – sonst sieht es aus, als waere der Beitrag kaputt.
 */
function BeitragsBild({ pfad }: { pfad: string }) {
  const [fehlt, setFehlt] = useState(false)

  if (fehlt) {
    return (
      <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
        Das Bild zu diesem Beitrag lässt sich gerade nicht laden.
      </p>
    )
  }

  return (
    <div className="md-map" style={{ lineHeight: 0, marginTop: 'var(--space-sm)' }}>
      <img
        src={bildAdresse(pfad)}
        alt=""
        loading="lazy"
        onError={() => setFehlt(true)}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />
    </div>
  )
}

function Reaktion({
  icon, an, anzahl, label, onClick, gold = false,
}: {
  icon: string
  an: boolean
  anzahl: number
  label: string
  onClick: () => void
  gold?: boolean
}) {
  // Gold hebt sich bewusst von der App-Farbe ab: Die Medaille soll nicht wie
  // ein zweiter Like aussehen.
  const farbe = gold ? '#D9A441' : 'var(--md-primary)'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={an}
      aria-label={`${label}${anzahl > 0 ? `, ${anzahl}` : ''}`}
      className="md-button md-button--compact"
      style={{
        flex: 1,
        cursor: 'pointer',
        gap: 6,
        background: an ? `color-mix(in srgb, ${farbe} 18%, transparent)` : 'transparent',
        color: an ? farbe : 'var(--md-on-surface-variant)',
        border: `1px solid ${an ? farbe : 'var(--md-outline)'}`,
      }}
    >
      <Icon name={icon} size={20} className="icon-sm" />
      {anzahl > 0 && anzahl}
    </button>
  )
}

/** "vor 3 Min." bis hinunter zum Datum. */
function zeitpunkt(iso: string): string {
  const minuten = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minuten < 1) return 'gerade eben'
  if (minuten < 60) return `vor ${minuten} Min.`
  if (minuten < 1440) return `vor ${Math.floor(minuten / 60)} Std.`
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}
