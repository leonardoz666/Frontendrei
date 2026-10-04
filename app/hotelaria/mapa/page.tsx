'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, RefreshCw } from 'lucide-react'
import { fetchList } from '@/app/lib/api'

type Unidade = {
  id: number
  nome: string
  tipo: string | null
  statusGovernanca: string
  ativo: boolean
}

type Hospede = {
  id: number
  nome: string
}

type Reserva = {
  id: number
  codigo: string
  status: string
  checkinPrevisto: string
  checkoutPrevisto: string
  hospede?: Hospede
  unidade?: Unidade
}

const OPCOES_DIAS = [7, 14, 30] as const
const MS_DIA = 24 * 60 * 60 * 1000

function isoDia(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function labelDia(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function ocupaDia(reserva: Reserva, diaIso: string): boolean {
  const inicio = reserva.checkinPrevisto.slice(0, 10)
  const fim = reserva.checkoutPrevisto.slice(0, 10)
  return inicio <= diaIso && diaIso < fim
}

function corStatus(status: string): string {
  if (status === 'HOSPEDADO') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (status === 'PRE_CHECKIN') return 'bg-sky-100 text-sky-800 border-sky-200'
  if (status === 'CHECKOUT') return 'bg-gray-100 text-gray-700 border-gray-200'
  if (status === 'CANCELADA' || status === 'NO_SHOW') return 'bg-red-50 text-red-700 border-red-100'
  return 'bg-orange-100 text-orange-800 border-orange-200'
}

export default function MapaHotelariaPage() {
  const [dias, setDias] = useState<(typeof OPCOES_DIAS)[number]>(14)
  const [inicio, setInicio] = useState(() => isoDia(new Date()))

  const { data: unidades = [], isFetching: carregandoUnidades, refetch: refetchUnidades } = useQuery({
    queryKey: ['hotelaria-mapa-unidades'],
    queryFn: () => fetchList<Unidade>('/hotelaria/unidades?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })
  const { data: reservas = [], isFetching: carregandoReservas, refetch: refetchReservas } = useQuery({
    queryKey: ['hotelaria-mapa-reservas'],
    queryFn: () => fetchList<Reserva>('/hotelaria/reservas?page=1&pageSize=100&sort=checkinPrevisto&order=asc'),
  })

  const datas = useMemo(() => {
    const base = new Date(`${inicio}T00:00:00.000Z`)
    return Array.from({ length: dias }, (_, index) => new Date(base.getTime() + index * MS_DIA))
  }, [dias, inicio])

  const unidadesOrdenadas = useMemo(() => [...unidades].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [unidades])
  const reservasAtivas = useMemo(
    () => reservas.filter((reserva) => !['CANCELADA', 'NO_SHOW'].includes(reserva.status)),
    [reservas]
  )

  const atualizar = () => {
    void refetchUnidades()
    void refetchReservas()
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/hotelaria" className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-black">Mapa de reservas</h1>
            <p className="mt-1 text-sm text-gray-600">Visualização por unidade e período para ocupação 7/14/30 dias.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={atualizar}
          disabled={carregandoUnidades || carregandoReservas}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${carregandoUnidades || carregandoReservas ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </header>

      <section className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-end">
          <div>
            <label htmlFor="inicio" className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Início</label>
            <input
              id="inicio"
              type="date"
              value={inicio}
              onChange={(event) => setInicio(event.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2 text-black"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Período</label>
            <div className="flex flex-wrap gap-2">
              {OPCOES_DIAS.map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setDias(opcao)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${dias === opcao ? 'border-orange-600 bg-orange-50 text-orange-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}`}
                >
                  {opcao} dias
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="min-w-[900px]">
          <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: `180px repeat(${datas.length}, minmax(72px, 1fr))` }}>
            <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-500">Unidade</div>
            {datas.map((data) => (
              <div key={isoDia(data)} className="border-l border-gray-200 px-2 py-2 text-center text-xs font-semibold text-gray-700">
                {labelDia(data)}
              </div>
            ))}
          </div>

          {unidadesOrdenadas.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Nenhuma unidade ativa cadastrada.</div>
          ) : (
            unidadesOrdenadas.map((unidade) => (
              <div key={unidade.id} className="grid border-b border-gray-100 last:border-b-0" style={{ gridTemplateColumns: `180px repeat(${datas.length}, minmax(72px, 1fr))` }}>
                <div className="px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{unidade.nome}</p>
                  <p className="text-xs text-gray-500">{unidade.tipo ?? 'Unidade'} · {unidade.statusGovernanca}</p>
                </div>
                {datas.map((data) => {
                  const diaIso = isoDia(data)
                  const reserva = reservasAtivas.find((item) => item.unidade?.id === unidade.id && ocupaDia(item, diaIso))
                  return (
                    <div key={`${unidade.id}-${diaIso}`} className="min-h-16 border-l border-gray-100 p-1">
                      {reserva ? (
                        <Link
                          href="/hotelaria/reservas"
                          className={`block rounded border px-2 py-1 text-xs font-semibold ${corStatus(reserva.status)}`}
                          title={`${reserva.codigo} · ${reserva.hospede?.nome ?? ''}`}
                        >
                          <span className="block truncate">{reserva.codigo}</span>
                          <span className="block truncate font-normal">{reserva.hospede?.nome ?? reserva.status}</span>
                        </Link>
                      ) : (
                        <div className="flex h-full min-h-12 items-center justify-center text-gray-300">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
