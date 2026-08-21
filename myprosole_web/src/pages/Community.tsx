import { useEffect, useRef, useState } from 'react'
import MeldenBlatt from '../components/ui/MeldenBlatt'
import Icon from '../components/ui/Icon'
import Bildergalerie from '../components/community/Bildergalerie'
import CommunityTabs from '../components/community/CommunityTabs'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'
import { useFeed, bildAdresse, type FeedPost, type FeedComment } from '../store/feed'
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

export function BeitragSchreiben({ gruppeId = null }: { gruppeId?: string | null }) {
  const profile = useAuth((s) => s.profile)
  const createPost = useFeed((s) => s.createPost)
  const initial = profile?.display_name?.trim().charAt(0).toUpperCase() ?? ''

  const [offen, setOffen] = useState(false)
  const [text, setText] = useState('')
  const [bilder, setBilder] = useState<File[]>([])
  const [vorschauen, setVorschauen] = useState<string[]>([])
  const [sendet, setSendet] = useState(false)
  // Der Fehler bleibt im Formular stehen, statt als Kurzeinblendung zu
  // verschwinden. Ein Beitrag, der nicht ankommt, ist zu wichtig, um ihn zu
  // uebersehen – und der Text bleibt erhalten, sodass nichts verloren geht.
  const [fehler, setFehler] = useState<string | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)
  const kameraRef = useRef<HTMLInputElement>(null)

  // Die Vorschau-Adressen muessen wieder freigegeben werden, sonst haelt der
  // Browser die Dateien im Speicher, bis die Seite neu geladen wird.
  const bildHinzu = (datei: File | null) => {
    if (!datei) return
    // Fuenf ist die Grenze, wie im Community-Profil. Mehr passt weder in
    // eine Galerie noch in die Aufmerksamkeit der Lesenden.
    if (bilder.length >= 5) {
      setFehler('Mehr als fünf Bilder gehen nicht.')
      return
    }
    setBilder((v) => [...v, datei])
    setVorschauen((v) => [...v, URL.createObjectURL(datei)])
  }

  const bildWeg = (i: number) => {
    URL.revokeObjectURL(vorschauen[i])
    setBilder((v) => v.filter((_, k) => k !== i))
    setVorschauen((v) => v.filter((_, k) => k !== i))
  }

  const alleWeg = () => {
    vorschauen.forEach((a) => URL.revokeObjectURL(a))
    setBilder([])
    setVorschauen([])
  }

  const senden = async () => {
    if (!text.trim() && bilder.length === 0) return
    setSendet(true)
    setFehler(null)
    const err = await createPost(text, bilder, gruppeId)
    setSendet(false)
    if (err) {
      setFehler(err)
      return
    }
    setText('')
    alleWeg()
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
            {gruppeId ? 'In der Gruppe teilen…' : 'Frage stellen oder Lauf teilen…'}
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

      {/* Dieselbe Galerie wie beim fertigen Beitrag. Vorher standen die
          Bilder hier untereinander und in Originalhoehe – der Beitrag sah
          in der Vorschau ganz anders aus als nach dem Teilen. */}
      <Bildergalerie
        bilder={vorschauen.map((adresse) => ({ id: adresse, url: adresse }))}
        bearbeitbar
        onEntfernen={(g) => bildWeg(vorschauen.indexOf(g.id))}
      />

      <input
        ref={dateiRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { bildHinzu(e.target.files?.[0] ?? null); e.target.value = '' }}
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
        onChange={(e) => { bildHinzu(e.target.files?.[0] ?? null); e.target.value = '' }}
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
          {bilder.length ? 'Weiteres Bild' : 'Aus Galerie'}
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
          onClick={() => { setOffen(false); setText(''); alleWeg(); setFehler(null) }}
          disabled={sendet}
          className="md-button md-button--compact"
          style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={senden}
          disabled={sendet || (!text.trim() && bilder.length === 0)}
          className="md-button md-button--filled md-button--compact"
          style={{ flex: 1 }}
        >
          {sendet ? 'Wird geteilt…' : 'Teilen'}
        </button>
      </div>
    </section>
  )
}

