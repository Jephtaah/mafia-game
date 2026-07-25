import type { PlayerInfo } from '../types/messages'

interface RoleRevealProps {
  role: string
  fellowImpostors?: PlayerInfo[]
  onDismiss: () => void
}

export default function RoleReveal({ role, fellowImpostors, onDismiss }: RoleRevealProps) {
  const isImpostor = role === 'impostor'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl text-center">
        <h1 className="text-lg text-gray-400 mb-2">Your Role</h1>
        <div className={`text-4xl font-bold mb-4 ${isImpostor ? 'text-red-400' : 'text-green-400'}`}>
          {isImpostor ? 'Impostor' : 'Crewmate'}
        </div>
        <p className="text-gray-300 mb-6">
          {isImpostor
            ? 'Eliminate crewmates without being caught.'
            : 'Complete tasks and find the impostors.'}
        </p>

        {isImpostor && fellowImpostors && fellowImpostors.length > 0 && (
          <div className="mb-6 text-left">
            <h2 className="text-sm text-gray-400 mb-2">Fellow Impostors</h2>
            <div className="bg-gray-700 rounded-lg divide-y divide-gray-600">
              {fellowImpostors.map((p) => (
                <div key={p.id} className="px-4 py-2 text-red-300 font-medium">
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onDismiss}
          className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2.5 font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
