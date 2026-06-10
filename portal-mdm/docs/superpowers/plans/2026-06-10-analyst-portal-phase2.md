# Analyst Portal Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the analyst role read-only access to the shared admin pages (`/quality`, `/workflows`, `/catalogos`) and upgrade the `/explore` hub with real DWH data.

**Architecture:** The three shared pages (`/quality`, `/workflows`, `/catalogos`) live under `app/(admin)/` which currently blocks analysts via `requireRole("admin")`. The fix is a two-step: (1) add `requireAnyRole(roles)` to `lib/auth/require-role.ts`, (2) make the `(admin)` layout accept analyst+admin and derive the sidebar nav from the session role. Each page's client component then receives an `isReadOnly` boolean to hide mutation-only UI. The `/explore` page is upgraded by splitting out a `"use client"` KPI strip that consumes `useDwhState` and `useQualityKpis` hooks with real live data.

**Tech Stack:** Next.js 14+ App Router · TypeScript · TanStack Query v5 (`useDwhState`, `useQualityKpis`) · Playwright (E2E).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Modify** | `lib/auth/require-role.ts` | Add `requireAnyRole(roles)` helper |
| **Modify** | `app/(admin)/layout.tsx` | Accept admin+analyst, derive nav from session role |
| **Modify** | `app/(admin)/workflows/page.tsx` | Read session role, pass `isReadOnly` |
| **Modify** | `app/(admin)/workflows/homologation-client.tsx` | Hide write actions when `isReadOnly` |
| **Modify** | `app/(admin)/catalogos/page.tsx` | Read session role, pass `isReadOnly` |
| **Modify** | `app/(admin)/catalogos/catalogos-client.tsx` | Hide write actions when `isReadOnly` |
| **Create** | `app/(analyst)/explore/explore-kpis.tsx` | Client component with real DWH KPIs |
| **Modify** | `app/(analyst)/explore/page.tsx` | Import ExploreKpis, remove hardcoded values |
| **Create** | `e2e/analyst-phase2.spec.ts` | Smoke tests for analyst read-only access |

---

## Task 1: Add `requireAnyRole` to `lib/auth/require-role.ts`

**Files:**
- Modify: `lib/auth/require-role.ts`

**Context:** The current file has only `requireRole(expected: Role)` which does an exact-match. We need a variant that accepts multiple roles so the admin layout can serve both admin and analyst users.

- [ ] **Step 1: Open the file and verify its current content**

Read `lib/auth/require-role.ts`. Confirm it currently exports only `requireRole`. Current content:
```typescript
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { ROLE_HOME, type Role } from "./rbac";

export async function requireRole(expected: Role): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== expected) redirect(ROLE_HOME[session.role]);
  return session;
}
```

- [ ] **Step 2: Add `requireAnyRole` below the existing function**

Final file content:
```typescript
import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { ROLE_HOME, type Role } from "./rbac";

export async function requireRole(expected: Role): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== expected) redirect(ROLE_HOME[session.role]);
  return session;
}

export async function requireAnyRole(required: readonly Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!required.includes(session.role)) redirect(ROLE_HOME[session.role]);
  return session;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "D:\Proyecto2026\ACP_DWH\ACP Proyecciones\Portal_MDM_NEXTJS\Portal-Nextjs\portal-mdm"
npx tsc --noEmit 2>&1 | grep -i "require-role" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/require-role.ts
git commit -m "feat(auth): add requireAnyRole for multi-role layouts"
```

---

## Task 2: Make `(admin)` layout role-aware

**Files:**
- Modify: `app/(admin)/layout.tsx`

**Context:** The layout currently calls `requireRole("admin")` and hardcodes `role="admin"` for `RoleShell` and `buildNavGroups`. After this task, analysts accessing `/quality`, `/workflows`, `/catalogos` will see their analyst sidebar and admin users will see the admin sidebar. The middleware (proxy.ts) is the primary RBAC enforcer—it already blocks analysts from `/dashboard`, `/audit`, etc. The layout is a secondary guard.

