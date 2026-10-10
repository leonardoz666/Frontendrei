'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { LogOut, MessageCircle } from 'lucide-react'
import Sidebar from './Sidebar'
import { apiFetch } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'
import { initializeUiPreferences } from '@/app/lib/uiPreferences'
import {
  ROUTE_SHORTCUTS,
  readStoredCollapsed,
  writeStoredCollapsed,
  type NavUser,
} from '@/app/lib/navigation'

/**
 * Suporte (RF-UI-04): `NEXT_PUBLIC_SUPORTE_WHATSAPP` aceita a URL completa do WhatsApp
 * ou apenas o telefone. Sem a variável, nenhum botão é renderizado (nada de link quebrado).
 */
function resolveSupportHref(raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  const digits = value.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()
  const isLoginPage = pathname === '/login'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [user, setUser] = useState<NavUser | null>(null)

  const isWaiter = user?.role === 'GARCOM'
  const isStockkeeper = user?.role === 'ESTOQUISTA'
  const isStockRoute = pathname === '/admin/estoque' || pathname.startsWith('/admin/estoque/')
  const isStockRouteBlocked = isStockkeeper && !isStockRoute
  const sidebarOffset = isLoginPage || !user || isWaiter ? '' : isStockkeeper || !isCollapsed ? 'md:ml-72' : 'md:ml-[88px]'
  const supportHref = isLoginPage || !user ? null : resolveSupportHref(process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP)

  // Estado recolhido persistido: lido após a montagem para não divergir do SSR.
  useEffect(() => {
    setIsCollapsed(readStoredCollapsed())
  }, [])

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(prev => {
      const next = !prev
      writeStoredCollapsed(next)
      return next
    })
  }, [])

  // Usuário logado: alimenta o cabeçalho e a Sidebar (uma única chamada a /api/auth/me).
  useEffect(() => {
    if (isLoginPage) {
      setUser(null)
      return
    }
    let cancelled = false
    const loadUser = async () => {
      try {
        const data = await apiFetch<{ user?: NavUser }>('/auth/me', { redirectOn401: false })
        if (!cancelled && data.user) {
          const preferences = data.user.id === undefined
            ? data.user.uiPreferences ?? {}
            : await initializeUiPreferences(data.user.id, data.user.uiPreferences)
          if (!cancelled) {
            setIsCollapsed(preferences.sidebarCollapsed ?? readStoredCollapsed())
            setUser(data.user)
          }
        } else if (!cancelled) {
          setUser(null)
        }
      } catch {
        // Sessão indisponível: as páginas cuidam do redirecionamento para /login.
        if (!cancelled) setUser(null)
      }
    }
    loadUser()
    return () => {
      cancelled = true
    }
  }, [isLoginPage])

  // O cargo de estoquista é operacional e permanece restrito ao módulo de estoque,
  // inclusive quando alguém tenta abrir outra URL diretamente.
  useEffect(() => {
    if (isStockRouteBlocked) router.replace('/admin/estoque')
  }, [isStockRouteBlocked, router])

  // Atalho global (PRD seção 13): F8 abre o mapa de mesas.
  useEffect(() => {
    if (isLoginPage || isStockkeeper) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return

      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return
      }

      const shortcut = ROUTE_SHORTCUTS.find(option => option.key === event.key)
      if (!shortcut) return

      event.preventDefault()

      if (shortcut.disabled) {
        showToast(`${shortcut.label}: módulo ainda não disponível`, 'warning')
        return
      }

      router.push(shortcut.href)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLoginPage, isStockkeeper, router, showToast])

  const handleLogout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {!isLoginPage && user && (
        <>
          {isWaiter ? (
            <header className="sticky top-0 z-30 grid min-h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 shadow-sm sm:px-5 md:px-8 xl:min-h-[76px] xl:grid-cols-[1fr_auto_1fr] xl:gap-6 xl:py-0">
              <div className="hidden shrink-0 items-center gap-3 xl:flex">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-xl font-bold text-white">R</div>
                <div className="hidden sm:block">
                  <p className="text-base font-bold leading-tight text-slate-900">Rei do Pirão</p>
                  <p className="text-xs font-medium text-slate-500">Operação do salão</p>
                </div>
              </div>

              <nav className="col-start-1 row-start-1 grid min-w-0 w-full grid-cols-3 items-stretch justify-center gap-1.5 sm:gap-2 xl:col-start-2 xl:flex xl:w-auto xl:flex-none xl:items-center" aria-label="Navegação do garçom">
                {[
                  { href: '/', label: 'Início', mobileLabel: 'Início' },
                  { href: '/mesas', label: 'Mapa de Mesas', mobileLabel: 'Mesas' },
                  { href: '/minhas-mesas', label: 'Minhas Mesas', mobileLabel: 'Minhas' },
                ].map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className={`flex min-h-10 min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-bold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:px-4 sm:text-sm xl:py-2.5 ${pathname === item.href ? 'border-orange-600 bg-orange-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950'}`}
                  >
                    <span className="sm:hidden">{item.mobileLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-2 sm:gap-3 xl:col-start-3 xl:gap-6 xl:justify-self-end">
                <div
                  id="waiter-header-status"
                  className="hidden min-w-[250px] shrink-0 items-center justify-center xl:flex"
                  aria-live="polite"
                />

                <div className="flex shrink-0 items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="max-w-36 truncate text-sm font-semibold text-slate-900">{user?.name ?? 'Garçom'}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">GARÇOM</p>
                  </div>
                  <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white sm:flex">
                    {user?.name?.charAt(0).toUpperCase() || 'G'}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Sair"
                    aria-label="Sair"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition-colors hover:border-red-300 hover:bg-red-100 sm:h-9 sm:w-9 sm:border-transparent sm:bg-transparent sm:text-slate-400 sm:shadow-none sm:hover:bg-red-50 sm:hover:text-red-600"
                  >
                    <LogOut size={17} />
                  </button>
                </div>
              </div>
            </header>
          ) : (
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              user={user}
              collapsed={isStockkeeper ? false : isCollapsed}
              onToggleCollapse={isStockkeeper ? undefined : toggleCollapsed}
            />
          )}

          {supportHref && (
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              title="Suporte pelo WhatsApp"
              aria-label="Suporte pelo WhatsApp"
              className="fixed bottom-4 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white shadow-lg shadow-green-200 hover:bg-green-600 transition-colors"
            >
              <MessageCircle size={22} />
            </a>
          )}
        </>
      )}

      <main className={`min-w-0 flex-1 transition-[margin] duration-300 ${sidebarOffset}`}>
        {!isStockRouteBlocked && children}
      </main>
    </div>
  )
}
