import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useHeatmapMensual, useHeatmapSemanal } from '@/hooks/useAtenciones'
import { getCellStyle, formatHora, calcProfesionales, HORAS } from '@/utils/heatmap'
import { DIAS_SEMANA, type NombreDia } from '@/types'
import { Loader2, Info } from 'lucide-react'
import { clsx } from 'clsx'

interface TooltipData {
  hora: number
  key: number | string
  total: number
  profesionales: number
  x: number
  y: number
}

export default function HeatMap() {
  const { filtros } = useStore()
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const isSemanal = filtros.vista === 'semanal' || filtros.vista === 'promedio'

  const { data: mensualData, isLoading: loadingM } = useHeatmapMensual(filtros)
  const { data: semanalData, isLoading: loadingS } = useHeatmapSemanal(filtros)

  const isLoading = isSemanal ? loadingS : loadingM

  // Build a lookup: { hora: { key: value } }
  const grid = useMemo(() => {
    if (isSemanal) {
      const map: Record<number, Record<string, number>> = {}
      HORAS.forEach((h) => { map[h] = {} })
      ;(semanalData ?? []).forEach(({ hora, nombre_dia, total, promedio }) => {
        map[hora][nombre_dia] = filtros.vista === 'promedio' ? Math.round(promedio) : total
      })
      return map
    } else {
      const map: Record<number, Record<number, number>> = {}
      HORAS.forEach((h) => { map[h] = {} })
      ;(mensualData ?? []).forEach(({ hora, key, total }) => {
        map[hora as number][key as number] = total
      })
      return map
    }
  }, [isSemanal, mensualData, semanalData, filtros.vista])

  // Column keys
  const columns: Array<number | NombreDia> = useMemo(() => {
    if (isSemanal) return DIAS_SEMANA
    if (!mensualData || mensualData.length === 0) {
      // Fallback: days 1-31 for the selected month
      const daysInMonth = filtros.mes
        ? new Date(filtros.anio, filtros.mes, 0).getDate()
        : 31
      return Array.from({ length: daysInMonth }, (_, i) => i + 1)
    }
    const days = new Set<number>()
    mensualData.forEach(({ key }) => days.add(key as number))
    return [...days].sort((a, b) => (a as number) - (b as number))
  }, [isSemanal, mensualData, filtros.mes, filtros.anio])

  // Max value for color scale
  const maxValue = useMemo(() => {
    let max = 0
    Object.values(grid).forEach((row) => {
      Object.values(row).forEach((v) => { if (v > max) max = v })
    })
    return max || 1
  }, [grid])

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">Cargando datos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 overflow-x-auto relative">
      {/* Legend */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500">
            {filtros.vista === 'promedio' ? 'Promedio de atenciones' : 'Total atenciones'} por hora
            {filtros.triage !== 'all' && ` · ${filtros.triage}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Menor</span>
          {['#dcfce7', '#bbf7d0', '#fef9c3', '#fed7aa', '#fca5a5', '#dc2626'].map((c) => (
            <div key={c} className="w-5 h-4 rounded-sm" style={{ background: c }} />
          ))}
          <span>Mayor</span>
        </div>
      </div>

      <div className="heatmap-grid">
        {/* Header row */}
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `80px repeat(${columns.length}, minmax(28px, 1fr))`,
          }}
        >
          <div className="text-xs text-slate-400 text-center pb-1 font-medium">Hora</div>
          {columns.map((col) => (
            <div key={col} className="text-xs text-slate-500 text-center pb-1 font-medium">
              {typeof col === 'number' ? col : col}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {HORAS.map((hora) => (
          <div
            key={hora}
            className="grid gap-px mb-px"
            style={{
              gridTemplateColumns: `80px repeat(${columns.length}, minmax(28px, 1fr))`,
            }}
          >
            {/* Hour label */}
            <div className="flex items-center justify-end pr-2">
              <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
                {formatHora(hora)}
              </span>
            </div>

            {/* Cells */}
            {columns.map((col) => {
              const value = (grid[hora]?.[col as keyof typeof grid[number]] as number) ?? 0
              const style = getCellStyle(value, maxValue)
              const profs = value > 0 ? calcProfesionales(value, filtros.minutos) : 0

              return (
                <div
                  key={col}
                  className="heatmap-cell"
                  style={{ background: style.bg, color: style.text }}
                  onMouseEnter={(e) => {
                    const rect = (e.target as HTMLElement).getBoundingClientRect()
                    setTooltip({
                      hora,
                      key: col,
                      total: value,
                      profesionales: profs,
                      x: rect.left + rect.width / 2,
                      y: rect.top - 8,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {value > 0 ? (
                    <span className="text-[10px] leading-none font-bold">{value}</span>
                  ) : (
                    <span className="text-[9px] text-slate-300">·</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Totals row */}
        <div
          className="grid gap-px mt-1 border-t border-slate-200 pt-1"
          style={{
            gridTemplateColumns: `80px repeat(${columns.length}, minmax(28px, 1fr))`,
          }}
        >
          <div className="flex items-center justify-end pr-2">
            <span className="text-xs font-bold text-slate-700">TOTAL</span>
          </div>
          {columns.map((col) => {
            const total = HORAS.reduce(
              (sum, h) => sum + ((grid[h]?.[col as keyof typeof grid[number]] as number) ?? 0),
              0
            )
            return (
              <div
                key={col}
                className="flex items-center justify-center text-[10px] font-bold text-clinic-700 bg-clinic-50 rounded py-1"
              >
                {total > 0 ? total : '—'}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && tooltip.total > 0 && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-semibold mb-1">
            {formatHora(tooltip.hora)}
            {typeof tooltip.key === 'number' ? ` · Día ${tooltip.key}` : ` · ${tooltip.key}`}
          </p>
          <p className="text-slate-300">
            {tooltip.total} atenciones
          </p>
          <p className="text-amber-300">
            {tooltip.profesionales} profesional{tooltip.profesionales !== 1 ? 'es' : ''} requerido{tooltip.profesionales !== 1 ? 's' : ''}
          </p>
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  )
}
