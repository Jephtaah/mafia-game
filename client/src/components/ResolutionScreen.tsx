import { useState, useEffect } from 'react'

interface ResolutionScreenProps {
  eliminated: string | null
  role: string | null
  players: { id: string; name: string }[]
  timer: number
}

export default function ResolutionScreen({ eliminated, role, players, timer }: ResolutionScreenProps) {
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

  const name = eliminated ? players.find((p) => p.id === eliminated)?.name ?? 'Unknown' : null

  const radius = 18
  const circumference = 2 * Math.PI * radius
  const progress = secondsLeft / timer
  const offset = circumference * (1 - progress)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in-scale text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-['Playfair_Display_SC'] text-[#C4A861] tracking-[0.08em]">
            DAWN BREAKS
          </h1>
          <div className="w-8 h-px bg-[#C4A861]/25 mx-auto mt-3" />
        </div>

        <div className="border border-[#C4A861]/15 bg-[#12121A] p-8 mb-6">
          {eliminated ? (
            <div className="animate-fade-in-up">
              <p className="text-xs text-[#6B7280] tracking-[0.15em] uppercase mb-3">
                The town has spoken
              </p>
              <p className="text-2xl font-['Playfair_Display_SC'] text-[#DC2626] mb-2">
                {name}
              </p>
              <p className="text-xs text-[#6B7280]">
                They were <span className="text-[#C4A861] capitalize">{role}</span>.
              </p>
            </div>
          ) : (
            <div className="animate-fade-in-up">
              <p className="text-lg font-['Playfair_Display_SC'] text-[#9CA3AF] mb-1">
                No One Was Lost
              </p>
              <p className="text-xs text-[#6B7280]">Mercifully, the night took no one.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <svg viewBox="0 0 48 48" className="w-10 h-10">
            <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(196,168,97,0.12)" strokeWidth="3" />
            <circle cx="24" cy="24" r={radius} fill="none" stroke="#C4A861" strokeWidth="3"
              strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
              className="transition-all duration-1000 ease-linear" />
            <text x="24" y="24" textAnchor="middle" dominantBaseline="central"
              className="fill-[#C4A861] text-[10px] font-['JetBrains_Mono']">
              {secondsLeft}
            </text>
          </svg>
          <p className="text-[10px] text-[#6B7280] tracking-[0.15em] uppercase">Daybreak approaches</p>
        </div>
      </div>
    </div>
  )
}
