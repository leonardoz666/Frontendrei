'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import { Clock, AlertTriangle, ChefHat, Beer, Volume2, VolumeX, Printer } from 'lucide-react'

type OrdemItem = {
  id: number
  pedidoItem: {
    quantidade: number
    observacao: string | null
    produto: {
      nome: string
    }
  }
}

type OrdemProducao = {
  id: number
  setor: string
  status: string
  criadaEm: string
  pedido: {
    id: number
    comanda: {
      mesa: {
        numero: number
      }
    }
  }
  itens: OrdemItem[]
}

// Alert time in minutes
const ALERT_TIME_MINUTES = 10
const WARNING_TIME_MINUTES = 5

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrdemProducao[]>([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [reprinting, setReprinting] = useState<number | null>(null)
  const router = useRouter()

  const fetchOrders = useCallback(async () => {
    try {
      console.log('[DEBUG] Kitchen fetching orders');
      const res = await fetch('/api/kitchen')
      console.log(`[DEBUG] Kitchen fetch status: ${res.status}`);
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (res.status === 403) {
        router.replace('/')
        return
      }
      if (!res.ok) {
        console.error(`[DEBUG] Kitchen fetch failed: ${res.status}`);
        return
      }

      const data = await res.json()
      console.log(`[DEBUG] Kitchen orders count: ${Array.isArray(data) ? data.length : 'not array'}`)
      if (Array.isArray(data)) {
        setOrders(data)
      }
    } catch (err) {
      console.error('[DEBUG] Error fetching orders:', err)
    }
  }, [router])

  // Update time every second for elapsed time calculation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Initial Auth Check and Fetch
    const run = async () => {
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      if (!meData.user) {
        router.replace('/login')
        return
      }
      if (!['GERENTE', 'DONO', 'CAIXA', 'GARCOM', 'ADMIN'].includes(meData.user.role)) {
        router.replace('/')
        return
      }

      fetchOrders()
    }

    run()

    // Socket.io connection
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')

    socket.on('connect', () => {
      console.log('Connected to socket')
    })

    socket.on('new-kitchen-order', (newOrder: OrdemProducao) => {
      setOrders(prev => {
        // Avoid duplicates
        if (prev.find(o => o.id === newOrder.id)) return prev

        // Play sound for new order
        if (soundEnabled) {
          const audio = new Audio('/sounds/new-order.mp3')
          audio.play().catch(() => { })
        }

        return [...prev, newOrder]
      })
    })

    socket.on('kitchen-order-updated', ({ id, status }: { id: number, status: string }) => {
      setOrders(prev => {
        if (status === 'PRONTO') {
          return prev.filter(o => o.id !== id)
        }
        return prev.map(o => o.id === id ? { ...o, status } : o)
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [router, fetchOrders, soundEnabled])

  const updateStatus = async (id: number, newStatus: string) => {
    await fetch('/api/kitchen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })
    fetchOrders()
  }

  const handleReprint = async (id: number) => {
    if (reprinting) return
    setReprinting(id)
    try {
      const res = await fetch(`/api/kitchen/reprint/${id}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
    } catch (e) {
      console.error(e)
      alert('Erro ao enviar comando de reimpressão')
    } finally {
      setReprinting(null)
    }
  }

  // Calculate elapsed time
  const getElapsedTime = (createdAt: string) => {
    const created = new Date(createdAt)
    const diff = currentTime.getTime() - created.getTime()
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return { minutes, seconds, totalMinutes: minutes }
  }

  // Get time status color
  const getTimeStatus = (minutes: number) => {
    if (minutes >= ALERT_TIME_MINUTES) return 'critical'
    if (minutes >= WARNING_TIME_MINUTES) return 'warning'
    return 'normal'
  }

  const cozinhaOrders = orders.filter(o => o.setor === 'COZINHA')
  const barOrders = orders.filter(o => o.setor === 'BAR')

  // Count alerts
  const alertCount = orders.filter(o => {
    const { totalMinutes } = getElapsedTime(o.criadaEm)
    return totalMinutes >= ALERT_TIME_MINUTES
  }).length

  const OrderCard = ({ order }: { order: OrdemProducao }) => {
    const { minutes, seconds, totalMinutes } = getElapsedTime(order.criadaEm)
    const timeStatus = getTimeStatus(totalMinutes)

    return (
      <div className={`p-5 rounded-2xl shadow-lg border-l-4 mb-4 transition-all ${order.status === 'RECEBIDO'
        ? timeStatus === 'critical'
          ? 'bg-red-50 border-red-500 animate-pulse'
          : timeStatus === 'warning'
            ? 'bg-yellow-50 border-yellow-500'
            : 'bg-white border-yellow-400'
        : 'bg-blue-50 border-blue-500'
        }`}>
        {/* Header with time */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-2xl text-gray-900">Mesa {order.pedido.comanda.mesa.numero}</h3>
            <span className="text-sm text-gray-500">Pedido #{order.pedido.id}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Reprint Button */}
            <button
              onClick={() => handleReprint(order.id)}
              disabled={reprinting === order.id}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors disabled:opacity-50"
              title="Reimprimir Comanda"
            >
              <Printer size={20} className={reprinting === order.id ? 'animate-pulse' : ''} />
            </button>

            {/* Elapsed Time Display */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${timeStatus === 'critical'
              ? 'bg-red-100 text-red-700'
              : timeStatus === 'warning'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
              {timeStatus === 'critical' && <AlertTriangle size={18} className="animate-bounce" />}
              <Clock size={18} />
              <span className="font-mono font-bold text-lg">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3 mb-4 bg-white/50 rounded-xl p-3">
          {order.itens.map(item => (
            <div key={item.id} className="flex items-start gap-2">
              <span className="font-bold text-xl text-orange-600 min-w-[40px]">
                {item.pedidoItem.quantidade}x
              </span>
              <div className="flex-1">
                <span className="font-semibold text-lg text-gray-900">{item.pedidoItem.produto.nome}</span>
                {item.pedidoItem.observacao && (
                  <p className="text-red-600 font-medium text-sm mt-1 bg-red-50 px-2 py-1 rounded">
                    ⚠️ {item.pedidoItem.observacao}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {order.status === 'RECEBIDO' && (
            <button
              onClick={() => updateStatus(order.id, 'EM_PREPARO')}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-blue-200"
            >
              🔥 Iniciar Preparo
            </button>
          )}
          <button
            onClick={() => updateStatus(order.id, 'PRONTO')}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold text-lg transition-all active:scale-95 shadow-lg shadow-green-200"
          >
            ✅ Pronto
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-gray-800 rounded-2xl p-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ChefHat className="text-orange-500" size={36} />
          Cozinha & Bar (KDS)
        </h1>

        <div className="flex items-center gap-4">
          {/* Alert Counter */}
          {alertCount > 0 && (
            <div className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 animate-pulse">
              <AlertTriangle size={20} />
              {alertCount} pedido(s) atrasado(s)!
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-3 rounded-xl transition-colors ${soundEnabled ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            title={soundEnabled ? 'Som ativado' : 'Som desativado'}
          >
            {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>

          {/* Current Time */}
          <div className="bg-gray-700 text-white px-4 py-2 rounded-xl font-mono text-xl">
            {currentTime.toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-6 justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 rounded bg-yellow-400"></div>
          <span>Recebido</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 rounded bg-yellow-500"></div>
          <span>+5min</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span>+10min (Urgente!)</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-4 h-4 rounded bg-blue-500"></div>
          <span>Em Preparo</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cozinha Column */}
        <div className="bg-gray-800 p-6 rounded-2xl min-h-[80vh]">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <ChefHat className="text-orange-500" size={28} />
            Cozinha
            <span className="bg-orange-500 text-white text-lg px-3 py-1 rounded-full">
              {cozinhaOrders.length}
            </span>
          </h2>
          {cozinhaOrders.length === 0 ? (
            <div className="text-center py-20">
              <ChefHat className="text-gray-600 mx-auto mb-4" size={64} />
              <p className="text-gray-500 text-xl">Sem pedidos pendentes</p>
            </div>
          ) : (
            cozinhaOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </div>

        {/* Bar Column */}
        <div className="bg-gray-800 p-6 rounded-2xl min-h-[80vh]">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Beer className="text-blue-500" size={28} />
            Bar
            <span className="bg-blue-500 text-white text-lg px-3 py-1 rounded-full">
              {barOrders.length}
            </span>
          </h2>
          {barOrders.length === 0 ? (
            <div className="text-center py-20">
              <Beer className="text-gray-600 mx-auto mb-4" size={64} />
              <p className="text-gray-500 text-xl">Sem pedidos pendentes</p>
            </div>
          ) : (
            barOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  )
}
