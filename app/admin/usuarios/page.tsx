'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Pagination } from '@/app/components/ui/Pagination'
import { Switch } from '@/app/components/ui/Switch'
import Skeleton from '@/app/components/ui/Skeleton'
import { PAGE_SIZE_OPTIONS, usePagedQuery } from '@/app/lib/pagination'
import { paginaAtual, useListaCrud } from '@/app/lib/crud-client'
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  Edit,
  KeyRound,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { apiFetch, redirectToLogin } from '@/app/lib/api'

interface User {
  id: number
  nome: string
  login: string
  role: string
  codOperador: number | null
  ativo: boolean
  email: string | null
  foto: string | null
  permissions: string[]
  defaultRolePermissions?: string[]
  customPermissions?: string[]
  modoEstoque: 'COMPLETO' | 'SIMPLIFICADO'
}

interface PermissionGroup {
  group: string
  label: string
  items: Array<{ id: string; label: string }>
}

interface PermissionSchema {
  allPermissions: string[]
  groups: PermissionGroup[]
  roleDefaults: Record<string, string[]>
}

const ROLE_LABELS: Record<string, string> = {
  DONO: 'Dono',
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  CAIXA: 'Caixa',
  ATENDENTE: 'Atendente',
  GARCOM: 'Garçom',
  COZINHA: 'Cozinha',
  ESTOQUISTA: 'Estoquista',
}

