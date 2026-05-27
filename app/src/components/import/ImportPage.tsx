import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Upload, FileText, AlertTriangle, CheckCircle, XCircle,
  Trash2, RefreshCw, Download, Calendar, Database, Hash,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

// ---- Types ----
interface ImportRecord {
  id: string
  nombre_archivo: string
  filas_importadas: number
  filas_errores: number
  estado: string
  fecha_inicio: string
  fecha_fin: string | null
  detalles: { fecha_desde?: string; fecha_hasta?: string } | null
}

// ---- Column mapping: Excel PascalCase → snake_case ----
const COLUMN_MAP: Record<string, string> = {
  TipoIdentificacion: 'tipo_identificacion',
  Documento: 'documento',
  Nombre: 'nombre',
  Edad: 'edad',
  Sexo: 'sexo',
  Aseguradora: 'aseguradora',
  Contrato: 'contrato',
  Plan: 'plan',
  FechaTriage: 'fecha_triage',
  HoraTriage: 'hora_triage',
  ProfesionalIniciaTriage: 'profesional_inicia_triage',
  ProfesionalClasifica: 'profesional_clasifica',
  UbicacionTriage: 'ubicacion_triage',
  PacienteNoResponde: 'paciente_no_responde',
  ClasificacionTriage: 'clasificacion_triage',
  FechaClasificacion: 'fecha_clasificacion',
  HoraClasificacion: 'hora_clasificacion',
  FechaEgreso: 'fecha_egreso',
  HoraEgreso: 'hora_egreso',
  EstanciaTotalUrgencias: 'estancia_total_urgencias',
  'TiempoClasificacion(minutos)': 'tiempo_clasificacion_minutos',
  DestinoClasificacion: 'destino_clasificacion',
  Ingreso: 'ingreso',
  FechaIngreso: 'fecha_ingreso',
  HoraIngreso: 'hora_ingreso',
  UbicacionOrigen: 'ubicacion_origen',
  'TiempoClasificacionIngreso(minutos)': 'tiempo_clasificacion_ingreso_minutos',
  ProfesionalConsultaInicialUrgencias: 'profesional_consulta_inicial',
  FechaConsultaInicialUrgencias: 'fecha_consulta_inicial',
  HoraConsultaInicialUrgencias: 'hora_consulta_inicial',
  HoraInicioConsultaInicialUrgencias: 'hora_consulta_inicial',  // variante ABRI
  HoraFinConsultaInicialUrgencias: '_skip_hora_fin_consulta',   // ignorar
  DuracionConsultaMinutos: '_skip_duracion_consulta',           // ignorar
  'TiempoEsperaConsultaInicial(minutos)': 'tiempo_espera_consulta_inicial_minutos',
  'TiempoEsperaConsultaInicial(minutos) - DesdeLaClasificacion': 'tiempo_espera_consulta_inicial_minutos',
  DestinoConsultaInicialUrgencias: 'destino_consulta_inicial',
  ProfesionalPrimeraEvolucionUrgencias: 'profesional_primera_evolucion',
  FechaPrimeraEvolucionUrgencias: 'fecha_primera_evolucion',
  'TiempoRevaloracion(horas)': 'tiempo_revaloracion_horas',
  DestinoPrimeraEvolucionUrgencias: 'destino_primera_evolucion',
  'TiempoEstanciaEnUrgencias(minutos)': 'tiempo_estancia_urgencias_minutos',
  'TiempoEnUrgenciasParaInternacion(horas)': 'tiempo_urgencias_internacion_horas',
  DiagnosticoPrincipal: 'diagnostico_principal',
  hora: 'hora_numerica',
  Ndia: 'nombre_dia',
}

// Lowercase version for case-insensitive lookup
const COLUMN_MAP_LC: Record<string, string> = Object.fromEntries(
  Object.entries(COLUMN_MAP).map(([k, v]) => [k.toLowerCase().replace(/\s/g, ''), v])
)

function resolveField(csvKey: string): string {
  if (COLUMN_MAP[csvKey]) return COLUMN_MAP[csvKey]
  const normalized = csvKey.toLowerCase().replace(/\s/g, '')
  return COLUMN_MAP_LC[normalized] ?? csvKey
}

