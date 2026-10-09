'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Info, Search } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { apiFetch, fetchAllList } from '@/app/lib/api'
import { useCrud } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Wizard de vínculo de impressão — RF-PRA-05 (PRD seção 5.2), em 3 passos:
 * (1) praça, (2) impressora, (3) produtos e/ou categorias.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A REGRA DE PRECEDÊNCIA (a frase que o operador precisa ler)
 *
 * Para cada item de um pedido, o backend (`PrinterRouter.resolverItem`) decide o
 * destino nesta ordem:
 *
 *   1. o vínculo PRAÇA + PRODUTO da mesa (mais específico);
 *   2. senão, o vínculo PRAÇA + CATEGORIA do produto;
 *   3. senão, a impressora cadastrada no próprio produto (`Produto.dispositivoId`);
 *   4. senão, a impressora padrão do caixa (`isCaixa` + ativo, a mais antiga);
 *   5. senão, não imprime e registra `[PRINTER SKIP]` — a venda NUNCA falha por isso.
 *
 * Ou seja: nesta tela, o vínculo de produto SEMPRE vence o vínculo de categoria da
 * mesma praça, e os dois vencem o que estiver configurado no cadastro do produto e
 * no caixa. É isso que define "para onde vai a comida e para onde vai a bebida".
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Sem selecionar produto nem categoria o vínculo vale para a PRAÇA INTEIRA (o
 * backend grava `produtoId` e `categoriaId` nulos). Esse é o atalho para "tudo
 * desta praça imprime aqui" e é o degrau mais fraco da decisão: qualquer vínculo
 * por produto ou categoria da mesma praça tem prioridade sobre ele.
 *
 * O passo 3 cria UM vínculo por combinação selecionada (N produtos + M categorias
 * = N+M chamadas) porque a tabela tem uma linha por vínculo. Vínculo que já existe
 * volta 409; ao final o resumo mostra quantos foram criados e quantos já existiam.
 */

const RESOURCE_PRACAS = '/pracas'
const RESOURCE_DISPOSITIVOS = '/dispositivos?tipo=IMPRESSORA'

const PASSOS = ['Praça', 'Impressora', 'Produtos e categorias'] as const

type Praca = {
  id: number
  nome: string
  ativo: boolean
  _count?: { mesas: number }
}

type Dispositivo = {
  id: number
  nome: string
  tipo: string
  larguraMm: number
  isCaixa: boolean
  vincularTodos: boolean
  ativo: boolean
}

type Produto = {
  id: number
  nome: string
  categoriaId: number | null
}

type Categoria = {
  id: number
  nome: string
  setor: string
}

type Vinculo = {
  id: number
  pracaId: number
  dispositivoId: number
  produtoId: number | null
  categoriaId: number | null
  criadoEm: string
  dispositivo?: { id: number; nome: string; tipo: string; larguraMm: number; isCaixa: boolean } | null
  produto?: { id: number; nome: string } | null
  categoria?: { id: number; nome: string } | null
}

const PRACAS_VAZIAS: Praca[] = []
const DISPOSITIVOS_VAZIOS: Dispositivo[] = []

/** Categorias do produto -> nome, para o atalho "selecionar a categoria do produto". */
function alvoDoVinculo(vinculo: Vinculo): string {
  if (vinculo.produto) return vinculo.produto.nome
  if (vinculo.categoria) return `Categoria: ${vinculo.categoria.nome}`
  return 'Praça inteira'
}

