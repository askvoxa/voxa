import { Resend } from 'resend'

const FROM_EMAIL = 'VOXA <noreply@askvoxa.com>'
const UNSUBSCRIBE_EMAIL = 'mailto:unsubscribe@askvoxa.com'

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — email não enviado')
    return null
  }
  return new Resend(process.env.RESEND_API_KEY)
}

/** Headers padrão incluindo List-Unsubscribe para compliance */
const UNSUBSCRIBE_HEADERS = {
  'List-Unsubscribe': `<${UNSUBSCRIBE_EMAIL}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}

/* ─── Layout base ────────────────────────────────────────────────────────── */

function emailLayout(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<span style="display:none;font-size:1px;color:#111111;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</span>`
    : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VOXA</title>
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#1a1a1a;border-radius:16px;overflow:hidden">
          <!-- Header gradient bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#F58529 0%,#DD2A7B 50%,#8134AF 100%);font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <!-- Logo -->
          <tr>
            <td align="center" style="padding:32px 32px 0">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);padding:6px 20px;border-radius:10px">
                    <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:3px;text-decoration:none">VOXA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:28px 32px 32px">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:0 32px 28px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-top:1px solid #2a2a2a;padding-top:20px">
                    <p style="margin:0;font-size:12px;color:#666;text-align:center;line-height:18px">
                      Este email foi enviado automaticamente pela
                      <span style="color:#DD2A7B;font-weight:600">VOXA</span>
                      — plataforma de perguntas pagas para criadores.
                    </p>
                    <p style="margin:8px 0 0;font-size:11px;color:#555;text-align:center">
                      askvoxa.com
                    </p>
                    <p style="margin:8px 0 0;font-size:11px;color:#555;text-align:center">
                      <a href="${UNSUBSCRIBE_EMAIL}" style="color:#555;text-decoration:underline">Cancelar inscrição</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Botão CTA padronizado com gradiente VOXA */
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:8px 0">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="21%" fillcolor="#DD2A7B" stroke="f">
        <v:textbox><center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${label}</center></v:textbox>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;line-height:20px;text-align:center;min-width:180px">
        ${label}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`
}

/** Formata valor em BRL: R$ 10,00 */
function brl(n: number): string {
  return `R$\u00A0${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Retorna "pergunta" ou "perguntas" conforme a contagem */
function pluralPerguntas(n: number): string {
  return n === 1 ? 'pergunta' : 'perguntas'
}

/* ─── Emails para Criadores ─────────────────────────────────────────────── */

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
  isAnonymous: boolean,
  creatorNet: number
) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'
  const displayName = isAnonymous ? 'Alguém (anônimo)' : senderName
  const deadlineHours = Number(process.env.RESPONSE_DEADLINE_HOURS ?? 36)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `Nova pergunta de ${brl(price)} aguardando resposta`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <p style="margin:0 0 4px;font-size:14px;color:#999">Olá, <span style="color:#ccc;font-weight:600">@${creatorUsername}</span></p>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff">Nova pergunta recebida!</h1>

      <!-- Info row -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
        <tr>
          <td style="background:#222;border-radius:10px;padding:16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:8px">
                  <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Enviado por</span><br>
                  <span style="font-size:15px;color:#eee;font-weight:600">${displayName}</span>
                </td>
                <td align="right" style="padding-bottom:8px">
                  <span style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px">Valor pago</span><br>
                  <span style="font-size:15px;color:#DD2A7B;font-weight:700">${brl(price)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Question content -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
        <tr>
          <td style="border-left:3px solid #DD2A7B;padding:14px 16px;background:#222;border-radius:0 8px 8px 0">
            <p style="margin:0;font-size:15px;color:#ddd;line-height:22px;font-style:italic">"${question.substring(0, 300)}${question.length > 300 ? '...' : ''}"</p>
          </td>
        </tr>
      </table>

      <!-- Net earnings -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td style="background:linear-gradient(135deg,rgba(129,52,175,0.15),rgba(221,42,123,0.15));border:1px solid #333;border-radius:10px;padding:14px 16px;text-align:center">
            <span style="font-size:13px;color:#aaa">Você receberá</span><br>
            <span style="font-size:22px;font-weight:800;color:#ffffff">${brl(creatorNet)}</span>
            <span style="font-size:13px;color:#aaa"> líquido</span>
          </td>
        </tr>
      </table>

      ${ctaButton(`${appUrl}/dashboard`, 'Responder agora')}

      <!-- Deadline warning -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px">
        <tr>
          <td style="background:rgba(197,48,48,0.1);border:1px solid rgba(197,48,48,0.3);border-radius:8px;padding:12px 14px;text-align:center">
            <p style="margin:0;font-size:13px;color:#f87171;font-weight:600;line-height:18px">
              ⏰ Prazo: ${deadlineHours} horas — após isso, o fã recebe reembolso automático.
            </p>
          </td>
        </tr>
      </table>
    `, `Nova pergunta de ${brl(price)} — responda em até ${deadlineHours}h`),
  })
}

/**
 * Notifica o criador que recebeu um apoio financeiro (tip).
 * Fire-and-forget — não deve bloquear o webhook de pagamento.
 */
export async function sendSupportNotification({
  creatorEmail,
  creatorUsername,
  senderName,
  amount,
  isAnonymous,
}: {
  creatorEmail: string
  creatorUsername: string
  senderName: string
  amount: number
  isAnonymous: boolean
}) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'
  const displayName = isAnonymous ? 'Alguém (anônimo)' : senderName

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `Você recebeu um apoio de ${brl(amount)}!`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <p style="margin:0 0 4px;font-size:14px;color:#999">Olá, <span style="color:#ccc;font-weight:600">@${creatorUsername}</span></p>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#ffffff">Novo apoio recebido!</h1>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td style="background:linear-gradient(135deg,rgba(129,52,175,0.15),rgba(221,42,123,0.15));border:1px solid #333;border-radius:10px;padding:20px 16px;text-align:center">
            <span style="font-size:13px;color:#aaa">Apoio de</span><br>
            <span style="font-size:15px;color:#eee;font-weight:600">${displayName}</span><br>
            <span style="font-size:28px;font-weight:800;color:#DD2A7B;display:inline-block;margin-top:8px">${brl(amount)}</span>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:15px;color:#ccc;line-height:22px;text-align:center">
        Seu trabalho está sendo valorizado! Continue criando conteúdo incrível.
      </p>

      ${ctaButton(`${appUrl}/dashboard`, 'Ver no dashboard')}
    `, `${displayName} enviou ${brl(amount)} de apoio para você`),
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

  const urgencyMap: Record<number, { color: string; msg: string }> = {
    24: { color: '#DD6B20', msg: 'Prazo vencendo em breve' },
    12: { color: '#E53E3E', msg: 'Última chance — reembolso automático em 12h' },
    6:  { color: '#C53030', msg: 'URGENTE — reembolso automático em 6h' },
  }

  const level = urgencyMap[hoursUntilExpiry] ?? {
    color: '#8134AF',
    msg: `${hoursUntilExpiry}h para expirar`,
  }

  const plural = pluralPerguntas(pendingCount)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `[VOXA] ${pendingCount} ${plural} aguardando — ${level.msg}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <!-- Urgency banner -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td style="background:rgba(197,48,48,0.12);border-left:4px solid ${level.color};border-radius:0 8px 8px 0;padding:14px 16px">
            <p style="margin:0;font-size:16px;color:${level.color};font-weight:700">${level.msg}</p>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:15px;color:#ccc">Olá, <span style="color:#fff;font-weight:600">@${creatorUsername}</span></p>
      <p style="margin:0 0 8px;font-size:15px;color:#ccc;line-height:22px">
        Você tem <strong style="color:#fff">${pendingCount} ${plural}</strong> pendente${pendingCount > 1 ? 's' : ''} no dashboard.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#999;line-height:20px">
        Se não responder no prazo, o fã recebe reembolso automático e sua taxa de resposta cai.
      </p>

      ${ctaButton(`${appUrl}/dashboard`, 'Ir para o dashboard')}
    `, `${pendingCount} ${plural} pendente${pendingCount > 1 ? 's' : ''} — ${level.msg}`),
  })
}

