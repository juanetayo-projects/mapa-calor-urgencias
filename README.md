# Mapa de Calor Urgencias · Clínica Santa Bárbara

Sistema web de análisis visual para el servicio de urgencias. Muestra un mapa de calor interactivo con la distribución de atenciones por hora y día, cálculo de profesionales requeridos y filtros avanzados con sincronización automática desde SQL Server (Azure).

---

## Stack tecnológico

| Capa       | Tecnología                                            |
|------------|-------------------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite                          |
| Estilos    | Tailwind CSS                                          |
| Estado     | Zustand + React Query                                 |
| Backend    | Supabase (PostgreSQL + Auth + Edge Functions)         |
| Sync       | Node.js 22 + mssql + GitHub Actions (cron horario)   |
| Email      | Resend                                                |
| Deploy     | GitHub Pages (frontend) + Supabase (backend)          |

---

## Estructura del proyecto

```
mapadecalorurg/
├── app/                        # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # Login, ProtectedRoute
│   │   │   ├── layout/         # Sidebar, Header, Layout
│   │   │   ├── dashboard/      # HeatMap, Filtros, Stats, Weekly, Profesionales
│   │   │   ├── admin/          # Gestión usuarios, config, SyncPage
│   │   │   └── reports/        # Envío de reportes por email
│   │   ├── hooks/              # useAuth, useAtenciones
│   │   ├── lib/                # supabase.ts
│   │   ├── store/              # useStore (Zustand)
│   │   ├── types/              # Tipos TypeScript
│   │   └── utils/              # heatmap.ts (colores, cálculos)
│   └── public/                 # logo.png, logo-white.png
├── scripts/
│   └── sync/                   # Sincronización SQL Server → Supabase
│       ├── index.js            # Lógica de sincronización horaria
│       ├── query.sql           # Consulta SQL a Gomedisys
│       └── package.json        # mssql + @supabase/supabase-js + ws
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Schema completo + RPC base
│   │   ├── 002_import_helper.sql     # Helper importación CSV
│   │   ├── 003_import_features.sql   # Features de importación
│   │   ├── 004_admin_functions.sql   # Funciones de administración
│   │   ├── 005_new_filters.sql       # Filtros destino + ubicación
│   │   ├── 005b_fix_overloads.sql    # Corrección overloads PostgREST
│   │   ├── 006_fix_admin_create_user.sql
│   │   ├── 007_sync_system.sql       # Tabla sync_logs + sync_key
│   │   └── 008_multiselect_filters.sql # Filtros multivalor (text[])
│   └── functions/
│       └── send-report/        # Edge Function Resend
└── .github/workflows/
    ├── deploy.yml              # CI/CD GitHub Pages
    └── sync.yml                # Cron horario SQL Server → Supabase
```

---

## Configuración inicial

### 1. Clonar y configurar el proyecto

```bash
git clone https://github.com/juanetayo-projects/mapa-calor-urgencias.git
cd mapa-calor-urgencias/app
npm install
cp .env.example .env
```

Editar `.env`:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhb...
```

### 2. Configurar Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ir a **SQL Editor** y ejecutar en orden:
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
   ```

### 3. Configurar sincronización automática (GitHub Actions)

En GitHub → Settings → Secrets and variables → Actions, agregar:

| Secret                   | Descripción                              |
|--------------------------|------------------------------------------|
| `GOMEDISYS_HOST`         | Host Azure SQL (ej. goreplica.database.windows.net) |
| `GOMEDISYS_PORT`         | Puerto (1433)                            |
| `GOMEDISYS_DATABASE`     | Nombre de la base de datos               |
| `GOMEDISYS_USERNAME`     | Usuario SQL                              |
| `GOMEDISYS_PASSWORD`     | Contraseña SQL                           |
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase                |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypass RLS)        |

El workflow `.github/workflows/sync.yml` se ejecuta **cada hora a los :05 UTC** (00:05 Colombia).
Para sincronización manual: GitHub → Actions → "Sync SQL Server → Supabase" → Run workflow.

**Zona horaria:** Colombia (UTC−5, sin horario de verano). La variable `HOURS_BACK` permite sincronizar
horas anteriores en ejecuciones manuales (ej. `hours_back=6` para las últimas 6 horas).

### 4. Importar datos históricos desde Excel

1. Abrir `fuente/Mapa.xlsx` y exportar hoja **DATA** como CSV (`;` como separador, UTF-8)
2. En Supabase SQL Editor importar a `atenciones_staging` y ejecutar `fn_import_from_staging()`

