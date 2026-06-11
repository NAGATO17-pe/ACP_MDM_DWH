# Connect Tables + Motor Proyecciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar mock data accionable (quality charts, entities, models badge) y exponer el motor de proyecciones de cosecha como página `/proyecciones` del portal.

**Architecture:** Workstream A deriva agregados (trend, by-table) en rutas proxy Next.js desde los endpoints FastAPI de bitácora y cuarentena — mismo patrón que `/api/cc/dwh/facts`. Workstream B consume el router FastAPI `/api/v1/proyecciones/*` YA EXISTENTE (servicio portado sin streamlit, registrado en main.py); solo requiere un fix de 4 líneas en el router backend (exponer kg_pesimista/kg_optimista) y todo el frontend: schemas zod, 5 proxies, hooks, página con filtros + KPIs + chart 3-escenarios + tabla detalle + editor de matriz.

**Tech Stack:** Next.js 14+ App Router · TypeScript · zod · TanStack Query v5 · Recharts · FastAPI (solo Task 6) · Playwright.

**Spec:** `docs/superpowers/specs/2026-06-11-connect-tables-proyecciones-design.md`

---

## Hechos verificados del backend (NO re-verificar, ya leído)

- Router `backend/api/rutas_proyecciones.py` registrado en `main.py` línea 46. Endpoints:
  - `GET /api/v1/proyecciones/fechas` → `{ "fechas": number[] }` (ints YYYYMMDD)
  - `GET /api/v1/proyecciones/combinaciones/{id_tiempo}` → `Array<{ Fundo: string, Modulo: string, Variedad: string, Condicion: string }>`
  - `GET /api/v1/proyecciones/matriz` → `{}` o `Record<string, Record<string, number | null>>`
  - `POST /api/v1/proyecciones/matriz` (rol analista) → `{ ok: boolean }`
  - `POST /api/v1/proyecciones/ejecutar` (rol analista) body `{ id_tiempo, matriz_inputs?, margen_pesimista=0.9906, margen_optimista=1.0107, modulo?, variedad?, condicion?, fundo? }` → `{ df_semanal: FilaSemanas[], kpis, df_detalle }`
- `kpis` keys: `total_base, total_opt, total_pes, variedad_top, total_plantas, kg_por_planta, unidades_cubiertas, unidades_totales` (números salvo variedad_top string).
- `df_detalle` row keys: `fundo, condicion, certificacion, modulo, turno, valvula, variedad, semana, id_tiempo_proy, semana_label, fecha_semana, kg_base, kg_pesimista, kg_optimista`.
- `df_semanal` del servicio tiene `kg_pesimista`/`kg_optimista` pero el router actual solo mapea `kg_base` → Task 6 lo corrige.
- Frontend: `BitacoraEntry` = `{ idLog, nombreProceso, tablaDestino, fechaInicio, estado, filasInsertadas, filasRechazadas, ... }` con mapper `mapBitacoraEntry` y schema crudo `FastApiBitacoraPagina` (campo `items`).
- `FastApiQuarantinePage` = `{ datos: FastApiQuarantineRecord[], total, ... }`, record crudo tiene `tabla_origen`, `estado` (PENDIENTE/RESUELTO/DESCARTADO via `mapQuarantineRecord`).
- Hooks catálogos existentes: `useVariedadesDim(params)`, `useGeografia(params)`, `usePersonal(params)` → `UseQueryResult<CatalogoPagina<T>>` donde `CatalogoPagina = { datos: T[], total, pagina, tamano }`. Tipos: `VariedadDim { idVariedad, nombreVariedad, breeder, esActiva, fechaCreacion, fechaModificacion }`, `Geografia { fundo, sector, modulo, turno, valvula, cama, esTestBlock, codigoSapCampo, esVigente }`, `Personal { dni, nombreCompleto, rol, sexo, idPlanilla, pctAsertividad, diasAusentismo }`.
- `DataTable` props: `{ columns: ColumnDef[], data: T[], searchPlaceholder?, searchKey?, emptyMessage? }`.
- `fastapiFetch<T>(path, init?: RequestInit & { timeoutMs?: number })` — soporta method/body.
- `ROUTE_ACL` en `lib/auth/rbac.ts` es array `{ path, roles }`; nav en `lib/routes.ts` items con `{ href, label, icon, roles }` y constantes `ADMIN/ANALYST/EXECUTIVE`.

## Reglas globales para TODOS los implementadores

1. **NO ejecutar `git commit` en paralelo con otro agente.** Cada task termina con su commit propio (el controller las despacha en serie).
2. Verificación TypeScript: `npx tsc --noEmit 2>&1 | Select-String "<archivos del task>"` → sin output.
3. Charts: leyenda visible, tooltips con `formatNumber`, gridlines con `stroke="var(--color-border)" strokeOpacity={0.4}`, skeleton en loading, empty state con mensaje, error state con retry. Distinguir series por color + opacidad/dash (no solo color).
4. Números en tablas: `tabular-nums`. Locale es-PE vía `formatNumber` de `@/lib/format`.

---

## Task 1: Schemas + rutas trend/by-table + hooks (A1-A3)

**Files:**
- Modify: `lib/schemas/control-center.ts` (añadir 2 schemas al final de la sección de quality, cerca de `QualityKpis`)
- Create: `app/api/cc/quality/trend/route.ts`
- Create: `app/api/cc/quality/by-table/route.ts`
- Modify: `hooks/use-control-center.ts` (añadir 2 hooks tras `useQualityKpis`)

- [ ] **Step 1: Añadir schemas a `lib/schemas/control-center.ts`** (debajo de `QualityKpis`):

```typescript
/** Punto de tendencia de calidad — derivado de bitácora por día. */
export const QualityTrendPoint = z.object({
  date: z.string(), // YYYY-MM-DD
  insertadas: z.number().int().nonnegative(),
  rechazadas: z.number().int().nonnegative(),
  tasaRechazo: z.number().min(0).max(100),
});
export type QualityTrendPoint = z.infer<typeof QualityTrendPoint>;

/** Agregado de cuarentena por tabla origen. */
export const QualityByTable = z.object({
  tabla: z.string(),
  pendientes: z.number().int().nonnegative(),
  resueltos: z.number().int().nonnegative(),
  descartados: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type QualityByTable = z.infer<typeof QualityByTable>;
```

