'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { LogOut, MessageCircle } from 'lucide-react'
import Sidebar from './Sidebar'
import { apiFetch } from '@/app/lib/api'
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
  const [user, setUser] = useState<NavUser | null>(null)

  const isWaiter = user?.role === 'GARCOM'
  const sidebarOffset = isLoginPage || !user || isWaiter ? '' : isCollapsed ? 'md:ml-[88px]' : 'md:ml-72'
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
        if (!cancelled) setUser(data.user ?? null)
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

  // Atalho global (PRD seção 13): F8 abre o mapa de mesas.
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
            <header className="sticky top-0 z-30 flex min-h-[76px] items-center justify-between gap-6 border-b border-slate-200 bg-white px-5 shadow-sm md:px-8">
              <div className="flex shrink-0 items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-xl font-bold text-white">R</div>
                <div className="hidden sm:block">
                  <p className="text-base font-bold leading-tight text-slate-900">Rei do Pirão</p>
                  <p className="text-xs font-medium text-slate-500">Operação do salão</p>
                </div>
              </div>

              <nav className="flex min-w-0 flex-1 items-center justify-center gap-2" aria-label="Navegação do garçom">
                {[
                  { href: '/', label: 'Início' },
                  { href: '/mesas', label: 'Mapa de Mesas' },
                  { href: '/minhas-mesas', label: 'Minhas Mesas' },
                ].map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className={`rounded-lg border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${pathname === item.href ? 'border-orange-600 bg-orange-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950'}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="max-w-36 truncate text-sm font-semibold text-slate-900">{user?.name ?? 'Garçom'}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">GARÇOM</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase() || 'G'}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sair"
                  aria-label="Sair"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </header>
          ) : (
            <Sidebar
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              user={user}
              collapsed={isCollapsed}
              onToggleCollapse={toggleCollapsed}
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
        {children}
      </main>
    </div>
  )
}
