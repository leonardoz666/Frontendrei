'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PaginationMeta } from '../../lib/pagination'
import { Button } from './Button'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type PaginationItem = number | 'ellipsis'

/**
 * Janela de páginas com elipse (RF-UI-01.5):
 * 1 … 4 [5] 6 … 20. Sempre mostra a primeira e a última página.
 */
export function getPaginationItems(current: number, totalPages: number, windowSize = 1): PaginationItem[] {
  const lastPage = Math.max(1, Math.floor(totalPages))
  const active = Math.min(Math.max(1, Math.floor(current)), lastPage)
  const maxWithoutEllipsis = 5 + windowSize * 2

  if (lastPage <= maxWithoutEllipsis) {
    return Array.from({ length: lastPage }, (_, index) => index + 1)
  }

  const start = Math.max(2, active - windowSize)
  const end = Math.min(lastPage - 1, active + windowSize)
  const items: PaginationItem[] = [1]

  if (start > 2) {
    items.push('ellipsis')
  }

  for (let page = start; page <= end; page++) {
    items.push(page)
  }

  if (end < lastPage - 1) {
    items.push('ellipsis')
  }

  items.push(lastPage)

  return items
}

export interface PaginationProps {
  meta: PaginationMeta
  onPageChange: (page: number) => void
  className?: string
  /** Desabilita toda a navegação (ex.: durante um fetch em andamento). */
  disabled?: boolean
  /** Sufixo do rodapé. Default: "registros". */
  itemLabel?: string
}

function navButtonClass(active: boolean): string {
  return cn(
    'h-8 min-w-8 px-2 text-xs font-semibold',
    active
      ? 'border-orange-600 bg-orange-600 text-white hover:bg-orange-700 hover:text-white'
      : 'text-gray-700'
  )
}

/**
 * Paginação do padrão de UI (RF-UI-01.5/01.6):
 * Primeiro · Anterior · números com elipse · Próximo · Último
 * e o rodapé "Mostrando X até Y de Z registros".
 *
 * Componente controlado: quem chama guarda `page` (ex.: estado da tela ou o
 * `usePagedQuery`) e reage a `onPageChange`.
 */
export function Pagination({
  meta,
  onPageChange,
  className,
  disabled = false,
  itemLabel = 'registros',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.floor(meta.totalPages) || 1)
  const currentPage = Math.min(Math.max(1, Math.floor(meta.page) || 1), totalPages)
  const total = Math.max(0, meta.total)
  const pageSize = Math.max(1, meta.pageSize)

  const firstRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastRecord = total === 0 ? 0 : Math.min(currentPage * pageSize, total)

  const isFirst = currentPage <= 1
  const isLast = currentPage >= totalPages
  const items = getPaginationItems(currentPage, totalPages)

  const goTo = (page: number) => {
    const target = Math.min(Math.max(1, page), totalPages)
    if (disabled || target === currentPage) return
    onPageChange(target)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-sm text-gray-600">
        Mostrando <span className="font-semibold text-gray-800">{firstRecord}</span> até{' '}
        <span className="font-semibold text-gray-800">{lastRecord}</span> de{' '}
        <span className="font-semibold text-gray-800">{total}</span> {itemLabel}
      </p>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Paginação">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            onClick={() => goTo(1)}
            disabled={disabled || isFirst}
            aria-label="Primeira página"
            title="Primeira página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            onClick={() => goTo(currentPage - 1)}
            disabled={disabled || isFirst}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="hidden items-center gap-1 sm:flex">
            {items.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="flex h-8 w-8 items-center justify-center text-sm text-gray-400"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === currentPage ? 'primary' : 'outline'}
                  size="sm"
                  className={navButtonClass(item === currentPage)}
                  onClick={() => goTo(item)}
                  disabled={disabled}
                  aria-label={`Página ${item}`}
                  aria-current={item === currentPage ? 'page' : undefined}
                >
                  {item}
                </Button>
              )
            )}
          </div>

          {/* Em telas pequenas os números somem: fica só "página X de Y". */}
          <span className="px-2 text-xs font-semibold text-gray-600 sm:hidden">
            {currentPage} / {totalPages}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            onClick={() => goTo(currentPage + 1)}
            disabled={disabled || isLast}
            aria-label="Próxima página"
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 px-0"
            onClick={() => goTo(totalPages)}
            disabled={disabled || isLast}
            aria-label="Última página"
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  )
}

export default Pagination
