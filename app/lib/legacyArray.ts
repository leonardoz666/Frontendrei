/**
 * Ponte de compatibilidade entre o contrato de lista ANTIGO (array puro) e o
 * contrato paginado NOVO do PRD seção 3.2 (`{ data: [...], meta: {...} }`).
 *
 * Motivo: as rotas `GET /api/categories` e `GET /api/products` estão migrando
 * para o contrato paginado, mas telas de produção ainda fazem `.map()` sobre a
 * resposta assumindo array puro. `unwrapList` aceita os dois formatos e devolve
 * sempre um array, então a troca de contrato no backend não derruba nenhuma tela
 * e as telas podem ser migradas uma a uma.
 *
 * Formatos aceitos:
 *   - `T[]`            -> devolve o próprio array
 *   - `{ data: T[] }`  -> devolve `data`
 *   - qualquer outra coisa (`{ data: null }`, `null`, `undefined`, `{}`, string,
 *     número, objeto de erro) -> devolve `[]`
 *
 * Nunca lança: é camada de tolerância, não de validação.
 */
export function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (payload !== null && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data
    if (Array.isArray(data)) {
      return data as T[]
    }
  }

  return []
}

/**
 * `true` quando o payload do servidor veio embrulhado no contrato novo
 * (`{ data, meta }`). Útil para decidir se há meta de paginação para exibir.
 */
export function hasPaginationMeta(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return false
  }
  const meta = (payload as { meta?: unknown }).meta
  return meta !== null && typeof meta === 'object'
}
