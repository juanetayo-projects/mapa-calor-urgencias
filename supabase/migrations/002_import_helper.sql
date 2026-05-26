-- ================================================================
-- HELPER: Función para importar datos desde CSV
-- Ejecutar después de cargar el CSV con \COPY o Supabase Dashboard
-- ================================================================

-- Tabla temporal de importación (misma estructura que el Excel DATA)
CREATE TABLE IF NOT EXISTS public.atenciones_staging (
  tipo_identificacion   TEXT,
  documento             TEXT,
  nombre                TEXT,
  edad                  TEXT,
  sexo                  TEXT,
  aseguradora           TEXT,
  contrato              TEXT,
  plan                  TEXT,
  fecha_triage          TEXT,
  hora_triage           TEXT,
  profesional_inicia_triage   TEXT,
  profesional_clasifica       TEXT,
  ubicacion_triage      TEXT,
  paciente_no_responde  TEXT,
  clasificacion_triage  TEXT,
  fecha_clasificacion   TEXT,
  hora_clasificacion    TEXT,
  fecha_egreso          TEXT,
  hora_egreso           TEXT,
  estancia_total_urgencias    TEXT,
  tiempo_clasificacion_minutos        TEXT,
  destino_clasificacion TEXT,
  ingreso               TEXT,
  fecha_ingreso         TEXT,
  hora_ingreso          TEXT,
  ubicacion_origen      TEXT,
  tiempo_clasificacion_ingreso_minutos TEXT,
  profesional_consulta_inicial         TEXT,
  fecha_consulta_inicial               TEXT,
  hora_consulta_inicial                TEXT,
  tiempo_espera_consulta_inicial_minutos TEXT,
  destino_consulta_inicial             TEXT,
  profesional_primera_evolucion        TEXT,
  fecha_primera_evolucion              TEXT,
  tiempo_revaloracion_horas            TEXT,
  destino_primera_evolucion            TEXT,
  tiempo_estancia_urgencias_minutos    TEXT,
  tiempo_urgencias_internacion_horas   TEXT,
  diagnostico_principal TEXT,
  dia_num               TEXT,
  mes_num               TEXT,
  hora_num              TEXT,
  nombre_dia_raw        TEXT
);

-- ----------------------------------------------------------------
-- Función: migrar staging → atenciones
-- Llama después de \COPY atenciones_staging FROM 'Mapa_DATA.csv' CSV HEADER;
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_import_from_staging(p_import_id UUID DEFAULT NULL)
RETURNS TABLE (importados integer, errores integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok  integer := 0;
  v_err integer := 0;
BEGIN
  -- Insertar registros válidos
  WITH inserted AS (
    INSERT INTO public.atenciones (
      tipo_identificacion, documento, nombre, edad, sexo,
      aseguradora, contrato, plan,
      fecha_triage, hora_triage,
      profesional_inicia_triage, profesional_clasifica,
      ubicacion_triage, paciente_no_responde, clasificacion_triage,
      fecha_clasificacion, hora_clasificacion,
      fecha_egreso, hora_egreso, estancia_total_urgencias,
      tiempo_clasificacion_minutos, destino_clasificacion,
      ingreso, fecha_ingreso, hora_ingreso, ubicacion_origen,
      tiempo_clasificacion_ingreso_minutos,
      profesional_consulta_inicial, fecha_consulta_inicial,
      hora_consulta_inicial, tiempo_espera_consulta_inicial_minutos,
      destino_consulta_inicial, profesional_primera_evolucion,
      fecha_primera_evolucion, tiempo_revaloracion_horas,
      destino_primera_evolucion, tiempo_estancia_urgencias_minutos,
      tiempo_urgencias_internacion_horas, diagnostico_principal,
      hora_numerica, nombre_dia
    )
    SELECT
      tipo_identificacion,
      documento,
      nombre,
      NULLIF(TRIM(edad), '')::integer,
      sexo,
      aseguradora, contrato, plan,
      TO_DATE(NULLIF(TRIM(fecha_triage),''), 'YYYY-MM-DD'),
      NULLIF(TRIM(hora_triage),'')::time,
      profesional_inicia_triage,
      profesional_clasifica,
      ubicacion_triage,
      CASE WHEN LOWER(TRIM(paciente_no_responde)) IN ('true','1','si','sí') THEN TRUE ELSE FALSE END,
      clasificacion_triage,
      NULLIF(TRIM(fecha_clasificacion),'')::date,
      NULLIF(TRIM(hora_clasificacion),'')::time,
      NULLIF(TRIM(fecha_egreso),'')::date,
      NULLIF(TRIM(hora_egreso),'')::time,
      NULLIF(TRIM(estancia_total_urgencias),'')::integer,
      NULLIF(TRIM(tiempo_clasificacion_minutos),'')::integer,
      NULLIF(TRIM(destino_clasificacion),''),
      NULLIF(TRIM(ingreso),''),
      NULLIF(TRIM(fecha_ingreso),'')::date,
      NULLIF(TRIM(hora_ingreso),'')::time,
      NULLIF(TRIM(ubicacion_origen),''),
      NULLIF(TRIM(tiempo_clasificacion_ingreso_minutos),'')::integer,
      NULLIF(TRIM(profesional_consulta_inicial),''),
      NULLIF(TRIM(fecha_consulta_inicial),'')::date,
      NULLIF(TRIM(hora_consulta_inicial),'')::time,
      NULLIF(TRIM(tiempo_espera_consulta_inicial_minutos),'')::integer,
      NULLIF(TRIM(destino_consulta_inicial),''),
      NULLIF(TRIM(profesional_primera_evolucion),''),
      NULLIF(TRIM(fecha_primera_evolucion),'')::date,
      NULLIF(TRIM(tiempo_revaloracion_horas),'')::numeric,
      NULLIF(TRIM(destino_primera_evolucion),''),
      NULLIF(TRIM(tiempo_estancia_urgencias_minutos),'')::integer,
      NULLIF(TRIM(tiempo_urgencias_internacion_horas),'')::numeric,
      NULLIF(TRIM(diagnostico_principal),''),
      NULLIF(TRIM(hora_num),'')::smallint,
      UPPER(TRIM(nombre_dia_raw))
    FROM public.atenciones_staging
    WHERE TRIM(fecha_triage) <> ''
      AND TRIM(hora_num) <> ''
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_ok FROM inserted;

  SELECT COUNT(*) INTO v_err
  FROM public.atenciones_staging
  WHERE TRIM(fecha_triage) = '' OR TRIM(hora_num) = '';

  -- Limpiar staging
  TRUNCATE public.atenciones_staging;

  -- Actualizar log de importación
  IF p_import_id IS NOT NULL THEN
    UPDATE public.importaciones
    SET filas_importadas = v_ok,
        filas_errores    = v_err,
        estado           = 'completed',
        fecha_fin        = NOW()
    WHERE id = p_import_id;
  END IF;

  RETURN QUERY SELECT v_ok, v_err;
END;
$$;

COMMENT ON FUNCTION public.fn_import_from_staging IS
  'Migra datos de atenciones_staging → atenciones. Usar después de COPY desde CSV exportado del Excel Mapa.xlsx hoja DATA.';
