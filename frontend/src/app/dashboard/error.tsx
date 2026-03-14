'use client'

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 text-center max-w-md w-full">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Algo deu errado</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Não foi possível carregar o dashboard. Verifique sua conexão e tente novamente.
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
