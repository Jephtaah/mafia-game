interface ResolutionScreenProps {
  eliminated: string | null
  role: string | null
  players: { id: string; name: string }[]
  timer: number
}

export default function ResolutionScreen({ eliminated, role, players, timer }: ResolutionScreenProps) {
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

        <p className="text-xs text-gray-500 mt-6">Day begins in {timer}s...</p>
      </div>
    </div>
  )
}
