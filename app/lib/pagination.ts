'use client'

import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiFetch } from './api'

/**
 * Tipos e hook do contrato de lista paginada do PRD 3.2:
 *
 * GET /products?page=1&pageSize=25&search=pirao&sort=nome&order=asc
 * 200 { "data": [...], "meta": { "page":1, "pageSize":25, "total":312, "totalPages":13 } }
 */

/** `pageSize` aceita apenas 10 / 25 / 50 / 100; fora disso o backend cai no default. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]
export const DEFAULT_PAGE_SIZE: PageSize = 25

export const SEARCH_DEBOUNCE_MS = 300

export type SortOrder = 'asc' | 'desc'

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface ListQueryParams {
  page?: number | string | null
  pageSize?: number | string | null
  search?: string | null
  sort?: string | null
  order?: SortOrder | null
}

/** Normaliza `pageSize` para um dos valores do contrato (default 25). */
export function normalizePageSize(value: unknown): PageSize {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as PageSize)
    : DEFAULT_PAGE_SIZE
}

/** Normaliza `page` para inteiro >= 1. */
export function normalizePage(value: unknown): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN

  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

/**
 * Monta a query string do contrato. Omite `search`/`sort`/`order` quando vazios
 * (o backend aplica o default de cada um).
 */
export function buildListQuery(params: ListQueryParams = {}): string {
  const query = new URLSearchParams()
  query.set('page', String(normalizePage(params.page)))
  query.set('pageSize', String(normalizePageSize(params.pageSize)))

  const search = params.search?.trim()
  if (search) {
    query.set('search', search)
  }

  const sort = params.sort?.trim()
  if (sort) {
    query.set('sort', sort)
  }

  if (params.order === 'asc' || params.order === 'desc') {
    query.set('order', params.order)
  }

  return `?${query.toString()}`
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/**
 * Tolerante aos dois contratos, pela mesma razão de `unwrapList`: se a rota
 * ainda devolver array puro, sintetizamos um `meta` coerente em vez de quebrar.
 */
export function toPaginated<T>(
  payload: unknown,
  fallback: { page?: unknown; pageSize?: unknown } = {}
): Paginated<T> {
  const fallbackPage = normalizePage(fallback.page)
  const fallbackPageSize = normalizePageSize(fallback.pageSize)

  if (Array.isArray(payload)) {
    const data = payload as T[]
    return {
      data,
      meta: {
        page: fallbackPage,
        pageSize: fallbackPageSize,
        total: data.length,
        totalPages: data.length > 0 ? 1 : 0,
      },
    }
  }

  if (payload !== null && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const data = Array.isArray(record.data) ? (record.data as T[]) : []
    const rawMeta =
      record.meta !== null && typeof record.meta === 'object' && !Array.isArray(record.meta)
        ? (record.meta as Record<string, unknown>)
        : {}

    const page = normalizePage(toFiniteNumberOrNull(rawMeta.page) ?? fallbackPage)
    const pageSize = normalizePageSize(toFiniteNumberOrNull(rawMeta.pageSize) ?? fallbackPageSize)
    const total = toFiniteNumberOrNull(rawMeta.total) ?? data.length
    const totalPages =
      toFiniteNumberOrNull(rawMeta.totalPages) ??
      (total > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 0)

    return { data, meta: { page, pageSize, total, totalPages } }
  }

  return {
    data: [],
    meta: { page: fallbackPage, pageSize: fallbackPageSize, total: 0, totalPages: 0 },
  }
}

/** Debounce genérico (usado pela busca — RF-UI-01.3). */
export function useDebouncedValue<T>(value: T, delay: number = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export interface UsePagedQueryOptions<T> {
  /**
   * Recurso da API: `'products'`, `'/products'` ou `'/api/products'`.
   * O caminho é normalizado por `apiFetch` (sempre relativo a `/api/*`).
   */
  resource: string
  page?: number | string | null
  pageSize?: number | string | null
  /** Texto de busca; sofre debounce de 300ms antes de virar requisição. */
  search?: string | null
  sort?: string | null
  order?: SortOrder | null
  enabled?: boolean
  staleTime?: number
  /** Chave customizada do react-query (default: derivada de resource + params). */
  queryKey?: readonly unknown[]
  select?: (data: Paginated<T>) => Paginated<T>
}

/**
 * Hook único de listagem paginada: monta a URL, faz debounce da busca e devolve
 * o resultado SEMPRE no formato `{ data, meta }`.
 *
 * Mantém os dados da página anterior durante o fetch seguinte
 * (`placeholderData: keepPreviousData`) para a tabela não piscar vazia.
 */
export function usePagedQuery<T>(
  options: UsePagedQueryOptions<T>
): UseQueryResult<Paginated<T>, Error> {
  const {
    resource,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    search = '',
    sort = null,
    order = null,
    enabled = true,
    staleTime,
    queryKey,
    select,
  } = options

  const debouncedSearch = useDebouncedValue(search ?? '', SEARCH_DEBOUNCE_MS)
  const normalizedPage = normalizePage(page)
  const normalizedPageSize = normalizePageSize(pageSize)
  const normalizedSort = sort?.trim() ? sort.trim() : null

  const queryString = buildListQuery({
    page: normalizedPage,
    pageSize: normalizedPageSize,
    search: debouncedSearch,
    sort: normalizedSort,
    order,
  })
  const url = `${resource}${resource.includes('?') ? `&${queryString.slice(1)}` : queryString}`

  const resolvedKey = queryKey ?? [
    resource,
    {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      search: debouncedSearch,
      sort: normalizedSort,
      order: order ?? null,
    },
  ]

  return useQuery<Paginated<T>, Error>({
    queryKey: resolvedKey,
    queryFn: async () =>
      toPaginated<T>(await apiFetch<unknown>(url), {
        page: normalizedPage,
        pageSize: normalizedPageSize,
      }),
    enabled,
    placeholderData: keepPreviousData,
    ...(staleTime !== undefined ? { staleTime } : {}),
    ...(select !== undefined ? { select } : {}),
  })
}