export default function AdminUsersPage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [actor, setActor] = useState<{ id: number; role: string; permissions: string[] } | null>(null)
  const [permissionSchema, setPermissionSchema] = useState<PermissionSchema | null>(null)
  
  // Form states
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [email, setEmail] = useState('')
  const [codOperador, setCodOperador] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [foto, setFoto] = useState<string | null>(null)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState('GARCOM')
  const [modoEstoque, setModoEstoque] = useState<'COMPLETO' | 'SIMPLIFICADO'>('COMPLETO')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'ATIVOS' | 'INATIVOS'>('TODOS')
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  
  const [error, setError] = useState('')
  const [, setSuccess] = useState('')
  const router = useRouter()
  const queryClient = useQueryClient()
  const lista = useListaCrud('/users')
  const statusResource = statusFilter === 'TODOS'
    ? '/users'
    : `/users?ativo=${statusFilter === 'ATIVOS'}`
  const usersQuery = usePagedQuery<User>({
    ...lista.listaParams,
    resource: statusResource,
    enabled: actor !== null,
  })
  const pagina = paginaAtual(usersQuery, lista.page, lista.pageSize)
  const resumoQuery = useQuery({
    queryKey: ['users-resumo'],
    queryFn: () => apiFetch<{ total: number; ativos: number; inativos: number }>('/users/resumo'),
    enabled: actor !== null,
  })

  useEffect(() => {
    const run = async () => {
      try {
        const meData = await apiFetch<{ user: { id: number; role: string; permissions: string[] } }>('/auth/me')
        if (!meData.user) {
          redirectToLogin()
          return
        }
        const permissoes: string[] = meData.user.permissions ?? []
        if (!permissoes.includes('usuarios.visualizar')) {
          router.replace('/')
          return
        }
        setActor(meData.user)
        const schema = await apiFetch<PermissionSchema>('/users/permissions/schema')
        setPermissionSchema(schema)
        setSelectedPermissions(schema.roleDefaults.GARCOM ?? [])
        setLoading(false)
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Erro ao carregar sessão', 'error')
        setLoading(false)
      }
    }

    run()
  }, [router, showToast])

  const isAdmin = actor?.role === 'DONO' || actor?.role === 'ADMIN'
  const canCreateUsers = actor?.role === 'DONO' || Boolean(actor?.permissions.includes('usuarios.criar'))
  const canEditUsers = actor?.role === 'DONO' || Boolean(actor?.permissions.includes('usuarios.editar'))
  const canDeleteUsers = actor?.role === 'DONO' || Boolean(actor?.permissions.includes('usuarios.excluir'))
  const canAssignPermissions = actor?.role === 'DONO' || Boolean(actor?.permissions.includes('usuarios.permissoes'))
  const canManage = (user: User) => isAdmin || (
    !['DONO', 'ADMIN'].includes(user.role) && user.permissions.every(p => actor?.permissions.includes(p))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const url = editingId ? `/api/users/${editingId}` : '/api/users'
    const method = editingId ? 'PUT' : 'POST'
    
    const body = new FormData()
    body.append('nome', nome)
    body.append('login', login)
    body.append('role', role)
    body.append('email', email)
    body.append('codOperador', codOperador)
    body.append('ativo', String(ativo))
    if (isAdmin && role === 'ESTOQUISTA') body.append('modoEstoque', modoEstoque)
    if (senha || !editingId) {
      body.append('senha', senha)
    }
    if (fotoFile) body.append('foto', fotoFile)
    else if (foto !== null) body.append('foto', foto)
    if (canAssignPermissions) {
      // Campos repetidos chegam como array no multipart. Dois marcadores garantem
      // esse formato até quando nenhuma permissão estiver selecionada; o backend
      // descarta valores que não pertencem ao catálogo.
      body.append('permissions', '__empty__')
      body.append('permissions', '__empty__')
      selectedPermissions.forEach(permission => body.append('permissions', permission))
    }

    setSaving(true)
    try {
      await apiFetch<{ user: User }>(url, {
        method,
        body,
      })
      await Promise.all([usersQuery.refetch(), queryClient.invalidateQueries({ queryKey: ['users-resumo'] })])
      showToast(editingId ? 'Usuário atualizado!' : 'Usuário criado!', 'success')
      resetForm()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao salvar usuário', 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setNome('')
    setLogin('')
    setEmail('')
    setCodOperador('')
    setAtivo(true)
    setFoto(null)
    setFotoFile(null)
    setSenha('')
    setRole('GARCOM')
    setModoEstoque('COMPLETO')
    setSelectedPermissions(permissionSchema?.roleDefaults.GARCOM ?? [])
    setEditingId(null)
    setIsCreating(false)
    setExpandedPermissionGroups(new Set())
  }

  const handleEdit = (user: User) => {
    setEditingId(user.id)
    setIsCreating(true)
    setNome(user.nome)
    setLogin(user.login)
    setEmail(user.email ?? '')
    setCodOperador(user.codOperador ? String(user.codOperador) : '')
    setAtivo(user.ativo)
    setFoto(user.foto)
    setFotoFile(null)
    setRole(user.role)
    setModoEstoque(user.modoEstoque ?? 'COMPLETO')
    setSelectedPermissions(user.permissions)
    setSenha('')
  }

  const handleCreate = () => {
    setSelectedPermissions(permissionSchema?.roleDefaults.GARCOM ?? [])
    setIsCreating(true)
  }

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole)
    if (nextRole !== 'ESTOQUISTA') setModoEstoque('COMPLETO')
    setSelectedPermissions(permissionSchema?.roleDefaults[nextRole] ?? [])
  }

  const togglePermission = (permission: string) => {
    setSelectedPermissions(current => current.includes(permission)
      ? current.filter(item => item !== permission)
      : [...current, permission]
    )
  }

  const togglePermissionGroup = (group: PermissionGroup) => {
    const groupIds = group.items.map(item => item.id)
    const allSelected = groupIds.every(permission => selectedPermissions.includes(permission))
    setSelectedPermissions(current => allSelected
      ? current.filter(permission => !groupIds.includes(permission))
      : [...new Set([...current, ...groupIds])]
    )
  }

  const togglePermissionGroupExpanded = (groupId: string) => {
    setExpandedPermissionGroups(current => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: 'DELETE' })
      await Promise.all([usersQuery.refetch(), queryClient.invalidateQueries({ queryKey: ['users-resumo'] })])
      showToast('Usuário desativado com sucesso!', 'success')
      setDeleteTarget(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao excluir usuário', 'error')
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Carregando...</div>

  if (isCreating || editingId) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={resetForm} aria-label="Voltar para usuários" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100">
                <ArrowLeft size={19} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-slate-950">{editingId ? `Editar ${nome || 'usuário'}` : 'Novo usuário'}</h1>
                <p className="mt-0.5 text-sm text-slate-500">Dados de acesso e responsabilidades no sistema.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" isLoading={saving}><Save size={17} className="mr-2" />Salvar alterações</Button>
            </div>
          </header>

          <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
                <UserRound size={20} className="text-orange-600" />
                <div><h2 className="font-bold text-slate-900">Identificação</h2><p className="text-sm text-slate-500">Informações usadas para reconhecer o operador.</p></div>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-[160px_1fr]">
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="Prévia do usuário" className="mb-3 h-20 w-20 rounded-full object-cover" />
                  ) : (
                    <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-2xl font-bold text-orange-700">{nome.charAt(0).toUpperCase() || '?'}</div>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 hover:text-orange-700">
                    <Camera size={16} /> Alterar foto
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] ?? null; setFotoFile(file); if (file) setFoto(URL.createObjectURL(file)) }} />
                  </label>
                </div>
                <div className="grid content-start gap-4 md:grid-cols-2">
                  <Input label="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} required />
                  <Input label="Login" value={login} onChange={(e) => setLogin(e.target.value)} required />
                  <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input label="Código de operador" type="number" value={codOperador} onChange={(e) => setCodOperador(e.target.value)} placeholder="Gerado automaticamente" />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
                <KeyRound size={20} className="text-orange-600" />
                <div><h2 className="font-bold text-slate-900">Acesso</h2><p className="text-sm text-slate-500">Perfil, senha e disponibilidade para login.</p></div>
              </div>
              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Cargo / Perfil</label>
                  <select value={role} onChange={(e) => handleRoleChange(e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="GARCOM">Garçom</option><option value="ATENDENTE">Atendente</option><option value="COZINHA">Cozinha</option><option value="ESTOQUISTA">Estoquista</option><option value="CAIXA">Caixa</option><option value="GERENTE">Gerente</option>
                    {isAdmin && <option value="DONO">Dono</option>}{isAdmin && <option value="ADMIN">Administrador</option>}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Senha {editingId && <span className="font-normal text-slate-500">(opcional na edição)</span>}</label>
                  <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required={!editingId} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <Switch
                  checked={ativo}
                  onCheckedChange={setAtivo}
                  label="Usuário ativo"
                  description="Permite entrar e operar o sistema."
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2"
                />
                {isAdmin && role === 'ESTOQUISTA' && (
                  <fieldset className="rounded-lg border border-orange-200 bg-orange-50/60 p-4 md:col-span-2">
                    <legend className="px-1 text-sm font-bold text-slate-900">Tela de estoque</legend>
                    <p className="mb-3 text-sm text-slate-600">Escolha como este estoquista vai registrar o trabalho.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {([
                        { value: 'COMPLETO', title: 'Tela completa', description: 'Acesso ao painel, cadastros e movimentações diretas.' },
                        { value: 'SIMPLIFICADO', title: 'Registro simplificado', description: 'Cria lotes para o administrador revisar e lançar.' },
                      ] as const).map(option => (
                        <label key={option.value} className={`cursor-pointer rounded-lg border p-3 ${modoEstoque === option.value ? 'border-orange-500 bg-white ring-2 ring-orange-100' : 'border-slate-200 bg-white'}`}>
                          <span className="flex items-start gap-3">
                            <input type="radio" name="modoEstoque" value={option.value} checked={modoEstoque === option.value} onChange={() => setModoEstoque(option.value)} className="mt-1 accent-orange-600" />
                            <span><strong className="block text-sm text-slate-900">{option.title}</strong><span className="mt-0.5 block text-xs leading-5 text-slate-600">{option.description}</span></span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>
            </section>

            {canAssignPermissions && permissionSchema && (
              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 text-orange-600" /><div><h2 className="font-bold text-slate-900">Permissões individuais</h2><p className="text-sm text-slate-500">{selectedPermissions.length} de {permissionSchema.allPermissions.length} selecionadas.</p></div></div>
                  <button type="button" onClick={() => setSelectedPermissions(permissionSchema.roleDefaults[role] ?? [])} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Restaurar padrão de {ROLE_LABELS[role] ?? role}</button>
                </div>
                <div className="divide-y divide-slate-200">
                  {permissionSchema.groups.map(group => {
                    const groupIds = group.items.map(item => item.id)
                    const selectedCount = groupIds.filter(permission => selectedPermissions.includes(permission)).length
                    const allSelected = selectedCount === groupIds.length
                    const expanded = expandedPermissionGroups.has(group.group)
                    return (
                      <div key={group.group}>
                        <div className="flex min-h-14 items-center gap-3 px-5 py-2">
                          <button type="button" onClick={() => togglePermissionGroupExpanded(group.group)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <ChevronDown size={17} className={`shrink-0 text-slate-500 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{group.label}</span>
                            <span className="text-xs font-medium text-slate-500">{selectedCount}/{groupIds.length}</span>
                          </button>
                          <button type="button" onClick={() => togglePermissionGroup(group)} className={`h-8 rounded-md border px-3 text-xs font-semibold ${allSelected ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}>{allSelected ? 'Remover grupo' : 'Selecionar grupo'}</button>
                        </div>
                        {expanded && <div className="grid border-t border-slate-100 bg-slate-50 px-5 py-3 sm:grid-cols-2 lg:grid-cols-3">{group.items.map(permission => (
                          <label key={permission.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-white"><input type="checkbox" checked={selectedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} className="h-4 w-4 accent-orange-600" /><span>{permission.label}</span></label>
                        ))}</div>}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 py-4 backdrop-blur-sm"><Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button><Button type="submit" isLoading={saving}><Save size={17} className="mr-2" />Salvar alterações</Button></div>
          </div>
        </form>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-bold text-slate-950">Usuários</h1><p className="mt-1 text-sm text-slate-500">Equipe, acesso e permissões em um só lugar.</p></div>
          {canCreateUsers && <Button onClick={handleCreate}><Plus size={18} className="mr-2" />Novo usuário</Button>}
        </header>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2"><UserRound size={18} className="text-slate-500" /><span className="text-sm text-slate-500">Total</span><strong className="text-lg text-slate-950">{resumoQuery.data?.total ?? '—'}</strong></div>
          <div className="flex items-center gap-2"><UserCheck size={18} className="text-emerald-600" /><span className="text-sm text-slate-500">Ativos</span><strong className="text-lg text-slate-950">{resumoQuery.data?.ativos ?? '—'}</strong></div>
          <div className="flex items-center gap-2"><UserX size={18} className="text-red-500" /><span className="text-sm text-slate-500">Inativos</span><strong className="text-lg text-slate-950">{resumoQuery.data?.inativos ?? '—'}</strong></div>
        </div>

        {usersQuery.isError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{usersQuery.error.message}</div>}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <label htmlFor="usuarios-page-size" className="whitespace-nowrap">Exibir</label>
            <select
              id="usuarios-page-size"
              value={lista.pageSize}
              onChange={(event) => lista.setPageSize(Number(event.target.value))}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            >
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <span className="whitespace-nowrap">resultados por página</span>
          </div>

          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-100">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={lista.search}
                onChange={(event) => lista.definirBusca(event.target.value)}
                placeholder="Pesquisar..."
                aria-label="Pesquisar usuários"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </label>
            <div className="grid grid-cols-3 rounded-lg bg-slate-200 p-1">
              {(['TODOS', 'ATIVOS', 'INATIVOS'] as const).map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => { setStatusFilter(filter); lista.reiniciarPagina() }}
                  className={`h-8 rounded-md px-3 text-xs font-semibold ${statusFilter === filter ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {filter === 'TODOS' ? 'Todos' : filter === 'ATIVOS' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section aria-label="Lista de usuários">
          {usersQuery.isLoading ? (
            <div className="flex flex-wrap items-start gap-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[94px] w-full rounded-lg sm:w-[250px]" />)}
            </div>
          ) : pagina.data.length > 0 ? (
            <div className={`transition-opacity ${usersQuery.isFetching ? 'opacity-60' : 'opacity-100'} flex flex-wrap items-start gap-2`}>
              {pagina.data.map(user => (
                <article key={user.id} className="relative w-full min-w-0 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 hover:shadow-sm sm:w-[250px]">
                  <div className="flex min-w-0 items-center gap-2.5 pr-16">
                    {user.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.foto} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{user.nome.charAt(0).toUpperCase()}</div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-slate-950">{user.nome}</h2>
                      <p className="truncate text-xs text-slate-500">@{user.login}{user.email ? ` · ${user.email}` : ''}</p>
                    </div>
                  </div>

                  <dl className="mt-2 flex min-w-0 items-center gap-2 border-t border-slate-100 pt-2 text-xs">
                    <div className="min-w-0"><dt className="sr-only">Perfil</dt><dd className="truncate font-semibold text-slate-700">{ROLE_LABELS[user.role] ?? user.role}</dd></div>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <div className="min-w-0"><dt className="sr-only">Operador</dt><dd className="truncate text-slate-500">Op. {user.codOperador ?? 'automático'}</dd></div>
                    <div className="ml-auto shrink-0"><dt className="sr-only">Status</dt><dd className={`inline-flex items-center gap-1 font-semibold ${user.ativo ? 'text-emerald-700' : 'text-red-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${user.ativo ? 'bg-emerald-500' : 'bg-red-500'}`} />{user.ativo ? 'Ativo' : 'Inativo'}</dd></div>
                  </dl>

                  <div className="absolute right-2 top-2 flex items-center">
                    {canEditUsers && canManage(user) && <Button variant="ghost" size="icon" title="Editar usuário" aria-label="Editar usuário" className="h-8 w-8" onClick={() => handleEdit(user)}><Edit size={15} /></Button>}
                    {canDeleteUsers && canManage(user) && user.id !== actor?.id && <Button variant="ghost" size="icon" title="Desativar usuário" aria-label="Desativar usuário" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(user)}><Trash2 size={15} /></Button>}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center"><UserRound size={28} className="mx-auto mb-3 text-slate-300" /><p className="font-semibold text-slate-700">Nenhum usuário encontrado</p><p className="mt-1 text-sm text-slate-500">Altere a busca ou o filtro de situação.</p></div>
          )}

          <Pagination meta={pagina.meta} onPageChange={lista.setPage} disabled={usersQuery.isFetching} itemLabel="usuários" className="mt-3 rounded-lg border border-slate-200 bg-white" />
        </section>

        <ConfirmationModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Desativar usuário?" description={`O usuário ${deleteTarget?.nome ?? ''} não conseguirá mais fazer login, mas o histórico será preservado.`} confirmText="Desativar" variant="danger" />
      </div>
    </main>
  )
}
