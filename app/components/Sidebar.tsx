'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Users, 
  ChefHat, 
  LogOut, 
  Armchair,
  Receipt,
  ClipboardList,
  Printer,
  ShoppingBag,
  Settings
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'

type User = {
  name: string
  role: string
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [showBillModal, setShowBillModal] = useState(false)
  const [splitPeople, setSplitPeople] = useState('1')
  const [mounted, setMounted] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isOpen) onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMounted(true)
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user)
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isTablePage = pathname.startsWith('/mesas/') && pathname !== '/mesas'
  const currentMesaId = isTablePage ? pathname.split('/')[2] : null

  const handleRequestBill = async () => {
    if (!currentMesaId) return
    try {
      const res = await fetch(`/api/tables/${currentMesaId}/request-bill`, { method: 'POST' })
      if (res.ok) {
        setShowBillModal(false)
        router.push('/mesas')
      }
    } catch (error) {
      console.error('Error requesting bill:', error)
    }
  }

  const handlePrintPartialBill = async () => {
    if (!currentMesaId) return
    try {
      const res = await fetch(`/api/tables/${currentMesaId}/print-partial`, { method: 'POST' })
      if (res.ok) {
        setShowBillModal(false)
        showToast('Conta parcial enviada para a impressora!', 'success')
      } else {
        showToast('Erro ao imprimir conta parcial', 'error')
      }
    } catch (error) {
      console.error('Error printing partial bill:', error)
      showToast('Erro ao conectar com o servidor', 'error')
    }
  }

  const menuItems = [
    { href: '/', label: 'Início', icon: LayoutDashboard, roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA', 'GARCOM'] },
    { href: '/mesas', label: 'Mesas', icon: Armchair, roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA', 'GARCOM'] },
    { href: '/mesas-abertas', label: 'Mesas Abertas', icon: ClipboardList, roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA', 'GARCOM'] },
    { href: '/minhas-mesas', label: 'Minhas Mesas', icon: Users, roles: ['GARCOM', 'GERENTE', 'DONO'] },
    { href: '/ifood', label: 'iFood', icon: ShoppingBag, roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA'] },
    { href: '/admin', label: 'PAINEL', icon: Settings, roles: ['ADMIN', 'DONO'] },
  ]

  const filteredItems = menuItems.filter(item => {
    if (!user) return false
    return item.roles.includes(user.role)
  })

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
      <div className="py-4 border-b border-gray-100 flex items-center justify-center">
        <div className="w-56 h-28 relative">
          <Image 
            src="/logo.png"  
            alt="Rei do Pirão" 
            fill 
            className="object-contain"
            priority
          />
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="mb-4 px-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu</p>
        </div>
        {filteredItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-orange-600 text-white font-medium shadow-md' 
                  : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-600'} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {isTablePage && (
          <div className="md:hidden px-4 mb-2">
             <button
              onClick={() => setShowBillModal(true)}
              className="w-full text-left px-4 py-3 rounded-lg transition-colors hover:bg-orange-50 text-orange-600 font-bold flex items-center space-x-3 border border-orange-200 bg-orange-50/50"
            >
              <Receipt size={20} className="text-orange-600" />
              <span>Solicitar Conta</span>
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-100 bg-white">
        {isTablePage && (
          <button
            onClick={() => setShowBillModal(true)}
            className="w-full hidden md:flex items-center justify-center space-x-2 px-4 py-3 mb-4 rounded-xl border-2 border-orange-500 text-orange-600 font-bold hover:bg-orange-50 transition-colors"
          >
            <Receipt size={20} />
            <span>Solicitar Conta</span>
          </button>
        )}
        
        <div className="bg-slate-50 rounded-2xl p-3 flex items-center justify-between group hover:bg-slate-100 transition-colors">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0 shadow-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate leading-tight">{user?.name}</p>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{user?.role}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-white hover:shadow-sm"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {mounted && showBillModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white text-black rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                💰 Solicitação de Conta
              </h2>
              <p className="text-orange-100 text-sm mt-1">Selecione uma opção abaixo</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-black mb-2">
                  Dividir para quantas pessoas?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={splitPeople}
                    onChange={(e) => setSplitPeople(e.target.value)}
                    className="w-full p-4 pl-12 border border-gray-200 rounded-xl focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all text-lg font-bold text-black bg-gray-50"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl">👥</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={handleRequestBill}
                  className="w-full p-4 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-bold rounded-xl transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                >
                  ✅ Fechar Conta
                </button>

                <button
                  onClick={handlePrintPartialBill}
                  className="w-full p-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  📄 Conta Parcial
                </button>
                
                <button
                  onClick={() => setShowBillModal(false)}
                  className="w-full p-4 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] text-black font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  ❌ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      </aside>
    </>
  )
}