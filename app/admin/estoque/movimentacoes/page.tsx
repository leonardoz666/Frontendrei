'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { Switch } from '@/app/components/ui/Switch'
import { ExportMenu } from '@/app/components/ui/ExportMenu'
import { apiFetch, fetchList } from '@/app/lib/api'
import { usePagedQuery } from '@/app/lib/pagination'
import { comoDecimalDigitado, comoNumero, formatarMoeda, paginaAtual, useListaCrud } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

const RESOURCE = '/insumos/movimentos'

type Insumo = {
  id: number
  codigo: string
  nome: string
  unidade: string
  saldoAtual?: number | string
}

type Movimento = {
  id: number
  tipo: string
  sentido: 'ENTRADA' | 'SAIDA' | 'NEUTRO'
  quantidade: number | string
  custoUnitario: number | string | null
  motivo: string | null
  documento: string | null
  criadoEm: string
  insumo?: Insumo
  usuario?: { id: number; nome: string }
}

type FormState = {
  insumoId: string
  tipo: string
  sentido: string
  quantidade: string
  custoUnitario: string
  documento: string
  motivo: string
  permitirNegativo: boolean
}

const FORM_VAZIO: FormState = {
  insumoId: '',
  tipo: 'ENTRADA',
  sentido: '',
  quantidade: '',
  custoUnitario: '',
  documento: '',
  motivo: '',
  permitirNegativo: false,
}

const TIPOS = ['ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA', 'INVENTARIO'] as const

function quantidade(valor: unknown, unidade?: string): string {
  return `${comoNumero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${unidade ?? ''}`.trim()
}

function sinal(sentido: Movimento['sentido']) {
  if (sentido === 'ENTRADA') return <ArrowUpCircle className="h-4 w-4 text-green-600" />
  if (sentido === 'SAIDA') return <ArrowDownCircle className="h-4 w-4 text-red-600" />
  return <span className="h-4 w-4 rounded-full bg-gray-300" />
}

