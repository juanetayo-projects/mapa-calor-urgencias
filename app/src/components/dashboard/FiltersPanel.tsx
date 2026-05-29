import { useEffect, useRef, useState } from 'react'
import { RotateCcw, SlidersHorizontal, Timer, ChevronDown, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAniosDisponibles, useTriageDisponibles, useDestinoDisponibles, useUbicacionDisponibles } from '@/hooks/useAtenciones'
import { DIAS_SEMANA, MESES, type NombreDia, type VistaHeatmap } from '@/types'
import { calcCapacidad } from '@/utils/heatmap'
import { clsx } from 'clsx'

// ── Componente multi-select reutilizable ──────────────────────────────────

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  allLabel?: string
}

function MultiSelect({ label, options, selected, onChange, allLabel = 'Todos' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }

  const buttonLabel =
    selected.length === 0 ? allLabel
    : selected.length === 1 ? selected[0]
    : `${selected.length} sel.`

  const hasSelection = selected.length > 0

  return (
    <div className="flex items-center gap-1">
      <label className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{label}</label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={clsx(
            'flex items-center gap-1 filter-select py-1 text-xs min-w-[80px] max-w-[110px]',
            hasSelection && 'border-clinic-400 bg-clinic-50 text-clinic-700 font-medium'
          )}
        >
          <span className="flex-1 truncate text-left">{buttonLabel}</span>
          {hasSelection
            ? <X className="w-2.5 h-2.5 flex-shrink-0 text-clinic-500 hover:text-clinic-800"
                onClick={e => { e.stopPropagation(); onChange([]) }} />
            : <ChevronDown className={clsx('w-2.5 h-2.5 flex-shrink-0 transition-transform text-slate-400', open && 'rotate-180')} />
          }
        </button>

        {open && options.length > 0 && (
          <div className="absolute z-50 top-full mt-0.5 left-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[160px] py-1 max-h-52 overflow-y-auto">
            {/* Opción "Todos" */}
            <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
              <input
                type="checkbox"
                checked={selected.length === 0}
                onChange={() => onChange([])}
                className="w-3 h-3 accent-clinic-600"
              />
              <span className="text-xs font-medium text-slate-500 italic">{allLabel}</span>
            </label>
            {options.map(opt => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-clinic-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-3 h-3 accent-clinic-600"
                />
                <span className="text-xs text-slate-700">{opt}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Panel principal ────────────────────────────────────────────────────────

export default function FiltersPanel() {
  const { filtros, setFiltros, resetFiltros } = useStore()
  const { data: anios = [] } = useAniosDisponibles()
  const { data: triages = [] } = useTriageDisponibles()
  const { data: destinos = [] } = useDestinoDisponibles()
  const { data: ubicaciones = [] } = useUbicacionDisponibles()

  // Si el año en el store no tiene datos, cambiar al primer año disponible
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

        {/* Clasificación Triage — multi-select */}
        <MultiSelect
          label="Clasificación"
          options={triages}
          selected={filtros.triage}
          onChange={(v) => setFiltros({ triage: v })}
          allLabel="Todos"
        />

        {/* Destino clasificación — multi-select */}
        <MultiSelect
          label="Destino"
          options={destinos.map(d => d.destino)}
          selected={filtros.destinoClasificacion}
          onChange={(v) => setFiltros({ destinoClasificacion: v })}
          allLabel="Todos"
        />

        {/* Ubicación Triage — multi-select */}
        <MultiSelect
          label="Ubicación"
          options={ubicaciones}
          selected={filtros.ubicacionTriage}
          onChange={(v) => setFiltros({ ubicacionTriage: v })}
          allLabel="Todas"
        />

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
