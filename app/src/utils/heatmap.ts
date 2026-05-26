export type HeatLevel = 'empty' | 'low' | 'medium-low' | 'medium' | 'medium-high' | 'high' | 'critical'

export interface CellStyle {
  bg: string
  text: string
  level: HeatLevel
}

// Color scale: white → green → yellow → orange → red → dark-red
const SCALE: Record<HeatLevel, CellStyle> = {
  empty:       { bg: '#f8fafc', text: '#cbd5e1', level: 'empty' },
  low:         { bg: '#dcfce7', text: '#166534', level: 'low' },
  'medium-low':{ bg: '#bbf7d0', text: '#15803d', level: 'medium-low' },
  medium:      { bg: '#fef9c3', text: '#854d0e', level: 'medium' },
  'medium-high':{ bg: '#fed7aa', text: '#9a3412', level: 'medium-high' },
  high:        { bg: '#fca5a5', text: '#991b1b', level: 'high' },
  critical:    { bg: '#dc2626', text: '#ffffff', level: 'critical' },
}

export function getCellStyle(value: number, maxValue: number): CellStyle {
  if (value === 0 || maxValue === 0) return SCALE.empty
  const ratio = value / maxValue
  if (ratio < 0.10) return SCALE.low
  if (ratio < 0.25) return SCALE['medium-low']
  if (ratio < 0.50) return SCALE.medium
  if (ratio < 0.70) return SCALE['medium-high']
  if (ratio < 0.90) return SCALE.high
  return SCALE.critical
}

// How many professionals needed given patients and minutes-per-patient
export function calcProfesionales(atenciones: number, minutos: number): number {
  if (atenciones === 0) return 0
  const atencionesPerHour = 60 / minutos
  return Math.ceil(atenciones / atencionesPerHour)
}

// Capacity: how many patients 1 professional can see per hour
export function calcCapacidad(minutos: number): number {
  return Math.round(60 / minutos)
}

export function formatHora(hora: number): string {
  if (hora === 0)  return '12:00 a.m.'
  if (hora < 12)  return `${hora}:00 a.m.`
  if (hora === 12) return '12:00 m.'
  return `${hora - 12}:00 p.m.`
}

export function getLevelLabel(level: HeatLevel): string {
  const labels: Record<HeatLevel, string> = {
    empty:        'Sin atenciones',
    low:          'Bajo',
    'medium-low': 'Medio-bajo',
    medium:       'Medio',
    'medium-high':'Medio-alto',
    high:         'Alto',
    critical:     'Crítico',
  }
  return labels[level]
}

export const HORAS = Array.from({ length: 24 }, (_, i) => i)
