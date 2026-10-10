'use client'

import { useState } from 'react'
import { Crown, Power, PowerOff, Printer, RefreshCw, Trash2 } from 'lucide-react'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { Switch } from '@/app/components/ui/Switch'
import { ConfirmationModal } from '@/app/components/ConfirmationModal'
import { apiFetch } from '@/app/lib/api'
import { usePagedQuery } from '@/app/lib/pagination'
import { useCrud, useListaCrud, paginaAtual, SeloAtivo } from '@/app/lib/crud-client'
import { useToast } from '@/contexts/ToastContext'

/**
 * Impressoras — PRD seção 5.1 / RF-DIS-01 a RF-DIS-05, no padrão RF-UI-01
 * (`DataTable` + modal próprio + ConfirmationModal).
 *
 * Decisões que importam:
 *
 * - **"Caixa" é exclusivo.** O backend garante no máximo UMA impressora com
 *   `isCaixa = true E ativo = true`: ao marcar um novo, ele desmarca o anterior na
 *   MESMA transação (RF-DIS-02). A UI avisa isso no formulário, porque a
 *   consequência é visível — o outro registro perde o selo de caixa na listagem.
 * - **`larguraMm` é 58 ou 80**, não um número livre: é o que o `PrinterService`
 *   usa para escolher a coluna do `node-thermal-printer` (PRD 5.3). Um select de
 *   dois valores evita o 400 do backend e o ticket torto.
 * - **`vincularTodos` não altera nada neste cadastro** (RF-DIS-04): é a flag que o
 *   wizard de `/admin/pracas/vincular` lê para oferecer o vínculo "praça inteira".
 * - **IP/porta/conexão são configuração física** e o teste de impressão usa o
 *   mesmo `PrinterService` que imprime pedidos/contas.
 * - **DELETE é soft delete** (`ativo = false`): a impressora é referenciada por
 *   `VinculoImpressao` (FK RESTRICT) e pode ser a impressora padrão de um produto.
 *   Por isso a listagem mostra o selo de situação e o botão de reativar.
 *
 * `isCaixa` NÃO é limpo no soft delete (o backend preserva de propósito), então
 * reativar uma impressora de caixa devolve a exclusividade a ela.
 */

const RESOURCE = '/dispositivos'
const LIST_RESOURCE = '/dispositivos?tipo=IMPRESSORA'
// The Vercel app runs in the cloud, while the Windows agent runs on the
// operator's computer. In the browser, loopback is therefore the default
// production bridge; the env var remains available for a custom local URL.
const CONFIGURED_PRINTER_AGENT_URL = (process.env.NEXT_PUBLIC_PRINTER_AGENT_URL || '').trim()
const PRINTER_AGENT_URL = (CONFIGURED_PRINTER_AGENT_URL || 'http://127.0.0.1:4100').replace(/\/$/, '')
const PRINTER_AGENT_TOKEN = process.env.NEXT_PUBLIC_PRINTER_AGENT_TOKEN || ''

function deveUsarAgenteLocal(): boolean {
  if (CONFIGURED_PRINTER_AGENT_URL) return true
  if (typeof window === 'undefined') return true
  return !['localhost', '127.0.0.1'].includes(window.location.hostname)
}

function erroDoAgente(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error('Rei Printer Agent não está em execução. Abra o agente neste computador e tente novamente.')
  }
  return error instanceof Error ? error : new Error('Erro ao comunicar com o Rei Printer Agent')
}

const CONEXOES = ['TCP', 'USB'] as const
const LARGURAS_MM = [58, 80] as const

type Conexao = (typeof CONEXOES)[number]

type Dispositivo = {
  id: number
  nome: string
  tipo: string
  larguraMm: number
  descricao: string | null
  ip: string | null
  porta: number
  conexao: string
  isCaixa: boolean
  vincularTodos: boolean
  ativo: boolean
  _count?: { vinculos: number }
}

type WindowsPrinter = {
  name: string
  driverName: string | null
  portName: string | null
  isDefault: boolean
  shared: boolean
  workOffline: boolean
  printerStatus: number | null
}

