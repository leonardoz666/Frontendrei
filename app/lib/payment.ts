export type PaymentSummary = {
  subtotal: number
  servico: number
  totalFinal: number
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

export function amountForItems(balance: number, subtotal: number): number {
  return Math.max(0, Math.min(roundMoney(subtotal * 1.1), balance))
}
