'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, History, Printer, RotateCcw, Settings2, X } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import { buildPrintHtml } from '@/app/lib/export'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { ExportMenu } from '@/app/components/ui/ExportMenu'
import { Button } from '@/app/components/ui/Button'
import type { PageSize } from '@/app/lib/pagination'
import { useToast } from '@/contexts/ToastContext'

type Movimento = { id: number; tipo: string; valor: number; descricao: string | null; criadoEm: string }
type Pagamento = { id: number; tipo: string; valor: number; status: string; criadoEm: string; motivoEstorno: string | null }
type CaixaResumo = {
  caixa: {
    id: number
    status: string
    abertoEm: string
    fechadoEm: string | null
    saldoInicial: number
    saldoFechamento: number | null
    observacaoFechamento: string | null
    movimentos: Movimento[]
  }
  usuarioAbertura?: string | null
  usuarioFechamento?: string | null
  vendasPorForma: Array<{ tipo: string; total: number }>
  vendasTotal: number
  vendasEmDinheiro: number
  suprimentos: number
  sangrias: number
  ajustes: number
  dinheiroEsperado: number
  saldoInformado: number | null
  diferenca: number | null
  quantidadePagamentos: number
  pagamentos?: Pagamento[]
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const formatarMoeda = (valor: number | null | undefined) => valor == null ? '-' : moeda.format(Number(valor))
const formatarData = (valor: string | null) => valor ? dataHora.format(new Date(valor)) : '-'
const nomeForma = (valor: string) => valor.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letra => letra.toUpperCase())

