'use client'

import { useState, useEffect, useRef } from 'react'
import { ShoppingBag, RefreshCw, Check, X, Clock, MapPin, Phone, Receipt } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

type IfoodItem = {
  name: string
  quantity: number
  price: number
  options?: string[]
}

type IfoodOrder = {
  id: string
  displayId: string
  createdAt: string
  customer: {
    name: string
    phone: string
  }
  delivery: {
    address: string
  }
  items: IfoodItem[]
  total: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}

export default function IfoodPage() {
  const [isConnected, setIsConnected] = useState(false)
  const [orders, setOrders] = useState<IfoodOrder[]>([])
  const [polling, setPolling] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Custom Toast (simple alert replacement)
  const showToast = (msg: string, type: 'success' | 'error') => {
    // Simple implementation or verify if ToastContext is available globally
    console.log(msg)
    // We can use native notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(msg)
    }
  }

  useEffect(() => {
    setIsClient(true)
    const stored = localStorage.getItem('ifood_connected')
    if (stored === 'true') {
      setIsConnected(true)
      startPolling()
    }

    // Request notification permission
    if ("Notification" in window) {
      Notification.requestPermission()
    }

    audioRef.current = new Audio('/sounds/new-order.mp3')
  }, [])

  const startPolling = () => {
    setPolling(true)
    // Simulate incoming orders every 30-60 seconds
    const interval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance per tick
        simulateNewOrder()
      }
    }, 15000)

    return () => clearInterval(interval)
  }

  const simulateNewOrder = () => {
    const newOrder: IfoodOrder = {
      id: Math.random().toString(36).substr(2, 9),
      displayId: `#${Math.floor(Math.random() * 9999)}`,
      createdAt: new Date().toISOString(),
      customer: {
        name: ['João Silva', 'Maria Oliveira', 'Pedro Santos', 'Ana Costa'][Math.floor(Math.random() * 4)],
        phone: '(11) 99999-9999'
      },
      delivery: {
        address: 'Rua das Flores, 123 - Centro'
      },
      items: [
        { name: 'X-Tudo', quantity: 1, price: 25.0, options: ['Sem cebola'] },
        { name: 'Coca-Cola Lata', quantity: 1, price: 6.0 }
      ],
      total: 31.0,
      status: 'PENDING'
    }

    setOrders(prev => {
      // Play sound if new order
      audioRef.current?.play().catch(() => { })
      return [newOrder, ...prev]
    })
  }

  const handleConnect = () => {
    setIsConnected(true)
    localStorage.setItem('ifood_connected', 'true')
    startPolling()
  }

  const handleDisconnect = () => {
    setIsConnected(false)
    setPolling(false)
    localStorage.removeItem('ifood_connected')
  }

  const handleAccept = async (order: IfoodOrder) => {
    // 1. Create order in system (Mesa 99 for delivery)
    // In a real scenario, we would map products. Here we mock success.

    // Simulate API call to create order
    try {
      // Here we could call /api/orders with mock items
      // For now, just update UI
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ACCEPTED' } : o))
      showToast(`Pedido ${order.displayId} aceito e enviado para cozinha!`, 'success')

      // Try to print (simulated by triggering backend logic if we implemented order creation)
    } catch (e) {
      showToast('Erro ao aceitar pedido', 'error')
    }
  }

  const handleReject = (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'REJECTED' } : o))
  }

  if (!isClient) return null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#EA1D2C] text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ShoppingBag size={32} />
            <h1 className="text-2xl font-bold">Gestor de Pedidos iFood</h1>
          </div>
          <div>
            {!isConnected ? (
              <button
                onClick={handleConnect}
                className="bg-white text-[#EA1D2C] px-6 py-2 rounded-full font-bold hover:bg-gray-100 transition-colors"
              >
                Conectar Loja
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="bg-red-800 text-white px-6 py-2 rounded-full font-bold hover:bg-red-900 transition-colors flex items-center gap-2"
              >
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                Conectado (Polling)
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto w-full p-6 flex-1">
        {!isConnected ? (
          <div className="text-center py-20">
            <ShoppingBag size={80} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-600">Loja Desconectada</h2>
            <p className="text-gray-500 mt-2">Clique em conectar para começar a receber pedidos.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.length === 0 && (
              <div className="text-center py-20 flex flex-col items-center">
                <RefreshCw size={40} className="text-[#EA1D2C] animate-spin mb-4" />
                <p className="text-gray-500 text-xl">Aguardando novos pedidos...</p>
              </div>
            )}

            {orders.map(order => (
              <div key={order.id} className={`bg-white rounded-xl shadow-lg border-l-8 overflow-hidden transition-all ${order.status === 'PENDING' ? 'border-yellow-400' :
                  order.status === 'ACCEPTED' ? 'border-green-500' : 'border-red-500 opacity-60'
                }`}>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-2xl font-bold text-gray-900">{order.displayId}</h3>
                        <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded text-gray-600">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-lg font-medium text-gray-800">{order.customer.name}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                        <span className="flex items-center gap-1"><Phone size={14} /> {order.customer.phone}</span>
                        <span className="flex items-center gap-1"><MapPin size={14} /> {order.delivery.address}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">Total do Pedido</p>
                      <p className="text-3xl font-bold text-gray-900">R$ {order.total.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-200 last:border-0">
                        <div className="flex gap-3">
                          <span className="font-bold text-gray-900">{item.quantity}x</span>
                          <div>
                            <p className="text-gray-800 font-medium">{item.name}</p>
                            {item.options && item.options.map(opt => (
                              <p key={opt} className="text-sm text-gray-500">• {opt}</p>
                            ))}
                          </div>
                        </div>
                        <span className="text-gray-600">R$ {item.price.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>

                  {order.status === 'PENDING' && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleReject(order.id)}
                        className="flex-1 py-4 border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                      >
                        <X size={20} />
                        Rejeitar
                      </button>
                      <button
                        onClick={() => handleAccept(order)}
                        className="flex-[2] py-4 bg-[#EA1D2C] text-white font-bold rounded-xl hover:bg-[#d01522] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200"
                      >
                        <Check size={20} />
                        Aceitar e Imprimir
                      </button>
                    </div>
                  )}

                  {order.status === 'ACCEPTED' && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-2 font-bold">
                      <Check size={24} />
                      Pedido aceito e enviado para produção!
                    </div>
                  )}

                  {order.status === 'REJECTED' && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-2 font-bold">
                      <X size={24} />
                      Pedido rejeitado.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
