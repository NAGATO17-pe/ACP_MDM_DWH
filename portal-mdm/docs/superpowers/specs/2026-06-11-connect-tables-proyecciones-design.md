# Spec: Conectar tablas restantes + Integración Motor de Proyecciones

**Fecha:** 2026-06-11
**Estado:** Aprobado (alcance validado con usuario vía brainstorming)

## Objetivo

Eliminar todo dato mock accionable del portal y conectar las tablas/charts restantes
a datos reales del backend FastAPI, e integrar el motor de proyecciones de cosecha
(`acp_mdm_portal/utils/motor_proyecciones.py`) como página nueva del portal Next.js.

## Decisiones de alcance (validadas con el usuario)

1. **`/entities`** → re-perfilar con entidades maestras REALES (variedades, geografía,
   personal) desde los endpoints de catálogos existentes. `/catalogos` queda como
   gestión CRUD; `/entities` como exploración read-only con DataTable rica.
2. **Charts sin fuente real** (gauge score, radar) → reemplazar por métricas reales:
   gauge = tasa de resolución de cuarentena; radar → barras por tabla origen.
3. **`/models`** → queda en mock CON badge visible "Datos de demostración".
   No hay backend de modelos; crear uno está fuera de alcance.
4. **Enfoque de agregación:** server-side en rutas proxy Next.js (Enfoque A),
   mismo patrón que `/api/cc/dwh/facts`. Agregación SQL en FastAPI (Enfoque C)
   queda documentada como mejora futura si los volúmenes crecen.

---

## Workstream A — Conectar tablas

### A1. Ruta `GET /api/cc/quality/trend?days=30`

- Fuente: FastAPI `GET /api/v1/auditoria/bitacora?pagina=1&tamano=500`.
- Agrupa por día (`fecha_inicio`): `{ date, insertadas, rechazadas, tasaRechazo }[]`.
- Schema zod `QualityTrendPoint` en `lib/schemas/control-center.ts`.
- Guard `requireApiSession()`. `dynamic = "force-dynamic"`. Cache 60s.

### A2. Ruta `GET /api/cc/quality/by-table`

- Fuente: FastAPI `GET /api/v1/cuarentena?pagina=1&tamano=500`.
- Agrupa por `tabla_origen` × `estado`: `{ tabla, pendientes, resueltos, descartados, total }[]`.
- Schema zod `QualityByTable`. Ordenado por `total` desc, top 10.

### A3. Hooks

`useQualityTrend(days)` y `useQualityByTable()` en `hooks/use-control-center.ts`,
mismo patrón que `useQualityKpis` (refetch 120s, staleTime 60s, keepPreviousData).

### A4. `/quality` (admin) — KPIs y charts reales

- KPI cards mock (completitud, validez) → reemplazar por reales: Total cuarentena,
  Pendientes, Resueltos, Tasa de resolución (desde `useQualityKpis` vía componente
  cliente, o server-fetch del resumen — seguir el patrón del componente existente).
- `quality-charts.tsx`: `QualityTrendChart` → datos de `useQualityTrend`;
  `QualityByEntityChart` → `useQualityByTable`; `QualityGauge` → `resolutionRate`
  real; `QualityRadarChart` → ELIMINAR y sustituir por barras apiladas por tabla
  (pendientes/resueltos/descartados).
- Eliminar import de `QUALITY_KPIS` mock en la página.

### A5. `/overview` ejecutivo — charts reales

`overview-charts.tsx`: `ExecutiveTrendChart` → `useQualityTrend(30)`;
`ExecutiveByEntityChart` → `useQualityByTable()`. Eliminar imports de
`QUALITY_TREND`/`QUALITY_BY_ENTITY`.

### A6. `/entities` — explorador de entidades maestras reales

- `page.tsx`: server component, sin mock. Pasa `isReadOnly` por consistencia.
- `entities-client.tsx`: tabs **Variedades / Geografía / Personal** (reemplazan
  cliente/producto/proveedor/ubicación). Datos vía hooks existentes de
  `hooks/use-catalogos.ts` (`/api/cc/catalogos/variedades-dim`, `/geografia`,
  `/personal`). Conservar `DataTable` (búsqueda, paginación, sorting con
  `aria-sort`). Columnas por tab según schema real de cada catálogo.
