import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3000/api'

type Categoria = {
  id: number
  nome: string
  setor: string
  produtos: Array<{ id: number; nome: string; preco: number }>
}

async function runTest() {
  console.log('Starting Order Flow Test...')

  // 0. Login
  console.log('\n0. Logging in...')
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'admin', senha: '123456' })
  })

  if (!loginRes.ok) {
    throw new Error('Login failed')
  }

  const cookie = loginRes.headers.get('set-cookie')
  if (!cookie) {
    throw new Error('No cookie received')
  }
  console.log('Logged in successfully')

  const headers = {
    'Cookie': cookie,
    'Content-Type': 'application/json'
  }

  // 1. Fetch Products
  console.log('\n1. Fetching Products...')
  const productsRes = await fetch(`${BASE_URL}/products`, { headers })
  const categories = (await productsRes.json()) as Categoria[]
  
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error('No products found')
  }
  
  // Find a Kitchen product and a Bar product
  const kitchenCat = categories.find((c) => c.setor === 'COZINHA')
  const barCat = categories.find((c) => c.setor === 'BAR')
  
  const food = kitchenCat?.produtos[0]
  const drink = barCat?.produtos[0]

  if (!food || !drink) {
    throw new Error('Could not find both kitchen and bar products')
  }
  
  console.log(`Found Food: ${food.nome} ($${food.preco})`)
  console.log(`Found Drink: ${drink.nome} ($${drink.preco})`)

  // 2. Create Order
  console.log('\n2. Creating Order for Table 5...')
  const orderPayload = {
    mesaId: 5,
    itens: [
      { produtoId: food.id, quantidade: 2, observacao: 'Bem passado' },
      { produtoId: drink.id, quantidade: 3, observacao: 'Com gelo e limão' }
    ]
  }

  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(orderPayload)
  })

  const orderData = await orderRes.json()
  console.log('Order Response:', orderData)

  if (!orderData.success) {
    throw new Error('Failed to create order')
  }

  console.log('\nSUCCESS! Order created.')
}

runTest().catch(console.error)
