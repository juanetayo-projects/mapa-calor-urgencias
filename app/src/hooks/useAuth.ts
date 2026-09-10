import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import type { Profile } from '@/types'

export function useAuth() {
  const { profile, setProfile } = useStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (data && (data as Profile).activo === false) {
      await supabase.auth.signOut()
      setProfile(null)
      setLoading(false)
      return
    }

    setProfile(data as Profile)
    setLoading(false)
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return 'Credenciales incorrectas. Verifique su email y contraseña.'

    if (data.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('activo')
        .eq('id', data.user.id)
        .single()

      if (prof && (prof as Pick<Profile, 'activo'>).activo === false) {
        await supabase.auth.signOut()
        return 'Su usuario está inactivo. Contacte al administrador.'
      }
    }

    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return error
  }

  return { profile, loading, signIn, signOut, resetPassword }
}