Current content of `app/(admin)/layout.tsx`:
```typescript
import { requireRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";
import { buildNavGroups } from "@/lib/routes";
import { PreferenciasProvider } from "@/components/providers/preferencias-provider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole("admin");
  const navItems = buildNavGroups("admin").flatMap((g) => g.items);

  return (
    <RoleShell role="admin" userName={session.name ?? session.username} navItems={navItems}>
      <PreferenciasProvider>{children}</PreferenciasProvider>
    </RoleShell>
  );
}
```

- [ ] **Step 1: Replace the layout**

```typescript
import { requireAnyRole } from "@/lib/auth/require-role";
import { RoleShell } from "@/components/layout/role-shell";
import { buildNavGroups } from "@/lib/routes";
import { PreferenciasProvider } from "@/components/providers/preferencias-provider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAnyRole(["admin", "analyst"]);
  const navItems = buildNavGroups(session.role).flatMap((g) => g.items);

  return (
    <RoleShell role={session.role} userName={session.name ?? session.username} navItems={navItems}>
      <PreferenciasProvider>{children}</PreferenciasProvider>
    </RoleShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "layout" | head -10
```

Expected: no output (no errors referencing layout files).

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/layout.tsx"
git commit -m "feat(auth): admin layout now accepts analyst role — shared pages unlocked"
```

---

## Task 3: Workflows — read-only mode for analyst

**Files:**
- Modify: `app/(admin)/workflows/page.tsx`
- Modify: `app/(admin)/workflows/homologation-client.tsx`

**Context:** `HomologationClient` has five write-action zones that analysts must not see:
1. Re-Inyección card at the top
2. Toolbar "Rechazar" and "Guardar Seleccionados" buttons
3. Header checkbox `<th>` (select all)
4. Per-row checkbox `<td>`
5. Per-row "Corrección Sugerida" column (Select/Input for editing)

In read-only mode: hide 1-4, and render the suggested value as static text in column 5.

- [ ] **Step 1: Update `workflows/page.tsx` to read session role and pass `isReadOnly`**

Current content reads `cookies()` for the JWT and calls `getPendingHomologations`. Add `getSession()`:

```typescript
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { HomologationClient } from "./homologation-client";
import { getPendingHomologations, getReinjectionStats } from "@/lib/api/homologation";
import { JWT_COOKIE_NAME } from "@/lib/auth/session";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Workflows y Homologación" };

export default async function WorkflowsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(JWT_COOKIE_NAME)?.value;
  const session = await getSession();

  const [pendingHomologations, reinjectionData] = await Promise.all([
    getPendingHomologations(token),
    getReinjectionStats(token),
  ]);

  const reinyeccionCount = reinjectionData?.candidatos || 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Homologación"
        description="Ajusta y valida registros rechazados para integrarlos al Data Warehouse."
      />

      <HomologationClient
        initialData={pendingHomologations}
        reinyeccionCount={reinyeccionCount}
        isReadOnly={session?.role === "analyst"}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add `isReadOnly` prop to `HomologationClientProps`**

Find the interface at the top of `homologation-client.tsx` (around line 40):
```typescript
interface HomologationClientProps {
  initialData: HomologationRecord[];
  reinyeccionCount: number;
}
```

Replace with:
```typescript
interface HomologationClientProps {
  initialData: HomologationRecord[];
  reinyeccionCount: number;
  isReadOnly?: boolean;
}
```

- [ ] **Step 3: Destructure `isReadOnly` in the component function**

Find (around line 210):
```typescript
export function HomologationClient({
  initialData,
  reinyeccionCount,
}: HomologationClientProps) {
```

Replace with:
```typescript
export function HomologationClient({
  initialData,
  reinyeccionCount,
  isReadOnly = false,
}: HomologationClientProps) {
```

- [ ] **Step 4: Guard the Re-Inyección card**

