export interface EmailPayload {
  to: string[]
  subject: string
  html: string
  replyTo?: string
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'Variable VITE_RESEND_API_KEY no configurada. Añádela al archivo .env.local con tu clave de Resend (resend.com).',
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Mapa de Calor <noreply@resend.dev>',
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as { message?: string }).message ?? `HTTP ${response.status}`)
    }

    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { success: false, error: msg }
  }
}

export function buildReportHtml(params: {
  titulo: string
  periodo: string
  totalAtenciones: number
  picoHora: number
  promedioDia: number
  tableRows: string
  clinicaNombre?: string
}): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 0 auto; padding: 32px 16px; }
    .header { background: #1e4d8c; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0; }
    .header h1 { margin: 8px 0 0; font-size: 20px; }
    .content { background: white; padding: 24px 32px; border: 1px solid #e2e8f0; }
    .stats { display: flex; gap: 16px; margin: 16px 0; }
    .stat { flex: 1; background: #f0f4fb; padding: 16px; border-radius: 8px; text-align: center; }
    .stat .val { font-size: 28px; font-weight: 700; color: #1e4d8c; }
    .stat .lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th { background: #1e4d8c; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 7px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { background: #f8fafc; padding: 16px 32px; border: 1px solid #e2e8f0; border-top: 0; border-radius: 0 0 12px 12px; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${params.titulo}</h1>
      <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">${params.clinicaNombre ?? 'Clínica Santa Bárbara'} &mdash; ${params.periodo}</p>
    </div>
    <div class="content">
      <div class="stats">
        <div class="stat">
          <div class="val">${params.totalAtenciones.toLocaleString('es-CO')}</div>
          <div class="lbl">Total Atenciones</div>
        </div>
        <div class="stat">
          <div class="val">${params.picoHora}:00</div>
          <div class="lbl">Hora Pico</div>
        </div>
        <div class="stat">
          <div class="val">${params.promedioDia.toFixed(0)}</div>
          <div class="lbl">Promedio / Día</div>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Hora</th><th>Atenciones</th><th>Profesionales</th></tr>
        </thead>
        <tbody>${params.tableRows}</tbody>
      </table>
    </div>
    <div class="footer">
      Generado automáticamente &bull; Mapa de Calor Urgencias &bull; ${new Date().toLocaleDateString('es-CO')}
    </div>
  </div>
</body>
</html>`
}
