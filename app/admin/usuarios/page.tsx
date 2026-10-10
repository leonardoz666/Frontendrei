'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Switch } from '@/app/components/ui/Switch'
import { usePagedQuery } from '@/app/lib/pagination'
import { paginaAtual, SeloAtivo, useListaCrud } from '@/app/lib/crud-client'
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  KeyRound,
  Plus,
  Save,
  ShieldCheck,
  UserCheck,
  UserRound,
  UserX,
} from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { apiFetch } from '@/app/lib/api'

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
          router.replace('/login')
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
    setSelectedPermissions(user.permissions)
    setSenha('')
  }

  const handleCreate = () => {
    setSelectedPermissions(permissionSchema?.roleDefaults.GARCOM ?? [])
    setIsCreating(true)
  }

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole)
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

  const columns: Array<DataTableColumn<User>> = [
    {
      key: 'nome',
      header: 'Usuário',
      sortKey: 'nome',
      render: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          {user.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-700">
              {user.nome.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950">{user.nome}</span>
            <span className="block truncate text-xs text-slate-500">@{user.login}{user.email ? ` · ${user.email}` : ''}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Perfil',
      sortKey: 'role',
      render: (user) => ROLE_LABELS[user.role] ?? user.role,
    },
    {
      key: 'codOperador',
      header: 'Operador',
      sortKey: 'codOperador',
      hideOnMobile: true,
      render: (user) => user.codOperador ?? 'Automático',
    },
    {
      key: 'ativo',
      header: 'Situação',
      sortKey: 'ativo',
      align: 'center',
      render: (user) => <SeloAtivo ativo={user.ativo} />,
    },
  ]

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

        <DataTable<User>
          columns={columns}
          data={pagina.data}
          getRowId={(user) => user.id}
          meta={pagina.meta}
          loading={usersQuery.isLoading || usersQuery.isFetching}
          storageKey="admin-usuarios"
          itemLabel="usuários"
          emptyMessage="Nenhum usuário encontrado"
          emptyHint="Altere a busca ou o filtro de situação."
          toolbar={<div className="grid grid-cols-3 rounded-lg bg-slate-200 p-1">{(['TODOS', 'ATIVOS', 'INATIVOS'] as const).map(filter => <button key={filter} type="button" onClick={() => { setStatusFilter(filter); lista.reiniciarPagina() }} className={`h-8 rounded-md px-3 text-xs font-semibold ${statusFilter === filter ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{filter === 'TODOS' ? 'Todos' : filter === 'ATIVOS' ? 'Ativos' : 'Inativos'}</button>)}</div>}
          rowActions={{
            onEdit: handleEdit,
            onDelete: setDeleteTarget,
            editLabel: 'Editar usuário',
            deleteLabel: 'Desativar usuário',
            canEdit: (user) => canEditUsers && canManage(user),
            canDelete: (user) => canDeleteUsers && canManage(user) && user.id !== actor?.id,
          }}
          onPageChange={lista.setPage}
          onPageSizeChange={lista.setPageSize}
          onSearch={lista.definirBusca}
          onSort={lista.definirOrdenacao}
          ariaLabel="Lista de usuários"
        />

        <ConfirmationModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Desativar usuário?" description={`O usuário ${deleteTarget?.nome ?? ''} não conseguirá mais fazer login, mas o histórico será preservado.`} confirmText="Desativar" variant="danger" />
      </div>
    </main>
  )
}
