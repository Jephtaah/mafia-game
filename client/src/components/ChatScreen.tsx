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
  const listRef = useRef<HTMLDivElement>(null)

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
        <h1 className="text-lg font-bold">Day Phase</h1>
        <span className="text-sm text-gray-400">{timer}s remaining</span>
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
