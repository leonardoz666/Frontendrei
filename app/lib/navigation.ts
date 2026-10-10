import {
  persistUiPreferences,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  SIDEBAR_VISIBILITY_EVENT,
  type SidebarVisibilityPreference,
  type UiPreferences,
} from './uiPreferences'

/**
 * Árvore de navegação da sidebar — DADOS puros, sem JSX (PRD seção 4, RF-UI-05).
 *
 * Regras:
 *  - o filtro é por PERMISSÃO (`GET /api/auth/me` devolve `permissions`), não por `role`;
 *  - `roles` é fallback: usado quando o item não tem permissão mapeada e também quando o
 *    usuário chega sem a lista de permissões carregada (sessão antiga / resposta parcial);
 *  - item com `disabled: true` = módulo do PRD ainda NÃO implementado. Ele aparece
 *    esmaecido, com o selo "em breve", e NÃO navega — nada de link para rota inexistente;
 *  - só estas rotas existem hoje: `/`, `/dashboard`, `/mesas`,
 *    `/minhas-mesas`, `/admin`, `/admin/produtos`, `/admin/categorias`, `/admin/usuarios`
 *    e `/admin/impressoras`.
 *
 * Os ids de permissão são o espelho de `Backendrei/src/lib/permissions.ts` (fonte da verdade).
 */

/** Ids de permissão conhecidos (mantidos em sincronia com o backend). */
export type NavPermission =
  | 'mesas.visualizar'
  | 'mesas.abrir'
  | 'mesas.reabrir'
  | 'mesas.fechar'
  | 'mesas.transferir'
  | 'mesas.transferir_itens'
  | 'pedidos.criar'
  | 'pedidos.editar'
  | 'pedidos.cancelar'
  | 'pedidos.itens.fechar'
  | 'pagamentos.abrir'
  | 'pagamentos.registrar'
  | 'pagamentos.desconto'
  | 'pagamentos.cancelar'
  | 'pagamentos.estornar'
  | 'caixa.abrir'
  | 'caixa.movimentar'
  | 'caixa.fechar'
  | 'caixa.ajustar_fechado'
  | 'produtos.visualizar'
  | 'produtos.criar'
  | 'produtos.editar'
  | 'produtos.excluir'
  | 'produtos.preco'
  | 'relatorios.visualizar'
  | 'relatorios.faturamento'
  | 'relatorios.caixa'
  | 'relatorios.exportar'
  | 'relatorios.importar'
  | 'relatorios.excluir'
  | 'usuarios.visualizar'
  | 'usuarios.criar'
  | 'usuarios.editar'
  | 'usuarios.excluir'
  | 'usuarios.permissoes'
  | 'cadastros.visualizar'
  | 'cadastros.editar'
  | 'cardapio.publicar'
  | 'cardapio.importar'
  | 'estoque.visualizar'
  | 'estoque.movimentar'
  | 'estoque.ajustar'
  | 'estoque.negativo'
  | 'ponto.visualizar'
  | 'ponto.registrar'
  | 'ponto.ajustar'
  | 'ponto.gerar_arquivo'
  | 'ponto.auditar'
  | 'fiscal.visualizar'
  | 'fiscal.emitir'
  | 'fiscal.cancelar'
  | 'fiscal.configurar'
  | 'hotelaria.visualizar'
  | 'hotelaria.reservar'
  | 'hotelaria.checkin'
  | 'hotelaria.governanca'

/** Nomes de ícone do `lucide-react` usados na árvore (resolvidos em `Sidebar.tsx`). */
export type NavIconName =
  | 'LayoutDashboard'
  | 'ChartColumn'
  | 'Armchair'
  | 'ClipboardList'
  | 'Users'
  | 'Tags'
  | 'Contact'
  | 'Wallet'
  | 'Truck'
  | 'UtensilsCrossed'
  | 'Package'
  | 'FileSpreadsheet'
  | 'Boxes'
  | 'History'
  | 'ClipboardCheck'
  | 'PackageSearch'
  | 'Clock'
  | 'Camera'
  | 'CalendarDays'
  | 'Pencil'
  | 'Shield'
  | 'BedDouble'
  | 'UserCheck'
  | 'Sparkles'
  | 'Landmark'
  | 'Bike'
  | 'FileText'
  | 'Settings'
  | 'UserCog'
  | 'Printer'
  | 'Target'
  | 'Warehouse'
  | 'ListTree'
  | 'MapPin'
  | 'HardDrive'
  | 'QrCode'
  | 'Eye'

