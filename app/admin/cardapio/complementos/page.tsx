'use client'

import { useMemo, useState } from 'react'
import { Power, PowerOff } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { usePagedQuery } from '@/app/lib/pagination'
import {
  SeloAtivo,
  comoDecimalDigitado,
  formatarMoeda,
  paginaAtual,
  useCrud,
  useListaCrud,
} from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

const RESOURCE_GRUPOS = '/complementos/grupos'
const RESOURCE_COMPLEMENTOS = '/complementos'

type ComplementoGrupo = {
  id: number
  nome: string
  obrigatorio: boolean
  minEscolhas: number
  maxEscolhas: number | null
  ordem: number
  ativo: boolean
  complementos?: Complemento[]
  _count?: { complementos: number; produtos?: number }
}

type Complemento = {
  id: number
  grupoId: number
  nome: string
  valor: number | string
  ordem: number
  ativo: boolean
  grupo?: { id: number; nome: string }
}

type GrupoForm = {
  nome: string
  obrigatorio: boolean
  minEscolhas: string
  maxEscolhas: string
  ordem: string
}

type ComplementoForm = {
  grupoId: string
  nome: string
  valor: string
  ordem: string
}

const GRUPO_VAZIO: GrupoForm = {
  nome: '',
  obrigatorio: false,
  minEscolhas: '0',
  maxEscolhas: '',
  ordem: '0',
}

const COMPLEMENTO_VAZIO: ComplementoForm = {
  grupoId: '',
  nome: '',
  valor: '0',
  ordem: '0',
}

function regraEscolha(grupo: ComplementoGrupo): string {
  if (!grupo.obrigatorio && grupo.minEscolhas === 0 && grupo.maxEscolhas === null) return 'Opcional'
  const partes: string[] = []
  if (grupo.obrigatorio) partes.push('Obrigatório')
  if (grupo.minEscolhas > 0) partes.push(`mín. ${grupo.minEscolhas}`)
  if (grupo.maxEscolhas !== null) partes.push(`máx. ${grupo.maxEscolhas}`)
  return partes.join(' · ')
}