- Eliminar `lib/mock/entities.ts` cuando nada lo importe.
- Nav: descripción de la página actualizada ("Exploración de dimensiones maestras
  del DWH").

### A7. `/models` — badge de demo

Badge `Datos de demostración` (variant warning, con icono — no solo color) en
header de `/models` y `/models/[id]`. Tooltip: "Backend de modelos en roadmap".

### Criterios de aceptación A

- Cero imports de `lib/mock/quality` y `lib/mock/entities` en páginas.
- `lib/mock/models` solo lo importan `/models` (con badge) y RPT-002.
- Charts con loading skeleton, empty state con mensaje y error state con retry.
- `tsc --noEmit` limpio; smoke E2E pasa.

---

## Workstream B — Motor de Proyecciones

### B1. Port del motor a FastAPI (sin streamlit)

`backend/servicios/motor_proyecciones.py` — copia del motor con cambios SOLO de
infraestructura (la matemática NO se toca):

- `@st.cache_data(ttl=N)` → cache del backend (`nucleo/cache.py`) o TTL simple.
- `st.warning(msg)` → acumular en `warnings: list[str]` retornada al caller.
- `from utils.db import ejecutar_query` → capa de acceso del backend
  (`nucleo/conexion.py` / repositorios — seguir el patrón de los routers existentes).
- Funciones puras (`cerrar_matriz`, `validar_matriz_inputs`,
  `calcular_pct_productivas`, `kg_unidad_semana`, `lookup_peso_baya`) se copian
  intactas + unit tests con valores conocidos del Excel.

### B2. Router `backend/api/rutas_proyecciones.py`

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/api/v1/proyecciones/fechas` | viewer | Fechas de evaluación disponibles (id_tiempo) |
| GET | `/api/v1/proyecciones/combinaciones?id_tiempo=` | viewer | Fundos/módulos/variedades/condiciones disponibles |
| POST | `/api/v1/proyecciones/ejecutar` | viewer | Body: `{id_tiempo, modulo?, variedad?, condicion?, fundo?, matriz_inputs?, margen_pesimista?, margen_optimista?}` → `{semanal[], detalle[], kpis, warnings[]}` |
| GET | `/api/v1/proyecciones/parametros` | viewer | Matriz + márgenes persistidos |
| PUT | `/api/v1/proyecciones/parametros` | analista_mdm | Guardar matriz + márgenes (valida con `validar_matriz_inputs`; 422 con detalle si inválida) |

Schemas Pydantic en `backend/schemas/`. Registrar router en `main.py`.
DataFrames → `to_dict(orient="records")` con claves estables documentadas.

### B3. Proxies Next.js + schemas + hooks

- `lib/schemas/proyecciones.ts` — zod: `ProyeccionSemanal`, `ProyeccionDetalle`,
  `ProyeccionKpis`, `MatrizInputs`, `CombinacionesDisponibles`.
- Rutas: `app/api/cc/proyecciones/{fechas,combinaciones,ejecutar,parametros}/route.ts`
  con `requireApiSession` (PUT parametros: validar rol analyst/admin con
  `requireApiRole`).
- `hooks/use-proyecciones.ts`: `useFechasProyeccion`, `useCombinaciones(idTiempo)`,
  `useEjecutarProyeccion` (mutation), `useParametrosProyeccion` + mutation de guardado.

### B4. Página `/proyecciones` (analyst + admin)

- RBAC: `lib/auth/rbac.ts` ROUTE_ACL `"/proyecciones": ["analyst", "admin"]`;
  nav item en `lib/routes.ts` grupo analyst (icono `Sprout` o `TrendingUp`).
- `app/(analyst)/proyecciones/page.tsx` (server) + `proyecciones-client.tsx`.

**Layout (jerarquía visual, reglas ui-ux-pro-max):**

1. **Barra de filtros** (top, sticky en desktop): Selects con label visible
   (no placeholder-only) — Fecha de evaluación (requerida), Fundo, Módulo,
   Variedad, Condición (opcionales). Botón primario único "Proyectar"
   (primary-action: un solo CTA). Estados: disabled mientras carga, spinner
   inline (loading-buttons).
2. **KPI cards** (grid 4): Kg proyectados totales (central), Rango
   pesimista–optimista, Unidades proyectadas, Plantas consideradas.
   `formatNumber` es-PE, tabular-nums.
3. **Chart W1–W6** (Recharts BarChart agrupado, 3 series): pesimista/central/
   optimista distinguidos por color + opacidad/patrón (color-not-only);
   leyenda visible junto al chart; tooltips con valores exactos formateados;
   gridlines sutiles (`--color-border` al 40%); ejes con unidades ("Kg",
   "Semana W1…W6"); respeta `prefers-reduced-motion` (animation-optional).
4. **Tabla detalle por unidad**: columnas Módulo/Turno/Válvula/Variedad/Fundo/
   Condición + W1…W6 + Total; sortable con `aria-sort`; `tabular-nums`;
   sticky header; export CSV (export-option) — botón secundario.
5. **Editor de matriz de maduración** (disclosure progresivo: colapsado por
   defecto bajo "Configuración avanzada" — progressive-disclosure):
   - Grid 7 estados × 6 semanas. Inputs numéricos % (`inputMode="decimal"`,
     altura ≥44px, touch-friendly-input).
   - Celdas AUTO (None) renderizadas como chips de solo lectura con estilo
     distinto (read-only-distinction) mostrando el valor calculado `1−Σ`.
   - Validación on-blur (inline-validation): suma por estado > 1 → error bajo
     la fila con causa y corrección sugerida (error-clarity); `aria-live`
     para lectores (aria-live-errors).
   - Acciones: "Restaurar defaults" (undo-support) y "Guardar" (persiste vía
     PUT; submit-feedback con éxito/error; confirm si se cierra con cambios
     sin guardar — sheet-dismiss-confirm).
   - Márgenes pesimista/optimista: 2 inputs numéricos con helper text del
     valor por defecto.
6. **Warnings del motor** (si los hay): callout amber con icono encima del
   chart — color + icono, no solo color.
7. **Estados**: skeleton por bloque (loading-chart), empty state si la fecha
   no tiene datos ("Sin conteos fenológicos para esta fecha" + guía),
   error state con retry (error-state-chart).

### B5. E2E smoke

`e2e/proyecciones.spec.ts`: analyst llega a /proyecciones, ve filtros y CTA;
con stubs, ejecuta proyección y ve KPIs + tabla; editor de matriz abre y
valida; executive NO llega (redirect).

### Criterios de aceptación B

- Backend: unit tests de funciones puras pasan; `uvicorn` arranca con el
  router registrado; endpoints responden con sesión válida.
- Frontend: `tsc --noEmit` limpio; página accesible para analyst y admin;
  E2E smoke verde.
- La matemática del motor es idéntica al original (diff de funciones puras
  = solo imports/decoradores).

---

## Fuera de alcance

- Endpoints de agregación SQL en FastAPI para trend/by-table (Enfoque C, futuro).
- Backend de modelos predictivos.
- Edición de proyecciones guardadas / historial comparativo en UI (el motor
  lo soporta — `extraer_proyeccion_anterior` — pero la UI de comparación es
  iteración futura).
- Rol `operador_etl` propio (TODO documentado en `lib/auth/roles.ts`).

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Capa DB del backend difiere de `utils.db` del portal Streamlit | Tarea de port lee `nucleo/conexion.py` ANTES de portar; los SQL del motor son SELECT puros |
| Payloads de `ejecutar` grandes (detalle por unidad) | Límite implícito por filtros; si pesa, paginar detalle en iteración futura |
| Agregación trend/by-table sobre páginas de 500 registros es aproximada | Documentado en código; Enfoque C como mejora |
| Drift matemático en el port | Unit tests con valores de referencia del Excel antes de exponer endpoints |
