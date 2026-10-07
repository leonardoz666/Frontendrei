'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Plus, Edit, Trash2, Save, X, Check } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { ApiError, apiFetch } from '@/app/lib/api'

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
}

export default function AdminUsersPage() {
  const { showToast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [actor, setActor] = useState<{ id: number; role: string; permissions: string[] } | null>(null)
  
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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  
  const [error, setError] = useState('')
  const [, setSuccess] = useState('')
  const router = useRouter()

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch<User[]>('/users')
      setUsers(data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) router.replace('/login')
      else if (error instanceof ApiError && error.status === 403) router.replace('/')
      else showToast(error instanceof Error ? error.message : 'Erro ao carregar usuários', 'error')
    } finally {
      setLoading(false)
    }
  }, [router, showToast])

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
        await fetchUsers()
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Erro ao carregar sessão', 'error')
        setLoading(false)
      }
    }

    run()
  }, [fetchUsers, router, showToast])

  const isAdmin = actor?.role === 'DONO' || actor?.role === 'ADMIN'
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

    try {
      const data = await apiFetch<{ user: User }>(url, {
        method,
        body,
      })
      setUsers(editingId
        ? users.map(u => u.id === editingId ? data.user : u)
        : [...users, data.user]
      )
      showToast(editingId ? 'Usuário atualizado!' : 'Usuário criado!', 'success')
      resetForm()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao salvar usuário', 'error')
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
    setEditingId(null)
    setIsCreating(false)
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
    setSenha('')
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: 'DELETE' })
      setUsers(users.map(u => u.id === deleteTarget.id ? { ...u, ativo: false } : u))
      showToast('Usuário desativado com sucesso!', 'success')
      setDeleteTarget(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao excluir usuário', 'error')
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-500">Carregando...</div>

  // Create/Edit View
  if (isCreating || editingId) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h1>
          <Button variant="outline" onClick={resetForm}><X size={18} className="mr-2"/> Cancelar</Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Nome Completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
              <Input
                label="Login (Usuário)"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  label="Código de operador"
                  type="number"
                  value={codOperador}
                  onChange={(e) => setCodOperador(e.target.value)}
                  placeholder="Automático se vazio"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Foto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    setFotoFile(file)
                    if (file) setFoto(URL.createObjectURL(file))
                  }}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setAtivo(!ativo)}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left"
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded border ${ativo ? 'border-green-600 bg-green-600' : 'border-gray-400 bg-white'}`}>
                  {ativo && <Check size={14} className="text-white" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-800">Usuário ativo</span>
                  <span className="block text-xs text-gray-500">Usuários inativos não conseguem fazer login.</span>
                </span>
              </button>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Senha {editingId && <span className="font-normal text-gray-500">(deixe em branco para manter)</span>}
                </label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required={!editingId}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo / Permissão</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="GARCOM">Garçom</option>
                  <option value="ATENDENTE">Atendente</option>
                  <option value="COZINHA">Cozinha</option>
                  <option value="CAIXA">Caixa</option>
                  <option value="GERENTE">Gerente</option>
                  {isAdmin && <option value="DONO">Dono</option>}
                  {isAdmin && <option value="ADMIN">Admin</option>}
                </select>
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md">{error}</div>}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
                <Button type="submit"><Save size={18} className="mr-2" /> Salvar Usuário</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // List View
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Usuários</h1>
          <p className="text-gray-500 mt-1">Gerencie o acesso ao sistema</p>
        </div>
        {(isAdmin || actor?.permissions.includes('usuarios.criar')) && <Button onClick={() => setIsCreating(true)}>
          <Plus size={18} className="mr-2" /> Novo Usuário
        </Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {user.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.foto} alt={user.nome} className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg">
                    {user.nome.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{user.nome}</h3>
                  <p className="text-sm text-gray-500 mb-1">@{user.login}</p>
                  <p className="text-xs text-gray-500 mb-2">Operador {user.codOperador ?? '-'}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    {user.role}
                  </span>
                  {!user.ativo && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                      Inativo
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {(isAdmin || actor?.permissions.includes('usuarios.editar')) && canManage(user) && <Button variant="ghost" size="icon" title="Editar usuário" className="h-8 w-8" onClick={() => handleEdit(user)}>
                  <Edit size={16} className="text-gray-400 hover:text-blue-600" />
                </Button>}
                {isAdmin && user.id !== actor?.id && actor?.permissions.includes('usuarios.excluir') && <Button variant="ghost" size="icon" title="Desativar usuário" className="h-8 w-8" onClick={() => setDeleteTarget(user)}>
                  <Trash2 size={16} className="text-gray-400 hover:text-red-600" />
                </Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {users.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhum usuário encontrado.
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Desativar usuário?"
        description={`O usuário ${deleteTarget?.nome ?? ''} não conseguirá mais fazer login, mas o histórico será preservado.`}
        confirmText="Desativar"
        variant="danger"
      />
    </div>
  )
}
