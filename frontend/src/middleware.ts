import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Atualiza a sessão (necessário para manter o cookie fresh)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Rotas protegidas: exigem login
  if ((pathname.startsWith('/dashboard') || pathname.startsWith('/setup')) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Query de perfil única para todas as rotas que precisam (evita múltiplas queries)
  // Campos: account_type (admin check), creator_setup_completed e approval_status (setup flow)
  const needsProfile = user && (
    pathname.startsWith('/admin') || pathname.startsWith('/api/admin') ||
    pathname.startsWith('/dashboard') || pathname.startsWith('/setup') ||
    pathname === '/'
  )

  const profile = needsProfile
    ? (await supabase
        .from('profiles')
        .select('id, account_type, creator_setup_completed, approval_status')
        .eq('id', user!.id)
        .single()
      ).data
    : null

  // Rotas admin (páginas e API): exigem login + account_type = 'admin'
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const isApiRoute = pathname.startsWith('/api/admin')
    if (!user) {
      return isApiRoute
        ? NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url))
    }
    if (profile?.account_type !== 'admin') {
      return isApiRoute
        ? NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
        : NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Proteção de rotas autenticadas que dependem do perfil
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/setup'))) {
    // /setup: se já tem perfil, redirecionar
    if (pathname === '/setup' && profile) {
      // Influencer sem setup completo e sem solicitação pendente → /setup/creator
      if ((profile.account_type === 'influencer' || profile.account_type === 'admin') && !profile.creator_setup_completed && profile.approval_status !== 'pending_review' && profile.approval_status !== 'approved') {
        return NextResponse.redirect(new URL('/setup/creator', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // /setup/creator: precisa ter perfil e não ter setup completo
    // Fans podem acessar para solicitar virar criador (cadastro aberto com aprovação)
    if (pathname === '/setup/creator' || pathname.startsWith('/setup/creator')) {
      if (!profile) {
        return NextResponse.redirect(new URL('/setup', request.url))
      }
      // Setup completo ou solicitação já enviada (pending/approved) → dashboard
      if (profile.account_type === 'influencer' || profile.account_type === 'admin') {
        if (profile.creator_setup_completed || profile.approval_status === 'pending_review' || profile.approval_status === 'approved') {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      }
    }

    // /dashboard: influencer sem setup e sem solicitação enviada → forçar setup
    // Exceções: pending_review (aguardando aprovação), approved (aprovado) e rejected (pode ver motivo e reenviar)
    if (pathname.startsWith('/dashboard') && profile) {
      if ((profile.account_type === 'influencer' || profile.account_type === 'admin') && !profile.creator_setup_completed && profile.approval_status !== 'pending_review' && profile.approval_status !== 'approved' && profile.approval_status !== 'rejected') {
        return NextResponse.redirect(new URL('/setup/creator', request.url))
      }
    }


  }

  // Se já está logado e tenta acessar /login, redireciona para /dashboard
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Homepage: se autenticado mas sem perfil, redirecionar para /setup
  // (safety net para quando o Supabase redireciona para a homepage após OAuth
  //  em vez do nosso /auth/callback)
  if (pathname === '/' && user && !profile) {
    return NextResponse.redirect(new URL('/setup', request.url))
  }

  return response
}

export const config = {
  // Cobrir todas as rotas exceto arquivos estáticos e _next
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
