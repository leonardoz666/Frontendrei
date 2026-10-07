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
  let footerColor = ""
  let userColor = "text-gray-700"
  let timeColor = "text-gray-500"
  let statusText: string = mesa.status

  if (isOcupada) {
    borderColor = "border-amber-300"
    backgroundColor = "bg-amber-300"
    numColor = "text-black"
    badgeClass = "text-black"
    footerColor = "bg-amber-400"
    userColor = "text-black"
    timeColor = "text-black"
    statusText = "Em Andamento"
  } else if (isFechamento) {
    borderColor = "border-red-500"
    backgroundColor = "bg-red-500"
    numColor = "text-white"
    badgeClass = "text-white"
    footerColor = "bg-red-600"
    userColor = "text-white"
    timeColor = "text-red-100"
    statusText = "FECHANDO"
  }

  return (
    <div
      onClick={() => onClick(mesa)}
      className={clsx(
        "flex min-h-[148px] cursor-pointer flex-col overflow-hidden rounded-2xl border shadow-[0_2px_14px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-lg",
        borderColor,
        backgroundColor
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-3">
        <span className={clsx(
          "text-4xl font-bold tracking-tight",
          numColor
        )}>
          {mesa.numero.toString().padStart(2, '0')}
        </span>

        <div className={clsx(
          "text-[10px] font-bold uppercase",
          !isOcupada && !isFechamento && "rounded-full px-3 py-1",
          badgeClass
        )}>
          {statusText}
        </div>
      </div>

      {(isOcupada || isFechamento) && mesa.comandas?.[0] && (
        <div className={clsx("flex min-h-12 w-full animate-in flex-col items-center justify-center px-3 py-2 fade-in slide-in-from-bottom-2", footerColor)}>
          <span className={clsx("max-w-[120px] truncate text-[11px] font-bold", userColor)}>
            {mesa.comandas[0].usuario?.nome?.split(' ')[0] || fallbackUsuarioNome || 'Desconhecido'}
          </span>
          <span className={clsx("mt-0.5 text-[10px] font-medium", timeColor)}>
            {formatTime(mesa.comandas[0].abertaEm)}
          </span>
        </div>
      )}
    </div>
  )
}
