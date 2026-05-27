-- ================================================================
-- PASO 1: verificar si el usuario existe
-- ================================================================
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL   AS email_confirmado,
  u.encrypted_password IS NOT NULL   AS tiene_password,
  left(u.encrypted_password, 7)      AS hash_prefijo,
  count(i.id)                        AS num_identidades
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
WHERE u.email = 'lider.proceso@cacsantabarbara.co'
GROUP BY u.id, u.email, u.email_confirmed_at, u.encrypted_password;

-- ================================================================
-- PASO 2: reparar usuario existente  (ejecutar solo si PASO 1 devuelve fila)
-- ================================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'lider.proceso@cacsantabarbara.co';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuario no encontrado — usar PASO 3 para crearlo';
    RETURN;
  END IF;

  -- Limpiar identidades previas (pueden estar mal)
  DELETE FROM auth.identities WHERE user_id = v_user_id;

  -- Restablecer password y confirmar email
  UPDATE auth.users
  SET encrypted_password = crypt('Lider123*', gen_salt('bf')),
      email_confirmed_at = NOW(),
      updated_at         = NOW(),
      banned_until       = NULL,
      deleted_at         = NULL
  WHERE id = v_user_id;

  -- Insertar identity con id tipo UUID (gen_random_uuid())
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
    gen_random_uuid(),                                -- UUID, no text
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'lider.proceso@cacsantabarbara.co'),
    'email',
    'lider.proceso@cacsantabarbara.co',
    NOW(), NOW(), NOW()
  );

  RAISE NOTICE 'Usuario reparado OK: %', v_user_id;
END $$;

-- ================================================================
-- PASO 3: crear usuario desde cero  (ejecutar solo si PASO 1 devuelve 0 filas)
-- ================================================================
DO $$
DECLARE
  v_new_id UUID := gen_random_uuid();
  v_exists  INT;
BEGIN
  SELECT count(*) INTO v_exists FROM auth.users
  WHERE email = 'lider.proceso@cacsantabarbara.co';

  IF v_exists > 0 THEN
    RAISE NOTICE 'Usuario ya existe — se ejecutó PASO 2, no PASO 3';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud
  ) VALUES (
    v_new_id,
    '00000000-0000-0000-0000-000000000000',
    'lider.proceso@cacsantabarbara.co',
    crypt('Lider123*', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Lider Proceso"}',
    FALSE, 'authenticated', 'authenticated'
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_new_id,
    jsonb_build_object('sub', v_new_id::text, 'email', 'lider.proceso@cacsantabarbara.co'),
    'email',
    'lider.proceso@cacsantabarbara.co',
    NOW(), NOW(), NOW()
  );

  -- Asignar rol analyst (o el que necesites: viewer / analyst / admin)
  UPDATE public.profiles
  SET role = 'analyst', full_name = 'Lider Proceso'
  WHERE id = v_new_id;

  RAISE NOTICE 'Usuario creado desde cero OK: %', v_new_id;
END $$;

-- ================================================================
-- VERIFICACIÓN FINAL
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
