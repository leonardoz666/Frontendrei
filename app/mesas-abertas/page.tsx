'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'

type Mesa = {
  id: number
  numero: number
  status: string
  comandas: { 
    id: number
    total: number
    usuario?: { nome: string }
  }[]
}

export default function MesasAbertasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

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

        const tablesRes = await fetch('/api/tables', { cache: 'no-store' })
        const tables = await tablesRes.json()
        if (!cancelled) {
          // Filter only open tables
          const openTables = tables.filter((t: Mesa) => t.status !== 'LIVRE')
          setMesas(openTables)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  if (loading) return <div className="p-8 text-center">Carregando mesas abertas...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Mesas Abertas</h1>

        {mesas.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm text-center">
            <p className="text-gray-500">Nenhuma mesa aberta no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mesas.map((mesa) => {
              const comanda = mesa.comandas[0]
              const waiterName = comanda?.usuario?.nome || 'Desconhecido'
              
              const isFechamento = mesa.status === 'FECHAMENTO'
              const statusLabel = isFechamento ? 'FECHAMENTO' : 'Em Andamento'
              const statusColorClass = isFechamento ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
              const borderColorClass = isFechamento ? 'border-red-500' : 'border-yellow-400'

              return (
                <div 
                  key={mesa.id}
                  onClick={() => router.push(`/mesas/${mesa.id}`)}
                  className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${borderColorClass} cursor-pointer hover:shadow-lg transition-all`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Mesa {mesa.numero}</h2>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColorClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-gray-600">
                      <User size={18} className="mr-2" />
                      <span className="text-sm">Garçom: <strong>{waiterName}</strong></span>
                    </div>
                    
                    {comanda && (
                      <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total parcial</span>
                        <span className="text-xl font-bold text-green-600">
                          R$ {comanda.total.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