export type NavShortcut = 'F8'

export interface NavItem {
  href: string
  label: string
  icon: NavIconName
  /** Permissão única exigida. */
  permission?: NavPermission
  /** Alternativa: qualquer UMA destas permissões concede acesso (OR). */
  anyPermission?: NavPermission[]
  /** Fallback por papel, quando o item não declara permissão. */
  roles?: string[]
  /** Módulo ainda não implementado: renderiza esmaecido, com selo, e não navega. */
  disabled?: boolean
  /** Atalho de teclado associado (documentado na sidebar). */
  shortcut?: NavShortcut
}

export interface NavGroup {
  id: string
  label: string
  icon: NavIconName
  items: NavItem[]
}

/** Formato de `data.user` devolvido por `GET /api/auth/me`. */
export interface NavUser {
  id?: number
  name?: string | null
  role?: string | null
  permissions?: string[] | null
  uiPreferences?: UiPreferences | null
}

/** Grupos + itens visíveis para um usuário (grupo sem item visível não é renderizado). */
export interface VisibleNavGroup {
  group: NavGroup
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'inicio',
    label: 'Início',
    icon: 'LayoutDashboard',
    items: [
      { href: '/', label: 'Início', icon: 'LayoutDashboard' },
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: 'ChartColumn',
        permission: 'relatorios.visualizar',
      },
    ],
  },
  {
    id: 'mesas',
    label: 'Mesas',
    icon: 'Armchair',
    items: [
      {
        href: '/mesas',
        label: 'Mapa de Mesas',
        icon: 'Armchair',
        permission: 'mesas.visualizar',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA', 'GARCOM'],
        shortcut: 'F8',
      },
      {
        href: '/minhas-mesas',
        label: 'Minhas Mesas',
        icon: 'Users',
        roles: ['GARCOM', 'GERENTE', 'DONO'],
      },
      {
        href: '/admin/mesas/qrcodes',
        label: 'QR-Code das Mesas',
        icon: 'QrCode',
        permission: 'cadastros.visualizar',
        roles: ['ADMIN', 'DONO', 'GERENTE'],
      },
    ],
  },
  {
    id: 'cadastros',
    label: 'Cadastros',
    icon: 'Tags',
    items: [
      {
        href: '/admin/categorias',
        label: 'Categorias',
        icon: 'Tags',
        permission: 'cadastros.visualizar',
        roles: ['ADMIN', 'DONO', 'GERENTE'],
      },
      {
        href: '/admin/pracas',
        label: 'Praças',
        icon: 'MapPin',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/pracas/vincular',
        label: 'Vincular Impressora',
        icon: 'Printer',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/centros-custo',
        label: 'Centros de Custo',
        icon: 'Target',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/contas-bancarias',
        label: 'Contas Bancárias',
        icon: 'Landmark',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/plano-contas',
        label: 'Plano de Contas',
        icon: 'ListTree',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/fornecedores',
        label: 'Fornecedores',
        icon: 'Truck',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/estoques',
        label: 'Estoques',
        icon: 'Warehouse',
        permission: 'cadastros.visualizar',
      },
      {
        href: '/admin/formas-pagamento',
        label: 'Formas de Pagamento',
        icon: 'Wallet',
        permission: 'cadastros.visualizar',
      },
    ],
  },
  {
    id: 'cardapio',
    label: 'Cardápio',
    icon: 'UtensilsCrossed',
    items: [
      {
        href: '/admin/produtos',
        label: 'Produtos',
        icon: 'Package',
        permission: 'produtos.visualizar',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA', 'GARCOM', 'COZINHA'],
      },
      {
        href: '/admin/cardapio/tipos-tamanho',
        label: 'Tipos e Tamanhos',
        icon: 'ListTree',
        anyPermission: ['produtos.visualizar', 'cardapio.publicar'],
        roles: ['ADMIN', 'DONO', 'GERENTE'],
      },
      {
        href: '/admin/cardapio/complementos',
        label: 'Complementos',
        icon: 'PackageSearch',
        anyPermission: ['produtos.visualizar', 'cardapio.publicar'],
        roles: ['ADMIN', 'DONO', 'GERENTE'],
      },
      {
        href: '/admin/cardapio',
        label: 'Organizar Cardápio',
        icon: 'UtensilsCrossed',
        permission: 'cardapio.publicar',
      },
      {
        href: '/admin/cardapio/importar',
        label: 'Importar Cardápio',
        icon: 'FileSpreadsheet',
        permission: 'cardapio.importar',
      },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    icon: 'Boxes',
    items: [
      {
        href: '/admin/estoque',
        label: 'Visão Geral',
        icon: 'Boxes',
        permission: 'estoque.visualizar',
      },
      {
        href: '/admin/estoque/insumos',
        label: 'Insumos',
        icon: 'PackageSearch',
        permission: 'estoque.visualizar',
      },
      {
        href: '/admin/estoque/movimentacoes',
        label: 'Movimentações',
        icon: 'History',
        permission: 'estoque.movimentar',
      },
      {
        href: '/admin/estoque/distribuicoes',
        label: 'Saídas e devoluções',
        icon: 'Truck',
        permission: 'estoque.movimentar',
      },
      {
        href: '/admin/estoque/inventario',
        label: 'Inventário',
        icon: 'ClipboardCheck',
        permission: 'estoque.movimentar',
      },
      {
        href: '/admin/estoque/ficha-tecnica',
        label: 'Ficha Técnica',
        icon: 'ClipboardCheck',
        permission: 'estoque.visualizar',
      },
      {
        href: '/admin/estoque/grupos',
        label: 'Grupos e subgrupos',
        icon: 'Tags',
        permission: 'estoque.visualizar',
      },
    ],
  },
  {
    id: 'ponto',
    label: 'Controle de Ponto',
    icon: 'Clock',
    items: [
      {
        href: '/ponto',
        label: 'Registro de Ponto',
        icon: 'Clock',
        permission: 'ponto.visualizar',
      },
      {
        href: '/ponto/batida',
        label: 'Batida por Câmera',
        icon: 'Camera',
        permission: 'ponto.registrar',
      },
      {
        href: '/ponto/espelho',
        label: 'Espelho de Ponto',
        icon: 'CalendarDays',
        permission: 'ponto.visualizar',
      },
      {
        href: '/ponto#ajustes',
        label: 'Ajustes',
        icon: 'Pencil',
        permission: 'ponto.ajustar',
      },
      {
        href: '/ponto/auditoria',
        label: 'Auditoria',
        icon: 'Shield',
        permission: 'ponto.auditar',
      },
    ],
  },
  {
    id: 'hotelaria',
    label: 'Hotelaria',
    icon: 'BedDouble',
    items: [
      {
        href: '/hotelaria',
        label: 'Painel',
        icon: 'BedDouble',
        permission: 'hotelaria.visualizar',
      },
      {
        href: '/hotelaria/reservas',
        label: 'Reservas',
        icon: 'CalendarDays',
        permission: 'hotelaria.reservar',
      },
      {
        href: '/hotelaria/mapa',
        label: 'Mapa de Reservas',
        icon: 'BedDouble',
        permission: 'hotelaria.visualizar',
      },
      {
        href: '/hotelaria/checkin',
        label: 'Check-in',
        icon: 'UserCheck',
        permission: 'hotelaria.checkin',
        disabled: true,
      },
      {
        href: '/hotelaria/governanca',
        label: 'Governança',
        icon: 'Sparkles',
        permission: 'hotelaria.governanca',
      },
    ],
  },
  {
    id: 'caixa',
    label: 'Caixa',
    icon: 'Wallet',
    items: [
      {
        href: '/caixa',
        label: 'Caixa do Dia',
        icon: 'Wallet',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA'],
        anyPermission: ['relatorios.caixa', 'caixa.abrir'],
      },
      {
        href: '/caixa/fechamento',
        label: 'Fechamento',
        icon: 'Landmark',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA'],
        anyPermission: ['relatorios.caixa', 'caixa.fechar'],
      },
      {
        href: '/caixa/historico',
        label: 'Histórico de Caixas',
        icon: 'History',
        permission: 'relatorios.caixa',
      },
      {
        href: '/fiscal/notas',
        label: 'Notas Fiscais',
        icon: 'FileText',
        permission: 'fiscal.visualizar',
      },
      {
        href: '/fiscal/radar-xml',
        label: 'Radar XML SEFAZ',
        icon: 'PackageSearch',
        permission: 'fiscal.visualizar',
      },
    ],
  },
  {
    id: 'administracao',
    label: 'Administração',
    icon: 'Settings',
    items: [
      {
        href: '/admin',
        label: 'Painel',
        icon: 'Settings',
        roles: ['ADMIN', 'DONO'],
      },
      {
        href: '/admin/usuarios',
        label: 'Usuários',
        icon: 'UserCog',
        permission: 'usuarios.visualizar',
        roles: ['ADMIN', 'DONO'],
      },
      {
        href: '/admin/impressoras',
        label: 'Impressoras',
        icon: 'Printer',
        permission: 'cadastros.visualizar',
        roles: ['ADMIN', 'DONO', 'GERENTE'],
      },
      {
        href: '/admin/visibilidade',
        label: 'Visibilidade',
        icon: 'Eye',
        roles: ['ADMIN', 'DONO'],
      },
      {
        href: '/admin/fiscal',
        label: 'Configuração Fiscal',
        icon: 'FileText',
        permission: 'fiscal.configurar',
      },
    ],
  },
]

