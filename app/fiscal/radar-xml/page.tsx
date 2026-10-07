'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, DownloadCloud, FileSearch, Upload } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { apiFetch } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

type PessoaXml = {
  documento: string | null
  nome: string | null
  ie: string | null
}

type ItemXml = {
  numero: number
  codigo: string | null
  descricao: string | null
  ncm: string | null
  cfop: string | null
  unidade: string | null
  quantidade: number
  valorUnitario: number
  valorTotal: number
}

type RadarXmlResumo = {
  chave: string | null
  modelo: string | null
  numero: string | null
  serie: string | null
  emitidaEm: string | null
  emitente: PessoaXml
  destinatario: PessoaXml
  totais: {
    produtos: number
    nota: number
  }
  itens: ItemXml[]
  alertas: string[]
  tipoDocumento: 'NFE' | 'NFCE' | 'DESCONHECIDO'
  usoEsperado: 'COMPRA' | 'VENDA' | 'DESCONHECIDO'
}

type RadarDfeStatus = {
  servico: string
  endpoint: string
  finalidade: string
  emiteNota: false
  prontoParaConsulta: boolean
  pendencias: string[]
  requisitos: string[]
  controle?: {
    ultimoNsu: string
    maxNsu: string | null
    ultimaConsultaEm: string | null
    status: string
    ultimoErro: string | null
  }
}

type XmlRecebido = {
  id: number
  nsu: string
  tipoDocumento: string
  chave: string | null
  numero: string | null
  serie: string | null
  emitidaEm: string | null
  emitenteDoc: string | null
  emitenteNome: string | null
  valorTotal: number
  statusConferencia: string
  statusManifestacao: string
  recebidoEm: string
}

type TipoManifestacao = 'CIENCIA' | 'CONFIRMACAO' | 'DESCONHECIMENTO' | 'NAO_REALIZADA'

type ListaApi<T> = {
  data: T[]
  meta: {
    total: number
  }
}

function dinheiro(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0))
}

function dataFiscal(valor: string | null): string {
  if (!valor) return '-'
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString('pt-BR')
}

function documento(valor: string | null): string {
  if (!valor) return '-'
  if (valor.length === 14) return valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  if (valor.length === 11) return valor.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  return valor
}

