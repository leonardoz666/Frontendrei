'use client'

import { useEffect, useState, use, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Produto = {
  id: number
  nome: string
  preco: number
  categoriaId: number
}

type Categoria = {
  id: number
  nome: string
  setor: string
  produtos: Produto[]
}

type CartItem = {
  produtoId: number
  nome: string
  preco: number
  quantidade: number
  observacao: string
  setor: string
}

type SubmittedItem = {
  id: number
  nome: string
  quantidade: number
  preco: number
  observacao: string | null
  status: string
  horario: string
}

type APIPedido = {
  id: number
  criadoEm: string
  itens: {
    id: number
    quantidade: number
    observacao: string | null
    status: string
    produto: {
      nome: string
      preco: number
    }
  }[]
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const unwrappedParams = use(params)
  const mesaId = Number(unwrappedParams.id)

  const [categories, setCategories] = useState<Categoria[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [submittedItems, setSubmittedItems] = useState<SubmittedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [tableStatus, setTableStatus] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const fetchTableData = useCallback(async () => {
    try {
      const res = await fetch(`/api/tables/${mesaId}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
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
      }
    } catch (error) {
      console.error('Error fetching table data:', error)
    }
  }, [mesaId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const meRes = await fetch('/api/auth/me')
        const meData = await meRes.json()
        if (!meData.user) {
          router.replace('/login')
          return
        }

        const productsRes = await fetch('/api/categories', { cache: 'no-store' })
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
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router, fetchTableData])

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

    setCart(prev => {
      const existing = prev.find(item => item.produtoId === produto.id)
      if (existing) {
        return prev.map(item => 
          item.produtoId === produto.id 
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

  const updateQuantity = (produtoId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.produtoId === produtoId) {
        const newQty = Math.max(0, item.quantidade + delta)
        return { ...item, quantidade: newQty }
      }
      return item
    }).filter(item => item.quantidade > 0))
  }

  const updateObservation = (produtoId: number, obs: string) => {
    setCart(prev => prev.map(item => 
      item.produtoId === produtoId ? { ...item, observacao: obs } : item
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
        setFeedback({ type: 'success', message: 'Pedido enviado com sucesso!' })
        fetchTableData()
      } else {
        setFeedback({ type: 'error', message: 'Erro ao enviar pedido' })
      }
    } catch (error) {
      console.error(error)
      setFeedback({ type: 'error', message: 'Erro ao enviar pedido' })
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
        <Link href="/" className="text-orange-500 font-medium hover:underline flex items-center gap-1">
          <span>←</span> Voltar ao Início
        </Link>
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
          {filteredProducts.map(produto => (
            <button
              key={produto.id}
              onClick={() => addToCart(produto)}
              className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200 hover:border-orange-500 hover:shadow-md transition-all text-left flex flex-col justify-between min-h-[110px] group"
            >
              <div className="mb-2">
                <h3 className="font-bold text-sm text-gray-900 leading-tight line-clamp-2">{produto.nome}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium uppercase tracking-wide">{produto.setor}</p>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="font-bold text-base text-gray-900">R$ {produto.preco.toFixed(2).replace('.', ',')}</span>
                <div className="text-orange-500 transform group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="16"></line>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                  </svg>
                </div>
              </div>
            </button>
          ))}
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
              ✅ Comanda <span className="text-sm font-normal text-black">({submittedItems.length})</span>
            </h2>
            <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
              <span className="font-bold text-black">
                Total: R$ {submittedItems.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
             {submittedItems.map((item, index) => (
               <div key={`${item.id}-${index}`} className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                 
                 <div>
                   <div className="flex justify-between items-start mb-1.5">
                     <span className="text-[10px] text-black font-medium">{item.horario}</span>
                     <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                       item.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
                       item.status === 'EM_PREPARO' ? 'bg-blue-100 text-blue-700' :
                       item.status === 'PRONTO' ? 'bg-green-100 text-green-700' :
                       'bg-gray-100 text-black'
                     }`}>
                       {item.status === 'EM_PREPARO' ? 'PREPARO' : item.status}
                     </span>
                   </div>
                   
                   <h3 className="font-bold text-black leading-tight mb-1 text-xs sm:text-sm">
                     <span className="text-yellow-600 mr-1 text-sm sm:text-base">{item.quantidade}x</span>
                     {item.nome}
                   </h3>
                   
                   {item.observacao && (
                     <div className="text-[10px] text-black bg-gray-50 p-1.5 rounded border border-gray-100 mb-1 italic leading-tight">
                       &quot;{item.observacao}&quot;
                     </div>
                   )}
                 </div>

                 <div className="pt-1.5 border-t border-gray-50 flex justify-end items-center">
                    <span className="font-bold text-black text-xs sm:text-sm">
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
            {cart.map(item => (
              <div key={item.produtoId} className="bg-white p-4 rounded-xl shadow-sm border border-orange-200 relative">
                {/* Header: Name and Remove */}
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="font-bold text-lg text-black">{item.nome}</h3>
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wide">{item.setor}</span>
                  </div>
                  <button 
                    onClick={() => updateQuantity(item.produtoId, -item.quantidade)} // Sets to 0, which removes
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
                    onChange={(e) => updateObservation(item.produtoId, e.target.value)}
                  />
                </div>
                
                {/* Footer: Controls and Subtotal */}
                <div className="flex items-end justify-between">
                  <div className="flex items-center bg-gray-100 rounded-lg p-1">
                    <button 
                      onClick={() => updateQuantity(item.produtoId, -1)}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-black font-bold hover:bg-white hover:shadow-sm transition-all"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-black">{item.quantidade}</span>
                    <button 
                      onClick={() => updateQuantity(item.produtoId, 1)}
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

      {/* Feedback Modal */}
      {feedback && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              feedback.type === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
              {feedback.type === 'success' ? (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            
            <h3 className="text-2xl font-bold text-black mb-2">
              {feedback.type === 'success' ? 'Sucesso!' : 'Ops!'}
            </h3>
            
            <p className="text-black mb-8 text-lg">{feedback.message}</p>
            
            <button
              onClick={() => {
                setFeedback(null)
              }}
              className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg transition-transform active:scale-95 ${
                feedback.type === 'success' 
                  ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                  : 'bg-red-600 hover:bg-red-700 shadow-red-200'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
