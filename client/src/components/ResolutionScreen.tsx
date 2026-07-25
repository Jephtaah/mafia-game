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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl text-center">
        <h1 className="text-2xl font-bold mb-4">Resolution</h1>

        {eliminated ? (
          <>
            <p className="text-gray-300 mb-2">
              <span className="font-bold text-red-400">{name}</span> was eliminated.
            </p>
            <p className="text-sm text-gray-500">They were a {role}.</p>
          </>
        ) : (
          <p className="text-gray-300">No one was eliminated.</p>
        )}

        <div className="w-full h-1.5 bg-gray-700 rounded-full mt-6 mb-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${(secondsLeft / timer) * 100}%`,
              backgroundColor: secondsLeft > 3 ? '#3b82f6' : '#ef4444',
            }}
          />
        </div>
        <p className="text-xs text-gray-500">Day begins in {secondsLeft}s...</p>
      </div>
    </div>
  )
}
