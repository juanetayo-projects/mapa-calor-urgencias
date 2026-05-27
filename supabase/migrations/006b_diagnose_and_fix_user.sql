-- ================================================================
-- DIAGNÓSTICO: ejecutar primero, ver resultados antes del fix
-- ================================================================
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL          AS email_confirmado,
  u.encrypted_password IS NOT NULL          AS tiene_password,
  left(u.encrypted_password, 7)             AS hash_prefijo,   -- debe ser '$2a$06$' o '$2a$10$'
  u.banned_until IS NULL                    AS no_baneado,
  u.deleted_at IS NULL                      AS no_eliminado,
  count(i.id)                               AS num_identidades
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
WHERE u.email = 'lider.proceso@cacsantabarbara.co'
GROUP BY u.id, u.email, u.email_confirmed_at, u.encrypted_password, u.banned_until, u.deleted_at;

-- ================================================================
-- FIX COMPLETO: elimina y recrea el usuario desde cero
-- Ejecutar SOLO si el diagnóstico anterior mostró problemas
-- ================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 1. Obtener el ID del usuario problemático
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'lider.proceso@cacsantabarbara.co';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario no encontrado — no se hizo nada';
    RETURN;
  END IF;

  -- 2. Eliminar identity records (pueden estar corruptos)
  DELETE FROM auth.identities WHERE user_id = v_user_id;

  -- 3. Re-setear el password y confirmar el email
  UPDATE auth.users
  SET encrypted_password = crypt('Lider123*', gen_salt('bf')),
      email_confirmed_at = NOW(),
      updated_at         = NOW(),
      banned_until       = NULL,
      deleted_at         = NULL
  WHERE id = v_user_id;

  -- 4. Insertar identity correctamente
  --    provider_id = email (así lo hace Supabase GoTrue internamente)
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
    v_user_id::text,                                                       -- id = UUID del usuario como text
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'lider.proceso@cacsantabarbara.co'),
    'email',
    'lider.proceso@cacsantabarbara.co',                                    -- provider_id = email
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Usuario reparado: %', v_user_id;
END $$;

-- ================================================================
-- VERIFICACIÓN: ejecutar después del fix para confirmar el estado
-- ================================================================
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL   AS email_ok,
  left(u.encrypted_password, 7)      AS hash_prefix,
  i.provider,
  i.provider_id,
  i.identity_data->>'email'          AS identity_email
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
WHERE u.email = 'lider.proceso@cacsantabarbara.co';
