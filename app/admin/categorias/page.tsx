'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImageIcon, Power, PowerOff } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { useToast } from '@/contexts/ToastContext'
import { apiFetch } from '@/app/lib/api'
import { usePagedQuery, type SortOrder } from '@/app/lib/pagination'
import { SeloAtivo } from '@/app/lib/crud-client'

type Categoria = {
  id: number
  nome: string
  setor: string
  ativo: boolean
  imagem: string | null
  ordem: number
  _count?: { produtos: number }
  produtos?: Array<{ id: number }>
}

const SETORES = ['COZINHA', 'BAR', 'SOBREMESA'] as const

const SETOR_BADGE: Record<string, string> = {
  COZINHA: 'bg-orange-100 text-orange-800',
  BAR: 'bg-blue-100 text-blue-800',
  SOBREMESA: 'bg-purple-100 text-purple-800',
}

/**
 * Migração para o padrão DataTable (RF-UI-01).
 *
 * O que mudou em relação à versão anterior:
 * - paginação, busca e ordenação passaram a ser do SERVIDOR (antes a tela baixava
 *   todas as categorias e filtrava no cliente);
 * - a exclusão passou a usar o ConfirmationModal do projeto, no lugar do
 *   `confirm()` nativo do browser;
 * - formatação de erro e chamadas padronizadas por `lib/api.ts`.
 */
