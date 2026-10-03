'use client'

import { useState } from 'react'
import { Power, PowerOff } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import {
  useCrud,
  useListaCrud,
  paginaAtual,
  SeloAtivo,
  comoDecimalDigitado,
  formatarMoeda,
} from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Contas bancárias — PRD seção 7 (Módulo 4), padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório), `banco`, `agencia`, `numero` (textos livres),
 * `saldoInicial` (decimal >= 0) e `ativo`.
 *
 * O `saldoInicial` é digitado em texto e NÃO com `type="number"`: o operador
 * digita "1.250,50" e o input nativo rejeitaria a vírgula, deixando o campo
 * vazio no submit. A conversão vírgula->ponto acontece em
 * `comoDecimalDigitado` e o valor vai como número no JSON (o backend aceita
 * número ou string e rejeita negativo com 400).
 *
 * Atenção ao ler a API: `Decimal` chega ao JSON já normalizado para `number`
 * por `Backendrei/src/lib/serialize.ts` — por isso nunca chamamos `.toFixed()`
 * nem `.toNumber()` no cliente (o teste `verify-serialize.ts` cobre essa borda).
 */

const RESOURCE = '/contas-bancarias'

type ContaBancaria = {
  id: number
  nome: string
  banco: string | null
  agencia: string | null
  numero: string | null
  saldoInicial: number
  ativo: boolean
}

type FormState = {
  nome: string
  banco: string
  agencia: string
  numero: string
  saldoInicial: string
}

const FORM_VAZIO: FormState = { nome: '', banco: '', agencia: '', numero: '', saldoInicial: '' }