type FormState = {
  nome: string
  larguraMm: string
  descricao: string
  ip: string
  porta: string
  conexao: Conexao
  modoWindows: 'TERMICA' | 'TEXTO'
  isCaixa: boolean
  vincularTodos: boolean
}

const FORM_VAZIO: FormState = {
  nome: '',
  larguraMm: '80',
  descricao: '',
  ip: '',
  porta: '9100',
  conexao: 'TCP',
  modoWindows: 'TERMICA',
  isCaixa: false,
  vincularTodos: false,
}

const MARCADOR_MODO_TEXTO = '[MODO_TEXTO]'

/** `true` quando o valor do banco é uma das opções conhecidas (blindagem do cast). */
function opcaoConhecida<T extends string>(valor: string, aceitos: readonly T[]): valor is T {
  return (aceitos as readonly string[]).includes(valor)
}

function descricaoSemMarcador(descricao: string | null | undefined): string {
  return (descricao ?? '').replace(MARCADOR_MODO_TEXTO, '').replace(/\s+·\s*$/, '').trim()
}

function modoWindowsDaDescricao(descricao: string | null | undefined): 'TERMICA' | 'TEXTO' {
  return (descricao ?? '').includes(MARCADOR_MODO_TEXTO) ? 'TEXTO' : 'TERMICA'
}

function descricaoComModo(descricao: string, modoWindows: 'TERMICA' | 'TEXTO'): string | null {
  const limpa = descricaoSemMarcador(descricao)
  if (modoWindows === 'TEXTO') {
    return [limpa, MARCADOR_MODO_TEXTO].filter(Boolean).join(' · ')
  }
  return limpa === '' ? null : limpa
}