export default function CategoriasPage() {
  const router = useRouter()
  const { showToast } = useToast()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string | null>(null)
  const [order, setOrder] = useState<SortOrder | null>(null)

  const [editing, setEditing] = useState<Categoria | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [setor, setSetor] = useState<string>('COZINHA')
  const [imagem, setImagem] = useState('')
  const [ordem, setOrdem] = useState('0')
  const [salvando, setSalvando] = useState(false)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)
  const [paraExcluir, setParaExcluir] = useState<Categoria | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<Categoria>({
    resource: '/categories',
    page,
    pageSize,
    search,
    sort,
    order,
  })

  /**
   * Envolve a chamada para centralizar toast + redirecionamento em 401, que é o
   * padrão que as telas migradas devem seguir. O check de status é por forma
   * (`status === 401`) para não acoplar a tela a um `instanceof` de classe.
   */
  const chamar = useCallback(
    async <T,>(fn: () => Promise<T>, mensagemErro: string): Promise<T | null> => {
      try {
        return await fn()
      } catch (err) {
        const status = (err as { status?: number } | null)?.status
        if (status === 401) {
          router.push('/login')
          return null
        }
        showToast(err instanceof Error ? err.message : mensagemErro, 'error')
        return null
      }
    },
    [router, showToast]
  )

  const abrirNova = () => {
    setEditing(null)
    setNome('')
    setSetor('COZINHA')
    setImagem('')
    setOrdem('0')
    setShowForm(true)
  }

  const abrirEdicao = (categoria: Categoria) => {
    setEditing(categoria)
    setNome(categoria.nome)
    setSetor(categoria.setor)
    setImagem(categoria.imagem ?? '')
    setOrdem(String(categoria.ordem ?? 0))
    setShowForm(true)
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()
    setSalvando(true)
    const editando = editing
    const ordemNumero = Number(ordem || 0)
    if (!Number.isInteger(ordemNumero) || ordemNumero < 0) {
      showToast('Ordem deve ser um número inteiro não negativo', 'error')
      setSalvando(false)
      return
    }

    const resultado = await chamar(
      () =>
        apiFetch(editando ? `/categories/${editando.id}` : '/categories', {
          method: editando ? 'PUT' : 'POST',
          body: { nome, setor, imagem, ordem: ordemNumero },
        }),
      'Erro ao salvar categoria'
    )

    setSalvando(false)
    if (resultado === null) return

    showToast(editando ? 'Categoria atualizada' : 'Categoria criada', 'success')
    setShowForm(false)
    setEditing(null)
    setNome('')
    setSetor('COZINHA')
    setImagem('')
    setOrdem('0')
    void refetch()
  }

  const alternarAtivo = async (categoria: Categoria) => {
    setAlternandoId(categoria.id)
    const resultado = await chamar(
      () =>
        apiFetch<Categoria>(`/categories/${categoria.id}/ativo`, {
          method: 'PATCH',
          body: { ativo: !categoria.ativo },
        }),
      'Erro ao alterar status da categoria'
    )
    setAlternandoId(null)
    if (resultado === null) return
    showToast(`Categoria ${resultado.ativo ? 'ativada' : 'desativada'}`, 'success')
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    setExcluindo(true)

    const resultado = await chamar(
      () => apiFetch(`/categories/${paraExcluir.id}`, { method: 'DELETE' }),
      'Erro ao excluir categoria'
    )

    setExcluindo(false)
    if (resultado === null) return

    showToast('Categoria excluída', 'success')
    setParaExcluir(null)
    void refetch()
    // Se apagou a última linha da página, recuar evita cair numa página vazia.
    if (data && data.data.length === 1 && page > 1) {
      setPage((atual) => atual - 1)
    }
  }

  const columns: Array<DataTableColumn<Categoria>> = [
    {
      key: 'nome',
      header: 'Categoria',
      sortKey: 'nome',
      render: (categoria) => (
        <div className="flex items-center gap-3">
          {categoria.imagem ? (
            <div
              aria-hidden="true"
              className="h-10 w-10 rounded bg-cover bg-center"
              style={{ backgroundImage: `url(${categoria.imagem})` }}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 text-gray-400">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
          <div>
            <span className="font-medium text-gray-900">{categoria.nome}</span>
            <p className="text-xs text-gray-500">Ordem {categoria.ordem ?? 0}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'setor',
      header: 'Setor',
      render: (categoria) => (
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${
            SETOR_BADGE[categoria.setor] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {categoria.setor}
        </span>
      ),
    },
    {
      key: 'ativo',
      header: 'Status',
      sortKey: 'ativo',
      hideOnMobile: true,
      render: (categoria) => <SeloAtivo ativo={categoria.ativo} />,
    },
    {
      key: 'produtos',
      header: 'Produtos ativos',
      align: 'center',
      hideOnMobile: true,
      render: (categoria) => (
        <span className="text-gray-600">
          {categoria._count?.produtos ?? categoria.produtos?.length ?? 0}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-3xl font-bold text-black">Gerenciar Categorias</h1>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar categorias'}
        </div>
      )}

      <DataTable<Categoria>
        ariaLabel="Listagem de categorias"
        columns={columns}
        data={data?.data ?? []}
        getRowId={(categoria) => categoria.id}
        meta={data?.meta ?? { page, pageSize, total: 0, totalPages: 0 }}
        loading={isLoading}
        itemLabel="categorias"
        storageKey="admin-categorias"
        emptyMessage="Nenhuma categoria encontrada"
        emptyHint={search ? `Nada corresponde a "${search}".` : 'Crie a primeira categoria abaixo.'}
        onPageChange={setPage}
        onPageSizeChange={(novo) => {
          setPageSize(novo)
          setPage(1)
        }}
        onSearch={(texto) => {
          setSearch(texto)
          setPage(1)
        }}
        onSort={(campo, direcao) => {
          setSort(campo)
          setOrder(direcao)
          setPage(1)
        }}
          rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          deleteLabel: 'Desativar',
          extra: (categoria) => (
            <button
              type="button"
              title={categoria.ativo ? 'Desativar' : 'Ativar'}
              aria-label={categoria.ativo ? 'Desativar categoria' : 'Ativar categoria'}
              disabled={alternandoId === categoria.id}
              onClick={() => void alternarAtivo(categoria)}
              className="rounded-lg p-1.5 text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              {categoria.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Nova categoria', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar categoria' : 'Nova categoria'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="categoria-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome
                </label>
                <input
                  id="categoria-nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="categoria-setor" className="mb-1 block text-sm font-medium text-black">
                  Setor de produção
                </label>
                <select
                  id="categoria-setor"
                  value={setor}
                  onChange={(event) => setSetor(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {SETORES.map((valor) => (
                    <option key={valor} value={valor}>
                      {valor.charAt(0) + valor.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Define para qual impressora os itens desta categoria são enviados.
                </p>
              </div>

              <div>
                <label htmlFor="categoria-imagem" className="mb-1 block text-sm font-medium text-black">
                  Imagem
                </label>
                <input
                  id="categoria-imagem"
                  type="url"
                  value={imagem}
                  onChange={(event) => setImagem(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label htmlFor="categoria-ordem" className="mb-1 block text-sm font-medium text-black">
                  Ordem
                </label>
                <input
                  id="categoria-ordem"
                  type="number"
                  min={0}
                  value={ordem}
                  onChange={(event) => setOrdem(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={salvando}
                >
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
        title="Excluir categoria"
        description={
          paraExcluir
            ? `Tem certeza que deseja desativar "${paraExcluir.nome}"? Ela deixa de aparecer no cardápio, mas o histórico é preservado.`
            : ''
        }
        confirmText={excluindo ? 'Desativando...' : 'Desativar'}
        onConfirm={confirmarExclusao}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
