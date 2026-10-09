'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import {
  buildSidebarVisualSections,
  readStoredSidebarVisibility,
  visibleNavGroups,
  writeStoredSidebarVisibility,
  type NavUser,
  type SidebarVisibilityState,
} from '@/app/lib/navigation'
import { initializeUiPreferences } from '@/app/lib/uiPreferences'

function VisibilitySwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? 'border-orange-600 bg-orange-600' : 'border-slate-300 bg-slate-200'
      } ${checked ? 'justify-end' : 'justify-start'}`}
    >
      <span className="h-5 w-5 rounded-full border border-slate-200 bg-white shadow-sm" />
    </button>
  )
}

export default function SidebarVisibilityPage() {
  const [user, setUser] = useState<NavUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [visibility, setVisibility] = useState<SidebarVisibilityState>({
    hideBrand: false,
    hideSearch: false,
    hideShortcuts: false,
    hiddenSectionIds: [],
    hiddenItemHrefs: [],
  })
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    apiFetch<{ user?: NavUser }>('/auth/me')
      .then(async data => {
        if (cancelled || !data.user) return
        const preferences = data.user.id === undefined
          ? data.user.uiPreferences ?? {}
          : await initializeUiPreferences(data.user.id, data.user.uiPreferences)
        if (cancelled) return
        setUser(data.user)
        setVisibility(preferences.sidebarVisibility ?? readStoredSidebarVisibility(data.user))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sections = useMemo(
    () => buildSidebarVisualSections(visibleNavGroups(user), user?.role === 'GARCOM'),
    [user]
  )

  const persist = (next: SidebarVisibilityState) => {
    setVisibility(next)
    writeStoredSidebarVisibility(user, next)
  }

  const toggleSection = (sectionId: string) => {
    const hidden = new Set(visibility.hiddenSectionIds)
    if (hidden.has(sectionId)) hidden.delete(sectionId)
    else hidden.add(sectionId)
    persist({ ...visibility, hiddenSectionIds: [...hidden] })
  }

  const toggleItem = (href: string) => {
    const hidden = new Set(visibility.hiddenItemHrefs)
    if (hidden.has(href)) hidden.delete(href)
    else hidden.add(href)
    persist({ ...visibility, hiddenItemHrefs: [...hidden] })
  }

  const resetVisibility = () => persist({
    hideBrand: false,
    hideSearch: false,
    hideShortcuts: false,
    hiddenSectionIds: [],
    hiddenItemHrefs: [],
  })

  const toggleExpanded = (sectionId: string) => {
    setExpandedSections(current => {
      const next = new Set(current)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-orange-600" size={32} />
      </div>
    )
  }

  const hiddenCount = Number(visibility.hideBrand)
    + Number(visibility.hideSearch)
    + Number(visibility.hideShortcuts)
    + visibility.hiddenSectionIds.length
    + visibility.hiddenItemHrefs.length

  const renderSection = (section: (typeof sections)[number]) => {
    const sectionVisible = !visibility.hiddenSectionIds.includes(section.id)
    const isExpanded = expandedSections.has(section.id)

    return (
      <section key={section.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className={`flex min-h-16 items-center gap-4 bg-slate-50 px-5 py-3 ${isExpanded ? 'border-b border-slate-200' : ''}`}>
          <button
            type="button"
            onClick={() => toggleExpanded(section.id)}
            aria-expanded={isExpanded}
            className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            <ChevronDown
              size={18}
              className={`shrink-0 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">{section.label}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{section.items.length} opção(ões)</span>
            </span>
          </button>
          <VisibilitySwitch
            checked={sectionVisible}
            label={`${sectionVisible ? 'Ocultar' : 'Exibir'} categoria ${section.label}`}
            onChange={() => toggleSection(section.id)}
          />
        </div>

        {isExpanded && (
          <div className={sectionVisible ? '' : 'bg-slate-50/70'}>
            {section.groups.map((group, groupIndex) => (
              <div key={group.id}>
                {section.groups.length > 1 && (
                  <p className={`px-5 pb-1 pt-4 text-xs font-bold uppercase text-slate-500 ${groupIndex > 0 ? 'border-t border-slate-100' : ''}`}>
                    {group.label}
                  </p>
                )}
                {group.items.map(item => {
                  const itemVisible = !visibility.hiddenItemHrefs.includes(item.href)
                  return (
                    <div
                      key={item.href}
                      className="flex min-h-12 items-center justify-between gap-4 border-t border-slate-100 px-5 py-2 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-medium ${sectionVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                          {item.label}
                        </p>
                        {item.disabled && <p className="text-xs text-slate-400">Em breve</p>}
                      </div>
                      <VisibilitySwitch
                        checked={itemVisible}
                        disabled={!sectionVisible}
                        label={`${itemVisible ? 'Ocultar' : 'Exibir'} ${item.label}`}
                        onChange={() => toggleItem(item.href)}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Visibilidade da barra lateral</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Escolha quais categorias e opções aparecem no seu menu. Isso não altera permissões nem bloqueia páginas.
            </p>
          </div>
          <button
            type="button"
            onClick={resetVisibility}
            disabled={hiddenCount === 0}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={17} />
            Restaurar tudo
          </button>
        </header>

        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-600">
          {hiddenCount > 0 ? <EyeOff size={17} /> : <Eye size={17} />}
          {hiddenCount === 0 ? 'Todos os itens disponíveis estão visíveis.' : `${hiddenCount} item(ns) oculto(s).`}
        </div>

        <section className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {[
            {
              key: 'hideBrand' as const,
              title: 'Marca do restaurante',
              description: 'Logo, nome do restaurante e identificação da operação.',
            },
            {
              key: 'hideSearch' as const,
              title: 'Campo de busca',
              description: 'Busca rápida por módulos e ações do sistema.',
            },
            {
              key: 'hideShortcuts' as const,
              title: 'Atalhos rápidos',
              description: 'Botões Início, Mapa de Mesas e Painel.',
            },
          ].map(option => (
            <div key={option.key} className="flex min-h-20 items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 first:border-t-0">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{option.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
              </div>
              <VisibilitySwitch
                checked={!visibility[option.key]}
                label={`${visibility[option.key] ? 'Exibir' : 'Ocultar'} ${option.title.toLowerCase()}`}
                onChange={() => persist({ ...visibility, [option.key]: !visibility[option.key] })}
              />
            </div>
          ))}
        </section>

        <div className="space-y-4 lg:hidden">
          {sections.map(renderSection)}
        </div>

        <div className="hidden grid-cols-2 items-start gap-4 lg:grid">
          <div className="space-y-4">
            {sections.filter((_, index) => index % 2 === 0).map(renderSection)}
          </div>
          <div className="space-y-4">
            {sections.filter((_, index) => index % 2 === 1).map(renderSection)}
          </div>
        </div>
      </div>
    </main>
  )
}
