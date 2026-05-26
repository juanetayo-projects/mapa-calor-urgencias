import { useState } from 'react'
import Header from '@/components/layout/Header'
import FiltersPanel from './FiltersPanel'
import StatsCards from './StatsCards'
import HeatMap from './HeatMap'
import WeeklyView from './WeeklyView'
import { useStore } from '@/store/useStore'
import { MESES } from '@/types'
import { LayoutGrid, TableProperties } from 'lucide-react'
import { clsx } from 'clsx'

type Tab = 'heatmap' | 'semanal'

export default function DashboardPage() {
  const { filtros } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('heatmap')

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'heatmap', label: 'Mapa de Calor', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'semanal', label: 'Resumen Semanal', icon: <TableProperties className="w-4 h-4" /> },
  ]

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Mapa de Calor · Urgencias"
        subtitle={`Clínica Santa Bárbara · ${periodoLabel}${filtros.triage !== 'all' ? ` · ${filtros.triage}` : ''}`}
      />

      <div className="flex-1 p-5 space-y-4 overflow-auto">
        {/* Filters */}
        <FiltersPanel />

        {/* KPI Cards */}
        <StatsCards />

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px',
                activeTab === id
                  ? 'border-clinic-600 text-clinic-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'heatmap' && <HeatMap />}
        {activeTab === 'semanal' && <WeeklyView />}
      </div>
    </div>
  )
}
