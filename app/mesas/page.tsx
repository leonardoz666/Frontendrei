'use client'

import { useState, useEffect } from 'react'
import { Plus, Loader2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'
import { TableCard, Mesa } from '@/components/TableCard'

type User = {
  role: string
}

export default function MesasPage() {
  const { showToast } = useToast()
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMesaNumero, setNewMesaNumero] = useState('')
  const [error, setError] = useState('')
  const [selectedTable, setSelectedTable] = useState<Mesa | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  const handleTableClick = (mesa: Mesa) => {
    if (mesa.status === 'LIVRE') {
      setSelectedTable(mesa)
      setShowModal(true)
    } else if (mesa.status === 'FECHAMENTO') {
      setSelectedTable(mesa)
      setShowReopenModal(true)
    } else {
      router.push(`/mesas/${mesa.id}`)
    }
  }

  const confirmOpenTable = async () => {
    if (!selectedTable) return
    try {
      await fetch(`/api/tables/${selectedTable.id}/open`, { method: 'POST' })
      router.push(`/mesas/${selectedTable.id}`)
    } catch (error) {
      console.error('Error opening table:', error)
      router.push(`/mesas/${selectedTable.id}`)
    }
  }

  const confirmReopenTable = async () => {
    if (!selectedTable) return
    try {
      await fetch(`/api/tables/${selectedTable.id}/reopen`, { method: 'POST' })
      setShowReopenModal(false)
      fetchMesas()
      router.push(`/mesas/${selectedTable.id}`)
    } catch (error) {
      console.error('Error reopening table:', error)
    }
  }

  const confirmCloseTable = () => {
    if (!selectedTable) return
    setShowCloseModal(true)
  }

  const executeCloseTable = async () => {
    if (!selectedTable) return

    try {
      const res = await fetch(`/api/tables/${selectedTable.id}/close`, { method: 'POST' })
      if (res.ok) {
        setShowReopenModal(false) // Close the actions modal
        setShowCloseModal(false) // Close the confirmation modal
        fetchMesas()
      } else {
        showToast('Erro ao fechar mesa', 'error')
      }
    } catch (error) {
      console.error('Error closing table:', error)
      showToast('Erro ao fechar mesa', 'error')
    }
  }

  const fetchMesas = async () => {
    try {
      console.log('[DEBUG] fetching /api/tables');
      const res = await fetch('/api/tables')
      console.log(`[DEBUG] /api/tables status: ${res.status}`);
      if (res.ok) {
        const data = await res.json()
        console.log('[DEBUG] /api/tables success, count:', data.length);
        setMesas(data)
      } else {
         console.error(`[DEBUG] /api/tables failed: ${res.status}`);
         const txt = await res.text();
         console.error(`[DEBUG] /api/tables error text: ${txt}`);
      }
    } catch (error) {
      console.error('[DEBUG] Error fetching tables:', error)
    }
  }

  useEffect(() => {
    const init = async () => {
        try {
            // Auth check
            const meRes = await fetch('/api/auth/me')
            const meData = await meRes.json()
            if (!meData.user) {
                router.replace('/login')
                return
            }
            setUser(meData.user)

            // Initial fetch
            await fetchMesas()
            setLoading(false)
        } catch (error) {
            console.error(error)
            setLoading(false)
        }
    }

    init()
    
    // Poll for updates
    const interval = setInterval(fetchMesas, 5000)
    return () => clearInterval(interval)
  }, [router])

  const handleAddMesa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCreating(true)
    setError('')
    
    try {
      const res = await fetch('/api/tables', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: newMesaNumero || undefined })
      })
      
      if (res.ok) {
        fetchMesas()
        setShowAddModal(false)
        setNewMesaNumero('')
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao criar mesa')
      }
    } catch (error) {
      console.error('Error creating table:', error)
      setError('Erro de conexão')
    } finally {
      setCreating(false)
    }
  }

  const openAddModal = () => {
    setNewMesaNumero('')
    setShowAddModal(true)
  }

  const livres = mesas.filter(m => m.status === 'LIVRE').length
  const ocupadas = mesas.filter(m => m.status !== 'LIVRE').length
  const canCreate = user?.role === 'ADMIN' || user?.role === 'DONO'
  const canClose = user?.role === 'ADMIN' || user?.role === 'DONO' || user?.role === 'GERENTE' || user?.role === 'CAIXA'

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Mapa de Mesas</h1>
            <p className="text-gray-500 mt-1">Gerencie o layout e status em tempo real.</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Widget */}
            <div className="bg-white rounded-2xl px-8 py-3 shadow-sm border border-gray-100 flex items-center gap-8">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Livres</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                  <span className="text-xl font-bold text-gray-900">{livres}</span>
                </div>
              </div>
              
              <div className="w-px h-10 bg-gray-100"></div>
              
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Ocupadas</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                  <span className="text-xl font-bold text-gray-900">{ocupadas}</span>
                </div>
              </div>
            </div>

            {/* Add Button - Only for Admin/Dono */}
            {canCreate && (
                <button 
                  onClick={openAddModal}
                  disabled={creating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white w-14 h-14 rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center"
                >
                  {creating ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} strokeWidth={2.5} />}
                </button>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {mesas.map((mesa) => (
            <TableCard 
              key={mesa.id} 
              mesa={mesa} 
              onClick={handleTableClick} 
            />
          ))}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Nova Mesa</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddMesa}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número da Mesa
                </label>
                <input
                  type="number"
                  value={newMesaNumero}
                  onChange={(e) => setNewMesaNumero(e.target.value)}
                  className="w-full text-4xl font-bold text-center text-gray-900 p-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="00"
                  autoFocus
                />
                {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newMesaNumero}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {creating ? <Loader2 className="animate-spin" size={20} /> : 'Criar Mesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Modal */}
      {showModal && selectedTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full transform transition-all scale-100">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🍽️</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Abrir Mesa {selectedTable.numero}?</h2>
              <p className="text-gray-500 mt-2">Deseja iniciar o atendimento nesta mesa?</p>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowModal(false)} 
                className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmOpenTable} 
                className="flex-1 py-3 px-4 rounded-xl bg-green-600 font-bold text-white hover:bg-green-700 shadow-lg shadow-green-200 transition-colors"
              >
                Sim, Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && selectedTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full transform transition-all scale-100">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔄</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Mesa {selectedTable.numero}</h2>
              <p className="text-gray-500 mt-2">Escolha uma ação para esta mesa</p>
            </div>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmReopenTable} 
                className="w-full py-3 px-4 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
              >
                🔄 Reabrir Conta
              </button>

              {canClose && (
                <button 
                  onClick={confirmCloseTable} 
                  className="w-full py-3 px-4 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                >
                  💰 Baixar Conta / Liberar Mesa
                </button>
              )}

              <button 
                onClick={() => {
                    router.push(`/mesas/${selectedTable.id}`)
                }}
                className="w-full py-3 px-4 rounded-xl bg-green-600 font-bold text-white hover:bg-green-700 shadow-lg shadow-green-200 transition-colors"
              >
                📄 Ver Comanda
              </button>

              <button 
                onClick={() => setShowReopenModal(false)} 
                className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {showCloseModal && selectedTable && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-2">Baixar Conta</h2>
              <p className="text-gray-600 mb-6">
                Tem certeza que deseja baixar a conta e liberar a <strong>Mesa {selectedTable.numero}</strong>?
                <br/><br/>
                Isso irá finalizar a comanda e liberar a mesa para novos clientes.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeCloseTable}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
