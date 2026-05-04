# Mejoras a implementar — Portal MDM

> Documento de backlog técnico. Ordenado por prioridad: seguridad → UX → funcionalidad nueva.
> Estado al: 2026-05-04

---

## Estado actual del portal

### ✅ Completamente implementado

| Página | Rol | Contenido |
|--------|-----|-----------|
| **Quality** | Admin | 4 KPIs + 4 gráficos (gauge, radar, trend, barras) |
| **Workflows** | Admin | Cola de aprobación + stepper + histórico |
| **Audit** | Admin | Timeline de eventos con iconos y colores semánticos |
| **Entities** | Admin | Tabla de 60 entidades con búsqueda y paginación |
| **Overview** | Executive | 4 KPIs estratégicos + 2 gráficos de tendencia |
| **Models** | Analyst | Grid de 5 modelos con accuracy / AUC / F1 |

### ✅ Bugs corregidos (2026-05-04)

| # | Archivo | Fix aplicado |
|---|---------|-------------|
| 1 | `app/api/auth/login/route.ts` | Mensajes de error sanitizados — ya no expone detalles del backend (anti-enumeración) |
| 2 | `lib/auth/cookie-config.ts` | `sameSite` cambiado de `"lax"` a `"strict"` |
| 3 | `lib/api/client.ts` | Guard para respuesta 204 / cuerpo vacío inesperado + JSDoc de contrato |
| 4 | `lib/format.ts` | Tipos de retorno `: string` explícitos en las 4 funciones exportadas |

---

## PRIORIDAD ALTA

### M-01 — Analyst: Explore funcional

**Problema:** `app/(analyst)/explore/page.tsx` muestra 3 KPIs estáticos y 2 links. No hay análisis real de datos.

**Solución propuesta:**
- Convertir a Server Component que carga `generateEntities()` desde `lib/mock/entities.ts`
- Extraer un `ExploreClient` (`"use client"`) con:
  - `Tabs` (ya implementado en `components/ui/tabs.tsx`) con pestañas: **Todas · Cliente · Producto · Proveedor · Ubicación**
  - Filtro por estado (`Select` ya implementado): Todos / Validado / Pendiente / Rechazado / Borrador
  - `DataTable` (ya implementado en `components/data-table/data-table.tsx`) con columnas: Código, Nombre, Tipo, Propietario, Completitud, Estado, Actualizado
  - Badges de estado con colores semánticos (reutilizar patrón de `audit/page.tsx`)
  - Barra de progreso inline para el campo `completeness`

**Archivos a crear/modificar:**
```
app/(analyst)/explore/page.tsx          ← MODIFICAR (Server Component + datos)
app/(analyst)/explore/explore-client.tsx ← CREAR ("use client", tabs + filtros + tabla)
```

**Reutiliza:**
- `components/data-table/data-table.tsx`
- `components/ui/tabs.tsx`
- `components/ui/select.tsx`
- `components/ui/badge.tsx`
- `lib/mock/entities.ts` — `generateEntities()`, `ENTITY_TYPE_LABEL`

---

### M-02 — Notificaciones toast en acciones del usuario

**Problema:** `useToast` y `<Toaster>` están implementados y montados en `app/layout.tsx`, pero **ninguna página los usa**. Las acciones del usuario (aprobación, rechazo, búsqueda sin resultados, errores) no dan ningún feedback visual.

**Solución propuesta — conectar toasts en estas acciones:**

| Página | Acción | Toast |
|--------|--------|-------|
| `(admin)/workflows` | Aprobar workflow | `variant: "success"` — "Workflow aprobado correctamente" |
| `(admin)/workflows` | Rechazar workflow | `variant: "destructive"` — "Workflow rechazado" |
| `(admin)/entities` | Copiar código de entidad | `variant: "default"` — "Código copiado al portapapeles" |
| `(analyst)/explore` | Filtro sin resultados | `variant: "warning"` — "Sin entidades con ese filtro" |
| Cualquier página | Error de carga de datos | `variant: "destructive"` — "Error al cargar los datos" |

