import { useState, useCallback } from 'react'
import { useHeatmapSemanal, useHeatmapStatsDetail } from '@/hooks/useAtenciones'
import { useStore } from '@/store/useStore'
import { DIAS_SEMANA, DIAS_LABEL, MESES } from '@/types'
import { formatHora, HORAS } from '@/utils/heatmap'
import { Loader2, TableProperties, X, TrendingUp, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

// ── Tipos internos ────────────────────────────────────────────────────────

interface CellData {
  hora:        number
  nombre_dia:  string
  total:       number
  promedio:    number
  occurrences: number
  minimo:      number | null
  maximo:      number | null
}

// ── Escala de color estilo Odoo (azul → naranja → rojo) ──────────────────

function getCellBg(ratio: number): string {
  if (ratio === 0)   return '#f8fafc'
  if (ratio < 0.10)  return '#eff6ff'
  if (ratio < 0.25)  return '#bfdbfe'
  if (ratio < 0.45)  return '#60a5fa'
  if (ratio < 0.65)  return '#f59e0b'
  if (ratio < 0.85)  return '#ef4444'
  return '#991b1b'
}
function getCellText(ratio: number): string {
  if (ratio === 0)   return '#cbd5e1'
  if (ratio < 0.45)  return '#1e3a5f'
  return '#ffffff'
}

// ── Tooltip ───────────────────────────────────────────────────────────────

interface TooltipState {
  x: number; y: number
  cell: CellData
}

function Tooltip({ t }: { t: TooltipState }) {
  const { cell } = t
  return (
    <div
      className="fixed z-50 pointer-events-none bg-slate-900 text-white rounded-xl shadow-2xl p-3 min-w-[210px]"
      style={{ left: t.x + 12, top: t.y - 10 }}
    >
      <p className="font-semibold text-sm mb-2 text-sky-300">
        {formatHora(cell.hora)} · {DIAS_LABEL[cell.nombre_dia as keyof typeof DIAS_LABEL] ?? cell.nombre_dia}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Promedio/día</span>
          <strong className="text-white">{cell.promedio.toFixed(1)} pac.</strong>
        </div>
        {cell.minimo !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Mínimo diario</span>
            <strong className="text-green-400">{cell.minimo} pac.</strong>
          </div>
        )}
        {cell.maximo !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-400">Máximo diario</span>
            <strong className="text-red-400">{cell.maximo} pac.</strong>
          </div>
        )}
        <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between gap-4">
          <span className="text-slate-400">Total período</span>
          <strong className="text-yellow-300">{cell.total.toLocaleString('es-CO')}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Días con datos</span>
          <strong className="text-sky-300">{cell.occurrences}</strong>
        </div>
      </div>
    </div>
  )
}

// ── Modal — Registros más representativos ─────────────────────────────────

type SortKey = 'promedio' | 'maximo' | 'minimo' | 'total' | 'occurrences'

