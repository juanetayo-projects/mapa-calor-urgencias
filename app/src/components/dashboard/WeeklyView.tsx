import { useHeatmapSemanal } from '@/hooks/useAtenciones'
import { useStore } from '@/store/useStore'
import { DIAS_SEMANA, DIAS_LABEL } from '@/types'
import { calcProfesionales, formatHora, getCellStyle } from '@/utils/heatmap'
import { Loader2, BarChart3 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

export default function WeeklyView() {
  const { filtros } = useStore()
  const { data, isLoading } = useHeatmapSemanal(filtros)

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // Aggregate by day of week for bar chart
  const byDay = DIAS_SEMANA.map((dia) => {
    const rows = (data ?? []).filter((r) => r.nombre_dia === dia)
    const total = rows.reduce((s, r) => s + r.total, 0)
    const promedio = rows.length > 0
      ? rows.reduce((s, r) => s + r.promedio, 0) / rows.length
      : 0
    return { dia, label: DIAS_LABEL[dia], total, promedio: Math.round(promedio) }
  })

  const maxTotal = Math.max(...byDay.map((d) => d.total), 1)

  // Aggregate by hour for peak hours chart
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const rows = (data ?? []).filter((r) => r.hora === h)
    const total = rows.reduce((s, r) => s + r.total, 0)
    return { hora: h, label: `${h}h`, total }
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Totals by day of week */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-clinic-600" />
          <h3 className="text-sm font-semibold text-slate-700">Atenciones por día de semana</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byDay} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString('es-CO')}`, 'Atenciones']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {byDay.map(({ total }) => {
                const s = getCellStyle(total, maxTotal)
                return <Cell key={total} fill={s.bg === '#f8fafc' ? '#e2e8f0' : s.bg} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Atenciones by hour */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-clinic-600" />
          <h3 className="text-sm font-semibold text-slate-700">Atenciones por hora (semana)</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byHour} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString('es-CO'), 'Atenciones']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="total" fill="#2a63b2" opacity={0.85} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div className="card p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Tabla resumen semanal — profesionales requeridos por hora/día
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-3 text-slate-500 font-medium whitespace-nowrap w-24">Hora</th>
                {DIAS_SEMANA.map((d) => (
                  <th key={d} className="text-center py-2 px-1 text-slate-500 font-medium">{d}</th>
                ))}
                <th className="text-center py-2 px-1 text-slate-600 font-semibold">Total</th>
                <th className="text-center py-2 px-1 text-slate-600 font-semibold">Prom.</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 24 }, (_, hora) => {
                const rowTotal = DIAS_SEMANA.reduce((s, dia) => {
                  const cell = (data ?? []).find((r) => r.hora === hora && r.nombre_dia === dia)
                  return s + (cell?.total ?? 0)
                }, 0)
                const rowAvg = rowTotal > 0 ? Math.round(rowTotal / 7) : 0

                return (
                  <tr key={hora} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-1 pr-3 text-slate-600 whitespace-nowrap font-medium">
                      {formatHora(hora)}
                    </td>
                    {DIAS_SEMANA.map((dia) => {
                      const cell = (data ?? []).find((r) => r.hora === hora && r.nombre_dia === dia)
                      const v = cell?.total ?? 0
                      const profs = calcProfesionales(v, filtros.minutos)
                      const s = getCellStyle(v, Math.max(...(data ?? []).map((r) => r.total), 1))

                      return (
                        <td key={dia} className="py-1 px-1 text-center">
                          <div
                            className="rounded px-1 py-0.5 inline-block min-w-[32px] font-medium"
                            style={{ background: s.bg, color: s.text }}
                          >
                            {v > 0 ? v : '·'}
                          </div>
                          {profs > 0 && (
                            <div className="text-[10px] text-amber-600 font-medium">{profs}p</div>
                          )}
                        </td>
                      )
                    })}
                    <td className="py-1 px-1 text-center font-bold text-clinic-700">{rowTotal > 0 ? rowTotal : '—'}</td>
                    <td className="py-1 px-1 text-center text-slate-500">{rowAvg > 0 ? rowAvg : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold">
                <td className="py-2 pr-3 text-slate-700">TOTAL</td>
                {DIAS_SEMANA.map((dia) => {
                  const t = (data ?? []).filter((r) => r.nombre_dia === dia).reduce((s, r) => s + r.total, 0)
                  return (
                    <td key={dia} className="py-2 px-1 text-center text-clinic-700">{t > 0 ? t : '—'}</td>
                  )
                })}
                <td className="py-2 px-1 text-center text-clinic-800">
                  {(data ?? []).reduce((s, r) => s + r.total, 0).toLocaleString('es-CO')}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-2 italic">p = profesionales requeridos</p>
      </div>
    </div>
  )
}