**Archivos a modificar:**
```
app/(admin)/workflows/page.tsx    ← agregar useToast a botones Aprobar/Rechazar
app/(admin)/entities/entities-client.tsx ← agregar toast al copiar código
app/(analyst)/explore/explore-client.tsx ← agregar toast cuando filtro = 0 resultados
```

**API pública disponible:**
```ts
const { toast } = useToast();
toast({ title: "Aprobado", description: "...", variant: "success" });
```

---

## PRIORIDAD MEDIA

### M-03 — Loading & empty states

**Problema:** `KpiSkeleton`, `TableSkeleton` y `ChartSkeleton` existen en `components/ui/skeleton.tsx` pero no se usan en ninguna página. Cuando los datos tardan, la UI muestra en blanco.

**Solución propuesta:**

#### Loading states — usar `Suspense` de React con fallback Skeleton
```tsx
// Patrón a aplicar en cada página con datos
import { Suspense } from "react";
import { KpiSkeleton, TableSkeleton } from "@/components/ui/skeleton";

<Suspense fallback={<div className="grid grid-cols-3 gap-4"><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></div>}>
  <KpiSection />
</Suspense>

<Suspense fallback={<TableSkeleton rows={10} />}>
  <DataSection />
</Suspense>
```

#### Empty states — componente reutilizable nuevo
Crear `components/ui/empty-state.tsx`:
```tsx
// Props: icon, title, description, action? (botón opcional)
// Render: icono centrado + título + descripción + botón CTA opcional
// Usar en DataTable cuando rows = 0 y el mensaje actual es solo texto plano
```

**Páginas a actualizar:**
```
app/(admin)/entities/page.tsx         ← Suspense + KpiSkeleton + TableSkeleton
app/(analyst)/explore/page.tsx        ← Suspense + KpiSkeleton + TableSkeleton
app/(analyst)/models/page.tsx         ← Suspense + skeleton de cards
app/(executive)/overview/page.tsx     ← Suspense + KpiSkeleton + ChartSkeleton
```

**Archivos a crear:**
```
components/ui/empty-state.tsx         ← CREAR
```

---

### M-04 — Analyst: Reports con descarga real

**Problema:** `app/(analyst)/reports/page.tsx` tiene 4 reportes hardcodeados con botón "Descargar" sin lógica. No genera ni descarga nada.

**Solución propuesta:**
- Implementar descarga de CSV desde los datos mock en memoria (sin backend)
- Crear utilidad `lib/export/csv.ts` con función `exportToCsv(filename, rows, columns)`
- Conectar cada reporte a su fuente de datos mock:
  - **Calidad MDM** → `lib/mock/quality.ts`
  - **Top 100 entidades** → `generateEntities(100)` de `lib/mock/entities.ts`
  - **Auditoría** → `lib/mock/audit.ts`
  - **Performance modelos** → `lib/mock/models.ts`
- Toast de confirmación al completar descarga: `variant: "success"` — "Reporte descargado"

**Archivos a crear/modificar:**
```
lib/export/csv.ts                     ← CREAR
app/(analyst)/reports/page.tsx        ← MODIFICAR (conectar lógica de descarga)
```

---

### M-05 — Analyst: Detalle de modelo (`/models/[id]`)

**Problema:** `app/(analyst)/models/[id]/page.tsx` **no existe**. Los cards de modelos en `/models` no tienen destino al hacer click.

**Solución propuesta:**
- Crear página de detalle con:
  - Header: nombre, algoritmo, status badge, fecha de entrenamiento
  - Sección métricas: Accuracy, AUC, F1 con `KpiCard`
  - Sección variables de importancia: tabla ordenable con `DataTable`
  - Sección predicciones recientes: mini-tabla con timestamp + valor predicho
  - Botón "Volver a modelos" con `Link`

