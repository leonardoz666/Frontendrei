require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const assert = require('node:assert/strict')
const { fetchAllProducts, sectorFromCategory, correctProductSectors } = require('../app/lib/product-catalog')

async function run() {
  const originalFetch = global.fetch
  try {
    const calls = []
    global.fetch = async (url, options) => {
      calls.push({ url, options })
      if (options.method === 'PUT') return new Response('{}', { status: 200 })
      const page = Number(new URL(url, 'http://local').searchParams.get('page'))
      const data = page === 1 ? [
        { id: 1, nome: 'Suco', preco: 8, categoria: { nome: 'Bebidas' }, isDrink: false, isFood: true },
        { id: 2, nome: 'Pirão', preco: 25, categoria: { nome: 'Pratos' }, isDrink: false, isFood: true }
      ] : [{ id: 3, nome: 'Café', preco: 5, categoria: { nome: 'Bebidas' }, isDrink: false, isFood: true }]
      return Response.json({ data, meta: { total: 3 } })
    }

    assert.equal((await fetchAllProducts()).length, 3)
    assert.equal(sectorFromCategory('Bebidas')?.isDrink, true)
    assert.equal(sectorFromCategory('Pratos')?.isFood, true)
    assert.equal(sectorFromCategory('Diversos'), null)
    assert.deepEqual(await correctProductSectors(), { updated: 2, failed: 0 })
    const updates = calls.filter(call => call.options.method === 'PUT')
    assert.equal(updates.length, 2)
    assert.deepEqual(updates.map(call => call.url), ['/api/products/1', '/api/products/3'])
    assert.deepEqual([...updates[0].options.body.keys()], ['nome', 'preco', 'isDrink', 'isFood'])
    assert.ok(calls.every(call => call.options.credentials === 'include'))

    global.fetch = async url => Response.json({
      data: Number(new URL(url, 'http://local').searchParams.get('page')) === 1 ? [{ id: 1 }] : [],
      meta: { total: 2 }
    })
    await assert.rejects(fetchAllProducts(), /incompleta/)
    console.log('10 verificações do catálogo passaram')
  } finally {
    global.fetch = originalFetch
  }
}

run().catch(error => { console.error(error); process.exitCode = 1 })