function MovimentacoesEstoqueContent() {
  const { showToast } = useToast()
  const searchParams = useSearchParams()
  const insumoInicial = searchParams.get('insumoId') ?? ''
  const ui = useListaCrud(RESOURCE)
  const { data, isLoading, isError, error, refetch } = usePagedQuery<Movimento>({
    ...ui.listaParams,
    resource: insumoInicial ? `${RESOURCE}?insumoId=${insumoInicial}` : RESOURCE,
  })
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const { data: insumos = [] } = useQuery({
    queryKey: ['movimentos-insumos-select'],
    queryFn: () => fetchList<Insumo>('/insumos?page=1&pageSize=100&ativo=true'),
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>({ ...FORM_VAZIO, insumoId: insumoInicial })
  const [salvando, setSalvando] = useState(false)

  const insumosSelect = useMemo(
    () => [...insumos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [insumos]
  )

  const abrirForm = () => {
    setForm({ ...FORM_VAZIO, insumoId: insumoInicial })
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setForm({ ...FORM_VAZIO, insumoId: insumoInicial })
  }

  const atualizarCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()
    const insumoId = Number(form.insumoId)
    const quantidade = comoDecimalDigitado(form.quantidade)
    const custoUnitario = form.custoUnitario.trim() ? comoDecimalDigitado(form.custoUnitario) : null

    if (!Number.isInteger(insumoId) || insumoId < 1 || quantidade === null || quantidade <= 0) {
      showToast('Informe insumo e quantidade válida', 'error')
      return
    }
    if (custoUnitario !== null && custoUnitario < 0) {
      showToast('Custo unitário inválido', 'error')
      return
    }

    setSalvando(true)
    try {
      await apiFetch(RESOURCE, {
        method: 'POST',
        body: {
          insumoId,
          tipo: form.tipo,
          sentido: form.sentido || undefined,
          quantidade,
          custoUnitario,
          documento: form.documento.trim() || null,
          motivo: form.motivo.trim() || null,
          permitirNegativo: form.permitirNegativo,
        },
      })
      showToast('Movimento registrado', 'success')
      fecharForm()
      ui.reiniciarPagina()
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao registrar movimento', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const columns: Array<DataTableColumn<Movimento>> = [
    {
      key: 'sinal',
      header: '',
      align: 'center',
      render: (movimento) => sinal(movimento.sentido),
    },
    {
      key: 'criadoEm',
      header: 'Data',
      sortKey: 'criadoEm',
      render: (movimento) => (
        <span className="text-gray-700">{new Date(movimento.criadoEm).toLocaleString('pt-BR')}</span>
      ),
    },
    {
      key: 'insumo',
      header: 'Insumo',
      render: (movimento) => (
        <div>
          <span className="font-medium text-gray-900">{movimento.insumo?.nome ?? `#${movimento.id}`}</span>
          <span className="block font-mono text-xs text-gray-500">{movimento.insumo?.codigo ?? ''}</span>
        </div>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortKey: 'tipo',
      render: (movimento) => <span className="text-gray-700">{movimento.tipo}</span>,
    },
    {
      key: 'quantidade',
      header: 'Quantidade',
      sortKey: 'quantidade',
      align: 'right',
      render: (movimento) => (
        <span className="text-gray-700">{quantidade(movimento.quantidade, movimento.insumo?.unidade)}</span>
      ),
    },
    {
      key: 'custo',
      header: 'Custo',
      hideOnMobile: true,
      align: 'right',
      render: (movimento) => <span className="text-gray-700">{formatarMoeda(movimento.custoUnitario)}</span>,
    },
    {
      key: 'motivo',
      header: 'Motivo',
      hideOnMobile: true,
      render: (movimento) => <span className="text-gray-600">{movimento.motivo ?? movimento.documento ?? '—'}</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Movimentações de estoque</h1>
      <p className="mb-6 text-sm text-gray-600">
        Registre entradas, saídas, perdas e inventários. Movimentos são auditados e não são editados.
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar movimentos'}
        </div>
      )}

      <DataTable
        ariaLabel="Movimentações de estoque"
        columns={columns}
        data={pagina.data}
        getRowId={(movimento) => movimento.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="movimentos"
        storageKey="admin-estoque-movimentacoes"
        emptyMessage="Nenhum movimento encontrado"
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        toolbar={
          <ExportMenu
            fileName="movimentacoes-estoque"
            title="Movimentações de estoque"
            getRows={() => pagina.data.map((movimento) => ({
              data: new Date(movimento.criadoEm).toLocaleString('pt-BR'),
              codigo: movimento.insumo?.codigo ?? '',
              insumo: movimento.insumo?.nome ?? '',
              tipo: movimento.tipo,
              sentido: movimento.sentido,
              quantidade: comoNumero(movimento.quantidade),
              unidade: movimento.insumo?.unidade ?? '',
              custoUnitario: comoNumero(movimento.custoUnitario),
              motivo: movimento.motivo ?? '',
              documento: movimento.documento ?? '',
            }))}
          />
        }
        createAction={{ label: 'Novo movimento', onClick: abrirForm }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">Novo movimento</h2>
            </div>
            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="mov-insumo" className="mb-1 block text-sm font-medium text-black">Insumo</label>
                <select id="mov-insumo" value={form.insumoId} onChange={(event) => atualizarCampo('insumoId', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required>
                  <option value="">Selecione</option>
                  {insumosSelect.map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>{insumo.codigo} · {insumo.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="mov-tipo" className="mb-1 block text-sm font-medium text-black">Tipo</label>
                  <select id="mov-tipo" value={form.tipo} onChange={(event) => atualizarCampo('tipo', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black">
                    {TIPOS.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="mov-sentido" className="mb-1 block text-sm font-medium text-black">Sentido</label>
                  <select id="mov-sentido" value={form.sentido} onChange={(event) => atualizarCampo('sentido', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black">
                    <option value="">Automático</option>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mov-qtd" className="mb-1 block text-sm font-medium text-black">Quantidade</label>
                  <input id="mov-qtd" inputMode="decimal" value={form.quantidade} onChange={(event) => atualizarCampo('quantidade', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" required />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="mov-custo" className="mb-1 block text-sm font-medium text-black">Custo unitário</label>
                  <input id="mov-custo" inputMode="decimal" value={form.custoUnitario} onChange={(event) => atualizarCampo('custoUnitario', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
                <div>
                  <label htmlFor="mov-doc" className="mb-1 block text-sm font-medium text-black">Documento</label>
                  <input id="mov-doc" value={form.documento} onChange={(event) => atualizarCampo('documento', event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-black" />
                </div>
              </div>

              <div>
                <label htmlFor="mov-motivo" className="mb-1 block text-sm font-medium text-black">Motivo</label>
                <textarea id="mov-motivo" value={form.motivo} onChange={(event) => atualizarCampo('motivo', event.target.value)} className="min-h-20 w-full rounded-lg border border-gray-300 p-2 text-black" />
              </div>

              <Switch
                checked={form.permitirNegativo}
                onCheckedChange={(checked) => atualizarCampo('permitirNegativo', checked)}
                label="Autorizar saldo negativo"
                description="O movimento só será aceito quando sua permissão também permitir."
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={fecharForm} disabled={salvando}>Cancelar</Button>
                <Button type="submit" isLoading={salvando}>Registrar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MovimentacoesEstoquePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-4 text-sm text-gray-600 sm:p-6 lg:p-8">Carregando movimentações...</div>}>
      <MovimentacoesEstoqueContent />
    </Suspense>
  )
}
