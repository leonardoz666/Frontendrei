'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, PackageCheck, Plus, RotateCcw, Scale, Trash2, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DataTable, type DataTableColumn } from '@/app/components/ui/DataTable'
import { Button } from '@/app/components/ui/Button'
import { apiFetch, fetchList } from '@/app/lib/api'
import { paginaAtual, comoDecimalDigitado, comoNumero, useListaCrud } from '@/app/lib/crud-client'
import { usePagedQuery } from '@/app/lib/pagination'
import { useToast } from '@/contexts/ToastContext'

const RESOURCE = '/estoque-distribuicoes'

type Destino = { id: number; nome: string; ativo: boolean }
type Insumo = { id: number; codigo: string; nome: string; unidade: string; saldoAtual: number | string }
type Produto = { id: number; codigo?: string | null; nome: string; estoque: number | null; custo?: number | string }

type SaidaItem = {
  id: number
  tipo: 'INSUMO' | 'PRODUTO'
  nomeSnapshot: string
  unidadeSnapshot: string
  quantidade: number | string
  custoUnitario: number | string
  quantidadeDestinada: number | string
  quantidadeDisponivel: number | string
}

type Devolucao = {
  id: number
  motivo: string
  criadoEm: string
}

type Saida = {
  id: number
  numero: string
  destino: Destino
  usuario?: { id: number; nome: string } | null
  observacao: string | null
  criadoEm: string
  itens: SaidaItem[]
  devolucoes: Devolucao[]
}

type ComparacaoItem = {
  tipo: 'INSUMO' | 'PRODUTO'
  itemId: number
  nome: string
  unidade: string
  inicio: string
  enviado: number | string
  lancado: number | string
  devolvido: number | string
  perda: number | string
  diferenca: number | string
  status: 'CONCILIADO' | 'SOBRA_ESPERADA' | 'CONSUMO_MAIOR'
}

type ComparacaoResposta = {
  data: ComparacaoItem[]
  geradoEm: string
  destino: string
}

type LinhaSaida = {
  chave: number
  tipo: 'INSUMO' | 'PRODUTO'
  itemId: string
  quantidade: string
}

type LinhaDevolucao = {
  quantidade: string
  condicao: 'REESTOQUE' | 'PERDA'
}

function novaLinha(chave = Date.now()): LinhaSaida {
  return { chave, tipo: 'PRODUTO', itemId: '', quantidade: '' }
}

function formatarQuantidade(valor: unknown, unidade: string): string {
  const numero = comoNumero(valor)
  const casas = unidade === 'UN' ? 0 : 3
  return `${numero.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${unidade}`
}

function formatarData(valor: string): string {
  return new Date(valor).toLocaleString('pt-BR')
}

