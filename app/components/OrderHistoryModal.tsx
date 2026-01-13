'use client'

import { useState, useEffect } from 'react'
import { X, Clock, ChefHat, CheckCircle2, XCircle, History } from 'lucide-react'
import { createPortal } from 'react-dom'

type HistoryItem = {
    id: number
    nome: string
    quantidade: number
    preco: number
    observacao: string | null
    status: string
    horario: string
}

type HistoryOrder = {
    id: number
    criadoEm: string
    status: string
    itens: HistoryItem[]
}

interface OrderHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    mesaId: number
    mesaNumero: number
}

export function OrderHistoryModal({ isOpen, onClose, mesaId, mesaNumero }: OrderHistoryModalProps) {
    const [orders, setOrders] = useState<HistoryOrder[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/tables/${mesaId}/history`)
                if (res.ok) {
                    const data = await res.json()
                    setOrders(data)
                }
            } catch (error) {
                console.error('Error fetching history:', error)
            } finally {
                setLoading(false)
            }
        }

        if (isOpen) {
            fetchHistory()
        }
    }, [isOpen, mesaId])

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PRONTO':
            case 'ENTREGUE':
                return <CheckCircle2 className="text-green-500" size={16} />
            case 'CANCELADO':
                return <XCircle className="text-red-500" size={16} />
            case 'EM_PREPARO':
                return <ChefHat className="text-blue-500" size={16} />
            default:
                return <Clock className="text-yellow-500" size={16} />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'PRONTO': return 'Pronto'
            case 'ENTREGUE': return 'Entregue'
            case 'CANCELADO': return 'Cancelado'
            case 'EM_PREPARO': return 'Em Preparo'
            case 'PENDENTE': return 'Pendente'
            default: return status
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PRONTO':
            case 'ENTREGUE':
                return 'bg-green-100 text-green-700'
            case 'CANCELADO':
                return 'bg-red-100 text-red-700 line-through'
            case 'EM_PREPARO':
                return 'bg-blue-100 text-blue-700'
            default:
                return 'bg-yellow-100 text-yellow-700'
        }
    }

    // Calculate totals
    const totalGeral = orders.reduce((acc, order) => {
        return acc + order.itens.reduce((itemAcc, item) => {
            if (item.status !== 'CANCELADO') {
                return itemAcc + (item.preco * item.quantidade)
            }
            return itemAcc
        }, 0)
    }, 0)

    const totalItems = orders.reduce((acc, order) => {
        return acc + order.itens.filter(i => i.status !== 'CANCELADO').reduce((sum, i) => sum + i.quantidade, 0)
    }, 0)

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <History size={28} />
                            <div>
                                <h2 className="text-2xl font-bold">Histórico de Pedidos</h2>
                                <p className="text-blue-100 mt-1">Mesa {mesaNumero}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                            <X size={28} />
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-blue-50 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p className="text-sm text-blue-600">Total de Itens</p>
                        <p className="text-2xl font-bold text-blue-700">{totalItems}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-blue-600">Valor Total</p>
                        <p className="text-2xl font-bold text-blue-700">R$ {totalGeral.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <History size={48} className="mx-auto mb-4 text-gray-300" />
                            <p>Nenhum pedido registrado nesta sessão.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {orders.map((order) => (
                                <div key={order.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                    {/* Order Header */}
                                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-gray-900">Pedido #{order.id}</span>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${order.status === 'ABERTO' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {order.status === 'ABERTO' ? 'Em andamento' : 'Finalizado'}
                                            </span>
                                        </div>
                                        <span className="text-sm text-gray-500 flex items-center gap-1">
                                            <Clock size={14} />
                                            {new Date(order.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Order Items */}
                                    <div className="divide-y divide-gray-100">
                                        {order.itens.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`px-4 py-3 flex items-center justify-between ${item.status === 'CANCELADO' ? 'bg-red-50/50' : ''
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3 flex-1">
                                                    <span className={`font-bold text-orange-600 ${item.status === 'CANCELADO' ? 'line-through opacity-50' : ''}`}>
                                                        {item.quantidade}x
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className={`font-medium text-gray-900 ${item.status === 'CANCELADO' ? 'line-through opacity-50' : ''}`}>
                                                            {item.nome}
                                                        </p>
                                                        {item.observacao && (
                                                            <p className="text-xs text-gray-500 mt-0.5">{item.observacao}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${getStatusColor(item.status)}`}>
                                                        {getStatusIcon(item.status)}
                                                        {getStatusLabel(item.status)}
                                                    </span>
                                                    <span className={`font-bold ${item.status === 'CANCELADO' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                        R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
