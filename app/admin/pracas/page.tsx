'use client'

import { useState } from 'react'
import { AlertTriangle, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { useCrud, useListaCrud, paginaAtual, SeloAtivo } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Praças — PRD seção 5.2 (RF-PRA-01 a RF-PRA-04), no padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório, único IGNORANDO CAIXA E ACENTO — o backend compara
 * por `nomeNorm`, então "NÃO DEFINIDA" e "Não definida" são a mesma praça e o
 * segundo cadastro volta 409) e `ranges: [{ inicio, fim }]`.
 *
 * O que o operador precisa saber e a tela deixa explícito:
 *
 * - **A faixa não cria mesa.** Ela só diz quais mesas EXISTENTES (por `numero`)
 *   passam a apontar para esta praça. Mesa só nasce no gerador em lote (RF-MES-02/03).
 * - **Mesa fora das faixas perde a praça.** Ao salvar, mesa desta praça cujo número
 *   ficou fora das novas faixas volta para "Não definida" — é o que permite
 *   corrigir um range digitado errado.
 * - **Faixa que sobrepõe a de OUTRA praça volta 409** com o nome da praça
 *   conflitante (RF-PRA-02). O toast mostra a mensagem do backend.
 * - **Excluir a praça NÃO apaga mesa** (RF-PRA-04): as mesas voltam para
 *   "Não definida" e continuam existindo. Faixas e vínculos de impressão da praça
 *   são removidos junto. O aviso aparece no rodapé e na confirmação.
 *
 * `PUT` sem `ranges` no corpo preserva as faixas atuais; a tela SEMPRE manda o
 * array (mesmo vazio), porque o formulário edita as faixas como um todo — enviar
 * `[]` é o gesto explícito de "esta praça não tem faixa".
 */

const RESOURCE = '/pracas'

type PracaRange = {
  id?: number
  inicio: number
  fim: number
}

type Praca = {
  id: number
  nome: string
  ativo: boolean
  ranges?: PracaRange[]
  _count?: { mesas: number }
}

/** Linha do editor de faixas: `id` local só para o React não trocar as linhas de lugar. */
type RangeRow = {
  key: number
  inicio: string
  fim: string
}

let proximaChave = 1

function novaRangeRow(inicio = '', fim = ''): RangeRow {
  proximaChave += 1
  return { key: proximaChave, inicio, fim }
}

/** "1–50, 200–250" — formato da listagem. */
function formatarRanges(ranges: PracaRange[] | undefined): string {
  if (!ranges || ranges.length === 0) return '—'
  return [...ranges]
    .sort((a, b) => a.inicio - b.inicio)
    .map((range) => `${range.inicio}–${range.fim}`)
    .join(', ')
}

