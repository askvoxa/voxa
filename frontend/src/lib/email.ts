import { Resend } from 'resend'

const FROM_EMAIL = 'VOXA <noreply@askvoxa.com>'
const UNSUBSCRIBE_EMAIL = 'mailto:unsubscribe@askvoxa.com'

/** Escapa caracteres HTML para prevenir injeção em templates de email */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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
    ? `<span style="display:none;font-size:1px;color:#FCF9F8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${preheader}</span>`
    : ''

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VOXA</title>
</head>
<body style="margin:0;padding:0;background-color:#FCF9F8;font-family:'Plus Jakarta Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FCF9F8">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border-radius:24px;border:1px solid rgba(233, 188, 182, 0.4);overflow:hidden;box-shadow:0px 20px 40px rgba(28,27,27,0.06)">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 32px 0;border-bottom:1px solid #F0EDEC;padding-bottom:32px">
              <span style="font-size:28px;font-weight:900;color:#BC000A;letter-spacing:-1px;text-decoration:none">
                VOXA
              </span>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:48px 32px">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:0;background-color:#F6F3F2">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:40px 32px">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#5F3F3A;opacity:0.6;letter-spacing:1.5px;text-transform:uppercase">
                      <span style="margin:0 12px">PRIVACY</span>
                      <span style="margin:0 12px">SUPPORT</span>
                      <span style="margin:0 12px">TERMS</span>
                    </p>
                    <p style="margin:0 0 12px;font-size:10px;color:#5F3F3A;opacity:0.4;letter-spacing:2px;text-transform:uppercase;line-height:1.6">
                      © 2026 VOXA Platform. Curated Excellence.<br/>
                      Este e-mail foi enviado automaticamente.
                    </p>
                    <p style="margin:0;font-size:11px;color:#5F3F3A;opacity:0.6">
                      <a href="${UNSUBSCRIBE_EMAIL}" style="color:#5F3F3A;text-decoration:underline">Cancelar inscrição</a>
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

