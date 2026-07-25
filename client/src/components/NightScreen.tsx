import { useState, useEffect } from 'react'
import type { PlayerInfo } from '../types/messages'

interface NightScreenProps {
  role: string
  players: PlayerInfo[]
  playerId: string
  isAlive: boolean
  fellowImpostors?: PlayerInfo[]
  send: (msg: object) => void
  timer: number
  votedCount: number
  waiting: boolean
}

export default function NightScreen({ role, players, playerId, isAlive, fellowImpostors, send, timer, votedCount, waiting }: NightScreenProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(timer)
  const [prevTimer, setPrevTimer] = useState(timer)
  const isImpostor = role === 'impostor'
  const impostorCount = 1 + (fellowImpostors?.length ?? 0)

  if (timer !== prevTimer) {
    setPrevTimer(timer)
    setSecondsLeft(timer)
  }

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const aliveTargets = players.filter(
    (p) => p.id !== playerId && p.isAlive && !fellowImpostors?.some((f) => f.id === p.id)
  )

  const handleConfirm = () => {
    if (!selected) return
    send({ type: 'night_kill', target: selected })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center">Night Falls</h1>
        <div className="text-center text-gray-400 mb-6">
          {secondsLeft}s remaining
        </div>

        {!isImpostor || !isAlive ? (
          <div className="text-center text-gray-300 py-8">
            <p className="text-lg mb-2">{isAlive ? 'You are safe for now...' : 'You are dead — spectating.'}</p>
            <p className="text-sm text-gray-500">Waiting for night to end.</p>
          </div>
        ) : (
          <>
            <h2 className="text-sm text-gray-400 mb-2">Select a target</h2>
            <div className="bg-gray-700 rounded-lg divide-y divide-gray-600 mb-4">
              {aliveTargets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full text-left px-4 py-2.5 font-medium transition-colors ${
                    selected === p.id
                      ? 'bg-red-900/50 text-red-300'
                      : 'hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {impostorCount > 1 && (
              <div className="text-center mb-4">
                {waiting ? (
                  <p className="text-xs text-gray-400">
                    Waiting for fellow impostors ({votedCount}/{impostorCount} voted)
                  </p>
                ) : (
                  <p className="text-xs text-green-400">All impostors have chosen.</p>
                )}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!selected}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded py-2.5 font-medium"
            >
              Confirm Kill
            </button>
          </>
        )}
      </div>
    </div>
  )
}
