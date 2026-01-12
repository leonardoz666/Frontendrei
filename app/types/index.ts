export type Produto = {
  id: number
  nome: string
  preco: number
  categoriaId: number
  tipoOpcao?: 'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'
  sabores?: string
  isDrink?: boolean
  isFood?: boolean
  setor?: string // Added optional because it was used in handleModalConfirm logic check
  ativo?: boolean
}

export type Categoria = {
  id: number
  nome: string
  setor: string
  produtos: Produto[]
}

export type CartItem = {
  produtoId: number
  nome: string
  preco: number
  quantidade: number
  observacao: string
  setor: string
}

export type SubmittedItem = {
  id: number
  nome: string
  quantidade: number
  preco: number
  observacao: string | null
  status: string
  horario: string
}

export type APIPedido = {
  id: number
  criadoEm: string
  itens: {
    id: number
    quantidade: number
    observacao: string | null
    status: string
    produto: {
      nome: string
      preco: number
    }
  }[]
}
