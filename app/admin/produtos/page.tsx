'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Trash2, 
  Upload, 
  X, 
  Pencil, 
  ImageIcon, 
  Wine, 
  Pizza, 
  Utensils, 
  Download,
  Wand2
} from 'lucide-react'
import { clsx } from 'clsx'

type Categoria = {
  id: number
  nome: string
}

type Produto = {
  id: number
  nome: string
  preco: number
  ativo: boolean
  categoriaId: number | null
  categoria?: Categoria
  foto?: string
  tipoOpcao?: 'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'
  sabores?: string // JSON string
  isDrink?: boolean
  isFood?: boolean
  favorito?: boolean
  ultimoUso?: string
}

export default function ProdutosPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  
  // Queries
  const { data: produtos = [], isLoading: loadingProd } = useQuery<Produto[]>({
    queryKey: ['products'],
    queryFn: async () => {
      console.log('[DEBUG] fetching products');
      const res = await fetch('/api/products')
      console.log(`[DEBUG] products status: ${res.status}`);
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Unauthorized')
      }
      if (!res.ok) {
        console.error(`[DEBUG] products fetch failed: ${res.status}`);
        throw new Error('Erro ao buscar produtos')
      }
      return res.json()
    }
  })

  const { data: categorias = [], isLoading: loadingCat } = useQuery<Categoria[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      console.log('[DEBUG] fetching categories');
      const res = await fetch('/api/categories')
      console.log(`[DEBUG] categories status: ${res.status}`);
      if (res.status === 401) {
        router.push('/login')
        throw new Error('Unauthorized')
      }
      if (!res.ok) {
        console.error(`[DEBUG] categories fetch failed: ${res.status}`);
        throw new Error('Erro ao buscar categorias')
      }
      return res.json()
    }
  })

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [fixStatus, setFixStatus] = useState<string | null>(null)
  
  const handleFixSectors = async () => {
    if (!confirm('Deseja corrigir automaticamente os setores (Cozinha/Bar) de todos os produtos baseados na categoria?')) return

    setFixStatus('Iniciando correção...')
    let updated = 0
    let failed = 0

    for (const p of produtos) {
        if (!p.categoria) continue
        
        let shouldBeDrink = false
        let shouldBeFood = false
        const catNome = p.categoria.nome.toLowerCase()
        
        if (catNome.includes('bebida') || catNome.includes('drink') || catNome.includes('cerveja') || catNome.includes('refrigerante') || catNome.includes('suco') || catNome.includes('água') || catNome.includes('vinho') || catNome.includes('dose') || catNome.includes('bar')) {
            shouldBeDrink = true
            shouldBeFood = false
        } else if (catNome.includes('prato') || catNome.includes('entrada') || catNome.includes('comida') || catNome.includes('lanche') || catNome.includes('sobremesa') || catNome.includes('porção') || catNome.includes('petisco') || catNome.includes('hambúrguer') || catNome.includes('pizza') || catNome.includes('salada') || catNome.includes('cozinha')) {
            shouldBeFood = true
            shouldBeDrink = false
        } else {
            continue
        }

        if (p.isDrink === shouldBeDrink && p.isFood === shouldBeFood) continue

        try {
            const formData = new FormData()
            formData.append('nome', p.nome)
            formData.append('preco', String(p.preco))
            if (p.categoriaId) formData.append('categoriaId', String(p.categoriaId))
            formData.append('ativo', String(p.ativo))
            if (p.foto) formData.append('foto', p.foto)
            formData.append('tipoOpcao', p.tipoOpcao || 'padrao')
            formData.append('sabores', p.sabores || '[]')
            formData.append('isDrink', String(shouldBeDrink))
            formData.append('isFood', String(shouldBeFood))
            formData.append('favorito', String(!!p.favorito))

            const res = await fetch(`/api/products/${p.id}`, {
                method: 'PUT',
                body: formData
            })

            if (res.ok) {
                updated++
            } else {
                failed++
            }
        } catch (e) {
            console.error(e)
            failed++
        }
    }
    
    setFixStatus(`Correção concluída: ${updated} atualizados, ${failed} falhas`)
    queryClient.invalidateQueries({ queryKey: ['products'] })
    setTimeout(() => setFixStatus(null), 5000)
  }

  // Form States
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [foto, setFoto] = useState<string | undefined>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [tipoOpcao, setTipoOpcao] = useState<'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'>('padrao')
  const [sabores, setSabores] = useState<string[]>([])
  const [newSabor, setNewSabor] = useState('')
  const [isDrink, setIsDrink] = useState(false)
  const [isFood, setIsFood] = useState(true)
  const [favorito, setFavorito] = useState(false)

  const [error, setError] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Effect to set default category
  useEffect(() => {
    if (categorias.length > 0 && !categoriaId && !editingId) {
      setCategoriaId(categorias[0].id.toString())
    }
  }, [categorias, categoriaId, editingId])

  const filteredProdutos = produtos.filter(p => {
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return normalize(p.nome).includes(normalize(searchTerm))
  })

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setFoto(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddSabor = (e: React.FormEvent) => {
    e.preventDefault()
    if (newSabor && !sabores.includes(newSabor)) {
      setSabores([...sabores, newSabor])
      setNewSabor('')
    }
  }

  const handleRemoveSabor = (saborToRemove: string) => {
    setSabores(sabores.filter(s => s !== saborToRemove))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!nome) return

    try {
      const url = editingId ? `/api/products/${editingId}` : '/api/products'
      const method = editingId ? 'PUT' : 'POST'

      const formData = new FormData()
      formData.append('nome', nome)
      formData.append('preco', preco || '0')
      if (categoriaId) formData.append('categoriaId', categoriaId)
      formData.append('ativo', String(ativo))
      if (file) formData.append('foto', file)
      formData.append('tipoOpcao', tipoOpcao)
      formData.append('sabores', JSON.stringify(sabores))
      formData.append('isDrink', String(isDrink))
      formData.append('isFood', String(isFood))
      formData.append('favorito', String(favorito))

      const res = await fetch(url, {
        method,
        body: formData
      })

      if (!res.ok) throw new Error('Erro ao salvar produto')

      resetForm()
      queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar produto')
    }
  }

  const resetForm = () => {
    setNome('')
    setPreco('')
    setAtivo(true)
    setEditingId(null)
    setIsAdding(false)
    setFoto(undefined)
    setFile(null)
    setTipoOpcao('padrao')
    setSabores([])
    setNewSabor('')
    setIsDrink(false)
    setIsFood(true)
    setFavorito(false)
    setError('')
    if (categorias.length > 0) setCategoriaId(categorias[0].id.toString())
  }

  const handleEdit = (prod: Produto) => {
    setEditingId(prod.id)
    setIsAdding(true)
    setNome(prod.nome)
    setPreco(prod.preco.toString())
    setCategoriaId(prod.categoriaId ? prod.categoriaId.toString() : (categorias[0]?.id.toString() || ''))
    setAtivo(prod.ativo)
    setFoto(prod.foto)
    setTipoOpcao(prod.tipoOpcao as any || 'padrao')
    
    let parsedSabores: string[] = []
    try {
      if (prod.sabores) {
        parsedSabores = JSON.parse(prod.sabores)
      }
    } catch (e) {
      console.error('Error parsing sabores', e)
    }
    setSabores(parsedSabores)
    
    setIsDrink(prod.isDrink || false)
    setIsFood(prod.isFood !== undefined ? prod.isFood : true)
    setFavorito(prod.favorito || false)
    setError('')
  }

  const confirmDelete = async () => {
    if (deleteConfirmationId) {
      try {
        const res = await fetch(`/api/products/${deleteConfirmationId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Erro ao excluir')
        queryClient.invalidateQueries({ queryKey: ['products'] })
        setDeleteConfirmationId(null)
      } catch (err) {
        console.error(err)
        alert('Erro ao excluir produto')
      }
    }
  }

  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: produtos.map(p => ({
        ...p,
        sabores: p.sabores ? JSON.parse(p.sabores) : undefined
      }))
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cardapio.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setImportStatus('Lendo arquivo...')
      const text = await file.text()
      const json = JSON.parse(text)
      const items: any[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : []
      
      if (!items.length) {
        setImportStatus('Arquivo inválido ou vazio')
        return
      }

      let added = 0
      let updated = 0
      let failed = 0

      for (const i of items) {
        try {
          const existing = produtos.find(p => p.nome.toLowerCase() === i.nome.toLowerCase())
          
          const formData = new FormData()
          formData.append('nome', i.nome)
          
          let price = 0
          if (typeof i.preco === 'number') {
            price = i.preco
          } else if (typeof i.preco === 'string') {
            price = parseFloat(i.preco.replace(',', '.')) || 0
          }
          formData.append('preco', String(price))

          if (categoriaId) formData.append('categoriaId', categoriaId)
          formData.append('ativo', 'true')
          if (i.foto) formData.append('foto', i.foto) // Note: Base64 might need handling on server if direct string
          formData.append('tipoOpcao', i.tipoOpcao || (i.temOpcaoTamanho ? 'tamanho_pg' : 'padrao'))
          
          const saboresJson = i.sabores ? JSON.stringify(i.sabores) : '[]'
          formData.append('sabores', saboresJson)
          
          formData.append('isDrink', String(!!i.isDrink))
          formData.append('isFood', String(i.isFood !== undefined ? i.isFood : true))
          formData.append('favorito', String(!!i.favorito))

          const url = existing ? `/api/products/${existing.id}` : '/api/products'
          const method = existing ? 'PUT' : 'POST'

          const res = await fetch(url, {
            method,
            body: formData
          })

          if (res.ok) {
            existing ? updated++ : added++
          } else {
            failed++
          }
        } catch (e) {
          console.error(e)
          failed++
        }
      }

      setImportStatus(`Importação concluída: ${added} adicionados, ${updated} atualizados, ${failed} falhas`)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      e.target.value = '' 
    } catch (err) {
      console.error(err)
      setImportStatus('Falha ao importar arquivo')
    }
  }

  if (loadingProd || loadingCat) return <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-500">Carregando...</div>

  return (
    <div className="min-h-screen pb-32 bg-gray-50 relative">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 z-40 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/')} className="p-2 -ml-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Gerenciar Cardápio</h1>
          <div className="w-10" /> 
        </div>

        {/* Search & Add */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-gray-100 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm placeholder:text-gray-500"
            />
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-blue-600 text-white font-bold p-2.5 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20 active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={handleFixSectors}
            title="Auto-corrigir setores (Cozinha/Bar)"
            className="bg-white text-gray-700 font-bold p-2.5 rounded-xl flex items-center justify-center border border-gray-200 hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <Wand2 size={18} />
          </button>
          <button
            onClick={handleExport}
            title="Exportar cardápio (JSON)"
            className="bg-white text-gray-700 font-bold p-2.5 rounded-xl flex items-center justify-center border border-gray-200 hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            title="Importar cardápio (JSON)"
            className="bg-white text-gray-700 font-bold p-2.5 rounded-xl flex items-center justify-center border border-gray-200 hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <Upload size={18} />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </div>
      </header>

      {(importStatus || fixStatus) && (
        <div className="px-4">
          <div className="mt-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-2">
            {importStatus || fixStatus}
          </div>
        </div>
      )}

      {/* Product List - UPDATED GRID (Smaller items) */}
      <div className="p-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
        {filteredProdutos.map((prod, idx) => (
          <div 
            key={prod.id} 
            style={{ animationDelay: `${idx * 50}ms` }}
            className="group relative flex flex-col bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-all duration-300 animate-in fade-in zoom-in-50 fill-mode-backwards shadow-sm"
          >
            {/* Image Area */}
            <div 
              onClick={() => handleEdit(prod)}
              className="aspect-square w-full bg-gray-100 relative overflow-hidden cursor-pointer"
            >
              {prod.foto ? (
                <img 
                  src={prod.foto} 
                  alt={prod.nome} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                  <ImageIcon size={24} strokeWidth={1.5} />
                </div>
              )}
              
              {/* Type Badge - Smaller */}
              {(prod.isDrink || prod.isFood) && (
                <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-md p-1 rounded-md border border-white/10 shadow-lg">
                  {prod.isDrink ? (
                    <Wine size={12} className="text-purple-400" />
                  ) : (
                    <Utensils size={12} className="text-orange-400" />
                  )}
                </div>
              )}

              {/* Delete Button (Floating) */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirmationId(prod.id)
                }}
                className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/80 backdrop-blur-md text-white rounded-md hover:bg-red-500 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-y-0 md:translate-y-2 md:group-hover:translate-y-0 duration-200 shadow-lg"
              >
                <Trash2 size={12} />
              </button>

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>

            {/* Content */}
            <div 
              onClick={() => handleEdit(prod)}
              className="p-2 pt-1.5 relative cursor-pointer"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="font-bold text-[10px] sm:text-xs leading-tight text-gray-800 line-clamp-2">{prod.nome}</span>
              </div>
              
              <div className="mt-1.5 flex flex-wrap gap-1">
                {prod.tipoOpcao !== 'padrao' && (
                  <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 leading-none">
                    {prod.tipoOpcao === 'refrigerante' ? 'Bebida' : 
                     prod.tipoOpcao === 'tamanho_pg' ? 'P/G' : 
                     prod.tipoOpcao === 'combinado' ? 'Combinado' : 'Variações'}
                  </span>
                )}
                {prod.isDrink && (
                   <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 leading-none">
                     Drink
                   </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredProdutos.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Search size={20} />
            </div>
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      {/* Modal Add/Edit Product */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm max-h-[90vh] rounded-2xl border border-gray-200 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-900 p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 scrollbar-hide">
              <form id="product-form" onSubmit={handleSave} className="space-y-4">
                {/* Image Upload */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-32 w-full bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 transition-colors relative overflow-hidden group"
                >
                  {foto ? (
                    <>
                      <img src={foto} alt="Preview" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil className="text-white drop-shadow-md" size={24} />
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-gray-400 mb-2" />
                      <span className="text-xs text-gray-500">Toque para adicionar foto</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Nome do Produto</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                    placeholder="Ex: Hambúrguer"
                    required
                  />
                </div>

                {/* Price & Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Preço (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={preco}
                      onChange={e => setPreco(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Categoria</label>
                    <select
                      value={categoriaId}
                      onChange={e => {
                        const newId = e.target.value
                        setCategoriaId(newId)
                        
                        // Auto-detect sector based on category name
                        const cat = categorias.find(c => c.id.toString() === newId)
                        if (cat) {
                          const catNome = cat.nome.toLowerCase()
                          
                          if (catNome.includes('bebida') || catNome.includes('drink') || catNome.includes('cerveja') || catNome.includes('refrigerante') || catNome.includes('suco') || catNome.includes('água') || catNome.includes('vinho') || catNome.includes('dose') || catNome.includes('bar')) {
                              setIsDrink(true)
                              setIsFood(false)
                          } else if (catNome.includes('prato') || catNome.includes('entrada') || catNome.includes('comida') || catNome.includes('lanche') || catNome.includes('sobremesa') || catNome.includes('porção') || catNome.includes('petisco') || catNome.includes('hambúrguer') || catNome.includes('pizza') || catNome.includes('salada') || catNome.includes('cozinha')) {
                              setIsFood(true)
                              setIsDrink(false)
                          }
                        }
                      }}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                    >
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Option Type */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Tipo de Opção</label>
                  <select
                    value={tipoOpcao}
                    onChange={e => setTipoOpcao(e.target.value as any)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  >
                    <option value="padrao">Padrão (Sem variações)</option>
                    <option value="tamanho_pg">Tamanho (P/G)</option>
                    <option value="refrigerante">Refrigerante (Lata/Litro/KS + Normal/Zero)</option>
                    <option value="sabores">Apenas Sabores/Variações</option>
                    <option value="sabores_com_tamanho">Sabores + Tamanho (P/G)</option>
                    <option value="combinado">Combinado (Escolha Múltipla)</option>
                  </select>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 gap-2">
                  {/* Is Drink */}
                  <div 
                    className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                    onClick={() => {
                        setIsDrink(!isDrink)
                        if (!isDrink) setIsFood(false)
                    }}
                  >
                    <div className={clsx(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      isDrink ? "bg-blue-600 border-blue-600" : "border-gray-400 bg-white"
                    )}>
                      {isDrink && <Plus size={14} className="text-white rotate-45" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700">É Bebida/Drink?</span>
                      <p className="text-[10px] text-gray-500 leading-tight">Envia para Bar</p>
                    </div>
                  </div>

                  {/* Is Food */}
                  <div 
                    className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                    onClick={() => {
                        setIsFood(!isFood)
                        if (!isFood) setIsDrink(false)
                    }}
                  >
                    <div className={clsx(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      isFood ? "bg-blue-600 border-blue-600" : "border-gray-400 bg-white"
                    )}>
                      {isFood && <Plus size={14} className="text-white rotate-45" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700">É Comida?</span>
                      <p className="text-[10px] text-gray-500 leading-tight">Envia para Cozinha</p>
                    </div>
                  </div>
                </div>

                {/* Sabores List */}
                {(tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') && (
                  <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sabores/Variações</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSabor}
                        onChange={e => setNewSabor(e.target.value)}
                        placeholder="Novo sabor..."
                        className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddSabor(e)
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddSabor}
                        disabled={!newSabor}
                        className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                      {sabores.map(sabor => (
                        <div key={sabor} className="bg-white text-gray-700 text-xs font-medium px-2 py-1 rounded-md flex items-center gap-1 border border-gray-200">
                          <span>{sabor}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSabor(sabor)}
                            className="text-gray-400 hover:text-red-500 p-0.5 rounded-full hover:bg-gray-100"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      {sabores.length === 0 && (
                        <p className="text-gray-400 text-xs italic w-full text-center py-1">Nenhuma variação</p>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="p-4 border-t border-gray-200 shrink-0 bg-gray-50 rounded-b-2xl">
              <button
                type="submit"
                form="product-form"
                disabled={!nome || ((tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado') && sabores.length === 0)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-lg shadow-blue-900/20"
              >
                {editingId ? 'Salvar Alterações' : 'Criar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteConfirmationId}
        onClose={() => setDeleteConfirmationId(null)}
        onConfirm={confirmDelete}
        title="Excluir Produto?"
        description="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  )
}
