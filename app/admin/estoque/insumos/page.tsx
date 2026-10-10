'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRightLeft, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ExportMenu } from '@/app/components/ui/ExportMenu'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { fetchList } from '@/app/lib/api'
import { usePagedQuery } from '@/app/lib/pagination'
import {
  SeloAtivo,
  comoDecimalDigitado,
  comoNumero,
  formatarMoeda,
  paginaAtual,
  useCrud,
  useListaCrud,
} from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'
import { useQuery } from '@tanstack/react-query'

const RESOURCE = '/insumos'
const UNIDADES = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT'] as const

type Subgrupo = {
  id: number
  nome: string
  grupoId: number
  grupo?: { id: number; nome: string }
}

type Grupo = {
  id: number
  nome: string
}

type Insumo = {
  id: number
  codigo: string
  codCD: string | null
  nome: string
  unidade: string
  subgrupoId: number
  subgrupo?: Subgrupo
  planoContaId: number | null
  centroCustoId: number | null
  estoqueMin: number | string
  estoqueMax: number | string
  saldoAtual?: number | string
  custoMedio: number | string
  ativo: boolean
  unidadesConversao?: Array<{ id: number; unidade: string; fatorConversao: number | string; ativo: boolean }>
}

type ConversaoForm = { chave: number; unidade: string; fatorConversao: string }

type FormState = {
  codigo: string
  codCD: string
  nome: string
  unidade: string
  grupoId: string
  subgrupoId: string
  planoContaId: string
  centroCustoId: string
  estoqueMin: string
  estoqueMax: string
  custoMedio: string
  saldoInicial: string
  conversoes: ConversaoForm[]
}

type OpcaoFinanceira = {
  id: number
  nome: string
}

const FORM_VAZIO: FormState = {
  codigo: '',
  codCD: '',
  nome: '',
  unidade: 'UN',
  grupoId: '',
  subgrupoId: '',
  planoContaId: '',
  centroCustoId: '',
  estoqueMin: '0',
  estoqueMax: '0',
  custoMedio: '0',
  saldoInicial: '0',
  conversoes: [],
}

function quantidade(valor: unknown, unidade?: string): string {
  return `${comoNumero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${unidade ?? ''}`.trim()
}

function abaixoDoMinimo(insumo: Insumo): boolean {
  return comoNumero(insumo.saldoAtual) < comoNumero(insumo.estoqueMin)
}

