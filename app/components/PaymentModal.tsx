'use client'

import { useState, useEffect } from 'react'
import { X, CreditCard, Smartphone, Banknote, Calculator, Check, Loader2, Users, Receipt, AlertCircle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'

type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO'

type PaymentItem = {
    id: number | string
    nome: string
    quantidade: number
    preco: number
}

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    total: number
    mesaId: number
    mesaNumero: number
    onSuccess: () => void
    items?: PaymentItem[]
}

export function PaymentModal({ isOpen, onClose, total, mesaId, mesaNumero, onSuccess, items = [] }: PaymentModalProps) {
    const { showToast } = useToast()
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
    const [amountPaid, setAmountPaid] = useState('')
    const [splitCount, setSplitCount] = useState(1)
    const [processing, setProcessing] = useState(false)
    const [pagoParcialInfo, setPagoParcialInfo] = useState<{ saldoRestante: number; pagoAteAgora: number } | null>(null)

    const [splitMode, setSplitMode] = useState<'PEOPLE' | 'ITEMS'>('PEOPLE')
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string | number>>(new Set())

    const calculateTotals = () => {
        const rawFullTotal = total
        const serviceFeeFull = rawFullTotal * 0.10
        const fullFinalTotal = rawFullTotal + serviceFeeFull

        if (splitMode === 'PEOPLE') {
            const perPerson = fullFinalTotal / splitCount
            return { rawTotal: rawFullTotal, serviceFee: serviceFeeFull, finalTotal: fullFinalTotal, perPerson }
        } else {
            let itemsTotal = 0
            items.forEach(item => {
                if (selectedItemIds.has(item.id)) {
                    itemsTotal += item.preco * item.quantidade
                }
            })
            const serviceFee = itemsTotal * 0.10
            const finalTotal = itemsTotal + serviceFee
            return { rawTotal: itemsTotal, serviceFee, finalTotal, perPerson: finalTotal, fullFinalTotal }
        }
    }

    const totals = calculateTotals()
    const { rawTotal, serviceFee, finalTotal, perPerson } = totals
    const fullFinalTotal = ('fullFinalTotal' in totals) ? totals.fullFinalTotal : (total * 1.1)

    const change = amountPaid ? parseFloat(amountPaid) - (splitMode === 'PEOPLE' ? perPerson : finalTotal) : 0

    const paymentMethods = [
        { id: 'DINHEIRO' as PaymentMethod, label: 'Dinheiro', icon: Banknote, color: 'bg-green-500' },
        { id: 'PIX' as PaymentMethod, label: 'PIX', icon: Smartphone, color: 'bg-teal-500' },
        { id: 'CARTAO_CREDITO' as PaymentMethod, label: 'Crédito', icon: CreditCard, color: 'bg-blue-500' },
        { id: 'CARTAO_DEBITO' as PaymentMethod, label: 'Débito', icon: CreditCard, color: 'bg-purple-500' },
    ]

    const handleConfirmPayment = async () => {
        if (!selectedMethod) return

        const valueToPay = splitMode === 'PEOPLE' && splitCount > 1 ? perPerson : finalTotal

        setProcessing(true)
        try {
            const res = await fetch(`/api/tables/${mesaId}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: selectedMethod,
                    valor: valueToPay,
                    troco: selectedMethod === 'DINHEIRO' ? Math.max(0, change) : 0
                })
            })

            const data = await res.json().catch(() => ({}))

            if (res.ok) {
                if (data.fechado) {
                    showToast('Conta fechada com sucesso!', 'success')
                    onSuccess()
                    onClose()
                } else {
                    showToast(`Pagamento de R$ ${valueToPay.toFixed(2)} registrado! Restam R$ ${(data.saldoRestante || 0).toFixed(2)}`, 'success')
                    setPagoParcialInfo({
                        saldoRestante: data.saldoRestante || 0,
                        pagoAteAgora: data.pagoAteAgora || valueToPay
                    })
                    setSelectedItemIds(new Set())
                    setAmountPaid('')
                    setSelectedMethod(null)
                }
            } else {
                showToast(data.error || 'Erro ao processar pagamento. Verifique o valor.', 'error')
            }
        } catch (error) {
            console.error('Error processing payment:', error)
            showToast('Erro de conexão. Tente novamente.', 'error')
        } finally {
            setProcessing(false)
        }
    }

    const toggleItem = (id: number | string) => {
        setSelectedItemIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const quickAmounts = [10, 20, 50, 100, 200]

    useEffect(() => {
        if (isOpen) {
            setPagoParcialInfo(null)
            setSelectedMethod(null)
            setAmountPaid('')
            setSelectedItemIds(new Set())
            setSplitCount(1)
            setSplitMode('PEOPLE')
        }
    }, [isOpen])

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 text-white flex-shrink-0">
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

                <div className="p-0 flex-1 overflow-y-auto">
                    {/* Mode Switcher */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setSplitMode('PEOPLE')}
                            className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${splitMode === 'PEOPLE' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Users size={18} />
                            Por Pessoa
                        </button>
                        <button
                            onClick={() => setSplitMode('ITEMS')}
                            className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-colors ${splitMode === 'ITEMS' ? 'text-green-600 border-b-2 border-green-600 bg-green-50' : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            <Receipt size={18} />
                            Por Item
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Split Logic */}
                        {splitMode === 'PEOPLE' ? (
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
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    Selecione os itens a pagar:
                                </label>
                                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-60 overflow-y-auto">
                                    {items.map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleItem(item.id)}
                                            className={`p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${selectedItemIds.has(item.id) ? 'bg-green-50' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedItemIds.has(item.id) ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                                    }`}>
                                                    {selectedItemIds.has(item.id) && <Check size={14} className="text-white" />}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 mr-2">{item.quantidade}x</span>
                                                    <span className="text-gray-700">{item.nome}</span>
                                                </div>
                                            </div>
                                            <span className="font-bold text-gray-900">
                                                R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                {selectedItemIds.size === 0 && (
                                    <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                                        Selecione itens para calcular o valor parcial.
                                    </p>
                                )}
                            </div>
                        )}

                        {pagoParcialInfo && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle size={22} className="text-blue-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-bold text-blue-800 mb-1">Pagamento Parcial Registrado</p>
                                    <div className="space-y-1 text-sm text-blue-700">
                                        <div className="flex justify-between">
                                            <span>Total da Conta:</span>
                                            <span className="font-bold">R$ {fullFinalTotal.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Pago até agora:</span>
                                            <span className="font-bold text-green-700">R$ {pagoParcialInfo.pagoAteAgora.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                                            <span className="font-semibold">Saldo Restante:</span>
                                            <span className="font-bold text-red-700">R$ {pagoParcialInfo.saldoRestante.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Totals Summary */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            {/* Show different headers based on mode */}
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal {splitMode === 'ITEMS' ? '(Selecionado)' : ''}</span>
                                <span>R$ {rawTotal.toFixed(2).replace('.', ',')}</span>
                            </div>
                            <div className="flex justify-between text-gray-600">
                                <span>Taxa de Serviço (10%)</span>
                                <span>R$ {serviceFee.toFixed(2).replace('.', ',')}</span>
                            </div>

                            {splitMode === 'PEOPLE' && splitCount > 1 && (
                                <div className="border-t border-gray-200 pt-2 flex justify-between text-blue-600 font-bold">
                                    <span>Total (Mesa)</span>
                                    <span>R$ {(total * 1.1).toFixed(2).replace('.', ',')}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                                <span>Valor a Pagar {splitMode === 'PEOPLE' && splitCount > 1 ? '(Por Pessoa)' : ''}</span>
                                <span className="text-green-600">R$ {
                                    (splitMode === 'PEOPLE' ? perPerson : finalTotal).toFixed(2).replace('.', ',')
                                }</span>
                            </div>
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
                                <div className="grid grid-cols-5 gap-2 mb-3">
                                    {quickAmounts.map((amount) => (
                                        <button
                                            key={amount}
                                            onClick={() => setAmountPaid(amount.toString())}
                                            className="py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors text-sm"
                                        >
                                            {amount}
                                        </button>
                                    ))}
                                </div>

                                {/* Change calculation */}
                                {amountPaid && (
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
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 px-4 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl font-bold transition-colors shadow-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmPayment}
                        disabled={!selectedMethod || processing || (selectedMethod === 'DINHEIRO' && change < 0) || (splitMode === 'ITEMS' && selectedItemIds.size === 0)}
                        className="flex-[2] py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-200"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Check size={20} />
                                {pagoParcialInfo
                                    ? 'Continuar Pagamento'
                                    : (splitMode === 'ITEMS' && selectedItemIds.size < items.length
                                        ? 'Pagar Itens Selecionados'
                                        : (splitMode === 'PEOPLE' && splitCount > 1
                                            ? 'Pagar Por Pessoa'
                                            : 'Fechar Conta'))}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
