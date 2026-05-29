-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 008
-- Filtros multivalor: p_triage, p_destino, p_ubicacion → text[]
-- Permite seleccionar múltiples clasificaciones, destinos y ubicaciones
-- ================================================================

-- Eliminar versiones antiguas para evitar conflictos de overload
DROP FUNCTION IF EXISTS public.get_heatmap_data(integer, integer, text[], integer, text, text, text);
DROP FUNCTION IF EXISTS public.get_heatmap_semanal(integer, integer, integer, text, text, text);
DROP FUNCTION IF EXISTS public.get_stats(integer, integer, text);

-- ----------------------------------------------------------------
-- get_heatmap_data: p_triage / p_destino / p_ubicacion → text[]
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_heatmap_data(
  p_anio        integer,
  p_mes         integer  DEFAULT NULL,
  p_dias_semana text[]   DEFAULT NULL,
  p_semana_mes  integer  DEFAULT NULL,
  p_triage      text[]   DEFAULT NULL,
  p_destino     text[]   DEFAULT NULL,
  p_ubicacion   text[]   DEFAULT NULL
)
RETURNS TABLE (
  hora           integer,
  key            integer,
  nombre_dia     text,
  total          bigint,
  semana_del_mes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.hora_numerica::integer,
    a.dia_numero::integer    AS key,
    a.nombre_dia::text,
    COUNT(*)::bigint         AS total,
    a.semana_del_mes::integer
  FROM public.atenciones a
  WHERE a.anio_numero = p_anio
    AND (p_mes         IS NULL OR a.mes_numero             = p_mes)
    AND (p_dias_semana IS NULL OR a.nombre_dia             = ANY(p_dias_semana))
    AND (p_semana_mes  IS NULL OR a.semana_del_mes         = p_semana_mes)
    AND (p_triage      IS NULL OR cardinality(p_triage)   = 0 OR a.clasificacion_triage  = ANY(p_triage))
    AND (p_destino     IS NULL OR cardinality(p_destino)  = 0 OR a.destino_clasificacion = ANY(p_destino))
    AND (p_ubicacion   IS NULL OR cardinality(p_ubicacion)= 0 OR a.ubicacion_triage      = ANY(p_ubicacion))
  GROUP BY a.hora_numerica, a.dia_numero, a.nombre_dia, a.semana_del_mes
  ORDER BY a.hora_numerica, a.dia_numero;
END;
$$;

-- ----------------------------------------------------------------
-- get_heatmap_semanal: p_triage / p_destino / p_ubicacion → text[]
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_heatmap_semanal(
  p_anio       integer,
  p_mes        integer  DEFAULT NULL,
  p_semana_mes integer  DEFAULT NULL,
  p_triage     text[]   DEFAULT NULL,
  p_destino    text[]   DEFAULT NULL,
  p_ubicacion  text[]   DEFAULT NULL
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
    COUNT(*)::bigint                                                       AS total,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT a.dia_numero), 0), 2) AS promedio,
    COUNT(DISTINCT a.dia_numero)::bigint                                   AS occurrences
  FROM public.atenciones a
  WHERE a.anio_numero = p_anio
    AND (p_mes        IS NULL OR a.mes_numero             = p_mes)
    AND (p_semana_mes IS NULL OR a.semana_del_mes         = p_semana_mes)
    AND (p_triage     IS NULL OR cardinality(p_triage)   = 0 OR a.clasificacion_triage  = ANY(p_triage))
    AND (p_destino    IS NULL OR cardinality(p_destino)  = 0 OR a.destino_clasificacion = ANY(p_destino))
    AND (p_ubicacion  IS NULL OR cardinality(p_ubicacion)= 0 OR a.ubicacion_triage      = ANY(p_ubicacion))
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
-- get_stats: p_triage → text[]
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_stats(
  p_anio   integer,
  p_mes    integer  DEFAULT NULL,
  p_triage text[]   DEFAULT NULL
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
      AND (p_mes    IS NULL OR mes_numero            = p_mes)
      AND (p_triage IS NULL OR cardinality(p_triage) = 0 OR clasificacion_triage = ANY(p_triage))
  ),
  hourly AS (
    SELECT hora_numerica, COUNT(*) AS cnt
    FROM base
    GROUP BY hora_numerica
    ORDER BY cnt DESC
    LIMIT 1
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

-- Verificación
-- SELECT * FROM get_stats(2026, 5) LIMIT 1;
-- SELECT hora, nombre_dia, total FROM get_heatmap_semanal(2026, 5, NULL, ARRAY['I','II']) LIMIT 5;
