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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-xl text-center">
        <h1 className="text-2xl font-bold mb-2">Game Over</h1>
        <div className={`text-4xl font-bold mb-6 ${impostorsWin ? 'text-red-400' : 'text-green-400'}`}>
          {impostorsWin ? 'Impostors Win!' : 'Crewmates Win!'}
        </div>

        {myResult && (
          <div className="mb-6">
            <p className="text-sm text-gray-400">
              You were a <span className="font-bold text-white">{myResult.role}</span>
            </p>
          </div>
        )}

        <div className="mb-6 text-left">
          <h2 className="text-sm text-gray-400 mb-2 uppercase tracking-wider">Players</h2>
          <div className="bg-gray-700 rounded-lg divide-y divide-gray-600">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.isAlive ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className={`font-medium ${p.id === playerId ? 'text-blue-400' : 'text-gray-200'}`}>
                    {p.name}
                    {p.id === playerId && <span className="ml-1 text-xs text-blue-400">(you)</span>}
                  </span>
                </div>
                <span className={`text-sm font-medium ${p.role === 'impostor' ? 'text-red-400' : 'text-green-400'}`}>
                  {p.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2.5 font-medium"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