export default function ContasBancariasPage() {
  const { showToast } = useToast()
  const crud = useCrud<ContaBancaria>({
    resource: RESOURCE,
    entidade: 'Conta bancária',
    genero: 'f',
  })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<ContaBancaria>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ContaBancaria | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<ContaBancaria | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  const abrirNova = () => {
    setEditing(null)
    setForm(FORM_VAZIO)
    setShowForm(true)
  }

  const abrirEdicao = (conta: ContaBancaria) => {
    setEditing(conta)
    setForm({
      nome: conta.nome,
      banco: conta.banco ?? '',
      agencia: conta.agencia ?? '',
      numero: conta.numero ?? '',
      saldoInicial: Number.isFinite(conta.saldoInicial) ? String(conta.saldoInicial) : '',
    })
    setShowForm(true)
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
      showToast('Informe o nome da conta bancária', 'error')
      return
    }

    const saldoTexto = form.saldoInicial.trim()
    const saldoInicial = saldoTexto === '' ? 0 : comoDecimalDigitado(saldoTexto)
    if (saldoInicial === null) {
      showToast('Saldo inicial inválido: use apenas números (ex.: 1250,50)', 'error')
      return
    }
    if (saldoInicial < 0) {
      showToast('O saldo inicial não pode ser negativo', 'error')
      return
    }

    // Texto vazio é enviado como `null`: no backend `''` é normalizado para NULL
    // (AGENTS.md), mas mandar `null` explicitamente deixa a intenção clara.
    const corpo = {
      nome,
      banco: form.banco.trim() === '' ? null : form.banco.trim(),
      agencia: form.agencia.trim() === '' ? null : form.agencia.trim(),
      numero: form.numero.trim() === '' ? null : form.numero.trim(),
      saldoInicial,
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

  const alternar = async (conta: ContaBancaria) => {
    setAlternandoId(conta.id)
    const atualizada = await crud.alternarAtivo(conta.id, !conta.ativo)
    setAlternandoId(null)

    if (atualizada === null) return
    showToast(`Conta bancária ${atualizada.ativo ? 'ativada' : 'desativada'}`, 'success')
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

  const columns: Array<DataTableColumn<ContaBancaria>> = [
    {
      key: 'nome',
      header: 'Conta',
      sortKey: 'nome',
      render: (conta) => (
        <div>
          <span className="font-medium text-gray-900">{conta.nome}</span>
          {conta.banco && (
            <span className="block text-xs text-gray-500 md:hidden">{conta.banco}</span>
          )}
        </div>
      ),
    },
    {
      key: 'banco',
      header: 'Banco',
      sortKey: 'banco',
      hideOnMobile: true,
      render: (conta) => <span className="text-gray-700">{conta.banco ?? '—'}</span>,
    },
    {
      key: 'agencia',
      header: 'Agência',
      hideOnMobile: true,
      render: (conta) => <span className="text-gray-700">{conta.agencia ?? '—'}</span>,
    },
    {
      key: 'numero',
      header: 'Número',
      hideOnMobile: true,
      render: (conta) => <span className="text-gray-700">{conta.numero ?? '—'}</span>,
    },
    {
      key: 'saldoInicial',
      header: 'Saldo inicial',
      align: 'right',
      render: (conta) => (
        <span className="font-medium text-gray-900">{formatarMoeda(conta.saldoInicial)}</span>
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
    <div className="mx-auto max-w-6xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Contas Bancárias</h1>
      <p className="mb-6 text-sm text-gray-600">
        Contas e caixas usados pelos lançamentos financeiros. O saldo inicial é o ponto de partida
        do extrato da conta.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar contas bancárias'}
        </div>
      )}

      <DataTable<ContaBancaria>
        ariaLabel="Listagem de contas bancárias"
        columns={columns}
        data={pagina.data}
        getRowId={(conta) => conta.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="contas bancárias"
        storageKey="admin-contas-bancarias"
        emptyMessage="Nenhuma conta bancária encontrada"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Cadastre a primeira conta ou caixa abaixo.'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar conta bancária',
          deleteLabel: 'Excluir conta bancária',
          extra: (conta) => (
            <button
              type="button"
              title={conta.ativo ? 'Desativar' : 'Ativar'}
              aria-label={conta.ativo ? 'Desativar conta bancária' : 'Ativar conta bancária'}
              disabled={alternandoId === conta.id}
              onClick={() => void alternar(conta)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {conta.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
            </button>
          ),
        }}
        createAction={{ label: 'Nova conta bancária', onClick: abrirNova }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar conta bancária' : 'Nova conta bancária'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="conta-nome" className="mb-1 block text-sm font-medium text-black">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  id="conta-nome"
                  type="text"
                  value={form.nome}
                  onChange={(event) => atualizarCampo('nome', event.target.value)}
                  placeholder="Ex.: CAIXA COFRE"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="conta-banco" className="mb-1 block text-sm font-medium text-black">
                    Banco
                  </label>
                  <input
                    id="conta-banco"
                    type="text"
                    value={form.banco}
                    onChange={(event) => atualizarCampo('banco', event.target.value)}
                    placeholder="Ex.: Bradesco"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="conta-agencia"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Agência
                  </label>
                  <input
                    id="conta-agencia"
                    type="text"
                    value={form.agencia}
                    onChange={(event) => atualizarCampo('agencia', event.target.value)}
                    placeholder="Ex.: 1234-5"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="conta-numero"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Número
                  </label>
                  <input
                    id="conta-numero"
                    type="text"
                    value={form.numero}
                    onChange={(event) => atualizarCampo('numero', event.target.value)}
                    placeholder="Ex.: 98765-0"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="conta-saldo"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Saldo inicial (R$)
                  </label>
                  <input
                    id="conta-saldo"
                    type="text"
                    inputMode="decimal"
                    value={form.saldoInicial}
                    onChange={(event) => atualizarCampo('saldoInicial', event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Aceita vírgula ou ponto. Deixe vazio para começar em zero.
                  </p>
                </div>
                <div className="flex items-end pb-6 text-sm text-gray-500">
                  Banco, agência e número são opcionais — contas de caixa físico ficam em branco.
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
        title="Excluir conta bancária"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? A conta é desativada (soft delete) e o histórico de movimentos é preservado.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
