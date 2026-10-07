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
    <div className="min-h-screen bg-gray-50 px-4 pb-4 pt-6 sm:px-6 md:pt-12 lg:px-8 lg:pt-24">
      <div className="mx-auto w-full max-w-7xl">
        {mesas.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm text-center">
            <p className="text-gray-500">Você não tem nenhuma mesa aberta no momento.</p>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1111px] grid-cols-[repeat(auto-fit,minmax(136px,145px))] justify-center gap-4">
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
