# Prompt de Contexto — Mapa de Calor Urgencias

> Usa este documento como contexto inicial en una nueva sesión de Claude para
> continuar el desarrollo del proyecto sin perder información.

---

## Descripción del proyecto

Aplicación web SaaS para el análisis de demanda de atención en urgencias de la
**Clínica Santa Bárbara de Alta Complejidad** (Villavicencio, Colombia).
Desarrollado por el **Ing. Juan Carlos Etayo Ruiz**.

**URL producción:** https://juanetayo-projects.github.io/mapa-calor-urgencias/  
**Repositorio:** https://github.com/juanetayo-projects/mapa-calor-urgencias  
**Ruta local:** `C:\Users\Juan Carlos Etayo\mapadecalorurg\`

---

## Stack tecnológico

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Estado:** Zustand (persistencia localStorage) + TanStack React Query (caché)
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Sync:** Node.js 22 + mssql → GitHub Actions disparado por cron-job.org
- **Deploy:** GitHub Pages (frontend) + Supabase (backend)
- **Email:** Resend vía Supabase Edge Function

---

## Estructura de componentes del dashboard

```
DashboardPage.tsx          ← Orquesta pestañas + barra análisis mensual
├── FiltersPanel.tsx        ← Multi-select: triage, destino, ubicación
├── StatsCards.tsx          ← 6 KPIs: total, pico, promedio/día, min/at, prom/hora, días
├── HeatMap.tsx             ← Pestaña 1: mapa calor mensual/semanal/promedio
├── WeeklyView.tsx          ← Pestaña 2: gráficos + tabla hora×díasemana
├── ProfesionalesView.tsx   ← Pestaña 3: profesionales requeridos
├── AnalyticsView.tsx       ← Pestaña 4: pivot promedio estilo Odoo (datos prop)
└── MensualDetailView.tsx   ← Pestaña 5: detalle día 1-31 (datos prop)
```

**Importante:** `AnalyticsView` y `MensualDetailView` reciben datos como **props**
desde `DashboardPage` (no llaman hooks propios) para evitar race conditions con
React Query.

---

## Hooks de datos (`app/src/hooks/useAtenciones.ts`)

| Hook | RPC Supabase | Descripción |
|---|---|---|
| `useHeatmapMensual` | `get_heatmap_data` | hora × día calendario |
| `useHeatmapSemanal` | `get_heatmap_semanal` | hora × día semana (prom+total+occ) |
| `useHeatmapStatsDetail` | `get_heatmap_stats_detail` | hora × día semana + min/max |
| `useStats` | `get_stats` | KPIs globales del período |
| `useAniosDisponibles` | `get_available_years` | años con datos |
| `useTriageDisponibles` | `get_clasificacion_disponibles` | valores únicos triage |
| `useDestinoDisponibles` | `get_destino_disponibles` | valores únicos destino |
| `useUbicacionDisponibles` | `get_ubicacion_disponibles` | valores únicos ubicación |

---

## Tipos clave (`app/src/types/index.ts`)

```typescript
interface Filtros {
  anio: number
  mes: number | null
  diasSemana: NombreDia[]
  semanaDelMes: number | null
  triage: string[]               // [] = todos (era string 'all' antes)
  destinoClasificacion: string[] // [] = todos
  ubicacionTriage: string[]      // [] = todas
  minutos: number                // min/atención para cálculo profesionales
  vista: 'mensual' | 'semanal' | 'promedio'
}

interface HeatmapCell {
  hora: number
  key: number | string    // día calendario o nombre_dia
  nombre_dia: string
  total: number
  semana_del_mes?: number
}

interface HeatmapStatsDetail {
  hora: number; nombre_dia: string
  total: number; promedio: number; occurrences: number
  minimo: number; maximo: number
}

