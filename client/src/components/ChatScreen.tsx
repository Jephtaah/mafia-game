import { useState, useRef, useEffect } from 'react'

interface ChatMessage {
  playerId: string
  name: string
  text: string
}

interface ChatScreenProps {
  messages: ChatMessage[]
  isAlive: boolean
  onSend: (text: string) => void
  timer: number
}

export default function ChatScreen({ messages, isAlive, onSend, timer }: ChatScreenProps) {
  const [input, setInput] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(timer)
  const [prevTimer, setPrevTimer] = useState(timer)
  const listRef = useRef<HTMLDivElement>(null)

  if (timer !== prevTimer) {
    setPrevTimer(timer)
    setSecondsLeft(timer)
  }

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    onSend(text)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const radius = 16
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / timer
  const offset = circumference * (1 - progress)

  return (
    <div className="h-dvh flex flex-col">
      <div className="border-b border-[#C4A861]/10 bg-[#12121A] px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-xs font-['Playfair_Display_SC'] text-[#C4A861] tracking-[0.15em] uppercase">
              Daybreak
            </h1>
            <svg viewBox="0 0 40 40" className="w-7 h-7">
              <circle cx="20" cy="20" r={radius} fill="none" stroke="rgba(196,168,97,0.12)" strokeWidth="2.5" />
              <circle cx="20" cy="20" r={radius} fill="none" stroke="#C4A861" strokeWidth="2.5"
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-1000 ease-linear" />
              <text x="20" y="20" textAnchor="middle" dominantBaseline="central"
                className="fill-[#C4A861] text-[9px] font-['JetBrains_Mono']">
                {secondsLeft}
              </text>
            </svg>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-[#6B7280] text-center py-12 tracking-wide">
              Silence fills the square. Someone must speak first.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.02}s` }}>
              <p className="text-[11px] font-medium text-[#3B82F6] mb-0.5 tracking-wide">{m.name}</p>
              <p className="text-sm text-[#D1D5DB] leading-relaxed">{m.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-[#C4A861]/10 bg-[#12121A] px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {isAlive ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Speak your piece..."
                maxLength={500}
                className="flex-1 bg-[#0A0A0B] border border-[#C4A861]/15 text-[#E8E8E8] px-3.5 py-2.5
                           text-sm placeholder:text-[#6B7280] placeholder:text-xs
                           focus:outline-none focus:border-[#C4A861]/40 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-5 border border-[#C4A861]/40 text-[#C4A861] text-[11px]
                           tracking-[0.15em] uppercase hover:bg-[#C4A861]/8
                           disabled:opacity-30 disabled:cursor-not-allowed
                           transition-all duration-300"
              >
                Speak
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-[#6B7280] py-2">
              The dead may only listen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
