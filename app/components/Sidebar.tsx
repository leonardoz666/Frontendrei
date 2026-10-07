'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/contexts/ToastContext'
import { apiFetch } from '@/app/lib/api'
import {
  findActiveNavItem,
  readStoredCollapsed,
  readStoredGroupState,
  visibleNavGroups,
  writeStoredCollapsed,
  writeStoredGroupState,
  type NavItem,
  type NavUser,
} from '@/app/lib/navigation'

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
  const [searchTerm, setSearchTerm] = useState('')
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

  const visibleGroups = useMemo(() => visibleNavGroups(user), [user])
  const active = useMemo(() => findActiveNavItem(pathname), [pathname])
  const activeGroupId = active?.group.id
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
    const sectionDefinitions = [
      {
        id: 'atendimento',
        label: 'ATENDIMENTO',
        groupIds: ['inicio', 'mesas'],
        itemFilter: (item: NavItem) => !['/', '/dashboard', '/mesas'].includes(item.href),
      },
      { id: 'cardapio-estoque', label: 'CARDÁPIO E ESTOQUE', groupIds: ['cardapio', 'estoque'] },
      {
        id: 'caixa',
        label: 'CAIXA',
        groupIds: ['caixa'],
        itemFilter: (item: NavItem) => ['/caixa', '/caixa/fechamento'].includes(item.href),
      },
      {
        id: 'nota-fiscal',
        label: 'NOTA FISCAL',
        groupIds: ['caixa', 'administracao'],
        itemFilter: (item: NavItem) => ['/fiscal/notas', '/fiscal/radar-xml', '/admin/fiscal'].includes(item.href),
      },
    ]
    const sections = sectionDefinitions
      .map(section => ({
        ...section,
        items: section.groupIds.flatMap(groupId =>
          (sourceGroups.find(group => group.group.id === groupId)?.items ?? []).filter(item =>
            !section.itemFilter || section.itemFilter(item)
          )
        ),
      }))
      .filter(section => section.items.length > 0)
    const assigned = new Set(sectionDefinitions.flatMap(section => section.groupIds))
    sourceGroups
      .filter(({ group }) => !assigned.has(group.id))
      .forEach(({ group, items }) => sections.push({ id: group.id, label: group.label.toUpperCase(), groupIds: [group.id], items }))
    return isWaiter ? sections.filter(section => section.id !== 'atendimento') : sections
  }, [filteredGroups, isWaiter, normalizedSearch, visibleGroups])

  const visualSectionForActive = useMemo(
    () => visualSections.find(section => section.groupIds.includes(activeGroupId ?? '')),
    [activeGroupId, visualSections]
  )
  const activeSectionId = visualSectionForActive?.id

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
    await apiFetch('/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const isTablePage = pathname.startsWith('/mesas/') && pathname !== '/mesas'
  const currentMesaId = isTablePage ? pathname.split('/')[2] : null

  const handleRequestBill = async () => {
    if (!currentMesaId) return
    try {
      await apiFetch(`/tables/${currentMesaId}/request-bill`, { method: 'POST' })
      setShowBillModal(false)
      router.push('/mesas')
    } catch (error) {
      console.error('Error requesting bill:', error)
    }
  }

  const handlePrintPartialBill = async () => {
    if (!currentMesaId) return
    try {
      await apiFetch(`/tables/${currentMesaId}/print-partial`, { method: 'POST' })
      setShowBillModal(false)
      showToast('Conta parcial enviada para a impressora!', 'success')
    } catch (error) {
      console.error('Error printing partial bill:', error)
      showToast(error instanceof Error ? error.message : 'Erro ao imprimir conta parcial', 'error')
    }
  }

  const renderItem = (item: NavItem) => {
    if (isCollapsed) return null

    if (item.disabled) {
      return (
        <div
          key={item.href}
          aria-disabled="true"
          title={`${item.label} — em breve`}
          className={`flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-medium text-slate-300 cursor-not-allowed select-none ${
            isCollapsed ? 'md:justify-center md:px-0' : ''
          }`}
        >
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
        className={`group relative flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-[13px] font-semibold leading-5 tracking-[0.01em] transition-all duration-200 hover:translate-x-0.5 ${
          isActive
            ? 'border border-orange-300 bg-orange-50 text-orange-800'
            : 'text-slate-600 hover:bg-orange-50/70 hover:text-orange-800'
        } ${isCollapsed ? 'md:justify-center md:px-0' : ''}`}
      >
        <span className={`flex-1 truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
        {item.shortcut && (
          <kbd
            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
              isActive ? 'border-orange-200 bg-white/70 text-orange-700' : 'border-slate-200 text-slate-400'
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
        fixed inset-y-0 left-0 z-[70] w-72 bg-white flex flex-col transition-all duration-300 ease-in-out border-r border-slate-200 shadow-[18px_0_17px_rgba(15,20,31,0.06)]
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'md:w-[88px]' : 'md:w-72'}
        md:translate-x-0
      `}>
        <div
          className={`px-4 pt-[18px] pb-0 ${
            isCollapsed ? 'md:px-4' : ''
          }`}
        >
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

          <div className={`mt-3 ${isWaiter || isCollapsed ? 'hidden' : ''}`}>
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

          <div className={`mt-3 ${isWaiter ? 'flex flex-col gap-1.5' : 'flex h-[58px] gap-2'} ${isCollapsed ? 'md:hidden' : ''}`}>
            {quickShortcuts.map(shortcut => {
              const activeShortcut = pathname === shortcut.href
              return (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  title={shortcut.label}
                  className={`flex items-center rounded-xl border px-2.5 text-[11px] font-semibold leading-3 shadow-sm transition-all duration-200 ${isWaiter ? 'min-h-10 w-full' : 'w-20'} ${
                    activeShortcut
                      ? 'border-orange-400 bg-orange-50 text-orange-900 shadow-orange-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900 hover:shadow-orange-100'
                  }`}
                >
                  {shortcut.label}
                </Link>
              )
            })}
          </div>
          <div className="mt-4 h-px bg-slate-200" />
        </div>

        <nav className={`flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] ${isCollapsed ? 'md:px-4' : ''}`}>
          {filteredGroups.length === 0 && (
            <div className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-sm font-medium text-slate-500 ${isCollapsed ? 'md:hidden' : ''}`}>
              Nenhum módulo encontrado
            </div>
          )}

          {!isCollapsed && visualSections.map(section => {
            const isGroupActive = section.id === activeSectionId
            const isGroupOpen = Boolean(normalizedSearch) || (openGroups[section.id] ?? isGroupActive)

            return (
              <div key={section.id} className="mb-4 rounded-2xl border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(section.id)}
                  aria-expanded={isGroupOpen}
                  title={section.label}
                  className={`flex w-full items-center rounded-xl border-l-2 px-2.5 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition-colors ${isGroupActive ? 'border-orange-500 bg-orange-50/60 text-orange-800' : 'border-slate-300 text-slate-700 hover:border-orange-300 hover:bg-slate-50'}`}
                >
                  <span className="flex-1 text-left truncate">{section.label}</span>
                  <ChevronDown
                    size={14}
                    strokeWidth={2.5}
                    className={`shrink-0 transition-transform duration-200 ${isGroupOpen ? '' : '-rotate-90'}`}
                  />
                </button>

                <div className={isGroupOpen ? 'mt-2 space-y-1' : 'hidden'}>
                  {section.items.map(renderItem)}
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

        <div className="border-t border-slate-100 bg-gradient-to-t from-slate-50 to-white p-3">
          {isTablePage && (
            <button
              onClick={() => setShowBillModal(true)}
              title="Solicitar Conta"
              className={`mb-3 hidden w-full items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 font-bold text-orange-700 transition-colors hover:bg-orange-100 md:flex ${
                isCollapsed ? 'md:px-2' : ''
              }`}
            >
              <Receipt size={20} className="shrink-0" />
              <span className={isCollapsed ? 'md:hidden' : ''}>Solicitar Conta</span>
            </button>
          )}

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

            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
