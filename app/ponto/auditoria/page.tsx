'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Filter, Shield } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { fetchList } from '@/app/lib/api'
import { paginaAtual, useListaCrud } from '@/app/lib/crud-client'
import { usePagedQuery } from '@/app/lib/pagination'

type Funcionario = { id: number; nome: string }
type Auditoria = {
  id: number
  acao: string
  entidade: string
  entidadeId: number
  detalhe: string | null
  ip: string | null
  criadoEm: string
  usuario: { id: number; nome: string; login: string } | null
}

const ACOES = ['CRIAR', 'EDITAR', 'EXCLUIR', 'AJUSTAR', 'VISUALIZAR', 'GERAR']

function detalheLegivel(valor: string | null): string {
  if (!valor) return '—'
  try {
    const parsed = JSON.parse(valor) as Record<string, unknown>
    const partes = [
      parsed.recurso && String(parsed.recurso).replaceAll('_', ' '),
      parsed.nsr && `NSR ${parsed.nsr}`,
      parsed.origem && `origem ${parsed.origem}`,
      parsed.tipo && String(parsed.tipo).replaceAll('_', ' '),
      parsed.funcionarioId && `funcionário #${parsed.funcionarioId}`,
      parsed.quantidade !== undefined && `${parsed.quantidade} registro(s)`,
    ].filter(Boolean)
    return partes.length ? partes.join(' · ') : valor
  } catch {
    return valor
  }
}

export default function AuditoriaPontoPage() {
  const ui = useListaCrud('/ponto/auditoria')
  const [funcionarioId, setFuncionarioId] = useState('')
  const [acao, setAcao] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const filtro = useMemo(() => {
    const query = new URLSearchParams()
    if (funcionarioId) query.set('funcionarioId', funcionarioId)
    if (acao) query.set('acao', acao)
    if (inicio) query.set('inicio', new Date(`${inicio}T00:00:00`).toISOString())
    if (fim) query.set('fim', new Date(`${fim}T23:59:59.999`).toISOString())
    const valor = query.toString()
    return valor ? `?${valor}` : ''
  }, [funcionarioId, acao, inicio, fim])

  const { data, isLoading, isError, error } = usePagedQuery<Auditoria>({
    resource: `/ponto/auditoria${filtro}`,
    page: ui.page,
    pageSize: ui.pageSize,
    search: ui.search,
    sort: ui.sort ?? 'criadoEm',
    order: ui.order ?? 'desc',
  })
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['ponto-funcionarios-auditoria'],
    queryFn: () => fetchList<Funcionario>('/ponto/funcionarios?page=1&pageSize=100'),
  })

  const columns: Array<DataTableColumn<Auditoria>> = [
    {
      key: 'criadoEm',
      header: 'Data e hora',
      sortKey: 'criadoEm',
      render: item => <span className="whitespace-nowrap text-sm font-medium text-gray-900">{new Date(item.criadoEm).toLocaleString('pt-BR')}</span>,
    },
    {
      key: 'acao',
      header: 'Ação',
      sortKey: 'acao',
      render: item => <span className={`rounded px-2 py-1 text-xs font-bold ${item.acao === 'AJUSTAR' ? 'bg-amber-100 text-amber-800' : item.acao === 'GERAR' ? 'bg-blue-100 text-blue-800' : item.acao === 'VISUALIZAR' ? 'bg-gray-100 text-gray-700' : 'bg-orange-100 text-orange-800'}`}>{item.acao}</span>,
    },
    {
      key: 'alvo',
      header: 'Alvo',
      render: item => <span className="text-sm text-gray-700">{item.entidade} #{item.entidadeId}</span>,
      hideOnMobile: true,
    },
    {
      key: 'detalhe',
      header: 'Detalhe',
      render: item => <span className="line-clamp-2 max-w-xl text-sm text-gray-600" title={item.detalhe ?? undefined}>{detalheLegivel(item.detalhe)}</span>,
    },
    {
      key: 'usuario',
      header: 'Responsável',
      render: item => <span className="text-sm text-gray-700">{item.usuario?.nome ?? 'Sistema'}</span>,
      hideOnMobile: true,
    },
    {
      key: 'ip',
      header: 'IP',
      render: item => <span className="font-mono text-xs text-gray-500">{item.ip ?? '—'}</span>,
      hideOnMobile: true,
    },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white"><Shield className="h-5 w-5" /></div>
        <div><h1 className="text-3xl font-bold tracking-tight text-gray-950">Auditoria do ponto</h1><p className="mt-1 text-sm text-gray-600">Histórico imutável de cadastros, batidas, ajustes, acessos e arquivos.</p></div>
      </div>

      <div className="grid gap-3 border-b border-gray-200 py-5 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_160px_160px_160px_auto] lg:items-end">
        <label className="text-sm font-semibold text-gray-800">Funcionário
          <select value={funcionarioId} onChange={event => { setFuncionarioId(event.target.value); ui.setPage(1) }} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900"><option value="">Todos</option>{funcionarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-gray-800">Ação
          <select value={acao} onChange={event => { setAcao(event.target.value); ui.setPage(1) }} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900"><option value="">Todas</option>{ACOES.map(item => <option key={item}>{item}</option>)}</select>
        </label>
        <label className="text-sm font-semibold text-gray-800">Início<input type="date" value={inicio} onChange={event => { setInicio(event.target.value); ui.setPage(1) }} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 font-normal text-gray-900" /></label>
        <label className="text-sm font-semibold text-gray-800">Fim<input type="date" value={fim} onChange={event => { setFim(event.target.value); ui.setPage(1) }} className="mt-1 block h-10 w-full rounded-lg border border-gray-300 px-3 font-normal text-gray-900" /></label>
        <button type="button" onClick={() => { setFuncionarioId(''); setAcao(''); setInicio(''); setFim(''); ui.setPage(1) }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"><Filter className="h-4 w-4" />Limpar</button>
      </div>

      {isError && <div className="my-4 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">{error?.message ?? 'Erro ao carregar auditoria'}</div>}
      <div className="mt-5">
        <DataTable
          ariaLabel="Auditoria do controle de ponto"
          columns={columns}
          data={pagina.data}
          getRowId={item => item.id}
          meta={pagina.meta}
          loading={isLoading}
          emptyMessage="Nenhuma ação encontrada"
          emptyHint="Ajuste os filtros ou aguarde novas movimentações do ponto."
          itemLabel="ações"
          storageKey="ponto-auditoria"
          onPageChange={ui.setPage}
          onPageSizeChange={ui.setPageSize}
          onSearch={ui.definirBusca}
          onSort={ui.definirOrdenacao}
        />
      </div>
    </main>
  )
}
