'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Package, Search, ShoppingCart, TrendingUp } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'

type Period = 'today' | 'week' | 'month'

type RankedProduct = {
  id: number
  name: string
  active: boolean
  quantity: number
  revenue: number
}

type RankingResponse = {
  period: Period
  products: RankedProduct[]
  summary: {
    totalProducts: number
    productsWithSales: number
    unitsSold: number
    revenue: number
  }
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Este mês' },
]

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function positionClass(index: number): string {
  if (index === 0) return 'border-amber-300 bg-amber-100 text-amber-900'
  if (index === 1) return 'border-slate-300 bg-slate-100 text-slate-700'
  if (index === 2) return 'border-orange-300 bg-orange-100 text-orange-900'
  return 'border-slate-200 bg-white text-slate-600'
}

export default function RankingVendasPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [search, setSearch] = useState('')
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    apiFetch<RankingResponse>(`/dashboard/product-ranking?period=${period}`)
      .then(response => {
        if (!cancelled) setData(response)
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Erro ao carregar o ranking')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [period])

  const products = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    const ranked = (data?.products ?? []).map((product, index) => ({ ...product, position: index + 1 }))
    if (!query) return ranked
    return ranked.filter(product => product.name.toLocaleLowerCase('pt-BR').includes(query))
  }, [data?.products, search])

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-700">
              <BarChart3 size={18} aria-hidden="true" />
              Desempenho do cardápio
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Ranking de vendas</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
              Todos os produtos, ordenados da maior para a menor quantidade vendida.
            </p>
          </div>

          <div className="grid grid-cols-3 rounded-xl border border-slate-300 bg-slate-200/70 p-1 shadow-sm" aria-label="Período do ranking">
            {PERIODS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                aria-pressed={period === option.value}
                className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 sm:text-sm ${
                  period === option.value
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-white hover:text-slate-950'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo do período">
          {[
            { label: 'Produtos no cardápio', value: data?.summary.totalProducts ?? 0, icon: Package },
            { label: 'Produtos com venda', value: data?.summary.productsWithSales ?? 0, icon: TrendingUp },
            { label: 'Unidades vendidas', value: data?.summary.unitsSold ?? 0, icon: ShoppingCart },
            { label: 'Faturamento listado', value: currency.format(data?.summary.revenue ?? 0), icon: BarChart3 },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <item.icon className="mb-3 text-orange-600" size={20} aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-500">{item.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-950">Produtos por quantidade vendida</h2>
              <p className="text-sm text-slate-500">Produtos sem saída aparecem no fim da lista.</p>
            </div>
            <label className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100 sm:w-72">
              <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Buscar produto</span>
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar produto"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-sm font-medium text-slate-500">Carregando ranking...</div>
          ) : error ? (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>
          ) : products.length === 0 ? (
            <div className="flex min-h-64 items-center justify-center px-4 text-center text-sm font-medium text-slate-500">
              Nenhum produto corresponde à busca.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              <div className="hidden grid-cols-[72px_minmax(0,1fr)_150px_170px] gap-4 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-600 md:grid">
                <span>Posição</span>
                <span>Produto</span>
                <span className="text-right">Quantidade</span>
                <span className="text-right">Faturamento</span>
              </div>
              {products.map(product => (
                <article key={product.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-4 md:grid-cols-[72px_minmax(0,1fr)_150px_170px] md:gap-4 md:px-5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-extrabold ${positionClass(product.position - 1)}`}>
                    {product.position}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-950 sm:text-base">{product.name}</h3>
                      {!product.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Inativo</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 md:hidden">{currency.format(product.revenue)}</p>
                  </div>
                  <div className="col-start-2 flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2 md:col-auto md:block md:bg-transparent md:px-0 md:py-0 md:text-right">
                    <span className="text-xs font-medium text-slate-500 md:hidden">Vendido</span>
                    <span className={`text-base font-extrabold ${product.quantity > 0 ? 'text-orange-700' : 'text-slate-400'}`}>
                      {product.quantity}
                    </span>
                  </div>
                  <p className="hidden text-right text-sm font-bold text-slate-800 md:block">{currency.format(product.revenue)}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
