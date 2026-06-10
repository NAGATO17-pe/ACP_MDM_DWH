# Spec: Portal Analista — Diseño completo

**Fecha:** 2026-06-10  
**Autor:** carlo  
**Estado:** Aprobado — listo para plan de implementación

---

## Contexto

El Portal MDM tiene hoy un grupo de rutas `(admin)` completamente funcional para el
administrador de base de datos. Este spec define el grupo de rutas `(analyst)` para
el rol **analista** (`analista_mdm` en el backend → `analyst` en el frontend).

Las rutas `/explore`, `/models` y `/reports` ya están declaradas en el RBAC pero
sin implementación. Los módulos de calidad, catálogos y workflows existen solo para
`admin`. Este spec cierra esa deuda.

---

## Decisiones de diseño confirmadas

| Decisión | Elección | Razón |
|---|---|---|
| Estructura de rutas | Nuevo route group `(analyst)` | Aislamiento limpio, propio `requireRole("analyst")` |
| Dashboard | Mini BI con widgets configurables (Opción C) | Sin licencias externas, drag & drop real, viable en Fase 1 |
| Generación de charts | **Python (FastAPI + Plotly)** | pandas para datos, Plotly interactivo, statsmodels/Prophet para forecast |
| Renderizado de charts | `react-plotly.js` en frontend | Recibe JSON de figura — cero procesamiento en browser |
| Forecasting | statsmodels (Holt-Winters/OLS) + Prophet opcional | Prophet maneja estacionalidad agrícola anual |
| Páginas read-only | Versiones separadas de quality/catalogos/workflows | Sin duplicar lógica pesada, sin controles de mutación |
| Módulo Modelos | **Pospuesto** — ideas en `docs/ideas-modelos.md` | Sin demanda validada, depende de Fases 1 y 2 |

---

## Roles y RBAC

### Cambio requerido en `lib/auth/rbac.ts`

Agregar las siguientes rutas con rol `analyst`:

```
{ path: "/home",          roles: ["analyst"] }             // workspace analítico (NO compartir con admin)
{ path: "/notifications", roles: ["admin", "analyst"] }
{ path: "/explore",       roles: ["analyst", "admin"] }    // ya existe, agregar implementación
{ path: "/reports",       roles: ["analyst", "admin"] }    // ya existe, agregar implementación
{ path: "/catalogos",     roles: ["admin", "analyst"] }    // analyst = read-only
{ path: "/workflows",     roles: ["admin", "analyst"] }    // analyst = read-only
{ path: "/quality",       roles: ["admin", "analyst"] }    // analyst = read-only
```

> **Importante:** el analyst workspace vive en `/home`, NO en `/dashboard`.
> En Next.js App Router, dos route groups con el mismo path causan un build error
> porque el prefijo `(admin)` / `(analyst)` se elimina de la URL final.
> `/dashboard` permanece 100% admin. El analista entra por `/home`.

### Cambio requerido en `lib/auth/roles.ts`

```ts
analista_mdm: "analyst",   // era "admin" — cierra la deuda intencional documentada
```

### ROLE_HOME

```ts
analyst: "/home",          // workspace analítico personal
```

---

## Estructura de archivos

```
app/
├── (admin)/                          ← sin cambios
└── (analyst)/
    ├── layout.tsx                    ← requireRole("analyst") + buildNavGroups("analyst")
    ├── home/
    │   ├── page.tsx                  ← Server Component, prefetch config del workspace
    │   ├── loading.tsx
    │   └── home-client.tsx           ← grid drag & drop + widget renderer
    ├── notifications/
    │   ├── page.tsx
    │   ├── loading.tsx
    │   └── notifications-client.tsx
    ├── explore/
    │   ├── page.tsx
    │   ├── loading.tsx
    │   └── explore-client.tsx
    ├── reports/
    │   ├── page.tsx
    │   ├── loading.tsx
    │   └── reports-client.tsx
    ├── catalogos/
    │   ├── page.tsx
    │   ├── loading.tsx
    │   └── catalogos-readonly-client.tsx
    ├── workflows/
    │   ├── page.tsx
    │   ├── loading.tsx
    │   └── workflows-readonly-client.tsx
    └── quality/
        ├── page.tsx
        ├── loading.tsx
        └── quality-readonly-client.tsx

components/analyst/
    ├── widget-grid.tsx               ← dnd-kit sortable grid
    ├── widget-card.tsx               ← wrapper con drag handle + config button
    ├── widget-config-modal.tsx       ← modal para crear/editar widget
    ├── plotly-widget.tsx             ← <Plot data={} layout={} /> wrapper
    └── widgets/
        ├── kpi-widget.tsx
        ├── line-widget.tsx
        ├── bar-widget.tsx
        ├── area-widget.tsx
        ├── scatter-widget.tsx
        ├── pie-widget.tsx
        ├── table-widget.tsx
        └── forecast-widget.tsx

hooks/
    ├── use-analyst-home.ts            ← carga/guarda layout del workspace por usuario
    └── use-analyst-widget.ts         ← fetcher → POST /api/analyst/widget

app/api/analyst/
    ├── widget/route.ts               ← proxy → FastAPI /analyst/widget
    ├── views/route.ts                ← proxy → FastAPI /analyst/views
    ├── home/route.ts                 ← CRUD layout del workspace (GET/PATCH)
    └── notifications/route.ts        ← proxy → FastAPI /analyst/notifications
```

