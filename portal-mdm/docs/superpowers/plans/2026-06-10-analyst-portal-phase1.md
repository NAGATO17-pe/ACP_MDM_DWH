# Analyst Portal — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el portal del rol `analyst`: RBAC, layout, workspace analítico `/home` con widgets Plotly configurables (drag & drop), y centro de notificaciones `/notifications`.

**Architecture:** Nuevo route group `app/(analyst)/` con `requireRole("analyst")`. El FastAPI (Python) genera figuras Plotly desde el DWH y las devuelve como JSON. Next.js renderiza con `react-plotly.js`. El layout del workspace se persiste por usuario en la BD. Las notificaciones reutilizan el stream SSE existente en `/api/cc/alerts/stream`.

**Tech Stack:** Next.js 14+ App Router, TypeScript, `@dnd-kit/core` + `@dnd-kit/sortable`, `react-plotly.js` + `plotly.js`, FastAPI (Python), `plotly` (Python), `pandas`, `statsmodels`, Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-06-10-analyst-portal-design.md`

**Phase 2 plan:** `docs/superpowers/plans/2026-06-10-analyst-portal-phase2.md` (DWH Explorer, Reportes, páginas read-only)

---

## File map

### Archivos a modificar

| Archivo | Qué cambia |
|---|---|
| `lib/auth/rbac.ts` | Nuevas rutas analyst en `ROUTE_ACL` + `ROLE_HOME` |
| `lib/auth/roles.ts` | `analista_mdm → "analyst"` (era `"admin"`) |
| `lib/routes.ts` | Nuevas entradas `/home` y `/notifications` para analyst |

### Archivos a crear — Frontend

| Archivo | Responsabilidad |
|---|---|
| `app/(analyst)/layout.tsx` | `requireRole("analyst")` + sidebar |
| `app/(analyst)/home/page.tsx` | Server Component, prefetch layout config |
| `app/(analyst)/home/loading.tsx` | Skeleton del workspace |
| `app/(analyst)/home/home-client.tsx` | Grid drag & drop + widget renderer |
| `app/(analyst)/notifications/page.tsx` | Server Component |
| `app/(analyst)/notifications/loading.tsx` | Skeleton |
| `app/(analyst)/notifications/notifications-client.tsx` | Feed de notificaciones |
| `components/analyst/widget-grid.tsx` | dnd-kit sortable grid |
| `components/analyst/widget-card.tsx` | Wrapper con drag handle + acciones |
| `components/analyst/widget-config-modal.tsx` | Modal para crear/editar widget |
| `components/analyst/plotly-widget.tsx` | `<Plot>` wrapper con loading/error states |
| `hooks/use-analyst-home.ts` | Carga/guarda layout + widgets del workspace |
| `hooks/use-analyst-widget.ts` | Fetcher para POST /api/analyst/widget |
| `app/api/analyst/widget/route.ts` | Proxy → FastAPI POST /analyst/widget |
| `app/api/analyst/views/route.ts` | Proxy → FastAPI GET /analyst/views |
| `app/api/analyst/home/route.ts` | CRUD layout workspace (GET/PATCH) |
| `app/api/analyst/notifications/route.ts` | Proxy → FastAPI GET /analyst/notifications |
| `e2e/analyst-portal.spec.ts` | Smoke tests del portal analyst |

### Archivos a crear — Backend Python

> Todos los archivos Python viven en el proyecto FastAPI (`../../../backend/` relativo al portal, o la ruta que use tu entorno).

| Archivo | Responsabilidad |
|---|---|
| `backend/app/routers/analyst.py` | Router FastAPI con los 3 endpoints analyst |
| `backend/app/services/analyst_charts.py` | Lógica pandas + plotly para generar figuras |
| `backend/app/services/analyst_notifications.py` | Lógica para leer alertas/notificaciones |
| `backend/app/schemas/analyst.py` | Pydantic models: WidgetConfig, WidgetResponse, etc. |

---

## Task 1: Actualizar RBAC, roles y routes manifest

**Files:**
- Modify: `lib/auth/rbac.ts`
- Modify: `lib/auth/roles.ts`
- Modify: `lib/routes.ts`

- [ ] **Step 1.1: Agregar rutas analyst a `ROUTE_ACL` en `lib/auth/rbac.ts`**

Reemplazar el bloque `ROUTE_ACL` completo con:

```typescript
export const ROUTE_ACL: ReadonlyArray<{ path: string; roles: ReadonlyArray<Role> }> = [
  { path: "/dashboard",     roles: ["admin"] },
  { path: "/overview",      roles: ["admin", "executive"] },
  { path: "/etl-monitor",   roles: ["admin", "executive"] },
  { path: "/dwh",           roles: ["admin"] },
  { path: "/workflows",     roles: ["admin", "analyst"] },
  { path: "/quality",       roles: ["admin", "analyst"] },
  { path: "/alerts",        roles: ["admin", "executive"] },
  { path: "/home",          roles: ["analyst"] },
  { path: "/notifications", roles: ["analyst", "admin"] },
  { path: "/explore",       roles: ["analyst", "admin"] },
  { path: "/models",        roles: ["analyst", "admin"] },
  { path: "/reports",       roles: ["analyst", "admin"] },
  { path: "/catalogos",     roles: ["admin", "analyst"] },
  { path: "/bitacora",      roles: ["admin"] },
  { path: "/configuracion", roles: ["admin"] },
  { path: "/audit",         roles: ["admin"] },
];
```

Actualizar `ROLE_HOME`:

```typescript
export const ROLE_HOME: Record<Role, string> = {
  analyst:   "/home",
  admin:     "/dashboard",
  executive: "/overview",
};
```

- [ ] **Step 1.2: Mapear `analista_mdm → "analyst"` en `lib/auth/roles.ts`**

En el objeto `BACKEND_TO_FRONTEND`, cambiar:

```typescript
const BACKEND_TO_FRONTEND: Record<BackendRol, Role> = {
  admin: "admin",
  operador_etl: "admin",
  analista_mdm: "analyst",   // era "admin" — cierra deuda intencional
  viewer: "executive",
};
```

- [ ] **Step 1.3: Agregar entradas analyst en `lib/routes.ts`**

Primero añadir `Home` al import de lucide-react (ya existe `Bell` — solo añadir `Home`):

```typescript
import {
  Bell,
  Compass,
  Database,
  FileText,
  FlaskConical,
  GitPullRequestArrow,
  History,
  Home,
  LayoutDashboard,
  Network,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Telescope,
  Workflow,
  type LucideIcon,
} from "lucide-react";
```

Luego en el objeto `ROUTES`, agregar las dos entradas nuevas y actualizar las existentes:

```typescript
// Nueva entrada — workspace analista
home: {
  path: "/home",
  label: "Mi Workspace",
  icon: Home,
  roles: [ANALYST],
  section: "analisis",
  description: "Workspace analítico con widgets configurables.",
},

// Nueva entrada — notificaciones (analyst + admin)
notifications: {
  path: "/notifications",
  label: "Notificaciones",
  icon: Bell,
  roles: [ANALYST, ADMIN],
  section: "analisis",
  description: "Alertas ETL y calidad de datos.",
},

