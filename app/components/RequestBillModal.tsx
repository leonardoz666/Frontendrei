'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, CircleDollarSign, FileText, Loader2, Users, X } from 'lucide-react'
import { apiFetch } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

interface RequestBillModalProps {
  isOpen: boolean
  mesaId: number | string
  onClose: () => void
  onRequestSuccess?: () => void
}

export function RequestBillModal({ isOpen, mesaId, onClose, onRequestSuccess }: RequestBillModalProps) {
  const { showToast } = useToast()
  const [splitPeople, setSplitPeople] = useState('1')
  const [pendingAction, setPendingAction] = useState<'request' | 'print' | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSplitPeople('1')
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleRequestBill = async () => {
    setPendingAction('request')
    try {
      await apiFetch(`/tables/${mesaId}/request-bill`, {
        method: 'POST',
        body: { splitPeople: Math.max(1, Number(splitPeople) || 1) }
      })
      showToast('Conta enviada para fechamento.', 'success')
      onClose()
      onRequestSuccess?.()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao solicitar a conta', 'error')
    } finally {
      setPendingAction(null)
    }
  }

  const handlePrintPartialBill = async () => {
    setPendingAction('print')
    try {
      await apiFetch(`/tables/${mesaId}/print-partial`, {
        method: 'POST',
        body: { splitPeople: Math.max(1, Number(splitPeople) || 1) }
      })
      showToast('Conta parcial enviada para a impressora.', 'success')
      onClose()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao imprimir conta parcial', 'error')
    } finally {
      setPendingAction(null)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pendingAction) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="request-bill-title" className="w-full max-w-md overflow-hidden rounded-xl bg-white text-black shadow-2xl">
        <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="request-bill-title" className="flex items-center gap-2 text-xl font-bold">
                <CircleDollarSign size={22} /> Solicitação de conta
              </h2>
              <p className="mt-1 text-sm text-orange-100">Selecione uma opção abaixo</p>
            </div>
            <button type="button" onClick={onClose} disabled={Boolean(pendingAction)} aria-label="Fechar" className="rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-50">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <label htmlFor="request-bill-people" className="mb-2 block text-sm font-bold text-black">Dividir para quantas pessoas?</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-800" size={22} />
              <input
                id="request-bill-people"
                type="number"
                min={1}
                max={99}
                value={splitPeople}
                onChange={(event) => setSplitPeople(event.target.value)}
                className="h-14 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-lg font-bold text-black outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </div>
          </div>

          <div className="grid gap-3">
            <button type="button" onClick={handleRequestBill} disabled={Boolean(pendingAction)} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 font-bold text-white shadow-lg shadow-green-200 transition-colors hover:bg-green-700 disabled:opacity-50">
              {pendingAction === 'request' ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
              Fechar conta
            </button>
            <button type="button" onClick={handlePrintPartialBill} disabled={Boolean(pendingAction)} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700 disabled:opacity-50">
              {pendingAction === 'print' ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
              Conta parcial
            </button>
            <button type="button" onClick={onClose} disabled={Boolean(pendingAction)} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 font-bold text-black transition-colors hover:bg-gray-200 disabled:opacity-50">
              <X size={20} className="text-pink-500" /> Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
