'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, PackagePlus, Puzzle, RefreshCw, Save, Utensils } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiFetch, fetchList } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'
import type { Categoria, Produto } from '@/types'

type ProdutoOrdenavel = Produto & {
  ordem?: number
}

type Complemento = {
  id: number
  grupoId: number
  nome: string
  valor: number | string
  ordem: number
  ativo: boolean
}

type ComplementoGrupo = {
  id: number
  nome: string
  obrigatorio: boolean
  minEscolhas: number
  maxEscolhas: number | null
  ordem: number
  ativo: boolean
  complementos?: Complemento[]
}

type Modo = 'produtos' | 'grupos' | 'complementos'
type Ordenavel = { id: number; nome: string; ordem?: number; detalhe?: string }

const modos: Array<{ id: Modo; label: string; icon: typeof Utensils }> = [
  { id: 'produtos', label: 'Produtos', icon: Utensils },
  { id: 'grupos', label: 'Grupos', icon: PackagePlus },
  { id: 'complementos', label: 'Complementos', icon: Puzzle }
]

function ordenarPorOrdemNome<T extends { nome: string; ordem?: number }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome))
}

export default function OrganizarCardapioPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [modo, setModo] = useState<Modo>('produtos')
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [categoriaId, setCategoriaId] = useState<string>('all')
  const [produtos, setProdutos] = useState<ProdutoOrdenavel[]>([])
  const [grupos, setGrupos] = useState<ComplementoGrupo[]>([])
  const [grupoId, setGrupoId] = useState<string>('all')
  const [complementos, setComplementos] = useState<Complemento[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const categoriaAtual = useMemo(() => {
    if (categoriaId === 'all') return null
    return categorias.find((categoria) => String(categoria.id) === categoriaId) ?? null
  }, [categorias, categoriaId])

  const grupoAtual = useMemo(() => {
    if (grupoId === 'all') return null
    return grupos.find((grupo) => String(grupo.id) === grupoId) ?? null
  }, [grupos, grupoId])

  const itens: Ordenavel[] = useMemo(() => {
    if (modo === 'produtos') {
      return produtos.map((produto) => ({
        id: produto.id,
        nome: produto.nome,
        ordem: produto.ordem,
        detalhe: produto.tipo === 'POR_TAMANHO'
          ? 'Por tamanho'
          : `R$ ${Number(produto.valorPromo ?? produto.preco).toFixed(2).replace('.', ',')}`
      }))
    }

    if (modo === 'grupos') {
      return grupos.map((grupo) => ({
        id: grupo.id,
        nome: grupo.nome,
        ordem: grupo.ordem,
        detalhe: grupo.obrigatorio ? 'Obrigatório' : 'Opcional'
      }))
    }

    return complementos.map((complemento) => ({
      id: complemento.id,
      nome: complemento.nome,
      ordem: complemento.ordem,
      detalhe: `R$ ${Number(complemento.valor).toFixed(2).replace('.', ',')}`
    }))
  }, [complementos, grupos, modo, produtos])

  const tituloLista = modo === 'produtos'
    ? (categoriaAtual?.nome ?? 'Produtos')
    : modo === 'grupos'
      ? 'Grupos de complemento'
      : (grupoAtual?.nome ?? 'Complementos')

  const vazio = modo === 'produtos'
    ? 'Nenhum produto ativo nesta categoria.'
    : modo === 'grupos'
      ? 'Nenhum grupo de complemento ativo.'
      : 'Nenhum complemento ativo neste grupo.'

  const carregar = async () => {
    setLoading(true)
    try {
      const [listaCategorias, listaGrupos] = await Promise.all([
        fetchList<Categoria>('/categories'),
        fetchList<ComplementoGrupo>('/complementos/grupos?page=1&pageSize=100&ativo=true&sort=ordem&order=asc')
      ])

      setCategorias(listaCategorias)
      setGrupos(ordenarPorOrdemNome(listaGrupos))

      const primeiraCategoria = listaCategorias[0]?.id ? String(listaCategorias[0].id) : 'all'
      const categoriaSelecionada = categoriaId === 'all' ? primeiraCategoria : categoriaId
      setCategoriaId(categoriaSelecionada)
      const categoria = listaCategorias.find((item) => String(item.id) === categoriaSelecionada)
      setProdutos(ordenarPorOrdemNome(categoria?.produtos ?? []))

      const primeiroGrupo = listaGrupos[0]?.id ? String(listaGrupos[0].id) : 'all'
      const grupoSelecionado = grupoId === 'all' ? primeiroGrupo : grupoId
      setGrupoId(grupoSelecionado)
      const grupo = listaGrupos.find((item) => String(item.id) === grupoSelecionado)
      setComplementos(ordenarPorOrdemNome((grupo?.complementos ?? []).filter((item) => item.ativo)))
    } catch (error) {
      console.error(error)
      showToast('Falha ao carregar o cardápio.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (categorias.length === 0 || categoriaId === 'all') return
    const categoria = categorias.find((item) => String(item.id) === categoriaId)
    setProdutos(ordenarPorOrdemNome(categoria?.produtos ?? []))
  }, [categorias, categoriaId])

  useEffect(() => {
    if (grupos.length === 0 || grupoId === 'all') return
    const grupo = grupos.find((item) => String(item.id) === grupoId)
    setComplementos(ordenarPorOrdemNome((grupo?.complementos ?? []).filter((item) => item.ativo)))
  }, [grupos, grupoId])

  const mover = (index: number, direcao: -1 | 1) => {
    const destino = index + direcao
    if (destino < 0 || destino >= itens.length) return
    const trocar = <T,>(atuais: T[]) => {
      const copia = [...atuais]
      const item = copia[index]
      copia[index] = copia[destino]
      copia[destino] = item
      return copia
    }

    if (modo === 'produtos') setProdutos(trocar)
    if (modo === 'grupos') setGrupos(trocar)
    if (modo === 'complementos') setComplementos(trocar)
  }

  const salvar = async () => {
    setSaving(true)
    try {
      const corpo = {
        itens: itens.map((item, index) => ({
          id: item.id,
          ordem: index
        }))
      }

      if (modo === 'produtos') {
        await apiFetch('/products/ordem', { method: 'PATCH', body: corpo })
      } else if (modo === 'grupos') {
        await apiFetch('/complementos/grupos/ordem', { method: 'PATCH', body: corpo })
      } else {
        if (!grupoAtual) throw new Error('Selecione um grupo de complemento')
        await apiFetch(`/complementos/grupos/${grupoAtual.id}/itens/ordem`, { method: 'PATCH', body: corpo })
      }

      showToast('Ordem do cardápio salva.', 'success')
      await carregar()
    } catch (error) {
      console.error(error)
      showToast('Falha ao salvar a ordem.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organizar cardápio</h1>
              <p className="text-sm text-gray-500">Reordene produtos, grupos e complementos usados no lançamento de pedido.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={carregar}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={loading || saving || itens.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar ordem'}
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Organizar</label>
              <div className="flex flex-wrap gap-2">
                {modos.map((opcao) => {
                  const Icon = opcao.icon
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      onClick={() => setModo(opcao.id)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                        modo === opcao.id
                          ? 'border-orange-600 bg-orange-50 text-orange-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} />
                      {opcao.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {modo === 'produtos' && (
              <div className="w-full md:max-w-sm">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Categoria</label>
                <select
                  value={categoriaId}
                  onChange={(event) => setCategoriaId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {modo === 'complementos' && (
              <div className="w-full md:max-w-sm">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-500">Grupo</label>
                <select
                  value={grupoId}
                  onChange={(event) => setGrupoId(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">{tituloLista}</h2>
            <p className="text-xs text-gray-500">{itens.length} itens ativos</p>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-gray-500">Carregando...</div>
          ) : itens.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">{vazio}</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {itens.map((item, index) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{index + 1}. {item.nome}</p>
                    {item.detalhe && <p className="text-xs text-gray-500">{item.detalhe}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => mover(index, -1)}
                      disabled={index === 0}
                      className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(index, 1)}
                      disabled={index === itens.length - 1}
                      className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
