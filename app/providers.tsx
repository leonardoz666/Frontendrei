'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ToastProvider } from './contexts/ToastContext'
import { createQueryClient } from './lib/queryClient'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  )
}
