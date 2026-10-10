'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { apiFetch, apiRequest } from '@/app/lib/api'
import { paginaAtual, useListaCrud } from '@/app/lib/crud-client'
import { usePagedQuery } from '@/app/lib/pagination'
import { useToast } from '@/contexts/ToastContext'

type EmpresaFiscal = {
  id: number
  razaoSocial: string
  cnpj: string
  regime: string
  crt: string
  ambiente: string
  serieNfce: string
  serieNfe: string
  cscConfigurado?: boolean
  certificadoSenhaConfigurada?: boolean
  certificadoPath?: string | null
  cscId?: string | null
}

type ProdutoFiscalPendente = {
  id: number
  nome: string
  ncm: string | null
  cfop: string | null
  cstCsosn: string | null
  aliquotaIcms: number | string | null
  pendencias: string[]
}

type CheckProdutos = {
  data: ProdutoFiscalPendente[]
  meta: { total: number; pendentes: number }
}

type ClienteFiscal = {
  id: number
  nome: string
  documento: string
}

type NotaFiscal = {
  id: number
  tipo: string
  numero: number
  serie: string
  status: string
  ambiente: string
  valorTotal: number | string
  chave: string | null
  protocolo: string | null
  motivoRejeicao: string | null
  emitidaEm: string
  canceladaEm: string | null
  cliente: ClienteFiscal | null
}

type Inutilizacao = {
  id: number
  tipo: string
  serie: string
  numeroIni: number
  numeroFim: number
  justificativa: string
  protocolo: string | null
  status: string
  criadoEm: string
}

type FilaFiscal = {
  id: number
  operacao: string
  status: string
  tentativas: number
  ultimoErro: string | null
  agendadoPara: string
  nota: NotaFiscal | null
}

type ListaApi<T> = {
  data: T[]
  meta?: { total: number }
}

type FormState = {
  razaoSocial: string
  cnpj: string
  regime: string
  crt: string
  ambiente: string
  serieNfce: string
  serieNfe: string
  cscId: string
  csc: string
  certificadoPath: string
  certificadoSenha: string
}

type ProviderStatus = {
  provider: string
  enabled: boolean
  host?: string
  port?: number
  conectado: boolean
  resposta?: string
  erro?: string
}

const FORM_VAZIO: FormState = {
  razaoSocial: '',
  cnpj: '',
  regime: 'SIMPLES_NACIONAL',
  crt: '1',
  ambiente: 'HOMOLOGACAO',
  serieNfce: '1',
  serieNfe: '1',
  cscId: '',
  csc: '',
  certificadoPath: '',
  certificadoSenha: '',
}

const INUTILIZACAO_VAZIA = {
  tipo: 'NFCE',
  serie: '1',
  numeroIni: '',
  numeroFim: '',
  justificativa: '',
}

const fiscalInputClass = 'mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100'

