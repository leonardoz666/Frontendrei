import type { Produto } from '../components/ProductCard'
import { apiFetch, ApiError } from './api'
import type { Paginated } from './pagination'

export async function fetchAllProducts(): Promise<Produto[]> {
  const all: Produto[] = []
  for (let page = 1; page <= 50; page += 1) {
    const result = await apiFetch<Paginated<Produto>>(`/products?page=${page}&pageSize=100&ativo=all`)
    if (!Array.isArray(result?.data) || !Number.isInteger(result.meta?.total) || result.meta.total < 0) {
      throw new Error('Resposta inválida ao listar produtos')
    }
    all.push(...result.data)
    if (all.length >= result.meta.total) return all
    if (result.data.length === 0) break
  }
  throw new Error('A listagem de produtos está incompleta')
}

export function sectorFromCategory(name: string): { isDrink: boolean; isFood: boolean } | null {
  const category = name.toLowerCase()
  const drinks = ['bebida', 'drink', 'cerveja', 'refrigerante', 'suco', 'água', 'vinho', 'dose', 'bar']
  const foods = ['prato', 'entrada', 'comida', 'lanche', 'sobremesa', 'porção', 'petisco', 'hambúrguer', 'pizza', 'salada', 'cozinha']
  if (drinks.some(word => category.includes(word))) return { isDrink: true, isFood: false }
  if (foods.some(word => category.includes(word))) return { isDrink: false, isFood: true }
  return null
}

export async function correctProductSectors(onLoaded?: (total: number) => void): Promise<{ updated: number; failed: number }> {
  const products = await fetchAllProducts()
  onLoaded?.(products.length)
  let updated = 0
  let failed = 0

  for (const product of products) {
    if (!product.categoria) continue
    const sector = sectorFromCategory(product.categoria.nome)
    if (!sector || (product.isDrink === sector.isDrink && product.isFood === sector.isFood)) continue

    const formData = new FormData()
    formData.append('nome', product.nome)
    formData.append('preco', String(product.preco))
    formData.append('isDrink', String(sector.isDrink))
    formData.append('isFood', String(sector.isFood))
    try {
      await apiFetch(`/products/${product.id}`, { method: 'PUT', body: formData })
      updated += 1
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) throw error
      failed += 1
    }
  }

  return { updated, failed }
}
