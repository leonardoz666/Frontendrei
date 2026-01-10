'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Printer } from 'lucide-react'
import Link from 'next/link'

type PrinterConfig = {
  id: number
  setor: string
  name: string
  ip: string
  port: number
  enabled: boolean
}

export default function PrintersPage() {
  const router = useRouter()
  const [printers, setPrinters] = useState<PrinterConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<number | null>(null)

  useEffect(() => {
    fetchPrinters()
  }, [])

  const fetchPrinters = async () => {
    try {
      const res = await fetch('/api/printers')
      if (res.ok) {
        const data = await res.json()
        setPrinters(data)
      } else if (res.status === 401 || res.status === 403) {
        router.push('/')
      }
    } catch (error) {
      console.error('Error fetching printers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (printer: PrinterConfig) => {
    setSaving(printer.id)
    try {
      const res = await fetch(`/api/printers/${printer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: printer.ip,
          port: printer.port,
          enabled: printer.enabled
        })
      })

      if (res.ok) {
        alert('Configuração salva com sucesso!')
        fetchPrinters()
      } else {
        alert('Erro ao salvar configuração.')
      }
    } catch (error) {
      console.error('Error updating printer:', error)
      alert('Erro ao salvar configuração.')
    } finally {
      setSaving(null)
    }
  }

  const handleChange = (id: number, field: keyof PrinterConfig, value: any) => {
    setPrinters(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ))
  }

  if (loading) return <div className="p-8 text-center">Carregando...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Printer className="text-orange-500" />
            Configuração de Impressoras
          </h1>
        </div>

        <div className="grid gap-6">
          {printers.map(printer => (
            <div key={printer.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${printer.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <h2 className="text-xl font-bold text-gray-800">{printer.name}</h2>
                  <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
                    Setor: {printer.setor}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printer.enabled}
                    onChange={(e) => handleChange(printer.id, 'enabled', e.target.checked)}
                    className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-600">Habilitada</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço IP</label>
                  <input
                    type="text"
                    value={printer.ip}
                    onChange={(e) => handleChange(printer.id, 'ip', e.target.value)}
                    placeholder="Ex: 192.168.1.200"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all font-mono text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Porta</label>
                  <input
                    type="number"
                    value={printer.port}
                    onChange={(e) => handleChange(printer.id, 'port', parseInt(e.target.value) || 9100)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all font-mono text-gray-900"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => handleUpdate(printer)}
                  disabled={saving === printer.id}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving === printer.id ? (
                    'Salvando...'
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Configuração
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