const INT_FIELDS = new Set([
  'edad', 'hora_numerica', 'tiempo_clasificacion_minutos',
  'tiempo_clasificacion_ingreso_minutos', 'tiempo_espera_consulta_inicial_minutos',
  'tiempo_estancia_urgencias_minutos', 'estancia_total_urgencias',
])
const FLOAT_FIELDS = new Set(['tiempo_revaloracion_horas', 'tiempo_urgencias_internacion_horas'])
const SKIP_FIELDS = new Set([
  'id', 'dia_numero', 'mes_numero', 'anio_numero', 'semana_del_mes',
  'tipo_dia', 'created_at', 'updated_at', '#dia', 'mes', 'importacion_id',
  '_skip_hora_fin_consulta', '_skip_duracion_consulta',
])

// ---- CSV utilities ----
function parseLine(line: string, sep: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && !inQ) { inQ = true; continue }
    if (c === '"' && inQ) {
      if (line[i + 1] === '"') { cur += '"'; i++; continue }
      inQ = false; continue
    }
    if (c === sep && !inQ) { result.push(cur); cur = ''; continue }
    cur += c
  }
  result.push(cur)
  return result
}

function detectSeparator(firstLine: string): string {
  const counts = {
    ',': (firstLine.match(/,/g) ?? []).length,
    ';': (firstLine.match(/;/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
  }
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as string
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[]; sep: string } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { headers: [], rows: [], sep: ',' }
  const sep = detectSeparator(lines[0])
  const headers = parseLine(lines[0], sep).map(h => h.trim().replace(/^﻿/, '')) // strip BOM
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const values = parseLine(lines[i], sep)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return { headers, rows, sep }
}

// Detecta si el archivo usa M/D/YYYY (americano) o D/M/YYYY (colombiano)
// escanea las columnas de fecha buscando un valor con segundo componente > 12,
// lo que demuestra inequívocamente que el primer componente es el mes.
function detectDateFormat(rows: Record<string, string>[]): 'MDY' | 'DMY' {
  const dateCols = ['FechaTriage', 'FechaClasificacion', 'FechaEgreso', 'FechaIngreso']
  for (const row of rows) {
    for (const col of dateCols) {
      const val = (row[col] ?? '').trim()
      const m = val.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/)
      if (m) {
        const a = parseInt(m[1], 10), b = parseInt(m[2], 10)
        if (b > 12) return 'MDY'   // segundo > 12 → es día → formato M/D/YYYY
        if (a > 12) return 'DMY'   // primero > 12 → es día → formato D/M/YYYY
      }
    }
  }
  return 'DMY' // por defecto Colombia (D/M/YYYY)
}

function normalizeDate(raw: string, fmt: 'MDY' | 'DMY' = 'DMY'): string | null {
  if (!raw) return null
  const s = raw.trim()
  // ISO: 2024-01-15 o 2024-01-15T...
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10)
  // Formato con barra: M/D/YYYY o D/M/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [a, b, y] = [slash[1], slash[2], slash[3]]
    const ai = parseInt(a, 10), bi = parseInt(b, 10)
    // Si algún componente supera 12, el formato queda determinado unívocamente
    const useMDY = fmt === 'MDY' || bi > 12
    const useDMY = fmt === 'DMY' && ai > 12
    const [mes, dia] = (useMDY && !useDMY) ? [a, b] : [b, a]
    return `${y}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }
  // Formato con guión: DD-MM-YYYY
  const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dash) {
    const [a, b, y] = [dash[1], dash[2], dash[3]]
    const ai = parseInt(a, 10), bi = parseInt(b, 10)
    const useMDY = fmt === 'MDY' || bi > 12
    const useDMY = fmt === 'DMY' && ai > 12
    const [mes, dia] = (useMDY && !useDMY) ? [a, b] : [b, a]
    return `${y}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
  }
  // Número serial de Excel (ej. 45291)
  if (/^\d{5}$/.test(s)) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    epoch.setUTCDate(epoch.getUTCDate() + parseInt(s, 10))
    return epoch.toISOString().substring(0, 10)
  }
  return s
}

