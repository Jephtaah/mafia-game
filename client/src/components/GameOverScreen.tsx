interface PlayerResult {
  id: string
  name: string
  role: string
  isAlive: boolean
}

interface GameOverScreenProps {
  winner: string
  players: PlayerResult[]
  playerId: string
}

export default function GameOverScreen({ winner, players, playerId }: GameOverScreenProps) {
  const impostorsWin = winner === 'impostors'
  const myResult = players.find((p) => p.id === playerId)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <p className="text-[10px] text-[#6B7280] tracking-[0.3em] uppercase mb-3">Game Over</p>
          <div className={`text-4xl md:text-5xl font-['Playfair_Display_SC'] mb-2 ${
            impostorsWin ? 'text-[#DC2626]' : 'text-[#22C55E]'
          }`}>
            {impostorsWin ? 'Impostors Win' : 'Crewmates Win'}
          </div>
          <p className="text-xs text-[#6B7280]">
            {impostorsWin ? 'Deception prevails...' : 'Justice prevails.'}
          </p>
          <div className="w-10 h-px bg-[#C4A861]/30 mx-auto mt-5" />
        </div>

        {myResult && (
          <div className="text-center mb-7 animate-fade-in-up animate-delay-1">
            <p className="text-xs text-[#6B7280] tracking-[0.15em] uppercase">
              You were <span className="text-[#C4A861] capitalize">{myResult.role}</span>
            </p>
          </div>
        )}

        <div className="mb-8">
          <p className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mb-3 text-center">
            The Full Picture
          </p>
          <div className="space-y-1.5">
            {players.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-2.5 bg-[#12121A] border border-[#C4A861]/10 animate-fade-in-up"
                style={{ animationDelay: `${0.2 + i * 0.04}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${p.isAlive ? 'bg-[#22C55E]' : 'bg-[#DC2626]'}`} />
                  <span className={`text-sm ${p.id === playerId ? 'text-[#3B82F6]' : 'text-[#D1D5DB]'}`}>
                    {p.name}
                    {p.id === playerId && <span className="text-[10px] text-[#3B82F6] ml-1">(you)</span>}
                  </span>
                </div>
                <span className={`text-xs font-medium capitalize ${
                  p.role === 'impostor' ? 'text-[#DC2626]' : 'text-[#22C55E]'
                }`}>
                  {p.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full py-3 border border-[#C4A861]/40 text-[#C4A861] text-xs
                     tracking-[0.2em] uppercase hover:bg-[#C4A861]/8
                     transition-all duration-300"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
