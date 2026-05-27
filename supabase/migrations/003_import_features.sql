-- ================================================================
-- 003: Import tracking features
-- Ejecutar en Supabase → SQL Editor
-- ================================================================

-- Columna para rastrear qué importación generó cada registro
ALTER TABLE public.atenciones
  ADD COLUMN IF NOT EXISTS importacion_id UUID REFERENCES public.importaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atenciones_importacion_id
  ON public.atenciones(importacion_id);

-- Políticas RLS faltantes
DO $$
BEGIN
  -- UPDATE en importaciones (necesario para actualizar estado al terminar)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'importaciones' AND policyname = 'import_update'
  ) THEN
    CREATE POLICY "import_update" ON public.importaciones
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'analyst'))
      );
  END IF;

  -- DELETE en importaciones (solo admin)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'importaciones' AND policyname = 'import_delete'
  ) THEN
    CREATE POLICY "import_delete" ON public.importaciones
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  -- DELETE en atenciones (admin/analyst para poder eliminar importaciones)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'atenciones' AND policyname = 'atenciones_delete'
  ) THEN
    CREATE POLICY "atenciones_delete" ON public.atenciones
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'analyst'))
      );
  END IF;
END $$;

-- RPC: eliminar importación + sus atenciones
-- Intenta primero por importacion_id; si la columna no existe, elimina por rango de fechas
CREATE OR REPLACE FUNCTION public.fn_remove_importacion(p_importacion_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INTEGER := 0;
  v_desde   DATE;
  v_hasta   DATE;
  v_det     JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar importaciones';
  END IF;

  SELECT detalles INTO v_det FROM public.importaciones WHERE id = p_importacion_id;

  BEGIN
    -- Eliminar por importacion_id (requiere columna en atenciones)
    DELETE FROM public.atenciones WHERE importacion_id = p_importacion_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  EXCEPTION WHEN undefined_column THEN
    -- Fallback: eliminar por rango de fechas almacenado en detalles
    IF v_det IS NOT NULL THEN
      v_desde := (v_det->>'fecha_desde')::DATE;
      v_hasta := (v_det->>'fecha_hasta')::DATE;
      IF v_desde IS NOT NULL AND v_hasta IS NOT NULL THEN
        DELETE FROM public.atenciones
          WHERE fecha_triage::date BETWEEN v_desde AND v_hasta;
        GET DIAGNOSTICS v_count = ROW_COUNT;
      END IF;
    END IF;
  END;

  DELETE FROM public.importaciones WHERE id = p_importacion_id;
  RETURN v_count;
END;
$$;

-- RPC: contar atenciones en rango de fechas (para detectar duplicados)
CREATE OR REPLACE FUNCTION public.fn_count_atenciones_en_rango(
  p_fecha_desde DATE,
  p_fecha_hasta DATE
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.atenciones
  WHERE fecha_triage::date BETWEEN p_fecha_desde AND p_fecha_hasta;
$$;
