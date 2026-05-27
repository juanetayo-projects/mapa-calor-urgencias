import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Filtros, HeatmapCell, StatsData } from '@/types'

// ---- Heat map monthly (hours × calendar days) ----
export function useHeatmapMensual(filtros: Filtros) {
  const destino   = ((filtros.destinoClasificacion ?? 'all') === 'all') ? null : filtros.destinoClasificacion
  const ubicacion = ((filtros.ubicacionTriage      ?? 'all') === 'all') ? null : filtros.ubicacionTriage
  return useQuery({
    queryKey: ['heatmap-mensual', filtros.anio, filtros.mes, filtros.diasSemana, filtros.semanaDelMes, filtros.triage, destino, ubicacion],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_data', {
        p_anio:        filtros.anio,
        p_mes:         filtros.mes ?? null,
        p_dias_semana: (filtros.diasSemana?.length ?? 0) > 0 ? filtros.diasSemana : null,
        p_semana_mes:  filtros.semanaDelMes ?? null,
        p_triage:      ((filtros.triage ?? 'all') === 'all') ? null : filtros.triage,
        ...(destino   !== null ? { p_destino:   destino   } : {}),
        ...(ubicacion !== null ? { p_ubicacion: ubicacion } : {}),
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
  const destino   = ((filtros.destinoClasificacion ?? 'all') === 'all') ? null : filtros.destinoClasificacion
  const ubicacion = ((filtros.ubicacionTriage      ?? 'all') === 'all') ? null : filtros.ubicacionTriage
  return useQuery({
    queryKey: ['heatmap-semanal', filtros.anio, filtros.mes, filtros.semanaDelMes, filtros.triage, destino, ubicacion],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_semanal', {
        p_anio:       filtros.anio,
        p_mes:        filtros.mes ?? null,
        p_semana_mes: filtros.semanaDelMes ?? null,
        p_triage:     ((filtros.triage ?? 'all') === 'all') ? null : filtros.triage,
        ...(destino   !== null ? { p_destino:   destino   } : {}),
        ...(ubicacion !== null ? { p_ubicacion: ubicacion } : {}),
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
        p_anio:   filtros.anio,
        p_mes:    filtros.mes ?? null,
        p_triage: ((filtros.triage ?? 'all') === 'all') ? null : filtros.triage,
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

// ---- Available triage / clasificacion levels ----
// Direct query without ORDER so heap-order gives a diverse sample
export function useTriageDisponibles() {
  return useQuery({
    queryKey: ['triage-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atenciones')
        .select('clasificacion_triage')
        .not('clasificacion_triage', 'is', null)
        .limit(5000)
      if (error) throw error
      const unique = [...new Set((data ?? []).map((r) => r.clasificacion_triage as string))]
      return unique.filter(Boolean).sort()
    },
    staleTime: 60 * 60_000,
  })
}

// ---- Available destino_clasificacion values ----
// Direct query without ORDER for diverse results within limit
export function useDestinoDisponibles() {
  return useQuery({
    queryKey: ['destino-disponibles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atenciones')
        .select('destino_clasificacion')
        .not('destino_clasificacion', 'is', null)
        .limit(5000)
      if (error) throw error
      const unique = [...new Set((data ?? []).map((r) => r.destino_clasificacion as string))]
      return unique.filter(Boolean).sort().map((destino) => ({ destino }))
    },
    staleTime: 60 * 60_000,
  })
}

// ---- Available ubicacion_triage values ----
export function useUbicacionDisponibles() {
  return useQuery({
    queryKey: ['ubicacion-disponibles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('atenciones')
        .select('ubicacion_triage')
        .not('ubicacion_triage', 'is', null)
        .limit(5000)
      if (error) throw error
      const unique = [...new Set((data ?? []).map((r) => r.ubicacion_triage as string))]
      return unique.filter(Boolean).sort()
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
