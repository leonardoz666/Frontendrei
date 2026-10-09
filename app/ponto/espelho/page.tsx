'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Download, TriangleAlert } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { apiFetch, fetchList } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

type Funcionario = { id: number; nome: string; cpf: string; status: string }
type Registro = { nsr: number; dataHora: string; tipo: string; origem: string; nsrOriginal: number | null }
type EspelhoDia = { data: string; registros: Registro[]; minutosTrabalhados: number; pendencias: string[] }
type Espelho = {
  funcionario: { id: number; nome: string; cpf: string }
  inicio: string
  fim: string
  dias: EspelhoDia[]
  totalMinutos: number
}

function dataInput(data: Date): string {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function minutosTexto(minutos: number): string {
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}min`
}

function intervaloCompleto(inicio: string, fim: string) {
  return {
    inicio: new Date(`${inicio}T00:00:00`).toISOString(),
    fim: new Date(`${fim}T23:59:59.999`).toISOString(),
  }
}

export default function EspelhoPontoPage() {
  const hoje = new Date()
  const haTrintaDias = new Date(hoje)
  haTrintaDias.setDate(hoje.getDate() - 30)
  const { showToast } = useToast()
  const [funcionarioId, setFuncionarioId] = useState('')
  const [inicio, setInicio] = useState(dataInput(haTrintaDias))
  const [fim, setFim] = useState(dataInput(hoje))
  const [espelho, setEspelho] = useState<Espelho | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['ponto-funcionarios-espelho'],
    queryFn: () => fetchList<Funcionario>('/ponto/funcionarios?page=1&pageSize=100'),
  })

  const consultar = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!funcionarioId || !inicio || !fim) return
    setCarregando(true)
    try {
      const periodo = intervaloCompleto(inicio, fim)
      const query = new URLSearchParams({ funcionarioId, ...periodo })
      setEspelho(await apiFetch<Espelho>(`/ponto/espelho?${query.toString()}`))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao gerar espelho', 'error')
    } finally {
      setCarregando(false)
    }
  }

  const exportarPdf = async () => {
    if (!espelho) return
    setGerandoPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const margem = 14
      const largura = doc.internal.pageSize.getWidth()
      const altura = doc.internal.pageSize.getHeight()
      let y = 16

      const cabecalho = () => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(17, 24, 39)
        doc.text('Espelho de ponto', margem, 16)
        doc.setFontSize(10)
        doc.text(espelho.funcionario.nome, margem, 23)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(75, 85, 99)
        doc.text(`CPF: ${espelho.funcionario.cpf}`, margem, 28)
        doc.text(`Período: ${new Date(espelho.inicio).toLocaleDateString('pt-BR')} a ${new Date(espelho.fim).toLocaleDateString('pt-BR')}`, margem, 33)
        doc.text(`Total líquido apurado: ${minutosTexto(espelho.totalMinutos)}`, margem, 38)
        doc.setDrawColor(209, 213, 219)
        doc.line(margem, 42, largura - margem, 42)
        y = 49
      }
      cabecalho()

      if (espelho.dias.length === 0) {
        doc.text('Nenhum registro no período.', margem, y)
      }
      for (const dia of espelho.dias) {
        const marcacoes = dia.registros.map(registro => `${new Date(registro.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${registro.tipo.replaceAll('_', ' ')}`).join('  |  ')
        const linhasMarcacoes = doc.splitTextToSize(marcacoes || 'Sem marcações', largura - margem * 2 - 42) as string[]
        const linhasPendencias = dia.pendencias.flatMap(item => doc.splitTextToSize(`Pendência: ${item}`, largura - margem * 2 - 4) as string[])
        const alturaBloco = 12 + linhasMarcacoes.length * 4 + linhasPendencias.length * 4
        if (y + alturaBloco > altura - 16) {
          doc.addPage()
          cabecalho()
        }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(31, 41, 55)
        doc.text(new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR'), margem, y)
        doc.text(minutosTexto(dia.minutosTrabalhados), largura - margem, y, { align: 'right' })
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(75, 85, 99)
        doc.text(linhasMarcacoes, margem, y + 5)
        if (linhasPendencias.length) {
          doc.setTextColor(146, 64, 14)
          doc.text(linhasPendencias, margem, y + 6 + linhasMarcacoes.length * 4)
        }
        y += alturaBloco
        doc.setDrawColor(229, 231, 235)
        doc.line(margem, y - 4, largura - margem, y - 4)
      }

      const paginas = doc.getNumberOfPages()
      for (let pagina = 1; pagina <= paginas; pagina += 1) {
        doc.setPage(pagina)
        doc.setFontSize(8)
        doc.setTextColor(107, 114, 128)
        doc.text('Documento operacional. Regras trabalhistas e leiaute REP-P dependem de validação jurídica.', margem, altura - 7)
        doc.text(`${pagina}/${paginas}`, largura - margem, altura - 7, { align: 'right' })
      }
      await apiFetch('/ponto/espelho/exportacao', {
        method: 'POST',
        body: { funcionarioId: espelho.funcionario.id, inicio: espelho.inicio, fim: espelho.fim },
      })
      doc.save(`espelho-ponto-${espelho.funcionario.id}-${inicio}-${fim}.pdf`)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao exportar PDF', 'error')
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Espelho de ponto</h1>
        <p className="mt-1 text-sm text-gray-600">Conferência de marcações e horas líquidas por período.</p>
      </div>

      <form onSubmit={consultar} className="grid gap-3 border-b border-gray-200 bg-white py-5 sm:grid-cols-[minmax(220px,1fr)_170px_170px_auto] sm:items-end">
        <label className="text-sm font-semibold text-gray-800">Funcionário
          <select value={funcionarioId} onChange={event => setFuncionarioId(event.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal text-gray-900" required>
            <option value="">Selecione</option>
            {funcionarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-gray-800">Início
          <input type="date" value={inicio} onChange={event => setInicio(event.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-gray-300 px-3 font-normal text-gray-900" required />
        </label>
        <label className="text-sm font-semibold text-gray-800">Fim
          <input type="date" value={fim} onChange={event => setFim(event.target.value)} className="mt-1 block h-11 w-full rounded-lg border border-gray-300 px-3 font-normal text-gray-900" required />
        </label>
        <Button type="submit" isLoading={carregando}><CalendarDays className="mr-2 h-4 w-4" />Consultar</Button>
      </form>

      {espelho && (
        <section className="mt-6">
          <div className="flex flex-col gap-3 border-b-2 border-gray-900 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-950">{espelho.funcionario.nome}</h2>
              <p className="text-sm text-gray-500">{espelho.funcionario.cpf}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right"><p className="text-xs text-gray-500">Total líquido</p><p className="text-2xl font-bold tabular-nums text-gray-950">{minutosTexto(espelho.totalMinutos)}</p></div>
              <Button type="button" variant="outline" onClick={() => void exportarPdf()} isLoading={gerandoPdf}><Download className="mr-2 h-4 w-4" />PDF</Button>
            </div>
          </div>

          {espelho.dias.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-500">Nenhum registro encontrado neste período.</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {espelho.dias.map(dia => (
                <article key={dia.data} className="grid gap-3 py-4 md:grid-cols-[130px_1fr_120px] md:items-start">
                  <div><p className="font-bold text-gray-900">{new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR')}</p><p className="text-xs text-gray-500">{new Date(`${dia.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' })}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {dia.registros.map(registro => <span key={registro.nsr} className="border-l-2 border-orange-500 bg-gray-50 px-2 py-1 text-xs text-gray-700"><b>{new Date(registro.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</b> {registro.tipo.replaceAll('_', ' ')}</span>)}
                    {dia.pendencias.length > 0 && <div className="w-full text-xs font-medium text-amber-800"><TriangleAlert className="mr-1 inline h-4 w-4" />{dia.pendencias.join(' · ')}</div>}
                  </div>
                  <p className="text-right font-bold tabular-nums text-gray-900">{minutosTexto(dia.minutosTrabalhados)}</p>
                </article>
              ))}
            </div>
          )}
          <p className="mt-6 border-t border-gray-200 pt-3 text-xs text-gray-500">Cálculo operacional baseado nos pares de marcações. Atrasos, extras e faltas dependem da validação das regras trabalhistas aplicáveis.</p>
        </section>
      )}
    </main>
  )
}
