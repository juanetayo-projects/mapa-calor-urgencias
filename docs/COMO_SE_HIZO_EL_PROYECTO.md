# Mapa de Calor Urgencias — Documentación del Proyecto

**Clínica Santa Bárbara de Alta Complejidad · Colombia**  
Versión 1.0 · Mayo 2026

---

## 1. Descripción General

Aplicación web SaaS para visualizar la demanda horaria del servicio de Urgencias mediante un mapa de calor interactivo. Permite al personal directivo y analítico identificar horas pico, distribuir profesionales de forma óptima e identificar patrones por triage, día de la semana y mes.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript | 18 / 5.x |
| Build tool | Vite | 5.x |
| Estilos | Tailwind CSS | 3.x |
| Estado global | Zustand (persist) | 4.x |
| Datos remotos | TanStack Query | 5.x |
| Gráficos | Recharts | 2.x |
| Backend / DB | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth (email+password) | — |
| Edge Functions | Deno (Supabase) | — |
| Email | Resend API | — |
| Deploy | GitHub Pages + GitHub Actions | — |
| Exportación | SheetJS (xlsx) + jsPDF | — |

---

## 3. Arquitectura

```
┌─────────────────────────────────────────────────────┐
│                  GitHub Pages                       │
│  React SPA (Vite build)                            │
│  ┌──────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │  Dashboard   │ │  Reportes  │ │  Importar    │ │
│  │  HeatMap     │ │  Email     │ │  CSV         │ │
│  └──────┬───────┘ └─────┬──────┘ └──────┬───────┘ │
└─────────┼───────────────┼───────────────┼──────────┘
          │               │               │
          ▼               ▼               ▼
┌─────────────────────────────────────────────────────┐
│              Supabase (zuqqhglrxhexlazxcqgl)        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ PostgreSQL  │  │  Auth        │  │  Edge     │  │
│  │ atenciones  │  │  JWT tokens  │  │  Function │  │
│  │ profiles    │  │  RLS policies│  │  send-    │  │
│  │ importac.   │  │              │  │  report   │  │
│  └─────────────┘  └──────────────┘  └─────┬─────┘  │
└──────────────────────────────────────────┼──────────┘
                                           ▼
                                    Resend API
                                  (envío de emails)
```

---

## 4. Estructura de Carpetas

```
mapadecalorurg/
├── app/                          ← Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/             ← Login
│   │   │   ├── dashboard/        ← HeatMap, Filters, Stats
│   │   │   ├── layout/           ← Sidebar, Header
│   │   │   ├── import/           ← Importación CSV
│   │   │   ├── reports/          ← Envío email
│   │   │   └── admin/            ← CRUD usuarios
│   │   ├── hooks/                ← useAtenciones, useAuth
│   │   ├── lib/                  ← supabase.ts, resend.ts
│   │   ├── store/                ← useStore (Zustand)
│   │   ├── types/                ← Tipos TypeScript
│   │   └── utils/
│   │       ├── heatmap.ts        ← Colores, cálculos
│   │       ├── holidays.ts       ← Festivos colombianos
│   │       └── exportData.ts     ← Excel / PDF
│   ├── .env                      ← Variables de entorno (NO subir a git)
│   └── vite.config.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_xxx.sql
│   │   ├── 003_import_features.sql
│   │   └── 004_admin_functions.sql
│   └── functions/
│       └── send-report/
│           └── index.ts          ← Edge Function (Deno)
├── docs/
│   └── COMO_SE_HIZO_EL_PROYECTO.md
└── .github/
    └── workflows/
        └── deploy.yml            ← CI/CD automático
```

---

## 5. Base de Datos (Supabase)

### Tablas principales

#### `public.atenciones`
Tabla central con ~36.000 registros importados desde el archivo Mapa.xlsx.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `fecha_triage` | DATE | Fecha de atención (clave para el heatmap) |
| `hora_triage` | TIME | Hora de atención |
| `clasificacion_triage` | TEXT | Triage I…V |
| `hora_numerica` | SMALLINT | Derivado de hora_triage (0–23) |
| `nombre_dia` | CHAR(3) | LUN/MAR/MIE/JUE/VIE/SAB/DOM |
| `dia_numero` | SMALLINT | Generado: día del mes (1–31) |
| `mes_numero` | SMALLINT | Generado: mes (1–12) |
| `anio_numero` | SMALLINT | Generado: año |
| `importacion_id` | UUID | FK → importaciones.id |

#### `public.profiles`
Extiende `auth.users` con nombre y rol.

| Campo | Tipo | Valores |
|-------|------|---------|
| `role` | TEXT | `admin` / `analyst` / `viewer` |

#### `public.importaciones`
Log de cada importación CSV realizada.

#### `public.configuracion`
Parámetros del sistema (minutos por atención, nombre clínica, umbrales heatmap, email destino).

#### `public.reportes_email`
Historial de reportes enviados por correo.

---

## 6. Row Level Security (RLS)

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Todos | Propio / Admin | Propio / Admin | — |
| atenciones | Autenticado | Admin/Analyst | Admin/Analyst | Admin |
| configuracion | Autenticado | Admin | Admin | Admin |
| importaciones | Autenticado | Admin/Analyst | Admin/Analyst | Admin |
| reportes_email | Autenticado | Admin/Analyst | — | — |

---

## 7. Funciones RPC

