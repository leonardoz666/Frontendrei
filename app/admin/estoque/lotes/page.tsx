'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ChevronRight, ClipboardList, PackageCheck, RefreshCw, X } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import { comoDecimalDigitado, comoNumero } from '@/app/lib/crud-client'
import { Switch } from '@/app/components/ui/Switch'
import { useToast } from '@/contexts/ToastContext'

type TipoLote = 'ENTRADA' | 'SAIDA' | 'CONTAGEM' | 'PERDA'
type ItemLote = {
  id: number
  status: string
  quantidade: number | string
  quantidadeInformada: number | string
  unidadeSnapshot: string
  unidadeInformada: string
  fatorConversao: number | string
  saldoReferencia: number | string
  custoUnitario: number | string | null
  custoUnitarioInformado: number | string | null
  observacao: string | null
  insumo: { id: number; codigo: string; nome: string; unidade: string; saldoAtual: number | string }
  movimento?: { id: number } | null
}
type Lote = {
  id: number
  tipo: TipoLote
  status: string
  documento: string | null
  observacao: string | null
  motivoRevisao: string | null
  criadoEm: string
  revisadoEm: string | null
  solicitante: { id: number; nome: string }
  revisor: { id: number; nome: string } | null
  itens: ItemLote[]
}
type ListaLotes = { data: Lote[]; meta: { total: number } }
type Ajuste = { quantidade: string; custoUnitario: string; observacao: string }

const TIPO_LABEL: Record<TipoLote, string> = { ENTRADA: 'Entrada', SAIDA: 'Saída', CONTAGEM: 'Contagem', PERDA: 'Perda' }
const STATUS_LABEL: Record<string, string> = { PENDENTE: 'Pendente', EFETIVADO: 'Lançado', PARCIAL: 'Parcial', REJEITADO: 'Não lançado', CANCELADO: 'Cancelado' }

