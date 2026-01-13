'use client'

import { useEffect, useState, use, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { io } from 'socket.io-client'
import { ArrowRightLeft, X, ListOrdered, Trash2, Rocket, Clock, PlusCircle, CheckCircle2, Search, History, CreditCard } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import { ProductOptionsModal } from '@/components/ProductOptionsModal'
import { PaymentModal } from '@/components/PaymentModal'
import { OrderHistoryModal } from '@/components/OrderHistoryModal'
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<Produto | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [isMobile, setIsMobile] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Transfer Table State
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [availableTables, setAvailableTables] = useState<{ id: number, numero: number, status: string }[]>([])
  const [targetTableId, setTargetTableId] = useState<number | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)

  // Payment and History Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [mesaNumero, setMesaNumero] = useState(mesaId)

  const fetchTableData = useCallback(async () => {
    try {
      console.log(`[DEBUG] Fetching table data for mesaId: ${mesaId}`);
      const res = await fetch(`/api/tables/${mesaId}`, { cache: 'no-store' })
      console.log(`[DEBUG] fetchTableData response status: ${res.status}`);
      if (res.ok) {
        const data = await res.json()
        console.log(`[DEBUG] fetchTableData success:`, data);
        setTableStatus(data.status)
        setMesaNumero(data.numero || mesaId)
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
      cat.produtos.map(prod => ({ ...prod, setor: cat.setor }))
    )
  }, [categories])

  const filteredProducts = useMemo(() => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const term = normalize(searchTerm)

    const result = allProducts.filter(p => {
      const matchesSearch = normalize(p.nome).includes(term)
      const matchesCategory = selectedCategory === 'all' || p.categoriaId.toString() === selectedCategory
      return matchesSearch && matchesCategory
    })

    // Se usuário não está pesquisando e está na categoria 'Todos', limitar a 10 (Prioridade Favoritos)
    if (!term && selectedCategory === 'all') {
      if (isMobile) return []
      return result
        .sort((a, b) => (Number(b.favorito) - Number(a.favorito)))
        .slice(0, 10)
    }

    return result
  }, [allProducts, searchTerm, selectedCategory, isMobile])

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
    extraItems?: Array<{ quantity: number, observation: string, preco: number }>
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

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)
  }, [cart])

  const submittedGroups = useMemo(() => {
    const groups: { [key: string]: SubmittedItem & { quantidade: number } } = {}
    submittedItems.forEach(item => {
      if (item.status === 'CANCELADO') return
      const key = `${item.nome}-${item.preco}-${item.observacao || ''}`
      if (!groups[key]) {
        groups[key] = { ...item, quantidade: 0 }
      }
      groups[key].quantidade += item.quantidade
    })
    return Object.values(groups)
  }, [submittedItems])



  if (loading) {
    return <div className="p-8 text-center">Carregando cardápio...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Mesa {mesaNumero}</h1>
          {['CAIXA', 'GERENTE', 'DONO', 'ADMIN'].includes(userRole) && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="bg-blue-100 text-blue-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-200 transition-colors"
              title="Trocar de Mesa"
            >
              <ArrowRightLeft size={18} />
              <span className="hidden sm:inline">Trocar Mesa</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* History Button */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-gray-200 transition-colors"
            title="Ver Histórico"
          >
            <History size={18} />
            <span className="hidden sm:inline">Histórico</span>
          </button>

          {/* Payment Button - Only for authorized roles */}
          {['CAIXA', 'GERENTE', 'DONO', 'ADMIN'].includes(userRole) && submittedItems.length > 0 && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
              title="Fechar Conta"
            >
              <CreditCard size={18} />
              <span className="hidden sm:inline">Fechar Conta</span>
            </button>
          )}

          <Link href="/" className="text-orange-500 font-medium hover:underline flex items-center gap-1">
            ← Voltar ao Início
          </Link>
        </div>
      </header>

      {tableStatus === 'FECHAMENTO' && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mx-6 mt-4 rounded shadow-sm flex items-center justify-between">
          <div>
            <p className="font-bold">🔒 Conta em Fechamento</p>
            <p className="text-sm">Não é possível adicionar novos itens. Solicite a reabertura no mapa de mesas se necessário.</p>
          </div>
        </div>
      )}

      {/* Main Content - Two Columns */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col lg:flex-row p-6 gap-6">

          {/* Left Side - Comanda + Produtos */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Comanda Section */}
            <section className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="text-green-500" size={24} />
                Comanda
              </h2>

              {submittedGroups.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-400">
                  Nenhum item lançado nesta mesa.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {submittedGroups.map((group, idx) => {
                    const originalProduct = allProducts.find(p => p.nome === group.nome)

                    return (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between min-h-[100px]">
                        <div>
                          <h3 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight">{group.nome}</h3>
                          {group.observacao && (
                            <p className="text-xs text-gray-500 mt-1">{group.observacao}</p>
                          )}
                        </div>

                        <div className="flex items-end justify-between mt-3">
                          <span className="font-bold text-base text-gray-900">R$ {group.preco.toFixed(2).replace('.', ',')}</span>
                          {originalProduct && originalProduct.ativo !== false ? (
                            <button
                              onClick={() => addToCart(originalProduct)}
                              className="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center hover:bg-orange-200 transition-colors"
                              title="Adicionar mais um"
                            >
                              <PlusCircle size={20} />
                            </button>
                          ) : (
                            <span className="text-xs text-red-400">Indisponível</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Produtos Section */}
            <section className="flex-1 overflow-hidden flex flex-col">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Produtos</h2>

              {/* Search Bar */}
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar produto (ex: Cerveja, Moqueca)..."
                  className="w-full p-3 pl-12 rounded-xl border border-gray-200 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 bg-white placeholder-gray-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={tableStatus === 'FECHAMENTO'}
                />
              </div>

              {/* Categories Filter */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors text-sm ${selectedCategory === 'all'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                  Todos
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id.toString())}
                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-colors text-sm ${selectedCategory === cat.id.toString()
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                      }`}
                  >
                    {cat.nome}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
                  {filteredProducts.map(produto => {
                    const isInactive = produto.ativo === false
                    return (
                      <button
                        key={produto.id}
                        onClick={() => !isInactive && addToCart(produto)}
                        disabled={isInactive || tableStatus === 'FECHAMENTO'}
                        className={`bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between min-h-[100px] text-left transition-all ${isInactive || tableStatus === 'FECHAMENTO'
                          ? 'opacity-60 cursor-not-allowed bg-gray-50'
                          : 'hover:border-orange-500 hover:shadow-md'
                          }`}
                      >
                        <div>
                          <h3 className="font-bold text-sm text-gray-900 line-clamp-2 leading-tight">{produto.nome}</h3>
                          <p className="text-xs text-gray-500 mt-1">{produto.setor}</p>
                        </div>

                        <div className="flex items-end justify-between mt-3">
                          <span className="font-bold text-base text-gray-900">R$ {produto.preco.toFixed(2).replace('.', ',')}</span>
                          {!isInactive && tableStatus !== 'FECHAMENTO' && (
                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center">
                              <PlusCircle size={20} />
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
              </div>
            </section>
          </div>

          {/* Right Side - Pedido Atual (Hidden on Mobile) */}
          <aside className="hidden lg:flex lg:w-[380px] bg-white rounded-xl border border-gray-200 shadow-sm flex-col h-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <ListOrdered className="text-orange-500" size={20} />
                <h2 className="font-bold text-lg text-gray-900">
                  Pedido Atual <span className="text-gray-400 text-sm font-normal">({cart.length})</span>
                </h2>
              </div>
              <div className="bg-gray-200 px-2 py-1 rounded text-xs font-bold text-gray-700">
                Total: R$ {cartTotal.toFixed(2).replace('.', ',')}
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  Selecione produtos do cardápio para adicionar ao pedido.
                </div>
              ) : (
                cart.map((item, index) => {
                  // Extract option from observation for display
                  let displayName = item.nome
                  let displayObs = item.observacao || ''
                  const optionMatch = displayObs.match(/^\(\s*(.+?)\s*\)\s*(.*)/)
                  if (optionMatch) {
                    displayName += ` ( ${optionMatch[1]} )`
                    displayObs = optionMatch[2]
                  }

                  return (
                    <div key={`cart-${index}`} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative">
                      {/* Top row - pending status */}
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          --:--
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-yellow-100 text-yellow-700">
                          PENDENTE
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-orange-600 font-bold text-sm">{item.quantidade}x</span>
                        <div className="flex-1">
                          <span className="font-bold text-gray-900 text-sm block leading-tight">{displayName}</span>
                          {displayObs && (
                            <span className="text-xs text-gray-500 block mt-0.5">{displayObs}</span>
                          )}
                        </div>
                      </div>

                      {/* Bottom row - price and action */}
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
                  )
                })
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Footer - Fixed Bottom Bar */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4 sticky bottom-0 z-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-medium">Total:</span>
            <span className="text-2xl font-bold text-green-600">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="px-4 py-3 text-gray-500 font-bold hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Limpar
            </button>
            <button
              onClick={() => isMobile ? setShowReviewModal(true) : submitOrder()}
              disabled={cart.length === 0 || submitting}
              className="bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-green-200 hover:bg-green-700 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {submitting ? 'Enviando...' : `Enviar Pedido (${cart.length})`}
              {!submitting && <Rocket size={20} />}
            </button>
          </div>
        </div>
      </footer>

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
                <h2 className="text-xl font-bold text-gray-900">Trocar Mesa</h2>
                <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6">
                <p className="mb-4 text-gray-600">Selecione a mesa para onde deseja transferir:</p>

                {isTransferring ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                    <p className="text-gray-600">Transferindo...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                    {availableTables.map(table => (
                      <button
                        key={table.id}
                        onClick={() => setTargetTableId(table.id)}
                        className={`p-3 rounded-lg border-2 font-bold transition-all ${targetTableId === table.id
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

      {/* Mobile Review Modal */}
      {showReviewModal && (
        createPortal(
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-2">
                  <ListOrdered className="text-orange-500" size={24} />
                  <h2 className="text-xl font-bold text-gray-900">Revisar Pedido ({cart.length})</h2>
                </div>
                <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={24} className="text-gray-500" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {cart.length === 0 ? (
                  <p className="text-center text-gray-500 py-10">Carrinho vazio.</p>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="flex justify-between items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex gap-3">
                        <span className="font-bold text-orange-600 px-2 py-1 bg-white rounded border border-gray-200 h-fit text-sm">
                          {item.quantidade}x
                        </span>
                        <div>
                          <p className="font-bold text-gray-900">{item.nome}</p>
                          {item.observacao && <p className="text-xs text-gray-500">{item.observacao}</p>}
                          <p className="text-sm font-bold text-gray-700 mt-1">
                            R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="text-gray-400 hover:text-red-500 p-2"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 font-medium">Total do Pedido</span>
                  <span className="text-2xl font-bold text-green-600">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <button
                  onClick={() => {
                    setShowReviewModal(false)
                    submitOrder()
                  }}
                  className="w-full py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 flex items-center justify-center gap-2 text-lg active:scale-[0.98] transition-all"
                >
                  <Rocket size={24} />
                  Confirmar Envio
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={submittedItems.filter(i => i.status !== 'CANCELADO').reduce((acc, i) => acc + (i.preco * i.quantidade), 0)}
        items={submittedItems.filter(i => i.status !== 'CANCELADO')}
        mesaId={mesaId}
        mesaNumero={mesaNumero}
        onSuccess={() => {
          showToast('Pagamento registrado com sucesso!', 'success')
          router.push('/mesas')
        }}
      />

      {/* Order History Modal */}
      <OrderHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        mesaId={mesaId}
        mesaNumero={mesaNumero}
      />

    </div>
  )
}