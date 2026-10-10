'use client'

import { useMemo, useState } from 'react'
import { CornerDownRight, Power, PowerOff } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { useCrud, useListaCrud, paginaAtual, SeloAtivo } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Plano de contas — PRD seção 7 (Módulo 4), padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório), `tipo` (RECEITA | DESPESA, obrigatório na
 * criação), `paiId` (opcional — hierarquia), `codigo` (único, opcional) e `ativo`.
 *
 * HIERARQUIA. O backend já inclui o pai resumido (`pai: { id, nome, codigo }`) e
 * a contagem de filhos (`_count.filhos`) em toda resposta do plano, então a
 * listagem exibe o nome do pai e o nível calculado a partir da lista completa.
 * Além disso carregamos a lista inteira (`?pageSize=100&ativo=true`, o máximo do
 * contrato) só para montar o select de pai e o mapa id->nome — a tela não tem
 * como montar a árvore a partir de uma página de 25.
 *
 * CICLOS. O backend rejeita ciclo com 400 (`gerariaCiclo`), mas a tela NÃO deve
 * oferecer a opção: o select exclui o próprio registro e todos os seus
 * descendentes. Sem isso o operador só descobriria o erro depois de salvar.
 */

const RESOURCE = '/plano-contas'
const CHAVE_LISTA_COMPLETA = 'plano-contas-completo'
const LIMITE_LISTA_COMPLETA = 100

const TIPOS = ['RECEITA', 'DESPESA'] as const
type TipoPlano = (typeof TIPOS)[number]

const TIPO_BADGE: Record<TipoPlano, string> = {
  RECEITA: 'bg-emerald-100 text-emerald-800',
  DESPESA: 'bg-red-100 text-red-800',
}

type PlanoConta = {
  id: number
  nome: string
  tipo: string
  paiId: number | null
  pai?: { id: number; nome: string; codigo: string | null; tipo: string } | null
  codigo: string | null
  ativo: boolean
  _count?: { filhos: number }
}

type FormState = {
  nome: string
  tipo: TipoPlano
  paiId: string
  codigo: string
}

const FORM_VAZIO: FormState = { nome: '', tipo: 'DESPESA', paiId: '', codigo: '' }

