export type PaymentSummary = {
  subtotal: number
  servico: number
  desconto: number
  descontoPercentual: number
  incluirServico: boolean
  totalFinal: number
  ajuste: number
  configuracaoBloqueada: boolean
  pagoAteAgora: number
  saldoRestante: number
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function amountPerPerson(balance: number, people: number): number {
  if (!Number.isFinite(balance) || balance <= 0 || !Number.isInteger(people) || people < 1) return 0
  // Remaining people share the remaining cents; the last payment clears the balance.
  return Math.floor(Math.round(balance * 100) / people) / 100
}

export function amountForItems(balance: number, subtotal: number, includeService = true, discountPercent = 0): number {
  const serviceMultiplier = includeService ? 1.1 : 1
  const discountMultiplier = 1 - Math.min(100, Math.max(0, discountPercent)) / 100
  return Math.max(0, Math.min(roundMoney(subtotal * serviceMultiplier * discountMultiplier), balance))
}
