import { useState } from 'react'
import { X, Eye, EyeOff, Loader2 } from 'lucide-react'

export type UserDialogMode = 'create' | 'reset_password'

interface UserDialogProps {
  mode: UserDialogMode
  userName?: string
  userId?: string
  onConfirm: (data: UserFormData) => Promise<void>
  onClose: () => void
}

export interface UserFormData {
  email?: string
  fullName?: string
  password: string
  role?: string
}

export default function UserDialog({ mode, userName, onConfirm, onClose }: UserDialogProps) {
  const [email, setEmail]       = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole]         = useState('viewer')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'create' && (!email.trim() || !fullName.trim())) {
      setError('Email y nombre son obligatorios')
      return
    }
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await onConfirm({
        email: email.trim() || undefined,
        fullName: fullName.trim() || undefined,
        password,
        role,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">
            {mode === 'create' ? 'Crear usuario' : `Cambiar contraseña — ${userName}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          {mode === 'create' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: María González"
                  className="filter-select w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Correo electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@clinica.co"
                  className="filter-select w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="filter-select w-full"
                >
                  <option value="viewer">Visualizador</option>
                  <option value="analyst">Analista</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {mode === 'create' ? 'Contraseña' : 'Nueva contraseña'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="filter-select w-full pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Mínimo 6 caracteres</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {mode === 'create' ? 'Crear usuario' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}
