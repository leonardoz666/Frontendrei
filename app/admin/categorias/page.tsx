'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Categoria = {
  id: number
  nome: string
  setor: string
}

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // Form states
  const [nome, setNome] = useState('')
  const [setor, setSetor] = useState('COZINHA')
  const [error, setError] = useState('')

  const router = useRouter()

  const fetchCategorias = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Erro ao buscar categorias')
      const data = await res.json()
      setCategorias(data)
    } catch (err) {
      console.error(err)
      setError('Falha ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchCategorias()
  }, [fetchCategorias])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const url = editingId ? `/api/categories/${editingId}` : '/api/categories'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, setor })
      })

      if (!res.ok) throw new Error('Erro ao salvar categoria')

      // Reset form
      setNome('')
      setSetor('COZINHA')
      setEditingId(null)
      fetchCategorias()
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar categoria')
    }
  }

  const handleEdit = (cat: Categoria) => {
    setEditingId(cat.id)
    setNome(cat.nome)
    setSetor(cat.setor)
    setError('')
  }

  const handleCancel = () => {
    setEditingId(null)
    setNome('')
    setSetor('COZINHA')
    setError('')
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return

    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir')
      fetchCategorias()
    } catch (err) {
      console.error(err)
      setError('Erro ao excluir categoria')
    }
  }

  if (loading) return <div className="p-8">Carregando...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-black">Gerenciar Categorias</h1>

      {/* Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-black">
          {editingId ? 'Editar Categoria' : 'Nova Categoria'}
        </h2>
        
        <form onSubmit={handleSubmit} className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-black mb-1">Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none text-black"
              required
            />
          </div>
          
          <div className="w-40">
            <label className="block text-sm font-medium text-black mb-1">Setor</label>
            <select
              value={setor}
              onChange={(e) => setSetor(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-orange-500 outline-none text-black"
            >
              <option value="COZINHA">Cozinha</option>
              <option value="BAR">Bar</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
            >
              {editingId ? 'Salvar' : 'Adicionar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-4 border-b font-medium text-black">Nome</th>
              <th className="p-4 border-b font-medium text-black">Setor</th>
              <th className="p-4 border-b font-medium text-black text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((cat) => (
              <tr key={cat.id} className="hover:bg-gray-50 border-b last:border-0">
                <td className="p-4 text-black">{cat.nome}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    cat.setor === 'COZINHA' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {cat.setor}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => handleEdit(cat)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {categorias.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-black">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
