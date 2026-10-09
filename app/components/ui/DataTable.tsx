'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Inbox,
  Pencil,
  Trash2,
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Pagination } from './Pagination'
import Skeleton from './Skeleton'
import { Button } from './Button'
import { persistUiPreferences, UI_PREFERENCES_SYNC_EVENT } from '../../lib/uiPreferences'
import {
  PAGE_SIZE_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  useDebouncedValue,
  type PaginationMeta,
  type PageSize,
  type SortOrder,
} from '../../lib/pagination'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * DataTable — padrão único de listagem do sistema (PRD RF-UI-01).
 *
 * Decisões que importam:
 *
 * - **Paginação, busca e ordenação são do SERVIDOR.** O componente nunca filtra
 *   a página recebida: com 300+ mesas e centenas de itens, filtrar no cliente
 *   mostraria "nenhum resultado" para registros que estão na página 4. Por isso
 *   ele só emite eventos (`onSearch`, `onSort`, `onPageChange`) e recebe `meta`.
 * - **`pageSize` é lembrado por tela** em `localStorage`, na chave informada em
 *   `storageKey`. Sem isso, cada navegação volta a 25 e incomoda quem trabalha
 *   em uma lista longa o dia inteiro.
 * - **Exclusão sempre passa por confirmação do chamador.** O componente só
 *   emite `onDelete`; o modal (ConfirmationModal) é responsabilidade da tela,
 *   para que o texto da confirmação possa citar o registro certo.
 * - **Ordenação em 3 estados**: asc → desc → nenhum. O terceiro devolve a
 *   ordenação natural do servidor, que o usuário não consegue alcançar de outro
 *   jeito depois de clicar num cabeçalho.
 * - **Colunas `hideOnMobile`** existem porque a operação roda em celular no
 *   salão; sem isso a tabela vira rolagem horizontal ilegível.
 */

