'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { apiFetch, apiRequest } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

type TipoImportacao = 'PRODUTO_SEM_TAMANHO' | 'PRODUTO_COM_TAMANHO'

type ErroImportacao = {
  linha: number
  coluna: string
  mensagem: string
}

type LinhaImportacao = {
  linha: number
  categoria: string
  codigo: string
  item: string
  venda: number
  custo: number
  tipo?: string
  tamanho?: string
  valorTamanho?: number
  produtoExistenteId?: number
}

type PreviewImportacao = {
  hash: string
  tipo: TipoImportacao
  linhas: LinhaImportacao[]
  erros: ErroImportacao[]
  resumo: {
    validas: number
    invalidas: number
    novasCategorias: number
    produtosNovos: number
    produtosAtualizados: number
  }
}

function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ImportarCardapioPage() {
  const { showToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [tipo, setTipo] = useState<TipoImportacao>('PRODUTO_SEM_TAMANHO')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewImportacao | null>(null)
  const [carregandoModelo, setCarregandoModelo] = useState(false)
  const [enviandoPreview, setEnviandoPreview] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const montarFormData = (file: File, hash?: string) => {
    const formData = new FormData()
    formData.append('arquivo', file)
    formData.append('tipo', tipo)
    if (hash) formData.append('hash', hash)
    return formData
  }

  const baixarModelo = async () => {
    setCarregandoModelo(true)
    try {
      const resposta = await apiRequest(`/importacao/modelo?tipo=${tipo}`)
      const blob = await resposta.blob()
      baixarBlob(blob, `modelo-cardapio-${tipo === 'PRODUTO_COM_TAMANHO' ? 'com-tamanho' : 'sem-tamanho'}.xlsx`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao baixar modelo', 'error')
    } finally {
      setCarregandoModelo(false)
    }
  }

  const enviarPreview = async (file: File) => {
    setArquivo(file)
    setPreview(null)
    setEnviandoPreview(true)
    try {
      const resposta = await apiFetch<PreviewImportacao>('/importacao/preview', {
        method: 'POST',
        body: montarFormData(file),
      })
      setPreview(resposta)
      showToast(
        resposta.erros.length > 0
          ? `${resposta.erros.length} erro(s) encontrados na planilha`
          : 'Preview gerado sem erros',
        resposta.erros.length > 0 ? 'warning' : 'success'
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao validar planilha', 'error')
    } finally {
      setEnviandoPreview(false)
    }
  }

  const confirmar = async () => {
    if (!arquivo || !preview) return
    setConfirmando(true)
    try {
      const resposta = await apiFetch<PreviewImportacao>('/importacao/confirmar', {
        method: 'POST',
        body: montarFormData(arquivo, preview.hash),
      })
      setPreview(resposta)
      showToast(
        `Importação concluída: ${resposta.resumo.produtosNovos} novos, ${resposta.resumo.produtosAtualizados} atualizados`,
        'success'
      )
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao confirmar importação', 'error')
    } finally {
      setConfirmando(false)
    }
  }

  const podeConfirmar = Boolean(arquivo && preview && preview.erros.length === 0 && preview.linhas.length > 0)

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-black">Importar Cardápio</h1>
          <p className="mt-1 text-sm text-gray-600">
            Valide a planilha antes de gravar produtos, categorias e tamanhos.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={baixarModelo} isLoading={carregandoModelo}>
          <Download className="mr-2 h-4 w-4" />
          Baixar modelo
        </Button>
      </div>

      <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <div className="grid gap-4 md:grid-cols-[280px_1fr_auto] md:items-end">
          <div>
            <label htmlFor="tipo-importacao" className="mb-1 block text-sm font-medium text-black">
              Tipo de importação
            </label>
            <select
              id="tipo-importacao"
              value={tipo}
              onChange={(event) => {
                setTipo(event.target.value as TipoImportacao)
                setPreview(null)
                setArquivo(null)
              }}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="PRODUTO_SEM_TAMANHO">Produto sem tamanho</option>
              <option value="PRODUTO_COM_TAMANHO">Produto com tamanho</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-orange-400 hover:bg-orange-50"
          >
            <Upload className="h-4 w-4" />
            {arquivo ? arquivo.name : 'Selecionar .xlsx ou .csv'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void enviarPreview(file)
              event.target.value = ''
            }}
          />

          <Button type="button" onClick={confirmar} disabled={!podeConfirmar} isLoading={confirmando}>
            Confirmar importação
          </Button>
        </div>
      </section>

      {enviandoPreview && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <FileSpreadsheet className="h-4 w-4" />
          Lendo e validando planilha...
        </div>
      )}

      {preview && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-5">
            {[
              ['Válidas', preview.resumo.validas],
              ['Inválidas', preview.resumo.invalidas],
              ['Categorias novas', preview.resumo.novasCategorias],
              ['Produtos novos', preview.resumo.produtosNovos],
              ['Atualizados', preview.resumo.produtosAtualizados],
            ].map(([label, value]) => (
              <div key={label} className="border-y border-gray-200 bg-white px-4 py-4 sm:px-5">
                <div className="text-xs font-medium uppercase text-gray-500">{label}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
              </div>
            ))}
          </div>

          {preview.erros.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Erros encontrados
              </h2>
              <div className="overflow-hidden rounded-lg border border-red-200">
                <table className="w-full text-sm">
                  <thead className="bg-red-50 text-left text-red-800">
                    <tr>
                      <th className="px-3 py-2">Linha</th>
                      <th className="px-3 py-2">Coluna</th>
                      <th className="px-3 py-2">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {preview.erros.slice(0, 50).map((erro, index) => (
                      <tr key={`${erro.linha}-${erro.coluna}-${index}`}>
                        <td className="px-3 py-2 text-gray-700">{erro.linha || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-700">{erro.coluna}</td>
                        <td className="px-3 py-2 text-gray-700">{erro.mensagem}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">Prévia das linhas válidas</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-700">
                  <tr>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Categoria</th>
                    <th className="px-3 py-2 text-right">Venda</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {preview.linhas.slice(0, 100).map((linha) => (
                    <tr key={`${linha.linha}-${linha.codigo}`}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{linha.codigo}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {linha.item}
                        {linha.tamanho && (
                          <span className="ml-2 text-xs text-gray-500">
                            {linha.tipo} · {linha.tamanho} · {moeda(linha.valorTamanho ?? 0)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{linha.categoria}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{moeda(linha.venda)}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {linha.produtoExistenteId ? 'Atualiza existente' : 'Novo produto'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
