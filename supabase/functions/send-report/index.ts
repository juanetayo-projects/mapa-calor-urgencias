// Supabase Edge Function: send-report
// Deploy: Supabase Dashboard → Edge Functions → send-report → reemplazar código
// Secret:  Supabase Dashboard → Edge Functions → Manage secrets → RESEND_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY no configurada en los secrets de la Edge Function')
    }

    const { to, subject, html, replyTo, attachments } = await req.json()

    const body: Record<string, unknown> = {
      from: 'Mapa de Calor Urgencias <noreply@resend.dev>',
      to,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }

    // Adjuntos opcionales (base64)
    if (attachments && attachments.length > 0) {
      body.attachments = attachments.map((a: { filename: string; content: string }) => ({
        filename: a.filename,
        content:  a.content,
      }))
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`)

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
