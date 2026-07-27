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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-['Playfair_Display_SC'] text-[#C4A861] tracking-[0.08em] leading-none">
            MAFIA
          </h1>
          <p className="text-[10px] text-[#6B7280] tracking-[0.35em] uppercase mt-3">
            A Game of Deception
          </p>
          <div className="w-12 h-px bg-[#C4A861]/30 mx-auto mt-5" />
        </div>

        {displayError && (
          <div className="mb-6 p-3 border border-[#DC2626]/30 bg-[#DC2626]/5 text-[#DC2626] text-xs tracking-wide text-center">
            {displayError}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              maxLength={20}
              placeholder="Enter your alias"
              disabled={isConnecting}
              className="w-full bg-transparent border-b border-[#C4A861]/25 text-[#E8E8E8] py-2.5
                         placeholder:text-[#6B7280] text-sm tracking-wider
                         focus:outline-none focus:border-[#C4A861]/60 transition-colors
                         disabled:opacity-40"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={isConnecting}
            className="w-full py-2.5 border border-[#C4A861]/40 text-[#C4A861] text-xs
                       tracking-[0.2em] uppercase hover:bg-[#C4A861]/8
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-300"
          >
            {isConnecting && pendingKind === 'create' ? 'Establishing...' : 'Establish New Game'}
          </button>
        </div>

        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-[#C4A861]/15" />
          <span className="text-[10px] text-[#6B7280] tracking-[0.25em] uppercase">or</span>
          <div className="flex-1 h-px bg-[#C4A861]/15" />
        </div>

        <div className="space-y-5">
          <div>
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              maxLength={20}
              placeholder="Enter your alias"
              disabled={isConnecting}
              className="w-full bg-transparent border-b border-[#C4A861]/25 text-[#E8E8E8] py-2.5
                         placeholder:text-[#6B7280] text-sm tracking-wider
                         focus:outline-none focus:border-[#C4A861]/60 transition-colors
                         disabled:opacity-40"
            />
          </div>

          <div>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
              maxLength={4}
              placeholder="ROOM CODE"
              disabled={isConnecting}
              className="w-full bg-[#12121A] border border-[#C4A861]/25 text-[#C4A861] py-3
                         text-center text-lg font-['JetBrains_Mono'] tracking-[0.3em]
                         placeholder:text-[#6B7280] placeholder:tracking-[0.2em] placeholder:text-sm
                         focus:outline-none focus:border-[#C4A861]/60 transition-colors
                         disabled:opacity-40"
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={isConnecting}
            className="w-full py-2.5 border border-[#C4A861]/40 text-[#C4A861] text-xs
                       tracking-[0.2em] uppercase hover:bg-[#C4A861]/8
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-300"
          >
            {isConnecting && pendingKind === 'join' ? 'Entering...' : 'Enter the Fray'}
          </button>
        </div>
      </div>
    </div>
  )
}
