import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { validatePixKey, stripMask, maskPixKey } from '@/lib/pix-validation'

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

  // Desativar chave anterior (se existir)
  await supabaseAdmin
    .from('creator_pix_keys')
    .update({ is_active: false })
    .eq('creator_id', user.id)
    .eq('is_active', true)

  // Inserir nova chave (valor armazenado — em produção, encriptar via pgp_sym_encrypt)
  const { error: insertError } = await supabaseAdmin
    .from('creator_pix_keys')
    .insert({
      creator_id: user.id,
      key_type,
      key_value: rawValue,
      is_active: true,
    })

  if (insertError) {
    console.error('[payout/pix-key] Erro ao inserir chave:', insertError.message)
    return NextResponse.json({ error: 'Erro ao cadastrar chave PIX.' }, { status: 500 })
  }

  const masked = maskPixKey(key_type, rawValue)
  console.log(`[payout/pix-key] Criador ${user.id} cadastrou chave ${key_type.toUpperCase()}: ${masked}`)

  return NextResponse.json({
    success: true,
    key_type,
    masked_value: masked,
  })
}

// GET — retorna a chave PIX ativa do criador (mascarada)
export async function GET() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
  }

  const { data } = await supabaseAdmin
    .from('creator_pix_keys')
    .select('id, key_type, key_value, created_at')
    .eq('creator_id', user.id)
    .eq('is_active', true)
    .single()

  if (!data) {
    return NextResponse.json({ has_key: false })
  }

  return NextResponse.json({
    has_key: true,
    key_type: data.key_type,
    masked_value: maskPixKey(data.key_type as 'cpf' | 'cnpj', data.key_value),
    created_at: data.created_at,
  })
}