export default function DistribuicoesEstoquePage() {
  const { showToast } = useToast()
  const ui = useListaCrud(RESOURCE)
  const { data, isLoading, isError, error, refetch } = usePagedQuery<Saida>({
    ...ui.listaParams,
    resource: RESOURCE,
  })
  const pagina = paginaAtual({ data }, ui.page, ui.pageSize)

  const { data: destinos = [] } = useQuery({
    queryKey: ['distribuicoes-destinos'],
    queryFn: () => fetchList<Destino>('/estoques?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })
  const { data: insumos = [] } = useQuery({
    queryKey: ['distribuicoes-insumos'],
    queryFn: () => fetchList<Insumo>('/insumos?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })
  const { data: produtosRecebidos = [] } = useQuery({
    queryKey: ['distribuicoes-produtos'],
    queryFn: () => fetchList<Produto>('/products?page=1&pageSize=100&ativo=true&sort=nome&order=asc'),
  })
  const produtos = useMemo(
    () => produtosRecebidos.filter((produto) => produto.estoque !== null),
    [produtosRecebidos]
  )

  const [showSaida, setShowSaida] = useState(false)
  const [destinoId, setDestinoId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<LinhaSaida[]>([novaLinha(1)])
  const [salvandoSaida, setSalvandoSaida] = useState(false)

  const [saidaDevolucao, setSaidaDevolucao] = useState<Saida | null>(null)
  const [motivoDevolucao, setMotivoDevolucao] = useState('')
  const [linhasDevolucao, setLinhasDevolucao] = useState<Record<number, LinhaDevolucao>>({})
  const [salvandoDevolucao, setSalvandoDevolucao] = useState(false)
  const [comparacao, setComparacao] = useState<ComparacaoResposta | null>(null)
  const [comparando, setComparando] = useState(false)

  const fecharSaida = () => {
    setShowSaida(false)
    setDestinoId('')
    setObservacao('')
    setLinhas([novaLinha(1)])
  }

  const alterarLinha = (chave: number, atualizacao: Partial<LinhaSaida>) => {
    setLinhas((atuais) => atuais.map((linha) => linha.chave === chave ? { ...linha, ...atualizacao } : linha))
  }

  const itemSelecionado = (linha: LinhaSaida) => {
    const id = Number(linha.itemId)
    return linha.tipo === 'INSUMO'
      ? insumos.find((item) => item.id === id)
      : produtos.find((item) => item.id === id)
  }

  const registrarSaida = async (event: React.FormEvent) => {
    event.preventDefault()
    const destino = Number(destinoId)
    const itens = linhas.map((linha) => ({
      tipo: linha.tipo,
      itemId: Number(linha.itemId),
      quantidade: comoDecimalDigitado(linha.quantidade),
    }))
    if (!Number.isInteger(destino) || destino < 1) {
      showToast('Selecione o destino da saída', 'error')
      return
    }
    if (itens.some((item) => !Number.isInteger(item.itemId) || item.itemId < 1 || item.quantidade === null || item.quantidade <= 0)) {
      showToast('Preencha todos os itens e quantidades', 'error')
      return
    }

    setSalvandoSaida(true)
    try {
      await apiFetch(RESOURCE, {
        method: 'POST',
        body: { destinoId: destino, observacao: observacao.trim() || null, itens },
      })
      showToast('Saída registrada', 'success')
      fecharSaida()
      ui.reiniciarPagina()
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao registrar saída', 'error')
    } finally {
      setSalvandoSaida(false)
    }
  }

  const abrirDevolucao = (saida: Saida) => {
    const pendentes = saida.itens.filter((item) => comoNumero(item.quantidadeDisponivel) > 0)
    setLinhasDevolucao(Object.fromEntries(pendentes.map((item) => [item.id, { quantidade: '', condicao: 'REESTOQUE' }])))
    setMotivoDevolucao('')
    setSaidaDevolucao(saida)
  }

  const registrarDevolucao = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!saidaDevolucao) return
    const itens = Object.entries(linhasDevolucao)
      .map(([saidaItemId, linha]) => ({
        saidaItemId: Number(saidaItemId),
        quantidade: comoDecimalDigitado(linha.quantidade),
        condicao: linha.condicao,
      }))
      .filter((item) => item.quantidade !== null && item.quantidade > 0)

    if (motivoDevolucao.trim() === '') {
      showToast('Informe o motivo da devolução', 'error')
      return
    }
    if (itens.length === 0) {
      showToast('Informe ao menos uma quantidade', 'error')
      return
    }

    setSalvandoDevolucao(true)
    try {
      await apiFetch(`${RESOURCE}/${saidaDevolucao.id}/devolucoes`, {
        method: 'POST',
        body: { motivo: motivoDevolucao.trim(), itens },
      })
      showToast('Devolução registrada', 'success')
      setSaidaDevolucao(null)
      void refetch()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao registrar devolução', 'error')
    } finally {
      setSalvandoDevolucao(false)
    }
  }

  const compararEstoque = async () => {
    setComparando(true)
    try {
      const resultado = await apiFetch<ComparacaoResposta>(`${RESOURCE}/comparacao-cozinha`)
      setComparacao(resultado)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao comparar estoque', 'error')
    } finally {
      setComparando(false)
    }
  }

  const columns: Array<DataTableColumn<Saida>> = [
    {
      key: 'numero',
      header: 'Documento',
      render: (saida) => <span className="font-mono text-sm font-semibold text-gray-900">{saida.numero}</span>,
    },
    {
      key: 'destino',
      header: 'Destino',
      render: (saida) => (
        <div>
          <p className="font-semibold text-gray-900">{saida.destino.nome}</p>
          <p className="text-xs text-gray-500">{saida.usuario?.nome ?? 'Operador não informado'}</p>
        </div>
      ),
    },
    {
      key: 'itens',
      header: 'Itens enviados',
      render: (saida) => (
        <div className="space-y-1">
          {saida.itens.map((item) => (
            <p key={item.id} className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{item.nomeSnapshot}</span>{' '}
              {formatarQuantidade(item.quantidade, item.unidadeSnapshot)}
            </p>
          ))}
        </div>
      ),
    },
    {
      key: 'pendencias',
      header: 'A devolver/acertar',
      hideOnMobile: true,
      render: (saida) => {
        const pendentes = saida.itens.filter((item) => comoNumero(item.quantidadeDisponivel) > 0)
        if (pendentes.length === 0) {
          return <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700"><PackageCheck className="h-4 w-4" />Acertada</span>
        }
        return (
          <div className="space-y-1">
            {pendentes.map((item) => (
              <p key={item.id} className="text-sm font-medium text-amber-700">
                {formatarQuantidade(item.quantidadeDisponivel, item.unidadeSnapshot)} de {item.nomeSnapshot}
              </p>
            ))}
          </div>
        )
      },
    },
    {
      key: 'criadoEm',
      header: 'Data',
      sortKey: 'criadoEm',
      hideOnMobile: true,
      render: (saida) => <span className="text-sm text-gray-600">{formatarData(saida.criadoEm)}</span>,
    },
  ]

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
            <ArrowDownToLine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-950">Saídas e devoluções</h1>
            <p className="mt-1 text-sm text-gray-600">Controle do que sai do Estoque Central para a cozinha e demais unidades.</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => void compararEstoque()} isLoading={comparando}>
          <Scale className="mr-2 h-4 w-4" />
          Comparar estoque
        </Button>
      </header>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {(error as Error)?.message ?? 'Falha ao carregar as saídas'}
        </div>
      )}

      <DataTable
        ariaLabel="Saídas do Estoque Central"
        columns={columns}
        data={pagina.data}
        getRowId={(saida) => saida.id}
        meta={pagina.meta}
        loading={isLoading}
        itemLabel="saídas"
        storageKey="admin-estoque-distribuicoes"
        emptyMessage="Nenhuma saída registrada"
        emptyHint="Registre a primeira carga enviada para a cozinha ou uma unidade."
        onPageChange={ui.setPage}
        onPageSizeChange={ui.setPageSize}
        onSearch={ui.definirBusca}
        onSort={ui.definirOrdenacao}
        rowActions={{
          extra: (saida) => {
            const temPendente = saida.itens.some((item) => comoNumero(item.quantidadeDisponivel) > 0)
            return (
              <button
                type="button"
                title={temPendente ? 'Registrar devolução' : 'Saída já acertada'}
                aria-label={temPendente ? 'Registrar devolução' : 'Saída já acertada'}
                disabled={!temPendente}
                onClick={() => abrirDevolucao(saida)}
                className="rounded-lg p-1.5 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )
          },
        }}
        createAction={{ label: 'Registrar saída', onClick: () => setShowSaida(true) }}
      />

      {showSaida && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-4xl rounded-lg bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-950">Nova saída do Estoque Central</h2>
            </div>
            <form onSubmit={registrarSaida} className="space-y-5 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="saida-destino" className="mb-1 block text-sm font-medium text-gray-900">Destino</label>
                  <select id="saida-destino" value={destinoId} onChange={(event) => setDestinoId(event.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-gray-950" required>
                    <option value="">Selecione</option>
                    {destinos.map((destino) => <option key={destino.id} value={destino.id}>{destino.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="saida-observacao" className="mb-1 block text-sm font-medium text-gray-900">Observação</label>
                  <input id="saida-observacao" value={observacao} onChange={(event) => setObservacao(event.target.value)} placeholder="Ex.: carga do turno da noite" className="w-full rounded-lg border border-gray-300 p-2 text-gray-950" />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="hidden grid-cols-[120px_minmax(0,1fr)_130px_40px] gap-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 sm:grid">
                  <span>Tipo</span><span>Item</span><span>Quantidade</span><span />
                </div>
                <div className="divide-y divide-gray-100">
                  {linhas.map((linha) => {
                    const selecionado = itemSelecionado(linha)
                    const opcoes = linha.tipo === 'INSUMO' ? insumos : produtos
                    const saldo = linha.tipo === 'INSUMO'
                      ? (selecionado as Insumo | undefined)?.saldoAtual
                      : (selecionado as Produto | undefined)?.estoque
                    const unidade = linha.tipo === 'INSUMO' ? (selecionado as Insumo | undefined)?.unidade : 'UN'
                    return (
                      <div key={linha.chave} className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[120px_minmax(0,1fr)_130px_40px] sm:items-start">
                        <select aria-label="Tipo do item" value={linha.tipo} onChange={(event) => alterarLinha(linha.chave, { tipo: event.target.value as LinhaSaida['tipo'], itemId: '' })} className="rounded-lg border border-gray-300 p-2 text-sm text-gray-950">
                          <option value="PRODUTO">Produto</option>
                          <option value="INSUMO">Insumo</option>
                        </select>
                        <div>
                          <select aria-label="Item de estoque" value={linha.itemId} onChange={(event) => alterarLinha(linha.chave, { itemId: event.target.value })} className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-950" required>
                            <option value="">Selecione</option>
                            {opcoes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                          </select>
                          {selecionado && <p className="mt-1 text-xs text-gray-500">Saldo central: {formatarQuantidade(saldo, unidade ?? 'UN')}</p>}
                        </div>
                        <input aria-label="Quantidade enviada" inputMode="decimal" value={linha.quantidade} onChange={(event) => alterarLinha(linha.chave, { quantidade: event.target.value })} className="rounded-lg border border-gray-300 p-2 text-sm text-gray-950" placeholder="0" required />
                        <button type="button" title="Remover item" aria-label="Remover item" disabled={linhas.length === 1} onClick={() => setLinhas((atuais) => atuais.filter((item) => item.chave !== linha.chave))} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button type="button" onClick={() => setLinhas((atuais) => [...atuais, novaLinha(Math.max(...atuais.map((item) => item.chave), 0) + 1)])} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-700 hover:text-orange-800">
                <Plus className="h-4 w-4" /> Adicionar item
              </button>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <Button type="button" variant="outline" onClick={fecharSaida} disabled={salvandoSaida}>Cancelar</Button>
                <Button type="submit" isLoading={salvandoSaida}>Registrar saída</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saidaDevolucao && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-3xl rounded-lg bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-bold text-gray-950">Registrar devolução</h2>
              <p className="mt-1 text-sm text-gray-600">{saidaDevolucao.numero} para {saidaDevolucao.destino.nome}</p>
            </div>
            <form onSubmit={registrarDevolucao} className="space-y-5 px-6 py-5">
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <div className="hidden grid-cols-[minmax(0,1fr)_130px_150px] gap-3 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 sm:grid">
                  <span>Item pendente</span><span>Quantidade</span><span>Destino do item</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {saidaDevolucao.itens.filter((item) => comoNumero(item.quantidadeDisponivel) > 0).map((item) => (
                    <div key={item.id} className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_130px_150px] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.nomeSnapshot}</p>
                        <p className="text-xs text-gray-500">Disponível: {formatarQuantidade(item.quantidadeDisponivel, item.unidadeSnapshot)}</p>
                      </div>
                      <input aria-label={`Quantidade devolvida de ${item.nomeSnapshot}`} inputMode="decimal" value={linhasDevolucao[item.id]?.quantidade ?? ''} onChange={(event) => setLinhasDevolucao((atuais) => ({ ...atuais, [item.id]: { ...atuais[item.id], quantidade: event.target.value } }))} className="rounded-lg border border-gray-300 p-2 text-sm text-gray-950" placeholder="0" />
                      <select aria-label={`Condição de ${item.nomeSnapshot}`} value={linhasDevolucao[item.id]?.condicao ?? 'REESTOQUE'} onChange={(event) => setLinhasDevolucao((atuais) => ({ ...atuais, [item.id]: { ...atuais[item.id], condicao: event.target.value as LinhaDevolucao['condicao'] } }))} className="rounded-lg border border-gray-300 p-2 text-sm text-gray-950">
                        <option value="REESTOQUE">Volta ao estoque</option>
                        <option value="PERDA">Perda/descarte</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="devolucao-motivo" className="mb-1 block text-sm font-medium text-gray-900">Motivo</label>
                <textarea id="devolucao-motivo" value={motivoDevolucao} onChange={(event) => setMotivoDevolucao(event.target.value)} className="min-h-20 w-full rounded-lg border border-gray-300 p-2 text-gray-950" placeholder="Ex.: sobra do turno" required />
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <Button type="button" variant="outline" onClick={() => setSaidaDevolucao(null)} disabled={salvandoDevolucao}>Cancelar</Button>
                <Button type="submit" isLoading={salvandoDevolucao}>Registrar devolução</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {comparacao && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-5xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">Comparação do estoque da cozinha</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Saídas para {comparacao.destino} comparadas com os pedidos lançados pelos garçons.
                </p>
              </div>
              <button type="button" title="Fechar" aria-label="Fechar comparação" onClick={() => setComparacao(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto px-6 py-5">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-gray-200 bg-gray-50 text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3 text-right">Enviado</th>
                    <th className="px-3 py-3 text-right">Pedidos</th>
                    <th className="px-3 py-3 text-right">Devolvido</th>
                    <th className="px-3 py-3 text-right">Perda</th>
                    <th className="px-3 py-3 text-right">Diferença</th>
                    <th className="px-3 py-3">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {comparacao.data.map((item) => (
                    <tr key={`${item.tipo}-${item.itemId}`}>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-900">{item.nome}</p>
                        <p className="text-xs text-gray-500">{item.tipo === 'PRODUTO' ? 'Produto pronto' : 'Insumo por ficha técnica'}</p>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700">{formatarQuantidade(item.enviado, item.unidade)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{formatarQuantidade(item.lancado, item.unidade)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{formatarQuantidade(item.devolvido, item.unidade)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{formatarQuantidade(item.perda, item.unidade)}</td>
                      <td className={`px-3 py-3 text-right font-bold ${comoNumero(item.diferenca) === 0 ? 'text-green-700' : comoNumero(item.diferenca) > 0 ? 'text-amber-700' : 'text-red-700'}`}>
                        {formatarQuantidade(item.diferenca, item.unidade)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          item.status === 'CONCILIADO'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'SOBRA_ESPERADA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                        }`}>
                          {item.status === 'CONCILIADO' ? 'Conciliado' : item.status === 'SOBRA_ESPERADA' ? 'Sobra esperada' : 'Consumo maior'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {comparacao.data.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-gray-500">Nenhuma saída para a cozinha foi registrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 px-6 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <p>Diferença = enviado - pedidos - devoluções - perdas.</p>
              <p>Atualizado em {formatarData(comparacao.geradoEm)}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