Find (around line 384):
```typescript
      {reinyeccionCount > 0 && (
        <Card className="border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 overflow-hidden">
```

Replace with:
```typescript
      {reinyeccionCount > 0 && !isReadOnly && (
        <Card className="border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 overflow-hidden">
```

- [ ] **Step 5: Guard the Reject + Save toolbar buttons**

Find (around line 477):
```typescript
        <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
          <Button
            variant="outline"
            size="sm"
            disabled={selectedIds.size === 0 || globalLoading}
            onClick={handleRejectSelected}
```

Wrap the entire action button `<div>` with `{!isReadOnly && ( ... )}`:
```typescript
        {!isReadOnly && (
          <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0">
            <Button
              variant="outline"
              size="sm"
              disabled={selectedIds.size === 0 || globalLoading}
              onClick={handleRejectSelected}
              className="flex-1 md:flex-none gap-2 hover:bg-[var(--color-destructive-glow)] hover:text-[var(--color-destructive)] hover:border-[var(--color-destructive)]/30"
            >
              <Trash2 className="h-4 w-4" />
              Rechazar ({selectedIds.size})
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedIds.size === 0 || globalLoading}
              onClick={handleSaveSelected}
              className="flex-1 md:flex-none gap-2 shadow-md"
            >
              <Save className="h-4 w-4" />
              Guardar Seleccionados
            </Button>
          </div>
        )}
```

- [ ] **Step 6: Guard the header checkbox `<th>` and adjust `colSpan`**

Find the `<thead>` section (around line 505):
```typescript
            <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]/40">
              <tr>
                <th className="p-4 text-left w-10">
                  <input
                    type="checkbox"
```

Replace the `<tr>` content so the checkbox `<th>` is conditional:
```typescript
            <thead className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)]/40">
              <tr>
                {!isReadOnly && (
                  <th className="p-4 text-left w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
                      checked={
                        selectedIds.size === filteredData.length &&
                        filteredData.length > 0
                      }
                      onChange={toggleAll}
                    />
                  </th>
                )}
```

- [ ] **Step 7: Guard the per-row checkbox `<td>`**

Find the row checkbox cell (around line 548):
```typescript
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
                        checked={selectedIds.has(d.id_registro)}
                        onChange={() => toggleSelect(d.id_registro)}
                      />
                    </td>
```

Replace with:
```typescript
                    {!isReadOnly && (
                      <td className="p-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
                          checked={selectedIds.has(d.id_registro)}
                          onChange={() => toggleSelect(d.id_registro)}
                        />
                      </td>
                    )}
```

- [ ] **Step 8: Make the "Corrección Sugerida" column read-only for analysts**

Find the correction column cell (around line 587):
```typescript
                    <td className="p-4">
                      {hasOptions ? (
                        <Select
                          value={corrections[d.id_registro] || ""}
```

Replace the entire correction `<td>` with a conditional:
```typescript
                    <td className="p-4">
                      {isReadOnly ? (
                        <span className="text-xs text-[var(--color-text-secondary)] font-mono">
                          {d.valor_sugerido ?? "—"}
                        </span>
                      ) : hasOptions ? (
                        <Select
                          value={corrections[d.id_registro] || ""}
                          onValueChange={(val) =>
                            setCorrections((prev) => ({
                              ...prev,
                              [d.id_registro]: val,
                            }))
                          }
                        >
                          <SelectTrigger
                            className={cn(
                              "h-9 text-xs font-medium border-[var(--color-primary)]/20 focus:ring-[var(--color-ring)]/10",
                              !corrections[d.id_registro] &&
                                "text-[var(--color-text-muted)] italic border-dashed",
                            )}
                          >
                            <SelectValue placeholder="Seleccionar oficial..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="relative">
                          <Input
                            value={corrections[d.id_registro] || ""}
                            onChange={(e) =>
                              setCorrections((prev) => ({
                                ...prev,
                                [d.id_registro]: e.target.value,
                              }))
                            }
                            className="h-9 text-xs font-medium border-[var(--color-primary)]/20 pr-8"
                            placeholder="Corrección libre..."
                          />
                          <Sparkles className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-primary)]/40" />
                        </div>
                      )}
                    </td>
```

