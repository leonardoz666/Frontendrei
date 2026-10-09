'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, CheckCircle2, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/app/components/ui/Button'
import { apiFetch, fetchList } from '@/app/lib/api'
import { useToast } from '@/contexts/ToastContext'

type Funcionario = { id: number; nome: string; cpf: string; status?: string }
type FuncionarioComBiometria = Funcionario & { biometriaId: number; biometriaCriadaEm: string }

const TIPOS = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'INICIO_INTERVALO', label: 'Início do intervalo' },
  { value: 'FIM_INTERVALO', label: 'Fim do intervalo' },
  { value: 'SAIDA', label: 'Saída' },
]

export default function BatidaPontoPage() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [funcionarioId, setFuncionarioId] = useState('')
  const [tipo, setTipo] = useState('ENTRADA')
  const [captura, setCaptura] = useState<Blob | null>(null)
  const [capturaUrl, setCapturaUrl] = useState<string | null>(null)
  const [confirmado, setConfirmado] = useState(false)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [cadastroFuncionarioId, setCadastroFuncionarioId] = useState('')
  const [fotoCadastro, setFotoCadastro] = useState<File | null>(null)
  const [consentimento, setConsentimento] = useState(false)
  const [salvandoFoto, setSalvandoFoto] = useState(false)

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['ponto-funcionarios-biometria'],
    queryFn: () => apiFetch<FuncionarioComBiometria[]>('/ponto/funcionarios-com-biometria'),
  })
  const { data: todosFuncionarios = [] } = useQuery({
    queryKey: ['ponto-funcionarios-ativos'],
    queryFn: () => fetchList<Funcionario>('/ponto/funcionarios?page=1&pageSize=100&status=ATIVO'),
  })
  const { data: sessao } = useQuery({
    queryKey: ['auth-me-ponto-batida'],
    queryFn: () => apiFetch<{ user?: { permissions?: string[] } }>('/auth/me'),
  })
  const podeCadastrar = Boolean(sessao?.user?.permissions?.includes('ponto.ajustar'))
  const selecionado = funcionarios.find(item => item.id === Number(funcionarioId))

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  useEffect(() => {
    if (!capturaUrl) return
    return () => URL.revokeObjectURL(capturaUrl)
  }, [capturaUrl])

  const iniciarCamera = async () => {
    try {
      streamRef.current?.getTracks().forEach(track => track.stop())
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setCameraAtiva(true)
    } catch {
      showToast('Não foi possível acessar a câmera. Verifique a permissão do navegador.', 'error')
    }
  }

  const capturar = async () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) {
      showToast('Ative a câmera antes de capturar', 'error')
      return
    }
    const canvas = document.createElement('canvas')
    const largura = Math.min(video.videoWidth, 960)
    canvas.width = largura
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * largura)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob) return
    setCaptura(blob)
    setCapturaUrl(URL.createObjectURL(blob))
    setConfirmado(false)
  }

  const registrar = async () => {
    if (!selecionado || !captura || !confirmado) {
      showToast('Selecione o funcionário, capture a foto e confirme a comparação', 'error')
      return
    }
    setRegistrando(true)
    try {
      const form = new FormData()
      form.append('funcionarioId', String(selecionado.id))
      form.append('tipo', tipo)
      form.append('confirmacaoVisual', 'true')
      form.append('foto', captura, `batida-${Date.now()}.jpg`)
      const registro = await apiFetch<{ nsr: number }>('/ponto/registros/camera', { method: 'POST', body: form })
      showToast(`Ponto registrado. NSR ${registro.nsr}`, 'success')
      setCaptura(null)
      setCapturaUrl(null)
      setConfirmado(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao registrar ponto', 'error')
    } finally {
      setRegistrando(false)
    }
  }

  const cadastrarReferencia = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!cadastroFuncionarioId || !fotoCadastro || !consentimento) {
      showToast('Selecione o funcionário, a foto e confirme o consentimento', 'error')
      return
    }
    setSalvandoFoto(true)
    try {
      const form = new FormData()
      form.append('foto', fotoCadastro)
      form.append('consentimento', 'true')
      await apiFetch(`/ponto/funcionarios/${cadastroFuncionarioId}/biometrias`, { method: 'POST', body: form })
      showToast('Foto de referência protegida e cadastrada', 'success')
      setFotoCadastro(null)
      setConsentimento(false)
      await queryClient.invalidateQueries({ queryKey: ['ponto-funcionarios-biometria'] })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao cadastrar foto', 'error')
    } finally {
      setSalvandoFoto(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-2 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950">Batida por câmera</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Compare a imagem ao vivo com a referência cadastrada antes de confirmar.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          <ShieldCheck className="h-4 w-4" /> Foto da batida não armazenada
        </span>
      </div>

      <div className="grid overflow-hidden border border-gray-200 bg-white lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-gray-200 bg-gray-50 p-5 lg:border-b-0 lg:border-r">
          <label className="text-sm font-semibold text-gray-900" htmlFor="funcionario">Funcionário</label>
          <select id="funcionario" value={funcionarioId} onChange={event => { setFuncionarioId(event.target.value); setConfirmado(false) }} className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900">
            <option value="">Selecione</option>
            {funcionarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>

          <p className="mt-5 text-sm font-semibold text-gray-900">Foto de referência</p>
          <div className="relative mt-2 aspect-[4/5] overflow-hidden rounded-lg border border-gray-200 bg-gray-200">
            {selecionado ? (
              <Image unoptimized fill sizes="320px" src={`/api/ponto/biometrias/${selecionado.biometriaId}/foto`} alt={`Referência facial de ${selecionado.nome}`} className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-5 text-center text-sm text-gray-500">Selecione um funcionário com foto cadastrada.</div>
            )}
          </div>
          {selecionado && <p className="mt-2 text-xs text-gray-500">CPF final {selecionado.cpf.slice(-4)}</p>}

          <label className="mt-5 block text-sm font-semibold text-gray-900" htmlFor="tipo">Marcação</label>
          <select id="tipo" value={tipo} onChange={event => setTipo(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-gray-900">
            {TIPOS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </aside>

        <section className="p-5 sm:p-7">
          <div className="relative aspect-video overflow-hidden bg-gray-950">
            <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" />
            {!cameraAtiva && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-300"><Camera className="h-10 w-10" /><span className="text-sm">A câmera está desligada</span></div>}
            <div className="pointer-events-none absolute inset-[12%] rounded-[45%] border-2 border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.16)]" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void iniciarCamera()}><Camera className="mr-2 h-4 w-4" />Ativar câmera</Button>
            <Button type="button" onClick={() => void capturar()} disabled={!cameraAtiva}><RefreshCw className="mr-2 h-4 w-4" />Capturar foto</Button>
          </div>

          {capturaUrl && (
            <div className="mt-5 border-t border-gray-200 pt-5">
              <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
                <Image unoptimized width={640} height={480} src={capturaUrl} alt="Foto capturada agora" className="aspect-[4/3] w-full object-cover [transform:scaleX(-1)]" />
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
                  <input type="checkbox" checked={confirmado} onChange={event => setConfirmado(event.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-600" />
                  <span>Comparei a captura com a foto de referência e confirmei a identidade do funcionário.</span>
                </label>
              </div>
              <Button type="button" size="lg" className="mt-4 w-full sm:w-auto" onClick={() => void registrar()} isLoading={registrando} disabled={!confirmado || !selecionado}>
                <CheckCircle2 className="mr-2 h-5 w-5" />Registrar {TIPOS.find(item => item.value === tipo)?.label.toLowerCase()}
              </Button>
            </div>
          )}
        </section>
      </div>

      {podeCadastrar && (
        <form onSubmit={cadastrarReferencia} className="mt-8 border-t border-gray-200 pt-6">
          <div className="max-w-3xl">
            <h2 className="text-lg font-bold text-gray-950">Cadastrar foto de referência</h2>
            <p className="mt-1 text-sm text-gray-600">A imagem é criptografada. Substituir a foto mantém o histórico da ação, não a imagem antiga.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <select value={cadastroFuncionarioId} onChange={event => setCadastroFuncionarioId(event.target.value)} className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-gray-900" required>
                <option value="">Funcionário</option>
                {todosFuncionarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
              <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700">
                <Upload className="h-4 w-4 text-orange-600" />
                <span className="truncate">{fotoCadastro?.name ?? 'Escolher foto'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" className="sr-only" onChange={event => setFotoCadastro(event.target.files?.[0] ?? null)} />
              </label>
            </div>
            <label className="mt-3 flex items-start gap-3 text-sm text-gray-700">
              <input type="checkbox" checked={consentimento} onChange={event => setConsentimento(event.target.checked)} className="mt-0.5 h-4 w-4 accent-orange-600" />
              <span>Confirmo que o funcionário foi informado e consentiu com o cadastro da foto para controle de ponto.</span>
            </label>
            <Button type="submit" className="mt-4" isLoading={salvandoFoto}>Salvar foto protegida</Button>
          </div>
        </form>
      )}
    </main>
  )
}