interface SyncLog {
  id: string; executed_at: string
  status: 'success' | 'error' | 'partial'
  records_fetched: number; records_upserted: number
  duration_ms: number | null; error_message: string | null
  sync_from: string | null; sync_to: string | null
  triggered_by: string
}
```

---

## Zustand Store (`app/src/store/useStore.ts`)

Persiste en localStorage bajo la clave `mcu-store`. El `merge()` migra los
valores string antiguos (`'all'`) a arrays vacíos `[]` para evitar crasheos con
`.join()` en navegadores con caché anterior.

---

## Calculos importantes (`app/src/utils/heatmap.ts`)

```typescript
// Profesionales con 1 decimal (no Math.ceil)
function calcProfesionales(atenciones: number, minutos: number): number {
  if (atenciones === 0) return 0
  return Math.round((atenciones / (60 / minutos)) * 10) / 10
}
```

---

## Sincronización automática (`scripts/sync/index.js`)

**Zona horaria:** Colombia = UTC−5 (sin DST). El script calcula la hora Colombia
usando `Date.now() + COLOMBIA_OFFSET_H * 3_600_000` con métodos UTC para evitar
confusión con la TZ del sistema operativo.

**sync_from / sync_to:** Se almacenan como ISO UTC en `sync_logs` pero representan
hora Colombia (el script usa Date.UTC con valores Colombia). Al mostrar en la app,
se leen los componentes UTC directamente para obtener la hora Colombia correcta.

**Auto-recuperación:**
```javascript
async function getAutoHoursBack(supabase, defaultHours = 1) {
  // Consulta sync_logs para el último éxito
  // Calcula horas desde entonces (máx 24h en modo auto)
  // HOURS_BACK env var tiene prioridad sobre auto-cálculo
}
```

**Formato de sync_key:**
- Con número de ingreso: `ingreso:{numero}`
- Sin ingreso: `triage:{documento}:{fecha_triage}:{hora_triage}`

---

## Migraciones Supabase (ejecutar en orden)

| N° | Archivo | Estado |
|---|---|---|
| 001 | initial_schema.sql | ✅ Ejecutado |
| 002 | import_helper.sql | ✅ |
| 003 | import_features.sql | ✅ |
| 004 | admin_functions.sql | ✅ |
| 005 | new_filters.sql | ✅ |
| 005b | fix_overloads.sql | ✅ |
| 006 | fix_admin_create_user.sql | ✅ |
| 007 | sync_system.sql | ✅ |
| 007b | sync_backfill_fix.sql | Referencia |
| 008 | multiselect_filters.sql | ✅ |
| 009 | heatmap_stats_detail.sql | ✅ |

**GENERATED ALWAYS columns** en `atenciones` (no incluir en INSERT/UPSERT):
`dia_numero`, `mes_numero`, `anio_numero`, `semana_del_mes`

**UNIQUE INDEX** en `atenciones.sync_key`: es un índice completo (no parcial) para
que `ON CONFLICT (sync_key)` funcione en PostgreSQL (NULL ≠ NULL, permite múltiples NULL).

---

## Infraestructura de sincronización

```
cron-job.org (cada hora :05)
    ↓ POST workflow_dispatch
GitHub Actions (sync.yml)
    ↓ node index.js
Azure SQL Server (Gomedisys réplica)
    ↓ SELECT con @StartDate/@EndDate
Supabase PostgreSQL (atenciones)
    ↓ UPSERT ON CONFLICT sync_key
sync_logs ← registro de cada ejecución
```

**cron-job.org** es más confiable que el `schedule` nativo de GitHub Actions
(que puede saltarse horas completas sin notificación).

---

## Columnas críticas de la tabla `atenciones`

| Columna BD | Campo del script |
|---|---|
| `hora_numerica` | `row['hora']` → `hora_numerica` |
| `nombre_dia` | columna real CHAR(3) |
| `tiempo_urgencias_internacion_horas` | `row['TiempoEnUrgenciasParaInternacion(horas)']` |
| `sync_key` | clave única para upsert idempotente |

---

## Características de UI importantes

1. **Multi-select filtros:** Clasificación/Destino/Ubicación usan dropdown con
   checkboxes. Los RPCs reciben `text[]` (migration 008).

2. **Análisis mensual por hora:** barra entre tabs y contenido mostrando
   Mín/Máx/Prom/Total calculado desde `mensualData` en DashboardPage.

3. **Picos resaltados:** celdas con ≥85% del valor máximo tienen ring rojo
   y fondo rojo suave en WeeklyView y ProfesionalesView.

4. **Footer:** `Layout.tsx` tiene `<footer>` con "Desarrollado por: Ing. Juan Carlos Etayo Ruiz"
   en color slate-300 al fondo de cada página.

5. **Tooltip MensualDetailView:** usa `flipUp`/`flipLeft` para voltear si la
   celda está cerca del borde de la pantalla. Muestra contexto de toda la hora
   en el mes (min/max/prom calculados desde mensualData).

6. **AnalyticsView datos:** recibe `semanalData` como prop desde DashboardPage
   (no llama useHeatmapSemanal internamente) para garantizar que los datos
   estén disponibles en el primer render.

---

## Material de capacitación (NotebookLM)

- **Notebook:** https://notebooklm.google.com/notebook/ea307fc2-2c1e-4cbd-a92f-1c10af16ded5
- **Slide deck PDF:** generado (enfocado en Atención al Paciente, sin "Gestión RRHH")
- **Audio Overview:** "El mapa de calor que predice urgencias" (podcast en español)

---

## Pendientes / Mejoras futuras

1. **Backfill sync_key en registros históricos:** registros cargados antes de
   la migration 007 tienen `sync_key = NULL`. Si se reimportan, crearán duplicados.
   Solución: ejecutar `007b_sync_backfill_fix.sql`.

2. **Subdomain DNS:** el admin debe configurar CNAME (no URL masking) para
   `mcurgencias.cacsb.net` → `juanetayo-projects.github.io`. Ver
   `docs/configuracion-subdominio-admin.txt`.

3. **Reportes email:** la Edge Function de Resend está deployada pero requiere
   configurar los destinatarios en el módulo Admin → Configuración.

4. **get_heatmap_stats_detail (migration 009):** función creada pero PostgREST
   puede tardar en propagarla al esquema. Si la Vista Analítica no muestra
   min/max del RPC, los datos se calculan client-side desde mensualData.

---

## Seguridad — reglas estrictas

- **NUNCA** commitar: `.env`, `fuente/Mapa.xlsx`, `images/`, contraseñas
- **NUNCA** exponer `SUPABASE_SERVICE_ROLE_KEY` al frontend
- **NUNCA** incluir columnas GENERATED ALWAYS en INSERT/UPSERT de Supabase
- El token de cron-job.org debe ser Classic (`ghp_...`) con scope solo `workflow`
