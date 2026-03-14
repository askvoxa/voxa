import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QuestionList from './QuestionList'

type Question = {
  id: string
  sender_name: string
  content: string
  price_paid: number
  service_type: string
  is_shareable: boolean
  is_anonymous: boolean
  created_at: string
  status: string
}

export default async function DashboardPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar perfil do criador logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, daily_limit, questions_answered_today')
    .eq('id', user.id)
    .single()

  // Se não tem perfil ainda, redirecionar para setup
  if (!profile) redirect('/setup')

  // Buscar perguntas pendentes, ordenadas por valor (maior primeiro)
  const { data: questions } = await supabase
    .from('questions')
    .select('id, sender_name, content, price_paid, service_type, is_shareable, is_anonymous, created_at, status')
    .eq('creator_id', profile.id)
    .eq('status', 'pending')
    .order('price_paid', { ascending: false })
    .returns<Question[]>()

  // Métricas reais
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todayAnswered } = await supabase
    .from('questions')
    .select('price_paid')
    .eq('creator_id', profile.id)
    .eq('status', 'answered')
    .gte('answered_at', today.toISOString())

  const { count: totalAnswered } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('creator_id', profile.id)
    .eq('status', 'answered')

  const earningsToday = (todayAnswered ?? []).reduce(
    (sum, q) => sum + Number(q.price_paid) * 0.9, // desconta 10% da plataforma
    0
  )

  const pendingCount = questions?.length ?? 0
  const avatarUrl = profile.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="font-bold text-xl text-gradient-instagram">VOXA</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">@{profile.username}</span>
            <div className="w-10 h-10 rounded-full bg-gradient-instagram p-[2px]">
              <div className="w-full h-full rounded-full bg-white overflow-hidden">
                <img src={avatarUrl} alt={profile.username} className="object-cover w-full h-full" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Saudação */}
        <div className="mb-8 p-6 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] rounded-3xl text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <h2 className="text-3xl font-bold mb-2 relative z-10">Olá, @{profile.username}! 👋</h2>
          <p className="text-lg opacity-90 relative z-10">
            {pendingCount > 0
              ? `Você tem ${pendingCount} pergunta${pendingCount > 1 ? 's' : ''} pendente${pendingCount > 1 ? 's' : ''} aguardando resposta.`
              : 'Nenhuma pergunta pendente no momento. Compartilhe seu perfil para receber mais!'}
          </p>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Ganhos Hoje (líquido)</p>
            <p className="text-3xl font-bold text-green-600">
              R$ {earningsToday.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Respondidas Hoje</p>
            <p className="text-3xl font-bold">
              {profile.questions_answered_today}
              <span className="text-base text-gray-400 font-normal">/{profile.daily_limit}</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Total Respondido</p>
            <p className="text-3xl font-bold text-[#DD2A7B]">{totalAnswered ?? 0}</p>
          </div>
        </div>

        {/* Lista de perguntas (Client Component) */}
        <QuestionList
          questions={questions ?? []}
          creatorUsername={profile.username}
          creatorId={profile.id}
        />
      </main>
    </div>
  )
}
