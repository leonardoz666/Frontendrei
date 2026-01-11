'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ChefHat } from 'lucide-react'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // Short timeout to avoid blocking if backend is down
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

      try {
        console.log('[DEBUG] Login check auth/me');
        const res = await fetch('/api/auth/me', { 
            signal: controller.signal,
            cache: 'no-store' 
        })
        clearTimeout(timeoutId);
        
        console.log(`[DEBUG] Login auth/me status: ${res.status}`);
        if (res.ok) {
            const data = await res.json()
            if (!cancelled && data.user) {
              console.log('[DEBUG] User already logged in, redirecting');
              router.replace('/')
            }
        }
      } catch (e) {
        console.error('[DEBUG] Login check error or timeout:', e);
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Credenciais inválidas')
      }
    } catch (err) {
      console.error(err)
      setError('Erro ao conectar ao servidor')
    } finally {
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
      <div className="flex-1 flex items-center justify-center p-8">
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
