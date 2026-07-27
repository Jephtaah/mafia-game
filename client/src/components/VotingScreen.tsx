import { useState, useEffect } from 'react'
import type { PlayerInfo } from '../types/messages'

interface VotingScreenProps {
  players: PlayerInfo[]
  playerId: string
  isAlive: boolean
  send: (msg: object) => void
  timer: number
  votes: { playerId: string; target: string }[]
  elimination: { eliminated: string | null; role: string | null } | null
}

export default function VotingScreen({ players, playerId, isAlive, send, timer, votes, elimination }: VotingScreenProps) {
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
              The Accusation
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

      {elimination && (
        <div className="border-b border-[#C4A861]/10 bg-[#0A0A0B] px-4 py-3">
          <div className="max-w-2xl mx-auto text-center animate-fade-in-up">
            <p className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mb-1">Verdict</p>
            {elimination.eliminated ? (
              <div>
                <p className="text-sm font-['Playfair_Display_SC'] text-[#DC2626]">
                  {players.find((p) => p.id === elimination.eliminated)?.name ?? 'Unknown'}
                </p>
                <p className="text-[10px] text-[#6B7280]">
                  was a <span className="text-[#C4A861] capitalize">{elimination.role}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#9CA3AF]">No one was condemned.</p>
            )}
          </div>
        </div>
      )}

      {!isAlive ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-[#6B7280]">The dead watch in silence.</p>
        </div>
      ) : voted || myVote ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 animate-fade-in-scale">
          <p className="text-sm text-[#22C55E] tracking-wide">Judgement cast.</p>
          <p className="text-xs text-[#6B7280]">Awaiting the jury...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="max-w-2xl mx-auto">
              <p className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mb-3 text-center">
                Who stands accused?
              </p>
              <div className="space-y-2 mb-5">
                {alivePlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`w-full text-left px-4 py-3 bg-[#12121A] border text-sm transition-all duration-200 ${
                      selected === p.id
                        ? 'border-[#DC2626]/50 text-[#DC2626]'
                        : 'border-[#C4A861]/10 text-[#9CA3AF] hover:border-[#C4A861]/30'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-2.5 border border-[#6B7280]/30 text-[#6B7280] text-[11px]
                             tracking-[0.15em] uppercase hover:bg-[#6B7280]/8
                             transition-all duration-300"
                >
                  Spare All
                </button>
                <button
                  onClick={handleVote}
                  disabled={!selected}
                  className="flex-1 py-2.5 border border-[#DC2626]/40 text-[#DC2626] text-[11px]
                             tracking-[0.15em] uppercase hover:bg-[#DC2626]/8
                             disabled:opacity-30 disabled:cursor-not-allowed
                             transition-all duration-300"
                >
                  Condemn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {votes.length > 0 && (
        <div className="border-t border-[#C4A861]/10 bg-[#12121A] px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mb-2 text-center">
              The Jury Speaks
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {players.filter((p) => votes.some((v) => v.playerId === p.id)).map((p, i) => {
                const vote = votes.find((v) => v.playerId === p.id)
                const targetName = vote?.target === 'skip'
                  ? 'spare'
                  : players.find((pl) => pl.id === vote?.target)?.name ?? 'Unknown'
                return (
                  <div key={p.id} className="animate-vote-reveal text-[11px] text-[#9CA3AF]"
                       style={{ animationDelay: `${i * 0.05}s` }}>
                    <span className="text-[#C4A861]/70">{p.name}</span>
                    <span className="text-[#6B7280] mx-1">→</span>
                    <span className={vote?.target === 'skip' ? 'text-[#6B7280]' : 'text-[#DC2626]'}>
                      {targetName}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
