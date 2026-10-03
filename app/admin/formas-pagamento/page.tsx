'use client'

import { useMemo, useState } from 'react'
import { Power, PowerOff } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { apiFetch } from '@/app/lib/api'
import {
  useCrud,
  useListaCrud,
  paginaAtual,
  SeloAtivo,
  comoDecimalDigitado,
  comoNumero,
  formatarPercentual,
} from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Formas de pagamento — PRD seção 7 (Módulo 4), padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório, ÚNICO), `taxa` (decimal %, >= 0), `prazoDias`
 * (inteiro >= 0, D+n), `contaBancariaId` (opcional) e `ativo`.
 *
 * `contaBancariaId` NÃO é FK no banco ainda: o backend valida a existência na
 * aplicação (`validarContaBancaria`). A tela carrega as contas para montar o
 * select; contas inativas continuam disponíveis quando já são o vínculo do
 * registro, porque desativar uma conta não pode quebrar a edição da forma.
 *
 * `taxa` é digitada como texto (`inputMode="decimal"`) pelo mesmo motivo do
 * `saldoInicial` das contas bancárias: vírgula. O JSON leva número; o backend
 * rejeita negativo com 400.
 */

const RESOURCE = '/formas-pagamento'
const RESOURCE_CONTAS = '/contas-bancarias'

/** O backend espera dinheiro/percentual como número; 100% é o teto do bom senso. */
const TAXA_MAXIMA = 100

type FormaPagamento = {
  id: number
  nome: string
  taxa: number
  prazoDias: number
  contaBancariaId: number | null
  ativo: boolean
}

type ContaBancaria = {
  id: number
  nome: string
  ativo: boolean
}

type FormState = {
  nome: string
  taxa: string
  prazoDias: string
  contaBancariaId: string
}

const FORM_VAZIO: FormState = { nome: '', taxa: '', prazoDias: '', contaBancariaId: '' }

