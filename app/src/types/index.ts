export type Role = 'admin' | 'analyst' | 'viewer'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Atencion {
  id: string
  tipo_identificacion: string
  documento: string
  nombre: string
  edad: number
  sexo: string
  aseguradora: string
  contrato: string
  plan: string
  fecha_triage: string
  hora_triage: string
  profesional_inicia_triage: string
  profesional_clasifica: string
  ubicacion_triage: string
  paciente_no_responde: boolean
  clasificacion_triage: string
  fecha_clasificacion: string | null
  hora_clasificacion: string | null
  tiempo_clasificacion_minutos: number | null
  destino_clasificacion: string | null
  fecha_egreso: string | null
  hora_egreso: string | null
  estancia_total_urgencias: number | null
  ingreso: string | null
  fecha_ingreso: string | null
  hora_ingreso: string | null
  ubicacion_origen: string | null
  tiempo_clasificacion_ingreso_minutos: number | null
  profesional_consulta_inicial: string | null
  fecha_consulta_inicial: string | null
  hora_consulta_inicial: string | null
  tiempo_espera_consulta_inicial_minutos: number | null
  destino_consulta_inicial: string | null
  profesional_primera_evolucion: string | null
  fecha_primera_evolucion: string | null
  tiempo_revaloracion_horas: number | null
  destino_primera_evolucion: string | null
  tiempo_estancia_urgencias_minutos: number | null
  tiempo_urgencias_internacion_horas: number | null
  diagnostico_principal: string | null
  dia_numero: number
  mes_numero: number
  anio_numero: number
  hora_numerica: number
  nombre_dia: string
  semana_del_mes: number
  tipo_dia: string | null
}

export type NombreDia = 'DOM' | 'LUN' | 'MAR' | 'MIE' | 'JUE' | 'VIE' | 'SAB'

export const DIAS_SEMANA: NombreDia[] = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']

export const DIAS_LABEL: Record<NombreDia, string> = {
  LUN: 'Lunes',
  MAR: 'Martes',
  MIE: 'Miércoles',
  JUE: 'Jueves',
  VIE: 'Viernes',
  SAB: 'Sábado',
  DOM: 'Domingo',
}

export const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

export type VistaHeatmap = 'mensual' | 'semanal' | 'promedio'

export interface Filtros {
  anio: number
  mes: number | null
  diasSemana: NombreDia[]
  semanaDelMes: number | null
  triage: string
  destinoClasificacion: string
  ubicacionTriage: string
  minutos: number
  vista: VistaHeatmap
}

export interface HeatmapCell {
  hora: number
  key: number | string   // dia number OR nombre_dia
  total: number
  promedio?: number
  semana_del_mes?: number
}

export interface StatsData {
  total_atenciones: number
  pico_hora: number
  pico_total: number
  promedio_dia: number
  total_dias: number
}

export interface Configuracion {
  id: string
  clave: string
  valor: string
  descripcion: string
  updated_at: string
}

export interface SyncLog {
  id: string
  executed_at: string
  status: 'success' | 'error' | 'partial'
  records_fetched: number
  records_upserted: number
  duration_ms: number | null
  error_message: string | null
  sync_from: string | null
  sync_to: string | null
  triggered_by: string
}

export interface ReporteEmail {
  id: string
  tipo: string
  destinatarios: string[]
  asunto: string
  cuerpo?: string
  fecha_envio: string
  estado: 'pending' | 'sent' | 'failed'
  error_mensaje?: string
}
