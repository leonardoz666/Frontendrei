'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { fetchList } from '@/app/lib/api'
import { usePagedQuery } from '@/app/lib/pagination'
import { comoDecimalDigitado, comoNumero, paginaAtual, useCrud, useListaCrud } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

const RESOURCE = '/insumos/ficha-tecnica'

type Produto = {
  id: number
  codigo?: string | null
  nome: string
}

type Insumo = {
  id: number
  codigo: string
  nome: string
  unidade: string
}

type FichaTecnicaItem = {
  id: number
  produtoId: number
  insumoId: number
  quantidade: number | string
  rendimento: number | string
  ativo: boolean
  produto?: Produto
  insumo?: Insumo
}

type FormState = {
  produtoId: string
  insumoId: string
  quantidade: string
  rendimento: string
}

const FORM_VAZIO: FormState = {
  produtoId: '',
  insumoId: '',
  quantidade: '',
  rendimento: '1',
}

function quantidade(valor: unknown, unidade?: string): string {
  return `${comoNumero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })} ${unidade ?? ''}`.trim()
}

export default function FichaTecnicaPage() {
  const { showToast } = useToast()
  const crud = useCrud<FichaTecnicaItem>({ resource: RESOURCE, entidade: 'Item de ficha técnica' })
  const ui = useListaCrud(RESOURCE)
  const { data, isLoading, isError, error, refetch } = usePagedQuery<FichaTecnicaItem>(ui.listaParams)
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const { data: produtos = [] } = useQuery({
    queryKey: ['ficha-produtos-select'],
    queryFn: () => fetchList<Produto>('/products?page=1&pageSize=100&ativo=true'),
  })
  const { data: insumos = [] } = useQuery({
    queryKey: ['ficha-insumos-select'],
    queryFn: () => fetchList<Insumo>('/insumos?page=1&pageSize=100&ativo=true'),
  })

  const produtosSelect = useMemo(
    () => [...produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [produtos]
  )
  const insumosSelect = useMemo(
    () => [...insumos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [insumos]
  )

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FichaTecnicaItem | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<FichaTecnicaItem | null>(null)

  const atualizarCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const abrirNovo = () => {
    setEditing(null)
    setForm({
      ...FORM_VAZIO,
      produtoId: produtosSelect[0]?.id ? String(produtosSelect[0].id) : '',
      insumoId: insumosSelect[0]?.id ? String(insumosSelect[0].id) : '',
    })
    setShowForm(true)
  }

  const abrirEdicao = (item: FichaTecnicaItem) => {
    setEditing(item)
    setForm({
      produtoId: String(item.produtoId),
      insumoId: String(item.insumoId),
      quantidade: String(item.quantidade ?? ''),
      rendimento: String(item.rendimento ?? 1),
    })
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(FORM_VAZIO)
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()
    const produtoId = Number(form.produtoId)
    const insumoId = Number(form.insumoId)
    const quantidade = comoDecimalDigitado(form.quantidade)
    const rendimento = comoDecimalDigitado(form.rendimento)

    if (!Number.isInteger(produtoId) || produtoId < 1 || !Number.isInteger(insumoId) || insumoId < 1) {
      showToast('Selecione produto e insumo', 'error')
      return
    }
    if (quantidade === null || quantidade <= 0 || rendimento === null || rendimento <= 0) {
      showToast('Quantidade e rendimento devem ser maiores que zero', 'error')
      return
    }

    setSalvando(true)
    const corpo = { produtoId, insumoId, quantidade, rendimento }
    const salvo = editing ? await crud.atualizar(editing.id, corpo) : await crud.criar(corpo)
    setSalvando(false)
    if (salvo === null) return
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
    if (excluido === null) return
    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<FichaTecnicaItem>> = [
    {
      key: 'produto',
      header: 'Produto',
      render: (item) => (
        <div>
          <span className="font-medium text-gray-900">{item.produto?.nome ?? `#${item.produtoId}`}</span>
          <span className="block font-mono text-xs text-gray-500">{item.produto?.codigo ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'insumo',
      header: 'Insumo',
      render: (item) => (
        <div>
          <span className="font-medium text-gray-900">{item.insumo?.nome ?? `#${item.insumoId}`}</span>
          <span className="block font-mono text-xs text-gray-500">{item.insumo?.codigo ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'quantidade',
      header: 'Quantidade',
      align: 'right',
      render: (item) => <span className="text-gray-700">{quantidade(item.quantidade, item.insumo?.unidade)}</span>,
    },
    {
      key: 'rendimento',
      header: 'Rendimento',
      align: 'right',
      hideOnMobile: true,
      render: (item) => <span className="text-gray-700">{comoNumero(item.rendimento).toLocaleString('pt-BR')}</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Ficha técnica</h1>
      <p className="mb-6 text-sm text-gray-600">
        Defina quanto de cada insumo é consumido quando um produto é vendido.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar ficha técnica'}
        </div>
      )}

      <DataTable
        ariaLabel="Ficha técnica"
        columns={columns}
        data={pagina.data}
        getRowId={(item) => item.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="itens"
        storageKey="admin-estoque-ficha-tecnica"
        emptyMessage="Nenhum item de ficha técnica encontrado"
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar item',
          deleteLabel: 'Excluir item',
        }}
        createAction={{ label: 'Novo item', onClick: abrirNovo }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">{editing ? 'Editar item' : 'Novo item'}</h2>
            </div>
            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="ficha-produto" className="mb-1 block text-sm font-medium text-black">Produto</label>
                <select id="ficha-produto" value={form.produtoId} onChange={(event) => atualizarCampo('produtoId', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required>
                  <option value="">Selecione</option>
                  {produtosSelect.map((produto) => (
                    <option key={produto.id} value={produto.id}>{produto.codigo ? `${produto.codigo} · ` : ''}{produto.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ficha-insumo" className="mb-1 block text-sm font-medium text-black">Insumo</label>
                <select id="ficha-insumo" value={form.insumoId} onChange={(event) => atualizarCampo('insumoId', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required>
                  <option value="">Selecione</option>
                  {insumosSelect.map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>{insumo.codigo} · {insumo.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ficha-qtd" className="mb-1 block text-sm font-medium text-black">Quantidade consumida</label>
                  <input id="ficha-qtd" inputMode="decimal" value={form.quantidade} onChange={(event) => atualizarCampo('quantidade', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required />
                </div>
                <div>
                  <label htmlFor="ficha-rend" className="mb-1 block text-sm font-medium text-black">Rendimento</label>
                  <input id="ficha-rend" inputMode="decimal" value={form.rendimento} onChange={(event) => atualizarCampo('rendimento', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required />
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
        title="Excluir item"
        description={paraExcluir ? 'Excluir este item da ficha técnica? A exclusão desativa o vínculo para novas baixas.' : ''}
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
