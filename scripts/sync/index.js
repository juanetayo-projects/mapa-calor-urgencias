'use strict';

/**
 * sync/index.js
 * Sincronización horaria: SQL Server (Azure) → Supabase
 *
 * SUPUESTO DE ZONA HORARIA:
 *   dateStartTriage se almacena en hora local Colombia (UTC-5).
 *   Si los datos están en UTC, cambiar COLOMBIA_OFFSET_H a 0.
 */

const sql      = require('mssql');
const { createClient } = require('@supabase/supabase-js');
const ws       = require('ws');
const fs       = require('fs');
const path     = require('path');

const COLOMBIA_OFFSET_H = -5;   // Colombia = UTC - 5h (sin horario de verano)

// ── Cálculo del rango horario ──────────────────────────────────────────────

function getPreviousHourRange(hoursBack = 1) {
  const nowUTC    = Date.now();
  const colombiaMs = nowUTC + COLOMBIA_OFFSET_H * 3_600_000;
  const co        = new Date(colombiaMs);

  // Techo de la hora actual en Colombia (usando UTC internamente)
  const endH = new Date(Date.UTC(
    co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate(),
    co.getUTCHours(), 0, 0, 0
  ));
  const startH = new Date(endH.getTime() - hoursBack * 3_600_000);

  const fmt = (d) => {
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:00:00`;
  };

  return {
    start:    fmt(startH),          // 'YYYY-MM-DD HH:00:00' (Colombia local)
    end:      fmt(endH),
    startISO: startH.toISOString(), // UTC ISO para el log en Supabase
    endISO:   endH.toISOString(),
  };
}

// ── Transformación de filas ────────────────────────────────────────────────

function toDateStr(val) {
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString().substring(0, 10);
  const s = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function toTimeStr(val) {
  if (val == null) return null;
  if (val instanceof Date) {
    const h = String(val.getUTCHours()).padStart(2, '0');
    const m = String(val.getUTCMinutes()).padStart(2, '0');
    const s = String(val.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : null;
}

function toInt(val) {
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function mapRow(row) {
  const ingreso      = row['Ingreso']   != null ? String(row['Ingreso']).trim()   : null;
  const documento    = row['Documento'] != null ? String(row['Documento']).trim() : null;
  const fechaTriage  = toDateStr(row['FechaTriage']);
  const horaTriage   = toTimeStr(row['HoraTriage']);

  // Clave única para upsert idempotente
  let syncKey = null;
  if (ingreso) {
    syncKey = `ingreso:${ingreso}`;
  } else if (documento && fechaTriage) {
    syncKey = `triage:${documento}:${fechaTriage}:${horaTriage ?? '00:00:00'}`;
  }

  return {
    sync_key:    syncKey,
    tipo_identificacion:   row['TipoIdentificacion'] || null,
    documento,
    nombre:      row['Nombre']      || null,
    edad:        toInt(row['Edad']),
    sexo:        row['Sexo']        || null,
    aseguradora: row['Aseguradora'] || null,
    contrato:    row['Contrato']    || null,
    plan:        row['Plan']        || null,
    fecha_triage: fechaTriage,
    hora_triage:  horaTriage,
    profesional_inicia_triage: row['ProfesionalIniciaTriage'] || null,
    profesional_clasifica:     row['ProfesionalClasifica']    || null,
    ubicacion_triage:          row['UbicacionTriage']         || null,
    paciente_no_responde:      row['PacienteNoResponde'] === 'X',
    clasificacion_triage:      row['ClasificacionTriage']     || null,
    fecha_clasificacion:       toDateStr(row['FechaClasificacion']),
    hora_clasificacion:        toTimeStr(row['HoraClasificacion']),
    fecha_egreso:              toDateStr(row['FechaEgreso']),
    hora_egreso:               toTimeStr(row['HoraEgreso']),
    estancia_total_urgencias:            toInt(row['EstanciaTotalUrgencias']),
    tiempo_clasificacion_minutos:        toInt(row['TiempoClasificacion(minutos)']),
    destino_clasificacion:               row['DestinoClasificacion']  || null,
    ingreso,
    fecha_ingreso:   toDateStr(row['FechaIngreso']),
    hora_ingreso:    toTimeStr(row['HoraIngreso']),
    ubicacion_origen:                    row['UbicacionOrigen']       || null,
    tiempo_clasificacion_ingreso_minutos: toInt(row['TiempoClasificacionIngreso(minutos)']),
    profesional_consulta_inicial:        row['ProfesionalConsultaInicialUrgencias'] || null,
    fecha_consulta_inicial:              toDateStr(row['FechaConsultaInicialUrgencias']),
    hora_consulta_inicial:               toTimeStr(row['HoraInicioConsultaInicialUrgencias']),
    tiempo_espera_consulta_inicial_minutos: toInt(row['TiempoEsperaConsultaInicial(minutos) - DesdeLaClasificacion']),
    destino_consulta_inicial:            row['DestinoConsultaInicialUrgencias']      || null,
    profesional_primera_evolucion:       row['ProfesionalPrimeraEvolucionUrgencias'] || null,
    fecha_primera_evolucion:             toDateStr(row['FechaPrimeraEvolucionUrgencias']),
    tiempo_revaloracion_horas:           toInt(row['TiempoRevaloracion(horas)']),
    destino_primera_evolucion:           row['DestinoPrimeraEvolucionUrgencias']     || null,
    tiempo_estancia_urgencias_minutos:        toInt(row['TiempoEstanciaEnUrgencias(minutos)']),
    tiempo_urgencias_internacion_horas:       toInt(row['TiempoEnUrgenciasParaInternacion(horas)']),
    diagnostico_principal:               row['DiagnosticoPrincipal'] || null,
    // hora_numerica y nombre_dia son columnas reales
    hora_numerica: toInt(row['hora']),
    nombre_dia:    row['Ndia'] || null,
    // dia_numero, mes_numero, anio_numero, semana_del_mes son GENERATED ALWAYS
    // → NO incluir: PostgreSQL los calcula solo desde fecha_triage
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

// ── Auto-recuperación de horas perdidas ───────────────────────────────────
//
// Si HOURS_BACK no está definido manualmente, consulta sync_logs para saber
// cuánto tiempo pasó desde el último sync exitoso y recuperar el gap completo.
// Esto soluciona la falta de confiabilidad del cron de GitHub Actions.

async function getAutoHoursBack(supabase, defaultHours = 1) {
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('sync_to')
      .eq('status', 'success')
      .order('executed_at', { ascending: false })
      .limit(1);

    if (error || !data?.length || !data[0].sync_to) {
      console.log(`[sync] Sin sync previo exitoso encontrado, usando ${defaultHours}h`);
      return defaultHours;
    }

    // sync_to almacena la hora Colombia como si fuera UTC (ver COLOMBIA_OFFSET_H)
    const lastSyncToMs  = new Date(data[0].sync_to).getTime();
    const nowColombiaMs = Date.now() + COLOMBIA_OFFSET_H * 3_600_000;
    const hoursDiff     = Math.ceil((nowColombiaMs - lastSyncToMs) / 3_600_000);
    const hoursBack     = Math.min(Math.max(hoursDiff, 1), 24); // entre 1 y 24

    console.log(`[sync] Auto-recuperación: último sync fue hace ${hoursDiff}h → hoursBack=${hoursBack}`);
    return hoursBack;

  } catch (err) {
    console.warn('[sync] No se pudo leer sync_logs:', err.message);
    return defaultHours;
  }
}

async function main() {
  const t0          = Date.now();
  const triggeredBy = process.env.TRIGGERED_BY || 'cron';

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws },
    }
  );

  // Determinar hoursBack: manual (HOURS_BACK env) o auto-calculado desde logs
  const hoursBack = process.env.HOURS_BACK
    ? parseInt(process.env.HOURS_BACK, 10)
    : await getAutoHoursBack(supabase);

  const range = getPreviousHourRange(hoursBack);
  console.log(`[sync] Rango Colombia local: ${range.start}  →  ${range.end}`);
  console.log(`[sync] hoursBack=${hoursBack} | Disparado por: ${triggeredBy}`);

  let recordsFetched  = 0;
  let recordsUpserted = 0;
  let errorMessage    = null;
  let status          = 'success';
  let pool;

  try {
    // ── 1. Conectar a Azure SQL ──────────────────────────────────
    pool = await sql.connect({
      server:   process.env.GOMEDISYS_HOST,
      port:     parseInt(process.env.GOMEDISYS_PORT || '1433', 10),
      database: process.env.GOMEDISYS_DATABASE,
      user:     process.env.GOMEDISYS_USERNAME,
      password: process.env.GOMEDISYS_PASSWORD,
      options: {
        encrypt:                true,    // Obligatorio en Azure SQL
        trustServerCertificate: false,
        connectTimeout:         30_000,
        requestTimeout:        120_000,
      },
    });
    console.log('[sync] Conexión a SQL Server establecida');

    // ── 2. Ejecutar query ────────────────────────────────────────
    const querySQL = fs.readFileSync(path.join(__dirname, 'query.sql'), 'utf8');
    const req = pool.request();
    req.input('StartDate', sql.NVarChar(30), range.start);
    req.input('EndDate',   sql.NVarChar(30), range.end);

    const result = await req.query(querySQL);
    recordsFetched = result.recordset.length;
    console.log(`[sync] Registros obtenidos: ${recordsFetched}`);

    // ── 3. Transformar y hacer upsert ────────────────────────────
    if (recordsFetched > 0) {
      const rows = result.recordset
        .map(mapRow)
        .filter(r => r.sync_key !== null);  // solo filas con clave única

      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase
          .from('atenciones')
          .upsert(batch, { onConflict: 'sync_key' });

        if (error) throw new Error(`Supabase upsert: ${error.message}`);
        recordsUpserted += batch.length;
        console.log(`[sync] Upserted ${recordsUpserted}/${rows.length}`);
      }
    }

  } catch (err) {
    console.error('[sync] ERROR:', err.message);
    errorMessage = err.message;
    status = recordsUpserted > 0 ? 'partial' : 'error';

  } finally {
    if (pool) await pool.close().catch(() => {});
  }

  // ── 4. Registrar log en Supabase ─────────────────────────────
  const duration = Date.now() - t0;
  const { error: logErr } = await supabase.from('sync_logs').insert({
    status,
    records_fetched:  recordsFetched,
    records_upserted: recordsUpserted,
    duration_ms:      duration,
    error_message:    errorMessage,
    sync_from:        range.startISO,
    sync_to:          range.endISO,
    triggered_by:     triggeredBy,
  });
  if (logErr) console.error('[sync] No se pudo guardar el log:', logErr.message);

  console.log(
    `[sync] Finalizado: ${status} | obtenidos=${recordsFetched} actualizados=${recordsUpserted} duración=${duration}ms`
  );

  if (status === 'error') process.exit(1);
}

main().catch(err => {
  console.error('[sync] Error fatal:', err);
  process.exit(1);
});
