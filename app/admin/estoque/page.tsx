'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, ClipboardList, ClipboardCheck, History, PackageSearch, RefreshCw, Tags } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'

type Meta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type Lista<T> = {
  data: T[]
  meta: Meta
}

type Insumo = {
  id: number
  codigo: string
  nome: string
  unidade: string
  saldoAtual: number | string
  estoqueMin: number | string
  estoqueMax: number | string
  subgrupo?: { nome: string; grupo?: { nome: string } }
}

type Movimento = {
  id: number
  tipo: string
  sentido: 'ENTRADA' | 'SAIDA' | 'NEUTRO'
  quantidade: number | string
  criadoEm: string
  motivo: string | null
  documento: string | null
  insumo?: { id: number; codigo: string; nome: string; unidade: string }
}

const MODULOS = [
  {
    href: '/admin/estoque/grupos',
    titulo: 'Grupos e subgrupos',
    descricao: 'Classificação dos insumos.',
    icon: Tags,
  },
  {
    href: '/admin/estoque/insumos',
    titulo: 'Insumos',
    descricao: 'Cadastro, mínimos, máximos e custo médio.',
    icon: PackageSearch,
  },
  {
    href: '/admin/estoque/movimentacoes',
    titulo: 'Movimentações',
    descricao: 'Entradas, saídas, perdas e inventário.',
    icon: History,
  },
  {
    href: '/admin/estoque/inventario',
    titulo: 'Inventário',
    descricao: 'Contagem e ajuste pela diferença encontrada.',
    icon: ClipboardCheck,
  },
  {
    href: '/admin/estoque/ficha-tecnica',
    titulo: 'Ficha técnica',
    descricao: 'Consumo automático por produto vendido.',
    icon: ClipboardList,
  },
]

function quantidade(valor: unknown, unidade?: string): string {
  const numero = typeof valor === 'number' ? valor : Number(String(valor ?? 0).replace(',', '.'))
  return `${(Number.isFinite(numero) ? numero : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} ${unidade ?? ''}`.trim()
}

function formatarData(valor: string): string {
  return new Date(valor).toLocaleString('pt-BR')
}

async function carregarResumo() {
  const [insumos, alertas, movimentos] = await Promise.all([
    apiFetch<Lista<Insumo>>('/insumos?page=1&pageSize=10&ativo=true&sort=nome&order=asc'),
    apiFetch<Lista<Insumo>>('/insumos/alertas?page=1&pageSize=10&sort=saldoAtual&order=asc'),
    apiFetch<Lista<Movimento>>('/insumos/movimentos?page=1&pageSize=5&sort=criadoEm&order=desc')
  ])

  return { insumos, alertas, movimentos }
}

export default function EstoquePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['estoque-resumo'],
    queryFn: carregarResumo,
  })

  const totalInsumos = data?.insumos.meta.total ?? 0
  const totalAlertas = data?.alertas.meta.total ?? 0
  const totalMovimentos = data?.movimentos.meta.total ?? 0

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black">Estoque de insumos</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Gestão de matéria-prima separada do estoque comercial de produtos, com saldos auditados por movimentação.
          </p>
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
          {(error as Error)?.message ?? 'Falha ao carregar resumo de estoque'}
        </div>
      )}

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Insumos ativos</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{isLoading ? '...' : totalInsumos}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Abaixo do mínimo</p>
          <p className={`mt-2 text-3xl font-bold ${totalAlertas > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
            {isLoading ? '...' : totalAlertas}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Movimentos auditados</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{isLoading ? '...' : totalMovimentos}</p>
        </div>
      </section>

      {totalAlertas > 0 && (
        <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-sm font-bold">Alertas de estoque mínimo</h2>
            </div>
            <Link href="/admin/estoque/insumos" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-800 hover:text-amber-900">
              Ver insumos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {data?.alertas.data.map((insumo) => (
              <Link
                key={insumo.id}
                href={`/admin/estoque/movimentacoes?insumoId=${insumo.id}`}
                className="rounded-lg border border-amber-200 bg-white px-3 py-2 hover:bg-amber-50"
              >
                <p className="text-sm font-semibold text-gray-900">{insumo.nome}</p>
                <p className="text-xs text-gray-600">
                  Saldo {quantidade(insumo.saldoAtual, insumo.unidade)} · mínimo {quantidade(insumo.estoqueMin, insumo.unidade)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-4 grid gap-4 md:grid-cols-2">
        {MODULOS.map((modulo) => {
          const Icon = modulo.icon
          return (
            <Link
              key={modulo.href}
              href={modulo.href}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{modulo.titulo}</h2>
              <p className="mt-1 text-sm text-gray-600">{modulo.descricao}</p>
            </Link>
          )
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">Últimas movimentações</h2>
        </div>
        {isLoading ? (
          <div className="p-4 text-sm text-gray-500">Carregando...</div>
        ) : data?.movimentos.data.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">Nenhuma movimentação registrada.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data?.movimentos.data.map((movimento) => (
              <li key={movimento.id} className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{movimento.insumo?.nome ?? `Insumo #${movimento.id}`}</p>
                  <p className="text-xs text-gray-500">{movimento.tipo} · {movimento.motivo ?? movimento.documento ?? 'Sem observação'}</p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-sm font-semibold text-gray-700">{quantidade(movimento.quantidade, movimento.insumo?.unidade)}</p>
                  <p className="text-xs text-gray-500">{formatarData(movimento.criadoEm)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
