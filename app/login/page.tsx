'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ChefHat } from 'lucide-react'
import { ApiError, apiFetch } from '@/app/lib/api'

type LoginResponse = { user?: { role?: string } }

type LoginLocation = {
  latitude: number
  longitude: number
  accuracy: number
}

function errorCode(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') return null
  const code = (error.body as Record<string, unknown>).code
  return typeof code === 'string' ? code : null
}

function requestCurrentLocation(): Promise<LoginLocation> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Este aparelho não oferece localização. O login de garçom não pode ser liberado.'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      positionError => {
        if (positionError.code === positionError.PERMISSION_DENIED) {
          reject(new Error('Permita o acesso à localização para entrar como garçom.'))
          return
        }
        if (positionError.code === positionError.TIMEOUT) {
          reject(new Error('Não foi possível confirmar sua localização a tempo. Tente novamente.'))
          return
        }
        reject(new Error('Não foi possível confirmar sua localização. Ative o GPS e tente novamente.'))
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    )
  })
}

function paginaInicial(role?: string): string {
  return role === 'ESTOQUISTA' ? '/admin/estoque' : '/'
}

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [locationStatus, setLocationStatus] = useState('')
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      // Short timeout to avoid blocking if backend is down
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

      try {
        const data = await apiFetch<{ user?: { role?: string } }>('/auth/me', {
          signal: controller.signal,
          redirectOn401: false,
        })
        if (!cancelled && data.user) {
          router.replace(paginaInicial(data.user.role))
        }
      } catch {
        // Login continua disponível quando a verificação da sessão falha.
      } finally {
        clearTimeout(timeoutId)
      }
    }

    run()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLocationStatus('')
    setLoading(true)

    try {
      let data: LoginResponse
      try {
        data = await apiFetch<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { login, senha },
          redirectOn401: false,
        })
      } catch (initialError) {
        if (errorCode(initialError) !== 'WAITER_LOCATION_REQUIRED') throw initialError

        setLocationStatus('Confirmando se você está no restaurante...')
        const location = await requestCurrentLocation()
        data = await apiFetch<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { login, senha, location },
          redirectOn401: false,
        })
      }
      router.push(paginaInicial(data.user?.role))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao conectar ao servidor')
    } finally {
      setLocationStatus('')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex w-full bg-gray-50">
      {/* Left Side - Hero / Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-orange-600 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-black/10 z-10" />
        <div className="relative z-20 text-white text-center p-12">
          <div className="mb-8 flex justify-center">
            <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <ChefHat size={64} className="text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-6">Rei do Pirão</h1>
          <p className="text-xl text-orange-100 max-w-md mx-auto">
            O melhor sabor da região, agora com um sistema de gestão à altura.
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-orange-700 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
      </div>

      {/* Right Side - Login Form */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
          <CardHeader className="space-y-1 text-center lg:text-left">
            <div className="flex justify-center lg:hidden mb-4">
               <ChefHat size={48} className="text-orange-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-center lg:text-left">Bem-vindo de volta</CardTitle>
            <p className="text-gray-500 text-sm text-center lg:text-left">
              Entre com suas credenciais para acessar o sistema
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Login"
                placeholder="Ex: garcom1"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
              <Input
                label="Senha"
                type="password"
                placeholder="••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}

              {locationStatus && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center text-sm font-medium text-blue-700" role="status">
                  {locationStatus}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                Entrar
              </Button>
            </form>
            
            <div className="mt-6 text-center text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Rei do Pirão. Todos os direitos reservados.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
