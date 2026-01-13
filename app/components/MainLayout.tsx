'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100">
      {!isLoginPage && (
        <>
          {/* Mobile Header */}
          <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <span className="font-bold text-gray-800 text-lg">Rei do Pirão</span>
            <div className="w-8" /> {/* Spacer for centering */}
          </div>

          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </>
      )}

      <main className={`flex-1 ${!isLoginPage ? 'md:ml-64' : ''}`}>
        {children}
      </main>
    </div>
  )
}
