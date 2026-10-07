export type ProductFormValues = {
  nome: string
  codigo: string
  descricao: string
  preco: string
  valorPromo: string
  custo: string
  categoriaId: string
  tipo: 'COMUM' | 'POR_TAMANHO'
  tipoTamanhoId: string
  dispositivoId: string
  ordemProduto: string
  ativo: boolean
  file: File | null
  tipoOpcao: string
  sabores: string[]
  isDrink: boolean
  isFood: boolean
  favorito: boolean
  destaque: boolean
  controlaEstoque: boolean
  autoatendimento: boolean
  fiscal: boolean
  ncm: string
  cfop: string
  cstCsosn: string
  aliquotaIcms: string
  permitirObservacao: boolean
  permiteGeloLimao: boolean
  gruposComplementoIds: number[]
}

export function buildProductFormData(values: ProductFormValues): FormData {
  const form = new FormData()
  const appendText = (field: string, value: string) => form.append(field, value.trim())
  form.append('nome', values.nome)
  appendText('codigo', values.codigo)
  appendText('descricao', values.descricao)
  form.append('preco', values.preco || '0')
  appendText('valorPromo', values.valorPromo)
  form.append('custo', values.custo || '0')
  if (values.categoriaId) form.append('categoriaId', values.categoriaId)
  form.append('tipo', values.tipo)
  appendText('tipoTamanhoId', values.tipo === 'POR_TAMANHO' ? values.tipoTamanhoId : '')
  appendText('dispositivoId', values.dispositivoId)
  form.append('ordem', values.ordemProduto || '0')
  form.append('ativo', String(values.ativo))
  if (values.file) form.append('foto', values.file)
  form.append('tipoOpcao', values.tipoOpcao)
  form.append('sabores', JSON.stringify(values.sabores))
  for (const field of ['isDrink', 'isFood', 'favorito', 'destaque', 'controlaEstoque', 'autoatendimento', 'fiscal', 'permitirObservacao', 'permiteGeloLimao'] as const) {
    form.append(field, String(values[field]))
  }
  for (const field of ['ncm', 'cfop', 'cstCsosn', 'aliquotaIcms'] as const) {
    appendText(field, values[field])
  }
  form.append('gruposComplemento', JSON.stringify(
    values.gruposComplementoIds.map((grupoId, ordem) => ({ grupoId, ordem }))
  ))
  return form
}
