import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { sendEmail, buildReportHtml } from '@/lib/resend'
import { semanalToExcelBase64, semanalToPDFBase64 } from '@/utils/exportData'
import Header from '@/components/layout/Header'
import { useStore } from '@/store/useStore'
import { useStats, useHeatmapSemanal } from '@/hooks/useAtenciones'
import { formatHora, calcProfesionales } from '@/utils/heatmap'
import { MESES } from '@/types'
import { Mail, Send, Clock, CheckCircle2, XCircle, Loader2, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ReporteEmail } from '@/types'

export default function ReportsPage() {
  const { filtros, profile } = useStore()
  const { data: stats } = useStats(filtros)
  const { data: semanalData } = useHeatmapSemanal(filtros)

  const [recipients, setRecipients] = useState<string[]>([''])
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')

  const periodoLabel = filtros.mes
    ? `${MESES[filtros.mes]} ${filtros.anio}`
    : `Año ${filtros.anio}`

  // History
  const { data: history = [], refetch } = useQuery({
    queryKey: ['reportes-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reportes_email')
        .select('*')
        .order('fecha_envio', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as ReporteEmail[]
    },
  })

  function addRecipient() {
    setRecipients((r) => [...r, ''])
  }
  function removeRecipient(i: number) {
    setRecipients((r) => r.filter((_, idx) => idx !== i))
  }
  function updateRecipient(i: number, val: string) {
    setRecipients((r) => r.map((v, idx) => (idx === i ? val : v)))
  }

  async function handleSend() {
    const validRecipients = recipients.filter((r) => r.includes('@'))
    if (validRecipients.length === 0) {
      toast.error('Ingrese al menos un correo válido')
      return
    }

    setSending(true)

    const emailSubject = subject || `Reporte Mapa de Calor Urgencias · ${periodoLabel}`

    // Generar adjuntos Excel y PDF
    const semanal = semanalData ?? []
    const nombreArchivo = `MapaCalor_${filtros.mes ? periodoLabel.replace(' ', '_') : 'Año_' + filtros.anio}`

    const excelBase64 = semanalToExcelBase64(semanal, filtros)
    const pdfBase64   = await semanalToPDFBase64(semanal, filtros)

    const html = buildReportHtml({
      titulo: `Reporte de Urgencias · ${periodoLabel}`,
      periodo: periodoLabel,
      totalAtenciones: stats?.total_atenciones ?? 0,
      picoHora: stats?.pico_hora ?? 0,
      promedioDia: stats?.promedio_dia ?? 0,
      hasAttachments: true,
    })

    const result = await sendEmail({
      to: validRecipients,
      subject: emailSubject,
      html,
      attachments: [
        { filename: `${nombreArchivo}.xlsx`, content: excelBase64 },
        { filename: `${nombreArchivo}.pdf`,  content: pdfBase64  },
      ],
    })

    // Log to DB
    await supabase.from('reportes_email').insert({
      tipo: 'manual',
      destinatarios: validRecipients,
      asunto: emailSubject,
      fecha_envio: new Date().toISOString(),
      estado: result.success ? 'sent' : 'failed',
      error_mensaje: result.error,
      enviado_por: profile?.id,
    })

    setSending(false)
    refetch()

    if (result.success) {
      toast.success(`Reporte enviado a ${validRecipients.length} destinatario(s)`)
    } else {
      toast.error(`Error al enviar: ${result.error}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Reportes" subtitle="Envío de reportes por correo electrónico" />

      <div className="flex-1 p-5 space-y-5 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Compose */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-5 h-5 text-clinic-600" />
              <h2 className="text-base font-semibold text-slate-800">Nuevo reporte</h2>
            </div>

            <div className="space-y-4">
              {/* Period info */}
              <div className="bg-clinic-50 border border-clinic-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-clinic-700 mb-1">Período del reporte</p>
                <p className="text-sm text-clinic-800">{periodoLabel}</p>
                {filtros.triage.length > 0 && (
                  <p className="text-xs text-clinic-600 mt-1">Triage: {filtros.triage.join(', ')}</p>
                )}
                {stats && (
                  <div className="flex gap-4 mt-2 pt-2 border-t border-clinic-200">
                    <div>
                      <p className="text-xs text-clinic-500">Total</p>
                      <p className="text-sm font-bold text-clinic-800">
                        {stats.total_atenciones.toLocaleString('es-CO')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-clinic-500">Pico</p>
                      <p className="text-sm font-bold text-clinic-800">{formatHora(stats.pico_hora)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-clinic-500">Prom/día</p>
                      <p className="text-sm font-bold text-clinic-800">{stats.promedio_dia.toFixed(0)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={`Reporte Mapa de Calor Urgencias · ${periodoLabel}`}
                  className="filter-select w-full text-sm"
                />
              </div>

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">Destinatarios</label>
                  <button onClick={addRecipient} className="flex items-center gap-1 text-xs text-clinic-600 hover:text-clinic-700">
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
                <div className="space-y-2">
                  {recipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={r}
                        onChange={(e) => updateRecipient(i, e.target.value)}
                        placeholder="correo@clinica.com"
                        className="filter-select flex-1 text-sm"
                      />
                      {recipients.length > 1 && (
                        <button onClick={() => removeRecipient(i)} className="text-slate-400 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar reporte</>
                )}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-clinic-600" />
              <h2 className="text-base font-semibold text-slate-800">Historial de envíos</h2>
            </div>

            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                <Mail className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No hay reportes enviados aún</p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-96">
                {history.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                    {r.estado === 'sent' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.asunto}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(r.fecha_envio).toLocaleString('es-CO')} · {r.destinatarios.length} destinatario(s)
                      </p>
                      {r.error_mensaje && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{r.error_mensaje}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
