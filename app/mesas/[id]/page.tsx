'use client'

import { useEffect, useState, use, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { io } from 'socket.io-client'
import { ArrowRightLeft, X, Check } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import { ProductOptionsModal } from '@/components/ProductOptionsModal'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Produto, Categoria, CartItem, SubmittedItem, APIPedido } from '@/types'

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const unwrappedParams = use(params)
  const mesaId = Number(unwrappedParams.id)
  const { showToast } = useToast()

  const [categories, setCategories] = useState<Categoria[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [submittedItems, setSubmittedItems] = useState<SubmittedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [tableStatus, setTableStatus] = useState<string>('')
  const [selectedCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  
  // Transfer Table State
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [availableTables, setAvailableTables] = useState<{id: number, numero: number, status: string}[]>([])
  const [targetTableId, setTargetTableId] = useState<number | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  
  // Cancel Item State
  const [itemToCancel, setItemToCancel] = useState<number | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)

  const handleCancelItem = (itemId: number) => {
    setItemToCancel(itemId)
    setShowCancelModal(true)
  }

  const confirmCancelItem = async () => {
    if (!itemToCancel) return

    try {
      const res = await fetch(`/api/orders/items/${itemToCancel}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        showToast('Item cancelado com sucesso', 'success')
        fetchTableData()
      } else {
        const error = await res.json()
        showToast(error.message || 'Erro ao cancelar item', 'error')
      }
    } catch (error) {
      console.error('Error cancelling item:', error)
      showToast('Erro ao conectar com o servidor', 'error')
    } finally {
      setShowCancelModal(false)
      setItemToCancel(null)
    }
  }

  const fetchTableData = useCallback(async () => {
    try {
      console.log(`[DEBUG] Fetching table data for mesaId: ${mesaId}`);
      const res = await fetch(`/api/tables/${mesaId}`, { cache: 'no-store' })
      console.log(`[DEBUG] fetchTableData response status: ${res.status}`);
      if (res.ok) {
        const data = await res.json()
        console.log(`[DEBUG] fetchTableData success:`, data);
        setTableStatus(data.status)
        if (data.comandas && data.comandas.length > 0) {
          const comanda = data.comandas[0]
          const items: SubmittedItem[] = []
          comanda.pedidos.forEach((pedido: APIPedido) => {
            pedido.itens.forEach((item) => {
              items.push({
                id: item.id,
                nome: item.produto.nome,
                quantidade: item.quantidade,
                preco: item.produto.preco,
                observacao: item.observacao,
                status: item.status,
                horario: new Date(pedido.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              })
            })
          })
          setSubmittedItems(items)
        }
      } else {
        console.error(`[DEBUG] fetchTableData failed with status: ${res.status}`);
        const errorText = await res.text();
        console.error(`[DEBUG] fetchTableData error text: ${errorText}`);
      }
    } catch (error) {
      console.error('[DEBUG] Error fetching table data:', error)
    }
  }, [mesaId])

  useEffect(() => {
    if (showTransferModal) {
      fetch('/api/tables')
        .then(res => res.json())
        .then(data => {
          // Filter out current table
          setAvailableTables(data.filter((t: { id: number }) => t.id !== mesaId))
        })
        .catch(err => console.error('Error fetching tables:', err))
    }
  }, [showTransferModal, mesaId])

  const handleTransferTable = async () => {
    if (!targetTableId) return
    
    setIsTransferring(true)
    try {
      const res = await fetch(`/api/tables/${mesaId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTableId })
      })

      if (res.ok) {
        showToast('Mesa transferida com sucesso!', 'success')
        setShowTransferModal(false)
        router.push(`/mesas/${targetTableId}`)
      } else {
        const errorText = await res.text()
        showToast(`Erro ao transferir: ${errorText}`, 'error')
      }
    } catch (error) {
      console.error('Error transferring table:', error)
      showToast('Erro ao conectar com o servidor', 'error')
    } finally {
      setIsTransferring(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        console.log('[DEBUG] Starting init run in OrderPage');
        const meRes = await fetch('/api/auth/me')
        console.log(`[DEBUG] auth/me status: ${meRes.status}`);
        const meData = await meRes.json()
        if (!meData.user) {
          console.warn('[DEBUG] No user found, redirecting to login');
          router.replace('/login')
          return
        }
        setUserRole(meData.user.role)

        console.log('[DEBUG] Fetching categories');
        const productsRes = await fetch('/api/categories', { cache: 'no-store' })
        console.log(`[DEBUG] categories status: ${productsRes.status}`);
        const productsData = await productsRes.json()
        
        if (!cancelled) {
          const order = ['Entradas', 'Pratos Principais', 'Bebidas', 'Drinks']
          const sortedCategories = productsData.sort((a: Categoria, b: Categoria) => {
            const indexA = order.findIndex(o => a.nome.toLowerCase() === o.toLowerCase())
            const indexB = order.findIndex(o => b.nome.toLowerCase() === o.toLowerCase())
            
            const valA = indexA === -1 ? 999 : indexA
            const valB = indexB === -1 ? 999 : indexB
            
            return valA - valB || a.nome.localeCompare(b.nome)
          })
          setCategories(sortedCategories)
          await fetchTableData()
        }
      } catch (err) {
        console.error('[DEBUG] Error in OrderPage init:', err);
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router, fetchTableData])

  // Real-time updates via Socket.io
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')

    socket.on('connect', () => {
      console.log(`[DEBUG] Socket connected for table ${mesaId}`)
    })

    const handleTableUpdate = (data?: { mesaId: number }) => {
      if (!data || Number(data.mesaId) === Number(mesaId)) {
        console.log(`[DEBUG] Update for table ${mesaId} received`)
        fetchTableData()
      }
    }

    socket.on('table:updated', handleTableUpdate)
    socket.on('tables-updated', () => fetchTableData())
    socket.on('kitchen-order-updated', () => fetchTableData())
    
    // For new orders, we could filter by mesaId if the event sends it, 
    // but fetching is safe enough to ensure sync
    socket.on('new-kitchen-order', () => fetchTableData())

    return () => {
      socket.disconnect()
    }
  }, [mesaId, fetchTableData])

  // Flatten products for search
  const allProducts = useMemo(() => {
    return categories.flatMap(cat => 
      cat.produtos.map(prod => ({ ...prod, setor: cat.setor}))
    )
  }, [categories])

  const filteredProducts = useMemo(() => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const term = normalize(searchTerm)

    return allProducts.filter(p => {
      const matchesSearch = normalize(p.nome).includes(term)
      const matchesCategory = selectedCategory === 'all' || p.categoriaId.toString() === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [allProducts, searchTerm, selectedCategory])

  const addToCart = (produto: Produto & { setor: string }) => {
    if (tableStatus === 'FECHAMENTO') return

    if (produto.tipoOpcao && produto.tipoOpcao !== 'padrao') {
      setSelectedProduct(produto)
      return
    }

    setCart(prev => {
      const existing = prev.find(item => item.produtoId === produto.id && item.observacao === '')
      if (existing) {
        return prev.map(item => 
          item === existing
            ? { ...item, quantidade: item.quantidade + 1 }
            : item
        )
      }
      return [...prev, { 
        produtoId: produto.id, 
        nome: produto.nome, 
        preco: produto.preco, 
        quantidade: 1, 
        observacao: '',
        setor: produto.setor
      }]
    })
    setSearchTerm('') // Clear search after adding
  }

  const handleModalConfirm = (
    quantity: number, 
    observation: string, 
    _options: string[], 
    finalPrice: number,
    extraItems?: Array<{quantity: number, observation: string, preco: number, nameSuffix?: string}>,
    productNameSuffix?: string
  ) => {
    if (!selectedProduct) return

    // Find setor from categories since selectedProduct doesn't have it explicitly
    // Or we can rely on finding it in the flat list if we had it.
    // But we can just lookup category.
    const category = categories.find(c => c.id === selectedProduct.categoriaId)
    const setor = category ? category.setor : 'Geral'

    setCart(prev => {
      const newCart = [...prev]
      
      const itemsToAdd = []
      
      // If quantity > 0, add the main item (legacy behavior or for single items)
      if (quantity > 0) {
        itemsToAdd.push({
          produtoId: selectedProduct.id,
          nome: selectedProduct.nome + (productNameSuffix || ''),
          preco: finalPrice,
          quantidade: quantity,
          observacao: observation,
          setor
        })
      }

      // Add extra items if any
      if (extraItems && extraItems.length > 0) {
        extraItems.forEach(item => {
          itemsToAdd.push({
            produtoId: selectedProduct.id,
            nome: selectedProduct.nome + (item.nameSuffix || ''),
            preco: item.preco,
            quantidade: item.quantity,
            observacao: item.observation,
            setor
          })
        })
      }

      // Merge with existing cart logic
      itemsToAdd.forEach(newItem => {
        const existingIndex = newCart.findIndex(item => item.produtoId === newItem.produtoId && item.observacao === newItem.observacao)
        
        if (existingIndex >= 0) {
          newCart[existingIndex] = {
            ...newCart[existingIndex],
            quantidade: newCart[existingIndex].quantidade + newItem.quantidade
          }
        } else {
          newCart.push(newItem)
        }
      })

      return newCart
    })
    
    setSelectedProduct(null)
    setSearchTerm('')
  }

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        const newQty = Math.max(0, item.quantidade + delta)
        return { ...item, quantidade: newQty }
      }
      return item
    }).filter(item => item.quantidade > 0))
  }

  const updateObservation = (index: number, obs: string) => {
    setCart(prev => prev.map((item, i) => 
      i === index ? { ...item, observacao: obs } : item
    ))
  }

  const submitOrder = async () => {
    if (cart.length === 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesaId,
          itens: cart.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            observacao: item.observacao
          }))
        })
      })

      if (res.ok) {
        setCart([])
        setShowConfirmModal(false)
        showToast('Pedido enviado com sucesso!', 'success')
        fetchTableData()
      } else {
        showToast('Erro ao enviar pedido', 'error')
      }
    } catch (error) {
      console.error(error)
      showToast('Erro ao enviar pedido', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Carregando cardápio...</div>

  const total = cart.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)

  // Group items for confirmation modal
  const itemsBySetor = cart.reduce((acc, item) => {
    if (!acc[item.setor]) acc[item.setor] = []
    acc[item.setor].push(item)
    return acc
  }, {} as Record<string, CartItem[]>)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-black">Mesa {mesaId}</h1>
        <div className="flex items-center gap-4">
          {['CAIXA', 'GERENTE', 'DONO', 'ADMIN'].includes(userRole) && (
            <button 
              onClick={() => setShowTransferModal(true)}
              className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-200 transition-colors"
              title="Trocar de Mesa"
            >
              <ArrowRightLeft size={20} />
              <span className="hidden sm:inline">Trocar Mesa</span>
            </button>
          )}
          <Link href="/" className="text-orange-500 font-medium hover:underline flex items-center gap-1">
            <span>←</span> Voltar ao Início
          </Link>
        </div>
      </div>

      {tableStatus === 'FECHAMENTO' && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm flex items-center justify-between">
          <div>
            <p className="font-bold">🔒 Conta em Fechamento</p>
            <p className="text-sm">Não é possível adicionar novos itens. Solicite a reabertura no mapa de mesas se necessário.</p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="🔍 Buscar produto (ex: Cerveja, Moqueca)..."
          className="w-full p-4 text-lg rounded-xl border border-gray-200 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-black bg-white placeholder-gray-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          disabled={tableStatus === 'FECHAMENTO'}
        />
      </div>

      {/* Search Results */}
      {searchTerm && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3 mb-8">
          {filteredProducts.map(produto => {
            const isInactive = produto.ativo === false
            return (
              <button
                key={produto.id}
                onClick={() => !isInactive && addToCart(produto)}
                disabled={isInactive}
                className={`p-3 rounded-2xl shadow-sm border border-gray-200 transition-all text-left flex flex-col justify-between min-h-[110px] group ${
                  isInactive 
                    ? 'bg-gray-100 opacity-60 cursor-not-allowed' 
                    : 'bg-white hover:border-orange-500 hover:shadow-md'
                }`}
              >
                <div className="mb-2">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-sm text-gray-900 leading-tight line-clamp-2">{produto.nome}</h3>
                    {isInactive && (
                      <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase tracking-wide">{produto.setor}</p>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="font-bold text-base text-gray-900">R$ {produto.preco.toFixed(2).replace('.', ',')}</span>
                  {!isInactive && (
                    <div className="text-orange-500 transform group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center p-8 text-black">
              Nenhum produto encontrado com &quot;{searchTerm}&quot;
            </div>
          )}
        </div>
      )}

      {/* Submitted Orders List */}
      {submittedItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-black flex items-center gap-2">
              ✅ Comanda <span className="text-sm font-normal text-black">({submittedItems.filter(i => i.status !== 'CANCELADO').length})</span>
            </h2>
            <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
              <span className="font-bold text-black">
                Total: R$ {submittedItems.filter(i => i.status !== 'CANCELADO').reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
             {submittedItems.map((item, index) => (
               <div key={`${item.id}-${index}`} className={`bg-white p-2.5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all ${item.status === 'CANCELADO' ? 'opacity-60 bg-gray-100' : ''}`}>
                 
                 <div>
                   <div className="flex justify-between items-start mb-1.5">
                     <span className="text-[10px] text-black font-medium">{item.horario}</span>
                     <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                       item.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
                       item.status === 'EM_PREPARO' ? 'bg-blue-100 text-blue-700' :
                       item.status === 'PRONTO' ? 'bg-green-100 text-green-700' :
                       item.status === 'CANCELADO' ? 'bg-red-100 text-red-700' :
                       'bg-gray-100 text-black'
                     }`}>
                       {item.status === 'EM_PREPARO' ? 'PREPARO' : item.status}
                     </span>
                   </div>
                   
                   <h3 className={`font-bold text-black leading-tight mb-1 text-xs sm:text-sm ${item.status === 'CANCELADO' ? 'line-through text-gray-500' : ''}`}>
                     <span className="text-yellow-600 mr-1 text-sm sm:text-base">{item.quantidade}x</span>
                     {item.nome}
                   </h3>
                   {item.observacao && (
                     <div className="text-[10px] text-black bg-gray-50 p-1.5 rounded border border-gray-100 mb-1 italic leading-tight">
                       &quot;{item.observacao}&quot;
                     </div>
                   )}
                 </div>

                 <div className="pt-1.5 border-t border-gray-50 flex justify-between items-center">
                    {item.status !== 'CANCELADO' && ['CAIXA', 'GERENTE', 'DONO', 'ADMIN'].includes(userRole) && (
                      <button 
                        onClick={() => handleCancelItem(item.id)}
                        className="text-red-500 hover:text-white hover:bg-red-500 transition-all p-1.5 rounded-lg border border-red-200 hover:border-red-500 shadow-sm"
                        title="Cancelar Item"
                      >
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    )}
                    <span className={`font-bold text-black text-xs sm:text-sm ml-auto ${item.status === 'CANCELADO' ? 'line-through text-gray-400' : ''}`}>
                      R$ {(item.preco * item.quantidade).toFixed(2)}
                    </span>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {/* Current Order List (Visible Feedback) */}
      <div className="flex-1 overflow-y-auto mb-20">
        <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
          📝 Pedido Atual <span className="text-sm font-normal text-gray-500">({cart.length} item{cart.length !== 1 && 's'})</span>
        </h2>
        
        {cart.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-black text-lg">Nenhum item adicionado ainda.</p>
            <p className="text-gray-500 text-sm">Use a busca acima para adicionar itens.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => (
              <div key={`${item.produtoId}-${index}`} className="bg-white p-4 rounded-xl shadow-sm border border-orange-200 relative">
                {/* Header: Name and Remove */}
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-bold text-lg text-black">{item.nome}</h3>
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">{item.setor}</span>
                  </div>
                  <button 
                    onClick={() => updateQuantity(index, -item.quantidade)} // Sets to 0, which removes
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>

                {/* Observation */}
                <div className="mb-4 mt-2">
                  <label className="text-xs text-gray-500 mb-1 block">Observação</label>
                  <textarea
                    placeholder="Sem cebola, bem passado..."
                    className="w-full text-sm p-3 bg-gray-50 border border-gray-100 rounded-lg focus:outline-none focus:border-orange-500 resize-none h-20 text-black placeholder-gray-400"
                    value={item.observacao}
                    onChange={(e) => updateObservation(index, e.target.value)}
                  />
                </div>
                
                {/* Footer: Controls and Subtotal */}
                <div className="flex items-end justify-between">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button 
                      onClick={() => updateQuantity(index, -1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-black font-bold hover:bg-white hover:shadow-sm transition-all"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-black">{item.quantidade}</span>
                    <button 
                      onClick={() => updateQuantity(index, 1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-black font-bold hover:bg-white hover:shadow-sm transition-all"
                    >
                      +
                    </button>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-xs text-gray-500 block">Subtotal</span>
                    <span className="font-bold text-xl text-black">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex items-center justify-between md:px-8 z-30">
          <div className="text-xl font-bold text-black">
            Total: <span className="text-green-600">R$ {total.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setShowConfirmModal(true)}
            className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-green-700 shadow-lg hover:shadow-green-200 transition-all flex items-center gap-2"
          >
            Enviar Pedido ({cart.reduce((a, b) => a + b.quantidade, 0)}) 🚀
          </button>
        </div>
      )}

      {/* Cancel Item Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelItem}
        title="Cancelar Item"
        description="Tem certeza que deseja cancelar este item? O valor será estornado da comanda."
        confirmText="Sim, Cancelar"
        cancelText="Não"
        variant="danger"
      />

      {/* Product Options Modal */}
      <ProductOptionsModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onConfirm={handleModalConfirm}
      />

      {/* Transfer Modal */}
      {showTransferModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-50">
              <h2 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                <ArrowRightLeft size={24} className="text-blue-600" />
                Trocar de Mesa
              </h2>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Selecione a mesa de destino. Todos os pedidos da Mesa {mesaId} serão transferidos.
              </p>
              
              <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto mb-6 p-1">
                {availableTables.map(table => (
                  <button
                    key={table.id}
                    onClick={() => setTargetTableId(table.id)}
                    className={`
                      p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all
                      ${targetTableId === table.id 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md transform scale-105' 
                        : 'border-gray-100 bg-white text-gray-600 hover:border-blue-200 hover:bg-gray-50'
                      }
                      ${table.status === 'OCUPADA' ? 'opacity-75' : ''}
                    `}
                  >
                    <span className="text-lg font-bold">Mesa {table.numero}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      table.status === 'LIVRE' ? 'bg-green-100 text-green-700' :
                      table.status === 'OCUPADA' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {table.status}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleTransferTable}
                  disabled={!targetTableId || isTransferring}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isTransferring ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Transferindo...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Confirmar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h2 className="text-2xl font-bold text-black text-center">Confirmar Envio</h2>
              <p className="text-center text-black mt-1">Verifique os itens antes de enviar para produção</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {Object.entries(itemsBySetor).map(([setor, items]) => (
                <div key={setor} className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-black">
                    {setor === 'COZINHA' ? '🍳' : setor === 'BAR' ? '🍺' : '📦'} {setor}
                  </h3>
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.produtoId} className="flex justify-between items-start text-sm">
                        <div>
                          <span className="font-bold text-black">{item.quantidade}x {item.nome}</span>
                          {item.observacao && (
                            <p className="text-red-500 text-xs mt-0.5">Obs: {item.observacao}</p>
                          )}
                        </div>
                        <span className="text-black">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                <span className="text-xl font-bold text-black">Total Final</span>
                <span className="text-2xl font-bold text-green-600">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-4 bg-white">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-4 rounded-xl border-2 border-gray-200 font-bold text-black hover:bg-gray-50 transition-colors"
              >
                Voltar e Editar
              </button>
              <button
                onClick={submitOrder}
                disabled={submitting}
                className="flex-1 py-4 rounded-xl bg-green-600 font-bold text-white hover:bg-green-700 shadow-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? 'Enviando...' : 'Confirmar e Enviar ✅'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}