// Actualizar: agregar ANALYST a estas rutas existentes
explore: {
  path: "/explore",
  label: "Exploración DWH",
  icon: Compass,
  roles: [ANALYST, ADMIN],
  section: "analisis",
},
models: {
  path: "/models",
  label: "Modelos",
  icon: FlaskConical,
  roles: [ANALYST, ADMIN],
  section: "analisis",
},
reports: {
  path: "/reports",
  label: "Reportes",
  icon: FileText,
  roles: [ANALYST, ADMIN],
  section: "gobierno",
},
catalogos: {
  path: "/catalogos",
  label: "Catálogos",
  icon: Database,
  roles: [ADMIN, ANALYST],
  section: "gobierno",
},
workflows: {
  path: "/workflows",
  label: "Workflows MDM",
  icon: GitPullRequestArrow,
  roles: [ADMIN, ANALYST],
  section: "operaciones",
  description: "Procesos de homologación y reinyección.",
},
quality: {
  path: "/quality",
  label: "Calidad de datos",
  icon: ShieldCheck,
  roles: [ADMIN, ANALYST],
  section: "operaciones",
  description: "Cuarentena, KPIs y rechazos.",
},
```

- [ ] **Step 1.4: Verificar que TypeScript compila sin errores**

```bash
npx tsc --noEmit
```

Expected: sin errores de tipos.

- [ ] **Step 1.5: Commit**

```bash
git add lib/auth/rbac.ts lib/auth/roles.ts lib/routes.ts
git commit -m "feat(rbac): agregar rutas y rol analyst, mapear analista_mdm→analyst"
```

---

## Task 2: Analyst layout + páginas skeleton

**Files:**
- Create: `app/(analyst)/layout.tsx`
- Create: `app/(analyst)/home/page.tsx`
- Create: `app/(analyst)/home/loading.tsx`
- Create: `app/(analyst)/notifications/page.tsx`
- Create: `app/(analyst)/notifications/loading.tsx`

- [ ] **Step 2.1: Crear `app/(analyst)/layout.tsx`**

```typescript
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";
import { buildNavGroups } from "@/lib/routes";

export default async function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("analyst");
  const navItems = buildNavGroups("analyst").flatMap((g) => g.items);

  return (
    <RoleShell
      role="analyst"
      userName={session.name ?? session.username}
      navItems={navItems}
    >
      {children}
    </RoleShell>
  );
}
```

- [ ] **Step 2.2: Crear `app/(analyst)/home/page.tsx` (stub)**

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mi Workspace" };
export const dynamic = "force-dynamic";

export default function AnalystHomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Mi Workspace</h1>
      <p className="text-muted-foreground mt-1">
        Tu espacio de análisis personal. Próximamente: widgets configurables.
      </p>
    </div>
  );
}
```

- [ ] **Step 2.3: Crear `app/(analyst)/home/loading.tsx`**

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4: Crear `app/(analyst)/notifications/page.tsx` (stub)**

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notificaciones" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Notificaciones</h1>
      <p className="text-muted-foreground mt-1">
        Alertas ETL y calidad de datos.
      </p>
    </div>
  );
}
```

- [ ] **Step 2.5: Crear `app/(analyst)/notifications/loading.tsx`**

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <div className="p-6 space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2.6: Verificar que el layout funciona en dev**

```bash
npm run dev
```

Abrir `http://localhost:3000`. Intentar acceder a `/home` con usuario `analista_mdm` del backend. Debe:
- Redirigir al login si no hay sesión
- Si hay sesión válida con rol `analista_mdm`, mostrar el sidebar de analista y el stub de la página

- [ ] **Step 2.7: Commit**

```bash
git add "app/(analyst)/"
git commit -m "feat(analyst): layout + páginas skeleton home y notifications"
```

---

## Task 3: Backend Python — Schemas y router base

> **Nota:** Todos los archivos de este task viven en el proyecto FastAPI (`backend/`), NO en el portal Next.js.

**Files:**
- Create: `backend/app/schemas/analyst.py`
- Create: `backend/app/routers/analyst.py`
- Modify: `backend/app/main.py` (o donde se registren los routers)

- [ ] **Step 3.1: Instalar dependencias Python**

```bash
cd backend
pip install plotly pandas statsmodels
# Si ya están instalados, esto es no-op
pip freeze | grep -E "plotly|pandas|statsmodels"
```

Expected output incluye las tres librerías con sus versiones.

- [ ] **Step 3.2: Crear `backend/app/schemas/analyst.py`**

```python
from pydantic import BaseModel, Field
from typing import Any, Literal, Optional


class FiltrosWidget(BaseModel):
    fecha_desde: Optional[str] = None   # ISO date "YYYY-MM-DD"
    fecha_hasta: Optional[str] = None
    dimension_valor: Optional[str] = None   # filtro adicional libre


class WidgetConfig(BaseModel):
    tipo: Literal[
        "linea", "barra", "area", "scatter",
        "pie", "kpi", "tabla", "forecast"
    ]
    vista: str                              # nombre de la vista DWH, ej: "vw_cosecha_mensual"
    eje_x: Optional[str] = None
    eje_y: Optional[str] = None
    grupo_by: Optional[str] = None
    metrica: Optional[str] = None          # para tipo "kpi"
    columnas: Optional[list[str]] = None   # para tipo "tabla"
    top_n: int = Field(default=50, ge=1, le=500)
    filtros: FiltrosWidget = Field(default_factory=FiltrosWidget)
    forecast_periodos: int = Field(default=0, ge=0, le=24)


class WidgetResponse(BaseModel):
    data: list[dict[str, Any]]
    layout: dict[str, Any]
    meta: dict[str, Any] = Field(default_factory=dict)


class VistaInfo(BaseModel):
    nombre: str
    label: str
    descripcion: str
    columnas: list[str]
    tipos: dict[str, str]    # columna → tipo ("fecha", "numero", "texto")


class NotificacionItem(BaseModel):
    id: str
    tipo: Literal["etl_failure", "cuarentena", "umbral_calidad", "etl_ok", "info"]
    severidad: Literal["error", "warning", "info"]
    titulo: str
    descripcion: str
    timestamp: str
    leida: bool = False
    link: Optional[str] = None


class NotificacionesResponse(BaseModel):
    items: list[NotificacionItem]
    total: int
    no_leidas: int
```

- [ ] **Step 3.3: Crear `backend/app/routers/analyst.py` (estructura base)**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.analyst import (
    WidgetConfig, WidgetResponse, VistaInfo, NotificacionesResponse
)
from app.services.analyst_charts import generar_figura, listar_vistas
from app.services.analyst_notifications import obtener_notificaciones
from app.dependencies import get_current_user   # ajusta al nombre real de tu dependency

router = APIRouter(prefix="/analyst", tags=["analyst"])


@router.get("/views", response_model=list[VistaInfo])
async def get_analyst_views(current_user=Depends(get_current_user)):
    """Catálogo de vistas analíticas disponibles para widgets."""
    return listar_vistas()


