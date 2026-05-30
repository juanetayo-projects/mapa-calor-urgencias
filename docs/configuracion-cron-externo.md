# Configuración de Cron Externo — Sync SQL Server → Supabase

## Problema

GitHub Actions tiene scheduling "best-effort" no garantizado para workflows programados.
Puede saltarse horas completas sin aviso. Para un sistema hospitalario que requiere
sincronización cada hora, necesitamos un servicio externo confiable.

## Solución: cron-job.org (gratuito)

cron-job.org es un servicio gratuito de cron externo que llama a una URL cada X minutos.
Lo usamos para disparar el workflow de GitHub Actions vía su API REST.

---

## Pasos de configuración

### 1. Crear GitHub Personal Access Token (PAT)

1. Ir a: https://github.com/settings/tokens/new
2. Nombre: `mapa-calor-sync-trigger`
3. Expiration: No expiration (o 1 año)
4. Scopes: marcar SOLO **`workflow`**
5. Copiar el token generado (solo se muestra una vez): `ghp_xxxxx...`

### 2. Crear cuenta en cron-job.org

1. Ir a: https://cron-job.org
2. Registrarse con email (es gratuito)
3. Verificar el email

### 3. Crear el cron job

En el dashboard de cron-job.org:

1. Clic en **"New job"**

2. **Title:** `Mapa Calor Urgencias - Sync Horario`

3. **URL:**
   ```
   https://api.github.com/repos/juanetayo-projects/mapa-calor-urgencias/actions/workflows/sync.yml/dispatches
   ```

4. **Schedule:** Every hour at minute 5
   - Execution schedule: Custom
   - Minutes: `5`
   - Hours: `*` (every hour)
   - Days: `*`
   - Months: `*`
   - Weekdays: `*`

5. **Request method:** POST

6. **Request headers** (agregar estos dos):
   | Header | Value |
   |--------|-------|
   | `Authorization` | `Bearer ghp_xxxxx...` (tu PAT) |
   | `Content-Type` | `application/json` |
   | `Accept` | `application/vnd.github+json` |
   | `X-GitHub-Api-Version` | `2022-11-28` |

7. **Request body:**
   ```json
   {"ref": "master"}
   ```

8. **Notifications:** Enable email on failure

9. Guardar → el cron correrá cada hora a los :05

---

## Verificación

Después de la primera ejecución (a los :05 de la siguiente hora):
1. Ir a GitHub → Actions → "Sync SQL Server → Supabase"
2. Verificar que aparece un nuevo run con **Event: workflow_dispatch**
3. El módulo de Sincronización en la app mostrará el nuevo registro en el historial

---

## ¿Por qué funciona mejor que GitHub Actions schedule?

| | GitHub Actions `schedule` | cron-job.org → workflow_dispatch |
|---|---|---|
| Confiabilidad | ~60-80% (best-effort) | ~99.9% |
| Delay máximo | Horas | < 1 minuto |
| Costo | Gratuito | Gratuito |
| Logs | En GitHub Actions | En cron-job.org + GitHub Actions |

---

## Nota de seguridad

- El PAT solo tiene el scope `workflow` — mínimos permisos necesarios
- Si el PAT se compromete, revocarlo en: https://github.com/settings/tokens
- cron-job.org guarda el PAT de forma cifrada en sus servidores
- Considerar rotar el PAT cada 6-12 meses

---

## Alternativa: desactivar el cron de GitHub y dejar solo cron-job.org

Una vez que cron-job.org esté funcionando, puedes modificar `.github/workflows/sync.yml`
para eliminar el trigger `schedule` y dejar solo `workflow_dispatch`:

```yaml
on:
  workflow_dispatch:
    inputs:
      hours_back:
        description: "Horas hacia atrás a sincronizar"
        required: false
        default: "0"  # 0 = auto-detectar desde sync_logs
```

Con `HOURS_BACK=0` (o sin definir), el script calcula automáticamente cuántas horas
han pasado desde el último sync exitoso, cubriendo cualquier gap.
