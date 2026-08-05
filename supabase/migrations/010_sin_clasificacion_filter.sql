-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 010
-- Filtro "Sin clasificación" + RPC para obtener atenciones sin triage
-- ================================================================

-- 1. Actualizar get_clasificacion_disponibles para incluir "Sin clasificación"
CREATE OR REPLACE FUNCTION public.get_clasificacion_disponibles()
RETURNS TABLE (clasificacion text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT a.clasificacion_triage::text
  FROM public.atenciones a
  WHERE a.clasificacion_triage IS NOT NULL AND a.clasificacion_triage <> ''
  ORDER BY 1;

  -- Agregar opción "Sin clasificación" si existen registros sin clasificar
  IF EXISTS (
    SELECT 1 FROM public.atenciones
    WHERE clasificacion_triage IS NULL OR clasificacion_triage = ''
  ) THEN
    RETURN QUERY SELECT '__SIN_CLASIFICACION__'::text;
  END IF;
END;
$$;

-- 2. Función auxiliar: condición de triage con soporte para "Sin clasificación"
CREATE OR REPLACE FUNCTION public._triage_condition(p_triage text[])
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  -- Sin filtro o filtro vacío = todos
  IF p_triage IS NULL OR cardinality(p_triage) = 0 THEN
    RETURN TRUE;
  END IF;

  -- Si el filtro contiene el valor sentinela, incluir NULL/vacíos
  -- (esto se maneja a nivel de query, esta función solo valida si hay filtro)
  RETURN TRUE;
END;
$$;

-- 3. Actualizar get_heatmap_data
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
    AND (
      p_triage IS NULL
      OR cardinality(p_triage) = 0
      OR a.clasificacion_triage = ANY(p_triage)
      OR ('__SIN_CLASIFICACION__' = ANY(p_triage) AND (a.clasificacion_triage IS NULL OR a.clasificacion_triage = ''))
    )
    AND (p_destino     IS NULL OR cardinality(p_destino)  = 0 OR a.destino_clasificacion = ANY(p_destino))
    AND (p_ubicacion   IS NULL OR cardinality(p_ubicacion)= 0 OR a.ubicacion_triage      = ANY(p_ubicacion))
  GROUP BY a.hora_numerica, a.dia_numero, a.nombre_dia, a.semana_del_mes
  ORDER BY a.hora_numerica, a.dia_numero;
END;
$$;

-- 4. Actualizar get_heatmap_semanal
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
    AND (
      p_triage IS NULL
      OR cardinality(p_triage) = 0
      OR a.clasificacion_triage = ANY(p_triage)
      OR ('__SIN_CLASIFICACION__' = ANY(p_triage) AND (a.clasificacion_triage IS NULL OR a.clasificacion_triage = ''))
    )
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

-- 5. Actualizar get_stats
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
      AND (p_mes IS NULL OR mes_numero = p_mes)
      AND (
        p_triage IS NULL
        OR cardinality(p_triage) = 0
        OR clasificacion_triage = ANY(p_triage)
        OR ('__SIN_CLASIFICACION__' = ANY(p_triage) AND (clasificacion_triage IS NULL OR clasificacion_triage = ''))
      )
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

-- 6. Actualizar get_heatmap_stats_detail
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
  SELECT
    a.hora_numerica::integer,
    a.nombre_dia::text,
    COUNT(*)::bigint                                                       AS total,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT a.dia_numero), 0), 2) AS promedio,
    COUNT(DISTINCT a.dia_numero)::bigint                                   AS occurrences,
    MIN(sub.hourly_count)::bigint                                          AS minimo,
    MAX(sub.hourly_count)::bigint                                          AS maximo
  FROM public.atenciones a
  INNER JOIN (
    SELECT fecha_triage, hora_numerica, COUNT(*) AS hourly_count
    FROM public.atenciones
    WHERE anio_numero = p_anio
      AND (p_mes IS NULL OR mes_numero = p_mes)
      AND (p_semana_mes IS NULL OR semana_del_mes = p_semana_mes)
      AND (
        p_triage IS NULL
        OR cardinality(p_triage) = 0
        OR clasificacion_triage = ANY(p_triage)
        OR ('__SIN_CLASIFICACION__' = ANY(p_triage) AND (clasificacion_triage IS NULL OR clasificacion_triage = ''))
      )
      AND (p_destino IS NULL OR cardinality(p_destino) = 0 OR destino_clasificacion = ANY(p_destino))
      AND (p_ubicacion IS NULL OR cardinality(p_ubicacion) = 0 OR ubicacion_triage = ANY(p_ubicacion))
    GROUP BY fecha_triage, hora_numerica
  ) sub ON (sub.fecha_triage = a.fecha_triage AND sub.hora_numerica = a.hora_numerica)
  WHERE a.anio_numero = p_anio
    AND (p_mes IS NULL OR a.mes_numero = p_mes)
    AND (p_semana_mes IS NULL OR a.semana_del_mes = p_semana_mes)
    AND (
      p_triage IS NULL
      OR cardinality(p_triage) = 0
      OR a.clasificacion_triage = ANY(p_triage)
      OR ('__SIN_CLASIFICACION__' = ANY(p_triage) AND (a.clasificacion_triage IS NULL OR a.clasificacion_triage = ''))
    )
    AND (p_destino IS NULL OR cardinality(p_destino) = 0 OR a.destino_clasificacion = ANY(p_destino))
    AND (p_ubicacion IS NULL OR cardinality(p_ubicacion) = 0 OR a.ubicacion_triage = ANY(p_ubicacion))
  GROUP BY a.hora_numerica, a.nombre_dia
  ORDER BY a.hora_numerica,
    CASE a.nombre_dia
      WHEN 'LUN' THEN 1 WHEN 'MAR' THEN 2 WHEN 'MIE' THEN 3
      WHEN 'JUE' THEN 4 WHEN 'VIE' THEN 5 WHEN 'SAB' THEN 6
      WHEN 'DOM' THEN 7 ELSE 8
    END;
END;
$$;

-- 7. RPC para obtener atenciones sin clasificación (para el modal)
CREATE OR REPLACE FUNCTION public.get_atenciones_sin_clasificacion(
  p_anio   integer,
  p_mes    integer DEFAULT NULL
)
RETURNS TABLE (
  id                  text,
  ingreso             text,
  documento           text,
  nombre              text,
  fecha_triage        date,
  hora_triage         text,
  clasificacion_triage text,
  destino_clasificacion text,
  ubicacion_triage    text,
  profesional_clasifica text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id::text,
    a.ingreso,
    a.documento,
    a.nombre,
    a.fecha_triage,
    a.hora_triage,
    a.clasificacion_triage,
    a.destino_clasificacion,
    a.ubicacion_triage,
    a.profesional_clasifica
  FROM public.atenciones a
  WHERE a.anio_numero = p_anio
    AND (p_mes IS NULL OR a.mes_numero = p_mes)
    AND (a.clasificacion_triage IS NULL OR a.clasificacion_triage = '')
  ORDER BY a.fecha_triage DESC, a.hora_triage DESC;
END;
$$;
