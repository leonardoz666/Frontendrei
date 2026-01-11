'use client'

import Link from 'next/link'
import { 
  UtensilsCrossed, 
  Users, 
  Tags, 
  Printer 
} from 'lucide-react'

export default function AdminDashboard() {
  const adminLinks = [
    {
      href: '/admin/produtos',
      label: 'Produtos',
      description: 'Gerenciar cardápio e itens',
      icon: UtensilsCrossed,
      color: 'bg-orange-500'
    },
    {
      href: '/admin/categorias',
      label: 'Categorias',
      description: 'Organizar setores e tipos',
      icon: Tags,
      color: 'bg-blue-500'
    },
    {
      href: '/admin/usuarios',
      label: 'Usuários',
      description: 'Gerenciar equipe e permissões',
      icon: Users,
      color: 'bg-green-500'
    },
    {
      href: '/admin/impressoras',
      label: 'Impressoras',
      description: 'Configurar impressão de pedidos',
      icon: Printer,
      color: 'bg-purple-500'
    }
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Painel Administrativo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {adminLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className="block group"
            >
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 h-full">
                <div className={`${link.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white shadow-md group-hover:scale-110 transition-transform`}>
                  <Icon size={24} />
                </div>
                <h2 className="text-lg font-bold text-gray-800 mb-2">{link.label}</h2>
                <p className="text-sm text-gray-500">{link.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
