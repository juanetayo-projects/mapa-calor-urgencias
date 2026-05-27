import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatHora, getCellStyle, HORAS } from './heatmap'
import { MESES } from '@/types'
import type { Filtros } from '@/types'

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

type GridMap = Record<number, Record<string | number, number>>

const DIAS_ORDER = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']

type SemanalRow = { hora: number; nombre_dia: string; total: number; promedio: number; occurrences: number }

function periodoLabel(filtros: Filtros): string {
  return filtros.mes ? `${MESES[filtros.mes]}_${filtros.anio}` : `Año_${filtros.anio}`
}

function periodoTexto(filtros: Filtros): string {
  return filtros.mes ? `${MESES[filtros.mes]} ${filtros.anio}` : `Año ${filtros.anio}`
}

function buildTableData(grid: GridMap, columns: Array<number | string>, colLabels: string[]) {
  const head = ['Hora', ...colLabels]
  const body = HORAS.map((hora) => [
    formatHora(hora),
    ...columns.map((col) => {
      const v = (grid[hora]?.[col as keyof GridMap[number]] as number) ?? 0
      return v > 0 ? v : 0
    }),
  ])
  const totals = [
    'TOTAL',
    ...columns.map((col) =>
      HORAS.reduce((s, h) => s + ((grid[h]?.[col as keyof GridMap[number]] as number) ?? 0), 0),
    ),
  ]
  return { head, body, totals }
}

/** Carga el logo como base64 para el PDF */
async function loadLogoBase64(): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const response = await fetch(`${base}logo.png`)
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// ─── Helpers para construir datos desde semanalData ────────────────────────────
function semanalToGrid(semanalData: SemanalRow[]): GridMap {
  const grid: GridMap = {}
  HORAS.forEach((h) => { grid[h] = {} })
  semanalData.forEach(({ hora, nombre_dia, total }) => {
    grid[hora][nombre_dia] = total
  })
  return grid
}

