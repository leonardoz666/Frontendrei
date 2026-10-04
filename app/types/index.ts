export type Produto = {
  id: number
  nome: string
  preco: number
  categoriaId: number
  tipo?: 'COMUM' | 'POR_TAMANHO'
  valorPromo?: number | string | null
  ordem?: number
  tipoTamanhoId?: number | null
  tipoTamanho?: {
    id: number
    nome: string
    tamanhos: Array<{ id: number; nome: string; valor: number | string; ordem: number }>
  } | null
  gruposComplemento?: Array<{
    grupoId: number
    ordem: number
    grupo: {
      id: number
      nome: string
      obrigatorio: boolean
      minEscolhas: number
      maxEscolhas: number | null
      complementos: Array<{ id: number; nome: string; valor: number | string; ordem: number }>
    }
  }>
  tipoOpcao?: 'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'
  sabores?: string
  isDrink?: boolean
  isFood?: boolean
  setor?: string // Added optional because it was used in handleModalConfirm logic check
  ativo?: boolean
  permitirObservacao?: boolean
  permiteGeloLimao?: boolean
  favorito?: boolean
  ultimoUso?: string
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
  tamanhoId?: number
  complementos?: Array<{ complementoId: number }>
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
    precoUnitario?: number | string | null
    complementos?: Array<{ valorCobrado: number | string }>
    produto: {
      nome: string
      preco: number
    }
  }[]
}
