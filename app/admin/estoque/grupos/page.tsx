'use client'

import { useMemo, useState } from 'react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ExportMenu } from '@/app/components/ui/ExportMenu'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { SeloAtivo, paginaAtual, useCrud, useListaCrud } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

const RESOURCE_GRUPOS = '/insumos/grupos'
const RESOURCE_SUBGRUPOS = '/insumos/subgrupos'

type InsumoGrupo = {
  id: number
  nome: string
  ativo?: boolean
  _count?: { subgrupos?: number; insumos?: number }
}

type InsumoSubgrupo = {
  id: number
  nome: string
  grupoId: number
  ativo?: boolean
  grupo?: { id: number; nome: string }
  _count?: { insumos?: number }
}

export default function EstoqueGruposPage() {
  const { showToast } = useToast()
  const gruposCrud = useCrud<InsumoGrupo>({ resource: RESOURCE_GRUPOS, entidade: 'Grupo de insumo' })
  const subgruposCrud = useCrud<InsumoSubgrupo>({
    resource: RESOURCE_SUBGRUPOS,
    entidade: 'Subgrupo de insumo',
  })
  const gruposUi = useListaCrud(RESOURCE_GRUPOS)
  const subgruposUi = useListaCrud(RESOURCE_SUBGRUPOS)
  const gruposQuery = usePagedQuery<InsumoGrupo>(gruposUi.listaParams)
  const gruposPagina = paginaAtual({ data: gruposQuery.data }, gruposUi.page, gruposUi.pageSize)

  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<number | null>(null)
  const grupoSelecionado = useMemo(
    () => gruposPagina.data.find((grupo) => grupo.id === grupoSelecionadoId) ?? null,
    [gruposPagina.data, grupoSelecionadoId]
  )
  const subgruposResource =
    grupoSelecionadoId === null ? RESOURCE_SUBGRUPOS : `${RESOURCE_SUBGRUPOS}?grupoId=${grupoSelecionadoId}`
  const subgruposQuery = usePagedQuery<InsumoSubgrupo>({
    ...subgruposUi.listaParams,
    resource: subgruposResource,
    enabled: grupoSelecionadoId !== null,
  })
  const subgruposPagina = paginaAtual(
    { data: subgruposQuery.data },
    subgruposUi.page,
    subgruposUi.pageSize
  )

  const [showGrupoForm, setShowGrupoForm] = useState(false)
  const [grupoNome, setGrupoNome] = useState('')
  const [grupoEditando, setGrupoEditando] = useState<InsumoGrupo | null>(null)
  const [grupoParaExcluir, setGrupoParaExcluir] = useState<InsumoGrupo | null>(null)
  const [salvandoGrupo, setSalvandoGrupo] = useState(false)

  const [showSubgrupoForm, setShowSubgrupoForm] = useState(false)
  const [subgrupoNome, setSubgrupoNome] = useState('')
  const [subgrupoGrupoId, setSubgrupoGrupoId] = useState('')
  const [subgrupoEditando, setSubgrupoEditando] = useState<InsumoSubgrupo | null>(null)
  const [subgrupoParaExcluir, setSubgrupoParaExcluir] = useState<InsumoSubgrupo | null>(null)
  const [salvandoSubgrupo, setSalvandoSubgrupo] = useState(false)

  const gruposSelect = useMemo(
    () => [...gruposPagina.data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [gruposPagina.data]
  )

  const abrirGrupo = (grupo?: InsumoGrupo) => {
    setGrupoEditando(grupo ?? null)
    setGrupoNome(grupo?.nome ?? '')
    setShowGrupoForm(true)
  }

  const fecharGrupo = () => {
    setShowGrupoForm(false)
    setGrupoEditando(null)
    setGrupoNome('')
  }

  const abrirSubgrupo = (subgrupo?: InsumoSubgrupo) => {
    setSubgrupoEditando(subgrupo ?? null)
    setSubgrupoNome(subgrupo?.nome ?? '')
    setSubgrupoGrupoId(String(subgrupo?.grupoId ?? grupoSelecionadoId ?? ''))
    setShowSubgrupoForm(true)
  }

  const fecharSubgrupo = () => {
    setShowSubgrupoForm(false)
    setSubgrupoEditando(null)
    setSubgrupoNome('')
    setSubgrupoGrupoId('')
  }

  const salvarGrupo = async (event: React.FormEvent) => {
    event.preventDefault()
    const nome = grupoNome.trim()
    if (!nome) {
      showToast('Informe o nome do grupo', 'error')
      return
    }
    setSalvandoGrupo(true)
    const salvo = grupoEditando
      ? await gruposCrud.atualizar(grupoEditando.id, { nome })
      : await gruposCrud.criar({ nome })
    setSalvandoGrupo(false)
    if (salvo === null) return
    showToast(gruposCrud.mensagem(grupoEditando ? 'atualizado' : 'criado'), 'success')
    setGrupoSelecionadoId(salvo.id)
    fecharGrupo()
    gruposUi.reiniciarPagina()
    void gruposQuery.refetch()
  }

  const salvarSubgrupo = async (event: React.FormEvent) => {
    event.preventDefault()
    const nome = subgrupoNome.trim()
    const grupoId = Number(subgrupoGrupoId)
    if (!nome || !Number.isInteger(grupoId) || grupoId < 1) {
      showToast('Informe grupo e nome do subgrupo', 'error')
      return
    }
    setSalvandoSubgrupo(true)
    const salvo = subgrupoEditando
      ? await subgruposCrud.atualizar(subgrupoEditando.id, { nome, grupoId })
      : await subgruposCrud.criar({ nome, grupoId })
    setSalvandoSubgrupo(false)
    if (salvo === null) return
    showToast(subgruposCrud.mensagem(subgrupoEditando ? 'atualizado' : 'criado'), 'success')
    setGrupoSelecionadoId(grupoId)
    fecharSubgrupo()
    subgruposUi.reiniciarPagina()
    void gruposQuery.refetch()
    void subgruposQuery.refetch()
  }

  const excluirGrupo = async () => {
    if (!grupoParaExcluir) return
    const alvo = grupoParaExcluir
    setGrupoParaExcluir(null)
    const excluido = await gruposCrud.excluir(alvo.id)
    if (excluido === null) return
    showToast(gruposCrud.mensagem('excluido'), 'success')
    if (grupoSelecionadoId === alvo.id) setGrupoSelecionadoId(null)
    if (gruposUi.aposExcluir(gruposPagina.data.length)) void gruposQuery.refetch()
  }

  const excluirSubgrupo = async () => {
    if (!subgrupoParaExcluir) return
    const alvo = subgrupoParaExcluir
    setSubgrupoParaExcluir(null)
    const excluido = await subgruposCrud.excluir(alvo.id)
    if (excluido === null) return
    showToast(subgruposCrud.mensagem('excluido'), 'success')
    if (subgruposUi.aposExcluir(subgruposPagina.data.length)) void subgruposQuery.refetch()
    void gruposQuery.refetch()
  }

  const grupoColumns: Array<DataTableColumn<InsumoGrupo>> = [
    {
      key: 'nome',
      header: 'Grupo',
      sortKey: 'nome',
      render: (grupo) => (
        <button
          type="button"
          onClick={() => setGrupoSelecionadoId(grupo.id)}
          className={`text-left font-medium ${
            grupo.id === grupoSelecionadoId ? 'text-orange-700' : 'text-gray-900'
          }`}
        >
          {grupo.nome}
        </button>
      ),
    },
    {
      key: 'subgrupos',
      header: 'Subgrupos',
      align: 'center',
      render: (grupo) => <span>{grupo._count?.subgrupos ?? 0}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (grupo) => <SeloAtivo ativo={grupo.ativo ?? true} />,
    },
  ]

  const subgrupoColumns: Array<DataTableColumn<InsumoSubgrupo>> = [
    {
      key: 'nome',
      header: 'Subgrupo',
      sortKey: 'nome',
      render: (subgrupo) => <span className="font-medium text-gray-900">{subgrupo.nome}</span>,
    },
    {
      key: 'grupo',
      header: 'Grupo',
      hideOnMobile: true,
      render: (subgrupo) => <span className="text-gray-700">{subgrupo.grupo?.nome ?? grupoSelecionado?.nome ?? '—'}</span>,
    },
    {
      key: 'insumos',
      header: 'Insumos',
      align: 'center',
      render: (subgrupo) => <span>{subgrupo._count?.insumos ?? 0}</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Grupos de insumos</h1>
      <p className="mb-6 text-sm text-gray-600">
        Classifique matéria-prima por grupo e subgrupo antes de cadastrar os itens de estoque.
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Grupos</h2>
          {gruposQuery.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(gruposQuery.error as Error)?.message ?? 'Falha ao carregar grupos'}
            </div>
          )}
          <DataTable
            ariaLabel="Grupos de insumos"
            columns={grupoColumns}
            data={gruposPagina.data}
            getRowId={(grupo) => grupo.id}
            meta={gruposPagina.meta}
            loading={gruposQuery.isLoading}
            itemLabel="grupos"
            storageKey="admin-estoque-grupos"
            emptyMessage="Nenhum grupo encontrado"
            onPageChange={gruposUi.setPage}
            onPageSizeChange={gruposUi.setPageSize}
            onSearch={gruposUi.definirBusca}
            onSort={gruposUi.definirOrdenacao}
            toolbar={
              <ExportMenu
                fileName="grupos-insumos"
                title="Grupos de insumos"
                getRows={() => gruposPagina.data}
                columns={[
                  { key: 'id', label: 'ID' },
                  { key: 'nome', label: 'Grupo' },
                ]}
              />
            }
            rowActions={{
              onEdit: abrirGrupo,
              onDelete: setGrupoParaExcluir,
              editLabel: 'Editar grupo',
              deleteLabel: 'Excluir grupo',
            }}
            createAction={{ label: 'Novo grupo', onClick: () => abrirGrupo() }}
          />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Subgrupos</h2>
          <p className="mb-3 text-xs text-gray-500">
            {grupoSelecionado ? grupoSelecionado.nome : 'Selecione um grupo para listar os subgrupos.'}
          </p>
          {subgruposQuery.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(subgruposQuery.error as Error)?.message ?? 'Falha ao carregar subgrupos'}
            </div>
          )}
          <DataTable
            ariaLabel="Subgrupos de insumos"
            columns={subgrupoColumns}
            data={grupoSelecionadoId === null ? [] : subgruposPagina.data}
            getRowId={(subgrupo) => subgrupo.id}
            meta={
              grupoSelecionadoId === null
                ? { page: 1, pageSize: subgruposUi.pageSize, total: 0, totalPages: 0 }
                : subgruposPagina.meta
            }
            loading={grupoSelecionadoId !== null && subgruposQuery.isLoading}
            itemLabel="subgrupos"
            storageKey="admin-estoque-subgrupos"
            emptyMessage={grupoSelecionadoId === null ? 'Nenhum grupo selecionado' : 'Nenhum subgrupo encontrado'}
            onPageChange={subgruposUi.setPage}
            onPageSizeChange={subgruposUi.setPageSize}
            onSearch={subgruposUi.definirBusca}
            onSort={subgruposUi.definirOrdenacao}
            rowActions={{
              onEdit: abrirSubgrupo,
              onDelete: setSubgrupoParaExcluir,
              editLabel: 'Editar subgrupo',
              deleteLabel: 'Excluir subgrupo',
            }}
            createAction={{ label: 'Novo subgrupo', onClick: () => abrirSubgrupo() }}
          />
        </section>
      </div>

      {showGrupoForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">{grupoEditando ? 'Editar grupo' : 'Novo grupo'}</h2>
            </div>
            <form onSubmit={salvarGrupo} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="grupo-nome" className="mb-1 block text-sm font-medium text-black">Nome</label>
                <input
                  id="grupo-nome"
                  value={grupoNome}
                  onChange={(event) => setGrupoNome(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={fecharGrupo} disabled={salvandoGrupo}>Cancelar</Button>
                <Button type="submit" isLoading={salvandoGrupo}>{grupoEditando ? 'Salvar' : 'Adicionar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSubgrupoForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">{subgrupoEditando ? 'Editar subgrupo' : 'Novo subgrupo'}</h2>
            </div>
            <form onSubmit={salvarSubgrupo} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="subgrupo-grupo" className="mb-1 block text-sm font-medium text-black">Grupo</label>
                <select
                  id="subgrupo-grupo"
                  value={subgrupoGrupoId}
                  onChange={(event) => setSubgrupoGrupoId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                >
                  <option value="">Selecione</option>
                  {gruposSelect.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="subgrupo-nome" className="mb-1 block text-sm font-medium text-black">Nome</label>
                <input
                  id="subgrupo-nome"
                  value={subgrupoNome}
                  onChange={(event) => setSubgrupoNome(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={fecharSubgrupo} disabled={salvandoSubgrupo}>Cancelar</Button>
                <Button type="submit" isLoading={salvandoSubgrupo}>{subgrupoEditando ? 'Salvar' : 'Adicionar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={grupoParaExcluir !== null}
        title="Excluir grupo"
        description={grupoParaExcluir ? `Excluir "${grupoParaExcluir.nome}"? O backend deve preservar histórico e bloquear vínculos ativos quando necessário.` : ''}
        confirmText="Excluir"
        onConfirm={() => void excluirGrupo()}
        onClose={() => setGrupoParaExcluir(null)}
      />
      <ConfirmationModal
        isOpen={subgrupoParaExcluir !== null}
        title="Excluir subgrupo"
        description={subgrupoParaExcluir ? `Excluir "${subgrupoParaExcluir.nome}"? Insumos vinculados devem ser tratados pelo backend.` : ''}
        confirmText="Excluir"
        onConfirm={() => void excluirSubgrupo()}
        onClose={() => setSubgrupoParaExcluir(null)}
      />
    </div>
  )
}
