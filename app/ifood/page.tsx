'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Truck, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'

// Mock types matching iFood structure loosely
type IfoodOrder = {
  id: string
  displayId: string
  customer: {
    name: string
    phone: string
    address?: string
  }
  items: {
    name: string
    quantity: number
    price: number
    options?: string[]
  }[]
  total: number
  status: 'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'CONCLUDED' | 'CANCELLED'
  createdAt: string
  notes?: string
}

// Mock data generator
const generateMockOrders = (): IfoodOrder[] => [
  {
    id: 'ord-001',
    displayId: '#1234',
    customer: {
      name: 'João Silva',
      phone: '(71) 99999-1111',
      address: 'Rua das Flores, 123 - Centro'
    },
    items: [
      { name: 'Pirão de Carne do Sol', quantity: 1, price: 45.90, options: ['Sem cebola'] },
      { name: 'Coca-Cola 2L', quantity: 1, price: 12.00 }
    ],
    total: 57.90,
    status: 'PLACED',
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
    notes: 'Campainha não funciona, ligar quando chegar.'
  },
  {
    id: 'ord-002',
    displayId: '#1235',
    customer: {
      name: 'Maria Oliveira',
      phone: '(71) 98888-2222',
      address: 'Av. Oceânica, 500 - Barra'
    },
    items: [
      { name: 'Moqueca de Camarão', quantity: 1, price: 89.90 }
    ],
    total: 89.90,
    status: 'CONFIRMED',
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString() // 25 min ago
  },
  {
    id: 'ord-003',
    displayId: '#1236',
    customer: {
      name: 'Pedro Santos',
      phone: '(71) 97777-3333'
    },
    items: [
      { name: 'Pirão de Frango', quantity: 2, price: 35.90 }
    ],
    total: 71.80,
    status: 'DISPATCHED',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() // 45 min ago
  }
]

