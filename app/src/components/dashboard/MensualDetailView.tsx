import { useState, useCallback, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { getColombianHolidays } from '@/utils/holidays'
import { calcProfesionales, formatHora, HORAS } from '@/utils/heatmap'
import { MESES, type HeatmapCell } from '@/types'
import { Loader2, Calendar, TrendingUp, X, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

// ── Escala de color (igual que Vista Analítica) ──────────────────────────

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

const DAY_ABBREV = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

interface DayMeta {
  abbrev:    string
  isSunday:  boolean
  isHoliday: boolean
  fullDate:  string  // 'YYYY-MM-DD'
}

// ── Tooltip ───────────────────────────────────────────────────────────────

interface TooltipState {
  x: number; y: number
  dia: number; hora: number
  meta: DayMeta; total: number; profs: number; semana: number
}

function Tooltip({ t, mes, anio }: { t: TooltipState; mes: number | null; anio: number }) {
  const mesLabel = mes ? MESES[mes] : ''
  return (
    <div
      className="fixed z-50 pointer-events-none bg-slate-900 text-white rounded-xl shadow-2xl p-3 min-w-[210px]"
      style={{ left: t.x + 12, top: t.y - 10 }}
    >
      <p className="font-semibold text-sm mb-2 text-sky-300">
        {formatHora(t.hora)} · {t.meta.abbrev} {t.dia} {mesLabel} {anio}
      </p>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Pacientes</span>
          <strong className="text-yellow-300 text-sm">{t.total}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Prof. requeridos</span>
          <strong className="text-sky-300">{t.profs.toFixed(1)}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Semana del mes</span>
          <strong className="text-slate-300">{t.semana}ª semana</strong>
        </div>
        {(t.meta.isSunday || t.meta.isHoliday) && (
          <div className={clsx(
            'text-center text-[10px] rounded px-2 py-0.5 mt-1 font-medium',
            t.meta.isSunday ? 'bg-red-800 text-red-200' : 'bg-amber-800 text-amber-200'
          )}>
            {t.meta.isSunday ? '🔴 Domingo' : '🟡 Festivo'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal — Registros más representativos ─────────────────────────────────

type SortKey = 'total' | 'profs' | 'dia' | 'hora'

interface ModalRow {
  hora:    number
  dia:     number
  meta:    DayMeta
  total:   number
  profs:   number
  semana:  number
}

function RepresentativeModal({
  rows, onClose, mes, anio,
}: {
  rows: ModalRow[]; onClose: () => void; mes: number | null; anio: number
}) {
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...rows].sort((a, b) =>
    sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]
  )

  const maxTotal = Math.max(...sorted.map(r => r.total), 1)
  const mesLabel = mes ? MESES[mes] : ''

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
        <span className="flex items-center gap-1 justify-end">{label}<SortIcon col={col} /></span>
      </th>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-100">
              <TrendingUp className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Registros más representativos</h2>
              <p className="text-xs text-slate-400">
                {sorted.length} franjas con actividad · {mesLabel} {anio} · clic en columna para ordenar
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0">
              <tr className="bg-slate-700">
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left whitespace-nowrap">Hora</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left whitespace-nowrap">Fecha</th>
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left">Sem.</th>
                <Th col="total"  label="Pacientes" />
                <Th col="profs"  label="Prof. req." />
                <th className="py-2.5 px-3 text-xs font-semibold text-slate-100 text-left">Demanda</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isTop5  = i < 5
                const barW    = Math.round((row.total / maxTotal) * 100)
                const special = row.meta.isSunday || row.meta.isHoliday
                return (
                  <tr
                    key={`${row.hora}-${row.dia}`}
                    className={clsx(
                      'border-b border-slate-100 hover:bg-sky-50 transition-colors',
                      isTop5 && 'bg-amber-50/60',
                      special && 'opacity-80'
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
                    <td className="py-2 px-3 text-xs whitespace-nowrap">
                      <span className={clsx(
                        'font-medium',
                        row.meta.isSunday ? 'text-red-600' : row.meta.isHoliday ? 'text-amber-600' : 'text-slate-700'
                      )}>
                        {row.meta.abbrev} {row.dia} {mesLabel}
                      </span>
                      {special && (
                        <span className="ml-1 text-[9px] text-slate-400">
                          {row.meta.isSunday ? '(Dom)' : '(Fest)'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-xs">{row.semana}ª</td>
                    <td className="py-2 px-3 text-right font-bold text-clinic-700 text-xs tabular-nums">{row.total}</td>
                    <td className="py-2 px-3 text-right text-sky-600 text-xs tabular-nums">{row.profs.toFixed(1)}</td>
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
          <span>🏆 Top 5 resaltados en amarillo · 🔴 Domingo · 🟡 Festivo</span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-600">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────

interface Props {
  mensualData: HeatmapCell[]
  isLoading:   boolean
}

export default function MensualDetailView({ mensualData, isLoading }: Props) {
  const { filtros } = useStore()
  const [tooltip,   setTooltip]   = useState<TooltipState | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  // Días del mes
  const daysInMonth = filtros.mes
    ? new Date(filtros.anio, filtros.mes, 0).getDate()
    : 31
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // Festivos colombianos
  const holidays = useMemo(
    () => getColombianHolidays(filtros.anio),
    [filtros.anio]
  )

  // Metadata por día: nombre, domingo, festivo
  const dayMeta = useMemo((): Map<number, DayMeta> => {
    const meta = new Map<number, DayMeta>()
    if (!filtros.mes) return meta
    days.forEach(d => {
      const date    = new Date(filtros.anio, filtros.mes! - 1, d)
      const dow     = date.getDay()
      const dateKey = `${filtros.anio}-${String(filtros.mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      meta.set(d, {
        abbrev:    DAY_ABBREV[dow],
        isSunday:  dow === 0,
        isHoliday: holidays.has(dateKey),
        fullDate:  dateKey,
      })
    })
    return meta
  }, [days, filtros.anio, filtros.mes, holidays])

  // Lookup: total para una franja (hora, dia)
  const lookup = useCallback((hora: number, dia: number): HeatmapCell | undefined =>
    mensualData.find(r => r.hora === hora && Number(r.key) === dia),
    [mensualData]
  )

  // Max valor para escala de color
  const maxTotal = Math.max(...mensualData.map(r => r.total), 1)

  // Promedio por hora (media de todos los días con datos en esa hora)
  function rowAvg(hora: number): number {
    const vals = days.map(d => lookup(hora, d)?.total ?? 0).filter(v => v > 0)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }

  // Tooltip handler
  const handleEnter = useCallback((e: React.MouseEvent, hora: number, dia: number, cell: HeatmapCell) => {
    const meta  = dayMeta.get(dia)
    if (!meta) return
    const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const profs = calcProfesionales(cell.total, filtros.minutos)
    setTooltip({
      x: rect.right, y: rect.top,
      hora, dia, meta,
      total:  cell.total,
      profs,
      semana: cell.semana_del_mes ?? 1,
    })
  }, [dayMeta, filtros.minutos])

  // Filas para el modal
  const modalRows = useMemo((): ModalRow[] => {
    const rows: ModalRow[] = []
    HORAS.forEach(hora => {
      days.forEach(dia => {
        const cell = lookup(hora, dia)
        if (!cell || cell.total === 0) return
        const meta = dayMeta.get(dia)
        if (!meta) return
        rows.push({
          hora, dia, meta,
          total:  cell.total,
          profs:  calcProfesionales(cell.total, filtros.minutos),
          semana: cell.semana_del_mes ?? 1,
        })
      })
    })
    return rows
  }, [mensualData, days, dayMeta, filtros.minutos, lookup])

  if (isLoading) return (
    <div className="card flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
    </div>
  )

  if (!mensualData.length) return (
    <div className="card flex flex-col items-center justify-center h-64 text-slate-400">
      <Calendar className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">Sin datos para el período seleccionado</p>
      <p className="text-xs mt-1 text-slate-300">Selecciona un mes con datos en los filtros</p>
    </div>
  )

  return (
    <>
      <div className="card overflow-hidden">

        {/* ── Barra superior ── */}
        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-sky-400" />
            <div>
              <p className="text-sm font-bold text-white leading-tight">
                Detalle Mensual · Atenciones por día
              </p>
              <p className="text-[10px] text-slate-400">
                {periodoLabel} · Total de pacientes por hora y día del mes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Leyenda */}
            <div className="flex items-center gap-1 text-[9px] text-slate-400">
              <span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />Dom/Fest
            </div>
            <div className="flex items-center gap-1">
              {[
                { label: 'Bajo', bg: '#eff6ff', tc: '#1e3a5f' },
                { label: '',     bg: '#bfdbfe', tc: '#1e3a5f' },
                { label: '',     bg: '#60a5fa', tc: '#fff'    },
                { label: '',     bg: '#f59e0b', tc: '#fff'    },
                { label: 'Alto', bg: '#991b1b', tc: '#fff'    },
              ].map(({ label, bg, tc }) => (
                <div key={bg} className="w-8 h-4 rounded text-[8px] font-semibold flex items-center justify-center"
                  style={{ background: bg, color: tc }}>{label}</div>
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

        {/* ── Tabla ── */}
        <div className="overflow-auto max-h-[70vh]">
          <table className="border-collapse text-xs" style={{ minWidth: `${90 + daysInMonth * 46}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="py-2 px-3 text-left text-slate-600 font-bold sticky left-0 bg-slate-100 z-30 border-r border-slate-200 min-w-[90px]">
                  Hora
                </th>
                {days.map(dia => {
                  const m = dayMeta.get(dia)
                  const special = m?.isSunday || m?.isHoliday
                  return (
                    <th
                      key={dia}
                      className={clsx(
                        'py-1.5 px-0.5 text-center font-bold border-l border-slate-200 min-w-[42px]',
                        m?.isSunday  && 'bg-red-50 text-red-700',
                        m?.isHoliday && !m.isSunday && 'bg-amber-50 text-amber-700',
                        !special     && 'text-slate-700'
                      )}
                    >
                      <div className="text-xs font-bold">{dia}</div>
                      <div className={clsx('text-[9px] font-normal',
                        m?.isSunday  ? 'text-red-400'    : m?.isHoliday ? 'text-amber-500' : 'text-slate-400'
                      )}>
                        {m?.abbrev ?? ''}
                      </div>
                    </th>
                  )
                })}
                <th className="py-1.5 px-2 text-center font-bold text-slate-600 border-l-2 border-slate-300 min-w-[52px] bg-slate-50 sticky right-0">
                  <div className="text-[10px]">Prom.</div>
                </th>
              </tr>
            </thead>

            <tbody>
              {HORAS.map((hora, idx) => {
                const avg     = rowAvg(hora)
                const hasData = days.some(d => (lookup(hora, d)?.total ?? 0) > 0)

                return (
                  <tr
                    key={hora}
                    className={clsx(
                      'border-b border-slate-100',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40',
                      !hasData && 'opacity-30'
                    )}
                  >
                    {/* Hora label */}
                    <td className={clsx(
                      'py-1 px-3 font-semibold text-slate-600 sticky left-0 z-10 border-r border-slate-200 whitespace-nowrap text-[11px]',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                    )}>
                      {formatHora(hora)}
                    </td>

                    {/* Celdas por día */}
                    {days.map(dia => {
                      const cell  = lookup(hora, dia)
                      const m     = dayMeta.get(dia)
                      const ratio = cell ? cell.total / maxTotal : 0
                      const bg    = getCellBg(ratio)
                      const tc    = getCellText(ratio)
                      const isSpecial = m?.isSunday || m?.isHoliday

                      return (
                        <td
                          key={dia}
                          className={clsx(
                            'py-0.5 px-0.5 border-l border-slate-100 text-center',
                            isSpecial && 'bg-red-50/20'
                          )}
                        >
                          {cell ? (
                            <div
                              className="mx-auto rounded cursor-default select-none transition-transform hover:scale-110 hover:shadow-md"
                              style={{
                                background: bg, color: tc,
                                width: 36, height: 26,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700,
                              }}
                              onMouseEnter={e => handleEnter(e, hora, dia, cell)}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              {cell.total}
                            </div>
                          ) : (
                            <div
                              className={clsx('mx-auto rounded', isSpecial ? 'bg-red-50/40' : 'bg-slate-50')}
                              style={{ width: 36, height: 26 }}
                            />
                          )}
                        </td>
                      )
                    })}

                    {/* Promedio de fila */}
                    <td className="py-0.5 px-2 border-l-2 border-slate-300 text-center bg-slate-50 sticky right-0">
                      {avg > 0 ? (
                        <span className="font-bold text-slate-600 tabular-nums text-[11px]">
                          {avg.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Totales por día */}
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 sticky bottom-0">
                <td className="py-2 px-3 font-bold text-slate-700 sticky left-0 bg-slate-100 z-10 border-r border-slate-200 text-[11px]">
                  TOTAL
                </td>
                {days.map(dia => {
                  const tot = HORAS.reduce((s, h) => s + (lookup(h, dia)?.total ?? 0), 0)
                  const m   = dayMeta.get(dia)
                  return (
                    <td key={dia} className="py-2 px-0.5 text-center border-l border-slate-200">
                      <span className={clsx(
                        'font-bold text-[11px] tabular-nums',
                        m?.isSunday ? 'text-red-600' : m?.isHoliday ? 'text-amber-600' : 'text-clinic-700'
                      )}>
                        {tot > 0 ? tot : '—'}
                      </span>
                    </td>
                  )
                })}
                <td className="py-2 px-2 text-center border-l-2 border-slate-300 bg-slate-100 sticky right-0">
                  <span className="font-bold text-clinic-800 text-[11px] tabular-nums">
                    {mensualData.reduce((s, r) => s + r.total, 0).toLocaleString('es-CO')}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-1 text-[10px] text-slate-400">
          <span>
            Valores = total de pacientes por hora y día específico ·
            Hover para ver fecha, profesionales requeridos y semana del mes
          </span>
          <span className="font-medium">
            {mensualData.length} franjas con datos · {daysInMonth} días en el mes
          </span>
        </div>
      </div>

      {tooltip && (
        <Tooltip t={tooltip} mes={filtros.mes} anio={filtros.anio} />
      )}

      {modalOpen && (
        <RepresentativeModal
          rows={modalRows}
          onClose={() => setModalOpen(false)}
          mes={filtros.mes}
          anio={filtros.anio}
        />
      )}
    </>
  )
}
