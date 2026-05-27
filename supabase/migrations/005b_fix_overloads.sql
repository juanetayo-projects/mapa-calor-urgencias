-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 005b
-- Elimina los overloads antiguos y deja solo las versiones con
-- p_destino + p_ubicacion. Esto resuelve la ambigüedad en PostgREST
-- que dejaba el mapa de calor vacío.
-- ================================================================

-- Eliminar versiones antiguas (firma original sin p_destino / p_ubicacion)
DROP FUNCTION IF EXISTS public.get_heatmap_data(integer, integer, text[], integer, text);
DROP FUNCTION IF EXISTS public.get_heatmap_semanal(integer, integer, integer, text);

-- Recrear get_heatmap_data con firma completa (7 parámetros)
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

-- Recrear get_heatmap_semanal con firma completa (6 parámetros)
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

-- Verificación rápida: debe devolver filas si hay datos en 2025
-- SELECT hora, key, total FROM get_heatmap_data(2025, 8) LIMIT 5;
