import type { PlayerInfo } from '../types/messages'

interface LobbyScreenProps {
  send: (msg: object) => void
  roomCode: string
  isHost: boolean
  players: PlayerInfo[]
  error: string
  onClearError: () => void
}

export default function LobbyScreen({ send, roomCode, isHost, players, error, onClearError }: LobbyScreenProps) {
  const handleStart = () => {
    onClearError()
    send({ type: 'start_game' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-['Playfair_Display_SC'] text-[#C4A861] tracking-[0.08em]">
            THE LOBBY
          </h1>
          <div className="w-10 h-px bg-[#C4A861]/30 mx-auto mt-3" />
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-3 px-5 py-3 border border-[#C4A861]/25 bg-[#C4A861]/5">
            <span className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase">Room</span>
            <span className="text-xl font-['JetBrains_Mono'] text-[#C4A861] tracking-[0.25em]">
              {roomCode}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 border border-[#DC2626]/30 bg-[#DC2626]/5 text-[#DC2626] text-xs tracking-wide text-center">
            {error}
          </div>
        )}

        <p className="text-center text-[10px] text-[#6B7280] tracking-[0.25em] uppercase mb-4">
          Assembled <span className="text-[#C4A861]">{players.length}</span>/10
        </p>

        <div className="space-y-2 mb-8">
          {players.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 bg-[#12121A] border border-[#C4A861]/10 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="w-9 h-9 shrink-0 rounded-full bg-[#1A1A28] border border-[#C4A861]/20
                              flex items-center justify-center text-xs font-['JetBrains_Mono'] text-[#C4A861]">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[#E8E8E8] truncate block">
                  {p.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.isHost && (
                  <span className="text-[9px] text-[#C4A861]/50 tracking-[0.15em] uppercase">Host</span>
                )}
                <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  p.connected
                    ? 'bg-[#22C55E] animate-glow-pulse'
                    : 'bg-[#6B7280]'
                }`} />
              </div>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={players.length < 5}
            className="w-full py-3 border border-[#C4A861]/40 text-[#C4A861] text-xs
                       tracking-[0.2em] uppercase hover:bg-[#C4A861]/8
                       disabled:opacity-30 disabled:cursor-not-allowed
                       transition-all duration-300"
          >
            {players.length < 5
              ? `Awaiting ${5 - players.length} more`
              : 'Commence'}
          </button>
        ) : (
          <p className="text-center text-xs text-[#6B7280] tracking-wide">
            Awaiting the host's signal...
          </p>
        )}
      </div>
    </div>
  )
}
