-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 009
-- Nueva función: get_heatmap_stats_detail
-- Retorna promedio, mínimo, máximo, total y ocurrencias por hora × día
-- para alimentar la Vista Analítica (estilo Odoo)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_heatmap_stats_detail(
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
  occurrences bigint,
  minimo      bigint,
  maximo      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH daily AS (
    -- Conteo por (hora, dia_semana, dia_calendario)
    SELECT
      hora_numerica,
      nombre_dia,
      dia_numero,
      COUNT(*) AS cnt
    FROM public.atenciones
    WHERE anio_numero = p_anio
      AND (p_mes        IS NULL OR mes_numero             = p_mes)
      AND (p_semana_mes IS NULL OR semana_del_mes         = p_semana_mes)
      AND (p_triage     IS NULL OR cardinality(p_triage)  = 0 OR clasificacion_triage  = ANY(p_triage))
      AND (p_destino    IS NULL OR cardinality(p_destino) = 0 OR destino_clasificacion = ANY(p_destino))
      AND (p_ubicacion  IS NULL OR cardinality(p_ubicacion)= 0 OR ubicacion_triage     = ANY(p_ubicacion))
    GROUP BY hora_numerica, nombre_dia, dia_numero
  )
  SELECT
    hora_numerica::integer                                               AS hora,
    nombre_dia::text,
    SUM(cnt)::bigint                                                     AS total,
    ROUND(SUM(cnt)::numeric / NULLIF(COUNT(*), 0), 2)                   AS promedio,
    COUNT(*)::bigint                                                     AS occurrences,
    MIN(cnt)::bigint                                                     AS minimo,
    MAX(cnt)::bigint                                                     AS maximo
  FROM daily
  GROUP BY hora_numerica, nombre_dia
  ORDER BY hora_numerica,
    CASE nombre_dia
      WHEN 'LUN' THEN 1 WHEN 'MAR' THEN 2 WHEN 'MIE' THEN 3
      WHEN 'JUE' THEN 4 WHEN 'VIE' THEN 5 WHEN 'SAB' THEN 6
      WHEN 'DOM' THEN 7 ELSE 8
    END;
END;
$$;

-- Verificación
-- SELECT * FROM get_heatmap_stats_detail(2026, 5) ORDER BY promedio DESC LIMIT 10;
