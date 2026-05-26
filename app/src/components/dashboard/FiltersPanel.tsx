import { RotateCcw, SlidersHorizontal, Timer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAniosDisponibles, useTriageDisponibles } from '@/hooks/useAtenciones'
import { DIAS_SEMANA, DIAS_LABEL, MESES, type NombreDia, type VistaHeatmap } from '@/types'
import { calcCapacidad } from '@/utils/heatmap'
import { clsx } from 'clsx'

export default function FiltersPanel() {
  const { filtros, setFiltros, resetFiltros } = useStore()
  const { data: anios = [] } = useAniosDisponibles()
  const { data: triages = [] } = useTriageDisponibles()

  const capacidad = calcCapacidad(filtros.minutos)

  function toggleDia(dia: NombreDia) {
    const next = filtros.diasSemana.includes(dia)
      ? filtros.diasSemana.filter((d) => d !== dia)
      : [...filtros.diasSemana, dia]
    setFiltros({ diasSemana: next })
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <SlidersHorizontal className="w-4 h-4 text-clinic-600" />
          <span className="text-sm">Filtros</span>
        </div>
        <button
          onClick={resetFiltros}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-clinic-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Resetear
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Vista */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Vista</label>
          <select
            className="filter-select w-full"
            value={filtros.vista}
            onChange={(e) => setFiltros({ vista: e.target.value as VistaHeatmap })}
          >
            <option value="mensual">Mensual</option>
            <option value="semanal">Semanal</option>
            <option value="promedio">Promedio</option>
          </select>
        </div>

        {/* Año */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Año</label>
          <select
            className="filter-select w-full"
            value={filtros.anio}
            onChange={(e) => setFiltros({ anio: Number(e.target.value) })}
          >
            {anios.length > 0
              ? anios.map(({ anio }) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))
              : <option value={filtros.anio}>{filtros.anio}</option>
            }
          </select>
        </div>

        {/* Mes */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Mes</label>
          <select
            className="filter-select w-full"
            value={filtros.mes ?? ''}
            onChange={(e) => setFiltros({ mes: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Todos</option>
            {Object.entries(MESES).map(([num, nombre]) => (
              <option key={num} value={num}>{nombre}</option>
            ))}
          </select>
        </div>

        {/* Semana del mes */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Semana del mes</label>
          <select
            className="filter-select w-full"
            value={filtros.semanaDelMes ?? ''}
            onChange={(e) =>
              setFiltros({ semanaDelMes: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Todas</option>
            <option value="1">Semana 1 (días 1–7)</option>
            <option value="2">Semana 2 (días 8–14)</option>
            <option value="3">Semana 3 (días 15–21)</option>
            <option value="4">Semana 4 (días 22–28)</option>
            <option value="5">Semana 5 (días 29–31)</option>
          </select>
        </div>

        {/* Triage */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Triage</label>
          <select
            className="filter-select w-full"
            value={filtros.triage}
            onChange={(e) => setFiltros({ triage: e.target.value })}
          >
            <option value="all">Todos</option>
            {triages.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Minutos */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            Min/atención
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={120}
              step={1}
              className="filter-select w-20"
              value={filtros.minutos}
              onChange={(e) => setFiltros({ minutos: Math.max(1, Number(e.target.value)) })}
            />
            <span className="text-xs text-slate-500 whitespace-nowrap">
              = <strong className="text-clinic-700">{capacidad}</strong>/h
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {capacidad} atenc. × profesional
          </p>
        </div>
      </div>

      {/* Días de semana chips */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <label className="block text-xs font-medium text-slate-500 mb-2">
          Día de la semana {filtros.diasSemana.length > 0 && `(${filtros.diasSemana.length} selec.)`}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((dia) => (
            <button
              key={dia}
              onClick={() => toggleDia(dia)}
              className={clsx(
                'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                filtros.diasSemana.includes(dia)
                  ? 'bg-clinic-600 text-white border-clinic-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-clinic-400 hover:text-clinic-600'
              )}
            >
              {dia}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
