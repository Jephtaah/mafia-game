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

const roleActionLabels: Record<string, { verb: string; heading: string }> = {
  impostor: { verb: 'Kill', heading: 'Select a target' },
  detective: { verb: 'Investigate', heading: 'Who should I investigate?' },
  doctor: { verb: 'Protect', heading: 'Who should I protect?' },
}

export default function NightScreen({ role, players, playerId, isAlive, fellowImpostors, send, timer, votedCount, waiting }: NightScreenProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(timer)
  const [prevTimer, setPrevTimer] = useState(timer)
  const hasNightAction = (role === 'impostor' || role === 'detective' || role === 'doctor') && isAlive
  const impostorCount = 1 + (fellowImpostors?.length ?? 0)
  const actionLabel = roleActionLabels[role] || { verb: 'Confirm', heading: 'Select a player' }

  if (timer !== prevTimer) {
    setPrevTimer(timer)
    setSecondsLeft(timer)
  }

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const aliveTargets = players.filter((p) => {
    if (!p.isAlive) return false
    if (role === 'impostor') {
      return p.id !== playerId && !fellowImpostors?.some((f) => f.id === p.id)
    }
    if (role === 'detective') {
      return p.id !== playerId // detective can investigate anyone except self
    }
    // doctor can protect anyone including self
    return true
  })

  const handleConfirm = () => {
    if (!selected) return
    if (role === 'impostor') {
      send({ type: 'night_kill', target: selected })
    } else if (role === 'detective') {
      send({ type: 'investigate', target: selected })
    } else if (role === 'doctor') {
      send({ type: 'protect', target: selected })
    }
  }

  const buttonColor = role === 'impostor' ? 'red' : role === 'detective' ? 'blue' : 'green'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center">Night Falls</h1>
        <div className="text-center text-gray-400 mb-1">
          {secondsLeft}s remaining
        </div>
        <div className="w-full h-1.5 bg-gray-700 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${(secondsLeft / timer) * 100}%`,
              backgroundColor: secondsLeft > 10 ? '#3b82f6' : secondsLeft > 5 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>

        {!hasNightAction ? (
          <div className="text-center text-gray-300 py-8">
            <p className="text-lg mb-2">{isAlive ? 'You are safe for now...' : 'You are dead — spectating.'}</p>
            <p className="text-sm text-gray-500">Waiting for night to end.</p>
          </div>
        ) : (
          <>
            <h2 className="text-sm text-gray-400 mb-2">{actionLabel.heading}</h2>
            <div className="bg-gray-700 rounded-lg divide-y divide-gray-600 mb-4">
              {aliveTargets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full text-left px-4 py-2.5 font-medium transition-colors ${
                    selected === p.id
                      ? role === 'impostor'
                        ? 'bg-red-900/50 text-red-300'
                        : role === 'detective'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-green-900/50 text-green-300'
                      : 'hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {p.name}
                  {p.id === playerId && <span className="text-xs text-gray-500 ml-2">(self)</span>}
                </button>
              ))}
            </div>

            {role === 'impostor' && impostorCount > 1 && (
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
              className={`w-full disabled:bg-gray-600 disabled:cursor-not-allowed rounded py-2.5 font-medium ${
                buttonColor === 'red'
                  ? 'bg-red-600 hover:bg-red-500'
                  : buttonColor === 'blue'
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : 'bg-green-600 hover:bg-green-500'
              }`}
            >
              {actionLabel.verb}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
