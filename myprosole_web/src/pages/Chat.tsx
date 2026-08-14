import { useState, useRef, useEffect } from 'react'
import Icon from '../components/ui/Icon'

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

const TIPS = [
  'Wie verbessere ich mein Tempo?',
  'Trainingsplan für 5 km',
  'Aufwärmen vor dem Lauf',
  'Regeneration nach dem Training',
]

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
    }

    const replyMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Der KI-Laufcoach wird bald verfügbar sein. Deine Frage wird dann hier beantwortet.',
    }

    setMessages((prev) => [...prev, userMsg, replyMsg])
    setInput('')
  }

  return (
    // Kompensiert das Padding des md-page-stack der AppShell: Chat-Log und
    // Eingabezeile bringen wie im Mockup ihre eigenen Innenabstände mit und
    // sollen die volle Breite nutzen.
    <div
      className="flex flex-col h-[calc(100dvh-8rem)]"
      style={{ margin: '0 calc(-1 * var(--space-md)) calc(-1 * var(--space-lg))' }}
    >
      <div className="md-chat-log">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5">
            <div className="md-coach-banner__icon" style={{ width: 64, height: 64 }}>
              <Icon name="mic" size={32} />
            </div>
            <div className="text-center">
              <h2 style={{ margin: '0 0 4px', font: 'var(--type-title-md)', color: 'var(--md-on-surface)' }}>
                Lauf-Coach
              </h2>
              <p style={{ margin: '0 auto', maxWidth: 320, font: 'var(--type-body-md)', color: 'var(--md-on-surface-variant)' }}>
                Dein persönlicher KI-Laufcoach. Stelle Fragen zu Training, Technik und Regeneration.
              </p>
            </div>
            <div className="md-chip-set" style={{ justifyContent: 'center' }}>
              {TIPS.map((tip) => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => setInput(tip)}
                  className="md-choice-chip"
                >
                  {tip}
                </button>
              ))}
            </div>
            <p style={{ margin: 'var(--space-md) 0 0', font: 'var(--type-label-md)', color: 'var(--md-on-surface-variant)' }}>
              Vollständige Coach-Integration kommt bald.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`md-chat-bubble ${
                  msg.role === 'user' ? 'md-chat-bubble--user' : 'md-chat-bubble--agent'
                }`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSend()
        }}
        className="md-chat-input-row"
      >
        <input
          className="md-chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frag den Coach zu deinem Lauf"
        />
        <button
          className="md-chat-send"
          type="submit"
          disabled={!input.trim()}
          style={{ opacity: input.trim() ? 1 : 0.4 }}
          aria-label="Senden"
        >
          <Icon name="send" size={20} className="icon-sm" />
        </button>
      </form>
    </div>
  )
}
