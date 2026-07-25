import { useState, useEffect } from 'react'
import type { PlayerInfo } from '../types/messages'

interface VotingScreenProps {
  players: PlayerInfo[]
  playerId: string
  isAlive: boolean
  send: (msg: object) => void
  timer: number
  votes: { playerId: string; target: string }[]
}

export default function VotingScreen({ players, playerId, isAlive, send, timer, votes }: VotingScreenProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [voted, setVoted] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(timer)
  const [prevTimer, setPrevTimer] = useState(timer)

  if (timer !== prevTimer) {
    setPrevTimer(timer)
    setSecondsLeft(timer)
  }

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const alivePlayers = players.filter((p) => p.id !== playerId && p.isAlive)

  const handleVote = () => {
    if (!selected || voted) return
    send({ type: 'vote', target: selected })
    setVoted(true)
  }

  const handleSkip = () => {
    if (voted) return
    send({ type: 'vote', target: 'skip' })
    setVoted(true)
  }

  const myVote = votes.find((v) => v.playerId === playerId)

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <h1 className="text-lg font-bold">Voting</h1>
        <span className="text-sm text-gray-400">{secondsLeft}s remaining</span>
      </div>

      {!isAlive ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">You are dead — spectating.</p>
        </div>
      ) : voted || myVote ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-green-400 text-lg mb-2">Vote cast!</p>
          <p className="text-gray-400 text-sm">Waiting for others to vote...</p>
        </div>
      ) : (
        <div className="flex-1 px-4 py-4">
          <div className="bg-gray-800 rounded-xl p-4 mb-4 shadow-xl">
            <h2 className="text-sm text-gray-400 mb-2">Who should be eliminated?</h2>
            <div className="bg-gray-700 rounded-lg divide-y divide-gray-600">
              {alivePlayers.map((p) => (
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
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 bg-gray-600 hover:bg-gray-500 rounded py-2.5 font-medium"
            >
              Skip Vote
            </button>
            <button
              onClick={handleVote}
              disabled={!selected}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded py-2.5 font-medium"
            >
              Vote
            </button>
          </div>
        </div>
      )}

      {votes.length > 0 && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-4">
          <h3 className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Live Tally</h3>
          <div className="space-y-1">
            {players.filter((p) => votes.some((v) => v.playerId === p.id)).map((p) => {
              const vote = votes.find((v) => v.playerId === p.id)
              const targetName = vote?.target === 'skip'
                ? 'Skip'
                : players.find((pl) => pl.id === vote?.target)?.name ?? 'Unknown'
              return (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{p.name}</span>
                  <span className="text-gray-500">
                    → <span className={vote?.target === 'skip' ? 'text-gray-400' : 'text-yellow-400'}>{targetName}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
