# Mapa de Calor Urgencias · Clínica Santa Bárbara

Sistema web de análisis visual para el servicio de urgencias. Muestra un mapa de calor interactivo con la distribución de atenciones por hora y día, cálculo de profesionales requeridos y filtros avanzados.

---

## Stack tecnológico

| Capa       | Tecnología              |
|------------|-------------------------|
| Frontend   | React 18 + TypeScript + Vite |
| Estilos    | Tailwind CSS            |
| Estado     | Zustand + React Query   |
| Backend    | Supabase (PostgreSQL + Auth + Edge Functions) |
| Email      | Resend                  |
| Deploy     | GitHub Pages (frontend) + Supabase (backend) |

---

## Estructura del proyecto

```
mapadecalorurg/
├── app/                        # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/           # Login, ProtectedRoute
│   │   │   ├── layout/         # Sidebar, Header, Layout
│   │   │   ├── dashboard/      # HeatMap, Filtros, Stats, Weekly
│   │   │   ├── admin/          # Gestión usuarios y config
│   │   │   └── reports/        # Envío de reportes por email
│   │   ├── hooks/              # useAuth, useAtenciones
│   │   ├── lib/                # supabase.ts, resend.ts
│   │   ├── store/              # useStore (Zustand)
│   │   ├── types/              # Tipos TypeScript
│   │   └── utils/              # heatmap.ts (colores, cálculos)
│   └── public/                 # logo.png, logo-white.png
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # Schema completo
│   │   └── 002_import_helper.sql    # Helper importación CSV
│   └── functions/
│       └── send-report/        # Edge Function Resend
└── .github/workflows/          # CI/CD GitHub Pages
```

---

## Configuración inicial

### 1. Clonar y configurar el proyecto

```bash
git clone https://github.com/TU_USUARIO/mapa-calor-urgencias.git
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
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_import_helper.sql`

### 3. Importar datos desde Excel

1. Abrir `fuente/Mapa.xlsx` y exportar hoja **DATA** como CSV (`;` como separador, UTF-8)
2. En Supabase SQL Editor:
```sql
-- Copiar el CSV a la tabla staging
COPY public.atenciones_staging FROM '/ruta/Mapa_DATA.csv' CSV HEADER DELIMITER ';';

-- Migrar a la tabla principal
SELECT * FROM public.fn_import_from_staging();
```
   O usar el **Table Editor** de Supabase para importar directo a `atenciones_staging`.

### 4. Desplegar Edge Function (Resend)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Vincular proyecto
supabase link --project-ref TU_PROJECT_REF

# Configurar secret de Resend
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set FROM_EMAIL=urgencias@clinicasantabarbara.com

# Desplegar función
supabase functions deploy send-report
```

### 5. Ejecutar en desarrollo

```bash
cd app
npm run dev
```

### 6. Deploy a GitHub Pages

1. En GitHub → Settings → Secrets and variables → Actions, agregar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. En GitHub → Settings → Pages → Source: **GitHub Actions**
3. Hacer push a `main` → el workflow despliega automáticamente.

---

## Parámetro "Minutos"

El parámetro **minutos por atención** calcula la capacidad operativa:

| Minutos | Atenciones/hora/profesional |
|---------|----------------------------|
| 14      | 4                          |
| 20      | 3                          |
| 30      | 2                          |
| 60      | 1                          |

**Fórmula profesionales requeridos:**
```
profesionales = CEIL(pacientes_en_hora / (60 / minutos))
```

El tooltip del mapa de calor muestra los profesionales requeridos para cada celda.

---

## Escala del mapa de calor

| Color     | Intensidad relativa |
|-----------|---------------------|
| Blanco    | 0 atenciones        |
| Verde     | 0–10%               |
| Verde claro | 10–25%            |
| Amarillo  | 25–50%              |
| Naranja   | 50–70%              |
| Rojo      | 70–90%              |
| Rojo oscuro | >90%             |

---

## Roles de usuario

| Rol          | Permisos                                        |
|--------------|-------------------------------------------------|
| Admin        | Todo: dashboard, reportes, usuarios, config     |
| Analista     | Dashboard, filtros, reportes, importar datos    |
| Visualizador | Solo dashboard con filtros básicos              |

---

## Variables de entorno

| Variable              | Descripción                    |
|-----------------------|--------------------------------|
| VITE_SUPABASE_URL     | URL del proyecto Supabase      |
| VITE_SUPABASE_ANON_KEY| Clave anon pública de Supabase |
| RESEND_API_KEY        | API Key de Resend (en Supabase Secrets) |
| FROM_EMAIL            | Email remitente (en Supabase Secrets)   |

---

© Clínica Santa Bárbara de Alta Complejidad
