-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 006
-- Fix fn_admin_create_user: agregar registro en auth.identities
-- Sin este registro, Supabase GoTrue rechaza el login del usuario
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Reparar usuarios ya creados sin identity (parche puntual)
--    Inserta el registro faltante en auth.identities para cualquier
--    usuario en auth.users que no tenga entrada en auth.identities.
-- ----------------------------------------------------------------
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  u.id::text,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.aud = 'authenticated'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );

-- ----------------------------------------------------------------
-- 2. Reemplazar fn_admin_create_user con versión que crea identity
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
  -- Solo admins pueden crear usuarios
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden crear usuarios';
  END IF;

  IF p_role NOT IN ('admin', 'analyst', 'viewer') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_role;
  END IF;

  v_new_id := gen_random_uuid();

  -- Insertar en auth.users con email confirmado directamente
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

  -- CRÍTICO: crear el registro en auth.identities
  -- Sin este registro Supabase GoTrue rechaza el login
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_id,
    jsonb_build_object('sub', v_new_id::text, 'email', p_email),
    'email',
    v_new_id::text,
    NOW(),
    NOW(),
    NOW()
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
