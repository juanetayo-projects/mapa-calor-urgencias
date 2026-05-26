import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { profile, signIn, resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')

  if (profile) return <Navigate to="/dashboard" replace />

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) setError('Credenciales incorrectas. Verifique su email y contraseña.')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const err = await resetPassword(email)
    setLoading(false)
    if (err) {
      setError('No se pudo enviar el correo de recuperación.')
    } else {
      toast.success('Correo de recuperación enviado. Revise su bandeja.')
      setMode('login')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-clinic-900 via-clinic-800 to-clinic-700 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] bg-[size:32px_32px]" />

      <div className="relative w-full max-w-md">
        {/* Logo card */}
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}logo-white.png`} alt="Clínica Santa Bárbara" className="h-16 mx-auto mb-3" />
          <p className="text-clinic-200 text-sm">Sistema de Gestión Mapa de Calor de Urgencias</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-1">
            {mode === 'login' ? 'Iniciar sesión' : 'Recuperar contraseña'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'login'
              ? 'Sistema de Gestión Mapa de Calor de Urgencias'
              : 'Ingrese su email para recibir instrucciones'}
          </p>

          <form onSubmit={mode === 'login' ? handleLogin : handleReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@clinica.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-500 focus:border-transparent"
                />
              </div>
            </div>

            {mode === 'login' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clinic-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-2.5 text-sm font-semibold"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Procesando...
                </span>
              ) : mode === 'login' ? 'Ingresar' : 'Enviar correo'}
            </button>
          </form>

          <div className="mt-4 text-center">
            {mode === 'login' ? (
              <button
                onClick={() => { setMode('reset'); setError('') }}
                className="text-sm text-clinic-600 hover:text-clinic-700 font-medium"
              >
                ¿Olvidó su contraseña?
              </button>
            ) : (
              <button
                onClick={() => { setMode('login'); setError('') }}
                className="text-sm text-clinic-600 hover:text-clinic-700 font-medium"
              >
                ← Volver al inicio de sesión
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-clinic-300 text-xs mt-6">
          © {new Date().getFullYear()} Clínica Santa Bárbara de Alta Complejidad
        </p>
      </div>
    </div>
  )
}