export default function ComplementosPage() {
  const { showToast } = useToast()
  const gruposCrud = useCrud<ComplementoGrupo>({
    resource: RESOURCE_GRUPOS,
    entidade: 'Grupo de complemento',
  })
  const complementosCrud = useCrud<Complemento>({
    resource: RESOURCE_COMPLEMENTOS,
    entidade: 'Complemento',
  })

  const gruposUi = useListaCrud(RESOURCE_GRUPOS)
  const complementosUi = useListaCrud(RESOURCE_COMPLEMENTOS)

  const gruposQuery = usePagedQuery<ComplementoGrupo>(gruposUi.listaParams)
  const gruposPagina = paginaAtual({ data: gruposQuery.data }, gruposUi.page, gruposUi.pageSize)

  const [grupoSelecionadoId, setGrupoSelecionadoId] = useState<number | null>(null)
  const grupoSelecionado = useMemo(() => {
    return gruposPagina.data.find((grupo) => grupo.id === grupoSelecionadoId) ?? null
  }, [gruposPagina.data, grupoSelecionadoId])

  const complementosQuery = usePagedQuery<Complemento>({
    ...complementosUi.listaParams,
    resource:
      grupoSelecionadoId === null
        ? RESOURCE_COMPLEMENTOS
        : `${RESOURCE_COMPLEMENTOS}?grupoId=${grupoSelecionadoId}`,
    enabled: grupoSelecionadoId !== null,
  })
  const complementosPagina = paginaAtual(
    { data: complementosQuery.data },
    complementosUi.page,
    complementosUi.pageSize
  )

  const [showGrupoForm, setShowGrupoForm] = useState(false)
  const [editingGrupo, setEditingGrupo] = useState<ComplementoGrupo | null>(null)
  const [grupoForm, setGrupoForm] = useState<GrupoForm>(GRUPO_VAZIO)
  const [salvandoGrupo, setSalvandoGrupo] = useState(false)
  const [grupoParaExcluir, setGrupoParaExcluir] = useState<ComplementoGrupo | null>(null)
  const [alternandoGrupoId, setAlternandoGrupoId] = useState<number | null>(null)

  const [showComplementoForm, setShowComplementoForm] = useState(false)
  const [editingComplemento, setEditingComplemento] = useState<Complemento | null>(null)
  const [complementoForm, setComplementoForm] = useState<ComplementoForm>(COMPLEMENTO_VAZIO)
  const [salvandoComplemento, setSalvandoComplemento] = useState(false)
  const [complementoParaExcluir, setComplementoParaExcluir] = useState<Complemento | null>(null)
  const [alternandoComplementoId, setAlternandoComplementoId] = useState<number | null>(null)

  const gruposSelect = useMemo(() => {
    return [...gruposPagina.data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [gruposPagina.data])

  const atualizarGrupoCampo = <K extends keyof GrupoForm>(campo: K, valor: GrupoForm[K]) => {
    setGrupoForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const atualizarComplementoCampo = <K extends keyof ComplementoForm>(
    campo: K,
    valor: ComplementoForm[K]
  ) => {
    setComplementoForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const abrirNovoGrupo = () => {
    setEditingGrupo(null)
    setGrupoForm(GRUPO_VAZIO)
    setShowGrupoForm(true)
  }

  const abrirEdicaoGrupo = (grupo: ComplementoGrupo) => {
    setEditingGrupo(grupo)
    setGrupoForm({
      nome: grupo.nome,
      obrigatorio: grupo.obrigatorio,
      minEscolhas: String(grupo.minEscolhas ?? 0),
      maxEscolhas: grupo.maxEscolhas === null ? '' : String(grupo.maxEscolhas),
      ordem: String(grupo.ordem ?? 0),
    })
    setShowGrupoForm(true)
  }

  const fecharGrupoForm = () => {
    setShowGrupoForm(false)
    setEditingGrupo(null)
    setGrupoForm(GRUPO_VAZIO)
  }

  const abrirNovoComplemento = () => {
    if (grupoSelecionadoId === null) {
      showToast('Selecione um grupo antes de cadastrar complementos', 'error')
      return
    }
    setEditingComplemento(null)
    setComplementoForm({ ...COMPLEMENTO_VAZIO, grupoId: String(grupoSelecionadoId) })
    setShowComplementoForm(true)
  }

  const abrirEdicaoComplemento = (complemento: Complemento) => {
    setEditingComplemento(complemento)
    setComplementoForm({
      grupoId: String(complemento.grupoId),
      nome: complemento.nome,
      valor: String(complemento.valor ?? 0),
      ordem: String(complemento.ordem ?? 0),
    })
    setShowComplementoForm(true)
  }

  const fecharComplementoForm = () => {
    setShowComplementoForm(false)
    setEditingComplemento(null)
    setComplementoForm(COMPLEMENTO_VAZIO)
  }

  const salvarGrupo = async (event: React.FormEvent) => {
    event.preventDefault()

    const nome = grupoForm.nome.trim()
    if (!nome) {
      showToast('Informe o nome do grupo de complemento', 'error')
      return
    }

    const minEscolhas = Number(grupoForm.minEscolhas.trim() || '0')
    if (!Number.isInteger(minEscolhas) || minEscolhas < 0) {
      showToast('Mínimo de escolhas deve ser um inteiro maior ou igual a zero', 'error')
      return
    }

    const maxEscolhas =
      grupoForm.maxEscolhas.trim() === '' ? null : Number(grupoForm.maxEscolhas.trim())
    if (maxEscolhas !== null && (!Number.isInteger(maxEscolhas) || maxEscolhas < 1)) {
      showToast('Máximo de escolhas deve ser vazio ou um inteiro maior que zero', 'error')
      return
    }
    if (maxEscolhas !== null && maxEscolhas < minEscolhas) {
      showToast('Máximo de escolhas não pode ser menor que o mínimo', 'error')
      return
    }

    const ordem = Number(grupoForm.ordem.trim() || '0')
    if (!Number.isInteger(ordem) || ordem < 0) {
      showToast('Ordem deve ser um inteiro maior ou igual a zero', 'error')
      return
    }

    setSalvandoGrupo(true)
    const editando = editingGrupo
    const salvo = editando
      ? await gruposCrud.atualizar(editando.id, {
          nome,
          obrigatorio: grupoForm.obrigatorio,
          minEscolhas,
          maxEscolhas,
          ordem,
        })
      : await gruposCrud.criar({
          nome,
          obrigatorio: grupoForm.obrigatorio,
          minEscolhas,
          maxEscolhas,
          ordem,
        })
    setSalvandoGrupo(false)

    if (salvo === null) return
    showToast(gruposCrud.mensagem(editando ? 'atualizado' : 'criado'), 'success')
    setGrupoSelecionadoId(salvo.id)
    fecharGrupoForm()
    gruposUi.reiniciarPagina()
    void gruposQuery.refetch()
  }

  const salvarComplemento = async (event: React.FormEvent) => {
    event.preventDefault()

    const grupoId = Number(complementoForm.grupoId)
    if (!Number.isInteger(grupoId) || grupoId < 1) {
      showToast('Selecione o grupo do complemento', 'error')
      return
    }

    const nome = complementoForm.nome.trim()
    if (!nome) {
      showToast('Informe o nome do complemento', 'error')
      return
    }

    const valor = comoDecimalDigitado(complementoForm.valor)
    if (valor === null || valor < 0) {
      showToast('Valor do complemento inválido', 'error')
      return
    }

    const ordem = Number(complementoForm.ordem.trim() || '0')
    if (!Number.isInteger(ordem) || ordem < 0) {
      showToast('Ordem deve ser um inteiro maior ou igual a zero', 'error')
      return
    }

    setSalvandoComplemento(true)
    const editando = editingComplemento
    const salvo = editando
      ? await complementosCrud.atualizar(editando.id, { grupoId, nome, valor, ordem })
      : await complementosCrud.criar({ grupoId, nome, valor, ordem })
    setSalvandoComplemento(false)

    if (salvo === null) return
    showToast(complementosCrud.mensagem(editando ? 'atualizado' : 'criado'), 'success')
    setGrupoSelecionadoId(grupoId)
    fecharComplementoForm()
    complementosUi.reiniciarPagina()
    void complementosQuery.refetch()
    void gruposQuery.refetch()
  }

  const alternarGrupo = async (grupo: ComplementoGrupo) => {
    setAlternandoGrupoId(grupo.id)
    const atualizado = await gruposCrud.alternarAtivo(grupo.id, !grupo.ativo)
    setAlternandoGrupoId(null)

    if (atualizado === null) return
    showToast(`Grupo ${atualizado.ativo ? 'ativado' : 'desativado'}`, 'success')
    void gruposQuery.refetch()
  }

  const alternarComplemento = async (complemento: Complemento) => {
    setAlternandoComplementoId(complemento.id)
    const atualizado = await complementosCrud.alternarAtivo(complemento.id, !complemento.ativo)
    setAlternandoComplementoId(null)

    if (atualizado === null) return
    showToast(`Complemento ${atualizado.ativo ? 'ativado' : 'desativado'}`, 'success')
    void complementosQuery.refetch()
  }

  const confirmarExclusaoGrupo = async () => {
    if (!grupoParaExcluir) return
    const alvo = grupoParaExcluir
    setGrupoParaExcluir(null)

    const excluido = await gruposCrud.excluir(alvo.id)
    if (excluido === null) return

    showToast(gruposCrud.mensagem('excluido'), 'success')
    if (grupoSelecionadoId === alvo.id) setGrupoSelecionadoId(null)
    if (gruposUi.aposExcluir(gruposPagina.data.length)) void gruposQuery.refetch()
  }

  const confirmarExclusaoComplemento = async () => {
    if (!complementoParaExcluir) return
    const alvo = complementoParaExcluir
    setComplementoParaExcluir(null)

    const excluido = await complementosCrud.excluir(alvo.id)
    if (excluido === null) return

    showToast(complementosCrud.mensagem('excluido'), 'success')
    if (complementosUi.aposExcluir(complementosPagina.data.length)) void complementosQuery.refetch()
    void gruposQuery.refetch()
  }

  const grupoColumns: Array<DataTableColumn<ComplementoGrupo>> = [
    {
      key: 'nome',
      header: 'Grupo',
      sortKey: 'nome',
      render: (grupo) => (
        <button
          type="button"
          onClick={() => setGrupoSelecionadoId(grupo.id)}
          className={`text-left font-medium ${
            grupoSelecionadoId === grupo.id ? 'text-orange-700' : 'text-gray-900'
          }`}
        >
          {grupo.nome}
        </button>
      ),
    },
    {
      key: 'regra',
      header: 'Regra',
      hideOnMobile: true,
      render: (grupo) => <span className="text-gray-700">{regraEscolha(grupo)}</span>,
    },
    {
      key: 'itens',
      header: 'Itens',
      align: 'center',
      render: (grupo) => <span className="text-gray-700">{grupo._count?.complementos ?? grupo.complementos?.length ?? 0}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (grupo) => <SeloAtivo ativo={grupo.ativo} />,
    },
  ]

  const complementoColumns: Array<DataTableColumn<Complemento>> = [
    {
      key: 'nome',
      header: 'Complemento',
      sortKey: 'nome',
      render: (complemento) => <span className="font-medium text-gray-900">{complemento.nome}</span>,
    },
    {
      key: 'valor',
      header: 'Valor',
      sortKey: 'valor',
      align: 'right',
      render: (complemento) => <span className="text-gray-700">{formatarMoeda(complemento.valor)}</span>,
    },
    {
      key: 'ordem',
      header: 'Ordem',
      sortKey: 'ordem',
      align: 'center',
      hideOnMobile: true,
      render: (complemento) => <span className="text-gray-700">{complemento.ordem ?? 0}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (complemento) => <SeloAtivo ativo={complemento.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Complementos</h1>
      <p className="mb-6 text-sm text-gray-600">
        Organize grupos como adicionais, acompanhamentos e pontos de preparo, com limites de escolha
        e valores cobrados por item.
      </p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Grupos</h2>

          {gruposQuery.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(gruposQuery.error as Error)?.message ?? 'Falha ao carregar grupos'}
            </div>
          )}

          <DataTable<ComplementoGrupo>
            ariaLabel="Listagem de grupos de complemento"
            columns={grupoColumns}
            data={gruposPagina.data}
            getRowId={(grupo) => grupo.id}
            meta={gruposPagina.meta}
            loading={gruposQuery.isLoading}
            itemLabel="grupos"
            storageKey="admin-cardapio-complementos-grupos"
            emptyMessage="Nenhum grupo de complemento encontrado"
            emptyHint={gruposUi.search ? `Nada corresponde a "${gruposUi.search}".` : 'Crie o primeiro grupo abaixo.'}
            onPageChange={(numero) => gruposUi.setPage(numero)}
            onPageSizeChange={gruposUi.setPageSize}
            onSearch={gruposUi.definirBusca}
            onSort={gruposUi.definirOrdenacao}
            rowActions={{
              onEdit: abrirEdicaoGrupo,
              onDelete: setGrupoParaExcluir,
              editLabel: 'Editar grupo',
              deleteLabel: 'Excluir grupo',
              extra: (grupo) => (
                <button
                  type="button"
                  title={grupo.ativo ? 'Desativar' : 'Ativar'}
                  aria-label={grupo.ativo ? 'Desativar grupo' : 'Ativar grupo'}
                  disabled={alternandoGrupoId === grupo.id}
                  onClick={() => void alternarGrupo(grupo)}
                  className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
                >
                  {grupo.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </button>
              ),
            }}
            createAction={{ label: 'Novo grupo', onClick: abrirNovoGrupo }}
          />
        </section>

        <section>
          <div className="mb-3 flex min-h-7 items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Itens do grupo</h2>
              <p className="text-xs text-gray-500">
                {grupoSelecionado ? grupoSelecionado.nome : 'Selecione um grupo na lista ao lado.'}
              </p>
            </div>
          </div>

          {complementosQuery.isError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(complementosQuery.error as Error)?.message ?? 'Falha ao carregar complementos'}
            </div>
          )}

          <DataTable<Complemento>
            ariaLabel="Listagem de complementos"
            columns={complementoColumns}
            data={grupoSelecionadoId === null ? [] : complementosPagina.data}
            getRowId={(complemento) => complemento.id}
            meta={
              grupoSelecionadoId === null
                ? { page: 1, pageSize: complementosUi.pageSize, total: 0, totalPages: 0 }
                : complementosPagina.meta
            }
            loading={grupoSelecionadoId !== null && complementosQuery.isLoading}
            itemLabel="complementos"
            storageKey="admin-cardapio-complementos-itens"
            emptyMessage={
              grupoSelecionadoId === null
                ? 'Nenhum grupo selecionado'
                : 'Nenhum complemento neste grupo'
            }
            emptyHint={
              grupoSelecionadoId === null
                ? 'Clique em um grupo para editar seus complementos.'
                : complementosUi.search
                  ? `Nada corresponde a "${complementosUi.search}".`
                  : 'Cadastre o primeiro complemento abaixo.'
            }
            onPageChange={(numero) => complementosUi.setPage(numero)}
            onPageSizeChange={complementosUi.setPageSize}
            onSearch={complementosUi.definirBusca}
            onSort={complementosUi.definirOrdenacao}
            rowActions={{
              onEdit: abrirEdicaoComplemento,
              onDelete: setComplementoParaExcluir,
              editLabel: 'Editar complemento',
              deleteLabel: 'Excluir complemento',
              extra: (complemento) => (
                <button
                  type="button"
                  title={complemento.ativo ? 'Desativar' : 'Ativar'}
                  aria-label={complemento.ativo ? 'Desativar complemento' : 'Ativar complemento'}
                  disabled={alternandoComplementoId === complemento.id}
                  onClick={() => void alternarComplemento(complemento)}
                  className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
                >
                  {complemento.ativo ? (
                    <PowerOff className="h-4 w-4" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                </button>
              ),
            }}
            createAction={{ label: 'Novo complemento', onClick: abrirNovoComplemento }}
          />
        </section>
      </div>

      {showGrupoForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editingGrupo ? 'Editar grupo' : 'Novo grupo'}
              </h2>
            </div>

            <form onSubmit={salvarGrupo} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="grupo-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  id="grupo-nome"
                  type="text"
                  value={grupoForm.nome}
                  onChange={(event) => atualizarGrupoCampo('nome', event.target.value)}
                  placeholder="Ex.: Adicionais"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="grupo-min" className="mb-1 block text-sm font-medium text-black">
                    Mínimo
                  </label>
                  <input
                    id="grupo-min"
                    type="number"
                    min={0}
                    step={1}
                    value={grupoForm.minEscolhas}
                    onChange={(event) => atualizarGrupoCampo('minEscolhas', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label htmlFor="grupo-max" className="mb-1 block text-sm font-medium text-black">
                    Máximo
                  </label>
                  <input
                    id="grupo-max"
                    type="number"
                    min={1}
                    step={1}
                    value={grupoForm.maxEscolhas}
                    onChange={(event) => atualizarGrupoCampo('maxEscolhas', event.target.value)}
                    placeholder="Ilimitado"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label htmlFor="grupo-ordem" className="mb-1 block text-sm font-medium text-black">
                    Ordem
                  </label>
                  <input
                    id="grupo-ordem"
                    type="number"
                    min={0}
                    step={1}
                    value={grupoForm.ordem}
                    onChange={(event) => atualizarGrupoCampo('ordem', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  checked={grupoForm.obrigatorio}
                  onChange={() => atualizarGrupoCampo('obrigatorio', !grupoForm.obrigatorio)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">
                  <span className="font-medium text-gray-900">Obrigatório</span>
                  <span className="block text-xs text-gray-500">
                    O produto exigirá que o operador escolha pelo menos o mínimo definido.
                  </span>
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={fecharGrupoForm} disabled={salvandoGrupo}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={salvandoGrupo}>
                  {editingGrupo ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showComplementoForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editingComplemento ? 'Editar complemento' : 'Novo complemento'}
              </h2>
            </div>

            <form onSubmit={salvarComplemento} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="complemento-grupo" className="mb-1 block text-sm font-medium text-black">
                  Grupo <span className="text-red-500">*</span>
                </label>
                <select
                  id="complemento-grupo"
                  value={complementoForm.grupoId}
                  onChange={(event) => atualizarComplementoCampo('grupoId', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                >
                  <option value="">Selecione</option>
                  {gruposSelect.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="complemento-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  id="complemento-nome"
                  type="text"
                  value={complementoForm.nome}
                  onChange={(event) => atualizarComplementoCampo('nome', event.target.value)}
                  placeholder="Ex.: Queijo coalho"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="complemento-valor" className="mb-1 block text-sm font-medium text-black">
                    Valor
                  </label>
                  <input
                    id="complemento-valor"
                    type="text"
                    inputMode="decimal"
                    value={complementoForm.valor}
                    onChange={(event) => atualizarComplementoCampo('valor', event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label htmlFor="complemento-ordem" className="mb-1 block text-sm font-medium text-black">
                    Ordem
                  </label>
                  <input
                    id="complemento-ordem"
                    type="number"
                    min={0}
                    step={1}
                    value={complementoForm.ordem}
                    onChange={(event) => atualizarComplementoCampo('ordem', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fecharComplementoForm}
                  disabled={salvandoComplemento}
                >
                  Cancelar
                </Button>
                <Button type="submit" isLoading={salvandoComplemento}>
                  {editingComplemento ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={grupoParaExcluir !== null}
        title="Excluir grupo"
        description={
          grupoParaExcluir
            ? `Tem certeza que deseja excluir "${grupoParaExcluir.nome}"? Os complementos do grupo também deixam de estar disponíveis para novos produtos.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusaoGrupo()}
        onClose={() => setGrupoParaExcluir(null)}
      />

      <ConfirmationModal
        isOpen={complementoParaExcluir !== null}
        title="Excluir complemento"
        description={
          complementoParaExcluir
            ? `Tem certeza que deseja excluir "${complementoParaExcluir.nome}"? O histórico de pedidos já feitos deve continuar preservado pelo backend.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusaoComplemento()}
        onClose={() => setComplementoParaExcluir(null)}
      />
    </div>
  )
}
