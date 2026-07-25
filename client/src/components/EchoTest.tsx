import { useState, useEffect, useRef } from 'react'
import { useWebSocket } from '../hooks/useWebSocket'

export default function EchoTest() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const { send, connect, disconnect, onRawMessage, readyState } = useWebSocket()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    connect('ws://localhost:8080/ws')
    return () => disconnect()
  }, [connect, disconnect])

  useEffect(() => {
    onRawMessage((data) => {
      setMessages((prev) => [...prev, `Echo: ${data}`])
    })
  }, [onRawMessage])

  const handleSend = () => {
    if (!input.trim()) return
    send({ type: 'chat', text: input })
    setMessages((prev) => [...prev, `Sent: ${input}`])
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend()
  }

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const statusText =
    readyState === WebSocket.OPEN
      ? 'Connected'
      : readyState === WebSocket.CONNECTING
        ? 'Connecting...'
        : 'Disconnected'

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-2">Echo Test</h1>
      <p className="text-sm text-gray-500 mb-4">{statusText}</p>

      <div ref={listRef} className="flex-1 overflow-y-auto border rounded p-2 mb-2 space-y-1">
        {messages.map((m, i) => (
          <div key={i} className="text-sm">{m}</div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={readyState !== WebSocket.OPEN}
          placeholder="Type a message..."
        />
        <button
          className="px-4 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          onClick={handleSend}
          disabled={readyState !== WebSocket.OPEN}
        >
          Send
        </button>
      </div>
    </div>
  )
}
