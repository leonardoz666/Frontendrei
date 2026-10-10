const fs = require('node:fs')
const path = require('node:path')

const arquivo = path.resolve(__dirname, '../app/admin/estoque/lotes/page.tsx')
const fonte = fs.readFileSync(arquivo, 'utf8')

const campos = [
  ['quantidade', /onChange=\{event => atualizarAjuste\(item\.id, 'quantidade',[\s\S]*?className="([^"]+)"/],
  ['custo unitário', /onChange=\{event => atualizarAjuste\(item\.id, 'custoUnitario',[\s\S]*?className="([^"]+)"/],
  ['observação', /onChange=\{event => atualizarAjuste\(item\.id, 'observacao',[\s\S]*?className="([^"]+)"/],
]

let falhas = 0

for (const [nome, padrao] of campos) {
  const correspondencia = fonte.match(padrao)
  const classes = correspondencia?.[1] ?? ''
  const requisitos = ['bg-white', 'text-slate-900', 'focus:ring-2', 'disabled:bg-slate-100', 'disabled:text-slate-500']
  const ausentes = requisitos.filter(classe => !classes.includes(classe))

  if (ausentes.length > 0) {
    falhas += 1
    console.error(`FAIL ${nome}: faltam ${ausentes.join(', ')}`)
  } else {
    console.log(`PASS ${nome}: contraste e estados explícitos`)
  }
}

if (falhas > 0) process.exitCode = 1
else console.log('3 campos de revisão possuem contraste legível')

if (fonte.includes('window.confirm(')) {
  console.error('FAIL confirmação: a revisão ainda usa o diálogo nativo do navegador')
  process.exitCode = 1
} else if (!fonte.includes('role="alertdialog"')) {
  console.error('FAIL confirmação: falta um modal visual acessível para confirmar o lançamento')
  process.exitCode = 1
} else {
  console.log('PASS confirmação: modal visual substitui o diálogo nativo')
}