/** Botão CTA padronizado com gradiente vibrante VOXA */
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:16px 0">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:56px;v-text-anchor:middle;width:240px;" arcsize="50%" fillcolor="#FD1D1D" stroke="f">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:bold;">${label}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#FD1D1D,#FCB045);background-color:#FD1D1D;color:#ffffff;text-decoration:none;border-radius:9999px;font-weight:700;font-size:16px;line-height:24px;text-align:center;box-shadow:0px 8px 16px rgba(253,29,29,0.2)">
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
  const displayName = escapeHtml(isAnonymous ? 'Alguém (anônimo)' : senderName)
  const safeUsername = escapeHtml(creatorUsername)
  const deadlineHours = Number(process.env.RESPONSE_DEADLINE_HOURS ?? 36)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `[VOXA] Nova pergunta de ${brl(price)} aguardando resposta`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Você recebeu uma nova pergunta!</h1>
        <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#5F3F3A">Olá, @${safeUsername}. <strong style="color:#1C1B1B">${displayName}</strong> enviou uma pergunta e está aguardando sua resposta.</p>

        <!-- Price/Value Highlight -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F6F3F2;border-radius:16px;padding:24px 32px;min-width:280px">
                <tr>
                  <td align="center">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5F3F3A;font-weight:700;display:block;margin-bottom:8px;opacity:0.8">VALOR DA RESPOSTA</span>
                    <span style="font-size:36px;font-weight:900;color:#BC000A">${brl(price)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- User Detail and Question Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background-color:#F6F3F2;border-radius:16px;padding:24px;text-align:left">
          <tr>
            <td>
              <div style="margin-bottom:16px;font-size:15px;font-weight:700;color:#1C1B1B">
                Enviado por: ${displayName}
              </div>
              <div style="background-color:#FFFFFF;padding:20px;border-radius:12px;border:1px solid rgba(233,188,182,0.3);font-style:italic;color:#1C1B1B;line-height:1.6;font-size:15px">
                "${escapeHtml(question.substring(0, 300))}${question.length > 300 ? '...' : ''}"
              </div>
            </td>
          </tr>
        </table>

        <!-- Net Earnings -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
          <tr>
            <td align="center">
               <span style="font-size:14px;color:#5F3F3A">Você receberá <strong style="color:#1C1B1B">${brl(creatorNet)}</strong> líquido.</span>
            </td>
          </tr>
        </table>

        ${ctaButton(`${appUrl}/dashboard`, 'Responder agora')}

        <!-- Deadline warning -->
        <p style="margin:24px 0 0;font-size:13px;color:#ba1a1a;font-weight:600">
          ⏰ Prazo: ${deadlineHours} horas — após isso, o fã recebe reembolso automático.
        </p>
      </div>
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
  const displayName = escapeHtml(isAnonymous ? 'Alguém (anônimo)' : senderName)
  const safeUsername = escapeHtml(creatorUsername)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `[VOXA] Você recebeu um apoio de ${brl(amount)}!`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <h1 style="margin:0 0 12px;font-size:32px;font-weight:800;color:#1C1B1B;letter-spacing:-1px">Novo apoio recebido!</h1>
        <p style="margin:0 0 32px;font-size:16px;line-height:1.5;color:#5F3F3A">Olá, @${safeUsername}. Alguém valoriza o seu conteúdo e acabou de enviar um apoio financeiro direto pra você.</p>

        <!-- Value Highlight Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:40px">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border:1px solid rgba(233,188,182,0.4);border-radius:24px;padding:40px 32px;width:100%;max-width:320px;box-shadow:0px 10px 30px rgba(0,0,0,0.03)">
                <tr>
                  <td align="center" style="padding-bottom:24px">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#888888;font-weight:700;display:block;margin-bottom:12px">VALOR APOIADO</span>
                    <span style="font-size:48px;font-weight:900;color:#BC000A;line-height:1">${brl(amount)}</span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F6F3F2;border-radius:999px;padding:12px 24px">
                      <tr>
                        <td style="font-size:14px;font-weight:700;color:#1C1B1B">
                          Enviado por <span style="color:#5F3F3A">${displayName}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${ctaButton(`${appUrl}/dashboard`, 'Ver no dashboard')}
      </div>
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

  const urgencyMap: Record<number, { color: string; bg: string; msg: string }> = {
    24: { color: '#BC000A', bg: '#fef2f2', msg: 'Prazo vencendo em breve' },
    12: { color: '#b91c1c', bg: '#fef2f2', msg: 'Última chance — reembolso em 12h' },
    6:  { color: '#991b1b', bg: '#fef2f2', msg: 'URGENTE — Reembolso automático em 6h' },
  }

  const level = urgencyMap[hoursUntilExpiry] ?? {
    color: '#8138b2',
    bg: '#f3e8ff',
    msg: `${hoursUntilExpiry}h para expirar`,
  }

  const plural = pluralPerguntas(pendingCount)

  await resend.emails.send({
    from: FROM_EMAIL,
    to: creatorEmail,
    subject: `[VOXA] ${pendingCount} ${plural} aguardando — ${level.msg}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <!-- Urgency banner -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background-color:${level.bg};border-radius:12px;border:1px solid rgba(188,0,10,0.1)">
          <tr>
            <td style="padding:16px;text-align:center">
              <p style="margin:0;font-size:15px;color:${level.color};font-weight:700;letter-spacing:0.5px">${level.msg}</p>
            </td>
          </tr>
        </table>

        <h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Atenção, @${escapeHtml(creatorUsername)}!</h1>
        <p style="margin:0 0 16px;font-size:16px;color:#5F3F3A;line-height:1.5">
          Você tem <strong style="color:#1C1B1B;font-size:18px">${pendingCount} ${plural}</strong> pendente${pendingCount > 1 ? 's' : ''} no dashboard.
        </p>
        <p style="margin:0 auto 40px;font-size:14px;color:#888888;line-height:1.6;max-width:85%">
          Se não responder no prazo, o fã recebe reembolso automático e a sua taxa de resposta na plataforma será prejudicada.
        </p>

        ${ctaButton(`${appUrl}/dashboard`, 'Ir para o dashboard')}
      </div>
    `, `${pendingCount} ${plural} pendente${pendingCount > 1 ? 's' : ''} — ${level.msg}`),
  })
}

/* ─── Emails para Fãs ───────────────────────────────────────────────────── */

/**
 * Confirma ao fã que sua pergunta paga foi recebida e está aguardando resposta.
 * Fire-and-forget — não deve bloquear o webhook de pagamento.
 */
