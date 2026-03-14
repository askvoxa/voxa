import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin: defaultOrigin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // No Render, o request.url vem como localhost. Devemos forçar pela ENV do app original.
  const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || defaultOrigin

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Verificar se o criador já tem perfil cadastrado
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (profile) {
          return NextResponse.redirect(`${origin}/dashboard`)
        } else {
          return NextResponse.redirect(`${origin}/setup`)
        }
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
