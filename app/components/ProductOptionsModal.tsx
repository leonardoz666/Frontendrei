import { useState, useEffect } from 'react'
import { X, Check, Minus, Plus, Snowflake, Citrus } from 'lucide-react'
import { Produto } from '@/types'

interface ProductOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
  onConfirm: (
    quantity: number, 
    observation: string, 
    selectedOptions: string[],
    finalPrice: number,
    extraItems?: Array<{quantity: number, observation: string, preco: number, nameSuffix?: string}>,
    productNameSuffix?: string
  ) => void
}

export function ProductOptionsModal({ isOpen, onClose, product, onConfirm }: ProductOptionsModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [observation, setObservation] = useState('')
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [optionQuantities, setOptionQuantities] = useState<Record<string, number>>({})
  const [wantsGelo, setWantsGelo] = useState(false)
  const [wantsLimao, setWantsLimao] = useState(false)
  
  // States for specific types
  
  useEffect(() => {
    if (isOpen) {
      setQuantity(1)
      setObservation('')
      setSelectedOptions([])
      setOptionQuantities({})
      setWantsGelo(false)
      setWantsLimao(false)
    }
  }, [isOpen, product])

  if (!isOpen || !product) return null

  const parseSabores = () => {
    try {
      if (!product.sabores) return []
      return JSON.parse(product.sabores)
    } catch {
      return []
    }
  }

  const options = parseSabores()

  const updateOptionQuantity = (opt: string, delta: number) => {
    setOptionQuantities(prev => {
      const current = prev[opt] || 0
      const newQty = Math.max(0, current + delta)
      
      if (newQty === 0) {
        const newPrev = { ...prev }
        delete newPrev[opt]
        return newPrev
      }
      
      return { ...prev, [opt]: newQty }
    })
  }

  const handleConfirm = () => {
    // Validation
    if (product.tipoOpcao === 'combinado' && selectedOptions.length === 0) {
      // Allow empty? Maybe enforce at least one?
    }

    if (product.tipoOpcao === 'refrigerante') {
      const items = Object.entries(optionQuantities)
          .map(([opt, qty]) => {
              let obs = observation
              if (wantsGelo) obs = obs ? `${obs}, Gelo` : 'Gelo'
              if (wantsLimao) obs = obs ? `${obs}, Limão` : 'Limão'
              
              return {
                  quantity: qty,
                  observation: obs,
                  preco: product.preco,
                  nameSuffix: ` ( ${opt} )`
              }
          })
      
      onConfirm(0, '', [], 0, items)
      return
    }

    // Construct final observation with options
    const optionsText = selectedOptions.length > 0 ? ` ( ${selectedOptions.join(', ')} )` : ''
    
    let obs = observation
    if (wantsGelo) obs = obs ? `${obs}, Gelo` : 'Gelo'
    if (wantsLimao) obs = obs ? `${obs}, Limão` : 'Limão'
    
    onConfirm(quantity, obs, selectedOptions, product.preco, undefined, optionsText)
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
        // If no sizes provided, use defaults
        const refriSizes = (Array.isArray(options) && options.length > 0) 
          ? options 
          : ['Lata', 'KS', '1 Litro']

        return (
          <div className="space-y-6">
            {refriSizes.map((size: string) => (
              <div key={size} className="">
                <h4 className="font-bold text-gray-500 mb-3 uppercase text-xs tracking-wider ml-1">{size}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Normal Option */}
                  <div className={`rounded-xl border-2 overflow-hidden transition-all ${
                    optionQuantities[`${size} - Normal`]
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-100 bg-white'
                  }`}>
                    <div className="p-3 text-center">
                      <span className="font-bold text-gray-900 block mb-2">Normal</span>
                      
                      {optionQuantities[`${size} - Normal`] ? (
                        <div className="flex items-center justify-between bg-white rounded-lg p-1 border border-orange-200">
                          <button 
                            onClick={() => updateOptionQuantity(`${size} - Normal`, -1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-orange-600"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-bold text-orange-700 w-6 text-center">
                            {optionQuantities[`${size} - Normal`]}
                          </span>
                          <button 
                            onClick={() => updateOptionQuantity(`${size} - Normal`, 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-orange-600"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateOptionQuantity(`${size} - Normal`, 1)}
                          className="w-full py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        >
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Zero Option */}
                  <div className={`rounded-xl border-2 overflow-hidden transition-all ${
                    optionQuantities[`${size} - Zero`]
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-100 bg-white'
                  }`}>
                    <div className="p-3 text-center">
                      <span className="font-bold text-green-600 block mb-2">Zero</span>
                      
                      {optionQuantities[`${size} - Zero`] ? (
                        <div className="flex items-center justify-between bg-white rounded-lg p-1 border border-green-200">
                          <button 
                            onClick={() => updateOptionQuantity(`${size} - Zero`, -1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-green-600"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-bold text-green-700 w-6 text-center">
                            {optionQuantities[`${size} - Zero`]}
                          </span>
                          <button 
                            onClick={() => updateOptionQuantity(`${size} - Zero`, 1)}
                            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-green-600"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateOptionQuantity(`${size} - Zero`, 1)}
                          className="w-full py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                        >
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
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

  const getTags = () => {
    const isDrink = ['refrigerante', 'sabores'].includes(product.tipoOpcao || '') || product.setor === 'Bebidas' || product.setor === 'Drinks' || product.isDrink
    
    if (isDrink) {
      // Removed Gelo/Limao from text tags since they are now buttons
      return []
    }
    return ['Sem cebola', 'Sem molho', 'Bem passado', 'Ao ponto', 'Mal passado']
  }

  const showGeloLimao = product.permiteGeloLimao

  const commonTags = getTags()

  const totalQuantity = product.tipoOpcao === 'refrigerante'
    ? Object.values(optionQuantities).reduce((a, b) => a + b, 0)
    : quantity

  const totalPrice = totalQuantity * product.preco

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
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {renderContent()}

          {/* Quantity - Hide for refrigerante since it has per-item quantity */}
          {product.tipoOpcao !== 'refrigerante' && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
              <span className="font-bold text-gray-700">Quantidade</span>
              <div className="flex items-center gap-4 bg-white rounded-lg p-1 border border-gray-200">
                <button 
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors">
                  <Minus size={20} />
                </button>
                <span className="font-bold text-xl w-8 text-center">{quantity}</span>
                <button 
                  onClick={() => setQuantity(q => q + 1)}
                  className="w-10 h-10 rounded-md flex items-center justify-center bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
                  <Plus size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Special Drink Options (Gelo/Limao) - Controlled by admin setting */}
          {showGeloLimao && (
             <div className="grid grid-cols-2 gap-3">
               <button
                 onClick={() => setWantsGelo(!wantsGelo)}
                 className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                   wantsGelo
                     ? 'border-blue-400 bg-blue-50 text-blue-700 font-bold'
                     : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <Snowflake size={20} className={wantsGelo ? 'fill-blue-400' : ''} />
                 <span>Com Gelo</span>
                 {wantsGelo && <Check size={16} className="ml-auto" />}
               </button>
               
               <button
                 onClick={() => setWantsLimao(!wantsLimao)}
                 className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                   wantsLimao
                     ? 'border-green-500 bg-green-50 text-green-700 font-bold'
                     : 'border-gray-100 bg-gray-50 text-gray-600 hover:bg-gray-100'
                 }`}
               >
                 <Citrus size={20} className={wantsLimao ? 'fill-green-500' : ''} />
                 <span>Com Limão</span>
                 {wantsLimao && <Check size={16} className="ml-auto" />}
               </button>
             </div>
          )}

          {/* Observation */}
          {(product.permitirObservacao !== false) && (
            <div className="space-y-3">
              <label className="font-bold text-gray-700 block">Observação (Opcional)</label>
              
              {/* Quick Tags */}
              <div className="flex flex-wrap gap-2">
                {commonTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setObservation(prev => prev ? `${prev}, ${tag}` : tag)}
                    className="px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-transparent hover:border-orange-200 transition-all">
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
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white rounded-b-2xl sticky bottom-0 z-10">
          <button
            onClick={handleConfirm}
            disabled={
              (product.tipoOpcao === 'combinado' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'refrigerante' && Object.keys(optionQuantities).length === 0) ||
              (product.tipoOpcao === 'sabores' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'tamanho_pg' && selectedOptions.length === 0) ||
              (product.tipoOpcao === 'sabores_com_tamanho' && selectedOptions.length < 2)
            }
            className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <span>Adicionar ao Pedido</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
              R$ {totalPrice.toFixed(2).replace('.', ',')}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
