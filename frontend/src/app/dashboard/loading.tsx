export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 bg-gray-100 rounded animate-pulse hidden sm:block" />
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse hidden sm:block" />
            <div className="h-4 w-20 bg-gray-100 rounded animate-pulse hidden sm:block" />
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Saudação skeleton */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] rounded-3xl shadow-md">
          <div className="h-8 w-48 bg-white/20 rounded-xl animate-pulse mb-3" />
          <div className="h-5 w-80 bg-white/20 rounded-lg animate-pulse" />
        </div>

        {/* Métricas skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Cards de pergunta skeleton */}
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-3 w-40 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-10 w-36 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-10 w-36 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
