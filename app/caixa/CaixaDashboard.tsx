'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CheckCircle2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

type MovementType = 'SANGRIA' | 'SUPRIMENTO' | 'AJUSTE'

type Movement = {
  id: number
  tipo: MovementType
  valor: number
  forma?: string | null
  descricao?: string | null
  criadoEm: string
}

type CashStatus = {
  aberto: boolean
  caixa: {
    id: number
    status: string
    saldoInicial: number
    abertoEm: string
    movimentos: Movement[]
  } | null
  vendasPorForma?: Array<{ tipo: string; total: number }>
  vendasTotal?: number
  vendasEmDinheiro?: number
  suprimentos?: number
  sangrias?: number
  ajustes?: number
  saldoInicial?: number
  dinheiroEsperado?: number
  quantidadePagamentos?: number
  quantidadeMovimentos?: number
}

type CashPanelProps = { fechamento?: boolean }

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatMoney(value: number | undefined | null) {
  return money.format(Number(value ?? 0))
}

function formatPaymentType(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
}

export default function CaixaDashboard({ fechamento = false }: CashPanelProps) {
  const { showToast } = useToast()
  const [data, setData] = useState<CashStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showMovement, setShowMovement] = useState<MovementType | null>(null)
  const [saldoInicial, setSaldoInicial] = useState('0')
  const [saldoInformado, setSaldoInformado] = useState('')
  const [valorMovimento, setValorMovimento] = useState('')
  const [descricao, setDescricao] = useState('')
  const [observacao, setObservacao] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/caixa/status', { cache: 'no-store' })
      if (!response.ok) throw new Error('Não foi possível consultar o caixa')
      setData(await response.json() as CashStatus)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao consultar o caixa', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const submit = async (url: string, body: Record<string, unknown>, successMessage: string) => {
    try {
      setSaving(true)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a operação')
      showToast(successMessage, 'success')
      await loadStatus()
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao concluir a operação', 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const openCash = async () => {
    const value = Number(saldoInicial)
    if (!Number.isFinite(value) || value < 0) {
      showToast('Informe um saldo inicial válido.', 'error')
      return
    }
    await submit('/api/caixa/abrir', { saldoInicial: value }, 'Caixa aberto com sucesso.')
  }

  const registerMovement = async () => {
    if (!showMovement) return
    const value = Number(valorMovimento)
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Informe um valor maior que zero.', 'error')
      return
    }
    const ok = await submit('/api/caixa/movimentos', {
      tipo: showMovement,
      valor: value,
      descricao: descricao.trim() || undefined,
    }, showMovement === 'SANGRIA' ? 'Sangria registrada.' : 'Suprimento registrado.')
    if (ok) {
      setShowMovement(null)
      setValorMovimento('')
      setDescricao('')
    }
  }

  const closeCash = async () => {
    const value = Number(saldoInformado)
    if (!Number.isFinite(value) || value < 0) {
      showToast('Informe o saldo contado no caixa.', 'error')
      return
    }
    await submit('/api/caixa/fechar', {
      saldoInformado: value,
      observacao: observacao.trim() || undefined,
    }, 'Caixa fechado com sucesso.')
    setSaldoInformado('')
    setObservacao('')
  }

  const movements = data?.caixa?.movimentos ?? []
  const paymentRows = data?.vendasPorForma ?? []
  const difference = useMemo(() => {
    if (data?.dinheiroEsperado == null || !saldoInformado) return null
    return Number(saldoInformado) - data.dinheiroEsperado
  }, [data?.dinheiroEsperado, saldoInformado])

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center text-slate-500"><RefreshCw className="mr-2 animate-spin" size={18} /> Carregando caixa...</div>
  }

  if (!data?.aberto || !data.caixa) {
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8">
        <PageHeading title="Caixa do Dia" subtitle="Abra o caixa para iniciar a operação." onRefresh={loadStatus} />
        <section className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Wallet size={24} /></div>
          <h2 className="text-xl font-bold text-slate-900">Abrir caixa</h2>
          <p className="mt-1 text-sm text-slate-500">Informe o dinheiro disponível no início do turno.</p>
          <label className="mt-6 block text-sm font-semibold text-slate-700">Saldo inicial</label>
          <div className="relative mt-2">
            <span className="absolute left-4 top-3.5 text-sm text-slate-400">R$</span>
            <input value={saldoInicial} onChange={event => setSaldoInicial(event.target.value)} type="number" min="0" step="0.01" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-lg font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" />
          </div>
          <button onClick={openCash} disabled={saving} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"><Wallet size={18} /> Abrir caixa</button>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
      <PageHeading title={fechamento ? 'Fechamento do Caixa' : 'Caixa do Dia'} subtitle={`Caixa #${data.caixa.id} aberto em ${dateTime.format(new Date(data.caixa.abertoEm))}`} onRefresh={loadStatus} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saldo inicial" value={formatMoney(data.saldoInicial)} icon={<Wallet size={19} />} />
        <Metric label="Vendas recebidas" value={formatMoney(data.vendasTotal)} icon={<Banknote size={19} />} accent="green" />
        <Metric label="Dinheiro esperado" value={formatMoney(data.dinheiroEsperado)} icon={<CheckCircle2 size={19} />} accent="blue" />
        <Metric label="Movimentos" value={String(data.quantidadeMovimentos ?? 0)} icon={<ArrowUpFromLine size={19} />} accent="slate" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="text-lg font-bold text-slate-900">Resumo das vendas</h2><p className="mt-1 text-sm text-slate-500">Pagamentos registrados desde a abertura.</p></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{data.quantidadePagamentos ?? 0} pagamentos</span>
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {paymentRows.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nenhuma venda recebida neste caixa.</p> : paymentRows.map(row => (
              <div key={row.tipo} className="flex items-center justify-between py-3"><span className="text-sm font-medium text-slate-600">{formatPaymentType(row.tipo)}</span><strong className="text-sm text-slate-900">{formatMoney(row.total)}</strong></div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Movimentações</h2><p className="mt-1 text-sm text-slate-500">Ajustes manuais do caixa.</p></div><button onClick={() => setShowMovement('SUPRIMENTO')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-orange-300 hover:text-orange-700"><Plus size={16} /> Registrar</button></div>
          <div className="mt-5 divide-y divide-slate-100">
            {movements.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Nenhum movimento registrado.</p> : movements.map(movement => <MovementRow key={movement.id} movement={movement} />)}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-slate-900">Conferência</h2><p className="mt-1 text-sm text-slate-500">Conte o dinheiro físico e compare com o valor esperado.</p></div><div className="flex gap-2"><button onClick={() => setShowMovement('SANGRIA')} className="inline-flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"><ArrowDownToLine size={16} /> Sangria</button><button onClick={() => setShowMovement('SUPRIMENTO')} className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"><ArrowUpFromLine size={16} /> Suprimento</button></div></div>
        {fechamento ? <div className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label className="block text-sm font-semibold text-slate-700">Saldo contado<input value={saldoInformado} onChange={event => setSaldoInformado(event.target.value)} type="number" min="0" step="0.01" placeholder="0,00" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><label className="block text-sm font-semibold text-slate-700">Observação<input value={observacao} onChange={event => setObservacao(event.target.value)} placeholder="Opcional" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><button onClick={closeCash} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"><LockKeyhole size={18} /> Fechar caixa</button></div> : <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><div><p className="text-sm font-semibold text-slate-700">Pronto para conferir?</p><p className="mt-1 text-sm text-slate-500">O fechamento registra o saldo contado e eventuais diferenças.</p></div><Link href="/caixa/fechamento" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white hover:bg-slate-800"><LockKeyhole size={18} /> Ir para fechamento</Link></div>}
        {difference !== null && <p className={`mt-4 text-sm font-bold ${difference === 0 ? 'text-emerald-700' : difference > 0 ? 'text-blue-700' : 'text-red-700'}`}>Diferença da conferência: {formatMoney(difference)}</p>}
      </section>

      {showMovement && <MovementModal type={showMovement} value={valorMovimento} description={descricao} saving={saving} onValueChange={setValorMovimento} onDescriptionChange={setDescricao} onClose={() => setShowMovement(null)} onSubmit={registerMovement} />}
    </main>
  )
}

function PageHeading({ title, subtitle, onRefresh }: { title: string; subtitle: string; onRefresh: () => void }) {
  return <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Operação</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><button title="Atualizar caixa" onClick={onRefresh} className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:border-orange-300 hover:text-orange-700"><RefreshCw size={18} /></button></header>
}

function Metric({ label, value, icon, accent = 'orange' }: { label: string; value: string; icon: React.ReactNode; accent?: 'orange' | 'green' | 'blue' | 'slate' }) {
  const colors = { orange: 'bg-orange-50 text-orange-600', green: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600', slate: 'bg-slate-100 text-slate-600' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${colors[accent]}`}>{icon}</div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>
}

function MovementRow({ movement }: { movement: Movement }) {
  const sangria = movement.tipo === 'SANGRIA'
  return <div className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${sangria ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>{sangria ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-700">{sangria ? 'Sangria' : movement.tipo === 'SUPRIMENTO' ? 'Suprimento' : 'Ajuste'}</p><p className="text-xs text-slate-400">{movement.descricao || dateTime.format(new Date(movement.criadoEm))}</p></div></div><strong className={`shrink-0 text-sm ${sangria ? 'text-red-700' : 'text-emerald-700'}`}>{sangria ? '-' : '+'}{formatMoney(movement.valor)}</strong></div>
}

function MovementModal({ type, value, description, saving, onValueChange, onDescriptionChange, onClose, onSubmit }: { type: MovementType; value: string; description: string; saving: boolean; onValueChange: (value: string) => void; onDescriptionChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
  const sangria = type === 'SANGRIA'
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-orange-600">Caixa</p><h2 className="mt-1 text-xl font-black text-slate-900">{sangria ? 'Registrar sangria' : 'Registrar suprimento'}</h2></div><button title="Fechar" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={19} /></button></div><label className="mt-6 block text-sm font-semibold text-slate-700">Valor<input value={value} onChange={event => onValueChange(event.target.value)} autoFocus type="number" min="0" step="0.01" placeholder="0,00" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><label className="mt-4 block text-sm font-semibold text-slate-700">Descrição<input value={description} onChange={event => onDescriptionChange(event.target.value)} placeholder={sangria ? 'Ex.: retirada para fornecedor' : 'Ex.: troco inicial'} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100" /></label><div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="rounded-xl px-4 py-3 font-bold text-slate-600 hover:bg-slate-100">Cancelar</button><button onClick={onSubmit} disabled={saving} className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 font-bold text-white disabled:opacity-60 ${sangria ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}><CheckCircle2 size={17} /> Confirmar</button></div></div></div>
}