export default function PlanoContasPage() {
  const { showToast } = useToast()
  const crud = useCrud<PlanoConta>({ resource: RESOURCE, entidade: 'Conta do plano', genero: 'f' })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<PlanoConta>(ui.listaParams)

  /**
   * Lista completa e separada da paginação da tela: só serve de apoio (select de
   * pai e mapa id->nome). Fica com `staleTime` curto porque o cadastro muda com
   * frequência enquanto o financeiro está sendo montado.
   */
  const listaCompleta = usePagedQuery<PlanoConta>({
    resource: `${RESOURCE}?ativo=true`,
    page: 1,
    pageSize: LIMITE_LISTA_COMPLETA,
    queryKey: [CHAVE_LISTA_COMPLETA],
    staleTime: 30_000,
  })

  const contas = useMemo(() => listaCompleta.data?.data ?? [], [listaCompleta.data])

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PlanoConta | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<PlanoConta | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  /** id -> registro, juntando a lista completa com a página atual (pode haver pai inativo). */
  const porId = useMemo(() => {
    const mapa = new Map<number, PlanoConta>()
    for (const conta of contas) mapa.set(conta.id, conta)
    for (const conta of pagina.data) mapa.set(conta.id, conta)
    return mapa
  }, [contas, pagina.data])

  /** id do pai -> total de filhos: usado para mostrar "sem filhos" e o nível. */
  const filhosPorPai = useMemo(() => {
    const mapa = new Map<number, number>()
    for (const conta of porId.values()) {
      if (conta.paiId === null) continue
      mapa.set(conta.paiId, (mapa.get(conta.paiId) ?? 0) + 1)
    }
    return mapa
  }, [porId])

  const nomeDoPai = (conta: PlanoConta): string | null => {
    if (conta.paiId === null) return null
    return conta.pai?.nome ?? porId.get(conta.paiId)?.nome ?? `#${conta.paiId}`
  }

  /** Nível na árvore (raiz = 1), caminhando os pais com limite de segurança. */
  const nivelDaConta = (conta: PlanoConta): number => {
    let nivel = 1
    let atual = conta.paiId
    const visitados = new Set<number>([conta.id])
    while (atual !== null && nivel < 20 && !visitados.has(atual)) {
      visitados.add(atual)
      nivel += 1
      atual = porId.get(atual)?.paiId ?? null
    }
    return nivel
  }

  /**
   * Opções do select de pai: exclui o próprio registro e todos os seus
   * descendentes (evita ciclo) — o backend rejeitaria de qualquer forma.
   */
  const opcoesDePai = useMemo(() => {
    const proibidos = new Set<number>()
    if (editing) {
      proibidos.add(editing.id)
      const filhosPorId = new Map<number, number[]>()
      for (const conta of porId.values()) {
        if (conta.paiId === null) continue
        const lista = filhosPorId.get(conta.paiId) ?? []
        lista.push(conta.id)
        filhosPorId.set(conta.paiId, lista)
      }
      const fila = [editing.id]
      while (fila.length > 0) {
        const atual = fila.shift() as number
        for (const filho of filhosPorId.get(atual) ?? []) {
          if (proibidos.has(filho)) continue
          proibidos.add(filho)
          fila.push(filho)
        }
      }
    }

    const opcoes = [...porId.values()].filter((conta) => !proibidos.has(conta.id))

    // O pai atual pode estar inativo (a lista de apoio só traz ativos): sem ele
    // no select, editar a conta apagaria o vínculo sem o operador perceber.
    const paiAtualId = editing?.paiId ?? null
    if (paiAtualId !== null && !opcoes.some((conta) => conta.id === paiAtualId) && !proibidos.has(paiAtualId)) {
      const paiAtual = porId.get(paiAtualId)
      if (paiAtual) opcoes.push(paiAtual)
    }

    return opcoes.sort((a, b) => {
      const codigoA = a.codigo ?? ''
      const codigoB = b.codigo ?? ''
      if (codigoA !== codigoB) return codigoA.localeCompare(codigoB, 'pt-BR')
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [porId, editing])

  const abrirNova = () => {
    setEditing(null)
    setForm(FORM_VAZIO)
    setShowForm(true)
    void listaCompleta.refetch()
  }

  const abrirEdicao = (conta: PlanoConta) => {
    setEditing(conta)
    setForm({
      nome: conta.nome,
      tipo: (TIPOS as readonly string[]).includes(conta.tipo)
        ? (conta.tipo as TipoPlano)
        : 'DESPESA',
      paiId: conta.paiId === null ? '' : String(conta.paiId),
      codigo: conta.codigo ?? '',
    })
    setShowForm(true)
    void listaCompleta.refetch()
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(FORM_VAZIO)
  }

  const atualizarCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  /** Rótulo do select com a indentação visual do nível na árvore. */
  const rotuloDoPai = (conta: PlanoConta): string => {
    const nivel = nivelDaConta(conta)
    const prefixo = nivel > 1 ? `${'— '.repeat(nivel - 1)}` : ''
    const codigo = conta.codigo ? `${conta.codigo} · ` : ''
    return `${prefixo}${codigo}${conta.nome}${conta.ativo ? '' : ' (inativa)'}`  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()

    const nome = form.nome.trim()
    if (nome === '') {
      showToast('Informe o nome da conta do plano', 'error')
      return
    }

    const corpo = {
      nome,
      tipo: form.tipo,
      paiId: form.paiId === '' ? null : Number(form.paiId),
      codigo: form.codigo.trim() === '' ? null : form.codigo.trim(),
    }

    setSalvando(true)
    const editando = editing
    const salvo = editando ? await crud.atualizar(editando.id, corpo) : await crud.criar(corpo)
    setSalvando(false)

    if (salvo === null) return
    showToast(crud.mensagem(editando ? 'atualizado' : 'criado'), 'success')
    fecharForm()
    ui.reiniciarPagina()
    void refetch()
    void listaCompleta.refetch()
  }

  const alternar = async (conta: PlanoConta) => {
    setAlternandoId(conta.id)
    const atualizada = await crud.alternarAtivo(conta.id, !conta.ativo)
    setAlternandoId(null)

    if (atualizada === null) return
    showToast(`Conta do plano ${atualizada.ativo ? 'ativada' : 'desativada'}`, 'success')
    void refetch()
    void listaCompleta.refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)

    const excluida = await crud.excluir(alvo.id)
    if (excluida === null) return

    showToast(crud.mensagem('excluido'), 'success')
    void listaCompleta.refetch()
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<PlanoConta>> = [
    {
      key: 'codigo',
      header: 'Código',
      sortKey: 'codigo',
      render: (conta) => (
        <span className="font-mono text-xs text-gray-700">{conta.codigo ?? '—'}</span>
      ),
    },
    {
      key: 'nome',
      header: 'Conta',
      sortKey: 'nome',
      render: (conta) => {
        const nivel = nivelDaConta(conta)
        return (
          <span className="inline-flex items-center gap-1">
            {nivel > 1 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
            <span
              className={
                nivel === 1 ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'
              }
            >
              {conta.nome}
            </span>
          </span>
        )
      },
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortKey: 'tipo',
      render: (conta) => (
        <span
          className={`rounded px-2 py-1 text-xs font-semibold ${
            TIPO_BADGE[conta.tipo as TipoPlano] ?? 'bg-gray-100 text-gray-700'
          }`}
        >
          {conta.tipo}
        </span>
      ),
    },
    {
      key: 'pai',
      header: 'Conta pai',
      hideOnMobile: true,
      render: (conta) => {
        const nome = nomeDoPai(conta)
        return nome ? (
          <span className="text-gray-700">{nome}</span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Raiz</span>
        )
      },
    },
    {
      key: 'filhos',
      header: 'Subcontas',
      align: 'center',
      hideOnMobile: true,
      render: (conta) => (
        <span className="text-gray-600">
          {filhosPorPai.get(conta.id) ?? conta._count?.filhos ?? 0}
        </span>
      ),
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (conta) => <SeloAtivo ativo={conta.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Plano de Contas</h1>
      <p className="mb-6 text-sm text-gray-600">
        Estrutura hierárquica de receitas e despesas. Uma conta pode ter uma conta pai (agrupador)
        e receber lançamentos próprios.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar o plano de contas'}
        </div>
      )}

      <DataTable<PlanoConta>
        ariaLabel="Listagem do plano de contas"
        columns={columns}
        data={pagina.data}
        getRowId={(conta) => conta.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="contas"
        storageKey="admin-plano-contas"
        emptyMessage="Nenhuma conta do plano encontrada"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Crie a primeira conta (normalmente uma raiz de RECEITA ou DESPESA) abaixo.'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar conta do plano',
          deleteLabel: 'Excluir conta do plano',
          extra: (conta) => (
            <button
              type="button"
              title={conta.ativo ? 'Desativar' : 'Ativar'}
              aria-label={conta.ativo ? 'Desativar conta do plano' : 'Ativar conta do plano'}
              disabled={alternandoId === conta.id}
              onClick={() => void alternar(conta)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {conta.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Nova conta do plano', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar conta do plano' : 'Nova conta do plano'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-[2fr,1fr]">
                <div>
                  <label htmlFor="plano-nome" className="mb-1 block text-sm font-medium text-black">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="plano-nome"
                    type="text"
                    value={form.nome}
                    onChange={(event) => atualizarCampo('nome', event.target.value)}
                    placeholder="Ex.: Despesas com pessoal"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="plano-codigo" className="mb-1 block text-sm font-medium text-black">
                    Código
                  </label>
                  <input
                    id="plano-codigo"
                    type="text"
                    value={form.codigo}
                    onChange={(event) => atualizarCampo('codigo', event.target.value)}
                    placeholder="3.1.02"
                    className="w-full rounded-lg border border-gray-300 p-2 font-mono text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">Opcional e único.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="plano-tipo" className="mb-1 block text-sm font-medium text-black">
                    Tipo <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="plano-tipo"
                    value={form.tipo}
                    onChange={(event) => atualizarCampo('tipo', event.target.value as TipoPlano)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    {TIPOS.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="plano-pai" className="mb-1 block text-sm font-medium text-black">
                    Conta pai
                  </label>
                  <select
                    id="plano-pai"
                    value={form.paiId}
                    onChange={(event) => atualizarCampo('paiId', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">Sem pai (conta raiz)</option>
                    {opcoesDePai.map((conta) => (
                      <option key={conta.id} value={conta.id}>
                        {rotuloDoPai(conta)}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    A própria conta e suas subcontas não aparecem na lista (evita ciclo).
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={fecharForm} disabled={salvando}>
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
        title="Excluir conta do plano"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? A conta é desativada (soft delete) e as subcontas continuam apontando para ela.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