export default function DispositivosPage() {
  const { showToast } = useToast()
  const crud = useCrud<Dispositivo>({ resource: RESOURCE, entidade: 'Impressora', genero: 'f' })
  const ui = useListaCrud(LIST_RESOURCE)

  const { data, isLoading, isError, error, refetch } = usePagedQuery<Dispositivo>(ui.listaParams)

  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Dispositivo | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Dispositivo | null>(null)
  const [paraExcluirDefinitivo, setParaExcluirDefinitivo] = useState<Dispositivo | null>(null)
  const [alternandoId, setAlternandoId] = useState<number | null>(null)
  const [testandoId, setTestandoId] = useState<number | null>(null)
  const [windowsPrinters, setWindowsPrinters] = useState<WindowsPrinter[]>([])
  const [carregandoWindows, setCarregandoWindows] = useState(false)
  const [mostraWindows, setMostraWindows] = useState(false)

  const abrirNovo = () => {
    setEditing(null)
    setForm(FORM_VAZIO)
    setShowForm(true)
  }

  const carregarWindowsPrinters = async () => {
    setCarregandoWindows(true)
    try {
      const body = deveUsarAgenteLocal()
        ? await (async () => {
            try {
              const res = await fetch(`${PRINTER_AGENT_URL}/printers`, {
                cache: 'no-store',
                headers: PRINTER_AGENT_TOKEN ? { 'X-Printer-Agent-Token': PRINTER_AGENT_TOKEN } : undefined,
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(data.error || 'Erro ao reconhecer impressoras')
              return data as { data?: WindowsPrinter[] }
            } catch (error) {
              throw erroDoAgente(error)
            }
          })()
        : await apiFetch<{ data?: WindowsPrinter[] }>('/dispositivos/windows-printers')
      setWindowsPrinters(Array.isArray(body.data) ? body.data : [])
      setMostraWindows(true)
      showToast('Impressoras do Windows reconhecidas.', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao reconhecer impressoras', 'error')
    } finally {
      setCarregandoWindows(false)
    }
  }

  const usarWindowsPrinter = (printer: WindowsPrinter) => {
    setEditing(null)
    setForm({
      nome: printer.name,
      larguraMm: '80',
      descricao: [printer.driverName, printer.portName].filter(Boolean).join(' · '),
      ip: printer.name,
      porta: '9100',
      conexao: 'USB',
      modoWindows: 'TERMICA',
      isCaixa: false,
      vincularTodos: false,
    })
    setShowForm(true)
  }

  const abrirEdicao = (dispositivo: Dispositivo) => {
    setEditing(dispositivo)
    setForm({
      nome: dispositivo.nome,
      larguraMm: String(dispositivo.larguraMm ?? 80),
      descricao: descricaoSemMarcador(dispositivo.descricao),
      ip: dispositivo.ip ?? '',
      porta: String(dispositivo.porta ?? 9100),
      conexao: opcaoConhecida(dispositivo.conexao, CONEXOES) ? dispositivo.conexao : 'TCP',
      modoWindows: modoWindowsDaDescricao(dispositivo.descricao),
      isCaixa: dispositivo.isCaixa,
      vincularTodos: dispositivo.vincularTodos,
    })
    setShowForm(true)
  }

  const fecharForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm(FORM_VAZIO)
  }

  const atualizarCampo = <K extends keyof FormState>(campo: K, valor: FormState[K]) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  /** Alterna uma flag booleana do formulário. */
  const alternarFlag = (campo: 'isCaixa' | 'vincularTodos') => {
    setForm((atual) => ({ ...atual, [campo]: !atual[campo] }))
  }

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault()

    const nome = form.nome.trim()
    if (nome === '') {
      showToast('Informe o nome da impressora', 'error')
      return
    }

    const larguraMm = Number(form.larguraMm)
    if (!(LARGURAS_MM as readonly number[]).includes(larguraMm)) {
      showToast('A largura do papel deve ser 58 mm ou 80 mm', 'error')
      return
    }

    const portaTexto = form.porta.trim()
    const porta = portaTexto === '' ? 9100 : Number(portaTexto)
    if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
      showToast('Porta inválida: informe um número entre 1 e 65535', 'error')
      return
    }

    const ip = form.ip.trim()

    // `''` nunca vai para o banco: o backend normaliza, mas mandar `null`
    // deixa explícita a intenção de limpar o campo.
    const corpo = {
      nome,
      tipo: 'IMPRESSORA',
      larguraMm,
      descricao: descricaoComModo(form.descricao, form.conexao === 'USB' ? form.modoWindows : 'TERMICA'),
      ip: ip === '' ? null : ip,
      porta,
      conexao: form.conexao,
      isCaixa: form.isCaixa,
      vincularTodos: form.vincularTodos,
    }

    setSalvando(true)
    const editando = editing
    const salvo = editando ? await crud.atualizar(editando.id, corpo) : await crud.criar(corpo)
    setSalvando(false)

    if (salvo === null) return

    showToast(crud.mensagem(editando ? 'atualizado' : 'criado'), 'success')
    if (salvo.isCaixa) {
      showToast('Esta é agora a única impressora de caixa ativa', 'info')
    }
    fecharForm()
    ui.reiniciarPagina()
    void refetch()
  }

  const alternar = async (dispositivo: Dispositivo) => {
    setAlternandoId(dispositivo.id)
    const atualizado = await crud.alternarAtivo(dispositivo.id, !dispositivo.ativo)
    setAlternandoId(null)

    if (atualizado === null) return
    showToast(`Impressora ${atualizado.ativo ? 'ativada' : 'desativada'}`, 'success')
    if (atualizado.ativo && atualizado.isCaixa) {
      showToast('Impressora de caixa reativada: ela voltou a ser o padrão do caixa', 'info')
    }
    void refetch()
  }

  const testarImpressora = async (dispositivo: Dispositivo) => {
    setTestandoId(dispositivo.id)
    try {
      const usandoAgente = deveUsarAgenteLocal() && dispositivo.conexao === 'USB'
      const body = usandoAgente
        ? await (async () => {
            try {
              const res = await fetch(`${PRINTER_AGENT_URL}/print-test`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(PRINTER_AGENT_TOKEN ? { 'X-Printer-Agent-Token': PRINTER_AGENT_TOKEN } : {}),
                },
                body: JSON.stringify({
                  printerName: dispositivo.ip,
                  modoTexto: dispositivo.descricao?.includes('[MODO_TEXTO]') ?? false,
                }),
              })
              const data = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(data.error || 'Falha ao testar impressora')
              return data
            } catch (error) {
              throw erroDoAgente(error)
            }
          })()
        : await apiFetch<{ message?: string }>(`/dispositivos/${dispositivo.id}/test`, { method: 'POST' })
      showToast(body.message || 'Teste enviado para a impressora', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao testar impressora', 'error')
    } finally {
      setTestandoId(null)
    }
  }

  const confirmarExclusao = async () => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)

    const excluido = await crud.excluir(alvo.id)
    if (excluido === null) return

    showToast(crud.mensagem('excluido'), 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const confirmarExclusaoDefinitiva = async () => {
    if (!paraExcluirDefinitivo) return
    const alvo = paraExcluirDefinitivo
    setParaExcluirDefinitivo(null)

    const excluido = await crud.executar(
      () => apiFetch<Dispositivo>(`${RESOURCE}/${alvo.id}/permanente`, { method: 'DELETE' }),
      'Erro ao excluir definitivamente a impressora'
    )
    if (excluido === null) return

    showToast('Impressora excluída definitivamente', 'success')
    if (ui.aposExcluir(pagina.data.length)) void refetch()
  }

  const columns: Array<DataTableColumn<Dispositivo>> = [
    {
      key: 'nome',
      header: 'Impressora',
      sortKey: 'nome',
      render: (dispositivo) => (
        <div>
          <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
            {dispositivo.tipo === 'IMPRESSORA' && (
              <Printer className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            )}
            {dispositivo.nome}
          </span>
          {dispositivo.descricao && (
            <span className="block text-xs text-gray-500">{dispositivo.descricao}</span>
          )}
        </div>
      ),
    },
    {
      key: 'larguraMm',
      header: 'Papel',
      sortKey: 'larguraMm',
      align: 'center',
      hideOnMobile: true,
      render: (dispositivo) => (
        <span className="text-gray-700">{dispositivo.larguraMm} mm</span>
      ),
    },
    {
      key: 'endereco',
      header: 'Destino',
      hideOnMobile: true,
      render: (dispositivo) => (
        <span className="font-mono text-xs text-gray-700">
          {dispositivo.conexao === 'USB'
            ? (dispositivo.ip ? `Windows: ${dispositivo.ip}` : 'Windows')
            : dispositivo.ip ? `${dispositivo.ip}:${dispositivo.porta}` : dispositivo.conexao}
        </span>
      ),
    },
    {
      key: 'modo',
      header: 'Modo',
      hideOnMobile: true,
      render: (dispositivo) => (
        <span className={modoWindowsDaDescricao(dispositivo.descricao) === 'TEXTO' ? 'text-blue-700' : 'text-gray-700'}>
          {dispositivo.conexao === 'USB' && modoWindowsDaDescricao(dispositivo.descricao) === 'TEXTO'
            ? 'Comum/teste'
            : 'Térmica ESC/POS'}
        </span>
      ),
    },
    {
      key: 'isCaixa',
      header: 'Caixa',
      align: 'center',
      render: (dispositivo) =>
        dispositivo.isCaixa ? (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
            <Crown className="h-3 w-3" />
            SIM
          </span>
        ) : (
          <span className="text-xs text-gray-400">NÃO</span>
        ),
    },
    {
      key: 'ativo',
      header: 'Situação',
      align: 'center',
      hideOnMobile: true,
      render: (dispositivo) => <SeloAtivo ativo={dispositivo.ativo} />,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <h1 className="mb-2 text-3xl font-bold text-black">Impressoras</h1>
      <p className="mb-6 text-sm text-gray-600">
        Configure impressoras TCP ou filas do Windows, envie testes e defina os destinos usados pelo
        roteador de pedidos (praça, produto ou caixa).
      </p>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar impressoras'}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Impressoras instaladas no Windows</h2>
            <p className="text-xs text-gray-500">
              Reconhece as impressoras cadastradas no Windows deste computador e preenche como conexão USB/local.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void carregarWindowsPrinters()}
            isLoading={carregandoWindows}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconhecer impressoras
          </Button>
        </div>

        {mostraWindows && (
          <div className="mt-4 overflow-hidden rounded-lg border border-gray-100">
            {windowsPrinters.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">Nenhuma impressora instalada foi encontrada no Windows.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {windowsPrinters.map((printer) => (
                  <div key={printer.name} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">{printer.name}</span>
                        {printer.isDefault && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Padrão
                          </span>
                        )}
                        {printer.workOffline && (
                          <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                            Offline
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {[printer.driverName, printer.portName].filter(Boolean).join(' · ') || 'Sem detalhes do driver'}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => usarWindowsPrinter(printer)}>
                      Usar no cadastro
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DataTable<Dispositivo>
        ariaLabel="Listagem de impressoras"
        columns={columns}
        data={pagina.data}
        getRowId={(dispositivo) => dispositivo.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="impressoras"
        storageKey="admin-impressoras"
        emptyMessage="Nenhuma impressora encontrada"
        emptyHint={
          ui.search
            ? `Nada corresponde a "${ui.search}".`
            : 'Reconheça uma impressora do Windows ou cadastre uma impressora TCP.'
        }
        onPageChange={(numero) => ui.setPage(numero)}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          onEdit: abrirEdicao,
          onDelete: setParaExcluir,
          editLabel: 'Editar impressora',
          deleteLabel: 'Desativar impressora',
          extra: (dispositivo) => (
            <>
              <button
                type="button"
                title="Testar impressão"
                aria-label="Testar impressão"
                disabled={testandoId === dispositivo.id || !dispositivo.ativo}
                onClick={() => void testarImpressora(dispositivo)}
                className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={dispositivo.ativo ? 'Desativar' : 'Ativar'}
                aria-label={dispositivo.ativo ? 'Desativar impressora' : 'Ativar impressora'}
                disabled={alternandoId === dispositivo.id}
                onClick={() => void alternar(dispositivo)}
                className="rounded-lg p-1.5 text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-40"
              >
                {dispositivo.ativo ? (
                  <PowerOff className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                title="Excluir definitivamente"
                aria-label="Excluir definitivamente"
                onClick={() => setParaExcluirDefinitivo(dispositivo)}
                className="rounded-lg p-1.5 text-red-600 transition-colors hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ),
        }}
        createAction={{ label: 'Nova impressora', onClick: abrirNovo }}
      />

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-bold text-black">
                {editing ? 'Editar impressora' : 'Nova impressora'}
              </h2>
            </div>

            <form onSubmit={salvar} className="space-y-4 px-6 py-5">
              <div className="grid gap-4">
                <div>
                  <label htmlFor="dispositivo-nome" className="mb-1 block text-sm font-medium text-black">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="dispositivo-nome"
                    type="text"
                    value={form.nome}
                    onChange={(event) => atualizarCampo('nome', event.target.value)}
                    placeholder="Ex.: Impressora Cozinha"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="dispositivo-largura" className="mb-1 block text-sm font-medium text-black">
                    Papel (mm)
                  </label>
                  <select
                    id="dispositivo-largura"
                    value={form.larguraMm}
                    onChange={(event) => atualizarCampo('larguraMm', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    {LARGURAS_MM.map((largura) => (
                      <option key={largura} value={largura}>
                        {largura} mm
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dispositivo-conexao" className="mb-1 block text-sm font-medium text-black">
                    Conexão
                  </label>
                  <select
                    id="dispositivo-conexao"
                    value={form.conexao}
                    onChange={(event) => atualizarCampo('conexao', event.target.value as Conexao)}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    {CONEXOES.map((conexao) => (
                      <option key={conexao} value={conexao}>
                        {conexao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dispositivo-modo" className="mb-1 block text-sm font-medium text-black">
                    Modo
                  </label>
                  <select
                    id="dispositivo-modo"
                    value={form.modoWindows}
                    onChange={(event) => atualizarCampo('modoWindows', event.target.value as FormState['modoWindows'])}
                    disabled={form.conexao !== 'USB'}
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="TERMICA">Térmica ESC/POS</option>
                    <option value="TEXTO">Impressora comum (teste)</option>
                  </select>
                </div>

              </div>

              <div>
                  <label htmlFor="dispositivo-ip" className="mb-1 block text-sm font-medium text-black">
                    {form.conexao === 'USB' ? 'Impressora Windows' : 'IP'}
                  </label>
                  <input
                    id="dispositivo-ip"
                    type="text"
                    value={form.ip}
                    onChange={(event) => atualizarCampo('ip', event.target.value)}
                    placeholder={form.conexao === 'USB' ? 'Ex.: EPSON TM-T20' : 'Ex.: 192.168.0.50'}
                    className="w-full rounded-lg border border-gray-300 p-2 font-mono text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  {form.conexao === 'USB' && (
                    <p className="mt-1 text-xs text-gray-500">
                      Para térmica real use ESC/POS. Para impressora comum, use o modo de teste em texto.
                    </p>
                  )}
              </div>

              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="dispositivo-porta" className="mb-1 block text-sm font-medium text-black">
                    Porta
                  </label>
                  <input
                    id="dispositivo-porta"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={65535}
                    step={1}
                    value={form.porta}
                    onChange={(event) => atualizarCampo('porta', event.target.value)}
                    placeholder="9100"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor="dispositivo-descricao"
                    className="mb-1 block text-sm font-medium text-black"
                  >
                    Descrição
                  </label>
                  <input
                    id="dispositivo-descricao"
                    type="text"
                    value={form.descricao}
                    onChange={(event) => atualizarCampo('descricao', event.target.value)}
                    placeholder="Ex.: Epson TM-T20 na parede da cozinha"
                    className="w-full rounded-lg border border-gray-300 p-2 text-black focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>

              <fieldset className="space-y-2 rounded-lg border border-gray-200 p-4">
                <legend className="px-1 text-sm font-semibold text-gray-700">
                  Funções da impressora
                </legend>

                <Switch
                  checked={form.isCaixa}
                  onCheckedChange={() => alternarFlag('isCaixa')}
                  label="Padrão do caixa"
                  description="Imprime a conta/fechamento. Só uma impressora pode ser caixa; marcar esta desmarca a anterior."
                />

                <Switch
                  checked={form.vincularTodos}
                  onCheckedChange={() => alternarFlag('vincularTodos')}
                  label="Vincular todos os produtos da praça"
                  description="Sugere esta impressora para a praça inteira no wizard de vínculos. Não cria vínculo sozinho."
                />
              </fieldset>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={fecharForm} disabled={salvando}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={salvando}>
                  {editing ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={paraExcluir !== null}
        title="Desativar impressora"
        description={
          paraExcluir
            ? `Tem certeza que deseja desativar "${paraExcluir.nome}"? A impressora não é apagada (soft delete) porque vínculos de impressão e produtos podem apontar para ela; ela apenas deixa de receber impressão enquanto estiver inativa.`
            : ''
        }
        confirmText="Desativar"
        onConfirm={() => void confirmarExclusao()}
        onClose={() => setParaExcluir(null)}
      />

      <ConfirmationModal
        isOpen={paraExcluirDefinitivo !== null}
        title="Excluir impressora definitivamente"
        description={
          paraExcluirDefinitivo
            ? `Atenção: isso vai apagar "${paraExcluirDefinitivo.nome}" do cadastro, não apenas desativar. Se ela estiver vinculada a praças/produtos, o sistema pode bloquear a exclusão. Esta ação não aparece mais na lista para reativar depois.`
            : ''
        }
        confirmText="Excluir definitivamente"
        onConfirm={() => void confirmarExclusaoDefinitiva()}
        onClose={() => setParaExcluirDefinitivo(null)}
      />
    </div>
  )
}
