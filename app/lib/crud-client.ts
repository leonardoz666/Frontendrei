'use client'

import { createElement, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from './api'
import type { Paginated, SortOrder } from './pagination'
import { useToast } from '@/contexts/ToastContext'

/**
 * Helper de CRUD para as telas de cadastro auxiliar (PRD seção 7 / Fase 1-C).
 *
 * Motivação: as 6 telas (`contas-bancarias`, `centros-custo`, `plano-contas`,
 * `fornecedores`, `estoques`, `formas-pagamento`) expõem EXATAMENTE o mesmo
 * contrato de escrita — POST no recurso, PUT em `/:id`, PATCH em `/:id/ativo`,
 * DELETE em `/:id` — e o mesmo tratamento de 401 + toast de erro. Sem o helper
 * seriam ~40 linhas clonadas por arquivo, e a próxima mudança de contrato
 * (ex.: `PATCH` virar `PUT /:id/ativo`) exigiria 6 edições sincronizadas.
 *
 * O que o helper NÃO faz de propósito:
 *  - não conhece os campos de nenhuma entidade (cada tela monta o `body`);
 *  - não guarda o estado do formulário (cada tela decide quando abrir/fechar);
 *  - não invalida a lista — quem chama refaz o fetch, porque só a tela sabe se
 *    precisa recuar de página (apagou o último item da página) ou só recarregar.
 */

/** Registro mínimo esperado: toda entidade destas rotas tem `id` inteiro. */
export interface RegistroCrud {
  id: number
}

export interface UseCrudOptions {
  /**
   * Recurso da API: `'centros-custo'` ou `'/centros-custo'`. O caminho é
   * normalizado por `apiFetch` (sempre relativo a `/api/*`).
   */
  resource: string
  /** Nome do recurso em português, para as mensagens: "Centro de custo criado". */
  entidade: string
  /** Gênero do nome, só para concordância das mensagens. */
  genero?: 'm' | 'f'
}

export interface UseCrudResult<T extends RegistroCrud> {
  /** POST `/{resource}`. `null` = falhou (o toast de erro já foi exibido). */
  criar: (dados: Record<string, unknown>) => Promise<T | null>
  /** PUT `/{resource}/{id}`. `null` = falhou. */
  atualizar: (id: number, dados: Record<string, unknown>) => Promise<T | null>
  /**
   * PATCH `/{resource}/{id}/ativo`. Sem `ativo` explícito o backend ALTERNA o
   * valor atual; passe `ativo` para forçar um estado.
   */
  alternarAtivo: (id: number, ativo?: boolean) => Promise<T | null>
  /** DELETE `/{resource}/{id}` — no backend é soft delete (`ativo = false`). */
  excluir: (id: number) => Promise<T | null>
  /**
   * Executa qualquer chamada com o mesmo tratamento de erro (401 -> `/login`,
   * resto -> toast de erro). Existe para o que o contrato padrão não cobre,
   * como carregar a lista auxiliar do select de pai do plano de contas.
   */
  executar: <R>(fn: () => Promise<R>, mensagemErro: string) => Promise<R | null>
  /** Mensagem de sucesso do recurso: "Conta bancária criada", "atualizada"… */
  mensagem: (acao: 'criado' | 'atualizado' | 'excluido') => string
}

/** Estados da listagem paginada, com os resets que o `DataTable` exige. */
export interface UseListaCrudResult {
  page: number
  pageSize: number
  search: string
  sort: string | null
  order: SortOrder | null
  /** Estado pronto para o `usePagedQuery` da tela (spread no objeto de opções). */
  listaParams: {
    resource: string
    page: number
    pageSize: number
    search: string
    sort: string | null
    order: SortOrder | null
  }
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  /** Busca do servidor: muda o termo e volta para a página 1. */
  definirBusca: (texto: string) => void
  /** Ordenação do servidor: muda o par sort/order e volta para a página 1. */
  definirOrdenacao: (sort: string | null, order: SortOrder | null) => void
  /** Volta para a página 1 (usado após criar/atualizar). */
  reiniciarPagina: () => void
  /**
   * Reage à exclusão: se a página ficou vazia por ter apagado a única linha e
   * não é a primeira, recua uma página; senão pede `refetch()`.
   *
   * Devolve `true` quando a tela deve recarregar a lista.
   */
  aposExcluir: (registrosNaPagina: number) => boolean
}

const PAGE_SIZE_INICIAL = 25

/**
 * Hook de escrita do CRUD. `resource`/`entidade` vêm da constante do módulo da
 * tela, então as funções devolvidas são estáveis — não há estado interno.
 */
export function useCrud<T extends RegistroCrud>(options: UseCrudOptions): UseCrudResult<T> {
  const { resource, entidade, genero = 'm' } = options
  const router = useRouter()
  const { showToast } = useToast()

  const mensagem = useCallback(
    (acao: 'criado' | 'atualizado' | 'excluido'): string => {
      const feminino = genero === 'f'
      if (acao === 'criado') return `${entidade} ${feminino ? 'criada' : 'criado'}`
      if (acao === 'atualizado') return `${entidade} ${feminino ? 'atualizada' : 'atualizado'}`
      return `${entidade} ${feminino ? 'excluída' : 'excluído'}`
    },
    [entidade, genero]
  )

  /**
   * Tratamento único de erro. O status é lido por FORMA (`status === 401`) para
   * não acoplar o helper a um `instanceof ApiError` — mesma decisão da tela de
   * referência `admin/categorias`. O `apiFetch` já redireciona em 401; o
   * `router.push` aqui cobre quem chamar com `redirectOn401: false`.
   */
  const executar = useCallback(
    async <R,>(fn: () => Promise<R>, mensagemErro: string): Promise<R | null> => {
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

  const criar = useCallback(
    (dados: Record<string, unknown>) =>
      executar<T>(
        () => apiFetch<T>(resource, { method: 'POST', body: dados }),
        `Erro ao criar ${entidade.toLowerCase()}`
      ),
    [executar, resource, entidade]
  )

  const atualizar = useCallback(
    (id: number, dados: Record<string, unknown>) =>
      executar<T>(
        () => apiFetch<T>(`${resource}/${id}`, { method: 'PUT', body: dados }),
        `Erro ao salvar ${entidade.toLowerCase()}`
      ),
    [executar, resource, entidade]
  )

  const alternarAtivo = useCallback(
    (id: number, ativo?: boolean) =>
      executar<T>(
        () =>
          apiFetch<T>(`${resource}/${id}/ativo`, {
            method: 'PATCH',
            body: ativo === undefined ? {} : { ativo },
          }),
        `Erro ao alterar a situação d${genero === 'f' ? 'a' : 'o'} ${entidade.toLowerCase()}`
      ),
    [executar, resource, entidade, genero]
  )

  const excluir = useCallback(
    (id: number) =>
      executar<T>(
        () => apiFetch<T>(`${resource}/${id}`, { method: 'DELETE' }),
        `Erro ao excluir ${entidade.toLowerCase()}`
      ),
    [executar, resource, entidade]
  )

  return { criar, atualizar, alternarAtivo, excluir, executar, mensagem }
}

/**
 * Estado da listagem paginada no padrão RF-UI-01 (servidor): página, tamanho,
 * busca, ordenação — mais os resets obrigatórios (busca/ordenação sempre voltam
 * para a página 1) e o recuo de página após exclusão.
 */
export function useListaCrud(resource: string): UseListaCrudResult {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState<number>(PAGE_SIZE_INICIAL)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<string | null>(null)
  const [order, setOrder] = useState<SortOrder | null>(null)

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPage(1)
  }, [])

  const definirBusca = useCallback((texto: string) => {
    setSearch(texto)
    setPage(1)
  }, [])

  const definirOrdenacao = useCallback((campo: string | null, direcao: SortOrder | null) => {
    setSort(campo)
    setOrder(direcao)
    setPage(1)
  }, [])

  const reiniciarPagina = useCallback(() => setPage(1), [])

  const aposExcluir = useCallback(
    (registrosNaPagina: number): boolean => {
      // Apagar a última linha de uma página > 1 deixaria o usuário numa página vazia.
      if (registrosNaPagina === 1 && page > 1) {
        setPage((atual) => atual - 1)
        return false
      }
      return true
    },
    [page]
  )

  return {
    page,
    pageSize,
    search,
    sort,
    order,
    listaParams: { resource, page, pageSize, search, sort, order },
    setPage,
    setPageSize,
    definirBusca,
    definirOrdenacao,
    reiniciarPagina,
    aposExcluir,
  }
}

/**
 * Extrai `{ data, meta }` de um `usePagedQuery` já resolvido.
 *
 * A entrada é `{ data }` (e não o resultado do hook inteiro) porque
 * `UseQueryResult` é uma união discriminada: desestruturar `data` na tela e
 * repassar aqui mantém a inferência de `T` e evita um cast.
 */
export function paginaAtual<T>(
  resultado: { data?: Paginated<T> } | undefined,
  page: number,
  pageSize: number
): Paginated<T> {
  return resultado?.data ?? { data: [], meta: { page, pageSize, total: 0, totalPages: 0 } }
}

/**
 * Selo ativo/inativo usado pelas listagens.
 *
 * Existe aqui, e não em cada página, porque as 6 telas precisam dele e um
 * `page.tsx` do App Router não pode exportar componente auxiliar (o Next exige
 * que os exports de uma página sejam `default` + metadados).
 *
 * Sem JSX de propósito: este arquivo é `.ts` (nome fixado pelo escopo da tarefa
 * Fase 1-C), e JSX só é válido em `.tsx`. `createElement` produz exatamente o
 * mesmo elemento com tipagem completa.
 */
export function SeloAtivo({ ativo }: { ativo: boolean }) {
  return createElement(
    'span',
    {
      className: `rounded px-2 py-1 text-xs font-semibold ${
        ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`,
    },
    ativo ? 'Ativo' : 'Inativo'
  )
}

/**
 * Converte campo numérico da API (o backend serializa `Decimal` como `number`,
 * mas aceitamos `string` por segurança) em `number` para exibição.
 */
export function comoNumero(valor: unknown, fallback = 0): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim() !== '') {
    const convertido = Number(valor.replace(',', '.'))
    return Number.isFinite(convertido) ? convertido : fallback
  }
  return fallback
}

/**
 * Aceita o decimal do operador: vírgula ou ponto, sem separador de milhar.
 * Devolve `null` para texto inválido e `NaN` nunca escapa daqui.
 */
export function comoDecimalDigitado(texto: string): number | null {
  const limpo = texto.trim()
  if (limpo === '') return null
  const convertido = Number(limpo.replace(',', '.'))
  return Number.isFinite(convertido) ? convertido : null
}

/** Formata moeda em pt-BR a partir de `number | string` (Decimal serializado). */
export function formatarMoeda(valor: unknown): string {
  return comoNumero(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata percentual com até 2 casas: `2.5` -> "2,50%". */
export function formatarPercentual(valor: unknown): string {
  return `${comoNumero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}
