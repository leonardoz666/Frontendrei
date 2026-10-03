'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, LogOut, Menu, MessageCircle, User as UserIcon } from 'lucide-react'
import Sidebar from './Sidebar'
import { useToast } from '@/contexts/ToastContext'
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [user, setUser] = useState<NavUser | null>(null)

  const sidebarOffset = isLoginPage ? '' : isCollapsed ? 'md:ml-20' : 'md:ml-64'
  const supportHref = isLoginPage ? null : resolveSupportHref(process.env.NEXT_PUBLIC_SUPORTE_WHATSAPP)

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
    if (isLoginPage) return
    let cancelled = false
    const loadUser = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return
        const data = (await res.json()) as { user?: NavUser }
        if (!cancelled && data.user) setUser(data.user)
      } catch {
        // Sessão indisponível: as páginas cuidam do redirecionamento para /login.
      }
    }
    loadUser()
    return () => {
      cancelled = true
    }
  }, [isLoginPage])

  // Fecha o menu de usuário ao trocar de rota.
  useEffect(() => {
    setIsUserMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setIsUserMenuOpen(false)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Atalhos globais (PRD seção 13): F8 = /mesas; F7 = delivery, ainda desabilitado.
  useEffect(() => {
    if (isLoginPage) return

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
  }, [isLoginPage, router, showToast])

  return (
    <div className="min-h-screen bg-gray-100">
      {!isLoginPage && (
        <>
          {/* Cabeçalho: fixo no mobile; em telas grandes entra no fluxo abaixo da sidebar
              (as páginas de mesas/produtos têm cabeçalho próprio `sticky top-0`). */}
          <header
            className={`bg-white border-b border-gray-200 p-4 flex items-center justify-between gap-3 sticky top-0 z-30 transition-[margin] duration-300 md:relative md:top-auto ${sidebarOffset}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                aria-label="Abrir menu"
              >
                <Menu size={24} />
              </button>
              <span className="font-bold text-gray-800 text-lg truncate">Rei do Pirão</span>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(prev => !prev)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || <UserIcon size={18} />}
                </span>
                <span className="hidden sm:block text-left max-w-[10rem]">
                  <span className="block text-sm font-semibold text-gray-900 truncate leading-tight">
                    {user?.name ?? 'Carregando…'}
                  </span>
                  <span className="block text-[11px] text-gray-500 uppercase font-medium tracking-wide">
                    {user?.role ?? ''}
                  </span>
                </span>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 shrink-0 ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name ?? '—'}</p>
                      <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">
                        {user?.role ?? '—'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <LogOut size={18} />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            user={user}
            collapsed={isCollapsed}
            onToggleCollapse={toggleCollapsed}
          />

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

      <main className={`flex-1 transition-[margin] duration-300 ${sidebarOffset}`}>
        {children}
      </main>
    </div>
  )
}
