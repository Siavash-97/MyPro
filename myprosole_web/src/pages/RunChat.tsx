import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useSnackbar } from '../components/ui/Snackbar'
import { useAuth } from '../store/auth'
import { useChats, type ChatMessage } from '../store/chats'
import { TEMPO_LABEL, type TempoArt } from '../store/communityRuns'

/**
 * Chat zu einer Verabredung – nur fuer die beiden Beteiligten.
 *
 * Hier steht auch der genaue Treffpunkt. Er wird nicht automatisch in den
 * Verlauf geschrieben, sondern oben angezeigt: Er gehoert zur Verabredung,
 * nicht zum Gespraech, und soll nicht zwischen Nachrichten verrutschen.
 *
 * Sprachnachrichten nehmen ueber MediaRecorder auf. Das koennen Chrome auf
 * Android und Safari ab iOS 14.3; wo es fehlt, verschwindet der Knopf, statt
 * beim Antippen zu scheitern.
 */
export default function RunChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const showSnackbar = useSnackbar()
  const user = useAuth((s) => s.user)
  const { chats, fetchChats, fetchMessages, sendText, sendVoice, fetchMeetingPoint } = useChats()

  const [nachrichten, setNachrichten] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [treffpunkt, setTreffpunkt] = useState<string | null>(null)
  const [laedt, setLaedt] = useState(true)
  const endeRef = useRef<HTMLDivElement>(null)

  const chat = chats.find((c) => c.id === id)

  useEffect(() => {
    if (chats.length === 0) fetchChats()
  }, [chats.length, fetchChats])

  useEffect(() => {
    if (!id) return
    let aktiv = true
    const laden = async () => {
      const n = await fetchMessages(id)
      if (aktiv) setNachrichten(n)
      setLaedt(false)
    }
    laden()
    // Einfaches Nachladen alle fuenf Sekunden. Echtzeit ueber Supabase
    // Realtime waere schoener, aber das ist eine eigene Einrichtung – und
    // fuer eine Absprache zu zweit reicht das hier.
    const takt = setInterval(laden, 5000)
    return () => { aktiv = false; clearInterval(takt) }
  }, [id, fetchMessages])

  useEffect(() => {
    if (chat) fetchMeetingPoint(chat.run_id).then(setTreffpunkt)
  }, [chat, fetchMeetingPoint])

  useEffect(() => {
    endeRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [nachrichten.length])

  if (laedt && !chat) return <LoadingSpinner />

  if (!chat) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-4 bg-background text-on-background">
        <p style={{ margin: '0 0 var(--space-md)', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
          Diesen Chat gibt es nicht mehr.
        </p>
        <button type="button" onClick={() => navigate('/profil')} className="md-button md-button--filled md-button--compact">
          Zum Profil
        </button>
      </div>
    )
  }

  const senden = async (inhalt: string, art: 'text' | 'location' = 'text') => {
    if (!inhalt.trim() || !id) return
    const err = await sendText(id, inhalt, art)
    if (err) {
      showSnackbar('Senden fehlgeschlagen: ' + err)
      return
    }
    setText('')
    setNachrichten(await fetchMessages(id))
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-on-background">
      <header className="md-app-bar">
        <button type="button" onClick={() => navigate(-1)} className="md-app-bar__icon-btn" aria-label="Zurück">
          <Icon name="back" className="icon" />
        </button>
        <span className="md-app-bar__title">
          {chat.community_runs?.city ?? 'Verabredung'}
        </span>
      </header>

      {/* Der Treffpunkt steht fest oben, nicht im Verlauf. */}
      <div style={{ padding: '0 var(--space-md)' }}>
        <div className="md-info-note md-info-note--neutral">
          <Icon name="location" size={20} className="icon icon-sm" />
          <p>
            {treffpunkt
              ? <><strong>Treffpunkt:</strong> {treffpunkt}</>
              : 'Treffpunkt wird geladen…'}
            {chat.community_runs && (
              <>
                <br />
                {zeitpunkt(chat.community_runs.starts_at)} ·{' '}
                {TEMPO_LABEL[chat.community_runs.pace as TempoArt]}
                {chat.community_runs.distance_km != null &&
                  ` · ${String(chat.community_runs.distance_km).replace('.', ',')} km`}
              </>
            )}
          </p>
        </div>
      </div>

      <main className="md-page-stack flex-1" style={{ paddingTop: 'var(--space-sm)' }}>
        {nachrichten.length === 0 ? (
          <p style={{ margin: 0, textAlign: 'center', font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
            Noch keine Nachrichten. Sag kurz Hallo.
          </p>
        ) : (
          nachrichten.map((n) => <Blase key={n.id} nachricht={n} eigen={n.user_id === user?.id} />)
        )}
        <div ref={endeRef} />
      </main>

      <div style={{ padding: '0 var(--space-md) var(--space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {treffpunkt && (
          <button
            type="button"
            onClick={() => senden(treffpunkt, 'location')}
            className="md-button md-button--text md-button--compact"
          >
            <Icon name="location" size={20} className="icon-sm" />
            Treffpunkt senden
          </button>
        )}

        <div className="md-chat-input-row">
          <input
            className="md-chat-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') senden(text) }}
            placeholder="Nachricht…"
            maxLength={2000}
          />
          <Aufnahme
            onFertig={async (audio) => {
              if (!id) return
              const err = await sendVoice(id, audio)
              if (err) {
                showSnackbar(err)
                return
              }
              setNachrichten(await fetchMessages(id))
            }}
          />
          <button
            type="button"
            onClick={() => senden(text)}
            disabled={!text.trim()}
            className="md-button md-button--filled md-button--compact"
            aria-label="Senden"
          >
            <Icon name="send" size={20} className="icon-sm" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Blase({ nachricht, eigen }: { nachricht: ChatMessage; eigen: boolean }) {
  const audioAdresse = useChats((s) => s.audioAdresse)
  const [quelle, setQuelle] = useState<string | null>(null)

  useEffect(() => {
    if (nachricht.kind === 'voice' && nachricht.audio_path) {
      audioAdresse(nachricht.audio_path).then(setQuelle)
    }
  }, [nachricht, audioAdresse])

  return (
    <div className={`md-chat-bubble ${eigen ? 'md-chat-bubble--user' : 'md-chat-bubble--agent'}`}>
      {nachricht.kind === 'location' && (
        <p style={{ margin: '0 0 4px', font: 'var(--type-label-md)', opacity: 0.8 }}>
          <Icon name="location" size={16} className="icon-sm" /> Treffpunkt
        </p>
      )}
      {nachricht.kind === 'voice' ? (
        quelle
          ? <audio controls src={quelle} style={{ maxWidth: '100%' }} />
          : <span style={{ opacity: 0.7 }}>Sprachnachricht wird geladen…</span>
      ) : (
        <span style={{ whiteSpace: 'pre-wrap' }}>{nachricht.body}</span>
      )}
    </div>
  )
}

/** Aufnahmeknopf. Halten nimmt auf, Loslassen sendet. */
function Aufnahme({ onFertig }: { onFertig: (audio: Blob) => Promise<void> }) {
  const [laeuft, setLaeuft] = useState(false)
  const [moeglich] = useState(
    () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  )
  const recorderRef = useRef<MediaRecorder | null>(null)
  const teileRef = useRef<Blob[]>([])

  if (!moeglich) return null

  const start = async () => {
    try {
      const spur = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(spur)
      teileRef.current = []
      r.ondataavailable = (e) => { if (e.data.size) teileRef.current.push(e.data) }
      r.onstop = async () => {
        spur.getTracks().forEach((t) => t.stop())
        const audio = new Blob(teileRef.current, { type: r.mimeType || 'audio/webm' })
        if (audio.size > 0) await onFertig(audio)
      }
      r.start()
      recorderRef.current = r
      setLaeuft(true)
    } catch {
      // Zugriff verweigert oder kein Mikrofon – der Knopf tut dann nichts.
      setLaeuft(false)
    }
  }

  const stop = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setLaeuft(false)
  }

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        // Den Zeiger am Knopf festhalten: Sonst gehen die folgenden
        // Ereignisse an das Element unter dem Finger, sobald er beim Halten
        // ein wenig verrutscht – und das Loslassen kommt hier nie an.
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={stop}
      // pointercancel ist der eigentliche Grund, warum das Halten nicht
      // funktionierte. Der Browser bricht die Zeigerfolge ab, sobald er die
      // Beruehrung als Textmarkieren oder als langes Druecken deutet – dann
      // kommt kein pointerup mehr, und die Aufnahme lief endlos weiter.
      onPointerCancel={() => laeuft && stop()}
      onPointerLeave={() => laeuft && stop()}
      // Ohne contextmenu-Sperre oeffnet ein langes Druecken auf dem Telefon
      // das Systemmenue mitten in der Aufnahme.
      onContextMenu={(e) => e.preventDefault()}
      aria-label={laeuft ? 'Aufnahme läuft, loslassen zum Senden' : 'Sprachnachricht aufnehmen'}
      className="md-button md-button--compact"
      style={{
        border: `1px solid ${laeuft ? 'var(--md-error)' : 'var(--md-outline)'}`,
        background: laeuft ? 'var(--md-error)' : 'transparent',
        color: laeuft ? 'var(--md-on-error)' : 'var(--md-on-surface-variant)',
        // Der Browser soll die Beruehrung nicht als Wischen oder Markieren
        // deuten – sie gehoert ganz diesem Knopf.
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <Icon name="mic" size={20} className="icon-sm" />
    </button>
  )
}

function zeitpunkt(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
}
