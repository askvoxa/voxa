import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Params = { params: { id: string } }

export async function PATCH(req: Request, { params }: Params) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  if (!id?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }
  const { custom_creator_rate, custom_deadline_hours } = body

  // null = reset to platform default; undefined = don't touch
  const updates: Record<string, unknown> = {}

  if ('custom_creator_rate' in body) {
    if (custom_creator_rate === null) {
      updates.custom_creator_rate = null
    } else {
      const rate = Number(custom_creator_rate)
      if (isNaN(rate) || rate < 0.5 || rate > 1) {
        return NextResponse.json(
          { error: 'Percentual do criador deve estar entre 50% e 100%.' },
          { status: 400 }
        )
      }
      updates.custom_creator_rate = rate
    }
  }

  if ('custom_deadline_hours' in body) {
    if (custom_deadline_hours === null) {
      updates.custom_deadline_hours = null
    } else {
      const hours = Number(custom_deadline_hours)
      if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
        return NextResponse.json(
          { error: 'Prazo deve ser entre 1 e 720 horas.' },
          { status: 400 }
        )
      }
      updates.custom_deadline_hours = hours
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  console.log(`[admin/audit] Admin ${admin.id} alterou params do criador ${id}:`, JSON.stringify(updates))

  return NextResponse.json({ ok: true })
}
