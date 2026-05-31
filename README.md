# Mapa de Calor Urgencias · Clínica Santa Bárbara

Sistema web de análisis visual para el servicio de urgencias. Visualiza la distribución de atenciones por hora y día, calcula profesionales requeridos, aplica filtros avanzados y sincroniza automáticamente desde SQL Server Azure (Gomedisys) cada hora.

**Desarrollado por:** Ing. Juan Carlos Etayo Ruiz  
**URL producción:** https://juanetayo-projects.github.io/mapa-calor-urgencias/  
**Repositorio:** https://github.com/juanetayo-projects/mapa-calor-urgencias

---

## Stack tecnológico

| Capa        | Tecnología                                                  |
|-------------|-------------------------------------------------------------|
| Frontend    | React 18 + TypeScript + Vite + Tailwind CSS                 |
| Estado      | Zustand (persistencia) + React Query (caché/fetching)       |
| Backend     | Supabase (PostgreSQL + Auth + RLS + Edge Functions)         |
| Sync        | Node.js 22 + mssql · GitHub Actions + cron-job.org          |
| Email       | Resend (Edge Function)                                      |
| Deploy      | GitHub Pages (frontend) + Supabase (backend)                |

---

## Estructura del proyecto

```
mapadecalorurg/
├── app/                              # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/                 # Login, ProtectedRoute
│   │   │   ├── layout/               # Sidebar, Header, Layout (con footer créditos)
│   │   │   ├── dashboard/
│   │   │   │   ├── DashboardPage.tsx # Tabs + análisis mensual por hora
│   │   │   │   ├── FiltersPanel.tsx  # Filtros con multi-select
│   │   │   │   ├── StatsCards.tsx    # 6 KPIs superiores
│   │   │   │   ├── HeatMap.tsx       # Mapa de calor (mensual/semanal/promedio)
│   │   │   │   ├── WeeklyView.tsx    # Resumen semanal + gráficos
│   │   │   │   ├── ProfesionalesView.tsx  # Profesionales requeridos hora×día
│   │   │   │   ├── AnalyticsView.tsx      # Vista Analítica estilo Odoo
│   │   │   │   └── MensualDetailView.tsx  # Detalle Mensual día 1-31
│   │   │   ├── admin/
│   │   │   │   ├── AdminPage.tsx     # Gestión usuarios y config
│   │   │   │   └── SyncPage.tsx      # Monitor sincronización
│   │   │   └── reports/              # Reportes por email
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useAtenciones.ts      # Todos los hooks de datos
│   │   ├── store/useStore.ts         # Zustand store (filtros persistidos)
│   │   ├── types/index.ts            # Tipos TypeScript
│   │   └── utils/
│   │       ├── heatmap.ts            # Colores, calcProfesionales (1 decimal)
│   │       ├── holidays.ts           # Festivos colombianos
│   │       └── exportData.ts         # Export Excel/PDF
│   └── public/                       # logo.png, logo-white.png
├── scripts/
│   └── sync/
│       ├── index.js                  # Sync con auto-recuperación de horas perdidas
│       ├── query.sql                 # Query Gomedisys (parametrizada por hora)
│       └── package.json
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # Schema + RPCs base + RLS
│       ├── 002_import_helper.sql     # Importación CSV staging
│       ├── 003_import_features.sql
│       ├── 004_admin_functions.sql
│       ├── 005_new_filters.sql       # RPCs destino + ubicación
│       ├── 005b_fix_overloads.sql    # Corrección overloads PostgREST
│       ├── 006_fix_admin_create_user.sql
│       ├── 007_sync_system.sql       # sync_logs + sync_key en atenciones
│       ├── 007b_sync_backfill_fix.sql
│       ├── 008_multiselect_filters.sql  # RPCs con text[] (multi-select)
│       └── 009_heatmap_stats_detail.sql # get_heatmap_stats_detail (min/max)
└── .github/workflows/
    ├── deploy.yml                    # CI/CD → GitHub Pages
    └── sync.yml                      # workflow_dispatch (disparado por cron-job.org)
```

---

## Configuración inicial

### 1. Clonar y configurar

```bash
git clone https://github.com/juanetayo-projects/mapa-calor-urgencias.git
cd mapa-calor-urgencias/app
npm install
cp .env.example .env
```