export function Beitrag({ post }: { post: FeedPost }) {
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const { toggleReaktion, deletePost, updatePost, removeBild } = useFeed()
  const [kommentarOffen, setKommentarOffen] = useState(false)
  const [bearbeitet, setBearbeitet] = useState(false)
  const [entwurf, setEntwurf] = useState(post.body ?? '')
  const [meldenOffen, setMeldenOffen] = useState(false)
  const [neueBilder, setNeueBilder] = useState<File[]>([])
  const [speichert, setSpeichert] = useState(false)
  const nachtragRef = useRef<HTMLInputElement>(null)

  const eigen = post.user_id === user?.id
  const geliked = post.community_post_likes.some((l) => l.user_id === user?.id)
  const ausgezeichnet = post.community_post_awards.some((a) => a.user_id === user?.id)

  const bilder = post.community_post_images
    .slice()
    .sort((a, b) => a.position - b.position)

  const bearbeitenStarten = () => {
    setEntwurf(post.body ?? '')
    setNeueBilder([])
    setBearbeitet(true)
  }

  const speichern = async () => {
    setSpeichert(true)
    const err = await updatePost(post.id, entwurf, neueBilder)
    setSpeichert(false)
    if (err) {
      showSnackbar('Änderung konnte nicht gespeichert werden: ' + err)
      return
    }
    setNeueBilder([])
    setBearbeitet(false)
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
        {eigen && !bearbeitet && (
          <>
            <button
              type="button"
              onClick={bearbeitenStarten}
              className="md-plan-item__remove"
              aria-label="Beitrag bearbeiten"
            >
              <Icon name="tune" size={20} className="icon-sm" />
            </button>
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
          </>
        )}
        {!eigen && (
          <button
            type="button"
            onClick={() => setMeldenOffen(true)}
            className="md-plan-item__remove"
            aria-label="Beitrag melden"
          >
            <Icon name="more" size={20} className="icon-sm" />
          </button>
        )}
      </div>

      <MeldenBlatt
        offen={meldenOffen}
        onSchliessen={() => setMeldenOffen(false)}
        art="beitrag"
        zielId={post.id}
        onFertig={showSnackbar}
      />

      {bearbeitet ? (
        <div className="md-field" style={{ marginTop: 'var(--space-sm)' }}>
          <label className="md-field__label" htmlFor={`bearbeiten-${post.id}`}>Text</label>
          <textarea
            className="md-field__input"
            id={`bearbeiten-${post.id}`}
            value={entwurf}
            onChange={(e) => setEntwurf(e.target.value)}
            rows={4}
            maxLength={2000}
            style={{ height: 'auto', padding: 'var(--space-sm) var(--space-md)', resize: 'none' }}
          />
        </div>
      ) : (
        post.body && (
          <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface)', whiteSpace: 'pre-wrap' }}>
            {post.body}
          </p>
        )
      )}

      {/* Eine Galerie zum Wischen statt einer langen Reihe untereinander:
          Fuenf Bilder untereinander machten aus einem Beitrag eine Tapete,
          durch die alle anderen hindurchscrollen mussten. */}
      <Bildergalerie
        bilder={bilder.map((b) => ({ id: b.id, url: bildAdresse(b.path) }))}
        bearbeitbar={bearbeitet}
        onEntfernen={async (g) => {
          const b = bilder.find((x) => x.id === g.id)
          if (!b) return
          const err = await removeBild(b)
          if (err) showSnackbar('Bild konnte nicht entfernt werden: ' + err)
        }}
      />

      {bearbeitet && (
        <>
          {neueBilder.length > 0 && (
            <p style={{ margin: 'var(--space-sm) 0 0', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
              {neueBilder.length} neues Bild wird beim Speichern hinzugefügt.
            </p>
          )}
          <input
            ref={nachtragRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const d = e.target.files?.[0]
              if (d) setNeueBilder((v) => [...v, d])
              e.target.value = ''
            }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
            <button
              type="button"
              onClick={() => nachtragRef.current?.click()}
              className="md-button md-button--text md-button--compact"
            >
              <Icon name="image" size={20} className="icon-sm" />
              Bild hinzufügen
            </button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
            <button
              type="button"
              onClick={() => { setBearbeitet(false); setNeueBilder([]) }}
              disabled={speichert}
              className="md-button md-button--compact"
              style={{ flex: 1, border: '1px solid var(--md-outline)', background: 'transparent', color: 'var(--md-on-surface)' }}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={speichern}
              disabled={speichert}
              className="md-button md-button--filled md-button--compact"
              style={{ flex: 1 }}
            >
              {speichert ? 'Wird gespeichert…' : 'Speichern'}
            </button>
          </div>
        </>
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

      {kommentarOffen && <Kommentare post={post} />}

    </article>
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
  // ein zweiter Like aussehen. Der Wert kommt aus --md-gold, weil Gold auf
  // hellem Grund dunkler sein muss als auf dunklem, um lesbar zu bleiben.
  const farbe = gold ? 'var(--md-gold)' : 'var(--md-primary)'
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

/**
 * Kommentare zu einem Beitrag – eine Ebene tief, wie bei Instagram.
 *
 * Antworten haengen an einem Hauptkommentar. Eine Antwort auf eine Antwort
 * haengt am selben Hauptkommentar; der Store sorgt dafuer. Sonst entstuenden
 * Baeume, die auf einem Telefon nicht mehr lesbar sind.
 */
function Kommentare({ post }: { post: FeedPost }) {
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const { addComment, deleteComment, toggleCommentLike } = useFeed()

  const [text, setText] = useState('')
  const [antwortAuf, setAntwortAuf] = useState<FeedComment | null>(null)
  const [sendet, setSendet] = useState(false)

  const alle = post.community_post_comments
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const haupt = alle.filter((k) => !k.parent_id)
  const antwortenZu = (id: string) => alle.filter((k) => k.parent_id === id)

  const senden = async () => {
    if (!text.trim()) return
    setSendet(true)
    const err = await addComment(post.id, text, antwortAuf?.id ?? null)
    setSendet(false)
    if (err) {
      showSnackbar('Kommentar konnte nicht gespeichert werden: ' + err)
      return
    }
    setText('')
    setAntwortAuf(null)
  }

  return (
    <div style={{ marginTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {haupt.map((k) => (
        <div key={k.id}>
          <EinKommentar
            kommentar={k}
            eigenerNutzer={user?.id}
            onAntworten={() => setAntwortAuf(k)}
            onLiken={() => toggleCommentLike(k.id)}
            onLoeschen={() => deleteComment(k.id)}
          />
          {/* Antworten eingerueckt, damit die Zuordnung ohne Linie erkennbar ist. */}
          {antwortenZu(k.id).map((a) => (
            <div key={a.id} style={{ marginLeft: 'var(--space-lg)', marginTop: 'var(--space-sm)' }}>
              <EinKommentar
                kommentar={a}
                eigenerNutzer={user?.id}
                onAntworten={() => setAntwortAuf(k)}
                onLiken={() => toggleCommentLike(a.id)}
                onLoeschen={() => deleteComment(a.id)}
              />
            </div>
          ))}
        </div>
      ))}

      {antwortAuf && (
        <div className="md-row" style={{ cursor: 'default', gap: 'var(--space-sm)' }}>
          <span style={{ font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
            Antwort an {antwortAuf.profiles?.display_name ?? 'Jemand'}
          </span>
          <button
            type="button"
            onClick={() => setAntwortAuf(null)}
            className="md-button md-button--text md-button--compact"
          >
            Abbrechen
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <input
          className="md-field__input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') senden() }}
          placeholder={antwortAuf ? 'Deine Antwort…' : 'Kommentieren…'}
          maxLength={1000}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={senden}
          disabled={sendet || !text.trim()}
          className="md-button md-button--filled md-button--compact"
          aria-label="Absenden"
        >
          <Icon name="send" size={20} className="icon-sm" />
        </button>
      </div>
    </div>
  )
}

function EinKommentar({
  kommentar, eigenerNutzer, onAntworten, onLiken, onLoeschen,
}: {
  kommentar: FeedComment
  eigenerNutzer?: string
  onAntworten: () => void
  onLiken: () => void
  onLoeschen: () => void
}) {
  const likes = kommentar.community_comment_likes ?? []
  const geliked = likes.some((l) => l.user_id === eigenerNutzer)

  return (
    <div className="md-row" style={{ cursor: 'default', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
          {kommentar.profiles?.display_name ?? 'Jemand'} · {zeitpunkt(kommentar.created_at)}
        </p>
        <p style={{ margin: 0, font: 'var(--type-body-md)', color: 'var(--md-on-surface)' }}>
          {kommentar.body}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 2 }}>
          <button
            type="button"
            onClick={onLiken}
            className="md-button md-button--text md-button--compact"
            aria-pressed={geliked}
            style={{ color: geliked ? 'var(--md-primary)' : 'var(--md-on-surface-variant)' }}
          >
            <Icon name="check" size={16} className="icon-sm" />
            {likes.length > 0 ? likes.length : 'Gefällt mir'}
          </button>
          <button
            type="button"
            onClick={onAntworten}
            className="md-button md-button--text md-button--compact"
            style={{ color: 'var(--md-on-surface-variant)' }}
          >
            Antworten
          </button>
        </div>
      </div>
      {kommentar.user_id === eigenerNutzer && (
        <button
          type="button"
          onClick={onLoeschen}
          className="md-plan-item__remove"
          aria-label="Kommentar löschen"
        >
          <Icon name="remove" size={20} className="icon-sm" />
        </button>
      )}
    </div>
  )
}
