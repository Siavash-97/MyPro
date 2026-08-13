import { useState, useRef, useEffect } from 'react'

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
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary-container">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" />
              </svg>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium text-on-surface mb-1">Lauf-Coach</h2>
              <p className="text-sm text-on-surface-variant max-w-xs">
                Dein persönlicher KI-Laufcoach. Stelle Fragen zu Training, Technik und Regeneration.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {TIPS.map((tip) => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => setInput(tip)}
                  className="rounded-full border border-outline-variant px-3 py-1.5 text-xs text-on-surface-variant"
                >
                  {tip}
                </button>
              ))}
            </div>
            <p className="text-xs text-on-surface-variant/60 mt-4">
              Vollständige Coach-Integration kommt bald.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'self-end bg-primary text-on-primary rounded-br-md'
                    : 'self-start bg-surface-container text-on-surface rounded-bl-md'
                }`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 pb-4 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center gap-2 rounded-full bg-surface-container px-4 py-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Frage an den Coach..."
            className="flex-1 bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/50"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30"
            aria-label="Senden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