@router.post("/widget", response_model=WidgetResponse)
async def generar_widget(
    config: WidgetConfig,
    current_user=Depends(get_current_user),
):
    """Genera una figura Plotly a partir de la configuración del widget."""
    try:
        return await generar_figura(config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando widget: {e}")


@router.get("/notifications", response_model=NotificacionesResponse)
async def get_notifications(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    severidad: str = Query(default=""),
    current_user=Depends(get_current_user),
):
    """Lista paginada de notificaciones del analista."""
    return await obtener_notificaciones(
        page=page,
        page_size=page_size,
        severidad=severidad or None,
    )
```

- [ ] **Step 3.4: Registrar el router en `backend/app/main.py`**

Agregar junto a los otros routers:

```python
from app.routers.analyst import router as analyst_router

app.include_router(analyst_router, prefix="/api/v1")
# Quedará como: /api/v1/analyst/views, /api/v1/analyst/widget, etc.
```

- [ ] **Step 3.5: Verificar que FastAPI arranca sin errores**

```bash
uvicorn app.main:app --reload
```

Abrir `http://localhost:8000/docs`. Verificar que aparecen los 3 endpoints bajo el tag `analyst`.

- [ ] **Step 3.6: Commit (backend)**

```bash
git add backend/app/schemas/analyst.py backend/app/routers/analyst.py backend/app/main.py
git commit -m "feat(backend): analyst router + schemas Pydantic"
```

---

## Task 4: Backend Python — Servicio de charts (analyst_charts.py)

**Files:**
- Create: `backend/app/services/analyst_charts.py`

- [ ] **Step 4.1: Crear `backend/app/services/analyst_charts.py`**

```python
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from sqlalchemy import text
from app.database import get_engine   # ajusta al nombre real de tu función de engine
from app.schemas.analyst import WidgetConfig, WidgetResponse, VistaInfo


# ── Catálogo de vistas ──────────────────────────────────────────────────────

VISTAS_CATALOG: list[VistaInfo] = [
    VistaInfo(
        nombre="vw_cosecha_mensual",
        label="Cosecha mensual",
        descripcion="Producción mensual por variedad y zona",
        columnas=["fecha", "variedad", "zona", "toneladas", "kg_neto"],
        tipos={"fecha": "fecha", "variedad": "texto", "zona": "texto",
               "toneladas": "numero", "kg_neto": "numero"},
    ),
    VistaInfo(
        nombre="vw_rendimiento_zona",
        label="Rendimiento por zona",
        descripcion="Rendimiento t/ha por zona geográfica y período",
        columnas=["fecha", "zona", "rendimiento_tha", "hectareas"],
        tipos={"fecha": "fecha", "zona": "texto",
               "rendimiento_tha": "numero", "hectareas": "numero"},
    ),
    VistaInfo(
        nombre="vw_cosecha_variedad",
        label="Cosecha por variedad",
        descripcion="Distribución de cosecha por variedad",
        columnas=["variedad", "toneladas", "porcentaje"],
        tipos={"variedad": "texto", "toneladas": "numero", "porcentaje": "numero"},
    ),
    VistaInfo(
        nombre="vw_rendimiento_historico",
        label="Rendimiento histórico",
        descripcion="Serie histórica de rendimiento para proyecciones",
        columnas=["fecha", "rendimiento_tha"],
        tipos={"fecha": "fecha", "rendimiento_tha": "numero"},
    ),
    VistaInfo(
        nombre="vw_correlacion",
        label="Correlación métricas",
        descripcion="Datos para análisis de correlación entre métricas",
        columnas=["fecha", "mm_lluvia", "temperatura_media", "rendimiento_tha", "zona"],
        tipos={"fecha": "fecha", "mm_lluvia": "numero", "temperatura_media": "numero",
               "rendimiento_tha": "numero", "zona": "texto"},
    ),
    VistaInfo(
        nombre="vw_resumen_periodo",
        label="Resumen de período",
        descripcion="Métricas agregadas para KPIs del workspace",
        columnas=["metrica", "valor", "valor_periodo_anterior", "delta_pct"],
        tipos={"metrica": "texto", "valor": "numero",
               "valor_periodo_anterior": "numero", "delta_pct": "numero"},
    ),
]


def listar_vistas() -> list[VistaInfo]:
    return VISTAS_CATALOG


def _get_vista_info(nombre: str) -> VistaInfo:
    for v in VISTAS_CATALOG:
        if v.nombre == nombre:
            return v
    raise ValueError(f"Vista '{nombre}' no existe en el catálogo.")


# ── Carga de datos ──────────────────────────────────────────────────────────

def _cargar_datos(config: WidgetConfig) -> pd.DataFrame:
    _get_vista_info(config.vista)   # valida que la vista existe

    engine = get_engine()
    filtros = config.filtros

    # Construir WHERE dinámico (solo parámetros conocidos — sin SQL injection)
    where_clauses = []
    params: dict = {}

    if filtros.fecha_desde:
        where_clauses.append("fecha >= :fecha_desde")
        params["fecha_desde"] = filtros.fecha_desde
    if filtros.fecha_hasta:
        where_clauses.append("fecha <= :fecha_hasta")
        params["fecha_hasta"] = filtros.fecha_hasta
    if filtros.dimension_valor and config.grupo_by:
        col = config.grupo_by.replace('"', '')   # sanitize
        where_clauses.append(f'"{col}" = :dim_val')
        params["dim_val"] = filtros.dimension_valor

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    query = text(f"SELECT TOP {config.top_n} * FROM Gold.{config.vista} {where_sql}")

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params=params)

    return df


# ── Generadores de figura ───────────────────────────────────────────────────

PLOTLY_DARK_TEMPLATE = "plotly_dark"


def _fig_to_response(fig: go.Figure, df: pd.DataFrame) -> WidgetResponse:
    fig_dict = fig.to_dict()
    return WidgetResponse(
        data=fig_dict["data"],
        layout=fig_dict.get("layout", {}),
        meta={"filas": len(df)},
    )


def _build_linea(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    if not config.eje_x or not config.eje_y:
        raise ValueError("tipo 'linea' requiere eje_x y eje_y.")
    fig = px.line(
        df,
        x=config.eje_x,
        y=config.eje_y,
        color=config.grupo_by,
        template=PLOTLY_DARK_TEMPLATE,
        labels={config.eje_x: config.eje_x, config.eje_y: config.eje_y},
    )
    return fig


def _build_barra(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    if not config.eje_x or not config.eje_y:
        raise ValueError("tipo 'barra' requiere eje_x y eje_y.")
    fig = px.bar(
        df,
        x=config.eje_x,
        y=config.eje_y,
        color=config.grupo_by,
        template=PLOTLY_DARK_TEMPLATE,
        barmode="group",
    )
    return fig


def _build_area(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    if not config.eje_x or not config.eje_y:
        raise ValueError("tipo 'area' requiere eje_x y eje_y.")
    fig = px.area(
        df,
        x=config.eje_x,
        y=config.eje_y,
        color=config.grupo_by,
        template=PLOTLY_DARK_TEMPLATE,
    )
    return fig


def _build_scatter(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    if not config.eje_x or not config.eje_y:
        raise ValueError("tipo 'scatter' requiere eje_x y eje_y.")
    fig = px.scatter(
        df,
        x=config.eje_x,
        y=config.eje_y,
        color=config.grupo_by,
        template=PLOTLY_DARK_TEMPLATE,
    )
    return fig


def _build_pie(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    if not config.eje_x or not config.eje_y:
        raise ValueError("tipo 'pie' requiere eje_x (dimensión) y eje_y (valor).")
    fig = px.pie(
        df,
        names=config.eje_x,
        values=config.eje_y,
        template=PLOTLY_DARK_TEMPLATE,
        hole=0.4,
    )
    return fig


def _build_kpi(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    metrica = config.metrica or (config.eje_y if config.eje_y else None)
    if not metrica:
        raise ValueError("tipo 'kpi' requiere 'metrica' o 'eje_y'.")
    val = df[metrica].sum() if metrica in df.columns else 0
    fig = go.Figure(go.Indicator(
        mode="number+delta",
        value=float(val),
        delta={"reference": float(val) * 0.9, "relative": True},
        domain={"x": [0, 1], "y": [0, 1]},
    ))
    fig.update_layout(template=PLOTLY_DARK_TEMPLATE, margin=dict(t=20, b=20))
    return fig


def _build_tabla(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    cols = config.columnas or list(df.columns[:6])
    df_view = df[cols].head(config.top_n)
    fig = go.Figure(go.Table(
        header=dict(
            values=cols,
            fill_color="#1e293b",
            font=dict(color="#e2e8f0", size=12),
            align="left",
        ),
        cells=dict(
            values=[df_view[c].tolist() for c in cols],
            fill_color="#0a0f1e",
            font=dict(color="#94a3b8", size=11),
            align="left",
        ),
    ))
    fig.update_layout(template=PLOTLY_DARK_TEMPLATE, margin=dict(t=10, b=10))
    return fig


def _build_forecast(config: WidgetConfig, df: pd.DataFrame) -> go.Figure:
    """Holt-Winters simple. Requiere eje_x (fecha) y eje_y (métrica numérica)."""
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    if not config.eje_x or not config.eje_y:
        raise ValueError("tipo 'forecast' requiere eje_x (fecha) y eje_y.")

    df = df.sort_values(config.eje_x)
    serie = df[config.eje_y].dropna()

    if len(serie) < 4:
        raise ValueError("Se necesitan al menos 4 puntos históricos para forecast.")

    n = config.forecast_periodos or 3
    model = ExponentialSmoothing(serie, trend="add", seasonal=None)
    fit = model.fit(optimized=True)
    forecast = fit.forecast(n)

    x_hist = df[config.eje_x].tolist()
    y_hist = df[config.eje_y].tolist()

    # Generar fechas futuras simples (asume períodos mensuales)
    try:
        last_date = pd.to_datetime(x_hist[-1])
        x_future = [
            (last_date + pd.DateOffset(months=i + 1)).strftime("%Y-%m")
            for i in range(n)
        ]
    except Exception:
        x_future = [f"T+{i+1}" for i in range(n)]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=x_hist, y=y_hist,
        mode="lines+markers", name="Histórico",
        line=dict(color="#60a5fa"),
    ))
    fig.add_trace(go.Scatter(
        x=x_future, y=forecast.tolist(),
        mode="lines+markers", name="Proyección",
        line=dict(color="#a78bfa", dash="dot"),
    ))
    fig.update_layout(template=PLOTLY_DARK_TEMPLATE)
    return fig


# ── Dispatcher ──────────────────────────────────────────────────────────────

_BUILDERS = {
    "linea":    _build_linea,
    "barra":    _build_barra,
    "area":     _build_area,
    "scatter":  _build_scatter,
    "pie":      _build_pie,
    "kpi":      _build_kpi,
    "tabla":    _build_tabla,
    "forecast": _build_forecast,
}


async def generar_figura(config: WidgetConfig) -> WidgetResponse:
    builder = _BUILDERS.get(config.tipo)
    if not builder:
        raise ValueError(f"Tipo de widget desconocido: {config.tipo}")
    df = _cargar_datos(config)
    if df.empty:
        raise ValueError(f"La vista '{config.vista}' no devolvió datos para los filtros aplicados.")
    fig = builder(config, df)
    return _fig_to_response(fig, df)
```

- [ ] **Step 4.2: Test manual del endpoint desde Swagger**

Con FastAPI corriendo (`uvicorn app.main:app --reload`), ir a `http://localhost:8000/docs`.

En `POST /api/v1/analyst/widget`, probar:

```json
{
  "tipo": "barra",
  "vista": "vw_cosecha_variedad",
  "eje_x": "variedad",
  "eje_y": "toneladas",
  "filtros": {}
}
```

Expected: respuesta 200 con campos `data`, `layout`, `meta`.

- [ ] **Step 4.3: Commit**

```bash
git add backend/app/services/analyst_charts.py
git commit -m "feat(backend): servicio de charts Python con Plotly + statsmodels forecast"
```

---

## Task 5: Backend Python — Servicio de notificaciones

**Files:**
- Create: `backend/app/services/analyst_notifications.py`

- [ ] **Step 5.1: Crear `backend/app/services/analyst_notifications.py`**

```python
import uuid
from datetime import datetime, timedelta
from sqlalchemy import text
from app.database import get_engine
from app.schemas.analyst import NotificacionItem, NotificacionesResponse


async def obtener_notificaciones(
    page: int = 1,
    page_size: int = 25,
    severidad: str | None = None,
) -> NotificacionesResponse:
    """
    Lee alertas/eventos de la BD y los transforma en NotificacionItem.
    Ajusta la query a la tabla real de alertas/bitácora de tu DWH.
    """
    engine = get_engine()

    # Ajusta el nombre de tabla y columnas a tu esquema real
    # Ejemplo base con tabla de bitácora/alertas
    where = "WHERE 1=1"
    params: dict = {"offset": (page - 1) * page_size, "limit": page_size}

    if severidad:
        where += " AND severidad = :severidad"
        params["severidad"] = severidad

    query_items = text(f"""
        SELECT TOP (:limit) *
        FROM (
            SELECT
                ROW_NUMBER() OVER (ORDER BY timestamp DESC) AS rn,
                CAST(id AS VARCHAR(36)) AS id,
                tipo,
                severidad,
                titulo,
                descripcion,
                CONVERT(VARCHAR(30), timestamp, 126) AS timestamp,
                leida,
                link
            FROM MDM.Alertas
            {where}
        ) AS paged
        WHERE rn > :offset
    """)

    query_count = text(f"SELECT COUNT(*) AS total FROM MDM.Alertas {where}")
    query_unread = text(
        f"SELECT COUNT(*) AS total FROM MDM.Alertas {where} AND leida = 0"
    )

    with engine.connect() as conn:
        rows = conn.execute(query_items, params).fetchall()
        total = conn.execute(query_count, params).scalar() or 0
        no_leidas = conn.execute(query_unread, params).scalar() or 0

    items = [
        NotificacionItem(
            id=row.id,
            tipo=row.tipo,
            severidad=row.severidad,
            titulo=row.titulo,
            descripcion=row.descripcion,
            timestamp=row.timestamp,
            leida=bool(row.leida),
            link=row.link,
        )
        for row in rows
    ]

    return NotificacionesResponse(items=items, total=total, no_leidas=no_leidas)
```

> **Nota:** Ajusta los nombres de tabla/columnas a tu esquema real. Si no existe una tabla `MDM.Alertas`, usa la tabla de bitácora o eventos que ya tenga el DWH.

- [ ] **Step 5.2: Commit**

```bash
git add backend/app/services/analyst_notifications.py
git commit -m "feat(backend): servicio de notificaciones analyst"
```

---

## Task 6: Next.js — API proxy routes

**Files:**
- Create: `app/api/analyst/views/route.ts`
- Create: `app/api/analyst/widget/route.ts`
- Create: `app/api/analyst/home/route.ts`
- Create: `app/api/analyst/notifications/route.ts`

- [ ] **Step 6.1: Crear `app/api/analyst/views/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  try {
    const views = await fastapiFetch("/api/v1/analyst/views");
    return NextResponse.json(views);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error interno" }, { status: 502 });
  }
}
```

- [ ] **Step 6.2: Crear `app/api/analyst/widget/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Body inválido" }, { status: 400 });
  }

  try {
    const figure = await fastapiFetch("/api/v1/analyst/widget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 30_000,   // charts pueden tardar más
    });
    return NextResponse.json(figure);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error generando widget" }, { status: 502 });
  }
}
```

- [ ] **Step 6.3: Crear `app/api/analyst/home/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

/** GET: carga el layout guardado del workspace del usuario actual */
export async function GET() {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  try {
    const layout = await fastapiFetch("/api/v1/analyst/home");
    return NextResponse.json(layout);
  } catch (err) {
    if (err instanceof FastApiError && err.status === 404) {
      // Sin layout guardado → devolver layout por defecto
      return NextResponse.json({ widgets: [], savedAt: null });
    }
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error cargando workspace" }, { status: 502 });
  }
}

/** PATCH: guarda el layout del workspace */
export async function PATCH(req: NextRequest) {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Body inválido" }, { status: 400 });
  }

  try {
    const result = await fastapiFetch("/api/v1/analyst/home", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error guardando workspace" }, { status: 502 });
  }
}
```

- [ ] **Step 6.4: Crear `app/api/analyst/notifications/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { requireApiRole } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error } = await requireApiRole("analyst");
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("page_size") ?? "25";
  const severidad = searchParams.get("severidad") ?? "";

  const params = new URLSearchParams({ page, page_size: pageSize });
  if (severidad) params.set("severidad", severidad);

  try {
    const data = await fastapiFetch(`/api/v1/analyst/notifications?${params}`);
    return NextResponse.json(data, {
      headers: { "cache-control": "private, max-age=15, stale-while-revalidate=30" },
    });
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json({ detail: "Error cargando notificaciones" }, { status: 502 });
  }
}
```

- [ ] **Step 6.5: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6.6: Commit**

```bash
git add app/api/analyst/
git commit -m "feat(api): proxy routes analyst — views, widget, home, notifications"
```

---

## Task 7: Frontend — Plotly widget component

**Files:**
- Create: `components/analyst/plotly-widget.tsx`

- [ ] **Step 7.1: Instalar react-plotly.js**

```bash
npm install react-plotly.js plotly.js
npm install --save-dev @types/react-plotly.js
```

- [ ] **Step 7.2: Crear `components/analyst/plotly-widget.tsx`**

```typescript
"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// react-plotly.js no soporta SSR — importar dinámico
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-full min-h-[160px] rounded-lg" />,
});

export interface PlotlyFigure {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  meta?: Record<string, unknown>;
}

interface PlotlyWidgetProps {
  figure: PlotlyFigure | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function PlotlyWidget({
  figure,
  loading = false,
  error = null,
  className,
}: PlotlyWidgetProps) {
  if (loading) {
    return <Skeleton className={cn("w-full min-h-[160px] rounded-lg", className)} />;
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center min-h-[120px] rounded-lg",
          "bg-destructive/10 text-destructive text-sm px-4 text-center",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (!figure) {
    return (
      <div
        className={cn(
          "flex items-center justify-center min-h-[120px] rounded-lg",
          "bg-muted/30 text-muted-foreground text-sm",
          className,
        )}
      >
        Sin datos
      </div>
    );
  }

  const layout: Partial<Plotly.Layout> = {
    autosize: true,
    margin: { t: 30, b: 40, l: 40, r: 10 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: "#e2e8f0", size: 11 },
    ...figure.layout,
  };

  return (
    <Plot
      data={figure.data}
      layout={layout}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%", height: "100%" }}
      className={className}
    />
  );
}
```

- [ ] **Step 7.3: Crear `hooks/use-analyst-widget.ts`**

```typescript
"use client";

import { useState } from "react";
import type { PlotlyFigure } from "@/components/analyst/plotly-widget";

interface WidgetConfig {
  tipo: string;
  vista: string;
  eje_x?: string;
  eje_y?: string;
  grupo_by?: string;
  metrica?: string;
  columnas?: string[];
  top_n?: number;
  filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    dimension_valor?: string;
  };
  forecast_periodos?: number;
}

interface UseAnalystWidgetResult {
  figure: PlotlyFigure | null;
  loading: boolean;
  error: string | null;
  fetchWidget: (config: WidgetConfig) => Promise<void>;
}

export function useAnalystWidget(): UseAnalystWidgetResult {
  const [figure, setFigure] = useState<PlotlyFigure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchWidget(config: WidgetConfig) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyst/widget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? `Error ${res.status}`);
      }
      const fig = (await res.json()) as PlotlyFigure;
      setFigure(fig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return { figure, loading, error, fetchWidget };
}
```

- [ ] **Step 7.4: Commit**

```bash
git add components/analyst/plotly-widget.tsx hooks/use-analyst-widget.ts
git commit -m "feat(analyst): PlotlyWidget component + useAnalystWidget hook"
```

---

## Task 8: Frontend — Widget config modal

**Files:**
- Create: `components/analyst/widget-config-modal.tsx`

- [ ] **Step 8.1: Crear `components/analyst/widget-config-modal.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const WIDGET_TYPES = [
  { value: "linea",    label: "📉 Línea de tiempo" },
  { value: "barra",    label: "📊 Barras" },
  { value: "area",     label: "📈 Área" },
  { value: "scatter",  label: "🔵 Dispersión" },
  { value: "pie",      label: "🥧 Torta / Donut" },
  { value: "kpi",      label: "🔢 KPI Card" },
  { value: "tabla",    label: "📋 Tabla de datos" },
  { value: "forecast", label: "📐 Proyección / Forecast" },
] as const;

export type WidgetTipo = (typeof WIDGET_TYPES)[number]["value"];

export interface WidgetConfigFormData {
  id: string;
  titulo: string;
  tipo: WidgetTipo;
  vista: string;
  eje_x: string;
  eje_y: string;
  grupo_by: string;
  fecha_desde: string;
  fecha_hasta: string;
  forecast_periodos: number;
  top_n: number;
  size: "sm" | "md" | "lg";
}

interface VistaInfo {
  nombre: string;
  label: string;
  columnas: string[];
}

interface WidgetConfigModalProps {
  open: boolean;
  initial?: Partial<WidgetConfigFormData>;
  onClose: () => void;
  onSave: (config: WidgetConfigFormData) => void;
}

const DEFAULT_FORM: WidgetConfigFormData = {
  id: "",
  titulo: "",
  tipo: "linea",
  vista: "",
  eje_x: "",
  eje_y: "",
  grupo_by: "",
  fecha_desde: "",
  fecha_hasta: "",
  forecast_periodos: 3,
  top_n: 50,
  size: "md",
};

export function WidgetConfigModal({
  open,
  initial,
  onClose,
  onSave,
}: WidgetConfigModalProps) {
  const [form, setForm] = useState<WidgetConfigFormData>({ ...DEFAULT_FORM, ...initial });
  const [views, setViews] = useState<VistaInfo[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...DEFAULT_FORM, ...initial });
    setLoadingViews(true);
    fetch("/api/analyst/views", { credentials: "include" })
      .then((r) => r.json())
      .then((data: VistaInfo[]) => setViews(data))
      .catch(() => setViews([]))
      .finally(() => setLoadingViews(false));
  }, [open]);

  const selectedView = views.find((v) => v.nombre === form.vista);
  const columns = selectedView?.columnas ?? [];

  function set<K extends keyof WidgetConfigFormData>(
    key: K,
    value: WidgetConfigFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.tipo || !form.vista) return;
    const id = form.id || crypto.randomUUID();
    const titulo = form.titulo || `Widget ${form.tipo}`;
    onSave({ ...form, id, titulo });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Editar widget" : "Nuevo widget"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Título */}
          <div className="space-y-1">
            <Label>Título del widget</Label>
            <Input
              placeholder="ej: Cosecha por variedad"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1">
            <Label>Tipo de gráfica</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v as WidgetTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WIDGET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vista DWH */}
          <div className="space-y-1">
            <Label>Vista del DWH</Label>
            <Select value={form.vista} onValueChange={(v) => set("vista", v)}>
              <SelectTrigger>
                <SelectValue placeholder={loadingViews ? "Cargando..." : "Seleccionar vista"} />
              </SelectTrigger>
              <SelectContent>
                {views.map((v) => (
                  <SelectItem key={v.nombre} value={v.nombre}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ejes (solo si hay vista seleccionada y el tipo los necesita) */}
          {columns.length > 0 && form.tipo !== "kpi" && form.tipo !== "tabla" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Eje X / Dimensión</Label>
                <Select value={form.eje_x} onValueChange={(v) => set("eje_x", v)}>
                  <SelectTrigger><SelectValue placeholder="Columna" /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Eje Y / Métrica</Label>
                <Select value={form.eje_y} onValueChange={(v) => set("eje_y", v)}>
                  <SelectTrigger><SelectValue placeholder="Columna" /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Grupo by */}
          {columns.length > 0 && !["kpi", "tabla", "scatter"].includes(form.tipo) && (
            <div className="space-y-1">
              <Label>Agrupar por (opcional)</Label>
              <Select value={form.grupo_by} onValueChange={(v) => set("grupo_by", v)}>
                <SelectTrigger><SelectValue placeholder="(ninguno)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">(ninguno)</SelectItem>
                  {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Forecast periodos */}
          {form.tipo === "forecast" && (
            <div className="space-y-1">
              <Label>Períodos a proyectar</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.forecast_periodos}
                onChange={(e) => set("forecast_periodos", Number(e.target.value))}
              />
            </div>
          )}

          {/* Tamaño */}
          <div className="space-y-1">
            <Label>Tamaño en el grid</Label>
            <Select value={form.size} onValueChange={(v) => set("size", v as "sm" | "md" | "lg")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeño (1×1)</SelectItem>
                <SelectItem value="md">Mediano (2×1)</SelectItem>
                <SelectItem value="lg">Grande (2×2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!form.tipo || !form.vista}
          >
            {initial?.id ? "Guardar cambios" : "Agregar widget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8.2: Commit**

```bash
git add components/analyst/widget-config-modal.tsx
git commit -m "feat(analyst): WidgetConfigModal para crear/editar widgets"
```

---

## Task 9: Frontend — Widget grid con dnd-kit

**Files:**
- Create: `components/analyst/widget-card.tsx`
- Create: `components/analyst/widget-grid.tsx`

- [ ] **Step 9.1: Instalar dnd-kit**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 9.2: Crear `components/analyst/widget-card.tsx`**

```typescript
"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  id: string;
  titulo: string;
  size: "sm" | "md" | "lg";
  editMode: boolean;
  onEdit: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "col-span-1 row-span-1",
  md: "col-span-2 row-span-1",
  lg: "col-span-2 row-span-2",
};

