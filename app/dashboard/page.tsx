'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    TrendingUp,
    DollarSign,
    ShoppingCart,
    Users,
    Calendar,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    ChefHat
} from 'lucide-react'

type DashboardStats = {
    today: {
        total: number
        orders: number
        avgTicket: number
        tables: number
    }
    week: {
        total: number
        orders: number
        avgTicket: number
    }
    month: {
        total: number
        orders: number
        avgTicket: number
    }
    topProducts: Array<{
        name: string
        quantity: number
        revenue: number
    }>
    hourlySales: Array<{
        hour: string
        total: number
    }>
    comparison: {
        todayVsYesterday: number
        weekVsLastWeek: number
    }
}

export default function DashboardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

    useEffect(() => {
        const init = async () => {
            try {
                const meRes = await fetch('/api/auth/me')
                const meData = await meRes.json()
                if (!meData.user) {
                    router.replace('/login')
                    return
                }

                // Only allow managers and above
                if (!['GERENTE', 'DONO', 'ADMIN', 'CAIXA'].includes(meData.user.role)) {
                    router.replace('/')
                    return
                }

                const res = await fetch('/api/dashboard/stats')
                if (res.ok) {
                    const data = await res.json()
                    setStats(data)
                }
            } catch (err) {
                console.error('Error loading dashboard:', err)
            } finally {
                setLoading(false)
            }
        }

        init()
    }, [router])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
        )
    }

    const currentStats = stats ? stats[period] : null
    const maxHourlySale = stats ? Math.max(...stats.hourlySales.map(h => h.total), 1) : 1

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-500 mt-1">Visão geral das vendas e operações</p>
                    </div>

                    {/* Period Toggle */}
                    <div className="bg-white rounded-xl p-1 shadow-sm border border-gray-200 flex gap-1">
                        {(['today', 'week', 'month'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${period === p
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {/* Total de Vendas */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <DollarSign className="text-green-600" size={24} />
                            </div>
                            {stats?.comparison.todayVsYesterday !== undefined && period === 'today' && (
                                <div className={`flex items-center gap-1 text-sm font-medium ${stats.comparison.todayVsYesterday >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                    {stats.comparison.todayVsYesterday >= 0 ? (
                                        <ArrowUpRight size={16} />
                                    ) : (
                                        <ArrowDownRight size={16} />
                                    )}
                                    {Math.abs(stats.comparison.todayVsYesterday)}%
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Total de Vendas</p>
                        <p className="text-3xl font-bold text-gray-900">
                            R$ {currentStats?.total.toFixed(2).replace('.', ',') || '0,00'}
                        </p>
                    </div>

                    {/* Pedidos */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <ShoppingCart className="text-blue-600" size={24} />
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Pedidos</p>
                        <p className="text-3xl font-bold text-gray-900">
                            {currentStats?.orders || 0}
                        </p>
                    </div>

                    {/* Ticket Médio */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <TrendingUp className="text-purple-600" size={24} />
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Ticket Médio</p>
                        <p className="text-3xl font-bold text-gray-900">
                            R$ {currentStats?.avgTicket.toFixed(2).replace('.', ',') || '0,00'}
                        </p>
                    </div>

                    {/* Mesas Atendidas */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                <Users className="text-orange-600" size={24} />
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">Mesas Atendidas</p>
                        <p className="text-3xl font-bold text-gray-900">
                            {stats?.today.tables || 0}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Vendas por Hora */}
                    <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="text-gray-400" size={20} />
                                <h2 className="text-lg font-bold text-gray-900">Vendas por Hora</h2>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar size={16} />
                                Hoje
                            </div>
                        </div>

                        {/* Simple Bar Chart */}
                        <div className="flex items-end justify-between h-48 gap-2">
                            {stats?.hourlySales.map((hour, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                                    <div
                                        className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-lg transition-all hover:from-orange-600 hover:to-orange-500 cursor-pointer"
                                        style={{
                                            height: `${(hour.total / maxHourlySale) * 100}%`,
                                            minHeight: hour.total > 0 ? '8px' : '0px'
                                        }}
                                        title={`R$ ${hour.total.toFixed(2)}`}
                                    />
                                    <span className="text-xs text-gray-400">{hour.hour}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Produtos Mais Vendidos */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-6">
                            <ChefHat className="text-gray-400" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">Mais Vendidos</h2>
                        </div>

                        <div className="space-y-4">
                            {stats?.topProducts.slice(0, 5).map((product, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            idx === 1 ? 'bg-gray-100 text-gray-600' :
                                                idx === 2 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-50 text-gray-500'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                        <p className="text-xs text-gray-500">{product.quantity} vendidos</p>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900">
                                        R$ {product.revenue.toFixed(2).replace('.', ',')}
                                    </p>
                                </div>
                            ))}

                            {(!stats?.topProducts || stats.topProducts.length === 0) && (
                                <p className="text-center text-gray-400 py-8">Nenhum dado disponível</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Stats Footer */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock size={18} />
                            <span className="text-sm font-medium opacity-90">Horário de Pico</span>
                        </div>
                        <p className="text-2xl font-bold">12:00 - 14:00</p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={18} />
                            <span className="text-sm font-medium opacity-90">Crescimento</span>
                        </div>
                        <p className="text-2xl font-bold">
                            {stats?.comparison.weekVsLastWeek !== undefined
                                ? `${stats.comparison.weekVsLastWeek >= 0 ? '+' : ''}${stats.comparison.weekVsLastWeek}%`
                                : 'N/A'}
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart size={18} />
                            <span className="text-sm font-medium opacity-90">Itens/Pedido</span>
                        </div>
                        <p className="text-2xl font-bold">3.5</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Users size={18} />
                            <span className="text-sm font-medium opacity-90">Clientes/Dia</span>
                        </div>
                        <p className="text-2xl font-bold">{stats?.today.tables ? stats.today.tables * 3 : 0}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
