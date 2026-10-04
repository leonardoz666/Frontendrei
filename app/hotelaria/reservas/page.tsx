'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { apiFetch, fetchList, toApiPath } from '@/app/lib/api'
import { formatarMoeda, paginaAtual, useListaCrud } from '@/app/lib/crud-client'
import { usePagedQuery } from '@/app/lib/pagination'
import { useToast } from '@/contexts/ToastContext'

type Unidade = {
  id: number
  nome: string
  tipo: string | null
  diaria: number | string
  statusGovernanca: string
}

type Hospede = {
  id: number
  nome: string
  documento: string
}

type Reserva = {
  id: number
  codigo: string
  status: string
  checkinPrevisto: string
  checkoutPrevisto: string
  valorDiaria: number | string
  hospede?: Hospede
  unidade?: Unidade
}

type ReservaForm = {
  hospedeId: string
  unidadeId: string
  checkinPrevisto: string
  checkoutPrevisto: string
  valorDiaria: string
  adultos: string
  criancas: string
}

const RESERVA_VAZIA: ReservaForm = {
  hospedeId: '',
  unidadeId: '',
  checkinPrevisto: '',
  checkoutPrevisto: '',
  valorDiaria: '',
  adultos: '1',
  criancas: '0',
}

function acoesStatus(status: string): Array<{ status: string; label: string }> {
  if (status === 'RESERVADO') {
    return [
      { status: 'PRE_CHECKIN', label: 'Pré-check-in' },
      { status: 'HOSPEDADO', label: 'Check-in' },
      { status: 'CANCELADA', label: 'Cancelar' },
    ]
  }
  if (status === 'PRE_CHECKIN') {
    return [
      { status: 'HOSPEDADO', label: 'Check-in' },
      { status: 'CANCELADA', label: 'Cancelar' },
    ]
  }
  if (status === 'HOSPEDADO') return [{ status: 'CHECKOUT', label: 'Checkout' }]
  return []
}

