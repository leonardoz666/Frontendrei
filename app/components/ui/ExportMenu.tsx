'use client'

import { useState } from 'react'
import { ClipboardCopy, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useToast } from '@/contexts/ToastContext'
import {
  buildPrintHtml,
  buildTsv,
  copyText,
  createCsvBlob,
  deriveColumns,
  downloadBlob,
  toMatrix,
  type ExportColumn,
  type ExportRow,
} from '../../lib/export'
import { buildXlsxBlob } from '../../lib/xlsx'
import { Button } from './Button'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type ExportFormat = 'copy' | 'excel' | 'csv' | 'pdf'

export interface ExportMenuProps {
  /**
   * Devolve as linhas da requisição ATUAL (respeitando filtros/busca/ordenação).
   * Pode ser assíncrona — o componente mostra o estado de carregando.
   */
  getRows: () => ExportRow[] | Promise<ExportRow[]>
  /** Nome base do arquivo, sem extensão (ex.: "produtos"). */
  fileName: string
  /** Colunas e cabeçalhos. Se omitido, derivado das chaves da primeira linha. */
  columns?: ExportColumn[]
  /** Título usado no PDF/impressão. Default: `fileName`. */
  title?: string
  className?: string
  disabled?: boolean
}

function sanitizeFileName(fileName: string): string {
  const cleaned = fileName.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')
  return cleaned || 'exportacao'
}

/**
 * RF-UI-02 — Copiar / Excel (.xlsx) / CSV / PDF, alimentado pela requisição
 * atual da lista.
 *
 * Tudo é gerado no cliente, sem dependência nova:
 *  - Copiar: TSV na área de transferência (colar direto no Excel/Sheets)
 *  - Excel: .xlsx real montado em `lib/xlsx.ts` (ZIP + XML, sem biblioteca)
 *  - CSV: Blob `text/csv` com separador `;` e BOM UTF-8 (Excel pt-BR)
 *  - PDF: janela formatada + `window.print()` ("Salvar como PDF" no diálogo)
 */
export function ExportMenu({
  getRows,
  fileName,
  columns,
  title,
  className,
  disabled = false,
}: ExportMenuProps) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState<ExportFormat | null>(null)

  const isBusy = busy !== null

  async function resolveData(): Promise<{ rows: ExportRow[]; cols: ExportColumn[] } | null> {
    const rows = await getRows()
    if (!rows || rows.length === 0) {
      showToast('Nenhum registro para exportar.', 'warning')
      return null
    }
    const cols = columns && columns.length > 0 ? columns : deriveColumns(rows)
    if (cols.length === 0) {
      showToast('Não foi possível determinar as colunas da exportação.', 'warning')
      return null
    }
    return { rows, cols }
  }

  async function run(format: ExportFormat) {
    if (isBusy) return
    setBusy(format)

    try {
      const data = await resolveData()
      if (!data) return

      const baseName = sanitizeFileName(fileName)
      const documentTitle = title ?? fileName

      if (format === 'copy') {
        const copied = await copyText(buildTsv(data.cols, data.rows))
        showToast(
          copied
            ? `${data.rows.length} registro(s) copiado(s) para a área de transferência.`
            : 'Não foi possível copiar. Verifique a permissão de área de transferência.',
          copied ? 'success' : 'error'
        )
        return
      }

      if (format === 'csv') {
        downloadBlob(createCsvBlob(data.cols, data.rows), `${baseName}.csv`)
        showToast('CSV gerado com sucesso.', 'success')
        return
      }

      if (format === 'excel') {
        downloadBlob(buildXlsxBlob(toMatrix(data.cols, data.rows), documentTitle), `${baseName}.xlsx`)
        showToast('Planilha Excel gerada com sucesso.', 'success')
        return
      }

      openPrintWindow(documentTitle, data.cols, data.rows, showToast)
    } catch (error) {
      console.error('[ExportMenu] falha ao exportar', error)
      showToast('Falha ao gerar a exportação.', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run('copy')}
        disabled={disabled || isBusy}
        title="Copiar os registros exibidos (colar no Excel)"
      >
        {busy === 'copy' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ClipboardCopy className="mr-1.5 h-4 w-4" />}
        Copiar
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run('excel')}
        disabled={disabled || isBusy}
        title="Baixar planilha .xlsx"
      >
        {busy === 'excel' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1.5 h-4 w-4" />}
        Excel
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run('csv')}
        disabled={disabled || isBusy}
        title="Baixar arquivo .csv"
      >
        {busy === 'csv' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
        CSV
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => run('pdf')}
        disabled={disabled || isBusy}
        title="Imprimir ou salvar em PDF"
      >
        {busy === 'pdf' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Printer className="mr-1.5 h-4 w-4" />}
        PDF
      </Button>
    </div>
  )
}

function openPrintWindow(
  documentTitle: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
): void {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if (!printWindow) {
    showToast('Não foi possível abrir a janela de impressão. Libere pop-ups para este site.', 'error')
    return
  }

  printWindow.document.open()
  printWindow.document.write(
    buildPrintHtml({
      title: documentTitle,
      subtitle: `${rows.length} registro(s) • ${new Date().toLocaleString('pt-BR')}`,
      columns,
      rows,
    })
  )
  printWindow.document.close()
  printWindow.focus()

  // Pequeno atraso para o layout da tabela estar pronto antes do diálogo.
  setTimeout(() => {
    try {
      printWindow.print()
    } catch (error) {
      console.error('[ExportMenu] falha ao abrir impressão', error)
    }
  }, 300)
}

export default ExportMenu
