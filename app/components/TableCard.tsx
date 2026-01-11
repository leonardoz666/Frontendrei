import { clsx } from 'clsx'

export type MesaStatus = 'LIVRE' | 'OCUPADA' | 'FECHAMENTO'

export interface Mesa {
  id: number
  numero: number
  status: MesaStatus
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
}

const formatTime = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function TableCard({ mesa, onClick }: TableCardProps) {
  const isOcupada = mesa.status === 'OCUPADA'
  const isFechamento = mesa.status === 'FECHAMENTO'
  
  let borderColor = "border-green-200"
  let numColor = "text-green-600"
  let badgeClass = "bg-green-50 text-green-500"
  let statusText: string = mesa.status

  if (isOcupada) {
    borderColor = "border-yellow-200"
    numColor = "text-yellow-500"
    badgeClass = "bg-yellow-50 text-yellow-600"
    statusText = "Em Andamento"
  } else if (isFechamento) {
    borderColor = "border-red-200"
    numColor = "text-red-600"
    badgeClass = "bg-red-50 text-red-600"
    statusText = "FECHANDO"
  }

  return (
    <div
      onClick={() => onClick(mesa)}
      className={clsx(
        "bg-white rounded-[2rem] p-6 flex flex-col items-center justify-center gap-4 aspect-square shadow-[0_2px_20px_rgba(0,0,0,0.04)] border transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg",
        borderColor
      )}
    >
      <span className={clsx(
        "text-5xl font-bold tracking-tight",
        numColor
      )}>
        {mesa.numero.toString().padStart(2, '0')}
      </span>
      
      <div className={clsx(
        "px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase",
        badgeClass
      )}>
        {statusText}
      </div>

      {(isOcupada || isFechamento) && mesa.comandas?.[0] && (
        <div className="flex flex-col items-center mt-3 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-xs font-bold text-gray-600 truncate max-w-[120px] flex items-center gap-1">
            👤 {mesa.comandas[0].usuario?.nome?.split(' ')[0] || 'Desconhecido'}
          </span>
          <span className="text-[10px] font-medium text-gray-400 mt-0.5 flex items-center gap-1">
            🕒 {formatTime(mesa.comandas[0].abertaEm)}
          </span>
        </div>
      )}
    </div>
  )
}
