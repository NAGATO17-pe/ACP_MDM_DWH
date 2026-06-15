# Portal MDM — Auditoría de Estado

> **IMPORTANTE**: Leer este archivo al inicio de cada sesión antes de tocar código.
> Actualizar cualquier sección cuando se modifique algo relevante.
> Fecha última actualización: 2026-06-11

---

## Arquitectura General

- **Framework**: Next.js 16.2.4, App Router, React 19
- **TypeScript**: strict mode — `tsc --noEmit` debe pasar limpio antes de cada commit
- **Auth**: JWT httpOnly cookie (`mdm_session` / `process.env.JWT_COOKIE_NAME`)
- **Edge gate**: `proxy.ts` (NOTA: en Next.js 16 ya no es `middleware.ts`)
- **Server RBAC**: `requireRole` / `requireAnyRole` en layouts y páginas server components
- **Data fetching**: TanStack Query v5 + `HydrationBoundary` para SSR prefetch
- **Backend**: FastAPI en `backend/` — roles distintos a los del frontend (ver §RBAC)

---

## Estructura de Rutas

### Grupos de rutas (route groups)

| Grupo | Layout auth | Roles permitidos |
|---|---|---|
| `(admin)` | `requireAnyRole(["admin", "analyst"])` | admin, analyst |
| `(analyst)` | `requireAnyRole(["analyst", "admin"])` | analyst, admin |
| `(executive)` | `requireRole("executive")` | executive (estricto) |
| `(auth)` | sin auth | todos |

### Páginas dentro de `(admin)`

| Ruta | Roles (routes.ts) | Guard página | Acceso real |
|---|---|---|---|
| `/dashboard` | [admin] | `requireRole("admin")` ✅ | admin |
| `/dwh` | [admin] | `requireRole("admin")` ✅ | admin |
| `/bitacora` | [admin] | `requireRole("admin")` ✅ | admin |
| `/configuracion` | [admin] | `requireRole("admin")` ✅ | admin |
| `/audit` | [admin] | `requireRole("admin")` ✅ | admin |
| `/workflows` | [admin, analyst] | ninguno (layout suficiente) | admin, analyst |
| `/quality` | [admin, analyst] | ninguno | admin, analyst |
| `/catalogos` | [admin, analyst] | ninguno | admin, analyst |
| `/explore` | [analyst, admin] | ninguno | admin, analyst |
| `/models` | [analyst, admin] | ninguno | admin, analyst |
| `/proyecciones` | [analyst, admin] | ninguno | admin, analyst |
| `/reports` | [analyst, admin] | ninguno | admin, analyst |
| `/notifications` | [analyst, admin] | ninguno | admin, analyst |
| `/alerts` | [admin, executive] | ninguno | **admin, analyst** ⚠️ |
| `/etl-monitor` | [admin, executive] | ninguno | **admin, analyst** ⚠️ |
| `/entities` | — | ninguno | admin, analyst |

> ⚠️ **Gap RBAC**: `/alerts` y `/etl-monitor` declaran `roles: [ADMIN, EXECUTIVE]` en `routes.ts`,
> pero viven en el grupo `(admin)` cuyo layout bloquea executives. En la práctica son
> accesibles a admin+analyst, no a executives. Pendiente: mover a grupo compartido o
> cambiar layout ejecutivo.

### Páginas dentro de `(analyst)`

| Ruta | Roles | Guard |
|---|---|---|
| `/home` | [analyst] | layout estricto analyst+admin |
| `/models/[id]` | [analyst, admin] | — (llama `notFound()` si id inválido) |

### Páginas dentro de `(executive)`

| Ruta | Roles | Guard |
|---|---|---|
| `/overview` | [executive, admin] | `requireRole("executive")` estricto |

> ⚠️ **Gap RBAC**: `/overview` declara `roles: [EXECUTIVE, ADMIN]` pero el layout ejecutivo
> usa `requireRole("executive")` estricto — admins no pueden acceder. Pendiente: cambiar
> layout ejecutivo a `requireAnyRole(["executive", "admin"])`.

---

## RBAC — Mapeo completo

### Roles frontend

```
admin      → página home: /dashboard
analyst    → página home: /home
executive  → página home: /overview
```

### Roles backend → frontend (lib/auth/roles.ts)

```
admin        → admin
operador_etl → admin
analista_mdm → analyst
viewer       → executive
```

### Jerarquía backend (nucleo/auth.py)

