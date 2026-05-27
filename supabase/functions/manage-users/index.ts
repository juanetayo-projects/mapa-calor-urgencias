// Supabase Edge Function: manage-users
// Deploy: Supabase Dashboard → Edge Functions → New function → "manage-users"
// Usa el service role key interno (SUPABASE_SERVICE_ROLE_KEY) — no requiere secretos adicionales
//
// Acciones soportadas:
//   { action: 'create',       email, password, full_name, role }
//   { action: 'delete',       user_id }
//   { action: 'set_password', user_id, password }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Verificar que el llamador está autenticado ──────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Sin autorización' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Cliente admin (service role) — para crear/eliminar usuarios en GoTrue
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Cliente del llamador — para verificar su sesión
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth:   { autoRefreshToken: false, persistSession: false },
    })

    const { data: { user: callerUser }, error: sessionErr } = await caller.auth.getUser()
    if (sessionErr || !callerUser) return json({ error: 'Sesión inválida' }, 401)

    // ── 2. Verificar que el llamador es administrador ───────────────────────
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo administradores pueden gestionar usuarios' }, 403)
    }

    // ── 3. Ejecutar la acción solicitada ───────────────────────────────────
    const body   = await req.json()
    const action = body.action as string

    // ---- CREATE ----
    if (action === 'create') {
      const { email, password, full_name, role } = body

      if (!email || !password || !full_name) {
        return json({ error: 'email, password y full_name son requeridos' }, 400)
      }
      if (!['admin', 'analyst', 'viewer'].includes(role)) {
        return json({ error: 'Rol inválido' }, 400)
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,          // confirmar email sin necesidad de link
        user_metadata: { full_name },
      })
      if (error) return json({ error: error.message }, 400)

      // El trigger fn_handle_new_user ya creó el perfil con role='viewer'.
      // Actualizamos al rol deseado.
      if (data.user) {
        await admin.from('profiles')
          .update({ role, full_name })
          .eq('id', data.user.id)
      }

      return json({ user_id: data.user?.id })
    }

    // ---- DELETE ----
    if (action === 'delete') {
      const { user_id } = body
      if (!user_id) return json({ error: 'user_id requerido' }, 400)
      if (user_id === callerUser.id) {
        return json({ error: 'No puede eliminarse a sí mismo' }, 400)
      }

      const { error } = await admin.auth.admin.deleteUser(user_id)
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    // ---- SET_PASSWORD ----
    if (action === 'set_password') {
      const { user_id, password } = body
      if (!user_id || !password) return json({ error: 'user_id y password requeridos' }, 400)

      const { error } = await admin.auth.admin.updateUserById(user_id, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ success: true })
    }

    return json({ error: `Acción desconocida: ${action}` }, 400)

  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
