import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { validatePixKey, stripMask } from '@/lib/pix-validation'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Autenticação
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
  }

  // Parsing do body
  let body: { key_type: string; key_value: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const { key_type, key_value } = body

  // Validação do tipo
  if (key_type !== 'cpf' && key_type !== 'cnpj') {
    return NextResponse.json({ error: 'Tipo de chave inválido. Use cpf ou cnpj.' }, { status: 400 })
  }

  // Validação dos dígitos verificadores
  const rawValue = stripMask(key_value)
  if (!validatePixKey(key_type, rawValue)) {
    return NextResponse.json({ error: `${key_type.toUpperCase()} inválido.` }, { status: 400 })
  }

  const encryptionKey = process.env.PIX_ENCRYPTION_KEY
  if (!encryptionKey) {
    console.error('[payout/pix-key] PIX_ENCRYPTION_KEY não configurada')
    return NextResponse.json({ error: 'Erro interno de configuração.' }, { status: 500 })
  }

  // Operação atômica via RPC: desativa chave anterior + insere nova criptografada
  const { data: newKeyId, error: rpcError } = await supabaseAdmin
    .rpc('upsert_pix_key', {
      p_creator_id: user.id,
      p_key_type: key_type,
      p_key_value: rawValue,
      p_encryption_key: encryptionKey,
    })

  if (rpcError) {
    console.error('[payout/pix-key] Erro ao cadastrar chave:', rpcError.message)
    return NextResponse.json({ error: 'Erro ao cadastrar chave PIX.' }, { status: 500 })
  }

  // Buscar valor mascarado via RPC (sem expor valor real na API)
  const { data: masked } = await supabaseAdmin
    .rpc('get_masked_pix_key', {
      p_creator_id: user.id,
      p_encryption_key: encryptionKey,
    })

  const maskedValue = masked?.[0]?.masked_value ?? '***'

  console.log(`[payout/pix-key] Criador ${user.id} cadastrou chave ${key_type.toUpperCase()}: ${maskedValue}`)

  return NextResponse.json({
    success: true,
    key_type,
    masked_value: maskedValue,
  })
}

// GET — retorna a chave PIX ativa do criador (mascarada, via decriptação no DB)
export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
  }

  const encryptionKey = process.env.PIX_ENCRYPTION_KEY
  if (!encryptionKey) {
    console.error('[payout/pix-key] PIX_ENCRYPTION_KEY não configurada')
    return NextResponse.json({ error: 'Erro interno de configuração.' }, { status: 500 })
  }

  // Buscar chave mascarada via RPC (valor nunca sai decriptado do DB)
  const { data, error } = await supabaseAdmin
    .rpc('get_masked_pix_key', {
      p_creator_id: user.id,
      p_encryption_key: encryptionKey,
    })

  if (error || !data || data.length === 0) {
    return NextResponse.json({ has_key: false })
  }

  const key = data[0]
  return NextResponse.json({
    has_key: true,
    key_type: key.key_type,
    masked_value: key.masked_value,
    created_at: key.created_at,
  })
}
