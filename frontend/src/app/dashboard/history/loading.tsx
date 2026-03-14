export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Métricas skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="h-4 w-36 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-9 w-28 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Filtros skeleton */}
        <div className="flex gap-2 mb-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-9 w-28 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>

        {/* Itens da lista skeleton */}
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                  <div>
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-1" />
                    <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-14 bg-gray-100 rounded-lg animate-pulse" />
                  <div className="h-7 w-20 bg-green-50 rounded-lg animate-pulse" />
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
