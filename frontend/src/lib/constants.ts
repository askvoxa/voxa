/** Taxa da plataforma sobre cada transação (10%) */
export const PLATFORM_FEE_RATE = 0.1

/** Percentual líquido que o criador recebe (90%) */
export const CREATOR_NET_RATE = 1 - PLATFORM_FEE_RATE

/** Prazo em horas para o criador responder antes do reembolso automático */
export const RESPONSE_DEADLINE_HOURS = 36
