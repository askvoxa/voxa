'use client'

import { useState, useEffect, useCallback } from 'react'

type JobName = 'expire-questions' | 'cleanup-intents' | 'process-payouts' | 'release-earnings'

type RunResult = {
  status: 'success' | 'error'
  duration_ms: number
  result: Record<string, unknown>
}

type HistoryRow = {
  id: string
  job_name: string
  triggered_by_email: string | null
  started_at: string
  duration_ms: number | null
  status: 'success' | 'error'
  result: Record<string, unknown> | null
}

const JOBS: { name: JobName; label: string; description: string }[] = [
  {
    name: 'expire-questions',
    label: 'Expirar Perguntas',
    description: 'Expira perguntas pendentes fora do prazo, emite reembolsos via Mercado Pago e envia nudges de urgência ao criador.',
  },
  {
    name: 'cleanup-intents',
    label: 'Limpar Intents',
    description: 'Remove payment_intents abandonados com mais de 48h sem confirmação de webhook do Mercado Pago.',
  },
  {
    name: 'process-payouts',
    label: 'Processar Payouts',
    description: 'Processa payout_requests pendentes via API PIX do Mercado Pago. Só executa no dia da semana configurado.',
  },
  {
    name: 'release-earnings',
    label: 'Liberar Ganhos',
    description: 'Libera ganhos de perguntas respondidas que ultrapassaram o período de carência, creditando no ledger do criador.',
  },
]

function summarizeResult(jobName: string, result: Record<string, unknown> | null): string {
  if (!result) return '—'
  if (result.error) return `Erro: ${result.error}`
  if (result.skipped) return `Ignorado: ${result.reason ?? ''}`

  switch (jobName) {
    case 'expire-questions': {
      const parts = []
      if (result.expired != null) parts.push(`${result.expired} expiradas`)
      if (result.refunded != null) parts.push(`${result.refunded} reembolsadas`)
      if (result.failed != null && Number(result.failed) > 0) parts.push(`${result.failed} com falha`)
      return parts.length ? parts.join(', ') : 'OK'
    }
    case 'cleanup-intents':
      return result.removed != null ? `${result.removed} intents removidos` : 'OK'
    case 'process-payouts': {
      const parts = []
      if (result.processed != null) parts.push(`${result.processed} processados`)
      if (result.succeeded != null) parts.push(`${result.succeeded} sucesso`)
      if (result.failed != null && Number(result.failed) > 0) parts.push(`${result.failed} falha`)
      if (result.reversed != null && Number(result.reversed) > 0) parts.push(`${result.reversed} revertidos`)
      return parts.length ? parts.join(', ') : 'OK'
    }
    case 'release-earnings':
      return result.released_count != null
        ? `${result.released_count} liberados — R$${Number(result.total_amount ?? 0).toFixed(2)}`
        : 'OK'
    default:
      return 'OK'
  }
}

export default function AdminJobsPage() {
  const [running, setRunning] = useState<JobName | null>(null)
  const [lastRun, setLastRun] = useState<Partial<Record<JobName, RunResult>>>({})
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const fetchHistory = useCallback(async () => {
    const res = await fetch('/api/admin/jobs/history')
    if (res.ok) setHistory(await res.json())
    setLoadingHistory(false)
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  async function runJob(job: JobName) {
    setRunning(job)
    try {
      const res = await fetch('/api/admin/jobs/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      })
      const data: RunResult = await res.json()
      setLastRun(prev => ({ ...prev, [job]: data }))
      await fetchHistory()
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Jobs</h1>
      <p className="text-sm text-gray-500 mb-8">Acione manualmente os processos agendados da plataforma.</p>

      {/* Job cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {JOBS.map(({ name, label, description }) => {
          const result = lastRun[name]
          const isRunning = running === name
          return (
            <div key={name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
              <div>
                <p className="font-bold text-sm text-gray-900">{label}</p>
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              </div>

              <button
                onClick={() => runJob(name)}
                disabled={running !== null}
                className="self-start bg-gradient-instagram text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50 transition-opacity"
              >
                {isRunning ? 'Executando...' : 'Executar agora'}
              </button>

              {result && (
                <div className={`rounded-xl px-3 py-2 text-xs ${result.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span className="font-semibold">{result.status === 'success' ? 'Sucesso' : 'Erro'}</span>
                  {' — '}
                  {summarizeResult(name, result.result)}
                  <span className="text-gray-400 ml-2">({result.duration_ms}ms)</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* History table */}
      <h2 className="text-base font-bold text-gray-900 mb-4">Histórico de execuções</h2>

      {loadingHistory ? (
        <p className="text-sm text-gray-400">Carregando...</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma execução registrada.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500 text-left">
                  <th className="px-4 py-3 font-semibold">Job</th>
                  <th className="px-4 py-3 font-semibold">Executado por</th>
                  <th className="px-4 py-3 font-semibold">Quando</th>
                  <th className="px-4 py-3 font-semibold">Duração</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-mono text-gray-700">{row.job_name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.triggered_by_email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(row.started_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {row.duration_ms != null ? `${row.duration_ms}ms` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${row.status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                        {row.status === 'success' ? 'Sucesso' : 'Erro'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {summarizeResult(row.job_name, row.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