function mapRow(row: Record<string, string>, fmt: 'MDY' | 'DMY'): Record<string, unknown> | null {
  const rec: Record<string, unknown> = {}
  for (const [csvKey, value] of Object.entries(row)) {
    if (!value) continue
    const field = resolveField(csvKey)
    if (SKIP_FIELDS.has(field) || field.startsWith('_skip_')) continue
    if (INT_FIELDS.has(field)) {
      const n = parseInt(value, 10)
      rec[field] = isNaN(n) ? null : n
    } else if (FLOAT_FIELDS.has(field)) {
      const n = parseFloat(value.replace(',', '.'))
      rec[field] = isNaN(n) ? null : n
    } else if (field === 'paciente_no_responde') {
      rec[field] = ['1', 'true', 'si', 'sí', 'True', 'TRUE', 'X', 'x'].includes(value)
    } else if (field === 'fecha_triage' || field.startsWith('fecha_')) {
      rec[field] = normalizeDate(value, fmt)
    } else {
      rec[field] = value || null
    }
  }
  if (!rec.fecha_triage) return null
  if (rec.hora_numerica === undefined) rec.hora_numerica = 0
  if (!rec.nombre_dia) rec.nombre_dia = 'DOM'
  return rec
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function downloadTemplate() {
  const headers = [
    'tipo_identificacion', 'documento', 'nombre', 'edad', 'sexo',
    'aseguradora', 'contrato', 'plan', 'fecha_triage', 'hora_triage',
    'profesional_inicia_triage', 'profesional_clasifica', 'ubicacion_triage',
    'paciente_no_responde', 'clasificacion_triage', 'fecha_clasificacion',
    'hora_clasificacion', 'fecha_egreso', 'hora_egreso', 'estancia_total_urgencias',
    'tiempo_clasificacion_minutos', 'destino_clasificacion', 'ingreso',
    'fecha_ingreso', 'hora_ingreso', 'ubicacion_origen',
    'tiempo_clasificacion_ingreso_minutos', 'profesional_consulta_inicial',
    'fecha_consulta_inicial', 'hora_consulta_inicial',
    'tiempo_espera_consulta_inicial_minutos', 'destino_consulta_inicial',
    'profesional_primera_evolucion', 'fecha_primera_evolucion',
    'tiempo_revaloracion_horas', 'destino_primera_evolucion',
    'tiempo_estancia_urgencias_minutos', 'tiempo_urgencias_internacion_horas',
    'diagnostico_principal', 'hora_numerica', 'nombre_dia',
  ]
  const sample = [
    'CC', '12345678', 'JUAN PEREZ', '35', 'M',
    'SURA', 'CONTRATO01', 'PLAN A', '2024-01-15', '08:30',
    'MEDICO1', 'ENFERMERA1', 'TRIAGE_1',
    '0', 'II', '2024-01-15',
    '08:45', '2024-01-15', '14:20', '352',
    '15', 'OBSERVACION', 'SI',
    '2024-01-15', '09:00', 'URGENCIAS',
    '30', 'DR. GARCIA',
    '2024-01-15', '09:15',
    '45', 'CONSULTORIO',
    'DRA. LOPEZ', '2024-01-15',
    '2.5', 'INTERNACION',
    '352', '1.5',
    'J00X RINOFARINGITIS AGUDA', '8', 'MAR',
  ]
  const csv = [headers.join(','), sample.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla_atenciones.csv'; a.click()
  URL.revokeObjectURL(url)
}

// ---- Main component ----
export default function ImportPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [step, setStep] = useState<'idle' | 'analyzing' | 'ready' | 'importing' | 'done'>('idle')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<ImportRecord | null>(null)

  const [fileName, setFileName] = useState('')
  const [totalRows, setTotalRows] = useState(0)
  const [skippedRows, setSkippedRows] = useState(0)
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null)
  const [existingCount, setExistingCount] = useState(0)
  const [parsedRecords, setParsedRecords] = useState<Record<string, unknown>[]>([])

  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [importResult, setImportResult] = useState<{ ok: number; errors: number } | null>(null)
  const [lastImportId, setLastImportId] = useState<string | null>(null)

  const [imports, setImports] = useState<ImportRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [diagHeaders, setDiagHeaders] = useState<string[]>([])
  const [diagSep, setDiagSep] = useState('')

  const canImport = profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  // Load import history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('importaciones')
      .select('*')
      .order('fecha_inicio', { ascending: false })
      .limit(10)
    setImports((data as ImportRecord[]) ?? [])
    setLoadingHistory(false)
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  // File processing
  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .csv')
      return
    }
    setFileName(file.name)
    setStep('analyzing')
    setImportResult(null)

    const text = await file.text()
    if (!text.trim()) {
      toast.error('El archivo está vacío')
      setStep('idle')
      return
    }

    const { rows, headers, sep } = parseCSV(text)
    setDiagHeaders(headers)
    setDiagSep(sep === '\t' ? 'TAB' : sep)

    if (rows.length === 0) {
      toast.error('El archivo no contiene filas de datos')
      setStep('idle')
      return
    }

    // Detectar formato de fecha del archivo (M/D/YYYY americano vs D/M/YYYY colombiano)
    const dateFmt = detectDateFormat(rows)

    const records: Record<string, unknown>[] = []
    let skipped = 0
    for (const row of rows) {
      const rec = mapRow(row, dateFmt)
      if (rec) records.push(rec)
      else skipped++
    }

    if (records.length === 0) {
      setStep('idle')
      return
    }

    // Compute date range
    const dates = records
      .map(r => r.fecha_triage as string)
      .filter(Boolean)
      .sort()
    const fromDate = dates[0]?.substring(0, 10)
    const toDate = dates[dates.length - 1]?.substring(0, 10)
    setDateRange(fromDate && toDate ? { from: fromDate, to: toDate } : null)

    // Check existing records in that date range
    if (fromDate && toDate) {
      const { data } = await supabase.rpc('fn_count_atenciones_en_rango', {
        p_fecha_desde: fromDate,
        p_fecha_hasta: toDate,
      })
      setExistingCount(data ?? 0)
    } else {
      setExistingCount(0)
    }

    setTotalRows(rows.length)
    setSkippedRows(skipped)
    setParsedRecords(records)
    setStep('ready')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const reset = () => {
    setStep('idle')
    setFileName('')
    setTotalRows(0)
    setSkippedRows(0)
    setDateRange(null)
    setExistingCount(0)
    setParsedRecords([])
    setProgress(0)
    setProgressLabel('')
    setImportResult(null)
    setShowConfirm(false)
    setDiagHeaders([])
    setDiagSep('')
  }

  // Perform import
  const runImport = async () => {
    setShowConfirm(false)
    setStep('importing')
    setProgress(0)

    // Create importacion record
    const { data: imp, error: impErr } = await supabase
      .from('importaciones')
      .insert({
        nombre_archivo: fileName,
        filas_importadas: 0,
        filas_errores: 0,
        estado: 'processing',
        detalles: dateRange
          ? { fecha_desde: dateRange.from, fecha_hasta: dateRange.to }
          : null,
      })
      .select()
      .single()

    if (impErr || !imp) {
      toast.error('Error al registrar la importación')
      setStep('ready')
      return
    }

    const importId = (imp as { id: string }).id
    setLastImportId(importId)

    const BATCH = 200
    let totalOk = 0
    let totalErr = 0
    let firstError = ''
    const batches = Math.ceil(parsedRecords.length / BATCH)

    for (let b = 0; b < batches; b++) {
      // Note: importacion_id included only if column exists (migration 003)
      // If column missing the insert still succeeds without it (field is ignored by Supabase
      // when not present in the table — actual error is caught below)
      const baseChunk = parsedRecords.slice(b * BATCH, (b + 1) * BATCH)
      const chunk = baseChunk.map(r => ({ ...r, importacion_id: importId }))

      const { error } = await supabase.from('atenciones').insert(chunk)
      if (error) {
        if (error.message.includes('importacion_id')) {
          // Migration 003 not run yet — retry without importacion_id
          const chunkClean = baseChunk.map(({ importacion_id: _x, ...rest }) => rest) as Record<string, unknown>[]
          const { error: e2 } = await supabase.from('atenciones').insert(chunkClean)
          if (e2) { totalErr += baseChunk.length; if (!firstError) firstError = e2.message }
          else totalOk += baseChunk.length
        } else {
          totalErr += baseChunk.length
          if (!firstError) firstError = error.message
        }
      } else {
        totalOk += baseChunk.length
      }

      const pct = Math.round(((b + 1) / batches) * 100)
      setProgress(pct)
      setProgressLabel(`${totalOk} de ${parsedRecords.length} registros...`)
    }

    if (firstError && totalOk === 0) {
      toast.error(`Error al insertar: ${firstError.substring(0, 120)}`)
      await supabase.from('importaciones').update({ estado: 'failed', fecha_fin: new Date().toISOString() }).eq('id', importId)
      setStep('ready')
      await loadHistory()
      return
    }

    // Update importacion record status
    const { error: updErr } = await supabase
      .from('importaciones')
      .update({
        filas_importadas: totalOk,
        filas_errores: totalErr,
        estado: totalErr === 0 ? 'completed' : 'completed_with_errors',
        fecha_fin: new Date().toISOString(),
      })
      .eq('id', importId)

    if (updErr) {
      // RLS missing — update via upsert approach won't work; just warn
      console.warn('No se pudo actualizar el registro de importación:', updErr.message)
    }

    setImportResult({ ok: totalOk, errors: totalErr })
    setStep('done')

    // Invalidate queries so dashboard refreshes
    queryClient.invalidateQueries()
    await loadHistory()

    if (totalErr === 0) {
      toast.success(`${totalOk} registros importados correctamente`)
    } else {
      toast(`${totalOk} importados, ${totalErr} con errores`, { icon: '⚠️' })
    }
  }

  // Remove an import
  const handleRemove = async (imp: ImportRecord) => {
    setRemoveTarget(imp)
    setShowRemoveConfirm(true)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    setShowRemoveConfirm(false)
    const { data, error } = await supabase.rpc('fn_remove_importacion', {
      p_importacion_id: removeTarget.id,
    })
    if (error) {
      toast.error(`Error al eliminar: ${error.message}`)
    } else {
      toast.success(`${data ?? 0} registros eliminados`)
      queryClient.invalidateQueries()
      await loadHistory()
      if (lastImportId === removeTarget.id) {
        setLastImportId(null)
        reset()
      }
    }
    setRemoveTarget(null)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Importación de Datos</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Cargue archivos CSV con atenciones de urgencias
        </p>
      </div>

      {/* Action bar */}
      <div className="flex gap-3">
        <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Descargar plantilla CSV
        </button>
      </div>

      {/* Drop zone */}
      {(step === 'idle' || step === 'analyzing') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            'card p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors',
            dragging
              ? 'border-clinic-500 bg-clinic-50'
              : 'hover:border-clinic-300 hover:bg-slate-50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {step === 'analyzing' ? (
            <>
              <RefreshCw className="w-10 h-10 text-clinic-500 animate-spin" />
              <p className="text-slate-600 font-medium">Analizando archivo...</p>
            </>
          ) : (
            <>
              <div className={clsx(
                'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
                dragging ? 'bg-clinic-100' : 'bg-slate-100'
              )}>
                <Upload className={clsx('w-8 h-8', dragging ? 'text-clinic-600' : 'text-slate-400')} />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-700">
                  {dragging ? 'Suelte el archivo aquí' : 'Arrastre un archivo CSV o haga clic para seleccionar'}
                </p>
                <p className="text-slate-400 text-sm mt-1">Solo archivos .csv · Máx. 50 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Diagnostic panel — shown when file parsed but no valid records found */}
      {step === 'idle' && diagHeaders.length > 0 && (
        <div className="card p-5 space-y-3 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                No se encontró la columna <code className="bg-amber-100 px-1 rounded">fecha_triage</code>
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Separador detectado: <strong>{diagSep}</strong> · {diagHeaders.length} columnas encontradas
              </p>
            </div>
          </div>
          <div>
            <p className="text-amber-700 text-xs font-medium mb-1.5">Columnas detectadas en el archivo:</p>
            <div className="flex flex-wrap gap-1.5">
              {diagHeaders.map(h => (
                <span
                  key={h}
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded font-mono',
                    resolveField(h) === 'fecha_triage'
                      ? 'bg-green-100 text-green-800 ring-1 ring-green-400'
                      : COLUMN_MAP[h] || COLUMN_MAP_LC[h.toLowerCase().replace(/\s/g, '')]
                        ? 'bg-white text-slate-700 ring-1 ring-slate-300'
                        : 'bg-amber-100 text-amber-700'
                  )}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
          <p className="text-amber-600 text-xs">
            Las columnas en blanco/naranja no se reconocen. Descargue la plantilla CSV para ver el formato esperado.
          </p>
          <button onClick={reset} className="text-xs text-amber-700 underline">Limpiar</button>
        </div>
      )}

      {/* Preview panel */}
      {step === 'ready' && (
        <div className="card p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-clinic-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-slate-800">{fileName}</p>
                <p className="text-slate-500 text-sm">Listo para importar</p>
              </div>
            </div>
            <button onClick={reset} className="text-slate-400 hover:text-slate-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={<Hash className="w-4 h-4 text-clinic-500" />}
              label="Registros válidos" value={parsedRecords.length.toLocaleString('es-CO')} />
            <Stat icon={<Hash className="w-4 h-4 text-slate-400" />}
              label="Filas omitidas" value={skippedRows.toLocaleString('es-CO')}
              muted />
            <Stat icon={<Calendar className="w-4 h-4 text-clinic-500" />}
              label="Fecha inicio"
              value={dateRange ? formatDate(dateRange.from) : '-'} />
            <Stat icon={<Calendar className="w-4 h-4 text-clinic-500" />}
              label="Fecha fin"
              value={dateRange ? formatDate(dateRange.to) : '-'} />
          </div>

          {/* Overlap warning */}
          {existingCount > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 font-medium text-sm">
                  Ya existen {existingCount.toLocaleString('es-CO')} registros en ese rango de fechas
                </p>
                <p className="text-amber-700 text-xs mt-0.5">
                  Los nuevos registros se agregarán sin eliminar los existentes.
                  Si desea reemplazarlos, elimine primero el último archivo importado.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          {canImport && (
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowConfirm(true)} className="btn-primary flex items-center gap-2">
                <Database className="w-4 h-4" />
                Importar {parsedRecords.length.toLocaleString('es-CO')} registros
              </button>
              <button onClick={reset} className="btn-secondary">Cancelar</button>
            </div>
          )}
          {!canImport && (
            <p className="text-slate-500 text-sm">
              Solo administradores y analistas pueden importar datos.
            </p>
          )}
        </div>
      )}

      {/* Importing progress */}
      {step === 'importing' && (
        <div className="card p-8 flex flex-col items-center gap-5">
          <RefreshCw className="w-10 h-10 text-clinic-500 animate-spin" />
          <div className="w-full max-w-sm space-y-2">
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-clinic-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-slate-600 text-sm">{progressLabel}</p>
          </div>
          <p className="text-slate-400 text-xs">No cierre esta ventana durante la importación</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && importResult && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            {importResult.errors === 0
              ? <CheckCircle className="w-8 h-8 text-green-500" />
              : <AlertTriangle className="w-8 h-8 text-amber-500" />
            }
            <div>
              <p className="font-semibold text-slate-800">
                {importResult.errors === 0 ? 'Importación completada' : 'Importación con errores'}
              </p>
              <p className="text-slate-500 text-sm">
                {importResult.ok.toLocaleString('es-CO')} registros insertados
                {importResult.errors > 0 && ` · ${importResult.errors.toLocaleString('es-CO')} con error`}
              </p>
            </div>
          </div>
          <button onClick={reset} className="btn-secondary">Importar otro archivo</button>
        </div>
      )}

      {/* Import history */}
      <div className="card">
        <button
          onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500" />
            <span className="font-medium text-slate-700">Historial de importaciones</span>
            {imports.length > 0 && (
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                {imports.length}
              </span>
            )}
          </div>
          {showHistory
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>

        {showHistory && (
          <div className="border-t border-slate-100">
            {loadingHistory ? (
              <div className="px-5 py-6 flex items-center justify-center gap-2 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> Cargando...
              </div>
            ) : imports.length === 0 ? (
              <p className="px-5 py-6 text-slate-400 text-sm text-center">
                No hay importaciones registradas
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-2.5 text-slate-500 font-medium">Archivo</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Registros</th>
                    <th className="text-center px-4 py-2.5 text-slate-500 font-medium">Estado</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Fecha</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Rango</th>
                    {isAdmin && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {imports.map((imp, idx) => (
                    <tr key={imp.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-700 truncate max-w-[160px]" title={imp.nombre_archivo}>
                        <span className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          {imp.nombre_archivo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 font-mono">
                        {imp.filas_importadas.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge estado={imp.estado} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(imp.fecha_inicio).toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {imp.detalles?.fecha_desde
                          ? `${formatDate(imp.detalles.fecha_desde)} – ${formatDate(imp.detalles.fecha_hasta ?? '')}`
                          : '-'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {idx === 0 && (
                            <button
                              onClick={() => handleRemove(imp)}
                              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                              title="Eliminar esta importación y sus registros"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Confirm import dialog */}
      {showConfirm && (
        <Dialog
          title="Confirmar importación"
          onCancel={() => setShowConfirm(false)}
          onConfirm={runImport}
          confirmLabel="Sí, importar"
          confirmClass="btn-primary"
        >
          <p className="text-slate-600 text-sm">
            Se van a insertar{' '}
            <span className="font-semibold text-slate-800">
              {parsedRecords.length.toLocaleString('es-CO')} registros
            </span>
            {dateRange && (
              <> del período{' '}
                <span className="font-semibold">
                  {formatDate(dateRange.from)} al {formatDate(dateRange.to)}
                </span>
              </>
            )}.
          </p>
          {existingCount > 0 && (
            <p className="text-amber-700 text-sm mt-2 bg-amber-50 rounded px-3 py-2">
              Ya hay {existingCount.toLocaleString('es-CO')} registros en ese rango. Se agregarán sin eliminar los existentes.
            </p>
          )}
          <p className="text-slate-500 text-sm mt-3">¿Desea continuar?</p>
        </Dialog>
      )}

      {/* Confirm remove dialog */}
      {showRemoveConfirm && removeTarget && (
        <Dialog
          title="Eliminar importación"
          onCancel={() => { setShowRemoveConfirm(false); setRemoveTarget(null) }}
          onConfirm={confirmRemove}
          confirmLabel="Sí, eliminar"
          confirmClass="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <p className="text-slate-600 text-sm">
            Se eliminarán permanentemente{' '}
            <span className="font-semibold text-slate-800">
              {removeTarget.filas_importadas.toLocaleString('es-CO')} registros
            </span>{' '}
            del archivo <span className="font-medium">"{removeTarget.nombre_archivo}"</span>.
          </p>
          <p className="text-red-600 text-sm mt-2 font-medium">Esta acción no se puede deshacer.</p>
        </Dialog>
      )}
    </div>
  )
}

// ---- Sub-components ----
function Stat({
  icon, label, value, muted = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <p className={clsx('font-semibold text-lg', muted ? 'text-slate-400' : 'text-slate-800')}>
        {value}
      </p>
    </div>
  )
}

function StatusBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completado', cls: 'bg-green-100 text-green-700' },
    completed_with_errors: { label: 'Con errores', cls: 'bg-amber-100 text-amber-700' },
    processing: { label: 'Procesando', cls: 'bg-blue-100 text-blue-700' },
    failed: { label: 'Fallido', cls: 'bg-red-100 text-red-700' },
  }
  const s = map[estado] ?? { label: estado, cls: 'bg-slate-100 text-slate-600' }
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', s.cls)}>
      {s.label}
    </span>
  )
}

function Dialog({
  title, children, onCancel, onConfirm, confirmLabel, confirmClass,
}: {
  title: string
  children: React.ReactNode
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  confirmClass: string
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-3">{title}</h3>
        {children}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary">Cancelar</button>
          <button onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
