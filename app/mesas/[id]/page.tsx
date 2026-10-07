'use client'

import { useEffect, useState, use, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, X, ListOrdered, ListPlus, Trash2, Rocket, PlusCircle, Minus, Plus, Search, CreditCard, Receipt, Lock, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import { ProductOptionsModal } from '@/components/ProductOptionsModal'
import { PaymentModal } from '@/components/PaymentModal'
import { RequestBillModal } from '@/app/components/RequestBillModal'
import { unwrapList } from '@/app/lib/legacyArray'
import { connectTableSocket } from '@/app/lib/table-socket'
import { apiFetch } from '@/app/lib/api'
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
  const [userPermissions, setUserPermissions] = useState<string[]>([])
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const submitInFlight = useRef(false)
  const reviewCloseButton = useRef<HTMLButtonElement>(null)
  const reviewDialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showReviewModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    reviewCloseButton.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showReviewModal])

  useEffect(() => {
    if (!showReviewModal) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting && !submitInFlight.current) {
        setShowReviewModal(false)
      }
      if (event.key !== 'Tab') return
      const buttons = reviewDialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [showReviewModal, submitting])

  // Transfer Table State
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [availableTables, setAvailableTables] = useState<{ id: number, numero: number, status: string }[]>([])
  const [targetTableId, setTargetTableId] = useState<number | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [showItemTransferModal, setShowItemTransferModal] = useState(false)
  const [selectedTransferItemIds, setSelectedTransferItemIds] = useState<number[]>([])
  const [itemTransferTargetId, setItemTransferTargetId] = useState<number | null>(null)
  const [isTransferringItems, setIsTransferringItems] = useState(false)

  // Payment Modals
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [mesaNumero, setMesaNumero] = useState(mesaId)
  const paymentEntryHandled = useRef(false)

  const fetchTableData = useCallback(async () => {
    try {
      const data = await apiFetch<{ status: string; numero: number; comandas?: Array<{ pedidos: APIPedido[] }> }>(`/tables/${mesaId}`)
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
                preco: item.precoUnitario != null
                  ? Number(item.precoUnitario)
                  : Number(item.produto.preco) + (item.complementos ?? []).reduce((acc, complemento) => acc + Number(complemento.valorCobrado), 0),
                observacao: item.observacao,
                status: item.status,
                horario: new Date(pedido.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              })
            })
          })
          setSubmittedItems(items)
        } else {
          setSubmittedItems([])
        }
    } catch (error) {
      console.error(`Erro ao carregar mesa ${mesaId}:`, error)
    }
  }, [mesaId])

  useEffect(() => {
    if (showTransferModal || showItemTransferModal) {
      apiFetch<Array<{ id: number; numero: number; status: string }>>('/tables')
        .then(data => {
          setAvailableTables(data.filter(t => t.id !== mesaId))
        })
        .catch(err => console.error('Error fetching tables:', err))
    }
  }, [showTransferModal, showItemTransferModal, mesaId])

  const handleTransferTable = async () => {
    if (!targetTableId) return

    setIsTransferring(true)
    try {
      await apiFetch(`/tables/${mesaId}/transfer`, {
        method: 'POST',
        body: { targetTableId }
      })

      showToast('Mesa transferida com sucesso!', 'success')
      setShowTransferModal(false)
      router.push(`/mesas/${targetTableId}`)
    } catch (error) {
      console.error('Error transferring table:', error)
      showToast(error instanceof Error ? error.message : 'Erro ao conectar com o servidor', 'error')
    } finally {
      setIsTransferring(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const meData = await apiFetch<{ user?: { role: string; permissions?: string[] } }>('/auth/me')
        if (!meData.user) {
          router.replace('/login')
          return
        }
        setUserPermissions(meData.user.permissions ?? [])

        // `unwrapList` aceita array puro (contrato antigo) OU `{ data, meta }`
        // (contrato paginado novo). Sem isso, no dia em que a rota passar a ser
        // paginada, `productsData.sort` estoura "sort is not a function" na tela
        // de lançamento de pedido — o coração da operação. Ver lib/legacyArray.ts.
        const [categoriesResponse] = await Promise.all([
          apiFetch('/categories'),
          fetchTableData()
        ])
        const productsData = unwrapList<Categoria>(categoriesResponse)

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
        }
      } catch (err) {
        console.error('Erro ao carregar pedido:', err)
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
    const socket = connectTableSocket()

    const handleTableUpdate = (data?: { mesaId: number }) => {
      if (!data || Number(data.mesaId) === Number(mesaId)) {
        fetchTableData()
      }
    }

    socket.on('table:updated', handleTableUpdate)

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

  const canCreateOrder = userPermissions.includes('pedidos.criar')
  const canRequestBill = userPermissions.includes('pedidos.editar')
  const canTransferItems = tableStatus === 'OCUPADA' && userPermissions.includes('mesas.transferir_itens')
  const canTransferTable = tableStatus === 'OCUPADA' && userPermissions.includes('mesas.transferir')
  const canRegisterPayment = userPermissions.includes('pagamentos.abrir') && userPermissions.includes('pagamentos.registrar')
  const canApplyDiscount = userPermissions.includes('pagamentos.desconto')

  useEffect(() => {
    if (paymentEntryHandled.current || !canRegisterPayment || !tableStatus) return
    if (new URLSearchParams(window.location.search).get('recebimento') !== '1') return

    paymentEntryHandled.current = true
    setShowPaymentModal(true)
  }, [canRegisterPayment, tableStatus])

  const filteredProducts = useMemo(() => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const term = normalize(searchTerm)

    const result = allProducts.filter(p => {
      const matchesSearch = normalize(p.nome).includes(term)
      const matchesCategory = selectedCategory === 'all' || p.categoriaId.toString() === selectedCategory
      return matchesSearch && matchesCategory
    })

    if (!term && selectedCategory === 'all') {
      return result
        .sort((a, b) => (Number(b.favorito) - Number(a.favorito)))
    }

    return result
  }, [allProducts, searchTerm, selectedCategory])

  const addToCart = (produto: Produto & { setor: string }) => {
    if (tableStatus === 'FECHAMENTO' || !canCreateOrder) return

    if ((produto.tipoOpcao && produto.tipoOpcao !== 'padrao') || produto.tipo === 'POR_TAMANHO' || (produto.gruposComplemento?.length ?? 0) > 0) {
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
        preco: Number(produto.valorPromo ?? produto.preco),
        quantidade: 1,
        observacao: '',
        setor: produto.setor
      }]
    })
    setSearchTerm('') // Clear search after adding
  }

  const handleTransferItems = async () => {
    if (!itemTransferTargetId || selectedTransferItemIds.length === 0) return

    setIsTransferringItems(true)
    try {
      const result = await apiFetch<{ sourceEmptied: boolean; targetTableId: number }>(`/tables/${mesaId}/transfer-items`, {
        method: 'POST',
        body: { targetTableId: itemTransferTargetId, itemIds: selectedTransferItemIds }
      })
      showToast(`${selectedTransferItemIds.length} lançamento(s) transferido(s) com sucesso!`, 'success')
      setShowItemTransferModal(false)
      setSelectedTransferItemIds([])
      setItemTransferTargetId(null)
      if (result.sourceEmptied) router.push(`/mesas/${result.targetTableId}`)
      else await fetchTableData()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao transferir itens', 'error')
    } finally {
      setIsTransferringItems(false)
    }
  }

  const decreaseCartQuantity = (produtoId: number) => {
    setReviewError('')
    setCart(prev => {
      let index = prev.length - 1
      while (index >= 0 && prev[index].produtoId !== produtoId) index--
      if (index < 0) return prev
      if (prev[index].quantidade === 1) return prev.filter((_, itemIndex) => itemIndex !== index)
      return prev.map((item, itemIndex) => itemIndex === index
        ? { ...item, quantidade: item.quantidade - 1 }
        : item)
    })
  }

  const handleModalConfirm = (
    quantity: number,
    observation: string,
    _options: string[],
    finalPrice: number,
    extraItems?: Array<{ quantity: number, observation: string, preco: number }>,
    escolhas?: { tamanhoId?: number; complementos?: Array<{ complementoId: number }> }
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
          tamanhoId: escolhas?.tamanhoId,
          complementos: escolhas?.complementos,
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
        const complementoKey = JSON.stringify(newItem.complementos ?? [])
        const existingIndex = newCart.findIndex(item =>
          item.produtoId === newItem.produtoId &&
          item.observacao === newItem.observacao &&
          item.tamanhoId === newItem.tamanhoId &&
          JSON.stringify(item.complementos ?? []) === complementoKey
        )

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
    setReviewError('')
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  const submitOrder = async () => {
    if (cart.length === 0 || tableStatus === 'FECHAMENTO' || !canCreateOrder || submitInFlight.current) return

    submitInFlight.current = true
    setSubmitting(true)
    try {
      await apiFetch('/orders', {
        method: 'POST',
        body: {
          mesaId,
          itens: cart.map(item => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            tamanhoId: item.tamanhoId,
            complementos: item.complementos,
            observacao: item.observacao
          }))
        },
      })
      setCart([])
      setReviewError('')
      setShowReviewModal(false)
      showToast('Pedido enviado com sucesso!', 'success')
      void fetchTableData()
    } catch (error) {
      console.error(error)
      setReviewError(error instanceof Error ? error.message : 'Erro ao lançar pedido')
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)
  }, [cart])
  const cartItemCount = useMemo(() => cart.reduce((total, item) => total + item.quantidade, 0), [cart])
  const cartQuantities = useMemo(() => {
    const quantities = new Map<number, number>()
    for (const item of cart) {
      quantities.set(item.produtoId, (quantities.get(item.produtoId) ?? 0) + item.quantidade)
    }
    return quantities
  }, [cart])

  const groupedByProduct = useMemo(() => {
    const products: { [nome: string]: { nome: string, variations: { [key: string]: SubmittedItem & { quantidade: number } } } } = {}
    
    submittedItems.forEach((item) => {
      if (item.status === 'CANCELADO') return
      
      if (!products[item.nome]) {
        products[item.nome] = { nome: item.nome, variations: {} }
      }
      
      const varKey = `${item.observacao || ''}-${item.preco}`
      if (!products[item.nome].variations[varKey]) {
        products[item.nome].variations[varKey] = { ...item, quantidade: 0 }
      }
      products[item.nome].variations[varKey].quantidade += item.quantidade
    })
    
    return Object.values(products).map(p => ({
       nome: p.nome,
       variations: Object.values(p.variations)
    }))
  }, [submittedItems])

  if (loading) {
    return <div className="p-8 text-center">Carregando cardápio...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-3 md:p-6 max-w-7xl mx-auto w-full">

          {tableStatus === 'FECHAMENTO' && (
            <div className="flex items-start gap-2 border-l-4 border-red-500 bg-red-50 p-3 text-red-700">
              <Lock size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Conta em Fechamento</p>
                <p className="text-sm">Não é possível adicionar novos itens. Solicite a reabertura no mapa de mesas se necessário.</p>
              </div>
            </div>
          )}

          {/* Comanda + Produtos */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Comanda Section */}
            <section className="mb-4 overflow-hidden rounded-md border border-gray-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-lg font-bold text-gray-900">Mesa {mesaNumero}</h1>
                  <span className="text-xs font-medium text-gray-500">Comanda</span>
                </div>
                <div className="flex items-center gap-2">
                  {canTransferTable && (
                    <button
                      type="button"
                      onClick={() => { setTargetTableId(null); setShowTransferModal(true) }}
                      title="Trocar de mesa"
                      aria-label="Trocar de mesa"
                      className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                    >
                      <ArrowRightLeft size={16} />
                      <span className="hidden sm:inline">Trocar mesa</span>
                    </button>
                  )}
                  {canTransferItems && submittedItems.some(item => item.status !== 'CANCELADO') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTransferItemIds([])
                        setItemTransferTargetId(null)
                        setShowItemTransferModal(true)
                      }}
                      title="Transferir itens individualmente"
                      className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                    >
                      <ListPlus size={16} />
                      <span>Transferir itens</span>
                    </button>
                  )}
                  {canRegisterPayment && submittedItems.length > 0 && (
                    <button type="button" onClick={() => setShowPaymentModal(true)} title="Fechar conta" aria-label="Fechar conta" className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-green-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700">
                      <CreditCard size={16} />
                      <span className="hidden sm:inline">Fechar conta</span>
                    </button>
                  )}
                  {canRequestBill && tableStatus !== 'FECHAMENTO' && (
                    <button
                      type="button"
                      onClick={() => setShowBillModal(true)}
                      title="Solicitar conta"
                      aria-label="Solicitar conta"
                      className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
                    >
                      <Receipt size={16} />
                      <span className="hidden sm:inline">Solicitar conta</span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto p-3">
                {groupedByProduct.length === 0 ? (
                  <div className="py-3 text-center text-sm text-gray-500">
                    Nenhum item lançado nesta mesa.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start gap-2.5">
                    {groupedByProduct.map((productGroup, idx) => {
                      const originalProduct = allProducts.find(p => p.nome === productGroup.nome)
                      
                      return (
                        <div key={idx} className="w-[150px] max-w-full bg-white rounded-md border border-gray-200 flex flex-col">
                          <div className="px-2.5 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center gap-1.5">
                             <h3 className="min-w-0 break-words font-semibold text-sm leading-tight text-gray-900">{productGroup.nome}</h3>
                             {originalProduct && originalProduct.ativo !== false && (
                                <button
                                  onClick={() => addToCart(originalProduct)}
                                  className="w-6 h-6 shrink-0 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors"
                                  title="Adicionar Produto"
                                  aria-label={`Adicionar ${productGroup.nome}`}
                                >
                                  <PlusCircle size={14} />
                                </button>
                             )}
                          </div>
                          <div className="px-2.5 py-1.5 divide-y divide-gray-100">
                            {productGroup.variations.map((v, vIdx) => {
                               return (
                                 <div key={vIdx} className="flex gap-1.5 py-1.5 text-xs leading-tight">
                                      <span className="shrink-0 font-bold text-orange-600">{v.quantidade}x</span>
                                      <div className="min-w-0">
                                        {v.observacao && <span className="block break-words text-gray-700">{v.observacao}</span>}
                                        <span className="block font-semibold text-gray-600">R$ {(v.preco * v.quantidade).toFixed(2).replace('.', ',')}</span>
                                      </div>
                                 </div>
                               );
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Produtos Section */}
            <section className="flex-1 overflow-hidden flex flex-col min-h-[500px]">
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
                  disabled={tableStatus === 'FECHAMENTO' || !canCreateOrder}
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
                <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                  {filteredProducts.map(produto => {
                    const isInactive = produto.ativo === false
                    const isDisabled = isInactive || tableStatus === 'FECHAMENTO' || !canCreateOrder
                    const quantity = cartQuantities.get(produto.id) ?? 0
                    return (
                      <article
                        key={produto.id}
                        className={`flex flex-col rounded-md border bg-white p-3 text-left transition-colors ${isDisabled
                          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60'
                          : quantity > 0 ? 'border-orange-500' : 'border-gray-200 hover:border-orange-500'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => addToCart(produto)}
                          disabled={isDisabled}
                          aria-label={`Adicionar ${produto.nome} ao pedido`}
                          title={produto.nome}
                          className="block w-full text-left disabled:cursor-not-allowed"
                        >
                          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-gray-900">{produto.nome}</h3>
                        </button>

                        <div className="mt-2 flex flex-wrap items-end justify-between gap-1">
                          <span className="whitespace-nowrap text-sm font-bold text-gray-900">R$ {produto.preco.toFixed(2).replace('.', ',')}</span>
                          {!isDisabled && (quantity === 0 ? (
                            <button
                              type="button"
                              onClick={() => addToCart(produto)}
                              title={`Adicionar ${produto.nome}`}
                              aria-label={`Adicionar ${produto.nome}`}
                              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 hover:bg-orange-200"
                            >
                              <PlusCircle size={20} />
                            </button>
                          ) : (
                            <div role="group" aria-label={`Quantidade de ${produto.nome}`} className="ml-auto flex h-9 shrink-0 items-center rounded-md bg-neutral-950 text-white">
                              <button type="button" onClick={() => decreaseCartQuantity(produto.id)} title="Diminuir quantidade" aria-label={`Diminuir quantidade de ${produto.nome}`} className="flex h-9 w-9 items-center justify-center rounded-l-md hover:bg-neutral-800">
                                <Minus size={16} />
                              </button>
                              <output className="w-4 text-center text-sm font-semibold" aria-live="polite">{quantity}</output>
                              <button type="button" onClick={() => addToCart(produto)} title="Aumentar quantidade" aria-label={`Aumentar quantidade de ${produto.nome}`} className="flex h-9 w-9 items-center justify-center rounded-r-md hover:bg-neutral-800">
                                <Plus size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </article>
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
        </div>
      </main>

      {/* Footer - Fixed Bottom Bar */}
      <footer className="sticky bottom-0 z-20 border-t border-gray-200 bg-white px-3 py-3 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <span className="text-sm font-medium text-gray-600">{cartItemCount} {cartItemCount === 1 ? 'item selecionado' : 'itens selecionados'}</span>
            <span className="text-lg font-bold text-gray-900">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setReviewError('')
              setShowReviewModal(true)
            }}
            disabled={cart.length === 0 || submitting || tableStatus === 'FECHAMENTO' || !canCreateOrder}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-2.5 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <ListOrdered size={18} />
            Conferir pedido
          </button>
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

      {showItemTransferModal && (
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="transfer-items-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
                <div>
                  <h2 id="transfer-items-title" className="text-lg font-bold text-slate-950">Transferir itens</h2>
                  <p className="text-sm text-slate-500">Escolha os lançamentos e a mesa que irá recebê-los.</p>
                </div>
                <button type="button" onClick={() => setShowItemTransferModal(false)} disabled={isTransferringItems} aria-label="Fechar" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50">
                  <X size={20} />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)] md:overflow-hidden">
                <section className="border-b border-slate-200 p-4 md:overflow-y-auto md:border-b-0 md:border-r sm:p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">Itens da mesa {mesaNumero}</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const itemIds = submittedItems.filter(item => item.status !== 'CANCELADO').map(item => item.id)
                        setSelectedTransferItemIds(selectedTransferItemIds.length === itemIds.length ? [] : itemIds)
                      }}
                      className="text-xs font-semibold text-orange-700 hover:text-orange-800"
                    >
                      {selectedTransferItemIds.length === submittedItems.filter(item => item.status !== 'CANCELADO').length ? 'Limpar seleção' : 'Selecionar todos'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {submittedItems.filter(item => item.status !== 'CANCELADO').map(item => {
                      const selected = selectedTransferItemIds.includes(item.id)
                      return (
                        <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${selected ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => setSelectedTransferItemIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}
                            className="mt-0.5 h-4 w-4 accent-orange-600"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-3">
                              <span className="font-semibold text-slate-900">{item.quantidade}x {item.nome}</span>
                              <span className="shrink-0 text-sm font-semibold text-slate-700">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
                            </span>
                            {item.observacao && <span className="mt-1 block break-words text-xs text-slate-500">{item.observacao}</span>}
                            <span className="mt-1 block text-xs text-slate-400">Lançado às {item.horario}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </section>

                <section className="p-4 md:overflow-y-auto sm:p-5">
                  <h3 className="mb-1 font-semibold text-slate-900">Mesa de destino</h3>
                  <p className="mb-3 text-xs text-slate-500">Somente mesas abertas podem receber itens.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {availableTables.filter(table => table.status === 'OCUPADA').map(table => (
                      <button
                        key={table.id}
                        type="button"
                        onClick={() => setItemTransferTargetId(table.id)}
                        className={`rounded-md border px-3 py-2.5 text-left text-slate-950 transition-colors ${itemTransferTargetId === table.id ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'}`}
                      >
                        <span className="block font-bold">Mesa {table.numero}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-amber-700">Ocupada</span>
                      </button>
                    ))}
                  </div>
                  {availableTables.filter(table => table.status === 'OCUPADA').length === 0 && (
                    <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Nenhuma outra mesa aberta para receber itens.</p>
                  )}
                </section>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-slate-600">{selectedTransferItemIds.length} lançamento(s) selecionado(s)</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowItemTransferModal(false)} disabled={isTransferringItems} className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:flex-none">Cancelar</button>
                  <button type="button" onClick={handleTransferItems} disabled={!itemTransferTargetId || selectedTransferItemIds.length === 0 || isTransferringItems} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-orange-600 px-4 font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
                    {isTransferringItems && <Loader2 size={17} className="animate-spin" />}
                    Transferir itens
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
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
                    {availableTables.filter(table => table.status === 'LIVRE').map(table => (
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

      {/* Conferência obrigatória antes do lançamento */}
      {showReviewModal && (
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3 sm:p-4">
            <div ref={reviewDialog} role="dialog" aria-modal="true" aria-labelledby="review-order-title" className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-md bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <ListOrdered className="text-orange-600" size={20} />
                  <div>
                    <h2 id="review-order-title" className="text-lg font-semibold text-gray-900">Conferir pedido</h2>
                    <p className="text-xs text-gray-500">Mesa {mesaNumero} · {cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'}</p>
                  </div>
                </div>
                <button ref={reviewCloseButton} type="button" onClick={() => setShowReviewModal(false)} disabled={submitting} aria-label="Fechar conferência" className="rounded-md p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-2">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">Nenhum item para lançar.</p>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 border-b border-gray-100 py-3 last:border-0">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <span className="shrink-0 text-sm font-bold text-orange-600">
                          {item.quantidade}x
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-gray-900">{item.nome}</p>
                          {item.observacao && <p className="mt-0.5 break-words text-xs text-gray-600">{item.observacao}</p>}
                          <p className="mt-1 text-sm font-semibold text-gray-800">
                            R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(index)}
                        disabled={submitting}
                        title="Remover item"
                        aria-label={`Remover ${item.nome} do pedido`}
                        className="shrink-0 rounded-md p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-gray-200 bg-gray-50 p-4">
                {(reviewError || tableStatus === 'FECHAMENTO') && (
                  <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    {reviewError || 'A conta está em fechamento. Reabra a mesa antes de lançar itens.'}
                  </p>
                )}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-600">Total do pedido</span>
                  <span className="text-lg font-bold text-gray-900">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => setShowReviewModal(false)} disabled={submitting} className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                    Continuar escolhendo
                  </button>
                  <button type="button" onClick={submitOrder} disabled={cart.length === 0 || submitting || tableStatus === 'FECHAMENTO' || !canCreateOrder} className="flex items-center justify-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
                    <Rocket size={18} />
                    {submitting ? 'Lançando...' : 'Lançar pedido'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          if (new URLSearchParams(window.location.search).get('recebimento') === '1') {
            router.replace(`/mesas/${mesaId}`)
          }
        }}
        items={submittedItems.filter(i => i.status !== 'CANCELADO')}
        mesaId={mesaId}
        mesaNumero={mesaNumero}
        canApplyDiscount={canApplyDiscount}
        onSuccess={() => {
          showToast('Pagamento registrado com sucesso!', 'success')
          router.push('/mesas')
        }}
      />
      <RequestBillModal
        isOpen={showBillModal}
        mesaId={mesaId}
        onClose={() => setShowBillModal(false)}
        onRequestSuccess={() => router.push('/mesas')}
      />

    </div>
  )
}
