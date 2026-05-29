-- ================================================================
-- 007_sync_system.sql
-- Sistema de sincronización automática SQL Server → Supabase
-- ================================================================

-- ── Tabla de logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at      timestamptz NOT NULL    DEFAULT now(),
  status           text        NOT NULL    CHECK (status IN ('success', 'error', 'partial')),
  records_fetched  integer     NOT NULL    DEFAULT 0,
  records_upserted integer     NOT NULL    DEFAULT 0,
  duration_ms      integer,
  error_message    text,
  sync_from        timestamptz,
  sync_to          timestamptz,
  triggered_by     text        NOT NULL    DEFAULT 'cron'
);

CREATE INDEX IF NOT EXISTS sync_logs_executed_at_idx
  ON public.sync_logs (executed_at DESC);

-- Solo admins pueden leer los logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden leer sync_logs"
  ON public.sync_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── sync_key en atenciones (clave de upsert idempotente) ─────────
ALTER TABLE public.atenciones
  ADD COLUMN IF NOT EXISTS sync_key text;

-- Índice único parcial (solo filas donde sync_key no es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS atenciones_sync_key_idx
  ON public.atenciones (sync_key)
  WHERE sync_key IS NOT NULL;

-- Backfill para registros importados anteriormente via CSV
UPDATE public.atenciones
SET sync_key = CASE
  WHEN ingreso IS NOT NULL AND ingreso <> ''
    THEN 'ingreso:' || ingreso
  WHEN documento IS NOT NULL AND fecha_triage IS NOT NULL
    THEN 'triage:' || documento || ':' || fecha_triage::text
         || ':' || COALESCE(hora_triage::text, '00:00:00')
  ELSE NULL
END
WHERE sync_key IS NULL;