export default function FormasPagamentoPage() {
  const { showToast } = useToast()
  const crud = useCrud<FormaPagamento>({
    resource: RESOURCE,
    entidade: 'Forma de pagamento',
    genero: 'f',
  })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<FormaPagamento>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [contas, setContas] = useState<ContaBancaria[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FormaPagamento | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<FormaPagamento | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  const contasPorId = useMemo(() => {
    const mapa = new Map<number, ContaBancaria>()
    for (const conta of contas) mapa.set(conta.id, conta)
    return mapa
  }, [contas])

  /**
   * Carrega as contas para o select. Duas listas de 100 (ativas + todas) cobrem
   * o caso "conta vinculada que foi desativada": ela já não vem em `ativos`,
   * mas continua selecionável ao editar a forma que aponta para ela.
   */
  const carregarContas = async () => {
    const [ativas, todas] = await Promise.all([
      crud.executar(
        () => apiFetch<{ data: ContaBancaria[] }>(`${RESOURCE_CONTAS}?pageSize=100&ativo=true`),
        'Erro ao carregar contas bancárias'
      ),
      crud.executar(
        () => apiFetch<{ data: ContaBancaria[] }>(`${RESOURCE_CONTAS}?pageSize=100`),
        'Erro ao carregar contas bancárias'
      ),
    ])

    const mapa = new Map<number, ContaBancaria>()
    for (const conta of todas?.data ?? []) mapa.set(conta.id, conta)
    for (const conta of ativas?.data ?? []) mapa.set(conta.id, conta)

    setContas([...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
  }

  const abrirNova = () => {
    setEditing(null)
    setForm(FORM_VAZIO)
    setShowForm(true)
    void carregarContas()
  }

  const abrirEdicao = (forma: FormaPagamento) => {
    setEditing(forma)
    setForm({
      nome: forma.nome,
      taxa: String(comoNumero(forma.taxa)),
      prazoDias: String(forma.prazoDias ?? 0),
      contaBancariaId: forma.contaBancariaId ? String(forma.contaBancariaId) : '',
    })
    setShowForm(true)
    void carregarContas()
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(FORM_VAZIO)
  }

  const atualizarCampo = (campo: keyof FormState, valor: string) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()

    const nome = form.nome.trim()
    if (nome === '') {
      showToast('Informe o nome da forma de pagamento', 'error')
      return
    }

    const taxaTexto = form.taxa.trim()
    const taxa = taxaTexto === '' ? 0 : comoDecimalDigitado(taxaTexto)
    if (taxa === null) {
      showToast('Taxa inválida: use apenas números (ex.: 2,50)', 'error')
      return
    }
    if (taxa < 0) {
      showToast('A taxa não pode ser negativa', 'error')
      return
    }
    if (taxa > TAXA_MAXIMA) {
      showToast(`A taxa deve ser de no máximo ${TAXA_MAXIMA}%`, 'error')
      return
    }

    const prazoTexto = form.prazoDias.trim()
    const prazoDias = prazoTexto === '' ? 0 : Number(prazoTexto)
    if (!Number.isInteger(prazoDias) || prazoDias < 0) {
      showToast('Prazo inválido: informe um número inteiro de dias (0 = à vista)', 'error')
      return
    }

    const corpo = {
      nome,
      taxa,
      prazoDias,
      contaBancariaId:
        form.contaBancariaId === '' ? null : Number(form.contaBancariaId),
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
  }

  const alternar = async (forma: FormaPagamento) => {
    setAlternandoId(forma.id)
    const atualizada = await crud.alternarAtivo(forma.id, !forma.ativo)
    setAlternandoId(null)

    if (atualizada === null) return
    showToast(`Forma de pagamento ${atualizada.ativo ? 'ativada' : 'desativada'}`, 'success')
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)

    const excluida = await crud.excluir(alvo.id)
    if (excluida === null) return

    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<FormaPagamento>> = [
    {
      key: 'nome',
      header: 'Forma de pagamento',
      sortKey: 'nome',
      render: (forma) => <span className="font-medium text-gray-900">{forma.nome}</span>,
    },
    {
      key: 'taxa',
      header: 'Taxa',
      sortKey: 'taxa',
      align: 'right',
      render: (forma) => (
        <span className={comoNumero(forma.taxa) > 0 ? 'text-gray-900' : 'text-gray-400'}>
          {formatarPercentual(forma.taxa)}
        </span>
      ),
    },
    {
      key: 'prazoDias',
      header: 'Prazo',
      sortKey: 'prazoDias',
      align: 'center',
      hideOnMobile: true,
      render: (forma) => (
        <span className="text-gray-700">
          {forma.prazoDias > 0 ? `D+${forma.prazoDias}` : 'À vista'}
        </span>
      ),
    },
    {
      key: 'contaBancaria',
      header: 'Conta bancária',
      hideOnMobile: true,
      render: (forma) => {
        if (!forma.contaBancariaId) return <span className="text-gray-400">—</span>
        const conta = contasPorId.get(forma.contaBancariaId)
        return (
          <span className="text-gray-700">
            {conta
              ? `${conta.nome}${conta.ativo ? '' : ' (inativa)'}`
              : `#${forma.contaBancariaId}`}
          </span>
        )
      },
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (forma) => <SeloAtivo ativo={forma.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Formas de Pagamento</h1>
      <p className="mb-6 text-sm text-gray-600">
        Taxa é o percentual retido pela operadora e prazo é o D+n de repasse da conta.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar formas de pagamento'}
        </div>
      )}

      <DataTable<FormaPagamento>
        ariaLabel="Listagem de formas de pagamento"
        columns={columns}
        data={pagina.data}
        getRowId={(forma) => forma.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="formas de pagamento"
        storageKey="admin-formas-pagamento"
        emptyMessage="Nenhuma forma de pagamento encontrada"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Cadastre DINHEIRO, PIX, CARTAO_CREDITO, CARTAO_DEBITO e VOUCHER abaixo.'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar forma de pagamento',
          deleteLabel: 'Excluir forma de pagamento',
          extra: (forma) => (
            <button
              type="button"
              title={forma.ativo ? 'Desativar' : 'Ativar'}
              aria-label={forma.ativo ? 'Desativar forma de pagamento' : 'Ativar forma de pagamento'}
              disabled={alternandoId === forma.id}
              onClick={() => void alternar(forma)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {forma.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Nova forma de pagamento', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="forma-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  id="forma-nome"
                  type="text"
                  value={form.nome}
                  onChange={(event) => atualizarCampo('nome', event.target.value)}
                  placeholder="Ex.: PIX"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nome único. O financeiro valida o tipo do pagamento contra este nome.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="forma-taxa" className="mb-1 block text-sm font-medium text-black">
                    Taxa (%)
                  </label>
                  <input
                    id="forma-taxa"
                    type="text"
                    inputMode="decimal"
                    value={form.taxa}
                    onChange={(event) => atualizarCampo('taxa', event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Aceita vírgula. Vazio = 0%. Máximo {TAXA_MAXIMA}%.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="forma-prazo"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Prazo (dias)
                  </label>
                  <input
                    id="forma-prazo"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={form.prazoDias}
                    onChange={(event) => atualizarCampo('prazoDias', event.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    D+n do repasse. À vista = 0.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="forma-conta"
                  className="mb-1 block text-sm font-medium text-black"
                >
                  Conta bancária de destino
                </label>
                <select
                  id="forma-conta"
                  value={form.contaBancariaId}
                  onChange={(event) => atualizarCampo('contaBancariaId', event.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="">Nenhuma (a definir)</option>
                  {contas.map((conta) => (
                    <option key={conta.id} value={conta.id}>
                      {conta.nome}
                      {conta.ativo ? '' : ' (inativa)'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Opcional. Só contas cadastradas em Contas Bancárias aparecem aqui.
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
        title="Excluir forma de pagamento"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? A forma é desativada (soft delete) e os pagamentos históricos continuam válidos.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
