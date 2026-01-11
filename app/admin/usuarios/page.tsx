'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Plus, Search, Edit, Trash2, User as UserIcon, Shield, X, Save } from 'lucide-react'

interface User {
  id: number
  nome: string
  login: string
  role: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form states
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [role, setRole] = useState('GARCOM')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  
  const [error, setError] = useState('')
  const [, setSuccess] = useState('')
  const router = useRouter()

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (res.status === 403) {
        router.replace('/')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showToast(data.error || 'Erro ao carregar usuários', 'error')
        return
      }
      const data = await res.json()
      setUsers(data)
    } catch {
      showToast('Erro ao conectar com o servidor', 'error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const run = async () => {
      const meRes = await fetch('/api/auth/me')
      const meData = await meRes.json()
      if (!meData.user) {
        router.replace('/login')
        return
      }
      if (meData.user.role !== 'DONO' && meData.user.role !== 'ADMIN') {
        router.replace('/')
        return
      }
      await fetchUsers()
    }

    run()
  }, [fetchUsers, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const url = editingId ? `/api/users/${editingId}` : '/api/users'
    const method = editingId ? 'PUT' : 'POST'
    
    const body: { nome: string; login: string; role: string; senha?: string } = { nome, login, role }
    if (senha || !editingId) {
      body.senha = senha
    }

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        setUsers(editingId 
          ? users.map(u => u.id === editingId ? data.user : u)
          : [...users, data.user]
        )

        showToast(editingId ? 'Usuário atualizado!' : 'Usuário criado!', 'success')
        resetForm()
      } else {
        showToast(data.error || 'Erro ao salvar usuário', 'error')
      }
    } catch {
      showToast('Erro ao conectar com o servidor', 'error')
    }
  }

  const resetForm = () => {
    setNome('')
    setLogin('')
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
    setRole(user.role)
    setSenha('')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return

    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(users.filter(u => u.id !== id))
      showToast('Usuário excluído com sucesso!', 'success')
    } else {
      const data = await res.json()
      showToast(data.error || 'Erro ao excluir usuário', 'error')
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
                  <option value="CAIXA">Caixa</option>
                  <option value="GERENTE">Gerente</option>
                  <option value="DONO">Dono</option>
                  <option value="ADMIN">Admin</option>
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
        <Button onClick={() => setIsCreating(true)}>
          <Plus size={18} className="mr-2" /> Novo Usuário
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg">
                  {user.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{user.nome}</h3>
                  <p className="text-sm text-gray-500 mb-1">@{user.login}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                    {user.role}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(user)}>
                  <Edit size={16} className="text-gray-400 hover:text-blue-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(user.id)}>
                  <Trash2 size={16} className="text-gray-400 hover:text-red-600" />
                </Button>
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
    </div>
  )
}
