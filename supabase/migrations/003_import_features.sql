-- ================================================================
-- 003: Import tracking features
-- Run in Supabase SQL Editor
-- ================================================================

-- Add importacion_id to atenciones for tracking which import each record came from
ALTER TABLE public.atenciones
  ADD COLUMN IF NOT EXISTS importacion_id UUID REFERENCES public.importaciones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_atenciones_importacion_id
  ON public.atenciones(importacion_id);

-- Allow admin to delete importaciones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'importaciones' AND policyname = 'import_delete'
  ) THEN
    CREATE POLICY "import_delete" ON public.importaciones
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'atenciones' AND policyname = 'atenciones_delete'
  ) THEN
    CREATE POLICY "atenciones_delete" ON public.atenciones
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'analyst'))
      );
  END IF;
END $$;

-- RPC: remove an import and all its associated atenciones
CREATE OR REPLACE FUNCTION public.fn_remove_importacion(p_importacion_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo administradores pueden eliminar importaciones';
  END IF;

  DELETE FROM public.atenciones WHERE importacion_id = p_importacion_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.importaciones WHERE id = p_importacion_id;

  RETURN v_count;
END;
$$;

-- RPC: count existing atenciones in a date range (for duplicate detection)
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
