-- ================================================================
-- MAPA DE CALOR URGENCIAS · Migration 011
-- Permite inactivar usuarios sin eliminarlos (preserva historial/FKs)
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;
