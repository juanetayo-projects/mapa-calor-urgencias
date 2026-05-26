import { Users, Clock, TrendingUp, Calendar, Stethoscope, Timer } from 'lucide-react'
import { useStats } from '@/hooks/useAtenciones'
import { useStore } from '@/store/useStore'
import { formatHora, calcCapacidad, calcProfesionales } from '@/utils/heatmap'
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
    <div className="card p-4 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl bg-${color}-50 flex-shrink-0`}>
        <div className={`text-${color}-600`}>{icon}</div>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="h-8 w-24 bg-slate-200 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function StatsCards() {
  const { filtros } = useStore()
  const { data: stats, isLoading } = useStats(filtros)
  const capacidad = calcCapacidad(filtros.minutos)

  const picoProfs = stats
    ? calcProfesionales(stats.pico_total, filtros.minutos)
    : 0

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <StatCard
        icon={<Users className="w-5 h-5" />}
        label="Total atenciones"
        value={stats ? stats.total_atenciones.toLocaleString('es-CO') : '—'}
        sub={periodoLabel}
        loading={isLoading}
      />
      <StatCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Hora pico"
        value={stats ? formatHora(stats.pico_hora) : '—'}
        sub={stats ? `${stats.pico_total} atenciones` : undefined}
        loading={isLoading}
      />
      <StatCard
        icon={<Calendar className="w-5 h-5" />}
        label="Promedio / día"
        value={stats ? stats.promedio_dia.toFixed(0) : '—'}
        sub={`${stats?.total_dias ?? 0} días con datos`}
        loading={isLoading}
      />
      <StatCard
        icon={<Timer className="w-5 h-5" />}
        label="Min / atención"
        value={filtros.minutos}
        sub={`${capacidad} pac. × prof./hora`}
        color="indigo"
      />
      <StatCard
        icon={<Stethoscope className="w-5 h-5" />}
        label="Prof. en pico"
        value={picoProfs}
        sub="Profesionales requeridos"
        color="amber"
        loading={isLoading}
      />
      <StatCard
        icon={<Clock className="w-5 h-5" />}
        label="Días analizados"
        value={stats?.total_dias ?? '—'}
        sub={`Filtrando: ${filtros.triage === 'all' ? 'todos los triage' : filtros.triage}`}
        loading={isLoading}
      />
    </div>
  )
}
