import { createClient } from '@/lib/supabase/server'

/**
 * Verifica se o usuário autenticado tem is_admin = true.
 * Retorna o user object se for admin, null caso contrário.
 * Usar em API Routes para verificação de autorização.
 */
export async function getAdminUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return profile?.is_admin ? user : null
}

/**
 * Verifica se o usuário autenticado tem is_admin = true.
 * Para uso em Server Components (defense in depth além do middleware).
 * Retorna o user ID se for admin, null caso contrário.
 */
export async function requireAdmin(): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return profile?.is_admin ? user.id : null
}