/** Atalhos globais de teclado (PRD seção 13). `disabled` não navega. */
export const ROUTE_SHORTCUTS: ReadonlyArray<{
  key: NavShortcut
  href: string
  label: string
  disabled: boolean
}> = [
  { key: 'F8', href: '/mesas', label: 'Mapa de Mesas', disabled: false },
]

export { SIDEBAR_COLLAPSED_STORAGE_KEY, SIDEBAR_VISIBILITY_EVENT }

export type SidebarVisibilityState = SidebarVisibilityPreference

export interface SidebarVisualSectionGroup {
  id: string
  label: string
  items: NavItem[]
}

export interface SidebarVisualSection {
  id: string
  label: string
  groupIds: string[]
  groups: SidebarVisualSectionGroup[]
  items: NavItem[]
}

const EMPTY_SIDEBAR_VISIBILITY: SidebarVisibilityState = {
  hideBrand: false,
  hideSearch: false,
  hideShortcuts: false,
  hiddenSectionIds: [],
  hiddenItemHrefs: [],
}

export function sidebarVisibilityStorageKey(user: NavUser | null | undefined): string {
  return `rei.sidebar.visibility:${user?.id ?? user?.role ?? 'default'}`
}

export function readStoredSidebarVisibility(user: NavUser | null | undefined): SidebarVisibilityState {
  if (typeof window === 'undefined') return EMPTY_SIDEBAR_VISIBILITY
  try {
    const raw = window.localStorage.getItem(sidebarVisibilityStorageKey(user))
    if (!raw) return EMPTY_SIDEBAR_VISIBILITY
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY_SIDEBAR_VISIBILITY
    const state = parsed as Partial<SidebarVisibilityState> & { hideHeader?: unknown }
    const legacyHeaderHidden = state.hideHeader === true
    return {
      hideBrand: legacyHeaderHidden || state.hideBrand === true,
      hideSearch: legacyHeaderHidden || state.hideSearch === true,
      hideShortcuts: legacyHeaderHidden || state.hideShortcuts === true,
      hiddenSectionIds: Array.isArray(state.hiddenSectionIds)
        ? state.hiddenSectionIds.filter((value): value is string => typeof value === 'string')
        : [],
      hiddenItemHrefs: Array.isArray(state.hiddenItemHrefs)
        ? state.hiddenItemHrefs.filter((value): value is string => typeof value === 'string')
        : [],
    }
  } catch {
    return EMPTY_SIDEBAR_VISIBILITY
  }
}

