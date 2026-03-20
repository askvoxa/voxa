import { Resend } from 'resend'

const FROM_EMAIL = 'VOXA <noreply@askvoxa.com>'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — email não enviado')
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

/** Envolve o conteúdo HTML com doctype e charset UTF-8 corretos para clientes de email */
function html(content: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VOXA</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;background:#ffffff">
    <div style="text-align:center;margin-bottom:32px">
      <div style="display:inline-block;background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);padding:2px 16px;border-radius:8px">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:2px">VOXA</span>
      </div>
    </div>
    ${content}
  </div>
</body>
</html>`
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
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `Sua pergunta foi respondida por @${creatorUsername}!`,
    html: html(`
      <p style="font-size:16px;color:#333;margin-bottom:8px">Olá, <strong>${fanName}</strong>!</p>
      <p style="font-size:16px;color:#333;margin-bottom:24px">
        <strong>@${creatorUsername}</strong> acabou de responder sua pergunta na VOXA.
      </p>
      <div style="text-align:center;margin-bottom:32px">
        <a href="${appUrl}/perfil/${creatorUsername}"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px">
          Ver resposta
        </a>
      </div>
      <p style="font-size:13px;color:#999;text-align:center">
        Se você não fez essa pergunta, pode ignorar este email.
      </p>
    `),
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
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `Sua pergunta para @${creatorUsername} expirou - reembolso em andamento`,
    html: html(`
      <p style="font-size:16px;color:#333;margin-bottom:8px">Olá, <strong>${fanName}</strong>!</p>
      <p style="font-size:16px;color:#333;margin-bottom:8px">
        Infelizmente, <strong>@${creatorUsername}</strong> não respondeu sua pergunta dentro do prazo de 36 horas.
      </p>
      <p style="font-size:16px;color:#333;margin-bottom:24px">
        Estamos processando seu reembolso. O valor será devolvido integralmente ao método de pagamento original.
      </p>
      <div style="text-align:center;margin-bottom:32px">
        <a href="${appUrl}"
           style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px">
          Explorar outros criadores
        </a>
      </div>
      <p style="font-size:13px;color:#999;text-align:center">
        Você receberá outro email quando o reembolso for confirmado.
      </p>
    `),
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
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: 'Reembolso confirmado pela VOXA',
    html: html(`
      <p style="font-size:16px;color:#333;margin-bottom:8px">Olá, <strong>${fanName}</strong>!</p>
      <p style="font-size:16px;color:#333;margin-bottom:8px">
        Seu reembolso referente à sua pergunta para <strong>@${creatorUsername}</strong> foi confirmado com sucesso.
      </p>
      <p style="font-size:16px;color:#333;margin-bottom:24px">
        O valor será devolvido ao método de pagamento original. Dependendo do seu banco ou operadora, pode levar alguns dias úteis para aparecer.
      </p>
      <p style="font-size:13px;color:#999;text-align:center">
        Obrigado por usar a VOXA. Esperamos que tenha uma experiência melhor na próxima vez!
      </p>
    `),
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'
  const displayName = isAnonymous ? 'Alguém (anônimo)' : senderName
  const net = (price * 0.9).toFixed(2)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `Nova pergunta de R$${price.toFixed(2)} aguardando resposta`,
    html: html(`
      <p style="color:#555;margin-bottom:4px">Ola, <strong>@${creatorUsername}</strong>!</p>
      <h2 style="color:#8134AF;margin-top:0;margin-bottom:8px">Voce recebeu uma nova pergunta!</h2>
      <p style="color:#333;margin-bottom:8px">
        <strong>${displayName}</strong> pagou <strong>R$${price.toFixed(2)}</strong> e quer sua resposta.
      </p>
      <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #DD2A7B">
        <p style="margin:0;color:#333;font-style:italic">"${question.substring(0, 300)}${question.length > 300 ? '...' : ''}"</p>
      </div>
      <p style="color:#333">Você receberá <strong>R$${net}</strong> líquido ao responder.</p>
      <div style="background:#fff3f3;border-radius:8px;padding:12px;margin:16px 0">
        <p style="margin:0;color:#c53030;font-weight:bold">
          Prazo: 36 horas para responder — após isso, o fã recebe reembolso automático.
        </p>
      </div>
      <div style="text-align:center;margin-top:24px">
        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:linear-gradient(to right,#F58529,#DD2A7B,#8134AF);color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Responder agora
        </a>
      </div>
    `),
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'

  const urgencyMap: Record<number, { borderColor: string; bgColor: string; textColor: string; msg: string }> = {
    24: { borderColor: '#DD6B20', bgColor: '#fffaf0', textColor: '#c05621', msg: 'Prazo vencendo em breve' },
    12: { borderColor: '#E53E3E', bgColor: '#fff5f5', textColor: '#c53030', msg: 'Ultima chance - reembolso automatico em 12h' },
    6:  { borderColor: '#C53030', bgColor: '#fff5f5', textColor: '#9b2c2c', msg: 'URGENTE - reembolso automatico em 6h' },
  }

  const level = urgencyMap[hoursUntilExpiry] ?? {
    borderColor: '#8134AF',
    bgColor: '#faf5ff',
    textColor: '#6b21a8',
    msg: `${hoursUntilExpiry}h para expirar`,
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `[VOXA] ${pendingCount} pergunta(s) aguardando - ${level.msg}`,
    html: html(`
      <div style="background:${level.bgColor};border-left:4px solid ${level.borderColor};border-radius:8px;padding:16px;margin-bottom:20px">
        <p style="margin:0;color:${level.textColor};font-weight:700;font-size:16px">${level.msg}</p>
      </div>
      <p style="color:#333">Olá, <strong>@${creatorUsername}</strong>!</p>
      <p style="color:#333">
        Você tem <strong>${pendingCount} pergunta(s)</strong> pendente(s) no dashboard.
      </p>
      <p style="color:#333">
        Se não responder no prazo, o fã recebe reembolso automático e sua taxa de resposta cai.
      </p>
      <div style="text-align:center;margin-top:24px">
        <a href="${appUrl}/dashboard"
           style="display:inline-block;background:${level.borderColor};color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Ir para o dashboard
        </a>
      </div>
    `),
  })
}
