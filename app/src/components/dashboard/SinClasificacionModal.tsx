import { useState } from 'react'
import { X, AlertTriangle, Download, Calendar } from 'lucide-react'
import { useAtencionesSinClasificacion } from '@/hooks/useAtenciones'
import { useStore } from '@/store/useStore'
import { MESES } from '@/types'

interface SinClasificacionModalProps {
  open: boolean
  onClose: () => void
}

// Días por mes (para 2026)
const DIAS_POR_MES: Record<number, number> = {
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
}

export default function SinClasificacionModal({ open, onClose }: SinClasificacionModalProps) {
  const { filtros } = useStore()
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null)

  const { data: registros = [], isLoading } = useAtencionesSinClasificacion(
    filtros.anio,
    filtros.mes,
    diaSeleccionado
  )

  if (!open) return null

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  const now = new Date()
  const esMesActual = filtros.anio === now.getFullYear() && filtros.mes === now.getMonth() + 1
  const maxDias = filtros.mes
    ? esMesActual
      ? Math.min(DIAS_POR_MES[filtros.mes] ?? 31, now.getDate())
      : DIAS_POR_MES[filtros.mes] ?? 31
    : 31

  function exportToCSV() {
    const headers = ['#', 'Ingreso', 'Documento', 'Nombre', 'Fecha Triage', 'Hora Triage', 'Clasificación', 'Destino', 'Ubicación', 'Profesional']
    const rows = registros.map((r, i) => [
      i + 1,
      r.ingreso ?? '',
      r.documento ?? '',
      r.nombre ?? '',
      r.fecha_triage ?? '',
      r.hora_triage ?? '',
      r.clasificacion_triage ?? '',
      r.destino_clasificacion ?? '',
      r.ubicacion_triage ?? '',
      r.profesional_clasifica ?? '',
    ])
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sin_clasificacion_${filtros.anio}_${filtros.mes ?? 'todos'}${diaSeleccionado ? `_dia${diaSeleccionado}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const periodoDetalle = diaSeleccionado
    ? `${periodoLabel} · Día ${diaSeleccionado}`
    : periodoLabel

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-6xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Atenciones sin clasificación de Triage
              </h2>
              <p className="text-xs text-slate-500">
                {periodoDetalle} · {registros.length} registros
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Selector de día */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-clinic-400"
                value={diaSeleccionado ?? ''}
                onChange={(e) => setDiaSeleccionado(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Todos los días</option>
                {Array.from({ length: maxDias }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Día {d}</option>
                ))}
              </select>
            </div>

            {registros.length > 0 && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-clinic-700 bg-clinic-50 rounded-lg hover:bg-clinic-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clinic-600" />
            </div>
          ) : registros.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No hay registros sin clasificación en {periodoDetalle}</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Ingreso</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Documento</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Nombre</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Fecha Triage</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Hora</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Clasificación</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Destino</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Ubicación</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 border-b">Profesional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registros.map((r, i) => (
                    <tr key={r.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{r.ingreso ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.documento ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">{r.nombre ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.fecha_triage ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.hora_triage ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.clasificacion_triage ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.destino_clasificacion ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700">{r.ubicacion_triage ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[150px] truncate">{r.profesional_clasifica ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <p className="text-xs text-slate-500">
            Estos registros no tienen clasificación de triage en la fuente (GoMedisys).
            Revise uno a uno para determinar la causa de la falla.
          </p>
        </div>
      </div>
    </div>
  )
}