function RepresentativeModal({ data, onClose }: { data: CellData[]; onClose: () => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('promedio')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...data]
    .filter(r => r.total > 0)
    .sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
    })

  const maxProm = Math.max(...sorted.map(r => r.promedio), 1)

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'desc' ? <ChevronDown className="w-3 h-3 text-sky-400" /> : <ChevronUp className="w-3 h-3 text-sky-400" />
  }

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="py-2.5 px-3 text-xs font-semibold text-slate-100 cursor-pointer select-none whitespace-nowrap hover:bg-slate-600 transition-colors text-right"
        onClick={() => toggleSort(col)}
      >
        <span className="flex items-center gap-1 justify-end">
          {label}
          <SortIcon col={col} />
        </span>
      </th>
    )
  }

  const hasMinMax = sorted.some(r => r.minimo !== null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-100">
              <TrendingUp className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Registros más representativos</h2>
              <p className="text-xs text-slate-400">
                {sorted.length} combinaciones · clic en columna para ordenar
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Tabla */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0">
              <tr className="bg-slate-700">
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left whitespace-nowrap">Hora</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left whitespace-nowrap">Día</th>
                <Th col="promedio"    label="Prom/día" />
                {hasMinMax && <Th col="minimo" label="Mínimo" />}
                {hasMinMax && <Th col="maximo" label="Máximo" />}
                <Th col="total"       label="Total" />
                <Th col="occurrences" label="Días datos" />
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left">Demanda</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isTop5 = i < 5
                const barW   = Math.round((row.promedio / maxProm) * 100)
                return (
                  <tr
                    key={`${row.hora}-${row.nombre_dia}`}
                    className={clsx(
                      'border-b border-slate-100 hover:bg-sky-50 transition-colors',
                      isTop5 && 'bg-amber-50/60'
                    )}
                  >
                    <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap text-xs">
                      {isTop5 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 mr-1 rounded-full bg-amber-400 text-white text-[9px] font-bold">
                          {i + 1}
                        </span>
                      )}
                      {formatHora(row.hora)}
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-xs whitespace-nowrap">
                      {DIAS_LABEL[row.nombre_dia as keyof typeof DIAS_LABEL] ?? row.nombre_dia}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-clinic-700 text-xs tabular-nums">
                      {row.promedio.toFixed(1)}
                    </td>
                    {hasMinMax && (
                      <td className="py-2 px-3 text-right text-green-700 text-xs tabular-nums">
                        {row.minimo ?? '—'}
                      </td>
                    )}
                    {hasMinMax && (
                      <td className="py-2 px-3 text-right text-red-600 text-xs tabular-nums font-semibold">
                        {row.maximo ?? '—'}
                      </td>
                    )}
                    <td className="py-2 px-3 text-right text-slate-600 text-xs tabular-nums">
                      {row.total.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400 text-xs tabular-nums">
                      {row.occurrences}
                    </td>
                    <td className="py-2 px-3 w-32">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-sky-500 transition-all" style={{ width: `${barW}%` }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
          <span>🏆 Top 5 resaltados en amarillo</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────

export default function AnalyticsView() {
  const { filtros } = useStore()

  // Fuente principal: semanal (siempre funciona, incluye promedio/total/occ)
  const { data: semanalData, isLoading } = useHeatmapSemanal(filtros)

  // Enriquecimiento opcional: min/max por día (requiere migration 009)
  const { data: detailData } = useHeatmapStatsDetail(filtros)

  const [tooltip,   setTooltip]   = useState<TooltipState | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  // Merge: semanal + detail (si hay)
  const lookup = useCallback((hora: number, dia: string): CellData | undefined => {
    const s = (semanalData ?? []).find(r => r.hora === hora && r.nombre_dia === dia)
    if (!s) return undefined
    const d = (detailData  ?? []).find(r => r.hora === hora && r.nombre_dia === dia)
    return {
      hora:        s.hora,
      nombre_dia:  s.nombre_dia,
      total:       s.total,
      promedio:    s.promedio,
      occurrences: s.occurrences,
      minimo:      d?.minimo  ?? null,
      maximo:      d?.maximo  ?? null,
    }
  }, [semanalData, detailData])

  // Todos los datos merged para el modal
  const allMerged: CellData[] = (semanalData ?? []).map(s => {
    const d = (detailData ?? []).find(r => r.hora === s.hora && r.nombre_dia === s.nombre_dia)
    return {
      hora: s.hora, nombre_dia: s.nombre_dia,
      total: s.total, promedio: s.promedio, occurrences: s.occurrences,
      minimo: d?.minimo ?? null, maximo: d?.maximo ?? null,
    }
  })

  const maxProm = Math.max(...(semanalData ?? []).map(r => r.promedio), 1)

  // Suma de promedios por día (para fila total)
  const totByDay = DIAS_SEMANA.reduce((acc, dia) => {
    acc[dia] = (semanalData ?? []).filter(r => r.nombre_dia === dia).reduce((s, r) => s + r.promedio, 0)
    return acc
  }, {} as Record<string, number>)

  function rowAvg(hora: number): number {
    const cells = DIAS_SEMANA.map(d => lookup(hora, d)?.promedio ?? 0).filter(v => v > 0)
    return cells.length ? cells.reduce((s, v) => s + v, 0) / cells.length : 0
  }

  const handleCellEnter = useCallback((e: React.MouseEvent, cell: CellData) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ x: rect.right, y: rect.top, cell })
  }, [])

  if (isLoading) return (
    <div className="card flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
    </div>
  )

  if (!(semanalData ?? []).length) return (
    <div className="card flex flex-col items-center justify-center h-64 text-slate-400">
      <TableProperties className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">Sin datos para el período seleccionado</p>
    </div>
  )

  return (
    <>
      <div className="card overflow-hidden">

        {/* ── Barra superior estilo Odoo ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <TableProperties className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                Vista Analítica · Promedio de atenciones
              </p>
              <p className="text-[10px] text-slate-400">
                {periodoLabel} · Promedio diario por hora y día de semana
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Leyenda */}
            <div className="flex items-center gap-1">
              {[
                { label: 'Bajo',  bg: '#eff6ff', tc: '#1e3a5f' },
                { label: '',      bg: '#bfdbfe', tc: '#1e3a5f' },
                { label: '',      bg: '#60a5fa', tc: '#fff'    },
                { label: '',      bg: '#f59e0b', tc: '#fff'    },
                { label: 'Alto',  bg: '#991b1b', tc: '#fff'    },
              ].map(({ label, bg, tc }) => (
                <div
                  key={bg}
                  className="w-8 h-4 rounded text-[8px] font-semibold flex items-center justify-center"
                  style={{ background: bg, color: tc }}
                >
                  {label}
                </div>
              ))}
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition-colors shadow"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Ver registros representativos
            </button>
          </div>
        </div>

        {/* ── Tabla Pivot estilo Odoo ── */}
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="py-2.5 px-3 text-left text-slate-600 font-bold sticky left-0 bg-slate-100 z-10 border-r border-slate-200 whitespace-nowrap min-w-[90px]">
                  Hora
                </th>
                {DIAS_SEMANA.map(dia => (
                  <th key={dia} className="py-2.5 px-2 text-center font-bold text-slate-700 border-l border-slate-200 min-w-[68px]">
                    <div className="text-xs">{DIAS_LABEL[dia]}</div>
                    <div className="text-[9px] text-slate-400 font-normal mt-0.5">prom/día</div>
                  </th>
                ))}
                <th className="py-2.5 px-2 text-center font-bold text-slate-600 border-l-2 border-slate-300 min-w-[68px] bg-slate-50">
                  <div className="text-xs">Prom.</div>
                  <div className="text-[9px] text-slate-400 font-normal mt-0.5">todos días</div>
                </th>
              </tr>
            </thead>

            <tbody>
              {HORAS.map((hora, idx) => {
                const avg     = rowAvg(hora)
                const hasData = DIAS_SEMANA.some(d => (lookup(hora, d)?.total ?? 0) > 0)

                return (
                  <tr
                    key={hora}
                    className={clsx(
                      'border-b border-slate-100 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                      !hasData && 'opacity-30'
                    )}
                  >
                    <td className={clsx(
                      'py-1.5 px-3 font-semibold text-slate-600 sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    )}>
                      {formatHora(hora)}
                    </td>

                    {DIAS_SEMANA.map(dia => {
                      const cell  = lookup(hora, dia)
                      const ratio = cell ? cell.promedio / maxProm : 0
                      const bg    = getCellBg(ratio)
                      const tc    = getCellText(ratio)

                      return (
                        <td key={dia} className="py-0.5 px-0.5 border-l border-slate-100 text-center">
                          {cell ? (
                            <div
                              className="mx-auto rounded cursor-default select-none transition-transform hover:scale-110 hover:shadow-md"
                              style={{
                                background: bg, color: tc,
                                width: 60, height: 30,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 700,
                              }}
                              onMouseEnter={e => handleCellEnter(e, cell)}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              {cell.promedio.toFixed(1)}
                            </div>
                          ) : (
                            <div className="mx-auto rounded bg-slate-50" style={{ width: 60, height: 30 }} />
                          )}
                        </td>
                      )
                    })}

                    <td className="py-0.5 px-2 border-l-2 border-slate-300 text-center bg-slate-50">
                      {avg > 0 ? (
                        <span className="font-bold text-slate-600 tabular-nums">{avg.toFixed(1)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100">
                <td className="py-2 px-3 font-bold text-slate-700 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 text-xs">
                  Σ prom
                </td>
                {DIAS_SEMANA.map(dia => (
                  <td key={dia} className="py-2 px-2 text-center border-l border-slate-200">
                    <span className="font-bold text-slate-700 text-xs tabular-nums">
                      {totByDay[dia] > 0 ? totByDay[dia].toFixed(0) : '—'}
                    </span>
                  </td>
                ))}
                <td className="py-2 px-2 text-center border-l-2 border-slate-300">
                  <span className="font-bold text-clinic-700 text-xs tabular-nums">
                    {Object.values(totByDay).reduce((s, v) => s + v, 0).toFixed(0)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-1 text-[10px] text-slate-400">
          <span>
            Valores = promedio de pacientes por día en esa franja horaria ·
            Hover sobre celda: mín / máx / total / días con datos
          </span>
          <span className="font-medium">
            {(semanalData ?? []).length} celdas con datos
            {(detailData ?? []).length > 0 && ' · mín/máx disponibles'}
          </span>
        </div>
      </div>

      {tooltip && <Tooltip t={tooltip} />}

      {modalOpen && (
        <RepresentativeModal data={allMerged} onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
