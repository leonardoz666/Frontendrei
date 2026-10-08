'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ban, CalendarDays, ChevronLeft, ChevronRight, Clock3, Download, History, Loader2, LockKeyhole, RefreshCw, ShoppingBag, Trash2, Upload, UserRound, X } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

type HistoricoItem = {
  id: number
  produto: string
  quantidade: number
  valorUnitario: number
  observacao: string | null
  status: string
}

type HistoricoEvento = {
  id: string
  tipo: 'LANCAMENTO' | 'CANCELAMENTO'
  ocorridoEm: string
  dataAproximada?: boolean
  importado?: boolean
  pedidoId: number
  comandaId: number
  mesa: number
  operador: string
  status?: string
  motivo?: string
  total: number
  itens: HistoricoItem[]
}

type HistoricoResposta = {
  data: HistoricoEvento[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    lancamentos: number
    cancelamentos: number
  }
}

function dataInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

function inicioDoDia(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString()
}

function fimDoDia(value: string): string {
  return new Date(`${value}T23:59:59.999`).toISOString()
}

function moeda(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataGrupo(value: string): string {
  const data = new Date(value)
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)
  const chave = dataInput(data)
  if (chave === dataInput(hoje)) return 'Hoje'
  if (chave === dataInput(ontem)) return 'Ontem'
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

export default function HistoricoPedidosPage() {
  const { showToast } = useToast()
  const hoje = useMemo(() => new Date(), [])
  const seteDiasAtras = useMemo(() => {
    const data = new Date()
    data.setDate(data.getDate() - 6)
    return data
  }, [])
  const [inicio, setInicio] = useState(dataInput(seteDiasAtras))
  const [fim, setFim] = useState(dataInput(hoje))
  const [tipo, setTipo] = useState<'TODOS' | 'LANCAMENTO' | 'CANCELAMENTO'>('TODOS')
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState<HistoricoResposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [permissions, setPermissions] = useState<string[] | null>(null)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<'EXPORTAR' | 'IMPORTAR' | 'EXCLUIR' | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [senhaExclusao, setSenhaExclusao] = useState('')
  const importInputRef = useRef<HTMLInputElement>(null)

  const parametros = useCallback((page: number, pageSize: number) => new URLSearchParams({
    inicio: inicioDoDia(inicio),
    fim: fimDoDia(fim),
    tipo,
    page: String(page),
    pageSize: String(pageSize)
  }), [fim, inicio, tipo])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const params = parametros(pagina, 40)
      setResultado(await apiFetch<HistoricoResposta>(`/orders/history?${params}`))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o histórico')
    } finally {
      setCarregando(false)
    }
  }, [pagina, parametros])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    apiFetch<{ user?: { permissions?: string[] } }>('/auth/me')
      .then(data => setPermissions(data.user?.permissions ?? []))
      .catch(() => setPermissions([]))
  }, [])

  const grupos = useMemo(() => {
    const mapa = new Map<string, HistoricoEvento[]>()
    for (const evento of resultado?.data ?? []) {
      const chave = dataInput(new Date(evento.ocorridoEm))
      const atual = mapa.get(chave) ?? []
      atual.push(evento)
      mapa.set(chave, atual)
    }
    return [...mapa.entries()]
  }, [resultado])

  const alterarFiltro = (novoTipo: typeof tipo) => {
    setTipo(novoTipo)
    setPagina(1)
  }

  const canExport = Boolean(permissions?.includes('relatorios.exportar'))
  const canImport = Boolean(permissions?.includes('relatorios.importar'))
  const canDelete = Boolean(permissions?.includes('relatorios.excluir'))

  const buscarTodos = async (): Promise<HistoricoEvento[]> => {
    const primeira = await apiFetch<HistoricoResposta>(`/orders/history?${parametros(1, 100)}`)
    const eventos = [...primeira.data]
    for (let page = 2; page <= primeira.meta.totalPages; page++) {
      const resposta = await apiFetch<HistoricoResposta>(`/orders/history?${parametros(page, 100)}`)
      eventos.push(...resposta.data)
    }
    return eventos
  }

  const exportar = async () => {
    setAcaoEmAndamento('EXPORTAR')
    try {
      const eventos = await buscarTodos()
      const conteudo = JSON.stringify({
        schema: 'rei-historico-v1',
        exportadoEm: new Date().toISOString(),
        periodo: { inicio, fim, tipo },
        events: eventos
      }, null, 2)
      const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `historico-rei-${inicio}-a-${fim}.json`
      link.click()
      URL.revokeObjectURL(url)
      showToast(`${eventos.length} registro(s) exportado(s).`, 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao exportar histórico', 'error')
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const importar = async (file: File) => {
    setAcaoEmAndamento('IMPORTAR')
    try {
      const documento: unknown = JSON.parse(await file.text())
      if (!documento || typeof documento !== 'object' || Array.isArray(documento)) throw new Error('Arquivo de histórico inválido')
      const registro = documento as { schema?: unknown; events?: unknown }
      if (registro.schema !== 'rei-historico-v1' || !Array.isArray(registro.events) || registro.events.length === 0) {
        throw new Error('Selecione um arquivo exportado pelo Histórico do Rei')
      }
      let importados = 0
      let restaurados = 0
      for (let index = 0; index < registro.events.length; index += 40) {
        const resposta = await apiFetch<{ imported: number; restored: number }>('/orders/history/import', {
          method: 'POST',
          body: { events: registro.events.slice(index, index + 40) }
        })
        importados += resposta.imported
        restaurados += resposta.restored
      }
      showToast(`Importação concluída: ${importados} novo(s), ${restaurados} restaurado(s).`, 'success')
      setPagina(1)
      await carregar()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao importar histórico', 'error')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
      setAcaoEmAndamento(null)
    }
  }

  const excluir = async () => {
    if (!senhaExclusao) return
    setAcaoEmAndamento('EXCLUIR')
    try {
      const eventos = await buscarTodos()
      if (eventos.length === 0) throw new Error('Não há registros para excluir neste filtro')
      for (let index = 0; index < eventos.length; index += 400) {
        await apiFetch('/orders/history/delete', {
          method: 'POST',
          body: { eventIds: eventos.slice(index, index + 400).map(evento => evento.id), senha: senhaExclusao }
        })
      }
      showToast(`${eventos.length} registro(s) removido(s) do histórico.`, 'success')
      setShowDeleteModal(false)
      setSenhaExclusao('')
      setPagina(1)
      await carregar()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao excluir histórico', 'error')
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-orange-700">
              <ArrowLeft size={16} /> Painel
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-950"><History className="text-orange-600" /> Histórico</h1>
            <p className="mt-1 text-sm text-slate-600">Pedidos lançados e itens cancelados, organizados por dia.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void exportar()} title={canExport ? 'Exportar histórico filtrado' : 'Sem permissão para exportar histórico'} disabled={!canExport || acaoEmAndamento !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45">{acaoEmAndamento === 'EXPORTAR' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Exportar</button>
            <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importar(file) }} />
            <button type="button" onClick={() => importInputRef.current?.click()} title={canImport ? 'Importar arquivo de histórico' : 'Sem permissão para importar histórico'} disabled={!canImport || acaoEmAndamento !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45">{acaoEmAndamento === 'IMPORTAR' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Importar</button>
            <button type="button" onClick={() => { setSenhaExclusao(''); setShowDeleteModal(true) }} title={canDelete ? 'Excluir histórico filtrado' : 'Sem permissão para excluir histórico'} disabled={!canDelete || acaoEmAndamento !== null || (resultado?.meta.total ?? 0) === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"><Trash2 size={16} /> Excluir</button>
            <button type="button" onClick={() => void carregar()} disabled={carregando || acaoEmAndamento !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>
        </header>

        <section aria-label="Filtros do histórico" className="grid gap-4 border-b border-slate-200 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="text-sm font-semibold text-slate-800">Data inicial
            <input type="date" value={inicio} max={fim} onChange={event => { setInicio(event.target.value); setPagina(1) }} className="mt-1.5 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal text-slate-950" />
          </label>
          <label className="text-sm font-semibold text-slate-800">Data final
            <input type="date" value={fim} min={inicio} onChange={event => { setFim(event.target.value); setPagina(1) }} className="mt-1.5 block h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-normal text-slate-950" />
          </label>
          <div className="grid h-11 grid-cols-3 rounded-md border border-slate-300 bg-white p-1">
            {([['TODOS', 'Todos'], ['LANCAMENTO', 'Lançados'], ['CANCELAMENTO', 'Cancelados']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => alterarFiltro(value)} aria-pressed={tipo === value} className={`rounded px-3 text-sm font-semibold transition-colors ${tipo === value ? 'bg-orange-600 text-white' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'}`}>{label}</button>
            ))}
          </div>
        </section>

        {resultado && (
          <section aria-label="Resumo do período" className="grid grid-cols-2 border-b border-slate-200 py-4 sm:w-fit sm:min-w-[360px]">
            <div className="border-r border-slate-200 pr-6"><p className="text-xs font-bold uppercase text-slate-500">Lançados</p><p className="mt-1 text-2xl font-bold text-blue-700">{resultado.meta.lancamentos}</p></div>
            <div className="pl-6"><p className="text-xs font-bold uppercase text-slate-500">Cancelados</p><p className="mt-1 text-2xl font-bold text-red-700">{resultado.meta.cancelamentos}</p></div>
          </section>
        )}

        {erro && <div role="alert" className="my-5 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{erro}</div>}
        {carregando && !resultado && <div role="status" className="py-16 text-center text-sm text-slate-600">Carregando histórico...</div>}

        {!carregando && !erro && grupos.length === 0 && (
          <div className="py-16 text-center"><CalendarDays className="mx-auto h-9 w-9 text-slate-400" /><p className="mt-3 font-semibold text-slate-700">Nenhum registro encontrado neste período.</p></div>
        )}

        <div className="divide-y divide-slate-200">
          {grupos.map(([data, eventos]) => (
            <section key={data} className="py-6">
              <h2 className="mb-3 capitalize text-sm font-bold text-slate-700">{dataGrupo(eventos[0].ocorridoEm)}</h2>
              <div className="space-y-3">
                {eventos.map(evento => {
                  const cancelamento = evento.tipo === 'CANCELAMENTO'
                  return (
                    <article key={evento.id} className={`overflow-hidden rounded-md border bg-white ${cancelamento ? 'border-red-200' : 'border-slate-200'}`}>
                      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${cancelamento ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {cancelamento ? <Ban size={18} /> : <ShoppingBag size={18} />}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-950">{cancelamento ? 'Item cancelado' : `Pedido #${evento.pedidoId} lançado`}</p>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>Mesa {evento.mesa}</span>
                              <span className="inline-flex items-center gap-1"><UserRound size={13} /> {evento.operador}</span>
                              <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {new Date(evento.ocorridoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">{evento.importado && <span className="rounded bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800">IMPORTADO</span>}<strong className={cancelamento ? 'text-red-700' : 'text-slate-900'}>{cancelamento ? `-${moeda(evento.total)}` : moeda(evento.total)}</strong></div>
                      </div>

                      {cancelamento && (
                        <div className="border-y border-red-100 bg-red-50 px-4 py-2 text-sm text-red-900">
                          <strong>Motivo:</strong> {evento.motivo}
                          {evento.dataAproximada && <span className="ml-2 text-xs text-red-700">Horário exato não registrado</span>}
                        </div>
                      )}

                      <div className="divide-y divide-slate-100 px-4">
                        {evento.itens.map(item => (
                          <div key={item.id} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                            <div className="min-w-0"><span className="font-semibold text-slate-800">{item.quantidade}x {item.produto}</span>{item.observacao && <span className="mt-0.5 block break-words text-xs text-slate-500">{item.observacao}</span>}</div>
                            <div className="shrink-0 text-right"><span className="font-medium text-slate-700">{moeda(item.valorUnitario * item.quantidade)}</span>{!cancelamento && item.status === 'CANCELADO' && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">CANCELADO</span>}</div>
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {resultado && resultado.meta.totalPages > 1 && (
          <nav aria-label="Paginação do histórico" className="flex items-center justify-between border-t border-slate-200 py-5">
            <p className="text-sm text-slate-600">Página {resultado.meta.page} de {resultado.meta.totalPages} · {resultado.meta.total} registros</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPagina(current => Math.max(1, current - 1))} disabled={pagina <= 1 || carregando} aria-label="Página anterior" className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setPagina(current => Math.min(resultado.meta.totalPages, current + 1))} disabled={pagina >= resultado.meta.totalPages || carregando} aria-label="Próxima página" className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={18} /></button>
            </div>
          </nav>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="delete-history-title" className="w-full max-w-md overflow-hidden rounded-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-red-200 bg-red-600 px-5 py-4 text-white">
              <div><h2 id="delete-history-title" className="text-lg font-bold">Excluir histórico filtrado</h2><p className="mt-0.5 text-sm text-red-50">{resultado?.meta.total ?? 0} registro(s) no período atual</p></div>
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={acaoEmAndamento === 'EXCLUIR'} aria-label="Fechar" className="rounded p-1.5 hover:bg-red-700 disabled:opacity-50"><X size={20} /></button>
            </div>
            <div className="px-5 py-5">
              <div className="border-l-4 border-amber-500 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">Os registros deixarão de aparecer no histórico, mas pedidos, pagamentos, estoque e dados fiscais serão preservados.</div>
              <label htmlFor="history-password" className="mt-4 block text-sm font-semibold text-slate-900">Senha de login do usuário atual</label>
              <div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input id="history-password" type="password" value={senhaExclusao} onChange={event => setSenhaExclusao(event.target.value)} autoComplete="current-password" autoFocus className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-slate-950 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" /></div>
              <p className="mt-1.5 text-xs text-slate-500">A senha é usada somente para confirmar esta operação e não é armazenada.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={acaoEmAndamento === 'EXCLUIR'} className="h-10 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void excluir()} disabled={!senhaExclusao || acaoEmAndamento === 'EXCLUIR'} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50">{acaoEmAndamento === 'EXCLUIR' ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />} Excluir histórico</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