export interface DataTableColumn<T> {
  /** Identificador estável da coluna (não precisa ser uma chave de `T`). */
  key: string
  header: ReactNode
  /** Conteúdo da célula. Use `row` para montar o que precisar. */
  render: (row: T, index: number) => ReactNode
  /** Nome do campo no backend para ordenar. Ausente = coluna não ordenável. */
  sortKey?: string
  className?: string
  headerClassName?: string
  /** Esconde a coluna em telas pequenas (< 768px). */
  hideOnMobile?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface DataTableRowActions<T> {
  onEdit?: (row: T) => void
  onDelete?: (row: T) => void
  /** Ações extras renderizadas antes das padrões (ex.: menu "⋮"). */
  extra?: (row: T) => ReactNode
  /** Texto do tooltip de editar/excluir. Default genérico. */
  editLabel?: string
  deleteLabel?: string
  /** Esconde editar/excluir para linhas específicas (ex.: registro sem permissão). */
  canEdit?: (row: T) => boolean
  canDelete?: (row: T) => boolean
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  data: T[]
  /** Chave única da linha. */
  getRowId: (row: T) => string | number
  meta: PaginationMeta
  loading?: boolean
  /** Mensagem do estado vazio. */
  emptyMessage?: string
  emptyHint?: string
  rowActions?: DataTableRowActions<T>
  /** Conteúdo à direita da barra de busca (ex.: botão Exportar). */
  toolbar?: ReactNode
  /** Botão primário de criação, exibido ABAIXO da lista (padrão Gesfood). */
  createAction?: { label: string; onClick: () => void }
  /** Chave de persistência do `pageSize` por tela. */
  storageKey?: string
  /** Rótulo do rodapé: "registros", "mesas", "produtos"... */
  itemLabel?: string
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: PageSize) => void
  onSearch?: (search: string) => void
  onSort?: (sort: string | null, order: SortOrder | null) => void
  /** Habilita seleção múltipla com checkbox na primeira coluna. */
  selectable?: boolean
  selectedIds?: Array<string | number>
  onSelectionChange?: (ids: Array<string | number>) => void
  /** Barra de ações exibida quando há linhas selecionadas. */
  bulkActions?: (selectedIds: Array<string | number>) => ReactNode
  /** Nome acessível da tabela. */
  ariaLabel?: string
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function readStoredPageSize(storageKey?: string): PageSize | null {
  if (!storageKey || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`dsh:pageSize:${storageKey}`)
    const parsed = Number.parseInt(raw ?? '', 10)
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed) ? (parsed as PageSize) : null
  } catch {
    // localStorage bloqueado (modo privado / política) não pode derrubar a tela.
    return null
  }
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  meta,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado',
  emptyHint,
  rowActions,
  toolbar,
  createAction,
  storageKey,
  itemLabel = 'registros',
  onPageChange,
  onPageSizeChange,
  onSearch,
  onSort,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  ariaLabel = 'Listagem',
}: DataTableProps<T>) {
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Avisa o servidor quando a busca (já debounced) muda. `onSearch` é omitido na
  // primeira renderização para não disparar um fetch idêntico ao inicial.
  const [searchInitialized, setSearchInitialized] = useState(false)
  useEffect(() => {
    if (!onSearch) return
    if (!searchInitialized) {
      setSearchInitialized(true)
      return
    }
    onSearch(debouncedSearch.trim())
  }, [debouncedSearch, onSearch, searchInitialized])

  // Restaura o pageSize salvo desta tela uma única vez, no cliente.
  const [pageSizeInitialized, setPageSizeInitialized] = useState(false)
  useEffect(() => {
    if (pageSizeInitialized || !mounted) return
    setPageSizeInitialized(true)
    const stored = readStoredPageSize(storageKey)
    if (stored !== null && stored !== normalizeMetaPageSize(meta)) {
      onPageSizeChange?.(stored)
    }
  }, [mounted, pageSizeInitialized, storageKey, meta, onPageSizeChange])

  useEffect(() => {
    if (!storageKey) return
    const syncPageSize = () => {
      const stored = readStoredPageSize(storageKey)
      if (stored !== null && stored !== normalizeMetaPageSize(meta)) {
        onPageSizeChange?.(stored)
      }
    }
    window.addEventListener(UI_PREFERENCES_SYNC_EVENT, syncPageSize)
    return () => window.removeEventListener(UI_PREFERENCES_SYNC_EVENT, syncPageSize)
  }, [storageKey, meta, onPageSizeChange])

  const allIds = useMemo(() => data.map(getRowId), [data, getRowId])
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selectedIds.includes(id))
  const someSelected = selectable && selectedIds.length > 0 && !allSelected

  const toggleAll = () => {
    if (!onSelectionChange) return
    onSelectionChange(allSelected ? [] : allIds)
  }

  const toggleOne = (id: string | number) => {
    if (!onSelectionChange) return
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((current) => current !== id) : [...selectedIds, id]
    )
  }

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortKey || !onSort) return
    // asc -> desc -> nenhum (devolve a ordem natural do servidor)
    if (sortKey !== column.sortKey) {
      setSortKey(column.sortKey)
      setSortOrder('asc')
      onSort(column.sortKey, 'asc')
      return
    }
    if (sortOrder === 'asc') {
      setSortOrder('desc')
      onSort(column.sortKey, 'desc')
      return
    }
    setSortKey(null)
    setSortOrder(null)
    onSort(null, null)
  }

  const handlePageSize = (value: PageSize) => {
    if (storageKey && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`dsh:pageSize:${storageKey}`, String(value))
      } catch {
        // Persistência é conveniência: falhar aqui não pode quebrar a lista.
      }
      persistUiPreferences({ pageSizes: { [storageKey]: value } })
    }
    onPageSizeChange?.(value)
  }

  const columnCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)

  return (
    <div className="min-w-0 w-full [overflow-wrap:anywhere]">
      {/* Barra de controles: pageSize + busca + ações da tela */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <label htmlFor={`pagesize-${storageKey ?? 'default'}`} className="whitespace-nowrap">
            Exibir
          </label>
          <select
            id={`pagesize-${storageKey ?? 'default'}`}
            value={meta.pageSize}
            onChange={(event) => handlePageSize(Number(event.target.value) as PageSize)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="whitespace-nowrap">resultados por página</span>
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {onSearch && (
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Pesquisar..."
              aria-label="Pesquisar"
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 sm:max-w-xs"
            />
          )}
          {toolbar}
        </div>
      </div>

      {selectable && selectedIds.length > 0 && bulkActions && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm">
          <span className="font-medium text-orange-800">
            {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">{bulkActions(selectedIds)}</div>
        </div>
      )}

      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" aria-label={ariaLabel}>
            <thead className="bg-gray-50">
              <tr>
                {selectable && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someSelected
                      }}
                      onChange={toggleAll}
                      aria-label="Selecionar todos"
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                )}

                {columns.map((column) => {
                  const isSorted = sortKey === column.sortKey && column.sortKey !== undefined
                  const sortable = Boolean(column.sortKey && onSort)
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
                      }
                      className={cn(
                        'px-3 py-3 font-semibold text-gray-700',
                        ALIGN_CLASS[column.align ?? 'left'],
                        column.hideOnMobile && 'hidden md:table-cell',
                        column.headerClassName
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(column)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded transition-colors hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                            column.align === 'right' && 'flex-row-reverse'
                          )}
                          title={`Ordenar por ${typeof column.header === 'string' ? column.header : column.key}`}
                        >
                          <span>{column.header}</span>
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}

                {rowActions && (
                  <th scope="col" className="px-3 py-3 text-right font-semibold text-gray-700">
                    Ações
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading &&
                Array.from({ length: Math.min(meta.pageSize, 8) }).map((_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} className="border-t border-gray-100">
                    {Array.from({ length: columnCount }).map((__, cellIndex) => (
                      <td key={`skeleton-cell-${cellIndex}`} className="px-3 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                data.map((row, index) => {
                  const id = getRowId(row)
                  const isSelected = selectedIds.includes(id)
                  return (
                    <tr
                      key={id}
                      className={cn(
                        'border-t border-gray-100 transition-colors hover:bg-orange-50/40',
                        isSelected && 'bg-orange-50/60'
                      )}
                    >
                      {selectable && (
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleOne(id)}
                            aria-label={`Selecionar linha ${index + 1}`}
                            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                        </td>
                      )}

                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={cn(
                            'px-3 py-3 text-gray-800 break-words',
                            ALIGN_CLASS[column.align ?? 'left'],
                            column.hideOnMobile && 'hidden md:table-cell',
                            column.className
                          )}
                        >
                          {column.render(row, index)}
                        </td>
                      ))}

                      {rowActions && (
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {rowActions.extra?.(row)}
                            {rowActions.onEdit && (rowActions.canEdit?.(row) ?? true) && (
                              <button
                                type="button"
                                onClick={() => rowActions.onEdit?.(row)}
                                title={rowActions.editLabel ?? 'Editar'}
                                aria-label={rowActions.editLabel ?? 'Editar'}
                                className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {rowActions.onDelete && (rowActions.canDelete?.(row) ?? true) && (
                              <button
                                type="button"
                                onClick={() => rowActions.onDelete?.(row)}
                                title={rowActions.deleteLabel ?? 'Excluir'}
                                aria-label={rowActions.deleteLabel ?? 'Excluir'}
                                className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}

              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="px-3 py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                      <Inbox className="h-8 w-8 text-gray-300" />
                      <p className="font-medium text-gray-700">{emptyMessage}</p>
                      {emptyHint && <p className="text-sm text-gray-500">{emptyHint}</p>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          meta={meta}
          onPageChange={(page) => onPageChange?.(page)}
          disabled={loading}
          itemLabel={itemLabel}
        />
      </div>

      {createAction && (
        <div className="mt-4">
          <Button type="button" onClick={createAction.onClick}>
            {createAction.label}
          </Button>
        </div>
      )}
    </div>
  )
}

function normalizeMetaPageSize(meta: PaginationMeta): PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(meta.pageSize)
    ? (meta.pageSize as PageSize)
    : 25
}

export default DataTable
