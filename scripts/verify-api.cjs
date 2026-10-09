require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const assert = require('node:assert/strict')

const originalFetch = global.fetch

async function main() {
  const { apiFetch, ApiError, invalidateAuthMeCache } = require('../app/lib/api')

  let calls = 0
  global.fetch = async () => {
    calls += 1
    if (calls < 3) {
      return new Response('', { status: 503, headers: { 'retry-after': '0' } })
    }
    return Response.json({ user: { id: 1, role: 'GARCOM' } })
  }
  const recovered = await apiFetch('/auth/me', { redirectOn401: false })
  assert.equal(recovered.user.id, 1)
  assert.equal(calls, 3, 'GET transitório deve tentar novamente')

  invalidateAuthMeCache()
  calls = 0
  global.fetch = async () => {
    calls += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return Response.json({ user: { id: 2, role: 'CAIXA' } })
  }
  const [first, second] = await Promise.all([
    apiFetch('/auth/me', { redirectOn401: false }),
    apiFetch('/auth/me', { redirectOn401: false })
  ])
  assert.equal(calls, 1, 'chamadas simultâneas a /auth/me devem compartilhar a mesma requisição')
  assert.deepEqual(first, second)
  await apiFetch('/auth/me', { redirectOn401: false })
  assert.equal(calls, 1, 'resultado de /auth/me deve usar o cache curto')

  invalidateAuthMeCache()
  calls = 0
  global.fetch = async () => {
    calls += 1
    return new Response('', { status: 503, headers: { 'retry-after': '0' } })
  }
  await assert.rejects(
    apiFetch('/auth/me', { redirectOn401: false }),
    error => error instanceof ApiError && error.status === 503 && /temporariamente indisponível/.test(error.message)
  )
  assert.equal(calls, 4, 'tentativas devem ser limitadas')

  console.log('8 verificações de resiliência da API passaram')
}

main()
  .finally(() => { global.fetch = originalFetch })
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