---

## Módulo 1 — Workspace Analítico `/home` (Fase 1)

### Concepto

Lienzo de análisis personal del analista. Cada widget es una visualización configurada
por el analista apuntando a una vista analítica del DWH. **No muestra estado del sistema**
(ETL, salud de pipeline) — eso va en `/notifications`.

### Tipos de widget (8)

| Widget | Chart | Configuración |
|---|---|---|
| Línea de tiempo | `LineChart` | vista, eje_x (fecha), eje_y (métrica), grupo_by, rango |
| Barras | `BarChart` | vista, dimensión, métrica, apiladas/agrupadas |
| Área | `AreaChart` | vista, eje_x (fecha), métricas (multi-serie) |
| Dispersión | `ScatterChart` | vista, eje_x (métrica A), eje_y (métrica B), color |
| Torta / Donut | `PieChart` | vista, dimensión, valor |
| KPI Card | valor único | vista, métrica, comparar vs período anterior |
| Tabla de datos | DataTable | vista, columnas visibles, top N filas |
| Proyección | `ForecastChart` | vista, eje_x, eje_y, períodos a proyectar, modelo |

### Flujo de configuración de widget

1. Analista hace clic en "+ Widget"
2. Modal: elige tipo de chart
3. Modal: elige vista del DWH (lista de `GET /analyst/views`)
4. Modal: configura ejes, filtros, rango de fechas, tamaño de grid
5. Frontend hace `POST /api/analyst/widget` con la configuración
6. FastAPI consulta el DWH, genera figura Plotly, devuelve JSON
7. Frontend renderiza `<Plot data={fig.data} layout={fig.layout} />`
8. Widget queda en el grid — analista lo arrastra al lugar deseado
9. Clic "Guardar" → `PATCH /api/analyst/dashboard` persiste el layout

### Persistencia del layout

- La configuración de cada widget (tipo, vista, parámetros) se guarda como JSON en la BD
- El layout del grid (posición y tamaño de cada widget) también se persiste
- Fallback: si el endpoint falla, se usa `localStorage`
- Layout por defecto si el usuario no tiene configuración guardada: 2 KPIs + 1 línea de tiempo vacíos con "Configúrame"

### Generación de charts en Python

**Endpoint:** `POST /analyst/widget` en FastAPI

```python
# Flujo en FastAPI
@router.post("/analyst/widget")
async def generar_widget(config: WidgetConfig, db: Session = Depends(get_db)):
    df = await cargar_vista(config.vista, config.filtros, db)   # pandas DataFrame
    fig = construir_figura(config.tipo, df, config)              # plotly Figure
    if config.forecast_periodos:
        fig = agregar_forecast(fig, df, config)                  # statsmodels
    return fig.to_dict()
```

**Librerías Python:**
- `pandas` — consulta y transformación de datos
- `plotly` — generación de figuras interactivas
- `statsmodels` — Holt-Winters para forecast básico
- `prophet` — forecast con estacionalidad anual (agrícola), Fase 2

**Vistas analíticas iniciales en SQL Server (Gold):**
- `vw_cosecha_mensual` — producción por mes, variedad, zona
- `vw_rendimiento_zona` — rendimiento t/ha por zona y período
- `vw_cosecha_variedad` — distribución por variedad
- `vw_proyeccion_anual` — datos históricos para forecast
- `vw_correlacion` — métricas para scatter (lluvia, temperatura, rendimiento)
- `vw_resumen_periodo` — resumen ejecutivo configurable

**Frontend:**
- `npm install react-plotly.js plotly.js @dnd-kit/core @dnd-kit/sortable`
- `<Plot data={fig.data} layout={fig.layout} config={{ responsive: true }} />`

---

## Módulo 2 — Notificaciones (Fase 1)

### Concepto

Centro unificado de alertas del ecosistema de datos: ETL failures, datos en cuarentena,
umbrales de calidad superados. **Aquí sí vive el monitoreo del sistema** — no en el dashboard.

### Features

- Feed cronológico con paginación (25 por página)
- Severidades: `error` | `warning` | `info`
- Tipos: `etl_failure` | `cuarentena` | `umbral_calidad` | `etl_ok`
- Badge con contador de no leídas en el sidebar — actualizado vía SSE (reutiliza `/api/cc`)
- Marcar como leído: individual + "marcar todas"
- Filtros: por severidad, tipo, módulo, rango de fechas
- Cada notificación tiene: título, descripción, timestamp, link a recurso afectado

### API

- `GET /api/analyst/notifications?page=1&severidad=error` — lista paginada
- `PATCH /api/analyst/notifications/read` — marcar leídas
- SSE badge: reutiliza el stream existente en `/api/cc`

---

## Módulo 3 — Exploración DWH (Fase 2)

### Concepto

