import { memo } from 'react'
import Image from 'next/image'
import { ImageIcon, Wine, Utensils, Trash2 } from 'lucide-react'

export type Categoria = {
  id: number
  nome: string
}

export type Produto = {
  id: number
  nome: string
  preco: number
  ativo: boolean
  categoriaId: number | null
  categoria?: Categoria
  foto?: string
  tipoOpcao?: 'padrao' | 'tamanho_pg' | 'refrigerante' | 'sabores' | 'sabores_com_tamanho' | 'combinado'
  sabores?: string // JSON string
  isDrink?: boolean
  isFood?: boolean
  favorito?: boolean
  permitirObservacao?: boolean
  permiteGeloLimao?: boolean
  ultimoUso?: string
}

interface ProductCardProps {
  prod: Produto
  onEdit: (prod: Produto) => void
  onDelete: (id: number) => void
}

export const ProductCard = memo(function ProductCard({ prod, onEdit, onDelete }: ProductCardProps) {
  return (
    <div 
      className={`group relative flex flex-col bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors shadow-sm ${!prod.ativo ? 'opacity-60 grayscale' : ''}`}
    >
      {/* Image Area */}
      <div 
        onClick={() => onEdit(prod)}
        className="aspect-square w-full bg-gray-100 relative overflow-hidden cursor-pointer"
      >
        {!prod.ativo && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10">
            <span className="bg-black/75 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">
              Inativo
            </span>
          </div>
        )}
        {prod.foto ? (
          <Image 
            src={prod.foto} 
            alt={prod.nome} 
            fill
            sizes="(max-width: 640px) 25vw, (max-width: 768px) 20vw, (max-width: 1024px) 16vw, 12vw"
            className="object-cover" 
            loading="lazy"
            unoptimized={prod.foto.startsWith('data:')} // Only unoptimize base64
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
            <ImageIcon size={24} strokeWidth={1.5} />
          </div>
        )}
        
        {/* Type Badge - Smaller - Removed backdrop-blur for performance */}
        {(prod.isDrink || prod.isFood) && (
          <div className="absolute top-1.5 left-1.5 bg-black/80 p-1 rounded-md border border-white/10 shadow-sm z-10">
            {prod.isDrink ? (
              <Wine size={12} className="text-purple-400" />
            ) : (
              <Utensils size={12} className="text-orange-400" />
            )}
          </div>
        )}

        {/* Delete Button (Floating) - Removed backdrop-blur */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(prod.id)
          }}
          className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-y-0 md:translate-y-2 md:group-hover:translate-y-0 duration-200 shadow-sm z-10"
        >
          <Trash2 size={12} />
        </button>

        {/* Simple overlay instead of gradient */}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </div>

      {/* Content */}
      <div 
        onClick={() => onEdit(prod)}
        className="p-2 pt-1.5 relative cursor-pointer"
      >
        <div className="flex items-start justify-between gap-1">
          <span className="font-bold text-[10px] sm:text-xs leading-tight text-gray-800 line-clamp-2">{prod.nome}</span>
        </div>
        
        <div className="mt-1.5 flex flex-wrap gap-1">
          {prod.tipoOpcao !== 'padrao' && (
            <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 leading-none">
              {prod.tipoOpcao === 'refrigerante' ? 'Bebida' : 
               prod.tipoOpcao === 'tamanho_pg' ? 'P/G' : 
               prod.tipoOpcao === 'combinado' ? 'Combinado' : 'Variações'}
            </span>
          )}
          {prod.isDrink && (
             <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 leading-none">
               Drink
             </span>
          )}
        </div>
      </div>
    </div>
  )
}, (prev, next) => {
  return prev.prod.id === next.prod.id && 
         prev.prod.nome === next.prod.nome && 
         prev.prod.preco === next.prod.preco &&
         prev.prod.foto === next.prod.foto &&
         prev.prod.tipoOpcao === next.prod.tipoOpcao &&
         prev.prod.isDrink === next.prod.isDrink &&
         prev.prod.isFood === next.prod.isFood
})
