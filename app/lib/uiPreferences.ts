import { apiFetch } from './api'

export const SIDEBAR_COLLAPSED_STORAGE_KEY = 'rei.sidebar.collapsed'
export const SIDEBAR_GROUPS_STORAGE_KEY = 'rei.sidebar.groups'
export const SIDEBAR_VISIBILITY_EVENT = 'rei:sidebar-visibility-change'
export const UI_PREFERENCES_SYNC_EVENT = 'rei:ui-preferences-sync'
const PAGE_SIZE_STORAGE_PREFIX = 'dsh:pageSize:'

export interface SidebarVisibilityPreference {
  hideBrand: boolean
  hideSearch: boolean
  hideShortcuts: boolean
  hiddenSectionIds: string[]
  hiddenItemHrefs: string[]
}

export interface UiPreferences {
  sidebarVisibility?: SidebarVisibilityPreference
  sidebarCollapsed?: boolean
  sidebarGroups?: Record<string, boolean>
  pageSizes?: Record<string, number>
}

function visibilityStorageKey(userId: number | string): string {
  return `rei.sidebar.visibility:${userId}`
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function collectLocalPreferences(userId: number | string): UiPreferences {
  if (typeof window === 'undefined') return {}
  const preferences: UiPreferences = {}

  const visibility = parseObject(window.localStorage.getItem(visibilityStorageKey(userId)))
  if (visibility) preferences.sidebarVisibility = visibility as unknown as SidebarVisibilityPreference

  const collapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  if (collapsed !== null) preferences.sidebarCollapsed = collapsed === '1'

  const groups = parseObject(window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY))
  if (groups) preferences.sidebarGroups = groups as Record<string, boolean>

  const pageSizes: Record<string, number> = {}
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(PAGE_SIZE_STORAGE_PREFIX)) continue
    const value = Number.parseInt(window.localStorage.getItem(key) ?? '', 10)
    if (Number.isInteger(value)) pageSizes[key.slice(PAGE_SIZE_STORAGE_PREFIX.length)] = value
  }
  if (Object.keys(pageSizes).length > 0) preferences.pageSizes = pageSizes

  return preferences
}

function applyPreferencesLocally(userId: number | string, preferences: UiPreferences): void {
  if (typeof window === 'undefined') return

  const visibilityKey = visibilityStorageKey(userId)
  if (preferences.sidebarVisibility) {
    window.localStorage.setItem(visibilityKey, JSON.stringify(preferences.sidebarVisibility))
  } else {
    window.localStorage.removeItem(visibilityKey)
  }

  if (preferences.sidebarCollapsed !== undefined) {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, preferences.sidebarCollapsed ? '1' : '0')
  } else {
    window.localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
  }

  if (preferences.sidebarGroups) {
    window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(preferences.sidebarGroups))
  } else {
    window.localStorage.removeItem(SIDEBAR_GROUPS_STORAGE_KEY)
  }

  const pageSizeKeys: string[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(PAGE_SIZE_STORAGE_PREFIX)) pageSizeKeys.push(key)
  }
  pageSizeKeys.forEach(key => window.localStorage.removeItem(key))
  Object.entries(preferences.pageSizes ?? {}).forEach(([key, value]) => {
    window.localStorage.setItem(`${PAGE_SIZE_STORAGE_PREFIX}${key}`, String(value))
  })

  window.dispatchEvent(new CustomEvent(SIDEBAR_VISIBILITY_EVENT))
  window.dispatchEvent(new CustomEvent(UI_PREFERENCES_SYNC_EVENT))
}

let saveQueue: Promise<unknown> = Promise.resolve()

export function persistUiPreferences(patch: UiPreferences): void {
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(() => apiFetch('/auth/preferences', { method: 'PATCH', body: patch, redirectOn401: false }))
    .catch(() => undefined)
}

export async function initializeUiPreferences(
  userId: number | string,
  remotePreferences: UiPreferences | null | undefined
): Promise<UiPreferences> {
  const localPreferences = collectLocalPreferences(userId)

  // `undefined` mantém compatibilidade durante o deploy, enquanto o backend antigo
  // ainda não devolve este campo. `null` indica um perfil novo, pronto para migração.
  if (remotePreferences === undefined) return localPreferences

  if (remotePreferences === null) {
    if (Object.keys(localPreferences).length > 0) {
      try {
        await apiFetch('/auth/preferences', {
          method: 'PATCH',
          body: localPreferences,
          redirectOn401: false,
        })
      } catch {
        // O cache local continua válido se a sincronização estiver indisponível.
      }
    }
    return localPreferences
  }

  applyPreferencesLocally(userId, remotePreferences)
  return remotePreferences
}