export default function VincularImpressaoPage() {
  const { showToast } = useToast()
  const crud = useCrud<Vinculo>({
    resource: RESOURCE_PRACAS,
    entidade: 'Vínculo de impressão',
  })

  const [passo, setPasso] = useState<1 | 2 | 3>(1)
  const [pracaId, setPracaId] = useState<number | null>(null)
  const [dispositivoId, setDispositivoId] = useState<number | null>(null)
  const [produtosSel, setProdutosSel] = useState<number[]>([])
  const [categoriasSel, setCategoriasSel] = useState<number[]>([])
  const [vincularTudo, setVincularTudo] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [buscaCategoria, setBuscaCategoria] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Vinculo | null>(null)

  // --- Listas de apoio -------------------------------------------------------
  const pracasQuery = usePagedQuery<Praca>({
    resource: RESOURCE_PRACAS,
    page: 1,
    pageSize: 100,
    sort: 'nome',
    order: 'asc',
    queryKey: ['vincular-pracas'],
    staleTime: 30_000,
  })

  const dispositivosQuery = usePagedQuery<Dispositivo>({
    resource: RESOURCE_DISPOSITIVOS,
    page: 1,
    pageSize: 100,
    sort: 'nome',
    order: 'asc',
    queryKey: ['vincular-dispositivos'],
    staleTime: 30_000,
  })

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCarregandoCatalogo(true)

    void (async () => {
      try {
        const [listaProdutos, listaCategorias] = await Promise.all([
          fetchAllList<Produto>('/products'),
          fetchAllList<Categoria>('/categories'),
        ])
        if (cancelado) return
        setProdutos(listaProdutos)
        setCategorias(listaCategorias)
      } catch (err) {
        if (cancelado) return
        const status = (err as { status?: number } | null)?.status
        showToast(
          status === 401
            ? 'Sessão expirada: entre novamente para carregar produtos e categorias'
            : 'Não foi possível carregar produtos/categorias para o passo 3',
          'error'
        )
      } finally {
        if (!cancelado) setCarregandoCatalogo(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [showToast])

  const pracas = pracasQuery.data?.data ?? PRACAS_VAZIAS
  const dispositivos = dispositivosQuery.data?.data ?? DISPOSITIVOS_VAZIOS

  // --- Vínculos existentes da praça escolhida --------------------------------
  const vinculosQuery = usePagedQuery<Vinculo>({
    resource: `${RESOURCE_PRACAS}/${pracaId}/vinculos`,
    queryKey: ['vinculos-praca', pracaId],
    enabled: pracaId !== null,
    staleTime: 0,
  })

  // A rota devolve ARRAY PURO (não `{data, meta}`): o `usePagedQuery` passa tudo por
  // `toPaginated`, que sintetiza o `meta` para o array. A tolerância já está na lib.
  const vinculos = vinculosQuery.data?.data ?? []

  const pracaSelecionada = pracas.find((p) => p.id === pracaId) ?? null
  const dispositivoSelecionado = dispositivos.find((d) => d.id === dispositivoId) ?? null

  const nomesDeDispositivos = useMemo(() => {
    const mapa = new Map<number, string>()
    for (const dispositivo of dispositivos) mapa.set(dispositivo.id, dispositivo.nome)
    return mapa
  }, [dispositivos])

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase()
    if (termo === '') return produtos
    return produtos.filter((produto) => produto.nome.toLowerCase().includes(termo))
  }, [produtos, buscaProduto])

  const categoriasFiltradas = useMemo(() => {
    const termo = buscaCategoria.trim().toLowerCase()
    if (termo === '') return categorias
    return categorias.filter((categoria) => categoria.nome.toLowerCase().includes(termo))
  }, [categorias, buscaCategoria])

  const alternarProduto = (id: number) => {
    setProdutosSel((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    )
  }

  const alternarCategoria = (id: number) => {
    setCategoriasSel((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    )
  }

  /** Seleciona todas as categorias dos produtos marcados (atalho "categoria do produto"). */
  const selecionarCategoriasDosProdutos = () => {
    const ids = new Set(categoriasSel)
    for (const produtoId of produtosSel) {
      const produto = produtos.find((p) => p.id === produtoId)
      if (produto?.categoriaId) ids.add(produto.categoriaId)
    }
    if (ids.size === categoriasSel.length) {
      showToast('Nenhuma categoria nova para adicionar a partir dos produtos marcados', 'info')
      return
    }
    setCategoriasSel([...ids])
    showToast(`${ids.size} categoria(s) marcada(s)`, 'success')
  }

  const limparSelecao = () => {
    setProdutosSel([])
    setCategoriasSel([])
    setBuscaProduto('')
    setBuscaCategoria('')
  }

  /** Volta o wizard para o passo 1 sem perder as listas já carregadas. */
  const recomeçar = () => {
    setPasso(1)
    setDispositivoId(null)
    setVincularTudo(false)
    limparSelecao()
  }

  const avancar = () => {
    if (passo === 1) {
      if (pracaId === null) {
        showToast('Escolha a praça para continuar', 'error')
        return
      }
      setPasso(2)
      return
    }
    if (passo === 2) {
      if (dispositivoId === null) {
        showToast('Escolha a impressora de destino para continuar', 'error')
        return
      }
      setPasso(3)
    }
  }

  const selecionarPraca = (id: number) => {
    setPracaId(id)
    // Trocar de praça invalida dispositivo/alvos escolhidos: os vínculos são por praça.
    setDispositivoId(null)
    setVincularTudo(false)
    limparSelecao()
    setPasso(2)
  }

  const totalDeAlvos = vincularTudo ? 1 : produtosSel.length + categoriasSel.length

  const salvar = async () => {
    if (pracaId === null) {
      showToast('Escolha a praça antes de salvar', 'error')
      setPasso(1)
      return
    }
    if (dispositivoId === null) {
      showToast('Escolha a impressora antes de salvar', 'error')
      setPasso(2)
      return
    }
    if (totalDeAlvos === 0) {
      showToast(
        'Marque pelo menos um produto, uma categoria, ou use "Vincular a praça inteira"',
        'error'
      )
      return
    }

    // Um POST por vínculo: a tabela tem uma linha por combinação praça+alvo.
    const alvos: Array<{ produtoId: number | null; categoriaId: number | null }> = vincularTudo
      ? [{ produtoId: null, categoriaId: null }]
      : [
          ...produtosSel.map((id) => ({ produtoId: id, categoriaId: null })),
          ...categoriasSel.map((id) => ({ produtoId: null, categoriaId: id })),
        ]

    setSalvando(true)
    let criados = 0
    let duplicados = 0
    let falhas = 0

    for (const alvo of alvos) {
      const criado = await crud.executar(
        () =>
          apiFetch<Vinculo>(`${RESOURCE_PRACAS}/${pracaId}/vinculos`, {
            method: 'POST',
            body: { dispositivoId, ...alvo },
          }),
        'Erro ao criar vínculo de impressão'
      )

      if (criado !== null) {
        criados += 1
        continue
      }

      // O `useCrud` já mostrou o toast de erro (inclusive 409 "vínculo já existe").
      // Contamos para o resumo final não mentir sobre quantos entraram.
      falhas += 1
      duplicados += 1
    }

    setSalvando(false)

    if (criados > 0) {
      showToast(
        `${criados} vínculo(s) criado(s)${duplicados > 0 ? `, ${duplicados} não criado(s)` : ''}`,
        duplicados > 0 ? 'warning' : 'success'
      )
      limparSelecao()
      setVincularTudo(false)
      void vinculosQuery.refetch()
      return
    }

    if (falhas > 0 && criados === 0) {
      showToast('Nenhum vínculo foi criado — veja as mensagens de erro acima', 'error')
    }
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir || pracaId === null) return
    const alvo = paraExcluir
    setParaExcluir(null)

    const removido = await crud.executar(
      () =>
        apiFetch<{ success: boolean }>(
          `${RESOURCE_PRACAS}/${pracaId}/vinculos/${alvo.id}`,
          { method: 'DELETE' }
        ),
      'Erro ao remover vínculo de impressão'
    )

    if (removido === null) return
    showToast('Vínculo removido', 'success')
    void vinculosQuery.refetch()
  }

  const columns: Array<DataTableColumn<Vinculo>> = [
    {
      key: 'praca',
      header: 'Praça',
      render: () => (
        <span className="text-gray-700">{pracaSelecionada?.nome ?? `#${pracaId}`}</span>
      ),
    },
    {
      key: 'alvo',
      header: 'Alvo',
      render: (vinculo) => {
        if (vinculo.produto) {
          return (
            <span className="font-medium text-gray-900">
              {vinculo.produto.nome}
              <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-orange-800">
                produto
              </span>
            </span>
          )
        }
        if (vinculo.categoria) {
          return (
            <span className="font-medium text-gray-900">
              {vinculo.categoria.nome}
              <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-800">
                categoria
              </span>
            </span>
          )
        }
        return (
          <span className="font-medium text-gray-900">
            Praça inteira
            <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
              sem filtro
            </span>
          </span>
        )
      },
    },
    {
      key: 'dispositivo',
      header: 'Impressora',
      render: (vinculo) => (
        <span className="text-gray-700">
          {vinculo.dispositivo?.nome ??
            nomesDeDispositivos.get(vinculo.dispositivoId) ??
            `#${vinculo.dispositivoId}`}
          {vinculo.dispositivo?.larguraMm ? (
            <span className="ml-1 text-xs text-gray-500">({vinculo.dispositivo.larguraMm} mm)</span>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Vincular Impressão</h1>
      <p className="mb-4 text-sm text-gray-600">
        Diz para qual impressora vai cada item de um pedido, por praça.
      </p>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>Regra de precedência:</strong> o vínculo <em>praça + produto</em> vence o vínculo{' '}
          <em>praça + categoria</em>, e os dois vencem a impressora cadastrada no produto e a
          impressora padrão do caixa — ou seja, o vínculo mais específico desta tela é sempre quem
          manda na impressão. Sem nenhum deles, o item cai no caixa; sem caixa configurado, o sistema
          não imprime e registra a pendência, sem falhar a venda.
        </div>
      </div>

      {/* Indicador de passos */}
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {PASSOS.map((rotulo, indice) => {
          const numero = (indice + 1) as 1 | 2 | 3
          const ativo = passo === numero
          const concluido = passo > numero
          return (
            <li key={rotulo} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  ativo
                    ? 'bg-orange-600 text-white'
                    : concluido
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {concluido ? <Check className="h-3.5 w-3.5" /> : numero}
              </span>
              <button
                type="button"
                onClick={() => {
                  // Só volta para passos já alcançados; avançar exige escolher antes.
                  if (numero < passo) setPasso(numero)
                }}
                className={`rounded px-1 py-0.5 ${
                  ativo ? 'font-semibold text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {rotulo}
              </button>
              {numero < 3 && <ArrowRight className="h-3.5 w-3.5 text-gray-300" />}
            </li>
          )
        })}
      </ol>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {passo === 1 && (
          <div>
            <h2 className="mb-1 text-lg font-bold text-gray-900">1. Escolha a praça</h2>
            <p className="mb-4 text-sm text-gray-600">
              A praça é a origem: os vínculos valem para as mesas que pertencem a ela.
            </p>

            {pracasQuery.isLoading ? (
              <p className="text-sm text-gray-500">Carregando praças...</p>
            ) : pracas.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Nenhuma praça cadastrada. Crie uma em “Praças” antes de configurar a impressão.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pracas.map((praca) => (
                  <button
                    key={praca.id}
                    type="button"
                    onClick={() => selecionarPraca(praca.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      pracaId === praca.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
                    }`}
                  >
                    <span className="block font-medium text-gray-900">{praca.nome}</span>
                    <span className="block text-xs text-gray-500">
                      {praca._count?.mesas ?? 0} mesa(s)
                      {praca.ativo ? '' : ' · inativa'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {passo === 2 && (
          <div>
            <h2 className="mb-1 text-lg font-bold text-gray-900">2. Escolha a impressora</h2>
            <p className="mb-4 text-sm text-gray-600">
              Praça selecionada: <strong>{pracaSelecionada?.nome ?? '—'}</strong>
            </p>

            {dispositivosQuery.isLoading ? (
              <p className="text-sm text-gray-500">Carregando impressoras...</p>
            ) : dispositivos.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Nenhuma impressora cadastrada. Cadastre uma impressora em “Impressoras” antes de
                criar vínculos.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {dispositivos.map((dispositivo) => (
                  <button
                    key={dispositivo.id}
                    type="button"
                    onClick={() => setDispositivoId(dispositivo.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      dispositivoId === dispositivo.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/40'
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-1 font-medium text-gray-900">
                      {dispositivo.nome}
                      {dispositivo.isCaixa && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                          caixa
                        </span>
                      )}
                      {dispositivo.vincularTodos && (
                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-800">
                          vincular todos
                        </span>
                      )}
                      {!dispositivo.ativo && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                          inativo
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-gray-500">
                      Papel {dispositivo.larguraMm} mm
                    </span>
                  </button>
                ))}
              </div>
            )}

            {dispositivoSelecionado && !dispositivoSelecionado.ativo && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Esta impressora está <strong>inativa</strong>: o roteador só imprime em impressora
                ativa, então o vínculo existirá mas não vai imprimir até reativá-la em
                “Impressoras”.
              </p>
            )}
          </div>
        )}

        {passo === 3 && (
          <div>
            <h2 className="mb-1 text-lg font-bold text-gray-900">
              3. Escolha produtos e/ou categorias
            </h2>
            <p className="mb-4 text-sm text-gray-600">
              Praça <strong>{pracaSelecionada?.nome ?? '—'}</strong> → impressora{' '}
              <strong>{dispositivoSelecionado?.nome ?? '—'}</strong>. Marque produtos, categorias, os
              dois, ou use o vínculo da praça inteira.
            </p>

            <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
              <input
                type="checkbox"
                checked={vincularTudo}
                onChange={() => {
                  setVincularTudo((atual) => !atual)
                  if (!vincularTudo) limparSelecao()
                }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">
                  Vincular a praça inteira (sem filtro de produto ou categoria)
                </span>
                <span className="block text-xs text-gray-500">
                  Atalho para “tudo desta praça imprime aqui”. É o degrau mais fraco da decisão:
                  qualquer vínculo por produto ou categoria desta mesma praça tem prioridade sobre
                  ele.
                </span>
              </span>
            </label>

            {vincularTudo ? (
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Será criado <strong>1 vínculo</strong> sem alvo: todos os itens das mesas desta praça
                que não tiverem vínculo mais específico imprimem em{' '}
                <strong>{dispositivoSelecionado?.nome ?? '—'}</strong>.
              </p>
            ) : carregandoCatalogo ? (
              <p className="text-sm text-gray-500">Carregando produtos e categorias...</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Produtos ({produtosSel.length} marcado(s))
                    </h3>
                    <button
                      type="button"
                      onClick={() => setProdutosSel([])}
                      disabled={produtosSel.length === 0}
                      className="text-xs text-gray-500 underline disabled:opacity-40"
                    >
                      limpar
                    </button>
                  </div>

                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      value={buscaProduto}
                      onChange={(event) => setBuscaProduto(event.target.value)}
                      placeholder="Buscar produto..."
                      aria-label="Buscar produto"
                      className="h-9 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded border border-gray-100">
                    {produtosFiltrados.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500">Nenhum produto encontrado.</p>
                    ) : (
                      produtosFiltrados.map((produto) => {
                        const categoria = categorias.find((c) => c.id === produto.categoriaId)
                        return (
                          <label
                            key={produto.id}
                            className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-2 last:border-b-0 hover:bg-orange-50/40"
                          >
                            <input
                              type="checkbox"
                              checked={produtosSel.includes(produto.id)}
                              onChange={() => alternarProduto(produto.id)}
                              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-800">{produto.nome}</span>
                            {categoria && (
                              <span className="ml-auto text-[10px] uppercase text-gray-400">
                                {categoria.nome}
                              </span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Categorias ({categoriasSel.length} marcada(s))
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCategoriasSel([])}
                      disabled={categoriasSel.length === 0}
                      className="text-xs text-gray-500 underline disabled:opacity-40"
                    >
                      limpar
                    </button>
                  </div>

                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      value={buscaCategoria}
                      onChange={(event) => setBuscaCategoria(event.target.value)}
                      placeholder="Buscar categoria..."
                      aria-label="Buscar categoria"
                      className="h-9 w-full rounded-lg border border-gray-300 pl-8 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded border border-gray-100">
                    {categoriasFiltradas.length === 0 ? (
                      <p className="p-3 text-xs text-gray-500">Nenhuma categoria encontrada.</p>
                    ) : (
                      categoriasFiltradas.map((categoria) => (
                        <label
                          key={categoria.id}
                          className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-2 last:border-b-0 hover:bg-blue-50/40"
                        >
                          <input
                            type="checkbox"
                            checked={categoriasSel.includes(categoria.id)}
                            onChange={() => alternarCategoria(categoria.id)}
                            className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-800">{categoria.nome}</span>
                          <span className="ml-auto text-[10px] uppercase text-gray-400">
                            {categoria.setor}
                          </span>
                        </label>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={selecionarCategoriasDosProdutos}
                    disabled={produtosSel.length === 0}
                    className="mt-2 text-xs text-orange-700 underline disabled:opacity-40"
                  >
                    Marcar as categorias dos {produtosSel.length} produto(s) selecionado(s)
                  </button>
                  <p className="mt-1 text-xs text-gray-500">
                    Marcar produto e categoria juntos cria os dois vínculos: o de produto continua
                    vencendo na hora de imprimir.
                  </p>
                </section>
              </div>
            )}

            {!vincularTudo && totalDeAlvos > 0 && (
              <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Serão criados <strong>{totalDeAlvos} vínculo(s)</strong>:{' '}
                {produtosSel.length > 0 && `${produtosSel.length} de produto`}
                {produtosSel.length > 0 && categoriasSel.length > 0 && ' e '}
                {categoriasSel.length > 0 && `${categoriasSel.length} de categoria`}.
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
          <div className="flex gap-2">
            {passo > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasso((atual) => (atual === 3 ? 2 : 1))}
                disabled={salvando}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={recomeçar} disabled={salvando}>
              Recomeçar
            </Button>
          </div>

          <div className="flex gap-2">
            {passo < 3 ? (
              <Button type="button" onClick={avancar}>
                Avançar
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void salvar()}
                isLoading={salvando}
                disabled={totalDeAlvos === 0}
              >
                Criar {totalDeAlvos > 0 ? `${totalDeAlvos} ` : ''}vínculo
                {totalDeAlvos === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Vínculos existentes da praça escolhida */}
      <div className="mt-8">
        <h2 className="mb-1 text-xl font-bold text-gray-900">Vínculos existentes</h2>
        <p className="mb-4 text-sm text-gray-600">
          {pracaSelecionada
            ? `Vínculos configurados para a praça "${pracaSelecionada.nome}".`
            : 'Escolha uma praça no passo 1 para ver e remover os vínculos dela.'}
        </p>

        {pracaId === null ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            Nenhuma praça selecionada.
          </p>
        ) : (
          <DataTable<Vinculo>
            ariaLabel="Vínculos de impressão da praça"
            columns={columns}
            data={vinculos}
            getRowId={(vinculo) => vinculo.id}
            meta={vinculosQuery.data?.meta ?? { page: 1, pageSize: 25, total: 0, totalPages: 0 }}
            loading={vinculosQuery.isLoading}
            itemLabel="vínculos"
            storageKey="admin-pracas-vinculos"
            emptyMessage="Nenhum vínculo configurado para esta praça"
            emptyHint="Use o wizard acima para apontar a praça (ou um produto/categoria dela) para uma impressora."
            rowActions={{
              onDelete: setParaExcluir,
              deleteLabel: 'Remover vínculo',
            }}
          />
        )}
      </div>

      <ConfirmationModal
        isOpen={paraExcluir !== null}
        title="Remover vínculo de impressão"
        description={
          paraExcluir
            ? `Tem certeza que deseja remover o vínculo de "${alvoDoVinculo(
                paraExcluir
              )}" com "${
                paraExcluir.dispositivo?.nome ??
                nomesDeDispositivos.get(paraExcluir.dispositivoId) ??
                'a impressora'
              }"? A impressora e o produto/categoria não são apagados — só este vínculo deixa de existir, e o item volta a cair na regra seguinte (produto, depois caixa).`
            : ''
        }
        confirmText="Remover"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
