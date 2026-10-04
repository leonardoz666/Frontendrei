'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react'
import { apiFetch, fetchList } from '@/app/lib/api'
import { comoDecimalDigitado, comoNumero } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

type Insumo = {
  id: number
  codigo: string
  nome: string
  unidade: string
  saldoAtual: number | string
  estoqueMin: number | string
  ativo: boolean
}

function quantidade(valor: unknown, unidade?: string): string {
  return `${comoNumero(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${unidade ?? ''}`.trim()
}

function diferencaTexto(diferenca: number, unidade?: string): string {
  if (diferenca === 0) return 'Sem ajuste'
  const prefixo = diferenca > 0 ? '+' : '-'
  return `${prefixo}${quantidade(Math.abs(diferenca), unidade)}`
}

export default function InventarioEstoquePage() {
  const { showToast } = useToast()
  const [insumoId, setInsumoId] = useState('')
  const [contado, setContado] = useState('')
  const [documento, setDocumento] = useState('')
  const [motivo, setMotivo] = useState('Contagem de inventário')
  const [salvando, setSalvando] = useState(false)

  const { data: insumos = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inventario-insumos'],
    queryFn: () => fetchList<Insumo>('/insumos?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })

  const insumosOrdenados = useMemo(
    () => [...insumos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [insumos]
  )
  const insumo = insumosOrdenados.find((item) => String(item.id) === insumoId) ?? null
  const saldoAtual = insumo ? comoNumero(insumo.saldoAtual) : 0
  const saldoContado = contado.trim() ? comoDecimalDigitado(contado) : null
  const diferenca = saldoContado === null ? null : saldoContado - saldoAtual

  const registrar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!insumo) {
      showToast('Selecione um insumo', 'error')
      return
    }
    if (saldoContado === null || saldoContado < 0) {
      showToast('Informe uma contagem válida', 'error')
      return
    }
    if (diferenca === null || Math.abs(diferenca) < 0.0005) {
      showToast('Saldo contado igual ao saldo atual. Nenhum ajuste necessário.', 'success')
      return
    }

    setSalvando(true)
    try {
      await apiFetch('/insumos/movimentos', {
        method: 'POST',
        body: {
          insumoId: insumo.id,
          tipo: 'INVENTARIO',
          sentido: diferenca > 0 ? 'ENTRADA' : 'SAIDA',
          quantidade: Math.abs(diferenca),
          documento: documento.trim() || null,
          motivo: motivo.trim() || 'Contagem de inventário',
        },
      })
      showToast('Inventário registrado e saldo ajustado.', 'success')
      setContado('')
      setDocumento('')
      setMotivo('Contagem de inventário')
      await refetch()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Falha ao registrar inventário', 'error')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-8">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/estoque"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-black">Inventário</h1>
            <p className="mt-1 text-sm text-gray-600">
              Lance a contagem física; o sistema registra um movimento de inventário apenas pela diferença.
            </p>
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

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <form onSubmit={registrar} className="space-y-4">
          <div>
            <label htmlFor="inventario-insumo" className="mb-1 block text-sm font-medium text-black">Insumo</label>
            <select
              id="inventario-insumo"
              value={insumoId}
              onChange={(event) => setInsumoId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
              disabled={isLoading}
              required
            >
              <option value="">Selecione</option>
              {insumosOrdenados.map((item) => (
                <option key={item.id} value={item.id}>{item.codigo} · {item.nome}</option>
              ))}
            </select>
          </div>

          {insumo && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Saldo atual</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{quantidade(insumo.saldoAtual, insumo.unidade)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Mínimo</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{quantidade(insumo.estoqueMin, insumo.unidade)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Ajuste previsto</p>
                <p className={`mt-1 text-lg font-bold ${diferenca && diferenca < 0 ? 'text-red-700' : diferenca && diferenca > 0 ? 'text-green-700' : 'text-gray-900'}`}>
                  {diferenca === null ? '...' : diferencaTexto(diferenca, insumo.unidade)}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="inventario-contado" className="mb-1 block text-sm font-medium text-black">Saldo contado</label>
              <input
                id="inventario-contado"
                inputMode="decimal"
                value={contado}
                onChange={(event) => setContado(event.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>
            <div>
              <label htmlFor="inventario-documento" className="mb-1 block text-sm font-medium text-black">Documento</label>
              <input
                id="inventario-documento"
                value={documento}
                onChange={(event) => setDocumento(event.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="inventario-motivo" className="mb-1 block text-sm font-medium text-black">Motivo</label>
            <textarea
              id="inventario-motivo"
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              className="min-h-20 w-full rounded-lg border border-gray-300 p-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={salvando || !insumo}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {salvando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Registrar inventário
            </button>
          </div>
        </form>
      </section>

    </main>
  )
}
