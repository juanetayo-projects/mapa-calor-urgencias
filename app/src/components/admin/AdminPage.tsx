import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import { useStore } from '@/store/useStore'
import { useConfiguracion } from '@/hooks/useAtenciones'
import { Save, Users, Settings2, Shield, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile, Configuracion } from '@/types'

export default function AdminPage() {
  const { profile } = useStore()
  const queryClient = useQueryClient()
  const { data: configs = [], isLoading: loadingConfig } = useConfiguracion()

  // Users query
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data as Profile[]
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Rol actualizado correctamente')
    },
    onError: () => toast.error('Error al actualizar el rol'),
  })

  const updateConfigMutation = useMutation({
    mutationFn: async ({ clave, valor }: { clave: string; valor: string }) => {
      const { error } = await supabase
        .from('configuracion')
        .update({ valor, updated_by: profile?.id, updated_at: new Date().toISOString() })
        .eq('clave', clave)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion'] })
      toast.success('Configuración guardada')
    },
    onError: () => toast.error('Error al guardar'),
  })

  const [editValues, setEditValues] = useState<Record<string, string>>({})

  const getEditValue = (c: Configuracion) =>
    editValues[c.clave] !== undefined ? editValues[c.clave] : c.valor

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col h-full">
        <Header title="Administración" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Acceso restringido</p>
            <p className="text-slate-400 text-sm">Se requiere rol de administrador</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Administración" subtitle="Gestión de usuarios y configuración del sistema" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        {/* Users */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-clinic-600" />
            <h2 className="text-base font-semibold text-slate-800">Gestión de usuarios</h2>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Usuario</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Email</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Rol</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-medium text-slate-700">{u.full_name}</td>
                      <td className="py-2.5 pr-4 text-slate-500">{u.email}</td>
                      <td className="py-2.5 pr-4">
                        <select
                          value={u.role}
                          disabled={u.id === profile.id}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ id: u.id, role: e.target.value })
                          }
                          className="filter-select text-xs"
                        >
                          <option value="viewer">Visualizador</option>
                          <option value="analyst">Analista</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="py-2.5 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Configuration */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 className="w-5 h-5 text-clinic-600" />
            <h2 className="text-base font-semibold text-slate-800">Parámetros del sistema</h2>
          </div>

          {loadingConfig ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {(configs as Configuracion[]).map((c) => (
                <div key={c.clave} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{c.clave}</p>
                    <p className="text-xs text-slate-400">{c.descripcion}</p>
                  </div>
                  <input
                    type="text"
                    value={getEditValue(c)}
                    onChange={(e) =>
                      setEditValues((v) => ({ ...v, [c.clave]: e.target.value }))
                    }
                    className="filter-select w-48 text-sm"
                  />
                  <button
                    onClick={() => {
                      updateConfigMutation.mutate({ clave: c.clave, valor: getEditValue(c) })
                      setEditValues((v) => { const n = { ...v }; delete n[c.clave]; return n })
                    }}
                    disabled={editValues[c.clave] === undefined}
                    className="btn-primary text-xs py-1.5 disabled:opacity-30"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Role legend */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-clinic-600" />
            <h2 className="text-base font-semibold text-slate-800">Roles y permisos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { role: 'Administrador', color: 'red', perms: ['Ver dashboard', 'Filtros completos', 'Enviar reportes', 'Gestionar usuarios', 'Configurar sistema', 'Importar datos'] },
              { role: 'Analista',      color: 'blue', perms: ['Ver dashboard', 'Filtros completos', 'Enviar reportes', 'Importar datos'] },
              { role: 'Visualizador',  color: 'green', perms: ['Ver dashboard', 'Filtros básicos'] },
            ].map(({ role, color, perms }) => (
              <div key={role} className="border border-slate-200 rounded-xl p-4">
                <span className={`inline-block text-xs bg-${color}-100 text-${color}-700 font-semibold px-2.5 py-1 rounded-full mb-3`}>
                  {role}
                </span>
                <ul className="space-y-1.5">
                  {perms.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
