import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin: defaultOrigin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnUrl = searchParams.get('returnUrl') || ''
  const inviteCode = searchParams.get('inviteCode') || ''

  // No Render, o request.url vem como localhost. Devemos forçar pela ENV do app original.
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || defaultOrigin

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[auth/callback] Erro ao trocar código por sessão:', error.message)
    }

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, account_type, creator_setup_completed')
          .eq('id', user.id)
          .single()

        if (profile) {
          // Influencer que ainda não completou o setup de criador
          if (
            (profile.account_type === 'influencer' || profile.account_type === 'admin') &&
            !profile.creator_setup_completed
          ) {
            return NextResponse.redirect(`${origin}/setup/creator`)
          }

          // Se tem returnUrl, redirecionar para lá
          if (returnUrl) {
            // Validar que returnUrl é um path relativo seguro (bloqueia open redirect via //)
            const safeReturnUrl = (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) ? returnUrl : '/dashboard'
            return NextResponse.redirect(`${origin}${safeReturnUrl}`)
          }

          return NextResponse.redirect(`${origin}/dashboard`)
        }

        // Sem perfil: novo usuário — passar inviteCode e returnUrl via query params para o setup
        const setupParams = new URLSearchParams()
        if (inviteCode) setupParams.set('inviteCode', inviteCode)
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
          setupParams.set('returnUrl', returnUrl)
        }
        const setupQuery = setupParams.toString()

        return NextResponse.redirect(`${origin}/setup${setupQuery ? `?${setupQuery}` : ''}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