export default function IfoodPage() {
  const { showToast } = useToast()
  const [orders, setOrders] = useState<IfoodOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'PLACED' | 'CONFIRMED' | 'DISPATCHED' | 'HISTORY'>('PLACED')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  useEffect(() => {
    // Simulate API fetch
    setTimeout(() => {
      setOrders(generateMockOrders())
      setLoading(false)
    }, 1000)
  }, [])

  const handleStatusChange = (orderId: string, newStatus: IfoodOrder['status']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ))
    
    const messages = {
      'CONFIRMED': 'Pedido confirmado com sucesso!',
      'DISPATCHED': 'Pedido despachado para entrega!',
      'CANCELLED': 'Pedido cancelado.',
      'CONCLUDED': 'Pedido finalizado.'
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    showToast((messages as any)[newStatus] || 'Status atualizado', newStatus === 'CANCELLED' ? 'error' : 'success')
  }

  const getFilteredOrders = () => {
    if (activeTab === 'HISTORY') {
      return orders.filter(o => ['CONCLUDED', 'CANCELLED'].includes(o.status))
    }
    return orders.filter(o => o.status === activeTab)
  }

  const toggleExpand = (id: string) => {
    setExpandedOrder(expandedOrder === id ? null : id)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500 gap-2">
        <ShoppingBag className="animate-bounce text-red-500" /> Carregando pedidos...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-50">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-3 rounded-xl shadow-lg shadow-red-200">
            <ShoppingBag className="text-white w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Gestor de Pedidos iFood</h1>
            <p className="text-sm text-gray-500">Gerencie seus pedidos de delivery em tempo real</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-green-600">Conectado</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'PLACED', label: 'Novos', icon: AlertCircle, count: orders.filter(o => o.status === 'PLACED').length },
          { id: 'CONFIRMED', label: 'Em Preparo', icon: Clock, count: orders.filter(o => o.status === 'CONFIRMED').length },
          { id: 'DISPATCHED', label: 'Saiu para Entrega', icon: Truck, count: orders.filter(o => o.status === 'DISPATCHED').length },
          { id: 'HISTORY', label: 'Histórico', icon: CheckCircle, count: orders.filter(o => ['CONCLUDED', 'CANCELLED'].includes(o.status)).length },
        ].map(tab => {
          const Icon = tab.icon
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const isActive = activeTab === tab.id as any
          
          return (
            <button
              key={tab.id}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 whitespace-nowrap
                ${isActive 
                  ? 'bg-red-500 text-white shadow-md shadow-red-200 scale-105' 
                  : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100'}
              `}
            >
              <Icon size={18} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`
                  ml-2 text-xs px-2 py-0.5 rounded-full 
                  ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders List */}
      <div className="grid gap-4">
        {getFilteredOrders().length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum pedido nesta aba</h3>
            <p className="text-gray-500">Aguardando novos pedidos...</p>
          </div>
        ) : (
          getFilteredOrders().map(order => (
            <Card key={order.id} className={`border-l-4 ${
              order.status === 'PLACED' ? 'border-l-red-500' :
              order.status === 'CONFIRMED' ? 'border-l-orange-500' :
              order.status === 'DISPATCHED' ? 'border-l-blue-500' :
              order.status === 'CONCLUDED' ? 'border-l-green-500' : 'border-l-gray-500'
            }`}>
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-red-50 px-3 py-2 rounded-lg text-center min-w-[80px]">
                      <span className="block text-xs text-red-600 font-bold uppercase">Pedido</span>
                      <span className="block text-xl font-black text-gray-800">{order.displayId}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{order.customer.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(order.createdAt)}</span>
                        <span className="flex items-center gap-1"><ShoppingBag size={14} /> {order.items.length} itens</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(order.total)}</span>
                    <button 
                      onClick={() => toggleExpand(order.id)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      {expandedOrder === order.id ? <ChevronUp /> : <ChevronDown />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedOrder === order.id && (
                  <div className="border-t pt-4 mt-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <ShoppingBag size={16} /> Itens do Pedido
                        </h4>
                        <ul className="space-y-3">
                          {order.items.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-start text-sm">
                              <div className="flex gap-3">
                                <span className="font-bold text-gray-900 w-6">{item.quantity}x</span>
                                <div>
                                  <span className="text-gray-800">{item.name}</span>
                                  {item.options && (
                                    <p className="text-xs text-gray-500 mt-0.5">{item.options.join(', ')}</p>
                                  )}
                                </div>
                              </div>
                              <span className="font-medium text-gray-600">{formatCurrency(item.price * item.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                        {order.notes && (
                          <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                            <p className="text-sm text-yellow-800 font-medium flex gap-2">
                              <AlertCircle size={16} /> Observações:
                            </p>
                            <p className="text-sm text-yellow-700 mt-1 pl-6">{order.notes}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <MapPin size={16} /> Dados de Entrega
                        </h4>
                        <div className="bg-gray-50 p-4 rounded-xl space-y-3 text-sm">
                          <div className="flex items-start gap-3">
                            <MapPin size={16} className="text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-gray-900 font-medium">Endereço de Entrega</p>
                              <p className="text-gray-600">{order.customer.address || 'Retirada no balcão'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone size={16} className="text-gray-400" />
                            <div>
                              <p className="text-gray-900 font-medium">Telefone</p>
                              <p className="text-gray-600">{order.customer.phone}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                  {order.status === 'PLACED' && (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <XCircle size={18} className="mr-2" />
                        Rejeitar Pedido
                      </Button>
                      <Button 
                        onClick={() => handleStatusChange(order.id, 'CONFIRMED')}
                        className="bg-green-600 hover:bg-green-700 text-white border-none shadow-md shadow-green-100"
                      >
                        <CheckCircle size={18} className="mr-2" />
                        Aceitar e Confirmar
                      </Button>
                    </>
                  )}
                  
                  {order.status === 'CONFIRMED' && (
                    <Button 
                      onClick={() => handleStatusChange(order.id, 'DISPATCHED')}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Truck size={18} className="mr-2" />
                      Despachar Entrega
                    </Button>
                  )}

                  {order.status === 'DISPATCHED' && (
                    <Button 
                      onClick={() => handleStatusChange(order.id, 'CONCLUDED')}
                      className="bg-gray-800 hover:bg-gray-900 text-white"
                    >
                      <CheckCircle size={18} className="mr-2" />
                      Finalizar Pedido
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
