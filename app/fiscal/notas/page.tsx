'use client'

import { useState } from 'react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { apiFetch } from '@/app/lib/api'
import { formatarMoeda, paginaAtual, useListaCrud } from '@/app/lib/crud-client'
import { usePagedQuery } from '@/app/lib/pagination'
import { useToast } from '@/contexts/ToastContext'

type NotaFiscal = {
  id: number
  tipo: string
  numero: number
  serie: string
  status: string
  ambiente: string
  valorTotal: number | string
  motivoRejeicao: string | null
  emitidaEm: string
  cliente?: { nome: string; documento: string } | null
}

type FormState = {
  tipo: string
  numero: string
  serie: string
  ambiente: string
  valorTotal: string
}

type RelatorioFiscal = {
  totais: { quantidade: number; valor: number }
  porTipoStatus: Array<{ tipo: string; status: string; quantidade: number; valor: number }>
  produtos: Array<{ codigo: string; descricao: string; emissoes: number; quantidade: number; valor: number }>
}

function dataInput(data: Date): string {
  return data.toISOString().slice(0, 10)
}

const FORM_VAZIO: FormState = {
  tipo: 'NFCE',
  numero: '',
  serie: '1',
  ambiente: 'HOMOLOGACAO',
  valorTotal: '',
}

