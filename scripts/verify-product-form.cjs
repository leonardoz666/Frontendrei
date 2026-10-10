require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const assert = require('node:assert/strict')
const { buildProductFormData } = require('../app/lib/product-form')

const form = buildProductFormData({
  nome: 'Suco', codigo: '  42  ', descricao: '  Natural  ', preco: '',
  valorPromo: ' 8 ', custo: '', categoriaId: '3', tipo: 'COMUM', tipoTamanhoId: '9',
  dispositivoIds: [12, 5], ordemProduto: '', ativo: true, file: null, tipoOpcao: 'sabores',
  sabores: ['Manga'], isDrink: true, isFood: false, favorito: false, destaque: false,
  controlaEstoque: false, autoatendimento: true, fiscal: false, ncm: ' 2202 ',
  cfop: '', cstCsosn: '', aliquotaIcms: '', permitirObservacao: true,
  permiteGeloLimao: true, gruposComplementoIds: [7, 4],
})

assert.equal(form.get('codigo'), '42')
assert.equal(form.get('descricao'), 'Natural')
assert.equal(form.get('preco'), '0')
assert.equal(form.get('custo'), '0')
assert.equal(form.get('tipoTamanhoId'), '')
assert.equal(form.get('dispositivoId'), '12')
assert.deepEqual(JSON.parse(form.get('dispositivoIds')), [12, 5])
assert.equal(form.get('ordem'), '0')
assert.equal(form.get('isDrink'), 'true')
assert.equal(form.get('isFood'), 'false')
assert.equal(form.get('permiteGeloLimao'), 'true')
assert.equal(form.get('ncm'), '2202')
assert.deepEqual(JSON.parse(form.get('sabores')), ['Manga'])
assert.deepEqual(JSON.parse(form.get('gruposComplemento')), [
  { grupoId: 7, ordem: 0 }, { grupoId: 4, ordem: 1 },
])
console.log('14 verificações do formulário de produtos passaram')
