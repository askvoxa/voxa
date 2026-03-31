/**
 * DEV ONLY: Endpoint para autenticação de testes
 * Permite criar/logar um test user sem Google OAuth
 * ⚠️ Remover em produção
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Apenas disponível em desenvolvimento
if (process.env.NODE_ENV === 'production') {
  throw new Error('[DEV API] test-auth não disponível em produção')
}

export async function POST(req: Request) {
  const { action, email, password, accountType } = await req.json()

  if (!action || !email || !password) {
    return NextResponse.json(
      { error: 'Parâmetros obrigatórios: action, email, password' },
      { status: 400 }
    )
  }

  if (action === 'signup') {
    try {
      // Criar test user com admin client
      const { data: { user }, error: signupError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (signupError || !user) {
        return NextResponse.json(
          { error: `Signup falhou: ${signupError?.message}` },
          { status: 400 }
        )
      }

      // Criar perfil
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          username: email.split('@')[0] + '_' + Math.random().toString(36).slice(2, 8),
          account_type: accountType || 'fan',
          is_active: true,
        })

      if (profileError) {
        return NextResponse.json(
          { error: `Perfil falhou: ${profileError.message}` },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        user: { id: user.id, email: user.email },
        message: 'Test user criado com sucesso',
      })
    } catch (e) {
      return NextResponse.json(
        { error: `Erro no signup: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 }
      )
    }
  }

  if (action === 'login') {
    try {
      // Login com cliente normal (não admin)
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.session) {
        return NextResponse.json(
          { error: `Login falhou: ${error?.message}` },
          { status: 401 }
        )
      }

      return NextResponse.json({
        success: true,
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          user: data.user,
        },
        message: 'Login bem-sucedido',
      })
    } catch (e) {
      return NextResponse.json(
        { error: `Erro no login: ${e instanceof Error ? e.message : String(e)}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(
    { error: 'Action inválida. Use: signup ou login' },
    { status: 400 }
  )
}
