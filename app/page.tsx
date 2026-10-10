'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'
import { apiFetch, redirectToLogin } from '@/app/lib/api'

type Mesa = {
  id: number
  numero: number
  status: string
}

export default function Home() {
  const { showToast } = useToast()
  const [input, setInput] = useState('')
  const [tables, setTables] = useState<Mesa[]>([])
  const [canCreateTable, setCanCreateTable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [targetTable, setTargetTable] = useState<Mesa | null>(null)
  const [openingTable, setOpeningTable] = useState(false)
  const router = useRouter()

  // Haptic feedback for tactile response on mobile
  const triggerHaptic = useCallback((ms = 15) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms)
      } catch {}
    }
  }, [])

  useEffect(() => {
    // Auth check and fetch tables
    const init = async () => {
      try {
        const meData = await apiFetch<{ user?: { permissions?: string[] } }>('/auth/me')
        if (!meData.user) {
          redirectToLogin()
          return
        }
        setCanCreateTable(Array.isArray(meData.user.permissions) && meData.user.permissions.includes('cadastros.editar'))

        setTables(await apiFetch<Mesa[]>('/tables'))
      } catch (err) {
        console.error('Home init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const handleNumber = useCallback((num: number) => {
    triggerHaptic(12)
    if (input.length < 3) { // Limit to 3 digits usually enough for tables
      setInput(prev => prev + num.toString())
    }
  }, [input, triggerHaptic])

  const handleBackspace = useCallback(() => {
    triggerHaptic(18)
    setInput(prev => prev.slice(0, -1))
  }, [triggerHaptic])

  const handleClear = useCallback(() => {
    triggerHaptic(20)
    setInput('')
  }, [triggerHaptic])

  const handleEnter = useCallback(() => {
    if (!input) return
    triggerHaptic(25)

    const tableNum = parseInt(input)
    let table = tables.find(t => t.numero === tableNum)

    if (!table) {
      if (!canCreateTable) {
        showToast(`Mesa ${tableNum} não cadastrada`, 'error')
        return
      }
      table = { id: -1, numero: tableNum, status: 'LIVRE' }
    }

    if (table.status === 'LIVRE') {
      setTargetTable(table)
      setShowConfirmModal(true)
    } else {
      router.push(`/mesas/${table.id}`)
    }
  }, [input, tables, canCreateTable, router, showToast, triggerHaptic])

  // Real-time matching table status preview
  const matchingTable = useMemo(() => {
    if (!input) return null
    const num = parseInt(input)
    return tables.find(t => t.numero === num) || null
  }, [input, tables])

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumber(parseInt(e.key))
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Enter') {
        handleEnter()
      } else if (e.key === 'Escape') {
        handleClear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNumber, handleBackspace, handleEnter, handleClear])

  const confirmOpen = async () => {
    if (!targetTable) return

    setOpeningTable(true)
    try {
      let tableId = targetTable.id
      if (tableId === -1) {
        // Create table first
        const newTable = await apiFetch<Mesa>('/tables', {
          method: 'POST',
          body: { numero: targetTable.numero },
        })
        tableId = newTable.id
      }

      await apiFetch(`/tables/${tableId}/open`, { method: 'POST' })
      showToast(`Mesa ${targetTable.numero} aberta com sucesso!`, 'success')
      router.push(`/mesas/${tableId}`)
    } catch (error) {
      console.error('Error opening table:', error)
      showToast(error instanceof Error ? error.message : 'Erro ao abrir mesa', 'error')
    } finally {
      setOpeningTable(false)
      setShowConfirmModal(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100dvh-4rem)]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-4rem)] p-2 sm:p-4 select-none touch-manipulation">
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm md:shadow-xl w-full max-w-sm border border-gray-100 flex flex-col justify-between">
        
        {/* Header Title */}
        <div className="text-center mb-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">Número da Mesa</h1>
          <p className="text-xs text-gray-400 mt-0.5">Toque no teclado ou digite</p>
        </div>
        
        {/* Display Screen */}
        <div className="bg-gray-50 border-2 border-gray-200/80 p-3 sm:p-4 rounded-2xl mb-4 text-center h-20 sm:h-24 flex flex-col items-center justify-center relative">
          <span className={`font-mono font-bold tracking-widest transition-all ${input ? 'text-4xl sm:text-5xl text-gray-900' : 'text-gray-300 text-xl'}`}>
            {input ? `MESA ${input}` : 'Digite o número...'}
          </span>

          {/* Quick status badge preview */}
          {matchingTable && (
            <div className="mt-1">
              {matchingTable.status === 'LIVRE' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Livre (Abrir)
                </span>
              )}
              {matchingTable.status === 'OCUPADA' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> Ocupada (Entrar)
                </span>
              )}
              {matchingTable.status === 'FECHAMENTO' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Fechamento
                </span>
              )}
            </div>
          )}
        </div>

        {/* Ergonomic One-Hand Keypad (Thumb Zone Optimized) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5 mb-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="h-16 sm:h-20 text-2xl sm:text-3xl font-bold text-gray-800 bg-gray-50/80 active:bg-orange-100 border border-gray-200/90 rounded-2xl active:scale-95 transition-all shadow-sm flex items-center justify-center select-none"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            aria-label="Apagar dígito"
            className="h-16 sm:h-20 text-lg sm:text-xl font-bold text-red-600 bg-red-50/80 active:bg-red-100 border border-red-100 rounded-2xl active:scale-95 transition-all flex items-center justify-center select-none"
          >
            ⌫
          </button>
          <button
            onClick={() => handleNumber(0)}
            className="h-16 sm:h-20 text-2xl sm:text-3xl font-bold text-gray-800 bg-gray-50/80 active:bg-orange-100 border border-gray-200/90 rounded-2xl active:scale-95 transition-all shadow-sm flex items-center justify-center select-none"
          >
            0
          </button>
          <button
            onClick={handleEnter}
            disabled={!input}
            className="h-16 sm:h-20 text-base sm:text-lg font-bold text-white bg-green-600 active:bg-green-700 rounded-2xl active:scale-95 transition-all shadow-md shadow-green-200 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed select-none"
          >
            ENTRAR
          </button>
        </div>

        {/* Clear shortcut */}
        {input && (
          <div className="text-center mt-1">
            <button
              onClick={handleClear}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 py-1 px-3"
            >
              Limpar digitação
            </button>
          </div>
        )}
      </div>

      {/* Modal Confirm Open Table */}
      {showConfirmModal && targetTable && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-6 sm:p-8 rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-sm w-full animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 text-center">Abrir Mesa {targetTable.numero}?</h2>
            <p className="text-gray-500 text-sm text-center mb-6">Esta mesa está livre e pronta para ser aberta para novos pedidos.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3.5 px-4 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
              >
                Voltar
              </button>
              <button
                onClick={confirmOpen}
                disabled={openingTable}
                className="flex-1 py-3.5 px-4 rounded-xl bg-green-600 font-bold text-white hover:bg-green-700 active:scale-95 shadow-lg shadow-green-200 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {openingTable ? 'Abrindo...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
