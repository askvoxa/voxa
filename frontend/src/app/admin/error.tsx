'use client'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 flex flex-col items-start gap-4">
      <h1 className="text-xl font-bold text-gray-900">Erro ao carregar página</h1>
      <p className="text-sm text-gray-500 max-w-md">
        {error.message || 'Ocorreu um erro inesperado. Se o problema persistir, verifique se as migrações do banco de dados foram aplicadas.'}
      </p>
      {error.digest && (
        <p className="text-xs text-gray-500 font-mono">ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="text-sm font-semibold px-4 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-700 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  )
}
