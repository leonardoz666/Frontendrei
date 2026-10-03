/**
 * Helpers PUROS de exportação (sem React e sem dependência externa).
 *
 * Separados do componente `ExportMenu` para poderem ser reaproveitados por
 * qualquer tela e testados sem DOM. A geração de `.xlsx` mora em `./xlsx`.
 */

export const CSV_DELIMITER = ';'
export const CSV_BOM = '\uFEFF'
export const CSV_MIME = 'text/csv;charset=utf-8'
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export interface ExportColumn {
  /** Chave do campo na linha. */
  key: string
  /** Cabeçalho exibido/exportado. */
  label: string
}

export type ExportRow = Record<string, unknown>

/**
 * Valor de uma célula em texto.
 * Decisões: `null`/`undefined` -> vazio; booleano -> Sim/Não (pt-BR);
 * `Date` -> formato brasileiro; objeto -> JSON (evita `[object Object]`).
 */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toLocaleString('pt-BR')
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Cabeçalhos + linhas já formatadas como texto. */
export function toMatrix(columns: ExportColumn[], rows: ExportRow[]): string[][] {
  return [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => formatCell(row[column.key]))),
  ]
}

/** Colunas derivadas da primeira linha quando a tela não informa as colunas. */
export function deriveColumns(rows: ExportRow[]): ExportColumn[] {
  const first = rows[0]
  if (!first || typeof first !== 'object') return []
  return Object.keys(first).map((key) => ({ key, label: key }))
}

function quoteDelimited(value: string, delimiter: string): string {
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** CSV/DSV genérico com quebra de linha CRLF (o que o Excel espera). */
export function buildDelimited(
  columns: ExportColumn[],
  rows: ExportRow[],
  delimiter: string = CSV_DELIMITER
): string {
  return toMatrix(columns, rows)
    .map((line) => line.map((cell) => quoteDelimited(cell, delimiter)).join(delimiter))
    .join('\r\n')
}

/**
 * CSV pronto para o Excel pt-BR: separador `;` + BOM UTF-8 (garante acentuação).
 * Para CSV RFC 4180 puro use `buildDelimited(columns, rows, ',')`.
 */
export function buildCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  return CSV_BOM + buildDelimited(columns, rows, CSV_DELIMITER)
}

/** TSV para a área de transferência — tabs/newlines internos viram espaço. */
export function buildTsv(columns: ExportColumn[], rows: ExportRow[]): string {
  return toMatrix(columns, rows)
    .map((line) => line.map((cell) => cell.replace(/[\t\r\n]+/g, ' ')).join('\t'))
    .join('\n')
}

export function createBlob(content: string, mimeType: string): Blob {
  return new Blob([content], { type: mimeType })
}

export function createCsvBlob(columns: ExportColumn[], rows: ExportRow[]): Blob {
  return createBlob(buildCsv(columns, rows), CSV_MIME)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface PrintDocumentOptions {
  title: string
  subtitle?: string
  columns: ExportColumn[]
  rows: ExportRow[]
}

/**
 * Documento HTML formatado para `window.print()` / "Salvar como PDF".
 * Não usa biblioteca de PDF: o usuário escolhe "Salvar como PDF" no diálogo do
 * navegador (decisão registrada — evita dependência pesada no bundle).
 */
export function buildPrintHtml({ title, subtitle, columns, rows }: PrintDocumentOptions): string {
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')
  const body = rows
    .map((row, index) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(formatCell(row[column.key]))}</td>`)
        .join('')
      const stripe = index % 2 === 1 ? ' class="stripe"' : ''
      return `<tr${stripe}>${cells}</tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #111827; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #ea580c; color: #fff; }
  tr.stripe td { background: #f9fafb; }
  @page { margin: 12mm; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
<button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;border:0;border-radius:8px;background:#ea580c;color:#fff;font-weight:600;cursor:pointer;">Imprimir</button>
<table>
<thead><tr>${head}</tr></thead>
<tbody>${body}</tbody>
</table>
</body>
</html>`
}

/** Dispara o download de um Blob no navegador. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Firefox precisa do objectURL vivo até o download começar.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Copia texto para a área de transferência.
 * Usa a Clipboard API e cai para o `textarea` + `execCommand` quando a API não
 * existe ou é bloqueada (contexto não-secure, permissão negada).
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // segue para o fallback
    }
  }

  if (typeof document === 'undefined') {
    return false
  }

  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'readonly')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}
