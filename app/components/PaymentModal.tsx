'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CreditCard, Smartphone, Banknote, Calculator, Check, Loader2, Users, Receipt, AlertCircle, Lock } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import { apiFetch } from '@/app/lib/api'
import { amountForItems, amountPerPerson, roundMoney, type PaymentSummary } from '@/app/lib/payment'

type PaymentMethod = 'DINHEIRO' | 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'VALE_REFEICAO' | 'VALE_ALIMENTACAO' | 'VOUCHER'
type CreditCardBrand = 'VISA' | 'MASTERCARD' | 'ELO' | 'AMERICAN_EXPRESS' | 'HIPERCARD'
type FormaPagamentoAtiva = { id: number; nome: string; ativo: boolean }

const METODOS_PADRAO: PaymentMethod[] = ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'VALE_REFEICAO']
const METODOS_SUPORTADOS = new Set<PaymentMethod>(['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'VALE_REFEICAO', 'VALE_ALIMENTACAO', 'VOUCHER'])
const ROTULOS_METODO: Record<PaymentMethod, string> = {
    DINHEIRO: 'Dinheiro', PIX: 'PIX', CARTAO_CREDITO: 'Crédito', CARTAO_DEBITO: 'Débito',
    VALE_REFEICAO: 'Vale-refeição', VALE_ALIMENTACAO: 'Vale-alimentação', VOUCHER: 'Voucher'
}

type PaymentItem = {
    id: number | string
    nome: string
    quantidade: number
    preco: number
}

interface PaymentModalProps {
    isOpen: boolean
    onClose: () => void
    mesaId: number
    mesaNumero: number
    onSuccess: () => void
    canApplyDiscount?: boolean
    items?: PaymentItem[]
}

export function PaymentModal({ isOpen, onClose, mesaId, mesaNumero, onSuccess, canApplyDiscount = false, items = [] }: PaymentModalProps) {
    const { showToast } = useToast()
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
    const [selectedCardBrand, setSelectedCardBrand] = useState<CreditCardBrand | ''>('')
    const [amountPaid, setAmountPaid] = useState('')
    const [splitCount, setSplitCount] = useState(1)
    const [processing, setProcessing] = useState(false)
    const [summary, setSummary] = useState<PaymentSummary | null>(null)
    const [summaryLoading, setSummaryLoading] = useState(true)
    const [summaryError, setSummaryError] = useState('')
    const paymentInFlight = useRef(false)
    const [emitirNfce, setEmitirNfce] = useState(false)
    const [includeService, setIncludeService] = useState(true)
    const [discountEnabled, setDiscountEnabled] = useState(false)
    const [discountPercent, setDiscountPercent] = useState('')
    const [metodosAtivos, setMetodosAtivos] = useState<PaymentMethod[]>(METODOS_PADRAO)

    const [splitMode, setSplitMode] = useState<'PEOPLE' | 'ITEMS'>('PEOPLE')
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string | number>>(new Set())

    const parsedDiscount = discountEnabled ? Math.min(99.99, Math.max(0, Number(discountPercent) || 0)) : 0
    const pricingLocked = summary?.configuracaoBloqueada === true
    const baseSubtotal = summary?.subtotal ?? 0
    const configuredService = includeService ? roundMoney(baseSubtotal * 0.1) : 0
    const configuredDiscount = roundMoney((baseSubtotal + configuredService) * (parsedDiscount / 100))
    const configuredTotal = roundMoney(Math.max(0, baseSubtotal + configuredService - configuredDiscount))
    const fullFinalTotal = pricingLocked ? (summary?.totalFinal ?? 0) : configuredTotal
    const balance = pricingLocked
        ? (summary?.saldoRestante ?? 0)
        : roundMoney(Math.max(0, fullFinalTotal - (summary?.pagoAteAgora ?? 0)))
    const selectedSubtotal = items.reduce((sum, item) =>
        sum + (selectedItemIds.has(item.id) ? item.preco * item.quantidade : 0), 0)
    const rawTotal = splitMode === 'PEOPLE' ? (summary?.subtotal ?? 0) : selectedSubtotal
    const serviceFee = pricingLocked
        ? (summary?.ajuste && summary.ajuste > 0 ? summary.ajuste : 0)
        : splitMode === 'PEOPLE'
            ? configuredService
            : includeService ? roundMoney(selectedSubtotal * 0.1) : 0
    const discountValue = pricingLocked
        ? (summary?.ajuste && summary.ajuste < 0 ? Math.abs(summary.ajuste) : 0)
        : splitMode === 'PEOPLE'
            ? configuredDiscount
            : roundMoney((selectedSubtotal + serviceFee) * (parsedDiscount / 100))
    const valueToPay = splitMode === 'PEOPLE'
        ? amountPerPerson(balance, splitCount)
        : amountForItems(balance, selectedSubtotal, includeService, parsedDiscount)
    const received = Number(amountPaid)
    const cashValid = amountPaid.trim() !== '' && Number.isFinite(received) && received >= valueToPay
    const change = Number.isFinite(received) ? roundMoney(received - valueToPay) : 0
    const pagoParcialInfo = summary && summary.pagoAteAgora > 0 ? summary : null

    const loadSummary = useCallback(async (signal?: AbortSignal) => {
        setSummaryLoading(true)
        setSummaryError('')
        try {
            const data = await apiFetch<PaymentSummary>(`/tables/${mesaId}/payment-summary`, { signal })
            if (!signal?.aborted) setSummary(data)
        } catch (error) {
            if (!signal?.aborted) {
                setSummary(null)
                setSummaryError(error instanceof Error ? error.message : 'Erro ao consultar saldo')
            }
        } finally {
            if (!signal?.aborted) setSummaryLoading(false)
        }
    }, [mesaId])

    const paymentMethods = metodosAtivos.map(id => ({
        id,
        label: ROTULOS_METODO[id],
        icon: id === 'DINHEIRO' ? Banknote : id === 'PIX' ? Smartphone : CreditCard,
        color: id === 'DINHEIRO' ? 'bg-green-600' : id === 'PIX' ? 'bg-teal-600' : id === 'CARTAO_CREDITO' ? 'bg-blue-600' : id === 'CARTAO_DEBITO' ? 'bg-violet-600' : 'bg-amber-600'
    }))
    const creditCardBrands: Array<{ id: CreditCardBrand; label: string }> = [
        { id: 'VISA', label: 'Visa' },
        { id: 'MASTERCARD', label: 'Mastercard' },
        { id: 'ELO', label: 'Elo' },
        { id: 'AMERICAN_EXPRESS', label: 'American Express' },
        { id: 'HIPERCARD', label: 'Hipercard' },
    ]

    const handleConfirmPayment = async () => {
        if (!selectedMethod || paymentInFlight.current || summaryLoading || !summary || valueToPay <= 0) return
        if (selectedMethod === 'DINHEIRO' && !cashValid) return
        if (selectedMethod === 'CARTAO_CREDITO' && !selectedCardBrand) return

        paymentInFlight.current = true
        setProcessing(true)
        try {
            const data = await apiFetch<{
                fechado: boolean; totalFinal: number; pagoAteAgora: number; saldoRestante: number
                nfce?: { status: string; serie: string; numero: number; motivoRejeicao?: string }
            }>(`/tables/${mesaId}/payment`, {
                method: 'POST',
                body: {
                    tipo: selectedMethod,
                    ...(selectedMethod === 'CARTAO_CREDITO' ? { bandeira: selectedCardBrand } : {}),
                    valor: valueToPay,
                    troco: selectedMethod === 'DINHEIRO' ? Math.max(0, change) : 0,
                    emitirNfce,
                    incluirServico: includeService,
                    descontoPercentual: parsedDiscount
                }
            })

            if (data.fechado) {
                if (data.nfce) {
                    const autorizada = data.nfce.status === 'AUTORIZADA'
                    showToast(
                        autorizada
                            ? `Conta fechada e NFC-e ${data.nfce.serie}/${data.nfce.numero} autorizada`
                            : `Conta fechada. NFC-e pendente/rejeitada: ${data.nfce.motivoRejeicao || data.nfce.status}`,
                        autorizada ? 'success' : 'warning'
                    )
                } else {
                    showToast('Conta fechada com sucesso!', 'success')
                }
                onSuccess()
                onClose()
            } else {
                showToast(`Pagamento de R$ ${valueToPay.toFixed(2)} registrado! Restam R$ ${data.saldoRestante.toFixed(2)}`, 'success')
                setSummary(previous => previous ? {
                    ...previous,
                    totalFinal: data.totalFinal,
                    saldoRestante: data.saldoRestante,
                    pagoAteAgora: data.pagoAteAgora,
                    ajuste: roundMoney(data.totalFinal - previous.subtotal),
                    configuracaoBloqueada: true
                } : null)
                if (splitMode === 'PEOPLE') setSplitCount(count => Math.max(1, count - 1))
                setSelectedItemIds(new Set())
                setAmountPaid('')
                setSelectedMethod(null)
                setSelectedCardBrand('')
            }
        } catch (error) {
            console.error('Error processing payment:', error)
            showToast(error instanceof Error ? error.message : 'Erro de conexão. Tente novamente.', 'error')
            // A response may be lost after the payment commits; reload before allowing another attempt.
            await loadSummary()
            setSelectedMethod(null)
            setSelectedCardBrand('')
            setAmountPaid('')
            setSplitCount(1)
            setSelectedItemIds(new Set())
        } finally {
            paymentInFlight.current = false
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
            const controller = new AbortController()
            const previousOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            setSummary(null)
            void loadSummary(controller.signal)
            void apiFetch<{ data: FormaPagamentoAtiva[] }>('/formas-pagamento/ativas', { signal: controller.signal })
                .then(resposta => {
                    const configurados = resposta.data
                        .map(forma => forma.nome.trim().toUpperCase() as PaymentMethod)
                        .filter((nome): nome is PaymentMethod => METODOS_SUPORTADOS.has(nome))
                    setMetodosAtivos(configurados.length > 0 ? Array.from(new Set(configurados)) : METODOS_PADRAO)
                })
                .catch(() => setMetodosAtivos(METODOS_PADRAO))
            setSelectedMethod(null)
            setSelectedCardBrand('')
            setAmountPaid('')
            setSelectedItemIds(new Set())
            setSplitCount(1)
            setSplitMode('PEOPLE')
            setEmitirNfce(false)
            setIncludeService(true)
            setDiscountEnabled(false)
            setDiscountPercent('')
            return () => {
                controller.abort()
                document.body.style.overflow = previousOverflow
            }
        }
    }, [isOpen, loadSummary])

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-100">
            <div className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-100 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex-shrink-0 bg-green-700 text-white shadow-sm">
                    <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                        <div>
                            <h2 className="text-2xl font-bold">Receber conta</h2>
                            <p className="mt-0.5 text-sm font-medium text-green-100">Mesa {mesaNumero}</p>
                        </div>
                        <button onClick={onClose} disabled={processing} aria-label="Fechar" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15 disabled:opacity-50">
                            <X size={26} />
                        </button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
                    {summaryLoading && <span role="status" className="sr-only">Consultando dados do recebimento</span>}
                    {summaryError && (
                        <div role="alert" className="mx-auto w-full max-w-7xl px-4 py-5 text-red-700 sm:px-6 lg:px-8">
                            <p>{summaryError}</p>
                            <button onClick={() => void loadSummary()} className="mt-2 underline">Tentar novamente</button>
                        </div>
                    )}
                    {!summaryLoading && summary && summary.totalFinal <= 0 && (
                        <div role="alert" className="mx-auto w-full max-w-7xl border-l-4 border-amber-500 bg-amber-50 px-4 py-4 text-amber-900 sm:px-6 lg:px-8">
                            <p className="font-bold">Conta sem valor para receber</p>
                            <p className="mt-1 text-sm">Os itens desta comanda foram lançados com preço R$ 0,00. Configure os preços dos produtos e relance os itens antes de fechar a conta.</p>
                        </div>
                    )}
                    <fieldset disabled={processing || summaryLoading || !summary} className="mx-auto min-h-full w-full max-w-7xl bg-white shadow-sm">
                    {/* Mode Switcher */}
                    <div className="grid grid-cols-2 border-b border-gray-200 bg-white">
                        <button
                            onClick={() => setSplitMode('PEOPLE')}
                            className={`flex h-14 items-center justify-center gap-2 border-b-2 text-sm font-bold transition-colors ${splitMode === 'PEOPLE' ? 'border-green-600 bg-green-50 text-green-700' : 'border-transparent text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Users size={18} />
                            Por Pessoa
                        </button>
                        <button
                            onClick={() => setSplitMode('ITEMS')}
                            className={`flex h-14 items-center justify-center gap-2 border-b-2 text-sm font-bold transition-colors ${splitMode === 'ITEMS' ? 'border-green-600 bg-green-50 text-green-700' : 'border-transparent text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <Receipt size={18} />
                            Por Item
                        </button>
                    </div>

                    <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:items-start">
                        <div className="space-y-6 p-4 sm:p-6 lg:min-h-[calc(100dvh-216px)] lg:border-r lg:border-gray-200 lg:p-8">
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

                        {pricingLocked ? (
                            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                                <Lock size={20} className="mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold">Condições da conta bloqueadas</p>
                                    <p className="mt-1 text-blue-700">A taxa e o desconto foram definidos no primeiro pagamento parcial.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 border-y border-gray-200 py-4">
                                <label className="flex cursor-pointer items-center justify-between gap-4">
                                    <span>
                                        <span className="block font-semibold text-gray-900">Incluir taxa de serviço de 10%</span>
                                        <span className="text-sm text-gray-500">Desative quando a conta for paga sem os 10%.</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={includeService}
                                        onChange={(event) => setIncludeService(event.target.checked)}
                                        className="h-5 w-5 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                </label>

                                {canApplyDiscount && (
                                    <div className="border-t border-gray-200 pt-3">
                                        <label className="flex cursor-pointer items-center justify-between gap-4">
                                            <span>
                                                <span className="block font-semibold text-gray-900">Dar desconto ao cliente</span>
                                                <span className="text-sm text-gray-500">O desconto será aplicado sobre a conta com a taxa escolhida.</span>
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={discountEnabled}
                                                onChange={(event) => {
                                                    setDiscountEnabled(event.target.checked)
                                                    if (!event.target.checked) setDiscountPercent('')
                                                }}
                                                className="h-5 w-5 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                        </label>
                                        {discountEnabled && (
                                            <div className="mt-3">
                                                <label htmlFor="discount-percent" className="mb-2 block text-sm font-medium text-gray-700">Desconto (%)</label>
                                                <div className="relative max-w-48">
                                                    <input
                                                        id="discount-percent"
                                                        type="number"
                                                        min="0"
                                                        max="99.99"
                                                        step="0.01"
                                                        value={discountPercent}
                                                        onChange={(event) => setDiscountPercent(event.target.value)}
                                                        className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 pr-10 font-semibold text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                                                        placeholder="0"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-gray-500">%</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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
                            {discountValue > 0 && (
                                <div className="flex justify-between font-medium text-red-700">
                                    <span>Desconto{!pricingLocked ? ` (${parsedDiscount.toFixed(2).replace('.', ',')}%)` : ''}</span>
                                    <span>- R$ {discountValue.toFixed(2).replace('.', ',')}</span>
                                </div>
                            )}

                            {splitMode === 'PEOPLE' && splitCount > 1 && (
                                <div className="border-t border-gray-200 pt-2 flex justify-between text-blue-600 font-bold">
                                    <span>Total (Mesa)</span>
                                    <span>R$ {fullFinalTotal.toFixed(2).replace('.', ',')}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-200">
                                <span>Valor a Pagar {splitMode === 'PEOPLE' && splitCount > 1 ? '(Por Pessoa)' : ''}</span>
                                <span className="text-green-600">R$ {
                                    valueToPay.toFixed(2).replace('.', ',')
                                }</span>
                            </div>
                        </div>
                        </div>

                        <div className="space-y-6 border-t border-gray-200 bg-slate-50 p-4 sm:p-6 lg:border-t-0 lg:p-8">
                        {/* Payment Methods */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Forma de Pagamento
                            </label>
                            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                                {paymentMethods.map((method) => {
                                    const Icon = method.icon
                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => {
                                                setSelectedMethod(method.id)
                                                if (method.id !== 'CARTAO_CREDITO') setSelectedCardBrand('')
                                            }}
                                            className={`flex min-h-16 items-center gap-3 rounded-lg border-2 p-4 transition-colors ${selectedMethod === method.id
                                                ? `border-transparent ${method.color} text-white shadow-lg`
                                                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Icon size={24} />
                                            <span className="font-medium">{method.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {selectedMethod === 'CARTAO_CREDITO' && (
                            <div>
                                <label htmlFor="credit-card-brand" className="mb-2 block text-sm font-medium text-gray-700">
                                    Bandeira do cartão
                                </label>
                                <select
                                    id="credit-card-brand"
                                    value={selectedCardBrand}
                                    onChange={(event) => setSelectedCardBrand(event.target.value as CreditCardBrand | '')}
                                    className="h-12 w-full rounded-xl border-2 border-gray-200 bg-white px-4 font-medium text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">Selecione a bandeira</option>
                                    {creditCardBrands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>{brand.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <label className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 text-sm text-gray-700">
                            <input
                                type="checkbox"
                                checked={emitirNfce}
                                onChange={(event) => setEmitirNfce(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span>
                                <span className="block font-semibold text-gray-900">Emitir NFC-e ao fechar</span>
                                <span className="text-gray-500">A emissão só ocorre quando a conta for quitada totalmente.</span>
                            </span>
                        </label>

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
                                        min="0"
                                        step="0.01"
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

                                {/* Automatic change calculation */}
                                <div className={`overflow-hidden rounded-lg border ${amountPaid.trim() === ''
                                    ? 'border-gray-200 bg-white'
                                    : change >= 0
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-red-300 bg-red-50'
                                    }`}>
                                    <div className="flex items-center gap-2 border-b border-inherit px-4 py-3">
                                        <Calculator size={20} className="text-gray-700" />
                                        <span className="font-bold text-gray-900">Cálculo do troco</span>
                                    </div>
                                    <div className="space-y-2 px-4 py-3 text-sm">
                                        <div className="flex items-center justify-between text-gray-600">
                                            <span>Valor da conta</span>
                                            <span className="font-semibold text-gray-900">R$ {valueToPay.toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-gray-600">
                                            <span>Valor recebido</span>
                                            <span className="font-semibold text-gray-900">R$ {(amountPaid.trim() === '' || !Number.isFinite(received) ? 0 : Math.max(0, received)).toFixed(2).replace('.', ',')}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-inherit pt-3">
                                            <span className={`font-bold ${amountPaid.trim() === '' ? 'text-gray-700' : change >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                                                {amountPaid.trim() === '' ? 'Troco a devolver' : change >= 0 ? 'Troco a devolver' : 'Ainda falta receber'}
                                            </span>
                                            <span className={`text-2xl font-bold ${amountPaid.trim() === '' ? 'text-gray-900' : change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                R$ {(amountPaid.trim() === '' ? 0 : Math.abs(change)).toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                    </fieldset>
                </div>

                {/* Footer Actions */}
                <div className="flex-shrink-0 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
                    <div className="mx-auto flex w-full max-w-7xl flex-col-reverse gap-3 px-4 py-3 sm:flex-row sm:justify-end sm:px-6 lg:px-8">
                        <button
                            onClick={onClose}
                            disabled={processing}
                            className="h-12 rounded-lg border border-gray-300 bg-white px-8 font-bold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmPayment}
                            disabled={!selectedMethod || processing || summaryLoading || !summary || valueToPay <= 0 || (selectedMethod === 'DINHEIRO' && !cashValid) || (selectedMethod === 'CARTAO_CREDITO' && !selectedCardBrand)}
                            className="flex h-12 min-w-64 items-center justify-center gap-2 rounded-lg bg-green-600 px-8 font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            </div>
        </div>,
        document.body
    )
}
