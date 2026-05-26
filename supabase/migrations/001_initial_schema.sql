-- ================================================================
-- MAPA DE CALOR URGENCIAS · Clínica Santa Bárbara
-- Supabase PostgreSQL Migration 001 · Schema inicial
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- PROFILES (extiende auth.users)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  role        TEXT        NOT NULL DEFAULT 'viewer'
                          CHECK (role IN ('admin', 'analyst', 'viewer')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- ATENCIONES (tabla principal de datos clínicos)
-- Fuente: hoja DATA del archivo Mapa.xlsx (36,535 registros)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.atenciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación del paciente
  tipo_identificacion   TEXT,
  documento             TEXT,
  nombre                TEXT,
  edad                  INTEGER,
  sexo                  TEXT,

  -- Aseguramiento
  aseguradora           TEXT,
  contrato              TEXT,
  plan                  TEXT,

  -- Triage (entrada)
  fecha_triage          DATE        NOT NULL,
  hora_triage           TIME,
  profesional_inicia_triage   TEXT,
  profesional_clasifica       TEXT,
  ubicacion_triage      TEXT,
  paciente_no_responde  BOOLEAN     DEFAULT FALSE,
  clasificacion_triage  TEXT,        -- TRIAGE I ... V

  -- Clasificación
  fecha_clasificacion   DATE,
  hora_clasificacion    TIME,
  tiempo_clasificacion_minutos          INTEGER,
  destino_clasificacion TEXT,

  -- Egreso
  fecha_egreso          DATE,
  hora_egreso           TIME,
  estancia_total_urgencias              INTEGER,

  -- Ingreso
  ingreso               TEXT,
  fecha_ingreso         DATE,
  hora_ingreso          TIME,
  ubicacion_origen      TEXT,
  tiempo_clasificacion_ingreso_minutos  INTEGER,

  -- Consulta inicial
  profesional_consulta_inicial          TEXT,
  fecha_consulta_inicial                DATE,
  hora_consulta_inicial                 TIME,
  tiempo_espera_consulta_inicial_minutos INTEGER,
  destino_consulta_inicial              TEXT,

  -- Primera evolución
  profesional_primera_evolucion         TEXT,
  fecha_primera_evolucion               DATE,
  tiempo_revaloracion_horas             NUMERIC(6,2),
  destino_primera_evolucion             TEXT,

  -- Métricas de estancia
  tiempo_estancia_urgencias_minutos         INTEGER,
  tiempo_urgencias_internacion_horas        NUMERIC(6,2),

  -- Diagnóstico
  diagnostico_principal TEXT,

  -- Campos derivados (pre-calculados al importar)
  hora_numerica   SMALLINT    NOT NULL CHECK (hora_numerica BETWEEN 0 AND 23),
  nombre_dia      CHAR(3)     NOT NULL,   -- DOM LUN MAR MIE JUE VIE SAB
  tipo_dia        CHAR(3),               -- Ord / Fes

  -- Campos generados automáticamente
  dia_numero      SMALLINT    GENERATED ALWAYS AS (EXTRACT(DAY   FROM fecha_triage)::SMALLINT) STORED,
  mes_numero      SMALLINT    GENERATED ALWAYS AS (EXTRACT(MONTH FROM fecha_triage)::SMALLINT) STORED,
  anio_numero     SMALLINT    GENERATED ALWAYS AS (EXTRACT(YEAR  FROM fecha_triage)::SMALLINT) STORED,
  semana_del_mes  SMALLINT    GENERATED ALWAYS AS (CEIL(EXTRACT(DAY FROM fecha_triage) / 7.0)::SMALLINT) STORED,

  -- Auditoría
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by     UUID        REFERENCES public.profiles(id)
);

-- ----------------------------------------------------------------
-- CONFIGURACION
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT        NOT NULL UNIQUE,
  valor       TEXT        NOT NULL,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES public.profiles(id)
);