Browser read-only de las tablas del Data Warehouse. El analista navega los esquemas
Bronce/Silver/Gold, ve el esquema de columnas, previsualizda datos y exporta.

### Features

- Árbol de esquemas colapsable (Bronce / Silver / Gold)
- Al seleccionar tabla: muestra columnas con tipo y descripción
- Preview de datos: primeras 100 filas
- Filtros por columna (texto contiene, número rango, fecha rango)
- Estadísticas por columna: nulos %, distintos, min, max, media
- Export CSV (hasta 10,000 filas con confirmación)
- Sin ningún permiso de escritura

### API

- `GET /api/analyst/explore/schemas` — árbol de esquemas
- `GET /api/analyst/explore/table?schema=Gold&tabla=Fact_Cosecha_SAP` — metadatos
- `POST /api/analyst/explore/preview` — primeras N filas con filtros
- `POST /api/analyst/explore/stats` — estadísticas por columna
- `POST /api/analyst/explore/export` — CSV streaming

---

## Módulo 4 — Reportes (Fase 2)

### Concepto

Galería de reportes predefinidos con parámetros configurables. El analista elige
un reporte, ajusta los parámetros (fechas, filtros) y genera la visualización.
No es un query builder libre.

### Features

- Galería: tarjetas con nombre, descripción e ícono del reporte
- Formulario de parámetros por reporte (fecha desde/hasta, variedad, zona, etc.)
- Visualización con Plotly (charts generados en Python, mismo patrón que dashboard)
- Export Excel vía `xlsx` (SheetJS, client-side)
- Export PDF vía `window.print()` + `@media print` CSS

### Reportes iniciales

| Reporte | Descripción |
|---|---|
| Calidad por tabla | Evolución de tasa de rechazo por tabla y período |
| Cosecha por variedad | Volumen y distribución por variedad en rango de fechas |
| Rendimiento por zona | Rendimiento t/ha por zona geográfica |
| Rechazos ETL | Top tablas con más rechazos y causas principales |
| Proyección de cosecha | Forecast de producción para los próximos N períodos |

---

## Módulos read-only (Fase 2) — Calidad, Catálogos, Workflows

Los tres siguen el mismo patrón:

1. Reutilizan los hooks/API existentes del admin (`useQualityKpis`, `useCatalogos`, etc.)
2. El componente cliente **no incluye** controles de mutación (sin botones Aprobar/Rechazar,
   Crear/Editar/Eliminar, Ejecutar)
3. Usan el mismo `PageHeader` y estructura visual del portal
4. Se declaran en el route group `(analyst)` con su propio archivo cliente

### Calidad read-only
- KPIs: tasa rechazo, registros en cuarentena
- Tabla de cuarentena: consulta y filtros, sin AccionesBulk ni QuarantineDrawer de aprobación
- Tendencia 7 y 30 días

### Catálogos read-only
- Selector de catálogo
- Tabla con búsqueda y paginación
- Export CSV
- Sin botones Crear / Editar / Eliminar

### Workflows read-only
- Lista de workflows con estado y progreso
- Historial de ejecuciones
- Sin botón "Ejecutar" ni acciones manuales

---

## Stack técnico completo

### Frontend (agregar)
| Librería | Uso |
|---|---|
| `react-plotly.js` + `plotly.js` | Render de figuras Plotly desde Python |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag & drop del grid del dashboard |
| `xlsx` (SheetJS) | Export Excel client-side en Reportes |

### Backend Python (agregar)
| Librería | Uso |
|---|---|
| `plotly` | Generación de figuras interactivas |
| `statsmodels` | Forecast Holt-Winters, regresión OLS |
| `prophet` | Forecast con estacionalidad (Fase 2) |

### Existente (reutilizar)
- `pandas`, `sqlalchemy` — ya en el proyecto ETL
- `recharts` — reemplazado por react-plotly.js para widgets analíticos
- SSE stream `/api/cc` — para badge de notificaciones

---

## Fases de implementación

### Fase 1 — Infraestructura + Dashboard + Notificaciones
- Route group `(analyst)` con layout
- Actualizar RBAC y roles (analista_mdm → analyst)
- Actualizar `lib/routes.ts` con rutas analyst
- Dashboard: widget grid drag & drop + 8 tipos de widget + config modal
- Integración Python: endpoint `/analyst/widget` en FastAPI
- Vistas analíticas SQL: 6 vistas iniciales en Gold
- Centro de notificaciones con SSE badge

### Fase 2 — Datos y análisis
- DWH Explorer (exploración read-only)
- Calidad read-only
- Catálogos read-only
- Workflows read-only
- Módulo de Reportes con export

### Fase 3 — Futuro
- Módulo Modelos (ver `docs/ideas-modelos.md`)
- Prophet para forecast estacional
- Widgets adicionales según demanda

---

## Fuera de alcance (este spec)

- Módulo Modelos (`/models`) — ideas en `docs/ideas-modelos.md`
- Power BI Embedded (Opción A descartada)
- Query builder libre de SQL (Opción B descartada)
- Páginas del Ingeniero en Jefe (`operador_etl`) — spec separado