function formatarData(valor: string | null | undefined): string {
  if (!valor) return '—'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

function formatarMoeda(valor: number | string): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function classeStatus(status: string): string {
  const normalizado = status.toUpperCase()
  if (['AUTORIZADA', 'CONCLUIDO', 'CANCELADA'].includes(normalizado)) return 'bg-green-50 text-green-700 border-green-200'
  if (['REJEITADA', 'ERRO'].includes(normalizado)) return 'bg-red-50 text-red-700 border-red-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function AdminFiscalPage() {
  const { showToast } = useToast()
  const ui = useListaCrud('/fiscal/empresas')
  const { data, isLoading, isError, error, refetch } = usePagedQuery<EmpresaFiscal>(ui.listaParams)
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [salvando, setSalvando] = useState(false)
  const [checkProdutos, setCheckProdutos] = useState<CheckProdutos | null>(null)
  const [checandoProdutos, setChecandoProdutos] = useState(false)
  const [notas, setNotas] = useState<NotaFiscal[]>([])
  const [inutilizacoes, setInutilizacoes] = useState<Inutilizacao[]>([])
  const [fila, setFila] = useState<FilaFiscal[]>([])
  const [carregandoOperacao, setCarregandoOperacao] = useState(true)
  const [baixandoXmlId, setBaixandoXmlId] = useState<number | null>(null)
  const [cancelandoNotaId, setCancelandoNotaId] = useState<number | null>(null)
  const [notaParaCancelar, setNotaParaCancelar] = useState<NotaFiscal | null>(null)
  const [justificativaCancelamento, setJustificativaCancelamento] = useState('')
  const [inutilizacaoForm, setInutilizacaoForm] = useState(INUTILIZACAO_VAZIA)
  const [salvandoInutilizacao, setSalvandoInutilizacao] = useState(false)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [checandoProvider, setChecandoProvider] = useState(false)

  const carregarOperacaoFiscal = async () => {
    setCarregandoOperacao(true)
    try {
      const [notasResp, inutilizacoesResp, filaResp] = await Promise.all([
        apiFetch<ListaApi<NotaFiscal>>('/fiscal/notas?pageSize=8&sort=emitidaEm&dir=desc'),
        apiFetch<ListaApi<Inutilizacao>>('/fiscal/inutilizacoes?pageSize=8&sort=criadoEm&dir=desc'),
        apiFetch<ListaApi<FilaFiscal>>('/fiscal/fila?pageSize=8&sort=agendadoPara&dir=desc'),
      ])
      setNotas(notasResp.data)
      setInutilizacoes(inutilizacoesResp.data)
      setFila(filaResp.data)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao carregar operação fiscal', 'error')
    } finally {
      setCarregandoOperacao(false)
    }
  }

  const checarProviderFiscal = async () => {
    setChecandoProvider(true)
    try {
      const status = await apiFetch<ProviderStatus>('/fiscal/provider/status')
      setProviderStatus(status)
      showToast(status.conectado ? 'ACBrMonitor respondeu' : status.erro || 'Provider fiscal ainda não conectado', status.conectado ? 'success' : 'warning')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao checar provider fiscal', 'error')
    } finally {
      setChecandoProvider(false)
    }
  }

  useEffect(() => {
    void carregarOperacaoFiscal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showForm, editingId])

  const salvar = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.razaoSocial.trim() || !form.cnpj.trim()) {
      showToast('Informe razão social e CNPJ', 'error')
      return
    }
    setSalvando(true)
    try {
      const body = editingId === null ? form : {
        ...form,
        csc: form.csc || undefined,
        certificadoSenha: form.certificadoSenha || undefined,
      }
      await apiFetch(editingId === null ? '/fiscal/empresas' : `/fiscal/empresas/${editingId}`, {
        method: editingId === null ? 'POST' : 'PATCH', body,
      })
      showToast(editingId === null ? 'Empresa fiscal criada' : 'Empresa fiscal atualizada', 'success')
      setForm(FORM_VAZIO)
      setEditingId(null)
      setShowForm(false)
      ui.reiniciarPagina()
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar empresa fiscal', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const editarEmpresa = (empresa: EmpresaFiscal) => {
    setForm({
      razaoSocial: empresa.razaoSocial,
      cnpj: empresa.cnpj,
      regime: empresa.regime,
      crt: empresa.crt,
      ambiente: empresa.ambiente,
      serieNfce: empresa.serieNfce,
      serieNfe: empresa.serieNfe,
      cscId: empresa.cscId ?? '',
      csc: '',
      certificadoPath: empresa.certificadoPath ?? '',
      certificadoSenha: '',
    })
    setEditingId(empresa.id)
    setShowForm(true)
  }

  const baixarXml = async (nota: NotaFiscal) => {
    setBaixandoXmlId(nota.id)
    try {
      const response = await apiRequest(`/fiscal/notas/${nota.id}/xml`, {
        headers: { Accept: 'application/xml' },
      })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${nota.tipo}-${nota.serie}-${nota.numero}.xml`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showToast('XML baixado', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao baixar XML', 'error')
    } finally {
      setBaixandoXmlId(null)
    }
  }

  const abrirCancelamento = (nota: NotaFiscal) => {
    setNotaParaCancelar(nota)
    setJustificativaCancelamento('')
  }

  const cancelarNota = async () => {
    if (!notaParaCancelar) return
    const justificativa = justificativaCancelamento.trim()
    if (justificativa.length < 15) {
      showToast('Justificativa deve ter pelo menos 15 caracteres', 'error')
      return
    }
    setCancelandoNotaId(notaParaCancelar.id)
    try {
      await apiFetch(`/fiscal/notas/${notaParaCancelar.id}/cancelar`, {
        method: 'POST',
        body: { justificativa },
      })
      showToast('Cancelamento registrado', 'success')
      setNotaParaCancelar(null)
      setJustificativaCancelamento('')
      await carregarOperacaoFiscal()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao cancelar nota', 'error')
    } finally {
      setCancelandoNotaId(null)
    }
  }

  const solicitarInutilizacao = async (event: FormEvent) => {
    event.preventDefault()
    if (inutilizacaoForm.justificativa.trim().length < 15) {
      showToast('Justificativa deve ter pelo menos 15 caracteres', 'error')
      return
    }
    setSalvandoInutilizacao(true)
    try {
      await apiFetch('/fiscal/inutilizacoes', {
        method: 'POST',
        body: {
          ...inutilizacaoForm,
          numeroIni: Number(inutilizacaoForm.numeroIni),
          numeroFim: Number(inutilizacaoForm.numeroFim),
        },
      })
      showToast('Inutilização enviada para a fila fiscal', 'success')
      setInutilizacaoForm(INUTILIZACAO_VAZIA)
      await carregarOperacaoFiscal()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao solicitar inutilização', 'error')
    } finally {
      setSalvandoInutilizacao(false)
    }
  }

  const checarProdutos = async () => {
    setChecandoProdutos(true)
    try {
      const resultado = await apiFetch<CheckProdutos>('/fiscal/check-produtos')
      setCheckProdutos(resultado)
      showToast(
        resultado.meta.pendentes === 0
          ? 'Todos os produtos fiscais estão completos'
          : `${resultado.meta.pendentes} produto(s) fiscal(is) com pendência`,
        resultado.meta.pendentes === 0 ? 'success' : 'warning'
      )
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao checar produtos fiscais', 'error')
    } finally {
      setChecandoProdutos(false)
    }
  }

  const columns: Array<DataTableColumn<EmpresaFiscal>> = [
    { key: 'razaoSocial', header: 'Empresa', sortKey: 'razaoSocial', render: (empresa) => <span className="font-medium text-gray-900">{empresa.razaoSocial}</span> },
    { key: 'cnpj', header: 'CNPJ', sortKey: 'cnpj', render: (empresa) => <span className="font-mono text-xs">{empresa.cnpj}</span> },
    { key: 'regime', header: 'Regime', hideOnMobile: true, render: (empresa) => <span>{empresa.regime}</span> },
    { key: 'ambiente', header: 'Ambiente', render: (empresa) => <span>{empresa.ambiente}</span> },
    {
      key: 'segredos',
      header: 'SEFAZ',
      hideOnMobile: true,
      render: (empresa) => (
        <span className="text-xs text-gray-600">
          CSC {empresa.cscConfigurado ? 'ok' : 'pendente'} · Cert. {empresa.certificadoSenhaConfigurada ? 'ok' : 'pendente'}
        </span>
      )
    },
  ]

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 py-6 [overflow-wrap:anywhere] sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Configuração fiscal</h1>
      <p className="mb-6 text-sm text-gray-600">
        Cadastro-base para SEFAZ direta via ACBrMonitor. Certificado A1 e CSC são gravados criptografados e não retornam na API.
      </p>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Provider fiscal</h2>
            <p className="text-sm text-gray-600">
              {providerStatus
                ? `${providerStatus.provider} · ${providerStatus.enabled ? `${providerStatus.host}:${providerStatus.port}` : 'desabilitado'}`
                : 'Cheque a conexão com o ACBrMonitor antes de homologar emissões.'}
            </p>
            {providerStatus?.erro && <p className="mt-1 text-sm text-amber-700">{providerStatus.erro}</p>}
            {providerStatus?.resposta && <p className="mt-1 max-w-2xl whitespace-pre-wrap font-mono text-xs text-gray-500">{providerStatus.resposta}</p>}
          </div>
          <Button type="button" variant="outline" onClick={() => void checarProviderFiscal()} isLoading={checandoProvider}>
            Checar ACBr
          </Button>
        </div>
      </section>

      <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Empresas fiscais</h2>
            <p className="text-sm text-gray-600">Cadastre a empresa ou atualize CNPJ e certificado para habilitar o Radar XML.</p>
          </div>
          <Button type="button" onClick={() => { setForm(FORM_VAZIO); setEditingId(null); setShowForm(true) }}>Nova empresa</Button>
        </div>
        {isError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{(error as Error)?.message ?? 'Falha ao carregar empresas'}</div>}
        {!isLoading && !isError && !ui.search && pagina.meta.total === 0 ? (
          <div className="border-l-4 border-orange-400 bg-orange-50 px-4 py-4 text-sm text-orange-950">
            Nenhuma empresa cadastrada. Adicione CNPJ e certificado A1 para preparar a consulta SEFAZ.
          </div>
        ) : <DataTable
          ariaLabel="Empresas fiscais"
          columns={columns}
          data={pagina.data}
          getRowId={(empresa) => empresa.id}
          meta={pagina.meta}
          loading={isLoading}
          itemLabel="empresas"
          storageKey="admin-fiscal-empresas"
          emptyMessage="Nenhuma empresa fiscal cadastrada"
          onPageChange={ui.setPage}
          onPageSizeChange={ui.setPageSize}
          onSearch={ui.definirBusca}
          onSort={ui.definirOrdenacao}
          rowActions={{ onEdit: editarEmpresa, editLabel: 'Editar empresa fiscal' }}
        />}
      </section>

      {showForm && <form ref={formRef} onSubmit={salvar} autoComplete="off" className="mb-6 scroll-mt-6 border-y border-gray-200 bg-white px-4 py-6 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{editingId === null ? 'Nova empresa fiscal' : 'Editar empresa fiscal'}</h2>
            <p className="mt-1 text-sm text-gray-600">Dados da empresa, numeração de notas e credenciais para emissão.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); setForm(FORM_VAZIO) }}>Cancelar</Button>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-3 text-sm font-bold text-slate-800">Identificação</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
            <label className="min-w-0 text-sm font-medium text-slate-700">Razão social<input value={form.razaoSocial} onChange={(event) => setForm((atual) => ({ ...atual, razaoSocial: event.target.value }))} className={fiscalInputClass} required /></label>
            <label className="text-sm font-medium text-slate-700">CNPJ<input value={form.cnpj} onChange={(event) => setForm((atual) => ({ ...atual, cnpj: event.target.value }))} inputMode="numeric" className={fiscalInputClass} required /></label>
            <label className="text-sm font-medium text-slate-700">Ambiente<select value={form.ambiente} onChange={(event) => setForm((atual) => ({ ...atual, ambiente: event.target.value }))} className={fiscalInputClass}><option value="HOMOLOGACAO">Homologação</option><option value="PRODUCAO">Produção</option></select></label>
          </div>
        </fieldset>

        <fieldset className="mt-6 border-t border-slate-100 pt-5">
          <legend className="text-sm font-bold text-slate-800">Regime e numeração</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">Regime tributário<input value={form.regime} onChange={(event) => setForm((atual) => ({ ...atual, regime: event.target.value }))} className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700">CRT<input value={form.crt} onChange={(event) => setForm((atual) => ({ ...atual, crt: event.target.value }))} className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700">Série NF-e<input value={form.serieNfe} onChange={(event) => setForm((atual) => ({ ...atual, serieNfe: event.target.value }))} className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700">Série NFC-e<input value={form.serieNfce} onChange={(event) => setForm((atual) => ({ ...atual, serieNfce: event.target.value }))} className={fiscalInputClass} /></label>
          </div>
        </fieldset>

        <fieldset className="mt-6 border-t border-slate-100 pt-5">
          <legend className="text-sm font-bold text-slate-800">Credenciais fiscais</legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-medium text-slate-700">ID do CSC<input value={form.cscId} onChange={(event) => setForm((atual) => ({ ...atual, cscId: event.target.value }))} autoComplete="off" className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700">CSC / token NFC-e<input value={form.csc} onChange={(event) => setForm((atual) => ({ ...atual, csc: event.target.value }))} type="password" autoComplete="new-password" className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700 lg:col-span-2">Caminho do certificado A1 (.pfx)<input value={form.certificadoPath} onChange={(event) => setForm((atual) => ({ ...atual, certificadoPath: event.target.value }))} className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700">Senha do certificado A1<input value={form.certificadoSenha} onChange={(event) => setForm((atual) => ({ ...atual, certificadoSenha: event.target.value }))} type="password" autoComplete="new-password" className={fiscalInputClass} /></label>
          </div>
        </fieldset>

        {editingId !== null && <p className="mt-4 text-xs text-slate-500">Deixe os campos de senha vazios para manter os valores atuais.</p>}
        <div className="mt-6 flex justify-end border-t border-slate-100 pt-5"><Button type="submit" isLoading={salvando}>{editingId === null ? 'Criar empresa fiscal' : 'Salvar alterações'}</Button></div>
      </form>}

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Check produtos fiscais</h2>
            <p className="text-sm text-gray-600">
              Valida NCM, CFOP, CST/CSOSN e alíquota dos produtos marcados como fiscais.
            </p>
          </div>
          <Button type="button" onClick={() => void checarProdutos()} isLoading={checandoProdutos}>
            Checar produtos
          </Button>
        </div>

        {checkProdutos && (
          <div className="mt-4">
            <div className={`rounded-lg px-4 py-3 text-sm ${checkProdutos.meta.pendentes === 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              {checkProdutos.meta.pendentes === 0
                ? `Nenhuma pendência nos ${checkProdutos.meta.total} produto(s) fiscal(is).`
                : `${checkProdutos.meta.pendentes} de ${checkProdutos.meta.total} produto(s) fiscal(is) precisam de correção.`}
            </div>

            {checkProdutos.data.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {checkProdutos.data.map((produto) => (
                  <div key={produto.id} className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{produto.nome}</p>
                    <p className="text-xs text-gray-500">
                      NCM {produto.ncm || '—'} · CFOP {produto.cfop || '—'} · CST/CSOSN {produto.cstCsosn || '—'} · ICMS {produto.aliquotaIcms ?? '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {produto.pendencias.map((pendencia) => (
                        <span key={pendencia} className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                          {pendencia}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Operação fiscal</h2>
            <p className="text-sm text-gray-600">Notas, XML operacional, cancelamento e fila do provider fiscal.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void carregarOperacaoFiscal()} isLoading={carregandoOperacao}>
            Atualizar
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[720px] divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Emissão</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {notas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhuma nota fiscal encontrada</td>
                </tr>
              )}
              {notas.map((nota) => (
                <tr key={nota.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{nota.tipo} {nota.serie}/{nota.numero}</div>
                    <div className="text-xs text-gray-500">{nota.ambiente}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${classeStatus(nota.status)}`}>{nota.status}</span>
                    {nota.motivoRejeicao && <div className="mt-1 max-w-xs text-xs text-red-600">{nota.motivoRejeicao}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{nota.cliente?.nome ?? 'Consumidor não identificado'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatarMoeda(nota.valorTotal)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatarData(nota.emitidaEm)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => void baixarXml(nota)} isLoading={baixandoXmlId === nota.id}>
                        XML
                      </Button>
                      {nota.status !== 'CANCELADA' && (
                        <Button type="button" size="sm" variant="danger" onClick={() => abrirCancelamento(nota)} isLoading={cancelandoNotaId === nota.id}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={solicitarInutilizacao} className="min-w-0 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Inutilizar numeração</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Tipo de nota<select value={inutilizacaoForm.tipo} onChange={(event) => setInutilizacaoForm((atual) => ({ ...atual, tipo: event.target.value }))} className={fiscalInputClass}>
              <option value="NFCE">NFC-e</option>
              <option value="NFE">NF-e</option>
            </select></label>
            <label className="text-sm font-medium text-slate-700">Série<input value={inutilizacaoForm.serie} onChange={(event) => setInutilizacaoForm((atual) => ({ ...atual, serie: event.target.value }))} className={fiscalInputClass} /></label>
            <label className="text-sm font-medium text-slate-700">Número inicial<input value={inutilizacaoForm.numeroIni} onChange={(event) => setInutilizacaoForm((atual) => ({ ...atual, numeroIni: event.target.value }))} type="number" min="1" className={fiscalInputClass} required /></label>
            <label className="text-sm font-medium text-slate-700">Número final<input value={inutilizacaoForm.numeroFim} onChange={(event) => setInutilizacaoForm((atual) => ({ ...atual, numeroFim: event.target.value }))} type="number" min="1" className={fiscalInputClass} required /></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Justificativa legal<textarea value={inutilizacaoForm.justificativa} onChange={(event) => setInutilizacaoForm((atual) => ({ ...atual, justificativa: event.target.value }))} className={`${fiscalInputClass} min-h-24`} required /></label>
            <Button type="submit" isLoading={salvandoInutilizacao} className="sm:col-span-2">Solicitar inutilização</Button>
          </div>
        </form>

        <div className="min-w-0 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Últimas inutilizações</h2>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {inutilizacoes.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">Nenhuma inutilização encontrada</div>}
            {inutilizacoes.map((item) => (
              <div key={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-gray-900">{item.tipo} {item.serie}: {item.numeroIni} a {item.numeroFim}</p>
                  <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classeStatus(item.status)}`}>{item.status}</span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{item.justificativa}</p>
                <p className="mt-1 text-xs text-gray-500">Criada em {formatarData(item.criadoEm)} · Protocolo {item.protocolo ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mb-6 border-y border-gray-200 bg-white px-4 py-5 sm:px-5">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Fila fiscal</h2>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {fila.length === 0 && <div className="px-4 py-6 text-center text-sm text-gray-500">Fila fiscal vazia</div>}
          {fila.map((item) => (
            <div key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-gray-900">
                  {item.operacao}{item.nota ? ` · ${item.nota.tipo} ${item.nota.serie}/${item.nota.numero}` : ''}
                </p>
                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classeStatus(item.status)}`}>{item.status}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Tentativas {item.tentativas} · Agendado {formatarData(item.agendadoPara)}</p>
              {item.ultimoErro && <p className="mt-1 text-sm text-red-600">{item.ultimoErro}</p>}
            </div>
          ))}
        </div>
      </section>

      <ConfirmationModal
        isOpen={notaParaCancelar !== null}
        title="Cancelar nota fiscal"
        description={notaParaCancelar ? `Informe a justificativa legal para cancelar ${notaParaCancelar.tipo} ${notaParaCancelar.serie}/${notaParaCancelar.numero}.` : ''}
        confirmText="Cancelar nota"
        variant="danger"
        closeOnConfirm={false}
        onClose={() => {
          setNotaParaCancelar(null)
          setJustificativaCancelamento('')
        }}
        onConfirm={() => void cancelarNota()}
      >
        <label htmlFor="justificativa-cancelamento" className="mb-1 block text-sm font-semibold text-gray-700">
          Justificativa
        </label>
        <textarea
          id="justificativa-cancelamento"
          value={justificativaCancelamento}
          onChange={(event) => setJustificativaCancelamento(event.target.value)}
          className="min-h-28 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          placeholder="Ex.: Erro na emissão da nota fiscal..."
        />
        <p className="mt-1 text-xs text-gray-500">Mínimo de 15 caracteres.</p>
      </ConfirmationModal>
    </div>
  )
}