export default function RadarXmlPage() {
  const { showToast } = useToast()
  const [xml, setXml] = useState('')
  const [resultado, setResultado] = useState<RadarXmlResumo | null>(null)
  const [status, setStatus] = useState<RadarDfeStatus | null>(null)
  const [recebidos, setRecebidos] = useState<XmlRecebido[]>([])
  const [analisando, setAnalisando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [manifestandoId, setManifestandoId] = useState<number | null>(null)
  const [manifestacoes, setManifestacoes] = useState<Record<number, TipoManifestacao>>({})
  const [activeTab, setActiveTab] = useState<'sefaz' | 'manual'>('sefaz')

  const carregarRadar = useCallback(async () => {
    const [statusAtual, lista] = await Promise.all([
      apiFetch<RadarDfeStatus>('/fiscal/radar-xml/status'),
      apiFetch<ListaApi<XmlRecebido>>('/fiscal/radar-xml/recebidos?page=1&pageSize=10&sort=recebidoEm&order=desc'),
    ])
    setStatus(statusAtual)
    setRecebidos(lista.data)
  }, [])

  useEffect(() => {
    carregarRadar()
      .catch((err) => showToast(err instanceof Error ? err.message : 'Erro ao carregar Radar XML', 'error'))
  }, [carregarRadar, showToast])

  const resumoUso = useMemo(() => {
    if (!resultado) return null
    if (resultado.usoEsperado === 'COMPRA') return 'NF-e de fornecedor, própria para conferência de compras e entrada de insumos.'
    if (resultado.usoEsperado === 'VENDA') return 'NFC-e de venda. Use para conferência, não como XML de compra.'
    return 'Documento fiscal reconhecido parcialmente.'
  }, [resultado])

  const analisar = async (event: FormEvent) => {
    event.preventDefault()
    if (!xml.trim()) {
      showToast('Cole ou carregue um XML antes de analisar', 'warning')
      return
    }
    setAnalisando(true)
    try {
      const resposta = await apiFetch<RadarXmlResumo>('/fiscal/radar-xml/analisar', {
        method: 'POST',
        body: { xml },
      })
      setResultado(resposta)
      showToast('XML analisado', resposta.alertas.length ? 'warning' : 'success')
    } catch (err) {
      setResultado(null)
      showToast(err instanceof Error ? err.message : 'Erro ao analisar XML', 'error')
    } finally {
      setAnalisando(false)
    }
  }

  const carregarArquivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0]
    if (!arquivo) return
    const conteudo = await arquivo.text()
    setXml(conteudo)
    setResultado(null)
  }

  const importarXml = async () => {
    if (!xml.trim()) {
      showToast('Cole ou carregue um XML antes de salvar no radar', 'warning')
      return
    }
    setImportando(true)
    try {
      await apiFetch('/fiscal/radar-xml/importar', { method: 'POST', body: { xml } })
      showToast('XML salvo no Radar', 'success')
      await carregarRadar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar XML no Radar', 'error')
    } finally {
      setImportando(false)
    }
  }

  const sincronizarSefaz = async () => {
    setSincronizando(true)
    try {
      const resposta = await apiFetch<{ documentosRecebidos: number; documentosNovos: number; motivo: string | null }>('/fiscal/radar-xml/sincronizar', { method: 'POST' })
      showToast(`${resposta.documentosRecebidos} documento(s) retornado(s) pela SEFAZ`, resposta.documentosRecebidos > 0 ? 'success' : 'warning')
      await carregarRadar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao consultar SEFAZ por NSU', 'error')
      await carregarRadar().catch(() => undefined)
    } finally {
      setSincronizando(false)
    }
  }

  const atualizarConferencia = async (item: XmlRecebido, statusConferencia: string) => {
    try {
      await apiFetch(`/fiscal/radar-xml/recebidos/${item.id}/conferencia`, {
        method: 'PATCH',
        body: { statusConferencia },
      })
      showToast('Status de conferência atualizado', 'success')
      await carregarRadar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar conferência', 'error')
    }
  }

  const manifestar = async (item: XmlRecebido) => {
    const tipo = manifestacoes[item.id] ?? 'CIENCIA'
    let justificativa: string | undefined
    if (tipo === 'NAO_REALIZADA') {
      justificativa = window.prompt('Informe o motivo da operação não realizada (mínimo de 15 caracteres):')?.trim()
      if (!justificativa) return
      if (justificativa.length < 15) {
        showToast('A justificativa deve ter pelo menos 15 caracteres', 'warning')
        return
      }
    }
    setManifestandoId(item.id)
    try {
      const resposta = await apiFetch<{ avisoConsulta: string | null }>(`/fiscal/radar-xml/recebidos/${item.id}/manifestar`, {
        method: 'POST',
        body: { tipo, justificativa },
      })
      showToast(resposta.avisoConsulta ?? 'Manifestação enviada à SEFAZ', resposta.avisoConsulta ? 'warning' : 'success')
      await carregarRadar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao manifestar documento', 'error')
    } finally {
      setManifestandoId(null)
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="mb-2 text-3xl font-bold text-black">Radar XML SEFAZ</h1>
          <p className="max-w-3xl text-sm text-gray-600">
            Analise XML de NF-e recebido de fornecedor, confira emitente, chave, totais e itens antes de lançar compras ou insumos.
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="Radar XML" className="mb-6 flex w-fit max-w-full gap-1 rounded-lg bg-slate-100 p-1">
        <button type="button" role="tab" aria-selected={activeTab === 'sefaz'} onClick={() => setActiveTab('sefaz')} className={`rounded-md border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 ${activeTab === 'sefaz' ? 'border-orange-600 bg-orange-600 text-white shadow-sm' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:text-slate-950'}`}>Consulta SEFAZ</button>
        <button type="button" role="tab" aria-selected={activeTab === 'manual'} onClick={() => setActiveTab('manual')} className={`rounded-md border px-4 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1 ${activeTab === 'manual' ? 'border-orange-600 bg-orange-600 text-white shadow-sm' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:text-slate-950'}`}>Analisar XML</button>
      </div>

      {activeTab === 'manual' && <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileSearch className="mt-1 shrink-0 text-orange-600" size={22} />
            <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Analisar documento</h2>
            <p className="text-sm text-gray-600">Cole o conteúdo completo do XML autorizado ou envie o arquivo recebido do fornecedor.</p>
            </div>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-orange-500">
            <Upload size={16} /> Carregar XML
            <input type="file" accept=".xml,text/xml,application/xml" className="sr-only" onChange={carregarArquivo} />
          </label>
        </div>
        <form onSubmit={analisar} className="space-y-3">
          <textarea
            aria-label="Conteúdo XML"
            value={xml}
            onChange={(event) => {
              setXml(event.target.value)
              setResultado(null)
            }}
            placeholder="<?xml version=&quot;1.0&quot; encoding=&quot;UTF-8&quot;?>"
            className="min-h-32 max-h-72 w-full resize-y rounded-md border border-gray-300 p-3 font-mono text-xs text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={analisando}>Analisar XML</Button>
            <Button type="button" variant="outline" onClick={() => void importarXml()} isLoading={importando}>
              Salvar no Radar
            </Button>
            <Button type="button" variant="outline" onClick={() => { setXml(''); setResultado(null) }}>
              Limpar
            </Button>
          </div>
        </form>
      </section>}

      {activeTab === 'sefaz' && <section className="mb-6 grid gap-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Distribuição DF-e</h2>
              {status && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.prontoParaConsulta ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>{status.prontoParaConsulta ? 'Pronto' : 'Pendente'}</span>}
            </div>
            <Button type="button" onClick={() => void sincronizarSefaz()} isLoading={sincronizando} disabled={!status?.prontoParaConsulta}>
              <DownloadCloud size={16} className="mr-2" /> Consultar SEFAZ
            </Button>
          </div>
          <p className="mb-3 text-sm text-gray-600">{status?.finalidade ?? 'Carregando status do serviço.'}</p>
          <p className="mb-4 text-xs text-slate-500">O último NSU é iniciado automaticamente na primeira consulta.</p>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-gray-500">Serviço</dt>
              <dd className="font-medium text-gray-900">{status?.servico ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Pronto para consulta</dt>
              <dd className={status?.prontoParaConsulta ? 'font-medium text-green-700' : 'font-medium text-amber-700'}>
                {status ? (status.prontoParaConsulta ? 'Sim' : 'Pendente') : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Último NSU</dt>
              <dd className="font-mono text-xs font-medium text-gray-900">{status?.controle?.ultimoNsu ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Maior NSU</dt>
              <dd className="font-mono text-xs font-medium text-gray-900">{status?.controle?.maxNsu ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Última consulta</dt>
              <dd className="font-medium text-gray-900">{status?.controle?.ultimaConsultaEm ? dataFiscal(status.controle.ultimaConsultaEm) : '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="font-medium text-gray-900">{status?.controle?.status ?? '-'}</dd>
            </div>
            {status?.controle?.ultimoErro && (
              <div className="md:col-span-2">
                <dt className="text-gray-500">Último erro</dt>
                <dd className="text-amber-700">{status.controle.ultimoErro}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="min-w-0 border-t border-gray-100 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Pendências</h2>
          {status && status.pendencias.length === 0 ? (
            <p className="text-sm font-medium text-green-700">Configuração mínima presente.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {(status?.pendencias ?? ['Carregando...']).map((item) => <li key={item} className="border-b border-gray-100 pb-2 last:border-0">{item}</li>)}
            </ul>
          )}
          {status && status.pendencias.length > 0 && <Link href="/admin/fiscal" className="mt-4 inline-block text-sm font-semibold text-orange-700 hover:text-orange-800">Abrir configuração fiscal</Link>}
        </div>
      </section>}

      {activeTab === 'manual' && resultado && (
        <section className="space-y-6">
          {resultado.alertas.length > 0 && (
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Atenção no XML</p>
                <ul className="mt-1 space-y-1">
                  {resultado.alertas.map((alerta) => <li key={alerta}>• {alerta}</li>)}
                </ul>
              </div>
            </div>
          )}

          <div className="border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">Resumo</h2>
            <p className="mb-4 text-sm text-gray-600">{resumoUso}</p>
            <dl className="grid gap-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-gray-500">Modelo</dt>
                <dd className="font-medium text-gray-900">{resultado.modelo ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Série / número</dt>
                <dd className="font-medium text-gray-900">{resultado.serie ?? '-'}/{resultado.numero ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Emissão</dt>
                <dd className="font-medium text-gray-900">{dataFiscal(resultado.emitidaEm)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Valor da nota</dt>
                <dd className="font-medium text-gray-900">{dinheiro(resultado.totais.nota)}</dd>
              </div>
              <div className="md:col-span-4">
                <dt className="text-gray-500">Chave de acesso</dt>
                <dd className="break-all font-mono text-xs font-medium text-gray-900">{resultado.chave ?? '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Emitente</h2>
              <p className="font-medium text-gray-900">{resultado.emitente.nome ?? '-'}</p>
              <p className="text-sm text-gray-600">{documento(resultado.emitente.documento)}</p>
              <p className="text-sm text-gray-600">IE {resultado.emitente.ie ?? '-'}</p>
            </div>
            <div className="border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Destinatário</h2>
              <p className="font-medium text-gray-900">{resultado.destinatario.nome ?? '-'}</p>
              <p className="text-sm text-gray-600">{documento(resultado.destinatario.documento)}</p>
              <p className="text-sm text-gray-600">IE {resultado.destinatario.ie ?? '-'}</p>
            </div>
          </div>

          <div className="overflow-hidden border-y border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-4 sm:px-5">
              <h2 className="text-lg font-semibold text-gray-900">Itens</h2>
              <span className="text-sm text-gray-600">{resultado.itens.length} item(ns)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">NCM</th>
                    <th className="px-3 py-2">CFOP</th>
                    <th className="px-3 py-2 text-right">Qtd.</th>
                    <th className="px-3 py-2 text-right">Unit.</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resultado.itens.map((item) => (
                    <tr key={`${item.numero}-${item.codigo ?? item.descricao}`}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{item.numero}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{item.codigo ?? '-'}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{item.descricao ?? '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{item.ncm ?? '-'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{item.cfop ?? '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{item.quantidade}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{dinheiro(item.valorUnitario)}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{dinheiro(item.valorTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'sefaz' && <section className="mt-6 overflow-hidden border-y border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">XMLs recebidos</h2>
            <p className="text-sm text-gray-600">Histórico vindo da consulta por NSU e importações manuais.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void carregarRadar()}>
            Atualizar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-y border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">NSU</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Emitente</th>
                <th className="px-3 py-2">Emissão</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Conferência</th>
                <th className="px-3 py-2">Manifestação</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recebidos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">Nenhum XML recebido ainda</td>
                </tr>
              )}
              {recebidos.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{item.nsu}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{item.tipoDocumento} {item.serie && item.numero ? `${item.serie}/${item.numero}` : ''}</p>
                    <p className="max-w-[260px] break-all font-mono text-xs text-gray-500">{item.chave ?? '-'}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{item.emitenteNome ?? '-'}</p>
                    <p className="text-xs text-gray-500">{documento(item.emitenteDoc)}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-700">{dataFiscal(item.emitidaEm)}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">{dinheiro(item.valorTotal)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{item.statusConferencia}</td>
                  <td className="px-3 py-2">
                    <p className="mb-2 text-xs font-semibold text-gray-700">{item.statusManifestacao}</p>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Manifestação da nota ${item.numero ?? item.id}`}
                        value={manifestacoes[item.id] ?? 'CIENCIA'}
                        onChange={(event) => setManifestacoes((atual) => ({ ...atual, [item.id]: event.target.value as TipoManifestacao }))}
                        className="h-9 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="CIENCIA">Ciência</option>
                        <option value="CONFIRMACAO">Confirmar operação</option>
                        <option value="DESCONHECIMENTO">Desconhecer operação</option>
                        <option value="NAO_REALIZADA">Operação não realizada</option>
                      </select>
                      <Button type="button" size="sm" onClick={() => void manifestar(item)} isLoading={manifestandoId === item.id} disabled={!item.chave}>
                        Enviar
                      </Button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void atualizarConferencia(item, 'CONFERIDO')}>
                        Conferido
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => void atualizarConferencia(item, 'IGNORADO')}>
                        Ignorar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>}
    </div>
  )
}