export function writeStoredSidebarVisibility(
  user: NavUser | null | undefined,
  state: SidebarVisibilityState
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(sidebarVisibilityStorageKey(user), JSON.stringify(state))
    window.dispatchEvent(new CustomEvent(SIDEBAR_VISIBILITY_EVENT))
  } catch {
    // localStorage indisponível: a preferência deixa de persistir, sem quebrar o menu.
  }
  persistUiPreferences({ sidebarVisibility: state })
}

/** Estado recolhido da sidebar, persistido pelo MainLayout. */
export function readStoredCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeStoredCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // localStorage indisponível (modo privado/quota): o estado só não é persistido.
  }
  persistUiPreferences({ sidebarCollapsed: collapsed })
}

/**
 * O usuário pode ver o item?
 *
 * - sem usuário carregado -> não (mesmo comportamento anterior: menu vazio);
 * - sem regra alguma -> sim (item livre, ex.: Início);
 * - com permissão declarada -> decide por `permissions` (o campo devolvido por `/auth/me`);
 * - `roles` só decide quando o item NÃO declara permissão, ou quando o usuário chegou sem
 *   a lista de permissões (fallback).
 */
export function canSeeNavItem(user: NavUser | null | undefined, item: NavItem): boolean {
  // Sem usuário carregado o menu fica vazio, como no comportamento anterior.
  if (!user) return false

  const hasPermissionRule = Boolean(item.permission) || Boolean(item.anyPermission?.length)
  const hasRoleRule = Boolean(item.roles?.length)

  if (!hasPermissionRule && !hasRoleRule) return true

  const permissions = user.permissions ?? []

  if (hasPermissionRule) {
    if (item.permission && permissions.includes(item.permission)) return true
    if (item.anyPermission?.some(permission => permissions.includes(permission))) return true
    if (hasRoleRule && permissions.length === 0) {
      return Boolean(user.role && item.roles?.includes(user.role))
    }
    return false
  }

  return Boolean(user.role && item.roles?.includes(user.role))
}