export default function ReservasPage() {
  const { showToast } = useToast()
  const ui = useListaCrud('/hotelaria/reservas')
  const { data, isLoading, isError, error, refetch } = usePagedQuery<Reserva>(ui.listaParams)
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const { data: unidades = [], refetch: refetchUnidades } = useQuery({
    queryKey: ['hotelaria-unidades-select'],
    queryFn: () => fetchList<Unidade>('/hotelaria/unidades?page=1&pageSize=100&ativo=true'),
  })
  const { data: hospedes = [], refetch: refetchHospedes } = useQuery({
    queryKey: ['hotelaria-hospedes-select'],
    queryFn: () => fetchList<Hospede>('/hotelaria/hospedes?page=1&pageSize=100'),
  })

  const unidadesSelect = useMemo(() => [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [unidades])
  const hospedesSelect = useMemo(() => [...hospedes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [hospedes])

  const [reservaForm, setReservaForm] = useState<ReservaForm>(RESERVA_VAZIA)
  const [unidadeNome, setUnidadeNome] = useState('')
  const [unidadeDiaria, setUnidadeDiaria] = useState('')
  const [hospedeNome, setHospedeNome] = useState('')
  const [hospedeDocumento, setHospedeDocumento] = useState('')
  const [salvandoReserva, setSalvandoReserva] = useState(false)
  const [salvandoUnidade, setSalvandoUnidade] = useState(false)
  const [salvandoHospede, setSalvandoHospede] = useState(false)
  const [alterandoStatusId, setAlterandoStatusId] = useState<number | null>(null)
  const [fnrhInicio, setFnrhInicio] = useState('')
  const [fnrhFim, setFnrhFim] = useState('')

  const criarUnidade = async (event: React.FormEvent) => {
    event.preventDefault()
    const diaria = Number(unidadeDiaria.replace(',', '.'))
    if (!unidadeNome.trim() || !Number.isFinite(diaria)) {
      showToast('Informe unidade e diária', 'error')
      return
    }
    setSalvandoUnidade(true)
    try {
      await apiFetch('/hotelaria/unidades', { method: 'POST', body: { nome: unidadeNome, diaria, capacidade: 1 } })
      showToast('Unidade criada', 'success')
      setUnidadeNome('')
      setUnidadeDiaria('')
      void refetchUnidades()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar unidade', 'error')
    } finally {
      setSalvandoUnidade(false)
    }
  }

  const criarHospede = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!hospedeNome.trim() || !hospedeDocumento.trim()) {
      showToast('Informe hóspede e documento', 'error')
      return
    }
    setSalvandoHospede(true)
    try {
      await apiFetch('/hotelaria/hospedes', { method: 'POST', body: { nome: hospedeNome, documento: hospedeDocumento } })
      showToast('Hóspede criado', 'success')
      setHospedeNome('')
      setHospedeDocumento('')
      void refetchHospedes()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar hóspede', 'error')
    } finally {
      setSalvandoHospede(false)
    }
  }

  const criarReserva = async (event: React.FormEvent) => {
    event.preventDefault()
    const hospedeId = Number(reservaForm.hospedeId)
    const unidadeId = Number(reservaForm.unidadeId)
    const valorDiaria = Number(reservaForm.valorDiaria.replace(',', '.'))
    if (!Number.isInteger(hospedeId) || !Number.isInteger(unidadeId) || !Number.isFinite(valorDiaria)) {
      showToast('Informe hóspede, unidade e diária', 'error')
      return
    }
    setSalvandoReserva(true)
    try {
      await apiFetch('/hotelaria/reservas', {
        method: 'POST',
        body: {
          ...reservaForm,
          hospedeId,
          unidadeId,
          valorDiaria,
          adultos: Number(reservaForm.adultos || 1),
          criancas: Number(reservaForm.criancas || 0),
        },
      })
      showToast('Reserva criada', 'success')
      setReservaForm(RESERVA_VAZIA)
      ui.reiniciarPagina()
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar reserva', 'error')
    } finally {
      setSalvandoReserva(false)
    }
  }

  const alterarStatus = async (reserva: Reserva, status: string) => {
    setAlterandoStatusId(reserva.id)
    try {
      await apiFetch(`/hotelaria/reservas/${reserva.id}/status`, {
        method: 'PATCH',
        body: { status },
      })
      showToast('Status da reserva atualizado', 'success')
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar reserva', 'error')
    } finally {
      setAlterandoStatusId(null)
    }
  }

  const baixarFnrh = () => {
    const params = new URLSearchParams()
    if (fnrhInicio) params.set('inicio', fnrhInicio)
    if (fnrhFim) params.set('fim', fnrhFim)
    const query = params.toString()
    window.location.assign(`${toApiPath('/hotelaria/fnrh.csv')}${query ? `?${query}` : ''}`)
  }

  const columns: Array<DataTableColumn<Reserva>> = [
    { key: 'codigo', header: 'Reserva', sortKey: 'codigo', render: (reserva) => <span className="font-mono text-xs">{reserva.codigo}</span> },
    { key: 'hospede', header: 'Hóspede', render: (reserva) => <span className="font-medium text-gray-900">{reserva.hospede?.nome ?? '—'}</span> },
    { key: 'unidade', header: 'Unidade', render: (reserva) => <span>{reserva.unidade?.nome ?? '—'}</span> },
    { key: 'periodo', header: 'Período', render: (reserva) => <span>{new Date(reserva.checkinPrevisto).toLocaleDateString('pt-BR')} → {new Date(reserva.checkoutPrevisto).toLocaleDateString('pt-BR')}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (reserva) => <span>{reserva.status}</span> },
    { key: 'diaria', header: 'Diária', align: 'right', render: (reserva) => <span>{formatarMoeda(reserva.valorDiaria)}</span> },
  ]

  return (
    <div className="mx-auto max-w-7xl p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Reservas</h1>
      <p className="mb-6 text-sm text-gray-600">Reservas bloqueiam sobreposição de período na mesma unidade.</p>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <form onSubmit={criarUnidade} className="border-y border-gray-200 bg-white py-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Nova unidade</h2>
          <div className="space-y-3">
            <input value={unidadeNome} onChange={(event) => setUnidadeNome(event.target.value)} placeholder="Nome" className="w-full rounded-lg border border-gray-300 p-2 text-black" />
            <div className="flex gap-2">
              <input value={unidadeDiaria} onChange={(event) => setUnidadeDiaria(event.target.value)} placeholder="Diária" className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-black" />
              <Button type="submit" isLoading={salvandoUnidade}>Criar</Button>
            </div>
          </div>
        </form>

        <form onSubmit={criarHospede} className="border-y border-gray-200 bg-white py-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Novo hóspede</h2>
          <div className="space-y-3">
            <input value={hospedeNome} onChange={(event) => setHospedeNome(event.target.value)} placeholder="Nome" className="w-full rounded-lg border border-gray-300 p-2 text-black" />
            <div className="flex gap-2">
              <input value={hospedeDocumento} onChange={(event) => setHospedeDocumento(event.target.value)} placeholder="Documento" className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-black" />
              <Button type="submit" isLoading={salvandoHospede}>Criar</Button>
            </div>
          </div>
        </form>

        <form onSubmit={criarReserva} className="border-y border-gray-200 bg-white py-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Nova reserva</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={reservaForm.hospedeId} onChange={(event) => setReservaForm((atual) => ({ ...atual, hospedeId: event.target.value }))} className="rounded-lg border border-gray-300 p-2 text-black" required>
              <option value="">Hóspede</option>
              {hospedesSelect.map((hospede) => <option key={hospede.id} value={hospede.id}>{hospede.nome}</option>)}
            </select>
            <select value={reservaForm.unidadeId} onChange={(event) => setReservaForm((atual) => ({ ...atual, unidadeId: event.target.value }))} className="rounded-lg border border-gray-300 p-2 text-black" required>
              <option value="">Unidade</option>
              {unidadesSelect.map((unidade) => <option key={unidade.id} value={unidade.id}>{unidade.nome}</option>)}
            </select>
            <input type="date" value={reservaForm.checkinPrevisto} onChange={(event) => setReservaForm((atual) => ({ ...atual, checkinPrevisto: event.target.value }))} className="rounded-lg border border-gray-300 p-2 text-black" required />
            <input type="date" value={reservaForm.checkoutPrevisto} onChange={(event) => setReservaForm((atual) => ({ ...atual, checkoutPrevisto: event.target.value }))} className="rounded-lg border border-gray-300 p-2 text-black" required />
            <input value={reservaForm.valorDiaria} onChange={(event) => setReservaForm((atual) => ({ ...atual, valorDiaria: event.target.value }))} placeholder="Diária" className="rounded-lg border border-gray-300 p-2 text-black" required />
            <Button type="submit" isLoading={salvandoReserva}>Reservar</Button>
          </div>
        </form>
      </div>

      <section className="mb-6 border-y border-gray-200 bg-white py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">FNRH CSV</h2>
            <p className="text-sm text-gray-600">Exportação por período de check-in previsto.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input
              type="date"
              value={fnrhInicio}
              onChange={(event) => setFnrhInicio(event.target.value)}
              className="rounded-lg border border-gray-300 p-2 text-black"
              aria-label="Início FNRH"
            />
            <input
              type="date"
              value={fnrhFim}
              onChange={(event) => setFnrhFim(event.target.value)}
              className="rounded-lg border border-gray-300 p-2 text-black"
              aria-label="Fim FNRH"
            />
            <button
              type="button"
              onClick={baixarFnrh}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              <Download className="h-4 w-4" />
              Baixar
            </button>
          </div>
        </div>
      </section>

      {isError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{(error as Error)?.message ?? 'Falha ao carregar reservas'}</div>}

      <DataTable
        ariaLabel="Reservas"
        columns={columns}
        data={pagina.data}
        getRowId={(reserva) => reserva.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="reservas"
        storageKey="hotelaria-reservas"
        emptyMessage="Nenhuma reserva encontrada"
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          extra: (reserva) => (
            <div className="flex flex-wrap justify-end gap-1">
              {acoesStatus(reserva.status).map((acao) => (
                <button
                  key={acao.status}
                  type="button"
                  disabled={alterandoStatusId === reserva.id}
                  onClick={() => void alterarStatus(reserva, acao.status)}
                  className="rounded px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-40"
                >
                  {acao.label}
                </button>
              ))}
            </div>
          ),
        }}
      />
    </div>
  )
}