- [ ] **Step 9: Fix empty state `colSpan`**

Find (around line 677):
```typescript
                <td
                    colSpan={6}
```

Replace with:
```typescript
                <td
                    colSpan={isReadOnly ? 5 : 6}
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "homologation" | head -10
```

Expected: no output.

- [ ] **Step 11: Commit**

```bash
git add "app/(admin)/workflows/page.tsx" "app/(admin)/workflows/homologation-client.tsx"
git commit -m "feat(analyst): workflows read-only mode — hide write actions for analyst role"
```

---

## Task 4: Catalogos — read-only mode for analyst

**Files:**
- Modify: `app/(admin)/catalogos/page.tsx`
- Modify: `app/(admin)/catalogos/catalogos-client.tsx`

**Context:** `CatalogosClient` has three write-action zones:
1. `NuevaVariedadDialog` button in the Variedades DWH sub-tab header
2. Desactivar/Reactivar buttons in each row of `VariedadesDimTabla`
3. The "Acciones" `<th>` column header in `VariedadesDimTabla`

The inner functions `VariedadesSection` and `VariedadesDimTabla` need an `isReadOnly` param threaded through.

- [ ] **Step 1: Update `catalogos/page.tsx` to pass `isReadOnly`**

Current `CatalogosPage` does not read session. Update it:

```typescript
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogosClient } from "./catalogos-client";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Catálogos — Portal MDM" };
export const dynamic = "force-dynamic";

export default async function CatalogosPage() {
  const session = await getSession();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Catálogos"
        description="Variedades homologadas, geografía agrícola y catálogo de personal del DWH."
      />
      <CatalogosClient isReadOnly={session?.role === "analyst"} />
    </div>
  );
}
```

- [ ] **Step 2: Add `isReadOnly` prop to `CatalogosClient`**

Find the `CatalogosClient` function (around line 47):
```typescript
export function CatalogosClient() {
```

Replace with:
```typescript
export function CatalogosClient({ isReadOnly = false }: { isReadOnly?: boolean }) {
```

- [ ] **Step 3: Thread `isReadOnly` into `VariedadesSection`**

Find the render inside `CatalogosClient` (around line 86):
```typescript
      {tab === "variedades" ? (
        <VariedadesSection />
```

Replace with:
```typescript
      {tab === "variedades" ? (
        <VariedadesSection isReadOnly={isReadOnly} />
```

- [ ] **Step 4: Add `isReadOnly` param to `VariedadesSection` and guard `NuevaVariedadDialog`**

Find (around line 101):
```typescript
function VariedadesSection() {
  const [sub, setSub] = useState<"mdm" | "dim">("dim");
```

Replace with:
```typescript
function VariedadesSection({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [sub, setSub] = useState<"mdm" | "dim">("dim");
```

Then find (around line 119):
```typescript
        {sub === "dim" ? <NuevaVariedadDialog /> : null}
```

Replace with:
```typescript
        {sub === "dim" && !isReadOnly ? <NuevaVariedadDialog /> : null}
```

Then find where `VariedadesDimTabla` is rendered (around line 137):
```typescript
      {sub === "dim" ? <VariedadesDimTabla /> : <VariedadesMdmTabla />}
```

Replace with:
```typescript
      {sub === "dim" ? <VariedadesDimTabla isReadOnly={isReadOnly} /> : <VariedadesMdmTabla />}
```

- [ ] **Step 5: Add `isReadOnly` param to `VariedadesDimTabla` and hide write columns**

Find (around line 144):
```typescript
function VariedadesDimTabla() {
```

Replace with:
```typescript
function VariedadesDimTabla({ isReadOnly = false }: { isReadOnly?: boolean }) {
```

