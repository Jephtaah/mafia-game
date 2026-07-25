import type { PlayerInfo } from '../types/messages'

interface RoleRevealProps {
  role: string
  desc?: string
  fellowImpostors?: PlayerInfo[]
  onDismiss: () => void
}

const roleColors: Record<string, string> = {
  impostor: 'text-red-400',
  detective: 'text-blue-400',
  doctor: 'text-green-400',
  crewmate: 'text-green-400',
}

const roleLabels: Record<string, string> = {
  impostor: 'Impostor',
  detective: 'Detective',
  doctor: 'Doctor',
  crewmate: 'Crewmate',
}

export default function RoleReveal({ role, desc, fellowImpostors, onDismiss }: RoleRevealProps) {
  const colorClass = roleColors[role] || 'text-green-400'
  const label = roleLabels[role] || role

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="bg-gray-800 rounded-xl p-8 w-full max-w-sm shadow-xl text-center">
        <h1 className="text-lg text-gray-400 mb-2">Your Role</h1>
        <div className={`text-4xl font-bold mb-4 capitalize ${colorClass}`}>
          {label}
        </div>
        <p className="text-gray-300 mb-6">
          {desc || (role === 'impostor'
            ? 'Eliminate crewmates without being caught.'
            : 'Complete tasks and find the impostors.')}
        </p>

        {role === 'impostor' && fellowImpostors && fellowImpostors.length > 0 && (
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
