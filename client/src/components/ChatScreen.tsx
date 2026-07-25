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

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex flex-col flex-1">
          <h1 className="text-lg font-bold">Day Phase</h1>
          <div className="w-full h-1 bg-gray-700 rounded-full mt-2 overflow-hidden max-w-[200px]">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${(secondsLeft / timer) * 100}%`,
                backgroundColor: secondsLeft > 15 ? '#3b82f6' : secondsLeft > 5 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>
        <span className="text-sm text-gray-400">{secondsLeft}s remaining</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center py-8 text-sm">
            No messages yet. Start the discussion.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className="bg-gray-800 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-blue-400">{m.name}</span>
            <p className="text-sm text-gray-200 mt-0.5">{m.text}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-800 border-t border-gray-700 px-4 py-3">
        {isAlive ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-medium"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-2">
            You are dead — spectating.
          </div>
        )}
      </div>
    </div>
  )
}
