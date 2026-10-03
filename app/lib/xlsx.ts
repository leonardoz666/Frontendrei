/**
 * Gerador de `.xlsx` sem dependência externa.
 *
 * Um `.xlsx` é um ZIP (OPC) com XMLs. Aqui montamos o mínimo válido:
 *   [Content_Types].xml, _rels/.rels, xl/workbook.xml,
 *   xl/_rels/workbook.xml.rels, xl/worksheets/sheet1.xml
 * usando strings inline (`t="inlineStr"`), o que dispensa `sharedStrings.xml`.
 *
 * O ZIP é gravado sem compressão (método STORE), suficiente para planilhas de
 * exportação e ~100 linhas de código em vez de uma dependência de ~1MB.
 *
 * Também evita `eval`/parser: nada de fórmula — todo valor entra como texto ou
 * número, então não há risco de injeção de fórmula (`=cmd|...`).
 */

export type XlsxCellValue = string | number | boolean | Date | null | undefined

export const SHEET_DEFAULT_NAME = 'Planilha'

const DOS_TIME = 0x0000
const DOS_DATE = 0x0021 // 1980-01-01, data mínima do formato ZIP

/* ------------------------------------------------------------------ ZIP ---- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const centralDirectory: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true) // assinatura do local file header
    localView.setUint16(4, 20, true) // versão necessária
    localView.setUint16(6, 0, true) // flags
    localView.setUint16(8, 0, true) // método: STORE
    localView.setUint16(10, DOS_TIME, true)
    localView.setUint16(12, DOS_DATE, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, size, true)
    localView.setUint32(22, size, true)
    localView.setUint16(26, nameBytes.length, true)
    localView.setUint16(28, 0, true) // extra
    local.set(nameBytes, 30)

    chunks.push(local, entry.data)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true) // assinatura do central directory
    centralView.setUint16(4, 20, true) // versão de criação
    centralView.setUint16(6, 20, true) // versão necessária
    centralView.setUint16(8, 0, true) // flags
    centralView.setUint16(10, 0, true) // método: STORE
    centralView.setUint16(12, DOS_TIME, true)
    centralView.setUint16(14, DOS_DATE, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, size, true)
    centralView.setUint32(24, size, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint16(30, 0, true) // extra
    centralView.setUint16(32, 0, true) // comentário
    centralView.setUint16(34, 0, true) // disco
    centralView.setUint16(36, 0, true) // atributos internos
    centralView.setUint32(38, 0, true) // atributos externos
    centralView.setUint32(42, localOffset, true)
    central.set(nameBytes, 46)

    centralDirectory.push(central)
    localOffset += local.length + size
  }

  const centralSize = centralDirectory.reduce((sum, part) => sum + part.length, 0)

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true) // assinatura do EOCD
  endView.setUint16(4, 0, true) // número do disco
  endView.setUint16(6, 0, true) // disco do central directory
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, localOffset, true)
  endView.setUint16(20, 0, true) // tamanho do comentário

  return concatBytes([...chunks, ...centralDirectory, end])
}

/* ------------------------------------------------------------------ XML ---- */

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 0 -> A, 25 -> Z, 26 -> AA ... */
export function columnLetter(index: number): string {
  let n = index + 1
  let letters = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    letters = String.fromCharCode(65 + remainder) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

function cellXml(reference: string, value: XlsxCellValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return `<c r="${reference}"><v>${value}</v></c>`
  }

  if (typeof value === 'boolean') {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`
  }

  const text = value instanceof Date ? value.toISOString() : value
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim()
  return (cleaned || SHEET_DEFAULT_NAME).slice(0, 31)
}

function sheetXml(matrix: XlsxCellValue[][]): string {
  const rows = matrix.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = row
      .map((value, columnIndex) => cellXml(`${columnLetter(columnIndex)}${rowNumber}`, value))
      .join('')
    return `<row r="${rowNumber}">${cells}</row>`
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

const WORKBOOK_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
}

/* -------------------------------------------------------------- Público ---- */

/** Bytes do `.xlsx` (primeira linha tratada como cabeçalho, mas sem formatação especial). */
export function buildXlsxBytes(
  matrix: XlsxCellValue[][],
  sheetName: string = SHEET_DEFAULT_NAME
): Uint8Array {
  const encoder = new TextEncoder()
  const name = sanitizeSheetName(sheetName)

  return buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(name)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml(matrix)) },
  ])
}

/** Blob pronto para download (`application/vnd.openxmlformats-...sheet`). */
export function buildXlsxBlob(
  matrix: XlsxCellValue[][],
  sheetName: string = SHEET_DEFAULT_NAME
): Blob {
  const bytes = buildXlsxBytes(matrix, sheetName)
  // Copia para um ArrayBuffer "puro": evita inferência de SharedArrayBuffer no TS.
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
