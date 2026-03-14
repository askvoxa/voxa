'use client'

export default function HistoryError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-100 text-center max-w-md w-full">
        <p className="text-4xl mb-4">📭</p>
        <h2 className="text-xl font-bold text-gray-700 mb-2">Erro ao carregar histórico</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Não foi possível carregar seu histórico de respostas. Tente novamente.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gradient-instagram text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
          >
            Tentar novamente
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