export default function InsumosPage() {
  const { showToast } = useToast()
  const crud = useCrud<Insumo>({ resource: RESOURCE, entidade: 'Insumo' })
  const ui = useListaCrud(RESOURCE)
  const { data, isLoading, isError, error, refetch } = usePagedQuery<Insumo>(ui.listaParams)
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const { data: grupos = [] } = useQuery({
    queryKey: ['insumos-grupos-select'],
    queryFn: () => fetchList<Grupo>('/insumos/grupos?page=1&pageSize=100&ativo=true'),
  })
  const { data: subgrupos = [] } = useQuery({
    queryKey: ['insumos-subgrupos-select'],
    queryFn: () => fetchList<Subgrupo>('/insumos/subgrupos?page=1&pageSize=100&ativo=true'),
  })
  const { data: planos = [] } = useQuery({
    queryKey: ['planos-contas-select'],
    queryFn: () => fetchList<OpcaoFinanceira>('/plano-contas?page=1&pageSize=100'),
  })
  const { data: centros = [] } = useQuery({
    queryKey: ['centros-custo-select'],
    queryFn: () => fetchList<OpcaoFinanceira>('/centros-custo?page=1&pageSize=100'),
  })

  const gruposSelect = useMemo(
    () => [...grupos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [grupos]
  )

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Insumo | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Insumo | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)
  const subgruposDoGrupo = useMemo(
    () => subgrupos
      .filter((subgrupo) => String(subgrupo.grupoId) === form.grupoId && subgrupo.nome.toLocaleLowerCase('pt-BR') !== 'geral')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [form.grupoId, subgrupos]
  )

  const atualizarCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const abrirNovo = () => {
    setEditing(null)
    setForm({ ...FORM_VAZIO, grupoId: gruposSelect[0]?.id ? String(gruposSelect[0].id) : '' })
    setShowForm(true)
  }

  const abrirEdicao = (insumo: Insumo) => {
    setEditing(insumo)
    setForm({
      codigo: insumo.codigo ?? '',
      codCD: insumo.codCD ?? '',
      nome: insumo.nome ?? '',
      unidade: insumo.unidade ?? 'UN',
      grupoId: String(insumo.subgrupo?.grupoId ?? insumo.subgrupo?.grupo?.id ?? ''),
      subgrupoId: insumo.subgrupo?.nome.toLocaleLowerCase('pt-BR') === 'geral' ? '' : String(insumo.subgrupoId ?? ''),
      planoContaId: insumo.planoContaId ? String(insumo.planoContaId) : '',
      centroCustoId: insumo.centroCustoId ? String(insumo.centroCustoId) : '',
      estoqueMin: String(insumo.estoqueMin ?? 0),
      estoqueMax: String(insumo.estoqueMax ?? 0),
      custoMedio: String(insumo.custoMedio ?? 0),
      saldoInicial: '0',
      conversoes: (insumo.unidadesConversao ?? []).map(conversao => ({
        chave: conversao.id,
        unidade: conversao.unidade,
        fatorConversao: String(conversao.fatorConversao),
      })),
    })
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(FORM_VAZIO)
  }

  const numeroDecimal = (valor: string, campo: string): number | null => {
    const numero = comoDecimalDigitado(valor)
    if (numero === null || numero < 0) {
      showToast(`${campo} inválido`, 'error')
      return null
    }
    return numero
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()
    const codigo = form.codigo.trim()
    const nome = form.nome.trim()
    const grupoId = Number(form.grupoId)
    if (!codigo || !nome || !Number.isInteger(grupoId) || grupoId < 1) {
      showToast('Informe código, nome e grupo', 'error')
      return
    }

    const estoqueMin = numeroDecimal(form.estoqueMin, 'Estoque mínimo')
    const estoqueMax = numeroDecimal(form.estoqueMax, 'Estoque máximo')
    const custoMedio = numeroDecimal(form.custoMedio, 'Custo médio')
    const saldoInicial = editing ? 0 : numeroDecimal(form.saldoInicial, 'Quantidade atual')
    if (estoqueMin === null || estoqueMax === null || custoMedio === null || saldoInicial === null) return
    const conversoes = form.conversoes.map((conversao, index) => ({
      unidade: conversao.unidade,
      fatorConversao: numeroDecimal(conversao.fatorConversao, `Fator da conversão ${index + 1}`),
    }))
    if (conversoes.some(conversao => conversao.fatorConversao === null)) return
    if (new Set(conversoes.map(conversao => conversao.unidade)).size !== conversoes.length) {
      showToast('Não repita a mesma unidade de conversão', 'error')
      return
    }

    const corpo = {
      codigo,
      codCD: form.codCD.trim() || null,
      nome,
      unidade: form.unidade,
      grupoId,
      subgrupoId: form.subgrupoId ? Number(form.subgrupoId) : null,
      planoContaId: form.planoContaId ? Number(form.planoContaId) : null,
      centroCustoId: form.centroCustoId ? Number(form.centroCustoId) : null,
      estoqueMin,
      estoqueMax,
      ...(!editing ? { custoMedio } : {}),
      conversoes: conversoes.map(conversao => ({ unidade: conversao.unidade, fatorConversao: conversao.fatorConversao! })),
      ...(!editing ? { saldoInicial } : {}),
    }

    setSalvando(true)
    const salvo = editing ? await crud.atualizar(editing.id, corpo) : await crud.criar(corpo)
    setSalvando(false)
    if (salvo === null) return
    showToast(crud.mensagem(editing ? 'atualizado' : 'criado'), 'success')
    fecharForm()
    ui.reiniciarPagina()
    void refetch()
  }

  const alternar = async (insumo: Insumo) => {
    setAlternandoId(insumo.id)
    const atualizado = await crud.alternarAtivo(insumo.id, !insumo.ativo)
    setAlternandoId(null)
    if (atualizado === null) return
    showToast(`Insumo ${atualizado.ativo ? 'ativado' : 'desativado'}`, 'success')
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)
    const excluido = await crud.excluir(alvo.id)
    if (excluido === null) return
    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<Insumo>> = [
    {
      key: 'codigo',
      header: 'Código',
      sortKey: 'codigo',
      render: (insumo) => <span className="font-mono text-xs text-gray-700">{insumo.codigo}</span>,
    },
    {
      key: 'nome',
      header: 'Insumo',
      sortKey: 'nome',
      render: (insumo) => (
        <div>
          <span className="font-medium text-gray-900">{insumo.nome}</span>
          <span className="block text-xs text-gray-500">
            {insumo.subgrupo?.grupo?.nome ?? 'Sem grupo'}
            {insumo.subgrupo?.nome && insumo.subgrupo.nome.toLocaleLowerCase('pt-BR') !== 'geral' ? ` / ${insumo.subgrupo.nome}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'saldo',
      header: 'Saldo',
      sortKey: 'saldoAtual',
      align: 'right',
      render: (insumo) => (
        <span className={abaixoDoMinimo(insumo) ? 'font-semibold text-amber-700' : 'text-gray-700'}>
          {quantidade(insumo.saldoAtual, insumo.unidade)}
        </span>
      ),
    },
    {
      key: 'minimo',
      header: 'Mínimo',
      align: 'right',
      hideOnMobile: true,
      render: (insumo) => <span className="text-gray-700">{quantidade(insumo.estoqueMin, insumo.unidade)}</span>,
    },
    {
      key: 'custo',
      header: 'Custo médio',
      align: 'right',
      hideOnMobile: true,
      render: (insumo) => <span className="text-gray-700">{formatarMoeda(insumo.custoMedio)}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (insumo) => <SeloAtivo ativo={insumo.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Insumos</h1>
      <p className="mb-4 text-sm text-gray-600">
        Cadastre matérias-primas e produtos prontos, organize por grupo e acompanhe o saldo disponível.
      </p>

      {pagina.data.some(abaixoDoMinimo) && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Há insumos abaixo do mínimo nesta página.
        </div>
      )}

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar insumos'}
        </div>
      )}

      <DataTable
        ariaLabel="Listagem de insumos"
        columns={columns}
        data={pagina.data}
        getRowId={(insumo) => insumo.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="insumos"
        storageKey="admin-estoque-insumos"
        emptyMessage="Nenhum insumo encontrado"
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        toolbar={
          <ExportMenu
            fileName="insumos"
            title="Insumos"
            getRows={() =>
              pagina.data.map((insumo) => ({
                codigo: insumo.codigo,
                nome: insumo.nome,
                grupo: insumo.subgrupo?.grupo?.nome ?? '',
                subgrupo: insumo.subgrupo?.nome ?? '',
                unidade: insumo.unidade,
                saldo: comoNumero(insumo.saldoAtual),
                estoqueMin: comoNumero(insumo.estoqueMin),
                estoqueMax: comoNumero(insumo.estoqueMax),
                custoMedio: comoNumero(insumo.custoMedio),
                ativo: insumo.ativo ? 'Ativo' : 'Inativo',
              }))
            }
          />
        }
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar insumo',
          deleteLabel: 'Excluir insumo',
          extra: (insumo) => (
            <>
              <Link
                href={`/admin/estoque/movimentacoes?insumoId=${insumo.id}`}
                title="Movimentar insumo"
                aria-label="Movimentar insumo"
                className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Link>
              <button
                type="button"
                title={insumo.ativo ? 'Desativar' : 'Ativar'}
                aria-label={insumo.ativo ? 'Desativar insumo' : 'Ativar insumo'}
                disabled={alternandoId === insumo.id}
                onClick={() => void alternar(insumo)}
                className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
              >
                {insumo.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              </button>
            </>
          ),
        }}
        createAction={{ label: 'Novo insumo', onClick: abrirNovo }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">{editing ? 'Editar insumo' : 'Novo insumo'}</h2>
            </div>
            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="codigo" className="mb-1 block text-sm font-medium text-black">Código</label>
                  <input id="codigo" value={form.codigo} onChange={(event) => atualizarCampo('codigo', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required autoFocus />
                </div>
                <div>
                  <label htmlFor="codCD" className="mb-1 block text-sm font-medium text-black">Cod. CD</label>
                  <input id="codCD" value={form.codCD} onChange={(event) => atualizarCampo('codCD', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label htmlFor="unidade" className="mb-1 block text-sm font-medium text-black">Unidade</label>
                  <select id="unidade" value={form.unidade} onChange={(event) => setForm(atual => ({ ...atual, unidade: event.target.value, conversoes: atual.conversoes.filter(conversao => conversao.unidade !== event.target.value) }))} className="w-full rounded-lg border border-gray-300 p-2 text-black">
                    {UNIDADES.map((unidade) => <option key={unidade} value={unidade}>{unidade}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="nome" className="mb-1 block text-sm font-medium text-black">Nome</label>
                <input id="nome" value={form.nome} onChange={(event) => atualizarCampo('nome', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Conversões de embalagem</h3>
                    <p className="mt-0.5 text-xs text-gray-600">Cadastre apenas quando o item puder ser lançado em caixa, pacote ou outra unidade. O saldo continuará em {form.unidade}.</p>
                  </div>
                  <button type="button" onClick={() => setForm(atual => ({ ...atual, conversoes: [...atual.conversoes, { chave: Date.now() + Math.random(), unidade: UNIDADES.find(unidade => unidade !== atual.unidade && !atual.conversoes.some(item => item.unidade === unidade)) ?? 'CX', fatorConversao: '' }] }))} disabled={form.conversoes.length >= UNIDADES.length - 1} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-orange-200 bg-white px-3 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-40"><Plus className="h-4 w-4" />Adicionar</button>
                </div>
                {form.conversoes.length > 0 && <div className="mt-3 space-y-2">{form.conversoes.map((conversao, index) => (
                  <div key={conversao.chave} className="grid items-end gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-[110px_1fr_auto]">
                    <label><span className="mb-1 block text-xs font-medium text-gray-700">Unidade</span><select value={conversao.unidade} onChange={event => setForm(atual => ({ ...atual, conversoes: atual.conversoes.map(item => item.chave === conversao.chave ? { ...item, unidade: event.target.value } : item) }))} className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-black">{UNIDADES.filter(unidade => unidade !== form.unidade).map(unidade => <option key={unidade} value={unidade}>{unidade}</option>)}</select></label>
                    <label><span className="mb-1 block text-xs font-medium text-gray-700">1 {conversao.unidade} equivale a quantos {form.unidade}?</span><input inputMode="decimal" value={conversao.fatorConversao} onChange={event => setForm(atual => ({ ...atual, conversoes: atual.conversoes.map(item => item.chave === conversao.chave ? { ...item, fatorConversao: event.target.value } : item) }))} placeholder={`Ex.: ${index + 2}`} className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-black" required /></label>
                    <button type="button" onClick={() => setForm(atual => ({ ...atual, conversoes: atual.conversoes.filter(item => item.chave !== conversao.chave) }))} aria-label={`Remover conversão ${index + 1}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}</div>}
              </div>

              <div className="grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="grupo" className="mb-1 block text-sm font-medium text-black">Grupo</label>
                  <select
                    id="grupo"
                    value={form.grupoId}
                    onChange={(event) => setForm((atual) => ({ ...atual, grupoId: event.target.value, subgrupoId: '' }))}
                    className="w-full rounded-lg border border-gray-300 bg-white p-2 text-black"
                    required
                  >
                    <option value="">Selecione um grupo</option>
                    {gruposSelect.map((grupo) => <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>)}
                  </select>
                  {gruposSelect.length === 0 && <Link href="/admin/estoque/grupos" className="mt-1 block text-xs font-semibold text-orange-700 hover:underline">Cadastre um grupo primeiro</Link>}
                </div>
                <div>
                  <label htmlFor="subgrupo" className="mb-1 block text-sm font-medium text-black">Detalhamento <span className="font-normal text-gray-500">(opcional)</span></label>
                  <select id="subgrupo" value={form.subgrupoId} onChange={(event) => atualizarCampo('subgrupoId', event.target.value)} disabled={!form.grupoId} className="w-full rounded-lg border border-gray-300 bg-white p-2 text-black disabled:bg-gray-100">
                    <option value="">Geral</option>
                    {subgruposDoGrupo.map((subgrupo) => <option key={subgrupo.id} value={subgrupo.id}>{subgrupo.nome}</option>)}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Use apenas quando precisar dividir o grupo em classificações menores.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="plano" className="mb-1 block text-sm font-medium text-black">Plano de conta</label>
                  <select id="plano" value={form.planoContaId} onChange={(event) => atualizarCampo('planoContaId', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black">
                    <option value="">Nenhum</option>
                    {planos.map((plano) => <option key={plano.id} value={plano.id}>{plano.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="centro" className="mb-1 block text-sm font-medium text-black">Centro de custo</label>
                  <select id="centro" value={form.centroCustoId} onChange={(event) => atualizarCampo('centroCustoId', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black">
                    <option value="">Nenhum</option>
                    {centros.map((centro) => <option key={centro.id} value={centro.id}>{centro.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className={`grid gap-4 ${editing ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
                {!editing && <div>
                  <label htmlFor="saldoInicial" className="mb-1 block text-sm font-medium text-black">Quantidade atual</label>
                  <input id="saldoInicial" inputMode="decimal" value={form.saldoInicial} onChange={(event) => atualizarCampo('saldoInicial', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                  <p className="mt-1 text-xs text-gray-500">Cria a entrada inicial no histórico.</p>
                </div>}
                <div>
                  <label htmlFor="min" className="mb-1 block text-sm font-medium text-black">Estoque mínimo</label>
                  <input id="min" inputMode="decimal" value={form.estoqueMin} onChange={(event) => atualizarCampo('estoqueMin', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label htmlFor="max" className="mb-1 block text-sm font-medium text-black">Estoque máximo</label>
                  <input id="max" inputMode="decimal" value={form.estoqueMax} onChange={(event) => atualizarCampo('estoqueMax', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label htmlFor="custo" className="mb-1 block text-sm font-medium text-black">{editing ? 'Custo médio calculado' : 'Custo inicial'}</label>
                  <input id="custo" inputMode="decimal" value={form.custoMedio} onChange={(event) => atualizarCampo('custoMedio', event.target.value)} disabled={Boolean(editing)} className="w-full rounded-lg border border-gray-300 p-2 text-black disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600" />
                  {editing && <p className="mt-1 text-xs text-gray-500">Atualizado automaticamente pelas entradas de estoque.</p>}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={fecharForm} disabled={salvando}>Cancelar</Button>
                <Button type="submit" isLoading={salvando}>{editing ? 'Salvar' : 'Adicionar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={paraExcluir !== null}
        title="Excluir insumo"
        description={paraExcluir ? `Excluir "${paraExcluir.nome}"? O backend deve desativar o cadastro quando houver histórico.` : ''}
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
