import { useState, useEffect, useRef } from 'react'

interface JoinScreenProps {
  send: (msg: object) => void
  readyState: number
  connect: (url: string) => void
  error: string
  onClearError: () => void
}

type PendingAction =
  | { kind: 'create'; name: string }
  | { kind: 'join'; name: string; code: string }

export default function JoinScreen({ send, readyState, connect, error, onClearError }: JoinScreenProps) {
  const [createName, setCreateName] = useState('')
  const [joinName, setJoinName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [localError, setLocalError] = useState('')
  const [pendingKind, setPendingKind] = useState<'create' | 'join' | null>(null)
  const pendingRef = useRef<PendingAction | null>(null)

  useEffect(() => {
    if (readyState === WebSocket.OPEN && pendingRef.current) {
      const action = pendingRef.current
      if (action.kind === 'create') {
        send({ type: 'create_room', name: action.name })
      } else {
        send({ type: 'join_room', code: action.code, name: action.name })
      }
    }
  }, [readyState, send])

  const handleCreate = () => {
    const trimmed = createName.trim()
    if (!trimmed || trimmed.length > 20) {
      setLocalError('Name must be 1-20 characters')
      return
    }
    setLocalError('')
    onClearError()
    pendingRef.current = { kind: 'create', name: trimmed }
    setPendingKind('create')
    connect('ws://localhost:3001/ws')
  }

  const handleJoin = () => {
    const trimmed = joinName.trim()
    const code = roomCode.trim().toUpperCase()
    if (!trimmed || trimmed.length > 20) {
      setLocalError('Name must be 1-20 characters')
      return
    }
    if (code.length !== 4) {
      setLocalError('Room code must be 4 characters')
      return
    }
    setLocalError('')
    onClearError()
    pendingRef.current = { kind: 'join', name: trimmed, code }
    setPendingKind('join')
    connect('ws://localhost:3001/ws')
  }

  const isConnecting = readyState === WebSocket.CONNECTING
  const displayError = localError || error

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-center">Mafia</h1>

        {displayError && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4 text-sm">
            {displayError}
          </div>
        )}

        <label className="block mb-4">
          <span className="text-sm text-gray-400">Your Name</span>
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            maxLength={20}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="Enter your name"
            disabled={isConnecting}
          />
        </label>

        <button
          onClick={handleCreate}
          disabled={isConnecting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded py-2.5 font-medium mb-4"
        >
          {isConnecting && pendingKind === 'create' ? 'Creating...' : 'Create Room'}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gray-800 px-2 text-gray-400">or join existing</span>
          </div>
        </div>

        <label className="block mb-4">
          <span className="text-sm text-gray-400">Your Name</span>
          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            maxLength={20}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            placeholder="Enter your name"
            disabled={isConnecting}
          />
        </label>

        <label className="block mb-4">
          <span className="text-sm text-gray-400">Room Code</span>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
            maxLength={4}
            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 tracking-widest text-center font-mono focus:outline-none focus:border-blue-500"
            placeholder="XXXX"
            disabled={isConnecting}
          />
        </label>

        <button
          onClick={handleJoin}
          disabled={isConnecting}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 rounded py-2.5 font-medium"
        >
          {isConnecting && pendingKind === 'join' ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </div>
  )
}