export function WidgetCard({
  id,
  titulo,
  size,
  editMode,
  onEdit,
  onRemove,
  children,
}: WidgetCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex flex-col rounded-xl border bg-card",
        SIZE_CLASSES[size],
        isDragging && "opacity-50 z-50 shadow-2xl",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold text-muted-foreground truncate">
          {titulo}
        </span>
        {editMode && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Arrastrar widget"
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onEdit}
              aria-label="Editar widget"
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={onRemove}
              aria-label="Eliminar widget"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {/* Body */}
      <div className="flex-1 p-3 min-h-[120px]">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 9.3: Crear `components/analyst/widget-grid.tsx`**

```typescript
"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Plus, Save, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "./widget-card";
import { PlotlyWidget } from "./plotly-widget";
import type { WidgetConfigFormData } from "./widget-config-modal";
import type { PlotlyFigure } from "./plotly-widget";

export interface WidgetState extends WidgetConfigFormData {
  figure: PlotlyFigure | null;
  loading: boolean;
  error: string | null;
}

interface WidgetGridProps {
  widgets: WidgetState[];
  editMode: boolean;
  saving: boolean;
  onReorder: (newOrder: WidgetState[]) => void;
  onAddWidget: () => void;
  onEditWidget: (id: string) => void;
  onRemoveWidget: (id: string) => void;
  onToggleEdit: () => void;
  onSave: () => void;
}

export function WidgetGrid({
  widgets,
  editMode,
  saving,
  onReorder,
  onAddWidget,
  onEditWidget,
  onRemoveWidget,
  onToggleEdit,
  onSave,
}: WidgetGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === active.id);
    const newIdx = widgets.findIndex((w) => w.id === over.id);
    onReorder(arrayMove(widgets, oldIdx, newIdx));
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mi Workspace</h1>
        <div className="flex gap-2">
          {editMode && (
            <Button size="sm" onClick={onAddWidget}>
              <Plus className="h-4 w-4 mr-1" /> Widget
            </Button>
          )}
          {editMode ? (
            <Button size="sm" onClick={onSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleEdit}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            {editMode ? "Salir de edición" : "Editar layout"}
          </Button>
        </div>
      </div>

      {/* Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-4 auto-rows-[160px]">
            {widgets.map((w) => (
              <WidgetCard
                key={w.id}
                id={w.id}
                titulo={w.titulo}
                size={w.size}
                editMode={editMode}
                onEdit={() => onEditWidget(w.id)}
                onRemove={() => onRemoveWidget(w.id)}
              >
                <PlotlyWidget
                  figure={w.figure}
                  loading={w.loading}
                  error={w.error}
                  className="h-full"
                />
              </WidgetCard>
            ))}

            {/* Slot de agregar (solo en modo edición) */}
            {editMode && (
              <button
                onClick={onAddWidget}
                className="col-span-1 row-span-1 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">Agregar</span>
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Estado vacío */}
      {widgets.length === 0 && !editMode && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <LayoutGrid className="h-10 w-10 opacity-30" />
          <p className="text-sm">Tu workspace está vacío.</p>
          <Button variant="outline" size="sm" onClick={onToggleEdit}>
            Empezar a configurar widgets
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 9.4: Commit**

```bash
git add components/analyst/widget-card.tsx components/analyst/widget-grid.tsx
git commit -m "feat(analyst): WidgetCard + WidgetGrid con dnd-kit drag & drop"
```

---

## Task 10: Frontend — Home page completa + persistencia de layout

**Files:**
- Create: `hooks/use-analyst-home.ts`
- Modify: `app/(analyst)/home/page.tsx`
- Create: `app/(analyst)/home/home-client.tsx`

- [ ] **Step 10.1: Crear `hooks/use-analyst-home.ts`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { WidgetConfigFormData } from "@/components/analyst/widget-config-modal";
import type { PlotlyFigure } from "@/components/analyst/plotly-widget";
import type { WidgetState } from "@/components/analyst/widget-grid";

interface SavedLayout {
  widgets: WidgetConfigFormData[];
  savedAt: string | null;
}

interface UseAnalystHomeResult {
  widgets: WidgetState[];
  editMode: boolean;
  saving: boolean;
  toggleEditMode: () => void;
  addWidget: (config: WidgetConfigFormData) => Promise<void>;
  updateWidget: (config: WidgetConfigFormData) => Promise<void>;
  removeWidget: (id: string) => void;
  reorderWidgets: (newOrder: WidgetState[]) => void;
  saveLayout: () => Promise<void>;
}

async function fetchFigure(config: WidgetConfigFormData): Promise<PlotlyFigure | null> {
  try {
    const res = await fetch("/api/analyst/widget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        tipo: config.tipo,
        vista: config.vista,
        eje_x: config.eje_x || undefined,
        eje_y: config.eje_y || undefined,
        grupo_by: config.grupo_by || undefined,
        metrica: config.tipo === "kpi" ? config.eje_y : undefined,
        columnas: config.tipo === "tabla" ? config.columnas : undefined,
        top_n: config.top_n,
        filtros: {
          fecha_desde: config.fecha_desde || undefined,
          fecha_hasta: config.fecha_hasta || undefined,
        },
        forecast_periodos: config.tipo === "forecast" ? config.forecast_periodos : 0,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function useAnalystHome(): UseAnalystHomeResult {
  const [widgets, setWidgets] = useState<WidgetState[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carga el layout guardado al montar
  useEffect(() => {
    fetch("/api/analyst/home", { credentials: "include" })
      .then((r) => r.json())
      .then(async (saved: SavedLayout) => {
        if (!saved.widgets?.length) return;
        const initial: WidgetState[] = saved.widgets.map((c) => ({
          ...c,
          figure: null,
          loading: true,
          error: null,
        }));
        setWidgets(initial);
        // Cargar figuras en paralelo
        const figures = await Promise.all(saved.widgets.map(fetchFigure));
        setWidgets((prev) =>
          prev.map((w, i) => ({
            ...w,
            figure: figures[i],
            loading: false,
            error: figures[i] ? null : "No se pudo cargar",
          })),
        );
      })
      .catch(() => {}); // Sin layout guardado — workspace vacío
  }, []);

  const toggleEditMode = useCallback(() => setEditMode((p) => !p), []);

  const addWidget = useCallback(async (config: WidgetConfigFormData) => {
    const newWidget: WidgetState = {
      ...config,
      figure: null,
      loading: true,
      error: null,
    };
    setWidgets((prev) => [...prev, newWidget]);
    const figure = await fetchFigure(config);
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === config.id
          ? { ...w, figure, loading: false, error: figure ? null : "No se pudo cargar" }
          : w,
      ),
    );
  }, []);

  const updateWidget = useCallback(async (config: WidgetConfigFormData) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === config.id ? { ...w, ...config, loading: true, error: null } : w,
      ),
    );
    const figure = await fetchFigure(config);
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === config.id
          ? { ...w, figure, loading: false, error: figure ? null : "No se pudo cargar" }
          : w,
      ),
    );
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetState[]) => {
    setWidgets(newOrder);
  }, []);

  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      const payload: SavedLayout = {
        widgets: widgets.map(({ figure: _f, loading: _l, error: _e, ...config }) => config),
        savedAt: new Date().toISOString(),
      };
      await fetch("/api/analyst/home", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
    } finally {
      setSaving(false);
    }
  }, [widgets]);

  return {
    widgets,
    editMode,
    saving,
    toggleEditMode,
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    saveLayout,
  };
}
```

- [ ] **Step 10.2: Crear `app/(analyst)/home/home-client.tsx`**

```typescript
"use client";

import { useState } from "react";
import { WidgetGrid } from "@/components/analyst/widget-grid";
import { WidgetConfigModal } from "@/components/analyst/widget-config-modal";
import type { WidgetConfigFormData } from "@/components/analyst/widget-config-modal";
import { useAnalystHome } from "@/hooks/use-analyst-home";

export function HomeClient() {
  const {
    widgets,
    editMode,
    saving,
    toggleEditMode,
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    saveLayout,
  } = useAnalystHome();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<
    Partial<WidgetConfigFormData> | undefined
  >(undefined);

  function handleOpenAdd() {
    setEditingWidget(undefined);
    setModalOpen(true);
  }

  function handleOpenEdit(id: string) {
    const w = widgets.find((x) => x.id === id);
    if (w) setEditingWidget(w);
    setModalOpen(true);
  }

  async function handleModalSave(config: WidgetConfigFormData) {
    setModalOpen(false);
    if (editingWidget?.id) {
      await updateWidget(config);
    } else {
      await addWidget(config);
    }
  }

  return (
    <>
      <div className="p-6">
        <WidgetGrid
          widgets={widgets}
          editMode={editMode}
          saving={saving}
          onReorder={reorderWidgets}
          onAddWidget={handleOpenAdd}
          onEditWidget={handleOpenEdit}
          onRemoveWidget={removeWidget}
          onToggleEdit={toggleEditMode}
          onSave={saveLayout}
        />
      </div>

      <WidgetConfigModal
        open={modalOpen}
        initial={editingWidget}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
      />
    </>
  );
}
```

- [ ] **Step 10.3: Actualizar `app/(analyst)/home/page.tsx` para usar el client**

```typescript
import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const metadata: Metadata = { title: "Mi Workspace" };
export const dynamic = "force-dynamic";

export default function AnalystHomePage() {
  return <HomeClient />;
}
```

- [ ] **Step 10.4: Commit**

```bash
git add hooks/use-analyst-home.ts "app/(analyst)/home/"
git commit -m "feat(analyst): workspace /home completo — drag & drop + persistencia"
```

---

## Task 11: Frontend — Notifications page

**Files:**
- Create: `app/(analyst)/notifications/notifications-client.tsx`
- Modify: `app/(analyst)/notifications/page.tsx`

- [ ] **Step 11.1: Crear `app/(analyst)/notifications/notifications-client.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

interface NotificacionItem {
  id: string;
  tipo: "etl_failure" | "cuarentena" | "umbral_calidad" | "etl_ok" | "info";
  severidad: "error" | "warning" | "info";
  titulo: string;
  descripcion: string;
  timestamp: string;
  leida: boolean;
  link?: string | null;
}

interface NotificacionesResponse {
  items: NotificacionItem[];
  total: number;
  no_leidas: number;
}

const SEVERIDAD_ICON: Record<string, React.ElementType> = {
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const SEVERIDAD_COLOR: Record<string, string> = {
  error:   "text-destructive",
  warning: "text-yellow-500",
  info:    "text-blue-400",
};

const TIPO_LABEL: Record<string, string> = {
  etl_failure:     "ETL Failure",
  cuarentena:      "Cuarentena",
  umbral_calidad:  "Umbral calidad",
  etl_ok:          "ETL OK",
  info:            "Info",
};

export function NotificationsClient() {
  const [severidad, setSeveridad] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery<NotificacionesResponse>({
    queryKey: ["analyst", "notifications", severidad],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", page_size: "50" });
      if (severidad) params.set("severidad", severidad);
      const res = await fetch(`/api/analyst/notifications?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Error cargando notificaciones");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          {data && data.no_leidas > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {data.no_leidas} sin leer
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={severidad} onValueChange={setSeveridad}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="error">Solo errores</SelectItem>
              <SelectItem value="warning">Solo warnings</SelectItem>
              <SelectItem value="info">Solo info</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <CheckCircle2 className="h-8 w-8 opacity-30" />
          <p className="text-sm">Sin notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => {
            const Icon = SEVERIDAD_ICON[n.severidad] ?? Info;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 p-4 rounded-xl border transition-colors",
                  !n.leida
                    ? "bg-muted/40 border-border"
                    : "bg-background border-border/50 opacity-70",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    SEVERIDAD_COLOR[n.severidad],
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold">{n.titulo}</span>
                    <Badge variant="secondary" className="text-xs">
                      {TIPO_LABEL[n.tipo] ?? n.tipo}
                    </Badge>
                    {!n.leida && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.descripcion}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {formatDateTime(n.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 11.2: Actualizar `app/(analyst)/notifications/page.tsx`**

```typescript
import type { Metadata } from "next";
import { NotificationsClient } from "./notifications-client";

export const metadata: Metadata = { title: "Notificaciones" };
export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  return <NotificationsClient />;
}
```

- [ ] **Step 11.3: Commit**

```bash
git add "app/(analyst)/notifications/"
git commit -m "feat(analyst): página de notificaciones con filtros y polling"
```

---

## Task 12: E2E smoke test — Analyst portal

**Files:**
- Create: `e2e/analyst-portal.spec.ts`

- [ ] **Step 12.1: Crear `e2e/analyst-portal.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

// Requiere un usuario con rol analista_mdm en el backend de test
// Ajusta las credenciales al entorno de testing
const ANALYST_USER = {
  username: process.env.TEST_ANALYST_USER ?? "analista_test",
  password: process.env.TEST_ANALYST_PASS ?? "pass_test",
};

test.describe("Portal Analista", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/usuario/i).fill(ANALYST_USER.username);
    await page.getByLabel(/contraseña/i).fill(ANALYST_USER.password);
    await page.getByRole("button", { name: /ingresar/i }).click();
    await page.waitForURL("/home");
  });

  test("redirige a /home tras login como analista", async ({ page }) => {
    await expect(page).toHaveURL("/home");
    await expect(page.getByText("Mi Workspace")).toBeVisible();
  });

  test("sidebar muestra rutas de analista", async ({ page }) => {
    await expect(page.getByRole("link", { name: /workspace/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /notificaciones/i })).toBeVisible();
    // No debe aparecer Dashboard admin
    await expect(page.getByRole("link", { name: /^dashboard$/i })).not.toBeVisible();
  });

  test("analista NO puede acceder a /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Debe redirigir a login o a /home (nunca mostrar el admin dashboard)
    await expect(page).not.toHaveURL("/dashboard");
  });

  test("analista puede abrir modal de agregar widget", async ({ page }) => {
    await page.getByRole("button", { name: /editar layout/i }).click();
    await page.getByRole("button", { name: /widget/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Nuevo widget")).toBeVisible();
  });

  test("página de notificaciones carga", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByText("Notificaciones")).toBeVisible();
    // No debe mostrar error 403/500
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });
});
```

- [ ] **Step 12.2: Verificar que los tests Playwright arrancan**

```bash
npx playwright test e2e/analyst-portal.spec.ts --headed
```

Expected: Los tests pasan o fallan con mensajes de "element not found" (no errores de red o 403 si el backend de test está configurado).

- [ ] **Step 12.3: Commit final de Phase 1**

```bash
git add e2e/analyst-portal.spec.ts
git commit -m "test(e2e): smoke tests del portal analista — Phase 1"
```

---

## Resumen de Phase 1

Al terminar este plan el portal tendrá:

- ✅ Rol `analyst` funcional — `analista_mdm` del backend aterriza en `/home`
- ✅ Layout analista con sidebar propio sin rutas admin
- ✅ Workspace `/home` con drag & drop, 8 tipos de widget, modal de configuración, persistencia
- ✅ Charts generados por Python (Plotly + pandas + statsmodels) — sin carga en el browser
- ✅ Forecast/proyección disponible como tipo de widget
- ✅ Centro de notificaciones `/notifications` con filtros y polling
- ✅ RBAC actualizado: quality, catalogos, workflows ahora incluyen analyst (Phase 2 los implementa)
- ✅ E2E smoke tests para el flujo analista

**Siguiente paso:** `docs/superpowers/plans/2026-06-10-analyst-portal-phase2.md`
(DWH Explorer, Reportes, páginas read-only de Quality/Catálogos/Workflows)
