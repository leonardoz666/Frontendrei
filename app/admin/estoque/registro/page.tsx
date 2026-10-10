'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ClipboardCheck, PackageMinus, PackagePlus, Plus, Scale, Send, Trash2, X } from 'lucide-react'
import { apiFetch, fetchList } from '@/app/lib/api'
import { comoDecimalDigitado, comoNumero } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

type TipoLote = 'ENTRADA' | 'SAIDA' | 'CONTAGEM' | 'PERDA'
type Insumo = { id: number; codigo: string; nome: string; unidade: string; saldoAtual: number | string }
type ItemRascunho = { chave: number; insumoId: string; quantidade: string; custoUnitario: string; observacao: string }
type Lote = {
  id: number
  tipo: TipoLote
  status: string
  documento: string | null
  observacao: string | null
  criadoEm: string
  motivoRevisao: string | null
  itens: Array<{ id: number; status: string; quantidade: number | string; unidadeSnapshot: string; insumo: Insumo }>
}
type ListaLotes = { data: Lote[]; meta: { total: number } }

const TIPOS: Array<{
  tipo: TipoLote
  titulo: string
  descricao: string
  icon: typeof PackagePlus
  cores: string
}> = [
  { tipo: 'ENTRADA', titulo: 'Entrada', descricao: 'Mercadoria recebida', icon: PackagePlus, cores: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { tipo: 'SAIDA', titulo: 'Saída', descricao: 'Uso ou retirada', icon: PackageMinus, cores: 'border-red-200 bg-red-50 text-red-800' },
  { tipo: 'CONTAGEM', titulo: 'Contagem', descricao: 'Conferir saldo físico', icon: ClipboardCheck, cores: 'border-blue-200 bg-blue-50 text-blue-800' },
  { tipo: 'PERDA', titulo: 'Perda', descricao: 'Quebra ou descarte', icon: AlertTriangle, cores: 'border-violet-200 bg-violet-50 text-violet-800' },
]

const STATUS: Record<string, { label: string; classe: string }> = {
  PENDENTE: { label: 'Aguardando revisão', classe: 'bg-amber-100 text-amber-800' },
  EFETIVADO: { label: 'Lançado', classe: 'bg-emerald-100 text-emerald-800' },
  PARCIAL: { label: 'Lançado parcialmente', classe: 'bg-blue-100 text-blue-800' },
  REJEITADO: { label: 'Não lançado', classe: 'bg-red-100 text-red-800' },
  CANCELADO: { label: 'Cancelado', classe: 'bg-slate-200 text-slate-700' },
}

function itemVazio(): ItemRascunho {
  return { chave: Date.now() + Math.random(), insumoId: '', quantidade: '', custoUnitario: '', observacao: '' }
}

function formatarQuantidade(valor: unknown, unidade: string): string {
  return `${comoNumero(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${unidade}`
}

export default function RegistroEstoqueSimplificadoPage() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState<TipoLote>('ENTRADA')
  const [itens, setItens] = useState<ItemRascunho[]>([itemVazio()])
  const [documento, setDocumento] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const { data: insumos = [], isLoading: carregandoInsumos } = useQuery({
    queryKey: ['estoque-registro-insumos'],
    queryFn: () => fetchList<Insumo>('/insumos?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })
  const { data: historico, isLoading: carregandoHistorico, isError: erroHistorico, error: detalheErroHistorico } = useQuery({
    queryKey: ['estoque-lotes-me'],
    queryFn: () => apiFetch<ListaLotes>('/estoque-lotes?page=1&pageSize=10'),
  })
  const insumosOrdenados = useMemo(() => [...insumos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [insumos])

  const selecionarTipo = (novoTipo: TipoLote) => {
    const preenchido = itens.some(item => item.insumoId || item.quantidade || item.observacao)
    if (preenchido && novoTipo !== tipo) {
      showToast('Envie ou limpe o lote atual antes de trocar o tipo', 'warning')
      return
    }
    setTipo(novoTipo)
  }

  const atualizarItem = (chave: number, campo: keyof Omit<ItemRascunho, 'chave'>, valor: string) => {
    setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, [campo]: valor } : item))
  }

  const removerItem = (chave: number) => {
    setItens(atuais => atuais.length === 1 ? [itemVazio()] : atuais.filter(item => item.chave !== chave))
  }

  const limpar = () => {
    setItens([itemVazio()])
    setDocumento('')
    setObservacao('')
  }

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault()
    const validos = itens.map(item => ({ ...item, quantidadeNumero: comoDecimalDigitado(item.quantidade) }))
    if (validos.some(item => !item.insumoId || item.quantidadeNumero === null || (tipo === 'CONTAGEM' ? item.quantidadeNumero < 0 : item.quantidadeNumero <= 0))) {
      showToast('Preencha o insumo e uma quantidade válida em todos os itens', 'error')
      return
    }
    if (new Set(validos.map(item => item.insumoId)).size !== validos.length) {
      showToast('O mesmo insumo não pode aparecer duas vezes no lote', 'error')
      return
    }
    if (tipo === 'PERDA' && !observacao.trim() && validos.every(item => !item.observacao.trim())) {
      showToast('Informe o motivo da perda', 'error')
      return
    }

    setSalvando(true)
    try {
      await apiFetch('/estoque-lotes', {
        method: 'POST',
        body: {
          tipo,
          documento: documento.trim() || null,
          observacao: observacao.trim() || null,
          itens: validos.map(item => ({
            insumoId: Number(item.insumoId),
            quantidade: item.quantidadeNumero,
            custoUnitario: tipo === 'ENTRADA' && item.custoUnitario.trim() ? comoDecimalDigitado(item.custoUnitario) : null,
            observacao: item.observacao.trim() || null,
          })),
        },
      })
      limpar()
      await queryClient.invalidateQueries({ queryKey: ['estoque-lotes-me'] })
      showToast(`Lote com ${validos.length} item(ns) enviado para revisão`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao enviar o lote', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const cancelar = async (lote: Lote) => {
    if (!window.confirm(`Cancelar o lote #${lote.id}?`)) return
    try {
      await apiFetch(`/estoque-lotes/${lote.id}/cancelar`, { method: 'POST' })
      await queryClient.invalidateQueries({ queryKey: ['estoque-lotes-me'] })
      showToast('Lote cancelado', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao cancelar o lote', 'error')
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-7">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Registro de estoque</h1>
        <p className="mt-1 text-sm text-slate-600">Monte um lote com vários itens. O saldo só muda depois da conferência administrativa.</p>
      </header>

      <section aria-label="Tipo do registro" className="grid grid-cols-2 gap-2 sm:gap-3">
        {TIPOS.map(option => {
          const Icon = option.icon
          const ativo = tipo === option.tipo
          return (
            <button key={option.tipo} type="button" onClick={() => selecionarTipo(option.tipo)} aria-pressed={ativo} className={`min-h-24 rounded-xl border p-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:p-4 ${option.cores} ${ativo ? 'ring-2 ring-current shadow-sm' : 'opacity-80 hover:opacity-100'}`}>
              <Icon className="mb-2 h-5 w-5" />
              <strong className="block text-sm sm:text-base">{option.titulo}</strong>
              <span className="mt-0.5 block text-xs opacity-80">{option.descricao}</span>
            </button>
          )
        })}
      </section>

      <form onSubmit={enviar} className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div><h2 className="font-bold text-slate-950">Lote de {TIPOS.find(item => item.tipo === tipo)?.titulo.toLowerCase()}</h2><p className="text-xs text-slate-500">{itens.length} item(ns) no lote</p></div>
          <button type="button" onClick={() => setItens(atuais => [...atuais, itemVazio()])} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 text-sm font-bold text-orange-700 hover:bg-orange-100"><Plus size={17} />Adicionar</button>
        </div>

        <div className="divide-y divide-slate-100">
          {itens.map((item, index) => {
            const insumo = insumosOrdenados.find(opcao => String(opcao.id) === item.insumoId)
            return (
              <fieldset key={item.chave} className="p-4 sm:p-5">
                <legend className="sr-only">Item {index + 1}</legend>
                <div className="mb-3 flex items-center justify-between"><strong className="text-sm text-slate-700">Item {index + 1}</strong><button type="button" onClick={() => removerItem(item.chave)} aria-label={`Remover item ${index + 1}`} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="sm:col-span-2"><span className="mb-1 block text-sm font-medium text-slate-700">Insumo</span><select value={item.insumoId} onChange={event => atualizarItem(item.chave, 'insumoId', event.target.value)} disabled={carregandoInsumos} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-orange-500" required><option value="">Selecione</option>{insumosOrdenados.map(opcao => <option key={opcao.id} value={opcao.id}>{opcao.codigo} · {opcao.nome}</option>)}</select></label>
                  <label><span className="mb-1 block text-sm font-medium text-slate-700">{tipo === 'CONTAGEM' ? 'Saldo contado' : 'Quantidade'}</span><div className="flex h-11 overflow-hidden rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-orange-500"><input inputMode="decimal" value={item.quantidade} onChange={event => atualizarItem(item.chave, 'quantidade', event.target.value)} className="min-w-0 flex-1 px-3 text-sm text-slate-950 outline-none" required /><span className="flex min-w-12 items-center justify-center border-l border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-600">{insumo?.unidade ?? '—'}</span></div></label>
                  {tipo === 'ENTRADA' ? <label><span className="mb-1 block text-sm font-medium text-slate-700">Custo unitário</span><input inputMode="decimal" value={item.custoUnitario} onChange={event => atualizarItem(item.chave, 'custoUnitario', event.target.value)} placeholder="Opcional" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-orange-500" /></label> : <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Saldo no sistema</span><strong className="text-sm text-slate-800">{insumo ? formatarQuantidade(insumo.saldoAtual, insumo.unidade) : '—'}</strong></div>}
                  <label className="sm:col-span-2 lg:col-span-4"><span className="mb-1 block text-sm font-medium text-slate-700">Observação do item</span><input value={item.observacao} onChange={event => atualizarItem(item.chave, 'observacao', event.target.value)} placeholder={tipo === 'PERDA' ? 'Motivo da perda' : 'Opcional'} className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-orange-500" /></label>
                </div>
              </fieldset>
            )
          })}
        </div>

        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5">
          <label><span className="mb-1 block text-sm font-medium text-slate-700">Documento</span><input value={documento} onChange={event => setDocumento(event.target.value)} placeholder="NF, requisição ou referência" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-orange-500" /></label>
          <label><span className="mb-1 block text-sm font-medium text-slate-700">Observação geral</span><input value={observacao} onChange={event => setObservacao(event.target.value)} placeholder={tipo === 'PERDA' ? 'Obrigatória se os itens não tiverem motivo' : 'Opcional'} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-orange-500" /></label>
          <button type="submit" disabled={salvando} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-orange-700 disabled:opacity-60 sm:col-span-2"><Send size={18} />{salvando ? 'Enviando...' : `Enviar lote com ${itens.length} item(ns)`}</button>
        </div>
      </form>

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-950">Histórico recente</h2><p className="text-sm text-slate-500">Acompanhe o resultado dos seus lotes.</p></div><Scale className="h-5 w-5 text-slate-400" /></div>
        {erroHistorico ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{detalheErroHistorico instanceof Error ? detalheErroHistorico.message : 'Falha ao carregar o histórico'}</div> : carregandoHistorico ? <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Carregando...</p> : historico?.data.length ? <div className="space-y-2">{historico.data.map(lote => {
          const status = STATUS[lote.status] ?? { label: lote.status, classe: 'bg-slate-100 text-slate-700' }
          return <article key={lote.id} className="rounded-lg border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900">Lote #{lote.id} · {TIPOS.find(item => item.tipo === lote.tipo)?.titulo}</h3><p className="mt-0.5 text-xs text-slate-500">{new Date(lote.criadoEm).toLocaleString('pt-BR')} · {lote.itens.length} item(ns)</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.classe}`}>{status.label}</span></div><p className="mt-2 text-sm text-slate-600">{lote.itens.slice(0, 3).map(item => item.insumo.nome).join(', ')}{lote.itens.length > 3 ? ` e mais ${lote.itens.length - 3}` : ''}</p>{lote.motivoRevisao && <p className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{lote.motivoRevisao}</p>}{lote.status === 'PENDENTE' && <button type="button" onClick={() => void cancelar(lote)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"><X size={14} />Cancelar lote</button>}</article>
        })}</div> : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">Nenhum lote enviado ainda.</div>}
      </section>
    </main>
  )
}
