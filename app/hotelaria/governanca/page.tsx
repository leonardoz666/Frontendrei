'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, Sparkles } from 'lucide-react'
import { apiFetch, fetchList } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

type Unidade = {
  id: number
  nome: string
  tipo: string | null
  capacidade: number
  statusGovernanca: string
  ativo: boolean
  _count?: { reservas: number }
}

const COLUNAS = [
  { status: 'LIMPO', titulo: 'Limpo', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { status: 'SUJO', titulo: 'Sujo', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  { status: 'EM_LIMPEZA', titulo: 'Em limpeza', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  { status: 'MANUTENCAO', titulo: 'Manutenção', className: 'border-red-200 bg-red-50 text-red-800' },
  { status: 'BLOQUEADO', titulo: 'Bloqueado', className: 'border-gray-200 bg-gray-100 text-gray-700' },
]

export default function GovernancaHotelariaPage() {
  const { showToast } = useToast()
  const [alterandoId, setAlterandoId] = useState<number | null>(null)
  const { data: unidades = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['hotelaria-governanca-unidades'],
    queryFn: () => fetchList<Unidade>('/hotelaria/unidades?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })

  const porStatus = useMemo(() => {
    const mapa = new Map<string, Unidade[]>()
    for (const coluna of COLUNAS) mapa.set(coluna.status, [])
    for (const unidade of unidades) {
      const lista = mapa.get(unidade.statusGovernanca) ?? mapa.get('BLOQUEADO')
      lista?.push(unidade)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    return mapa
  }, [unidades])

  const mover = async (unidade: Unidade, statusGovernanca: string) => {
    setAlterandoId(unidade.id)
    try {
      await apiFetch(`/hotelaria/unidades/${unidade.id}/governanca`, {
        method: 'PATCH',
        body: { statusGovernanca },
      })
      showToast('Status de governança atualizado', 'success')
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar governança', 'error')
    } finally {
      setAlterandoId(null)
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Link href="/hotelaria" className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-black">Governança</h1>
            <p className="mt-1 text-sm text-gray-600">Acompanhe limpeza, manutenção e bloqueios das unidades.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </header>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar unidades'}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-5">
        {COLUNAS.map((coluna) => {
          const itens = porStatus.get(coluna.status) ?? []
          return (
            <div key={coluna.status} className="rounded-lg border border-gray-200 bg-white">
              <div className={`flex items-center justify-between gap-2 border-b px-3 py-3 ${coluna.className}`}>
                <h2 className="text-sm font-bold">{coluna.titulo}</h2>
                <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-bold">{itens.length}</span>
              </div>

              {isLoading ? (
                <div className="p-4 text-sm text-gray-500">Carregando...</div>
              ) : itens.length === 0 ? (
                <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-gray-400">
                  <Sparkles className="h-5 w-5" />
                  Nenhuma unidade
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  {itens.map((unidade) => (
                    <article key={unidade.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-2">
                        <p className="text-sm font-semibold text-gray-900">{unidade.nome}</p>
                        <p className="text-xs text-gray-500">{unidade.tipo ?? 'Unidade'} · {unidade.capacidade} pessoa(s)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {COLUNAS.filter((destino) => destino.status !== unidade.statusGovernanca).map((destino) => (
                          <button
                            key={destino.status}
                            type="button"
                            onClick={() => void mover(unidade, destino.status)}
                            disabled={alterandoId === unidade.id}
                            className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                          >
                            {destino.titulo}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>
    </main>
  )
}