-- ----------------------------------------------------------------
-- REPORTES_EMAIL
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reportes_email (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT        NOT NULL DEFAULT 'manual',
  destinatarios TEXT[]      NOT NULL,
  asunto        TEXT        NOT NULL,
  cuerpo        TEXT,
  fecha_envio   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (estado IN ('pending', 'sent', 'failed')),
  error_mensaje TEXT,
  enviado_por   UUID        REFERENCES public.profiles(id)
);

-- ----------------------------------------------------------------
-- IMPORTACIONES (log de carga de datos)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.importaciones (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_archivo    TEXT        NOT NULL,
  filas_importadas  INTEGER     DEFAULT 0,
  filas_errores     INTEGER     DEFAULT 0,
  estado            TEXT        NOT NULL DEFAULT 'processing',
  fecha_inicio      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin         TIMESTAMPTZ,
  importado_por     UUID        REFERENCES public.profiles(id),
  detalles          JSONB
);

-- ================================================================
-- ÍNDICES DE RENDIMIENTO
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_at_fecha        ON public.atenciones (fecha_triage);
CREATE INDEX IF NOT EXISTS idx_at_anio_mes     ON public.atenciones (anio_numero, mes_numero);
CREATE INDEX IF NOT EXISTS idx_at_hora         ON public.atenciones (hora_numerica);
CREATE INDEX IF NOT EXISTS idx_at_triage       ON public.atenciones (clasificacion_triage);
CREATE INDEX IF NOT EXISTS idx_at_nombre_dia   ON public.atenciones (nombre_dia);
CREATE INDEX IF NOT EXISTS idx_at_semana       ON public.atenciones (semana_del_mes);
CREATE INDEX IF NOT EXISTS idx_at_tipo_dia     ON public.atenciones (tipo_dia);
-- Índice compuesto principal para el mapa de calor
CREATE INDEX IF NOT EXISTS idx_at_heatmap ON public.atenciones
  (anio_numero, mes_numero, hora_numerica, nombre_dia, clasificacion_triage);

-- ================================================================
-- FUNCIONES RPC
-- ================================================================

-- ----------------------------------------------------------------
-- get_heatmap_data: mapa calor mensual (hora × día del mes)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_heatmap_data(
  p_anio        integer,
  p_mes         integer  DEFAULT NULL,
  p_dias_semana text[]   DEFAULT NULL,
  p_semana_mes  integer  DEFAULT NULL,
  p_triage      text     DEFAULT NULL
)
RETURNS TABLE (
  hora          integer,
  key           integer,
  nombre_dia    text,
  total         bigint,
  semana_del_mes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.hora_numerica::integer,
    a.dia_numero::integer             AS key,
    a.nombre_dia::text,
    COUNT(*)::bigint                  AS total,
    a.semana_del_mes::integer
  FROM public.atenciones a
  WHERE a.anio_numero = p_anio
    AND (p_mes       IS NULL OR a.mes_numero     = p_mes)
    AND (p_dias_semana IS NULL OR a.nombre_dia   = ANY(p_dias_semana))
    AND (p_semana_mes IS NULL OR a.semana_del_mes = p_semana_mes)
    AND (p_triage    IS NULL OR a.clasificacion_triage ILIKE '%' || p_triage || '%')
  GROUP BY a.hora_numerica, a.dia_numero, a.nombre_dia, a.semana_del_mes
  ORDER BY a.hora_numerica, a.dia_numero;
END;
$$;

-- ----------------------------------------------------------------
-- get_heatmap_semanal: mapa calor semanal (hora × día semana)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_heatmap_semanal(
  p_anio       integer,
  p_mes        integer  DEFAULT NULL,
  p_semana_mes integer  DEFAULT NULL,
  p_triage     text     DEFAULT NULL
)
RETURNS TABLE (
  hora        integer,
  nombre_dia  text,
  total       bigint,
  promedio    numeric,
  occurrences bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.hora_numerica::integer,
    a.nombre_dia::text,
    COUNT(*)::bigint                                                      AS total,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT a.dia_numero), 0), 2) AS promedio,
    COUNT(DISTINCT a.dia_numero)::bigint                                  AS occurrences
  FROM public.atenciones a
  WHERE a.anio_numero = p_anio
    AND (p_mes       IS NULL OR a.mes_numero     = p_mes)
    AND (p_semana_mes IS NULL OR a.semana_del_mes = p_semana_mes)
    AND (p_triage    IS NULL OR a.clasificacion_triage ILIKE '%' || p_triage || '%')
  GROUP BY a.hora_numerica, a.nombre_dia
  ORDER BY a.hora_numerica,
    CASE a.nombre_dia
      WHEN 'LUN' THEN 1 WHEN 'MAR' THEN 2 WHEN 'MIE' THEN 3
      WHEN 'JUE' THEN 4 WHEN 'VIE' THEN 5 WHEN 'SAB' THEN 6
      WHEN 'DOM' THEN 7 ELSE 8
    END;