### 5. Desplegar Edge Function (Resend)

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set FROM_EMAIL=urgencias@clinicasantabarbara.com
supabase functions deploy send-report
```

### 6. Ejecutar en desarrollo

```bash
cd app
npm run dev
```

### 7. Deploy a GitHub Pages

1. En GitHub → Settings → Secrets agregar `VITE_SUPABASE_ANON_KEY`
2. En GitHub → Settings → Pages → Source: **GitHub Actions**
3. Push a `main` → el workflow despliega automáticamente.

**URL producción:** https://juanetayo-projects.github.io/mapa-calor-urgencias/

---

## Dashboard — Funcionalidades

### Mapa de Calor
Grilla hora × día (mensual, semanal, promedio) con escala de colores por intensidad.
- Exportación a Excel y PDF
- Indicadores de domingos y festivos colombianos
- Tooltip con atenciones y profesionales requeridos por celda

### Métricas KPI (tarjetas superiores)

| Tarjeta              | Descripción                                              |
|----------------------|----------------------------------------------------------|
| Total atenciones     | Suma del período seleccionado                            |
| Hora pico            | Hora con más atenciones acumuladas                       |
| Promedio / día       | Atenciones promedio diarias                              |
| Min / atención       | Minutos configurados + capacidad resultante              |
| Prom. pac./hora      | Promedio horario (total ÷ días ÷ 24). Compara vs pico.  |
| Días analizados      | Días con datos en el período + filtro triage activo      |

### Filtros (multi-select)
- **Vista:** Mensual / Semanal / Promedio
- **Año / Mes / Semana del mes:** filtros temporales
- **Clasificación Triage:** selección múltiple (I, II, III…)
- **Destino clasificación:** selección múltiple
- **Ubicación Triage:** selección múltiple
- **Min/atención:** tiempo por atención para cálculo de profesionales
- **Días de semana:** chips para incluir/excluir días

### Resumen Semanal
- Barras por día de semana con **picos resaltados en rojo** (≥85% del máximo)
- Barras por hora con resaltado de pico
- Tabla resumen con profesionales requeridos (con 1 decimal) y **celdas pico** marcadas

### Profesionales Requeridos
- Grilla hora × día con color-escala de profesionales necesarios
- **Análisis mensual:** Mín / Máx / Promedio / Total de pacientes por celda
- Celdas de **pico resaltadas** con ring rojo
- Valores de profesionales con **1 decimal** (ej. 1.5, 2.3)

---

## Sincronización Automática (Pantalla Admin)

Disponible en: Menú → Sincronización (solo rol admin)

- Historial de ejecuciones con estado (Exitoso / Error / Parcial)
- KPIs: última ejecución, última exitosa, conteo éxitos/errores, duración promedio
- Botón "Sincronizar ahora" → abre GitHub Actions
- Auto-refresco cada 60 segundos
- Períodos mostrados en **hora local Colombia**

---

## Parámetro "Minutos por atención"

| Minutos | Atenciones/hora/profesional | Profesionales para 5 pac. |
|---------|-----------------------------|---------------------------|
| 14      | 4.3                         | 1.2                       |
| 20      | 3.0                         | 1.7                       |
| 30      | 2.0                         | 2.5                       |
| 60      | 1.0                         | 5.0                       |

**Fórmula profesionales requeridos (con decimal):**
```
profesionales = ROUND(pacientes_en_hora / (60 / minutos), 1)
```

---

## Escala del mapa de calor

| Color        | Intensidad relativa |
|--------------|---------------------|
| Blanco       | 0 atenciones        |
| Verde        | 0–10%               |
| Verde claro  | 10–25%              |
| Amarillo     | 25–50%              |
| Naranja      | 50–70%              |
| Rojo         | 70–90%              |
| Rojo oscuro  | >90% (pico)         |

---

## Roles de usuario

| Rol          | Permisos                                                   |
|--------------|------------------------------------------------------------|
| Admin        | Todo: dashboard, reportes, usuarios, config, sincronización |
| Analista     | Dashboard, filtros, reportes, importar datos               |
| Visualizador | Solo dashboard con filtros básicos                         |

---

## Variables de entorno

| Variable                 | Descripción                              |
|--------------------------|------------------------------------------|
| `VITE_SUPABASE_URL`      | URL del proyecto Supabase                |
| `VITE_SUPABASE_ANON_KEY` | Clave anon pública de Supabase           |
| `RESEND_API_KEY`         | API Key de Resend (en Supabase Secrets)  |
| `FROM_EMAIL`             | Email remitente (en Supabase Secrets)    |
| `GOMEDISYS_HOST`         | Host Azure SQL (en GitHub Secrets)       |
| `GOMEDISYS_PASSWORD`     | Contraseña SQL (solo en GitHub Secrets)  |
| `SUPABASE_SERVICE_ROLE_KEY` | Service key Supabase (en GitHub Secrets) |

---

## Seguridad

- Las credenciales de SQL Server **nunca se almacenan en el repositorio**; solo en GitHub Secrets.
- La `SUPABASE_SERVICE_ROLE_KEY` se usa exclusivamente en el script de sincronización (server-side).
- Los archivos `fuente/Mapa.xlsx` e `images/` están en `.gitignore` por contener datos de pacientes (PII).
- Row Level Security (RLS) habilitado en todas las tablas de Supabase.

---

© Clínica Santa Bárbara de Alta Complejidad
