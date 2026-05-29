import { Users, Clock, TrendingUp, Calendar, BarChart2, Timer } from 'lucide-react'
import { useStats } from '@/hooks/useAtenciones'
import { useStore } from '@/store/useStore'
import { formatHora, calcCapacidad } from '@/utils/heatmap'
import { MESES } from '@/types'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
  loading?: boolean
}

function StatCard({ icon, label, value, sub, color = 'clinic', loading }: StatCardProps) {
  return (
    <div className="card px-2.5 py-2 flex items-center gap-2">
      <div className={`p-1.5 rounded-lg bg-${color}-50 flex-shrink-0`}>
        <div className={`text-${color}-600`}>{icon}</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide leading-none truncate">{label}</p>
        {loading ? (
          <div className="h-5 w-14 bg-slate-200 rounded animate-pulse mt-0.5" />
        ) : (
          <p className="text-base font-bold text-slate-800 leading-tight mt-0.5">{value}</p>
        )}
        {sub && <p className="text-[9px] text-slate-400 leading-none mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  )
}

export default function StatsCards() {
  const { filtros } = useStore()
  const { data: stats, isLoading } = useStats(filtros)
  const capacidad = calcCapacidad(filtros.minutos)

  const promPacHora = stats && stats.total_dias > 0
    ? (stats.total_atenciones / stats.total_dias / 24).toFixed(1)
    : '—'

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  return (
    <div className="grid grid-cols-3 xl:grid-cols-6 gap-2">
      <StatCard
        icon={<Users className="w-4 h-4" />}
        label="Total atenciones"
        value={stats ? stats.total_atenciones.toLocaleString('es-CO') : '—'}
        sub={periodoLabel}
        loading={isLoading}
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4" />}
        label="Hora pico"
        value={stats ? formatHora(stats.pico_hora) : '—'}
        sub={stats ? `${stats.pico_total} atenciones` : undefined}
        loading={isLoading}
      />
      <StatCard
        icon={<Calendar className="w-4 h-4" />}
        label="Promedio / día"
        value={stats ? stats.promedio_dia.toFixed(0) : '—'}
        sub={`${stats?.total_dias ?? 0} días con datos`}
        loading={isLoading}
      />
      <StatCard
        icon={<Timer className="w-4 h-4" />}
        label="Min / atención"
        value={filtros.minutos}
        sub={`${capacidad} pac./prof./h`}
        color="indigo"
      />
      <StatCard
        icon={<BarChart2 className="w-4 h-4" />}
        label="Prom. pac./hora"
        value={promPacHora}
        sub={stats ? `Pico: ${stats.pico_total} pac.` : undefined}
        color="teal"
        loading={isLoading}
      />
      <StatCard
        icon={<Clock className="w-4 h-4" />}
        label="Días analizados"
        value={stats?.total_dias ?? '—'}
        sub={filtros.triage.length === 0 ? 'Todos los triage' : filtros.triage.join(', ')}
        loading={isLoading}
      />
    </div>
  )
}
