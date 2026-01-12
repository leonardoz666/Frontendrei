'use client'

import { useEffect, useState, use, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { io } from 'socket.io-client'
import { ArrowRightLeft, X, CheckCircle2, ListOrdered, Search, Trash2, Rocket, Clock, PlusCircle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import { ProductOptionsModal } from '@/components/ProductOptionsModal'
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
    extraItems?: Array<{quantity: number, observation: string, preco: number}>
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
          nome: selectedProduct.nome,
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
            nome: selectedProduct.nome,
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

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index))
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

  const totalCart = cart.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)
  const totalSubmitted = submittedItems.filter(i => i.status !== 'CANCELADO').reduce((acc, item) => acc + (item.preco * item.quantidade), 0)
  const grandTotal = totalCart + totalSubmitted

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Left Column - Product Menu */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
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

          {/* Comanda Section (Actually Products Search & Grid) */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-green-500" size={24} /> Comanda
            </h2>
            
            {/* Search Bar */}
            <div className="mb-6 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar produto (ex: Cerveja, Moqueca)..."
                className="w-full p-4 pl-12 text-lg rounded-xl border border-gray-200 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-black bg-white placeholder-gray-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                disabled={tableStatus === 'FECHAMENTO'}
              />
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(produto => { // Show first 12 for demo or all? The image shows "Comanda" section with some products. I'll show all filtered products here.
                const isInactive = produto.ativo === false
                return (
                  <button
                    key={produto.id}
                    onClick={() => !isInactive && addToCart(produto)}
                    disabled={isInactive}
                    className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-[120px] relative group transition-all ${
                      isInactive ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:border-orange-500 hover:shadow-md'
                    }`}
                  >
                    <div className="w-full">
                      <h3 className="font-bold text-sm text-gray-900 text-left line-clamp-2 leading-tight">{produto.nome}</h3>
                      <p className="text-xs text-gray-500 mt-1 text-left">{produto.setor}</p>
                    </div>
                    
                    <div className="flex items-end justify-between w-full mt-2">
                      <span className="font-bold text-lg text-black">R$ {produto.preco.toFixed(2).replace('.', ',')}</span>
                      {!isInactive && (
                        <div className="text-orange-500">
                           <PlusCircle size={24} />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
              {filteredProducts.length === 0 && (
                 <div className="col-span-full text-center py-8 text-gray-500">
                   Nenhum produto encontrado.
                 </div>
              )}
            </div>
            
            <div className="mt-8">
                <h2 className="text-lg font-bold text-black mb-4">Produtos</h2>
                {/* Search bar could be duplicated here if needed as per image, but sticking to one main search for now as it's cleaner, unless strictly requested. The image shows two search bars, implying two categories. I'll stick to one list for now as categories are dynamic. */}
                 {/* Replicating the "Produtos" section search bar if the user strictly wants it, but logic-wise it's redundant unless filtering different things. */}
                 <div className="mb-6 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar produto (ex: Cerveja, Moqueca)..."
                    className="w-full p-4 pl-12 text-lg rounded-xl border border-gray-200 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-black bg-white placeholder-gray-400"
                    // Separate state for this search if needed, but for now reuse or just visual placeholder
                    disabled={true} 
                  />
                </div>
                 {/* Product cards again? I will just leave the top grid as the main one for now to avoid confusion. */}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Order Summary (Unified) */}
      <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col h-full shadow-xl z-10">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <ListOrdered className="text-orange-500" size={20} />
            <h2 className="font-bold text-lg text-black">Pedido Atual <span className="text-gray-400 text-sm font-normal">({cart.length + submittedItems.filter(i => i.status !== 'CANCELADO').length})</span></h2>
          </div>
          <div className="bg-gray-200 px-2 py-1 rounded text-xs font-bold text-gray-700">
             Total: R$ {grandTotal.toFixed(2).replace('.', ',')}
          </div>
        </div>

        {/* Unified List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
          {/* Cart Items (Pending) */}
          {cart.map((item, index) => (
            <div key={`cart-${index}`} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                  <Clock size={10} />
                  --:--
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700">
                  PENDENTE
                </span>
              </div>
              
              <div className="flex items-start gap-2 mb-2">
                <span className="text-orange-600 font-bold text-sm">{item.quantidade}x</span>
                <div className="flex-1">
                  <span className="font-bold text-gray-900 text-sm block leading-tight">{item.nome}</span>
                  {item.observacao && (
                    <span className="text-xs text-gray-500 block mt-0.5">{item.observacao}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-2">
                <span className="font-bold text-sm text-gray-900">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
                <button 
                  onClick={() => removeFromCart(index)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          {/* Submitted Items */}
          {submittedItems.map((item, index) => {
             if (item.status === 'CANCELADO') return null; // Don't show cancelled items in main list or show with strikethrough? Reference image doesn't show cancelled.
             
             // Extract option
             let displayName = item.nome
             let displayObs = item.observacao || ''
             const optionMatch = displayObs.match(/^\(\s*(.+?)\s*\)\s*(.*)/)
             if (optionMatch) {
               displayName += ` ( ${optionMatch[1]} )`
               displayObs = optionMatch[2]
             }

             return (
              <div key={`submitted-${item.id}-${index}`} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                    <Clock size={10} />
                    {item.horario}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                         item.status === 'EM_PREPARO' ? 'bg-blue-100 text-blue-700' :
                         item.status === 'PRONTO' ? 'bg-green-100 text-green-700' :
                         'bg-gray-100 text-black'
                       }`}>
                    {item.status === 'EM_PREPARO' ? 'COZINHA' : item.status}
                  </span>
                </div>
                
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-orange-600 font-bold text-sm">{item.quantidade}x</span>
                  <div className="flex-1">
                    <span className="font-bold text-gray-900 text-sm block leading-tight">{displayName}</span>
                    {displayObs && (
                      <span className="text-xs text-gray-500 block mt-0.5">{displayObs}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-2">
                  <span className="font-bold text-sm text-gray-900">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
                  <button 
                    onClick={() => handleCancelItem(item.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
             )
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
             <span className="text-gray-500 font-medium">Total:</span>
             <span className="text-2xl font-bold text-green-600">R$ {grandTotal.toFixed(2).replace('.', ',')}</span>
          </div>
          
          <div className="flex gap-3">
             <button 
               onClick={() => setCart([])}
               disabled={cart.length === 0}
               className="px-4 py-3 text-gray-500 font-bold hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Limpar
             </button>
             <button 
               onClick={submitOrder}
               disabled={cart.length === 0 || submitting}
               className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
             >
               {submitting ? 'Enviando...' : `Enviar Pedido (${cart.length})`}
               {!submitting && <Rocket size={20} />}
             </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedProduct && (
        <ProductOptionsModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          onConfirm={handleModalConfirm}
        />
      )}



      {showTransferModal && (
        createPortal(
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold">Trocar Mesa</h2>
                <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6">
                <p className="mb-4 text-gray-600">Selecione a mesa para onde deseja transferir:</p>
                
                {isTransferring ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                    <p>Transferindo...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                    {availableTables.map(table => (
                      <button
                        key={table.id}
                        onClick={() => setTargetTableId(table.id)}
                        className={`p-3 rounded-lg border-2 font-bold transition-all ${
                          targetTableId === table.id
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-orange-200 text-gray-700'
                        }`}
                      >
                        Mesa {table.numero}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTransferTable}
                    disabled={!targetTableId || isTransferring}
                    className="flex-1 py-3 px-4 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {showCancelModal && (
        createPortal(
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                  <X size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Cancelar Item?</h3>
                <p className="text-gray-500 mb-6">
                  Tem certeza que deseja cancelar este item? Essa ação não pode ser desfeita.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                  >
                    Não
                  </button>
                  <button
                    onClick={confirmCancelItem}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-200"
                  >
                    Sim, Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  )
}
