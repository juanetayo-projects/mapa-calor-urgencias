import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Filtros, HeatmapCell, HeatmapStatsDetail, StatsData } from '@/types'

// ---- Heat map monthly (hours × calendar days) ----
export function useHeatmapMensual(filtros: Filtros) {
  const triage    = (filtros.triage?.length   ?? 0) > 0 ? filtros.triage   : null
  const destino   = (filtros.destinoClasificacion?.length ?? 0) > 0 ? filtros.destinoClasificacion : null
  const ubicacion = (filtros.ubicacionTriage?.length      ?? 0) > 0 ? filtros.ubicacionTriage      : null
  return useQuery({
    queryKey: ['heatmap-mensual', filtros.anio, filtros.mes, filtros.diasSemana, filtros.semanaDelMes, triage, destino, ubicacion],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_data', {
        p_anio:        filtros.anio,
        p_mes:         filtros.mes ?? null,
        p_dias_semana: (filtros.diasSemana?.length ?? 0) > 0 ? filtros.diasSemana : null,
        p_semana_mes:  filtros.semanaDelMes ?? null,
        p_triage:      triage,
        p_destino:     destino,
        p_ubicacion:   ubicacion,
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
  const triage    = (filtros.triage?.length   ?? 0) > 0 ? filtros.triage   : null
  const destino   = (filtros.destinoClasificacion?.length ?? 0) > 0 ? filtros.destinoClasificacion : null
  const ubicacion = (filtros.ubicacionTriage?.length      ?? 0) > 0 ? filtros.ubicacionTriage      : null
  return useQuery({
    queryKey: ['heatmap-semanal', filtros.anio, filtros.mes, filtros.semanaDelMes, triage, destino, ubicacion],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_semanal', {
        p_anio:       filtros.anio,
        p_mes:        filtros.mes ?? null,
        p_semana_mes: filtros.semanaDelMes ?? null,
        p_triage:     triage,
        p_destino:    destino,
        p_ubicacion:  ubicacion,
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

// ---- Heatmap stats detail (promedio + min + max por hora×día) ----
export function useHeatmapStatsDetail(filtros: Filtros) {
  const triage    = (filtros.triage?.length   ?? 0) > 0 ? filtros.triage   : null
  const destino   = (filtros.destinoClasificacion?.length ?? 0) > 0 ? filtros.destinoClasificacion : null
  const ubicacion = (filtros.ubicacionTriage?.length      ?? 0) > 0 ? filtros.ubicacionTriage      : null
  return useQuery({
    queryKey: ['heatmap-stats-detail', filtros.anio, filtros.mes, filtros.semanaDelMes, triage, destino, ubicacion],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_heatmap_stats_detail', {
        p_anio:       filtros.anio,
        p_mes:        filtros.mes ?? null,
        p_semana_mes: filtros.semanaDelMes ?? null,
        p_triage:     triage,
        p_destino:    destino,
        p_ubicacion:  ubicacion,
      })
      if (error) throw error
      return (data ?? []) as HeatmapStatsDetail[]
    },
    enabled: !!filtros.anio,
    staleTime: 5 * 60_000,
  })
}

// ---- KPI Stats ----
export function useStats(filtros: Filtros) {
  const triage = (filtros.triage?.length ?? 0) > 0 ? filtros.triage : null
  return useQuery({
    queryKey: ['stats', filtros.anio, filtros.mes, triage],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_stats', {
        p_anio:   filtros.anio,
        p_mes:    filtros.mes ?? null,
        p_triage: triage,
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
// Uses SELECT DISTINCT RPC (migration 005) for complete unique values
export function useTriageDisponibles() {
  return useQuery({
    queryKey: ['triage-levels'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clasificacion_disponibles')
      if (error) throw error
      return ((data ?? []) as Array<{ clasificacion: string }>)
        .map((r) => r.clasificacion)
        .filter(Boolean)
        .sort()
    },
    staleTime: 60 * 60_000,
  })
}

// ---- Available destino_clasificacion values ----
// Uses SELECT DISTINCT RPC (migration 005) for complete unique values
export function useDestinoDisponibles() {
  return useQuery({
    queryKey: ['destino-disponibles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_destino_disponibles')
      if (error) throw error
      return ((data ?? []) as Array<{ destino: string }>)
        .filter((r) => Boolean(r.destino))
        .sort((a, b) => a.destino.localeCompare(b.destino))
        .map((r) => ({ destino: r.destino }))
    },
    staleTime: 60 * 60_000,
  })
}

// ---- Available ubicacion_triage values ----
// Uses SELECT DISTINCT RPC (migration 005) for complete unique values
export function useUbicacionDisponibles() {
  return useQuery({
    queryKey: ['ubicacion-disponibles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_ubicacion_disponibles')
      if (error) throw error
      return ((data ?? []) as Array<{ ubicacion: string }>)
        .map((r) => r.ubicacion)
        .filter(Boolean)
        .sort()
    },
    staleTime: 60 * 60_000,
  })
}

// ---- Atenciones sin clasificación de triage (para modal de revisión) ----
export function useAtencionesSinClasificacion(anio: number, mes: number | null, dia: number | null) {
  return useQuery({
    queryKey: ['atenciones-sin-clasificacion', anio, mes, dia],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_atenciones_sin_clasificacion', {
        p_anio: anio,
        p_mes: mes ?? null,
        p_dia: dia ?? null,
      })
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        ingreso: string | null
        documento: string | null
        nombre: string | null
        fecha_triage: string | null
        hora_triage: string | null
        clasificacion_triage: string | null
        destino_clasificacion: string | null
        ubicacion_triage: string | null
        profesional_clasifica: string | null
      }>
    },
    enabled: !!anio,
    staleTime: 5 * 60_000,
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
