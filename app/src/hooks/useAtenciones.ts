import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Filtros, HeatmapCell, StatsData } from '@/types'

// ---- Heat map monthly (hours × calendar days) ----
export function useHeatmapMensual(filtros: Filtros) {
  return useQuery({
    queryKey: ['heatmap-mensual', filtros.anio, filtros.mes, filtros.diasSemana, filtros.semanaDelMes, filtros.triage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_data', {
        p_anio: filtros.anio,
        p_mes: filtros.mes,
        p_dias_semana: filtros.diasSemana.length ? filtros.diasSemana : null,
        p_semana_mes: filtros.semanaDelMes,
        p_triage: filtros.triage === 'all' ? null : filtros.triage,
      })
      if (error) throw error
      return (data ?? []) as HeatmapCell[]
    },
    enabled: !!filtros.anio,
    staleTime: 5 * 60_000,
  })
}

// ---- Heat map weekly (hours × day-of-week) ----
export function useHeatmapSemanal(filtros: Filtros) {
  return useQuery({
    queryKey: ['heatmap-semanal', filtros.anio, filtros.mes, filtros.semanaDelMes, filtros.triage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_semanal', {
        p_anio: filtros.anio,
        p_mes: filtros.mes,
        p_semana_mes: filtros.semanaDelMes,
        p_triage: filtros.triage === 'all' ? null : filtros.triage,
      })
      if (error) throw error
      return (data ?? []) as Array<{
        hora: number
        nombre_dia: string
        total: number
        promedio: number
        occurrences: number
      }>
    },
    enabled: !!filtros.anio,
    staleTime: 5 * 60_000,
  })
}

// ---- KPI Stats ----
export function useStats(filtros: Filtros) {
  return useQuery({
    queryKey: ['stats', filtros.anio, filtros.mes, filtros.triage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stats', {
        p_anio: filtros.anio,
        p_mes: filtros.mes,
        p_triage: filtros.triage === 'all' ? null : filtros.triage,
      })
      if (error) throw error
      return (data?.[0] ?? null) as StatsData | null
    },
    enabled: !!filtros.anio,
    staleTime: 5 * 60_000,
  })
}

// ---- Available years ----
export function useAniosDisponibles() {
  return useQuery({
    queryKey: ['available-years'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_years')
      if (error) throw error
      return (data ?? []) as Array<{ anio: number }>
    },
    staleTime: 30 * 60_000,
  })
}

// ---- Available triage levels ----
export function useTriageDisponibles() {
  return useQuery({
    queryKey: ['triage-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atenciones')
        .select('clasificacion_triage')
        .not('clasificacion_triage', 'is', null)
        .order('clasificacion_triage')
        .limit(1000)
      if (error) throw error
      const unique = [...new Set((data ?? []).map((r) => r.clasificacion_triage as string))]
      return unique.sort()
    },
    staleTime: 60 * 60_000,
  })
}

// ---- Configuration ----
export function useConfiguracion() {
  return useQuery({
    queryKey: ['configuracion'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracion').select('*').order('clave')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30 * 60_000,
  })
}