- [ ] **Step 2: Crear `app/api/cc/quality/trend/route.ts`**:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { FastApiBitacoraPagina, mapBitacoraEntry } from "@/lib/schemas/bitacora";
import type { QualityTrendPoint } from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const days = Math.min(
    Number(new URL(req.url).searchParams.get("days") ?? 30) || 30,
    90,
  );

  const raw = await fastapiFetchSafe<unknown>(
    `/api/v1/auditoria/bitacora?pagina=1&tamano=500`,
  );
  const parsed = raw ? FastApiBitacoraPagina.safeParse(raw) : null;
  const entries = parsed?.success ? parsed.data.items.map(mapBitacoraEntry) : [];

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, { insertadas: number; rechazadas: number }>();

  for (const e of entries) {
    if (!e.fechaInicio) continue;
    const ts = new Date(e.fechaInicio).getTime();
    if (Number.isNaN(ts) || ts < cutoff) continue;
    const day = e.fechaInicio.slice(0, 10);
    const acc = byDay.get(day) ?? { insertadas: 0, rechazadas: 0 };
    acc.insertadas += e.filasInsertadas;
    acc.rechazadas += e.filasRechazadas;
    byDay.set(day, acc);
  }

  const payload: QualityTrendPoint[] = [...byDay.entries()]
    .map(([date, v]) => ({
      date,
      insertadas: v.insertadas,
      rechazadas: v.rechazadas,
      tasaRechazo:
        v.insertadas + v.rechazadas > 0
          ? Math.round((v.rechazadas / (v.insertadas + v.rechazadas)) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json(payload, {
    headers: { "cache-control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
```

- [ ] **Step 3: Crear `app/api/cc/quality/by-table/route.ts`**:

```typescript
import { NextResponse } from "next/server";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { FastApiQuarantinePage, mapQuarantineRecord } from "@/lib/schemas/quality";
import type { QualityByTable } from "@/lib/schemas/control-center";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const raw = await fastapiFetchSafe<unknown>(
    `/api/v1/cuarentena?pagina=1&tamano=500`,
  );
  const parsed = raw ? FastApiQuarantinePage.safeParse(raw) : null;
  const records = parsed?.success ? parsed.data.datos.map(mapQuarantineRecord) : [];

  const byTable = new Map<string, { pendientes: number; resueltos: number; descartados: number }>();
  for (const r of records) {
    const acc = byTable.get(r.tablaOrigen) ?? { pendientes: 0, resueltos: 0, descartados: 0 };
    if (r.estado === "PENDIENTE") acc.pendientes += 1;
    else if (r.estado === "RESUELTO") acc.resueltos += 1;
    else acc.descartados += 1;
    byTable.set(r.tablaOrigen, acc);
  }

  const payload: QualityByTable[] = [...byTable.entries()]
    .map(([tabla, v]) => ({ tabla, ...v, total: v.pendientes + v.resueltos + v.descartados }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json(payload, {
    headers: { "cache-control": "private, max-age=60, stale-while-revalidate=120" },
  });
}
```

- [ ] **Step 4: Añadir hooks a `hooks/use-control-center.ts`** (tras `useQualityKpis`; añadir `QualityTrendPoint, QualityByTable` al import existente de schemas):

```typescript
export function useQualityTrend(days = 30): UseQueryResult<QualityTrendPoint[]> {
  return useQuery({
    queryKey: ["cc", "quality-trend", days],
    queryFn: () =>
      fetchAndParse(`/api/cc/quality/trend?days=${days}`, z.array(QualityTrendPoint)),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useQualityByTable(): UseQueryResult<QualityByTable[]> {
  return useQuery({
    queryKey: ["cc", "quality-by-table"],
    queryFn: () =>
      fetchAndParse("/api/cc/quality/by-table", z.array(QualityByTable)),
    refetchInterval: 120_000,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}
```

- [ ] **Step 5: Verificar** `npx tsc --noEmit 2>&1 | Select-String "quality/trend|by-table|use-control-center|control-center.ts"` → sin output.

- [ ] **Step 6: Commit** `git add lib/schemas/control-center.ts hooks/use-control-center.ts "app/api/cc/quality/trend/" "app/api/cc/quality/by-table/"` · mensaje: `feat(quality): trend + by-table derived endpoints with hooks`

---

## Task 2: /quality — KPIs y charts reales (A4)

**Files:**
- Modify: `app/(admin)/quality/page.tsx`
- Modify: `app/(admin)/quality/quality-charts.tsx`

- [ ] **Step 1: Leer ambos archivos completos** antes de editar.

- [ ] **Step 2: En `quality-charts.tsx`** — convertir los 4 charts a datos reales:
  - Eliminar el import de `@/lib/mock/quality` (`QUALITY_BY_ENTITY, QUALITY_RADAR, QUALITY_TREND`).
  - Añadir: `import { useQualityTrend, useQualityByTable, useQualityKpis } from "@/hooks/use-control-center";` y `import { Skeleton } from "@/components/ui/skeleton";`.
  - `QualityTrendChart()`: usar `const { data, isLoading } = useQualityTrend(30);` — si `isLoading && !data` → `<Skeleton className="h-[260px] w-full rounded-md" />`; si `!data?.length` → empty state (`<p className="text-sm text-[var(--color-text-muted)] py-12 text-center">Sin datos de bitácora en el período</p>`); con datos → el mismo chart existente con `data={data}` y dataKeys `insertadas`/`rechazadas` (ajustar `dataKey`/labels del JSX del chart existente a estos campos; eje X `date`).
  - `QualityByEntityChart()`: usar `useQualityByTable()`, mismo patrón loading/empty; barras apiladas `pendientes`/`resueltos`/`descartados` (stackId="a") con eje Y `tabla` si el chart era horizontal — conservar la orientación existente, solo cambiar datos y dataKeys.
  - `QualityRadarChart()`: ELIMINAR la función completa (sin reemplazo — el slot lo ocupa el by-table apilado).
  - `QualityGauge({ score })`: conservar su firma — sigue recibiendo score por props (el caller pasará el real).
- [ ] **Step 3: En `page.tsx`**:
  - Eliminar `import { QUALITY_KPIS } from "@/lib/mock/quality";` y `const k = QUALITY_KPIS;`.
  - Server-fetch del resumen real: ya existe el patrón — el endpoint proxy interno no se puede llamar desde el server component, así que usar `fastapiFetch` directo: `import { fastapiFetchSafe } from "@/lib/api/server-fetch";` y obtener `/api/v1/cuarentena/resumen` → `{ total, pendientes, resueltos, descartados }`; calcular `resolutionRate = total > 0 ? ((resueltos + descartados) / total) * 100 : 100`.
  - KPI cards: reemplazar las 2 cards mock (`Completitud global`, la que use `k.validity`) por: `Total cuarentena` (valor `total`), `Tasa de resolución` (valor `resolutionRate.toFixed(1)` unit `%`, tone success si ≥90, warning si no). Las cards "En Cuarentena"/"Pendientes revisión" reales existentes se conservan.
  - Donde se renderice `<QualityRadarChart />` eliminar el uso; `<QualityGauge score={...} />` pasar `resolutionRate` real.
- [ ] **Step 4: Verificar** tsc filtrado a `quality` → sin output. Verificar que `lib/mock/quality` ya no se importa en `app/(admin)/quality/`: `grep -rn "lib/mock/quality" "app/(admin)/quality/"` → sin output.
- [ ] **Step 5: Commit** mensaje: `feat(quality): real KPIs + charts from bitacora/cuarentena — drop mock`

---

## Task 3: /overview — charts reales (A5)

**Files:**
- Modify: `app/(executive)/overview/overview-charts.tsx`

- [ ] **Step 1: Leer el archivo completo.** Es `"use client"` (verificar; si no, añadir la directiva al convertirlo a hooks).
- [ ] **Step 2:** Eliminar `import { QUALITY_BY_ENTITY, QUALITY_TREND } from "@/lib/mock/quality";`. Añadir imports de `useQualityTrend`, `useQualityByTable`, `Skeleton` (igual que Task 2).
  - `ExecutiveTrendChart()`: `useQualityTrend(30)` — AreaChart existente con `data={data}`, áreas `insertadas` y `rechazadas`, eje X `date`. Skeleton/empty como Task 2.
  - `ExecutiveByEntityChart()`: `useQualityByTable()` — bar chart existente con `data={data}`, dataKey categórico `tabla`, barras `pendientes`/`resueltos`/`descartados` apiladas.
- [ ] **Step 3: Verificar** tsc filtrado `overview` → sin output; `grep -rn "lib/mock/quality" app/` → solo (ninguna) coincidencia fuera de `lib/mock/`.
- [ ] **Step 4: Commit** mensaje: `feat(executive): overview charts on real bitacora/cuarentena aggregates`

---

## Task 4: /entities — explorador de entidades maestras reales (A6)

**Files:**
- Modify: `app/(admin)/entities/page.tsx`
- Rewrite: `app/(admin)/entities/entities-client.tsx`
- Delete: `lib/mock/entities.ts` (al final, cuando nada lo importe)

- [ ] **Step 1: Reescribir `page.tsx`**:

```typescript
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { EntitiesClient } from "./entities-client";

export const metadata: Metadata = { title: "Entidades MDM" };
export const dynamic = "force-dynamic";

export default function EntitiesPage() {
  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Entidades MDM"
        description="Exploración de dimensiones maestras del DWH: variedades, geografía agrícola y personal."
      />
      <EntitiesClient />
    </div>
  );
}
```

- [ ] **Step 2: Reescribir `entities-client.tsx`** — 3 tabs, cada uno con su hook + DataTable:

```typescript
"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table/data-table";
import { useVariedadesDim, useGeografia, usePersonal } from "@/hooks/use-catalogos";
import type { Geografia, Personal, VariedadDim } from "@/lib/schemas/catalogos";
import { formatDate } from "@/lib/format";

const PAGE = { pagina: 1, tamano: 200 };

const VARIEDAD_COLUMNS: ColumnDef<VariedadDim>[] = [
  { accessorKey: "idVariedad", header: "ID",
    cell: ({ row }) => <span className="font-mono text-xs text-[var(--color-text-muted)]">{row.original.idVariedad}</span> },
  { accessorKey: "nombreVariedad", header: "Variedad",
    cell: ({ row }) => <span className="font-medium">{row.original.nombreVariedad}</span> },
  { accessorKey: "breeder", header: "Breeder",
    cell: ({ row }) => row.original.breeder ?? "—" },
  { accessorKey: "esActiva", header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.esActiva ? "success" : "default"}>
        {row.original.esActiva ? "Activa" : "Inactiva"}
      </Badge>
    ) },
  { accessorKey: "fechaModificacion", header: "Modificada",
    cell: ({ row }) =>
      row.original.fechaModificacion ? formatDate(row.original.fechaModificacion) : "—" },
];

const GEOGRAFIA_COLUMNS: ColumnDef<Geografia>[] = [
  { accessorKey: "fundo", header: "Fundo", cell: ({ row }) => row.original.fundo ?? "—" },
  { accessorKey: "sector", header: "Sector", cell: ({ row }) => row.original.sector ?? "—" },
  { accessorKey: "modulo", header: "Módulo",
    cell: ({ row }) => <span className="tabular-nums">{row.original.modulo ?? "—"}</span> },
  { accessorKey: "turno", header: "Turno",
    cell: ({ row }) => <span className="tabular-nums">{row.original.turno ?? "—"}</span> },
  { accessorKey: "valvula", header: "Válvula", cell: ({ row }) => row.original.valvula ?? "—" },
  { accessorKey: "esVigente", header: "Vigencia",
    cell: ({ row }) => (
      <Badge variant={row.original.esVigente ? "success" : "default"}>
        {row.original.esVigente ? "Vigente" : "Histórica"}
      </Badge>
    ) },
];

const PERSONAL_COLUMNS: ColumnDef<Personal>[] = [
  { accessorKey: "dni", header: "DNI",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.dni ?? "—"}</span> },
  { accessorKey: "nombreCompleto", header: "Nombre",
    cell: ({ row }) => <span className="font-medium">{row.original.nombreCompleto ?? "—"}</span> },
  { accessorKey: "rol", header: "Rol", cell: ({ row }) => row.original.rol ?? "—" },
  { accessorKey: "pctAsertividad", header: "Asertividad",
    cell: ({ row }) =>
      row.original.pctAsertividad != null ? (
        <span className="tabular-nums">{row.original.pctAsertividad.toFixed(1)}%</span>
      ) : "—" },
  { accessorKey: "diasAusentismo", header: "Ausentismo (días)",
    cell: ({ row }) => <span className="tabular-nums">{row.original.diasAusentismo ?? "—"}</span> },
];

function TabLoading() {
  return (
    <div className="flex flex-col gap-2 pt-2" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded" />
      ))}
    </div>
  );
}

export function EntitiesClient() {
  const variedades = useVariedadesDim(PAGE);
  const geografia = useGeografia(PAGE);
  const personal = usePersonal(PAGE);

  return (
    <Tabs defaultValue="variedades" className="w-full">
      <TabsList>
        <TabsTrigger value="variedades">Variedades</TabsTrigger>
        <TabsTrigger value="geografia">Geografía</TabsTrigger>
        <TabsTrigger value="personal">Personal</TabsTrigger>
      </TabsList>

      <TabsContent value="variedades">
        {variedades.isLoading && !variedades.data ? (
          <TabLoading />
        ) : (
          <DataTable
            columns={VARIEDAD_COLUMNS}
            data={variedades.data?.datos ?? []}
            searchPlaceholder="Buscar variedad o breeder…"
            emptyMessage="Sin variedades registradas."
          />
        )}
      </TabsContent>

      <TabsContent value="geografia">
        {geografia.isLoading && !geografia.data ? (
          <TabLoading />
        ) : (
          <DataTable
            columns={GEOGRAFIA_COLUMNS}
            data={geografia.data?.datos ?? []}
            searchPlaceholder="Buscar fundo, sector o módulo…"
            emptyMessage="Sin registros de geografía."
          />
        )}
      </TabsContent>

      <TabsContent value="personal">
        {personal.isLoading && !personal.data ? (
          <TabLoading />
        ) : (
          <DataTable
            columns={PERSONAL_COLUMNS}
            data={personal.data?.datos ?? []}
            searchPlaceholder="Buscar por nombre o DNI…"
            emptyMessage="Sin personal registrado."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
```

Nota: si `Badge` no tiene variant `success`, revisar `components/ui/badge.tsx` y usar la variante equivalente existente.

- [ ] **Step 3:** `grep -rn "lib/mock/entities" app/ components/ lib/ --include="*.tsx" --include="*.ts"` → si solo queda `lib/mock/entities.ts` a sí mismo, ELIMINAR el archivo `lib/mock/entities.ts`.
- [ ] **Step 4: Verificar** tsc filtrado `entities` → sin output.
- [ ] **Step 5: Commit** mensaje: `feat(entities): real master-data explorer (variedades/geografia/personal) — drop mock`

---

## Task 5: /models — badge de demo (A7)

**Files:**
- Modify: `app/(analyst)/models/page.tsx`
- Modify: `app/(analyst)/models/[id]/page.tsx`

- [ ] **Step 1:** En ambos archivos, junto al `PageHeader` (dentro del contenedor inmediato, después del header), añadir:

```tsx
<Badge
  variant="warning"
  className="w-fit gap-1.5"
  title="Backend de modelos en roadmap — los datos mostrados son de ejemplo"
>
  <FlaskConical aria-hidden className="h-3 w-3" />
  Datos de demostración
</Badge>
```

`Badge` ya está importado en `models/page.tsx`; en `[id]/page.tsx` verificar/añadir import. `FlaskConical` ya importado en la lista; verificar en detalle.
- [ ] **Step 2: Verificar** tsc filtrado `models` → sin output.
- [ ] **Step 3: Commit** mensaje: `feat(models): demo-data badge while backend does not exist`

---

## Task 6: Backend — exponer kg_pesimista/kg_optimista en el router (B-fix)

**Files (REPO BACKEND, fuera del repo del portal):**
- Modify: `D:\Proyecto2026\ACP_DWH\ACP Proyecciones\backend\schemas\proyecciones\respuesta.py`
- Modify: `D:\Proyecto2026\ACP_DWH\ACP Proyecciones\backend\api\rutas_proyecciones.py`

- [ ] **Step 1:** En `respuesta.py`, clase `FilaSemanas`, añadir tras `kg_proyectados: float`:

```python
    kg_pesimista: float = 0.0
    kg_optimista: float = 0.0
```

- [ ] **Step 2:** En `rutas_proyecciones.py`, en el loop que construye `filas` (función `ejecutar`), añadir al dict tras `"kg_proyectados": float(r["kg_base"]),`:

```python
                    "kg_pesimista": float(r["kg_pesimista"]),
                    "kg_optimista": float(r["kg_optimista"]),
```

- [ ] **Step 3: Verificar sintaxis:** `python -c "import ast; ast.parse(open(r'D:\Proyecto2026\ACP_DWH\ACP Proyecciones\backend\api\rutas_proyecciones.py', encoding='utf-8').read()); ast.parse(open(r'D:\Proyecto2026\ACP_DWH\ACP Proyecciones\backend\schemas\proyecciones\respuesta.py', encoding='utf-8').read()); print('OK')"` → `OK`.
- [ ] **Step 4: Commit solo si el backend está bajo git:** `git -C "D:\Proyecto2026\ACP_DWH\ACP Proyecciones\backend" rev-parse --git-dir 2>$null` — si retorna ruta, commit con mensaje `feat(proyecciones): expose pesimista/optimista scenarios in weekly response`; si no, reportar "backend sin git, cambios aplicados sin commit".

---

## Task 7: Proyecciones — schemas zod + proxies + hooks (B3)

**Files:**
- Create: `lib/schemas/proyecciones.ts`
- Create: `app/api/cc/proyecciones/fechas/route.ts`
- Create: `app/api/cc/proyecciones/combinaciones/[idTiempo]/route.ts`
- Create: `app/api/cc/proyecciones/matriz/route.ts` (GET + POST)
- Create: `app/api/cc/proyecciones/ejecutar/route.ts` (POST)
- Create: `hooks/use-proyecciones.ts`

- [ ] **Step 1: Crear `lib/schemas/proyecciones.ts`**:

```typescript
import { z } from "zod";

/** Celda de matriz: % [0,1] o null (= AUTO, 1 − Σ anteriores). */
export const MatrizInputs = z.record(
  z.string(),
  z.record(z.string(), z.number().min(0).max(1).nullable()),
);
export type MatrizInputs = z.infer<typeof MatrizInputs>;

export const FechasDisponibles = z.object({ fechas: z.array(z.number().int()) });
export type FechasDisponibles = z.infer<typeof FechasDisponibles>;

export const Combinacion = z.object({
  Fundo: z.string(),
  Modulo: z.string(),
  Variedad: z.string(),
  Condicion: z.string(),
});
export type Combinacion = z.infer<typeof Combinacion>;

export const ProyeccionSemanal = z.object({
  semana: z.number().int(),
  semana_label: z.string(),
  fecha_semana: z.string(),
  kg_proyectados: z.number(),
  kg_pesimista: z.number().default(0),
  kg_optimista: z.number().default(0),
  kg_anterior: z.number(),
  pct_variacion: z.number(),
  tendencia: z.string(),
});
export type ProyeccionSemanal = z.infer<typeof ProyeccionSemanal>;

export const ProyeccionKpis = z.object({
  total_base: z.number(),
  total_opt: z.number(),
  total_pes: z.number(),
  variedad_top: z.string(),
  total_plantas: z.number(),
  kg_por_planta: z.number(),
  unidades_cubiertas: z.number().int(),
  unidades_totales: z.number().int(),
});
export type ProyeccionKpis = z.infer<typeof ProyeccionKpis>;

export const ProyeccionDetalle = z.object({
  fundo: z.string(),
  condicion: z.string(),
  certificacion: z.string(),
  modulo: z.coerce.number(),
  turno: z.coerce.number(),
  valvula: z.coerce.string(),
  variedad: z.string(),
  semana: z.number().int(),
  semana_label: z.string(),
  kg_base: z.number(),
  kg_pesimista: z.number(),
  kg_optimista: z.number(),
});
export type ProyeccionDetalle = z.infer<typeof ProyeccionDetalle>;

export const RespuestaProyeccion = z.object({
  df_semanal: z.array(ProyeccionSemanal),
  kpis: ProyeccionKpis.partial().passthrough(),
  df_detalle: z.array(ProyeccionDetalle.passthrough()).nullable().default([]),
});
export type RespuestaProyeccion = z.infer<typeof RespuestaProyeccion>;

export const EjecutarProyeccionInput = z.object({
  id_tiempo: z.number().int(),
  matriz_inputs: MatrizInputs.optional(),
  margen_pesimista: z.number().positive().default(0.9906),
  margen_optimista: z.number().positive().default(1.0107),
  modulo: z.number().int().optional(),
  variedad: z.string().optional(),
  condicion: z.string().optional(),
  fundo: z.string().optional(),
});
export type EjecutarProyeccionInput = z.infer<typeof EjecutarProyeccionInput>;
```

- [ ] **Step 2: Crear `app/api/cc/proyecciones/fechas/route.ts`**:

```typescript
import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { FechasDisponibles } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/fechas`);
    return NextResponse.json(FechasDisponibles.parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 3: Crear `app/api/cc/proyecciones/combinaciones/[idTiempo]/route.ts`**:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { Combinacion } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

type Params = Promise<{ idTiempo: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { error } = await requireApiSession();
  if (error) return error;
  const { idTiempo } = await params;
  const id = Number(idTiempo);
  if (!Number.isInteger(id))
    return NextResponse.json({ detail: "idTiempo inválido" }, { status: 400 });
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/combinaciones/${id}`);
    return NextResponse.json(z.array(Combinacion).parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 4: Crear `app/api/cc/proyecciones/matriz/route.ts`** (GET carga, POST guarda):

```typescript
import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { MatrizInputs } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/matriz`);
    const parsed = MatrizInputs.safeParse(raw);
    return NextResponse.json(parsed.success ? parsed.data : {});
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const body = MatrizInputs.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json(
      { detail: "Matriz inválida: valores deben estar en [0,1] o null" },
      { status: 422 },
    );
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/matriz`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.data),
    });
    return NextResponse.json(raw);
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 5: Crear `app/api/cc/proyecciones/ejecutar/route.ts`**:

```typescript
import { NextResponse } from "next/server";
import { fastapiFetch, FastApiError } from "@/lib/api/server-fetch";
import { EjecutarProyeccionInput, RespuestaProyeccion } from "@/lib/schemas/proyecciones";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { error } = await requireApiSession();
  if (error) return error;
  const body = EjecutarProyeccionInput.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json(
      { detail: "Petición inválida", issues: body.error.issues },
      { status: 422 },
    );
  try {
    const raw = await fastapiFetch<unknown>(`/api/v1/proyecciones/ejecutar`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.data),
      timeoutMs: 120_000,
    });
    return NextResponse.json(RespuestaProyeccion.parse(raw));
  } catch (err) {
    if (err instanceof FastApiError)
      return NextResponse.json({ detail: err.message }, { status: err.status });
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 6: Crear `hooks/use-proyecciones.ts`** (mirar el estilo de `hooks/use-catalogos.ts` para `fetchJson`; si no es exportable, replicar el helper local):

```typescript
"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  Combinacion,
  EjecutarProyeccionInput,
  FechasDisponibles,
  MatrizInputs,
  RespuestaProyeccion,
} from "@/lib/schemas/proyecciones";

async function fetchParse<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

export function useFechasProyeccion(): UseQueryResult<FechasDisponibles> {
  return useQuery({
    queryKey: ["proyecciones", "fechas"],
    queryFn: () => fetchParse("/api/cc/proyecciones/fechas", FechasDisponibles),
    staleTime: 10 * 60_000,
  });
}

export function useCombinaciones(idTiempo: number | null): UseQueryResult<Combinacion[]> {
  return useQuery({
    queryKey: ["proyecciones", "combinaciones", idTiempo],
    queryFn: () =>
      fetchParse(`/api/cc/proyecciones/combinaciones/${idTiempo}`, z.array(Combinacion)),
    enabled: idTiempo != null,
    staleTime: 5 * 60_000,
  });
}

export function useMatrizGuardada(): UseQueryResult<MatrizInputs> {
  return useQuery({
    queryKey: ["proyecciones", "matriz"],
    queryFn: () => fetchParse("/api/cc/proyecciones/matriz", MatrizInputs),
    staleTime: 5 * 60_000,
  });
}

export function useGuardarMatriz(): UseMutationResult<unknown, Error, MatrizInputs> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matriz) =>
      fetchParse("/api/cc/proyecciones/matriz", z.unknown(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(matriz),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["proyecciones", "matriz"] }),
  });
}

export function useEjecutarProyeccion(): UseMutationResult<
  RespuestaProyeccion,
  Error,
  EjecutarProyeccionInput
> {
  return useMutation({
    mutationFn: (input) =>
      fetchParse("/api/cc/proyecciones/ejecutar", RespuestaProyeccion, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}
```

- [ ] **Step 7: Verificar** tsc filtrado `proyecciones` → sin output.
- [ ] **Step 8: Commit** mensaje: `feat(proyecciones): zod schemas + API proxies + hooks`

---

## Task 8: Página /proyecciones — RBAC, nav, filtros, KPIs, chart, tabla (B4a)

**Files:**
- Modify: `lib/auth/rbac.ts` (1 línea en ROUTE_ACL)
- Modify: `lib/routes.ts` (1 nav item)
- Create: `app/(analyst)/proyecciones/page.tsx`
- Create: `app/(analyst)/proyecciones/proyecciones-client.tsx`

- [ ] **Step 1:** En `lib/auth/rbac.ts`, añadir a ROUTE_ACL (tras `/reports`):

```typescript
  { path: "/proyecciones",  roles: ["analyst", "admin"] },
```

- [ ] **Step 2:** En `lib/routes.ts`, añadir nav item en el grupo del analyst (tras "Reportes"; leer el archivo para replicar la forma exacta del item, incluido el campo de grupo/descripcion si existe):

```typescript
  {
    href: "/proyecciones",
    label: "Proyecciones",
    icon: Sprout,
    roles: [ANALYST, ADMIN],
  },
```

Añadir `Sprout` al import de lucide-react del archivo.

- [ ] **Step 3: Crear `page.tsx`**:

```typescript
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { ProyeccionesClient } from "./proyecciones-client";

export const metadata: Metadata = { title: "Proyecciones de cosecha" };
export const dynamic = "force-dynamic";

export default function ProyeccionesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proyecciones de cosecha"
        description="Motor Six-Week: kg proyectados por semana a partir de conteos fenológicos."
      />
      <ProyeccionesClient />
    </div>
  );
}
```

- [ ] **Step 4: Crear `proyecciones-client.tsx`.** Estructura completa (filtros → KPIs → chart → tabla). El editor de matriz se añade en Task 9 — dejar el placeholder `{/* MatrixEditor (Task 9) */}`:

```typescript
"use client";

import * as React from "react";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/charts/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import {
  useCombinaciones, useEjecutarProyeccion, useFechasProyeccion,
} from "@/hooks/use-proyecciones";
import type { ProyeccionDetalle, RespuestaProyeccion } from "@/lib/schemas/proyecciones";

const TODOS = "__todos__";

function fmtFecha(idTiempo: number): string {
  const s = String(idTiempo);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function ProyeccionesClient() {
  const fechas = useFechasProyeccion();
  const [idTiempo, setIdTiempo] = React.useState<number | null>(null);
  const [fundo, setFundo] = React.useState(TODOS);
  const [modulo, setModulo] = React.useState(TODOS);
  const [variedad, setVariedad] = React.useState(TODOS);
  const [condicion, setCondicion] = React.useState(TODOS);

  const combinaciones = useCombinaciones(idTiempo);
  const ejecutar = useEjecutarProyeccion();

  // Primera fecha disponible al cargar
  React.useEffect(() => {
    if (idTiempo == null && fechas.data?.fechas.length)
      setIdTiempo(fechas.data.fechas[0]);
  }, [fechas.data, idTiempo]);

  const opciones = React.useMemo(() => {
    const rows = combinaciones.data ?? [];
    const uniq = (xs: string[]) => [...new Set(xs)].sort();
    return {
      fundos: uniq(rows.map((r) => r.Fundo)),
      modulos: uniq(rows.map((r) => r.Modulo)),
      variedades: uniq(rows.map((r) => r.Variedad)),
      condiciones: uniq(rows.map((r) => r.Condicion)),
    };
  }, [combinaciones.data]);

  function onProyectar() {
    if (idTiempo == null) return;
    ejecutar.mutate({
      id_tiempo: idTiempo,
      margen_pesimista: 0.9906,
      margen_optimista: 1.0107,
      ...(modulo !== TODOS ? { modulo: Number(modulo) } : {}),
      ...(variedad !== TODOS ? { variedad } : {}),
      ...(condicion !== TODOS ? { condicion } : {}),
      ...(fundo !== TODOS ? { fundo } : {}),
    });
  }

  const r = ejecutar.data;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filtros ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Filtro label="Fecha de evaluación" required>
            <Select
              value={idTiempo != null ? String(idTiempo) : ""}
              onValueChange={(v) => setIdTiempo(Number(v))}
            >
              <SelectTrigger className="h-11 w-44">
                <SelectValue placeholder={fechas.isLoading ? "Cargando…" : "Seleccionar"} />
              </SelectTrigger>
              <SelectContent>
                {(fechas.data?.fechas ?? []).map((f) => (
                  <SelectItem key={f} value={String(f)}>{fmtFecha(f)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filtro>
          <FiltroSelect label="Fundo" value={fundo} onChange={setFundo} options={opciones.fundos} />
          <FiltroSelect label="Módulo" value={modulo} onChange={setModulo} options={opciones.modulos} />
          <FiltroSelect label="Variedad" value={variedad} onChange={setVariedad} options={opciones.variedades} />
          <FiltroSelect label="Condición" value={condicion} onChange={setCondicion} options={opciones.condiciones} />
          <Button
            variant="primary"
            className="h-11 gap-2"
            disabled={idTiempo == null || ejecutar.isPending}
            onClick={onProyectar}
          >
            {ejecutar.isPending
              ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              : <Play aria-hidden className="h-4 w-4" />}
            Proyectar
          </Button>
        </CardContent>
      </Card>

      {/* ── Error ───────────────────────────────────────────────── */}
      {ejecutar.isError ? (
        <Card className="border-[var(--color-destructive)]/30">
          <CardContent className="flex items-center gap-3 pt-6">
            <TriangleAlert aria-hidden className="h-5 w-5 text-[var(--color-destructive)]" />
            <p className="text-sm">{ejecutar.error.message}</p>
            <Button variant="outline" size="sm" onClick={onProyectar}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Resultados ──────────────────────────────────────────── */}
      {ejecutar.isPending ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-md" />
          ))}
        </div>
      ) : r ? (
        <Resultados r={r} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            Selecciona una fecha de evaluación y pulsa «Proyectar».
          </CardContent>
        </Card>
      )}

      {/* MatrixEditor (Task 9) */}
    </div>
  );
}

function Filtro({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
      <span>{label}{required ? <span aria-hidden className="text-[var(--color-destructive)]"> *</span> : null}</span>
      {children}
    </label>
  );
}

function FiltroSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <Filtro label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </Filtro>
  );
}

function Resultados({ r }: { r: RespuestaProyeccion }) {
  const k = r.kpis;
  if (!r.df_semanal.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          Sin conteos fenológicos para esta fecha y filtros. Prueba otra fecha de evaluación.
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <section aria-label="KPIs de proyección" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Kg proyectados (central)" value={formatNumber(Math.round(k.total_base ?? 0))} />
        <KpiCard
          label="Rango pesimista – optimista"
          value={`${formatNumber(Math.round(k.total_pes ?? 0))} – ${formatNumber(Math.round(k.total_opt ?? 0))}`}
        />
        <KpiCard
          label="Unidades con datos"
          value={`${k.unidades_cubiertas ?? 0} / ${k.unidades_totales ?? 0}`}
        />
        <KpiCard label="Variedad top" value={k.variedad_top ?? "—"} />
      </section>

      <Card>
        <CardHeader><CardTitle>Kg proyectados por semana (W1–W6)</CardTitle></CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <BarChart data={r.df_semanal} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.4} vertical={false} />
              <XAxis dataKey="semana_label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => formatNumber(v)} />
              <Tooltip formatter={(v: number) => `${formatNumber(Math.round(v))} kg`} />
              <Legend />
              <Bar name="Pesimista" dataKey="kg_pesimista" fill="var(--color-warning)" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
              <Bar name="Central" dataKey="kg_proyectados" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              <Bar name="Optimista" dataKey="kg_optimista" fill="var(--color-success, #22c55e)" fillOpacity={0.55} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <DetalleTable detalle={r.df_detalle ?? []} />
    </>
  );
}

/** Pivot del detalle largo (fila por unidad×semana) a ancho (W1..W6 por unidad). */
function DetalleTable({ detalle }: { detalle: ProyeccionDetalle[] }) {
  const rows = React.useMemo(() => {
    const map = new Map<string, {
      fundo: string; modulo: number; turno: number; valvula: string;
      variedad: string; condicion: string; semanas: number[]; total: number;
    }>();
    for (const d of detalle) {
      const key = `${d.modulo}|${d.turno}|${d.valvula}|${d.variedad}`;
      const acc = map.get(key) ?? {
        fundo: d.fundo, modulo: d.modulo, turno: d.turno, valvula: d.valvula,
        variedad: d.variedad, condicion: d.condicion,
        semanas: [0, 0, 0, 0, 0, 0], total: 0,
      };
      if (d.semana >= 1 && d.semana <= 6) acc.semanas[d.semana - 1] += d.kg_base;
      acc.total += d.kg_base;
      map.set(key, acc);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [detalle]);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Detalle por unidad ({rows.length})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--color-border)]/40 text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="px-2 py-2 font-medium">Fundo</th>
              <th className="px-2 py-2 font-medium">Módulo</th>
              <th className="px-2 py-2 font-medium">Turno</th>
              <th className="px-2 py-2 font-medium">Válvula</th>
              <th className="px-2 py-2 font-medium">Variedad</th>
              {[1, 2, 3, 4, 5, 6].map((w) => (
                <th key={w} className="px-2 py-2 text-right font-medium">W{w}</th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((u) => (
              <tr
                key={`${u.modulo}-${u.turno}-${u.valvula}-${u.variedad}`}
                className="border-b border-[var(--color-border)]/20 hover:bg-[var(--color-surface-2)]"
              >
                <td className="px-2 py-1.5">{u.fundo}</td>
                <td className="px-2 py-1.5 tabular-nums">{u.modulo}</td>
                <td className="px-2 py-1.5 tabular-nums">{u.turno}</td>
                <td className="px-2 py-1.5 tabular-nums">{u.valvula}</td>
                <td className="px-2 py-1.5">{u.variedad}</td>
                {u.semanas.map((kg, i) => (
                  <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                    {kg > 0 ? formatNumber(Math.round(kg)) : "—"}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatNumber(Math.round(u.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 ? (
          <p className="pt-2 text-[11px] text-[var(--color-text-muted)]">
            Mostrando 100 de {rows.length} unidades (ordenadas por kg total).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

Notas para el implementador: verificar variantes reales de `Button` (`variant="primary"` existe en este codebase — usada en homologation-client) y los tokens CSS (`--color-warning`, `--color-success`) en `app/globals.css`; si `--color-success` no existe usar el token de éxito que usen otros componentes (grep `success` en globals.css).

- [ ] **Step 5: Verificar** tsc filtrado `proyecciones` → sin output. Verificar middleware: `/proyecciones` debe estar permitido para analyst — el middleware deriva de ROUTE_ACL (Step 1), no requiere edición aparte; confirmar con `grep -n "proyecciones" lib/auth/rbac.ts`.
- [ ] **Step 6: Commit** mensaje: `feat(proyecciones): /proyecciones page — filters, KPIs, 3-scenario chart, unit detail`

---

## Task 9: Editor de matriz de maduración (B4b)

**Files:**
- Create: `app/(analyst)/proyecciones/matrix-editor.tsx`
- Modify: `app/(analyst)/proyecciones/proyecciones-client.tsx` (reemplazar el placeholder)

- [ ] **Step 1: Crear `matrix-editor.tsx`.** Grid 7 estados × 6 semanas; celdas null = AUTO (chip read-only); validación on-blur por fila (suma ≤ 1); Restaurar defaults; Guardar vía `useGuardarMatriz`:

```typescript
"use client";

import * as React from "react";
import { ChevronDown, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGuardarMatriz, useMatrizGuardada } from "@/hooks/use-proyecciones";
import type { MatrizInputs } from "@/lib/schemas/proyecciones";

/** Defaults del motor (espejo de MATRIZ_INPUTS_DEFAULT en el backend). */
export const MATRIZ_DEFAULT: MatrizInputs = {
  cosechable: { "1": 1.0, "2": null },
  maduras: { "1": 1.0, "2": null },
  cremas: { "1": 1.0, "2": null },
  fase_2: { "1": 0.14, "2": 0.4, "3": null },
  fase_1: { "1": 0, "2": 0, "3": 0.1, "4": 0.6, "5": null, "6": null },
  verdes: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0.16, "6": 0.17 },
  pequena: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
};

const ESTADOS: Array<{ key: string; label: string }> = [
  { key: "cosechable", label: "Cosechable" },
  { key: "maduras", label: "Maduras" },
  { key: "cremas", label: "Cremas" },
  { key: "fase_2", label: "Fase 2" },
  { key: "fase_1", label: "Fase 1" },
  { key: "verdes", label: "Verdes" },
  { key: "pequena", label: "Pequeña" },
];

const SEMANAS = ["1", "2", "3", "4", "5", "6"] as const;

function sumaFila(fila: Record<string, number | null>): number {
  return Object.values(fila).reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

export function MatrixEditor({ onMatrizChange }: {
  onMatrizChange?: (m: MatrizInputs) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const guardada = useMatrizGuardada();
  const guardar = useGuardarMatriz();
  const [matriz, setMatriz] = React.useState<MatrizInputs>(MATRIZ_DEFAULT);
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [dirty, setDirty] = React.useState(false);

  // Cargar matriz persistida si existe
  React.useEffect(() => {
    if (guardada.data && Object.keys(guardada.data).length > 0 && !dirty) {
      setMatriz(guardada.data);
    }
  }, [guardada.data, dirty]);

  function setCelda(estado: string, semana: string, raw: string) {
    const v = raw.trim() === "" ? null : Number(raw) / 100;
    setMatriz((prev) => {
      const next = {
        ...prev,
        [estado]: { ...prev[estado], [semana]: Number.isNaN(v as number) ? null : v },
      };
      onMatrizChange?.(next);
      return next;
    });
    setDirty(true);
  }

  function validarFila(estado: string) {
    const fila = matriz[estado] ?? {};
    const suma = sumaFila(fila);
    const fueraDeRango = Object.values(fila).some((v) => v != null && (v < 0 || v > 1));
    setErrores((prev) => {
      const next = { ...prev };
      if (fueraDeRango) {
        next[estado] = "Hay valores fuera de 0–100%. Corrige las celdas marcadas.";
      } else if (suma > 1.0001) {
        next[estado] = `La suma es ${(suma * 100).toFixed(0)}% (> 100%). Reduce alguna semana para que el total no exceda 100%.`;
      } else {
        delete next[estado];
      }
      return next;
    });
  }

  function restaurar() {
    setMatriz(MATRIZ_DEFAULT);
    setErrores({});
    setDirty(true);
    onMatrizChange?.(MATRIZ_DEFAULT);
  }

  const hayErrores = Object.keys(errores).length > 0;

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <CardTitle className="text-sm">Configuración avanzada — matriz de maduración</CardTitle>
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Porcentaje de bayas de cada estado que se cosecha en cada semana.
            Las celdas <span className="font-medium">AUTO</span> se calculan como
            100% − Σ(semanas anteriores). Valores en %.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]">
                  <th className="px-2 py-1.5 font-medium">Estado</th>
                  {SEMANAS.map((s) => (
                    <th key={s} className="px-2 py-1.5 text-center font-medium">W{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ESTADOS.map(({ key, label }) => {
                  const fila = matriz[key] ?? {};
                  return (
                    <React.Fragment key={key}>
                      <tr className="border-t border-[var(--color-border)]/20">
                        <td className="px-2 py-1.5 font-medium">{label}</td>
                        {SEMANAS.map((s) => {
                          const v = s in fila ? fila[s] : undefined;
                          if (v === undefined) {
                            return (
                              <td key={s} className="px-2 py-1.5 text-center text-[var(--color-text-muted)] opacity-40">·</td>
                            );
                          }
                          if (v === null) {
                            return (
                              <td key={s} className="px-2 py-1.5 text-center">
                                <span
                                  className="inline-flex rounded border border-dashed border-[var(--color-border)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]"
                                  title="Calculada automáticamente: 100% − Σ semanas anteriores"
                                >
                                  auto
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={s} className="px-1 py-1.5">
                              <Input
                                inputMode="decimal"
                                aria-label={`${label} semana ${s} (%)`}
                                value={(v * 100).toFixed(0)}
                                onChange={(e) => setCelda(key, s, e.target.value)}
                                onBlur={() => validarFila(key)}
                                className={cn(
                                  "h-11 w-16 text-center text-xs tabular-nums",
                                  errores[key] && "border-[var(--color-destructive)]",
                                )}
                              />
                            </td>
                          );
                        })}
                      </tr>
                      {errores[key] ? (
                        <tr>
                          <td colSpan={7} className="px-2 pb-1.5">
                            <p role="alert" aria-live="polite" className="text-[11px] text-[var(--color-destructive)]">
                              {errores[key]}
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={restaurar}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Restaurar defaults
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="gap-1.5"
              disabled={hayErrores || guardar.isPending || !dirty}
              onClick={() => guardar.mutate(matriz, { onSuccess: () => setDirty(false) })}
            >
              {guardar.isPending
                ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                : <Save aria-hidden className="h-3.5 w-3.5" />}
              Guardar matriz
            </Button>
            {guardar.isSuccess && !dirty ? (
              <span className="text-[11px] text-[var(--color-text-muted)]" aria-live="polite">Guardada ✓</span>
            ) : null}
            {guardar.isError ? (
              <span role="alert" className="text-[11px] text-[var(--color-destructive)]">
                {guardar.error.message}
              </span>
            ) : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 2:** En `proyecciones-client.tsx`: importar `MatrixEditor` y `type MatrizInputs`; añadir estado `const [matriz, setMatriz] = React.useState<MatrizInputs | null>(null);`; reemplazar el placeholder `{/* MatrixEditor (Task 9) */}` por `<MatrixEditor onMatrizChange={setMatriz} />`; en `onProyectar`, añadir al payload `...(matriz ? { matriz_inputs: matriz } : {})`.
- [ ] **Step 3: Verificar** tsc filtrado `proyecciones|matrix` → sin output.
- [ ] **Step 4: Commit** mensaje: `feat(proyecciones): maturation matrix editor with validation + persistence`

---

## Task 10: E2E smoke (B5 + criterios A)

**Files:**
- Create: `e2e/proyecciones.spec.ts`

- [ ] **Step 1: Leer `e2e/analyst-phase2.spec.ts` y `e2e/helpers/auth.ts`** para replicar el patrón de stubs y `loginAs`.
- [ ] **Step 2: Crear `e2e/proyecciones.spec.ts`**:

```typescript
import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const SEMANAL = [1, 2, 3, 4, 5, 6].map((w) => ({
  semana: w,
  semana_label: `W${w} (0${w}/07)`,
  fecha_semana: `2026-07-0${w}`,
  kg_proyectados: 1000 * w,
  kg_pesimista: 990 * w,
  kg_optimista: 1010 * w,
  kg_anterior: 0,
  pct_variacion: 0,
  tendencia: "Estable",
}));

function stubProyecciones(page: Page) {
  void page.route("**/api/cc/proyecciones/fechas", (r) =>
    r.fulfill({ json: { fechas: [20260610, 20260603] } }),
  );
  void page.route("**/api/cc/proyecciones/combinaciones/**", (r) =>
    r.fulfill({
      json: [{ Fundo: "Fundo Norte", Modulo: "1", Variedad: "Sekoya Pop", Condicion: "Suelo - Organico" }],
    }),
  );
  void page.route("**/api/cc/proyecciones/matriz", (r) => {
    if (r.request().method() === "POST") return r.fulfill({ json: { ok: true } });
    return r.fulfill({ json: {} });
  });
  void page.route("**/api/cc/proyecciones/ejecutar", (r) =>
    r.fulfill({
      json: {
        df_semanal: SEMANAL,
        kpis: {
          total_base: 21000, total_opt: 21210, total_pes: 20790,
          variedad_top: "Sekoya Pop", total_plantas: 15000,
          kg_por_planta: 1.4, unidades_cubiertas: 10, unidades_totales: 12,
        },
        df_detalle: [],
      },
    }),
  );
  void page.route("**/api/cc/**", (r) => r.fulfill({ json: {} }));
}

test.describe("Proyecciones — analyst", () => {
  test.beforeEach(async ({ page }) => {
    stubProyecciones(page);
    await loginAs(page, "analyst");
  });

  test("analyst llega a /proyecciones y ve filtros + CTA", async ({ page }) => {
    await page.goto("/proyecciones");
    await expect(page).toHaveURL("/proyecciones");
    await expect(page.getByRole("heading", { name: /proyecciones de cosecha/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /proyectar/i })).toBeVisible();
  });

  test("ejecutar proyección muestra KPIs y chart", async ({ page }) => {
    await page.goto("/proyecciones");
    await page.getByRole("button", { name: /proyectar/i }).click();
    await expect(page.getByText(/kg proyectados \(central\)/i)).toBeVisible();
    await expect(page.getByText(/21,000|21 000|21000/)).toBeVisible();
    await expect(page.getByText(/kg proyectados por semana/i)).toBeVisible();
  });

  test("editor de matriz abre y muestra celdas AUTO", async ({ page }) => {
    await page.goto("/proyecciones");
    await page.getByRole("button", { name: /configuración avanzada/i }).click();
    await expect(page.getByText(/restaurar defaults/i)).toBeVisible();
    await expect(page.getByText("auto").first()).toBeVisible();
  });
});

test.describe("Proyecciones — RBAC", () => {
  test("executive NO llega a /proyecciones", async ({ page }) => {
    stubProyecciones(page);
    await loginAs(page, "executive");
    await page.goto("/proyecciones");
    await expect(page).not.toHaveURL("/proyecciones");
  });
});
```

- [ ] **Step 3:** `npx playwright test e2e/proyecciones.spec.ts --list` → 4 tests sin errores de parseo. tsc filtrado `proyecciones.spec` → sin output.
- [ ] **Step 4: Commit** mensaje: `test(proyecciones): e2e smoke — page, projection run, matrix editor, rbac`

---

## Self-Review

- **Cobertura del spec:** A1→Task 1, A2→Task 1, A3→Task 1, A4→Task 2, A5→Task 3, A6→Task 4, A7→Task 5, B1/B2→ya existentes en backend (verificado) + fix Task 6, B3→Task 7, B4→Tasks 8-9, B5→Task 10. Sin huecos.
- **Placeholders:** ninguno — todo step tiene código o comando exacto. El único "placeholder" es el comentario `{/* MatrixEditor (Task 9) */}` que Task 9 reemplaza explícitamente.
- **Consistencia de tipos:** `QualityTrendPoint`/`QualityByTable` definidos en Task 1 y consumidos en Tasks 2-3 con los mismos nombres; `MatrizInputs` (claves de semana como string) coincide entre schema zod, editor y payload; `kg_pesimista`/`kg_optimista` añadidos en backend (Task 6) y esperados con `.default(0)` en zod (Task 7) para tolerar backend sin redeploy.
- **Orden de ejecución:** Tasks 1→2→3 secuenciales (dependencia de hooks); Task 4, 5, 6 independientes; Task 7→8→9→10 secuenciales.
