'use client'

import Link from 'next/link'
import { BedDouble, CalendarDays, Sparkles, UserRound } from 'lucide-react'

const MODULOS = [
  { href: '/hotelaria/reservas', titulo: 'Reservas', descricao: 'Criar reservas e acompanhar status.', icon: CalendarDays },
  { href: '/hotelaria/mapa', titulo: 'Mapa de reservas', descricao: 'Ocupação por unidade em 7, 14 ou 30 dias.', icon: BedDouble },
  { href: '/hotelaria/reservas', titulo: 'Hóspedes', descricao: 'Cadastro usado pelas reservas.', icon: UserRound },
  { href: '/hotelaria/reservas', titulo: 'Unidades', descricao: 'Quartos, suítes e diárias.', icon: BedDouble },
  { href: '/hotelaria/governanca', titulo: 'Governança', descricao: 'Status de limpeza das unidades.', icon: Sparkles },
]

export default function HotelariaPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Hotelaria</h1>
      <p className="mb-6 text-sm text-gray-600">
        Scaffold operacional para unidades, hóspedes e reservas com bloqueio de sobreposição.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {MODULOS.map((modulo) => {
          const Icon = modulo.icon
          return (
            <Link key={modulo.titulo} href={modulo.href} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50/40">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{modulo.titulo}</h2>
              <p className="mt-1 text-sm text-gray-600">{modulo.descricao}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
