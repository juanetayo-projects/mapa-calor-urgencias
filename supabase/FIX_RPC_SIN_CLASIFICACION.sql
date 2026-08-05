/*
 * Ejecutar este SQL en la consola de Supabase:
 * https://supabase.com/dashboard/project/zuqqhglrxhexlazxcqgl/sql/new
 */

CREATE OR REPLACE FUNCTION public.get_atenciones_sin_clasificacion(
  p_anio   integer,
  p_mes    integer DEFAULT NULL,
  p_dia    integer DEFAULT NULL
)
RETURNS TABLE (
  id                    uuid,
  ingreso               text,
  documento             text,
  nombre                text,
  fecha_triage          date,
  hora_triage           text,
  clasificacion_triage  text,
  destino_clasificacion text,
  ubicacion_triage      text,
  profesional_clasifica text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.ingreso,
    a.documento,
    a.nombre,
    a.fecha_triage,
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
  ORDER BY a.fecha_triage DESC, a.hora_triage DESC;
END;
$$;
