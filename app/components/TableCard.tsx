import { clsx } from 'clsx'

export type MesaStatus = 'LIVRE' | 'OCUPADA' | 'FECHAMENTO'

export interface Mesa {
  id: number
  numero: number
  status: MesaStatus
  praca?: {
    id: number
    nome: string
  } | null
  comandas: {
    id: number
    abertaEm: string
    usuario?: {
      nome: string
    }
  }[]
}

interface TableCardProps {
  mesa: Mesa
  onClick: (mesa: Mesa) => void
  fallbackUsuarioNome?: string
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function TableCard({ mesa, onClick, fallbackUsuarioNome }: TableCardProps) {
  const isOcupada = mesa.status === 'OCUPADA'
  const isFechamento = mesa.status === 'FECHAMENTO'
  
  let borderColor = "border-green-200"
  let backgroundColor = "bg-green-50"
  let numColor = "text-green-600"
  let badgeClass = "bg-green-100 text-green-700"
  let statusText: string = mesa.status

  if (isOcupada) {
    borderColor = "border-yellow-200"
    backgroundColor = "bg-yellow-50"
    numColor = "text-yellow-500"
    badgeClass = "bg-yellow-100 text-yellow-700"
    statusText = "Em Andamento"
  } else if (isFechamento) {
    borderColor = "border-red-200"
    backgroundColor = "bg-red-50"
    numColor = "text-red-600"
    badgeClass = "bg-red-100 text-red-700"
    statusText = "FECHANDO"
  }

  return (
    <div
      onClick={() => onClick(mesa)}
      className={clsx(
        "rounded-2xl p-3 flex min-h-[148px] flex-col items-center justify-center gap-2 shadow-[0_2px_14px_rgba(0,0,0,0.04)] border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        borderColor,
        backgroundColor
      )}
    >
      <span className={clsx(
        "text-4xl font-bold tracking-tight",
        numColor
      )}>
        {mesa.numero.toString().padStart(2, '0')}
      </span>
      
      <div className={clsx(
        "px-3 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase",
        badgeClass
      )}>
        {statusText}
      </div>

      {(isOcupada || isFechamento) && mesa.comandas?.[0] && (
        <div className="mt-1 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
          <span className="max-w-[120px] truncate text-[11px] font-bold text-gray-600">
            {mesa.comandas[0].usuario?.nome?.split(' ')[0] || fallbackUsuarioNome || 'Desconhecido'}
          </span>
          <span className="mt-0.5 text-[10px] font-medium text-gray-400">
            {formatTime(mesa.comandas[0].abertaEm)}
          </span>
        </div>
      )}
    </div>
  )
}
