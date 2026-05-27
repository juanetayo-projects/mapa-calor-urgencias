import { useEffect } from 'react'
import { RotateCcw, SlidersHorizontal, Timer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAniosDisponibles, useTriageDisponibles, useDestinoDisponibles, useUbicacionDisponibles } from '@/hooks/useAtenciones'
import { DIAS_SEMANA, DIAS_LABEL, MESES, type NombreDia, type VistaHeatmap } from '@/types'
import { calcCapacidad } from '@/utils/heatmap'
import { clsx } from 'clsx'

export default function FiltersPanel() {
  const { filtros, setFiltros, resetFiltros } = useStore()
  const { data: anios = [] } = useAniosDisponibles()
  const { data: triages = [] } = useTriageDisponibles()
  const { data: destinos = [] } = useDestinoDisponibles()
  const { data: ubicaciones = [] } = useUbicacionDisponibles()

  // Cuando los años disponibles cargan, si el año en el store no tiene datos,
  // cambiar automáticamente al primer año disponible
  useEffect(() => {
    if (anios.length > 0 && !anios.some(({ anio }) => anio === filtros.anio)) {
      setFiltros({ anio: anios[0].anio })
    }
  }, [anios]) // eslint-disable-line react-hooks/exhaustive-deps

  const capacidad = calcCapacidad(filtros.minutos)

  function toggleDia(dia: NombreDia) {
    const next = filtros.diasSemana.includes(dia)
      ? filtros.diasSemana.filter((d) => d !== dia)
      : [...filtros.diasSemana, dia]
    setFiltros({ diasSemana: next })
  }

  return (
    <div className="card px-3 py-2">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Title */}
        <div className="flex items-center gap-1.5 text-slate-600 font-semibold shrink-0">
          <SlidersHorizontal className="w-3.5 h-3.5 text-clinic-600" />
          <span className="text-xs">Filtros</span>
        </div>

        {/* Vista */}
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Vista</label>
          <select
            className="filter-select py-1 text-xs"
            value={filtros.vista}
            onChange={(e) => setFiltros({ vista: e.target.value as VistaHeatmap })}
          >
            <option value="mensual">Mensual</option>
            <option value="semanal">Semanal</option>
            <option value="promedio">Promedio</option>
          </select>
        </div>

        {/* Año */}
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Año</label>
          <select
            className="filter-select py-1 text-xs"
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
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Mes</label>
          <select
            className="filter-select py-1 text-xs"
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
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Semana</label>
          <select
            className="filter-select py-1 text-xs"
            value={filtros.semanaDelMes ?? ''}
            onChange={(e) =>
              setFiltros({ semanaDelMes: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Todas</option>
            <option value="1">Sem 1 (1–7)</option>
            <option value="2">Sem 2 (8–14)</option>
            <option value="3">Sem 3 (15–21)</option>
            <option value="4">Sem 4 (22–28)</option>
            <option value="5">Sem 5 (29–31)</option>
          </select>
        </div>

        {/* Clasificación Triage */}
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Clasificación</label>
          <select
            className="filter-select py-1 text-xs"
            value={filtros.triage}
            onChange={(e) => setFiltros({ triage: e.target.value })}
          >
            <option value="all">Todos</option>
            {triages.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Destino clasificación */}
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Destino</label>
          <select
            className="filter-select py-1 text-xs"
            value={filtros.destinoClasificacion}
            onChange={(e) => setFiltros({ destinoClasificacion: e.target.value })}
          >
            <option value="all">Todos</option>
            {destinos.map(({ destino }) => (
              <option key={destino} value={destino}>{destino}</option>
            ))}
          </select>
        </div>

        {/* Ubicación Triage */}
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Ubicación</label>
          <select
            className="filter-select py-1 text-xs"
            value={filtros.ubicacionTriage ?? 'all'}
            onChange={(e) => setFiltros({ ubicacionTriage: e.target.value })}
          >
            <option value="all">Todas</option>
            {ubicaciones.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Minutos */}
        <div className="flex items-center gap-1">
          <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap flex items-center gap-0.5">
            <Timer className="w-3 h-3" />Min/at.
          </label>
          <input
            type="number"
            min={5}
            max={120}
            step={1}
            className="filter-select py-1 text-xs w-16"
            value={filtros.minutos}
            onChange={(e) => setFiltros({ minutos: Math.max(1, Number(e.target.value)) })}
          />
          <span className="text-[10px] text-slate-400 whitespace-nowrap">
            = <strong className="text-clinic-700">{capacidad}</strong>/h
          </span>
        </div>

        {/* Días de semana chips */}
        <div className="flex items-center gap-1 flex-wrap ml-auto">
          <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">
            Días{filtros.diasSemana.length > 0 ? ` (${filtros.diasSemana.length})` : ''}:
          </span>
          {DIAS_SEMANA.map((dia) => (
            <button
              key={dia}
              onClick={() => toggleDia(dia)}
              className={clsx(
                'px-1.5 py-0.5 rounded text-[10px] font-medium transition-all border',
                filtros.diasSemana.includes(dia)
                  ? 'bg-clinic-600 text-white border-clinic-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-clinic-400 hover:text-clinic-600'
              )}
            >
              {dia.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Reset */}
        <button
          onClick={resetFiltros}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-clinic-600 transition-colors shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          Resetear
        </button>
      </div>
    </div>
  )
}
