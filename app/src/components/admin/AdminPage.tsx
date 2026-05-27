import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import { useStore } from '@/store/useStore'
import { useConfiguracion } from '@/hooks/useAtenciones'
import {
  Save, Users, Settings2, Shield, CheckCircle2, Loader2,
  UserPlus, Trash2, KeyRound,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile, Configuracion } from '@/types'
import UserDialog, { type UserDialogMode, type UserFormData } from './UserDialog'

interface DialogState {
  mode: UserDialogMode
  userId?: string
  userName?: string
}

export default function AdminPage() {
  const { profile } = useStore()
  const queryClient = useQueryClient()
  const { data: configs = [], isLoading: loadingConfig } = useConfiguracion()

  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null)

  // Users query
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at')
      if (error) throw error
      return data as Profile[]
    },
  })

  // Helper: invoke manage-users Edge Function
  async function invokeManageUsers(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('manage-users', { body })
    if (error) throw new Error(error.message)
    if (data?.error) throw new Error(data.error)
    return data
  }

  // Create user — usa Edge Function (GoTrue Admin API, hash compatible 100%)
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) =>
      invokeManageUsers({
        action:    'create',
        email:     data.email!,
        password:  data.password,
        full_name: data.fullName!,
        role:      data.role ?? 'viewer',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Usuario creado correctamente')
      setDialog(null)
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  })

  // Delete user — usa Edge Function
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) =>
      invokeManageUsers({ action: 'delete', user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Usuario eliminado')
      setDeleteConfirm(null)
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  })

  // Change password — usa Edge Function
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) =>
      invokeManageUsers({ action: 'set_password', user_id: userId, password }),
    onSuccess: () => {
      toast.success('Contraseña actualizada')
      setDialog(null)
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  })

  // Change role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('Rol actualizado')
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

  async function handleDialogConfirm(data: UserFormData) {
    if (dialog?.mode === 'create') {
      await createUserMutation.mutateAsync(data)
    } else if (dialog?.mode === 'reset_password' && dialog.userId) {
      await changePasswordMutation.mutateAsync({ userId: dialog.userId, password: data.password })
    }
  }

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-clinic-600" />
              <h2 className="text-base font-semibold text-slate-800">Gestión de usuarios</h2>
            </div>
            <button
              onClick={() => setDialog({ mode: 'create' })}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Nuevo usuario
            </button>
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
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase text-right">Acciones</th>
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
                          className="filter-select text-xs py-1"
                        >
                          <option value="viewer">Visualizador</option>
                          <option value="analyst">Analista</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="py-2.5 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('es-CO')}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Cambiar contraseña"
                            onClick={() =>
                              setDialog({ mode: 'reset_password', userId: u.id, userName: u.full_name ?? u.email })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-clinic-600 hover:bg-clinic-50 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== profile.id && (
                            <button
                              title="Eliminar usuario"
                              onClick={() => setDeleteConfirm(u)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
              { role: 'Administrador', color: 'red',   perms: ['Ver dashboard', 'Filtros completos', 'Enviar reportes', 'Gestionar usuarios', 'Configurar sistema', 'Importar datos'] },
              { role: 'Analista',      color: 'blue',  perms: ['Ver dashboard', 'Filtros completos', 'Enviar reportes', 'Importar datos'] },
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

      {/* User create/edit dialog */}
      {dialog && (
        <UserDialog
          mode={dialog.mode}
          userId={dialog.userId}
          userName={dialog.userName}
          onConfirm={handleDialogConfirm}
          onClose={() => setDialog(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Eliminar usuario</h3>
            <p className="text-sm text-slate-500 mb-4">
              ¿Eliminar a <strong>{deleteConfirm.full_name ?? deleteConfirm.email}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(deleteConfirm.id)}
                disabled={deleteUserMutation.isPending}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleteUserMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