/** Grupos com pelo menos um item visível para o usuário. */
export function visibleNavGroups(user: NavUser | null | undefined): VisibleNavGroup[] {
  const visible: VisibleNavGroup[] = []
  for (const group of NAV_GROUPS) {
    const items = group.items.filter(item => canSeeNavItem(user, item))
    if (items.length > 0) visible.push({ group, items })
  }

  if (user?.role === 'GARCOM') {
    const allowedForWaiter = new Set(['/', '/mesas', '/minhas-mesas'])
    return visible
      .map(({ group, items }) => ({ group, items: items.filter(item => allowedForWaiter.has(item.href)) }))
      .filter(({ items }) => items.length > 0)
  }

  if (user?.role === 'ESTOQUISTA') {
    return visible.filter(({ group }) => group.id === 'estoque')
  }

  return visible
}

/** Seções exibidas pela sidebar, compartilhadas com a tela de personalização. */
export function buildSidebarVisualSections(
  sourceGroups: VisibleNavGroup[],
  isWaiter: boolean
): SidebarVisualSection[] {
  const sectionDefinitions: Array<{
    id: string
    label: string
    groupIds: string[]
    itemFilter?: (item: NavItem) => boolean
  }> = [
    {
      id: 'atendimento',
      label: 'ATENDIMENTO',
      groupIds: ['inicio', 'mesas'],
      itemFilter: item => !['/', '/dashboard', '/mesas'].includes(item.href),
    },
    { id: 'cardapio', label: 'CARDÁPIO', groupIds: ['cardapio'] },
    { id: 'estoque', label: 'ESTOQUE', groupIds: ['estoque'] },
    {
      id: 'caixa',
      label: 'CAIXA',
      groupIds: ['caixa'],
      itemFilter: item => ['/caixa', '/caixa/fechamento', '/caixa/historico'].includes(item.href),
    },
    {
      id: 'nota-fiscal',
      label: 'NOTA FISCAL',
      groupIds: ['caixa', 'administracao'],
      itemFilter: item => ['/fiscal/notas', '/fiscal/radar-xml', '/admin/fiscal'].includes(item.href),
    },
  ]

  const sections = sectionDefinitions
    .map(section => {
      const groups = section.groupIds
        .map(groupId => {
          const source = sourceGroups.find(({ group }) => group.id === groupId)
          return source && {
            id: groupId,
            label: source.group.label,
            items: source.items.filter(item => !section.itemFilter || section.itemFilter(item)),
          }
        })
        .filter((group): group is NonNullable<typeof group> => Boolean(group && group.items.length))
      return { ...section, groups, items: groups.flatMap(group => group.items) }
    })
    .filter(section => section.items.length > 0)

  const assigned = new Set(sectionDefinitions.flatMap(section => section.groupIds))
  sourceGroups
    .filter(({ group }) => !assigned.has(group.id))
    .forEach(({ group, items }) => sections.push({
      id: group.id,
      label: group.label.toUpperCase(),
      groupIds: [group.id],
      groups: [{ id: group.id, label: group.label, items }],
      items,
    }))

  return isWaiter ? sections.filter(section => section.id !== 'atendimento') : sections
}

/** A rota casa com o `href` do item (`/` só casa exato). */
export function isHrefActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Item ativo = o `href` mais específico que casa com a rota atual.
 * Itens desabilitados nunca são considerados ativos (rota inexistente).
 */
export function findActiveNavItem(
  pathname: string | null | undefined
): { group: NavGroup; item: NavItem } | null {
  if (!pathname) return null
  let best: { group: NavGroup; item: NavItem } | null = null
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.disabled || !isHrefActive(pathname, item.href)) continue
      if (!best || item.href.length > best.item.href.length) best = { group, item }
    }
  }
  return best
}
