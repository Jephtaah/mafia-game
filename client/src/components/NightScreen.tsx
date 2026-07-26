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

const roleConfig: Record<string, { verb: string; heading: string; color: string; border: string; hover: string }> = {
  impostor:   { verb: 'Strike',      heading: 'Choose your prey',       color: 'text-[#DC2626]', border: 'border-[#DC2626]/40', hover: 'hover:border-[#DC2626]/70' },
  detective:  { verb: 'Investigate', heading: 'Who do you suspect?',    color: 'text-[#3B82F6]', border: 'border-[#3B82F6]/40', hover: 'hover:border-[#3B82F6]/70' },
  doctor:     { verb: 'Protect',     heading: 'Who needs protection?',  color: 'text-[#22C55E]', border: 'border-[#22C55E]/40', hover: 'hover:border-[#22C55E]/70' },
}

export default function NightScreen({ role, players, playerId, isAlive, fellowImpostors, send, timer, votedCount, waiting }: NightScreenProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(timer)
  const [prevTimer, setPrevTimer] = useState(timer)
  const hasNightAction = (role === 'impostor' || role === 'detective' || role === 'doctor') && isAlive
  const impostorCount = 1 + (fellowImpostors?.length ?? 0)
  const config = roleConfig[role] || { verb: 'Confirm', heading: 'Select a player', color: 'text-[#C4A861]', border: 'border-[#C4A861]/40', hover: 'hover:border-[#C4A861]/70' }

  if (timer !== prevTimer) {
    setPrevTimer(timer)
    setSecondsLeft(timer)
  }

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  let aliveTargets = players.filter((p) => {
    if (p.isAlive === false) return false
    if (role === 'impostor') {
      return p.id !== playerId && !fellowImpostors?.some((f) => f.id === p.id)
    }
    if (role === 'detective') {
      return p.id !== playerId
    }
    return true
  })

  if (aliveTargets.length === 0) {
    aliveTargets = players.filter((p) => p.id !== playerId)
  }

  const isTimeUp = secondsLeft <= 0

  const handleConfirm = () => {
    if (!selected || submitted || isTimeUp) return
    if (role === 'impostor') {
      send({ type: 'night_kill', target: selected })
    } else if (role === 'detective') {
      send({ type: 'investigate', target: selected })
    } else if (role === 'doctor') {
      send({ type: 'protect', target: selected })
    }
    setSubmitted(true)
  }

  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / timer
  const offset = circumference * (1 - progress)
  const timerColor = secondsLeft > 10 ? '#C4A861' : secondsLeft > 5 ? '#DC2626' : '#DC2626'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-scale">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-['Playfair_Display_SC'] text-[#C4A861] tracking-[0.08em]">
            NIGHT FALLS
          </h1>
          <div className="w-8 h-px bg-[#C4A861]/25 mx-auto mt-3" />

          <div className="flex justify-center mt-5">
            <svg viewBox="0 0 48 48" className="w-12 h-12">
              <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(196,168,97,0.12)" strokeWidth="3" />
              <circle cx="24" cy="24" r={radius} fill="none" stroke={timerColor} strokeWidth="3"
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-1000 ease-linear" />
              <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
                className="fill-[#C4A861] text-[10px] font-['JetBrains_Mono']">
                {secondsLeft}
              </text>
            </svg>
          </div>
        </div>

        {!hasNightAction ? (
          <div className="text-center py-10">
            <p className="text-sm text-[#9CA3AF] mb-1">
              {isAlive ? 'The shadows conceal you...' : 'You have fallen.'}
            </p>
            <p className="text-xs text-[#6B7280]">Waiting for night to end.</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mb-3 text-center">
              {config.heading}
            </p>
            <div className="space-y-2 mb-5">
              {aliveTargets.map((p) => (
                <button
                  key={p.id}
                  disabled={submitted || isTimeUp}
                  onClick={() => !submitted && !isTimeUp && setSelected(p.id)}
                  className={`w-full text-left px-4 py-3 bg-[#12121A] border text-sm
                              ${selected === p.id
                                ? `${config.border} ${config.color}`
                                : 'border-[#C4A861]/10 text-[#9CA3AF]'
                              } ${submitted || isTimeUp ? 'cursor-not-allowed opacity-75' : config.hover} transition-all duration-200`}
                >
                  <span>{p.name}</span>
                  {p.id === playerId && (
                    <span className="text-[10px] text-[#6B7280] ml-2">(yourself)</span>
                  )}
                </button>
              ))}
            </div>

            {isTimeUp ? (
              <div className="text-center py-3 mb-2">
                <p className="text-xs text-[#DC2626] tracking-[0.1em] uppercase mb-1">
                  Time Expired
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  Night phase is concluding...
                </p>
              </div>
            ) : submitted ? (
              <div className="text-center py-3 mb-2">
                <p className="text-xs text-[#22C55E] tracking-[0.1em] uppercase mb-1">
                  Target Confirmed
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  Waiting for night phase to conclude...
                </p>
              </div>
            ) : (
              <>
                {role === 'impostor' && impostorCount > 1 && (
                  <div className="text-center mb-4">
                    {waiting ? (
                      <p className="text-[11px] text-[#6B7280]">
                        Awaiting accomplices ({votedCount}/{impostorCount} ready)
                      </p>
                    ) : (
                      <p className="text-[11px] text-[#22C55E]">All impostors have chosen.</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleConfirm}
                  disabled={!selected || isTimeUp}
                  className="w-full py-2.5 border text-xs tracking-[0.2em] uppercase
                             disabled:opacity-30 disabled:cursor-not-allowed
                             transition-all duration-300"
                  style={{
                    borderColor: selected && !isTimeUp ? (role === 'impostor' ? '#DC2626' : role === 'detective' ? '#3B82F6' : '#22C55E') : 'rgba(196,168,97,0.3)',
                    color: selected && !isTimeUp ? (role === 'impostor' ? '#DC2626' : role === 'detective' ? '#3B82F6' : '#22C55E') : 'rgba(196,168,97,0.3)',
                  }}
                >
                  {config.verb}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
