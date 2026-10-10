'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Loader2, X, ListPlus, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'
import { TableCard, Mesa } from '@/components/TableCard'
import { connectTableSocket } from '@/app/lib/table-socket'
import { apiFetch, redirectToLogin } from '@/app/lib/api'

type User = {
  role: string
  permissions?: string[]
}

function MesaStatusSummary({ livres, ocupadas }: { livres: number; ocupadas: number }) {
  return (
    <div className="flex h-12 items-center gap-6 rounded-lg border border-slate-200 bg-slate-50 px-5 shadow-sm">
      <div className="min-w-[70px] text-center">
        <p className="text-[10px] font-bold uppercase text-slate-500">Livres</p>
        <div className="mt-0.5 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-lg font-bold leading-none text-slate-900">{livres}</span>
        </div>
      </div>
      <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
      <div className="min-w-[70px] text-center">
        <p className="text-[10px] font-bold uppercase text-slate-500">Ocupadas</p>
        <div className="mt-0.5 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
          <span className="text-lg font-bold leading-none text-slate-900">{ocupadas}</span>
        </div>
      </div>
    </div>
  )
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
  const [tableActionPending, setTableActionPending] = useState(false)
  const tableActionInFlight = useRef(false)
  const [user, setUser] = useState<User | null>(null)
  const [headerStatusTarget, setHeaderStatusTarget] = useState<HTMLElement | null>(null)
  const [podeCadastrar, setPodeCadastrar] = useState(false)
  const [caixaAberto, setCaixaAberto] = useState<boolean | null>(null)
  const [pracas, setPracas] = useState<Array<{ id: number; nome: string }>>([])
  const [showLoteModal, setShowLoteModal] = useState(false)
  const [loteInicio, setLoteInicio] = useState('1')
  const [loteFim, setLoteFim] = useState('50')
  const [lotePracaId, setLotePracaId] = useState('')
  const [lotePrevia, setLotePrevia] = useState<{ criadas: number; ignoradas: number; numerosIgnorados: number[] } | null>(null)
  const [loteCarregando, setLoteCarregando] = useState(false)
  const [loteErro, setLoteErro] = useState('')
  const router = useRouter()

  useEffect(() => {
    const existingTarget = document.getElementById('waiter-header-status')
    if (existingTarget) {
      setHeaderStatusTarget(existingTarget)
      return
    }

    const observer = new MutationObserver(() => {
      const target = document.getElementById('waiter-header-status')
      if (!target) return

      setHeaderStatusTarget(target)
      observer.disconnect()
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const carregarPracas = async () => {
    try {
      const corpo = await apiFetch<{ data?: Array<{ id: number; nome: string }> }>('/pracas?page=1&pageSize=100')
      setPracas(corpo.data ?? [])
    } catch {
      // Praças são opcionais aqui: sem elas a geração continua (mesa fica "Não definida").
    }
  }

  const abrirLote = () => {
    setLoteInicio('1')
    setLoteFim('50')
    setLotePracaId('')
    setLotePrevia(null)
    setLoteErro('')
    setShowLoteModal(true)
  }

  /**
   * RF-MES-03: `previa: true` devolve o que SERIA criado sem gravar nada. É o que
   * permite ao operador conferir antes de criar 300 mesas por engano.
   */
  const conferirLote = async () => {
    setLoteErro('')
    setLotePrevia(null)
    setLoteCarregando(true)
    try {
      const corpo = await apiFetch<{ criadas: number; ignoradas: number; numerosIgnorados?: number[] }>('/tables/gerar', {
        method: 'POST',
        body: {
          inicio: Number(loteInicio),
          fim: Number(loteFim),
          ...(lotePracaId ? { pracaId: Number(lotePracaId) } : {}),
          previa: true,
        },
      })
      setLotePrevia({ criadas: corpo.criadas, ignoradas: corpo.ignoradas, numerosIgnorados: corpo.numerosIgnorados ?? [] })
    } catch (erro) {
      setLoteErro(erro instanceof Error ? erro.message : 'Falha ao conferir a faixa')
    } finally {
      setLoteCarregando(false)
    }
  }

  const confirmarLote = async () => {
    setLoteErro('')
    setLoteCarregando(true)
    try {
      const corpo = await apiFetch<{ criadas: number; ignoradas: number }>('/tables/gerar', {
        method: 'POST',
        body: {
          inicio: Number(loteInicio),
          fim: Number(loteFim),
          ...(lotePracaId ? { pracaId: Number(lotePracaId) } : {}),
        },
      })
      showToast(`${corpo.criadas} mesa(s) criada(s), ${corpo.ignoradas} já existia(m).`, 'success')
      setShowLoteModal(false)
      await fetchMesas()
    } catch (erro) {
      setLoteErro(erro instanceof Error ? erro.message : 'Falha ao gerar as mesas')
    } finally {
      setLoteCarregando(false)
    }
  }

  const handleTableClick = (mesa: Mesa) => {
    if (mesa.status === 'LIVRE') {
      if (!caixaAberto) {
        showToast('Abra o caixa antes de iniciar um atendimento.', 'warning')
        return
      }
      setSelectedTable(mesa)
      setShowModal(true)
    } else if (mesa.status === 'FECHAMENTO') {
      if (canReopen || canRegisterPayment) {
        setSelectedTable(mesa)
        setShowReopenModal(true)
      } else {
        router.push(`/mesas/${mesa.id}`)
      }
    } else {
      router.push(`/mesas/${mesa.id}`)
    }
  }

  const executeTableAction = async (action: 'open' | 'reopen'): Promise<boolean> => {
    if (!selectedTable || tableActionInFlight.current) return false
    tableActionInFlight.current = true
    setTableActionPending(true)
    try {
      await apiFetch(`/tables/${selectedTable.id}/${action}`, { method: 'POST' })
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível atualizar a mesa', 'error')
      return false
    } finally {
      tableActionInFlight.current = false
      setTableActionPending(false)
    }
  }

  const confirmOpenTable = async () => {
    const table = selectedTable
    if (table && await executeTableAction('open')) router.push(`/mesas/${table.id}`)
  }

  const confirmReopenTable = async () => {
    const table = selectedTable
    if (table && await executeTableAction('reopen')) {
      setShowReopenModal(false)
      await fetchMesas()
      router.push(`/mesas/${table.id}`)
    }
  }

  const fetchMesas = async () => {
    try {
      const data = await apiFetch<Mesa[]>('/tables')
      // O mapa representa somente atendimento em andamento. Mesas livres
      // continuam cadastradas no banco, mas não ocupam o mapa até serem abertas.
      setMesas(data.filter(mesa => mesa.status !== 'LIVRE'))
    } catch (error) {
      console.error('Erro ao carregar mesas:', error)
    }
  }

  const fetchEstadoCaixa = async () => {
    try {
      const estado = await apiFetch<{ aberto: boolean }>('/caixa/operacional')
      setCaixaAberto(estado.aberto)
    } catch (error) {
      console.error('Erro ao consultar disponibilidade do caixa:', error)
      setCaixaAberto(false)
    }
  }

  useEffect(() => {
    const init = async () => {
        try {
            // Auth check
            const meData = await apiFetch<{ user?: User & { permissions?: string[] } }>('/auth/me')
            if (!meData.user) {
                redirectToLogin()
                return
            }
            setUser(meData.user)
            // Cadastrar mesa é `cadastros.editar` (DT-1 da Fase 0), não `mesas.abrir`:
            // o backend rejeita a criação sem essa permissão. A tela espelha o gate.
            setPodeCadastrar(Array.isArray(meData.user.permissions) && meData.user.permissions.includes('cadastros.editar'))
            void carregarPracas()

            // Initial fetch
            await Promise.all([fetchMesas(), fetchEstadoCaixa()])
            setLoading(false)
        } catch (error) {
            console.error(error)
            setLoading(false)
        }
    }

    init()
    
    // Socket connection for real-time updates
    const socket = connectTableSocket()

    let refreshTimer: ReturnType<typeof setTimeout> | undefined
    const handleUpdate = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined
        void fetchMesas()
      }, 50)
    }

    socket.on('tables-updated', handleUpdate)
    socket.on('table:updated', handleUpdate)
    const handleCashUpdate = (estado?: { aberto?: boolean }) => {
      if (typeof estado?.aberto === 'boolean') setCaixaAberto(estado.aberto)
      else void fetchEstadoCaixa()
    }
    socket.on('caixa:updated', handleCashUpdate)

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      socket.off('caixa:updated', handleCashUpdate)
      socket.disconnect()
    }
  }, [router])

  const handleAddMesa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCreating(true)
    setError('')
    
    try {
      await apiFetch('/tables', {
        method: 'POST',
        body: { numero: newMesaNumero || undefined },
      })
      await fetchMesas()
      setShowAddModal(false)
      setNewMesaNumero('')
    } catch (error) {
      console.error('Error creating table:', error)
      setError(error instanceof Error ? error.message : 'Erro ao criar mesa')
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
  const isWaiter = user?.role === 'GARCOM'
  const canCreate = user?.role === 'ADMIN' || user?.role === 'DONO'
  const canReopen = Boolean(user?.permissions?.includes('mesas.reabrir'))
  const canRegisterPayment = Boolean(
    user?.permissions?.includes('pagamentos.abrir') &&
    user.permissions.includes('pagamentos.registrar')
  )

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={40} /></div>

  return (
    <div className={`min-h-screen bg-gray-50 px-4 pb-4 sm:px-6 lg:px-8 ${isWaiter ? 'pt-6 md:pt-12 lg:pt-24' : 'pt-6 lg:pt-8'}`}>
      {headerStatusTarget &&
        createPortal(
          <MesaStatusSummary livres={livres} ocupadas={ocupadas} />,
          headerStatusTarget
        )}

      <div className="mx-auto w-full max-w-7xl">
        {caixaAberto === false && (
          <div className="mb-5 flex items-start gap-3 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-800">
            <Lock size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div><p className="font-bold">Caixa fechado</p><p className="text-sm">Abra o caixa para iniciar mesas e lançar pedidos.</p></div>
          </div>
        )}
        {!isWaiter && (
          <section className="mb-8 flex flex-col gap-5 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Mapa de Mesas</h1>
              <p className="mt-1 text-sm text-slate-500">Acompanhe os atendimentos e gerencie o cadastro das mesas.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <MesaStatusSummary livres={livres} ocupadas={ocupadas} />

              {canCreate && (
                <button 
                  onClick={openAddModal}
                  disabled={creating}
                  title="Nova mesa"
                  aria-label="Nova mesa"
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-600 text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} strokeWidth={2.5} />}
                </button>
              )}

              {/* Geração em lote (RF-MES-02/03). Visível para quem tem a permissão
                  que o backend realmente exige para criar mesa. */}
              {podeCadastrar && (
                <button
                  onClick={abrirLote}
                  title="Gerar mesas em lote (ex.: 1 a 300)"
                  className="flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <ListPlus size={20} />
                  <span>Em lote</span>
                </button>
              )}
            </div>
          </section>
        )}

        {isWaiter && podeCadastrar && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={abrirLote}
              title="Gerar mesas em lote (ex.: 1 a 300)"
              className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ListPlus size={20} />
              <span>Em lote</span>
            </button>
          </div>
        )}

        {/* O mapa exibe apenas mesas abertas; mesas livres não aparecem como cartões. */}
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          {mesas.length === 0 ? (
            <p className="text-gray-500">Nenhuma mesa aberta no momento.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(136px,145px))] justify-start gap-4">
              {mesas.map((mesa) => (
                <TableCard
                  key={mesa.id}
                  mesa={mesa}
                  onClick={handleTableClick}
                />
              ))}
            </div>
          )}
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
                disabled={tableActionPending}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmOpenTable} 
                disabled={tableActionPending}
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
              {canReopen && (
                <button
                  onClick={confirmReopenTable}
                  disabled={tableActionPending}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-colors"
                >
                  🔄 Reabrir Conta
                </button>
              )}

              {canRegisterPayment && (
                <button 
                  onClick={() => router.push(`/mesas/${selectedTable.id}?recebimento=1`)}
                  disabled={tableActionPending}
                  className="w-full py-3 px-4 rounded-xl bg-red-600 font-bold text-white hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                >
                  💰 Baixar Conta / Liberar Mesa
                </button>
              )}

              <button 
                onClick={() => {
                    router.push(`/mesas/${selectedTable.id}`)
                }}
                disabled={tableActionPending}
                className="w-full py-3 px-4 rounded-xl bg-green-600 font-bold text-white hover:bg-green-700 shadow-lg shadow-green-200 transition-colors"
              >
                📄 Ver Comanda
              </button>

              <button 
                onClick={() => setShowReopenModal(false)} 
                disabled={tableActionPending}
                className="w-full py-3 px-4 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Geração de mesas em lote (RF-MES-02/03) */}
      {showLoteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">Gerar mesas em lote</h2>
              <button
                onClick={() => setShowLoteModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm text-gray-600">
                Cria todas as mesas de uma faixa de números. Números que já existem são
                ignorados — nada é duplicado nem sobrescrito.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="lote-inicio" className="mb-1 block text-sm font-medium text-gray-700">
                    Da mesa
                  </label>
                  <input
                    id="lote-inicio"
                    type="number"
                    min={1}
                    max={300}
                    value={loteInicio}
                    onChange={(e) => {
                      setLoteInicio(e.target.value)
                      setLotePrevia(null)
                    }}
                    className="w-full rounded-lg border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label htmlFor="lote-fim" className="mb-1 block text-sm font-medium text-gray-700">
                    Até a mesa
                  </label>
                  <input
                    id="lote-fim"
                    type="number"
                    min={1}
                    max={300}
                    value={loteFim}
                    onChange={(e) => {
                      setLoteFim(e.target.value)
                      setLotePrevia(null)
                    }}
                    className="w-full rounded-lg border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="lote-praca" className="mb-1 block text-sm font-medium text-gray-700">
                  Praça (opcional)
                </label>
                <select
                  id="lote-praca"
                  value={lotePracaId}
                  onChange={(e) => {
                    setLotePracaId(e.target.value)
                    setLotePrevia(null)
                  }}
                  className="w-full rounded-lg border border-gray-300 p-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Não definida</option>
                  {pracas.map((praca) => (
                    <option key={praca.id} value={praca.id}>
                      {praca.nome}
                    </option>
                  ))}
                </select>
                {pracas.length === 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Nenhuma praça cadastrada. As mesas ficarão como &quot;Não definida&quot;.
                  </p>
                )}
              </div>

              {loteErro && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {loteErro}
                </div>
              )}

              {lotePrevia && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm">
                  <p className="font-semibold text-blue-900">
                    {lotePrevia.criadas} mesa(s) serão criada(s)
                    {lotePrevia.ignoradas > 0 && `, ${lotePrevia.ignoradas} já existem e serão ignoradas`}.
                  </p>
                  {lotePrevia.numerosIgnorados.length > 0 && (
                    <p className="mt-1 text-xs text-blue-800">
                      Já existem: {lotePrevia.numerosIgnorados.slice(0, 20).join(', ')}
                      {lotePrevia.numerosIgnorados.length > 20 && ` (+${lotePrevia.numerosIgnorados.length - 20})`}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={conferirLote}
                  disabled={loteCarregando}
                  className="rounded-xl border-2 border-gray-200 px-4 py-2.5 font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {loteCarregando ? 'Conferindo...' : 'Conferir antes'}
                </button>
                <button
                  type="button"
                  onClick={confirmarLote}
                  disabled={loteCarregando || !lotePrevia}
                  title={!lotePrevia ? 'Use "Conferir antes" para ver o que será criado' : undefined}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  Criar mesas
                </button>
              </div>

              <p className="text-xs text-gray-500">
                O botão &quot;Criar mesas&quot; só libera depois de conferir, para evitar criar
                centenas de mesas por engano.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