// ─── Excel desde grid (botón del mapa) ────────────────────────────────────────
export function exportToExcel(
  grid: GridMap,
  columns: Array<number | string>,
  colLabels: string[],
  filtros: Filtros,
) {
  const { head, body, totals } = buildTableData(grid, columns, colLabels)
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([head, ...body, totals])
  ws['!cols'] = head.map((_, i) => ({ wch: i === 0 ? 14 : 6 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Mapa de Calor')

  const summaryData = [
    ['Columna', 'Total atenciones'],
    ...columns.map((col, i) => [
      colLabels[i],
      HORAS.reduce((s, h) => s + ((grid[h]?.[col as keyof GridMap[number]] as number) ?? 0), 0),
    ]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Resumen')
  XLSX.writeFile(wb, `MapaCalor_${periodoLabel(filtros)}.xlsx`)
}

// ─── Excel base64 desde semanalData (para adjuntar al email) ──────────────────
export function semanalToExcelBase64(semanalData: SemanalRow[], filtros: Filtros): string {
  const grid = semanalToGrid(semanalData)
  const periodo = periodoTexto(filtros)

  // Hoja 1: Hora × Día de semana
  const head = ['Hora', ...DIAS_ORDER]
  const body = HORAS.map((hora) => [
    formatHora(hora),
    ...DIAS_ORDER.map((d) => (grid[hora]?.[d] as number) ?? 0),
  ])
  const totals = [
    'TOTAL',
    ...DIAS_ORDER.map((d) => HORAS.reduce((s, h) => s + ((grid[h]?.[d] as number) ?? 0), 0)),
  ]

  const ws = XLSX.utils.aoa_to_sheet([
    [`Mapa de Calor Urgencias · Clínica Santa Bárbara · ${periodo}`],
    [],
    head,
    ...body,
    totals,
  ])
  ws['!cols'] = [{ wch: 14 }, ...DIAS_ORDER.map(() => ({ wch: 8 }))]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]

  // Hoja 2: Totales por hora
  const resumenHead = ['Hora', 'Total atenciones', 'Día pico']
  const resumenBody = HORAS.map((hora) => {
    const vals = DIAS_ORDER.map((d) => ({ dia: d, v: (grid[hora]?.[d] as number) ?? 0 }))
    const total = vals.reduce((s, x) => s + x.v, 0)
    const pico = vals.sort((a, b) => b.v - a.v)[0]
    return [formatHora(hora), total, total > 0 ? `${pico.dia} (${pico.v})` : '—']
  })
  const ws2 = XLSX.utils.aoa_to_sheet([resumenHead, ...resumenBody])
  ws2['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle por Día')
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por Hora')

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
}

// ─── PDF desde grid (botón del mapa) ──────────────────────────────────────────
export async function exportToPDF(
  grid: GridMap,
  columns: Array<number | string>,
  colLabels: string[],
  filtros: Filtros,
) {
  const { head, body, totals } = buildTableData(grid, columns, colLabels)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const headerH = 22

  doc.setFillColor(30, 77, 140)
  doc.rect(0, 0, pageW, headerH, 'F')

  const logoBase64 = await loadLogoBase64()
  if (logoBase64) doc.addImage(logoBase64, 'PNG', 5, 2, 38, 18)

  const textX = logoBase64 ? 48 : 8
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Mapa de Calor · Urgencias', textX, 10)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Clínica Santa Bárbara de Alta Complejidad', textX, 16)

  const periodoText = `Período: ${periodoTexto(filtros)}${filtros.triage !== 'all' ? '  ·  Triage: ' + filtros.triage : ''}`
  doc.setFontSize(8)
  doc.text(periodoText, pageW - doc.getTextWidth(periodoText) - 5, 16)

  autoTable(doc, {
    head: [head],
    body: [...body, totals],
    startY: headerH + 2,
    styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center' },
    headStyles: { fillColor: [30, 77, 140], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { halign: 'left', cellWidth: 18 } },
    didParseCell: (data) => {
      if (data.row.index === body.length) {
        data.cell.styles.fillColor = [240, 244, 251]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [30, 77, 140]
      }
    },
    margin: { left: 5, right: 5 },
  })

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 5, pageH - 3)
  doc.text('Mapa de Calor Urgencias · Clínica Santa Bárbara', pageW / 2, pageH - 3, { align: 'center' })

  doc.save(`MapaCalor_${periodoLabel(filtros)}.pdf`)
}

// ─── PDF base64 desde semanalData (para adjuntar al email) ────────────────────
export async function semanalToPDFBase64(semanalData: SemanalRow[], filtros: Filtros): Promise<string> {
  const grid = semanalToGrid(semanalData)
  const colLabels = DIAS_ORDER
  const periodo = periodoTexto(filtros)

  // Calcular valor máximo para la escala de colores
  const maxValue = HORAS.reduce((mx, hora) =>
    DIAS_ORDER.reduce((mx2, d) => Math.max(mx2, (grid[hora]?.[d] as number) ?? 0), mx), 0)

  const head = ['Hora', ...colLabels]
  const body = HORAS.map((hora) => [
    formatHora(hora),
    ...DIAS_ORDER.map((d) => {
      const v = (grid[hora]?.[d] as number) ?? 0
      return v > 0 ? v : '—'
    }),
  ])
  const totals = [
    'TOTAL',
    ...DIAS_ORDER.map((d) => HORAS.reduce((s, h) => s + ((grid[h]?.[d] as number) ?? 0), 0)),
  ]

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const headerH = 22

  doc.setFillColor(30, 77, 140)
  doc.rect(0, 0, pageW, headerH, 'F')

  // Logo blanco
  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const response = await fetch(`${base}logo-white.png`)
    if (response.ok) {
      const blob = await response.blob()
      const logoB64 = await new Promise<string>((res) => {
        const r = new FileReader()
        r.onloadend = () => res(r.result as string)
        r.readAsDataURL(blob)
      })
      doc.addImage(logoB64, 'PNG', 5, 2, 38, 18)
    }
  } catch { /* sin logo */ }

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Mapa de Calor · Urgencias', 48, 10)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Clínica Santa Bárbara de Alta Complejidad', 48, 16)

  const periodoText = `Período: ${periodo}${filtros.triage !== 'all' ? '  ·  Triage: ' + filtros.triage : ''}`
  doc.setFontSize(8)
  doc.text(periodoText, pageW - doc.getTextWidth(periodoText) - 5, 16)

  autoTable(doc, {
    head: [head],
    body: [...body, totals],
    startY: headerH + 2,
    styles: { fontSize: 7, cellPadding: 1.4, halign: 'center' },
    headStyles: { fillColor: [30, 77, 140], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 20 } },
    didParseCell: (data) => {
      // Fila de totales
      if (data.row.index === body.length) {
        data.cell.styles.fillColor = [240, 244, 251]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [30, 77, 140]
        return
      }
      // Celdas de datos (columnas 1..7, no la columna de hora)
      if (data.section === 'body' && data.column.index > 0) {
        const raw = data.cell.raw
        if (typeof raw === 'number' && raw > 0) {
          const style = getCellStyle(raw, maxValue)
          data.cell.styles.fillColor = hexToRgb(style.bg)
          data.cell.styles.textColor = hexToRgb(style.text)
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
    margin: { left: 5, right: 5 },
  })

  doc.setTextColor(148, 163, 184)
  doc.setFontSize(6.5)
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 5, pageH - 3)
  doc.text('Mapa de Calor Urgencias · Clínica Santa Bárbara', pageW / 2, pageH - 3, { align: 'center' })

  return doc.output('datauristring').split(',')[1]
}