function numero(valor: unknown): string {
  return comoNumero(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

export default function RevisaoLotesEstoquePage() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<'PENDENTE' | 'TODOS'>('PENDENTE')
  const [lote, setLote] = useState<Lote | null>(null)
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [ajustes, setAjustes] = useState<Record<number, Ajuste>>({})
  const [motivo, setMotivo] = useState('')
  const [confirmarDivergencias, setConfirmarDivergencias] = useState(false)
  const [permitirNegativo, setPermitirNegativo] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const url = filtro === 'PENDENTE' ? '/estoque-lotes?page=1&pageSize=25&status=PENDENTE' : '/estoque-lotes?page=1&pageSize=25'
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['estoque-lotes-revisao', filtro],
    queryFn: () => apiFetch<ListaLotes>(url),
  })

  const abrirLote = (selecionado: Lote) => {
    setLote(selecionado)
    setSelecionados(new Set(selecionado.status === 'PENDENTE' ? selecionado.itens.map(item => item.id) : []))
    setAjustes(Object.fromEntries(selecionado.itens.map(item => [item.id, {
      quantidade: String(item.quantidadeInformada),
      custoUnitario: item.custoUnitarioInformado === null ? '' : String(item.custoUnitarioInformado),
      observacao: item.observacao ?? '',
    }])))
    setMotivo('')
    setConfirmarDivergencias(false)
    setPermitirNegativo(false)
  }

  const divergencias = useMemo(() => lote?.tipo === 'CONTAGEM'
    ? lote.itens.filter(item => Math.abs(comoNumero(item.saldoReferencia) - comoNumero(item.insumo.saldoAtual)) >= 0.0005)
    : [], [lote])

  const alternarItem = (id: number) => {
    setSelecionados(atuais => {
      const proximos = new Set(atuais)
      if (proximos.has(id)) proximos.delete(id)
      else proximos.add(id)
      return proximos
    })
  }

  const atualizarAjuste = (id: number, campo: keyof Ajuste, valor: string) => {
    setAjustes(atuais => ({ ...atuais, [id]: { ...atuais[id], [campo]: valor } }))
  }

  const revisar = async () => {
    if (!lote) return
    const rejeitados = lote.itens.length - selecionados.size
    if (rejeitados > 0 && !motivo.trim()) {
      showToast('Informe o motivo dos itens que não serão lançados', 'error')
      return
    }
    let itensEfetivar: Array<{ id: number; quantidade: number; custoUnitario: number | null; observacao: string | null }>
    try {
      itensEfetivar = lote.itens.filter(item => selecionados.has(item.id)).map(item => {
        const ajuste = ajustes[item.id]
        const quantidade = comoDecimalDigitado(ajuste.quantidade)
        const custo = ajuste.custoUnitario.trim() ? comoDecimalDigitado(ajuste.custoUnitario) : null
        if (quantidade === null || (lote.tipo === 'CONTAGEM' ? quantidade < 0 : quantidade <= 0)) throw new Error(`Quantidade inválida para ${item.insumo.nome}`)
        if (custo !== null && custo < 0) throw new Error(`Custo inválido para ${item.insumo.nome}`)
        return { id: item.id, quantidade, custoUnitario: custo, observacao: ajuste.observacao.trim() || null }
      })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Dados inválidos', 'error')
      return
    }
    if (!window.confirm(selecionados.size === 0 ? `Não lançar nenhum item do lote #${lote.id}?` : `Lançar ${selecionados.size} item(ns) do lote #${lote.id}?`)) return

    setSalvando(true)
    try {
      await apiFetch(`/estoque-lotes/${lote.id}/revisar`, {
        method: 'POST',
        body: { itensEfetivar, motivoRevisao: motivo.trim() || null, confirmarDivergencias, permitirNegativo },
      })
      showToast(selecionados.size === 0 ? 'Lote marcado como não lançado' : 'Lote lançado no estoque', 'success')
      setLote(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['estoque-lotes-revisao'] }),
        queryClient.invalidateQueries({ queryKey: ['estoque-resumo'] }),
      ])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao revisar o lote', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">Lotes para revisão</h1><p className="mt-1 text-sm text-slate-600">Confira vários itens e lance os selecionados de uma só vez.</p></div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={17} className={isFetching ? 'animate-spin' : ''} />Atualizar</button>
      </header>

      <div className="mb-4 inline-grid grid-cols-2 rounded-lg bg-slate-200 p-1">
        <button type="button" onClick={() => setFiltro('PENDENTE')} className={`rounded-md px-4 py-2 text-sm font-bold ${filtro === 'PENDENTE' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>Pendentes</button>
        <button type="button" onClick={() => setFiltro('TODOS')} className={`rounded-md px-4 py-2 text-sm font-bold ${filtro === 'TODOS' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600'}`}>Histórico</button>
      </div>

      {isError && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error instanceof Error ? error.message : 'Falha ao carregar os lotes'}</div>}

      {!isError && (isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando lotes...</div> : data?.data.length ? (
        <div className="space-y-2">{data.data.map(item => (
          <button key={item.id} type="button" onClick={() => abrirLote(item)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-orange-300 hover:shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700"><ClipboardList size={20} /></span>
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-950">Lote #{item.id} · {TIPO_LABEL[item.tipo]}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{item.solicitante.nome} · {new Date(item.criadoEm).toLocaleString('pt-BR')} · {item.itens.length} item(ns)</span></span>
            <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex ${item.status === 'PENDENTE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{STATUS_LABEL[item.status] ?? item.status}</span>
            <ChevronRight size={18} className="shrink-0 text-slate-400" />
          </button>
        ))}</div>
      ) : <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"><PackageCheck className="mx-auto mb-3 h-8 w-8 text-emerald-600" /><p className="font-bold text-slate-800">Nenhum lote {filtro === 'PENDENTE' ? 'pendente' : 'encontrado'}</p><p className="mt-1 text-sm text-slate-500">Os lotes enviados pelos estoquistas aparecerão aqui.</p></div>)}

      {lote && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6">
          <section role="dialog" aria-modal="true" aria-labelledby="lote-title" className="my-2 w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl sm:my-6">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div><h2 id="lote-title" className="text-xl font-bold text-slate-950">Lote #{lote.id} · {TIPO_LABEL[lote.tipo]}</h2><p className="mt-1 text-sm text-slate-500">Registrado por {lote.solicitante.nome} em {new Date(lote.criadoEm).toLocaleString('pt-BR')}</p></div>
              <button type="button" onClick={() => setLote(null)} aria-label="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </header>

            <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto">
              {(lote.documento || lote.observacao) && <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-2 sm:px-6">{lote.documento && <p><span className="font-bold text-slate-700">Documento:</span> {lote.documento}</p>}{lote.observacao && <p><span className="font-bold text-slate-700">Observação:</span> {lote.observacao}</p>}</div>}
              {divergencias.length > 0 && <div className="m-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:mx-6"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>{divergencias.length} saldo(s) mudaram desde a contagem.</strong><p className="mt-0.5">Confira os valores atuais antes de continuar.</p></div></div>}

              <div className="divide-y divide-slate-100">
                {lote.itens.map(item => {
                  const selecionado = selecionados.has(item.id)
                  const ajuste = ajustes[item.id]
                  const saldoMudou = Math.abs(comoNumero(item.saldoReferencia) - comoNumero(item.insumo.saldoAtual)) >= 0.0005
                  return <article key={item.id} className={`px-4 py-4 sm:px-6 ${selecionado ? 'bg-white' : 'bg-slate-50 opacity-70'}`}>
                    <div className="grid items-start gap-3 lg:grid-cols-[auto_minmax(180px,1fr)_140px_140px_minmax(180px,1fr)]">
                      <label className="flex min-h-11 cursor-pointer items-center"><input type="checkbox" checked={selecionado} onChange={() => alternarItem(item.id)} disabled={lote.status !== 'PENDENTE'} className="h-5 w-5 accent-orange-600" /><span className="sr-only">Selecionar {item.insumo.nome}</span></label>
                      <div><strong className="block text-sm text-slate-900">{item.insumo.nome}</strong><span className="font-mono text-xs text-slate-500">{item.insumo.codigo}</span>{lote.tipo === 'CONTAGEM' && <span className={`mt-1 block text-xs ${saldoMudou ? 'font-bold text-amber-700' : 'text-slate-500'}`}>No envio: {numero(item.saldoReferencia)} · Agora: {numero(item.insumo.saldoAtual)} {item.insumo.unidade}</span>}</div>
                      <label><span className="mb-1 block text-xs font-bold text-slate-700">{lote.tipo === 'CONTAGEM' ? 'Contado' : 'Quantidade'}</span><div className="flex h-10 overflow-hidden rounded-lg border border-slate-400 bg-white focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200"><input inputMode="decimal" value={ajuste?.quantidade ?? ''} onChange={event => atualizarAjuste(item.id, 'quantidade', event.target.value)} disabled={!selecionado || lote.status !== 'PENDENTE'} className="min-w-0 flex-1 bg-white px-2 text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-transparent disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /><span className="flex items-center border-l border-slate-300 bg-slate-100 px-2 text-xs font-bold text-slate-700">{item.unidadeInformada}</span></div>{item.unidadeInformada !== item.unidadeSnapshot && <span className="mt-1 block text-[11px] text-slate-500">1 {item.unidadeInformada} = {numero(item.fatorConversao)} {item.unidadeSnapshot}</span>}</label>
                      {lote.tipo === 'ENTRADA' ? <label><span className="mb-1 block text-xs font-bold text-slate-700">Custo por {item.unidadeInformada}</span><input inputMode="decimal" value={ajuste?.custoUnitario ?? ''} onChange={event => atualizarAjuste(item.id, 'custoUnitario', event.target.value)} disabled={!selecionado || lote.status !== 'PENDENTE'} className="h-10 w-full rounded-lg border border-slate-400 bg-white px-2 text-sm font-medium text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></label> : <div />}
                      <label><span className="mb-1 block text-xs font-bold text-slate-700">Observação</span><input value={ajuste?.observacao ?? ''} onChange={event => atualizarAjuste(item.id, 'observacao', event.target.value)} disabled={!selecionado || lote.status !== 'PENDENTE'} className="h-10 w-full rounded-lg border border-slate-400 bg-white px-2 text-sm font-medium text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /></label>
                    </div>
                  </article>
                })}
              </div>

              {lote.status === 'PENDENTE' ? <div className="space-y-4 border-t border-slate-200 bg-slate-50 p-4 sm:p-6">
                {selecionados.size < lote.itens.length && <label><span className="mb-1 block text-sm font-bold text-slate-700">Motivo dos itens não lançados</span><textarea value={motivo} onChange={event => setMotivo(event.target.value)} className="min-h-20 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500" required /></label>}
                {divergencias.length > 0 && <Switch checked={confirmarDivergencias} onCheckedChange={setConfirmarDivergencias} label="Confirmo que revisei os saldos alterados" description="A contagem será calculada contra o saldo atual." />}
                {lote.tipo !== 'ENTRADA' && <Switch checked={permitirNegativo} onCheckedChange={setPermitirNegativo} label="Permitir saldo negativo" description="Somente funciona para quem possui essa permissão." />}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setLote(null)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">Cancelar</button><button type="button" onClick={() => void revisar()} disabled={salvando || (divergencias.length > 0 && !confirmarDivergencias)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50 ${selecionados.size === 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}>{selecionados.size === 0 ? <X size={17} /> : <Check size={17} />}{salvando ? 'Processando...' : selecionados.size === 0 ? 'Não lançar lote' : `Lançar ${selecionados.size} item(ns)`}</button></div>
              </div> : <div className="border-t border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:px-6">Revisado por <strong>{lote.revisor?.nome ?? 'Administrador'}</strong>{lote.revisadoEm ? ` em ${new Date(lote.revisadoEm).toLocaleString('pt-BR')}` : ''}. {lote.motivoRevisao}</div>}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
