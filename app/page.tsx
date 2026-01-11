'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/contexts/ToastContext'

type Mesa = {
  id: number
  numero: number
  status: string
}

export default function Home() {
  const { showToast } = useToast()
  const [input, setInput] = useState('')
  const [tables, setTables] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [targetTable, setTargetTable] = useState<Mesa | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Auth check and fetch tables
    const init = async () => {
      try {
        console.log('[DEBUG] Home page init');
        const meRes = await fetch('/api/auth/me')
        console.log(`[DEBUG] Home auth/me status: ${meRes.status}`);
        const meData = await meRes.json()
        if (!meData.user) {
          console.warn('[DEBUG] Home: No user, redirecting');
          router.replace('/login')
          return
        }

        console.log('[DEBUG] Home fetching tables');
        const tablesRes = await fetch('/api/tables')
        console.log(`[DEBUG] Home tables status: ${tablesRes.status}`);
        if (tablesRes.ok) {
          const tablesData = await tablesRes.json()
          setTables(tablesData)
        } else {
             console.error(`[DEBUG] Home tables failed: ${tablesRes.status}`);
        }
      } catch (err) {
        console.error('[DEBUG] Home init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [router])

  const handleNumber = useCallback((num: number) => {
    if (input.length < 3) { // Limit to 3 digits usually enough for tables
      setInput(prev => prev + num.toString())
    }
  }, [input])

  const handleBackspace = useCallback(() => {
    setInput(prev => prev.slice(0, -1))
  }, [])

  const handleEnter = useCallback(() => {
    if (!input) return

    const tableNum = parseInt(input)
    const table = tables.find(t => t.numero === tableNum)

    if (!table) {
      showToast('Mesa não encontrada!', 'error')
      setInput('')
      return
    }

    if (table.status === 'LIVRE') {
      setTargetTable(table)
      setShowConfirmModal(true)
    } else {
      router.push(`/mesas/${table.id}`)
    }
  }, [input, tables, router, showToast])

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumber(parseInt(e.key))
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Enter') {
        handleEnter()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNumber, handleBackspace, handleEnter])

  const confirmOpen = () => {
    if (targetTable) {
      router.push(`/mesas/${targetTable.id}`)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando...</div>

  return (
    <div className="flex flex-col items-center justify-start pt-6 min-h-[calc(100vh-4rem)]">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">Digite o Número da Mesa</h1>
        
        {/* Display */}
        <div className="bg-gray-100 p-6 rounded-xl mb-6 text-center h-24 flex items-center justify-center">
          <span className={`font-mono font-bold text-gray-800 tracking-widest ${input ? 'text-5xl' : 'text-gray-400 text-2xl'}`}>
            {input || 'Digite...'}
          </span>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumber(num)}
              className="h-20 text-3xl font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-all active:scale-95 shadow-sm"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleBackspace}
            className="h-20 text-xl font-bold text-red-500 bg-red-50 border-2 border-red-100 rounded-xl hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center"
          >
            ⌫
          </button>
          <button
            onClick={() => handleNumber(0)}
            className="h-20 text-3xl font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-orange-50 hover:border-orange-500 hover:text-orange-600 transition-all active:scale-95 shadow-sm"
          >
            0
          </button>
          <button
            onClick={handleEnter}
            className="h-20 text-xl font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-all active:scale-95 shadow-md flex items-center justify-center"
          >
            ENTRAR
          </button>
        </div>
      </div>

      {/* Modal Confirm */}
      {showConfirmModal && targetTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Abrir Mesa {targetTable.numero}?</h2>
            <p className="text-gray-600 text-center mb-8">Esta mesa está fechada no momento.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmOpen}
                className="flex-1 py-3 px-4 rounded-xl bg-green-600 font-bold text-white hover:bg-green-700 shadow-lg transition-colors"
              >
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
