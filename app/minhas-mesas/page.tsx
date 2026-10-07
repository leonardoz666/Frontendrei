'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/app/lib/api'
import { Mesa, TableCard } from '@/app/components/TableCard'

export default function MinhasMesasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchMyTables = async () => {
      try {
        const data = await apiFetch<Mesa[]>('/tables/my/opened')
        setMesas(data)
      } catch (error) {
        console.error('Error fetching my tables:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMyTables()
  }, [])

  if (loading) return <div className="p-8 text-center">Carregando suas mesas...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">Minhas Mesas Abertas</h1>

        {mesas.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm text-center">
            <p className="text-gray-500">Você não tem nenhuma mesa aberta no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {mesas.map((mesa) => (
              <TableCard
                key={mesa.id}
                mesa={mesa}
                onClick={(selected) => router.push(`/mesas/${selected.id}`)}
                fallbackUsuarioNome="Você"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
