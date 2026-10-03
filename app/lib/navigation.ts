/**
 * Árvore de navegação da sidebar — DADOS puros, sem JSX (PRD seção 4, RF-UI-05).
 *
 * Regras:
 *  - o filtro é por PERMISSÃO (`GET /api/auth/me` devolve `permissions`), não por `role`;
 *  - `roles` é fallback: usado quando o item não tem permissão mapeada e também quando o
 *    usuário chega sem a lista de permissões carregada (sessão antiga / resposta parcial);
 *  - item com `disabled: true` = módulo do PRD ainda NÃO implementado. Ele aparece
 *    esmaecido, com o selo "em breve", e NÃO navega — nada de link para rota inexistente;
 *  - só estas rotas existem hoje: `/`, `/dashboard`, `/mesas`, `/mesas-abertas`,
 *    `/minhas-mesas`, `/admin`, `/admin/produtos`, `/admin/categorias`, `/admin/usuarios`
 *    e `/admin/impressoras`.
 *
 * Os ids de permissão são o espelho de `Backendrei/src/lib/permissions.ts` (fonte da verdade).
 */

/** Ids de permissão conhecidos (mantidos em sincronia com o backend). */
export type NavPermission =
  | 'mesas.visualizar'
  | 'mesas.abrir'
  | 'mesas.fechar'
  | 'mesas.transferir'
  | 'pedidos.criar'
  | 'pedidos.editar'
  | 'pedidos.cancelar'
  | 'pedidos.itens.fechar'
  | 'pagamentos.abrir'
  | 'pagamentos.registrar'
  | 'pagamentos.desconto'
  | 'pagamentos.cancelar'
  | 'pagamentos.estornar'
  | 'produtos.visualizar'
  | 'produtos.criar'
  | 'produtos.editar'
  | 'produtos.excluir'
  | 'produtos.preco'
  | 'relatorios.visualizar'
  | 'relatorios.faturamento'
  | 'relatorios.caixa'
  | 'relatorios.exportar'
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

export type NavShortcut = 'F7' | 'F8'

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
        anyPermission: ['relatorios.visualizar', 'relatorios.caixa'],
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA'],
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
        href: '/mesas-abertas',
        label: 'Mesas Abertas',
        icon: 'ClipboardList',
        permission: 'mesas.visualizar',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA', 'GARCOM'],
      },
      {
        href: '/minhas-mesas',
        label: 'Minhas Mesas',
        icon: 'Users',
        roles: ['GARCOM', 'GERENTE', 'DONO'],
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
        href: '/admin/cardapio',
        label: 'Publicar Cardápio',
        icon: 'UtensilsCrossed',
        permission: 'cardapio.publicar',
        disabled: true,
      },
      {
        href: '/admin/cardapio/importar',
        label: 'Importar Cardápio',
        icon: 'FileSpreadsheet',
        permission: 'cardapio.importar',
        disabled: true,
      },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    icon: 'Boxes',
    items: [
      {
        href: '/estoque',
        label: 'Visão Geral',
        icon: 'Boxes',
        permission: 'estoque.visualizar',
        disabled: true,
      },
      {
        href: '/estoque/movimentacoes',
        label: 'Movimentações',
        icon: 'History',
        permission: 'estoque.movimentar',
        disabled: true,
      },
      {
        href: '/estoque/inventario',
        label: 'Inventário',
        icon: 'ClipboardCheck',
        permission: 'estoque.ajustar',
        disabled: true,
      },
      {
        href: '/estoque/insumos',
        label: 'Insumos',
        icon: 'PackageSearch',
        permission: 'estoque.visualizar',
        disabled: true,
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
        disabled: true,
      },
      {
        href: '/ponto/espelho',
        label: 'Espelho de Ponto',
        icon: 'CalendarDays',
        permission: 'ponto.visualizar',
        disabled: true,
      },
      {
        href: '/ponto/ajustes',
        label: 'Ajustes',
        icon: 'Pencil',
        permission: 'ponto.ajustar',
        disabled: true,
      },
      {
        href: '/ponto/auditoria',
        label: 'Auditoria',
        icon: 'Shield',
        permission: 'ponto.auditar',
        disabled: true,
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
        disabled: true,
      },
      {
        href: '/hotelaria/reservas',
        label: 'Reservas',
        icon: 'CalendarDays',
        permission: 'hotelaria.reservar',
        disabled: true,
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
        disabled: true,
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
        disabled: true,
      },
      {
        href: '/caixa/fechamento',
        label: 'Fechamento',
        icon: 'Landmark',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA'],
        disabled: true,
      },
      {
        // F7 (PRD seção 13): atalho existe, módulo de delivery ainda não.
        href: '/delivery',
        label: 'Delivery',
        icon: 'Bike',
        roles: ['ADMIN', 'DONO', 'GERENTE', 'CAIXA'],
        disabled: true,
        shortcut: 'F7',
      },
      {
        href: '/fiscal/notas',
        label: 'Notas Fiscais',
        icon: 'FileText',
        permission: 'fiscal.visualizar',
        disabled: true,
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
        href: '/admin/fiscal',
        label: 'Configuração Fiscal',
        icon: 'FileText',
        permission: 'fiscal.configurar',
        disabled: true,
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
  { key: 'F7', href: '/delivery', label: 'Delivery', disabled: true },
]

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'rei.sidebar.collapsed'
export const SIDEBAR_GROUPS_STORAGE_KEY = 'rei.sidebar.groups'

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
}

/** Grupos abertos/fechados escolhidos pelo usuário (`id do grupo -> aberto?`). */
export function readStoredGroupState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const state: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') state[key] = value
    }
    return state
  } catch {
    return {}
  }
}

export function writeStoredGroupState(state: Record<string, boolean>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage indisponível: o acordeão continua funcionando só em memória.
  }
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
  return visible
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
