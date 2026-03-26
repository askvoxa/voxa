// Validação e formatação de chaves PIX (CPF e CNPJ)

/** Remove qualquer caractere não-numérico */
export function stripMask(value: string): string {
  return value.replace(/\D/g, '')
}

/** Valida CPF com dígitos verificadores (mod 11) */
export function validateCPF(value: string): boolean {
  const digits = stripMask(value)
  if (digits.length !== 11) return false

  // Rejeitar sequências iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false

  // Primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[9])) return false

  // Segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[10])) return false

  return true
}

/** Valida CNPJ com dígitos verificadores (mod 11) */
export function validateCNPJ(value: string): boolean {
  const digits = stripMask(value)
  if (digits.length !== 14) return false

  // Rejeitar sequências iguais
  if (/^(\d)\1{13}$/.test(digits)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  // Primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i]
  }
  let remainder = sum % 11
  const firstDigit = remainder < 2 ? 0 : 11 - remainder
  if (firstDigit !== parseInt(digits[12])) return false

  // Segundo dígito verificador
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i]
  }
  remainder = sum % 11
  const secondDigit = remainder < 2 ? 0 : 11 - remainder
  if (secondDigit !== parseInt(digits[13])) return false

  return true
}

/** Formata CPF: 123.456.789-00 */
export function formatCPF(value: string): string {
  const digits = stripMask(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/** Formata CNPJ: 12.345.678/0001-00 */
export function formatCNPJ(value: string): string {
  const digits = stripMask(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/** Mascara CPF para exibição: ***.456.789-** */
export function maskCPF(value: string): string {
  const digits = stripMask(value)
  if (digits.length !== 11) return '***.***.***-**'
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

/** Mascara CNPJ para exibição: **.345.678/0001-** */
export function maskCNPJ(value: string): string {
  const digits = stripMask(value)
  if (digits.length !== 14) return '**.***.***/*****-**'
  return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`
}

/** Valida chave PIX de acordo com o tipo */
export function validatePixKey(keyType: 'cpf' | 'cnpj', value: string): boolean {
  return keyType === 'cpf' ? validateCPF(value) : validateCNPJ(value)
}

/** Mascara chave PIX de acordo com o tipo */
export function maskPixKey(keyType: 'cpf' | 'cnpj', value: string): string {
  return keyType === 'cpf' ? maskCPF(value) : maskCNPJ(value)
}

/** Formata chave PIX de acordo com o tipo */
export function formatPixKey(keyType: 'cpf' | 'cnpj', value: string): string {
  return keyType === 'cpf' ? formatCPF(value) : formatCNPJ(value)
}
