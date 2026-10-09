'use client'

import { useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { useToast } from '@/contexts/ToastContext'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => unknown | Promise<unknown>
  label: string
  description?: string
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md'
  className?: string
  /** Chamado quando a escrita assíncrona falha; o estado visual é revertido antes. */
  onError?: (error: unknown) => void
}

/**
 * Controle booleano único do Rei.
 *
 * A interface esconde semântica, teclado, foco, estado pendente e atualização
 * otimista. Promessas rejeitadas — ou handlers que retornem `false`/`null` —
 * restauram automaticamente o valor anterior.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  loading = false,
  size = 'md',
  className,
  onError,
}: SwitchProps) {
  const { showToast } = useToast()
  const descriptionId = useId()
  const [visualChecked, setVisualChecked] = useState(checked)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!pending) setVisualChecked(checked)
  }, [checked, pending])

  const toggle = async () => {
    if (disabled || loading || pending) return
    const anterior = visualChecked
    const proximo = !anterior
    setVisualChecked(proximo)
    setPending(true)
    try {
      const resultado = await onCheckedChange(proximo)
      if (resultado === false || resultado === null) {
        setVisualChecked(anterior)
        showToast(`Não foi possível alterar “${label}”`, 'error')
      }
    } catch (error) {
      setVisualChecked(anterior)
      if (onError) onError(error)
      else showToast(error instanceof Error ? error.message : `Erro ao alterar “${label}”`, 'error')
    } finally {
      setPending(false)
    }
  }

  const ocupado = loading || pending
  const dimensoes = size === 'sm'
    ? { trilho: 'h-6 w-11 p-0.5', botao: 'h-5 w-5', spinner: 'h-3 w-3' }
    : { trilho: 'h-7 w-12 p-0.5', botao: 'h-6 w-6', spinner: 'h-3.5 w-3.5' }

  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        {description && <span id={descriptionId} className="mt-0.5 block text-xs text-gray-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={visualChecked}
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={ocupado}
        disabled={disabled || ocupado}
        onClick={() => void toggle()}
        className={cn(
          'relative flex shrink-0 items-center rounded-full border transition-[background-color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          dimensoes.trilho,
          visualChecked ? 'justify-end border-orange-600 bg-orange-600' : 'justify-start border-gray-300 bg-gray-200'
        )}
      >
        <span className={cn('flex items-center justify-center rounded-full bg-white text-orange-600 shadow-sm transition-transform motion-reduce:transition-none', dimensoes.botao)}>
          {ocupado && <Loader2 className={cn('animate-spin', dimensoes.spinner)} aria-hidden="true" />}
        </span>
      </button>
    </div>
  )
}
