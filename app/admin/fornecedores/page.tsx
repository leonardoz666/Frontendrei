'use client'

import { useState } from 'react'
import { Mail, Power, PowerOff, Phone } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { usePagedQuery } from '@/app/lib/pagination'
import { useCrud, useListaCrud, paginaAtual, SeloAtivo } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Fornecedores — PRD seção 7 (Módulo 4), padrão RF-UI-01.
 *
 * Campos: `nome` (obrigatório), `documento` (CNPJ/CPF, ÚNICO e opcional),
 * `email`, `telefone`, `contato` (nome da pessoa) e `ativo`.
 *
 * `documento` vazio é enviado como `null`, nunca como `''`: no Postgres vários
 * `NULL` convivem sob o índice único, mas dois `''` colidem — é o comentário do
 * backend em `fornecedores.ts`.
 */

const RESOURCE = '/fornecedores'

type Fornecedor = {
  id: number
  nome: string
  documento: string | null
  email: string | null
  telefone: string | null
  contato: string | null
  ativo: boolean
}

type FormState = {
  nome: string
  documento: string
  email: string
  telefone: string
  contato: string
}

const FORM_VAZIO: FormState = { nome: '', documento: '', email: '', telefone: '', contato: '' }

/** Validação simples: só barra e-mail claramente inválido, sem exigir RFC. */
const EMAIL_SIMPLES = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function FornecedoresPage() {
  const { showToast } = useToast()
  const crud = useCrud<Fornecedor>({ resource: RESOURCE, entidade: 'Fornecedor' })
  const ui = useListaCrud(RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<Fornecedor>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Fornecedor | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Fornecedor | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)

  const abrirNovo = () => {
    setEditing(null)
    setForm(FORM_VAZIO)
    setShowForm(true)
  }

  const abrirEdicao = (fornecedor: Fornecedor) => {
    setEditing(fornecedor)
    setForm({
      nome: fornecedor.nome,
      documento: fornecedor.documento ?? '',
      email: fornecedor.email ?? '',
      telefone: fornecedor.telefone ?? '',
      contato: fornecedor.contato ?? '',
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
      showToast('Informe o nome do fornecedor', 'error')
      return
    }

    const email = form.email.trim()
    if (email !== '' && !EMAIL_SIMPLES.test(email)) {
      showToast('E-mail inválido', 'error')
      return
    }

    const documento = form.documento.trim()
    const corpo = {
      nome,
      documento: documento === '' ? null : documento,
      email: email === '' ? null : email,
      telefone: form.telefone.trim() === '' ? null : form.telefone.trim(),
      contato: form.contato.trim() === '' ? null : form.contato.trim(),
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

  const alternar = async (fornecedor: Fornecedor) => {
    setAlternandoId(fornecedor.id)
    const atualizado = await crud.alternarAtivo(fornecedor.id, !fornecedor.ativo)
    setAlternandoId(null)

    if (atualizado === null) return
    showToast(`Fornecedor ${atualizado.ativo ? 'ativado' : 'desativado'}`, 'success')
    void refetch()
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)

    const excluido = await crud.excluir(alvo.id)
    if (excluido === null) return

    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<Fornecedor>> = [
    {
      key: 'nome',
      header: 'Fornecedor',
      sortKey: 'nome',
      render: (fornecedor) => (
        <div>
          <span className="font-medium text-gray-900">{fornecedor.nome}</span>
          {fornecedor.documento && (
            <span className="block text-xs text-gray-500 md:hidden">{fornecedor.documento}</span>
          )}
        </div>
      ),
    },
    {
      key: 'documento',
      header: 'CNPJ/CPF',
      sortKey: 'documento',
      hideOnMobile: true,
      render: (fornecedor) => (
        <span className="font-mono text-xs text-gray-700">{fornecedor.documento ?? '—'}</span>
      ),
    },
    {
      key: 'contato',
      header: 'Contato',
      render: (fornecedor) => (
        <span className="text-gray-700">{fornecedor.contato ?? '—'}</span>
      ),
    },
    {
      key: 'telefone',
      header: 'Telefone',
      hideOnMobile: true,
      render: (fornecedor) =>
        fornecedor.telefone ? (
          <span className="inline-flex items-center gap-1 text-gray-700">
            <Phone className="h-3.5 w-3.5 text-gray-400" />
            {fornecedor.telefone}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'email',
      header: 'E-mail',
      hideOnMobile: true,
      render: (fornecedor) =>
        fornecedor.email ? (
          <a
            href={`mailto:${fornecedor.email}`}
            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          >
            <Mail className="h-3.5 w-3.5 text-gray-400" />
            {fornecedor.email}
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (fornecedor) => <SeloAtivo ativo={fornecedor.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Fornecedores</h1>
      <p className="mb-6 text-sm text-gray-600">
        Cadastro usado pelas compras e pelo controle de insumos. O CNPJ/CPF é opcional, mas único
        quando informado.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar fornecedores'}
        </div>
      )}

      <DataTable<Fornecedor>
        ariaLabel="Listagem de fornecedores"
        columns={columns}
        data={pagina.data}
        getRowId={(fornecedor) => fornecedor.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="fornecedores"
        storageKey="admin-fornecedores"
        emptyMessage="Nenhum fornecedor encontrado"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Cadastre o primeiro fornecedor abaixo.'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar fornecedor',
          deleteLabel: 'Excluir fornecedor',
          extra: (fornecedor) => (
            <button
              type="button"
              title={fornecedor.ativo ? 'Desativar' : 'Ativar'}
              aria-label={fornecedor.ativo ? 'Desativar fornecedor' : 'Ativar fornecedor'}
              disabled={alternandoId === fornecedor.id}
              onClick={() => void alternar(fornecedor)}
              className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
            >
              {fornecedor.ativo ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
            </button>
          ),
        }}
        createAction={{ label: 'Novo fornecedor', onClick: abrirNovo }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar fornecedor' : 'Novo fornecedor'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="fornecedor-nome"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fornecedor-nome"
                    type="text"
                    value={form.nome}
                    onChange={(event) => atualizarCampo('nome', event.target.value)}
                    placeholder="Ex.: Distribuidora de Pescados Ltda"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="fornecedor-documento"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    CNPJ/CPF
                  </label>
                  <input
                    id="fornecedor-documento"
                    type="text"
                    value={form.documento}
                    onChange={(event) => atualizarCampo('documento', event.target.value)}
                    placeholder="Somente números ou com pontuação"
                    className="w-full rounded-lg border border-gray-300 p-2 font-mono text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">Opcional. Não pode repetir.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="fornecedor-contato"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Contato
                  </label>
                  <input
                    id="fornecedor-contato"
                    type="text"
                    value={form.contato}
                    onChange={(event) => atualizarCampo('contato', event.target.value)}
                    placeholder="Nome do vendedor / responsável"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fornecedor-telefone"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Telefone
                  </label>
                  <input
                    id="fornecedor-telefone"
                    type="tel"
                    value={form.telefone}
                    onChange={(event) => atualizarCampo('telefone', event.target.value)}
                    placeholder="(71) 90000-0000"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="fornecedor-email"
                  className="mb-1 block text-sm font-medium text-black"
                >
                  E-mail
                </label>
                <input
                  id="fornecedor-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => atualizarCampo('email', event.target.value)}
                  placeholder="compras@fornecedor.com.br"
                  className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
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
        title="Excluir fornecedor"
        description={
          paraExcluir
            ? `Tem certeza que deseja excluir "${paraExcluir.nome}"? O fornecedor é desativado (soft delete) e o histórico de compras é preservado.`
            : ''
        }
        confirmText="Excluir"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />
    </div>
  )
}