`.env`:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
```

### 2. Ejecutar migraciones en Supabase SQL Editor (en orden)

```
001_initial_schema.sql
002_import_helper.sql
003_import_features.sql
004_admin_functions.sql
005_new_filters.sql
005b_fix_overloads.sql
006_fix_admin_create_user.sql
007_sync_system.sql
008_multiselect_filters.sql
009_heatmap_stats_detail.sql
```

### 3. Sincronización automática

#### GitHub Secrets requeridos

| Secret | Descripción |
|---|---|
| `GOMEDISYS_HOST` | Host Azure SQL |
| `GOMEDISYS_PORT` | 1433 |
| `GOMEDISYS_DATABASE` | Nombre BD Gomedisys |
| `GOMEDISYS_USERNAME` | Usuario SQL |
| `GOMEDISYS_PASSWORD` | Contraseña SQL |
| `VITE_SUPABASE_URL` | URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service key (bypass RLS) |

#### cron-job.org (trigger confiable)

El workflow se dispara desde **cron-job.org** cada hora a los :05 (reemplaza el cron de GitHub Actions que es unreliable):

- **URL:** `https://api.github.com/repos/juanetayo-projects/mapa-calor-urgencias/actions/workflows/sync.yml/dispatches`
- **Method:** POST
- **Schedule:** `5 * * * *`
- **Body:** `{"ref": "master"}`
- **Headers:**
  ```
  Authorization: Bearer ghp_XXXX (token classic con scope workflow)
  Content-Type: application/json
  Accept: application/vnd.github+json
  X-GitHub-Api-Version: 2022-11-28
  ```

Ver `docs/configuracion-cron-externo.md` para guía paso a paso.

#### Auto-recuperación de horas perdidas

El script `scripts/sync/index.js` tiene lógica de auto-recuperación: si el cron se salta varias horas, la siguiente ejecución consulta `sync_logs` y sincroniza automáticamente todas las horas perdidas (máximo 24h back en modo automático; ilimitado en modo manual con `HOURS_BACK`).

**Zona horaria:** Colombia (UTC−5, sin DST). Los timestamps en `sync_logs` almacenan hora Colombia como UTC (particularidad del diseño).

### 4. Importar datos históricos

1. Exportar hoja DATA de `fuente/Mapa.xlsx` como CSV (`;`, UTF-8)
2. Importar a `atenciones_staging` en Supabase Table Editor
3. Ejecutar: `SELECT * FROM fn_import_from_staging();`

### 5. Edge Function Resend (reportes email)

```bash
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set FROM_EMAIL=urgencias@clinicasantabarbara.com
supabase functions deploy send-report
```

---

## Dashboard — Pestañas y funcionalidades

### Pestaña 1: Mapa de Calor

Grilla hora (0–23) × día del período seleccionado.

- **Vista Mensual:** columnas = días 1–31 del mes, con nombre del día
- **Vista Semanal:** columnas = LUN/MAR/…/DOM (acumulado)
- **Vista Promedio:** igual semanal pero muestra el promedio diario
- Domingos en rojo, festivos colombianos en ámbar
- Tooltip: atenciones + profesionales requeridos
- Exportar a **Excel** y **PDF**

### Pestaña 2: Resumen Semanal

- **Gráfico:** Atenciones por día de semana — *Sumatoria de pacientes atendidos por día de la semana*. Barras pico en rojo (≥85% del máximo).
- **Gráfico:** Atenciones por hora — *Sumatoria de pacientes atendidos por hora durante el mes*. Horas pico en rojo.
- **Tabla resumen:** hora × día semana con profesionales requeridos (1 decimal), celdas pico con ring rojo.

### Pestaña 3: Profesionales Requeridos

Escala de color verde→amarillo→naranja→rojo según número de profesionales por celda.

- Celdas pico resaltadas (≥85% del máximo)
- Valores con **1 decimal** (ej. 1.5, 2.3)
- Fila PICO al fondo por día de semana

### Pestaña 4: Vista Analítica (estilo Odoo)

Pivot table hora × día de semana con **promedio de atenciones por día**.

- Escala azul→naranja→rojo (intensidad relativa)
- **Tooltip** al hover: promedio/día, mínimo, máximo, total, días con datos
- **Columna promedio** a la derecha (promedio de la hora entre días)
- **Fila Σ prom** al fondo (suma de promedios por día)
- Botón **"Ver registros representativos"** → modal con tabla ordenable, top-5 dorado, barra de demanda visual

### Pestaña 5: Detalle Mensual

Pivot table hora × **cada día del mes (1–31)** con total de pacientes.

- Domingos en rojo, festivos colombianos en ámbar
- **Tooltip inteligente** (se voltea si está cerca del borde):
  - Fecha completa + día de semana
  - Pacientes ese día (con indicador ▲/▼ vs promedio de la hora)
  - Profesionales requeridos
  - Semana del mes
  - Contexto de la hora en el mes: **Mínimo / Máximo / Promedio**
- **Fila TOTAL** sticky al fondo por día
- **Columna Prom.** sticky a la derecha
- Botón **"Ver registros representativos"** → modal ordenable con indicadores dom/festivo

### Barra de análisis mensual por hora (entre pestañas y contenido)

Siempre visible independientemente de la pestaña activa:
> **Análisis mensual por hora:** Mín 1 · Máx 77 · Prom 28.7 · Total 4,824

