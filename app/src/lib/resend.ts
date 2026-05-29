import { supabase } from './supabase'

export interface EmailAttachment {
  filename: string
  content: string // base64
}

export interface EmailPayload {
  to: string[]
  subject: string
  html: string
  replyTo?: string
  attachments?: EmailAttachment[]
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('send-report', {
      body: payload,
    })

    if (error) {
      const msg = error.message ?? String(error)
      if (msg.includes('Failed to send') || msg.includes('fetch') || msg.includes('404')) {
        return {
          success: false,
          error: 'Edge Function "send-report" no disponible. Verificar en Supabase → Edge Functions.',
        }
      }
      throw error
    }

    if (data && !data.success) {
      return { success: false, error: data.error ?? 'Error desconocido' }
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { success: false, error: msg }
  }
}

const LOGO_URL = 'https://juanetayo-projects.github.io/mapa-calor-urgencias/logo-white.png'

export function buildReportHtml(params: {
  titulo: string
  periodo: string
  totalAtenciones: number
  picoHora: number
  promedioDia: number
  clinicaNombre?: string
  hasAttachments?: boolean
}): string {
  const clinica = params.clinicaNombre ?? 'Clínica Santa Bárbara de Alta Complejidad'
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: Arial, sans-serif; color: #1e293b; background: #f1f5f9; margin: 0; padding: 0; }
    .wrap { max-width: 600px; margin: 24px auto; }
    .header { background: #1e4d8c; color: white; padding: 20px 28px; border-radius: 12px 12px 0 0; }
    .logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .logo-row img { height: 44px; width: auto; }
    .logo-text { font-size: 11px; opacity: 0.8; letter-spacing: 0.4px; text-transform: uppercase; }
    .logo-sys  { font-size: 13px; font-weight: 600; margin-top: 2px; }
    .header h1 { margin: 0 0 4px; font-size: 20px; }
    .header p  { margin: 0; font-size: 13px; opacity: 0.85; }
    .body  { background: white; padding: 24px 28px; border: 1px solid #e2e8f0; }
    .kpis  { display: flex; gap: 12px; margin: 0 0 20px; }
    .kpi   { flex: 1; background: #f0f4fb; border-radius: 10px; padding: 14px; text-align: center; }
    .kpi .val { font-size: 26px; font-weight: 700; color: #1e4d8c; }
    .kpi .lbl { font-size: 11px; color: #64748b; margin-top: 3px; }
    .attach-box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;
                  padding: 12px 16px; margin: 0; display: flex; align-items: center; gap: 10px; }
    .attach-icon { font-size: 24px; }
    .attach-text { font-size: 13px; color: #0369a1; }
    .attach-text strong { display: block; font-size: 14px; }
    .footer { background: #f8fafc; padding: 14px 28px; border: 1px solid #e2e8f0; border-top: 0;
              border-radius: 0 0 12px 12px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo-row">
        <img src="${LOGO_URL}" alt="${clinica}" />
        <div>
          <div class="logo-text">${clinica}</div>
          <div class="logo-sys">Sistema de Mapa de Calor · Urgencias</div>
        </div>
      </div>
      <h1>${params.titulo}</h1>
      <p>Período: ${params.periodo}</p>
    </div>
    <div class="body">
      <div class="kpis">
        <div class="kpi">
          <div class="val">${params.totalAtenciones.toLocaleString('es-CO')}</div>
          <div class="lbl">Total Atenciones</div>
        </div>
        <div class="kpi">
          <div class="val">${params.picoHora}:00</div>
          <div class="lbl">Hora Pico</div>
        </div>
        <div class="kpi">
          <div class="val">${params.promedioDia.toFixed(0)}</div>
          <div class="lbl">Promedio / Día</div>
        </div>
      </div>
      ${params.hasAttachments ? `
      <div class="attach-box">
        <div class="attach-icon">📎</div>
        <div class="attach-text">
          <strong>Archivos adjuntos incluidos</strong>
          Se adjuntan el mapa de calor completo (24 horas × días de la semana) en formato Excel y PDF.
        </div>
      </div>` : ''}
    </div>
    <div class="footer">
      Generado automáticamente &bull; Mapa de Calor Urgencias &bull; ${new Date().toLocaleDateString('es-CO')}
    </div>
  </div>
</body>
</html>`
}
