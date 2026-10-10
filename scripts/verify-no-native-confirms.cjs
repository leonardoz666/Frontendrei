const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const appDir = path.resolve(__dirname, '..', 'app')
const violations = []

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(fullPath)
    return /\.tsx?$/.test(entry.name) ? [fullPath] : []
  })
}

for (const filePath of sourceFiles(appDir)) {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const nativeConfirm =
        (ts.isIdentifier(expression) && expression.text === 'confirm') ||
        (ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          expression.expression.text === 'window' &&
          expression.name.text === 'confirm')

      if (nativeConfirm) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        violations.push(`${path.relative(appDir, filePath)}:${position.line + 1}`)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

if (violations.length > 0) {
  console.error('Confirmações nativas encontradas:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('OK: nenhuma chamada nativa a confirm() no frontend.')