---

## Filtros

Panel superior con controles:

| Filtro | Tipo | Descripción |
|---|---|---|
| Vista | Selector | Mensual / Semanal / Promedio |
| Año | Selector | Años disponibles en BD |
| Mes | Selector | Todos o mes específico |
| Semana | Selector | Sem 1–5 del mes |
| Clasificación | **Multi-select** | Triage I, II, III, IV, V |
| Destino | **Multi-select** | Destino de clasificación |
| Ubicación | **Multi-select** | Ubicación de triage |
| Min/atención | Número | 5–120 min. Afecta cálculo prof. |
| Días semana | Chips | Incluir/excluir días específicos |

Los multi-select permiten selección múltiple con checkbox, badge azul cuando activo, y botón × para limpiar.

---

## Módulo Sincronización (Admin)

- Historial completo de ejecuciones
- KPIs: última ejecución, última exitosa, éxitos/errores, duración promedio
- Períodos en hora local Colombia
- Auto-refresco cada 60 segundos
- Botón "Sincronizar ahora" → GitHub Actions

---

## Métricas KPI (tarjetas superiores)

| Tarjeta | Valor |
|---|---|
| Total atenciones | Suma del período |
| Hora pico | Hora con más atenciones acumuladas |
| Promedio / día | Atenciones promedio diarias |
| Min / atención | Minutos configurados + capacidad (pac/prof/h) |
| Prom. pac./hora | total ÷ días ÷ 24 (compara vs pico) |
| Días analizados | Días con datos + filtro triage activo |

---

## Cálculo de profesionales

```
profesionales = ROUND(pacientes_en_hora / (60 / minutos), 1)
```

Resultado con 1 decimal para precisión en planeación.

| Min/at. | Cap. (pac/prof/h) | 10 pac → prof |
|---------|-------------------|---------------|
| 14 | 4.3 | 2.3 |
| 20 | 3.0 | 3.3 |
| 30 | 2.0 | 5.0 |
| 60 | 1.0 | 10.0 |

---

## Escala de colores

### Mapa de calor (intensidad relativa)

| Color | Rango |
|---|---|
| Blanco | 0 atenciones |
| Verde | 0–10% del máximo |
| Verde claro | 10–25% |
| Amarillo | 25–50% |
| Naranja | 50–70% |
| Rojo | 70–90% |
| Rojo oscuro | >90% (pico crítico) |

### Vista Analítica (promedios)

Escala azul → naranja → rojo oscuro (misma lógica relativa).

### Profesionales Requeridos

Verde (1) → Verde oscuro (2) → Amarillo (3) → Naranja (4) → Rojo claro (5) → Rojo (6+)

---

## Roles de usuario

| Rol | Acceso |
|---|---|
| Admin | Todo: dashboard, reportes, usuarios, config, sincronización |
| Analista | Dashboard, filtros, reportes, importar datos |
| Visualizador | Solo dashboard con filtros básicos |

---

## Variables de entorno y secretos

| Variable | Dónde | Descripción |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` + GitHub Secret | URL proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` + GitHub Secret | Clave anon pública |
| `RESEND_API_KEY` | Supabase Secrets | API Key Resend |
| `FROM_EMAIL` | Supabase Secrets | Email remitente |
| `GOMEDISYS_HOST` | GitHub Secret | Host Azure SQL |
| `GOMEDISYS_PORT` | GitHub Secret | Puerto SQL (1433) |
| `GOMEDISYS_DATABASE` | GitHub Secret | Nombre BD |
| `GOMEDISYS_USERNAME` | GitHub Secret | Usuario SQL |
| `GOMEDISYS_PASSWORD` | GitHub Secret | Contraseña SQL |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secret | Service key (bypass RLS) |

---

## Seguridad

- Credenciales SQL Server solo en GitHub Secrets, nunca en código
- Service role key solo en scripts server-side (GitHub Actions)
- `fuente/Mapa.xlsx` e `images/` en `.gitignore` (contienen PII de pacientes)
- Row Level Security habilitado en todas las tablas
- Token de GitHub (cron-job.org) con scope mínimo: solo `workflow`

---

## Migraciones Supabase — resumen

| Migración | Propósito |
|---|---|
| 001 | Schema inicial, RPCs base, RLS |
| 002–003 | Importación CSV |
| 004 | Funciones admin |
| 005 | Filtros destino + ubicación |
| 005b | Corrección overloads PostgREST |
| 006 | Fix creación usuarios admin |
| 007 | sync_logs + sync_key (idempotencia) |
| 007b | Backfill sync_key con deduplicación |
| 008 | RPCs con text[] (filtros multi-select) |
| 009 | get_heatmap_stats_detail (min/max por celda) |

---

© Clínica Santa Bárbara de Alta Complejidad · Desarrollado por Ing. Juan Carlos Etayo Ruiz
