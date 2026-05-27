-- ================================================================
-- 004: Admin user management functions
-- Ejecutar en Supabase → SQL Editor
-- ================================================================

-- Permitir que admin actualice perfiles de otros usuarios
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_admin'
  ) THEN
    CREATE POLICY "profiles_update_admin" ON public.profiles
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

-- ----------------------------------------------------------------
-- fn_admin_create_user: crea un usuario en auth.users + actualiza perfil
-- Evita envío de email de confirmación (email confirmado directamente)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_create_user(
  p_email     TEXT,
  p_password  TEXT,
  p_full_name TEXT,
  p_role      TEXT DEFAULT 'viewer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, auth, public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden crear usuarios';
  END IF;

  IF p_role NOT IN ('admin', 'analyst', 'viewer') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_role;
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_full_name),
    FALSE,
    'authenticated',
    'authenticated'
  );

  -- El trigger fn_handle_new_user crea el perfil con role='viewer'.
  -- Actualizamos al rol deseado y al nombre completo.
  UPDATE public.profiles
  SET role      = p_role,
      full_name = p_full_name
  WHERE id = v_new_id;

  RETURN v_new_id;
END;
$$;

-- ----------------------------------------------------------------
-- fn_admin_delete_user: elimina usuario de auth.users
-- El CASCADE en profiles.id → auth.users(id) elimina el perfil
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_delete_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar usuarios';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No puede eliminarse a sí mismo';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- ----------------------------------------------------------------
-- fn_admin_set_password: cambia la contraseña de cualquier usuario
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_admin_set_password(
  p_user_id     UUID,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, auth, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden cambiar contraseñas';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at         = NOW()
  WHERE id = p_user_id;
END;
$$;