export default function PracasPage() {
  const { showToast } = useToast()
  const crud = useCrud<Praca>({ resource: RESOURCE, entidade: 'Praça', genero: 'f' })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<Praca>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Praca | null>(null)
  const [nome, setNome] = useState('')
  const [ranges, setRanges] = useState<RangeRow[]>([novaRangeRow()])
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Praca | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  const abrirNova = () => {
    setEditing(null)
    setNome('')
    setRanges([novaRangeRow()])
    setShowForm(true)
  }

  const abrirEdicao = (praca: Praca) => {
    setEditing(praca)
    setNome(praca.nome)
    const atuais = [...(praca.ranges ?? [])].sort((a, b) => a.inicio - b.inicio)
    setRanges(
      atuais.length > 0
        ? atuais.map((range) => novaRangeRow(String(range.inicio), String(range.fim)))
        : [novaRangeRow()]
    )
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setNome('')
    setRanges([novaRangeRow()])
  }

  const atualizarRange = (key: number, campo: 'inicio' | 'fim', valor: string) => {
    setRanges((atual) =>
      atual.map((linha) => (linha.key === key ? { ...linha, [campo]: valor } : linha))
    )
  }

  const adicionarRange = () => setRanges((atual) => [...atual, novaRangeRow()])

  const removerRange = (key: number) => {
    setRanges((atual) => (atual.length === 1 ? [novaRangeRow()] : atual.filter((l) => l.key !== key)))
  }

  /**
   * Valida as faixas no cliente para dar erro imediato (o backend valida de novo e
   * devolve 400/409). Linhas totalmente vazias são descartadas — é como o operador
   * "limpa" uma faixa sem usar o botão de remover.
   */
  const montarRanges = (): PracaRange[] | null => {
    const preenchidas = ranges.filter(
      (linha) => linha.inicio.trim() !== '' || linha.fim.trim() !== ''
    )

    const montadas: PracaRange[] = []
    for (const linha of preenchidas) {
      const inicio = Number(linha.inicio.trim())
      const fim = Number(linha.fim.trim())

      if (!Number.isInteger(inicio) || inicio < 1) {
        showToast('Início da faixa deve ser um número inteiro maior ou igual a 1', 'error')
        return null
      }
      if (!Number.isInteger(fim) || fim < 1) {
        showToast('Fim da faixa deve ser um número inteiro maior ou igual a 1', 'error')
        return null
      }
      if (fim < inicio) {
        showToast(`Faixa inválida: ${inicio}–${fim} tem o fim menor que o início`, 'error')
        return null
      }
      montadas.push({ inicio, fim })
    }

    montadas.sort((a, b) => a.inicio - b.inicio)
    for (let i = 1; i < montadas.length; i += 1) {
      if (montadas[i].inicio <= montadas[i - 1].fim) {
        showToast(
          `As faixas ${montadas[i - 1].inicio}–${montadas[i - 1].fim} e ${montadas[i].inicio}–${montadas[i].fim} se sobrepõem`,
          'error'
        )
        return null
      }
    }

    return montadas
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()

    const nomeLimpo = nome.trim()
    if (nomeLimpo === '') {
      showToast('Informe o nome da praça', 'error')
      return
    }

    const rangesMontados = montarRanges()
    if (rangesMontados === null) return

    const corpo = { nome: nomeLimpo, ranges: rangesMontados }

    setSalvando(true)
    const editando = editing
    const salvo = editando
      ? await crud.atualizar(editando.id, corpo)
      : await crud.criar(corpo)
    setSalvando(false)

    if (salvo === null) return

    const mesasVinculadas = (salvo as { mesasVinculadas?: number }).mesasVinculadas
    showToast(crud.mensagem(editando ? 'atualizado' : 'criado'), 'success')
    if (typeof mesasVinculadas === 'number') {
      showToast(
        mesasVinculadas > 0
          ? `${mesasVinculadas} mesa(s) vinculada(s) a esta praça`
          : 'Nenhuma mesa existente caiu nas faixas informadas',
        'info'
      )
    }

    fecharForm()
    ui.reiniciarPagina()
    void refetch()
  }

  const alternar = async (praca: Praca) => {
    setAlternandoId(praca.id)
    const atualizada = await crud.alternarAtivo(praca.id, !praca.ativo)
    setAlternandoId(null)

    if (atualizada === null) return
    showToast(`Praça ${atualizada.ativo ? 'ativada' : 'desativada'}`, 'success')
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)

    const excluida = await crud.excluir(alvo.id)
    if (excluida === null) return

    const mesasDesvinculadas = (excluida as { mesasDesvinculadas?: number }).mesasDesvinculadas
    showToast(crud.mensagem('excluido'), 'success')
    if (typeof mesasDesvinculadas === 'number' && mesasDesvinculadas > 0) {
      showToast(
        `${mesasDesvinculadas} mesa(s) continuam existindo e voltaram para "Não definida"`,
        'info'
      )
    }

    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<Praca>> = [
    {
      key: 'nome',
      header: 'Praça',
      sortKey: 'nome',
      render: (praca) => <span className="font-medium text-gray-900">{praca.nome}</span>,
    },
    {
      key: 'ranges',
      header: 'Faixas de mesas',
      render: (praca) => (
        <span className="font-mono text-xs text-gray-700">{formatarRanges(praca.ranges)}</span>
      ),
    },
    {
      key: 'mesas',
      header: 'Mesas',
      align: 'center',
      hideOnMobile: true,
      render: (praca) => (
        <span className="text-gray-700">{praca._count?.mesas ?? 0}</span>
      ),
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      render: (praca) => <SeloAtivo ativo={praca.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Praças</h1>
      <p className="mb-4 text-sm text-gray-600">
        A praça agrupa mesas por faixa de numeração (ex.: salão 1–50, varanda 200–250) e é o
        primeiro critério do roteamento de impressão.
      </p>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>As faixas não criam mesas.</strong> Elas vinculam apenas mesas já existentes com
          aquele número, e mesa que ficar fora das faixas volta para <em>“Não definida”</em>. Excluir
          uma praça também <strong>não apaga mesa nenhuma</strong>: as mesas continuam existindo, só
          perdem a praça.
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar praças'}
        </div>
      )}

      <DataTable<Praca>
        ariaLabel="Listagem de praças"
        columns={columns}
        data={pagina.data}
        getRowId={(praca) => praca.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="praças"
        storageKey="admin-pracas"
        emptyMessage="Nenhuma praça encontrada"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Cadastre a primeira praça abaixo (ex.: Salão).'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar praça',
          deleteLabel: 'Excluir praça',
          extra: (praca) => (
            <button
              type="button"
              title={praca.ativo ? 'Desativar' : 'Ativar'}
              aria-label={praca.ativo ? 'Desativar praça' : 'Ativar praça'}
              disabled={alternandoId === praca.id}
              onClick={() => void alternar(praca)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {praca.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Nova praça', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar praça' : 'Nova praça'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="praca-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  id="praca-nome"
                  type="text"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Salão, Varanda"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  O nome é único ignorando maiúsculas e acentos: “Não definida” e “NÃO DEFINIDA”
                  são a mesma praça.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Faixas de mesas</span>
                  <button
                    type="button"
                    onClick={adicionarRange}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar faixa
                  </button>
                </div>

                <div className="space-y-2">
                  {ranges.map((linha) => (
                    <div key={linha.key} className="flex items-center gap-2">
                      <div className="flex-1">
                        <label
                          htmlFor={`praca-range-inicio-${linha.key}`}
                          className="sr-only"
                        >
                          Número inicial da faixa
                        </label>
                        <input
                          id={`praca-range-inicio-${linha.key}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={linha.inicio}
                          onChange={(event) =>
                            atualizarRange(linha.key, 'inicio', event.target.value)
                          }
                          placeholder="De (ex.: 1)"
                          className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                      <span className="text-gray-400">até</span>
                      <div className="flex-1">
                        <label htmlFor={`praca-range-fim-${linha.key}`} className="sr-only">
                          Número final da faixa
                        </label>
                        <input
                          id={`praca-range-fim-${linha.key}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={linha.fim}
                          onChange={(event) =>
                            atualizarRange(linha.key, 'fim', event.target.value)
                          }
                          placeholder="Até (ex.: 50)"
                          className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                      <button
                        type="button"
                        title="Remover faixa"
                        aria-label="Remover faixa"
                        onClick={() => removerRange(linha.key)}
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  O fim precisa ser maior ou igual ao início, e duas faixas da mesma praça não podem
                  se sobrepor. Deixe as duas colunas vazias para não usar faixa nenhuma — nesse caso
                  as mesas desta praça ficam sem faixa e voltam para “Não definida”.
                </p>
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
        title="Excluir praça"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? As ${
                paraExcluir._count?.mesas ?? 0
              } mesa(s) desta praça NÃO serão apagadas: elas continuam existindo e voltam para "Não definida". As faixas e os vínculos de impressão desta praça são removidos junto.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
