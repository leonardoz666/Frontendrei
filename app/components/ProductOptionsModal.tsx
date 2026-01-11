import { useState, useEffect } from 'react'
import { X, Check, Minus, Plus } from 'lucide-react'
import { Produto } from '@/types'

interface ProductOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
  onConfirm: (
    quantity: number, 
    observation: string, 
    selectedOptions: string[],
    finalPrice: number
  ) => void
}

export function ProductOptionsModal({ isOpen, onClose, product, onConfirm }: ProductOptionsModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [observation, setObservation] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  
  // States for specific types
  
  useEffect(() => {
    if (isOpen) {
      setQuantity(1)
      setObservation('')
      setSelectedOptions([])
    }
  }, [isOpen, product])

  if (!isOpen || !product) return null

  const parseSabores = () => {
    try {
      if (!product.sabores) return []
      return JSON.parse(product.sabores)
    } catch (e) {
      return []
    }
  }

  const options = parseSabores()

  const handleConfirm = () => {
    // Validation
    if (product.tipoOpcao === 'combinado' && selectedOptions.length === 0) {
      // Allow empty? Maybe enforce at least one?
    }

    // Construct final observation with options
    const optionsText = selectedOptions.length > 0 ? ` [${selectedOptions.join(', ')}]` : ''
    const finalObs = (observation + optionsText).trim()

    onConfirm(quantity, finalObs, selectedOptions, product.preco)
  }

  const toggleOption = (opt: string) => {
    if (selectedOptions.includes(opt)) {
      setSelectedOptions(prev => prev.filter(o => o !== opt))
    } else {
      setSelectedOptions(prev => [...prev, opt])
    }
  }

  const selectSingleOption = (opt: string) => {
    setSelectedOptions([opt])
  }

  const renderContent = () => {
    switch (product.tipoOpcao) {
      case 'combinado':
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Escolha os sabores (Máx: 2)</h3>
            <div className="grid grid-cols-1 gap-2">
              {Array.isArray(options) && options.map((opt: string) => (
                <button
                  key={opt}
                  onClick={() => {
                    if (selectedOptions.includes(opt)) {
                      toggleOption(opt)
                    } else {
                      if (selectedOptions.length < 2) toggleOption(opt)
                    }
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all flex justify-between items-center ${
                    selectedOptions.includes(opt)
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                      : 'border-gray-100 bg-white text-gray-600 hover:border-orange-200'
                  }`}
                >
                  <span>{opt}</span>
                  {selectedOptions.includes(opt) && <Check size={20} />}
                </button>
              ))}
            </div>
          </div>
        )

      case 'sabores': // Example: Água (Com gás, Sem gás)
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Selecione uma opção</h3>
            <div className="grid grid-cols-2 gap-3">
              {Array.isArray(options) && options.map((opt: string) => (
                <button
                  key={opt}
                  onClick={() => selectSingleOption(opt)}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    selectedOptions.includes(opt)
                      ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                      : 'border-gray-100 bg-white text-gray-600 hover:border-orange-200'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )

      case 'refrigerante':
        // Assuming options are sizes like ["Lata", "1L", "600ml"]
        // And for each size we allow "Normal" or "Zero"
        return (
          <div className="space-y-6">
            {Array.isArray(options) && options.map((size: string) => (
              <div key={size} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3 uppercase text-sm tracking-wide border-b border-gray-200 pb-2">{size}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedOptions([`${size} - Normal`])}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                      selectedOptions.includes(`${size} - Normal`)
                        ? 'bg-orange-500 text-white border-orange-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setSelectedOptions([`${size} - Zero`])}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${
                      selectedOptions.includes(`${size} - Zero`)
                        ? 'bg-green-600 text-white border-green-700 shadow-md'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-green-300'
                    }`}
                  >
                    Zero
                  </button>
                </div>
              </div>
            ))}
          </div>
        )

      case 'tamanho_pg':
        return (
           <div className="space-y-4">
            <h3 className="font-bold text-gray-700">Selecione o tamanho</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => selectSingleOption('Pequeno (P)')}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  selectedOptions.includes('Pequeno (P)')
                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                    : 'border-gray-100 bg-white text-gray-600 hover:border-orange-200'
                }`}
              >
                Pequeno (P)
              </button>
              <button
                onClick={() => selectSingleOption('Grande (G)')}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  selectedOptions.includes('Grande (G)')
                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                    : 'border-gray-100 bg-white text-gray-600 hover:border-orange-200'
                }`}
              >
                Grande (G)
              </button>
            </div>
          </div>
        )

      case 'sabores_com_tamanho':
        const sizes = ['Pequeno (P)', 'Grande (G)']
        const currentSize = selectedOptions.find(o => sizes.includes(o))
        const currentFlavor = selectedOptions.find(o => !sizes.includes(o))

        return (
          <div className="space-y-6">
            {/* Size Selection */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-700">1. Escolha o tamanho</h3>
              <div className="grid grid-cols-2 gap-3">
                {sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      // Remove other sizes, keep flavor
                      const newOptions = selectedOptions.filter(o => !sizes.includes(o))
                      setSelectedOptions([...newOptions, size])
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      selectedOptions.includes(size)
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                        : 'border-gray-100 bg-white text-gray-600 hover:border-orange-200'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Flavor Selection */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-700">2. Escolha o sabor</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.isArray(options) && options.map((flavor: string) => (
                  <button
                    key={flavor}
                    onClick={() => {
                      // Remove other flavors (non-sizes), keep size
                      const newOptions = selectedOptions.filter(o => sizes.includes(o))
                      setSelectedOptions([...newOptions, flavor])
                    }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      selectedOptions.includes(flavor)
                        ? 'border-orange-500 bg-orange-50 text-orange-700 font-bold'
                        : 'border-gray-100 bg-white text-gray-600 hover:border-orange-200'
                    }`}
                  >
                    {flavor}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const commonTags = ['Com gelo', 'Sem gelo', 'Com limão', 'Sem limão', 'Bem passado', 'Mal passado']

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-2xl sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{product.nome}</h2>
            <p className="text-orange-500 font-bold">R$ {product.preco.toFixed(2).replace('.', ',')}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {renderContent()}

          {/* Quantity */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
            <span className="font-bold text-gray-700">Quantidade</span>
            <div className="flex items-center gap-4 bg-white rounded-lg p-1 border border-gray-200">
              <button 
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <Minus size={20} />
              </button>
              <span className="font-bold text-xl w-8 text-center">{quantity}</span>
              <button 
                onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 rounded-md flex items-center justify-center bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Observation */}
          <div className="space-y-3">
            <label className="font-bold text-gray-700 block">Observação (Opcional)</label>
            
            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2">
              {commonTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setObservation(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-transparent hover:border-orange-200 transition-all"
                >
                  {tag}
                </button>
              ))}
            </div>

            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Ex: Tirar a cebola, colocar gelo..."
              className="w-full p-4 rounded-xl bg-gray-50 border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all resize-none text-gray-700"
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl sticky bottom-0 z-10">
          <button
            onClick={handleConfirm}
            disabled={
              (product.tipoOpcao === 'combinado' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'refrigerante' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'sabores' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'tamanho_pg' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'sabores_com_tamanho' && selectedOptions.length < 2)
            }
            className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span>Adicionar ao Pedido</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              R$ {(product.preco * quantity).toFixed(2).replace('.', ',')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
