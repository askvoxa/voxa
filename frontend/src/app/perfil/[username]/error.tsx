'use client'

export default function PerfilError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="bg-[#111] rounded-[32px] p-10 border border-white/10 text-center max-w-md w-full">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-bold text-white mb-2">Erro ao carregar perfil</h2>
        <p className="text-gray-500 mb-6 text-sm">
          Não foi possível carregar este perfil. Verifique sua conexão e tente novamente.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-gradient-instagram text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
