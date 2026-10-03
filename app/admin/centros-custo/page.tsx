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
 * Centros de custo — PRD seção 7 (Módulo 4), padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório, ÚNICO no banco) e `ativo`. Sem campos extras, o
 * formulário é um input só; a listagem tem o selo de situação porque o DELETE
 * do backend é SOFT DELETE e os inativos continuam aparecendo na página.
 */

const RESOURCE = '/centros-custo'

type CentroCusto = {
  id: number
  nome: string
  ativo: boolean
}

export default function CentrosCustoPage() {
  const { showToast } = useToast()
  const crud = useCrud<CentroCusto>({ resource: RESOURCE, entidade: 'Centro de custo' })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<CentroCusto>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CentroCusto | null>(null)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<CentroCusto | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  const abrirNova = () => {
    setEditing(null)
    setNome('')
    setShowForm(true)
  }

  const abrirEdicao = (centro: CentroCusto) => {
    setEditing(centro)
    setNome(centro.nome)
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
      showToast('Informe o nome do centro de custo', 'error')
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

  const alternar = async (centro: CentroCusto) => {
    setAlternandoId(centro.id)
    const atualizado = await crud.alternarAtivo(centro.id, !centro.ativo)
    setAlternandoId(null)

    if (atualizado === null) return
    showToast(`Centro de custo ${atualizado.ativo ? 'ativado' : 'desativado'}`, 'success')
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)

    // `ConfirmationModal` fecha sozinho depois do onConfirm, então guardamos o
    // registro antes para saber se devemos recuar de página ao terminar.
    const excluido = await crud.excluir(alvo.id)
    if (excluido === null) return

    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(data?.data.length ?? 0)) void refetch()
  }

  const columns: Array<DataTableColumn<CentroCusto>> = [
    {
      key: 'nome',
      header: 'Centro de custo',
      sortKey: 'nome',
      render: (centro) => <span className="font-medium text-gray-900">{centro.nome}</span>,
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      render: (centro) => <SeloAtivo ativo={centro.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-3xl font-bold text-black">Centros de Custo</h1>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar centros de custo'}
        </div>
      )}

      <DataTable<CentroCusto>
        ariaLabel="Listagem de centros de custo"
        columns={columns}
        data={pagina.data}
        getRowId={(centro) => centro.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="centros de custo"
        storageKey="admin-centros-custo"
        emptyMessage="Nenhum centro de custo encontrado"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Crie o primeiro centro de custo abaixo.'
        }
        onPageChange={(pagina) => ui.setPage(pagina)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar centro de custo',
          deleteLabel: 'Excluir centro de custo',
          extra: (centro) => (
            <button
              type="button"
              title={centro.ativo ? 'Desativar' : 'Ativar'}
              aria-label={centro.ativo ? 'Desativar centro de custo' : 'Ativar centro de custo'}
              disabled={alternandoId === centro.id}
              onClick={() => void alternar(centro)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {centro.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Novo centro de custo', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar centro de custo' : 'Novo centro de custo'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label
                  htmlFor="centro-custo-nome"
                  className="mb-1 block text-sm font-medium text-black"
                >
                  Nome
                </label>
                <input
                  id="centro-custo-nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Cozinha, Administrativo"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  O nome é único: o sistema recusa um centro de custo repetido.
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
        title="Excluir centro de custo"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? O registro é desativado (soft delete) e não aparece mais nas listas.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