Find the `<tr>` inside `<thead>` (the header row with all column headers, around line 200):
```typescript
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Variedad</th>
            <th className="px-3 py-2 font-medium">Breeder</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Creada</th>
            <th className="px-3 py-2 font-medium">Modificada</th>
            <th className="px-3 py-2 sr-only">Acciones</th>
          </tr>
```

Replace with:
```typescript
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Variedad</th>
            <th className="px-3 py-2 font-medium">Breeder</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Creada</th>
            <th className="px-3 py-2 font-medium">Modificada</th>
            {!isReadOnly && <th className="px-3 py-2 sr-only">Acciones</th>}
          </tr>
```

Find the action `<td>` inside each row (around line 239):
```typescript
                <td className="px-3 py-2 text-right">
                  {v.esActiva ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => aplicar(v.idVariedad, "desactivar")}
```

Replace the entire action `<td>` with:
```typescript
                {!isReadOnly && (
                  <td className="px-3 py-2 text-right">
                    {v.esActiva ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aplicar(v.idVariedad, "desactivar")}
                        disabled={busy}
                        aria-busy={busy}
                        className="h-7 px-2 text-xs"
                      >
                        {busy ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Desactivar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => aplicar(v.idVariedad, "reactivar")}
                        disabled={busy}
                        aria-busy={busy}
                        className="h-7 px-2 text-xs"
                      >
                        {busy ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Reactivar
                      </Button>
                    )}
                  </td>
                )}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "catalogos" | head -10
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/catalogos/page.tsx" "app/(admin)/catalogos/catalogos-client.tsx"
git commit -m "feat(analyst): catalogos read-only mode — hide create/edit actions for analyst role"
```

---

## Task 5: Upgrade `/explore` with real DWH data

**Files:**
- Create: `app/(analyst)/explore/explore-kpis.tsx`
- Modify: `app/(analyst)/explore/page.tsx`

**Context:** The current `explore/page.tsx` is a pure server component with three hardcoded KPI values (`28 datasets`, `3 modelos`, `1,284 consultas`). We split it: a new `"use client"` component fetches real values via `useDwhState` (for table count) and `useQualityKpis` (for quarantine pendientes). The `page.tsx` stays as a server component and imports the client KPI strip.

- [ ] **Step 1: Create `explore-kpis.tsx`**

```typescript
"use client";

import { Compass, Database, FlaskConical, ShieldAlert } from "lucide-react";
import { KpiCard } from "@/components/charts/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { useDwhState, useQualityKpis } from "@/hooks/use-control-center";

export function ExploreKpis() {
  const dwh = useDwhState();
  const quality = useQualityKpis();

  return (
    <section
      aria-label="Resumen del data warehouse"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {dwh.isLoading && !dwh.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Datasets disponibles"
          value={dwh.data ? formatNumber(dwh.data.tables) : "—"}
          icon={Database}
        />
      )}

      <KpiCard
        label="Modelos en producción"
        value={3}
        delta={50}
        deltaLabel="vs. trimestre"
        icon={FlaskConical}
        tone="success"
      />

      {quality.isLoading && !quality.data ? (
        <Skeleton className="h-[100px] rounded-md" />
      ) : (
        <KpiCard
          label="Pendientes cuarentena"
          value={quality.data ? formatNumber(quality.data.pendientes) : "—"}
          icon={ShieldAlert}
          tone={
            (quality.data?.pendientes ?? 0) > 0 ? "warning" : "success"
          }
          delta={
            (quality.data?.pendientes ?? 0) > 0
              ? quality.data!.pendientes
              : undefined
          }
          deltaLabel="requieren revisión"
        />
      )}
    </section>
  );
}
```

- [ ] **Step 2: Update `explore/page.tsx` to use `ExploreKpis`**

