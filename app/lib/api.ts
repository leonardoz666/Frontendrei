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
  return response.statusText || `Erro ${response.status}`
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

  const response = await fetch(url, init)

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

/**
 * Lista tolerante: aceita tanto array puro (contrato antigo) quanto
 * `{ data: [...] }` (contrato paginado novo). Ver `unwrapList`.
 */
export async function fetchList<T>(path: string, options: ApiRequestOptions = {}): Promise<T[]> {
  return unwrapList<T>(await apiFetch<unknown>(path, options))
}

export { unwrapList }
export { hasPaginationMeta } from './legacyArray'
