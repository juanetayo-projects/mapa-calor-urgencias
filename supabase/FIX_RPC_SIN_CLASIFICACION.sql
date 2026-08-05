/*
 * Ejecutar este SQL en la consola de Supabase:
 * https://supabase.com/dashboard/project/zuqqhglrxhexlazxcqgl/sql/new
 */

-- Primero eliminar la función anterior con todas sus firmas
DROP FUNCTION IF EXISTS public.get_atenciones_sin_clasificacion(integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_atenciones_sin_clasificacion(integer, integer);

-- Crear versión simple y robusta
CREATE OR REPLACE FUNCTION public.get_atenciones_sin_clasificacion(
  p_anio   integer,
  p_mes    integer DEFAULT NULL,
  p_dia    integer DEFAULT NULL
)
RETURNS TABLE (
  id                    text,
  ingreso               text,
  documento             text,
  nombre                text,
  fecha_triage          text,
  hora_triage           text,
  clasificacion_triage  text,
  destino_clasificacion text,
  ubicacion_triage      text,
  profesional_clasifica text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    a.id::text,
    a.ingreso,
    a.documento,
    a.nombre,
    a.fecha_triage::text,
    TO_CHAR(a.hora_triage, 'HH24:MI:SS'),
    a.clasificacion_triage,
    a.destino_clasificacion,
    a.ubicacion_triage,
    a.profesional_clasifica
  FROM public.atenciones a
  WHERE a.anio_numero = p_anio
    AND (p_mes IS NULL OR a.mes_numero = p_mes)
    AND (p_dia IS NULL OR a.dia_numero = p_dia)
    AND (a.clasificacion_triage IS NULL OR a.clasificacion_triage = '')
  ORDER BY a.fecha_triage DESC, a.hora_triage DESC
$$;