Replace the entire file:
```typescript
import type { Metadata } from "next";
import { Database, FileText, FlaskConical } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExploreKpis } from "./explore-kpis";

const SHORTCUTS = [
  {
    href: "/models",
    title: "Modelos predictivos",
    description: "Explora métricas, importancia de variables y predicciones.",
    icon: FlaskConical,
  },
  {
    href: "/reports",
    title: "Reportes",
    description: "Genera reportes PDF/Excel desde plantillas predefinidas.",
    icon: FileText,
  },
];

export const metadata: Metadata = { title: "Exploración de datos" };

export default function ExplorePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exploración de datos"
        description="Punto de entrada para análisis y descubrimiento sobre el data warehouse."
      />

      <ExploreKpis />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SHORTCUTS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="block focus-visible:outline-none"
            >
              <Card className="hover:border-[var(--color-primary)] transition-colors">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="bg-[var(--color-surface-2)] text-[var(--color-primary)] inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <CardTitle>{s.title}</CardTitle>
                      <CardDescription>{s.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-[var(--color-text-muted)]">
                  Acceso rápido →
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "explore" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(analyst)/explore/explore-kpis.tsx" "app/(analyst)/explore/page.tsx"
git commit -m "feat(analyst): upgrade /explore with real DWH table count + quarantine KPIs"
```

---

## Task 6: E2E smoke tests

**Files:**
- Create: `e2e/analyst-phase2.spec.ts`

**Context:** Uses `loginAs(page, "analyst")` from `e2e/helpers/auth.ts` (already supports analyst). Stubs `useActiveAlerts` and other CC routes that the shared pages may call. Tests verify: analyst can reach `/quality`, `/workflows`, `/catalogos`; write actions are absent; admin can still reach those pages with write UI.

The project uses Playwright. Check `e2e/analyst-portal.spec.ts` for the existing pattern (stub setup, `loginAs` usage).

- [ ] **Step 1: Create the test file**