```python
_JERARQUIA = { "admin": 40, "operador_etl": 30, "analista_mdm": 20, "viewer": 10 }
```

Un usuario admin (40) pasa `require_rol("analista_mdm")` porque 40 ≥ 20.

### Archivos clave RBAC

| Archivo | Qué hace |
|---|---|
| `lib/auth/rbac.ts` | ROUTE_ACL + ROLE_HOME |
| `lib/auth/roles.ts` | mapeo backend→frontend |
| `lib/auth/require-role.ts` | `requireRole` / `requireAnyRole` (server) |
| `lib/auth/session.ts` | `getSession()`, JWT_COOKIE_NAME |
| `proxy.ts` | edge gate (Next.js 16 renombró middleware→proxy) |

---

## Auth Flow

```
1. Usuario visita ruta protegida
   → proxy.ts verifica cookie JWT
   → Sin cookie → redirect /login
   → Cookie inválida → redirect /login
   → Role no permitido en esa ruta → redirect ROLE_HOME[role]

2. Login
   → POST /api/auth/login (Next.js API route → FastAPI)
   → FastAPI valida credenciales, retorna JWT
   → API route setea httpOnly cookie mdm_session
   → Login form llama GET /api/auth/me para obtener role
   → window.location.href = ROLE_HOME[role]  ← hard redirect (evita race condition cookie)

3. Cada layout server component
   → requireRole / requireAnyRole → si falla → redirect

4. Páginas admin-only
   → requireRole("admin") al inicio → doble protección
```

> **Cambio crítico (2026-06-11)**: El login form usaba `router.replace() + router.refresh()`
> que creaba race condition con la cookie httpOnly. Cambiado a `window.location.href`.
> Esto resuelve el "Página no encontrada" en /dashboard tras login de admin.

---

## API Routes (Next.js)

| Ruta | Descripción | Auth |
|---|---|---|
| `POST /api/auth/login` | Proxy a FastAPI /v1/auth/token | pública |
| `GET /api/auth/me` | Decodifica cookie, retorna {role, name, username} | requireApiSession |
| `POST /api/auth/logout` | Borra cookie | requireApiSession |
| `GET /api/cc/*` | Control Center: KPIs, quality, DWH, freshness | requireApiSession |
| `GET /api/v1/**` | Proxy genérico a FastAPI | requireApiSession |

### API CC routes

```
/api/cc/etl/runs          → FastAPI /v1/etl/runs
/api/cc/etl/bitacora      → FastAPI /v1/bitacora
/api/cc/quality/summary   → FastAPI /v1/cuarentena/resumen
/api/cc/quality/trend     → FastAPI /v1/cuarentena/tendencia (NUEVO)
/api/cc/quality/by-table  → FastAPI /v1/cuarentena/por-tabla (NUEVO)
/api/cc/dwh/tables        → FastAPI /v1/dwh/tablas
/api/cc/dwh/freshness     → FastAPI /v1/dwh/freshness
/api/cc/alerts            → FastAPI /v1/alertas
```

---

## Backend FastAPI

- Ruta base: `http://localhost:8000`
- Módulo proyecciones: `backend/api/rutas_proyecciones.py`
- Auth: `backend/nucleo/auth.py`

### Endpoints proyecciones

| Método | Ruta | Role mínimo |
|---|---|---|
| GET | /v1/proyecciones/fechas | viewer |
| GET | /v1/proyecciones/combinaciones/{id_tiempo} | viewer |
| GET | /v1/proyecciones/integridad/{id_tiempo} | viewer |
| GET | /v1/proyecciones/matriz | viewer |
| POST | /v1/proyecciones/matriz | analista_mdm |
| POST | /v1/proyecciones/ejecutar | analista_mdm |

### Base de datos — tablas clave

| Tabla | Columnas relevantes |
|---|---|
| `Config.Parametros_Pipeline` | `Nombre_Parametro` (NO Clave), `Valor`, `Descripcion`, `Modulo` |
| `Silver.Fact_Censo_Plantas` | `Cantidad` + `ID_Estado_Planta` (NO Cantidad_Plantas) |
| `Silver.Fact_Cosecha_SAP` | kg cosechados por variedad/fundo/semana |
| `Gold.Fact_Proyeccion_SixWeek` | resultado del motor de proyecciones |

---

## Bugs Resueltos