**Archivos a crear:**
```
app/(analyst)/models/[id]/page.tsx    ← CREAR
lib/mock/models.ts                    ← MODIFICAR (agregar feature_importance y predictions por modelo)
```

---

### M-06 — Responsive móvil (sidebar hamburguesa)

**Problema:** `components/layout/role-shell.tsx` usa `hidden lg:flex` en el sidebar — en móvil el sidebar desaparece completamente sin alternativa de navegación.

**Solución propuesta:**
- Agregar estado `sidebarOpen: boolean` con `useState`
- Botón hamburguesa (`Menu` icon de lucide) en el header móvil
- Overlay + sidebar deslizante desde la izquierda en móvil (`translate-x` con transición)
- Cerrar al hacer click en un navItem o en el overlay
- Usar `usePathname` para cerrar automáticamente al navegar

**Archivos a modificar:**
```
components/layout/role-shell.tsx      ← MODIFICAR
```

---

## PRIORIDAD BAJA

### M-07 — Admin: Entities — modal de detalle/edición

**Problema:** La tabla de entidades en `(admin)/entities` no tiene acción al hacer click en una fila. No hay forma de ver el detalle ni editar una entidad.

**Solución propuesta:**
- Agregar columna de acción con botón "Ver detalle" en `DataTable`
- `Dialog` (ya implementado) con formulario react-hook-form + Zod:
  - Campos: nombre, tipo, propietario, estado
  - Validación inline con mensajes de error
  - Botón "Enviar a aprobación" → crea entrada en Workflows + toast de confirmación

**Archivos a modificar/crear:**
```
app/(admin)/entities/entities-client.tsx   ← MODIFICAR
app/(admin)/entities/entity-dialog.tsx     ← CREAR
```

---

### M-08 — Admin: Workflows — confirmación por Dialog

**Problema:** Los botones "Aprobar" y "Rechazar" en workflows ejecutan la acción sin confirmación. Un click accidental es irreversible.

**Solución propuesta:**
- Envolver las acciones en `Dialog` de confirmación (ya implementado)
- "Aprobar": Dialog simple con botón confirm verde
- "Rechazar": Dialog con textarea de motivo de rechazo (requerido, mín. 10 chars)
- Toast al completar la acción

**Archivos a modificar:**
```
app/(admin)/workflows/page.tsx        ← MODIFICAR
```

---

### M-09 — Unit tests para utilidades

**Problema:** No existen unit tests. Solo hay tests E2E con Playwright en `/e2e/`.

**Solución propuesta — tests con Vitest (ya compatible con Next.js sin instalación extra en algunos setups):**
- `lib/format.ts` → test de `formatDate`, `formatDateTime`, `formatNumber`, `formatPercent`
- `lib/api/client.ts` → test del guard 204/null en `apiFetch`
- `lib/mock/entities.ts` → test de `generateEntities` (count, tipos, rangos)

**Archivos a crear:**
```
lib/format.test.ts
lib/api/client.test.ts
lib/mock/entities.test.ts
```

---

## Resumen de esfuerzo estimado

| ID | Mejora | Archivos | Complejidad |
|----|--------|----------|-------------|
| M-01 | Analyst Explore funcional | 2 | Media |
| M-02 | Toasts en acciones | 3 | Baja |
| M-03 | Loading & empty states | 5 + 1 nuevo | Media |
| M-04 | Reports con descarga CSV | 2 | Baja |
| M-05 | Detalle de modelo `/[id]` | 2 | Media |
| M-06 | Responsive móvil sidebar | 1 | Media |
| M-07 | Entities modal edición | 2 | Alta |
| M-08 | Workflows confirmación Dialog | 1 | Baja |
| M-09 | Unit tests | 3 nuevos | Media |

**Total estimado: 9 mejoras · 13 archivos modificados · 8 archivos nuevos · 0 dependencias nuevas**