/* ─── Emails para Fãs ───────────────────────────────────────────────────── */

/**
 * Notifica o fã por email que sua pergunta foi respondida.
 * Fire-and-forget — não deve bloquear o fluxo de resposta do criador.
 */
export async function sendResponseNotification({
  fanEmail,
  fanName,
  creatorUsername,
  questionId,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
  questionId: string
}) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `@${creatorUsername} respondeu sua pergunta!`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <p style="margin:0 0 4px;font-size:14px;color:#999">Olá, <span style="color:#ccc;font-weight:600">${fanName}</span></p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff">Sua pergunta foi respondida!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#ccc;line-height:22px">
        <strong style="color:#DD2A7B">@${creatorUsername}</strong> acabou de responder sua pergunta na VOXA.
      </p>

      ${ctaButton(`${appUrl}/perfil/${creatorUsername}?q=${questionId}`, 'Ver resposta')}

      <p style="margin:20px 0 0;font-size:12px;color:#666;text-align:center">
        Se você não fez essa pergunta, pode ignorar este email.
      </p>
    `, `@${creatorUsername} respondeu — clique para ver`),
  })
}

/**
 * Notifica o fã que sua pergunta expirou e o reembolso está sendo processado.
 * Disparada quando a pergunta ultrapassa o prazo sem resposta.
 */
export async function sendExpirationNotification({
  fanEmail,
  fanName,
  creatorUsername,
  amount,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
  amount: number
}) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `Sua pergunta para @${creatorUsername} expirou — reembolso de ${brl(amount)} em andamento`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <p style="margin:0 0 4px;font-size:14px;color:#999">Olá, <span style="color:#ccc;font-weight:600">${fanName}</span></p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff">Pergunta expirada</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#ccc;line-height:22px">
        Infelizmente, <strong style="color:#DD2A7B">@${creatorUsername}</strong> não respondeu sua pergunta dentro do prazo.
      </p>

      <!-- Refund amount -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px">
        <tr>
          <td style="background:#222;border-radius:10px;padding:16px;text-align:center">
            <span style="font-size:13px;color:#aaa">Valor a ser reembolsado</span><br>
            <span style="font-size:22px;font-weight:800;color:#4ade80">${brl(amount)}</span>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:15px;color:#ccc;line-height:22px">
        O valor será devolvido integralmente ao método de pagamento original. Dependendo do seu banco, pode levar alguns dias úteis.
      </p>

      ${ctaButton(`${appUrl}`, 'Explorar outros criadores')}
    `, `Reembolso de ${brl(amount)} em processamento — pergunta para @${creatorUsername} expirou`),
  })
}