| Bug | Archivo | Fix | Commit |
|---|---|---|---|
| `Invalid column name 'Clave'` | `repo_proyecciones.py` | Renombrar a `Nombre_Parametro` | 045e176 |
| `Acceso denegado [usuario=admin2]` | `rutas_proyecciones.py` | `require_rol("analista")` → `require_rol("analista_mdm")` | 045e176 |
| `Invalid column name 'Cantidad_Plantas'` (FastAPI) | `repo_proyecciones.py` | `SUM(f.Cantidad_Plantas)` → `SUM(f.Cantidad)` | 54cd592 |
| `Invalid column name 'Cantidad_Plantas'` (Streamlit) | `acp_mdm_portal/utils/motor_proyecciones.py:446` | `SUM(f.Cantidad_Plantas)` → `SUM(f.Cantidad)` | (2026-06-11) |
| Admin redirigido de rutas analyst | `app/(analyst)/layout.tsx` | `requireRole("analyst")` → `requireAnyRole(["analyst","admin"])` | 41993f0 |
| `/dashboard` "Página no encontrada" | `login-form.tsx` | `router.replace+refresh` → `window.location.href` | (2026-06-11) |
| Analysts accedían a páginas admin-only | dashboard/dwh/bitacora/configuracion/audit page.tsx | `requireRole("admin")` en cada página | (2026-06-11) |
| Widgets analista vacíos — queries a vistas Gold inexistentes | `backend/servicios/servicio_analista_charts.py` | Reescritura completa: `Gold.vw_*` → JOINs directos a `Silver.Fact_Cosecha_SAP` | 8b07d57 |
| Workspace analista siempre vacío — faltaba endpoint `/home` | `backend/api/rutas_analista.py` | GET+PATCH `/v1/analista/home` persiste layout en `Config.Parametros_Pipeline` | 8b07d57 |

---

## Bugs Conocidos / Pendientes

| Bug / Gap | Gravedad | Descripción |
|---|---|---|
| `/alerts`, `/etl-monitor` no accesibles a executives | Media | En `(admin)` group, layout bloquea executives aunque routes.ts los declara permitidos |
| `/overview` no accesible a admins | Baja | Executive layout usa `requireRole("executive")` estricto; admins van a /dashboard igual |

---

## Componentes Clave

| Componente | Ruta | Descripción |
|---|---|---|
| `Dashboard` | `components/control-center/dashboard.tsx` | Dashboard admin con 6 cards Control Center |
| `RoleShell` | `components/layout/role-shell.tsx` | Shell con sidebar + header role-aware |
| `NavSidebar` | `components/layout/nav-sidebar.tsx` | Sidebar con NavGroups dinámicos por rol |
| `KpiCard` | `components/charts/kpi-card.tsx` | Card KPI con trend y color semáforo |
| `DataFreshnessTable` | `components/control-center/data-freshness-table.tsx` | Tabla freshness por fact table |
| `SegmentError` | `components/ui/segment-error.tsx` | Error boundary para error.tsx de cada layout |
| `LoginForm` | `app/(auth)/login/login-form.tsx` | Form login con hard redirect post-auth |

---

## Hooks y Schemas

### Control Center

```
hooks/use-control-center.ts     → useEtlRuns, useQualitySummary, useAlerts, useDwhTables,
                                   useDwhFreshness, useQualityTrend, useQualityByTable
lib/schemas/control-center.ts   → EtlRun, QualitySummary, QualityTrendPoint, QualityByTable,
                                   DwhTable, Alert (Zod schemas)
lib/control-center/dashboard-prefetch.ts → prefetchDashboard() con Promise.allSettled
```

### Proyecciones

```
hooks/use-proyecciones.ts       → useProyecciones, useCombinaciones, useFechas
lib/schemas/proyecciones.ts     → ProyeccionResult, SemanaProyeccion, Combinacion
```

---

## Stack de Tecnologías

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.2.4, App Router |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Tipos | TypeScript 5.x strict |
| State | TanStack Query v5 (server + client) |
| Forms | react-hook-form + zod |
| Icons | lucide-react |
| Charts | Recharts / Plotly.js |
| Auth | JWT httpOnly cookie |
| Backend | FastAPI (Python 3.12) |
| DB | SQL Server — schemas: Bronce, Silver, Gold, MDM, Cuarentena, Config |

---

## Cómo Actualizar Este Documento

Después de cada cambio significativo:
1. Actualizar la sección **Bugs Resueltos** con el fix y commit
2. Actualizar la tabla de páginas si se agrega/elimina una ruta
3. Actualizar la sección **Bugs Conocidos** si se descubre o resuelve algo
4. Actualizar la fecha de "última actualización" al inicio del doc
