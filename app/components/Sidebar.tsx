'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Armchair,
  BedDouble,
  Bike,
  Boxes,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Contact,
  FileSpreadsheet,
  FileText,
  History,
  Landmark,
  LayoutDashboard,
  ListTree,
  LogOut,
  Package,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Printer,
  Receipt,
  Settings,
  Shield,
  Sparkles,
  Tags,
  Target,
  Truck,
  UserCheck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import {
  findActiveNavItem,
  readStoredCollapsed,
  readStoredGroupState,
  visibleNavGroups,
  writeStoredCollapsed,
  writeStoredGroupState,
  type NavIconName,
  type NavItem,
  type NavUser,
} from '@/app/lib/navigation'

/** Nome de ícone (dado) -> componente lucide. O `Record` garante que nenhum nome fique sem ícone. */
const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  ChartColumn,  Armchair,
  ClipboardList,
  Users,
  Tags,
  Contact,
  Wallet,
  Truck,
  UtensilsCrossed,
  Package,
  FileSpreadsheet,
  Boxes,
  History,
  ClipboardCheck,
  PackageSearch,
  Clock,
  CalendarDays,
  Pencil,
  Shield,
  BedDouble,
  UserCheck,
  Sparkles,
  Landmark,
  Bike,
  FileText,
  Settings,
  UserCog,
  Printer,
  // Ícones exigidos pela árvore de navegação. Sem eles o `NAV_ICONS` resolveria
  // para `undefined` e a Sidebar quebraria em runtime (o `tsc` não acusa, porque
  // a árvore declara o nome como string).
  Target,
  Warehouse,
  ListTree,
}

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  /** Usuário já carregado pelo MainLayout (evita uma segunda chamada a `/api/auth/me`). */
  user?: NavUser | null
  /** Estado recolhido (rail de ícones) controlado pelo MainLayout. */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({
  isOpen,
  onClose,
  user: userProp,
  collapsed: collapsedProp,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()
  const [fetchedUser, setFetchedUser] = useState<NavUser | null>(null)
  const [showBillModal, setShowBillModal] = useState(false)
  const [splitPeople, setSplitPeople] = useState('1')
  const [mounted, setMounted] = useState(false)
  const [selfCollapsed, setSelfCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const activeGroupRef = useRef<string | undefined>(undefined)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isOpen) onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMounted(true)
  }, [])

  // O MainLayout já busca o usuário; a busca própria só roda no uso avulso da Sidebar.
  useEffect(() => {
    if (userProp !== undefined) return
    let cancelled = false
    fetch('/api/auth/me')
      .then(res => res.json())
      .then((data: { user?: NavUser }) => {
        if (!cancelled && data?.user) setFetchedUser(data.user)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userProp])

  const user = userProp !== undefined ? userProp : fetchedUser
  const visibleGroups = useMemo(() => visibleNavGroups(user), [user])
  const active = useMemo(() => findActiveNavItem(pathname), [pathname])
  const activeGroupId = active?.group.id
  const activeHref = active?.item.href

  // Acordeão: preferências salvas (uma vez) + grupo da rota ativa sempre aberto.
  useEffect(() => {
    setOpenGroups(readStoredGroupState())
  }, [])

  useEffect(() => {
    if (!activeGroupId || activeGroupRef.current === activeGroupId) return
    activeGroupRef.current = activeGroupId
    setOpenGroups(prev => {
      // Sem preferência salva o grupo já abre pela regra padrão; se havia preferência,
      // ela é descartada ao entrar na rota para o grupo ativo abrir automaticamente.
      if (!(activeGroupId in prev)) return prev
      const next = { ...prev }
      delete next[activeGroupId]
      writeStoredGroupState(next)
      return next
    })
  }, [activeGroupId])

  // Fallback de colapso/persistência quando a Sidebar é usada fora do MainLayout.
  useEffect(() => {
    if (collapsedProp !== undefined) return
    setSelfCollapsed(readStoredCollapsed())
  }, [collapsedProp])

  const isCollapsed = collapsedProp !== undefined ? collapsedProp : selfCollapsed

  const handleToggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse()
      return
    }
    setSelfCollapsed(prev => {
      const next = !prev
      writeStoredCollapsed(next)
      return next
    })
  }

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const isOpenNow = prev[groupId] ?? groupId === activeGroupId
      const next = { ...prev, [groupId]: !isOpenNow }
      writeStoredGroupState(next)
      return next
    })
  }

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

  const renderItem = (item: NavItem) => {
    const Icon = NAV_ICONS[item.icon]

    if (item.disabled) {
      return (
        <div
          key={item.href}
          aria-disabled="true"
          title={`${item.label} — em breve`}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 cursor-not-allowed select-none ${
            isCollapsed ? 'md:justify-center md:px-2' : ''
          }`}
        >
          <Icon size={20} className="text-gray-300 shrink-0" />
          <span className={`flex-1 truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded ${
              isCollapsed ? 'md:hidden' : ''
            }`}
          >
            em breve
          </span>
        </div>
      )
    }

    const isActive = item.href === activeHref

    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        aria-current={isActive ? 'page' : undefined}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium text-sm ${
          isActive
            ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
            : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
        } ${isCollapsed ? 'md:justify-center md:px-2' : ''}`}
      >
        <Icon
          size={20}
          className={`transition-colors duration-200 shrink-0 ${
            isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-600'
          }`}
        />
        <span className={`flex-1 truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
        {item.shortcut && (
          <kbd
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              isActive ? 'border-white/40 text-white/80' : 'border-gray-200 text-gray-400'
            } ${isCollapsed ? 'md:hidden' : ''}`}
          >
            {item.shortcut}
          </kbd>
        )}
      </Link>
    )
  }

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
        fixed inset-y-0 left-0 z-[70] w-64 bg-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        md:translate-x-0
      `}>
        <div
          className={`py-5 px-3 flex items-center justify-between gap-2 border-b border-gray-100 mb-2 ${
            isCollapsed ? 'md:flex-col md:gap-3' : ''
          }`}
        >
          <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'md:justify-center' : ''}`}>
            <div className="bg-orange-600 p-2 rounded-lg shadow-sm shrink-0">
              <UtensilsCrossed className="text-white" size={24} />
            </div>
            <span
              className={`text-xl font-bold text-gray-800 tracking-tight truncate ${
                isCollapsed ? 'md:hidden' : ''
              }`}
            >
              Rei do Pirão
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleCollapse}
            aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors shrink-0"
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {visibleGroups.map(({ group, items }) => {
            const GroupIcon = NAV_ICONS[group.icon]
            const isGroupActive = group.id === activeGroupId
            const isGroupOpen = openGroups[group.id] ?? isGroupActive

            return (
              <div key={group.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isGroupOpen}
                  title={group.label}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                    isGroupActive
                      ? 'text-orange-600'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  } ${isCollapsed ? 'md:justify-center md:px-2' : ''}`}
                >
                  <GroupIcon size={18} className="shrink-0" />
                  <span className={`flex-1 text-left truncate ${isCollapsed ? 'md:hidden' : ''}`}>
                    {group.label}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform duration-200 ${
                      isGroupOpen ? '' : '-rotate-90'
                    } ${isCollapsed ? 'md:hidden' : ''}`}
                  />
                </button>

                <div className={isGroupOpen ? 'mt-1 space-y-1' : 'hidden'}>
                  {items.map(renderItem)}
                </div>
              </div>
            )
          })}

          {isTablePage && (
            <div className="md:hidden px-1 pt-2">
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
              title="Solicitar Conta"
              className={`w-full hidden md:flex items-center justify-center space-x-2 px-4 py-3 mb-4 rounded-xl border-2 border-orange-500 text-orange-600 font-bold hover:bg-orange-50 transition-colors ${
                isCollapsed ? 'md:px-2' : ''
              }`}
            >
              <Receipt size={20} className="shrink-0" />
              <span className={isCollapsed ? 'md:hidden' : ''}>Solicitar Conta</span>
            </button>
          )}

          <div
            className={`bg-slate-50 rounded-2xl p-3 flex items-center justify-between gap-2 group hover:bg-slate-100 transition-colors ${
              isCollapsed ? 'md:flex-col md:justify-center' : ''
            }`}
          >
            <div className={`flex items-center space-x-3 overflow-hidden ${isCollapsed ? 'md:space-x-0' : ''}`}>
              <div
                title={user?.name ?? undefined}
                className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0 shadow-sm"
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={`flex-1 min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-500 uppercase font-medium tracking-wide mt-0.5">{user?.role}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-lg hover:bg-white hover:shadow-sm shrink-0"
              title="Sair"
              aria-label="Sair"
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
