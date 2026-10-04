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
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Notas fiscais</h1>
      <p className="mb-6 text-sm text-gray-600">
        Scaffold fiscal com provider fake. Emissão real depende de provedor homologado e configuração fiscal validada.
      </p>

      <form onSubmit={emitir} className="mb-6 border-y border-gray-200 bg-white py-5">
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
      />
    </div>
  )
}
