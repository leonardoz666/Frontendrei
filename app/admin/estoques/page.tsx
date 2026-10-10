'use client'

import { useState } from 'react'
import { Power, PowerOff } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { useCrud, useListaCrud, paginaAtual, SeloAtivo } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Locais de estoque (`EstoqueLocal`) — PRD seção 7 (Módulo 4), padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório, ÚNICO) e `ativo`. É a base das transferências de
 * insumo da Fase 4, por isso os locais previstos ("Cozinha", "Bar", "Depósito")
 * aparecem como sugestão no formulário — o valor continua livre.
 */

const RESOURCE = '/estoques'

const NOMES_SUGERIDOS = ['Cozinha', 'Bar', 'Depósito'] as const

type EstoqueLocal = {
  id: number
  nome: string
  ativo: boolean
}

export default function EstoquesPage() {
  const { showToast } = useToast()
  const crud = useCrud<EstoqueLocal>({ resource: RESOURCE, entidade: 'Local de estoque' })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<EstoqueLocal>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EstoqueLocal | null>(null)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<EstoqueLocal | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  const abrirNova = () => {
    setEditing(null)
    setNome('')
    setShowForm(true)
  }

  const abrirEdicao = (estoque: EstoqueLocal) => {
    setEditing(estoque)
    setNome(estoque.nome)
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setNome('')
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()
    const nomeLimpo = nome.trim()
    if (nomeLimpo === '') {
      showToast('Informe o nome do local de estoque', 'error')
      return
    }

    setSalvando(true)
    const editando = editing
    const salvo = editando
      ? await crud.atualizar(editando.id, { nome: nomeLimpo })
      : await crud.criar({ nome: nomeLimpo })
    setSalvando(false)

    if (salvo === null) return
    showToast(crud.mensagem(editando ? 'atualizado' : 'criado'), 'success')
    fecharForm()
    ui.reiniciarPagina()
    void refetch()
  }

  const alternar = async (estoque: EstoqueLocal) => {
    setAlternandoId(estoque.id)
    const atualizado = await crud.alternarAtivo(estoque.id, !estoque.ativo)
    setAlternandoId(null)

    if (atualizado === null) return
    showToast(`Local de estoque ${atualizado.ativo ? 'ativado' : 'desativado'}`, 'success')
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

  const columns: Array<DataTableColumn<EstoqueLocal>> = [
    {
      key: 'nome',
      header: 'Local de estoque',
      sortKey: 'nome',
      render: (estoque) => <span className="font-medium text-gray-900">{estoque.nome}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      render: (estoque) => <SeloAtivo ativo={estoque.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-6 text-3xl font-bold text-black">Locais de Estoque</h1>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar locais de estoque'}
        </div>
      )}

      <DataTable<EstoqueLocal>
        ariaLabel="Listagem de locais de estoque"
        columns={columns}
        data={pagina.data}
        getRowId={(estoque) => estoque.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="locais de estoque"
        storageKey="admin-estoques"
        emptyMessage="Nenhum local de estoque encontrado"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Crie o primeiro local de estoque abaixo.'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar local de estoque',
          deleteLabel: 'Excluir local de estoque',
          extra: (estoque) => (
            <button
              type="button"
              title={estoque.ativo ? 'Desativar' : 'Ativar'}
              aria-label={estoque.ativo ? 'Desativar local de estoque' : 'Ativar local de estoque'}
              disabled={alternandoId === estoque.id}
              onClick={() => void alternar(estoque)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {estoque.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Novo local de estoque', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar local de estoque' : 'Novo local de estoque'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="estoque-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome
                </label>
                <input
                  id="estoque-nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Cozinha"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nome único. Locais sugeridos pelo PRD: {NOMES_SUGERIDOS.join(', ')}.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={fecharForm} disabled={salvando}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={salvando}>
                  {editing ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={paraExcluir !== null}
        title="Excluir local de estoque"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? O local é desativado (soft delete) e deixa de aparecer nas listas de estoque.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
