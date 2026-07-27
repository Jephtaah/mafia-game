import type { PlayerInfo } from '../types/messages'

interface RoleRevealProps {
  role: string
  desc?: string
  fellowImpostors?: PlayerInfo[]
  onDismiss: () => void
}

const roleDisplay: Record<string, { label: string; color: string; accent: string }> = {
  impostor:   { label: 'The Impostor',  color: 'text-[#DC2626]', accent: 'border-[#DC2626]/30' },
  detective:  { label: 'The Detective', color: 'text-[#3B82F6]', accent: 'border-[#3B82F6]/30' },
  doctor:     { label: 'The Doctor',    color: 'text-[#22C55E]', accent: 'border-[#22C55E]/30' },
  crewmate:   { label: 'The Crewmate',  color: 'text-[#22C55E]', accent: 'border-[#22C55E]/30' },
}

export default function RoleReveal({ role, desc, fellowImpostors, onDismiss }: RoleRevealProps) {
  const info = roleDisplay[role] ?? roleDisplay.crewmate ?? { label: role, color: 'text-[#C4A861]', accent: 'border-[#C4A861]/30' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-card-flip">
        <div className={`border ${info.accent} bg-[#12121A] p-8 text-center`}>
          <p className="text-[10px] text-[#6B7280] tracking-[0.25em] uppercase mb-5">
            Your Role
          </p>

          <div className={`text-3xl md:text-4xl font-['Playfair_Display_SC'] ${info.color} mb-4`}>
            {info.label}
          </div>

          <p className="text-xs text-[#9CA3AF] leading-relaxed mb-7">
            {desc || (role === 'impostor'
              ? 'Eliminate the crewmates without being discovered.'
              : 'Root out the impostors before they take over.')}
          </p>

          {role === 'impostor' && fellowImpostors && fellowImpostors.length > 0 && (
            <div className="mb-7">
              <p className="text-[10px] text-[#6B7280] tracking-[0.2em] uppercase mb-3">
                Fellow Impostors
              </p>
              <div className="space-y-1.5">
                {fellowImpostors.map((p, i) => (
                  <div
                    key={p.id}
                    className="px-4 py-2 border border-[#DC2626]/20 bg-[#DC2626]/5 animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <span className="text-sm text-[#DC2626]">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onDismiss}
            className="w-full py-2.5 border border-[#C4A861]/40 text-[#C4A861] text-xs
                       tracking-[0.2em] uppercase hover:bg-[#C4A861]/8
                       transition-all duration-300"
          >
            Embrace Your Destiny
          </button>
        </div>
      </div>
    </div>
  )
}