END;
$$;

-- ----------------------------------------------------------------
-- get_available_years: años con datos
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_available_years()
RETURNS TABLE (anio integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT anio_numero::integer
  FROM public.atenciones
  ORDER BY 1 DESC;
END;
$$;

-- ----------------------------------------------------------------
-- get_stats: KPIs para el período seleccionado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_stats(
  p_anio   integer,
  p_mes    integer DEFAULT NULL,
  p_triage text    DEFAULT NULL
)
RETURNS TABLE (
  total_atenciones bigint,
  pico_hora        integer,
  pico_total       bigint,
  promedio_dia     numeric,
  total_dias       bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM public.atenciones
    WHERE anio_numero = p_anio
      AND (p_mes    IS NULL OR mes_numero         = p_mes)
      AND (p_triage IS NULL OR clasificacion_triage ILIKE '%' || p_triage || '%')
  ),
  hourly AS (
    SELECT hora_numerica, COUNT(*) AS cnt
    FROM base GROUP BY hora_numerica ORDER BY cnt DESC LIMIT 1
  ),
  totals AS (
    SELECT COUNT(*) AS total, COUNT(DISTINCT fecha_triage) AS dias FROM base
  )
  SELECT
    t.total,
    h.hora_numerica::integer,
    h.cnt,
    ROUND(t.total::numeric / NULLIF(t.dias, 0), 1),
    t.dias
  FROM totals t, hourly h;
END;
$$;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atenciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importaciones  ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select"      ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Atenciones: todos los autenticados leen, solo admin/analyst escriben
CREATE POLICY "atenciones_select" ON public.atenciones
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "atenciones_insert" ON public.atenciones
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','analyst'))
  );

CREATE POLICY "atenciones_update" ON public.atenciones
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','analyst'))
  );

CREATE POLICY "atenciones_delete" ON public.atenciones
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Configuración: todos leen, solo admin escribe
CREATE POLICY "config_select"    ON public.configuracion FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "config_write"     ON public.configuracion FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Reportes
CREATE POLICY "reportes_select"  ON public.reportes_email FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "reportes_insert"  ON public.reportes_email FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','analyst'))
  );

-- Importaciones
CREATE POLICY "import_select"    ON public.importaciones FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "import_insert"    ON public.importaciones FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','analyst'))
  );

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.fn_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_config_updated_at
  BEFORE UPDATE ON public.configuracion
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

-- Auto-crear perfil cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ================================================================
-- DATOS SEMILLA · Configuración por defecto
-- ================================================================
INSERT INTO public.configuracion (clave, valor, descripcion) VALUES
  ('minutos_default',       '30',                             'Minutos por atención por defecto'),
  ('nombre_clinica',        'Clínica Santa Bárbara',          'Nombre de la institución'),
  ('ciudad',                'Colombia',                       'Ciudad/País'),
  ('email_reporte_default', 'urgencias@clinicasantabarbara.com', 'Email destino para reportes automáticos'),
  ('heatmap_umbral_bajo',   '10',                             'Umbral inferior del mapa de calor'),
  ('heatmap_umbral_medio',  '25',                             'Umbral medio del mapa de calor'),
  ('heatmap_umbral_alto',   '45',                             'Umbral alto del mapa de calor'),
  ('heatmap_umbral_critico','60',                             'Umbral crítico del mapa de calor')
ON CONFLICT (clave) DO NOTHING;
