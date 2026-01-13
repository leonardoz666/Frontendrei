'use client'

import { useState } from 'react'
import { X, CreditCard, Smartphone, Banknote, Calculator, Check, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'

type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO'

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    total: number
    mesaId: number
    mesaNumero: number
    onSuccess: () => void
}

export function PaymentModal({ isOpen, onClose, total, mesaId, mesaNumero, onSuccess }: PaymentModalProps) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
    const [amountPaid, setAmountPaid] = useState('')
    const [splitCount, setSplitCount] = useState(1)
    const [processing, setProcessing] = useState(false)

    const totalWithService = total * 1.10 // 10% service fee
    const splitValue = totalWithService / splitCount
    const change = amountPaid ? parseFloat(amountPaid) - totalWithService : 0

    const paymentMethods = [
        { id: 'DINHEIRO' as PaymentMethod, label: 'Dinheiro', icon: Banknote, color: 'bg-green-500' },
        { id: 'PIX' as PaymentMethod, label: 'PIX', icon: Smartphone, color: 'bg-teal-500' },
        { id: 'CARTAO_CREDITO' as PaymentMethod, label: 'Crédito', icon: CreditCard, color: 'bg-blue-500' },
        { id: 'CARTAO_DEBITO' as PaymentMethod, label: 'Débito', icon: CreditCard, color: 'bg-purple-500' },
    ]

    const handleConfirmPayment = async () => {
        if (!selectedMethod) return

        setProcessing(true)
        try {
            const res = await fetch(`/api/tables/${mesaId}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: selectedMethod,
                    valor: totalWithService,
                    troco: selectedMethod === 'DINHEIRO' ? Math.max(0, change) : 0
                })
            })

            if (res.ok) {
                onSuccess()
                onClose()
            }
        } catch (error) {
            console.error('Error processing payment:', error)
        } finally {
            setProcessing(false)
        }
    }

    const quickAmounts = [50, 100, 150, 200, 250, 300]

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Fechar Conta</h2>
                            <p className="text-green-100 mt-1">Mesa {mesaNumero}</p>
                        </div>
                        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                            <X size={28} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Totals Summary */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>R$ {total.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Taxa de Serviço (10%)</span>
                            <span>R$ {(total * 0.10).toFixed(2).replace('.', ',')}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                            <span>Total</span>
                            <span className="text-green-600">R$ {totalWithService.toFixed(2).replace('.', ',')}</span>
                        </div>
                    </div>

                    {/* Split Bill */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dividir para quantas pessoas?
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                                className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl transition-colors"
                            >
                                -
                            </button>
                            <div className="flex-1 text-center">
                                <span className="text-3xl font-bold text-gray-900">{splitCount}</span>
                                <p className="text-sm text-gray-500">pessoa(s)</p>
                            </div>
                            <button
                                onClick={() => setSplitCount(splitCount + 1)}
                                className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xl transition-colors"
                            >
                                +
                            </button>
                        </div>
                        {splitCount > 1 && (
                            <div className="mt-3 text-center bg-blue-50 rounded-xl p-3">
                                <p className="text-sm text-blue-600">Cada pessoa paga:</p>
                                <p className="text-2xl font-bold text-blue-700">R$ {splitValue.toFixed(2).replace('.', ',')}</p>
                            </div>
                        )}
                    </div>

                    {/* Payment Methods */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Forma de Pagamento
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {paymentMethods.map((method) => {
                                const Icon = method.icon
                                return (
                                    <button
                                        key={method.id}
                                        onClick={() => setSelectedMethod(method.id)}
                                        className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedMethod === method.id
                                                ? `border-transparent ${method.color} text-white shadow-lg`
                                                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                                            }`}
                                    >
                                        <Icon size={24} />
                                        <span className="font-medium">{method.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Cash amount input */}
                    {selectedMethod === 'DINHEIRO' && (
                        <div className="animate-in slide-in-from-top duration-200">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Valor Recebido
                            </label>
                            <div className="relative mb-3">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">R$</span>
                                <input
                                    type="number"
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(e.target.value)}
                                    className="w-full p-4 pl-12 text-2xl font-bold text-gray-900 rounded-xl border border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none"
                                    placeholder="0,00"
                                />
                            </div>

                            {/* Quick amounts */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {quickAmounts.map((amount) => (
                                    <button
                                        key={amount}
                                        onClick={() => setAmountPaid(amount.toString())}
                                        className="py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
                                    >
                                        R$ {amount}
                                    </button>
                                ))}
                            </div>

                            {/* Change calculation */}
                            {parseFloat(amountPaid) > 0 && (
                                <div className={`rounded-xl p-4 flex items-center justify-between ${change >= 0 ? 'bg-green-50' : 'bg-red-50'
                                    }`}>
                                    <div className="flex items-center gap-2">
                                        <Calculator size={20} className={change >= 0 ? 'text-green-600' : 'text-red-600'} />
                                        <span className={`font-medium ${change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                            {change >= 0 ? 'Troco' : 'Falta'}
                                        </span>
                                    </div>
                                    <span className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        R$ {Math.abs(change).toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmPayment}
                            disabled={!selectedMethod || processing || (selectedMethod === 'DINHEIRO' && change < 0)}
                            className="flex-1 py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    Processando...
                                </>
                            ) : (
                                <>
                                    <Check size={20} />
                                    Confirmar Pagamento
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