| Función | Descripción |
|---------|-------------|
| `get_heatmap_data(anio, mes, dias, semana, triage)` | Datos para mapa mensual (hora × día) |
| `get_heatmap_semanal(anio, mes, semana, triage)` | Datos para vista semanal (hora × día semana) |
| `get_available_years()` | Años con datos en la BD |
| `get_stats(anio, mes, triage)` | KPIs: total, hora pico, promedio/día |
| `get_triage_disponibles()` | Lista de valores únicos de triage |
| `fn_remove_importacion(id)` | Elimina importación + sus atenciones |
| `fn_count_atenciones_en_rango(desde, hasta)` | Conteo para detectar duplicados |
| `fn_admin_create_user(email, pass, nombre, rol)` | Crea usuario sin confirmación email |
| `fn_admin_delete_user(user_id)` | Elimina usuario (cascade a perfil) |
| `fn_admin_set_password(user_id, nueva_pass)` | Cambia contraseña |

---

## 8. Festivos Colombianos — Algoritmo

El archivo `app/src/utils/holidays.ts` calcula automáticamente los festivos de Colombia para cualquier año:

1. **Fechas fijas**: Año Nuevo (1/1), Día del Trabajo (1/5), Independencia (20/7), Boyacá (7/8), Inmaculada Concepción (8/12), Navidad (25/12).

2. **Ley Emiliani** (se trasladan al lunes siguiente si no caen en lunes): Reyes Magos, San José, San Pedro y Pablo, Asunción, Día de la Raza, Todos los Santos, Independencia de Cartagena.

3. **Semana Santa** (Algoritmo Gaussiano de cálculo de Pascua): Jueves Santo (Pascua − 3), Viernes Santo (Pascua − 2), Ascensión (Pascua + 39, Emiliani), Corpus Christi (Pascua + 60, Emiliani), Sagrado Corazón (Pascua + 68, Emiliani).

---

## 9. Mapa de Calor — Lógica de Colores

La escala de colores es relativa al máximo del período visualizado:

| Intensidad | Color |
|-----------|-------|
| 0% | Blanco |
| 1–20% | Verde muy claro |
| 20–40% | Verde claro |
| 40–60% | Amarillo |
| 60–75% | Naranja |
| 75–90% | Rojo claro |
| 90–100% | Rojo |

Los **domingos** se marcan con fondo rojo claro en el encabezado de columna.  
Los **festivos** se marcan con fondo ámbar en el encabezado de columna.

---

## 10. Configuración Inicial (desde cero)

### Prerequisitos
- Node.js ≥ 20
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Resend](https://resend.com) (para emails)
- Cuenta en GitHub

### Pasos

**1. Clonar el repositorio**
```bash
git clone https://github.com/juanetayo-projects/mapa-calor-urgencias.git
cd mapa-calor-urgencias/app
npm install
```

**2. Configurar variables de entorno**

Crear `app/.env`:
```env
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
VITE_RESEND_API_KEY=re_<tu_clave>
```

**3. Ejecutar migraciones en Supabase**

En **Supabase → SQL Editor**, ejecutar en orden:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/003_import_features.sql`
3. `supabase/migrations/004_admin_functions.sql`

**4. Crear usuario administrador inicial**

En **Supabase → Authentication → Users → Invite user** o usar el panel de administración de la app una vez creado el primer usuario manualmente.

Luego en **SQL Editor**:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'tu@email.com';
```

**5. Importar datos**

Usar el módulo **Importar datos** de la app con el archivo CSV exportado desde el sistema de urgencias.  
El CSV debe tener la columna `fecha_triage` (formato DD/MM/YYYY o DD-MM-YYYY) y `hora_triage`.

**6. Desplegar Edge Function de email**

En **Supabase → Edge Functions**:
- Crear nueva función llamada `send-report`
- Pegar el contenido de `supabase/functions/send-report/index.ts`
- En **Manage secrets**, agregar: `RESEND_API_KEY = re_<tu_clave>`

**7. GitHub Pages**

En **GitHub → Settings → Secrets and variables → Actions**, agregar:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RESEND_API_KEY`

Cada push a `master` dispara el deploy automático.

---

## 11. Módulo de Importación CSV

El importador acepta archivos CSV/XLSX exportados desde el sistema de historia clínica.

**Características del parser:**
- Detecta automáticamente el separador (`,` `;` o tabulación)
- Mapeo de columnas case-insensitive (acepta `FECHA_TRIAGE`, `Fecha triage`, etc.)
- Soporta fechas en formato: `DD/MM/YYYY`, `DD-MM-YYYY`, ISO 8601, número serial de Excel
- Strip automático de BOM (archivos exportados desde Excel)
- Funciona con o sin columna `importacion_id` (compatibilidad hacia atrás)

---

## 12. Roles y Permisos

| Función | Admin | Analyst | Viewer |
|---------|:-----:|:-------:|:------:|
| Ver dashboard | ✓ | ✓ | ✓ |
| Exportar Excel/PDF | ✓ | ✓ | ✓ |
| Enviar reportes email | ✓ | ✓ | — |
| Importar datos CSV | ✓ | ✓ | — |
| Eliminar importaciones | ✓ | — | — |
| Gestionar usuarios | ✓ | — | — |
| Configurar sistema | ✓ | — | — |

---

## 13. Historial de Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | May 2026 | Lanzamiento inicial |
| 1.1.0 | May 2026 | Fix import CSV, auto-año, políticas RLS |
| 1.2.0 | May 2026 | Nombres días en heatmap, festivos CO, CRUD usuarios, exportar Excel/PDF |

---

## 14. Contacto y Soporte

**Desarrollado con** Claude (Anthropic) + React + Supabase  
**Institución:** Clínica Santa Bárbara de Alta Complejidad — Colombia