/**
 * Notifica o fã que sua pergunta foi rejeitada pelo criador e o reembolso está sendo processado.
 */
export async function sendRejectionNotification({
  fanEmail,
  fanName,
  creatorUsername,
  amount,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
  amount: number
}) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `Sua pergunta para @${creatorUsername} foi recusada — reembolso de ${brl(amount)}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <p style="margin:0 0 4px;font-size:14px;color:#999">Olá, <span style="color:#ccc;font-weight:600">${fanName}</span></p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff">Pergunta recusada</h1>
      <p style="margin:0 0 8px;font-size:15px;color:#ccc;line-height:22px">
        <strong style="color:#DD2A7B">@${creatorUsername}</strong> optou por não responder sua pergunta.
      </p>

      <!-- Refund amount -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 24px">
        <tr>
          <td style="background:#222;border-radius:10px;padding:16px;text-align:center">
            <span style="font-size:13px;color:#aaa">Valor do reembolso</span><br>
            <span style="font-size:22px;font-weight:800;color:#4ade80">${brl(amount)}</span>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:15px;color:#ccc;line-height:22px">
        O reembolso será processado automaticamente. Dependendo do seu banco ou operadora, pode levar alguns dias úteis para aparecer.
      </p>

      ${ctaButton(`${appUrl}`, 'Explorar outros criadores')}
    `, `Reembolso de ${brl(amount)} — sua pergunta para @${creatorUsername} foi recusada`),
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
  amount,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
  amount: number
}) {
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `Reembolso de ${brl(amount)} confirmado — VOXA`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <p style="margin:0 0 4px;font-size:14px;color:#999">Olá, <span style="color:#ccc;font-weight:600">${fanName}</span></p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff">Reembolso confirmado</h1>

      <!-- Refund amount -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px">
        <tr>
          <td style="background:#222;border-radius:10px;padding:16px;text-align:center">
            <span style="font-size:13px;color:#aaa">Valor reembolsado</span><br>
            <span style="font-size:22px;font-weight:800;color:#4ade80">${brl(amount)}</span>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 8px;font-size:15px;color:#ccc;line-height:22px">
        Seu reembolso referente à pergunta para <strong style="color:#DD2A7B">@${creatorUsername}</strong> foi confirmado com sucesso.
      </p>
      <p style="margin:0 0 0;font-size:15px;color:#ccc;line-height:22px">
        O valor será devolvido ao método de pagamento original. Dependendo do seu banco ou operadora, pode levar alguns dias úteis para aparecer.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px">
        <tr>
          <td style="text-align:center">
            <p style="margin:0;font-size:13px;color:#888">
              Obrigado por usar a VOXA. Esperamos vê-lo novamente!
            </p>
          </td>
        </tr>
      </table>
    `, `Reembolso de ${brl(amount)} confirmado para sua pergunta`),
  })
}
