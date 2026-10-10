'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Armchair,
  Bike,
  Boxes,
  CalendarDays,
  Camera,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Contact,
  Eye,
  FileSpreadsheet,
  FileText,
  HardDrive,
  History,
  Landmark,
  LayoutDashboard,
  ListTree,
  LogOut,
  MapPin,
  Package,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Printer,
  QrCode,
  Settings,
  Shield,
  Tags,
  Target,
  Truck,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '@/app/lib/api'
import {
  buildSidebarVisualSections,
  findActiveNavItem,
  readStoredCollapsed,
  readStoredSidebarVisibility,
  SIDEBAR_VISIBILITY_EVENT,
  sidebarVisibilityStorageKey,
  visibleNavGroups,
  writeStoredCollapsed,
  type NavIconName,
  type NavItem,
  type NavUser,
} from '@/app/lib/navigation'

const NAV_ICONS: Record<NavIconName, LucideIcon> = {
  LayoutDashboard,
  ChartColumn,
  Armchair,
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
  Camera,
  CalendarDays,
  Pencil,
  Shield,
  Landmark,
  Bike,
  FileText,
  Settings,
  UserCog,
  Printer,
  Target,
  Warehouse,
  ListTree,
  MapPin,
  HardDrive,
  QrCode,
  Eye,
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
  const [fetchedUser, setFetchedUser] = useState<NavUser | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selfCollapsed, setSelfCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [visibility, setVisibility] = useState(() => readStoredSidebarVisibility(null))
  const activeSectionRef = useRef<string | undefined>(undefined)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isOpen) onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // O MainLayout já busca o usuário; a busca própria só roda no uso avulso da Sidebar.
  useEffect(() => {
    if (userProp !== undefined) return
    let cancelled = false
    apiFetch<{ user?: NavUser }>('/auth/me', { redirectOn401: false })
      .then(data => {
        if (!cancelled && data?.user) setFetchedUser(data.user)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userProp])

  const user = userProp !== undefined ? userProp : fetchedUser
  const isWaiter = user?.role === 'GARCOM'
  const isStockkeeper = user?.role === 'ESTOQUISTA'

  const visibleGroups = useMemo(() => visibleNavGroups(user), [user])
  const active = useMemo(() => findActiveNavItem(pathname), [pathname])
  const activeHref = active?.item.href
  const quickShortcuts = user?.role === 'GARCOM'
    ? [
        { href: '/', label: 'Início' },
        { href: '/mesas', label: 'Mapa de Mesas' },
        { href: '/minhas-mesas', label: 'Minhas Mesas' },
      ]
    : [
        { href: '/', label: 'Início' },
        { href: '/mesas', label: 'Mapa de Mesas' },
        { href: '/admin', label: 'Painel' },
      ]
  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return visibleGroups
    return visibleGroups
      .map(({ group, items }) => {
        const groupMatches = group.label.toLowerCase().includes(normalizedSearch)
        const filteredItems = groupMatches
          ? items
          : items.filter(item => item.label.toLowerCase().includes(normalizedSearch))
        return { group, items: filteredItems }
      })
      .filter(({ items }) => items.length > 0)
  }, [normalizedSearch, visibleGroups])
  const visualSections = useMemo(() => {
    const sourceGroups = normalizedSearch ? filteredGroups : visibleGroups
    const hiddenSections = new Set(visibility.hiddenSectionIds)
    const hiddenItems = new Set(visibility.hiddenItemHrefs)

    return buildSidebarVisualSections(sourceGroups, isWaiter)
      .filter(section => !hiddenSections.has(section.id))
      .map(section => {
        const groups = section.groups
          .map(group => ({ ...group, items: group.items.filter(item => !hiddenItems.has(item.href)) }))
          .filter(group => group.items.length > 0)
        return { ...section, groups, items: groups.flatMap(group => group.items) }
      })
      .filter(section => section.items.length > 0)
  }, [filteredGroups, isWaiter, normalizedSearch, visibility, visibleGroups])
  const dashboardItem = useMemo(() => {
    if (visibility.hiddenItemHrefs.includes('/dashboard')) return null
    const sourceGroups = normalizedSearch ? filteredGroups : visibleGroups
    return sourceGroups.flatMap(({ items }) => items).find(item => item.href === '/dashboard') ?? null
  }, [filteredGroups, normalizedSearch, visibility.hiddenItemHrefs, visibleGroups])

  useEffect(() => {
    if (!user) return
    const syncVisibility = () => setVisibility(readStoredSidebarVisibility(user))
    const handleStorage = (event: StorageEvent) => {
      if (event.key === sidebarVisibilityStorageKey(user)) syncVisibility()
    }

    syncVisibility()
    window.addEventListener(SIDEBAR_VISIBILITY_EVENT, syncVisibility)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener(SIDEBAR_VISIBILITY_EVENT, syncVisibility)
      window.removeEventListener('storage', handleStorage)
    }
  }, [user])

  const visualSectionForActive = useMemo(
    () => visualSections.find(section => section.items.some(item => item.href === activeHref)),
    [activeHref, visualSections]
  )
  const activeSectionId = visualSectionForActive?.id

  useEffect(() => {
    if (!activeSectionId || activeSectionRef.current === activeSectionId) return
    activeSectionRef.current = activeSectionId
    setOpenGroups(prev => {
      if (!(activeSectionId in prev)) return prev
      const next = { ...prev }
      delete next[activeSectionId]
      return next
    })
  }, [activeSectionId])

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
      const isOpenNow = prev[groupId] ?? groupId === activeSectionId
      return { ...prev, [groupId]: !isOpenNow }
    })
  }

  const handleLogout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const renderItem = (item: NavItem) => {
    const Icon = NAV_ICONS[item.icon]

    if (item.disabled) {
      return (
        <div
          key={item.href}
          aria-disabled="true"
          title={`${item.label} — em breve`}
          className={`flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] font-medium text-slate-300 cursor-not-allowed select-none ${
            isCollapsed ? 'md:justify-center md:px-0' : ''
          }`}
        >
          <Icon size={19} className={`hidden shrink-0 ${isCollapsed ? 'md:block' : ''}`} aria-hidden="true" />
          <span className={`flex-1 truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
          <span
            className={`rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 ${
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
        className={`group relative flex h-9 items-center gap-2.5 rounded-md px-3 text-[13px] font-medium leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${
          isActive
            ? 'bg-orange-600 font-semibold text-white shadow-sm'
            : 'text-slate-800 hover:bg-orange-600 hover:text-white'
        } ${isCollapsed ? 'md:justify-center md:px-0' : ''}`}
      >
        <Icon size={19} className={`hidden shrink-0 ${isCollapsed ? 'md:block' : ''}`} aria-hidden="true" />
        <span className={`flex-1 truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
        {item.shortcut && (
          <kbd
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
              isActive ? 'border-white/40 bg-white/15 text-white' : 'border-slate-200 text-slate-400 group-hover:border-white/40 group-hover:text-white'
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
        fixed inset-y-0 left-0 z-[70] w-72 bg-[#e8eef5] flex flex-col transition-all duration-300 ease-in-out border-r border-slate-300 shadow-[18px_0_17px_rgba(15,20,31,0.08)]
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'md:w-[88px]' : 'md:w-72'}
        md:translate-x-0
      `}>
        {!isStockkeeper && (!visibility.hideBrand || !visibility.hideSearch || !visibility.hideShortcuts) && (
        <div
          className={`px-4 pt-[18px] pb-0 ${
            isCollapsed ? `md:px-4 ${visibility.hideBrand ? 'md:hidden' : ''}` : ''
          }`}
        >
          {!visibility.hideBrand && (
          <div className={`flex h-[54px] items-center gap-3 ${isCollapsed ? 'md:justify-center' : ''}`}>
            <div className={`flex min-w-0 items-center gap-3 ${isCollapsed ? 'md:justify-center' : ''}`}>
              <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[#f4510b] text-[22px] font-bold text-white ${isCollapsed ? 'md:h-14 md:w-14 md:rounded-[14px] md:text-2xl' : ''}`}>
                R
              </div>
              <div className={`min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
                <span className="block truncate text-base font-bold leading-tight text-slate-950">
                  Rei do Pirão
                </span>
                <span className="block truncate text-xs font-medium text-slate-500">Operação do salão</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleCollapse}
              aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-orange-50 hover:text-orange-700 md:flex"
            >
              {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          </div>
          )}

          {!visibility.hideSearch && (
          <div className={`${visibility.hideBrand ? '' : 'mt-3'} ${isWaiter ? 'hidden' : isCollapsed ? 'md:hidden' : ''}`}>
            <label className="flex h-10 items-center gap-2 rounded-[10px] border border-slate-200 bg-slate-50 px-3 focus-within:border-orange-300 focus-within:ring-4 focus-within:ring-orange-100">
              <span className="shrink-0 text-[15px] font-semibold text-slate-400">/</span>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Buscar módulo ou ação"
                type="search"
              />
              <span className="rounded-[11px] bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                Ctrl K
              </span>
            </label>
          </div>
          )}

          {!visibility.hideShortcuts && (
          <div className={`${visibility.hideBrand && visibility.hideSearch ? '' : 'mt-3'} ${isWaiter ? 'flex flex-col gap-1.5' : 'flex gap-1 rounded-lg bg-slate-100 p-1'} ${isCollapsed ? 'md:hidden' : ''}`}>
            {quickShortcuts.map(shortcut => {
              const activeShortcut = pathname === shortcut.href
              return (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  title={shortcut.label}
                  className={`flex items-center justify-center rounded-md border px-2 text-center text-[11px] font-bold leading-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 ${isWaiter ? 'min-h-10 w-full' : 'min-h-10 min-w-0 flex-1'} ${
                    activeShortcut
                      ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                      : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:text-slate-950'
                  }`}
                >
                  {shortcut.label}
                </Link>
              )
            })}
          </div>
          )}
          <div className="mt-4 h-px bg-slate-200" />
        </div>
        )}

        <nav className={`flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] ${isCollapsed ? 'md:px-4' : ''}`}>
          {filteredGroups.length === 0 && (
            <div className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-medium text-slate-500 ${isCollapsed ? 'md:hidden' : ''}`}>
              Nenhum módulo encontrado
            </div>
          )}

          {isCollapsed && (
            <div className="hidden space-y-1 md:block">
              {dashboardItem && renderItem(dashboardItem)}
              {visualSections.flatMap(section => section.items).map(renderItem)}
            </div>
          )}

          {dashboardItem && (
            <div className={`mb-3 ${isCollapsed ? 'md:hidden' : ''}`}>
              {renderItem(dashboardItem)}
            </div>
          )}

          {visualSections.map(section => {
            const isGroupActive = section.id === activeSectionId
            const isGroupOpen = Boolean(normalizedSearch) || (openGroups[section.id] ?? isGroupActive)

            return (
              <div key={section.id} className={`mb-2 border-b border-slate-100 pb-2 ${isCollapsed ? 'md:hidden' : ''}`}>
                <button
                  type="button"
                  onClick={() => toggleGroup(section.id)}
                  aria-expanded={isGroupOpen}
                  title={section.label}
                  className={`flex min-h-10 w-full items-center rounded-md border-l-[3px] px-3 py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${isGroupActive ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-transparent bg-slate-50 text-slate-800 hover:bg-slate-100'}`}
                >
                  <span className="flex-1 text-left truncate">{section.label}</span>
                  <ChevronDown
                    size={14}
                    strokeWidth={2.5}
                    className={`shrink-0 transition-transform duration-200 ${isGroupOpen ? '' : '-rotate-90'}`}
                  />
                </button>

                <div className={isGroupOpen ? 'mt-2 rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm' : 'hidden'}>
                  {section.groups.map((group, index) => (
                    <div key={group.id} className={index > 0 ? 'mt-2 border-t border-slate-200 pt-2' : ''}>
                      <div className="space-y-0.5 border-l-2 border-slate-300 pl-1.5">
                        {group.items.map(renderItem)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

        </nav>

        <div className="border-t border-slate-300 bg-[#e8eef5] p-3">
          <div
            className={`group flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm shadow-slate-950/[0.03] transition-colors hover:bg-slate-50 ${
              isCollapsed ? 'md:flex-col md:justify-center' : ''
            }`}
          >
            <div className={`flex items-center space-x-3 overflow-hidden ${isCollapsed ? 'md:space-x-0' : ''}`}>
              <div
                title={user?.name ?? undefined}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-sm"
              >
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={`flex-1 min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-500 uppercase font-medium tracking-wide mt-0.5">{user?.role}</p>
              </div>
            </div>

            <div className={`flex shrink-0 items-center gap-1 ${isCollapsed ? 'md:flex-col' : ''}`}>
              {visibility.hideBrand && (
                <button
                  type="button"
                  onClick={handleToggleCollapse}
                  aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                  title={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
                  className="hidden rounded-xl p-2 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-700 md:flex"
                >
                  {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
              )}
              <button
                onClick={handleLogout}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>

      </aside>
    </>
  )
}
