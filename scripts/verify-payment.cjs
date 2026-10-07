require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const assert = require('node:assert/strict')
const { amountPerPerson, amountForItems, roundMoney } = require('../app/lib/payment')

const tests = [
  ['pagamento integral usa saldo restante', () => assert.equal(amountPerPerson(55, 1), 55)],
  ['divisao usa saldo restante', () => assert.equal(amountPerPerson(55, 2), 27.5)],
  ['ultima pessoa paga centavos restantes', () => {
    let balance = 10
    const payments = []
    for (let people = 3; people >= 1; people--) {
      const amount = amountPerPerson(balance, people)
      payments.push(amount)
      balance = roundMoney(balance - amount)
    }
    assert.deepEqual(payments, [3.33, 3.33, 3.34])
    assert.equal(balance, 0)
  }],
  ['itens nao excedem saldo restante', () => assert.equal(amountForItems(55, 100), 55)],
  ['itens incluem taxa uma vez', () => assert.equal(amountForItems(100, 35), 38.5)],
  ['valores decimais sao arredondados', () => assert.equal(roundMoney(1.005), 1.01)],
  ['saldo quitado nao gera nova parcela', () => assert.equal(amountPerPerson(0, 1), 0)],
  ['divisao invalida nao gera valor infinito', () => assert.equal(amountPerPerson(55, 0), 0)]
]
for (const [name, run] of tests) {
  run()
  console.log(`PASS ${name}`)
}