export default function NotasFiscaisPage() {
  const { showToast } = useToast()
  const ui = useListaCrud('/fiscal/notas')
  const { data, isLoading, isError, error, refetch } = usePagedQuery<NotaFiscal>(ui.listaParams)
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [inicio, setInicio] = useState(dataInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
  const [fim, setFim] = useState(dataInput(new Date()))
  const [relatorio, setRelatorio] = useState<RelatorioFiscal | null>(null)
  const [processando, setProcessando] = useState(false)

  const parametrosPeriodo = () => new URLSearchParams({
    ini: new Date(`${inicio}T00:00:00`).toISOString(),
    fim: new Date(`${fim}T23:59:59`).toISOString(),
  }).toString()

  const carregarRelatorio = async () => {
    try {
      setRelatorio(await apiFetch<RelatorioFiscal>(`/fiscal/relatorios/resumo?${parametrosPeriodo()}`))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao gerar relatório fiscal', 'error')
    }
  }

  const reprocessarFila = async () => {
    setProcessando(true)
    try {
      const resultado = await apiFetch<{ processadas: number; autorizadas: number; falhas: number }>('/fiscal/fila/reprocessar', { method: 'POST', body: { limite: 20 } })
      showToast(`${resultado.processadas} processada(s), ${resultado.autorizadas} autorizada(s), ${resultado.falhas} falha(s).`, resultado.falhas ? 'warning' : 'success')
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao reprocessar fila', 'error')
    } finally {
      setProcessando(false)
    }
  }

  const emitir = async (event: React.FormEvent) => {
    event.preventDefault()
    const numero = Number(form.numero)
    const valorTotal = Number(form.valorTotal.replace(',', '.'))
    if (!Number.isInteger(numero) || numero < 1 || !Number.isFinite(valorTotal) || valorTotal < 0) {
      showToast('Informe número e valor válidos', 'error')
      return
    }
    setSalvando(true)
    try {
      const nota = await apiFetch<NotaFiscal>('/fiscal/notas', {
        method: 'POST',
        body: { ...form, numero, valorTotal },
      })
      showToast(nota.motivoRejeicao ?? 'Nota criada na fila fiscal', nota.status === 'REJEITADA' ? 'warning' : 'success')
      setForm(FORM_VAZIO)
      ui.reiniciarPagina()
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao emitir nota', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const columns: Array<DataTableColumn<NotaFiscal>> = [
    { key: 'numero', header: 'Número', sortKey: 'numero', render: (nota) => <span className="font-mono text-xs">{nota.serie}/{nota.numero}</span> },
    { key: 'tipo', header: 'Tipo', render: (nota) => <span>{nota.tipo}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (nota) => <span className="font-medium text-gray-900">{nota.status}</span> },
    { key: 'valor', header: 'Valor', align: 'right', render: (nota) => <span>{formatarMoeda(nota.valorTotal)}</span> },
    { key: 'emissao', header: 'Emissão', sortKey: 'emitidaEm', hideOnMobile: true, render: (nota) => <span>{new Date(nota.emitidaEm).toLocaleString('pt-BR')}</span> },
    { key: 'motivo', header: 'Motivo', hideOnMobile: true, render: (nota) => <span className="text-gray-600">{nota.motivoRejeicao ?? '—'}</span> },
  ]

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Notas fiscais</h1>
      <p className="mb-6 text-sm text-gray-600">
        Emissão, acompanhamento, contingência e arquivos fiscais. A autorização real depende do ACBrMonitor homologado.
      </p>

      <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">Início<input type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 p-2 text-black" /></label>
            <label className="text-sm font-medium text-gray-700">Fim<input type="date" value={fim} onChange={(event) => setFim(event.target.value)} className="mt-1 block rounded-lg border border-gray-300 p-2 text-black" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void carregarRelatorio()}>Gerar relatório</Button>
            <Button type="button" variant="outline" onClick={() => window.open(`/api/fiscal/exportar-xml?${parametrosPeriodo()}`, '_blank')}>Baixar XML ZIP</Button>
            <Button type="button" onClick={() => void reprocessarFila()} isLoading={processando}>Reprocessar fila</Button>
          </div>
        </div>
        {relatorio && (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs font-bold uppercase text-gray-500">Notas</p><p className="mt-1 text-xl font-bold text-gray-900">{relatorio.totais.quantidade}</p></div>
              <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs font-bold uppercase text-gray-500">Valor</p><p className="mt-1 text-xl font-bold text-gray-900">{formatarMoeda(relatorio.totais.valor)}</p></div>
              {relatorio.porTipoStatus.slice(0, 2).map((grupo) => <div key={`${grupo.tipo}-${grupo.status}`} className="rounded-lg border border-gray-200 p-3"><p className="text-xs font-bold uppercase text-gray-500">{grupo.tipo} · {grupo.status}</p><p className="mt-1 text-xl font-bold text-gray-900">{grupo.quantidade}</p></div>)}
            </div>
            {relatorio.produtos.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-600"><tr><th className="px-3 py-2">Produto</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Valor</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">{relatorio.produtos.map((produto) => <tr key={`${produto.codigo}-${produto.descricao}`}><td className="px-3 py-2"><span className="font-medium text-gray-900">{produto.descricao}</span><span className="ml-2 font-mono text-xs text-gray-500">{produto.codigo}</span></td><td className="px-3 py-2 text-right">{produto.quantidade.toLocaleString('pt-BR')}</td><td className="px-3 py-2 text-right">{formatarMoeda(produto.valor)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <form onSubmit={emitir} className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Criar nota na fila</h2>
        <div className="grid gap-3 md:grid-cols-[120px_120px_120px_180px_1fr_auto]">
          <select value={form.tipo} onChange={(event) => setForm((atual) => ({ ...atual, tipo: event.target.value }))} className="rounded-lg border border-gray-300 p-2 text-black">
            <option value="NFCE">NFC-e</option>
            <option value="NFE">NF-e</option>
          </select>
          <input value={form.numero} onChange={(event) => setForm((atual) => ({ ...atual, numero: event.target.value }))} placeholder="Número" className="rounded-lg border border-gray-300 p-2 text-black" required />
          <input value={form.serie} onChange={(event) => setForm((atual) => ({ ...atual, serie: event.target.value }))} placeholder="Série" className="rounded-lg border border-gray-300 p-2 text-black" required />
          <select value={form.ambiente} onChange={(event) => setForm((atual) => ({ ...atual, ambiente: event.target.value }))} className="rounded-lg border border-gray-300 p-2 text-black">
            <option value="HOMOLOGACAO">Homologação</option>
            <option value="PRODUCAO">Produção</option>
          </select>
          <input value={form.valorTotal} onChange={(event) => setForm((atual) => ({ ...atual, valorTotal: event.target.value }))} placeholder="Valor total" className="rounded-lg border border-gray-300 p-2 text-black" required />
          <Button type="submit" isLoading={salvando}>Criar</Button>
        </div>
      </form>

      {isError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{(error as Error)?.message ?? 'Falha ao carregar notas'}</div>}

      <DataTable
        ariaLabel="Notas fiscais"
        columns={columns}
        data={pagina.data}
        getRowId={(nota) => nota.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="notas"
        storageKey="fiscal-notas"
        emptyMessage="Nenhuma nota fiscal encontrada"
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          extra: (nota) => (
            <button type="button" onClick={() => window.open(`/api/fiscal/notas/${nota.id}/danfe`, '_blank')} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100">
              DANFE
            </button>
          )
        }}
      />
    </div>
  )
}
