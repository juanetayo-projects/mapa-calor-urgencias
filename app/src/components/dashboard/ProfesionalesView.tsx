import { useHeatmapSemanal } from '@/hooks/useAtenciones'
import { useStore } from '@/store/useStore'
import { DIAS_SEMANA } from '@/types'
import { calcProfesionales, formatHora, HORAS } from '@/utils/heatmap'
import { Loader2, Users } from 'lucide-react'

type ProfLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

interface ProfStyle {
  bg: string
  text: string
  label: string
}

const PROF_SCALE: Record<ProfLevel, ProfStyle> = {
  0: { bg: '#f8fafc', text: '#cbd5e1', label: 'Sin atenciones' },
  1: { bg: '#dcfce7', text: '#166534', label: '1 profesional' },
  2: { bg: '#bbf7d0', text: '#15803d', label: '2 profesionales' },
  3: { bg: '#fef9c3', text: '#854d0e', label: '3 profesionales' },
  4: { bg: '#fed7aa', text: '#9a3412', label: '4 profesionales' },
  5: { bg: '#fca5a5', text: '#991b1b', label: '5 profesionales' },
  6: { bg: '#dc2626', text: '#ffffff', label: '6+ profesionales' },
}

function getProfStyle(profs: number): ProfStyle {
  if (profs === 0) return PROF_SCALE[0]
  if (profs === 1) return PROF_SCALE[1]
  if (profs === 2) return PROF_SCALE[2]
  if (profs === 3) return PROF_SCALE[3]
  if (profs === 4) return PROF_SCALE[4]
  if (profs === 5) return PROF_SCALE[5]
  return PROF_SCALE[6]
}

export default function ProfesionalesView() {
  const { filtros } = useStore()
  const { data, isLoading } = useHeatmapSemanal(filtros)

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  // Max professionals in any cell (for summary info)
  const maxProfs = HORAS.reduce((mx, hora) =>
    DIAS_SEMANA.reduce((mx2, dia) => {
      const cell = (data ?? []).find((r) => r.hora === hora && r.nombre_dia === dia)
      return Math.max(mx2, calcProfesionales(cell?.total ?? 0, filtros.minutos))
    }, mx), 0)

  return (
    <div className="card p-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-clinic-600" />
          <h3 className="text-sm font-semibold text-slate-700">
            Profesionales requeridos por hora y día
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400">{filtros.minutos} min/atención ·</span>
          <span className="text-xs text-slate-500 font-medium">
            Pico: <strong className="text-clinic-700">{maxProfs} prof.</strong>
          </span>
          {/* Leyenda */}
          <div className="flex items-center gap-1 ml-2">
            {([1, 2, 3, 4, 5, 6] as ProfLevel[]).map((n) => (
              <div
                key={n}
                className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center"
                style={{ background: PROF_SCALE[n].bg, color: PROF_SCALE[n].text }}
                title={PROF_SCALE[n].label}
              >
                {n === 6 ? '6+' : n}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-1.5 pr-3 text-slate-500 font-medium whitespace-nowrap w-24 text-xs">
                Hora
              </th>
              {DIAS_SEMANA.map((d) => (
                <th key={d} className="text-center py-1.5 px-1 text-slate-500 font-semibold min-w-[44px]">
                  {d}
                </th>
              ))}
              <th className="text-center py-1.5 px-1 text-slate-600 font-semibold min-w-[44px]">
                Máx.
              </th>
              <th className="text-center py-1.5 px-1 text-slate-600 font-semibold min-w-[52px]">
                Total pac.
              </th>
            </tr>
          </thead>
          <tbody>
            {HORAS.map((hora) => {
              const cells = DIAS_SEMANA.map((dia) => {
                const cell = (data ?? []).find((r) => r.hora === hora && r.nombre_dia === dia)
                const total = cell?.total ?? 0
                const profs = calcProfesionales(total, filtros.minutos)
                return { dia, total, profs }
              })
              const rowPacientes = cells.reduce((s, c) => s + c.total, 0)
              const rowMaxProfs  = cells.reduce((s, c) => Math.max(s, c.profs), 0)

              if (rowPacientes === 0) {
                return (
                  <tr key={hora} className="border-b border-slate-50">
                    <td className="py-0.5 pr-3 text-slate-400 whitespace-nowrap text-[10px]">
                      {formatHora(hora)}
                    </td>
                    {DIAS_SEMANA.map((dia) => (
                      <td key={dia} className="py-0.5 px-0.5 text-center">
                        <div
                          className="rounded mx-auto flex items-center justify-center font-medium"
                          style={{
                            background: PROF_SCALE[0].bg,
                            color: PROF_SCALE[0].text,
                            width: 36,
                            height: 22,
                            fontSize: 11,
                          }}
                        >
                          ·
                        </div>
                      </td>
                    ))}
                    <td className="py-0.5 px-1 text-center text-slate-300">—</td>
                    <td className="py-0.5 px-1 text-center text-slate-300">—</td>
                  </tr>
                )
              }

              return (
                <tr key={hora} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="py-0.5 pr-3 text-slate-600 whitespace-nowrap font-medium text-[10px]">
                    {formatHora(hora)}
                  </td>
                  {cells.map(({ dia, total, profs }) => {
                    const style = getProfStyle(profs)
                    return (
                      <td key={dia} className="py-0.5 px-0.5 text-center">
                        <div
                          className="rounded mx-auto flex items-center justify-center font-bold"
                          style={{
                            background: style.bg,
                            color: style.text,
                            width: 36,
                            height: 22,
                            fontSize: 11,
                          }}
                          title={total > 0 ? `${total} pac. → ${profs} prof.` : ''}
                        >
                          {profs > 0 ? profs : '·'}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-0.5 px-1 text-center font-bold text-clinic-700 text-xs">
                    {rowMaxProfs}
                  </td>
                  <td className="py-0.5 px-1 text-center text-slate-500 text-xs">
                    {rowPacientes.toLocaleString('es-CO')}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold bg-slate-50">
              <td className="py-2 pr-3 text-slate-700 text-xs">PICO</td>
              {DIAS_SEMANA.map((dia) => {
                const diaProfs = HORAS.reduce((mx, hora) => {
                  const cell = (data ?? []).find((r) => r.hora === hora && r.nombre_dia === dia)
                  return Math.max(mx, calcProfesionales(cell?.total ?? 0, filtros.minutos))
                }, 0)
                const style = getProfStyle(diaProfs)
                return (
                  <td key={dia} className="py-2 px-0.5 text-center">
                    {diaProfs > 0 ? (
                      <div
                        className="rounded mx-auto flex items-center justify-center font-bold text-xs"
                        style={{ background: style.bg, color: style.text, width: 36, height: 22 }}
                      >
                        {diaProfs}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                )
              })}
              <td className="py-2 px-1 text-center text-clinic-800 text-xs font-bold">{maxProfs}</td>
              <td className="py-2 px-1 text-center text-slate-500 text-xs">
                {(data ?? []).reduce((s, r) => s + r.total, 0).toLocaleString('es-CO')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 mt-2 italic">
        Cada celda muestra cuántos profesionales se necesitan simultáneamente en esa hora/día
        ({filtros.minutos} min/atención). Hover para ver pacientes totales.
      </p>
    </div>
  )
}
