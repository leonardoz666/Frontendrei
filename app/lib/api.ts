import { unwrapList } from './legacyArray'

/**
 * Cliente HTTP do frontend.
 *
 * Regras (PRD 3.2 / 3.3):
 *  - todo caminho é RELATIVO e passa por `/api/*` (o rewrite do `next.config.js`
 *    encaminha para `NEXT_PUBLIC_API_URL`). Nunca hardcode host do backend.
 *  - `credentials: 'include'` sempre: a auth é JWT em cookie httpOnly.
 *  - erro sempre tipado: `ApiError` com `status` e mensagem do corpo.
 *  - 401 -> redireciona para `/login`.
 */

export const API_PREFIX = '/api'
export const LOGIN_PATH = '/login'

const TRANSIENT_GET_STATUSES = new Set([429, 502, 503, 504])
const TRANSIENT_GET_DELAYS_MS = [1000, 3000, 6000]
const AUTH_ME_CACHE_MS = 15_000

let authMeCache: { expiresAt: number; value: unknown } | null = null
let authMeInFlight: Promise<unknown> | null = null

export class ApiError extends Error {
  readonly status: number
  readonly details?: unknown
  /** Corpo bruto da resposta (JSON parseado quando possível, senão texto). */
  readonly body?: unknown

  constructor(status: number, message: string, options: { details?: unknown; body?: unknown } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = options.details
    this.body = options.body
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isNotFound(): boolean {
    return this.status === 404
  }
}

export type ApiRequestOptions = Omit<RequestInit, 'body' | 'credentials'> & {
  /** Objeto simples -> JSON.stringify + `Content-Type: application/json`. `FormData`/`Blob`/`string` passam direto. */
  body?: unknown
  /** Redireciona para `/login` em 401. Default: `true`. Desligue em telas públicas de auth. */
  redirectOn401?: boolean
  /** Em GET/HEAD, envia `cache: 'no-store'` (o cache de dados é do react-query). Default: `true`. */
  noStore?: boolean
}

/**
 * Normaliza o caminho para um caminho relativo começando em `/api/`.
 * Lança se receber URL absoluta — hardcodar host é proibido (AGENTS.md).
 */
export function toApiPath(path: string): string {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error('apiFetch: caminho vazio')
  }

  const trimmed = path.trim()

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    throw new Error(
      `apiFetch: URL absoluta não é permitida ("${trimmed}"). Use um caminho relativo a /api/*.`
    )
  }

  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  if (withSlash === API_PREFIX || withSlash.startsWith(`${API_PREFIX}/`)) {
    return withSlash
  }

  return `${API_PREFIX}${withSlash}`
}

/** Redireciona para o login (no-op no servidor e quando já estamos no login). */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return
  }
  // Não redireciona a partir da própria tela de login: isso apagaria a mensagem
  // de "credenciais inválidas" devolvida pelo POST /api/auth/login.
  if (window.location.pathname.startsWith(LOGIN_PATH)) {
    return
  }
  window.location.assign(LOGIN_PATH)
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined
  }
  let text = ''
  try {
    text = await response.text()
  } catch {
    return undefined
  }
  if (!text) {
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * Mensagem legível do erro. O contrato novo é `{ error: string }` (PRD 3.2); o
 * `errorHandler` atual do backend ainda responde `{ status, message }`, então
 * aceitamos os dois para não perder a mensagem real na migração.
 */
function extractMessage(body: unknown, response: Response): string {
  if (body !== null && typeof body === 'object') {
    const record = body as Record<string, unknown>
    for (const key of ['error', 'message', 'detail']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim() !== '') {
        return value
      }
    }
  }
  if (typeof body === 'string' && body.trim() !== '' && body.length <= 300) {
    return body.trim()
  }
  if (response.status === 429 || response.status === 503) {
    return 'Servidor temporariamente indisponível. Aguarde alguns segundos e tente novamente.'
  }
  return response.statusText || `Erro ${response.status}`
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter !== null) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000)
  }
  return TRANSIENT_GET_DELAYS_MS[attempt] ?? 0
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function extractDetails(body: unknown): unknown {
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    return (body as Record<string, unknown>).details
  }
  return undefined
}

function isBodyInitLike(body: unknown): boolean {
  if (typeof body === 'string') return true
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true
  return false
}

/**
 * Executa a requisição e devolve o `Response` cru.
 * Lança `ApiError` para qualquer status fora da faixa 2xx (e redireciona em 401).
 * Use quando precisar do corpo não-JSON (blob, stream); para JSON use `apiFetch`.
 */