export default function HistoricoCaixaPage() {
  const { showToast } = useToast()
  const [caixas, setCaixas] = useState<CaixaResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [desde, setDesde] = useState(() => {
    const data = new Date()
    data.setDate(data.getDate() - 30)
    return data.toISOString().slice(0, 10)
  })
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(25)
  const [detalhes, setDetalhes] = useState<CaixaResumo | null>(null)
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])
  const [pagamentoEstorno, setPagamentoEstorno] = useState<Pagamento | null>(null)
  const [motivoEstorno, setMotivoEstorno] = useState('')
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteMotivo, setAjusteMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [historico, me] = await Promise.all([
        apiFetch<{ data: CaixaResumo[] }>(`/caixa/historico?desde=${desde}`),
        apiFetch<{ user?: { permissions?: string[] } }>('/auth/me'),
      ])
      setCaixas(historico.data)
      setPermissions(me.user?.permissions ?? [])
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao carregar histórico', 'error')
    } finally {
      setLoading(false)
    }
  }, [desde, showToast])

  useEffect(() => { void carregar() }, [carregar])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return caixas
    return caixas.filter(item => [item.caixa.id, item.caixa.status, item.usuarioAbertura, item.usuarioFechamento]
      .some(valor => String(valor ?? '').toLocaleLowerCase('pt-BR').includes(termo)))
  }, [busca, caixas])
  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize))
  const paginaAtual = Math.min(page, totalPages)
  const data = filtrados.slice((paginaAtual - 1) * pageSize, paginaAtual * pageSize)

  const abrirDetalhes = async (caixaId: number) => {
    setCarregandoDetalhes(true)
    try {
      setDetalhes(await apiFetch<CaixaResumo>(`/caixa/${caixaId}/detalhes`))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao carregar detalhes', 'error')
    } finally {
      setCarregandoDetalhes(false)
    }
  }

  const estornar = async () => {
    if (!pagamentoEstorno || motivoEstorno.trim().length < 5) {
      showToast('Informe um motivo com pelo menos 5 caracteres', 'warning')
      return
    }
    setSalvando(true)
    try {
      await apiFetch(`/caixa/pagamentos/${pagamentoEstorno.id}/estornar`, { method: 'POST', body: { motivo: motivoEstorno } })
      showToast('Pagamento estornado e caixa recalculado', 'success')
      const caixaId = detalhes?.caixa.id
      setPagamentoEstorno(null)
      setMotivoEstorno('')
      if (caixaId) await abrirDetalhes(caixaId)
      await carregar()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao estornar pagamento', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const ajustar = async () => {
    if (!detalhes) return
    const valor = Number(ajusteValor.replace(',', '.'))
    if (!Number.isFinite(valor) || valor === 0 || ajusteMotivo.trim().length < 5) {
      showToast('Informe um valor diferente de zero e o motivo do ajuste', 'warning')
      return
    }
    setSalvando(true)
    try {
      await apiFetch(`/caixa/${detalhes.caixa.id}/ajustes`, { method: 'POST', body: { valor, descricao: ajusteMotivo } })
      showToast('Ajuste registrado sem alterar o fechamento original', 'success')
      setAjusteValor('')
      setAjusteMotivo('')
      await abrirDetalhes(detalhes.caixa.id)
      await carregar()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao registrar ajuste', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const imprimir = (item: CaixaResumo) => {
    const linhas = [
      { descricao: 'Saldo inicial', valor: formatarMoeda(item.caixa.saldoInicial) },
      { descricao: 'Vendas recebidas', valor: formatarMoeda(item.vendasTotal) },
      { descricao: 'Suprimentos', valor: formatarMoeda(item.suprimentos) },
      { descricao: 'Sangrias', valor: formatarMoeda(item.sangrias) },
      { descricao: 'Ajustes', valor: formatarMoeda(item.ajustes) },
      { descricao: 'Dinheiro esperado', valor: formatarMoeda(item.dinheiroEsperado) },
      { descricao: 'Saldo contado', valor: formatarMoeda(item.saldoInformado) },
      { descricao: 'Diferença', valor: formatarMoeda(item.diferenca) },
    ]
    const html = buildPrintHtml({
      title: `Fechamento do Caixa #${item.caixa.id}`,
      subtitle: `${formatarData(item.caixa.abertoEm)} até ${formatarData(item.caixa.fechadoEm)}`,
      columns: [{ key: 'descricao', label: 'Descrição' }, { key: 'valor', label: 'Valor' }],
      rows: linhas,
    })
    const janela = window.open('', '_blank')
    if (!janela) {
      showToast('Permita pop-ups para imprimir o fechamento', 'warning')
      return
    }
    janela.opener = null
    janela.document.write(html)
    janela.document.close()
  }

  const columns: Array<DataTableColumn<CaixaResumo>> = [
    { key: 'id', header: 'Caixa', render: item => <strong className="text-slate-900">#{item.caixa.id}</strong> },
    { key: 'abertura', header: 'Abertura', render: item => <span>{formatarData(item.caixa.abertoEm)}</span> },
    { key: 'fechamento', header: 'Fechamento', hideOnMobile: true, render: item => <span>{formatarData(item.caixa.fechadoEm)}</span> },
    { key: 'operador', header: 'Operador', hideOnMobile: true, render: item => <span>{item.usuarioFechamento ?? item.usuarioAbertura ?? '-'}</span> },
    { key: 'vendas', header: 'Vendas', align: 'right', render: item => <strong>{formatarMoeda(item.vendasTotal)}</strong> },
    { key: 'diferenca', header: 'Diferença', align: 'right', render: item => <strong className={Number(item.diferenca) === 0 ? 'text-emerald-700' : 'text-red-700'}>{formatarMoeda(item.diferenca)}</strong> },
    { key: 'status', header: 'Status', render: item => <span className={`text-xs font-bold ${item.caixa.status === 'FECHADO' ? 'text-slate-600' : 'text-emerald-700'}`}>{item.caixa.status}</span> },
  ]

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase text-orange-600">Caixa</p><h1 className="mt-1 text-3xl font-black text-slate-900">Histórico de caixas</h1><p className="mt-1 text-sm text-slate-500">Conferência, pagamentos, movimentos e divergências por turno.</p></div>
        <label className="text-sm font-semibold text-slate-700">Desde<input type="date" value={desde} onChange={event => { setDesde(event.target.value); setPage(1) }} className="ml-3 h-10 rounded-lg border border-slate-300 px-3" /></label>
      </header>
      <CashTabs />
      <div className="mt-6">
        <DataTable
          ariaLabel="Histórico de caixas"
          columns={columns}
          data={data}
          getRowId={item => item.caixa.id}
          meta={{ page: paginaAtual, pageSize, total: filtrados.length, totalPages }}
          loading={loading}
          storageKey="caixa-historico"
          itemLabel="caixas"
          emptyMessage="Nenhum caixa encontrado no período"
          onPageChange={setPage}
          onPageSizeChange={valor => { setPageSize(valor); setPage(1) }}
          onSearch={valor => { setBusca(valor); setPage(1) }}
          toolbar={<ExportMenu fileName="historico-caixas" title="Histórico de caixas" getRows={() => filtrados.map(item => ({ caixa: item.caixa.id, abertura: formatarData(item.caixa.abertoEm), fechamento: formatarData(item.caixa.fechadoEm), operador: item.usuarioFechamento ?? item.usuarioAbertura ?? '', vendas: item.vendasTotal, esperado: item.dinheiroEsperado, contado: item.saldoInformado ?? '', diferenca: item.diferenca ?? '', status: item.caixa.status }))} />}
          rowActions={{ extra: item => <Button type="button" size="icon" variant="ghost" title={`Ver caixa ${item.caixa.id}`} onClick={() => void abrirDetalhes(item.caixa.id)}><Eye size={17} /></Button> }}
        />
      </div>

      {(detalhes || carregandoDetalhes) && <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/55 p-4">
        <div className="mx-auto my-6 w-full max-w-5xl bg-white shadow-2xl">
          {carregandoDetalhes && !detalhes ? <p className="p-8 text-center text-slate-500">Carregando detalhes...</p> : detalhes && <>
            <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-xl font-black text-slate-900">Caixa #{detalhes.caixa.id}</h2><p className="text-sm text-slate-500">{formatarData(detalhes.caixa.abertoEm)} até {formatarData(detalhes.caixa.fechadoEm)}</p></div>
              <button type="button" title="Fechar" onClick={() => setDetalhes(null)} className="p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </header>
            <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
              {[['Vendas', formatarMoeda(detalhes.vendasTotal)], ['Esperado', formatarMoeda(detalhes.dinheiroEsperado)], ['Contado', formatarMoeda(detalhes.saldoInformado)], ['Diferença', formatarMoeda(detalhes.diferenca)]].map(([label, valor]) => <div key={label} className="bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{valor}</p></div>)}
            </div>
            <section className="px-5 py-5">
              <h3 className="font-bold text-slate-900">Pagamentos</h3>
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="border-y border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Forma</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-100">{(detalhes.pagamentos ?? []).map(pagamento => <tr key={pagamento.id}><td className="px-3 py-2">{formatarData(pagamento.criadoEm)}</td><td className="px-3 py-2">{nomeForma(pagamento.tipo)}</td><td className="px-3 py-2 text-right font-bold">{formatarMoeda(pagamento.valor)}</td><td className="px-3 py-2"><span>{pagamento.status}</span>{pagamento.motivoEstorno && <span className="block text-xs text-red-600">{pagamento.motivoEstorno}</span>}</td><td className="px-3 py-2 text-right">{pagamento.status === 'PAGO' && permissions.includes('pagamentos.estornar') && <Button size="sm" variant="danger" onClick={() => setPagamentoEstorno(pagamento)}><RotateCcw size={14} className="mr-1" /> Estornar</Button>}</td></tr>)}</tbody></table></div>
            </section>
            <section className="border-t border-slate-200 px-5 py-5"><h3 className="font-bold text-slate-900">Movimentações</h3><div className="mt-3 divide-y divide-slate-100">{detalhes.caixa.movimentos.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhuma movimentação.</p> : detalhes.caixa.movimentos.map(movimento => <div key={movimento.id} className="flex justify-between gap-4 py-2 text-sm"><span><strong>{movimento.tipo}</strong><span className="ml-2 text-slate-500">{movimento.descricao}</span></span><strong>{formatarMoeda(movimento.valor)}</strong></div>)}</div></section>
            {detalhes.caixa.status === 'FECHADO' && permissions.includes('caixa.ajustar_fechado') && <section className="border-t border-slate-200 bg-slate-50 px-5 py-5"><div className="flex items-center gap-2"><Settings2 size={18} className="text-orange-600" /><h3 className="font-bold text-slate-900">Ajuste pós-fechamento</h3></div><p className="mt-1 text-xs text-slate-500">Use valor negativo para retirada. O fechamento original permanece preservado.</p><div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_auto]"><input value={ajusteValor} onChange={event => setAjusteValor(event.target.value)} inputMode="decimal" placeholder="Valor (+/-)" className="h-10 border border-slate-300 px-3" /><input value={ajusteMotivo} onChange={event => setAjusteMotivo(event.target.value)} placeholder="Motivo obrigatório" className="h-10 border border-slate-300 px-3" /><Button onClick={() => void ajustar()} isLoading={salvando}>Registrar ajuste</Button></div></section>}
            <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-5 py-4"><ExportMenu fileName={`caixa-${detalhes.caixa.id}`} title={`Caixa #${detalhes.caixa.id}`} getRows={() => (detalhes.pagamentos ?? []).map(p => ({ data: formatarData(p.criadoEm), forma: nomeForma(p.tipo), valor: p.valor, status: p.status }))} /><Button variant="outline" onClick={() => imprimir(detalhes)}><Printer size={16} className="mr-2" /> Imprimir fechamento</Button><Button variant="secondary" onClick={() => setDetalhes(null)}>Fechar</Button></footer>
          </>}
        </div>
      </div>}

      {pagamentoEstorno && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md bg-white p-6 shadow-2xl"><h2 className="text-lg font-black text-slate-900">Estornar pagamento</h2><p className="mt-1 text-sm text-slate-600">{nomeForma(pagamentoEstorno.tipo)} · {formatarMoeda(pagamentoEstorno.valor)}</p><label className="mt-5 block text-sm font-bold text-slate-700">Motivo<textarea value={motivoEstorno} onChange={event => setMotivoEstorno(event.target.value)} className="mt-2 min-h-24 w-full border border-slate-300 p-3" placeholder="Motivo obrigatório" /></label><div className="mt-5 flex justify-end gap-3"><Button variant="outline" onClick={() => setPagamentoEstorno(null)}>Cancelar</Button><Button variant="danger" isLoading={salvando} onClick={() => void estornar()}>Confirmar estorno</Button></div></div></div>}
    </main>
  )
}

function CashTabs() {
  return <nav aria-label="Etapas do caixa" className="mt-6 flex w-fit max-w-full gap-1 rounded-lg bg-slate-100 p-1"><Link href="/caixa" className="rounded-md px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-white">Caixa do Dia</Link><Link href="/caixa/fechamento" className="rounded-md px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-white">Fechamento</Link><Link href="/caixa/historico" aria-current="page" className="rounded-md border border-orange-600 bg-orange-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm"><History size={15} className="mr-1 inline" /> Histórico</Link></nav>
}
