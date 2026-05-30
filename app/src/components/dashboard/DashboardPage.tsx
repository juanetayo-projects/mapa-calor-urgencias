import { useState } from 'react'
import Header from '@/components/layout/Header'
import FiltersPanel from './FiltersPanel'
import StatsCards from './StatsCards'
import HeatMap from './HeatMap'
import WeeklyView from './WeeklyView'
import ProfesionalesView from './ProfesionalesView'
import AnalyticsView from './AnalyticsView'
import { useStore } from '@/store/useStore'
import { useHeatmapSemanal } from '@/hooks/useAtenciones'
import { DIAS_SEMANA, MESES } from '@/types'
import { HORAS } from '@/utils/heatmap'
import { LayoutGrid, TableProperties, Users, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'

type Tab = 'heatmap' | 'semanal' | 'profesionales' | 'analitica'

export default function DashboardPage() {
  const { filtros } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('heatmap')

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  // ── Análisis mensual por hora (para la barra de tabs) ────────────
  const { data: semanalData } = useHeatmapSemanal(filtros)

  const allCells = HORAS.flatMap(hora =>
    DIAS_SEMANA.map(dia => {
      const cell = (semanalData ?? []).find(r => r.hora === hora && r.nombre_dia === dia)
      return cell?.total ?? 0
    })
  )
  const activeCells = allCells.filter(v => v > 0)
  const totalPac    = allCells.reduce((s, v) => s + v, 0)
  const minPac      = activeCells.length > 0 ? Math.min(...activeCells) : 0
  const maxPac      = activeCells.length > 0 ? Math.max(...activeCells) : 0
  const avgPac      = activeCells.length > 0
    ? (totalPac / activeCells.length).toFixed(1)
    : '0'

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'heatmap',       label: 'Mapa de Calor',           icon: <LayoutGrid      className="w-3.5 h-3.5" /> },
    { id: 'semanal',       label: 'Resumen Semanal',          icon: <TableProperties className="w-3.5 h-3.5" /> },
    { id: 'profesionales', label: 'Profesionales requeridos', icon: <Users           className="w-3.5 h-3.5" /> },
    { id: 'analitica',     label: 'Vista Analítica',          icon: <BarChart2       className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Mapa de Calor · Urgencias"
        subtitle={`Clínica Santa Bárbara · ${periodoLabel}${filtros.triage.length > 0 ? ` · ${filtros.triage.join(', ')}` : ''}${filtros.destinoClasificacion.length > 0 ? ` · ${filtros.destinoClasificacion.join(', ')}` : ''}${filtros.ubicacionTriage.length > 0 ? ` · ${filtros.ubicacionTriage.join(', ')}` : ''}`}
      />

      <div className="flex-1 p-3 flex flex-col gap-2 overflow-auto min-h-0">
        {/* Filters */}
        <FiltersPanel />

        {/* KPI Cards */}
        <StatsCards />

        {/* Tabs + Análisis mensual por hora */}
        <div className="flex items-center gap-0.5 border-b border-slate-200 flex-wrap">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all -mb-px',
                activeTab === id
                  ? 'border-clinic-600 text-clinic-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {icon}
              {label}
            </button>
          ))}

          {/* ── Análisis mensual por hora ── visible siempre junto al botón ── */}
          {totalPac > 0 && (
            <div className="ml-auto flex items-center gap-2 pb-1">
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                Análisis mensual por hora:
              </span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1 shadow-sm">
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  Mín <strong className="text-green-700 text-xs">{minPac}</strong>
                </span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  Máx <strong className="text-red-600 text-xs">{maxPac}</strong>
                </span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  Prom <strong className="text-clinic-700 text-xs">{avgPac}</strong>
                </span>
                <span className="text-slate-300 text-xs">·</span>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  Total <strong className="text-slate-700 text-xs">{totalPac.toLocaleString('es-CO')}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {activeTab === 'heatmap'       && <HeatMap />}
          {activeTab === 'semanal'       && <WeeklyView />}
          {activeTab === 'profesionales' && <ProfesionalesView />}
          {activeTab === 'analitica'     && <AnalyticsView />}
        </div>
      </div>
    </div>
  )
}