export async function sendQuestionConfirmation({
  fanEmail,
  fanName,
  creatorUsername,
  amount,
  question,
  questionId,
}: {
  fanEmail: string
  fanName: string
  creatorUsername: string
  amount: number
  question: string
  questionId: string
}) {
  const resend = getResend()
  if (!resend) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://askvoxa.com'
  const deadlineHours = Number(process.env.RESPONSE_DEADLINE_HOURS ?? 36)
  const safeCreator = escapeHtml(creatorUsername)
  // Fallback defensivo: sender_name pode vir vazio em casos extremos
  const safeFanName = escapeHtml(fanName || 'Fã')
  // Truncar a pergunta para evitar emails excessivamente longos
  const safeQuestion = escapeHtml(question.substring(0, 300)) + (question.length > 300 ? '...' : '')

  await resend.emails.send({
    from: FROM_EMAIL,
    to: fanEmail,
    subject: `[VOXA] Sua pergunta para @${creatorUsername} foi enviada com sucesso!`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">

        <!-- Ícone de confirmação -->
        <div style="display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;background-color:#F6F3F2;border-radius:50%;margin-bottom:24px">
          <span style="font-size:28px">✓</span>
        </div>

        <h1 style="margin:0 0 12px;font-size:28px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Pergunta enviada!</h1>
        <p style="margin:0 auto 32px;font-size:16px;line-height:1.6;color:#5F3F3A;max-width:90%">
          Olá, <strong style="color:#1C1B1B">${safeFanName}</strong>. Sua pergunta para <strong style="color:#BC000A">@${safeCreator}</strong> foi recebida e está aguardando resposta.
        </p>

        <!-- Card com valor pago -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F6F3F2;border-radius:16px;padding:24px 32px;min-width:280px">
                <tr>
                  <td align="center">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5F3F3A;font-weight:700;display:block;margin-bottom:8px;opacity:0.8">VALOR PAGO</span>
                    <span style="font-size:36px;font-weight:900;color:#BC000A">${brl(amount)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Card com trecho da pergunta -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background-color:#F6F3F2;border-radius:16px;padding:24px;text-align:left">
          <tr>
            <td>
              <div style="margin-bottom:12px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5F3F3A;font-weight:700;opacity:0.8">SUA PERGUNTA</div>
              <div style="background-color:#FFFFFF;padding:20px;border-radius:12px;border:1px solid rgba(233,188,182,0.3);font-style:italic;color:#1C1B1B;line-height:1.6;font-size:15px">
                "${safeQuestion}"
              </div>
            </td>
          </tr>
        </table>

        <!-- Banner de prazo com aviso de reembolso -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background-color:#fef2f2;border-radius:12px;border:1px solid rgba(188,0,10,0.1)">
          <tr>
            <td style="padding:16px 20px;text-align:center">
              <p style="margin:0;font-size:14px;color:#BC000A;font-weight:600;line-height:1.6">
                ⏰ <strong>@${safeCreator}</strong> tem até <strong>${deadlineHours} horas</strong> para responder.<br/>
                <span style="font-size:13px;font-weight:400;color:#5F3F3A">Se não houver resposta no prazo, você receberá reembolso integral automaticamente.</span>
              </p>
            </td>
          </tr>
        </table>

        ${ctaButton(`${appUrl}/perfil/${creatorUsername}?q=${questionId}`, `Ver perfil de @${creatorUsername}`)}

        <p style="margin:32px 0 0;font-size:12px;color:#A1A1AA;line-height:1.6">
          Se você não fez essa pergunta ou não reconhece esta transação,<br/>entre em contato com o suporte em <a href="mailto:suporte@askvoxa.com" style="color:#BC000A;text-decoration:none">suporte@askvoxa.com</a>.
        </p>
      </div>
    `, `Sua pergunta para @${creatorUsername} foi enviada — aguardando resposta`),
  })
}

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
    subject: `[VOXA] @${creatorUsername} respondeu sua pergunta!`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Sua pergunta foi respondida!</h1>
        <p style="margin:0 auto 36px;font-size:16px;line-height:1.6;color:#5F3F3A;max-width:90%">
          Olá, <strong style="color:#1C1B1B">${escapeHtml(fanName)}</strong>. <strong style="color:#BC000A">@${escapeHtml(creatorUsername)}</strong> acabou de responder à sua pergunta na VOXA. Entre para conferir o conteúdo exclusivo!
        </p>

        ${ctaButton(`${appUrl}/perfil/${creatorUsername}?q=${questionId}`, 'Ver resposta')}

        <p style="margin:40px 0 0;font-size:12px;color:#A1A1AA">
          Se você não fez essa pergunta, pode ignorar este e-mail.
        </p>
      </div>
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
    subject: `[VOXA] Sua pergunta para @${creatorUsername} expirou — Reembolso de ${brl(amount)} em andamento`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Pergunta expirada</h1>
        <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#5F3F3A">
          Olá, <strong style="color:#1C1B1B">${escapeHtml(fanName)}</strong>. Infelizmente, <strong style="color:#BC000A">@${escapeHtml(creatorUsername)}</strong> não teve a oportunidade de responder sua pergunta dentro do prazo.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F6F3F2;border-radius:16px;padding:24px 32px;min-width:280px">
                <tr>
                  <td align="center">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5F3F3A;font-weight:700;display:block;margin-bottom:8px;opacity:0.8">VALOR A SER REEMBOLSADO</span>
                    <span style="font-size:36px;font-weight:900;color:#16a34a">${brl(amount)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="margin:0 auto 36px;font-size:14px;color:#5F3F3A;line-height:1.6;max-width:90%">
          O valor será devolvido integralmente ao método de pagamento original. Dependendo do seu banco ou administradora do cartão, pode levar alguns dias úteis para aparecer.
        </p>

        ${ctaButton(`${appUrl}`, 'Explorar outros criadores')}
      </div>
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
    subject: `[VOXA] Sua pergunta para @${creatorUsername} foi recusada — Reembolso de ${brl(amount)}`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Pergunta recusada</h1>
        <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#5F3F3A">
          Olá, <strong style="color:#1C1B1B">${escapeHtml(fanName)}</strong>. <strong style="color:#BC000A">@${escapeHtml(creatorUsername)}</strong> optou por não responder sua pergunta neste momento.
        </p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F6F3F2;border-radius:16px;padding:24px 32px;min-width:280px">
                <tr>
                  <td align="center">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5F3F3A;font-weight:700;display:block;margin-bottom:8px;opacity:0.8">VALOR DO REEMBOLSO</span>
                    <span style="font-size:36px;font-weight:900;color:#16a34a">${brl(amount)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="margin:0 auto 36px;font-size:14px;color:#5F3F3A;line-height:1.6;max-width:90%">
          O reembolso será processado automaticamente para o seu método de pagamento original. Dependendo da sua bandeira, pode levar alguns dias úteis para crédito na fatura.
        </p>

        ${ctaButton(`${appUrl}`, 'Explorar outros criadores')}
      </div>
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
    subject: `[VOXA] Reembolso de ${brl(amount)} confirmado`,
    headers: UNSUBSCRIBE_HEADERS,
    html: emailLayout(`
      <div style="text-align:center">
        <h1 style="margin:0 0 16px;font-size:28px;font-weight:800;color:#1C1B1B;letter-spacing:-0.5px">Reembolso confirmado</h1>
        <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#5F3F3A">Olá, <strong style="color:#1C1B1B">${escapeHtml(fanName)}</strong>.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background-color:#F6F3F2;border-radius:16px;padding:24px 32px;min-width:280px">
                <tr>
                  <td align="center">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#5F3F3A;font-weight:700;display:block;margin-bottom:8px;opacity:0.8">VALOR REEMBOLSADO</span>
                    <span style="font-size:36px;font-weight:900;color:#16a34a">${brl(amount)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <p style="margin:0 auto 16px;font-size:15px;color:#5F3F3A;line-height:1.6;max-width:90%">
          Seu reembolso referente à pergunta para <strong style="color:#BC000A">@${escapeHtml(creatorUsername)}</strong> foi processado com sucesso.
        </p>
        <p style="margin:0 auto 36px;font-size:14px;color:#888888;line-height:1.6;max-width:90%">
          Os fundos já foram devolvidos ao seu método de pagamento. Para pagamentos em PIX é instantâneo, para cartão de crédito pode levar até 2 faturas.
        </p>

        <p style="margin:0;font-size:13px;color:#A1A1AA">
          Obrigado por usar a VOXA. Esperamos vê-lo novamente!
        </p>
      </div>
    `, `Reembolso de ${brl(amount)} confirmado para sua pergunta`),
  })
}
