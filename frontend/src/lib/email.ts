import { Resend } from 'resend'

const FROM_EMAIL = 'VOXA <noreply@askvoxa.com>'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — email não enviado')
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Notifica o fã por email que sua pergunta foi respondida.
 * Fire-and-forget — não deve bloquear o fluxo de resposta do criador.
 */
export async function sendResponseNotification({
  fanEmail,
  fanName,
  creatorUsername,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — notificação não enviada')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxa.com.br'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: 'Sua pergunta foi respondida! 🎉',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">VOXA</h1>
        </div>

        <p style="font-size: 16px; color: #333; margin-bottom: 8px;">Olá, <strong>${fanName}</strong>!</p>

        <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
          <strong>@${creatorUsername}</strong> acabou de responder sua pergunta na VOXA.
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${appUrl}/perfil/${creatorUsername}"
             style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Ver resposta
          </a>
        </div>

        <p style="font-size: 13px; color: #999; text-align: center;">
          Se você não fez essa pergunta, pode ignorar este email.
        </p>
      </div>
    `,
  })
}

/**
 * Notifica o fã que sua pergunta expirou e o reembolso está sendo processado.
 * Disparada quando a pergunta ultrapassa 36h sem resposta.
 */
export async function sendExpirationNotification({
  fanEmail,
  fanName,
  creatorUsername,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — notificação de expiração não enviada')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxa.com.br'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: 'Sua pergunta expirou — reembolso em andamento',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">VOXA</h1>
        </div>

        <p style="font-size: 16px; color: #333; margin-bottom: 8px;">Olá, <strong>${fanName}</strong>!</p>

        <p style="font-size: 16px; color: #333; margin-bottom: 8px;">
          Infelizmente, <strong>@${creatorUsername}</strong> não respondeu sua pergunta dentro do prazo.
        </p>

        <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
          Estamos processando seu reembolso. O valor será devolvido integralmente ao método de pagamento original.
        </p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${appUrl}"
             style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF); color: white; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
            Explorar criadores
          </a>
        </div>

        <p style="font-size: 13px; color: #999; text-align: center;">
          Você receberá outro email quando o reembolso for confirmado.
        </p>
      </div>
    `,
  })
}

/**
 * Notifica o criador que uma nova pergunta paga chegou.
 * Fire-and-forget — não deve bloquear o webhook de pagamento.
 */
export async function sendNewQuestionNotification(
  creatorEmail: string,
  creatorUsername: string,
  senderName: string,
  price: number,
  question: string,
  isAnonymous: boolean
) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxa.com.br'
  const displayName = isAnonymous ? 'Alguém (anônimo)' : senderName
  const net = (price * 0.9).toFixed(2)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `💬 Nova pergunta de R$${price.toFixed(2)} esperando resposta`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px">
        <div style="text-align:center;margin-bottom:32px">
          <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0">VOXA</h1>
        </div>
        <h2 style="color:#8134AF;margin-bottom:8px">Você recebeu uma nova pergunta!</h2>
        <p style="color:#333;margin-bottom:8px"><strong>${displayName}</strong> pagou <strong>R$${price.toFixed(2)}</strong> e quer sua resposta.</p>
        <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #DD2A7B">
          <p style="margin:0;color:#333">"${question.substring(0, 200)}${question.length > 200 ? '...' : ''}"</p>
        </div>
        <p style="color:#333">Você receberá <strong>R$${net}</strong> líquido ao responder.</p>
        <p style="color:#e53e3e;font-weight:bold">⏰ Prazo: 36 horas para responder (ou o fã recebe reembolso automático)</p>
        <div style="text-align:center;margin-top:24px">
          <a href="${appUrl}/dashboard"
             style="display:inline-block;background:linear-gradient(to right,#F58529,#DD2A7B,#8134AF);color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Responder agora →
          </a>
        </div>
      </div>
    `,
  })
}

/**
 * Envia lembrete de urgência ao criador para perguntas próximas de expirar.
 * Chamada pelo cron expire-questions nos thresholds de 6h, 12h e 24h.
 */
export async function sendUrgencyReminder({
  creatorEmail,
  creatorUsername,
  pendingCount,
  hoursUntilExpiry,
}: {
  creatorEmail: string
  creatorUsername: string
  pendingCount: number
  hoursUntilExpiry: number
}) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://voxa.com.br'

  const urgencyMap: Record<number, { emoji: string; color: string; msg: string }> = {
    24: { emoji: '⚠️', color: '#DD6B20', msg: 'Prazo vencendo em breve' },
    12: { emoji: '🔴', color: '#E53E3E', msg: 'Última chance — reembolso automático em 12h' },
    6:  { emoji: '🚨', color: '#C53030', msg: 'URGENTE — reembolso automático em 6h' },
  }

  const level = urgencyMap[hoursUntilExpiry] ?? {
    emoji: '⏰',
    color: '#8134AF',
    msg: `${hoursUntilExpiry}h para expirar`,
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `${level.emoji} ${pendingCount} pergunta(s) aguardando — ${level.msg}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px">
        <div style="text-align:center;margin-bottom:32px">
          <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0">VOXA</h1>
        </div>
        <h2 style="color:${level.color};margin-bottom:8px">${level.emoji} ${level.msg}</h2>
        <p style="color:#333">Você tem <strong>${pendingCount} pergunta(s)</strong> pendente(s) no dashboard.</p>
        <p style="color:#333">Se não responder no prazo, o fã recebe reembolso automático e sua taxa de resposta cai.</p>
        <div style="text-align:center;margin-top:24px">
          <a href="${appUrl}/dashboard"
             style="display:inline-block;background:${level.color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">
            Ir para o dashboard →
          </a>
        </div>
      </div>
    `,
  })
}

/**
 * Confirma ao fã que o reembolso foi processado com sucesso.
 * Disparada após o Mercado Pago confirmar o estorno.
 */
export async function sendRefundConfirmation({
  fanEmail,
  fanName,
  creatorUsername,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — confirmação de reembolso não enviada')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: 'Reembolso confirmado!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">VOXA</h1>
        </div>

        <p style="font-size: 16px; color: #333; margin-bottom: 8px;">Olá, <strong>${fanName}</strong>!</p>

        <p style="font-size: 16px; color: #333; margin-bottom: 8px;">
          Seu reembolso referente à pergunta para <strong>@${creatorUsername}</strong> foi processado com sucesso.
        </p>

        <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
          O valor será devolvido ao método de pagamento original. Dependendo do seu banco ou operadora, pode levar alguns dias úteis para aparecer.
        </p>

        <p style="font-size: 13px; color: #999; text-align: center;">
          Obrigado por usar a VOXA. Esperamos que tenha uma experiência melhor na próxima vez!
        </p>
      </div>
    `,
  })
}
