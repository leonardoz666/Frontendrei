'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { apiFetch } from '@/app/lib/api'
import { useCrud, useListaCrud, paginaAtual } from '@/app/lib/crud-client'
import { usePagedQuery } from '@/app/lib/pagination'
import { useToast } from '@/contexts/ToastContext'

type Tamanho = {
  id: number
  tipoId: number
  nome: string
  valor: number
  custo: number
  ordem: number
}

type TipoTamanho = {
  id: number
  nome: string
  tamanhos?: Tamanho[]
  _count?: { produtos: number; tamanhos: number }
}

const RESOURCE = '/tipos-tamanho'

function moeda(valor: unknown): string {
  const numero = typeof valor === 'number' ? valor : Number(valor ?? 0)
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function TiposTamanhoPage() {
  const { showToast } = useToast()
  const crud = useCrud<TipoTamanho>({ resource: RESOURCE, entidade: 'Tipo por tamanho' })
  const ui = useListaCrud(RESOURCE)
  const { data, isLoading, isError, error, refetch } = usePagedQuery<TipoTamanho>(ui.listaParams)
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<TipoTamanho | null>(null)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<TipoTamanho | null>(null)

  const [tipoParaTamanho, setTipoParaTamanho] = useState<TipoTamanho | null>(null)
  const [tamanhoNome, setTamanhoNome] = useState('')
  const [tamanhoValor, setTamanhoValor] = useState('')
  const [tamanhoCusto, setTamanhoCusto] = useState('')
  const [tamanhoOrdem, setTamanhoOrdem] = useState('0')
  const [salvandoTamanho, setSalvandoTamanho] = useState(false)
  const [tamanhoParaExcluir, setTamanhoParaExcluir] = useState<Tamanho | null>(null)

  const abrirNovo = () => {
    setEditing(null)
    setNome('')
    setShowForm(true)
  }

  const abrirEdicao = (tipo: TipoTamanho) => {
    setEditing(tipo)
    setNome(tipo.nome)
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
      showToast('Informe o nome do tipo', 'error')
      return
    }

    setSalvando(true)
    const salvo = editing
      ? await crud.atualizar(editing.id, { nome: nomeLimpo })
      : await crud.criar({ nome: nomeLimpo })
    setSalvando(false)
    if (!salvo) return

    showToast(crud.mensagem(editing ? 'atualizado' : 'criado'), 'success')
    fecharForm()
    ui.reiniciarPagina()
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)
    const excluido = await crud.excluir(alvo.id)
    if (!excluido) return
    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const abrirTamanho = (tipo: TipoTamanho) => {
    setTipoParaTamanho(tipo)
    setTamanhoNome('')
    setTamanhoValor('')
    setTamanhoCusto('')
    setTamanhoOrdem(String(tipo.tamanhos?.length ?? 0))
  }

  const salvarTamanho = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!tipoParaTamanho) return
    if (tamanhoNome.trim() === '' || tamanhoValor.trim() === '') {
      showToast('Informe nome e valor do tamanho', 'error')
      return
    }

    setSalvandoTamanho(true)
    try {
      await apiFetch(`${RESOURCE}/${tipoParaTamanho.id}/tamanhos`, {
        method: 'POST',
        body: {
          nome: tamanhoNome.trim(),
          valor: Number(tamanhoValor.replace(',', '.')),
          custo: tamanhoCusto.trim() === '' ? 0 : Number(tamanhoCusto.replace(',', '.')),
          ordem: Number(tamanhoOrdem || 0),
        },
      })
      showToast('Tamanho criado', 'success')
      setTipoParaTamanho(null)
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar tamanho', 'error')
    } finally {
      setSalvandoTamanho(false)
    }
  }

  const removerTamanho = async (tamanho: Tamanho) => {
    try {
      await apiFetch(`${RESOURCE}/${tamanho.tipoId}/tamanhos/${tamanho.id}`, { method: 'DELETE' })
      showToast('Tamanho excluído', 'success')
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir tamanho', 'error')
    }
  }

  const columns: Array<DataTableColumn<TipoTamanho>> = [
    {
      key: 'nome',
      header: 'Tipo',
      sortKey: 'nome',
      render: (tipo) => <span className="font-semibold text-gray-900">{tipo.nome}</span>,
    },
    {
      key: 'tamanhos',
      header: 'Tamanhos',
      render: (tipo) => (
        <div className="space-y-1">
          {(tipo.tamanhos ?? []).length === 0 ? (
            <span className="text-sm text-gray-400">Nenhum tamanho</span>
          ) : (
            tipo.tamanhos?.map((tamanho) => (
              <div key={tamanho.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1 text-xs">
                <span className="text-gray-700">
                  {tamanho.nome} · {moeda(tamanho.valor)}
                </span>
                <button
                  type="button"
                  onClick={() => setTamanhoParaExcluir(tamanho)}
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  title="Excluir tamanho"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'produtos',
      header: 'Produtos',
      align: 'center',
      hideOnMobile: true,
      render: (tipo) => <span>{tipo._count?.produtos ?? 0}</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Tipos por tamanho</h1>
      <p className="mb-6 text-sm text-gray-600">
        Cadastre famílias como Pizza, Pirão fracionado ou Escondidinho fracionado e seus tamanhos/preços.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar tipos'}
        </div>
      )}

      <DataTable<TipoTamanho>
        ariaLabel="Tipos por tamanho"
        columns={columns}
        data={pagina.data}
        getRowId={(tipo) => tipo.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="tipos"
        storageKey="admin-tipos-tamanho"
        emptyMessage="Nenhum tipo por tamanho encontrado"
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          extra: (tipo) => (
            <button
              type="button"
              onClick={() => abrirTamanho(tipo)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50"
              title="Adicionar tamanho"
            >
              <Plus className="h-4 w-4" />
            </button>
          ),
        }}
        createAction={{ label: 'Novo tipo', onClick: abrirNovo }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">{editing ? 'Editar tipo' : 'Novo tipo'}</h2>
            </div>
            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="tipo-nome" className="mb-1 block text-sm font-medium text-black">Nome</label>
                <input
                  id="tipo-nome"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={fecharForm}>Cancelar</Button>
                <Button type="submit" isLoading={salvando}>{editing ? 'Salvar' : 'Adicionar'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tipoParaTamanho && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">Novo tamanho · {tipoParaTamanho.nome}</h2>
            </div>
            <form onSubmit={salvarTamanho} className="space-y-4 px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="tamanho-nome" className="mb-1 block text-sm font-medium text-black">Nome</label>
                  <input id="tamanho-nome" value={tamanhoNome} onChange={(e) => setTamanhoNome(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required autoFocus />
                </div>
                <div>
                  <label htmlFor="tamanho-valor" className="mb-1 block text-sm font-medium text-black">Valor</label>
                  <input id="tamanho-valor" value={tamanhoValor} onChange={(e) => setTamanhoValor(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-gray-300 p-2 text-black" required />
                </div>
                <div>
                  <label htmlFor="tamanho-custo" className="mb-1 block text-sm font-medium text-black">Custo</label>
                  <input id="tamanho-custo" value={tamanhoCusto} onChange={(e) => setTamanhoCusto(e.target.value)} placeholder="0,00" className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label htmlFor="tamanho-ordem" className="mb-1 block text-sm font-medium text-black">Ordem</label>
                  <input id="tamanho-ordem" type="number" min={0} value={tamanhoOrdem} onChange={(e) => setTamanhoOrdem(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTipoParaTamanho(null)}>Cancelar</Button>
                <Button type="submit" isLoading={salvandoTamanho}>Adicionar tamanho</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={paraExcluir !== null}
        title="Excluir tipo por tamanho"
        description={paraExcluir ? `Excluir "${paraExcluir.nome}"? Só é permitido quando não houver produtos vinculados.` : ''}
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />

      <ConfirmationModal
        isOpen={tamanhoParaExcluir !== null}
        title="Excluir tamanho"
        description={tamanhoParaExcluir ? `Excluir o tamanho "${tamanhoParaExcluir.nome}"? Só é permitido quando ele não estiver em uso.` : ''}
        confirmText="Excluir"
        onConfirm={() => {
          if (tamanhoParaExcluir) void removerTamanho(tamanhoParaExcluir)
        }}
        onClose={() => setTamanhoParaExcluir(null)}
      />
    </div>
  )
}
