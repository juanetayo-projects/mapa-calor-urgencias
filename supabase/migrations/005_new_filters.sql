-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 005 (v2)
-- Filtros: destino_clasificacion + ubicacion_triage
-- Funciones disponibles: clasificacion, destino, ubicacion
-- ================================================================

-- Índices para los nuevos filtros
CREATE INDEX IF NOT EXISTS idx_at_destino   ON public.atenciones (destino_clasificacion);
CREATE INDEX IF NOT EXISTS idx_at_ubicacion ON public.atenciones (ubicacion_triage);

-- ----------------------------------------------------------------
-- get_heatmap_data: RECREAR con p_destino + p_ubicacion
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_heatmap_data(
  p_anio        integer,
  p_mes         integer  DEFAULT NULL,
  p_dias_semana text[]   DEFAULT NULL,
  p_semana_mes  integer  DEFAULT NULL,
  p_triage      text     DEFAULT NULL,
  p_destino     text     DEFAULT NULL,
  p_ubicacion   text     DEFAULT NULL
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
    AND (p_mes          IS NULL OR a.mes_numero            = p_mes)
    AND (p_dias_semana  IS NULL OR a.nombre_dia            = ANY(p_dias_semana))
    AND (p_semana_mes   IS NULL OR a.semana_del_mes        = p_semana_mes)
    AND (p_triage       IS NULL OR a.clasificacion_triage ILIKE '%' || p_triage || '%')
    AND (p_destino      IS NULL OR a.destino_clasificacion = p_destino)
    AND (p_ubicacion    IS NULL OR a.ubicacion_triage      = p_ubicacion)
  GROUP BY a.hora_numerica, a.dia_numero, a.nombre_dia, a.semana_del_mes
  ORDER BY a.hora_numerica, a.dia_numero;
END;
$$;

-- ----------------------------------------------------------------
-- get_heatmap_semanal: RECREAR con p_destino + p_ubicacion
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_heatmap_semanal(
  p_anio       integer,
  p_mes        integer  DEFAULT NULL,
  p_semana_mes integer  DEFAULT NULL,
  p_triage     text     DEFAULT NULL,
  p_destino    text     DEFAULT NULL,
  p_ubicacion  text     DEFAULT NULL
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
    AND (p_mes        IS NULL OR a.mes_numero            = p_mes)
    AND (p_semana_mes IS NULL OR a.semana_del_mes        = p_semana_mes)
    AND (p_triage     IS NULL OR a.clasificacion_triage ILIKE '%' || p_triage || '%')
    AND (p_destino    IS NULL OR a.destino_clasificacion = p_destino)
    AND (p_ubicacion  IS NULL OR a.ubicacion_triage      = p_ubicacion)
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
-- get_destino_disponibles
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_destino_disponibles()
RETURNS TABLE (destino text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.destino_clasificacion::text
  FROM public.atenciones a
  WHERE a.destino_clasificacion IS NOT NULL AND a.destino_clasificacion <> ''
  ORDER BY 1;
END; $$;

-- ----------------------------------------------------------------
-- get_clasificacion_disponibles: valores únicos de clasificacion_triage
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_clasificacion_disponibles()
RETURNS TABLE (clasificacion text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.clasificacion_triage::text
  FROM public.atenciones a
  WHERE a.clasificacion_triage IS NOT NULL AND a.clasificacion_triage <> ''
  ORDER BY 1;
END; $$;

-- ----------------------------------------------------------------
-- get_ubicacion_disponibles: valores únicos de ubicacion_triage
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ubicacion_disponibles()
RETURNS TABLE (ubicacion text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.ubicacion_triage::text
  FROM public.atenciones a
  WHERE a.ubicacion_triage IS NOT NULL AND a.ubicacion_triage <> ''
  ORDER BY 1;
END; $$;
