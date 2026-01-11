'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'

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

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrdemProducao[]>([])
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
      console.log(`[DEBUG] Kitchen orders count: ${Array.isArray(data) ? data.length : 'not array'}`);
      if (Array.isArray(data)) {
        setOrders(data)
      }
    } catch (err) {
      console.error('[DEBUG] Error fetching orders:', err)
    }
  }, [router])

  useEffect(() => {
    // Initial Auth Check and Fetch
    const run = async () => {
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      if (!meData.user) {
        router.replace('/login')
        return
      }
      if (!['GERENTE', 'DONO', 'CAIXA', 'GARCOM'].includes(meData.user.role)) {
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
  }, [router, fetchOrders])

  const updateStatus = async (id: number, newStatus: string) => {
    await fetch('/api/kitchen', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    })
    fetchOrders()
  }

  const cozinhaOrders = orders.filter(o => o.setor === 'COZINHA')
  const barOrders = orders.filter(o => o.setor === 'BAR')

  const OrderCard = ({ order }: { order: OrdemProducao }) => (
    <div className={`p-4 rounded-lg shadow border-l-4 mb-4 ${
      order.status === 'RECEBIDO' ? 'bg-white border-yellow-500' : 'bg-blue-50 border-blue-500'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-bold text-lg">Mesa {order.pedido.comanda.mesa.numero}</h3>
          <span className="text-sm text-gray-500">Pedido #{order.pedido.id}</span>
        </div>
        <span className="text-xs font-mono text-gray-400">
          {new Date(order.criadaEm).toLocaleTimeString()}
        </span>
      </div>
      
      <div className="space-y-2 mb-4">
        {order.itens.map(item => (
          <div key={item.id} className="text-sm">
            <span className="font-bold">{item.pedidoItem.quantidade}x</span> {item.pedidoItem.produto.nome}
            {item.pedidoItem.observacao && (
              <p className="text-red-600 text-xs ml-4">Obs: {item.pedidoItem.observacao}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-2">
        {order.status === 'RECEBIDO' && (
          <button 
            onClick={() => updateStatus(order.id, 'EM_PREPARO')}
            className="flex-1 bg-blue-500 text-white py-1 rounded hover:bg-blue-600 text-sm"
          >
            Iniciar Preparo
          </button>
        )}
        <button 
          onClick={() => updateStatus(order.id, 'PRONTO')}
          className="flex-1 bg-green-500 text-white py-1 rounded hover:bg-green-600 text-sm"
        >
          Pronto
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cozinha & Bar (KDS)</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cozinha Column */}
        <div className="bg-gray-200 p-4 rounded-lg min-h-[80vh]">
          <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
            🍳 Cozinha <span className="bg-gray-400 text-white text-sm px-2 rounded-full">{cozinhaOrders.length}</span>
          </h2>
          {cozinhaOrders.length === 0 ? (
            <p className="text-gray-500 text-center mt-10">Sem pedidos pendentes.</p>
          ) : (
            cozinhaOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </div>

        {/* Bar Column */}
        <div className="bg-gray-200 p-4 rounded-lg min-h-[80vh]">
          <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
            🍺 Bar <span className="bg-gray-400 text-white text-sm px-2 rounded-full">{barOrders.length}</span>
          </h2>
          {barOrders.length === 0 ? (
            <p className="text-gray-500 text-center mt-10">Sem pedidos pendentes.</p>
          ) : (
            barOrders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </div>
      </div>
    </div>
  )
}
