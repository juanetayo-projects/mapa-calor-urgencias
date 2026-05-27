import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatHora, HORAS } from './heatmap'
import { MESES } from '@/types'
import type { Filtros } from '@/types'

type GridMap = Record<number, Record<string | number, number>>

function periodoLabel(filtros: Filtros): string {
  return filtros.mes ? `${MESES[filtros.mes]}_${filtros.anio}` : `Año_${filtros.anio}`
}

function buildTableData(
  grid: GridMap,
  columns: Array<number | string>,
  colLabels: string[],
) {
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
      HORAS.reduce(
        (s, h) => s + ((grid[h]?.[col as keyof GridMap[number]] as number) ?? 0),
        0,
      ),
    ),
  ]
  return { head, body, totals }
}

/** Carga el logo de la clínica como base64 para incrustar en el PDF */
async function loadLogoBase64(): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const url = `${base}logo.png`
    const response = await fetch(url)
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

// ─── Excel ────────────────────────────────────────────────────────────────────
export function exportToExcel(
  grid: GridMap,
  columns: Array<number | string>,
  colLabels: string[],
  filtros: Filtros,
) {
  const { head, body, totals } = buildTableData(grid, columns, colLabels)

  const wsData = [head, ...body, totals]
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = head.map((_, i) => ({ wch: i === 0 ? 14 : 6 }))

  XLSX.utils.book_append_sheet(wb, ws, 'Mapa de Calor')

  // Second sheet: column totals only
  const summaryData = [
    ['Columna', 'Total atenciones'],
    ...columns.map((col, i) => [
      colLabels[i],
      HORAS.reduce(
        (s, h) => s + ((grid[h]?.[col as keyof GridMap[number]] as number) ?? 0),
        0,
      ),
    ]),
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen')

  XLSX.writeFile(wb, `MapaCalor_${periodoLabel(filtros)}.xlsx`)
}

// ─── PDF ──────────────────────────────────────────────────────────────────────
export async function exportToPDF(
  grid: GridMap,
  columns: Array<number | string>,
  colLabels: string[],
  filtros: Filtros,
) {
  const { head, body, totals } = buildTableData(grid, columns, colLabels)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.width   // 297 mm
  const pageH = doc.internal.pageSize.height  // 210 mm
  const headerH = 22

  // ── Encabezado azul ──────────────────────────────────────────────────────────
  doc.setFillColor(30, 77, 140)
  doc.rect(0, 0, pageW, headerH, 'F')

  // Logo de la clínica (intento cargar; si falla, solo texto)
  const logoBase64 = await loadLogoBase64()
  if (logoBase64) {
    // Logo a la izquierda, fondo azul → logo blanco se ve bien
    doc.addImage(logoBase64, 'PNG', 5, 2, 38, 18)
  }

  // Textos del encabezado
  const textX = logoBase64 ? 48 : 8
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Mapa de Calor · Urgencias', textX, 10)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.text('Clínica Santa Bárbara de Alta Complejidad', textX, 16)

  // Periodo a la derecha
  const periodo = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`
  const triageLabel = filtros.triage !== 'all' ? `  ·  Triage: ${filtros.triage}` : ''
  doc.setFontSize(8)
  const periodoText = `Período: ${periodo}${triageLabel}`
  const periodoW = doc.getTextWidth(periodoText)
  doc.text(periodoText, pageW - periodoW - 5, 16)

  // ── Tabla ─────────────────────────────────────────────────────────────────────
  autoTable(doc, {
    head: [head],
    body: [...body, totals],
    startY: headerH + 2,
    styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center' },
    headStyles: {
      fillColor: [30, 77, 140],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
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

  // ── Pie de página ─────────────────────────────────────────────────────────────
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 5, pageH - 3)
  doc.text('Mapa de Calor Urgencias · Clínica Santa Bárbara', pageW / 2, pageH - 3, { align: 'center' })

  doc.save(`MapaCalor_${periodoLabel(filtros)}.pdf`)
}
