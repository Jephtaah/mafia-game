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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center">Lobby</h1>

        <div className="text-center mb-6">
          <span className="text-sm text-gray-400">Room Code</span>
          <div className="text-3xl font-mono tracking-widest mt-1 text-yellow-400">{roomCode}</div>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-sm text-gray-400 mb-2">Players ({players.length}/10)</h2>
          <div className="bg-gray-700 rounded-lg divide-y divide-gray-600">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium">
                  {p.name}
                  {p.isHost && <span className="ml-2 text-xs bg-yellow-600 text-yellow-100 px-1.5 py-0.5 rounded">HOST</span>}
                </span>
                <span className={`text-xs ${p.connected ? 'text-green-400' : 'text-gray-500'}`}>
                  {p.connected ? 'online' : 'disconnected'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button
            onClick={handleStart}
            disabled={players.length < 5}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded py-2.5 font-medium"
          >
            {players.length < 5 ? `Need ${5 - players.length} more player${5 - players.length === 1 ? '' : 's'}` : 'Start Game'}
          </button>
        ) : (
          <div className="text-center text-gray-400 text-sm py-2.5">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </div>
  )
}