export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const {
    body,
    redirectOn401 = true,
    noStore = true,
    headers,
    method = 'GET',
    cache,
    ...rest
  } = options

  const url = toApiPath(path)
  const upperMethod = method.toUpperCase()
  const finalHeaders = new Headers(headers)
  if (!finalHeaders.has('Accept')) {
    finalHeaders.set('Accept', 'application/json')
  }

  let payload: BodyInit | null = null
  if (body !== undefined && body !== null) {
    if (isBodyInitLike(body)) {
      payload = body as BodyInit
    } else {
      if (!finalHeaders.has('Content-Type')) {
        finalHeaders.set('Content-Type', 'application/json')
      }
      payload = JSON.stringify(body)
    }
  }

  const init: RequestInit = {
    ...rest,
    method: upperMethod,
    headers: finalHeaders,
    credentials: 'include',
    body: payload,
  }

  if (cache !== undefined) {
    init.cache = cache
  } else if (upperMethod === 'GET' || upperMethod === 'HEAD') {
    init.cache = noStore ? 'no-store' : 'default'
  }

  let response: Response
  for (let attempt = 0; ; attempt += 1) {
    response = await fetch(url, init)
    const canRetry =
      (upperMethod === 'GET' || upperMethod === 'HEAD') &&
      TRANSIENT_GET_STATUSES.has(response.status) &&
      attempt < TRANSIENT_GET_DELAYS_MS.length
    if (!canRetry) break
    await wait(retryDelay(response, attempt))
  }

  if (!response.ok) {
    const parsed = await readResponseBody(response)
    if (response.status === 401 && redirectOn401) {
      redirectToLogin()
    }
    throw new ApiError(response.status, extractMessage(parsed, response), {
      details: extractDetails(parsed),
      body: parsed,
    })
  }

  return response
}

/** Requisição com corpo JSON tipado. Corpo vazio (204) resolve como `undefined`. */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const apiPath = toApiPath(path)
  const isAuthMe = method === 'GET' && apiPath === '/api/auth/me'

  if (isAuthMe && authMeCache && authMeCache.expiresAt > Date.now()) {
    return authMeCache.value as T
  }
  if (isAuthMe && authMeInFlight) return authMeInFlight as Promise<T>

  const execute = async (): Promise<T> => {
    const response = await apiRequest(path, options)

    if (response.status === 204 || response.status === 205) {
      return undefined as T
    }

    const text = await response.text()
    if (!text) {
      return undefined as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  if (!isAuthMe) {
    const result = await execute()
    if (apiPath === '/api/auth/login' && method === 'POST') {
      authMeCache = { expiresAt: Date.now() + AUTH_ME_CACHE_MS, value: result }
    } else if (apiPath === '/api/auth/logout' && method === 'POST') {
      authMeCache = null
    }
    return result
  }

  authMeInFlight = execute()
    .then(result => {
      authMeCache = { expiresAt: Date.now() + AUTH_ME_CACHE_MS, value: result }
      return result
    })
    .finally(() => {
      authMeInFlight = null
    })
  return authMeInFlight as Promise<T>
}

export function invalidateAuthMeCache(): void {
  authMeCache = null
  authMeInFlight = null
}

/**
 * Lista tolerante: aceita tanto array puro (contrato antigo) quanto
 * `{ data: [...] }` (contrato paginado novo). Ver `unwrapList`.
 */
export async function fetchList<T>(path: string, options: ApiRequestOptions = {}): Promise<T[]> {
  return unwrapList<T>(await apiFetch<unknown>(path, options))
}

/** Busca todas as páginas de uma lista que precisa alimentar um seletor ou catálogo. */
export async function fetchAllList<T>(path: string, options: ApiRequestOptions = {}): Promise<T[]> {
  const url = new URL(path, 'http://local')
  url.searchParams.delete('page')
  url.searchParams.set('pageSize', '100')

  const all: T[] = []
  for (let page = 1; page <= 100; page += 1) {
    url.searchParams.set('page', String(page))
    const payload = await apiFetch<unknown>(`${url.pathname}${url.search}`, options)
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Resposta paginada inválida')
    }
    const { data, meta } = payload as { data?: unknown; meta?: { total?: unknown; totalPages?: unknown } }
    if (!Array.isArray(data) || !Number.isInteger(meta?.total) || !Number.isInteger(meta?.totalPages)) {
      throw new Error('Resposta paginada inválida')
    }
    all.push(...data as T[])
    if (page >= Number(meta?.totalPages)) return all
  }

  throw new Error('A listagem excedeu o limite de 10.000 itens')
}

export { unwrapList }
export { hasPaginationMeta } from './legacyArray'
