/**
 * Singleton supabaseAdmin client (service role).
 * Centraliza a criação do client para evitar duplicação em múltiplos arquivos.
 *
 * Uso:
 *   import { supabaseAdmin } from '@/lib/supabase/admin'
 *   const { data } = await supabaseAdmin.from('table').select()
 */

import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
