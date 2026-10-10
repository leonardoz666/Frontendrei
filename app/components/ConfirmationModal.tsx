import { ReactNode } from 'react';
import { X, Check, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'success' | 'warning' | 'info';
  children?: ReactNode;
  showCancel?: boolean;
  closeOnConfirm?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  children,
  showCancel = true,
  closeOnConfirm = true
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:p-4">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 sm:max-h-[calc(100dvh-2rem)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            {variant === 'danger' && <div className="p-3 rounded-full bg-red-100 text-red-600"><AlertTriangle size={24} /></div>}
            {variant === 'warning' && <div className="p-3 rounded-full bg-amber-100 text-amber-600"><AlertTriangle size={24} /></div>}
            {variant === 'success' && <div className="p-3 rounded-full bg-emerald-100 text-emerald-600"><Check size={24} /></div>}
            {variant === 'info' && <div className="p-3 rounded-full bg-blue-100 text-blue-600"><Info size={24} /></div>}
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          
          {description && <p className="text-gray-500 mb-6 leading-relaxed">{description}</p>}
          
          {children}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            {showCancel && (
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <X size={20} />
                {cancelText}
              </button>
            )}
            <button
              onClick={() => {
                if (onConfirm) onConfirm();
                if (closeOnConfirm) onClose();
              }}
              className={clsx(
                "flex-1 py-3 px-4 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2",
                variant === 'danger' ? "bg-red-600 hover:bg-red-500" : 
                variant === 'success' ? "bg-emerald-600 hover:bg-emerald-500" :
                variant === 'warning' ? "bg-amber-600 hover:bg-amber-500" :
                "bg-blue-600 hover:bg-blue-500"
              )}
            >
              <Check size={20} />
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
