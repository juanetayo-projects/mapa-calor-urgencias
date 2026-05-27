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

  // Bold totals row
  const totalRowIdx = wsData.length - 1
  columns.forEach((_, ci) => {
    const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx, c: ci + 1 })
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } }
  })

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
export function exportToPDF(
  grid: GridMap,
  columns: Array<number | string>,
  colLabels: string[],
  filtros: Filtros,
) {
  const { head, body, totals } = buildTableData(grid, columns, colLabels)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header
  doc.setFillColor(30, 77, 140)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.text('Mapa de Calor · Urgencias · Clínica Santa Bárbara', 10, 11)
  doc.setFontSize(9)
  doc.text(
    `Período: ${filtros.mes ? `${MESES[filtros.mes]} ${filtros.anio}` : `Año ${filtros.anio}`}${filtros.triage !== 'all' ? '  ·  Triage: ' + filtros.triage : ''}`,
    10,
    16,
  )

  // Table
  autoTable(doc, {
    head: [head],
    body: [...body, totals],
    startY: 21,
    styles: { fontSize: 6.5, cellPadding: 1.2, halign: 'center' },
    headStyles: { fillColor: [30, 77, 140], textColor: 255, fontStyle: 'bold', fontSize: 7 },
    columnStyles: { 0: { halign: 'left', cellWidth: 18 } },
    didParseCell: (data) => {
      // Highlight totals row
      if (data.row.index === body.length) {
        data.cell.styles.fillColor = [240, 244, 251]
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = [30, 77, 140]
      }
    },
    margin: { left: 5, right: 5 },
  })

  // Footer
  const pageH = doc.internal.pageSize.height
  doc.setTextColor(148, 163, 184)
  doc.setFontSize(7)
  doc.text(
    `Generado: ${new Date().toLocaleString('es-CO')}`,
    5,
    pageH - 4,
  )

  doc.save(`MapaCalor_${periodoLabel(filtros)}.pdf`)
}