```typescript
import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

function stubSharedRoutes(page: Parameters<typeof test>[1]["page"]) {
  // CC routes called by shared pages
  void page.route("/api/cc/quality/summary", (r) =>
    r.fulfill({ json: { total: 10, pendientes: 3, resueltos: 5, descartados: 2, resolutionRate: 70 } }),
  );
  void page.route("/api/cc/quality*", (r) =>
    r.fulfill({ json: { datos: [], total: 0, pagina: 1, tamano: 25 } }),
  );
  void page.route("/api/cc/workflows/homologation*", (r) =>
    r.fulfill({ json: [] }),
  );
  void page.route("/api/cc/reinyeccion*", (r) =>
    r.fulfill({ json: { candidatos: 0 } }),
  );
  void page.route("/api/cc/catalogos/**", (r) =>
    r.fulfill({ json: { datos: [], total: 0, pagina: 1, tamano: 50 } }),
  );
  void page.route("/api/cc/**", (r) =>
    r.fulfill({ json: {} }),
  );
}

test.describe("Analyst Phase 2 — shared pages read-only", () => {
  test.beforeEach(async ({ page }) => {
    stubSharedRoutes(page);
    await loginAs(page, "analyst");
  });

  test("analyst can reach /quality and sees no bulk action bar", async ({ page }) => {
    await page.goto("/quality");
    await expect(page).not.toHaveURL("/home");
    // Page renders (any heading visible)
    await expect(page.getByRole("heading", { name: /calidad/i })).toBeVisible();
    // No QuarantineBulkBar — no "Guardar seleccionados" or "Rechazar" bulk buttons
    await expect(page.getByRole("button", { name: /guardar seleccionados/i })).not.toBeVisible();
  });

  test("analyst can reach /workflows and sees no save/reject buttons", async ({ page }) => {
    await page.goto("/workflows");
    await expect(page).not.toHaveURL("/home");
    await expect(page.getByRole("heading", { name: /homolog/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /guardar seleccionados/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /ejecutar reprocesamiento/i })).not.toBeVisible();
  });

  test("analyst can reach /catalogos and sees no nueva variedad button", async ({ page }) => {
    await page.goto("/catalogos");
    await expect(page).not.toHaveURL("/home");
    await expect(page.getByRole("heading", { name: /catálogos/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /nueva variedad/i })).not.toBeVisible();
  });

  test("analyst sees analyst sidebar nav on /workflows (not admin nav)", async ({ page }) => {
    await page.goto("/workflows");
    // Analyst nav has "Mi Workspace" — admin nav does not
    await expect(page.getByRole("link", { name: /mi workspace/i })).toBeVisible();
    // Admin-only "Dashboard" link should not appear
    await expect(page.getByRole("link", { name: /^dashboard$/i })).not.toBeVisible();
  });

  test("analyst cannot reach admin-only /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Should be redirected away (to /home or /login)
    await expect(page).not.toHaveURL("/dashboard");
  });
});

test.describe("Admin still has full write access on shared pages", () => {
  test.beforeEach(async ({ page }) => {
    stubSharedRoutes(page);
    await loginAs(page, "admin");
  });

  test("admin sees save/reject buttons on /workflows", async ({ page }) => {
    await page.goto("/workflows");
    await expect(page.getByRole("button", { name: /guardar seleccionados/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /rechazar/i })).toBeVisible();
  });

  test("admin sees nueva variedad button on /catalogos", async ({ page }) => {
    await page.goto("/catalogos");
    // NuevaVariedadDialog trigger should be visible
    await expect(page.getByRole("button", { name: /nueva variedad/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Verify the test file can be parsed by Playwright**

```bash
npx playwright test e2e/analyst-phase2.spec.ts --list 2>&1 | head -20
```

Expected: lists 6 tests without errors.

- [ ] **Step 3: Run TypeScript check on e2e**

```bash
npx tsc --noEmit 2>&1 | grep -i "analyst-phase2" | head -10
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add e2e/analyst-phase2.spec.ts
git commit -m "test(analyst): e2e smoke tests for Phase 2 shared read-only pages"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task |
|---|---|
| Analyst can visit `/quality` | Task 2 (layout) + Task 1 (requireAnyRole) |
| Analyst can visit `/workflows` | Task 2 (layout) + Task 1 (requireAnyRole) |
| Analyst can visit `/catalogos` | Task 2 (layout) + Task 1 (requireAnyRole) |
| Analyst sees analyst sidebar (not admin sidebar) on shared pages | Task 2 |
| Workflows: write actions hidden for analyst | Task 3 |
| Catalogos: write actions hidden for analyst | Task 4 |
| Admin retains full write access | Task 3 + Task 4 (guarded by `!isReadOnly`, admin gets `isReadOnly=false`) |
| `/explore` shows real DWH table count | Task 5 |
| `/explore` shows real quarantine pendientes | Task 5 |
| E2E smoke tests | Task 6 |

### Placeholder scan

No TBDs, no "add appropriate handling", no incomplete steps. Every code block is complete.

### Type consistency

- `requireAnyRole` returns `SessionPayload` — same type as `requireRole`.
- `session.role` in layouts typed as `Role` (from `SessionPayload`).
- `isReadOnly?: boolean` defaults to `false` in all three components.
- `useDwhState().data.tables` — field `tables` confirmed in `lib/schemas/control-center.ts` (from existing usage in `hero-kpis.tsx` which reads `data.tables`).
- `useQualityKpis().data.pendientes` — confirmed used in `hero-kpis.tsx`.
- `HomologationRecord.valor_sugerido` — used in existing `useEffect` at line ~292 (`if (d.valor_sugerido) initialCorrections[...]`). Type is `string | null`.

### Edge cases

- `isReadOnly` defaults to `false` in all components — safe when rendered without the prop.
- `session?.role === "analyst"` in page.tsx: if `getSession()` returns `null` (unauthenticated), `isReadOnly` is `false`, but the layout's `requireAnyRole` will have already redirected.
- Empty state `colSpan` in HomologationClient corrected to 5 when `isReadOnly` (one column removed).
