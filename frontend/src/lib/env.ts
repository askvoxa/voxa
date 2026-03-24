/**
 * Validação de variáveis de ambiente obrigatórias.
 * Importar no topo de API routes que dependem de env vars sensíveis
 * para falhar rápido com mensagem clara em vez de `undefined!` silencioso.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`[env] Variável de ambiente obrigatória ausente: ${name}`)
  }
  return value
}

// Validação lazy (avalia apenas quando acessado pela primeira vez)
// Evita crash no build/import — falha apenas em runtime quando a var é usada
export const env = {
  get SUPABASE_URL() { return requireEnv('NEXT_PUBLIC_SUPABASE_URL') },
  get SUPABASE_ANON_KEY() { return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') },
  get SUPABASE_SERVICE_ROLE_KEY() { return requireEnv('SUPABASE_SERVICE_ROLE_KEY') },
  get MP_ACCESS_TOKEN() { return requireEnv('MP_ACCESS_TOKEN') },
  get MP_WEBHOOK_SECRET() { return requireEnv('MP_WEBHOOK_SECRET') },
  get APP_URL() { return requireEnv('NEXT_PUBLIC_APP_URL') },
}
