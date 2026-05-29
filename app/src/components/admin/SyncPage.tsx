import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import { useStore } from '@/store/useStore'
import {
  Shield, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, ExternalLink, Loader2, Activity,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { SyncLog } from '@/types'

const GITHUB_ACTIONS_URL =
  'https://github.com/juanetayo-projects/mapa-calor-urgencias/actions/workflows/sync.yml'

// ── Helpers ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SyncLog['status'] }) {
  if (status === 'success')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Exitoso
      </span>
    )
  if (status === 'error')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Error
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" /> Parcial
    </span>
  )
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'medium',
  })
}

function fmtTimeRange(from: string | null, to: string | null) {
  if (!from || !to) return '—'
  // sync_from/to almacenan hora Colombia como si fuera UTC → leer componentes UTC directamente
  const fmtUTC = (iso: string) => {
    const d = new Date(iso)
    const h = String(d.getUTCHours()).padStart(2, '0')
    const m = String(d.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
  const d = new Date(from)
  const day   = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}  ${fmtUTC(from)} – ${fmtUTC(to)}`
}

// ── Componente principal ──────────────────────────────────────────────────

export default function SyncPage() {
  const { profile } = useStore()

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sync_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as SyncLog[]
    },
    refetchInterval: 60_000,
  })

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col h-full">
        <Header title="Sincronización" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Acceso restringido</p>
            <p className="text-slate-400 text-sm">Se requiere rol de administrador</p>
          </div>
        </div>
      </div>
    )
  }

  const lastLog      = logs[0]
  const successCount = logs.filter(l => l.status === 'success').length
  const errorCount   = logs.filter(l => l.status !== 'success').length
  const lastOk       = logs.find(l => l.status === 'success')
  const avgDuration  = logs.length > 0
    ? Math.round(logs.reduce((s, l) => s + (l.duration_ms ?? 0), 0) / logs.length)
    : null

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Sincronización Automática"
        subtitle="SQL Server (Azure) → Supabase · cada hora a los :05"
      />

      <div className="flex-1 p-5 space-y-5 overflow-auto">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Última ejecución</p>
            <p className="text-sm font-semibold text-slate-800">
              {lastLog ? fmtDatetime(lastLog.executed_at) : '—'}
            </p>
            {lastLog && <div className="mt-1"><StatusBadge status={lastLog.status} /></div>}
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Última exitosa</p>
            <p className="text-sm font-semibold text-slate-800">
              {lastOk ? fmtDatetime(lastOk.executed_at) : '—'}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Exitosas / Errores</p>
            <p className="text-sm font-semibold">
              <span className="text-green-600">{successCount}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className={errorCount > 0 ? 'text-red-600' : 'text-slate-400'}>{errorCount}</span>
              <span className="text-xs text-slate-400 ml-1">(últ. {logs.length})</span>
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500 mb-1">Duración promedio</p>
            <p className="text-sm font-semibold text-slate-800">{fmtDuration(avgDuration)}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            Actualizar tabla
          </button>
          <a
            href={GITHUB_ACTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center gap-1.5 text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Sincronizar ahora (GitHub Actions)
          </a>
          <p className="text-xs text-slate-400 ml-1">
            La tabla se refresca automáticamente cada 60 seg.
          </p>
        </div>

        {/* Tabla de logs */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-clinic-600" />
            <h2 className="text-base font-semibold text-slate-800">Historial de ejecuciones</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Sin ejecuciones registradas aún</p>
              <p className="text-xs mt-1">
                La primera sincronización automática ocurrirá a los :05 de la próxima hora
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    {['Ejecutado', 'Estado', 'Obtenidos', 'Actualizados', 'Duración', 'Periodo', 'Origen', 'Error'].map(h => (
                      <th key={h} className="pb-2 pr-4 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className={clsx(
                        'border-b border-slate-100 hover:bg-slate-50',
                        log.status === 'error'   && 'bg-red-50/50',
                        log.status === 'partial' && 'bg-yellow-50/40',
                      )}
                    >
                      <td className="py-2.5 pr-4 text-slate-700 whitespace-nowrap text-xs">
                        {fmtDatetime(log.executed_at)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-600 text-xs">
                        {log.records_fetched.toLocaleString('es-CO')}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-600 text-xs">
                        {log.records_upserted.toLocaleString('es-CO')}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-slate-500 whitespace-nowrap text-xs">
                        {fmtDuration(log.duration_ms)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap text-xs">
                        {fmtTimeRange(log.sync_from, log.sync_to)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded',
                          log.triggered_by === 'cron'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-blue-100 text-blue-700 font-medium',
                        )}>
                          {log.triggered_by}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 max-w-xs">
                        {log.error_message ? (
                          <span
                            className="text-xs text-red-600 truncate block max-w-[220px]"
                            title={log.error_message}
                          >
                            {log.error_message}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
