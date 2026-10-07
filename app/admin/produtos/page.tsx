'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ConfirmationModal } from '@/components/ConfirmationModal'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/ui/Skeleton'
import { ProductCard, Produto, Categoria } from '@/components/ProductCard'
import { apiFetch, apiRequest, ApiError, fetchList } from '@/app/lib/api'
import { usePagedQuery, type SortOrder } from '@/app/lib/pagination'
import { correctProductSectors, fetchAllProducts } from '@/app/lib/product-catalog'
import { buildProductFormData } from '@/app/lib/product-form'
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Upload, 
  X, 
  Check,
  Pencil, 
  Download,
  Wand2
} from 'lucide-react'
import { clsx } from 'clsx'

type TipoTamanho = {
  id: number
  nome: string
}

type Dispositivo = {
  id: number
  nome: string
  tipo: string
  ativo: boolean
}

type ComplementoGrupo = {
  id: number
  nome: string
  obrigatorio: boolean
  minEscolhas: number
  maxEscolhas: number | null
  ativo: boolean
}

export default function ProdutosPage() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  
  // Paginação/busca/ordenação no SERVIDOR (DT-2). Antes a tela baixava a base
  // inteira e filtrava no cliente, o que não escala para o cardápio real.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState<string | null>(null)
  const [order, setOrder] = useState<SortOrder | null>(null)

  const {
    data: paginaProdutos,
    isLoading: loadingProd,
    refetch: refetchProdutos,
  } = usePagedQuery<Produto>({
    resource: '/products',
    page,
    pageSize,
    search: searchTerm,
    sort,
    order,
  })

  const produtos = paginaProdutos?.data ?? []
  const meta = paginaProdutos?.meta ?? { page, pageSize, total: 0, totalPages: 0 }
  const totalProdutos = meta.total

  const { data: categorias = [], isLoading: loadingCat } = useQuery<Categoria[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      // Lista completa de categorias: alimenta os selects do formulário e a
      // importação, então precisa de TODAS, não de uma página.
      return fetchList<Categoria>('/categories?page=1&pageSize=100')
    }
  })

  const { data: tiposTamanho = [] } = useQuery<TipoTamanho[]>({
    queryKey: ['tipos-tamanho', 'select'],
    queryFn: async () => fetchList<TipoTamanho>('/tipos-tamanho?page=1&pageSize=100&sort=nome&order=asc')
  })

  const { data: dispositivos = [] } = useQuery<Dispositivo[]>({
    queryKey: ['dispositivos', 'select'],
    queryFn: async () => fetchList<Dispositivo>('/dispositivos?page=1&pageSize=100&ativo=true&tipo=IMPRESSORA&sort=nome&order=asc')
  })

  const { data: gruposComplemento = [] } = useQuery<ComplementoGrupo[]>({
    queryKey: ['complementos-grupos', 'select'],
    queryFn: async () => fetchList<ComplementoGrupo>('/complementos/grupos?page=1&pageSize=100&ativo=true&sort=ordem&order=asc')
  })

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null)
  const [fixStatus, setFixStatus] = useState<string | null>(null)
  const [confirmarFixSetores, setConfirmarFixSetores] = useState(false)

  const handleFixSectors = async () => {
    setConfirmarFixSetores(false)
    setFixStatus('Carregando todos os produtos...')
    try {
      const { updated, failed } = await correctProductSectors(total => {
        setFixStatus(`Corrigindo setores de ${total} produtos...`)
      })
      setFixStatus(`Correção concluída: ${updated} atualizados, ${failed} falhas`)
      if (updated > 0) showToast(`${updated} produtos corrigidos com sucesso!`, 'success')
      if (failed > 0) showToast(`${failed} falhas durante a correção.`, 'warning')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      void refetchProdutos()
      setTimeout(() => setFixStatus(null), 5000)
    } catch {
      setFixStatus(null)
      showToast('Falha ao corrigir os setores dos produtos.', 'error')
    }
  }

  // Form States
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [valorPromo, setValorPromo] = useState('')
  const [custo, setCusto] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [tipo, setTipo] = useState<'COMUM' | 'POR_TAMANHO'>('COMUM')
  const [tipoTamanhoId, setTipoTamanhoId] = useState('')
  const [dispositivoId, setDispositivoId] = useState('')
  const [ordemProduto, setOrdemProduto] = useState('0')
  const [ativo, setAtivo] = useState(true)
  const [foto, setFoto] = useState<string | undefined>(undefined)
  const [file, setFile] = useState<File | null>(null)
  const [tipoOpcao, setTipoOpcao] = useState<'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'>('padrao')
  const [sabores, setSabores] = useState<string[]>([])
  const [newSabor, setNewSabor] = useState('')
  const [isDrink, setIsDrink] = useState(false)
  const [isFood, setIsFood] = useState(true)
  const [favorito, setFavorito] = useState(false)
  const [destaque, setDestaque] = useState(false)
  const [controlaEstoque, setControlaEstoque] = useState(false)
  const [autoatendimento, setAutoatendimento] = useState(false)
  const [fiscal, setFiscal] = useState(false)
  const [gruposComplementoIds, setGruposComplementoIds] = useState<number[]>([])
  const [ncm, setNcm] = useState('')
  const [cfop, setCfop] = useState('')
  const [cstCsosn, setCstCsosn] = useState('')
  const [aliquotaIcms, setAliquotaIcms] = useState('')
  const [permitirObservacao, setPermitirObservacao] = useState(true)
  const [permiteGeloLimao, setPermiteGeloLimao] = useState(false)

  const [, setError] = useState('')
  const [importStatus, setImportStatus] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Effect to set default category
  useEffect(() => {
    if (categorias.length > 0 && !categoriaId && !editingId) {
      setCategoriaId(categorias[0].id.toString())
    }
  }, [categorias, categoriaId, editingId])

  // A busca agora é feita no SERVIDOR (dentro de `usePagedQuery`), com debounce de
  // 300ms. O filtro client-side que existia aqui foi removido de propósito: ele
  // só enxergava a página carregada e esconderia produtos das outras páginas.

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
      const url = editingId ? `/products/${editingId}` : '/products'
      const method = editingId ? 'PUT' : 'POST'

      const formData = buildProductFormData({
        nome, codigo, descricao, preco, valorPromo, custo, categoriaId, tipo,
        tipoTamanhoId, dispositivoId, ordemProduto, ativo, file, tipoOpcao,
        sabores, isDrink, isFood, favorito, destaque, controlaEstoque,
        autoatendimento, fiscal, ncm, cfop, cstCsosn, aliquotaIcms,
        permitirObservacao, permiteGeloLimao, gruposComplementoIds,
      })

      await apiFetch(url, {
        method,
        body: formData
      })

      showToast(editingId ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!', 'success')
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['products'] })
    void refetchProdutos()
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar produto')
      showToast('Erro ao salvar produto. Tente novamente.', 'error')
    }
  }

  const resetForm = () => {
    setNome('')
    setCodigo('')
    setDescricao('')
    setPreco('')
    setValorPromo('')
    setCusto('')
    setAtivo(true)
    setEditingId(null)
    setIsAdding(false)
    setTipo('COMUM')
    setTipoTamanhoId('')
    setDispositivoId('')
    setOrdemProduto('0')
    setFoto(undefined)
    setFile(null)
    setTipoOpcao('padrao')
    setSabores([])
    setNewSabor('')
    setIsDrink(false)
    setIsFood(true)
    setFavorito(false)
    setDestaque(false)
    setControlaEstoque(false)
    setAutoatendimento(false)
    setFiscal(false)
    setGruposComplementoIds([])
    setNcm('')
    setCfop('')
    setCstCsosn('')
    setAliquotaIcms('')
    setPermitirObservacao(true)
    setPermiteGeloLimao(false)
    setError('')
    if (categorias.length > 0) setCategoriaId(categorias[0].id.toString())
  }

  const handleEdit = useCallback((prod: Produto) => {
    setEditingId(prod.id)
    setIsAdding(true)
    setNome(prod.nome)
    setCodigo(prod.codigo ?? '')
    setDescricao(prod.descricao ?? '')
    setPreco(prod.preco.toString())
    setValorPromo(prod.valorPromo === null || prod.valorPromo === undefined ? '' : String(prod.valorPromo))
    setCusto(prod.custo === null || prod.custo === undefined ? '' : String(prod.custo))
    setCategoriaId(prod.categoriaId ? prod.categoriaId.toString() : (categorias[0]?.id.toString() || ''))
    setTipo(prod.tipo ?? 'COMUM')
    setTipoTamanhoId(prod.tipoTamanhoId ? String(prod.tipoTamanhoId) : '')
    setDispositivoId(prod.dispositivoId ? String(prod.dispositivoId) : '')
    setOrdemProduto(prod.ordem === undefined || prod.ordem === null ? '0' : String(prod.ordem))
    setAtivo(prod.ativo)
    setFoto(prod.foto)
    setTipoOpcao((prod.tipoOpcao as Produto['tipoOpcao']) || 'padrao')
    
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
    setDestaque(prod.destaque || false)
    setControlaEstoque(prod.controlaEstoque || false)
    setAutoatendimento(prod.autoatendimento || false)
    setFiscal(prod.fiscal || false)
    setGruposComplementoIds((prod.gruposComplemento ?? []).map((vinculo) => vinculo.grupoId))
    setNcm(prod.ncm ?? '')
    setCfop(prod.cfop ?? '')
    setCstCsosn(prod.cstCsosn ?? '')
    setAliquotaIcms(prod.aliquotaIcms === null || prod.aliquotaIcms === undefined ? '' : String(prod.aliquotaIcms))
    setPermitirObservacao(prod.permitirObservacao !== undefined ? prod.permitirObservacao : true)
    setPermiteGeloLimao(prod.permiteGeloLimao || false)
    setFile(null)
    setError('')
  }, [categorias])

  const confirmDelete = async () => {
    if (deleteConfirmationId) {
      try {
        const res = await apiRequest(`/products/${deleteConfirmationId}`, { method: 'DELETE' })
        
        if (res.status === 200) {
          const data = await res.json()
          showToast(data.message || 'Produto desativado (possui histórico).', 'warning')
        } else if (res.status === 204) {
          showToast('Produto excluído permanentemente!', 'success')
        } else {
          throw new Error('Erro ao excluir')
        }
        
        queryClient.invalidateQueries({ queryKey: ['products'] })
    void refetchProdutos()
        setDeleteConfirmationId(null)
      } catch (err) {
        console.error(err)
        showToast('Erro ao excluir produto.', 'error')
      }
    }
  }

  const handleExport = async () => {
    try {
      setImportStatus('Carregando todo o cardápio...')
      const allProducts = await fetchAllProducts()
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        items: allProducts.map(p => ({
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
    } catch (error) {
      console.error(error)
      showToast('Falha ao exportar o cardápio.', 'error')
    } finally {
      setImportStatus(null)
    }
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setImportStatus('Lendo arquivo...')
      const text = await file.text()
      const json = JSON.parse(text)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : []
      
      if (!items.length) {
        setImportStatus('Arquivo inválido ou vazio')
        return
      }

      const existingProducts = await fetchAllProducts()
      const existingByName = new Map(existingProducts.map(product => [product.nome.toLowerCase(), product.id]))

      let added = 0
      let updated = 0
      let failed = 0

      for (const i of items) {
        try {
          const existingId = existingByName.get(i.nome.toLowerCase())
          
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
          formData.append('permitirObservacao', String(i.permitirObservacao !== undefined ? i.permitirObservacao : true))
          formData.append('permiteGeloLimao', String(!!i.permiteGeloLimao))

          const url = existingId ? `/products/${existingId}` : '/products'
          const method = existingId ? 'PUT' : 'POST'

          const saved = await apiFetch<{ id: number }>(url, {
            method,
            body: formData
          })
          if (existingId) {
            updated++
          } else {
            added++
            existingByName.set(i.nome.toLowerCase(), saved.id)
          }
        } catch (e) {
          if (e instanceof ApiError && e.isUnauthorized) throw e
          console.error(e)
          failed++
        }
      }

      setImportStatus(`Importação concluída: ${added} adicionados, ${updated} atualizados, ${failed} falhas`)
      if (added > 0 || updated > 0) showToast(`Importação concluída: ${added} novos, ${updated} atualizados.`, 'success')
      if (failed > 0) showToast(`${failed} itens falharam na importação.`, 'warning')

      queryClient.invalidateQueries({ queryKey: ['products'] })
    void refetchProdutos()
      e.target.value = '' 
    } catch (err) {
      console.error(err)
      setImportStatus('Falha ao importar arquivo')
      showToast('Falha crítica ao importar arquivo.', 'error')
    }
  }

  if (loadingProd || loadingCat) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <header className="flex items-center justify-between mb-8">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-48 h-8" />
          <div className="w-10" />
        </header>
        <div className="flex gap-2 mb-8">
          <Skeleton className="flex-1 h-10 rounded-xl" />
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-10 h-10 rounded-xl" />
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-200">
              <Skeleton className="aspect-square w-full" />
              <div className="p-2 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

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
              onChange={e => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar por nome..."
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
            onClick={() => setConfirmarFixSetores(true)}
            title="Auto-corrigir setores (Cozinha/Bar) de TODO o cardápio"
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

      {/* Listagem: grade de cards, não DataTable.
          Decisão: o cardápio é um catálogo VISUAL (foto do prato é o que o
          operador reconhece), e o DataTable do padrão RF-UI-01 é uma tabela —
          usá-lo aqui destruiria a informação da imagem. O que o padrão exige e
          que foi adotado: paginação/busca/ordenação no servidor, contagem no
          rodapé e seletor de itens por página. */}
      <div className="p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <label htmlFor="produtos-pagesize" className="whitespace-nowrap">
              Exibir
            </label>
            <select
              id="produtos-pagesize"
              value={pageSize}
              onChange={(evento) => {
                setPageSize(Number(evento.target.value))
                setPage(1)
              }}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              {[10, 25, 50, 100].map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
            <span className="whitespace-nowrap">resultados por página</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="produtos-sort" className="sr-only">
              Ordenar
            </label>
            <select
              id="produtos-sort"
              value={sort ? `${sort}:${order ?? 'asc'}` : ''}
              onChange={(evento) => {
                const valor = evento.target.value
                if (!valor) {
                  setSort(null)
                  setOrder(null)
                } else {
                  const [campo, direcao] = valor.split(':')
                  setSort(campo)
                  setOrder(direcao as SortOrder)
                }
                setPage(1)
              }}
              className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="">Ordenar por…</option>
              <option value="nome:asc">Nome (A–Z)</option>
              <option value="nome:desc">Nome (Z–A)</option>
              <option value="id:desc">Mais recentes primeiro</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {loadingProd &&
            Array.from({ length: Math.min(pageSize, 20) }).map((_, indice) => (
              <div key={`skeleton-${indice}`} className="flex flex-col gap-2">
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}

          {!loadingProd &&
            produtos.map((prod) => (
              <ProductCard
                key={prod.id}
                prod={prod}
                onEdit={handleEdit}
                onDelete={setDeleteConfirmationId}
              />
            ))}

          {!loadingProd && produtos.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Search size={20} />
              </div>
              <p className="text-sm">
                {searchTerm
                  ? `Nenhum produto corresponde a "${searchTerm}"`
                  : 'Nenhum produto cadastrado'}
              </p>
            </div>
          )}
        </div>

        <Pagination
          meta={meta}
          onPageChange={setPage}
          disabled={loadingProd}
          itemLabel="produtos"
          className="mt-4 rounded-xl border border-gray-200 bg-white"
        />
      </div>

      {/* Modal Add/Edit Product */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl border border-gray-200 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
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
                      <div className="relative w-full h-full">
                        <Image 
                          src={foto} 
                          alt="Preview" 
                          fill
                          className="object-cover opacity-80 group-hover:opacity-60 transition-opacity" 
                          unoptimized
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Código</label>
                    <input
                      type="text"
                      value={codigo}
                      onChange={e => setCodigo(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                      placeholder="SKU ou PLU"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Ordem</label>
                    <input
                      type="number"
                      value={ordemProduto}
                      onChange={e => setOrdemProduto(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Descrição</label>
                  <textarea
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    className="w-full min-h-20 bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm resize-none"
                    placeholder="Detalhes exibidos no cardápio"
                  />
                </div>

                {/* Price & Category */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Promo (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valorPromo}
                      onChange={e => setValorPromo(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-blue-600 outline-none text-sm"
                      placeholder="Opcional"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Custo</label>
                    <input
                      type="number"
                      step="0.01"
                      value={custo}
                      onChange={e => setCusto(e.target.value)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Tipo de Preço</label>
                    <select
                      value={tipo}
                      onChange={e => setTipo(e.target.value as 'COMUM' | 'POR_TAMANHO')}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                    >
                      <option value="COMUM">Preço único</option>
                      <option value="POR_TAMANHO">Por tabela de tamanhos</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Tabela de Tamanhos</label>
                    <select
                      value={tipoTamanhoId}
                      onChange={e => setTipoTamanhoId(e.target.value)}
                      disabled={tipo !== 'POR_TAMANHO'}
                      className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">Selecione</option>
                      {tiposTamanho.map(item => (
                        <option key={item.id} value={item.id}>{item.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Impressora de Produção</label>
                  <select
                    value={dispositivoId}
                    onChange={e => setDispositivoId(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg p-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  >
                    <option value="">Usar roteamento por categoria/praça</option>
                    {dispositivos.map(item => (
                      <option key={item.id} value={item.id}>{item.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grupos de Complementos</label>
                    <span className="text-[10px] text-gray-400">{gruposComplementoIds.length} vinculados</span>
                  </div>
                  {gruposComplemento.length === 0 ? (
                    <p className="text-xs text-gray-500">Cadastre grupos em Cardápio &gt; Complementos.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto pr-1">
                      {gruposComplemento.map(grupo => {
                        const marcado = gruposComplementoIds.includes(grupo.id)
                        return (
                          <button
                            key={grupo.id}
                            type="button"
                            onClick={() => setGruposComplementoIds(prev => marcado ? prev.filter(id => id !== grupo.id) : [...prev, grupo.id])}
                            className={clsx(
                              "flex items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors",
                              marcado ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white hover:border-orange-200"
                            )}
                          >
                            <span>
                              <span className="block text-sm font-bold text-gray-800">{grupo.nome}</span>
                              <span className="block text-[10px] text-gray-500">
                                {grupo.obrigatorio ? 'Obrigatório' : 'Opcional'} · min {grupo.minEscolhas} · max {grupo.maxEscolhas ?? 'livre'}
                              </span>
                            </span>
                            <span className={clsx(
                              "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                              marcado ? "bg-orange-600 border-orange-600" : "border-gray-400 bg-white"
                            )}>
                              {marcado && <Check size={14} className="text-white" />}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Option Type */}
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Tipo de Opção</label>
                  <select
                    value={tipoOpcao}
                    onChange={e => setTipoOpcao(e.target.value as Exclude<Produto['tipoOpcao'], undefined>)}
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
                  {/* Active Status */}
                  <div 
                    className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                    onClick={() => setAtivo(!ativo)}
                  >
                    <div className={clsx(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      ativo ? "bg-green-600 border-green-600" : "border-gray-400 bg-white"
                    )}>
                      {ativo && <Check size={14} className="text-white" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700">Disponível / Ativo?</span>
                      <p className="text-[10px] text-gray-500 leading-tight">Se desmarcar, o produto some do cardápio</p>
                    </div>
                  </div>

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

                  <div className="grid grid-cols-2 gap-2">
                    <div 
                      className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                      onClick={() => setFavorito(!favorito)}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                        favorito ? "bg-amber-500 border-amber-500" : "border-gray-400 bg-white"
                      )}>
                        {favorito && <Check size={14} className="text-white" />}
                      </div>
                      <span className="text-sm font-bold text-gray-700">Favorito</span>
                    </div>

                    <div 
                      className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                      onClick={() => setDestaque(!destaque)}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                        destaque ? "bg-amber-500 border-amber-500" : "border-gray-400 bg-white"
                      )}>
                        {destaque && <Check size={14} className="text-white" />}
                      </div>
                      <span className="text-sm font-bold text-gray-700">Destaque</span>
                    </div>

                    <div 
                      className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                      onClick={() => setControlaEstoque(!controlaEstoque)}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                        controlaEstoque ? "bg-emerald-600 border-emerald-600" : "border-gray-400 bg-white"
                      )}>
                        {controlaEstoque && <Check size={14} className="text-white" />}
                      </div>
                      <span className="text-sm font-bold text-gray-700">Estoque</span>
                    </div>

                    <div 
                      className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                      onClick={() => setFiscal(!fiscal)}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                        fiscal ? "bg-indigo-600 border-indigo-600" : "border-gray-400 bg-white"
                      )}>
                        {fiscal && <Check size={14} className="text-white" />}
                      </div>
                      <span className="text-sm font-bold text-gray-700">Fiscal</span>
                    </div>

                    <div 
                      className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                      onClick={() => setAutoatendimento(!autoatendimento)}
                    >
                      <div className={clsx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                        autoatendimento ? "bg-blue-600 border-blue-600" : "border-gray-400 bg-white"
                      )}>
                        {autoatendimento && <Check size={14} className="text-white" />}
                      </div>
                      <span className="text-sm font-bold text-gray-700">Autoatendimento</span>
                    </div>
                  </div>

                  {/* Permitir Observação */}
                  <div 
                    className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                    onClick={() => setPermitirObservacao(!permitirObservacao)}
                  >
                    <div className={clsx(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      permitirObservacao ? "bg-blue-600 border-blue-600" : "border-gray-400 bg-white"
                    )}>
                      {permitirObservacao && <Check size={14} className="text-white" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700">Permitir Observação?</span>
                      <p className="text-[10px] text-gray-500 leading-tight">Exibir campo no pedido</p>
                    </div>
                  </div>

                  {/* Permitir Gelo e Limão */}
                  <div 
                    className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-200 cursor-pointer active:bg-gray-100 transition-colors" 
                    onClick={() => setPermiteGeloLimao(!permiteGeloLimao)}
                  >
                    <div className={clsx(
                      "w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      permiteGeloLimao ? "bg-blue-600 border-blue-600" : "border-gray-400 bg-white"
                    )}>
                      {permiteGeloLimao && <Check size={14} className="text-white" />}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-700">Gelo e Limão?</span>
                      <p className="text-[10px] text-gray-500 leading-tight">Exibir botões de Gelo/Limão</p>
                    </div>
                  </div>
                </div>

                {fiscal && (
                  <div className="space-y-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Fiscal</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={ncm}
                        onChange={e => setNcm(e.target.value)}
                        className="w-full bg-white border border-indigo-100 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="NCM"
                      />
                      <input
                        type="text"
                        value={cfop}
                        onChange={e => setCfop(e.target.value)}
                        className="w-full bg-white border border-indigo-100 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="CFOP"
                      />
                      <input
                        type="text"
                        value={cstCsosn}
                        onChange={e => setCstCsosn(e.target.value)}
                        className="w-full bg-white border border-indigo-100 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="CST/CSOSN"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={aliquotaIcms}
                        onChange={e => setAliquotaIcms(e.target.value)}
                        className="w-full bg-white border border-indigo-100 rounded-lg p-2.5 text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        placeholder="ICMS %"
                      />
                    </div>
                  </div>
                )}

                {/* Sabores List */}
                {(tipoOpcao === 'sabores' || tipoOpcao === 'sabores_com_tamanho' || tipoOpcao === 'combinado' || tipoOpcao === 'refrigerante') && (
                  <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sabores/Variações</label>
                    {tipoOpcao === 'refrigerante' && (
                      <p className="text-[10px] text-gray-500 mb-2">
                        Se deixar vazio, usará os tamanhos padrão: Lata, KS, 1 Litro.
                        <br/>Adicione tamanhos personalizados se desejar (ex: 600ml, 2 Litros).
                      </p>
                    )}
                    {tipoOpcao === 'sabores_com_tamanho' && (
                      <p className="text-[10px] text-gray-500 mb-2">
                        Adicione os sabores disponíveis para os tamanhos P e G (ex: Camarão, Peixe, Carne).
                      </p>
                    )}
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

      {/* Aviso explícito: é operação de LOTE sobre o cardápio inteiro, não sobre a
          página visível. Sem dizer isso, o operador poderia achar que corrigiu
          apenas o que está na tela (ou pior, achar que corrigiu tudo quando não). */}
      <ConfirmationModal
        isOpen={confirmarFixSetores}
        onClose={() => setConfirmarFixSetores(false)}
        onConfirm={handleFixSectors}
        title="Corrigir setores de produção?"
        description={`Isto vai reprocessar TODO o cardápio (${totalProdutos} produtos), não apenas a página atual, e ajustar Cozinha/Bar de cada item com base no nome da categoria. Produtos de categorias não reconhecidas ficam como estão.`}
        confirmText="Corrigir tudo"
        variant="warning"
      />
    </div>
  )
}
